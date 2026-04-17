/**
 * useContactsPermission — Shared contacts permission state for banners.
 *
 * Single source of truth for:
 * - Permission status (undetermined / granted / limited / denied)
 * - canAskAgain (whether the system prompt can be shown)
 * - Access privileges (all / limited / none)
 * - Platform-correct CTA action
 * - Banner dismissal persistence
 * - Sync-complete status
 *
 * Both the Add Friends modal banner and Messages screen banner
 * consume this hook rather than duplicating permission logic.
 *
 * @module hooks/useContactsPermission
 */

import {
  type ContactPermissionStatus,
  type ContactsPermissionInfo,
  getContactPermissionInfo,
  presentContactAccessPicker,
  requestContactPermissionFull,
} from "@/services/contacts";
import { createLogger } from "@/utils/log";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";

const logger = createLogger("hooks/useContactsPermission");

// ---------------------------------------------------------------------------
// Persistence keys
// ---------------------------------------------------------------------------

const DISMISS_KEY_MESSAGES = "@snapstyle/contacts_banner_messages_dismissed";
const DISMISS_KEY_MESSAGES_AT =
  "@snapstyle/contacts_banner_messages_dismissed_at";
/** How long a Messages-screen dismissal lasts before the compact reminder. */
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Computed permission state that directly maps to UX behavior.
 *
 * - `undetermined`     → first time; system prompt available
 * - `granted_all`      → full access; hide banner
 * - `granted_limited`  → iOS 18 partial; show "expand" banner
 * - `denied_can_retry` → denied but canAskAgain; can re-prompt
 * - `denied_permanent` → denied and !canAskAgain; direct to Settings
 */
export type ContactsPermissionState =
  | "undetermined"
  | "granted_all"
  | "granted_limited"
  | "denied_can_retry"
  | "denied_permanent";

export interface ContactsPermissionHook {
  /** Computed permission state for UX decision-making. */
  permState: ContactsPermissionState;
  /** Raw status from expo-contacts. */
  rawStatus: ContactPermissionStatus;
  /** Whether the system can still show the native permission prompt. */
  canAskAgain: boolean;
  /** iOS 18+ access privilege. */
  accessPrivileges: "all" | "limited" | "none";
  /** True once the initial async permission check is done. */
  ready: boolean;
  /** True while a permission request / sync is in progress. */
  loading: boolean;

  // ── Actions ─────────────────────────────────────────────────

  /**
   * Platform-correct CTA action.
   * - undetermined / denied_can_retry → requestPermissionsAsync()
   * - granted_limited (iOS 18+)      → presentAccessPickerAsync()
   * - denied_permanent                → Linking.openSettings()
   */
  handleEnableContacts: () => Promise<ContactPermissionStatus>;

  /**
   * Open device Settings directly.
   */
  handleOpenSettings: () => void;

  /**
   * Re-check permission status (e.g. after returning from Settings).
   */
  refreshPermission: () => Promise<void>;

  // ── Messages banner dismissal ───────────────────────────────

  /** Whether the Messages-screen banner has been dismissed (within cooldown). */
  messagesBannerDismissed: boolean;
  /** Timestamp of last Messages banner dismissal (null if never). */
  messagesBannerDismissedAt: number | null;
  /** Dismiss the Messages-screen banner (persists). */
  dismissMessagesBanner: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContactsPermission(): ContactsPermissionHook {
  const [info, setInfo] = useState<ContactsPermissionInfo>({
    status: "undetermined",
    canAskAgain: true,
    accessPrivileges: "none",
  });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  // Messages banner dismissal
  const [messagesDismissedAt, setMessagesDismissedAt] = useState<number | null>(
    null,
  );
  const dismissalLoaded = useRef(false);

  // ── Initial permission check ──────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const permInfo = await getContactPermissionInfo();
        setInfo(permInfo);
      } catch (err) {
        logger.error("Failed to check contact permission:", err);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // ── Load Messages dismissal ───────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DISMISS_KEY_MESSAGES_AT);
        if (raw) {
          setMessagesDismissedAt(JSON.parse(raw));
        }
      } catch {
        // non-critical
      } finally {
        dismissalLoaded.current = true;
      }
    })();
  }, []);

  // ── Derive permission state ───────────────────────────────────

  const permState: ContactsPermissionState = (() => {
    if (info.status === "granted") return "granted_all";
    if (info.status === "limited") return "granted_limited";
    if (info.status === "undetermined") return "undetermined";
    // denied
    if (info.canAskAgain) return "denied_can_retry";
    return "denied_permanent";
  })();

  // ── Messages banner dismissal (with cooldown) ─────────────────

  const messagesBannerDismissed: boolean = (() => {
    if (messagesDismissedAt === null) return false;
    const elapsed = Date.now() - messagesDismissedAt;
    return elapsed < DISMISS_COOLDOWN_MS;
  })();

  // ── Handlers ──────────────────────────────────────────────────

  const handleEnableContacts =
    useCallback(async (): Promise<ContactPermissionStatus> => {
      setLoading(true);
      try {
        switch (permState) {
          case "granted_limited": {
            // iOS 18+ — show the system access picker to expand access
            if (Platform.OS === "ios") {
              try {
                await presentContactAccessPicker();
                // Re-check permission after picker closes
                const updated = await getContactPermissionInfo();
                setInfo(updated);
                return updated.status;
              } catch {
                // presentAccessPickerAsync may reject on older iOS
                // Fall back to opening Settings
                Linking.openSettings();
                return info.status;
              }
            }
            // Android doesn't have limited access
            await Linking.openSettings().catch(() => {
              logger.warn("Linking.openSettings() failed or unsupported");
            });
            return info.status;
          }

          case "denied_permanent": {
            // Cannot re-prompt — go to Settings
            await Linking.openSettings().catch(() => {
              logger.warn("Linking.openSettings() failed or unsupported");
            });
            return "denied";
          }

          case "undetermined":
          case "denied_can_retry": {
            // Show the system permission prompt
            const result = await requestContactPermissionFull();
            setInfo(result);
            return result.status;
          }

          default:
            return info.status;
        }
      } catch (err) {
        logger.error("handleEnableContacts error:", err);
        return info.status;
      } finally {
        setLoading(false);
      }
    }, [permState, info.status]);

  const handleOpenSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      logger.warn("Linking.openSettings() failed or unsupported");
    }
  }, []);

  const refreshPermission = useCallback(async () => {
    try {
      const permInfo = await getContactPermissionInfo();
      setInfo(permInfo);
    } catch (err) {
      logger.error("Failed to refresh permission:", err);
    }
  }, []);

  const dismissMessagesBanner = useCallback(async () => {
    const now = Date.now();
    setMessagesDismissedAt(now);
    try {
      await AsyncStorage.setItem(DISMISS_KEY_MESSAGES_AT, JSON.stringify(now));
      await AsyncStorage.setItem(DISMISS_KEY_MESSAGES, "true");
    } catch {
      // non-critical
    }
  }, []);

  return {
    permState,
    rawStatus: info.status,
    canAskAgain: info.canAskAgain,
    accessPrivileges: info.accessPrivileges,
    ready,
    loading,
    handleEnableContacts,
    handleOpenSettings,
    refreshPermission,
    messagesBannerDismissed,
    messagesBannerDismissedAt: messagesDismissedAt,
    dismissMessagesBanner,
  };
}
