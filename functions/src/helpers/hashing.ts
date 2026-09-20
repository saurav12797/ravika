import { createHash, randomInt } from 'crypto';

/** SHA-256 hex digest of an arbitrary string. */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Privacy-preserving phone hash - must match client (SHA-256 of E.164). */
export function hashPhoneE164(phoneE164: string): string {
  return sha256(phoneE164);
}

/** Hash an OTP code for storage (never store plaintext). */
export function hashOtpCode(code: string): string {
  return sha256(code);
}

/** Cryptographically random 6-digit OTP (000000-999999, zero-padded). */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
