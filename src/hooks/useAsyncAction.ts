/**
 * useAsyncAction - Hook for handling async actions with consistent error/success feedback
 * Phase 15: Polish + Consistent Error Feedback
 *
 * Provides:
 * - Loading state management
 * - Automatic snackbar feedback on success/error
 * - Error mapping for user-friendly messages
 */

import { useState, useCallback } from "react";
import { useSnackbar } from "@/store/SnackbarContext";
import { mapError, getErrorMessage } from "@/utils/errors";

// =============================================================================
// Types
// =============================================================================

interface AsyncActionOptions<T> {
  /** Success message to show in snackbar */
  successMessage?: string;
  /** Custom error message (overrides mapped error) */
  errorMessage?: string;
  /** Called on success with result */
  onSuccess?: (result: T) => void;
  /** Called on error with the error object */
  onError?: (error: Error) => void;
  /** Whether to show success snackbar (default: true if successMessage provided) */
  showSuccessSnackbar?: boolean;
  /** Whether to show error snackbar (default: true) */
  showErrorSnackbar?: boolean;
  /** Timeout in milliseconds (default: 10000ms / 10s) */
  timeout?: number;
}

interface AsyncActionState {
  loading: boolean;
  error: string | null;
}

type AsyncActionResult<T> = [
  (
    action: () => Promise<T>,
    options?: AsyncActionOptions<T>,
  ) => Promise<T | undefined>,
  AsyncActionState,
];

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for handling async actions with consistent error/success feedback
 *
 * @example
 * ```tsx
 * const [execute, { loading, error }] = useAsyncAction();
 *
 * const handleSubmit = async () => {
 *   const result = await execute(
 *     () => sendFriendRequest(userId, username),
 *     { successMessage: 'Friend request sent!' }
 *   );
 *   if (result) {
 *     // Handle success
 *   }
 * };
 * ```
 */
export function useAsyncAction<T = unknown>(): AsyncActionResult<T> {
  const { showSuccess, showError } = useSnackbar();
  const [state, setState] = useState<AsyncActionState>({
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (
      action: () => Promise<T>,
      options: AsyncActionOptions<T> = {},
    ): Promise<T | undefined> => {
      const {
        successMessage,
        errorMessage,
        onSuccess,
        onError,
        showSuccessSnackbar = !!successMessage,
        showErrorSnackbar = true,
        timeout = 10000,
      } = options;

      setState({ loading: true, error: null });

      try {
        // Create timeout promise
        const timeoutPromise = new Promise<T>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  "Request timed out. Please check your internet connection.",
                ),
              ),
            timeout,
          );
        });

        // Race between the action and timeout
        const result = await Promise.race([action(), timeoutPromise]);

        setState({ loading: false, error: null });

        if (showSuccessSnackbar && successMessage) {
          showSuccess(successMessage);
        }

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (err: unknown) {
        // Map the error for user-friendly message
        const appError = mapError(err);
        const userMessage =
          errorMessage || appError.userMessage || getErrorMessage(err);

        setState({ loading: false, error: userMessage });

        if (showErrorSnackbar) {
          showError(userMessage);
        }

        if (onError) {
          onError(appError);
        }

        // Log for debugging
        console.error("[useAsyncAction]", appError);

        return undefined;
      }
    },
    [showSuccess, showError],
  );

  return [execute, state];
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Hook for mutation actions (create, update, delete)
 * Same as useAsyncAction but semantically clear
 */
export function useMutationAction<T = unknown>() {
  return useAsyncAction<T>();
}

/**
 * Hook for data fetching with automatic error display
 */
export function useFetchAction<T = unknown>() {
  const [execute, state] = useAsyncAction<T>();

  const fetch = useCallback(
    async (
      action: () => Promise<T>,
      options?: Omit<AsyncActionOptions<T>, "showSuccessSnackbar">,
    ): Promise<T | undefined> => {
      return execute(action, {
        ...options,
        showSuccessSnackbar: false, // Don't show success for fetches
      });
    },
    [execute],
  );

  return [fetch, state] as const;
}
