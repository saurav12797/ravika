import * as admin from 'firebase-admin';
import type { MilestoneKind } from '../types';

interface MilestoneDef {
  id: MilestoneKind;
  title: string;
  description: string;
  emoji: string;
  threshold: number;
  metric: 'total_interactions' | 'miss_you_count' | 'streak_days' | 'first';
}

const DEFINITIONS: MilestoneDef[] = [
  {
    id: 'first_interaction',
    title: 'First Spark',
    description: 'You shared your first reaction together.',
    emoji: '✨',
    threshold: 1,
    metric: 'first',
  },
  {
    id: 'miss_you_10',
    title: 'Ten Miss Yous',
    description: 'You have missed each other 10 times.',
    emoji: '🥺',
    threshold: 10,
    metric: 'miss_you_count',
  },
  {
    id: 'interactions_100',
    title: '100 Moments',
    description: 'You have shared 100 reactions.',
    emoji: '💯',
    threshold: 100,
    metric: 'total_interactions',
  },
  {
    id: 'interactions_500',
    title: '500 Moments',
    description: 'You have shared 500 reactions.',
    emoji: '🔥',
    threshold: 500,
    metric: 'total_interactions',
  },
  {
    id: 'interactions_1000',
    title: '1,000 Moments',
    description: 'You have shared 1,000 reactions.',
    emoji: '🏆',
    threshold: 1000,
    metric: 'total_interactions',
  },
  {
    id: 'streak_7',
    title: '7-Day Streak',
    description: 'You connected every day for a week.',
    emoji: '📅',
    threshold: 7,
    metric: 'streak_days',
  },
];

/**
 * Check and write newly achieved milestones under
 * `milestones/{connectionId}/items/{definitionId}`.
 * Also mirrors under each member's `milestones/{uid}/items/{connectionId_definitionId}`
 * for user-centric queries.
 */
export async function checkAndRecordMilestones(opts: {
  db: admin.firestore.Firestore;
  connectionId: string;
  memberIds: [string, string];
  totalInteractions: number;
  missYouCount: number;
  streakDays: number;
  nowMs: number;
}): Promise<MilestoneKind[]> {
  const {
    db,
    connectionId,
    memberIds,
    totalInteractions,
    missYouCount,
    streakDays,
    nowMs,
  } = opts;

  const achieved: MilestoneKind[] = [];

  for (const def of DEFINITIONS) {
    let hit = false;
    switch (def.metric) {
      case 'first':
        hit = totalInteractions >= 1;
        break;
      case 'miss_you_count':
        hit = missYouCount >= def.threshold;
        break;
      case 'total_interactions':
        hit = totalInteractions >= def.threshold;
        break;
      case 'streak_days':
        hit = streakDays >= def.threshold;
        break;
      default:
        hit = false;
    }
    if (!hit) {
      continue;
    }

    const itemRef = db
      .collection('milestones')
      .doc(connectionId)
      .collection('items')
      .doc(def.id);

    const existing = await itemRef.get();
    if (existing.exists) {
      continue;
    }

    const payload = {
      id: def.id,
      connectionId,
      definitionId: def.id,
      title: def.title,
      description: def.description,
      emoji: def.emoji,
      achievedAt: nowMs,
      metadata: {
        totalInteractions,
        missYouCount,
        streakDays,
      },
    };

    await itemRef.set(payload);
    achieved.push(def.id);

    for (const uid of memberIds) {
      await db
        .collection('milestones')
        .doc(uid)
        .collection('items')
        .doc(`${connectionId}_${def.id}`)
        .set({ ...payload, ownerUserId: uid });
    }
  }

  return achieved;
}
