import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import fraudDetectionService from '../services/fraudDetectionService';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/fraud/alerts
 * Get fraud alerts for the authenticated user
 * Requirements: 5.5
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const includeReviewed = req.query.includeReviewed === 'true';
    const severity = req.query.severity as string | undefined;
    const alertType = req.query.alertType as string | undefined;

    const alerts = await fraudDetectionService.getFraudAlerts(userId, {
      includeReviewed,
      severity: severity as any,
      alertType: alertType as any,
    });

    res.json({ alerts });
  } catch (error: any) {
    console.error('Error fetching fraud alerts:', error.message);
    res.status(500).json({ error: 'Failed to fetch fraud alerts' });
  }
});

/**
 * PATCH /api/fraud/alerts/:id
 * Review a fraud alert (mark as reviewed or false positive)
 * Requirements: 5.5
 */
router.patch('/alerts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const alertId = req.params.id;
    const { isFalsePositive } = req.body;

    if (typeof isFalsePositive !== 'boolean') {
      return res.status(400).json({ 
        error: 'isFalsePositive field is required and must be a boolean' 
      });
    }

    const alert = await fraudDetectionService.reviewAlert(alertId, userId, isFalsePositive);
    res.json(alert);
  } catch (error: any) {
    console.error('Error reviewing fraud alert:', error.message);
    
    if (error.message === 'Fraud alert not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to review fraud alert' });
  }
});

export default router;
