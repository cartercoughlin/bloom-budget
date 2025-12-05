import { Transaction as PrismaTransaction } from '@prisma/client';

export interface TransactionLocation {
  city?: string;
  region?: string;
  country?: string;
}

export interface CreateTransactionInput {
  userId: string;
  accountId: string;
  plaidTransactionId: string;
  amount: number;
  date: Date;
  merchantName?: string;
  description: string;
  categoryId?: string;
  categoryConfidence?: number;
  isPending?: boolean;
  location?: TransactionLocation;
  isFraudulent?: boolean;
}

export interface TransactionResponse {
  id: string;
  userId: string;
  accountId: string;
  plaidTransactionId: string;
  amount: number;
  date: Date;
  merchantName?: string;
  description: string;
  categoryId?: string;
  categoryConfidence: number;
  isPending: boolean;
  location: TransactionLocation;
  isFraudulent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TransactionModel {
  /**
   * Validate category confidence score
   */
  static validateCategoryConfidence(confidence: number): boolean {
    return confidence >= 0 && confidence <= 100;
  }

  /**
   * Validate create input
   */
  static validateCreateInput(input: CreateTransactionInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.userId || input.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    if (!input.accountId || input.accountId.trim().length === 0) {
      errors.push('Account ID is required');
    }

    if (!input.plaidTransactionId || input.plaidTransactionId.trim().length === 0) {
      errors.push('Plaid transaction ID is required');
    }

    if (input.amount === undefined || input.amount === null) {
      errors.push('Amount is required');
    }

    if (!input.date) {
      errors.push('Date is required');
    }

    if (!input.description || input.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (input.categoryConfidence !== undefined && !this.validateCategoryConfidence(input.categoryConfidence)) {
      errors.push('Category confidence must be between 0 and 100');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate transaction hash for duplicate detection
   */
  static generateTransactionHash(
    accountId: string,
    amount: number,
    date: Date,
    merchantName?: string
  ): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const merchant = merchantName || 'unknown';
    return `${accountId}-${amount}-${dateStr}-${merchant}`;
  }

  /**
   * Convert Prisma Transaction to response format
   */
  static toResponse(transaction: PrismaTransaction): TransactionResponse {
    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      plaidTransactionId: transaction.plaidTransactionId,
      amount: Number(transaction.amount),
      date: transaction.date,
      merchantName: transaction.merchantName || undefined,
      description: transaction.description,
      categoryId: transaction.categoryId || undefined,
      categoryConfidence: transaction.categoryConfidence,
      isPending: transaction.isPending,
      location: {
        city: transaction.locationCity || undefined,
        region: transaction.locationRegion || undefined,
        country: transaction.locationCountry || undefined,
      },
      isFraudulent: transaction.isFraudulent,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  /**
   * Check if transaction has location data
   */
  static hasLocation(transaction: PrismaTransaction): boolean {
    return !!(transaction.locationCity || transaction.locationRegion || transaction.locationCountry);
  }
}
