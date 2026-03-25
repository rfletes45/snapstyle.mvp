/**
 * ConversationDisplayModeContext
 *
 * Per-user chat display preference: "bubbles" | "stacked"
 *
 * Persistence strategy (matches existing patterns):
 * - AsyncStorage for instant local reads (`@vibe/conversation_display_mode`)
 * - Firestore `Users/{uid}.conversationDisplayMode` for cross-device sync
 * - Reads local cache on mount for flicker-free launch
 * - Writes both local + remote on change
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc } from "firebase/firestore";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ConversationDisplayMode,
  DEFAULT_DISPLAY_MODE,
} from "@/chat/displayMode";
import { getFirestoreInstance } from "@/services/firebase";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";

import { createLogger } from "@/utils/log";
const logger = createLogger("store/ConversationDisplayModeContext");

const STORAGE_KEY = "@vibe/conversation_display_mode";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ConversationDisplayModeContextValue {
  /** Current display mode */
  displayMode: ConversationDisplayMode;
  /** Update the display mode (persists locally + remotely) */
  setDisplayMode: (mode: ConversationDisplayMode) => void;
  /** True while loading the persisted preference */
  isLoading: boolean;
}

const ConversationDisplayModeContext = createContext<
  ConversationDisplayModeContextValue | undefined
>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ConversationDisplayModeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const uid = currentFirebaseUser?.uid;

  const [displayMode, setDisplayModeState] =
    useState<ConversationDisplayMode>(DEFAULT_DISPLAY_MODE);
  const [isLoading, setIsLoading] = useState(true);

  // ── Hydrate from local cache on mount ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached === "bubbles" || cached === "stacked") {
          setDisplayModeState(cached);
        }
      } catch (e) {
        logger.warn("Failed to read display mode from AsyncStorage:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Sync from Firestore profile when it loads ──────────────────────────
  useEffect(() => {
    if (!profile) return;
    const remote = (profile as any).conversationDisplayMode;
    if (remote === "bubbles" || remote === "stacked") {
      setDisplayModeState(remote);
      // Keep local cache in sync
      AsyncStorage.setItem(STORAGE_KEY, remote).catch(() => {});
    }
  }, [profile]);

  // ── Setter: persist locally + remotely ─────────────────────────────────
  const setDisplayMode = useCallback(
    (mode: ConversationDisplayMode) => {
      setDisplayModeState(mode);

      // Local cache (instant)
      AsyncStorage.setItem(STORAGE_KEY, mode).catch((e) =>
        logger.warn("Failed to write display mode to AsyncStorage:", e),
      );

      // Firestore sync (background)
      if (uid) {
        const db = getFirestoreInstance();
        updateDoc(doc(db, "Users", uid), {
          conversationDisplayMode: mode,
        }).catch((e) =>
          logger.warn("Failed to sync display mode to Firestore:", e),
        );
      }
    },
    [uid],
  );

  const value = useMemo(
    () => ({ displayMode, setDisplayMode, isLoading }),
    [displayMode, setDisplayMode, isLoading],
  );

  return (
    <ConversationDisplayModeContext.Provider value={value}>
      {children}
    </ConversationDisplayModeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversationDisplayMode(): ConversationDisplayModeContextValue {
  const ctx = useContext(ConversationDisplayModeContext);
  if (!ctx) {
    // Graceful fallback for usage outside provider (e.g. tests)
    return {
      displayMode: DEFAULT_DISPLAY_MODE,
      setDisplayMode: () => {},
      isLoading: false,
    };
  }
  return ctx;
}
