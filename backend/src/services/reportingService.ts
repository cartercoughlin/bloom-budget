import getPrismaClient from '../config/database';
import { cache } from '../config/redis';

const prisma = getPrismaClient();

// Cache TTL: 5 minutes for reports
const REPORT_CACHE_TTL = 5 * 60;

export interface SpendingByCategory {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  transactionCount: number;
  percentageOfTotal: number;
}

export interface SpendingAnalysisOptions {
  startDate: Date;
  endDate: Date;
  accountId?: string;
}

export interface TrendData {
  period: string;
  totalSpending: number;
  transactionCount: number;
  averageTransaction: number;
}

export interface TrendComparison {
  currentPeriod: TrendData;
  previousPeriod: TrendData;
  percentageChange: number;
  trend: 'up' | 'down' | 'stable';
}

export class ReportingService {
  /**
   * Get spending breakdown by category
   * Requirements: 6.1, 6.3
   */
  async getSpendingByCategory(
    userId: string,
    options: SpendingAnalysisOptions
  ): Promise<SpendingByCategory[]> {
    // Check cache first
    const cacheKey = `spending:${userId}:${options.startDate.toISOString()}:${options.endDate.toISOString()}:${options.accountId || 'all'}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.error('Failed to parse cached spending data:', error);
      }
    }
    // Build where clause
    const where: any = {
      userId,
      date: {
        gte: options.startDate,
        lte: options.endDate,
      },
      isPending: false,
    };

    if (options.accountId) {
      where.accountId = options.accountId;
    }

    // Get all transactions in the period
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
      },
    });

    // Calculate total spending
    const totalSpending = transactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

    // Group by category
    const categoryMap = new Map<string, {
      categoryId: string;
      categoryName: string;
      totalAmount: number;
      transactionCount: number;
    }>();

    transactions.forEach(tx => {
      const categoryId = tx.categoryId || 'uncategorized';
      const categoryName = tx.category?.name || 'Uncategorized';

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryId,
          categoryName,
          totalAmount: 0,
          transactionCount: 0,
        });
      }

      const category = categoryMap.get(categoryId)!;
      category.totalAmount += Math.abs(Number(tx.amount));
      category.transactionCount += 1;
    });

    // Convert to array and calculate percentages
    const result: SpendingByCategory[] = Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      percentageOfTotal: totalSpending > 0 ? (cat.totalAmount / totalSpending) * 100 : 0,
    }));

    // Sort by total amount descending
    result.sort((a, b) => b.totalAmount - a.totalAmount);

    // Cache the result
    await cache.set(cacheKey, JSON.stringify(result), REPORT_CACHE_TTL);

    return result;
  }

  /**
   * Get spending trends with month-over-month comparison
   * Requirements: 6.2
   */
  async getTrends(
    userId: string,
    currentStartDate: Date,
    currentEndDate: Date,
    accountId?: string
  ): Promise<TrendComparison> {
    // Check cache first
    const cacheKey = `trends:${userId}:${currentStartDate.toISOString()}:${currentEndDate.toISOString()}:${accountId || 'all'}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.error('Failed to parse cached trends data:', error);
      }
    }
    // Calculate previous period dates (same duration as current period)
    const periodDuration = currentEndDate.getTime() - currentStartDate.getTime();
    const previousStartDate = new Date(currentStartDate.getTime() - periodDuration);
    const previousEndDate = new Date(currentStartDate.getTime() - 1); // Day before current period

    // Get current period data
    const currentPeriodData = await this.getPeriodData(
      userId,
      currentStartDate,
      currentEndDate,
      accountId
    );

    // Get previous period data
    const previousPeriodData = await this.getPeriodData(
      userId,
      previousStartDate,
      previousEndDate,
      accountId
    );

    // Calculate percentage change
    let percentageChange = 0;
    if (previousPeriodData.totalSpending > 0) {
      percentageChange = 
        ((currentPeriodData.totalSpending - previousPeriodData.totalSpending) / 
        previousPeriodData.totalSpending) * 100;
    } else if (currentPeriodData.totalSpending > 0) {
      percentageChange = 100; // 100% increase from zero
    }

    // Determine trend direction
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(percentageChange) < 5) {
      trend = 'stable';
    } else if (percentageChange > 0) {
      trend = 'up';
    } else {
      trend = 'down';
    }

    const result = {
      currentPeriod: currentPeriodData,
      previousPeriod: previousPeriodData,
      percentageChange,
      trend,
    };

    // Cache the result
    await cache.set(cacheKey, JSON.stringify(result), REPORT_CACHE_TTL);

    return result;
  }

  /**
   * Helper method to get spending data for a specific period
   */
  private async getPeriodData(
    userId: string,
    startDate: Date,
    endDate: Date,
    accountId?: string
  ): Promise<TrendData> {
    const where: any = {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      isPending: false,
    };

    if (accountId) {
      where.accountId = accountId;
    }

    const transactions = await prisma.transaction.findMany({
      where,
    });

    const totalSpending = transactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
    const transactionCount = transactions.length;
    const averageTransaction = transactionCount > 0 ? totalSpending / transactionCount : 0;

    // Format period string
    const periodStr = `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;

    return {
      period: periodStr,
      totalSpending,
      transactionCount,
      averageTransaction,
    };
  }

  /**
   * Export transactions as CSV
   * Requirements: 6.5
   */
  async exportTransactions(
    userId: string,
    options: SpendingAnalysisOptions
  ): Promise<string> {
    // Build where clause
    const where: any = {
      userId,
      date: {
        gte: options.startDate,
        lte: options.endDate,
      },
    };

    if (options.accountId) {
      where.accountId = options.accountId;
    }

    // Get transactions with related data
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
      },
      orderBy: { date: 'desc' },
    });

    // Create CSV header
    const headers = [
      'Date',
      'Description',
      'Merchant',
      'Amount',
      'Category',
      'Account',
      'Location',
      'Status',
      'Fraudulent',
    ];

    // Create CSV rows
    const rows = transactions.map(tx => {
      const location = [tx.locationCity, tx.locationRegion, tx.locationCountry]
        .filter(Boolean)
        .join(', ');

      return [
        tx.date.toISOString().split('T')[0],
        this.escapeCsvField(tx.description),
        this.escapeCsvField(tx.merchantName || ''),
        tx.amount.toString(),
        this.escapeCsvField(tx.category?.name || 'Uncategorized'),
        this.escapeCsvField(tx.account?.accountName || ''),
        this.escapeCsvField(location),
        tx.isPending ? 'Pending' : 'Posted',
        tx.isFraudulent ? 'Yes' : 'No',
      ];
    });

    // Combine header and rows
    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ];

    return csvLines.join('\n');
  }

  /**
   * Escape CSV field (handle commas, quotes, newlines)
   */
  private escapeCsvField(field: string): string {
    if (!field) return '';
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    
    return field;
  }
}

export default new ReportingService();
