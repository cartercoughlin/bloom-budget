import { Budget as PrismaBudget } from '@prisma/client';

export type BudgetPeriod = 'monthly' | 'quarterly' | 'annual';

export interface CreateBudgetInput {
  userId: string;
  categoryId: string;
  amount: number;
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
  alertThreshold?: number;
}

export interface BudgetResponse {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: string;
  startDate: Date;
  endDate: Date;
  alertThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BudgetModel {
  /**
   * Validate budget period
   */
  static validatePeriod(period: string): boolean {
    const validPeriods: BudgetPeriod[] = ['monthly', 'quarterly', 'annual'];
    return validPeriods.includes(period as BudgetPeriod);
  }

  /**
   * Validate alert threshold
   */
  static validateAlertThreshold(threshold: number): boolean {
    return threshold > 0 && threshold <= 100;
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate: Date, endDate: Date): boolean {
    return startDate < endDate;
  }

  /**
   * Validate create input
   */
  static validateCreateInput(input: CreateBudgetInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.userId || input.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    if (!input.categoryId || input.categoryId.trim().length === 0) {
      errors.push('Category ID is required');
    }

    if (input.amount === undefined || input.amount === null || input.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!this.validatePeriod(input.period)) {
      errors.push('Period must be monthly, quarterly, or annual');
    }

    if (!input.startDate || !input.endDate) {
      errors.push('Start date and end date are required');
    } else if (!this.validateDateRange(input.startDate, input.endDate)) {
      errors.push('End date must be after start date');
    }

    if (input.alertThreshold !== undefined && !this.validateAlertThreshold(input.alertThreshold)) {
      errors.push('Alert threshold must be between 1 and 100');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Convert Prisma Budget to response format
   */
  static toResponse(budget: PrismaBudget): BudgetResponse {
    return {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      amount: Number(budget.amount),
      period: budget.period,
      startDate: budget.startDate,
      endDate: budget.endDate,
      alertThreshold: budget.alertThreshold,
      isActive: budget.isActive,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
