import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import transactionService from '../services/transactionService';
import syncScheduler from '../services/syncScheduler';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/transactions/categories
 * Get all available categories
 */
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await transactionService.getCategories();
    res.json({ categories });
  } catch (error: any) {
    console.error('Error fetching categories:', error.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/transactions
 * Get transactions with pagination and filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Parse query parameters
    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      categoryId: req.query.categoryId as string | undefined,
      accountId: req.query.accountId as string | undefined,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      merchantName: req.query.merchantName as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    };

    const result = await transactionService.getTransactions(userId, filters);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching transactions:', error.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * GET /api/transactions/:id
 * Get single transaction by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const transactionId = req.params.id;

    const transaction = await transactionService.getTransactionById(transactionId, userId);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error: any) {
    console.error('Error fetching transaction:', error.message);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

/**
 * PATCH /api/transactions/:id/category
 * Update transaction category
 */
router.patch('/:id/category', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const transactionId = req.params.id;
    const { categoryId } = req.body;

    if (!categoryId) {
      return res.status(400).json({ error: 'Category ID is required' });
    }

    const transaction = await transactionService.updateCategory(transactionId, userId, categoryId);
    res.json(transaction);
  } catch (error: any) {
    console.error('Error updating transaction category:', error.message);
    
    if (error.message === 'Transaction not found' || error.message === 'Category not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update transaction category' });
  }
});

/**
 * POST /api/transactions/sync/:accountId
 * Manually trigger transaction sync for a specific account
 */
router.post('/sync/:accountId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const accountId = req.params.accountId;

    const result = await syncScheduler.manualSync(accountId, userId);

    if (!result.success) {
      return res.status(500).json({ 
        error: 'Sync failed', 
        details: result.error 
      });
    }

    res.json({
      message: 'Sync completed successfully',
      imported: result.imported,
      duplicates: result.duplicates,
    });
  } catch (error: any) {
    console.error('Error during manual sync:', error.message);
    res.status(500).json({ error: 'Failed to sync transactions' });
  }
});

export default router;
