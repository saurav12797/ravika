/**
 * Application error helpers with friendly user-facing messages.
 */

const CODE_MESSAGES: Record<string, string> = {
  'auth/invalid-otp': 'That code is incorrect. Please try again.',
  'auth/expired-otp': 'That code has expired. Request a new one.',
  'auth/otp-rate-limited': 'Too many attempts. Please wait and try again.',
  'auth/invalid-phone': 'Enter a valid phone number with country code.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/unauthenticated': 'Please sign in to continue.',
  'auth/session-expired': 'Your session expired. Sign in again.',
  'firebase/not-configured':
    'App is not connected to Firebase yet. Check your environment config.',
  'user/not-found': 'User not found.',
  'user/username-taken': 'That username is already taken.',
  'connection/not-found': 'Connection not found.',
  'connection/pin-limit': 'You can pin up to 2 people.',
  'connection/already-exists': 'You are already connected.',
  'request/not-found': 'Request not found.',
  'request/not-pending': 'This request is no longer pending.',
  'permission-denied': 'You do not have permission to do that.',
  unavailable: 'Service temporarily unavailable. Try again shortly.',
  unknown: 'Something went wrong. Please try again.',
};

export class AppError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return CODE_MESSAGES[error.code] ?? error.message;
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (CODE_MESSAGES[code]) {
      return CODE_MESSAGES[code];
    }
    if (code === 'functions/not-found') {
      return 'Service is unavailable right now.';
    }
    if (code === 'functions/unavailable' || code === 'unavailable') {
      return CODE_MESSAGES.unavailable;
    }
    if (code.includes('network') || code === 'auth/network-request-failed') {
      return CODE_MESSAGES['auth/network-request-failed'];
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return CODE_MESSAGES.unknown;
}

export function assertConfigured(isConfigured: boolean): void {
  if (!isConfigured) {
    throw new AppError(
      'firebase/not-configured',
      CODE_MESSAGES['firebase/not-configured'],
    );
  }
}
