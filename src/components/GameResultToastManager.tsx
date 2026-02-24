/**
 * GameResultToastManager — Global listener for game result events.
 *
 * Mount once near the app root (inside NavigationContainer).
 * Shows:
 *   - Achievement unlock notifications via InAppToast (top banner)
 *
 * XP earned is displayed directly inside the GameOverModal, so no
 * duplicate bottom-toast is needed.
 *
 * Tapping an achievement notification navigates to the Achievements screen.
 *
 * @module components/GameResultToastManager
 */

import {
  GameResultNotification,
  onGameResultNotification,
} from "@/services/gameResultEvents";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useCallback, useEffect } from "react";

export function GameResultToastManager(): null {
  const { pushNotification } = useInAppNotifications();

  const handleNotification = useCallback(
    (n: GameResultNotification) => {
      // ── XP toast — handled inside GameOverModal, skip here ────

      // ── Achievement unlock notifications (top in-app banner) ──
      for (const achievementId of n.achievementsUnlocked) {
        const rewardParts: string[] = [];
        if (n.xpEarned > 0) rewardParts.push(`+${n.xpEarned} XP`);
        const rewardSummary =
          rewardParts.length > 0 ? ` — ${rewardParts.join(", ")}` : "";

        pushNotification({
          type: "achievement",
          title: "🏆 Achievement Unlocked!",
          body: `You earned a new achievement${rewardSummary}`,
          entityId: achievementId,
          fromUserId: "",
          navigateTo: {
            // Achievements lives in PlayStack, not ProfileStack.
            screen: "Play",
            params: {
              screen: "Achievements",
              params: { targetAchievementId: achievementId },
            },
          },
        });
      }
    },
    [pushNotification],
  );

  useEffect(() => {
    const unsub = onGameResultNotification(handleNotification);
    return unsub;
  }, [handleNotification]);

  // Render nothing — this is a pure side-effect component
  return null;
}
