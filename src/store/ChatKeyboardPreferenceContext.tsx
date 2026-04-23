/**
 * ChatKeyboardPreferenceContext
 *
 * Per-user preference: should the keyboard auto-open when entering any chat?
 *
 * Persistence strategy (matches ConversationDisplayModeContext):
 * - AsyncStorage for instant local reads (`@vibe/auto_open_keyboard_on_chat`)
 * - Firestore `Users/{uid}.autoOpenKeyboardOnChat` for cross-device sync
 * - Reads local cache on mount for flicker-free launch
 * - Default: enabled
 *
 * The toggle is exposed in ChatSettingsScreen but the value is GLOBAL
 * (applies to every chat / thread the user opens).
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

import { getFirestoreInstance } from "@/services/firebase";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import { createLogger } from "@/utils/log";

const logger = createLogger("store/ChatKeyboardPreferenceContext");

const STORAGE_KEY = "@vibe/auto_open_keyboard_on_chat";
const DEFAULT_VALUE = true;

interface ChatKeyboardPreferenceContextValue {
  /** When true, opening any chat automatically focuses the composer. */
  autoOpenKeyboard: boolean;
  /** Update the preference (persists locally + remotely). */
  setAutoOpenKeyboard: (enabled: boolean) => void;
  /** True while loading the persisted preference. */
  isLoading: boolean;
}

const ChatKeyboardPreferenceContext = createContext<
  ChatKeyboardPreferenceContextValue | undefined
>(undefined);

export function ChatKeyboardPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const uid = currentFirebaseUser?.uid;

  const [autoOpenKeyboard, setAutoOpenKeyboardState] =
    useState<boolean>(DEFAULT_VALUE);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from local cache on mount
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached === "true" || cached === "false") {
          setAutoOpenKeyboardState(cached === "true");
        }
      } catch (e) {
        logger.warn("Failed to read preference from AsyncStorage:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Sync from Firestore profile when it loads
  useEffect(() => {
    if (!profile) return;
    const remote = (profile as any).autoOpenKeyboardOnChat;
    if (typeof remote === "boolean") {
      setAutoOpenKeyboardState(remote);
      AsyncStorage.setItem(STORAGE_KEY, String(remote)).catch(() => {});
    }
  }, [profile]);

  const setAutoOpenKeyboard = useCallback(
    (enabled: boolean) => {
      setAutoOpenKeyboardState(enabled);

      // Local cache (instant)
      AsyncStorage.setItem(STORAGE_KEY, String(enabled)).catch((e) =>
        logger.warn("Failed to write preference to AsyncStorage:", e),
      );

      // Firestore sync (background, best-effort)
      if (uid) {
        try {
          const db = getFirestoreInstance();
          updateDoc(doc(db, "Users", uid), {
            autoOpenKeyboardOnChat: enabled,
          }).catch((e) =>
            logger.warn("Failed to sync preference to Firestore:", e),
          );
        } catch (e) {
          logger.warn("Failed to sync preference to Firestore:", e);
        }
      }
    },
    [uid],
  );

  const value = useMemo(
    () => ({ autoOpenKeyboard, setAutoOpenKeyboard, isLoading }),
    [autoOpenKeyboard, setAutoOpenKeyboard, isLoading],
  );

  return (
    <ChatKeyboardPreferenceContext.Provider value={value}>
      {children}
    </ChatKeyboardPreferenceContext.Provider>
  );
}

export function useChatKeyboardPreference(): ChatKeyboardPreferenceContextValue {
  const ctx = useContext(ChatKeyboardPreferenceContext);
  if (!ctx) {
    // Graceful fallback for usage outside provider (e.g. tests)
    return {
      autoOpenKeyboard: DEFAULT_VALUE,
      setAutoOpenKeyboard: () => {},
      isLoading: false,
    };
  }
  return ctx;
}
