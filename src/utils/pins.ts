/** Max pinned connections per user. */
export const MAX_PINNED_CONNECTIONS = 2;

/**
 * Whether the user may pin another connection given current pin count.
 */
export function canPinConnection(
  currentPinnedCount: number,
  maxPins: number = MAX_PINNED_CONNECTIONS,
): boolean {
  return currentPinnedCount < maxPins;
}

/**
 * Reorder pinOrder values for a list of connection ids (first = highest priority).
 */
export function assignPinOrders(
  orderedConnectionIds: string[],
): Record<string, number> {
  const result: Record<string, number> = {};
  orderedConnectionIds.forEach((id, index) => {
    result[id] = index;
  });
  return result;
}
