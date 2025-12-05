import { PlaidAccount as PrismaPlaidAccount } from '@prisma/client';
import crypto from 'crypto';

export interface CreatePlaidAccountInput {
  userId: string;
  plaidAccountId: string;
  plaidAccessToken: string;
  accountName: string;
  accountType: 'depository' | 'credit' | 'loan' | 'investment';
  accountSubtype: string;
  currentBalance: number;
  availableBalance?: number;
}

export interface PlaidAccountResponse {
  id: string;
  userId: string;
  plaidAccountId: string;
  accountName: string;
  accountType: string;
  accountSubtype: string;
  currentBalance: number;
  availableBalance?: number;
  lastSyncedAt: Date;
  isActive: boolean;
  createdAt: Date;
}

export class PlaidAccountModel {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly IV_LENGTH = 16;

  /**
   * Get encryption key from environment
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
    }
    return Buffer.from(key, 'utf8');
  }

  /**
   * Encrypt Plaid access token using AES-256
   */
  static encryptAccessToken(token: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Prepend IV to encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt Plaid access token
   */
  static decryptAccessToken(encryptedToken: string): string {
    const key = this.getEncryptionKey();
    const parts = encryptedToken.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Validate account type
   */
  static validateAccountType(type: string): boolean {
    const validTypes = ['depository', 'credit', 'loan', 'investment'];
    return validTypes.includes(type);
  }

  /**
   * Validate create input
   */
  static validateCreateInput(input: CreatePlaidAccountInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.userId || input.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    if (!input.plaidAccountId || input.plaidAccountId.trim().length === 0) {
      errors.push('Plaid account ID is required');
    }

    if (!input.plaidAccessToken || input.plaidAccessToken.trim().length === 0) {
      errors.push('Plaid access token is required');
    }

    if (!input.accountName || input.accountName.trim().length === 0) {
      errors.push('Account name is required');
    }

    if (!this.validateAccountType(input.accountType)) {
      errors.push('Invalid account type');
    }

    if (input.currentBalance === undefined || input.currentBalance === null) {
      errors.push('Current balance is required');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Convert Prisma PlaidAccount to response format (exclude sensitive data)
   */
  static toResponse(account: PrismaPlaidAccount): PlaidAccountResponse {
    return {
      id: account.id,
      userId: account.userId,
      plaidAccountId: account.plaidAccountId,
      accountName: account.accountName,
      accountType: account.accountType,
      accountSubtype: account.accountSubtype,
      currentBalance: Number(account.currentBalance),
      availableBalance: account.availableBalance ? Number(account.availableBalance) : undefined,
      lastSyncedAt: account.lastSyncedAt,
      isActive: account.isActive,
      createdAt: account.createdAt,
    };
  }
}
