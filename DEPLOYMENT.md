# Deployment Guide

This guide covers deploying the Budget App to production.

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] All environment variables set (see `ENV_VARIABLES.md`)
- [ ] Strong secrets generated for JWT_SECRET, ENCRYPTION_KEY, SESSION_SECRET
- [ ] Production database URL configured
- [ ] Production Redis URL configured
- [ ] Plaid production credentials obtained
- [ ] FRONTEND_URL set to production domain

### 2. Database Setup
- [ ] Production PostgreSQL database created
- [ ] Database backups configured
- [ ] SSL/TLS enabled for database connections
- [ ] Connection pooling configured

### 3. Security
- [ ] HTTPS/TLS certificates obtained
- [ ] CORS configured for production domain
- [ ] Rate limiting tested
- [ ] Security headers verified
- [ ] Secrets stored securely (not in code)

### 4. Testing
- [ ] All tests passing
- [ ] Integration tests run against staging
- [ ] Load testing completed
- [ ] Security audit performed

## Deployment Options

### Option 1: Docker Compose (Recommended for Small Scale)

1. **Prepare environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Build and start:**
   ```bash
   docker-compose up -d
   ```

3. **Check logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Run migrations:**
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

### Option 2: Kubernetes (Recommended for Scale)

1. **Create Kubernetes secrets:**
   ```bash
   kubectl create secret generic budget-app-secrets \
     --from-literal=jwt-secret=$JWT_SECRET \
     --from-literal=encryption-key=$ENCRYPTION_KEY \
     --from-literal=database-url=$DATABASE_URL
   ```

2. **Apply configurations:**
   ```bash
   kubectl apply -f k8s/
   ```

3. **Check status:**
   ```bash
   kubectl get pods
   kubectl logs -f deployment/budget-app-backend
   ```

### Option 3: Cloud Platforms

#### AWS

**Services needed:**
- ECS/Fargate for containers
- RDS for PostgreSQL
- ElastiCache for Redis
- ALB for load balancing
- Route 53 for DNS
- ACM for SSL certificates

**Deployment steps:**
1. Create RDS PostgreSQL instance
2. Create ElastiCache Redis cluster
3. Build and push Docker images to ECR
4. Create ECS task definitions
5. Create ECS services
6. Configure ALB with SSL
7. Update DNS records

#### Google Cloud Platform

**Services needed:**
- Cloud Run for containers
- Cloud SQL for PostgreSQL
- Memorystore for Redis
- Cloud Load Balancing
- Cloud DNS

**Deployment steps:**
1. Create Cloud SQL instance
2. Create Memorystore instance
3. Build and push to Container Registry
4. Deploy to Cloud Run
5. Configure load balancer
6. Update DNS

#### Azure

**Services needed:**
- Container Instances or App Service
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Application Gateway
- Azure DNS

## Post-Deployment

### 1. Verify Deployment

```bash
# Check health endpoint
curl https://your-domain.com/health

# Check API
curl https://your-domain.com/api/health
```

### 2. Monitor

- Set up application monitoring (New Relic, DataDog, etc.)
- Configure error tracking (Sentry)
- Set up log aggregation (ELK, CloudWatch, etc.)
- Configure uptime monitoring
- Set up alerts for errors and performance issues

### 3. Database Maintenance

```bash
# Create backup
pg_dump -U username -d database > backup.sql

# Schedule regular backups
# Add to crontab:
0 2 * * * pg_dump -U username -d database > /backups/backup_$(date +\%Y\%m\%d).sql
```

### 4. SSL/TLS Setup

Using Let's Encrypt with Certbot:
```bash
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Scaling Considerations

### Horizontal Scaling

1. **Backend API:**
   - Run multiple instances behind load balancer
   - Use Redis for session storage (already configured)
   - Ensure stateless design

2. **Database:**
   - Use read replicas for read-heavy workloads
   - Implement connection pooling
   - Consider database sharding for very large scale

3. **Redis:**
   - Use Redis Cluster for high availability
   - Configure persistence for important data

### Performance Optimization

1. **Caching:**
   - Reports cached for 5 minutes (already implemented)
   - Consider CDN for static assets
   - Implement HTTP caching headers

2. **Database:**
   - Add indexes for frequently queried fields
   - Optimize slow queries
   - Use EXPLAIN ANALYZE for query planning

3. **Background Jobs:**
   - Use job queue for heavy operations
   - Implement rate limiting for external APIs
   - Add retry logic with exponential backoff

## Rollback Procedure

1. **Identify issue:**
   - Check logs
   - Review error tracking
   - Check monitoring dashboards

2. **Rollback application:**
   ```bash
   # Docker
   docker-compose down
   docker-compose up -d --build <previous-version>
   
   # Kubernetes
   kubectl rollout undo deployment/budget-app-backend
   ```

3. **Rollback database (if needed):**
   ```bash
   # Restore from backup
   psql -U username -d database < backup.sql
   ```

4. **Verify:**
   - Check health endpoints
   - Test critical functionality
   - Monitor error rates

## Troubleshooting

### Common Issues

1. **Database connection errors:**
   - Check DATABASE_URL
   - Verify network connectivity
   - Check database credentials
   - Verify SSL settings

2. **Redis connection errors:**
   - Check REDIS_URL
   - Verify Redis is running
   - Check network connectivity

3. **Plaid API errors:**
   - Verify Plaid credentials
   - Check PLAID_ENV setting
   - Review Plaid dashboard for issues

4. **High memory usage:**
   - Check for memory leaks
   - Review connection pooling
   - Monitor Redis memory usage

5. **Slow performance:**
   - Check database query performance
   - Review API response times
   - Check Redis hit rates
   - Monitor CPU and memory usage

## Maintenance

### Regular Tasks

- **Daily:**
  - Monitor error rates
  - Check system health
  - Review logs for issues

- **Weekly:**
  - Review performance metrics
  - Check disk space
  - Review security alerts

- **Monthly:**
  - Update dependencies
  - Review and rotate secrets
  - Database maintenance (VACUUM, ANALYZE)
  - Review and optimize slow queries

### Updates

1. **Test in staging first**
2. **Create database backup**
3. **Deploy during low-traffic period**
4. **Monitor closely after deployment**
5. **Have rollback plan ready**

## Support

For deployment issues:
1. Check logs: `docker-compose logs -f`
2. Review error tracking dashboard
3. Check monitoring dashboards
4. Consult documentation
5. Open GitHub issue if needed
