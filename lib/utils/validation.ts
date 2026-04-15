/**
 * Environment variable validation and runtime checks
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_WIREFLUID_CHAIN_ID',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

export function validateEnvironment(): void {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    // Don't throw in production to avoid breaking the build
    if (process.env.NODE_ENV === 'development') {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }
}

export function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key];
  if (!value && !fallback) {
    console.warn(`⚠️ Environment variable ${key} is not set`);
    return '';
  }
  return value || fallback || '';
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidAmount(amount: number, max?: number): boolean {
  if (amount <= 0 || !Number.isInteger(amount)) return false;
  if (max !== undefined && amount > max) return false;
  return true;
}
