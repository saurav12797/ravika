import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from 'firebase/firestore';

/** Convert Firestore Timestamp | number | Date - epoch ms. */
export function toMillis(
  value: Timestamp | Date | number | null | undefined,
): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  return 0;
}

export function createConverter<T extends DocumentData>(
  fromFirestore: (id: string, data: DocumentData) => T,
): FirestoreDataConverter<T> {
  return {
    toFirestore(model: T): DocumentData {
      const { id: _id, ...rest } = model as T & { id?: string };
      return rest;
    },
    fromFirestore(
      snapshot: QueryDocumentSnapshot<DocumentData, DocumentData>,
      _options: SnapshotOptions,
    ): T {
      return fromFirestore(snapshot.id, snapshot.data());
    },
  };
}
