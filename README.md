# Budget App

A full-stack personal finance management application that integrates with financial institutions via Plaid to automatically import transactions, categorize spending, create budgets, detect fraudulent activity, and provide spending insights.

## Features

- 🏦 **Bank Integration**: Securely connect bank and credit card accounts via Plaid
- 💸 **Transaction Management**: Automatic transaction import with deduplication
- 🏷️ **Smart Categorization**: AI-powered transaction categorization with learning
- 📊 **Budget Tracking**: Create and monitor budgets with real-time alerts
- 🚨 **Fraud Detection**: Automatic detection of suspicious transactions
- 📈 **Reports & Analytics**: Spending trends and insights with visualizations
- 🔒 **Security**: AES-256 encryption, JWT authentication, and session management

## Tech Stack

### Frontend
- React 18 with TypeScript
- React Router for navigation
- TanStack Query for data fetching
- Tailwind CSS for styling
- Recharts for data visualization

### Backend
- Node.js with Express
- TypeScript
- Prisma ORM with PostgreSQL
- Redis for caching
- JWT authentication
- Plaid API integration

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- Redis 7+
- Plaid account (for API credentials)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd budget-app
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Set Up Environment Variables

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your configuration
```

See `ENV_VARIABLES.md` for detailed documentation on all environment variables.

### 4. Set Up Database

```bash
cd backend

# Run migrations
npx prisma migrate dev

# Seed database with default categories
npx prisma db seed
```

### 5. Start Development Servers

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Docker Deployment

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production

1. Set environment variables in `.env` file
2. Build and start:
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

## Project Structure

```
budget-app/
├── backend/
│   ├── prisma/          # Database schema and migrations
│   ├── src/
│   │   ├── config/      # Configuration files
│   │   ├── middleware/  # Express middleware
│   │   ├── models/      # Data models
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   └── utils/       # Utility functions
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts
│   │   ├── lib/         # Utilities
│   │   └── pages/       # Page components
│   └── Dockerfile
└── docker-compose.yml
```

## API Documentation

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Plaid Integration
- `POST /api/plaid/create-link-token` - Generate Plaid Link token
- `POST /api/plaid/exchange-token` - Exchange public token
- `GET /api/plaid/accounts` - Get linked accounts
- `DELETE /api/plaid/accounts/:id` - Unlink account
- `POST /api/plaid/sync` - Manually sync transactions

### Transactions
- `GET /api/transactions` - Get transactions with filters
- `GET /api/transactions/:id` - Get single transaction
- `PATCH /api/transactions/:id/category` - Update category

### Budgets
- `GET /api/budgets` - Get all budgets
- `POST /api/budgets` - Create budget
- `PUT /api/budgets/:id` - Update budget
- `DELETE /api/budgets/:id` - Delete budget
- `GET /api/budgets/:id/progress` - Get budget progress

### Fraud Detection
- `GET /api/fraud/alerts` - Get fraud alerts
- `PATCH /api/fraud/alerts/:id` - Review alert

### Reports
- `GET /api/reports/spending` - Get spending by category
- `GET /api/reports/trends` - Get spending trends
- `GET /api/reports/export` - Export transactions as CSV

## Database Migrations

See `backend/MIGRATIONS.md` for detailed migration documentation.

## Security

- All sensitive data encrypted with AES-256
- JWT-based authentication with httpOnly cookies
- Rate limiting on all endpoints
- CORS protection
- Helmet.js security headers
- Session timeout after 15 minutes of inactivity

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT

## Recent Changes

### Budget Category Display Fix
Fixed two issues related to budget category display:

1. **"Unknown Category" display issue**: Budgets were showing as "Unknown Category" in the dashboard
   - Updated `budgetService.ts` to include category data in all budget queries (getBudgets, getBudgetById, createBudget, updateBudget)
   - Modified `BudgetModel.toResponse()` to accept and include categoryName
   - Updated `BudgetResponse` interface to include optional `categoryName` field

2. **Empty category dropdown issue**: Category dropdown in budget creation form was empty
   - Fixed the API endpoint URL in `BudgetForm.tsx` from `/api/categories` to `/api/transactions/categories`
   - This matches the actual backend endpoint that returns available categories

## Support

For issues and questions, please open an issue on GitHub.
