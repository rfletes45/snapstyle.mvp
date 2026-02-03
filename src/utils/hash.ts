/**
 * Hash Utility Functions
 *
 * Simple hashing utilities for cache keys and comparisons.
 */

/**
 * Create a simple hash from a string
 * Uses djb2 algorithm - fast and good distribution
 *
 * @param str - String to hash
 * @returns Hexadecimal hash string
 */
export function createHash(str: string): string {
  let hash = 5381;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) ^ char; // hash * 33 ^ char
  }

  // Convert to unsigned 32-bit integer and then to hex
  return (hash >>> 0).toString(16);
}

/**
 * Create a hash from an object by serializing to JSON
 *
 * @param obj - Object to hash
 * @returns Hexadecimal hash string
 */
export function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj);
  return createHash(str);
}

/**
 * Compare two objects for equality using hash comparison
 * Faster than deep comparison for large objects
 *
 * @param obj1 - First object
 * @param obj2 - Second object
 * @returns true if objects have the same hash
 */
export function hashEqual(obj1: unknown, obj2: unknown): boolean {
  return hashObject(obj1) === hashObject(obj2);
}

/**
 * Generate a short unique ID
 * Useful for cache keys and component keys
 *
 * @returns 8-character alphanumeric string
 */
export function generateShortId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp.slice(-4)}${random}`;
}
