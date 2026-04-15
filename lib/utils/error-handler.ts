/**
 * Centralized error handling utilities
 */

import { toast } from 'sonner';
import { MESSAGES } from '@/lib/constants';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Parse contract revert reasons into user-friendly messages
 */
export function parseContractError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred';
  }

  const message = error.message.toLowerCase();

  // Common contract revert reasons
  if (message.includes('exceeds 10 token wallet cap')) {
    return MESSAGES.WALLET_CAP_HIT;
  }
  if (message.includes('exceeds supply')) {
    return MESSAGES.TOKEN_SOLD_OUT;
  }
  if (message.includes('insufficient holdings')) {
    return MESSAGES.INSUFFICIENT_HOLDINGS;
  }
  if (message.includes('rejected') || message.includes('denied')) {
    return MESSAGES.TRANSACTION_REJECTED;
  }
  if (message.includes('insufficient funds')) {
    return 'Insufficient funds in wallet';
  }

  // Return original message if no match
  return error.message;
}

/**
 * Handle and display errors with toast notifications
 */
export function handleError(error: unknown, context?: string): void {
  console.error(`Error${context ? ` in ${context}` : ''}:`, error);

  const message = parseContractError(error);
  toast.error(message);
}

/**
 * Async error wrapper for try-catch blocks
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return null;
  }
}
