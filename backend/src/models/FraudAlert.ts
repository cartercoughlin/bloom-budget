import { FraudAlert as PrismaFraudAlert } from '@prisma/client';

export type FraudAlertType = 'unusual_amount' | 'unusual_location' | 'rapid_transactions';
export type FraudAlertSeverity = 'low' | 'medium' | 'high';

export interface CreateFraudAlertInput {
  userId: string;
  transactionId: string;
  alertType: FraudAlertType;
  severity: FraudAlertSeverity;
  reason: string;
}

export interface FraudAlertResponse {
  id: string;
  userId: string;
  transactionId: string;
  alertType: string;
  severity: string;
  reason: string;
  isReviewed: boolean;
  isFalsePositive: boolean;
  reviewedAt?: Date;
  createdAt: Date;
}

export class FraudAlertModel {
  /**
   * Validate alert type
   */
  static validateAlertType(type: string): boolean {
    const validTypes: FraudAlertType[] = ['unusual_amount', 'unusual_location', 'rapid_transactions'];
    return validTypes.includes(type as FraudAlertType);
  }

  /**
   * Validate severity
   */
  static validateSeverity(severity: string): boolean {
    const validSeverities: FraudAlertSeverity[] = ['low', 'medium', 'high'];
    return validSeverities.includes(severity as FraudAlertSeverity);
  }

  /**
   * Validate create input
   */
  static validateCreateInput(input: CreateFraudAlertInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.userId || input.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    if (!input.transactionId || input.transactionId.trim().length === 0) {
      errors.push('Transaction ID is required');
    }

    if (!this.validateAlertType(input.alertType)) {
      errors.push('Invalid alert type');
    }

    if (!this.validateSeverity(input.severity)) {
      errors.push('Invalid severity level');
    }

    if (!input.reason || input.reason.trim().length === 0) {
      errors.push('Reason is required');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Convert Prisma FraudAlert to response format
   */
  static toResponse(alert: PrismaFraudAlert): FraudAlertResponse {
    return {
      id: alert.id,
      userId: alert.userId,
      transactionId: alert.transactionId,
      alertType: alert.alertType,
      severity: alert.severity,
      reason: alert.reason,
      isReviewed: alert.isReviewed,
      isFalsePositive: alert.isFalsePositive,
      reviewedAt: alert.reviewedAt || undefined,
      createdAt: alert.createdAt,
    };
  }
}
