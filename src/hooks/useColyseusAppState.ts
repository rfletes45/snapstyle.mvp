/**
 * useColyseusAppState — Handle mobile app state changes for Colyseus rooms
 *
 * Notifies the Colyseus server when the app goes to background/foreground.
 * This helps the server understand player engagement and handle reconnection.
 *
 * Usage:
 *   useColyseusAppState(room);
 */

import { Room } from "@colyseus/sdk";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useColyseusAppState");
export function useColyseusAppState(room: Room | null): void {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!room) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        const previousState = appStateRef.current;

        if (
          previousState.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          // App came to foreground — Colyseus SDK handles reconnection automatically
          logger.info("[ColyseusAppState] App returned to foreground");
          try {
            room.send("app_state", { state: "active" });
          } catch {
            // Room might be disconnected, SDK will reconnect
          }
        }

        if (nextAppState === "background") {
          // App going to background — notify server
          logger.info("[ColyseusAppState] App going to background");
          try {
            room.send("app_state", { state: "background" });
          } catch {
            // Room might already be disconnected
          }
        }

        appStateRef.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [room]);
}
