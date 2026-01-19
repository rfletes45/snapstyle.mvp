/**
 * Generate a paired ID for friend/chat relationships
 * Format: {minUid}_{maxUid}
 */
export function pairId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

/**
 * Generate a unique ID (timestamp + random suffix)
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  return `${timestamp}_${randomSuffix}`;
}

/**
 * Extract UIDs from a pairId
 */
export function extractPairUids(pairId: string): [string, string] {
  const parts = pairId.split("_");
  // Handle case where UIDs themselves contain underscores
  // For simplicity, assume standard Firebase UIDs don't contain underscores
  const mid = Math.floor(parts.length / 2);
  return [parts.slice(0, mid).join("_"), parts.slice(mid).join("_")];
}
