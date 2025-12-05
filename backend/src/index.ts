import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import logger, { stream } from './utils/logger';
import { validateEnvironment } from './utils/validateEnv';
import authRoutes from './routes/authRoutes';
import plaidRoutes from './routes/plaidRoutes';
import transactionRoutes from './routes/transactionRoutes';
import budgetRoutes from './routes/budgetRoutes';
import fraudRoutes from './routes/fraudRoutes';
import reportRoutes from './routes/reportRoutes';
import { sessionTimeout } from './middleware/authMiddleware';
import { apiRateLimiter } from './middleware/rateLimitMiddleware';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware';
import syncScheduler from './services/syncScheduler';

// Load environment variables
dotenv.config();

// Validate environment variables
try {
  validateEnvironment();
} catch (error: any) {
  console.error('Environment validation failed:', error.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.plaid.com'],
      scriptSrc: ["'self'", 'https://cdn.plaid.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'https://cdn.plaid.com'],
      connectSrc: ["'self'", 'https://cdn.plaid.com', 'https://production.plaid.com', 'https://sandbox.plaid.com', 'https://development.plaid.com'],
      frameSrc: ["'self'", 'https://cdn.plaid.com'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// HTTP request logging
app.use(morgan('combined', { stream }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check endpoint (no rate limiting)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply rate limiting and session timeout to all API routes
app.use('/api', apiRateLimiter);
app.use('/api', sessionTimeout);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/fraud', fraudRoutes);
app.use('/api/reports', reportRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start the transaction sync scheduler
  syncScheduler.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  syncScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  syncScheduler.stop();
  process.exit(0);
});
