import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getDb, loadAdminSettings, requireAuth } from '../helpers/admin';

interface MatchContactsInput {
  phoneHashes: string[];
}

interface MatchContact {
  phoneHash: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  /** Spec-compatible aliases */
  uid: string;
  photoURL?: string;
}

interface MatchContactsResult {
  matches: MatchContact[];
}

const MAX_HASHES = 500;
const CHUNK = 10;

export const matchContacts = onCall(
  { cors: true },
  async (request): Promise<MatchContactsResult> => {
    requireAuth(request.auth?.uid);
    const db = getDb();
    const settings = await loadAdminSettings(db);
    if (!settings.featureFlags.contactDiscovery) {
      throw new HttpsError(
        'failed-precondition',
        'Contact discovery is disabled.',
      );
    }

    const data = request.data as MatchContactsInput;
    if (!Array.isArray(data?.phoneHashes)) {
      throw new HttpsError('invalid-argument', 'phoneHashes must be an array.');
    }

    const unique = [
      ...new Set(data.phoneHashes.map((h) => String(h).trim()).filter(Boolean)),
    ];
    if (unique.length > MAX_HASHES) {
      throw new HttpsError(
        'invalid-argument',
        `At most ${MAX_HASHES} phoneHashes allowed.`,
      );
    }

    const matches: MatchContact[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < unique.length; i += CHUNK) {
      const chunk = unique.slice(i, i + CHUNK);

      // Resolve via phoneHashes/{hash} → uid when present.
      const indexRefs = chunk.map((h) => db.collection('phoneHashes').doc(h));
      const indexDocs = await db.getAll(...indexRefs);
      const indexedUids: Array<{ hash: string; uid: string }> = [];
      const missingHashes: string[] = [];

      for (let j = 0; j < indexDocs.length; j += 1) {
        const doc = indexDocs[j];
        if (doc.exists) {
          const uid = String(doc.data()?.uid ?? '');
          if (uid) {
            indexedUids.push({ hash: chunk[j], uid });
            continue;
          }
        }
        missingHashes.push(chunk[j]);
      }

      if (indexedUids.length > 0) {
        const userDocs = await db.getAll(
          ...indexedUids.map((x) => db.collection('users').doc(x.uid)),
        );
        for (let j = 0; j < userDocs.length; j += 1) {
          const u = userDocs[j];
          if (!u.exists) continue;
          const hash = indexedUids[j].hash;
          if (seen.has(hash)) continue;
          seen.add(hash);
          const profile = u.data() ?? {};
          const avatarUrl =
            profile.avatarUrl != null ? String(profile.avatarUrl) : undefined;
          matches.push({
            phoneHash: hash,
            userId: u.id,
            uid: u.id,
            username: String(profile.username ?? ''),
            displayName: String(profile.displayName ?? ''),
            avatarUrl,
            photoURL: avatarUrl,
          });
        }
      }

      if (missingHashes.length > 0) {
        const q = await db
          .collection('users')
          .where('phoneHash', 'in', missingHashes)
          .limit(CHUNK)
          .get();
        for (const d of q.docs) {
          const profile = d.data();
          const hash = String(profile.phoneHash ?? '');
          if (!hash || seen.has(hash)) continue;
          seen.add(hash);
          const avatarUrl =
            profile.avatarUrl != null ? String(profile.avatarUrl) : undefined;
          matches.push({
            phoneHash: hash,
            userId: d.id,
            uid: d.id,
            username: String(profile.username ?? ''),
            displayName: String(profile.displayName ?? ''),
            avatarUrl,
            photoURL: avatarUrl,
          });
        }
      }
    }

    return { matches };
  },
);

/** Client alias - discoveryService calls this name. */
export const matchContactsByPhoneHashes = matchContacts;
