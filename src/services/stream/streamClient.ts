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
let initPromise: Promise<StreamVideoClient> | null = null;

/**
 * Initialize the Stream Video client for the authenticated user.
 * No-ops if already initialized for the same user.
 * Uses a mutex to prevent concurrent init/destroy races.
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

  // If another init is in flight, wait for it then re-check
  if (initPromise) {
    try {
      await initPromise;
    } catch {
      // Previous init failed — proceed with fresh init below
    }
    if (client && currentUserId === userId) {
      return client;
    }
  }

  const doInit = async (): Promise<StreamVideoClient> => {
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
      options: {
        logLevel: __DEV__ ? "info" : "warn",
        rejectCallWhenBusy: true,
      },
    });

    currentUserId = userId;
    return client;
  };

  initPromise = doInit();
  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
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
      const StreamVideoRN =
        require("@stream-io/video-react-native-sdk").StreamVideoRN;
      await StreamVideoRN?.onPushLogout?.();
    } catch (err) {
      console.warn("[StreamClient] onPushLogout failed:", err);
    }
    try {
      await client.disconnectUser();
    } catch (err) {
      console.warn("[StreamClient] disconnectUser failed:", err);
    }
    try {
      const { stopCallAudioSession } =
        require("./callSessionManager") as typeof import("./callSessionManager");
      await stopCallAudioSession();
    } catch (err) {
      console.warn("[StreamClient] stopCallAudioSession failed:", err);
    }
    client = null;
    currentUserId = null;
  }
}
