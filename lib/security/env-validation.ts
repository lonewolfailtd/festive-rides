import { securityLogger } from './logger';

/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'ADMIN_EMAIL',
  'NEXT_PUBLIC_APP_URL',
] as const;

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'development',
  MAX_REQUEST_SIZE_BYTES: '1048576', // 1MB default
  RATE_LIMIT_WINDOW_MS: '900000', // 15 minutes default
  RATE_LIMIT_MAX_REQUESTS: '10', // 10 requests per window default
  DUPLICATE_BOOKING_WINDOW_HOURS: '24', // 24 hours default
  MIN_FORM_SUBMISSION_TIME_MS: '3000', // 3 seconds default
} as const;

export interface EnvValidationResult {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
}

/**
 * Validate that all required environment variables are present
 */
export function validateEnvironment(): EnvValidationResult {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // Check optional variables and warn if missing
  for (const [varName, defaultValue] of Object.entries(OPTIONAL_ENV_VARS)) {
    if (!process.env[varName]) {
      warnings.push(`${varName} not set, using default: ${defaultValue}`);
    }
  }

  const isValid = missingVars.length === 0;

  // Log critical failure if environment is invalid
  if (!isValid) {
    securityLogger.logEnvironmentCheckFailed(missingVars);
  }

  return {
    isValid,
    missingVars,
    warnings,
  };
}

/**
 * Get environment variable with fallback to default
 */
export function getEnvVar(
  key: keyof typeof OPTIONAL_ENV_VARS,
  defaultValue?: string
): string {
  return process.env[key] || defaultValue || OPTIONAL_ENV_VARS[key];
}

/**
 * Get numeric environment variable with validation
 */
export function getNumericEnvVar(
  key: keyof typeof OPTIONAL_ENV_VARS,
  defaultValue?: number
): number {
  const value = process.env[key] || (defaultValue !== undefined ? String(defaultValue) : OPTIONAL_ENV_VARS[key]);
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    console.warn(`Invalid numeric value for ${key}: ${value}, using default`);
    return defaultValue !== undefined ? defaultValue : parseInt(OPTIONAL_ENV_VARS[key], 10);
  }

  return parsed;
}

/**
 * Throw error and exit if environment is invalid
 */
export function requireValidEnvironment(): void {
  const result = validateEnvironment();

  if (!result.isValid) {
    console.error('CRITICAL: Environment validation failed!');
    console.error('Missing required environment variables:', result.missingVars);
    console.error('Application cannot start without these variables.');
    console.error('Please check your .env.local file and ensure all required variables are set.');

    // In production, you might want to exit the process
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      throw new Error(`Missing required environment variables: ${result.missingVars.join(', ')}`);
    }
  }

  // Log warnings for missing optional variables
  if (result.warnings.length > 0) {
    console.warn('Environment warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  console.log('Environment validation passed successfully');
}

// Export configuration with defaults
export const config = {
  maxRequestSizeBytes: getNumericEnvVar('MAX_REQUEST_SIZE_BYTES', 1048576),
  rateLimitWindowMs: getNumericEnvVar('RATE_LIMIT_WINDOW_MS', 900000),
  rateLimitMaxRequests: getNumericEnvVar('RATE_LIMIT_MAX_REQUESTS', 10),
  duplicateBookingWindowHours: getNumericEnvVar('DUPLICATE_BOOKING_WINDOW_HOURS', 24),
  minFormSubmissionTimeMs: getNumericEnvVar('MIN_FORM_SUBMISSION_TIME_MS', 3000),
};
