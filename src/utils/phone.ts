import * as Crypto from 'expo-crypto';
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { AppError } from '@/utils/errors';

const DEFAULT_COUNTRY: CountryCode = 'US';

/**
 * Normalize a phone number to E.164.
 * Client-side validation only - the server must re-validate.
 */
export function normalizeToE164(
  input: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new AppError('auth/invalid-phone', 'Phone number is required.');
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    throw new AppError('auth/invalid-phone', 'Enter a valid phone number.');
  }

  return parsed.format('E.164');
}

export function isValidPhone(
  input: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): boolean {
  try {
    normalizeToE164(input, defaultCountry);
    return true;
  } catch {
    return false;
  }
}

/** Human-friendly national display, e.g. "(415) 555-2671". */
export function formatPhoneDisplay(
  input: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string {
  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  if (!parsed || !parsed.isValid()) {
    return input.trim();
  }
  return parsed.formatNational();
}

/**
 * Privacy-preserving SHA-256 hash of an E.164 phone for contact matching.
 * Always hash the normalized E.164 form before lookup.
 */
export async function hashPhone(phoneE164: string): Promise<string> {
  const normalized = normalizeToE164(phoneE164);
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalized,
  );
}

export async function hashPhones(phones: string[]): Promise<string[]> {
  const unique = new Set<string>();
  for (const phone of phones) {
    try {
      unique.add(normalizeToE164(phone));
    } catch {
      // Skip invalid contact numbers.
    }
  }
  return Promise.all([...unique].map((p) => hashPhone(p)));
}
