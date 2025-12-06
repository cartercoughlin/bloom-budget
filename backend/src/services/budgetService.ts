import getPrismaClient from '../config/database';
import { BudgetModel, CreateBudgetInput, BudgetResponse, BudgetPeriod } from '../models/Budget';

const prisma = getPrismaClient();

export interface UpdateBudgetInput {
  amount?: number;
  period?: BudgetPeriod;
  startDate?: Date;
  endDate?: Date;
  alertThreshold?: number;
  isActive?: boolean;
}

export interface BudgetProgress {
  budget: BudgetResponse;
  currentSpending: number;
  percentageUsed: number;
  remainingAmount: number;
  daysRemaining: number;
  isOverBudget: boolean;
  shouldAlert: boolean;
}

export class BudgetService {
  /**
   * Create a new budget
   */
  async createBudget(input: CreateBudgetInput): Promise<BudgetResponse> {
    // Validate input
    const validation = BudgetModel.validateCreateInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Verify category exists and belongs to user or is system category
    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        OR: [
          { userId: input.userId },
          { isSystem: true }
        ]
      }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Check for overlapping budgets for the same category
    const overlapping = await prisma.budget.findFirst({
      where: {
        userId: input.userId,
        categoryId: input.categoryId,
        isActive: true,
        OR: [
          {
            AND: [
              { startDate: { lte: input.startDate } },
              { endDate: { gte: input.startDate } }
            ]
          },
          {
            AND: [
              { startDate: { lte: input.endDate } },
              { endDate: { gte: input.endDate } }
            ]
          },
          {
            AND: [
              { startDate: { gte: input.startDate } },
              { endDate: { lte: input.endDate } }
            ]
          }
        ]
      }
    });

    if (overlapping) {
      throw new Error('A budget already exists for this category in the specified time period');
    }

    // Create budget
    const budget = await prisma.budget.create({
      data: {
        userId: input.userId,
        categoryId: input.categoryId,
        amount: input.amount,
        period: input.period,
        startDate: input.startDate,
        endDate: input.endDate,
        alertThreshold: input.alertThreshold || 80,
        isActive: true,
      },
      include: {
        category: true
      }
    });

    return BudgetModel.toResponse(budget, budget.category.name);
  }

  /**
   * Get all budgets for a user
   */
  async getBudgets(userId: string, includeInactive: boolean = false): Promise<BudgetResponse[]> {
    const where: any = { userId };

    if (!includeInactive) {
      where.isActive = true;
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        category: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return budgets.map(budget => BudgetModel.toResponse(budget, budget.category.name));
  }

  /**
   * Get a single budget by ID
   */
  async getBudgetById(budgetId: string, userId: string): Promise<BudgetResponse | null> {
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId
      },
      include: {
        category: true
      }
    });

    if (!budget) {
      return null;
    }

    return BudgetModel.toResponse(budget, budget.category.name);
  }

  /**
   * Update a budget
   */
  async updateBudget(
    budgetId: string,
    userId: string,
    input: UpdateBudgetInput
  ): Promise<BudgetResponse> {
    // Verify budget exists and belongs to user
    const existing = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId
      }
    });

    if (!existing) {
      throw new Error('Budget not found');
    }

    // Validate updates
    if (input.amount !== undefined && input.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (input.period && !BudgetModel.validatePeriod(input.period)) {
      throw new Error('Period must be monthly, quarterly, or annual');
    }

    if (input.alertThreshold !== undefined && !BudgetModel.validateAlertThreshold(input.alertThreshold)) {
      throw new Error('Alert threshold must be between 1 and 100');
    }

    // Check date range if both dates are provided
    const startDate = input.startDate || existing.startDate;
    const endDate = input.endDate || existing.endDate;
    
    if (!BudgetModel.validateDateRange(startDate, endDate)) {
      throw new Error('End date must be after start date');
    }

    // Update budget
    const updated = await prisma.budget.update({
      where: { id: budgetId },
      data: {
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.period && { period: input.period }),
        ...(input.startDate && { startDate: input.startDate }),
        ...(input.endDate && { endDate: input.endDate }),
        ...(input.alertThreshold !== undefined && { alertThreshold: input.alertThreshold }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: {
        category: true
      }
    });

    return BudgetModel.toResponse(updated, updated.category.name);
  }

  /**
   * Delete a budget (soft delete by setting isActive to false)
   */
  async deleteBudget(budgetId: string, userId: string): Promise<void> {
    // Verify budget exists and belongs to user
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId
      }
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    // Soft delete by setting isActive to false
    await prisma.budget.update({
      where: { id: budgetId },
      data: { isActive: false }
    });
  }

  /**
   * Calculate spending for a budget period
   */
  async calculateSpending(budgetId: string, userId: string): Promise<number> {
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId
      }
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    // Sum all transactions in the budget period for the category
    const result = await prisma.transaction.aggregate({
      where: {
        userId,
        categoryId: budget.categoryId,
        date: {
          gte: budget.startDate,
          lte: budget.endDate
        },
        isPending: false // Only count non-pending transactions
      },
      _sum: {
        amount: true
      }
    });

    return Number(result._sum.amount || 0);
  }

  /**
   * Get budget progress with spending details
   */
  async getBudgetProgress(budgetId: string, userId: string): Promise<BudgetProgress> {
    const budget = await this.getBudgetById(budgetId, userId);
    
    if (!budget) {
      throw new Error('Budget not found');
    }

    const currentSpending = await this.calculateSpending(budgetId, userId);
    const budgetAmount = budget.amount;
    const percentageUsed = budgetAmount > 0 ? (currentSpending / budgetAmount) * 100 : 0;
    const remainingAmount = budgetAmount - currentSpending;
    
    // Calculate days remaining
    const now = new Date();
    const endDate = new Date(budget.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const isOverBudget = currentSpending > budgetAmount;
    const shouldAlert = percentageUsed >= budget.alertThreshold;

    return {
      budget,
      currentSpending,
      percentageUsed,
      remainingAmount,
      daysRemaining,
      isOverBudget,
      shouldAlert
    };
  }

  /**
   * Check budget alerts for a user
   */
  async checkBudgetAlerts(userId: string): Promise<BudgetProgress[]> {
    const budgets = await this.getBudgets(userId, false);
    const alerts: BudgetProgress[] = [];

    for (const budget of budgets) {
      const progress = await this.getBudgetProgress(budget.id, userId);
      
      // Only include budgets that should trigger alerts
      if (progress.shouldAlert) {
        alerts.push(progress);
      }
    }

    return alerts;
  }
}

export default new BudgetService();
