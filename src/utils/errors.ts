/**
 * Error Handling Utilities
 *
 * Provides:
 * - AppError class for typed errors
 * - Error code mapping for Firebase/Auth/Storage errors
 * - User-friendly error messages
 * - Error categorization
 */

/**
 * Error categories for UI handling
 */
export type ErrorCategory =
  | "auth" // Authentication errors
  | "permission" // Permission/authorization errors
  | "network" // Network/connectivity errors
  | "validation" // Input validation errors
  | "not_found" // Resource not found
  | "storage" // Storage/upload errors
  | "conflict" // Conflicts (e.g., username taken)
  | "rate_limit" // Rate limiting
  | "unknown"; // Unknown errors

/**
 * Application error class with structured data
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly userMessage: string;
  public readonly isRetryable: boolean;
  public readonly originalError?: unknown;

  constructor(
    code: string,
    userMessage: string,
    options?: {
      category?: ErrorCategory;
      isRetryable?: boolean;
      originalError?: unknown;
    },
  ) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
    this.category = options?.category ?? "unknown";
    this.isRetryable = options?.isRetryable ?? false;
    this.originalError = options?.originalError;
  }

  /**
   * Create a user-friendly string representation
   */
  toString(): string {
    return `[${this.code}] ${this.userMessage}`;
  }

  /**
   * Log error with context (for debugging)
   */
  log(context?: string): void {
    const prefix = context ? `[${context}]` : "";
    console.error(`${prefix} AppError:`, {
      code: this.code,
      category: this.category,
      message: this.userMessage,
      isRetryable: this.isRetryable,
      originalError: this.originalError,
    });
  }
}

/**
 * Firebase Auth error code mappings
 */
const AUTH_ERROR_MAP: Record<
  string,
  { message: string; category: ErrorCategory; retryable: boolean }
> = {
  "auth/invalid-email": {
    message: "Please enter a valid email address.",
    category: "validation",
    retryable: false,
  },
  "auth/user-disabled": {
    message: "This account has been disabled. Please contact support.",
    category: "auth",
    retryable: false,
  },
  "auth/user-not-found": {
    message: "No account found with this email. Please sign up.",
    category: "auth",
    retryable: false,
  },
  "auth/wrong-password": {
    message: "Incorrect password. Please try again.",
    category: "auth",
    retryable: true,
  },
  "auth/invalid-credential": {
    message: "Invalid email or password. Please try again.",
    category: "auth",
    retryable: true,
  },
  "auth/email-already-in-use": {
    message: "This email is already registered. Please log in.",
    category: "conflict",
    retryable: false,
  },
  "auth/weak-password": {
    message: "Password is too weak. Use at least 6 characters.",
    category: "validation",
    retryable: false,
  },
  "auth/network-request-failed": {
    message: "Network error. Please check your connection and try again.",
    category: "network",
    retryable: true,
  },
  "auth/too-many-requests": {
    message: "Too many attempts. Please wait a moment and try again.",
    category: "rate_limit",
    retryable: true,
  },
  "auth/requires-recent-login": {
    message: "Please log in again to complete this action.",
    category: "auth",
    retryable: false,
  },
  "auth/popup-closed-by-user": {
    message: "Sign in was cancelled. Please try again.",
    category: "auth",
    retryable: true,
  },
};

/**
 * Firestore error code mappings
 */
const FIRESTORE_ERROR_MAP: Record<
  string,
  { message: string; category: ErrorCategory; retryable: boolean }
> = {
  "permission-denied": {
    message: "You don't have permission to perform this action.",
    category: "permission",
    retryable: false,
  },
  "not-found": {
    message: "The requested data could not be found.",
    category: "not_found",
    retryable: false,
  },
  "already-exists": {
    message: "This item already exists.",
    category: "conflict",
    retryable: false,
  },
  "resource-exhausted": {
    message: "Too many requests. Please wait a moment and try again.",
    category: "rate_limit",
    retryable: true,
  },
  unavailable: {
    message: "Service temporarily unavailable. Please try again.",
    category: "network",
    retryable: true,
  },
  "deadline-exceeded": {
    message: "Request timed out. Please try again.",
    category: "network",
    retryable: true,
  },
  cancelled: {
    message: "Request was cancelled.",
    category: "unknown",
    retryable: true,
  },
  aborted: {
    message: "Operation was aborted. Please try again.",
    category: "unknown",
    retryable: true,
  },
};

/**
 * Storage error code mappings
 */
const STORAGE_ERROR_MAP: Record<
  string,
  { message: string; category: ErrorCategory; retryable: boolean }
> = {
  "storage/object-not-found": {
    message: "File not found.",
    category: "not_found",
    retryable: false,
  },
  "storage/unauthorized": {
    message: "You don't have permission to access this file.",
    category: "permission",
    retryable: false,
  },
  "storage/canceled": {
    message: "Upload was cancelled.",
    category: "unknown",
    retryable: true,
  },
  "storage/quota-exceeded": {
    message: "Storage quota exceeded.",
    category: "storage",
    retryable: false,
  },
  "storage/retry-limit-exceeded": {
    message: "Upload failed. Please try again.",
    category: "network",
    retryable: true,
  },
  "storage/invalid-checksum": {
    message: "File upload failed. Please try again.",
    category: "storage",
    retryable: true,
  },
  "storage/server-file-wrong-size": {
    message: "Upload failed. Please try again.",
    category: "storage",
    retryable: true,
  },
};

/**
 * Map a Firebase Auth error to AppError
 */
export function mapAuthError(error: unknown): AppError {
  const firebaseError = error as { code?: string; message?: string };
  const code = firebaseError.code || "auth/unknown";
  const mapping = AUTH_ERROR_MAP[code];

  if (mapping) {
    return new AppError(code, mapping.message, {
      category: mapping.category,
      isRetryable: mapping.retryable,
      originalError: error,
    });
  }

  // Default for unmapped auth errors
  return new AppError(code, "Authentication failed. Please try again.", {
    category: "auth",
    isRetryable: true,
    originalError: error,
  });
}

/**
 * Map a Firestore error to AppError
 */
export function mapFirestoreError(error: unknown): AppError {
  const firebaseError = error as { code?: string; message?: string };
  const code = firebaseError.code || "firestore/unknown";
  const mapping = FIRESTORE_ERROR_MAP[code];

  if (mapping) {
    return new AppError(`firestore/${code}`, mapping.message, {
      category: mapping.category,
      isRetryable: mapping.retryable,
      originalError: error,
    });
  }

  // Default for unmapped firestore errors
  return new AppError(
    `firestore/${code}`,
    "Something went wrong. Please try again.",
    {
      category: "unknown",
      isRetryable: true,
      originalError: error,
    },
  );
}

/**
 * Map a Storage error to AppError
 */
export function mapStorageError(error: unknown): AppError {
  const firebaseError = error as { code?: string; message?: string };
  const code = firebaseError.code || "storage/unknown";
  const mapping = STORAGE_ERROR_MAP[code];

  if (mapping) {
    return new AppError(code, mapping.message, {
      category: mapping.category,
      isRetryable: mapping.retryable,
      originalError: error,
    });
  }

  // Default for unmapped storage errors
  return new AppError(code, "Upload failed. Please try again.", {
    category: "storage",
    isRetryable: true,
    originalError: error,
  });
}

/**
 * Map any error to AppError (auto-detect type)
 */
export function mapError(error: unknown): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Firebase error with code
  const firebaseError = error as { code?: string; message?: string };
  if (firebaseError.code) {
    if (firebaseError.code.startsWith("auth/")) {
      return mapAuthError(error);
    }
    if (firebaseError.code.startsWith("storage/")) {
      return mapStorageError(error);
    }
    // Firestore errors don't always have prefix
    return mapFirestoreError(error);
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for network errors
    if (
      error.message.includes("network") ||
      error.message.includes("Network") ||
      error.message.includes("fetch")
    ) {
      return new AppError(
        "network/error",
        "Network error. Please check your connection.",
        {
          category: "network",
          isRetryable: true,
          originalError: error,
        },
      );
    }

    return new AppError(
      "unknown/error",
      error.message || "Something went wrong.",
      {
        category: "unknown",
        isRetryable: true,
        originalError: error,
      },
    );
  }

  // Unknown error type
  return new AppError(
    "unknown/error",
    "Something went wrong. Please try again.",
    {
      category: "unknown",
      isRetryable: true,
      originalError: error,
    },
  );
}

/**
 * Result type for operations that can fail
 * Use this instead of throwing errors for expected failure cases
 */
export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/**
 * Create a success result
 */
export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

/**
 * Create a failure result
 */
export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Wrap an async function to return Result instead of throwing
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  context?: string,
): Promise<Result<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    const appError = mapError(error);
    if (context) {
      appError.log(context);
    }
    return err(appError);
  }
}

/**
 * Get user-friendly message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Something went wrong. Please try again.";
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isRetryable;
  }
  return true; // Default to retryable for unknown errors
}

// =============================================================================
// BOUNDED RETRY UTILITIES
// =============================================================================

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Context for logging */
  context?: string;
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback before each retry attempt */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * Calculate delay for exponential backoff with optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
  jitter: boolean,
): number {
  // Exponential backoff: initialDelay * multiplier^attempt
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  const boundedDelay = Math.min(exponentialDelay, maxDelay);

  if (jitter) {
    // Add random jitter of ±25%
    const jitterRange = boundedDelay * 0.25;
    return boundedDelay + (Math.random() * 2 - 1) * jitterRange;
  }

  return boundedDelay;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with bounded exponential backoff retry
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withRetry(
 *   () => fetchUserData(userId),
 *   { maxAttempts: 3, context: "fetchUser" }
 * );
 *
 * // With custom retry logic
 * const result = await withRetry(
 *   () => sendMessage(chatId, message),
 *   {
 *     maxAttempts: 5,
 *     initialDelay: 500,
 *     shouldRetry: (error) => error instanceof AppError && error.category === "network",
 *     onRetry: (error, attempt) => console.log(`Retry ${attempt}...`),
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    jitter = true,
    context,
    shouldRetry = (error) => isRetryable(error),
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we've exhausted attempts
      if (attempt >= maxAttempts) {
        break;
      }

      // Check if error is retryable
      if (!shouldRetry(error, attempt)) {
        break;
      }

      // Calculate delay with backoff
      const delay = calculateDelay(
        attempt,
        initialDelay,
        maxDelay,
        backoffMultiplier,
        jitter,
      );

      // Log retry attempt if in dev mode
      if (__DEV__ && context) {
        console.log(
          `🔄 [${context}] Retry attempt ${attempt}/${maxAttempts} after ${Math.round(delay)}ms`,
        );
      }

      // Callback before retry
      onRetry?.(error, attempt, delay);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // All attempts failed, throw the last error
  throw lastError;
}

/**
 * Execute an async function with retry and return Result
 *
 * @example
 * ```typescript
 * const result = await withRetryResult(
 *   () => fetchUserData(userId),
 *   { maxAttempts: 3 }
 * );
 *
 * if (result.ok) {
 *   console.log("Success:", result.data);
 * } else {
 *   console.log("Failed after retries:", result.error.userMessage);
 * }
 * ```
 */
export async function withRetryResult<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<Result<T>> {
  try {
    const data = await withRetry(fn, options);
    return ok(data);
  } catch (error) {
    const appError = mapError(error);
    if (options.context) {
      appError.log(options.context);
    }
    return err(appError);
  }
}

// =============================================================================
// ERROR ACTIONS & SUGGESTIONS
// =============================================================================

/**
 * Suggested action for the user based on error type
 */
export type ErrorAction =
  | "retry" // User can retry the operation
  | "reload" // User should reload the screen/app
  | "re-login" // User needs to re-authenticate
  | "check-connection" // User should check network
  | "contact-support" // User should contact support
  | "dismiss"; // User can just dismiss the error

/**
 * Get suggested action for an error
 */
export function getErrorAction(error: unknown): ErrorAction {
  if (error instanceof AppError) {
    switch (error.category) {
      case "network":
        return "check-connection";
      case "auth":
        if (error.code === "auth/requires-recent-login") {
          return "re-login";
        }
        return "retry";
      case "permission":
        return "re-login";
      case "rate_limit":
        return "retry";
      case "validation":
        return "dismiss";
      case "not_found":
        return "reload";
      case "storage":
        return "retry";
      case "conflict":
        return "dismiss";
      default:
        return error.isRetryable ? "retry" : "dismiss";
    }
  }
  return "retry";
}

/**
 * Get action button text for an error
 */
export function getErrorActionText(action: ErrorAction): string {
  switch (action) {
    case "retry":
      return "Try Again";
    case "reload":
      return "Reload";
    case "re-login":
      return "Sign In Again";
    case "check-connection":
      return "Check Connection";
    case "contact-support":
      return "Contact Support";
    case "dismiss":
      return "OK";
  }
}

/**
 * Get helpful suggestion text for an error
 */
export function getErrorSuggestion(error: unknown): string | null {
  if (error instanceof AppError) {
    switch (error.category) {
      case "network":
        return "Please check your internet connection and try again.";
      case "auth":
        if (error.code === "auth/requires-recent-login") {
          return "For security, please sign in again to complete this action.";
        }
        return "Please check your credentials and try again.";
      case "permission":
        return "You may need to sign in again to access this feature.";
      case "rate_limit":
        return "Please wait a moment before trying again.";
      case "storage":
        return "There was an issue uploading. Please try again.";
      default:
        return null;
    }
  }
  return null;
}

/**
 * Combined error info for UI display
 */
export interface ErrorDisplayInfo {
  /** User-friendly error message */
  message: string;
  /** Suggested action type */
  action: ErrorAction;
  /** Action button text */
  actionText: string;
  /** Optional helpful suggestion */
  suggestion: string | null;
  /** Whether the error can be retried */
  canRetry: boolean;
}

/**
 * Get complete display info for an error
 */
export function getErrorDisplayInfo(error: unknown): ErrorDisplayInfo {
  const appError = error instanceof AppError ? error : mapError(error);
  const action = getErrorAction(appError);

  return {
    message: appError.userMessage,
    action,
    actionText: getErrorActionText(action),
    suggestion: getErrorSuggestion(appError),
    canRetry: appError.isRetryable,
  };
}
