import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  allowTestOtp,
  getDb,
  isEmulator,
  loadAdminSettings,
} from '../helpers/admin';
import { generateOtpCode, hashOtpCode, hashPhoneE164 } from '../helpers/hashing';
import { normalizePhoneE164 } from '../helpers/phone';
import { evaluateOtpRateLimit } from '../helpers/rateLimits';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface RequestOtpInput {
  phoneE164: string;
}

interface RequestOtpResult {
  sessionId: string;
  expiresAt: number;
  debugOtp?: string;
}

async function sendTwilioSms(phoneE164: string, code: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: phoneE164,
    From: from,
    Body: `Your Ravika code is ${code}. It expires in 5 minutes.`,
  });

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('Twilio SMS failed', { status: res.status, text });
    throw new HttpsError('internal', 'Failed to send SMS.');
  }

  return true;
}

export const requestOtp = onCall(
  { cors: true },
  async (request): Promise<RequestOtpResult> => {
    const data = request.data as RequestOtpInput;
    if (!data?.phoneE164 || typeof data.phoneE164 !== 'string') {
      throw new HttpsError('invalid-argument', 'phoneE164 is required.');
    }

    const phoneE164 = normalizePhoneE164(data.phoneE164);
    const phoneHash = hashPhoneE164(phoneE164);
    const db = getDb();
    const settings = await loadAdminSettings(db);
    const nowMs = Date.now();

    if (settings.maintenanceMode) {
      throw new HttpsError('unavailable', 'Ravika is under maintenance.');
    }

    // Rate-limit OTP requests per phone via rateLimitBuckets keyed by phoneHash.
    const bucketRef = db.collection('rateLimitBuckets').doc(`otp_${phoneHash}`);
    const rate = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bucketRef);
      const existing = snap.exists
        ? (snap.data() as { otpHourKey?: string; otpHourCount?: number })
        : {};
      const result = evaluateOtpRateLimit({
        nowMs,
        otpPerHour: settings.rateLimits.otpPerHour,
        existing,
      });
      if (!result.allowed) {
        return result;
      }
      tx.set(
        bucketRef,
        {
          ...result.next,
          phoneHash,
          updatedAt: nowMs,
        },
        { merge: true },
      );
      return result;
    });

    if (!rate.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        'Too many OTP requests. Try again later.',
      );
    }

    const code = generateOtpCode();
    const expiresAt = nowMs + OTP_TTL_MS;
    const sessionRef = db.collection('otpSessions').doc();

    await sessionRef.set({
      phoneE164,
      phoneHash,
      codeHash: hashOtpCode(code),
      expiresAt,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: nowMs,
      consumed: false,
    });

    const sent = await sendTwilioSms(phoneE164, code);
    if (!sent) {
      if (!allowTestOtp()) {
        throw new HttpsError(
          'failed-precondition',
          'SMS provider is not configured.',
        );
      }
      logger.info('[TEST OTP]', { phoneE164, code, sessionId: sessionRef.id });
    }

    const result: RequestOtpResult = {
      sessionId: sessionRef.id,
      expiresAt,
    };

    if (isEmulator()) {
      result.debugOtp = code;
    }

    return result;
  },
);

/**
 * Find existing Auth user by phone, or create one.
 */
export async function findOrCreateAuthUserByPhone(
  phoneE164: string,
): Promise<{ uid: string; isNewUser: boolean }> {
  try {
    const existing = await admin.auth().getUserByPhoneNumber(phoneE164);
    return { uid: existing.uid, isNewUser: false };
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    if (code !== 'auth/user-not-found') {
      throw err;
    }
  }

  const created = await admin.auth().createUser({ phoneNumber: phoneE164 });
  return { uid: created.uid, isNewUser: true };
}
