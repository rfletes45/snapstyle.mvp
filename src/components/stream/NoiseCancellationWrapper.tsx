/**
 * Noise Cancellation Wrapper
 *
 * Wraps children in Stream's NoiseCancellationProvider (must be inside <StreamCall>).
 * Provides runtime debug logging of noise cancellation state and a minimal
 * status indicator hook for call UIs.
 *
 * If the native module is unavailable (e.g. Expo Go), renders children without
 * the provider — call UI still works, just without Krisp noise cancellation.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import React, { useEffect } from "react";

// ---------------------------------------------------------------------------
// Lazy load NoiseCancellationProvider + hook so the module doesn't crash in
// environments where the native module isn't linked (Expo Go, web).
// ---------------------------------------------------------------------------
let NoiseCancellationProvider: React.ComponentType<{
  children: React.ReactNode;
}> | null = null;
let useNoiseCancellation:
  | (() => {
      isSupported: boolean | undefined;
      isEnabled: boolean;
      setEnabled: (fn: boolean | ((prev: boolean) => boolean)) => void;
      deviceSupportsAdvancedAudioProcessing: boolean | undefined;
    })
  | null = null;
let useCallStateHooks:
  | (() => {
      useCallSettings: () => any;
    })
  | null = null;

if (CALL_FEATURES.CALLS_ENABLED) {
  try {
    const sdk = require("@stream-io/video-react-native-sdk");
    NoiseCancellationProvider = sdk.NoiseCancellationProvider ?? null;
    useNoiseCancellation = sdk.useNoiseCancellation ?? null;
    useCallStateHooks = sdk.useCallStateHooks ?? null;
  } catch {
    // Native module unavailable
  }
}

const TAG = "[NoiseCancellation]";

// ---------------------------------------------------------------------------
// Debug Logger (must be inside NoiseCancellationProvider + StreamCall)
// ---------------------------------------------------------------------------
function NoiseCancellationDebugLogger() {
  if (!useNoiseCancellation || !useCallStateHooks) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isSupported, isEnabled, deviceSupportsAdvancedAudioProcessing } =
    useNoiseCancellation();

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { useCallSettings } = useCallStateHooks();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const settings = useCallSettings();

  const dashboardMode = settings?.audio?.noise_cancellation?.mode ?? "unknown";

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    console.info(`${TAG} State:`, {
      dashboardMode,
      isSupported,
      isEnabled,
      deviceSupportsAdvancedAudioProcessing,
    });
  }, [
    dashboardMode,
    isSupported,
    isEnabled,
    deviceSupportsAdvancedAudioProcessing,
  ]);

  return null;
}

// ---------------------------------------------------------------------------
// Public wrapper component
// ---------------------------------------------------------------------------

/**
 * Place this inside <StreamCall> to enable Stream/Krisp noise cancellation.
 * Falls back gracefully when the native module is unavailable.
 */
export function NoiseCancellationWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!NoiseCancellationProvider) {
    // Native module not available — render children directly
    return <>{children}</>;
  }

  return (
    <NoiseCancellationProvider>
      <NoiseCancellationDebugLogger />
      {children}
    </NoiseCancellationProvider>
  );
}

// ---------------------------------------------------------------------------
// Status hook for call UIs (safe to call outside NoiseCancellationProvider —
// returns null values when the provider isn't present)
// ---------------------------------------------------------------------------

export interface NoiseCancellationStatus {
  /** Dashboard mode: "available" | "disabled" | "auto-on" | null */
  dashboardMode: string | null;
  /** true if the native module + dashboard allow NC */
  isSupported: boolean | undefined;
  /** true if NC is currently active on this call */
  isEnabled: boolean;
  /** true if the device has Apple Neural Engine / Android AUDIO_PRO */
  deviceSupportsAdvanced: boolean | undefined;
  /** Toggle NC on/off (no-op if not supported) */
  setEnabled: (fn: boolean | ((prev: boolean) => boolean)) => void;
  /** Whether the full noise cancellation stack is available */
  isAvailable: boolean;
}

/**
 * Use inside a component that is a child of NoiseCancellationWrapper.
 * Returns null-safe defaults when the native module isn't loaded.
 */
export function useNoiseCancellationStatus(): NoiseCancellationStatus {
  const noopSetEnabled = React.useCallback(
    (_fn: boolean | ((prev: boolean) => boolean)) => {},
    [],
  );

  if (!useNoiseCancellation || !useCallStateHooks) {
    return {
      dashboardMode: null,
      isSupported: undefined,
      isEnabled: false,
      deviceSupportsAdvanced: undefined,
      setEnabled: noopSetEnabled,
      isAvailable: false,
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const nc = useNoiseCancellation();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { useCallSettings } = useCallStateHooks();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const settings = useCallSettings();

  const dashboardMode = settings?.audio?.noise_cancellation?.mode ?? null;

  return {
    dashboardMode,
    isSupported: nc.isSupported,
    isEnabled: nc.isEnabled,
    deviceSupportsAdvanced: nc.deviceSupportsAdvancedAudioProcessing,
    setEnabled: nc.setEnabled,
    isAvailable: true,
  };
}
