/**
 * useContactsOnboarding — State machine for the Messages-screen contacts
 * onboarding card.
 *
 * Manages:
 * - Permission status (undetermined / granted / limited / denied)
 * - Card visibility (show, dismiss, re-show logic)
 * - AsyncStorage-backed dismissal persistence
 * - Contact sync trigger after permission grant
 *
 * Does NOT auto-request permissions — only on explicit user action.
 *
 * @module hooks/useContactsOnboarding
 */

import { useContactsDiscovery } from "@/hooks/useContactsDiscovery";
import { ContactPermissionStatus } from "@/services/contacts";
import { useAuth } from "@/store/AuthContext";
import { createLogger } from "@/utils/log";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";

const logger = createLogger("hooks/useContactsOnboarding");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "@snapstyle/inbox_contacts_card_dismissed";
/** How long (ms) a "skip" lasts before the compact reminder is eligible. */
const SKIP_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingCardVariant =
  | "prominent" // large card — no chats, first time
  | "compact" // smaller card — has chats or re-show after cooldown
  | "limited" // iOS 18 limited access follow-up
  | "denied" // soft nudge to open Settings
  | "hidden"; // nothing to show

export interface ContactsOnboardingState {
  /** Which card variant to render (or hidden). */
  variant: OnboardingCardVariant;
  /** True while checking permission or running sync. */
  loading: boolean;
  /** The underlying contacts-discovery hook state. */
  permissionStatus: ContactPermissionStatus;
  /** Handle CTA press — requests permission then syncs. */
  handleEnable: () => Promise<void>;
  /** Handle "Not now" / dismiss. */
  handleDismiss: () => Promise<void>;
  /** Handle "Open Settings" for denied state. */
  handleOpenSettings: () => void;
  /** Whether the initial async checks are done. */
  ready: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContactsOnboarding(
  hasConversations: boolean,
): ContactsOnboardingState {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;
  const contacts = useContactsDiscovery(uid);

  const [ready, setReady] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  // Track if user just granted — hide the card immediately after sync
  const [justGranted, setJustGranted] = useState(false);

  // ── Load dismissal timestamp ──────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setDismissedAt(JSON.parse(raw));
      } catch {
        // ignore
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // ── Derive variant ────────────────────────────────────────────

  const variant: OnboardingCardVariant = (() => {
    if (!ready) return "hidden";
    if (justGranted) return "hidden";

    const status = contacts.permissionStatus;

    // Fully granted — nothing to show
    if (status === "granted") return "hidden";

    // iOS 18 limited access — show follow-up
    if (status === "limited") return "limited";

    // Denied — show Settings nudge once, respect dismissal
    if (status === "denied") {
      if (dismissedAt) return "hidden";
      return "denied";
    }

    // Undetermined
    if (status === "undetermined") {
      // Never dismissed → show prominent (no chats) or compact (has chats)
      if (!dismissedAt) {
        return hasConversations ? "compact" : "prominent";
      }

      // Dismissed but cooldown expired → compact reminder
      const elapsed = Date.now() - dismissedAt;
      if (elapsed > SKIP_COOLDOWN_MS) {
        return "compact";
      }

      // Still in cooldown
      return "hidden";
    }

    return "hidden";
  })();

  // ── Handlers ──────────────────────────────────────────────────

  const handleEnable = useCallback(async () => {
    setLoading(true);
    try {
      const status = await contacts.requestPermission();
      if (status === "granted" || status === "limited") {
        setJustGranted(true);
        await contacts.syncContacts();
      }
    } catch (err) {
      logger.error("Permission request failed:", err);
    } finally {
      setLoading(false);
    }
  }, [contacts]);

  const handleDismiss = useCallback(async () => {
    const now = Date.now();
    setDismissedAt(now);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(now));
    } catch {
      // non-critical
    }
  }, []);

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return {
    variant,
    loading,
    permissionStatus: contacts.permissionStatus,
    handleEnable,
    handleDismiss,
    handleOpenSettings,
    ready,
  };
}
