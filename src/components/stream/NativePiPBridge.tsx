/**
 * Native PiP Bridge
 *
 * Keeps Stream's native Picture-in-Picture integration mounted from a single
 * root-level place so direct video calls can enter system PiP from either the
 * full call screen or the in-app floating overlay, without mounting duplicate
 * PiP views during navigation transitions.
 *
 * PiP restore ownership
 * ──────────────────────
 * The iOS SDK (`StreamPictureInPictureController.swift`) auto-completes
 * `restoreUserInterfaceForPictureInPictureStop` with `true` and does NOT
 * expose a JS event distinguishing "user tapped the PiP window" from
 * "app returned to foreground via app icon" — both surface as a single
 * `onPiPChange(false)` callback after iOS finishes its stop animation.
 *
 * We therefore:
 *   1. Constrain the PiP source-view frame to the rect the user will
 *      visually land on when PiP stops, so there is NO fullscreen bounce
 *      when the app simply foregrounds. When `isOnCallScreen` is false
 *      the source view is a small floating-overlay-sized frame; when the
 *      user is on the fullscreen call screen the source view is
 *      fullscreen and the stop animation looks native.
 *   2. On PiP start, remember whether the user was on the call screen.
 *      When PiP stops, if they were — navigate back to `DirectCall`. This
 *      restores the intended fullscreen call experience whether the user
 *      tapped the PiP window or returned via app icon, because the
 *      "user was already on the call screen" signal is stable across
 *      both paths.
 *   3. When the user was NOT on the call screen when PiP started (i.e.
 *      they had explicitly minimized to the floating overlay), do not
 *      navigate — respect the minimized intent. The `FloatingVideoOverlay`
 *      owns re-entry in that case via explicit user tap.
 *
 * IMPORTANT: Uses StreamCallProvider (context-only) instead of StreamCall
 * (which mounts AppStateListener, DeviceStats, etc.) to avoid a duplicate
 * AppStateListener race condition. DirectCallScreen already wraps in
 * <StreamCall>, which provides the authoritative AppStateListener.
 */

import { useStreamCall } from "@/contexts/StreamCallContext";
import { navigate } from "@/services/navigationRef";
import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

let CallingState: any = null;
let StreamCallProvider: any = null;
let RTCViewPipIOS: any = null;
let useAutoEnterPiPEffect: (
  disablePictureInPicture: boolean | undefined,
) => void = () => {};
let useCallStateHooks: any = null;

try {
  const sdk = require("@stream-io/video-react-native-sdk");
  CallingState = sdk.CallingState;
  RTCViewPipIOS = sdk.RTCViewPipIOS;
  useAutoEnterPiPEffect = sdk.useAutoEnterPiPEffect ?? useAutoEnterPiPEffect;
  useCallStateHooks = sdk.useCallStateHooks;

  // Use StreamCallProvider (context-only) from bindings — NOT StreamCall
  // which mounts AppStateListener and other side-effect components.
  StreamCallProvider =
    require("@stream-io/video-react-bindings").StreamCallProvider;
} catch {
  // Stream SDK not available in this environment
}

import { VideoRenderErrorBoundary } from "@/components/stream/VideoRenderErrorBoundary";

// Keep in sync with FloatingVideoOverlay's pip rect so the iOS stop
// animation lands on the same spot the user will see the overlay at.
const OVERLAY_PIP_WIDTH = 140;
const OVERLAY_PIP_HEIGHT = 200;
const OVERLAY_PIP_MARGIN = 12;
const OVERLAY_PIP_BOTTOM_OFFSET = 120; // matches FloatingVideoOverlay DEFAULT_Y

interface NativePiPBridgeProps {
  /**
   * Whether the user is currently on the fullscreen call screen. Drives
   * both the PiP source-view frame (fullscreen vs. small floating rect)
   * and the restore-on-stop intent.
   */
  isOnCallScreen: boolean;
}

export function NativePiPBridge({ isOnCallScreen }: NativePiPBridgeProps) {
  const { activeCall, activeSession } = useStreamCall();

  const shouldMount =
    activeSession?.type === "direct_call" &&
    activeSession.mode === "video" &&
    !!activeCall &&
    !!StreamCallProvider;

  if (!shouldMount || !activeCall) return null;

  return (
    <VideoRenderErrorBoundary fallback={null}>
      <StreamCallProvider call={activeCall}>
        <NativePiPBridgeContent
          callId={activeCall.id}
          isOnCallScreen={isOnCallScreen}
          callMode={
            activeSession?.type === "direct_call"
              ? (activeSession.mode ?? "video")
              : "video"
          }
          recipientName={
            activeSession?.type === "direct_call"
              ? (activeSession.recipientName ?? "")
              : ""
          }
          isOutgoing={!!activeCall.isCreatedByMe}
        />
      </StreamCallProvider>
    </VideoRenderErrorBoundary>
  );
}

function NativePiPBridgeContent({
  callId,
  isOnCallScreen,
  callMode,
  recipientName,
  isOutgoing,
}: {
  callId: string;
  isOnCallScreen: boolean;
  callMode: "audio" | "video";
  recipientName: string;
  isOutgoing: boolean;
}) {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const isJoined = callingState === CallingState.JOINED;
  const shouldRenderIOSPiP =
    callingState === CallingState.JOINED ||
    callingState === CallingState.RECONNECTING ||
    callingState === CallingState.MIGRATING ||
    callingState === CallingState.OFFLINE ||
    callingState === CallingState.RECONNECTING_FAILED;

  // Stream only auto-enters Android PiP after the call reaches JOINED.
  // Keeping the hook mounted from the root means backgrounding works from
  // both the expanded call screen and the floating in-app overlay.
  useAutoEnterPiPEffect(!isJoined);

  // Track whether the user was on the call screen when PiP started so we
  // know whether to restore DirectCallScreen on PiP stop.
  const onCallScreenAtPiPStartRef = useRef<boolean>(isOnCallScreen);
  const pipActiveRef = useRef(false);
  const isOnCallScreenRef = useRef(isOnCallScreen);

  useEffect(() => {
    isOnCallScreenRef.current = isOnCallScreen;
  }, [isOnCallScreen]);

  const handlePiPChange = useCallback(
    (active: boolean) => {
      const wasActive = pipActiveRef.current;
      pipActiveRef.current = active;

      if (active && !wasActive) {
        onCallScreenAtPiPStartRef.current = isOnCallScreenRef.current;
        console.info("[NativePiPBridge] PiP started", {
          callId,
          onCallScreenAtStart: onCallScreenAtPiPStartRef.current,
        });
        return;
      }

      if (!active && wasActive) {
        const shouldRestoreFullCallScreen = onCallScreenAtPiPStartRef.current;
        console.info("[NativePiPBridge] PiP stopped", {
          callId,
          onCallScreenAtStart: onCallScreenAtPiPStartRef.current,
          isOnCallScreenNow: isOnCallScreenRef.current,
          willRestoreFullCallScreen:
            shouldRestoreFullCallScreen && !isOnCallScreenRef.current,
        });

        // Restore the fullscreen call screen only when (a) the user was
        // on the call screen at the moment PiP entered AND (b) they are
        // currently NOT on it (i.e. navigation moved them off while the
        // app was backgrounded, or we need to re-present after restore).
        // If the user deliberately minimized into the floating overlay,
        // we respect that intent and do not navigate.
        if (shouldRestoreFullCallScreen && !isOnCallScreenRef.current) {
          navigate("DirectCall", {
            callId,
            recipientName,
            mode: callMode,
            isOutgoing,
          });
        }
      }
    },
    [callId, callMode, isOutgoing, recipientName],
  );

  // Source-view wrapper: the frame of the parent View is what iOS animates
  // PiP into on stop. Fullscreen when the user is on the call screen so the
  // restore looks like a natural expand-to-fullscreen; small overlay-sized
  // frame otherwise so a foreground/enforced-stop does not produce a
  // fullscreen "bounce" before shrinking back to the floating overlay.
  const sourceViewStyle = isOnCallScreen
    ? StyleSheet.absoluteFill
    : styles.floatingSourceRect;

  // iOS needs the native PiP renderer mounted to provide true system PiP.
  if (!RTCViewPipIOS || !shouldRenderIOSPiP) return null;
  return (
    <View style={sourceViewStyle} pointerEvents="none" collapsable={false}>
      <RTCViewPipIOS
        includeLocalParticipantVideo={false}
        onPiPChange={handlePiPChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  floatingSourceRect: {
    position: "absolute",
    width: OVERLAY_PIP_WIDTH,
    height: OVERLAY_PIP_HEIGHT,
    right: OVERLAY_PIP_MARGIN,
    bottom: OVERLAY_PIP_BOTTOM_OFFSET,
    // The native RTCViewPipIOS uses its own rendering; we just need a
    // non-zero, non-fullscreen frame so iOS' PiP-stop animation collapses
    // the PiP window here instead of expanding to fill the screen.
    overflow: "hidden",
  },
});
