import getPrismaClient from '../config/database';
import { TransactionModel, CreateTransactionInput, TransactionResponse } from '../models/Transaction';
import { Transaction as PlaidTransaction } from 'plaid';
import categorizationService from './categorizationService';
import fraudDetectionService from './fraudDetectionService';

const prisma = getPrismaClient();

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  minAmount?: number;
  maxAmount?: number;
  merchantName?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  transactions: TransactionResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class TransactionService {
  /**
   * Get all available categories
   */
  async getCategories(): Promise<any[]> {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
      });
      return categories;
    } catch (error: any) {
      console.error('Error fetching categories:', error.message);
      throw new Error('Failed to fetch categories');
    }
  }

  /**
   * Import transactions from Plaid with duplicate detection
   */
  async importTransactions(
    plaidTransactions: PlaidTransaction[],
    accountId: string,
    userId: string
  ): Promise<{ imported: number; duplicates: number }> {
    let imported = 0;
    let duplicates = 0;

    for (const plaidTx of plaidTransactions) {
      try {
        // Check if transaction already exists by plaidTransactionId
        const existing = await prisma.transaction.findUnique({
          where: { plaidTransactionId: plaidTx.transaction_id },
        });

        if (existing) {
          duplicates++;
          continue;
        }

        // Create transaction hash for additional duplicate checking
        const txHash = TransactionModel.generateTransactionHash(
          accountId,
          plaidTx.amount,
          new Date(plaidTx.date),
          plaidTx.merchant_name || undefined
        );

        // Check for duplicates using hash (in case plaidTransactionId changed)
        const hashDuplicate = await this.findByHash(userId, txHash);
        if (hashDuplicate) {
          duplicates++;
          continue;
        }

        // Prepare transaction data
        const transactionData: CreateTransactionInput = {
          userId,
          accountId,
          plaidTransactionId: plaidTx.transaction_id,
          amount: plaidTx.amount,
          date: new Date(plaidTx.date),
          merchantName: plaidTx.merchant_name || undefined,
          description: plaidTx.name,
          isPending: plaidTx.pending,
          location: {
            city: plaidTx.location?.city || undefined,
            region: plaidTx.location?.region || undefined,
            country: plaidTx.location?.country || undefined,
          },
        };

        // Validate input
        const validation = TransactionModel.validateCreateInput(transactionData);
        if (!validation.valid) {
          console.error(`Invalid transaction data: ${validation.errors.join(', ')}`);
          continue;
        }

        // Auto-categorize the transaction (Requirements: 3.1, 3.3)
        try {
          const categorization = await categorizationService.categorizeTransaction(userId, {
            merchantName: transactionData.merchantName,
            description: transactionData.description,
            plaidCategory: plaidTx.personal_finance_category?.primary 
              ? [plaidTx.personal_finance_category.primary]
              : plaidTx.category || undefined,
          });

          transactionData.categoryId = categorization.categoryId;
          transactionData.categoryConfidence = categorization.confidence;
        } catch (error: any) {
          console.error(`Error categorizing transaction: ${error.message}`);
          // Continue without categorization
        }

        // Store transaction
        const createdTransaction = await prisma.transaction.create({
          data: {
            userId: transactionData.userId,
            accountId: transactionData.accountId,
            plaidTransactionId: transactionData.plaidTransactionId,
            amount: transactionData.amount,
            date: transactionData.date,
            merchantName: transactionData.merchantName,
            description: transactionData.description,
            categoryId: transactionData.categoryId,
            categoryConfidence: transactionData.categoryConfidence || 0,
            isPending: transactionData.isPending || false,
            locationCity: transactionData.location?.city,
            locationRegion: transactionData.location?.region,
            locationCountry: transactionData.location?.country,
            isFraudulent: transactionData.isFraudulent || false,
          },
        });

        imported++;

        // Run fraud detection on new transaction (Requirements: 5.1, 5.2, 5.3)
        // Run asynchronously to not block import process
        setImmediate(async () => {
          try {
            const transactionResponse = TransactionModel.toResponse(createdTransaction);
            const fraudAlerts = await fraudDetectionService.analyzeTransaction(transactionResponse);
            
            // If fraud detected, mark transaction as fraudulent
            if (fraudAlerts.length > 0) {
              await prisma.transaction.update({
                where: { id: createdTransaction.id },
                data: { isFraudulent: true },
              });
            }
          } catch (error: any) {
            console.error(`Error running fraud detection on transaction ${createdTransaction.id}:`, error.message);
          }
        });
      } catch (error: any) {
        console.error(`Error importing transaction ${plaidTx.transaction_id}:`, error.message);
        // Continue with next transaction
      }
    }

    return { imported, duplicates };
  }

  /**
   * Find transaction by hash for duplicate detection
   */
  private async findByHash(userId: string, hash: string): Promise<boolean> {
    // Parse hash to extract components
    const parts = hash.split('-');
    if (parts.length < 4) return false;

    const accountId = parts[0];
    const amount = parseFloat(parts[1]);
    const dateStr = parts[2];
    const merchantName = parts.slice(3).join('-');

    // Validate date string format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.error(`Invalid date format in hash: ${dateStr}`);
      return false;
    }

    // Create date range for the day
    const startDate = new Date(dateStr + 'T00:00:00.000Z');
    const endDate = new Date(dateStr + 'T23:59:59.999Z');

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error(`Invalid dates created from: ${dateStr}`);
      return false;
    }

    // Query for potential duplicates
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        accountId,
        amount,
        date: {
          gte: startDate,
          lte: endDate,
        },
        merchantName: merchantName === 'unknown' ? null : merchantName,
      },
      take: 1,
    });

    return transactions.length > 0;
  }

  /**
   * Get transactions with pagination and filters
   */
  async getTransactions(userId: string, filters: TransactionFilters): Promise<PaginatedTransactions> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId };

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
    }

    if (filters.merchantName) {
      where.merchantName = {
        contains: filters.merchantName,
        mode: 'insensitive',
      };
    }

    // Get total count
    const total = await prisma.transaction.count({ where });

    // Get transactions with category information
    const transactions = await prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        category: {
          select: {
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    return {
      transactions: transactions.map((tx: any) => ({
        ...TransactionModel.toResponse(tx),
        categoryName: tx.category?.name,
        categoryIcon: tx.category?.icon,
        categoryColor: tx.category?.color,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single transaction by ID
   */
  async getTransactionById(transactionId: string, userId: string): Promise<TransactionResponse | null> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      return null;
    }

    return TransactionModel.toResponse(transaction);
  }

  /**
   * Update transaction category
   */
  async updateCategory(
    transactionId: string,
    userId: string,
    categoryId: string
  ): Promise<TransactionResponse> {
    // Verify transaction belongs to user
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Verify category exists
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ userId }, { isSystem: true }],
      },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Update transaction
    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        categoryId,
        categoryConfidence: 100, // User-assigned categories have 100% confidence
      },
    });

    // Learn from user correction (Requirements: 3.5)
    try {
      await categorizationService.learnFromCorrection(userId, transactionId, categoryId);
    } catch (error: any) {
      console.error(`Error learning from correction: ${error.message}`);
      // Don't fail the update if learning fails
    }

    return TransactionModel.toResponse(updated);
  }
}

export default new TransactionService();
