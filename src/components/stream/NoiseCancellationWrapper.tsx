/**
 * Noise Cancellation Wrapper
 *
 * Stream's NoiseCancellationProvider must be rendered below StreamCall.
 * This wrapper adds the app-level pieces around it:
 * - safe native-module preflight so Expo Go / stale native builds do not crash
 * - user preference enforcement
 * - conservative auto-enable after the call is actually joined
 * - context-based status for call controls
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { callSettingsService } from "@/services/calls";
import { createLogger, isDebugEnabled } from "@/utils/log";
import {
  CallingState,
  NoiseCancellationProvider as StreamNoiseCancellationProvider,
  useCall,
  useCallStateHooks,
  useNoiseCancellation,
} from "@stream-io/video-react-native-sdk";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type NoiseCancellationMode = "available" | "disabled" | "auto-on" | string;

interface NoiseCancellationHookValue {
  isSupported: boolean | undefined;
  isEnabled: boolean;
  setEnabled: (value: boolean | ((prev: boolean) => boolean)) => void;
  deviceSupportsAdvancedAudioProcessing: boolean | undefined;
}

interface StreamCallSettings {
  audio?: {
    noise_cancellation?: {
      mode?: NoiseCancellationMode | null;
    } | null;
  } | null;
}

interface CallStateHooksValue {
  useCallSettings: () => StreamCallSettings | undefined;
  useCallCallingState: () => unknown;
}

interface NativeNoiseCancellationModule {
  deviceSupportsAdvancedAudioProcessing?: () => boolean | Promise<boolean>;
  isEnabled?: () => boolean | Promise<boolean>;
}

interface MinimalCall {
  id?: string;
  type?: string;
}

interface NativePreflightState {
  phase: "checking" | "ready" | "unavailable";
  packageInstalled: boolean;
  nativeLinked: boolean;
  deviceSupportsAdvanced: boolean | undefined;
  error: string | null;
}

export interface NoiseCancellationStatus {
  /** Dashboard mode: "available" | "disabled" | "auto-on" | null */
  dashboardMode: NoiseCancellationMode | null;
  /** true only when dashboard, native module, and device capability allow NC */
  isSupported: boolean | undefined;
  /** SDK/server support gate before app/device gating is applied */
  sdkSupported: boolean | undefined;
  /** true when NC is currently active on this call */
  isEnabled: boolean;
  /** true when the device reports advanced audio processing support */
  deviceSupportsAdvanced: boolean | undefined;
  /** Toggle NC on/off. Enabling is ignored when unsupported. */
  setEnabled: (value: boolean | ((prev: boolean) => boolean)) => void;
  /** Whether the SDK provider is mounted and usable */
  isAvailable: boolean;
  /** Whether package/native/device/dashboard checks are still loading */
  isLoading: boolean;
  /** Safe, non-private error/reason for disabled state */
  error: string | null;
  packageInstalled: boolean;
  nativeLinked: boolean;
  providerMounted: boolean;
  userPreferenceEnabled: boolean;
  callType: string | null;
}

const TAG = "[NoiseCancellation]";
const log = createLogger("stream/noiseCancellation");

let nativeNoiseCancellationModule: NativeNoiseCancellationModule | null = null;

if (CALL_FEATURES.CALLS_ENABLED) {
  try {
    nativeNoiseCancellationModule = require(
      "@stream-io/noise-cancellation-react-native",
    ) as NativeNoiseCancellationModule;
  } catch {
    nativeNoiseCancellationModule = null;
  }
}

const noopSetEnabled = (_value: boolean | ((prev: boolean) => boolean)) => {};

const defaultNoiseCancellationStatus: NoiseCancellationStatus = {
  dashboardMode: null,
  isSupported: undefined,
  sdkSupported: undefined,
  isEnabled: false,
  deviceSupportsAdvanced: undefined,
  setEnabled: noopSetEnabled,
  isAvailable: false,
  isLoading: false,
  error: null,
  packageInstalled: false,
  nativeLinked: false,
  providerMounted: false,
  userPreferenceEnabled: callSettingsService.getSettingsSync().noiseSuppression,
  callType: null,
};

const NoiseCancellationStatusContext =
  createContext<NoiseCancellationStatus>(defaultNoiseCancellationStatus);

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Noise cancellation is unavailable in this build.";
}

function useNativeNoiseCancellationPreflight(): NativePreflightState {
  const [state, setState] = useState<NativePreflightState>(() => ({
    phase: CALL_FEATURES.CALLS_ENABLED ? "checking" : "unavailable",
    packageInstalled: !!nativeNoiseCancellationModule,
    nativeLinked: false,
    deviceSupportsAdvanced: undefined,
    error: CALL_FEATURES.CALLS_ENABLED ? null : "Calls are disabled.",
  }));

  useEffect(() => {
    let cancelled = false;

    const unavailable = (
      error: string,
      packageInstalled = !!nativeNoiseCancellationModule,
      nativeLinked = false,
    ) => {
      if (cancelled) return;
      setState({
        phase: "unavailable",
        packageInstalled,
        nativeLinked,
        deviceSupportsAdvanced: undefined,
        error,
      });
    };

    if (!CALL_FEATURES.CALLS_ENABLED) {
      unavailable("Calls are disabled.", false, false);
      return () => {
        cancelled = true;
      };
    }

    const nativeModule = nativeNoiseCancellationModule;
    if (
      !nativeModule ||
      typeof nativeModule.deviceSupportsAdvancedAudioProcessing !== "function"
    ) {
      unavailable(
        "The Stream noise-cancellation package is not installed or not linked.",
        !!nativeModule,
        false,
      );
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const deviceSupportsAdvanced = await Promise.resolve(
          nativeModule.deviceSupportsAdvancedAudioProcessing?.(),
        );

        if (typeof nativeModule.isEnabled === "function") {
          await Promise.resolve(nativeModule.isEnabled());
        }

        if (cancelled) return;
        setState({
          phase: "ready",
          packageInstalled: true,
          nativeLinked: true,
          deviceSupportsAdvanced: !!deviceSupportsAdvanced,
          error: null,
        });
      } catch (error) {
        unavailable(safeErrorMessage(error), true, false);
        if (isDebugEnabled("CALLS")) {
          log.debug(`${TAG} Native preflight failed`, {
            data: { error: safeErrorMessage(error) },
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function NoiseCancellationRuntimeBridge({
  children,
  nativeState,
}: {
  children: React.ReactNode;
  nativeState: NativePreflightState;
}) {
  const nc = useNoiseCancellation() as NoiseCancellationHookValue;
  const { useCallSettings, useCallCallingState } =
    useCallStateHooks() as CallStateHooksValue;
  const settings = useCallSettings();
  const callingState = useCallCallingState();
  const call = (useCall() as MinimalCall | undefined) ?? null;

  const [userPreferenceEnabled, setUserPreferenceEnabled] = useState(
    () => callSettingsService.getSettingsSync().noiseSuppression,
  );
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const manualOverrideRef = useRef(false);
  const previousPreferenceRef = useRef(userPreferenceEnabled);
  const previousCallKeyRef = useRef<string | null>(null);

  const callType = typeof call?.type === "string" ? call.type : null;
  const callKey = `${callType ?? "unknown"}:${call?.id ?? "unknown"}`;
  const dashboardMode = settings?.audio?.noise_cancellation?.mode ?? null;
  const deviceSupportsAdvanced =
    nc.deviceSupportsAdvancedAudioProcessing ??
    nativeState.deviceSupportsAdvanced;
  const isSupported =
    nativeState.phase === "ready" &&
    nc.isSupported === true &&
    deviceSupportsAdvanced === true;
  const isLoading =
    nativeState.phase === "checking" ||
    nc.isSupported === undefined ||
    deviceSupportsAdvanced === undefined;

  useEffect(() => {
    if (previousCallKeyRef.current === callKey) return;
    previousCallKeyRef.current = callKey;
    manualOverrideRef.current = false;
    setRuntimeError(null);
  }, [callKey]);

  useEffect(() => {
    const unsubscribe = callSettingsService.addListener((settingsSnapshot) => {
      const nextPreference = settingsSnapshot.noiseSuppression;
      if (previousPreferenceRef.current !== nextPreference) {
        previousPreferenceRef.current = nextPreference;
        manualOverrideRef.current = false;
      }
      setUserPreferenceEnabled(nextPreference);
    });
    return unsubscribe;
  }, []);

  const setNoiseCancellationEnabled = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const nextEnabled =
        typeof value === "function" ? value(nc.isEnabled) : value;
      manualOverrideRef.current = true;

      if (nextEnabled && !isSupported) {
        const reason =
          deviceSupportsAdvanced === false
            ? "This device does not support advanced audio processing."
            : dashboardMode === "disabled"
              ? "Noise cancellation is disabled for this Stream call type."
              : "Noise cancellation is not ready for this call.";
        setRuntimeError(reason);
        if (isDebugEnabled("CALLS")) {
          log.debug(`${TAG} Enable ignored`, {
            data: {
              dashboardMode,
              sdkSupported: nc.isSupported,
              deviceSupportsAdvanced,
              nativeLinked: nativeState.nativeLinked,
              callType,
            },
          });
        }
        return;
      }

      try {
        nc.setEnabled(nextEnabled);
        setRuntimeError(null);
      } catch (error) {
        const message = safeErrorMessage(error);
        setRuntimeError(message);
        log.warn(`${TAG} Failed to toggle noise cancellation`, {
          data: { error: message },
        });
      }
    },
    [
      callType,
      dashboardMode,
      deviceSupportsAdvanced,
      isSupported,
      nativeState.nativeLinked,
      nc,
    ],
  );

  useEffect(() => {
    if (!nc.isEnabled || userPreferenceEnabled) return;
    try {
      nc.setEnabled(false);
    } catch (error) {
      const message = safeErrorMessage(error);
      setRuntimeError(message);
      log.warn(`${TAG} Failed to disable after preference change`, {
        data: { error: message },
      });
    }
  }, [nc, nc.isEnabled, userPreferenceEnabled]);

  useEffect(() => {
    if (callingState !== CallingState.JOINED) return;
    if (!userPreferenceEnabled) return;
    if (manualOverrideRef.current) return;
    if (!isSupported || nc.isEnabled) return;

    try {
      if (isDebugEnabled("CALLS")) {
        log.debug(`${TAG} Auto-enabling`, {
          data: {
            dashboardMode,
            sdkSupported: nc.isSupported,
            deviceSupportsAdvanced,
            nativeLinked: nativeState.nativeLinked,
            callType,
          },
        });
      }
      nc.setEnabled(true);
      setRuntimeError(null);
    } catch (error) {
      const message = safeErrorMessage(error);
      setRuntimeError(message);
      log.warn(`${TAG} Auto-enable failed`, { data: { error: message } });
    }
  }, [
    callType,
    callingState,
    dashboardMode,
    deviceSupportsAdvanced,
    isSupported,
    nativeState.nativeLinked,
    nc,
    nc.isEnabled,
    nc.isSupported,
    userPreferenceEnabled,
  ]);

  const effectiveError =
    runtimeError ??
    (nativeState.phase === "unavailable" ? nativeState.error : null);

  const contextValue = useMemo<NoiseCancellationStatus>(
    () => ({
      dashboardMode,
      isSupported,
      sdkSupported: nc.isSupported,
      isEnabled: nc.isEnabled,
      deviceSupportsAdvanced,
      setEnabled: setNoiseCancellationEnabled,
      isAvailable: nativeState.phase === "ready",
      isLoading,
      error: effectiveError,
      packageInstalled: nativeState.packageInstalled,
      nativeLinked: nativeState.nativeLinked,
      providerMounted: true,
      userPreferenceEnabled,
      callType,
    }),
    [
      callType,
      dashboardMode,
      deviceSupportsAdvanced,
      effectiveError,
      isLoading,
      isSupported,
      nativeState.nativeLinked,
      nativeState.packageInstalled,
      nativeState.phase,
      nc.isEnabled,
      nc.isSupported,
      setNoiseCancellationEnabled,
      userPreferenceEnabled,
    ],
  );

  const debugSnapshotRef = useRef("");
  useEffect(() => {
    if (!isDebugEnabled("CALLS")) return;
    const snapshot = JSON.stringify({
      dashboardMode,
      sdkSupported: nc.isSupported,
      deviceSupportsAdvanced,
      enabled: nc.isEnabled,
      supported: isSupported,
      loading: isLoading,
      nativeLinked: nativeState.nativeLinked,
      providerMounted: true,
      userPreferenceEnabled,
      callType,
      error: effectiveError,
    });
    if (debugSnapshotRef.current === snapshot) return;
    debugSnapshotRef.current = snapshot;
    log.debug(`${TAG} State`, {
      data: {
        dashboardMode,
        sdkSupported: nc.isSupported,
        deviceSupportsAdvanced,
        enabled: nc.isEnabled,
        supported: isSupported,
        loading: isLoading,
        nativeLinked: nativeState.nativeLinked,
        providerMounted: true,
        userPreferenceEnabled,
        callType,
        error: effectiveError,
      },
    });
  }, [
    callType,
    dashboardMode,
    deviceSupportsAdvanced,
    effectiveError,
    isLoading,
    isSupported,
    nativeState.nativeLinked,
    nc.isEnabled,
    nc.isSupported,
    userPreferenceEnabled,
  ]);

  return (
    <NoiseCancellationStatusContext.Provider value={contextValue}>
      {children}
    </NoiseCancellationStatusContext.Provider>
  );
}

/**
 * Place this inside StreamCall to enable Stream/Krisp noise cancellation.
 * Falls back gracefully when the native module is unavailable.
 */
export function NoiseCancellationWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const nativeState = useNativeNoiseCancellationPreflight();

  const fallbackStatus = useMemo<NoiseCancellationStatus>(
    () => ({
      ...defaultNoiseCancellationStatus,
      packageInstalled: nativeState.packageInstalled,
      nativeLinked: nativeState.nativeLinked,
      deviceSupportsAdvanced: nativeState.deviceSupportsAdvanced,
      isLoading: nativeState.phase === "checking",
      error: nativeState.error,
    }),
    [
      nativeState.deviceSupportsAdvanced,
      nativeState.error,
      nativeState.nativeLinked,
      nativeState.packageInstalled,
      nativeState.phase,
    ],
  );

  if (nativeState.phase !== "ready") {
    return (
      <NoiseCancellationStatusContext.Provider value={fallbackStatus}>
        {children}
      </NoiseCancellationStatusContext.Provider>
    );
  }

  return (
    <StreamNoiseCancellationProvider>
      <NoiseCancellationRuntimeBridge nativeState={nativeState}>
        {children}
      </NoiseCancellationRuntimeBridge>
    </StreamNoiseCancellationProvider>
  );
}

export function useNoiseCancellationStatus(): NoiseCancellationStatus {
  return useContext(NoiseCancellationStatusContext);
}
