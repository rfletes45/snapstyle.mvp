/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username (alphanumeric + underscore, 3-20 chars)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password (min 6 chars)
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Validate display name (1-50 chars)
 */
export function isValidDisplayName(displayName: string): boolean {
  return displayName.length > 0 && displayName.length <= 50;
}
