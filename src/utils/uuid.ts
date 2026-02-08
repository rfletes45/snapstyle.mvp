/**
 * UUID UTILITIES
 * Generate unique identifiers
 */

/**
 * Generate a v4 UUID
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a simple alphanumeric ID
 */
export function generateId(prefix: string = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Generate a picture ID with pic- prefix
 */
export function generateSnapId(): string {
  return generateId("pic");
}

/**
 * Generate a message ID with msg- prefix
 */
export function generateMessageId(): string {
  return generateId("msg");
}
