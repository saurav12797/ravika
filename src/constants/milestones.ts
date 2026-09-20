import type { MilestoneDefinition } from '@/types/models';

export const MILESTONE_DEFINITIONS: readonly MilestoneDefinition[] = [
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
] as const;

const byId = new Map(
  MILESTONE_DEFINITIONS.map((m) => [m.id, m] as const),
);

export function getMilestoneDefinition(id: MilestoneDefinition['id']) {
  return byId.get(id);
}
