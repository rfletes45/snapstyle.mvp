/**
 * Stream Video Client Singleton
 *
 * Manages the single StreamVideoClient instance for the app.
 * Must be initialized after user authentication and torn down on logout.
 */

import type {
  StreamVideoClient,
  User,
} from "@stream-io/video-react-native-sdk";
import { fetchStreamToken, streamTokenProvider } from "./streamTokenProvider";

// Lazy-load SDK to avoid native module crash in Expo Go.
// This file is only loaded (via barrel) when CALLS_ENABLED is true.
const getSDK = () =>
  require("@stream-io/video-react-native-sdk") as {
    StreamVideoClient: {
      getOrCreateInstance: (opts: any) => StreamVideoClient;
    };
  };

let client: StreamVideoClient | null = null;
let currentUserId: string | null = null;

/**
 * Initialize the Stream Video client for the authenticated user.
 * No-ops if already initialized for the same user.
 */
export async function initStreamClient(
  userId: string,
  userName?: string,
  avatarUrl?: string,
): Promise<StreamVideoClient> {
  // Already initialized for this user
  if (client && currentUserId === userId) {
    return client;
  }

  // Tear down previous client if switching users
  if (client) {
    await destroyStreamClient();
  }

  // Fetch initial token (also caches the API key)
  const { token, apiKey } = await fetchStreamToken();

  const user: User = {
    id: userId,
    name: userName,
    image: avatarUrl,
  };

  client = getSDK().StreamVideoClient.getOrCreateInstance({
    apiKey,
    user,
    token,
    tokenProvider: streamTokenProvider,
    options: { logLevel: __DEV__ ? "info" : "warn" },
  });

  currentUserId = userId;
  return client;
}

/**
 * Get the current Stream Video client.
 * Throws if not yet initialized.
 */
export function getStreamClient(): StreamVideoClient {
  if (!client) {
    throw new Error(
      "[StreamClient] Not initialized. Call initStreamClient() first.",
    );
  }
  return client;
}

/**
 * Get the current Stream Video client or null if not initialized.
 */
export function getStreamClientOrNull(): StreamVideoClient | null {
  return client;
}

/**
 * Tear down the Stream Video client (e.g. on logout).
 */
export async function destroyStreamClient(): Promise<void> {
  if (client) {
    try {
      await client.disconnectUser();
    } catch (err) {
      console.warn("[StreamClient] disconnectUser failed:", err);
    }
    client = null;
    currentUserId = null;
  }
}
