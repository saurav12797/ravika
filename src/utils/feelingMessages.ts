import type { ReactionDefinition } from '@/constants/reactions';
import type { ReactionType } from '@/types/models';

/** In-memory shuffle bags — drain all 50 before reshuffling. */
const messageDecks = new Map<string, number[]>();
const notifDecks = new Map<string, number[]>();

function shuffleIndices(len: number): number[] {
  const arr = Array.from({ length: len }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function nextIndex(decks: Map<string, number[]>, key: string, len: number): number {
  if (len <= 0) return 0;
  let deck = decks.get(key);
  if (!deck || deck.length === 0) {
    deck = shuffleIndices(len);
    decks.set(key, deck);
  }
  return deck.pop() ?? 0;
}

function cleanList(variants: string[] | undefined): string[] {
  return (variants ?? []).map((v) => v.trim()).filter(Boolean);
}

function deckKey(id: ReactionType | string | number | undefined, title: string): string {
  return id != null ? String(id) : title || 'feeling';
}

/**
 * Pick a random sub-message without repeating until all variants are used,
 * then reshuffle. Pairs notification template at the same index when possible.
 */
export function pickFeelingSendCopy(
  def: Pick<
    ReactionDefinition,
    | 'id'
    | 'title'
    | 'defaultMessage'
    | 'defaultMessages'
    | 'notificationTemplate'
    | 'notificationTemplates'
  >,
): { message: string; notificationBody: string } {
  const messages = cleanList(def.defaultMessages);
  const notifs = cleanList(def.notificationTemplates);
  const key = deckKey(def.id, def.title);

  if (messages.length === 0) {
    const message = (def.defaultMessage || def.title || 'Thinking of you').trim();
    const notificationBody =
      (def.notificationTemplate || `{name}: ${message}`).trim();
    return { message, notificationBody };
  }

  const index = nextIndex(messageDecks, `msg:${key}`, messages.length);
  const message = messages[index] ?? messages[0]!;

  let notificationBody: string;
  if (notifs.length > 0) {
    // Prefer matching index; if lengths differ, draw from notif deck.
    if (notifs[index]) {
      notificationBody = notifs[index]!;
    } else {
      const ni = nextIndex(notifDecks, `notif:${key}`, notifs.length);
      notificationBody = notifs[ni] ?? def.notificationTemplate;
    }
  } else {
    notificationBody = def.notificationTemplate || `{name}: ${message}`;
  }

  return { message, notificationBody };
}

/**
 * Pick one of the unique sub-messages for a feeling (non-repeating shuffle).
 */
export function pickFeelingMessage(
  def: Pick<
    ReactionDefinition,
    'id' | 'title' | 'defaultMessage' | 'emoji' | 'defaultMessages'
  >,
  exclude?: string,
): string {
  const variants = cleanList(def.defaultMessages);
  if (variants.length === 0) {
    return (def.defaultMessage || def.title || 'Thinking of you').trim();
  }

  const key = deckKey(def.id, def.title);
  // Try up to a few draws to avoid immediate exclude collision.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const index = nextIndex(messageDecks, `msg:${key}`, variants.length);
    const picked = variants[index] ?? variants[0]!;
    if (!exclude || picked !== exclude || variants.length === 1) {
      return picked;
    }
  }
  const pool = variants.filter((v) => v !== exclude);
  return (pool[0] ?? variants[0])!;
}

/** All sub-message variants for a feeling (for previews / admin). */
export function getFeelingMessageVariants(
  def: Pick<ReactionDefinition, 'defaultMessage' | 'defaultMessages' | 'title'>,
): string[] {
  const variants = cleanList(def.defaultMessages);
  if (variants.length > 0) return variants;
  const base = (def.defaultMessage || def.title).trim();
  return base ? [base] : [];
}
