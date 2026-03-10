/**
 * Games V4 — Hex Game Screen (Premium Polish)
 *
 * A premium, mobile-first abstract strategy board experience:
 *
 * Layout zones:
 *   1. Top HUD — TurnStatusCard with refined player capsules
 *   2. Player objective strip — color + goal at a glance
 *   3. Board hero — SVG hex grid on deep graphite slab with edge rails
 *   4. Bottom bar — move count + info button + notices
 *
 * Visual design: "calm midnight strategy board"
 *   - Deep graphite board surface with subtle frame depth
 *   - Proper pointy-top hexagonal SVG cells
 *   - Red/Blue stones with gradient feel + inner highlight
 *   - Colored edge rails marking each player's connection goal
 *   - Last-move soft gold ring
 *   - Win-path golden glow cascade
 *   - Premium swap decision sheet with clear actions
 *   - Compact help/info modal for new players
 *
 * Animation: Core RN Animated API only, native-driver safe.
 * Theme: Catppuccin dark alignment via useAppTheme.
 *
 * @module gamesV4/screens/HexScreenV4
 */

import { BorderRadius, Elevation, FontSizes, Spacing } from "@/constants/theme";
import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import {
  BoardTray,
  InlineNotice,
  TurnStatusCard,
} from "@/gamesV4/components/turnBased";
import type { PlayerChipProps } from "@/gamesV4/components/turnBased/PlayerChip";
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
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle as SvgCircle,
  Polygon as SvgPolygon,
} from "react-native-svg";

// =============================================================================
// Types (mirrors adapter state shape)
// =============================================================================

type HexCell = null | "red" | "blue";
type HexPhase = "opening" | "swap_pending" | "main" | "resolved";

interface HexPublicState {
  boardSize: 9;
  cells: HexCell[];
  phase: HexPhase;
  colorByUid: Record<string, "red" | "blue">;
  edgeGoalByColor: { red: "top_bottom"; blue: "left_right" };
  openingMoveIndex: number | null;
  swapDecision: "pending" | "kept" | "swapped" | null;
  moveCount: number;
  lastMove: { uid: string; color: "red" | "blue"; index: number } | null;
  winnerUid: string | null;
  winningPath: number[] | null;
}

// =============================================================================
// Design Tokens
// =============================================================================

const BOARD_SIZE = 9;

/** Player palette — saturated but readable strategy-game tones */
const P = {
  red: "#E55B4A",
  redStoneHighlight: "#F08070",
  blue: "#4A9BE5",
  blueStoneHighlight: "#70B0F0",
} as const;

/** Board surface palette */
const BOARD = {
  surfaceDark: "#12121E",
  frameDark: "#0C0C16",
  surfaceLight: "#EAEAF0",
  frameLight: "#D4D4DC",
  cellDark: "rgba(255,255,255,0.06)",
  cellStrokeDark: "rgba(255,255,255,0.10)",
  cellLight: "rgba(0,0,0,0.03)",
  cellStrokeLight: "rgba(0,0,0,0.08)",
  cellPressDark: "rgba(255,255,255,0.14)",
  cellPressLight: "rgba(0,0,0,0.08)",
  lastGlow: "#FFD54F",
  winGlow: "#FFD700",
} as const;

/** Win / loss colors matching system pattern */
const RESULT = { win: "#34C759", loss: "#FF3B30" } as const;

/** Timing (ms) */
const T = {
  lastPulse: 900,
  winGlow: 800,
  swapFade: 300,
} as const;

// =============================================================================
// Responsive Layout — pointy-top hexagon geometry
// =============================================================================

const SCREEN_W = Dimensions.get("window").width;

function computeLayout() {
  const edgePad = 24;
  const railW = 4;
  const maxBoardW = SCREEN_W - edgePad * 2 - railW * 2 - 12;
  const effectiveCols = BOARD_SIZE + (BOARD_SIZE - 1) * 0.5;
  const sqr3 = Math.sqrt(3);
  const r = Math.min(Math.floor(maxBoardW / (effectiveCols * sqr3)), 18);
  const radius = Math.max(r, 12);
  const hexW = sqr3 * radius;
  const hexH = 2 * radius;
  const horizSpacing = hexW;
  const vertSpacing = hexH * 0.75;
  const boardW =
    (BOARD_SIZE - 1) * horizSpacing +
    (BOARD_SIZE - 1) * horizSpacing * 0.5 +
    hexW;
  const boardH = (BOARD_SIZE - 1) * vertSpacing + hexH;
  return { radius, hexW, hexH, horizSpacing, vertSpacing, boardW, boardH };
}

const L = computeLayout();

/** Pointy-top hexagon vertices relative to center (0,0) */
function hexPoints(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(
      `${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return pts.join(" ");
}

const HEX_POINTS = hexPoints(L.radius);

/** Cell center in board-relative coordinates */
function cellCenter(index: number): { cx: number; cy: number } {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  return {
    cx: col * L.horizSpacing + row * L.horizSpacing * 0.5 + L.hexW / 2,
    cy: row * L.vertSpacing + L.hexH / 2,
  };
}

// =============================================================================
// HexCell (memoized)
// =============================================================================

interface HexCellProps {
  index: number;
  cell: HexCell;
  isLastMove: boolean;
  isWinPath: boolean;
  isTerminal: boolean;
  onPress: (index: number) => void;
  disabled: boolean;
  isDark: boolean;
}

const HexCellView = React.memo(function HexCellView({
  index,
  cell,
  isLastMove,
  isWinPath,
  isTerminal,
  onPress,
  disabled,
  isDark,
}: HexCellProps) {
  const scaleAnim = useRef(new Animated.Value(cell ? 1 : 0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevCell = useRef(cell);
  const [pressed, setPressed] = useState(false);

  // Stone pop-in
  useEffect(() => {
    if (cell && !prevCell.current) {
      scaleAnim.setValue(0.3);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 200,
        useNativeDriver: true,
      }).start();
    }
    prevCell.current = cell;
  }, [cell, scaleAnim]);

  // Win path glow
  useEffect(() => {
    if (isWinPath && isTerminal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: T.winGlow,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.35,
            duration: T.winGlow,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [isWinPath, isTerminal, glowAnim]);

  // Last move pulse
  useEffect(() => {
    if (isLastMove && !isTerminal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: T.lastPulse,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: T.lastPulse,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLastMove, isTerminal, pulseAnim]);

  const { cx, cy } = cellCenter(index);
  const tappable = !disabled && !cell;
  const stoneR = L.radius * 0.6;

  const cellFill = cell
    ? "transparent"
    : pressed && tappable
      ? isDark
        ? BOARD.cellPressDark
        : BOARD.cellPressLight
      : isDark
        ? BOARD.cellDark
        : BOARD.cellLight;
  const cellStroke = isDark ? BOARD.cellStrokeDark : BOARD.cellStrokeLight;
  const stoneFill =
    cell === "red" ? P.red : cell === "blue" ? P.blue : "transparent";
  const stoneHL =
    cell === "red"
      ? P.redStoneHighlight
      : cell === "blue"
        ? P.blueStoneHighlight
        : "transparent";

  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const a11y = cell
    ? `Row ${row + 1}, column ${col + 1}: ${cell} stone${isLastMove ? ", last move" : ""}${isWinPath && isTerminal ? ", winning path" : ""}`
    : `Row ${row + 1}, column ${col + 1}: empty`;

  return (
    <Pressable
      onPress={() => tappable && onPress(index)}
      onPressIn={() => tappable && setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || !!cell}
      hitSlop={Math.max(2, 22 - L.radius)}
      style={{
        position: "absolute",
        left: cx - L.hexW / 2 - 2,
        top: cy - L.hexH / 2 - 2,
        width: L.hexW + 4,
        height: L.hexH + 4,
        zIndex: cell ? 2 : 1,
      }}
      accessibilityLabel={a11y}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || !!cell }}
    >
      <Svg
        width={L.hexW + 4}
        height={L.hexH + 4}
        viewBox={`${-L.hexW / 2 - 2} ${-L.hexH / 2 - 2} ${L.hexW + 4} ${L.hexH + 4}`}
      >
        <SvgPolygon
          points={HEX_POINTS}
          fill={cellFill}
          stroke={cellStroke}
          strokeWidth={0.8}
        />
        {cell && (
          <>
            <SvgCircle cx={0} cy={0} r={stoneR} fill={stoneFill} />
            <SvgCircle
              cx={-stoneR * 0.2}
              cy={-stoneR * 0.25}
              r={stoneR * 0.42}
              fill={stoneHL}
              opacity={0.3}
            />
          </>
        )}
      </Svg>

      {/* Animated overlay for stone scale / glow / pulse */}
      {cell && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 2 + L.hexW / 2 - stoneR,
            top: 2 + L.hexH / 2 - stoneR,
            width: stoneR * 2,
            height: stoneR * 2,
            borderRadius: stoneR,
            transform: isLastMove
              ? [{ scale: pulseAnim }]
              : [{ scale: scaleAnim }],
          }}
        >
          {isLastMove && !isTerminal && (
            <View
              style={{
                position: "absolute",
                top: -2,
                left: -2,
                right: -2,
                bottom: -2,
                borderRadius: stoneR + 2,
                borderWidth: 2,
                borderColor: BOARD.lastGlow,
              }}
            />
          )}
          {isWinPath && isTerminal && (
            <Animated.View
              style={{
                position: "absolute",
                top: -4,
                left: -4,
                right: -4,
                bottom: -4,
                borderRadius: stoneR + 4,
                borderWidth: 2.5,
                borderColor: BOARD.winGlow,
                opacity: glowAnim,
              }}
            />
          )}
        </Animated.View>
      )}
    </Pressable>
  );
});

// =============================================================================
// Edge Rails
// =============================================================================

const EdgeRails = React.memo(function EdgeRails({
  isDark,
}: {
  isDark: boolean;
}) {
  const railW = 3;
  const railOff = L.radius + 2;
  const alpha = isDark ? 0.6 : 0.5;

  const rails = useMemo(() => {
    const top: { cx: number; cy: number }[] = [];
    const bot: { cx: number; cy: number }[] = [];
    const left: { cx: number; cy: number }[] = [];
    const right: { cx: number; cy: number }[] = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      top.push(cellCenter(i));
      bot.push(cellCenter((BOARD_SIZE - 1) * BOARD_SIZE + i));
      left.push(cellCenter(i * BOARD_SIZE));
      right.push(cellCenter(i * BOARD_SIZE + BOARD_SIZE - 1));
    }
    return { top, bot, left, right };
  }, []);

  const bar = (
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) => (
    <View
      key={key}
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: railW / 2,
        backgroundColor: color,
        opacity: alpha,
      }}
    />
  );

  const len = L.radius;

  return (
    <>
      {rails.top.map((p, i) =>
        bar(`rt${i}`, p.cx - len / 2, p.cy - railOff, len, railW, P.red),
      )}
      {rails.bot.map((p, i) =>
        bar(
          `rb${i}`,
          p.cx - len / 2,
          p.cy + railOff - railW,
          len,
          railW,
          P.red,
        ),
      )}
      {rails.left.map((p, i) =>
        bar(`bl${i}`, p.cx - railOff, p.cy - len / 2, railW, len, P.blue),
      )}
      {rails.right.map((p, i) =>
        bar(
          `br${i}`,
          p.cx + railOff - railW,
          p.cy - len / 2,
          railW,
          len,
          P.blue,
        ),
      )}
    </>
  );
});

// =============================================================================
// Player Objective Strip
// =============================================================================

interface ObjectiveStripProps {
  myColor: "red" | "blue" | null;
  opponentColor: "red" | "blue" | null;
  myName: string;
  opponentName: string;
  isMyTurn: boolean;
  isTerminal: boolean;
  isDark: boolean;
}

function PlayerObjectiveStrip({
  myColor,
  opponentColor,
  myName,
  opponentName,
  isMyTurn,
  isTerminal,
  isDark,
}: ObjectiveStripProps) {
  const goalText = (c: "red" | "blue" | null) =>
    c === "red"
      ? "Top \u2194 Bottom"
      : c === "blue"
        ? "Left \u2194 Right"
        : "\u2014";
  const dot = (c: "red" | "blue" | null) =>
    c === "red" ? P.red : c === "blue" ? P.blue : "#888";

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const txt1 = isDark ? "#cdd6f4" : "#222";
  const txt2 = isDark ? "rgba(205,214,244,0.6)" : "rgba(0,0,0,0.5)";

  const card = (
    name: string,
    color: "red" | "blue" | null,
    active: boolean,
    local: boolean,
  ) => {
    const border =
      active && !isTerminal
        ? { borderColor: dot(color), borderWidth: 1.5 }
        : {
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            borderWidth: 1,
          };
    return (
      <View
        style={[st.objCard, { backgroundColor: cardBg }, border]}
        accessibilityLabel={`${name}${local ? " (you)" : ""}, ${color ?? "unassigned"}, goal: ${goalText(color)}`}
      >
        <View style={st.objHeader}>
          <View style={[st.objDot, { backgroundColor: dot(color) }]} />
          <Text style={[st.objName, { color: txt1 }]} numberOfLines={1}>
            {name}
            {local ? " (you)" : ""}
          </Text>
        </View>
        <View style={st.objGoalRow}>
          <MaterialCommunityIcons
            name={color === "red" ? "swap-vertical" : "swap-horizontal"}
            size={12}
            color={txt2}
          />
          <Text style={[st.objGoalText, { color: txt2 }]}>
            {goalText(color)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={st.objStrip}>
      {card(myName, myColor, isMyTurn, true)}
      <Text style={[st.objVs, { color: txt2 }]}>vs</Text>
      {card(opponentName, opponentColor, !isMyTurn, false)}
    </View>
  );
}

// =============================================================================
// Swap Decision Sheet
// =============================================================================

interface SwapSheetProps {
  openingMoveIndex: number | null;
  onDecide: (choice: "keep" | "swap") => void;
  isDark: boolean;
  myColor: "red" | "blue";
  opponentName: string;
}

function SwapDecisionSheet({
  openingMoveIndex,
  onDecide,
  isDark,
  myColor,
  opponentName,
}: SwapSheetProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: T.swapFade,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: T.swapFade + 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const bg = isDark ? "#1a1a2e" : "#FFFFFF";
  const t1 = isDark ? "#cdd6f4" : "#1a1a2e";
  const t2 = isDark ? "rgba(205,214,244,0.6)" : "rgba(0,0,0,0.5)";
  const div = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const row =
    openingMoveIndex !== null
      ? Math.floor(openingMoveIndex / BOARD_SIZE) + 1
      : "?";
  const col =
    openingMoveIndex !== null ? (openingMoveIndex % BOARD_SIZE) + 1 : "?";

  const keepC = myColor === "red" ? P.red : P.blue;
  const swapC = myColor === "red" ? P.blue : P.red;

  return (
    <Animated.View style={[st.swapOverlay, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          st.swapCard,
          { backgroundColor: bg, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={st.swapHeader}>
          <MaterialCommunityIcons
            name="swap-horizontal-circle-outline"
            size={28}
            color={t1}
          />
          <Text style={[st.swapTitle, { color: t1 }]}>Opening Decision</Text>
        </View>

        <Text style={[st.swapDesc, { color: t2 }]}>
          {opponentName} placed the first stone at row {row}, column {col}. You
          may keep your current colors or swap sides.
        </Text>

        <View style={[st.swapDiv, { backgroundColor: div }]} />

        {/* Keep */}
        <Pressable
          style={({ pressed }) => [
            st.swapOpt,
            {
              backgroundColor: pressed
                ? isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)"
                : "transparent",
            },
          ]}
          onPress={() => {
            Haptics.medium();
            onDecide("keep");
          }}
          accessibilityLabel="Keep colors. Stay with current assignment and take the next move."
          accessibilityRole="button"
        >
          <View style={st.swapOptHead}>
            <View style={[st.swapOptDot, { backgroundColor: keepC }]} />
            <Text style={[st.swapOptTitle, { color: t1 }]}>Keep Colors</Text>
          </View>
          <Text style={[st.swapOptCaption, { color: t2 }]}>
            Stay{" "}
            {myColor === "red"
              ? "Red (Top \u2194 Bottom)"
              : "Blue (Left \u2194 Right)"}
            . You take the next normal move.
          </Text>
        </Pressable>

        <View style={[st.swapDiv, { backgroundColor: div }]} />

        {/* Swap */}
        <Pressable
          style={({ pressed }) => [
            st.swapOpt,
            {
              backgroundColor: pressed
                ? isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)"
                : "transparent",
            },
          ]}
          onPress={() => {
            Haptics.medium();
            onDecide("swap");
          }}
          accessibilityLabel="Swap sides. Take over the opening stone and flip color roles."
          accessibilityRole="button"
        >
          <View style={st.swapOptHead}>
            <View style={[st.swapOptDot, { backgroundColor: swapC }]} />
            <Text style={[st.swapOptTitle, { color: t1 }]}>Swap Sides</Text>
          </View>
          <Text style={[st.swapOptCaption, { color: t2 }]}>
            Become{" "}
            {myColor === "red"
              ? "Blue (Left \u2194 Right)"
              : "Red (Top \u2194 Bottom)"}
            . Take over the opening position.
          </Text>
        </Pressable>

        <View style={[st.swapFooter, { borderTopColor: div }]}>
          <MaterialCommunityIcons
            name="information-outline"
            size={14}
            color={t2}
          />
          <Text style={[st.swapFooterText, { color: t2 }]}>
            One-time decision to balance first-move advantage.
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// =============================================================================
// Help Modal
// =============================================================================

function HexHelpModal({
  visible,
  onClose,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
}) {
  const bg = isDark ? "#1a1a2e" : "#FFFFFF";
  const t1 = isDark ? "#cdd6f4" : "#1a1a2e";
  const t2 = isDark ? "rgba(205,214,244,0.6)" : "rgba(0,0,0,0.5)";
  const div = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const tipBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={st.helpOvr} onPress={onClose}>
        <Pressable
          style={[st.helpCard, { backgroundColor: bg }]}
          onPress={() => {}}
        >
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={st.helpHead}>
              <MaterialCommunityIcons
                name="hexagon-outline"
                size={24}
                color={t1}
              />
              <Text style={[st.helpTitle, { color: t1 }]}>How to Play Hex</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={st.helpX}
                accessibilityLabel="Close help"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="close" size={20} color={t2} />
              </Pressable>
            </View>

            <View style={[st.helpSec, { borderBottomColor: div }]}>
              <Text style={[st.helpSecTitle, { color: t1 }]}>Goal</Text>
              <Text style={[st.helpBody, { color: t2 }]}>
                Connect your two edges with an unbroken chain of stones.
              </Text>
              <View style={st.helpGoals}>
                <View style={st.helpGoalRow}>
                  <View style={[st.helpGoalDot, { backgroundColor: P.red }]} />
                  <Text style={[st.helpGoalTxt, { color: t2 }]}>
                    Red connects Top \u2194 Bottom
                  </Text>
                </View>
                <View style={st.helpGoalRow}>
                  <View style={[st.helpGoalDot, { backgroundColor: P.blue }]} />
                  <Text style={[st.helpGoalTxt, { color: t2 }]}>
                    Blue connects Left \u2194 Right
                  </Text>
                </View>
              </View>
            </View>

            <View style={[st.helpSec, { borderBottomColor: div }]}>
              <Text style={[st.helpSecTitle, { color: t1 }]}>Swap Rule</Text>
              <Text style={[st.helpBody, { color: t2 }]}>
                After the very first stone, the second player may swap colors.
                This balances the first-move advantage.
              </Text>
            </View>

            <View style={st.helpSecLast}>
              <Text style={[st.helpSecTitle, { color: t1 }]}>Tips</Text>
              {(
                [
                  [
                    "bridge" as const,
                    "Build bridges \u2014 two stones separated by one gap form a virtual connection that can\u2019t be cut.",
                  ],
                  [
                    "shield-outline" as const,
                    "Control the center early. Center stones connect to more neighbors and create flexibility.",
                  ],
                  [
                    "wall" as const,
                    "Block your opponent\u2019s strongest path while extending your own connection.",
                  ],
                  [
                    "scale-balance" as const,
                    "Swap rule: if the first move is central, consider swapping. Peripheral moves are usually safe to keep.",
                  ],
                ] as const
              ).map(([icon, text], i) => (
                <View key={i} style={[st.helpTip, { backgroundColor: tipBg }]}>
                  <MaterialCommunityIcons name={icon} size={16} color={t2} />
                  <Text style={[st.helpTipTxt, { color: t2 }]}>{text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// Win Banner
// =============================================================================

function WinBanner({
  winnerUid,
  myUid,
  winnerColor,
  isDark,
}: {
  winnerUid: string | null;
  myUid: string;
  winnerColor: "red" | "blue" | null;
  isDark: boolean;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 400,
      delay: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  if (!winnerUid) return null;
  const isMe = winnerUid === myUid;
  const goal =
    winnerColor === "red" ? "Top \u2194 Bottom" : "Left \u2194 Right";
  const t1 = isDark ? "#cdd6f4" : "#1a1a2e";

  return (
    <Animated.View
      style={[st.winBanner, { opacity: fade }]}
      accessibilityLabel={isMe ? "You win! Connection complete." : "You lost."}
    >
      <Text style={[st.winTitle, { color: isMe ? RESULT.win : RESULT.loss }]}>
        {isMe ? "Connection Complete" : "Opponent Connected"}
      </Text>
      <Text style={[st.winSub, { color: t1 }]}>
        {winnerColor === "red" ? "Red" : "Blue"} connected {goal}
      </Text>
    </Animated.View>
  );
}

// =============================================================================
// Bottom Helper Bar
// =============================================================================

function BottomHelperBar({
  moveCount,
  onInfoPress,
  isDark,
}: {
  moveCount: number;
  onInfoPress: () => void;
  isDark: boolean;
}) {
  const muted = isDark ? "rgba(205,214,244,0.4)" : "rgba(0,0,0,0.35)";
  return (
    <View style={st.botBar}>
      <Text
        style={[st.botMove, { color: muted }]}
        accessibilityLabel={`Move ${moveCount}`}
      >
        Move {moveCount}
      </Text>
      <Pressable
        onPress={() => {
          Haptics.light();
          onInfoPress();
        }}
        hitSlop={12}
        style={st.botInfo}
        accessibilityLabel="Game rules and tips"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color={muted}
        />
      </Pressable>
    </View>
  );
}

// =============================================================================
// Main Screen
// =============================================================================

function HexGameUI(props: GameShellProps) {
  const {
    publicState: rawState,
    isMyTurn,
    isTerminal,
    myUid,
    turnOrder,
    players,
    submitMove,
    actionLoading,
  } = props;

  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const state = rawState as unknown as HexPublicState | null;
  const [helpVisible, setHelpVisible] = useState(false);

  // ── Derived ─────────────────────────────────────────────────────────

  const myColor = state?.colorByUid[myUid] ?? null;
  const opponentUid = turnOrder.find((uid) => uid !== myUid) ?? "";
  const opponentColor = state?.colorByUid[opponentUid] ?? null;
  const myPlayer = players.find((p) => p.uid === myUid);
  const oppPlayer = players.find((p) => p.uid !== myUid);
  const winPathSet = useMemo(
    () => new Set(state?.winningPath ?? []),
    [state?.winningPath],
  );
  const winnerColor = state?.winnerUid
    ? (state.colorByUid[state.winnerUid] ?? null)
    : null;

  // ── Status ──────────────────────────────────────────────────────────

  const statusText = useMemo(() => {
    if (!state) return "Loading\u2026";
    if (state.phase === "resolved") {
      if (state.winnerUid === myUid) return "You win!";
      if (state.winnerUid) return "You lost";
      return "Game over";
    }
    if (state.phase === "swap_pending") {
      return isMyTurn ? "Opening decision" : "Waiting for swap decision\u2026";
    }
    if (state.phase === "opening") {
      return isMyTurn
        ? "Place the opening stone"
        : "Waiting for opening move\u2026";
    }
    return isMyTurn ? "Your turn" : "Opponent\u2019s turn";
  }, [state, isMyTurn, myUid]);

  const subtitle = useMemo(() => {
    if (!state || !myColor || state.phase === "resolved") return undefined;
    const goal = myColor === "red" ? "Top \u2194 Bottom" : "Left \u2194 Right";
    return `${myColor === "red" ? "Red" : "Blue"} \u00B7 ${goal}`;
  }, [state, myColor]);

  const statusColor = useMemo(() => {
    if (!state) return undefined;
    if (state.phase === "resolved") {
      return state.winnerUid === myUid
        ? RESULT.win
        : state.winnerUid
          ? RESULT.loss
          : undefined;
    }
    return undefined;
  }, [state, myUid]);

  // ── Chips ───────────────────────────────────────────────────────────

  const localChip: PlayerChipProps = useMemo(
    () => ({
      displayName: myPlayer?.displayName ?? "You",
      markLabel: myColor === "red" ? "R" : myColor === "blue" ? "B" : "?",
      markColor: myColor === "red" ? P.red : P.blue,
      isActive: isMyTurn && !isTerminal,
      isLocal: true,
      avatarUrl: myPlayer?.profilePictureUrl,
    }),
    [myPlayer, myColor, isMyTurn, isTerminal],
  );

  const opponentChip: PlayerChipProps = useMemo(
    () => ({
      displayName: oppPlayer?.displayName ?? "Opponent",
      markLabel:
        opponentColor === "red" ? "R" : opponentColor === "blue" ? "B" : "?",
      markColor: opponentColor === "red" ? P.red : P.blue,
      isActive: !isMyTurn && !isTerminal,
      isLocal: false,
      avatarUrl: oppPlayer?.profilePictureUrl,
    }),
    [oppPlayer, opponentColor, isMyTurn, isTerminal],
  );

  // ── Handlers ────────────────────────────────────────────────────────

  const handleCellPress = useCallback(
    (index: number) => {
      if (!isMyTurn || isTerminal || actionLoading) return;
      if (state?.phase === "swap_pending") return;
      Haptics.medium();
      submitMove({ type: "place", index });
    },
    [isMyTurn, isTerminal, actionLoading, state?.phase, submitMove],
  );

  const handleSwap = useCallback(
    (choice: "keep" | "swap") => {
      if (!isMyTurn || actionLoading) return;
      submitMove({ type: "swap_decision", choice });
    },
    [isMyTurn, actionLoading, submitMove],
  );

  // ── Terminal haptic ─────────────────────────────────────────────────

  const didHaptic = useRef(false);
  useEffect(() => {
    if (isTerminal && !didHaptic.current) {
      didHaptic.current = true;
      if (state?.winnerUid === myUid) Haptics.success();
      else Haptics.heavy();
    }
  }, [isTerminal, state?.winnerUid, myUid]);

  // ── Surfaces ────────────────────────────────────────────────────────

  const gameBg = isDark ? "#08080E" : theme.colors.background;
  const boardBg = isDark ? BOARD.surfaceDark : BOARD.surfaceLight;
  const frameBg = isDark ? BOARD.frameDark : BOARD.frameLight;

  // ── Render ──────────────────────────────────────────────────────────

  if (!state) {
    return <View style={[st.root, { backgroundColor: gameBg }]} />;
  }

  return (
    <View style={[st.root, { backgroundColor: gameBg }]}>
      {/* Zone 1 — Top HUD */}
      <TurnStatusCard
        statusText={statusText}
        subtitle={subtitle}
        localPlayer={localChip}
        opponentPlayer={opponentChip}
        isLocalTurn={isMyTurn}
        isTerminal={isTerminal}
        statusColor={statusColor}
      />

      {/* Zone 2 — Player objective strip */}
      <PlayerObjectiveStrip
        myColor={myColor}
        opponentColor={opponentColor}
        myName={myPlayer?.displayName ?? "You"}
        opponentName={oppPlayer?.displayName ?? "Opponent"}
        isMyTurn={isMyTurn}
        isTerminal={isTerminal}
        isDark={isDark}
      />

      {/* Zone 3 — Board hero */}
      <View style={st.boardZone}>
        <View
          style={[
            st.boardFrame,
            {
              backgroundColor: frameBg,
              ...Elevation.lg,
              shadowColor: isDark ? "#000" : "#888",
            },
          ]}
        >
          <BoardTray
            padding={Spacing.sm}
            backgroundColor={boardBg}
            style={st.boardTray}
          >
            <View
              style={{
                width: L.boardW + L.radius * 2 + 8,
                height: L.boardH + L.radius * 0.5 + 8,
                position: "relative",
              }}
            >
              <EdgeRails isDark={isDark} />
              {state.cells.map((cell, index) => (
                <HexCellView
                  key={index}
                  index={index}
                  cell={cell}
                  isLastMove={state.lastMove?.index === index}
                  isWinPath={winPathSet.has(index)}
                  isTerminal={isTerminal}
                  onPress={handleCellPress}
                  disabled={
                    !isMyTurn ||
                    isTerminal ||
                    actionLoading ||
                    state.phase === "swap_pending"
                  }
                  isDark={isDark}
                />
              ))}
            </View>
          </BoardTray>
        </View>
      </View>

      {/* Win banner */}
      {state.phase === "resolved" && !!state.winnerUid && (
        <WinBanner
          winnerUid={state.winnerUid}
          myUid={myUid}
          winnerColor={winnerColor}
          isDark={isDark}
        />
      )}

      {/* Zone 4 — Bottom */}
      <View style={st.botZone}>
        <BottomHelperBar
          moveCount={state.moveCount}
          onInfoPress={() => setHelpVisible(true)}
          isDark={isDark}
        />
        {state.phase === "swap_pending" && !isMyTurn && (
          <InlineNotice message="Opponent is choosing whether to swap\u2026" />
        )}
      </View>

      {/* Swap sheet overlay */}
      {state.phase === "swap_pending" && isMyTurn && (
        <SwapDecisionSheet
          openingMoveIndex={state.openingMoveIndex}
          onDecide={handleSwap}
          isDark={isDark}
          myColor={myColor ?? "blue"}
          opponentName={oppPlayer?.displayName ?? "Opponent"}
        />
      )}

      {/* Help modal */}
      <HexHelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        isDark={isDark}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const st = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },

  // Objective strip
  objStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  objCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: 3,
  },
  objHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  objDot: { width: 10, height: 10, borderRadius: 5 },
  objName: { fontSize: FontSizes.sm, fontWeight: "600", flex: 1 },
  objGoalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingLeft: 14,
  },
  objGoalText: { fontSize: FontSizes.xs, fontWeight: "500" },
  objVs: {
    fontSize: FontSizes.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Board
  boardZone: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  boardFrame: { borderRadius: BorderRadius.lg + 2, padding: 3 },
  boardTray: { borderRadius: BorderRadius.lg },

  // Bottom
  botZone: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.select({ ios: Spacing.md, default: Spacing.lg }),
    gap: Spacing.xs,
    alignItems: "center",
    minHeight: 44,
  },
  botBar: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  botMove: { fontSize: FontSizes.sm, fontWeight: "500" },
  botInfo: { padding: Spacing.xs, borderRadius: BorderRadius.full },

  // Win banner
  winBanner: { alignItems: "center", paddingVertical: Spacing.xs, gap: 2 },
  winTitle: { fontSize: FontSizes.lg, fontWeight: "700" },
  winSub: { fontSize: FontSizes.sm, fontWeight: "500" },

  // Swap overlay
  swapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.60)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    paddingHorizontal: Spacing.xl,
  },
  swapCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    ...Elevation.xl,
  },
  swapHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  swapTitle: { fontSize: FontSizes.xl, fontWeight: "700" },
  swapDesc: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  swapDiv: { height: 1, marginHorizontal: Spacing.lg },
  swapOpt: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
  },
  swapOptHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  swapOptDot: { width: 14, height: 14, borderRadius: 7 },
  swapOptTitle: { fontSize: FontSizes.md, fontWeight: "700" },
  swapOptCaption: { fontSize: FontSizes.xs, lineHeight: 17, paddingLeft: 22 },
  swapFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    marginTop: Spacing.xs,
  },
  swapFooterText: { fontSize: FontSizes.xs, fontStyle: "italic", flex: 1 },

  // Help modal
  helpOvr: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  helpCard: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "80%",
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    ...Elevation.xl,
  },
  helpHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  helpTitle: { fontSize: FontSizes.lg, fontWeight: "700", flex: 1 },
  helpX: { padding: Spacing.xs },
  helpSec: {
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  helpSecLast: { paddingBottom: Spacing.sm },
  helpSecTitle: {
    fontSize: FontSizes.md,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  helpBody: { fontSize: FontSizes.sm, lineHeight: 20 },
  helpGoals: { gap: Spacing.xs, marginTop: Spacing.sm },
  helpGoalRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  helpGoalDot: { width: 10, height: 10, borderRadius: 5 },
  helpGoalTxt: { fontSize: FontSizes.sm },
  helpTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  helpTipTxt: { fontSize: FontSizes.xs, lineHeight: 18, flex: 1 },
});

export default withGameV4Shell(HexGameUI, "hex");
