/**
 * VoiceRecordingHost
 *
 * Context bridge between ChatComposer (owner of the textInputContainer
 * layout) and VoiceRecordButton (gesture + recorder state owner).
 *
 * Responsibilities:
 *   1. Share the textInputContainer ref so the gesture handler can
 *      measure absolute bounds for hit detection.
 *   2. Share a `disabled` signal for the instant touch-down gate.
 *   3. Publish recording UI state (isRecording / isLocked / hoverTarget /
 *      duration) from the button UP to the composer so the overlay can
 *      be rendered as a child of textInputContainer (not a child of the
 *      tiny mic View).  Rendering the overlay inside textInputContainer
 *      is critical — it means the overlay's absolute positioning is
 *      relative to the actual text-box bounds, so the cancel X / lock
 *      icon / duration appear INSIDE the composer regardless of
 *      composer width, toolbar tool count, or composer resize.
 *   4. Share locked-mode actions (send / cancel) registered by the
 *      button so the overlay's Pressables can invoke them.
 *
 * @module components/chat/VoiceRecordingHost
 */

import { BorderRadius } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

// ── Types ───────────────────────────────────────────────────────────────
export type HoverTarget = "none" | "cancel" | "lock";

export interface VoiceRecordingState {
  isRecording: boolean;
  isLocked: boolean;
  hoverTarget: HoverTarget;
  durationFormatted: string;
}

export interface LockedActions {
  send?: () => void | Promise<void>;
  cancel?: () => void | Promise<void>;
}

export interface VoiceRecordingHostValue {
  /** Ref to the textInputContainer View, used for bounds measurement. */
  hostRef: React.RefObject<View | null>;
  /** Whether new touch-down gestures should be rejected. */
  disabled: boolean;
  /** Current recording UI state (updated by the button). */
  recordingState: VoiceRecordingState;
  /** Button → host: update the recording state (partial merge). */
  setRecordingState: (patch: Partial<VoiceRecordingState>) => void;
  /** Mutable ref holding the locked-mode action callbacks. */
  lockedActionsRef: React.MutableRefObject<LockedActions>;
}

const DEFAULT_STATE: VoiceRecordingState = {
  isRecording: false,
  isLocked: false,
  hoverTarget: "none",
  durationFormatted: "0:00",
};
const RECORDING_GUIDE_DASHES = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

const VoiceRecordingHostContext = createContext<VoiceRecordingHostValue | null>(
  null,
);

// ── Provider ────────────────────────────────────────────────────────────
export function VoiceRecordingHostProvider({
  hostRef,
  disabled,
  children,
}: {
  hostRef: React.RefObject<View | null>;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const [recordingState, setRecordingStateRaw] =
    useState<VoiceRecordingState>(DEFAULT_STATE);
  const lockedActionsRef = useRef<LockedActions>({});

  const setRecordingState = useCallback(
    (patch: Partial<VoiceRecordingState>) => {
      setRecordingStateRaw((prev) => {
        // Shallow-diff to avoid render churn when nothing actually changed.
        let changed = false;
        for (const k of Object.keys(patch) as (keyof VoiceRecordingState)[]) {
          if (prev[k] !== patch[k]) {
            changed = true;
            break;
          }
        }
        return changed ? { ...prev, ...patch } : prev;
      });
    },
    [],
  );

  const value = useMemo<VoiceRecordingHostValue>(
    () => ({
      hostRef,
      disabled,
      recordingState,
      setRecordingState,
      lockedActionsRef,
    }),
    [hostRef, disabled, recordingState, setRecordingState],
  );

  return (
    <VoiceRecordingHostContext.Provider value={value}>
      {children}
    </VoiceRecordingHostContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────
export function useVoiceRecordingHost(): VoiceRecordingHostValue | null {
  return useContext(VoiceRecordingHostContext);
}

// ── Overlay component ───────────────────────────────────────────────────
/**
 * Renders nothing unless a recording is active.  Must be mounted as a
 * child of the textInputContainer so `StyleSheet.absoluteFillObject`
 * covers the actual text-box bounds.
 */
export function VoiceRecordingOverlay() {
  const host = useVoiceRecordingHost();
  const theme = useTheme();
  const { colors: appColors } = useAppTheme();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const isRecording = host?.recordingState.isRecording ?? false;

  // Drive the pulse animation off the isRecording flag; start/stop it
  // whenever recording toggles.
  useEffect(() => {
    if (!isRecording) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulseAnim.setValue(0);
    };
  }, [isRecording, pulseAnim]);

  if (!host || !isRecording) return null;

  const { recordingState, lockedActionsRef } = host;
  const { isLocked, hoverTarget, durationFormatted } = recordingState;

  const dotOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.35],
  });

  // Overlay matches the textInputContainer shape: same rounded shell,
  // same background. When recording begins the composer visually
  // transforms into this recording bar.
  const overlayBg =
    appColors.inputBackground ?? appColors.surface ?? theme.colors.surface;
  // Timer pill uses a clearly-distinct surface so it never blends with
  // the overlay or the chat background.
  const timerBg =
    appColors.surfaceVariant ??
    (appColors as any).surface2 ??
    theme.colors.surfaceVariant ??
    theme.colors.surface;
  const timerBorder =
    (appColors as any).divider ??
    (appColors as any).outline ??
    "rgba(0,0,0,0.08)";

  return (
    <View
      pointerEvents={isLocked ? "auto" : "box-none"}
      style={[
        styles.overlay,
        { backgroundColor: overlayBg, borderRadius: BorderRadius.xl },
      ]}
    >
      {/* Timer pill — floats just above the composer, horizontally
          centered over the lock icon.  Positioned via bottom:"100%" so
          it tracks the composer's top edge regardless of dynamic
          composer height/width. */}
      <View pointerEvents="none" style={styles.timerPillWrapper}>
        <View
          style={[
            styles.timerPill,
            { backgroundColor: timerBg, borderColor: timerBorder },
          ]}
        >
          <Animated.View style={[styles.recordDot, { opacity: dotOpacity }]} />
          <Text
            style={[styles.durationText, { color: theme.colors.onSurface }]}
          >
            {durationFormatted}
          </Text>
        </View>
      </View>

      {/* Far-left: cancel (X) target */}
      <View style={styles.cancelSlot} pointerEvents="none">
        <View
          style={[
            styles.targetCircle,
            hoverTarget === "cancel" && {
              backgroundColor: theme.colors.error,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="close"
            size={18}
            color={
              hoverTarget === "cancel" ? "#FFF" : theme.colors.onSurfaceVariant
            }
          />
        </View>
      </View>

      {/* Middle filler — keeps flex layout stable between cancel and
          the (optional) right-side locked controls. */}
      <View style={styles.middleSlot} pointerEvents="none">
        {!isLocked && (
          <View style={styles.recordingGuide} pointerEvents="none">
            {RECORDING_GUIDE_DASHES.map((dashKey) => (
              <View
                key={dashKey}
                style={[
                  styles.guideDash,
                  { backgroundColor: theme.colors.onSurfaceVariant },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Absolute-centered lock target — horizontally centered in the
          live overlay bounds (matches textInputContainer). */}
      <View pointerEvents="none" style={styles.lockAbsolute}>
        <View
          style={[
            styles.targetCircle,
            (hoverTarget === "lock" || isLocked) && {
              backgroundColor: theme.colors.primary,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={isLocked ? "lock" : "lock-outline"}
            size={18}
            color={
              hoverTarget === "lock" || isLocked
                ? "#FFF"
                : theme.colors.onSurfaceVariant
            }
          />
        </View>
      </View>

      {/* Right side: locked-mode send / cancel controls. */}
      {isLocked && (
        <View style={styles.lockedControls}>
          <Pressable
            onPress={() => lockedActionsRef.current.cancel?.()}
            style={styles.lockedCancelBtn}
            accessibilityLabel="Discard voice message"
          >
            <MaterialCommunityIcons
              name="delete-outline"
              size={22}
              color={theme.colors.error}
            />
          </Pressable>
          <Pressable
            onPress={() => lockedActionsRef.current.send?.()}
            style={[
              styles.lockedSendBtn,
              { backgroundColor: theme.colors.primary },
            ]}
            accessibilityLabel="Send voice message"
          >
            <MaterialCommunityIcons name="send" size={18} color="#FFF" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    // NOTE: no overflow:"hidden".  The bg + borderRadius alone form the
    // rounded pill; the timer pill child (bottom:"100%") must be free
    // to paint outside the rounded shell without being clipped.
  },
  cancelSlot: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  targetCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  middleSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 8,
    paddingRight: 44,
  },
  recordingGuide: {
    width: "70%",
    maxWidth: 180,
    minWidth: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  guideDash: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.28,
  },
  // Timer pill floats above the composer's top edge, horizontally
  // centered over the lock icon.  Its wrapper uses bottom:"100%" to
  // track the composer's top regardless of composer height/width.
  timerPillWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    alignItems: "center",
    marginBottom: 6,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
  },
  durationText: {
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  lockAbsolute: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedControls: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 6,
  },
  lockedCancelBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
