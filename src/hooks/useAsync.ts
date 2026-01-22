/**
 * useAsync Hook
 * Phase 10: Standardized async operations with loading/error state
 *
 * Provides consistent patterns for:
 * - Loading states
 * - Error handling
 * - Retry functionality
 * - Cancellation
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { AppError, mapError, Result, ok, err } from "@/utils/errors";

/**
 * State for async operations
 */
export interface AsyncState<T> {
  /** The data returned from the operation */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error if operation failed */
  error: AppError | null;
  /** Whether the operation has been executed at least once */
  isExecuted: boolean;
}

/**
 * Hook return type
 */
export interface UseAsyncReturn<
  T,
  Args extends unknown[],
> extends AsyncState<T> {
  /** Execute the async operation */
  execute: (...args: Args) => Promise<Result<T>>;
  /** Reset state to initial values */
  reset: () => void;
  /** Retry the last operation */
  retry: () => Promise<Result<T>>;
}

/**
 * Options for useAsync hook
 */
export interface UseAsyncOptions<T> {
  /** Initial data value */
  initialData?: T | null;
  /** Auto-execute on mount */
  immediate?: boolean;
  /** Context for error logging */
  context?: string;
  /** Callback on success */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: AppError) => void;
}

/**
 * Hook for managing async operations with loading/error states
 *
 * @example
 * ```tsx
 * const { data, loading, error, execute } = useAsync(
 *   (userId: string) => fetchUserProfile(userId),
 *   { context: "ProfileScreen" }
 * );
 *
 * // Execute with args
 * const result = await execute("user123");
 * if (result.ok) {
 *   console.log("Profile:", result.data);
 * }
 * ```
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T> = {},
): UseAsyncReturn<T, Args> {
  const {
    initialData = null,
    immediate = false,
    context,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: false,
    error: null,
    isExecuted: false,
  });

  // Store the last args for retry
  const lastArgsRef = useRef<Args | null>(null);
  // Track if component is mounted
  const isMountedRef = useRef(true);
  // Store the async function ref for retry
  const asyncFnRef = useRef(asyncFn);
  asyncFnRef.current = asyncFn;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: Args): Promise<Result<T>> => {
      lastArgsRef.current = args;

      // Set loading state
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const data = await asyncFnRef.current(...args);

        // Only update state if still mounted
        if (isMountedRef.current) {
          setState({
            data,
            loading: false,
            error: null,
            isExecuted: true,
          });
          onSuccess?.(data);
        }

        return ok(data);
      } catch (error) {
        const appError = mapError(error);

        if (context) {
          appError.log(context);
        }

        // Only update state if still mounted
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: appError,
            isExecuted: true,
          }));
          onError?.(appError);
        }

        return err(appError);
      }
    },
    [context, onSuccess, onError],
  );

  const reset = useCallback(() => {
    lastArgsRef.current = null;
    setState({
      data: initialData,
      loading: false,
      error: null,
      isExecuted: false,
    });
  }, [initialData]);

  const retry = useCallback(async (): Promise<Result<T>> => {
    if (lastArgsRef.current !== null) {
      return execute(...lastArgsRef.current);
    }
    // No previous args to retry with
    return err(
      new AppError("no-args", "No previous operation to retry", {
        category: "unknown",
        isRetryable: false,
      }),
    );
  }, [execute]);

  // Auto-execute on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      execute(...([] as unknown as Args));
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    execute,
    reset,
    retry,
  };
}

/**
 * Hook for async operations that execute on mount
 *
 * @example
 * ```tsx
 * const { data, loading, error, refresh } = useAsyncEffect(
 *   () => fetchUserProfile(userId),
 *   [userId],
 *   { context: "ProfileScreen" }
 * );
 * ```
 */
export function useAsyncEffect<T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList,
  options: Omit<UseAsyncOptions<T>, "immediate"> = {},
): Omit<UseAsyncReturn<T, []>, "execute"> & {
  refresh: () => Promise<Result<T>>;
} {
  const { execute, ...state } = useAsync(asyncFn, options);

  // Re-execute when deps change
  useEffect(() => {
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    ...state,
    refresh: execute,
  };
}

/**
 * Hook for lazy async operations (manual trigger only)
 * Alias for useAsync with immediate: false
 */
export function useLazyAsync<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  options: Omit<UseAsyncOptions<T>, "immediate"> = {},
): UseAsyncReturn<T, Args> {
  return useAsync(asyncFn, { ...options, immediate: false });
}

export default useAsync;
