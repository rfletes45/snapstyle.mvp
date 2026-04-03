/**
 * Native PiP Bridge
 *
 * Keeps Stream's native Picture-in-Picture integration mounted from a single
 * root-level place so direct video calls can enter system PiP from either the
 * full call screen or the in-app floating overlay, without mounting duplicate
 * PiP views during navigation transitions.
 */

import { useStreamCall } from "@/contexts/StreamCallContext";
import React from "react";

let CallingState: any = null;
let StreamCall: any = null;
let RTCViewPipIOS: any = null;
let useAutoEnterPiPEffect: (disablePictureInPicture: boolean | undefined) => void =
  () => {};
let useCallStateHooks: any = null;

try {
  const sdk = require("@stream-io/video-react-native-sdk");
  CallingState = sdk.CallingState;
  StreamCall = sdk.StreamCall;
  RTCViewPipIOS = sdk.RTCViewPipIOS;
  useAutoEnterPiPEffect =
    sdk.useAutoEnterPiPEffect ?? useAutoEnterPiPEffect;
  useCallStateHooks = sdk.useCallStateHooks;
} catch {
  // Stream SDK not available in this environment
}

export function NativePiPBridge() {
  const { activeCall, activeSession } = useStreamCall();

  const shouldMount =
    activeSession?.type === "direct_call" &&
    activeSession.mode === "video" &&
    !!activeCall &&
    !!StreamCall;

  if (!shouldMount || !activeCall) return null;

  return (
    <StreamCall call={activeCall}>
      <NativePiPBridgeContent />
    </StreamCall>
  );
}

function NativePiPBridgeContent() {
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

  // iOS needs the native PiP renderer mounted to provide true system PiP.
  return RTCViewPipIOS && shouldRenderIOSPiP ? (
    <RTCViewPipIOS includeLocalParticipantVideo={false} />
  ) : null;
}
