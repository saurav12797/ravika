import type { RelationshipType } from '@/types/models';

export interface RelationshipTypeDefinition {
  id: RelationshipType;
  label: string;
  emoji: string;
}

export const RELATIONSHIP_TYPES: readonly RelationshipTypeDefinition[] = [
  { id: 'friend', label: 'Friend', emoji: '🤝' },
  { id: 'best_friend', label: 'Best Friend', emoji: '💫' },
  { id: 'girlfriend', label: 'Girlfriend', emoji: '💕' },
  { id: 'boyfriend', label: 'Boyfriend', emoji: '💙' },
  { id: 'wife', label: 'Wife', emoji: '💍' },
  { id: 'husband', label: 'Husband', emoji: '💍' },
  { id: 'sister', label: 'Sister', emoji: '👧' },
  { id: 'brother', label: 'Brother', emoji: '👦' },
  { id: 'mother', label: 'Mother', emoji: '👩' },
  { id: 'father', label: 'Father', emoji: '👨' },
  { id: 'daughter', label: 'Daughter', emoji: '🎀' },
  { id: 'son', label: 'Son', emoji: '🧢' },
  { id: 'cousin', label: 'Cousin', emoji: '🌿' },
  { id: 'family', label: 'Family', emoji: '🏠' },
  { id: 'crush', label: 'Crush', emoji: '😳' },
  { id: 'soulmate', label: 'Soulmate', emoji: '✨' },
  { id: 'other', label: 'Other', emoji: '🤍' },
] as const;

const byId = new Map<RelationshipType, RelationshipTypeDefinition>(
  RELATIONSHIP_TYPES.map((r) => [r.id, r]),
);

export function getRelationshipDefinition(
  id: RelationshipType,
): RelationshipTypeDefinition | undefined {
  return byId.get(id);
}

/**
 * How the other person typically sees you, given how you see them.
 * e.g. you connect as Girlfriend → they should see you as Boyfriend.
 */
const RECIPROCAL: Record<RelationshipType, RelationshipType> = {
  friend: 'friend',
  best_friend: 'best_friend',
  girlfriend: 'boyfriend',
  boyfriend: 'girlfriend',
  wife: 'husband',
  husband: 'wife',
  sister: 'brother',
  brother: 'sister',
  mother: 'daughter',
  father: 'son',
  daughter: 'mother',
  son: 'father',
  cousin: 'cousin',
  family: 'family',
  crush: 'crush',
  soulmate: 'soulmate',
  other: 'other',
};

export function getReciprocalRelationship(
  howSenderSeesRecipient: RelationshipType,
): RelationshipType {
  return RECIPROCAL[howSenderSeesRecipient] ?? 'friend';
}

/**
 * Options for the accepter: default reciprocal first, then close alternatives
 * (e.g. mother → daughter | son).
 */
export function getAcceptAsOptions(
  howSenderSeesRecipient: RelationshipType,
): RelationshipType[] {
  const primary = getReciprocalRelationship(howSenderSeesRecipient);
  const extras: RelationshipType[] = [];

  if (howSenderSeesRecipient === 'mother' || howSenderSeesRecipient === 'father') {
    extras.push('daughter', 'son');
  }
  if (howSenderSeesRecipient === 'daughter' || howSenderSeesRecipient === 'son') {
    extras.push('mother', 'father');
  }
  if (
    howSenderSeesRecipient === 'sister' ||
    howSenderSeesRecipient === 'brother'
  ) {
    extras.push('sister', 'brother');
  }
  if (
    howSenderSeesRecipient === 'girlfriend' ||
    howSenderSeesRecipient === 'boyfriend'
  ) {
    extras.push('girlfriend', 'boyfriend', 'soulmate');
  }
  if (howSenderSeesRecipient === 'wife' || howSenderSeesRecipient === 'husband') {
    extras.push('wife', 'husband');
  }

  const ordered: RelationshipType[] = [
    primary,
    ...extras,
    'friend',
    'best_friend',
    'other',
  ];
  return [...new Set(ordered)];
}
