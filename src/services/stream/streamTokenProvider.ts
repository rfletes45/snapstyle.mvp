/**
 * Stream Video Token Provider
 *
 * Fetches Stream Video user tokens from the Firebase backend.
 * Used by StreamVideoClient for authentication.
 */

import { getFunctionsInstance } from "@/services/firebase";
import { httpsCallable } from "firebase/functions";

interface TokenResponse {
  token: string;
  apiKey: string;
}

let cachedApiKey: string | null = null;
let inflightTokenPromise: Promise<TokenResponse> | null = null;

/**
 * Fetch a Stream Video token from the backend.
 * Also caches the API key for Stream client initialization.
 * Uses an in-flight promise lock to prevent concurrent duplicate requests.
 */
export async function fetchStreamToken(): Promise<TokenResponse> {
  if (inflightTokenPromise) return inflightTokenPromise;

  inflightTokenPromise = (async () => {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<void, TokenResponse>(
      functions,
      "getStreamVideoToken",
    );
    const result = await callable();
    cachedApiKey = result.data.apiKey;
    return result.data;
  })();

  try {
    return await inflightTokenPromise;
  } finally {
    inflightTokenPromise = null;
  }
}

/**
 * Token provider compatible with StreamVideoClient.
 * Called automatically when the client needs a fresh token.
 */
export async function streamTokenProvider(): Promise<string> {
  const { token } = await fetchStreamToken();
  return token;
}

/**
 * Get the cached Stream API key (available after first token fetch).
 */
export function getCachedApiKey(): string | null {
  return cachedApiKey;
}

/**
 * Clear cached state (call on logout).
 */
export function clearTokenCache(): void {
  cachedApiKey = null;
  inflightTokenPromise = null;
}
