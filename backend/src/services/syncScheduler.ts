import getPrismaClient from '../config/database';
import plaidService from './plaidService';
import transactionService from './transactionService';

const prisma = getPrismaClient();

interface SyncResult {
  accountId: string;
  success: boolean;
  imported?: number;
  duplicates?: number;
  error?: string;
  retryCount?: number;
}

export class SyncScheduler {
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_RETRIES = 3;
  private readonly BASE_RETRY_DELAY_MS = 60 * 60 * 1000; // 1 hour
  private retryQueue: Map<string, { retryCount: number; nextRetry: Date }> = new Map();

  /**
   * Start the scheduled sync job
   */
  start(): void {
    if (this.syncInterval) {
      console.log('Sync scheduler already running');
      return;
    }

    console.log('Starting transaction sync scheduler');
    
    // Run initial sync after 1 minute
    setTimeout(() => this.runDailySync(), 60 * 1000);

    // Schedule daily sync
    this.syncInterval = setInterval(() => {
      this.runDailySync();
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Stop the scheduled sync job
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Sync scheduler stopped');
    }
  }

  /**
   * Run daily sync for all active accounts
   */
  private async runDailySync(): Promise<void> {
    console.log('Starting daily transaction sync...');

    try {
      // Get all active accounts
      const accounts = await prisma.plaidAccount.findMany({
        where: { isActive: true },
        select: {
          id: true,
          userId: true,
          accountName: true,
          lastSyncedAt: true,
        },
      });

      console.log(`Found ${accounts.length} active accounts to sync`);

      const results: SyncResult[] = [];

      // Sync each account
      for (const account of accounts) {
        // Check if account is in retry queue and not ready yet
        const retryInfo = this.retryQueue.get(account.id);
        if (retryInfo && retryInfo.nextRetry > new Date()) {
          console.log(
            `Skipping account ${account.id} - retry scheduled for ${retryInfo.nextRetry.toISOString()}`
          );
          continue;
        }

        const result = await this.syncAccount(account.id, account.userId);
        results.push(result);

        // Handle retry logic
        if (!result.success) {
          await this.handleSyncFailure(account.id, result.error || 'Unknown error');
        } else {
          // Remove from retry queue on success
          this.retryQueue.delete(account.id);
        }

        // Add small delay between accounts to avoid rate limiting
        await this.delay(1000);
      }

      // Log summary
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const totalImported = results.reduce((sum, r) => sum + (r.imported || 0), 0);

      console.log(
        `Daily sync completed: ${successful} successful, ${failed} failed, ${totalImported} transactions imported`
      );
    } catch (error: any) {
      console.error('Error during daily sync:', error.message);
    }
  }

  /**
   * Sync a single account
   */
  private async syncAccount(accountId: string, userId: string): Promise<SyncResult> {
    try {
      console.log(`Syncing account ${accountId}...`);

      // Fetch transactions from Plaid
      const plaidTransactions = await plaidService.syncTransactions(accountId, userId);

      // Import transactions
      const importResult = await transactionService.importTransactions(
        plaidTransactions,
        accountId,
        userId
      );

      console.log(
        `Account ${accountId} synced: ${importResult.imported} imported, ${importResult.duplicates} duplicates`
      );

      return {
        accountId,
        success: true,
        imported: importResult.imported,
        duplicates: importResult.duplicates,
      };
    } catch (error: any) {
      console.error(`Error syncing account ${accountId}:`, error.message);
      return {
        accountId,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle sync failure with exponential backoff
   */
  private async handleSyncFailure(accountId: string, error: string): Promise<void> {
    const retryInfo = this.retryQueue.get(accountId) || { retryCount: 0, nextRetry: new Date() };
    retryInfo.retryCount++;

    if (retryInfo.retryCount <= this.MAX_RETRIES) {
      // Calculate exponential backoff: 1 hour * 2^(retryCount-1)
      const delayMs = this.BASE_RETRY_DELAY_MS * Math.pow(2, retryInfo.retryCount - 1);
      retryInfo.nextRetry = new Date(Date.now() + delayMs);

      this.retryQueue.set(accountId, retryInfo);

      console.log(
        `Account ${accountId} sync failed (attempt ${retryInfo.retryCount}/${this.MAX_RETRIES}). ` +
          `Next retry at ${retryInfo.nextRetry.toISOString()}`
      );

      // Log error to database
      await this.logSyncError(accountId, error, retryInfo.retryCount);

      // Schedule retry
      setTimeout(() => {
        this.retrySync(accountId);
      }, delayMs);
    } else {
      console.error(
        `Account ${accountId} sync failed after ${this.MAX_RETRIES} retries. Giving up.`
      );
      this.retryQueue.delete(accountId);
      await this.logSyncError(accountId, `Max retries exceeded: ${error}`, retryInfo.retryCount);
    }
  }

  /**
   * Retry syncing a specific account
   */
  private async retrySync(accountId: string): Promise<void> {
    try {
      const account = await prisma.plaidAccount.findUnique({
        where: { id: accountId },
        select: { userId: true, isActive: true },
      });

      if (!account || !account.isActive) {
        console.log(`Account ${accountId} no longer active, skipping retry`);
        this.retryQueue.delete(accountId);
        return;
      }

      console.log(`Retrying sync for account ${accountId}...`);
      const result = await this.syncAccount(accountId, account.userId);

      if (!result.success) {
        await this.handleSyncFailure(accountId, result.error || 'Unknown error');
      } else {
        this.retryQueue.delete(accountId);
        console.log(`Retry successful for account ${accountId}`);
      }
    } catch (error: any) {
      console.error(`Error during retry for account ${accountId}:`, error.message);
      await this.handleSyncFailure(accountId, error.message);
    }
  }

  /**
   * Log sync error (simple console logging for now)
   */
  private async logSyncError(accountId: string, error: string, retryCount: number): Promise<void> {
    const timestamp = new Date().toISOString();
    console.error(
      `[${timestamp}] SYNC_ERROR - Account: ${accountId}, Retry: ${retryCount}, Error: ${error}`
    );
    
    // In a production system, you would store this in a database table or external logging service
  }

  /**
   * Manual sync trigger for a specific account
   */
  async manualSync(accountId: string, userId: string): Promise<SyncResult> {
    console.log(`Manual sync triggered for account ${accountId}`);
    return await this.syncAccount(accountId, userId);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get retry queue status (for monitoring)
   */
  getRetryQueueStatus(): Array<{ accountId: string; retryCount: number; nextRetry: Date }> {
    return Array.from(this.retryQueue.entries()).map(([accountId, info]) => ({
      accountId,
      retryCount: info.retryCount,
      nextRetry: info.nextRetry,
    }));
  }
}

export default new SyncScheduler();
