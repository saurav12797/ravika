import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb, requireAuth } from '../helpers/admin';

interface RegisterDeviceInput {
  token: string;
  platform?: string;
}

interface RegisterDeviceResult {
  tokenId: string;
  ok: true;
}

function tokenDocId(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 40);
}

export const registerDevice = onCall(
  { cors: true },
  async (request): Promise<RegisterDeviceResult> => {
    const uid = requireAuth(request.auth?.uid);
    const data = request.data as RegisterDeviceInput;

    if (!data?.token || typeof data.token !== 'string' || !data.token.trim()) {
      throw new HttpsError('invalid-argument', 'token is required.');
    }

    const token = data.token.trim();
    const platform =
      typeof data.platform === 'string' ? data.platform.trim() : undefined;
    const db = getDb();
    const nowMs = Date.now();
    const tokenId = tokenDocId(token);
    const ref = db
      .collection('userDevices')
      .doc(uid)
      .collection('tokens')
      .doc(tokenId);

    const existing = await ref.get();
    await ref.set(
      {
        token,
        platform: platform ?? null,
        updatedAt: nowMs,
        createdAt: existing.exists
          ? (existing.data()?.createdAt as number | undefined) ?? nowMs
          : nowMs,
      },
      { merge: true },
    );

    // Keep legacy array on user doc in sync for older clients.
    await db
      .collection('users')
      .doc(uid)
      .set(
        {
          deviceTokens: admin.firestore.FieldValue.arrayUnion(token),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return { tokenId, ok: true };
  },
);
