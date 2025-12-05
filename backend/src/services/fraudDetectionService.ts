import getPrismaClient from '../config/database';
import { TransactionResponse } from '../models/Transaction';
import {
  CreateFraudAlertInput,
  FraudAlertType,
  FraudAlertSeverity,
  FraudAlertModel,
  FraudAlertResponse,
} from '../models/FraudAlert';

const prisma = getPrismaClient();

interface UserSpendingBaseline {
  typicalLocations: string[];
  transactionCount: number;
}

export class FraudDetectionService {
  /**
   * Calculate user spending baseline for location analysis
   */
  private async calculateUserBaseline(userId: string): Promise<UserSpendingBaseline> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: thirtyDaysAgo },
        isPending: false,
      },
    });

    if (transactions.length === 0) {
      return { typicalLocations: [], transactionCount: 0 };
    }

    const locationMap = new Map<string, number>();
    transactions.forEach((tx: any) => {
      if (tx.locationCity && tx.locationRegion) {
        const locationKey = `${tx.locationCity},${tx.locationRegion}`;
        locationMap.set(locationKey, (locationMap.get(locationKey) || 0) + 1);
      }
    });

    const threshold = transactions.length * 0.1;
    const typicalLocations = Array.from(locationMap.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([location]) => location);

    return { typicalLocations, transactionCount: transactions.length };
  }


  /**
   * Check if transaction is from a known sketchy merchant or pattern
   */
  async checkSketchyMerchant(
    transaction: TransactionResponse
  ): Promise<{ isSketchy: boolean; reason: string; severity: FraudAlertSeverity }> {
    const merchantName = transaction.merchantName?.toLowerCase() || '';
    const description = transaction.description?.toLowerCase() || '';
    const amount = Math.abs(transaction.amount);

    const sketchyPatterns = [
      // Gambling (word boundaries to avoid false positives like "Betterment")
      {
        pattern:
          /\bcasino\b|\bgambling\b|\bpoker\b|\bslots\b|\bbet\b|\bbets\b|\bbetting\b|\blottery\b|\bdraftkings\b|\bfanduel\b/i,
        reason: 'Gambling transaction detected',
        severity: 'medium' as FraudAlertSeverity,
      },
      // Cryptocurrency exchanges
      {
        pattern: /coinbase|binance|kraken|crypto|bitcoin|btc|eth/i,
        reason: 'Cryptocurrency transaction detected',
        severity: 'low' as FraudAlertSeverity,
      },
      // Payday loans
      {
        pattern: /payday|cash advance|quick loan|instant loan/i,
        reason: 'Payday loan transaction detected',
        severity: 'high' as FraudAlertSeverity,
      },
      // Wire transfers
      {
        pattern: /wire transfer|western union|moneygram|money order/i,
        reason: 'Wire transfer detected',
        severity: 'medium' as FraudAlertSeverity,
      },
      // Adult content
      {
        pattern: /adult|xxx|escort|onlyfans/i,
        reason: 'Adult content transaction detected',
        severity: 'low' as FraudAlertSeverity,
      },
      // Suspicious descriptions
      {
        pattern: /temp charge|pending|authorization|test transaction/i,
        reason: 'Suspicious transaction description',
        severity: 'medium' as FraudAlertSeverity,
      },
      // Large round numbers
      {
        pattern: null,
        check: () => [1000, 2000, 5000, 10000].includes(amount),
        reason: `Large round number transaction (${amount})`,
        severity: 'medium' as FraudAlertSeverity,
      },
    ];

    for (const { pattern, check, reason, severity } of sketchyPatterns) {
      if (pattern) {
        if (pattern.test(merchantName) || pattern.test(description)) {
          return { isSketchy: true, reason, severity };
        }
      } else if (check && check()) {
        return { isSketchy: true, reason, severity };
      }
    }

    return { isSketchy: false, reason: '', severity: 'low' };
  }

  /**
   * Check if transaction location is unusual
   */
  async checkUnusualLocation(
    userId: string,
    transaction: TransactionResponse
  ): Promise<{ isUnusual: boolean; reason: string; severity: FraudAlertSeverity }> {
    if (!transaction.location?.city || !transaction.location?.region) {
      return { isUnusual: false, reason: '', severity: 'low' };
    }

    const baseline = await this.calculateUserBaseline(userId);

    if (baseline.transactionCount < 10) {
      return { isUnusual: false, reason: '', severity: 'low' };
    }

    const transactionLocation = `${transaction.location.city},${transaction.location.region}`;

    if (!baseline.typicalLocations.includes(transactionLocation)) {
      return {
        isUnusual: true,
        reason: `Transaction in unusual location: ${transaction.location.city}, ${transaction.location.region}`,
        severity: 'medium',
      };
    }

    return { isUnusual: false, reason: '', severity: 'low' };
  }

  /**
   * Check for rapid transactions (5+ within 5 minutes)
   */
  async checkRapidTransactions(
    userId: string,
    transaction: TransactionResponse
  ): Promise<{ isUnusual: boolean; reason: string; severity: FraudAlertSeverity }> {
    const fiveMinutesAgo = new Date(transaction.date);
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        id: { not: transaction.id },
        date: {
          gte: fiveMinutesAgo,
          lt: transaction.date,
        },
      },
    });

    if (recentTransactions.length >= 4) {
      const count = recentTransactions.length + 1;
      return {
        isUnusual: true,
        reason: `${count} transactions detected within a 5-minute window`,
        severity: count >= 6 ? 'high' : 'medium',
      };
    }

    return { isUnusual: false, reason: '', severity: 'low' };
  }


  /**
   * Analyze transaction for fraud and generate alerts
   */
  async analyzeTransaction(transaction: TransactionResponse): Promise<FraudAlertResponse[]> {
    const alerts: FraudAlertResponse[] = [];

    try {
      // Check for sketchy merchants/patterns
      const sketchyCheck = await this.checkSketchyMerchant(transaction);
      if (sketchyCheck.isSketchy) {
        const alert = await this.createFraudAlert({
          userId: transaction.userId,
          transactionId: transaction.id,
          alertType: 'unusual_amount',
          severity: sketchyCheck.severity,
          reason: sketchyCheck.reason,
        });
        alerts.push(alert);
      }

      // Check for unusual location
      const locationCheck = await this.checkUnusualLocation(transaction.userId, transaction);
      if (locationCheck.isUnusual) {
        const alert = await this.createFraudAlert({
          userId: transaction.userId,
          transactionId: transaction.id,
          alertType: 'unusual_location',
          severity: locationCheck.severity,
          reason: locationCheck.reason,
        });
        alerts.push(alert);
      }

      // Check for rapid transactions
      const rapidCheck = await this.checkRapidTransactions(transaction.userId, transaction);
      if (rapidCheck.isUnusual) {
        const alert = await this.createFraudAlert({
          userId: transaction.userId,
          transactionId: transaction.id,
          alertType: 'rapid_transactions',
          severity: rapidCheck.severity,
          reason: rapidCheck.reason,
        });
        alerts.push(alert);
      }

      if (alerts.length > 0) {
        await this.sendNotifications(transaction.userId, alerts);
      }

      return alerts;
    } catch (error: any) {
      console.error(`Error analyzing transaction ${transaction.id}:`, error.message);
      return alerts;
    }
  }

  private async createFraudAlert(input: CreateFraudAlertInput): Promise<FraudAlertResponse> {
    const validation = FraudAlertModel.validateCreateInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const existing = await prisma.fraudAlert.findFirst({
      where: {
        transactionId: input.transactionId,
        alertType: input.alertType,
      },
    });

    if (existing) {
      return FraudAlertModel.toResponse(existing);
    }

    const alert = await prisma.fraudAlert.create({
      data: {
        userId: input.userId,
        transactionId: input.transactionId,
        alertType: input.alertType,
        severity: input.severity,
        reason: input.reason,
        isReviewed: false,
        isFalsePositive: false,
      },
    });

    return FraudAlertModel.toResponse(alert);
  }

  private async sendNotifications(userId: string, alerts: FraudAlertResponse[]): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });

      if (!user) {
        console.error(`User ${userId} not found for notification`);
        return;
      }

      console.log(`[FRAUD ALERT] Sending ${alerts.length} fraud alert(s) to ${user.email}`);
      alerts.forEach((alert) => {
        console.log(`  - ${alert.alertType} (${alert.severity}): ${alert.reason}`);
      });
    } catch (error: any) {
      console.error('Error sending fraud alert notifications:', error.message);
    }
  }


  /**
   * Get fraud alerts for a user
   */
  async getFraudAlerts(
    userId: string,
    options?: {
      includeReviewed?: boolean;
      severity?: FraudAlertSeverity;
      alertType?: FraudAlertType;
    }
  ): Promise<any[]> {
    const where: any = { userId };

    if (options?.includeReviewed === false) {
      where.isReviewed = false;
    }
    if (options?.severity) {
      where.severity = options.severity;
    }
    if (options?.alertType) {
      where.alertType = options.alertType;
    }

    const alerts = await prisma.fraudAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { transaction: true },
    });

    return alerts.map((alert: any) => ({
      ...FraudAlertModel.toResponse(alert),
      transaction: alert.transaction
        ? {
            amount: Number(alert.transaction.amount),
            merchantName: alert.transaction.merchantName,
            date: alert.transaction.date,
          }
        : undefined,
    }));
  }

  /**
   * Review fraud alert (mark as reviewed or false positive)
   */
  async reviewAlert(
    alertId: string,
    userId: string,
    isFalsePositive: boolean
  ): Promise<FraudAlertResponse> {
    const alert = await prisma.fraudAlert.findFirst({
      where: { id: alertId, userId },
    });

    if (!alert) {
      throw new Error('Fraud alert not found');
    }

    const updated = await prisma.fraudAlert.update({
      where: { id: alertId },
      data: {
        isReviewed: true,
        isFalsePositive,
        reviewedAt: new Date(),
      },
    });

    if (isFalsePositive) {
      await this.learnFromFalsePositive(alert);
    }

    return FraudAlertModel.toResponse(updated);
  }

  private async learnFromFalsePositive(alert: any): Promise<void> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: alert.transactionId },
      });

      if (!transaction) return;

      console.log(`[FRAUD LEARNING] False positive detected:`, {
        alertType: alert.alertType,
        severity: alert.severity,
        amount: transaction.amount,
        merchantName: transaction.merchantName,
        location: {
          city: transaction.locationCity,
          region: transaction.locationRegion,
        },
      });
    } catch (error: any) {
      console.error('Error learning from false positive:', error.message);
    }
  }
}

export default new FraudDetectionService();
