import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import getPrismaClient from '../config/database';
import crypto from 'crypto';
import transactionService from './transactionService';

const prisma = getPrismaClient();

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Encryption utilities for access tokens
const ALGORITHM = 'aes-256-cbc';

// Convert hex string to 32-byte buffer for AES-256
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY || '';
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY not configured');
  }
  // If it's a hex string, convert it to buffer
  if (keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }
  // Otherwise, hash it to get exactly 32 bytes
  return crypto.createHash('sha256').update(keyHex).digest();
}

function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey();
  const parts = encryptedToken.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

export class PlaidService {
  /**
   * Create a Plaid Link token for the user to initiate account linking
   */
  async createLinkToken(userId: string): Promise<string> {
    try {
      const response = await plaidClient.linkTokenCreate({
        user: {
          client_user_id: userId,
        },
        client_name: 'Budget App',
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
      });

      return response.data.link_token;
    } catch (error: any) {
      console.error('Error creating link token:', error.response?.data || error.message);
      throw new Error('Failed to create Plaid link token');
    }
  }

  /**
   * Exchange public token for access token and store account information
   */
  async exchangePublicToken(publicToken: string, userId: string): Promise<void> {
    try {
      // Exchange public token for access token
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const accessToken = exchangeResponse.data.access_token;
      const itemId = exchangeResponse.data.item_id;

      // Fetch account information
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });

      const accounts = accountsResponse.data.accounts;

      // Store each account with encrypted access token
      const encryptedAccessToken = encryptToken(accessToken);

      const createdAccounts = [];
      for (const account of accounts) {
        const createdAccount = await prisma.plaidAccount.create({
          data: {
            userId,
            plaidAccountId: account.account_id,
            plaidAccessToken: encryptedAccessToken,
            plaidItemId: itemId,
            accountName: account.name,
            accountType: account.type,
            accountSubtype: account.subtype || '',
            currentBalance: account.balances.current || 0,
            availableBalance: account.balances.available || 0,
            lastSyncedAt: new Date(),
            isActive: true,
          },
        });
        createdAccounts.push(createdAccount);
      }

      // Sync initial transactions for each account
      for (const account of createdAccounts) {
        try {
          await this.syncTransactions(account.id, userId);
        } catch (syncError: any) {
          console.error(`Failed to sync initial transactions for account ${account.id}:`, syncError.message);
          // Don't fail the whole operation if initial sync fails
        }
      }
    } catch (error: any) {
      console.error('Error exchanging public token:', error.response?.data || error.message);
      throw new Error('Failed to exchange public token');
    }
  }

  /**
   * Get all accounts for a user
   */
  async getAccounts(userId: string): Promise<any[]> {
    try {
      const accounts = await prisma.plaidAccount.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          id: true,
          accountName: true,
          accountType: true,
          accountSubtype: true,
          currentBalance: true,
          availableBalance: true,
          lastSyncedAt: true,
          createdAt: true,
        },
      });

      return accounts;
    } catch (error: any) {
      console.error('Error fetching accounts:', error.message);
      throw new Error('Failed to fetch accounts');
    }
  }

  /**
   * Remove an account and revoke Plaid access token
   */
  async removeAccount(accountId: string, userId: string): Promise<void> {
    try {
      // Fetch the account
      const account = await prisma.plaidAccount.findFirst({
        where: {
          id: accountId,
          userId,
        },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Decrypt access token
      const accessToken = decryptToken(account.plaidAccessToken);

      // Revoke the access token with Plaid
      try {
        await plaidClient.itemRemove({
          access_token: accessToken,
        });
      } catch (plaidError: any) {
        console.error('Error revoking Plaid token:', plaidError.response?.data || plaidError.message);
        // Continue with local deletion even if Plaid revocation fails
      }

      // Mark account as inactive
      await prisma.plaidAccount.update({
        where: { id: accountId },
        data: { isActive: false },
      });
    } catch (error: any) {
      console.error('Error removing account:', error.message);
      throw new Error('Failed to remove account');
    }
  }

  /**
   * Sync transactions from Plaid for a specific account
   */
  async syncTransactions(accountId: string, userId: string): Promise<any[]> {
    try {
      // Fetch the account
      const account = await prisma.plaidAccount.findFirst({
        where: {
          id: accountId,
          userId,
          isActive: true,
        },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Decrypt access token
      const accessToken = decryptToken(account.plaidAccessToken);

      // Get cursor for incremental sync
      let cursor = account.syncCursor || undefined;
      let hasMore = true;
      const allTransactions: any[] = [];

      // Fetch transactions using sync endpoint with pagination
      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: accessToken,
          cursor: cursor,
        });

        const { added, modified, removed, next_cursor, has_more } = response.data;

        console.log(`Plaid sync response: added=${added.length}, modified=${modified.length}, removed=${removed.length}, has_more=${has_more}`);

        // Process added transactions
        allTransactions.push(...added);

        // Update cursor and pagination flag
        cursor = next_cursor;
        hasMore = has_more;
      }

      console.log(`Total transactions fetched from Plaid: ${allTransactions.length}`);

      // Update the sync cursor and last synced time
      await prisma.plaidAccount.update({
        where: { id: accountId },
        data: {
          syncCursor: cursor,
          lastSyncedAt: new Date(),
        },
      });

      // Import transactions into database
      if (allTransactions.length > 0) {
        await transactionService.importTransactions(allTransactions, accountId, userId);
      }

      return allTransactions;
    } catch (error: any) {
      console.error('Error syncing transactions:', error.response?.data || error.message);
      throw new Error('Failed to sync transactions');
    }
  }
}

export default new PlaidService();
