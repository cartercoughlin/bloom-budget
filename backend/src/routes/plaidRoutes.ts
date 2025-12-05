import express from 'express';
import plaidService from '../services/plaidService';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/plaid/create-link-token
 * Create a Plaid Link token for account linking
 */
router.post('/create-link-token', async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const linkToken = await plaidService.createLinkToken(userId);
    return res.json({ linkToken });
  } catch (error: any) {
    console.error('Error creating link token:', error.message);
    return res.status(500).json({ error: 'Failed to create link token' });
  }
});

/**
 * POST /api/plaid/exchange-token
 * Exchange public token for access token and store accounts
 */
router.post('/exchange-token', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { publicToken } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!publicToken) {
      return res.status(400).json({ error: 'Public token is required' });
    }

    await plaidService.exchangePublicToken(publicToken, userId);
    return res.json({ success: true, message: 'Account linked successfully' });
  } catch (error: any) {
    console.error('Error exchanging token:', error.message);
    return res.status(500).json({ error: 'Failed to link account' });
  }
});

/**
 * GET /api/plaid/accounts
 * Get all linked accounts for the user
 */
router.get('/accounts', async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if Plaid is configured
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      return res.json({ 
        accounts: [],
        message: 'Plaid not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env file.'
      });
    }

    const accounts = await plaidService.getAccounts(userId);
    return res.json({ accounts });
  } catch (error: any) {
    console.error('Error fetching accounts:', error.message);
    return res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

/**
 * DELETE /api/plaid/accounts/:id
 * Remove a linked account
 */
router.delete('/accounts/:id', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await plaidService.removeAccount(id, userId);
    return res.json({ success: true, message: 'Account removed successfully' });
  } catch (error: any) {
    console.error('Error removing account:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to remove account' });
  }
});

/**
 * POST /api/plaid/sync
 * Manually trigger transaction sync for an account
 */
router.post('/sync', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { accountId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const transactions = await plaidService.syncTransactions(accountId, userId);
    return res.json({ 
      success: true, 
      message: 'Transactions synced successfully',
      count: transactions.length 
    });
  } catch (error: any) {
    console.error('Error syncing transactions:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to sync transactions' });
  }
});

export default router;
