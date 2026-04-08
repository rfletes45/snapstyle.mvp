/**
 * Games V4 — Crazy 8's Game Screen (v2 – visual upgrade)
 *
 * Mobile-first card game UI inspired by GamePigeon.
 * Uses the withGameV4Shell HOC for session management, move submission,
 * and auto-navigation to GameOverV4 on terminal.
 *
 * Visual features:
 *   - BottomDock layout with absolute positioning (no reflow)
 *   - Opponent card-back fans arranged around the table
 *   - Wild cards render BLACK in-hand, adopt chosen color on discard
 *   - Subtle diagonal watermark ellipse on every card face
 *   - No color bubble — discard card itself communicates color
 *   - Real display names via profileCache
 *   - Haptic feedback on valid plays
 *
 * @module gamesV4/screens/CrazyEightsScreenV4
 */

import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { subscribeToPrivateState } from "@/gamesV4/services/gameServiceV4";
import {
  getCachedProfileSync,
  prefetchProfiles,
} from "@/services/cache/profileCache";
import { useAppTheme } from "@/store/ThemeContext";
import * as Haptics from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { computePlayableCards } from "../adapters/crazyEights/crazyEightsEngine";
import type {
  Card,
  CardColor,
  CrazyEightsPrivateState,
  CrazyEightsPublicState,
} from "../adapters/crazyEights/crazyEightsTypes";

// =============================================================================
// Dev-only Logging
// =============================================================================

const __DEV_TRACE__ = __DEV__;

function moveTrace(tag: string, data: Record<string, unknown>) {
  if (!__DEV_TRACE__) return;
  console.log(`[c8][moveTrace][${tag}]`, JSON.stringify(data, null, 0));
}

function stateTrace(tag: string, data: Record<string, unknown>) {
  if (!__DEV_TRACE__) return;
  console.log(`[c8][stateTrace][${tag}]`, JSON.stringify(data, null, 0));
}

let _traceCounter = 0;
function nextTraceId(): string {
  _traceCounter++;
  return `c8-${Date.now()}-${_traceCounter}`;
}

// =============================================================================
// Dimensions / Sizing
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_W = 58;
const CARD_H = 86;
const CARD_RADIUS = 8;
const CARD_BACK_W = 36;
const CARD_BACK_H = 52;

// Bottom dock total height: hand tray + turn footer
const HAND_TRAY_H = CARD_H + 28;
const TURN_FOOTER_H = 36;

// =============================================================================
// Color Constants
// =============================================================================

const COLOR_MAP: Record<CardColor, string> = {
  red: "#E74C3C",
  blue: "#3498DB",
  green: "#27AE60",
  yellow: "#F1C40F",
};

const COLOR_NAMES: Record<CardColor, string> = {
  red: "Red",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
};

const ALL_COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

const WILD_BLACK = "#1A1A2E";

// =============================================================================
// Helpers
// =============================================================================

function asState(
  ps: Record<string, unknown> | null,
): CrazyEightsPublicState | null {
  if (!ps) return null;
  return ps as unknown as CrazyEightsPublicState;
}

function asPrivate(
  ps: Record<string, unknown> | null,
): CrazyEightsPrivateState | null {
  if (!ps) return null;
  return ps as unknown as CrazyEightsPrivateState;
}

function cardLabel(card: Card): string {
  if (card.type === "wild") return "W";
  if (card.type === "wild_draw_four") return "+4";
  if (card.type === "skip") return "⊘";
  if (card.type === "reverse") return "⟲";
  if (card.type === "draw_two") return "+2";
  return String(card.value ?? "?");
}

/**
 * Card background color.
 * - Normal cards → their color.
 * - Wilds in-hand → WILD_BLACK.
 * - Top discard wilds (after color pick) → adopted color.
 */
function getCardBg(
  card: Card,
  isDiscard: boolean,
  currentColor?: CardColor,
): string {
  if (card.color) return COLOR_MAP[card.color];
  if (isDiscard && currentColor) return COLOR_MAP[currentColor];
  return WILD_BLACK;
}

function isWildCard(card: Card): boolean {
  return card.type === "wild" || card.type === "wild_draw_four";
}

/** Solid pastel-red screen background (Catppuccin Mocha-friendly). */
const CRAZY8_BG = "#D4626E";

/**
 * Format the lastMove log entry into a human-readable string.
 */
function formatMicroLog(
  lastMove: { actor: string; action: string; detail?: string },
  playerNames?: Record<string, string>,
): string {
  const who = playerNames?.[lastMove.actor] ?? "Player";
  const detail = lastMove.detail;
  switch (lastMove.action) {
    case "PLAY_CARD":
      return detail ? `${who} played ${detail}` : `${who} played a card`;
    case "DRAW_CARD":
      return `${who} drew a card`;
    case "PASS":
      return `${who} passed`;
    case "CALL_CRAZY":
      return `${who} called CRAZY!`;
    case "CHALLENGE_WILD4":
      return `${who} challenged Wild +4`;
    case "ACCEPT_WILD4":
      return `${who} accepted Wild +4`;
    default:
      return detail ? `${lastMove.action} — ${detail}` : lastMove.action;
  }
}

// =============================================================================
// Display name resolution hook
// =============================================================================

function usePlayerNames(
  turnOrder: string[],
  myUid: string,
): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await prefetchProfiles(turnOrder);
      if (cancelled) return;
      const result: Record<string, string> = {};
      for (const uid of turnOrder) {
        if (uid === myUid) {
          result[uid] = "You";
        } else {
          const p = getCachedProfileSync(uid);
          result[uid] = p?.displayName || p?.username || "Player";
        }
      }
      setNames(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [turnOrder, myUid]);

  return names;
}

// =============================================================================
// Card Watermark — subtle diagonal white ellipse
// =============================================================================

const CardWatermark = React.memo(function CardWatermark({
  isWildBlack,
}: {
  isWildBlack: boolean;
}) {
  return (
    <View
      style={[wmStyles.container, { opacity: isWildBlack ? 0.06 : 0.1 }]}
      pointerEvents="none"
    >
      <View style={wmStyles.ellipse} />
    </View>
  );
});

const wmStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: CARD_RADIUS,
  },
  ellipse: {
    width: CARD_W * 1.8,
    height: CARD_H * 0.55,
    borderRadius: CARD_W,
    backgroundColor: "#FFF",
    transform: [{ rotate: "-30deg" }],
  },
});

// =============================================================================
// Card Component (face)
// =============================================================================

interface CardViewProps {
  card: Card;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  small?: boolean;
  /** True when this card is the top discard – wilds adopt currentColor */
  isDiscard?: boolean;
  currentColor?: CardColor;
}

const CardView = React.memo(function CardView({
  card,
  onPress,
  disabled,
  selected,
  small,
  isDiscard,
  currentColor,
}: CardViewProps) {
  const w = small ? CARD_W * 0.7 : CARD_W;
  const h = small ? CARD_H * 0.7 : CARD_H;
  const fontSize = small ? 16 : 22;
  const bg = getCardBg(card, !!isDiscard, currentColor);
  const label = cardLabel(card);
  const wildBlack = isWildCard(card) && !isDiscard;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
      style={[
        cvStyles.card,
        {
          width: w,
          height: h,
          backgroundColor: bg,
          borderColor: selected ? "#FFF" : "rgba(0,0,0,0.18)",
          borderWidth: selected ? 2.5 : 1,
          transform: selected ? [{ translateY: -12 }, { scale: 1.06 }] : [],
          shadowColor: selected ? "#FFF" : "#000",
          shadowOpacity: selected ? 0.45 : 0.22,
          shadowRadius: selected ? 8 : 2.5,
          shadowOffset: { width: 0, height: selected ? 4 : 1 },
          elevation: selected ? 8 : 3,
        },
      ]}
    >
      {/* Inner stroke — premium card feel */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: CARD_RADIUS - 1,
          borderWidth: 0.5,
          borderColor: "rgba(255,255,255,0.15)",
          margin: 1,
        }}
        pointerEvents="none"
      />
      <CardWatermark isWildBlack={wildBlack} />
      {/* Top-left */}
      <Text
        style={[cvStyles.corner, { fontSize: small ? 8 : 10, top: 3, left: 4 }]}
      >
        {label}
      </Text>
      {/* Center */}
      <Text style={[cvStyles.center, { fontSize, fontWeight: "900" }]}>
        {label}
      </Text>
      {/* Bottom-right */}
      <Text
        style={[
          cvStyles.corner,
          {
            fontSize: small ? 8 : 10,
            bottom: 3,
            right: 4,
            transform: [{ rotate: "180deg" }],
          },
        ]}
      >
        {label}
      </Text>
      {/* Wild rainbow stripe at bottom */}
      {isWildCard(card) && (
        <View style={cvStyles.wildStripe}>
          {ALL_COLORS.map((c) => (
            <View
              key={c}
              style={[cvStyles.wildSeg, { backgroundColor: COLOR_MAP[c] }]}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
});

const cvStyles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.5,
    elevation: 3,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    color: "#FFF",
    fontWeight: "700",
  },
  center: {
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  wildStripe: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    flexDirection: "row",
  },
  wildSeg: {
    flex: 1,
  },
});

// =============================================================================
// Card Back Component
// =============================================================================

const CardBack = React.memo(function CardBack({
  width = CARD_BACK_W,
  height = CARD_BACK_H,
  rotation = 0,
}: {
  width?: number;
  height?: number;
  rotation?: number;
}) {
  return (
    <View
      style={[
        cbStyles.back,
        {
          width,
          height,
          transform: rotation !== 0 ? [{ rotate: `${rotation}deg` }] : [],
        },
      ]}
    >
      {/* Inner border — premium double stroke */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 4,
          borderWidth: 0.5,
          borderColor: "rgba(255,255,255,0.08)",
          margin: 2,
        }}
        pointerEvents="none"
      />
      {/* Diagonal watermark stripes */}
      <View style={cbStyles.wmContainer} pointerEvents="none">
        <View style={cbStyles.wm} />
        <View
          style={[cbStyles.wm, { opacity: 0.5, marginTop: -height * 0.15 }]}
        />
      </View>
      {/* Center monogram */}
      <Text
        style={[cbStyles.monogram, { fontSize: Math.max(8, width * 0.28) }]}
      >
        C8
      </Text>
    </View>
  );
});

const cbStyles = StyleSheet.create({
  back: {
    borderRadius: 5,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#2D3748",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  wmContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 5,
  },
  wm: {
    width: CARD_BACK_W * 1.6,
    height: CARD_BACK_H * 0.35,
    borderRadius: CARD_BACK_W * 0.8,
    backgroundColor: "rgba(255,255,255,0.05)",
    transform: [{ rotate: "-35deg" }],
  },
  monogram: {
    color: "rgba(255,255,255,0.18)",
    fontWeight: "900",
    letterSpacing: 2,
  },
});

// =============================================================================
// Opponent Card Fan — renders overlapping card backs in a slight arc
// =============================================================================

const MAX_VISIBLE_BACKS = 10;

interface OpponentFanProps {
  cardCount: number;
  compact?: boolean;
}

const OpponentFan = React.memo(function OpponentFan({
  cardCount,
  compact,
}: OpponentFanProps) {
  const visible = Math.min(cardCount, MAX_VISIBLE_BACKS);
  const overlap = compact ? 10 : 14;
  const fanWidth = visible * overlap + (CARD_BACK_W - overlap);
  const remaining = cardCount - visible;

  return (
    <View
      style={{
        width: fanWidth,
        height: CARD_BACK_H + 6,
        position: "relative",
      }}
    >
      {Array.from({ length: visible }).map((_, i) => {
        const midIdx = (visible - 1) / 2;
        const rotDeg = (i - midIdx) * (compact ? 2.5 : 3.5);
        const yOff = Math.abs(i - midIdx) * (compact ? 1.2 : 1.8);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: i * overlap,
              top: yOff,
              zIndex: i,
            }}
          >
            <CardBack rotation={rotDeg} />
          </View>
        );
      })}
      {remaining > 0 && (
        <View style={fanStyles.badge}>
          <Text style={fanStyles.badgeText}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
});

const fanStyles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: -6,
    top: -6,
    backgroundColor: "#E74C3C",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
});

// =============================================================================
// Opponent Slot — name tag + card fan
// =============================================================================

type SlotPosition = "top" | "topLeft" | "topRight" | "midLeft" | "midRight";

const SLOT_FILL_RULES: Record<number, SlotPosition[]> = {
  1: ["top"],
  2: ["topLeft", "topRight"],
  3: ["topLeft", "top", "topRight"],
  4: ["midLeft", "topLeft", "topRight", "midRight"],
  5: ["midLeft", "topLeft", "top", "topRight", "midRight"],
};

interface OpponentSlotProps {
  name: string;
  cardCount: number;
  isCurrentTurn: boolean;
  calledCrazy: boolean;
  isDark: boolean;
  primaryColor: string;
  slotPosition: SlotPosition;
}

const OpponentSlot = React.memo(function OpponentSlot({
  name,
  cardCount,
  isCurrentTurn,
  calledCrazy,
  isDark,
  primaryColor,
  slotPosition,
}: OpponentSlotProps) {
  const isSide = slotPosition === "midLeft" || slotPosition === "midRight";
  return (
    <View style={[osStyles.wrapper, osPositions[slotPosition]]}>
      <View
        style={[
          osStyles.nameTag,
          {
            backgroundColor: isCurrentTurn
              ? primaryColor + "30"
              : isDark
                ? "rgba(26,26,46,0.85)"
                : "rgba(245,245,245,0.9)",
            borderColor: isCurrentTurn ? primaryColor : "transparent",
            borderWidth: isCurrentTurn ? 1.5 : 0,
          },
        ]}
      >
        <Text
          style={[
            osStyles.nameText,
            {
              color: isCurrentTurn ? primaryColor : isDark ? "#CCC" : "#333",
              fontWeight: isCurrentTurn ? "700" : "500",
            },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {calledCrazy && <Text style={{ fontSize: 10 }}>🃏</Text>}
        <Text style={[osStyles.countText, { color: isDark ? "#AAA" : "#666" }]}>
          {cardCount}
        </Text>
      </View>
      <OpponentFan cardCount={cardCount} compact={isSide} />
    </View>
  );
});

const osPositions = StyleSheet.create({
  top: { alignSelf: "center" },
  topLeft: { alignSelf: "flex-start", marginLeft: 8 },
  topRight: { alignSelf: "flex-end", marginRight: 8 },
  midLeft: { alignSelf: "flex-start", marginLeft: 4 },
  midRight: { alignSelf: "flex-end", marginRight: 4 },
});

const osStyles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    maxWidth: SCREEN_WIDTH * 0.38,
  },
  nameTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 2,
    gap: 4,
  },
  nameText: {
    fontSize: 11,
    maxWidth: 80,
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
  },
});

// =============================================================================
// Opponents Area — distributes opponents into spatial slots
// =============================================================================

interface OpponentsAreaProps {
  state: CrazyEightsPublicState;
  myUid: string;
  playerNames: Record<string, string>;
  isDark: boolean;
  primaryColor: string;
}

const OpponentsArea = React.memo(function OpponentsArea({
  state,
  myUid,
  playerNames,
  isDark,
  primaryColor,
}: OpponentsAreaProps) {
  const opponents = useMemo(
    () => state.turnOrder.filter((uid) => uid !== myUid),
    [state.turnOrder, myUid],
  );

  const slots = SLOT_FILL_RULES[opponents.length] ?? SLOT_FILL_RULES[5]!;

  // Group opponents by row
  const topRow: string[] = [];
  const midRow: string[] = [];
  opponents.forEach((uid, i) => {
    const pos = slots[i];
    if (pos === "midLeft" || pos === "midRight") {
      midRow.push(uid);
    } else {
      topRow.push(uid);
    }
  });

  const renderSlot = (uid: string) => {
    const globalIdx = opponents.indexOf(uid);
    return (
      <OpponentSlot
        key={uid}
        name={playerNames[uid] ?? "Player"}
        cardCount={state.handCounts[uid] ?? 0}
        isCurrentTurn={state.currentTurnUid === uid}
        calledCrazy={state.calledCrazy[uid] ?? false}
        isDark={isDark}
        primaryColor={primaryColor}
        slotPosition={slots[globalIdx] ?? "top"}
      />
    );
  };

  return (
    <View style={oaStyles.container}>
      {topRow.length > 0 && (
        <View style={oaStyles.topRow}>{topRow.map(renderSlot)}</View>
      )}
      {midRow.length > 0 && (
        <View style={oaStyles.midRow}>{midRow.map(renderSlot)}</View>
      )}
    </View>
  );
});

const oaStyles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 2,
  },
  midRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
});

// =============================================================================
// Center Area: Discard + Draw + Direction + Stack Meter + Micro Log
// (No color ring/bubble – discard card itself communicates color)
// =============================================================================

interface CenterAreaProps {
  state: CrazyEightsPublicState;
  isDark: boolean;
  onDrawPress: () => void;
  drawDisabled: boolean;
  onDiscardPress?: () => void;
  discardDisabled?: boolean;
  playerNames?: Record<string, string>;
}

function CenterArea({
  state,
  isDark,
  onDrawPress,
  drawDisabled,
  onDiscardPress,
  discardDisabled = true,
  playerNames,
}: CenterAreaProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Card arrival flash — triggers when a new card is played
  const arrivalAnim = useRef(new Animated.Value(1)).current;
  const prevMoveCount = useRef(state.moveCount);
  useEffect(() => {
    if (state.moveCount !== prevMoveCount.current) {
      prevMoveCount.current = state.moveCount;
      arrivalAnim.setValue(1.15);
      Animated.spring(arrivalAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [state.moveCount, arrivalAnim]);

  // Direction icon flip
  const dirAnim = useRef(
    new Animated.Value(state.direction === 1 ? 0 : 1),
  ).current;
  useEffect(() => {
    Animated.timing(dirAnim, {
      toValue: state.direction === 1 ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [state.direction, dirAnim]);

  useEffect(() => {
    if (state.pendingDraw.count > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state.pendingDraw.count, pulseAnim]);

  return (
    <View style={ctStyles.area}>
      {/* Direction indicator — animated flip on reverse */}
      <Animated.View
        style={[
          ctStyles.dirRow,
          {
            transform: [
              {
                scaleX: dirAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, -1],
                }),
              },
            ],
          },
        ]}
      >
        <MaterialCommunityIcons
          name="rotate-right"
          size={16}
          color={isDark ? "#888" : "#AAA"}
        />
      </Animated.View>

      <View style={ctStyles.pilesRow}>
        {/* Discard pile — tap to confirm play when a card is selected */}
        <TouchableOpacity
          style={ctStyles.pile}
          onPress={onDiscardPress}
          disabled={discardDisabled}
          activeOpacity={0.7}
        >
          <Text
            style={[ctStyles.pileLabel, { color: isDark ? "#666" : "#AAA" }]}
          >
            Discard
          </Text>
          <Animated.View
            style={{
              transform: [{ scale: Animated.multiply(pulseAnim, arrivalAnim) }],
            }}
          >
            <CardView
              card={state.topDiscard}
              disabled
              isDiscard
              currentColor={state.currentColor}
            />
            {/* Glow ring when discard is tappable */}
            {!discardDisabled && (
              <View
                style={{
                  position: "absolute",
                  top: -5,
                  left: -5,
                  right: -5,
                  bottom: -5,
                  borderRadius: CARD_RADIUS + 4,
                  borderWidth: 2.5,
                  borderColor: "#34C759",
                  shadowColor: "#34C759",
                  shadowOpacity: 0.6,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
            )}
          </Animated.View>
          {state.pendingDraw.count > 0 && (
            <View style={ctStyles.stackBadge}>
              <Text style={ctStyles.stackBadgeText}>
                +{state.pendingDraw.count}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Draw pile */}
        <TouchableOpacity
          style={ctStyles.pile}
          onPress={onDrawPress}
          disabled={drawDisabled}
          activeOpacity={0.7}
        >
          <Text
            style={[ctStyles.pileLabel, { color: isDark ? "#666" : "#AAA" }]}
          >
            Draw ({state.drawPileCount})
          </Text>
          <View
            style={[ctStyles.drawPile, { opacity: drawDisabled ? 0.5 : 1 }]}
          >
            <CardBack width={CARD_W} height={CARD_H} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Micro log — human-readable action ribbon */}
      {state.lastMove && (
        <View
          style={[
            ctStyles.microLog,
            {
              backgroundColor: isDark
                ? "rgba(26,26,46,0.9)"
                : "rgba(255,248,225,0.95)",
            },
          ]}
        >
          <Text
            style={[
              ctStyles.microLogText,
              { color: isDark ? "#FFD700" : "#E65100" },
            ]}
            numberOfLines={1}
          >
            {formatMicroLog(state.lastMove, playerNames)}
          </Text>
        </View>
      )}
    </View>
  );
}

const ctStyles = StyleSheet.create({
  area: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
  },
  dirRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 4,
  },
  dirText: {
    fontSize: 10,
  },
  pilesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  pile: {
    alignItems: "center",
  },
  pileLabel: {
    fontSize: 9,
    marginBottom: 3,
    fontWeight: "600",
  },
  stackBadge: {
    position: "absolute",
    top: 6,
    right: -10,
    backgroundColor: "#E74C3C",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 10,
  },
  stackBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
  },
  drawPile: {
    alignItems: "center",
    justifyContent: "center",
  },
  microLog: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: SCREEN_WIDTH - 40,
  },
  microLogText: {
    fontSize: 10,
    fontWeight: "600",
  },
});

// =============================================================================
// Challenge Banner
// =============================================================================

interface ChallengeBannerProps {
  state: CrazyEightsPublicState;
  myUid: string;
  onChallenge: () => void;
  onAccept: () => void;
  isDark: boolean;
  actionLoading: boolean;
}

function ChallengeBanner({
  state,
  myUid,
  onChallenge,
  onAccept,
  isDark,
  actionLoading,
}: ChallengeBannerProps) {
  if (!state.challengeWindow?.active) return null;
  const isTarget = state.challengeWindow.targetUid === myUid;

  if (!isTarget) {
    return (
      <View
        style={[
          chStyles.banner,
          { backgroundColor: isDark ? "#2A1A2E" : "#F3E5F5" },
        ]}
      >
        <MaterialCommunityIcons name="gavel" size={16} color="#AF52DE" />
        <Text
          style={[chStyles.text, { color: isDark ? "#CE93D8" : "#7B1FA2" }]}
        >
          Wild +4 challenge in progress...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        chStyles.banner,
        { backgroundColor: isDark ? "#2A1A2E" : "#F3E5F5" },
      ]}
    >
      <MaterialCommunityIcons name="gavel" size={16} color="#AF52DE" />
      <Text style={[chStyles.text, { color: isDark ? "#CE93D8" : "#7B1FA2" }]}>
        Wild +4! Challenge or accept?
      </Text>
      <View style={chStyles.row}>
        <TouchableOpacity
          style={[chStyles.btn, { backgroundColor: "#FF3B30" }]}
          onPress={onChallenge}
          disabled={actionLoading}
        >
          <Text style={chStyles.btnText}>Challenge</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[chStyles.btn, { backgroundColor: "#34C759" }]}
          onPress={onAccept}
          disabled={actionLoading}
        >
          <Text style={chStyles.btnText}>Accept +4</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const chStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 12,
    borderRadius: 10,
  },
  text: { fontSize: 12, fontWeight: "600", flex: 1 },
  row: { flexDirection: "row", gap: 6 },
  btn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  btnText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
});

// =============================================================================
// Player Hand (inside BottomDock)
// =============================================================================

interface PlayerHandProps {
  hand: Card[];
  selectedCardId: string | null;
  onCardPress: (cardId: string) => void;
  currentColor: CardColor;
  disabled: boolean;
  /** When set, only cards in this set are interactive & full opacity. */
  playableCardIds?: Set<string>;
  /** True when it's the local player's turn. */
  isMyTurn: boolean;
}

const PlayerHand = React.memo(function PlayerHand({
  hand,
  selectedCardId,
  onCardPress,
  currentColor,
  disabled,
  playableCardIds,
  isMyTurn,
}: PlayerHandProps) {
  const maxVisible = Math.floor((SCREEN_WIDTH - 32) / (CARD_W * 0.55));
  const overlap =
    hand.length > maxVisible ? Math.max(20, CARD_W * 0.55) : CARD_W + 4;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={phStyles.container}
    >
      {hand.map((card, idx) => {
        const isPlayable =
          !isMyTurn || !playableCardIds || playableCardIds.has(card.id);
        const cardDisabled = disabled || (isMyTurn && !isPlayable);
        const cardOpacity =
          isMyTurn && playableCardIds && !isPlayable ? 0.38 : 1;

        return (
          <View
            key={card.id}
            style={{
              marginLeft: idx === 0 ? 0 : -Math.max(0, CARD_W - overlap),
              zIndex: selectedCardId === card.id ? 100 : idx,
              opacity: cardOpacity,
            }}
          >
            <CardView
              card={card}
              selected={selectedCardId === card.id}
              onPress={() => onCardPress(card.id)}
              disabled={cardDisabled}
              currentColor={currentColor}
            />
          </View>
        );
      })}
    </ScrollView>
  );
});

const phStyles = StyleSheet.create({
  container: {
    alignItems: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
});

// =============================================================================
// Color Picker Modal
// =============================================================================

interface ColorPickerProps {
  visible: boolean;
  onSelect: (color: CardColor) => void;
  onCancel: () => void;
  isDark: boolean;
}

function ColorPicker({
  visible,
  onSelect,
  onCancel,
  isDark,
}: ColorPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={cpStyles.overlay}>
        <View
          style={[
            cpStyles.sheet,
            { backgroundColor: isDark ? "#1A1A2E" : "#FFF" },
          ]}
        >
          <Text style={[cpStyles.title, { color: isDark ? "#FFF" : "#333" }]}>
            Choose a Color
          </Text>
          <View style={cpStyles.row}>
            {ALL_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[cpStyles.btn, { backgroundColor: COLOR_MAP[c] }]}
                onPress={() => onSelect(c)}
              >
                <Text style={cpStyles.btnLabel}>{COLOR_NAMES[c]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={cpStyles.cancel} onPress={onCancel}>
            <Text style={{ color: isDark ? "#888" : "#999", fontSize: 14 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  btnLabel: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  cancel: { paddingVertical: 8 },
});

// =============================================================================
// Spectator View
// =============================================================================

interface SpectatorViewProps {
  state: CrazyEightsPublicState;
  isDark: boolean;
  primaryColor: string;
  playerNames: Record<string, string>;
}

function SpectatorViewContent({
  state,
  isDark,
  primaryColor,
  playerNames,
}: SpectatorViewProps) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={spStyles.container}>
      <Text style={[spStyles.title, { color: primaryColor }]}>
        📺 Spectating Crazy 8&apos;s
      </Text>
      <View style={spStyles.players}>
        {state.turnOrder.map((uid) => (
          <View
            key={uid}
            style={[
              spStyles.row,
              {
                backgroundColor:
                  state.currentTurnUid === uid
                    ? primaryColor + "20"
                    : isDark
                      ? "#1A1A2E"
                      : "#F5F5F5",
                borderColor:
                  state.currentTurnUid === uid ? primaryColor : "transparent",
              },
            ]}
          >
            <Text
              style={[
                spStyles.name,
                {
                  color:
                    state.currentTurnUid === uid
                      ? primaryColor
                      : isDark
                        ? "#CCC"
                        : "#333",
                },
              ]}
            >
              {playerNames[uid] ?? "Player"}
              {state.currentTurnUid === uid ? " 🔴" : ""}
            </Text>
            <Text style={{ color: isDark ? "#AAA" : "#666" }}>
              {state.handCounts[uid] ?? 0} cards
            </Text>
          </View>
        ))}
      </View>
      <CenterArea
        state={state}
        isDark={isDark}
        onDrawPress={() => {}}
        drawDisabled
      />
      <View
        style={[
          spStyles.roundInfo,
          { backgroundColor: isDark ? "#1A1A2E" : "#F5F5F5" },
        ]}
      >
        <Text style={{ color: isDark ? "#CCC" : "#333", fontWeight: "600" }}>
          Round {state.roundNumber} | Turn {state.turnCounter}
        </Text>
      </View>
    </ScrollView>
  );
}

const spStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  players: { width: "100%", gap: 6, marginBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  name: { fontSize: 14, fontWeight: "600", flex: 1 },
  roundInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
});

// =============================================================================
// Round Over Overlay
// =============================================================================

interface RoundOverProps {
  state: CrazyEightsPublicState;
  isDark: boolean;
  primaryColor: string;
  playerNames: Record<string, string>;
}

function RoundOverOverlay({
  state,
  isDark,
  primaryColor,
  playerNames,
}: RoundOverProps) {
  if (!state.resolved) return null;
  const winnerName = playerNames[state.resolved.winnerUid] ?? "Player";

  return (
    <View
      style={[
        roStyles.overlay,
        { backgroundColor: isDark ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.7)" },
      ]}
    >
      <View
        style={[
          roStyles.card,
          { backgroundColor: isDark ? "#1A1A2E" : "#FFF" },
        ]}
      >
        <Text style={[roStyles.title, { color: primaryColor }]}>
          {state.phase === "match_over" ? "🏆 Match Over!" : "Hand Complete!"}
        </Text>
        <Text style={[roStyles.winner, { color: isDark ? "#FFF" : "#333" }]}>
          Winner: {winnerName}
        </Text>
        <Text style={{ color: isDark ? "#888" : "#999", marginTop: 4 }}>
          {state.resolved.reason}
        </Text>
        {state.resolved.roundScores && (
          <View style={roStyles.table}>
            {state.turnOrder.map((uid) => (
              <View key={uid} style={roStyles.scoreRow}>
                <Text style={{ color: isDark ? "#CCC" : "#333", flex: 1 }}>
                  {playerNames[uid] ?? "Player"}
                </Text>
                <Text style={{ color: isDark ? "#AAA" : "#666" }}>
                  +{state.resolved!.roundScores[uid] ?? 0} pts
                </Text>
                <Text
                  style={{
                    color: primaryColor,
                    fontWeight: "700",
                    marginLeft: 12,
                  }}
                >
                  Total: {state.scores[uid] ?? 0}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const roStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  card: {
    width: SCREEN_WIDTH * 0.85,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  winner: { fontSize: 16, fontWeight: "600" },
  table: { width: "100%", marginTop: 16, gap: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center" },
});

// =============================================================================
// Main Crazy 8's UI — Wrapped by GameScreenShell
// =============================================================================

function CrazyEightsUI({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  currentTurnIndex,
  settings,
  submitMove,
  resign,
  actionLoading,
  actionError,
  sessionId,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const primaryColor = theme.colors.primary;
  const insets = useSafeAreaInsets();
  const state = asState(publicState);
  const playerNames = usePlayerNames(turnOrder, myUid);

  // ── Private state subscription ──
  const [privateState, setPrivateState] =
    useState<CrazyEightsPrivateState | null>(null);

  useEffect(() => {
    if (!sessionId || !myUid) return;
    if (!turnOrder.includes(myUid)) return;
    const unsub = subscribeToPrivateState(
      sessionId,
      myUid,
      (raw) => setPrivateState(asPrivate(raw)),
      (err) => console.warn("[CrazyEights] private state error:", err.message),
    );
    return unsub;
  }, [sessionId, myUid, turnOrder]);

  // ── Local UI state ──
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hand = privateState?.hand ?? [];
  const isSpectator = !turnOrder.includes(myUid);

  // Use the shell's isMyTurn (centralised, includes optimistic turn-advance).
  // Previously this was overridden locally via state.currentTurnUid — that
  // created a second source of truth that raced with the session subscription.
  const actualIsMyTurn = isMyTurn && !isTerminal;

  // ── Playable card computation ──
  const playableResult = useMemo(() => {
    if (!state || !actualIsMyTurn || hand.length === 0) return null;
    return computePlayableCards(
      hand,
      state.currentColor,
      state.topDiscard,
      state.settings,
      state.pendingDraw,
    );
  }, [state, actualIsMyTurn, hand]);

  const playableCardIds = playableResult?.playableIds ?? undefined;

  // Auto-deselect if the selected card becomes unplayable (e.g. snapshot update)
  useEffect(() => {
    if (
      selectedCardId &&
      playableCardIds &&
      actualIsMyTurn &&
      !playableCardIds.has(selectedCardId)
    ) {
      stateTrace("auto-deselect", {
        reason: "selected_card_no_longer_playable",
        cardId: selectedCardId,
      });
      setSelectedCardId(null);
    }
  }, [selectedCardId, playableCardIds, actualIsMyTurn]);

  // ── Structured logging: state snapshot changes ──
  useEffect(() => {
    if (!state) return;
    stateTrace("snapshot", {
      currentTurnUid: state.currentTurnUid,
      turnCounter: state.turnCounter,
      moveCount: state.moveCount,
      phase: state.phase,
      lastMove: state.lastMove,
      actualIsMyTurn,
      isMyTurnFromShell: isMyTurn,
      handSize: hand.length,
      playableCount: playableCardIds?.size ?? 0,
    });
  }, [
    state?.currentTurnUid,
    state?.turnCounter,
    state?.moveCount,
    state?.phase,
    actualIsMyTurn,
    isMyTurn,
    hand.length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    playableCardIds?.size,
  ]);

  // ── Card Play Logic ──

  const handleCardPress = useCallback(
    (cardId: string) => {
      if (!actualIsMyTurn || actionLoading || isSubmitting) return;

      // If it's our turn, only allow selecting playable cards
      if (playableCardIds && !playableCardIds.has(cardId)) {
        moveTrace("card-tap-blocked", {
          cardId,
          reason: "unplayable",
          hint: playableResult?.reasonById[cardId],
        });
        return;
      }

      moveTrace("card-tap", {
        cardId,
        isPlayable: true,
        reason: playableResult?.reasonById[cardId] ?? "unknown",
      });

      Haptics.selection();
      setSelectedCardId((prev) => (prev === cardId ? null : cardId));
    },
    [
      actualIsMyTurn,
      actionLoading,
      isSubmitting,
      playableCardIds,
      playableResult,
    ],
  );

  const handlePlaySelected = useCallback(async () => {
    if (!selectedCardId || !state || !actualIsMyTurn || isSubmitting) return;
    const card = hand.find((c) => c.id === selectedCardId);
    if (!card) return;

    if (card.type === "wild" || card.type === "wild_draw_four") {
      setPendingWildCardId(selectedCardId);
      setColorPickerVisible(true);
      return;
    }

    const traceId = nextTraceId();
    moveTrace("play-card", {
      traceId,
      cardId: selectedCardId,
      cardType: card.type,
      cardColor: card.color,
      believedTurnUid: state.currentTurnUid,
      turnCounter: state.turnCounter,
      handSize: hand.length,
    });

    Haptics.medium();
    const willHaveOne = hand.length === 2;
    setIsSubmitting(true);
    try {
      const success = await submitMove({
        action: "PLAY_CARD",
        cardId: selectedCardId,
        callCrazy: willHaveOne,
      });
      moveTrace("play-card-result", { traceId, success });
      if (success) setSelectedCardId(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCardId, state, actualIsMyTurn, isSubmitting, hand, submitMove]);

  // Tap discard pile to confirm the selected card
  const handleDiscardTap = useCallback(() => {
    if (!selectedCardId || !actualIsMyTurn || isSubmitting) {
      // No card selected — hint the player
      if (!selectedCardId && actualIsMyTurn) {
        Haptics.warning();
        moveTrace("discard-tap-hint", { reason: "no_card_selected" });
      }
      return;
    }
    // Delegate to the existing play logic (handles wilds + normal cards)
    handlePlaySelected();
  }, [selectedCardId, actualIsMyTurn, isSubmitting, handlePlaySelected]);

  const handleColorSelected = useCallback(
    async (color: CardColor) => {
      setColorPickerVisible(false);
      if (!pendingWildCardId) return;

      const traceId = nextTraceId();
      moveTrace("play-wild", {
        traceId,
        cardId: pendingWildCardId,
        declaredColor: color,
        believedTurnUid: state?.currentTurnUid,
      });

      Haptics.medium();
      const willHaveOne = hand.length === 2;
      setIsSubmitting(true);
      try {
        const success = await submitMove({
          action: "PLAY_CARD",
          cardId: pendingWildCardId,
          declaredColor: color,
          callCrazy: willHaveOne,
        });
        moveTrace("play-wild-result", { traceId, success });
        if (success) {
          setSelectedCardId(null);
          setPendingWildCardId(null);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [pendingWildCardId, hand, submitMove, state?.currentTurnUid],
  );

  const handleDraw = useCallback(async () => {
    if (!actualIsMyTurn || actionLoading || isSubmitting) return;
    const traceId = nextTraceId();
    moveTrace("draw-card", { traceId, believedTurnUid: state?.currentTurnUid });
    Haptics.light();
    setIsSubmitting(true);
    try {
      await submitMove({ action: "DRAW_CARD" });
      moveTrace("draw-card-done", { traceId });
    } finally {
      setIsSubmitting(false);
    }
    setSelectedCardId(null);
  }, [
    actualIsMyTurn,
    actionLoading,
    isSubmitting,
    submitMove,
    state?.currentTurnUid,
  ]);

  const handlePass = useCallback(async () => {
    if (!actualIsMyTurn || actionLoading || isSubmitting) return;
    const traceId = nextTraceId();
    moveTrace("pass", { traceId, believedTurnUid: state?.currentTurnUid });
    Haptics.light();
    setIsSubmitting(true);
    try {
      await submitMove({ action: "PASS" });
      moveTrace("pass-done", { traceId });
    } finally {
      setIsSubmitting(false);
    }
    setSelectedCardId(null);
  }, [
    actualIsMyTurn,
    actionLoading,
    isSubmitting,
    submitMove,
    state?.currentTurnUid,
  ]);

  const handleCatchNoCrazy = useCallback(async () => {
    if (actionLoading || isSubmitting || !state?.callEligibleUid) return;
    await submitMove({
      action: "CATCH_NO_CRAZY",
      targetUid: state.callEligibleUid,
    });
  }, [actionLoading, isSubmitting, state, submitMove]);

  const handleChallengeWild4 = useCallback(async () => {
    if (actionLoading || isSubmitting) return;
    await submitMove({
      action: "CHALLENGE_WILD4",
      challengeAction: "challenge",
    });
  }, [actionLoading, isSubmitting, submitMove]);

  const handleAcceptWild4 = useCallback(async () => {
    if (actionLoading || isSubmitting) return;
    await submitMove({
      action: "CHALLENGE_WILD4",
      challengeAction: "accept",
    });
  }, [actionLoading, isSubmitting, submitMove]);

  // ── Render ──

  if (!state) {
    return (
      <View style={[ms.container, { backgroundColor: CRAZY8_BG }]}>
        <Text
          style={{ color: primaryColor, textAlign: "center", marginTop: 60 }}
        >
          Loading...
        </Text>
      </View>
    );
  }

  if (isSpectator) {
    return (
      <View style={[ms.container, { backgroundColor: CRAZY8_BG }]}>
        <SpectatorViewContent
          state={state}
          isDark={isDark}
          primaryColor={primaryColor}
          playerNames={playerNames}
        />
      </View>
    );
  }

  const canPass = privateState?.hasDrawnThisTurn === true && actualIsMyTurn;
  const canDraw = actualIsMyTurn && !state.challengeWindow?.active;
  const canCatch =
    state.callEligibleUid != null &&
    state.callEligibleUid !== myUid &&
    !state.calledCrazy[state.callEligibleUid];

  const bottomDockH = HAND_TRAY_H + TURN_FOOTER_H + insets.bottom;
  const turnName =
    state.currentTurnUid === myUid
      ? "You"
      : (playerNames[state.currentTurnUid] ?? "Player");

  return (
    <View style={[ms.container, { backgroundColor: CRAZY8_BG }]}>
      {/* ========== TABLE AREA (fills space above bottom dock) ========== */}
      <View style={[ms.tableArea, { paddingBottom: bottomDockH }]}>
        {/* Opponents */}
        <OpponentsArea
          state={state}
          myUid={myUid}
          playerNames={playerNames}
          isDark={isDark}
          primaryColor={primaryColor}
        />

        {/* Challenge Banner */}
        <ChallengeBanner
          state={state}
          myUid={myUid}
          onChallenge={handleChallengeWild4}
          onAccept={handleAcceptWild4}
          isDark={isDark}
          actionLoading={actionLoading}
        />

        {/* Center: Piles + Log */}
        <CenterArea
          state={state}
          isDark={isDark}
          onDrawPress={handleDraw}
          drawDisabled={!canDraw}
          onDiscardPress={handleDiscardTap}
          discardDisabled={!selectedCardId || !actualIsMyTurn || isSubmitting}
          playerNames={playerNames}
        />

        {/* Inline action buttons (Catch, Pass) above the dock */}
        {(canPass || canCatch) && (
          <View style={ms.inlineActions}>
            {canPass && (
              <TouchableOpacity
                style={[ms.actionBtn, { backgroundColor: "#FF9500" }]}
                onPress={handlePass}
                disabled={actionLoading}
              >
                <MaterialCommunityIcons
                  name="skip-next"
                  size={16}
                  color="#FFF"
                />
                <Text style={ms.actionBtnText}>Pass</Text>
              </TouchableOpacity>
            )}
            {canCatch && (
              <TouchableOpacity
                style={[ms.actionBtn, { backgroundColor: "#FF3B30" }]}
                onPress={handleCatchNoCrazy}
                disabled={actionLoading}
              >
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={16}
                  color="#FFF"
                />
                <Text style={ms.actionBtnText}>Catch!</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ========== BOTTOM DOCK (absolute, no reflow) ========== */}
      <View
        style={[
          ms.bottomDock,
          {
            paddingBottom: insets.bottom,
            backgroundColor: isDark ? "#2A1015" : "#F5E0E3",
            borderTopColor: isDark ? "#4A2028" : "#D8B0B5",
          },
        ]}
      >
        {/* Hand Tray (fixed height) */}
        <View style={ms.handTray}>
          <PlayerHand
            hand={hand}
            selectedCardId={selectedCardId}
            onCardPress={handleCardPress}
            currentColor={state.currentColor}
            disabled={
              !actualIsMyTurn || !!state.challengeWindow?.active || isSubmitting
            }
            playableCardIds={playableCardIds}
            isMyTurn={actualIsMyTurn}
          />
        </View>

        {/* Tap-discard hint when a card is selected */}
        {!!selectedCardId && actualIsMyTurn && !isSubmitting && (
          <View style={ms.discardHint}>
            <Text style={ms.discardHintText}>Tap discard pile to play</Text>
          </View>
        )}

        {/* Turn Footer — thin bar at the very bottom */}
        <View
          style={[
            ms.turnFooter,
            {
              backgroundColor: isSubmitting
                ? "#FF9500"
                : actualIsMyTurn
                  ? "#34C759"
                  : isDark
                    ? "#181828"
                    : "#E8E8ED",
            },
          ]}
        >
          <Text
            style={[
              ms.turnFooterText,
              {
                color:
                  isSubmitting || actualIsMyTurn
                    ? "#FFF"
                    : isDark
                      ? "#AAA"
                      : "#666",
              },
            ]}
          >
            {isSubmitting
              ? "Submitting…"
              : actualIsMyTurn
                ? state.challengeWindow?.active &&
                  state.challengeWindow.targetUid === myUid
                  ? "Wild +4 — Challenge or Accept?"
                  : "Your Turn"
                : `${turnName}'s Turn`}
          </Text>
          <Text
            style={[
              ms.turnFooterMeta,
              {
                color: actualIsMyTurn
                  ? "rgba(255,255,255,0.7)"
                  : isDark
                    ? "#555"
                    : "#AAA",
              },
            ]}
          >
            Round {state.roundNumber} · {hand.length} cards
          </Text>
        </View>
      </View>

      {/* ========== Error banner ========== */}
      {actionError && (
        <View style={ms.errorBanner}>
          <Text style={ms.errorText}>{actionError}</Text>
        </View>
      )}

      {/* ========== Round over overlay ========== */}
      {(state.phase === "round_over" || state.phase === "match_over") && (
        <RoundOverOverlay
          state={state}
          isDark={isDark}
          primaryColor={primaryColor}
          playerNames={playerNames}
        />
      )}

      {/* ========== Color picker ========== */}
      <ColorPicker
        visible={colorPickerVisible}
        onSelect={handleColorSelected}
        onCancel={() => {
          setColorPickerVisible(false);
          setPendingWildCardId(null);
        }}
        isDark={isDark}
      />
    </View>
  );
}

// =============================================================================
// Main Styles
// =============================================================================

const ms = StyleSheet.create({
  container: {
    flex: 1,
  },
  tableArea: {
    flex: 1,
  },
  inlineActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 4,
  },
  actionBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  bottomDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  handTray: {
    height: HAND_TRAY_H,
    justifyContent: "center",
  },
  discardHint: {
    position: "absolute",
    top: 4,
    right: 16,
    zIndex: 50,
    backgroundColor: "rgba(52,199,89,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  discardHintText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  turnFooter: {
    height: TURN_FOOTER_H,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  turnFooterText: {
    fontSize: 13,
    fontWeight: "700",
  },
  turnFooterMeta: {
    fontSize: 10,
  },
  errorBanner: {
    position: "absolute",
    bottom: 180,
    left: 20,
    right: 20,
    backgroundColor: "#FF3B30",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    zIndex: 100,
  },
  errorText: {
    color: "#FFF",
    fontSize: 12,
    textAlign: "center",
  },
});

// =============================================================================
// Export — wrapped with GameV4Shell
// =============================================================================

export default withGameV4Shell(CrazyEightsUI, "crazy_eights");
