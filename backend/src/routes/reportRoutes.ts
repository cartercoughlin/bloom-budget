import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import reportingService from '../services/reportingService';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Simple in-memory cache (will be replaced with Redis in task 17)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Helper function to get cached data or execute function
 */
async function getCachedOrExecute<T>(
  cacheKey: string,
  executeFn: () => Promise<T>
): Promise<T> {
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data as T;
  }

  const data = await executeFn();
  cache.set(cacheKey, { data, timestamp: now });

  return data;
}

/**
 * GET /api/reports/spending
 * Get spending breakdown by category
 * Requirements: 6.1, 6.3, 6.4
 */
router.get('/spending', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const accountId = req.query.accountId as string | undefined;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    // Create cache key
    const cacheKey = `spending:${userId}:${startDate.toISOString()}:${endDate.toISOString()}:${accountId || 'all'}`;

    // Get data with caching
    const startTime = Date.now();
    const spending = await getCachedOrExecute(cacheKey, () =>
      reportingService.getSpendingByCategory(userId, {
        startDate,
        endDate,
        accountId,
      })
    );
    const duration = Date.now() - startTime;

    res.json({
      data: spending,
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        accountId: accountId || null,
        generatedIn: `${duration}ms`,
      },
    });
  } catch (error: any) {
    console.error('Error generating spending report:', error.message);
    res.status(500).json({ error: 'Failed to generate spending report' });
  }
});

/**
 * GET /api/reports/trends
 * Get spending trends with period comparison
 * Requirements: 6.2, 6.4
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const accountId = req.query.accountId as string | undefined;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    // Create cache key
    const cacheKey = `trends:${userId}:${startDate.toISOString()}:${endDate.toISOString()}:${accountId || 'all'}`;

    // Get data with caching
    const startTime = Date.now();
    const trends = await getCachedOrExecute(cacheKey, () =>
      reportingService.getTrends(userId, startDate, endDate, accountId)
    );
    const duration = Date.now() - startTime;

    res.json({
      data: trends,
      meta: {
        generatedIn: `${duration}ms`,
      },
    });
  } catch (error: any) {
    console.error('Error generating trends report:', error.message);
    res.status(500).json({ error: 'Failed to generate trends report' });
  }
});

/**
 * GET /api/reports/export
 * Export transactions as CSV
 * Requirements: 6.5
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const accountId = req.query.accountId as string | undefined;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    // Generate CSV
    const csv = await reportingService.exportTransactions(userId, {
      startDate,
      endDate,
      accountId,
    });

    // Set headers for CSV download
    const filename = `transactions_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(csv);
  } catch (error: any) {
    console.error('Error exporting transactions:', error.message);
    res.status(500).json({ error: 'Failed to export transactions' });
  }
});

export default router;
