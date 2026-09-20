import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Normalize + validate to E.164. Throws HttpsError on invalid input.
 */
export function normalizePhoneE164(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new HttpsError('invalid-argument', 'Phone number is required.');
  }

  const parsed = parsePhoneNumberFromString(trimmed, 'US');
  if (!parsed || !parsed.isValid()) {
    throw new HttpsError('invalid-argument', 'Enter a valid phone number.');
  }

  return parsed.format('E.164');
}
