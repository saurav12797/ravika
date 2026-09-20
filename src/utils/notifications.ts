import { getReactionDefinition } from '@/constants/reactions';
import { getRelationshipDefinition } from '@/constants/relationships';
import type { ReactionType, RelationshipType } from '@/types/models';

/**
 * Build push notification body from reaction + optional relationship context.
 */
export function buildNotificationBody(
  senderName: string,
  reaction: ReactionType | { emoji: string; title: string; message?: string },
  relationship?: RelationshipType,
): string {
  const name = senderName.trim() || 'Someone';

  let body: string;
  if (typeof reaction === 'object') {
    body =
      reaction.message?.trim() ||
      `${name} sent ${reaction.emoji} ${reaction.title}`;
  } else {
    const def = getReactionDefinition(reaction);
    if (def) {
      body = def.notificationTemplate.replace('{name}', name);
    } else {
      body = `${name} sent you a reaction`;
    }
  }

  if (relationship) {
    const rel = getRelationshipDefinition(relationship);
    if (rel) {
      return `${body} · ${rel.emoji} ${rel.label}`;
    }
  }

  return body;
}
