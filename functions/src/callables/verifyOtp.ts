import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb, loadAdminSettings } from '../helpers/admin';
import { hashOtpCode, hashPhoneE164 } from '../helpers/hashing';
import type { OtpSessionDoc } from '../types';
import { findOrCreateAuthUserByPhone } from './requestOtp';

interface VerifyOtpInput {
  sessionId: string;
  code: string;
}

interface VerifyOtpResult {
  customToken: string;
  isNewUser: boolean;
}

export const verifyOtp = onCall(
  { cors: true },
  async (request): Promise<VerifyOtpResult> => {
    const data = request.data as VerifyOtpInput;
    if (!data?.sessionId || typeof data.sessionId !== 'string') {
      throw new HttpsError('invalid-argument', 'sessionId is required.');
    }
    if (!data?.code || typeof data.code !== 'string') {
      throw new HttpsError('invalid-argument', 'code is required.');
    }

    const code = data.code.trim();
    if (!/^\d{4,8}$/.test(code)) {
      throw new HttpsError('invalid-argument', 'Invalid OTP code.');
    }

    const db = getDb();
    const settings = await loadAdminSettings(db);
    const sessionRef = db.collection('otpSessions').doc(data.sessionId);

    const session = await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', 'OTP session not found.');
      }

      const doc = snap.data() as OtpSessionDoc;
      if (doc.consumed) {
        throw new HttpsError('failed-precondition', 'OTP already used.');
      }

      const now = Date.now();
      if (now > doc.expiresAt) {
        tx.update(sessionRef, { consumed: true });
        throw new HttpsError('deadline-exceeded', 'OTP expired.');
      }

      if (doc.attempts >= doc.maxAttempts) {
        tx.update(sessionRef, { consumed: true });
        throw new HttpsError('resource-exhausted', 'Too many OTP attempts.');
      }

      const expected = hashOtpCode(code);
      if (expected !== doc.codeHash) {
        tx.update(sessionRef, { attempts: doc.attempts + 1 });
        throw new HttpsError('invalid-argument', 'Invalid OTP code.');
      }

      tx.update(sessionRef, { consumed: true, verifiedAt: now });
      return doc;
    });

    if (!settings.allowNewSignups) {
      // Allow existing users; block brand-new phones only after Auth lookup.
    }

    const { uid, isNewUser } = await findOrCreateAuthUserByPhone(
      session.phoneE164,
    );

    if (isNewUser && !settings.allowNewSignups) {
      await admin.auth().deleteUser(uid);
      throw new HttpsError('failed-precondition', 'New signups are disabled.');
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const phoneHash = session.phoneHash || hashPhoneE164(session.phoneE164);
    const nowMs = Date.now();

    if (!userSnap.exists) {
      await userRef.set({
        phoneE164: session.phoneE164,
        phoneHash,
        username: '',
        displayName: '',
        notificationPreferences: {
          pushEnabled: true,
          reactionNotifications: true,
          requestNotifications: true,
          milestoneNotifications: true,
          mode: 'smart',
        },
        isAdmin: false,
        lastActiveAt: nowMs,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('phoneHashes').doc(phoneHash).set(
        {
          uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    // Invalidate any sibling open sessions for this phone.
    const open = await db
      .collection('otpSessions')
      .where('phoneHash', '==', phoneHash)
      .where('consumed', '==', false)
      .limit(20)
      .get();
    const batch = db.batch();
    for (const d of open.docs) {
      batch.update(d.ref, { consumed: true });
    }
    if (!open.empty) {
      await batch.commit();
    }

    await sessionRef.delete().catch(() => {
      // Already marked consumed; delete is best-effort.
    });

    const customToken = await admin.auth().createCustomToken(uid);
    return { customToken, isNewUser: isNewUser || !userSnap.exists };
  },
);
