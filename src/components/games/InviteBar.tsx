/**
 * InviteBar — Inline invite bar scoped to a single conversation (vNext Phase 3)
 *
 * Renders as a list of `InviteBarItem` pills/cards within a chat screen.
 * The bar is visible whenever at least one InviteView for the given
 * `conversationId` is in the "open" state.
 *
 * Navigation behaviour:
 *   - Pre-game (lobby) → claims slot via `claimInviteSlot`, then delegates
 *     navigation to the parent's `onNavigateToGame` callback
 *   - Active (player)  → navigates to game screen via `onNavigateToGame`
 *   - Active (spectator) → navigates with `spectatorMode: true`
 *
 * Placement:
 *   Mount inside the chat screen body (e.g. above the message list).
 *
 * @see docs/AUDIT_GameInviteAndFlow.md — vNext Spec §5
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";

import { FontSizes, Spacing } from "@/constants/theme";
import { useInviteBar, type InviteBarEntry } from "@/hooks/useInviteBar";
import { claimInviteSlot } from "@/services/gameInvites";
import { getFullProfileData } from "@/services/profileService";

import { createLogger } from "@/utils/log";

import { InviteBarItem } from "./InviteBarItem";
import { InviteDebugPanel } from "./InviteDebugPanel";

const logger = createLogger("components/games/InviteBar");

// Enable LayoutAnimation on Android.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// Props
// =============================================================================

export interface InviteBarProps {
  /** The conversation this invite bar is scoped to. */
  conversationId: string;
  /** Current user's UID. */
  currentUserId: string;
  /** Current user's display name (used when claiming a slot). */
  currentUserName: string;
  /** Current user's avatar URL (optional — resolved from profile if absent). */
  currentUserAvatar?: string;
  /** Parent-provided navigation callback (same shape as ChatGameInvites). */
  onNavigateToGame: (
    gameId: string,
    gameType: string,
    options?: { inviteId?: string; spectatorMode?: boolean },
  ) => void;
  /** Whether to render in compact mode (default: false). */
  compact?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function InviteBar({
  conversationId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onNavigateToGame,
}: InviteBarProps) {
  const {
    entries,
    count,
    loading,
    dismiss,
    dismissAll,
    dismissFinished,
    toggle,
    expand,
    minimizeAll,
    shareResult,
  } = useInviteBar(conversationId);

  const theme = useTheme();

  // ── Resolve avatar from profile when not provided ────────────────────
  const [resolvedAvatar, setResolvedAvatar] = useState<string | undefined>(
    currentUserAvatar,
  );

  useEffect(() => {
    if (currentUserAvatar) {
      setResolvedAvatar(currentUserAvatar);
      return;
    }
    if (!currentUserId) return;

    let cancelled = false;
    getFullProfileData(currentUserId)
      .then((profile) => {
        if (!cancelled && profile?.profilePicture?.url) {
          setResolvedAvatar(profile.profilePicture.url);
        }
      })
      .catch((err) => {
        logger.warn("[InviteBar] Failed to fetch profile picture:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, currentUserAvatar]);

  // ── Auto-expand on status → "active" ─────────────────────────────────
  const prevStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    for (const entry of entries) {
      const id = entry.view.inviteId;
      const prevStatus = prevStatusesRef.current[id];
      const curStatus = entry.invite?.status;

      if (curStatus === "active" && prevStatus && prevStatus !== "active") {
        // Invite just went active → expand the bar item.
        expand(id);
      }

      if (curStatus) {
        prevStatusesRef.current[id] = curStatus;
      }
    }
  }, [entries, expand]);

  // ── Animate layout changes ───────────────────────────────────────────
  const lastCountRef = useRef(count);
  useEffect(() => {
    if (count !== lastCountRef.current) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      lastCountRef.current = count;
    }
  }, [count]);

  // ── Navigation handler ───────────────────────────────────────────────
  const handleNavigate = useCallback(
    async (entry: InviteBarEntry) => {
      const invite = entry.invite;
      if (!invite) return;

      const inviteId = entry.view.inviteId;
      const gameType = invite.gameType;
      const status = invite.status;
      const isSpectator = entry.view.role === "spectator";

      minimizeAll();

      // Lobby phase → claim slot first, then navigate
      if (
        ["pending", "filling", "ready", "starting"].includes(status ?? "") &&
        !isSpectator
      ) {
        const result = await claimInviteSlot(
          inviteId,
          currentUserId,
          currentUserName,
          resolvedAvatar,
        );
        if (result.success) {
          // Navigate with inviteId only (no matchId) so the lobby hook
          // enters queue mode and waits for the host to start the game.
          onNavigateToGame("", gameType, { inviteId });
        } else {
          logger.warn(
            `[InviteBar] claimInviteSlot failed for ${inviteId}:`,
            result.error,
          );
        }
        return;
      }

      // Active phase — spectator
      if (status === "active" && isSpectator && invite.gameId) {
        onNavigateToGame(invite.gameId, gameType, {
          inviteId,
          spectatorMode: true,
        });
        return;
      }

      // Active phase — player (resume)
      if (status === "active") {
        onNavigateToGame(invite.gameId || "", gameType, { inviteId });
        return;
      }

      // Fallback — just navigate with inviteId
      onNavigateToGame("", gameType, { inviteId });
    },
    [
      currentUserId,
      currentUserName,
      resolvedAvatar,
      minimizeAll,
      onNavigateToGame,
    ],
  );

  // ── Render nothing when empty ────────────────────────────────────────
  if (count === 0 || loading) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={[styles.inner, { backgroundColor: "transparent" }]}>
        {/* Items */}
        {entries.map((entry) => (
          <InviteBarItem
            key={entry.view.inviteId}
            entry={entry}
            onToggle={toggle}
            onDismiss={dismiss}
            onNavigate={handleNavigate}
            onShareResult={shareResult}
          />
        ))}

        {/* Dismiss-finished + dismiss-all buttons */}
        {count > 1 && (
          <View style={styles.headerActions}>
            {entries.some(
              (e) =>
                e.invite?.status === "completed" ||
                e.invite?.status === "declined" ||
                e.invite?.status === "expired" ||
                e.invite?.status === "cancelled",
            ) && (
              <Pressable
                style={[
                  styles.dismissAllBtn,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
                onPress={dismissFinished}
                accessibilityRole="button"
                accessibilityLabel="Close finished invites"
              >
                <Text
                  style={[
                    styles.dismissAllText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Close Finished
                </Text>
              </Pressable>
            )}
            <Pressable
              style={[
                styles.dismissAllBtn,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              onPress={dismissAll}
              accessibilityRole="button"
              accessibilityLabel="Close all invites"
            >
              <Text
                style={[
                  styles.dismissAllText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Close All ({count})
              </Text>
            </Pressable>
          </View>
        )}

        {/* Dev-only debug panel — tree-shaken in production */}
        {__DEV__ && <InviteDebugPanel entries={entries} />}
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  inner: {
    width: "100%",
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  dismissAllBtn: {
    alignSelf: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    marginTop: Spacing.xs,
  },
  dismissAllText: {
    fontSize: FontSizes.xs,
    fontWeight: "600",
  },
});
