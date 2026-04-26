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
import { createLogger, isDebugEnabled } from "@/utils/log";
import React, { useEffect, useMemo } from "react";

// ---------------------------------------------------------------------------
// Lazy load NoiseCancellationProvider + hook so the module doesn't crash in
// environments where the native module isn't linked (Expo Go, web).
// ---------------------------------------------------------------------------
let NoiseCancellationProvider: React.ComponentType<{
  noiseCancellation?: any;
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
// Native noise-cancellation bridge instance (required as the
// `noiseCancellation` prop on NoiseCancellationProvider — without it the
// provider renders but performs NO audio processing, which is why the
// Stream dashboard was reporting zero noise-cancellation minutes).
let NoiseCancellationImpl: any = null;

if (CALL_FEATURES.CALLS_ENABLED) {
  try {
    const sdk = require("@stream-io/video-react-native-sdk");
    NoiseCancellationProvider = sdk.NoiseCancellationProvider ?? null;
    useNoiseCancellation = sdk.useNoiseCancellation ?? null;
    useCallStateHooks = sdk.useCallStateHooks ?? null;
  } catch {
    // Native module unavailable
  }
  try {
    const ncModule = require("@stream-io/noise-cancellation-react-native");
    NoiseCancellationImpl =
      ncModule.NoiseCancellation ?? ncModule.default ?? null;
  } catch {
    // Krisp native module not linked (Expo Go / older Android builds)
  }
}

const TAG = "[NoiseCancellation]";
const log = createLogger("stream/noiseCancellation");

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
    if (!isDebugEnabled("CALLS")) return;
    log.debug(`${TAG} State`, {
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
// Auto-enable effect (runs inside provider)
// ---------------------------------------------------------------------------
//
// Stream's NoiseCancellationProvider does NOT auto-activate Krisp even when
// the dashboard mode is "available". The app must explicitly call
// setEnabled(true) once the native module reports isSupported. We gate on
// `isSupported` (covers dashboard "available" + device capability + native
// bridge present) and only flip the switch on — we never force-off, so the
// user can still mute noise cancellation from call UI if that's exposed.
// This is what was previously missing and is why Stream was crediting zero
// noise-cancellation minutes for this app.
function NoiseCancellationAutoEnable() {
  if (!useNoiseCancellation || !useCallStateHooks) return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isSupported, isEnabled, setEnabled } = useNoiseCancellation();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { useCallSettings } = useCallStateHooks();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const settings = useCallSettings();
  const dashboardMode = settings?.audio?.noise_cancellation?.mode ?? null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    // Dashboard "auto-on" already flips isEnabled internally; only push
    // ourselves when the dashboard is "available" (opt-in) and the
    // native + device stack reports support.
    if (isSupported && !isEnabled && dashboardMode !== "disabled") {
      if (isDebugEnabled("CALLS")) {
        log.debug(`${TAG} Auto-enabling`, { dashboardMode });
      }
      setEnabled(true);
    }
  }, [isSupported, isEnabled, dashboardMode, setEnabled]);

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
  // Instantiate the native Krisp bridge once per wrapper mount. Without
  // passing this as the `noiseCancellation` prop to NoiseCancellationProvider
  // the provider is a no-op and produces zero Stream-side noise cancellation
  // minutes, regardless of dashboard configuration.
  const noiseCancellation = useMemo(() => {
    if (!NoiseCancellationImpl) return null;
    try {
      return new NoiseCancellationImpl();
    } catch (err) {
      log.warn(`${TAG} Failed to construct NoiseCancellation instance`, err);
      return null;
    }
  }, []);

  if (!NoiseCancellationProvider) {
    // Native module not available — render children directly
    return <>{children}</>;
  }

  if (!noiseCancellation) {
    // Provider exists but Krisp bridge missing — providing the provider
    // without the bridge would still be a no-op, so skip it and log once
    // so it's obvious in TestFlight logs why NC isn't running.
    log.warn(
      `${TAG} NoiseCancellationProvider present but Krisp native bridge is not linked — noise cancellation disabled.`,
    );
    return <>{children}</>;
  }

  return (
    <NoiseCancellationProvider noiseCancellation={noiseCancellation}>
      <NoiseCancellationAutoEnable />
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
