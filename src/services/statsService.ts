import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from '@/services/firebase';
import { toMillis } from '@/services/firestoreUtils';
import type { DailyStats, MonthlyStats, WeeklyStats } from '@/types/models';
import { dayKey, monthKey, weekKey } from '@/utils/dates';

const DAILY = 'dailyStats';
const WEEKLY = 'weeklyStats';
const MONTHLY = 'monthlyStats';

function mapDaily(id: string, data: Record<string, unknown>): DailyStats {
  return {
    id,
    connectionId: String(data.connectionId),
    dayKey: String(data.dayKey),
    totalCount: Number(data.totalCount ?? 0),
    byReaction: (data.byReaction ?? {}) as DailyStats['byReaction'],
    bySender: (data.bySender ?? {}) as Record<string, number>,
    updatedAt: toMillis(data.updatedAt as Parameters<typeof toMillis>[0]),
  };
}

function mapWeekly(id: string, data: Record<string, unknown>): WeeklyStats {
  return {
    id,
    connectionId: String(data.connectionId),
    weekKey: String(data.weekKey),
    totalCount: Number(data.totalCount ?? 0),
    byReaction: (data.byReaction ?? {}) as WeeklyStats['byReaction'],
    bySender: (data.bySender ?? {}) as Record<string, number>,
    streakDays: Number(data.streakDays ?? 0),
    updatedAt: toMillis(data.updatedAt as Parameters<typeof toMillis>[0]),
  };
}

function mapMonthly(id: string, data: Record<string, unknown>): MonthlyStats {
  return {
    id,
    connectionId: String(data.connectionId),
    monthKey: String(data.monthKey),
    totalCount: Number(data.totalCount ?? 0),
    byReaction: (data.byReaction ?? {}) as MonthlyStats['byReaction'],
    bySender: (data.bySender ?? {}) as Record<string, number>,
    updatedAt: toMillis(data.updatedAt as Parameters<typeof toMillis>[0]),
  };
}

export function subscribeToDailyStats(
  connectionId: string,
  onChange: (stats: DailyStats | null) => void,
  onError?: (error: Error) => void,
  key: string = dayKey(),
): Unsubscribe {
  const id = `${connectionId}_${key}`;
  return onSnapshot(
    doc(getDb(), DAILY, id),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(mapDaily(snap.id, snap.data()));
    },
    (error) => onError?.(error),
  );
}

export async function getDailyStats(
  connectionId: string,
  key: string = dayKey(),
): Promise<DailyStats | null> {
  const snap = await getDoc(doc(getDb(), DAILY, `${connectionId}_${key}`));
  if (!snap.exists()) {
    return null;
  }
  return mapDaily(snap.id, snap.data());
}

export async function getWeeklyStats(
  connectionId: string,
  key: string = weekKey(),
): Promise<WeeklyStats | null> {
  const snap = await getDoc(doc(getDb(), WEEKLY, `${connectionId}_${key}`));
  if (!snap.exists()) {
    return null;
  }
  return mapWeekly(snap.id, snap.data());
}

export async function getMonthlyStats(
  connectionId: string,
  key: string = monthKey(),
): Promise<MonthlyStats | null> {
  const snap = await getDoc(doc(getDb(), MONTHLY, `${connectionId}_${key}`));
  if (!snap.exists()) {
    return null;
  }
  return mapMonthly(snap.id, snap.data());
}

export interface ConnectionStatsSummary {
  today: DailyStats | null;
  week: WeeklyStats | null;
  month: MonthlyStats | null;
  recentDaily: DailyStats[];
}

export async function getConnectionStats(
  connectionId: string,
): Promise<ConnectionStatsSummary> {
  const [today, week, month, recentSnap] = await Promise.all([
    getDailyStats(connectionId),
    getWeeklyStats(connectionId),
    getMonthlyStats(connectionId),
    getDocs(
      query(
        collection(getDb(), DAILY),
        where('connectionId', '==', connectionId),
        orderBy('dayKey', 'desc'),
        limit(14),
      ),
    ),
  ]);

  return {
    today,
    week,
    month,
    recentDaily: recentSnap.docs.map((d) => mapDaily(d.id, d.data())),
  };
}
