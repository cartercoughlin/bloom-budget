# Database Migrations Guide

This document describes how to manage database migrations for the Budget App.

## Overview

The Budget App uses Prisma for database migrations. Migrations are version-controlled SQL files that track changes to the database schema.

## Development Workflow

### Creating a New Migration

1. Make changes to `prisma/schema.prisma`
2. Create a migration:
   ```bash
   cd backend
   npx prisma migrate dev --name description_of_change
   ```
3. This will:
   - Create a new migration file in `prisma/migrations/`
   - Apply the migration to your development database
   - Regenerate the Prisma Client

### Applying Existing Migrations

```bash
cd backend
npx prisma migrate dev
```

### Resetting the Database (Development Only)

```bash
cd backend
npx prisma migrate reset
```

This will:
- Drop the database
- Create a new database
- Apply all migrations
- Run seed scripts

## Production Deployment

### Initial Setup

1. Ensure DATABASE_URL is set in production environment
2. Run migrations:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

### Deploying New Migrations

1. **Before deploying code:**
   - Review all pending migrations
   - Test migrations on a staging database
   - Create a database backup

2. **Deploy migrations:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Deploy application code**

### Migration Rollback

Prisma doesn't support automatic rollbacks. To rollback:

1. **Create a new migration** that reverses the changes
2. **Or restore from backup** if the migration caused issues

Example rollback migration:
```bash
npx prisma migrate dev --name rollback_feature_x
```

Then manually edit the migration SQL to reverse the changes.

## Best Practices

### 1. Always Test Migrations

- Test on a copy of production data
- Verify data integrity after migration
- Check application functionality

### 2. Backup Before Migrations

```bash
# PostgreSQL backup
pg_dump -U username -d database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore if needed
psql -U username -d database_name < backup_file.sql
```

### 3. Handle Data Migrations Carefully

For complex data transformations:
- Create a migration with SQL
- Test thoroughly
- Consider doing it in steps

### 4. Zero-Downtime Migrations

For production systems:
1. Make schema changes backward-compatible
2. Deploy code that works with both old and new schema
3. Run migration
4. Deploy code that uses new schema
5. Clean up old schema in a later migration

### 5. Monitor Migration Performance

- Large tables may take time to migrate
- Consider maintenance windows for major changes
- Use `CONCURRENTLY` for index creation in PostgreSQL

## Common Migration Scenarios

### Adding a Column

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  newColumn String?  // Make optional initially
}
```

### Renaming a Column

1. Add new column
2. Copy data from old to new
3. Update application code
4. Remove old column

### Adding an Index

```prisma
model Transaction {
  id     String   @id
  userId String
  date   DateTime

  @@index([userId, date])
}
```

## Troubleshooting

### Migration Failed

1. Check error message
2. Review migration SQL
3. Check database logs
4. Restore from backup if needed

### Schema Drift

If schema doesn't match migrations:
```bash
npx prisma db push --force-reset  # Development only!
```

### Prisma Client Out of Sync

```bash
npx prisma generate
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Migrations
  run: |
    cd backend
    npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Docker Deployment

Migrations run automatically in the Dockerfile CMD:
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

## Migration Files Location

All migrations are stored in:
```
backend/prisma/migrations/
```

Each migration has:
- A timestamp-based directory name
- A `migration.sql` file with the SQL commands

## Additional Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
