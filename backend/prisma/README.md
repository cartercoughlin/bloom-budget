# Database Setup

This directory contains the Prisma schema and migrations for the Budget App.

## Prerequisites

- PostgreSQL 12 or higher
- Node.js 18 or higher

## Setup

1. **Create a PostgreSQL database:**
   ```bash
   createdb budget_app
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and update the `DATABASE_URL`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/budget_app
   ```

3. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```

4. **Run migrations:**
   ```bash
   npm run db:migrate
   ```
   
   This will create all database tables and prompt you to name the migration.

5. **Seed default categories:**
   ```bash
   npm run db:seed
   ```

## Database Schema

The database includes the following tables:

- **users** - User accounts with authentication
- **plaid_accounts** - Connected bank/credit card accounts
- **transactions** - Financial transactions from Plaid
- **categories** - Spending categories (system and user-defined)
- **budgets** - Budget plans for categories
- **fraud_alerts** - Fraud detection alerts
- **categorization_rules** - Rules for auto-categorizing transactions

## Migrations

To create a new migration after schema changes:

```bash
npm run db:migrate
```

## Prisma Studio

To view and edit data in a GUI:

```bash
npx prisma studio
```

## Reset Database

To reset the database (WARNING: deletes all data):

```bash
npx prisma migrate reset
```

This will drop the database, recreate it, run all migrations, and run the seed script.
