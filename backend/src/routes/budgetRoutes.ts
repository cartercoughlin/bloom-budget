import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import budgetService from '../services/budgetService';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/budgets
 * Get all budgets for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const includeInactive = req.query.includeInactive === 'true';

    const budgets = await budgetService.getBudgets(userId, includeInactive);
    res.json(budgets);
  } catch (error: any) {
    console.error('Error fetching budgets:', error.message);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

/**
 * GET /api/budgets/:id
 * Get a single budget by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const budgetId = req.params.id;

    const budget = await budgetService.getBudgetById(budgetId, userId);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json(budget);
  } catch (error: any) {
    console.error('Error fetching budget:', error.message);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

/**
 * POST /api/budgets
 * Create a new budget
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { categoryId, amount, period, startDate, endDate, alertThreshold } = req.body;

    // Validate required fields
    if (!categoryId || !amount || !period || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Missing required fields: categoryId, amount, period, startDate, endDate' 
      });
    }

    const budget = await budgetService.createBudget({
      userId,
      categoryId,
      amount: parseFloat(amount),
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      alertThreshold: alertThreshold ? parseInt(alertThreshold) : undefined,
    });

    res.status(201).json(budget);
  } catch (error: any) {
    console.error('Error creating budget:', error.message);
    
    if (error.message.includes('Validation failed') || 
        error.message.includes('Category not found') ||
        error.message.includes('already exists')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

/**
 * PUT /api/budgets/:id
 * Update a budget
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const budgetId = req.params.id;
    const { amount, period, startDate, endDate, alertThreshold, isActive } = req.body;

    const updates: any = {};
    
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (period !== undefined) updates.period = period;
    if (startDate !== undefined) updates.startDate = new Date(startDate);
    if (endDate !== undefined) updates.endDate = new Date(endDate);
    if (alertThreshold !== undefined) updates.alertThreshold = parseInt(alertThreshold);
    if (isActive !== undefined) updates.isActive = isActive;

    const budget = await budgetService.updateBudget(budgetId, userId, updates);
    res.json(budget);
  } catch (error: any) {
    console.error('Error updating budget:', error.message);
    
    if (error.message === 'Budget not found') {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('must be') || error.message.includes('Validation')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

/**
 * DELETE /api/budgets/:id
 * Delete a budget (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const budgetId = req.params.id;

    await budgetService.deleteBudget(budgetId, userId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting budget:', error.message);
    
    if (error.message === 'Budget not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

/**
 * GET /api/budgets/:id/progress
 * Get budget progress with spending details
 */
router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const budgetId = req.params.id;

    const progress = await budgetService.getBudgetProgress(budgetId, userId);
    res.json(progress);
  } catch (error: any) {
    console.error('Error fetching budget progress:', error.message);
    
    if (error.message === 'Budget not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch budget progress' });
  }
});

/**
 * GET /api/budgets/alerts/check
 * Check for budget alerts
 */
router.get('/alerts/check', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const alerts = await budgetService.checkBudgetAlerts(userId);
    res.json(alerts);
  } catch (error: any) {
    console.error('Error checking budget alerts:', error.message);
    res.status(500).json({ error: 'Failed to check budget alerts' });
  }
});

export default router;
