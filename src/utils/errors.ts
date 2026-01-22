/**
 * Error Handling Utilities
 * Phase 10: Centralized error handling framework
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
