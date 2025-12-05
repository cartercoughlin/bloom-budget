# Environment Variables Documentation

This document describes all environment variables used in the Budget App.

## Required Variables

### Server Configuration
- `PORT` - Port number for the backend server (default: 3000)
- `NODE_ENV` - Environment mode: development, production, or test

### Database
- `DATABASE_URL` - PostgreSQL connection string
  - Format: `postgresql://username:password@host:port/database`
  - Example: `postgresql://user:password@localhost:5432/budget_app`

### Redis
- `REDIS_URL` - Redis connection string
  - Format: `redis://host:port`
  - Example: `redis://localhost:6379`

### Plaid Configuration
- `PLAID_CLIENT_ID` - Your Plaid client ID
- `PLAID_SECRET` - Your Plaid secret key
- `PLAID_ENV` - Plaid environment: sandbox, development, or production

### Security
- `JWT_SECRET` - Secret key for JWT token generation (minimum 32 characters)
- `ENCRYPTION_KEY` - Key for AES-256 encryption (minimum 32 characters)
- `SESSION_SECRET` - Secret for session management

### CORS
- `FRONTEND_URL` - Frontend application URL for CORS (default: http://localhost:5173)

## Optional Variables

### Logging
- `LOG_LEVEL` - Logging level: error, warn, info, http, debug (default: info in production, debug in development)

## Production Deployment Checklist

1. **Generate Strong Secrets**
   ```bash
   # Generate JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Generate ENCRYPTION_KEY
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Generate SESSION_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Set NODE_ENV to production**
   ```
   NODE_ENV=production
   ```

3. **Use Production Database**
   - Ensure DATABASE_URL points to your production PostgreSQL instance
   - Use SSL connection for production databases

4. **Configure Plaid for Production**
   - Set PLAID_ENV=production
   - Use production Plaid credentials

5. **Set Proper CORS**
   - Set FRONTEND_URL to your production frontend domain

6. **Enable Redis**
   - Ensure REDIS_URL points to your production Redis instance

## Security Best Practices

1. **Never commit .env files to version control**
2. **Use different secrets for each environment**
3. **Rotate secrets regularly**
4. **Use environment-specific credentials**
5. **Enable SSL/TLS for all database connections in production**
6. **Use managed services for Redis and PostgreSQL in production**

## Example .env File

See `.env.example` in the backend directory for a template.
