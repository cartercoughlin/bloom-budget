/**
 * Validate required environment variables
 */
export function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'PLAID_CLIENT_ID',
    'PLAID_SECRET',
    'PLAID_ENV',
    'ENCRYPTION_KEY',
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  // Validate ENCRYPTION_KEY length
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }

  // Validate PLAID_ENV
  const validPlaidEnvs = ['sandbox', 'development', 'production'];
  if (process.env.PLAID_ENV && !validPlaidEnvs.includes(process.env.PLAID_ENV)) {
    throw new Error(`PLAID_ENV must be one of: ${validPlaidEnvs.join(', ')}`);
  }

  console.log('✓ Environment variables validated successfully');
}
