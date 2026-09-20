import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getReciprocalRelationship } from '@/constants/relationships';
import { getCurrentUser } from '@/services/authService';
import { getDb } from '@/services/firebase';
import { toMillis } from '@/services/firestoreUtils';
import { notifyConnectionRequest } from '@/services/notificationService';
import type {
  Connection,
  ConnectionParticipant,
  ConnectionRequest,
  FeelingOverride,
  RelationshipType,
  RequestStatus,
  RespondToRequestAction,
  SharedFeeling,
} from '@/types/models';
import { AppError } from '@/utils/errors';
import { canPinConnection, MAX_PINNED_CONNECTIONS } from '@/utils/pins';

const CONNECTIONS = 'connections';
const REQUESTS = 'connectionRequests';
const MAX_PINS = MAX_PINNED_CONNECTIONS;

function sortedUserPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function mapRequest(
  id: string,
  data: Record<string, unknown>,
): ConnectionRequest {
  return {
    id,
    fromUserId: String(data.fromUserId),
    toUserId: String(data.toUserId),
    proposedRelationshipType: data.proposedRelationshipType as RelationshipType,
    message: data.message != null ? String(data.message) : undefined,
    status: data.status as RequestStatus,
    createdAt: toMillis(data.createdAt as Parameters<typeof toMillis>[0]),
    updatedAt: toMillis(data.updatedAt as Parameters<typeof toMillis>[0]),
    respondedAt: data.respondedAt
      ? toMillis(data.respondedAt as Parameters<typeof toMillis>[0])
      : undefined,
  };
}

function mapConnection(
  id: string,
  data: Record<string, unknown>,
): Connection {
  const userIdsRaw = data.userIds as string[] | undefined;
  const userIds: [string, string] =
    userIdsRaw && userIdsRaw.length === 2
      ? sortedUserPair(userIdsRaw[0], userIdsRaw[1])
      : ['', ''];

  return {
    id,
    userIds,
    participants: (data.participants ?? {}) as Record<
      string,
      ConnectionParticipant
    >,
    status: data.status as Connection['status'],
    createdAt: toMillis(data.createdAt as Parameters<typeof toMillis>[0]),
    updatedAt: toMillis(data.updatedAt as Parameters<typeof toMillis>[0]),
    acceptedAt: data.acceptedAt
      ? toMillis(data.acceptedAt as Parameters<typeof toMillis>[0])
      : undefined,
    lastInteractionAt: data.lastInteractionAt
      ? toMillis(data.lastInteractionAt as Parameters<typeof toMillis>[0])
      : undefined,
    interactionCount: Number(data.interactionCount ?? 0),
    missYouCount: Number(data.missYouCount ?? 0),
    unreadCounts:
      data.unreadCounts && typeof data.unreadCounts === 'object'
        ? (data.unreadCounts as Record<string, number>)
        : {},
    sharedFeelings: Array.isArray(data.sharedFeelings)
      ? (data.sharedFeelings as SharedFeeling[])
      : [],
    feelingOverrides:
      data.feelingOverrides && typeof data.feelingOverrides === 'object'
        ? (data.feelingOverrides as Record<string, FeelingOverride>)
        : undefined,
  };
}

function requireUid(): string {
  const user = getCurrentUser();
  if (!user) {
    throw new AppError('auth/unauthenticated', 'Please sign in to continue.');
  }
  return user.uid;
}

export async function sendRequest(
  toUserId: string,
  proposedRelationshipType: RelationshipType,
  message?: string,
): Promise<ConnectionRequest> {
  const fromUserId = requireUid();
  if (fromUserId === toUserId) {
    throw new AppError('request/not-pending', 'You cannot connect with yourself.');
  }

  const pair = sortedUserPair(fromUserId, toUserId);
  const existing = await getDocs(
    query(
      collection(getDb(), CONNECTIONS),
      where('userIds', '==', pair),
      where('status', '==', 'active'),
    ),
  );
  if (!existing.empty) {
    throw new AppError(
      'connection/already-exists',
      'You are already connected.',
    );
  }

  const ref = await addDoc(collection(getDb(), REQUESTS), {
    fromUserId,
    toUserId,
    proposedRelationshipType,
    message: message?.trim() || null,
    status: 'pending' satisfies RequestStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const snap = await getDoc(ref);
  const request = mapRequest(snap.id, snap.data() ?? {});
  void notifyConnectionRequest(request.id, toUserId, fromUserId);
  return request;
}

/**
 * Accept creates an ACTIVE mutual connection.
 * Decline closes the request.
 * change_relationship updates the proposed type and keeps the request pending
 * so both parties can reach mutual agreement.
 */
export async function respondToRequest(
  requestId: string,
  action: RespondToRequestAction,
  relationshipType?: RelationshipType,
): Promise<{ request: ConnectionRequest; connection?: Connection }> {
  const uid = requireUid();
  const db = getDb();
  const ref = doc(db, REQUESTS, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new AppError('request/not-found', 'Request not found.');
  }

  const request = mapRequest(snap.id, snap.data());
  if (request.status !== 'pending') {
    throw new AppError('request/not-pending', 'This request is no longer pending.');
  }

  if (action === 'change_relationship') {
    if (!relationshipType) {
      throw new AppError(
        'request/not-pending',
        'Pick a relationship type to propose.',
      );
    }
    if (uid !== request.toUserId && uid !== request.fromUserId) {
      throw new AppError('permission-denied', 'Not allowed.');
    }

    await updateDoc(ref, {
      proposedRelationshipType: relationshipType,
      updatedAt: serverTimestamp(),
    });
    const updated = await getDoc(ref);
    return { request: mapRequest(updated.id, updated.data() ?? {}) };
  }

  if (uid !== request.toUserId) {
    throw new AppError('permission-denied', 'Only the recipient can respond.');
  }

  if (action === 'decline') {
    await updateDoc(ref, {
      status: 'declined',
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const updated = await getDoc(ref);
    return { request: mapRequest(updated.id, updated.data() ?? {}) };
  }

  // accept - sender keeps how they see recipient; accepter picks how they see sender
  const senderSeesRecipient = request.proposedRelationshipType;
  const recipientSeesSender =
    relationshipType ?? getReciprocalRelationship(senderSeesRecipient);
  const pair = sortedUserPair(request.fromUserId, request.toUserId);
  const batch = writeBatch(db);

  const connectionRef = doc(collection(db, CONNECTIONS));
  const participants: Record<string, ConnectionParticipant> = {
    [request.fromUserId]: {
      relationshipType: senderSeesRecipient,
      pinned: false,
    },
    [request.toUserId]: {
      relationshipType: recipientSeesSender,
      pinned: false,
    },
  };

  batch.set(connectionRef, {
    userIds: pair,
    participants,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    acceptedAt: serverTimestamp(),
  });

  batch.update(ref, {
    status: 'accepted',
    proposedRelationshipType: senderSeesRecipient,
    respondedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    connectionId: connectionRef.id,
  });

  await batch.commit();

  const connectionSnap = await getDoc(connectionRef);
  const requestSnap = await getDoc(ref);

  return {
    request: mapRequest(requestSnap.id, requestSnap.data() ?? {}),
    connection: mapConnection(connectionSnap.id, connectionSnap.data() ?? {}),
  };
}

export async function cancelRequest(requestId: string): Promise<void> {
  const uid = requireUid();
  const ref = doc(getDb(), REQUESTS, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new AppError('request/not-found', 'Request not found.');
  }
  const request = mapRequest(snap.id, snap.data());
  if (request.fromUserId !== uid) {
    throw new AppError('permission-denied', 'Only the sender can cancel.');
  }
  if (request.status !== 'pending') {
    throw new AppError('request/not-pending', 'This request is no longer pending.');
  }
  await updateDoc(ref, {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

export async function listConnections(userId?: string): Promise<Connection[]> {
  const uid = userId ?? requireUid();
  const q = query(
    collection(getDb(), CONNECTIONS),
    where('userIds', 'array-contains', uid),
    where('status', '==', 'active'),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => mapConnection(d.id, d.data()));
}

export async function listRequests(
  direction: 'incoming' | 'outgoing' = 'incoming',
): Promise<ConnectionRequest[]> {
  const uid = requireUid();
  const field = direction === 'incoming' ? 'toUserId' : 'fromUserId';
  const q = query(
    collection(getDb(), REQUESTS),
    where(field, '==', uid),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => mapRequest(d.id, d.data()));
}

async function countPins(userId: string): Promise<number> {
  const connections = await listConnections(userId);
  return connections.filter((c) => c.participants[userId]?.pinned).length;
}

export async function pinConnection(connectionId: string): Promise<Connection> {
  const uid = requireUid();
  const ref = doc(getDb(), CONNECTIONS, connectionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new AppError('connection/not-found', 'Connection not found.');
  }
  const connection = mapConnection(snap.id, snap.data());
  if (!connection.userIds.includes(uid)) {
    throw new AppError('permission-denied', 'Not allowed.');
  }

  const participant = connection.participants[uid];
  if (participant?.pinned) {
    return connection;
  }

  const pins = await countPins(uid);
  if (!canPinConnection(pins, MAX_PINS)) {
    throw new AppError(
      'connection/pin-limit',
      'You can pin up to 2 people.',
    );
  }

  await updateDoc(ref, {
    [`participants.${uid}.pinned`]: true,
    [`participants.${uid}.pinOrder`]: pins,
    updatedAt: serverTimestamp(),
  });

  const updated = await getDoc(ref);
  return mapConnection(updated.id, updated.data() ?? {});
}

export async function unpinConnection(connectionId: string): Promise<Connection> {
  const uid = requireUid();
  const ref = doc(getDb(), CONNECTIONS, connectionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new AppError('connection/not-found', 'Connection not found.');
  }
  const connection = mapConnection(snap.id, snap.data());
  if (!connection.userIds.includes(uid)) {
    throw new AppError('permission-denied', 'Not allowed.');
  }

  await updateDoc(ref, {
    [`participants.${uid}.pinned`]: false,
    [`participants.${uid}.pinOrder`]: null,
    updatedAt: serverTimestamp(),
  });

  const updated = await getDoc(ref);
  return mapConnection(updated.id, updated.data() ?? {});
}

export async function reorderPins(connectionIds: string[]): Promise<void> {
  const uid = requireUid();
  if (connectionIds.length > MAX_PINS) {
    throw new AppError(
      'connection/pin-limit',
      'You can pin up to 2 people.',
    );
  }

  const db = getDb();
  const batch = writeBatch(db);

  for (let i = 0; i < connectionIds.length; i += 1) {
    const ref = doc(db, CONNECTIONS, connectionIds[i]);
    batch.update(ref, {
      [`participants.${uid}.pinned`]: true,
      [`participants.${uid}.pinOrder`]: i,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export function subscribeToConnections(
  userId: string,
  onChange: (connections: Connection[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), CONNECTIONS),
    where('userIds', 'array-contains', userId),
    where('status', '==', 'active'),
  );

  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => mapConnection(d.id, d.data())));
    },
    (error) => onError?.(error),
  );
}

/** Live pending requests for the signed-in user (incoming or outgoing). */
export function subscribeToRequests(
  direction: 'incoming' | 'outgoing',
  onChange: (items: ConnectionRequest[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const uid = requireUid();
  const field = direction === 'incoming' ? 'toUserId' : 'fromUserId';
  const q = query(
    collection(getDb(), REQUESTS),
    where(field, '==', uid),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => mapRequest(d.id, d.data())));
    },
    (error) => onError?.(error),
  );
}

/** Clear unread feeling badges for this user across the given connections. */
export async function clearUnreadForUser(
  connectionIds: string[],
): Promise<void> {
  const uid = requireUid();
  if (connectionIds.length === 0) return;

  const db = getDb();
  const batch = writeBatch(db);
  let ops = 0;

  for (const connectionId of connectionIds.slice(0, 40)) {
    batch.update(doc(db, CONNECTIONS, connectionId), {
      [`unreadCounts.${uid}`]: 0,
      updatedAt: serverTimestamp(),
    });
    ops += 1;
  }

  if (ops > 0) {
    try {
      await batch.commit();
    } catch {
      // Soft-fail - rules may block; badge still clears locally via lastReadAt.
    }
  }
}

/** Change how *you* see this person (friend, girlfriend, soulmate, …). */
export async function updateMyRelationshipType(
  connectionId: string,
  relationshipType: RelationshipType,
): Promise<Connection> {
  const uid = requireUid();
  const ref = doc(getDb(), CONNECTIONS, connectionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new AppError('connection/not-found', 'Connection not found.');
  }
  const connection = mapConnection(snap.id, snap.data());
  if (!connection.userIds.includes(uid)) {
    throw new AppError('permission-denied', 'Not allowed.');
  }
  const participant = connection.participants[uid];
  if (!participant) {
    throw new AppError('permission-denied', 'Not a participant.');
  }
  if (participant.relationshipType === relationshipType) {
    return connection;
  }

  await updateDoc(ref, {
    [`participants.${uid}.relationshipType`]: relationshipType,
    updatedAt: serverTimestamp(),
  });

  const updated = await getDoc(ref);
  return mapConnection(updated.id, updated.data() ?? {});
}
