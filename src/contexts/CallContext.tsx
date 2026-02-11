/**
 * CallContext - React context for call state management
 * Provides call state and actions to the entire app
 *
 * IMPORTANT: Native call features require a development build.
 * On web and Expo Go, a no-op context is provided.
 */

import Constants from "expo-constants";
import React, {
  createContext,
  JSX,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import {
  Call,
  CallActions,
  CallEvent,
  CallState,
  StartCallParams,
} from "@/types/call";


import { createLogger } from "@/utils/log";
const logger = createLogger("contexts/CallContext");
// Platform detection
const isWeb = Platform.OS === "web";
const isExpoGo = Constants.appOwnership === "expo";
const areNativeCallsAvailable = !isWeb && !isExpoGo;

// Conditionally import native modules
let MediaStream: any = null;
let callService: any = null;
let webRTCService: any = null;
let audioSessionService: any = null;
let voipPushService: any = null;
let batteryOptimizationHandler: any = null;
let callReconnectionService: any = null;
let concurrentCallManager: any = null;
let foregroundServiceManager: any = null;

if (areNativeCallsAvailable) {
  try {
    // Only import when native calls are available
    const webrtc = require("react-native-webrtc");
    MediaStream = webrtc.MediaStream;

    const callServices = require("@/services/calls/callService");
    callService = callServices.callService;

    const webRTCServices = require("@/services/calls/webRTCService");
    webRTCService = webRTCServices.webRTCService;

    const audioServices = require("@/services/calls/audioSessionService");
    audioSessionService = audioServices.audioSessionService;

    const voipServices = require("@/services/calls/voipPushService");
    voipPushService = voipServices.voipPushService;

    const batteryServices = require("@/services/calls/batteryOptimizationHandler");
    batteryOptimizationHandler = batteryServices.batteryOptimizationHandler;

    const reconnectionServices = require("@/services/calls/callReconnectionService");
    callReconnectionService = reconnectionServices.callReconnectionService;

    const concurrentServices = require("@/services/calls/concurrentCallManager");
    concurrentCallManager = concurrentServices.concurrentCallManager;

    const foregroundServices = require("@/services/calls/foregroundServiceManager");
    foregroundServiceManager = foregroundServices.foregroundServiceManager;
  } catch (error) {
    logger.warn(
      "[CallContext] Failed to load native call modules:",
      (error as Error).message,
    );
  }
}

// Simple logging helpers
const logInfo = (msg: string, data?: any) =>
  logger.info(`[CallContext] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  logger.error(`[CallContext] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && logger.info(`[CallContext] ${msg}`, data ?? "");

// ============================================================================
// Context Types
// ============================================================================

interface CallContextValue extends CallState, CallActions {
  incomingCall: Call | null;
  showIncomingCallUI: boolean;
  dismissIncomingCall: () => void;
  // Network quality and reconnection
  isReconnecting: boolean;
  reconnectionAttempts: number;
  // Concurrent calls
  heldCalls: Call[];
  hasCallWaiting: boolean;
  holdCurrentCall: () => Promise<void>;
  resumeHeldCall: (callId: string) => Promise<void>;
  swapCalls: () => Promise<void>;
}

const defaultState: CallState = {
  currentCall: null,
  incomingCall: null,
  isConnecting: false,
  isConnected: false,
  isMuted: false,
  isSpeakerOn: false,
  isVideoEnabled: false,
  localStream: null,
  remoteStreams: new Map(),
  callDuration: 0,
  networkQuality: "unknown",
};

const CallContext = createContext<CallContextValue | null>(null);

// ============================================================================
// No-op Provider for Web/Expo Go
// ============================================================================

const noopAsyncVoid = async (): Promise<void> => {};
const noopAsyncString = async (): Promise<string> => "";
const noopVoid = (): void => {};
const noopAsyncWithParam = async (_: string): Promise<void> => {};

const noopContextValue: CallContextValue = {
  ...defaultState,
  incomingCall: null,
  showIncomingCallUI: false,
  isReconnecting: false,
  reconnectionAttempts: 0,
  heldCalls: [],
  hasCallWaiting: false,
  // All actions are no-ops with correct types
  startCall: noopAsyncString as (params: StartCallParams) => Promise<string>,
  answerCall: noopAsyncVoid,
  declineCall: noopAsyncVoid,
  endCall: noopAsyncVoid,
  toggleMute: noopVoid,
  toggleSpeaker: noopVoid,
  toggleVideo: noopVoid,
  switchCamera: noopAsyncVoid,
  dismissIncomingCall: noopVoid,
  holdCurrentCall: noopAsyncVoid,
  resumeHeldCall: noopAsyncWithParam,
  swapCalls: noopAsyncVoid,
};

// ============================================================================
// Provider Component
// ============================================================================

interface CallProviderProps {
  children: ReactNode;
}

export function CallProvider({ children }: CallProviderProps): JSX.Element {
  // If native calls are not available, provide no-op context
  if (!areNativeCallsAvailable) {
    logInfo("Native calls not available - using no-op provider");
    return (
      <CallContext.Provider value={noopContextValue}>
        {children}
      </CallContext.Provider>
    );
  }

  return <NativeCallProvider>{children}</NativeCallProvider>;
}

/**
 * Native Call Provider - Only rendered on native platforms with dev builds
 */
function NativeCallProvider({ children }: CallProviderProps): JSX.Element {
  // Call state
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [showIncomingCallUI, setShowIncomingCallUI] = useState(false);

  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectionAttempts, setReconnectionAttempts] = useState(0);

  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  );

  // Concurrent calls state
  const [heldCalls, setHeldCalls] = useState<Call[]>([]);
  const [hasCallWaiting, setHasCallWaiting] = useState(false);

  // Call metrics
  const [callDuration, setCallDuration] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<
    "good" | "fair" | "poor" | "unknown"
  >("unknown");

  // Refs for duration timer
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const callStartTimeRef = useRef<number | null>(null);

  // ============================================================================
  // Initialization
  // ============================================================================

  useEffect(() => {
    // Initialize call service and related services
    const initializeServices = async () => {
      try {
        await callService.initialize();
        logInfo("CallService initialized");

        // Initialize audio session
        await audioSessionService.initialize();
        logInfo("AudioSessionService initialized");

        // Initialize VoIP push on iOS
        if (Platform.OS === "ios") {
          await voipPushService.register();
          logInfo("VoIPPushService registered");
        }

        // Check battery optimization on Android
        if (Platform.OS === "android") {
          const state = await batteryOptimizationHandler.checkState();
          if (state === "optimized") {
            // Prompt user after a short delay (don't block initialization)
            setTimeout(() => {
              batteryOptimizationHandler.showExemptionPrompt();
            }, 2000);
          }
        }
      } catch (error) {
        logError("Failed to initialize call services", { error });
      }
    };

    initializeServices();

    // Subscribe to call events
    const unsubscribe = callService.addEventListener(handleCallEvent);

    // Setup WebRTC callbacks
    webRTCService.setCallbacks({
      onRemoteStreamAdded: (odId: string, stream: any) => {
        setRemoteStreams((prev: Map<string, any>) =>
          new Map(prev).set(odId, stream),
        );
      },
      onRemoteStreamRemoved: (odId: string) => {
        setRemoteStreams((prev: Map<string, any>) => {
          const updated = new Map(prev);
          updated.delete(odId);
          return updated;
        });
      },
      onConnectionStateChanged: (odId: string, state: string) => {
        logDebug("Connection state changed", { odId, state });
        if (state === "connected") {
          setIsConnected(true);
          setIsConnecting(false);
          setIsReconnecting(false);
          setReconnectionAttempts(0);
        } else if (state === "connecting") {
          setIsConnecting(true);
        } else if (state === "failed" || state === "disconnected") {
          // Handle reconnection
          handleConnectionLost();
        }
      },
    });

    // Setup reconnection service callbacks
    callReconnectionService.setCallbacks({
      onAttemptingReconnect: (attempt: number, maxAttempts: number) => {
        setIsReconnecting(true);
        setReconnectionAttempts(attempt);
        logInfo("Attempting reconnection", { attempt, maxAttempts });
      },
      onReconnected: () => {
        setIsReconnecting(false);
        setReconnectionAttempts(0);
        logInfo("Call reconnected");
      },
      onReconnectFailed: () => {
        setIsReconnecting(false);
        logError("Reconnection failed, ending call");
        // End call after failed reconnection
        if (currentCall) {
          endCall(currentCall.id);
        }
      },
    });

    // Handle app state changes (background/foreground)
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      unsubscribe();
      appStateSubscription.remove();
      stopDurationTimer();
      callReconnectionService.stopMonitoring();
    };
  }, []);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleCallEvent = useCallback((event: CallEvent) => {
    logDebug("Call event received", { type: event.type });

    switch (event.type) {
      case "call_started":
        if (event.call.callerId === callService.getCurrentCallId()) {
          // Outgoing call
          setCurrentCall(event.call);
          setIsConnecting(true);
        } else {
          // Incoming call
          setIncomingCall(event.call);
          setShowIncomingCallUI(true);
        }
        break;

      case "call_answered":
        setCurrentCall(event.call);
        setIncomingCall(null);
        setShowIncomingCallUI(false);
        setIsConnecting(true);
        startDurationTimer();
        break;

      case "call_ended":
        handleCallEnded(event.call);
        break;

      case "call_failed":
        handleCallEnded(event.call);
        logError("Call failed", { error: event.error });
        break;

      case "participant_joined":
        logInfo("Participant joined", {
          participant: event.participant.displayName,
        });
        break;

      case "participant_left":
        logInfo("Participant left", { odId: event.odId });
        break;

      case "network_quality_changed":
        setNetworkQuality(event.quality);
        break;
    }
  }, []);

  const handleCallEnded = useCallback(async (call: Call) => {
    setCurrentCall(null);
    setIncomingCall(null);
    setShowIncomingCallUI(false);
    setIsConnecting(false);
    setIsConnected(false);
    setIsMuted(false);
    setIsSpeakerOn(false);
    setIsVideoEnabled(false);
    setLocalStream(null);
    setRemoteStreams(new Map());
    setNetworkQuality("unknown");
    setIsReconnecting(false);
    setReconnectionAttempts(0);
    stopDurationTimer();

    // Stop foreground service on Android
    if (Platform.OS === "android") {
      await foregroundServiceManager.stopService();
    }

    // Stop reconnection monitoring
    callReconnectionService.stopMonitoring();
  }, []);

  const handleConnectionLost = useCallback(async () => {
    if (!currentCall) return;

    logInfo("Connection lost, starting reconnection");
    setIsReconnecting(true);

    // Start reconnection monitoring
    callReconnectionService.startMonitoring(currentCall.id);
  }, [currentCall]);

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      logDebug("App state changed", { nextAppState });

      // Start foreground service when going to background with active call
      if (
        Platform.OS === "android" &&
        currentCall &&
        nextAppState === "background"
      ) {
        await foregroundServiceManager.startService(
          currentCall.id,
          currentCall.callerName ?? "Unknown",
          currentCall.type === "video",
        );
      }

      // Stop foreground service when coming to foreground
      if (Platform.OS === "android" && nextAppState === "active") {
        // Keep service if call is active
        if (!currentCall) {
          await foregroundServiceManager.stopService();
        }
      }
    },
    [currentCall],
  );

  // ============================================================================
  // Duration Timer
  // ============================================================================

  const startDurationTimer = useCallback(() => {
    callStartTimeRef.current = Date.now();
    setCallDuration(0);

    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsed = Math.floor(
          (Date.now() - callStartTimeRef.current) / 1000,
        );
        setCallDuration(elapsed);
      }
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    callStartTimeRef.current = null;
    setCallDuration(0);
  }, []);

  // ============================================================================
  // Call Actions
  // ============================================================================

  const startCall = useCallback(
    async (params: StartCallParams): Promise<string> => {
      try {
        setIsConnecting(true);
        setIsVideoEnabled(params.type === "video");

        const callId = await callService.startCall(params);

        // Get local stream after initialization
        const stream = webRTCService.getLocalStream();
        if (stream) {
          setLocalStream(stream);
        }

        return callId;
      } catch (error) {
        setIsConnecting(false);
        logError("Failed to start call", { error });
        throw error;
      }
    },
    [],
  );

  const answerCall = useCallback(
    async (callId: string): Promise<void> => {
      try {
        setShowIncomingCallUI(false);
        setIsConnecting(true);

        await callService.answerCall(callId);

        // Get local stream after answering
        const stream = webRTCService.getLocalStream();
        if (stream) {
          setLocalStream(stream);
        }

        startDurationTimer();
      } catch (error) {
        setIsConnecting(false);
        logError("Failed to answer call", { error });
        throw error;
      }
    },
    [startDurationTimer],
  );

  const declineCall = useCallback(async (callId: string): Promise<void> => {
    try {
      await callService.declineCall(callId);
      setIncomingCall(null);
      setShowIncomingCallUI(false);
    } catch (error) {
      logError("Failed to decline call", { error });
      throw error;
    }
  }, []);

  const endCall = useCallback(async (callId?: string): Promise<void> => {
    try {
      await callService.endCall(callId);
    } catch (error) {
      logError("Failed to end call", { error });
    }
  }, []);

  const toggleMute = useCallback((): void => {
    const newMuted = callService.toggleMute();
    setIsMuted(newMuted);
  }, []);

  const toggleSpeaker = useCallback((): void => {
    const newSpeaker = callService.toggleSpeaker();
    setIsSpeakerOn(newSpeaker);
  }, []);

  const toggleVideo = useCallback((): void => {
    const newEnabled = callService.toggleVideo();
    setIsVideoEnabled(newEnabled);
  }, []);

  const switchCamera = useCallback(async (): Promise<void> => {
    try {
      await callService.switchCamera();
    } catch (error) {
      logError("Failed to switch camera", { error });
    }
  }, []);

  const dismissIncomingCall = useCallback((): void => {
    setShowIncomingCallUI(false);
  }, []);

  // ============================================================================
  // Concurrent Call Actions
  // ============================================================================

  const holdCurrentCall = useCallback(async (): Promise<void> => {
    if (!currentCall) return;

    try {
      await concurrentCallManager.holdCall(currentCall.id);
      setHeldCalls((prev: Call[]) => [...prev, currentCall]);
      setCurrentCall(null);
      logInfo("Call put on hold", { callId: currentCall.id });
    } catch (error) {
      logError("Failed to hold call", { error });
      throw error;
    }
  }, [currentCall]);

  const resumeHeldCall = useCallback(
    async (callId: string): Promise<void> => {
      try {
        // If there's an active call, hold it first
        if (currentCall) {
          await holdCurrentCall();
        }

        const heldCall = heldCalls.find((c: Call) => c.id === callId);
        if (!heldCall) {
          throw new Error("Call not found in held calls");
        }

        await concurrentCallManager.resumeCall(callId);
        setHeldCalls((prev: Call[]) =>
          prev.filter((c: Call) => c.id !== callId),
        );
        setCurrentCall(heldCall);
        logInfo("Call resumed", { callId });
      } catch (error) {
        logError("Failed to resume call", { error });
        throw error;
      }
    },
    [currentCall, heldCalls, holdCurrentCall],
  );

  const swapCalls = useCallback(async (): Promise<void> => {
    if (!currentCall || heldCalls.length === 0) return;

    try {
      const firstHeldCall = heldCalls[0];
      await concurrentCallManager.swapCalls(currentCall.id, firstHeldCall.id);

      // Swap current call with first held call
      setHeldCalls((prev: Call[]) => [
        currentCall,
        ...prev.filter((c: Call) => c.id !== firstHeldCall.id),
      ]);
      setCurrentCall(firstHeldCall);
      logInfo("Calls swapped");
    } catch (error) {
      logError("Failed to swap calls", { error });
      throw error;
    }
  }, [currentCall, heldCalls]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: CallContextValue = {
    // State
    currentCall,
    incomingCall,
    isConnecting,
    isConnected,
    isMuted,
    isSpeakerOn,
    isVideoEnabled,
    localStream,
    remoteStreams,
    callDuration,
    networkQuality,
    showIncomingCallUI,
    isReconnecting,
    reconnectionAttempts,
    heldCalls,
    hasCallWaiting: incomingCall !== null && currentCall !== null,

    // Actions
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    switchCamera,
    dismissIncomingCall,
    holdCurrentCall,
    resumeHeldCall,
    swapCalls,
  };

  return (
    <CallContext.Provider value={contextValue}>{children}</CallContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCallContext(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCallContext must be used within a CallProvider");
  }
  return context;
}

export { CallContext };
