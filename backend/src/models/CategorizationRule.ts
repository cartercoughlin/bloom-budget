import { CategorizationRule as PrismaCategorizationRule } from '@prisma/client';

export interface CreateCategorizationRuleInput {
  userId: string;
  merchantPattern: string;
  categoryId: string;
  priority?: number;
  learnedFromUser?: boolean;
}

export interface CategorizationRuleResponse {
  id: string;
  userId: string;
  merchantPattern: string;
  categoryId: string;
  priority: number;
  learnedFromUser: boolean;
  createdAt: Date;
}

export class CategorizationRuleModel {
  /**
   * Validate regex pattern
   */
  static validatePattern(pattern: string): { valid: boolean; error?: string } {
    try {
      new RegExp(pattern);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid regex pattern' };
    }
  }

  /**
   * Validate create input
   */
  static validateCreateInput(input: CreateCategorizationRuleInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.userId || input.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    if (!input.merchantPattern || input.merchantPattern.trim().length === 0) {
      errors.push('Merchant pattern is required');
    } else {
      const patternValidation = this.validatePattern(input.merchantPattern);
      if (!patternValidation.valid) {
        errors.push(patternValidation.error!);
      }
    }

    if (!input.categoryId || input.categoryId.trim().length === 0) {
      errors.push('Category ID is required');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Test if a merchant name matches the pattern
   */
  static matchesMerchant(pattern: string, merchantName: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i'); // Case-insensitive
      return regex.test(merchantName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert Prisma CategorizationRule to response format
   */
  static toResponse(rule: PrismaCategorizationRule): CategorizationRuleResponse {
    return {
      id: rule.id,
      userId: rule.userId,
      merchantPattern: rule.merchantPattern,
      categoryId: rule.categoryId,
      priority: rule.priority,
      learnedFromUser: rule.learnedFromUser,
      createdAt: rule.createdAt,
    };
  }
}
