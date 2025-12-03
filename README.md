# Budget App

A personal finance management application that integrates with financial institutions via Plaid to automatically import transactions, categorize spending, create budgets, detect fraudulent activity, and provide spending insights.

## Project Structure

```
budget-app/
├── backend/          # Node.js/Express API server
│   ├── src/         # TypeScript source files
│   └── .env.example # Environment variables template
├── frontend/        # React application
│   ├── src/         # React components and logic
│   └── .env.example # Frontend environment variables
└── package.json     # Monorepo configuration
```

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Edit .env with your configuration
```

### 3. Run Development Servers

From the root directory:

```bash
# Run both frontend and backend
npm run dev

# Or run individually
npm run dev:backend
npm run dev:frontend
```

The backend will run on http://localhost:3000 and the frontend on http://localhost:5173.

## Available Scripts

- `npm run dev` - Run both frontend and backend in development mode
- `npm run build` - Build both applications for production
- `npm run lint` - Lint all workspaces
- `npm run format` - Format code with Prettier

## Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling

**Backend:**
- Node.js with Express
- TypeScript
- PostgreSQL database
- Redis for caching

## Security

- All sensitive data is encrypted using AES-256
- JWT-based authentication
- Session management with Redis
- Rate limiting on API endpoints

## License

Private - All rights reserved
