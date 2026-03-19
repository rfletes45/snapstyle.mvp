/**
 * Metro Magnate — Perimeter Board (Redesigned for Clarity)
 *
 * Square perimeter board with 36 spaces arranged around the edges,
 * 4 larger corner tiles, and a center panel with diagonal deck panels.
 *
 * Tile categories are now instantly distinguishable:
 * - Districts: sector color strip + subtle neutral bg + property icon
 * - Transit Lines: steel-tinted bg + subway icon + "TRANSIT" label
 * - Service Nodes: purple-tinted bg + flash icon + "SERVICE" label
 * - Market Shift: warm orange bg + chart icon + "EVENT" label
 * - City Brief: cool blue bg + document icon + "EVENT" label
 * - Civic Fee: red-tinted bg + cash icon + "FEE" label
 * - Corners: strong identity colors, large icons, bold labels
 *
 * @module gamesV4/screens/metroMagnate/MetroMagnateBoard
 */

import { BOARD_SPACES } from "@/gamesV4/adapters/metroMagnate/metroMagnateBoard";
import type { MetroMagnatePublicState } from "@/gamesV4/adapters/metroMagnate/metroMagnateTypes";
import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  BoardMetrics,
  BOTTOM_ROW,
  getAbbrevName,
  getSpaceIcon,
  LEFT_COL,
  RIGHT_COL,
  TOP_ROW,
} from "./mmBoardLayout";
import {
  formatCash,
  getDisplayName,
  getImpLevel,
  getPlayerColor,
  getSpaceAccent,
  getSpaceOwner,
  getTileBg,
  getTileBorder,
  getTileTypeLabel,
  isMortgagedProp,
} from "./mmConstants";

// =============================================================================
// Types
// =============================================================================

interface BoardProps {
  state: MetroMagnatePublicState;
  myUid: string;
  turnOrder: string[];
  players: GameShellProps["players"];
  metrics: BoardMetrics;
  onSpacePress: (index: number) => void;
  textColor: string;
  surfaceColor: string;
  secondaryColor: string;
  isMyTurn: boolean;
}

type TileSide = "top" | "right" | "bottom" | "left";

// =============================================================================
// Main Board Component
// =============================================================================

export function MetroMagnateBoard({
  state,
  myUid,
  turnOrder,
  players,
  metrics,
  onSpacePress,
  textColor,
  surfaceColor,
  secondaryColor,
  isMyTurn,
}: BoardProps) {
  const { boardSize, cornerSize, edgeThin, centerSize } = metrics;

  // Precompute position → uids
  const positionMap = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const p of state.players) {
      if (p.isBankrupt) continue;
      if (!map[p.position]) map[p.position] = [];
      map[p.position].push(p.uid);
    }
    return map;
  }, [state.players]);

  const myPlayer = state.players.find((p) => p.uid === myUid);
  const myPos = myPlayer?.isBankrupt ? -1 : (myPlayer?.position ?? -1);

  const tileProps = {
    state,
    positionMap,
    myPos,
    turnOrder,
    onSpacePress,
    textColor,
  };

  return (
    <View
      style={[
        bs.board,
        {
          width: boardSize,
          height: boardSize,
          backgroundColor: "#0C1222",
          borderWidth: 1,
          borderColor: "rgba(255,215,0,0.12)",
          borderRadius: 6,
        },
      ]}
    >
      {/* ── Top Row ── */}
      <View style={[bs.row, { height: cornerSize }]}>
        {TOP_ROW.map((idx, i) => {
          const isCorner = i === 0 || i === TOP_ROW.length - 1;
          return isCorner ? (
            <CornerTile
              key={idx}
              index={idx}
              size={cornerSize}
              {...tileProps}
            />
          ) : (
            <EdgeTile
              key={idx}
              index={idx}
              width={edgeThin}
              height={cornerSize}
              side="top"
              {...tileProps}
            />
          );
        })}
      </View>

      {/* ── Middle: Left col | Center | Right col ── */}
      <View style={[bs.middle, { height: centerSize }]}>
        {/* Left column */}
        <View style={[bs.sideCol, { width: cornerSize }]}>
          {LEFT_COL.map((idx) => (
            <EdgeTile
              key={idx}
              index={idx}
              width={cornerSize}
              height={edgeThin}
              side="left"
              {...tileProps}
            />
          ))}
        </View>

        {/* Center panel */}
        <CenterPanel
          state={state}
          myUid={myUid}
          turnOrder={turnOrder}
          players={players}
          centerSize={centerSize}
          textColor={textColor}
          secondaryColor={secondaryColor}
          isMyTurn={isMyTurn}
        />

        {/* Right column */}
        <View style={[bs.sideCol, { width: cornerSize }]}>
          {RIGHT_COL.map((idx) => (
            <EdgeTile
              key={idx}
              index={idx}
              width={cornerSize}
              height={edgeThin}
              side="right"
              {...tileProps}
            />
          ))}
        </View>
      </View>

      {/* ── Bottom Row ── */}
      <View style={[bs.row, { height: cornerSize }]}>
        {BOTTOM_ROW.map((idx, i) => {
          const isCorner = i === 0 || i === BOTTOM_ROW.length - 1;
          return isCorner ? (
            <CornerTile
              key={idx}
              index={idx}
              size={cornerSize}
              {...tileProps}
            />
          ) : (
            <EdgeTile
              key={idx}
              index={idx}
              width={edgeThin}
              height={cornerSize}
              side="bottom"
              {...tileProps}
            />
          );
        })}
      </View>
    </View>
  );
}

// =============================================================================
// Corner Tile — Strong identity, large icon, bold label
// =============================================================================

interface TileBaseProps {
  state: MetroMagnatePublicState;
  positionMap: Record<number, string[]>;
  myPos: number;
  turnOrder: string[];
  onSpacePress: (index: number) => void;
  textColor: string;
}

function CornerTile({
  index,
  size,
  state,
  positionMap,
  myPos,
  turnOrder,
  onSpacePress,
}: TileBaseProps & { index: number; size: number }) {
  const space = BOARD_SPACES[index];
  const accent = getSpaceAccent(space.type, space.sectorId);
  const bg = getTileBg(space.type);
  const playersHere = positionMap[index] ?? [];
  const isMyPos = index === myPos;
  const icon = getSpaceIcon(space.type);

  return (
    <TouchableOpacity
      style={[
        cs.corner,
        {
          width: size,
          height: size,
          borderColor: isMyPos ? "#FFFFFF" : getTileBorder(space.type),
          borderWidth: isMyPos ? 1.5 : 0.5,
          backgroundColor: isMyPos ? "rgba(255,255,255,0.14)" : bg,
        },
      ]}
      onPress={() => onSpacePress(index)}
      activeOpacity={0.7}
    >
      {/* Corner accent border (inner glow line) */}
      <View style={[cs.cornerAccent, { backgroundColor: accent + "30" }]} />
      {icon && (
        <MaterialCommunityIcons
          name={icon as any}
          size={Math.max(14, Math.round(size * 0.34))}
          color={accent}
          style={{ marginBottom: 1 }}
        />
      )}
      <Text style={[cs.name, { color: accent }]} numberOfLines={2}>
        {getAbbrevName(index, space.name)}
      </Text>
      {playersHere.length > 0 && (
        <View style={cs.tokenRow}>
          {playersHere.slice(0, 6).map((uid) => (
            <View
              key={uid}
              style={[
                cs.token,
                { backgroundColor: getPlayerColor(uid, turnOrder) },
              ]}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Edge Tile — Category-specific rendering
// =============================================================================

function EdgeTile({
  index,
  width,
  height,
  side,
  state,
  positionMap,
  myPos,
  turnOrder,
  onSpacePress,
  textColor,
}: TileBaseProps & {
  index: number;
  width: number;
  height: number;
  side: TileSide;
}) {
  const space = BOARD_SPACES[index];
  const accent = getSpaceAccent(space.type, space.sectorId);
  const owner = getSpaceOwner(state, index);
  const impLevel = getImpLevel(state, index);
  const mortgaged = isMortgagedProp(state, index);
  const playersHere = positionMap[index] ?? [];
  const isMyPos = index === myPos;
  const ownerColor = owner ? getPlayerColor(owner, turnOrder) : null;
  const icon = getSpaceIcon(space.type);
  const typeLabel = getTileTypeLabel(space.type);
  const isDistrict = space.type === "district";
  const isEvent = space.type === "market_shift" || space.type === "city_brief";
  const isInfra =
    space.type === "transit_line" || space.type === "service_node";
  const isFee = space.type === "civic_fee";

  // Background: category-specific
  const tileBg = isMyPos
    ? "rgba(255,255,255,0.12)"
    : ownerColor
      ? ownerColor + "12"
      : getTileBg(space.type);

  // Border: category-specific
  const tileBorderColor = isMyPos
    ? "#FFFFFF"
    : ownerColor
      ? ownerColor + "55"
      : getTileBorder(space.type);

  // Color strip: thicker for non-districts, always present
  const stripThickness = isDistrict
    ? 3
    : isEvent
      ? 4
      : isInfra
        ? 3
        : isFee
          ? 4
          : 3;
  const stripStyle = getStripStyle(side, accent, stripThickness);

  // Is this a vertical tile (left/right columns)?
  const isVertical = side === "left" || side === "right";

  return (
    <TouchableOpacity
      style={[
        es.tile,
        {
          width,
          height,
          borderColor: tileBorderColor,
          borderWidth: isMyPos ? 1.5 : 0.5,
          opacity: mortgaged ? 0.45 : 1,
          backgroundColor: tileBg,
        },
      ]}
      onPress={() => onSpacePress(index)}
      activeOpacity={0.7}
    >
      {/* Color strip (outside edge) */}
      <View style={stripStyle} />

      {/* Event/fee tiles get a subtle diagonal pattern overlay */}
      {isEvent && (
        <View style={[es.eventOverlay, { backgroundColor: accent + "08" }]} />
      )}

      {/* Content area */}
      <View style={es.content}>
        {/* Icon for non-district tiles (always shown) */}
        {icon && !isDistrict && (
          <MaterialCommunityIcons
            name={icon as any}
            size={isVertical ? 8 : 9}
            color={accent}
            style={{ marginBottom: 0 }}
          />
        )}

        {/* Tile name */}
        <Text
          style={[
            es.name,
            {
              color: isEvent || isFee || isInfra ? accent : textColor,
              fontWeight: isEvent || isFee ? "800" : "600",
              fontSize: isVertical ? 5.5 : 6,
            },
          ]}
          numberOfLines={2}
        >
          {getAbbrevName(index, space.name)}
        </Text>

        {/* Type sublabel for non-districts */}
        {typeLabel && !isVertical && (
          <Text style={[es.typeLabel, { color: accent + "99" }]}>
            {typeLabel}
          </Text>
        )}

        {/* Player tokens */}
        {playersHere.length > 0 && (
          <View style={es.tokenRow}>
            {playersHere.slice(0, 4).map((uid) => (
              <View
                key={uid}
                style={[
                  es.token,
                  { backgroundColor: getPlayerColor(uid, turnOrder) },
                ]}
              />
            ))}
          </View>
        )}

        {/* Improvement pips (districts only) */}
        {impLevel > 0 && (
          <View style={es.pipRow}>
            {impLevel < 5 ? (
              Array.from({ length: impLevel }).map((_, i) => (
                <View key={i} style={es.pip} />
              ))
            ) : (
              <Text style={es.towerBadge}>T</Text>
            )}
          </View>
        )}
      </View>

      {/* Owner indicator dot (bottom corner) */}
      {ownerColor && !isMyPos && (
        <View style={[es.ownerDot, { backgroundColor: ownerColor }]} />
      )}
    </TouchableOpacity>
  );
}

function getStripStyle(side: TileSide, accent: string, thickness: number) {
  const base = { backgroundColor: accent, position: "absolute" as const };
  switch (side) {
    case "top":
      return { ...base, top: 0, left: 0, right: 0, height: thickness };
    case "bottom":
      return { ...base, bottom: 0, left: 0, right: 0, height: thickness };
    case "left":
      return { ...base, top: 0, bottom: 0, left: 0, width: thickness };
    case "right":
      return { ...base, top: 0, bottom: 0, right: 0, width: thickness };
  }
}

// =============================================================================
// Center Panel — Logo, Dice, Phase, Diagonal Deck Panels
// =============================================================================

function CenterPanel({
  state,
  myUid,
  turnOrder,
  players,
  centerSize,
  textColor,
  secondaryColor,
  isMyTurn,
}: {
  state: MetroMagnatePublicState;
  myUid: string;
  turnOrder: string[];
  players: GameShellProps["players"];
  centerSize: number;
  textColor: string;
  secondaryColor: string;
  isMyTurn: boolean;
}) {
  const currentName = getDisplayName(state.currentTurnUid, players, myUid);
  const mode = state.settings?.mode ?? "classic";

  // Phase prompt
  let phaseText = "";
  let phaseIcon: string = "information";
  let phaseColor = secondaryColor;
  switch (state.phase) {
    case "pre_roll":
      phaseText = isMyTurn ? "Roll the dice!" : `${currentName}'s turn`;
      phaseIcon = "dice-multiple";
      phaseColor = isMyTurn ? "#4ADE80" : secondaryColor;
      break;
    case "buying_decision":
      phaseText = isMyTurn
        ? "Buy or Auction?"
        : `${currentName} deciding\u2026`;
      phaseIcon = "home-plus";
      phaseColor = isMyTurn ? "#10B981" : secondaryColor;
      break;
    case "auction":
      phaseText = "Auction!";
      phaseIcon = "gavel";
      phaseColor = "#F59E0B";
      break;
    case "post_roll":
      phaseText = isMyTurn ? "End Turn" : `${currentName} managing`;
      phaseIcon = "check-bold";
      phaseColor = isMyTurn ? "#60A5FA" : secondaryColor;
      break;
    case "debt_resolution":
      phaseText = isMyTurn ? "Resolve debt!" : `${currentName} in debt`;
      phaseIcon = "alert-circle";
      phaseColor = "#EF4444";
      break;
    case "inspection":
      phaseText = isMyTurn ? "Inspection" : `${currentName} inspected`;
      phaseIcon = "shield-alert";
      phaseColor = "#FF6B6B";
      break;
    case "trading":
      phaseText = "Trade offer";
      phaseIcon = "swap-horizontal";
      phaseColor = "#A78BFA";
      break;
    case "game_over":
      phaseText =
        state.winnerUid === myUid
          ? "Victory!"
          : `${getDisplayName(state.winnerUid ?? "", players, myUid)} wins!`;
      phaseIcon = "trophy";
      phaseColor = "#FFD700";
      break;
    default:
      phaseText = state.phase.replace(/_/g, " ");
  }

  // Deck panel sizing — compact decorative badges
  const deckW = Math.max(36, Math.round(centerSize * 0.24));
  const deckH = Math.max(14, Math.round(centerSize * 0.08));

  return (
    <View
      style={[
        cp.center,
        {
          width: centerSize,
          height: centerSize,
          backgroundColor: "#080E1A",
        },
      ]}
    >
      {/* ── Top-left diagonal deck: Market Shift ── */}
      <View
        style={[cp.deckPanel, cp.deckTopLeft, { width: deckW, height: deckH }]}
      >
        <MaterialCommunityIcons
          name="chart-line"
          size={Math.max(9, Math.round(deckH * 0.38))}
          color="#FB923C"
        />
        <Text style={cp.deckLabel} numberOfLines={1}>
          Market Shift
        </Text>
      </View>

      {/* ── Bottom-right diagonal deck: City Brief ── */}
      <View
        style={[
          cp.deckPanel,
          cp.deckBottomRight,
          { width: deckW, height: deckH },
        ]}
      >
        <MaterialCommunityIcons
          name="file-document-outline"
          size={Math.max(9, Math.round(deckH * 0.38))}
          color="#38BDF8"
        />
        <Text style={[cp.deckLabel, { color: "#38BDF8" }]} numberOfLines={1}>
          City Brief
        </Text>
      </View>

      {/* ── Central content ── */}

      {/* Logo */}
      <Text style={cp.logo}>METRO</Text>
      <Text style={cp.logoSub}>MAGNATE</Text>

      {/* Mode badge */}
      <View style={[cp.modeBadge, mode === "express" && cp.modeBadgeExpress]}>
        <Text
          style={[
            cp.modeText,
            { color: mode === "express" ? "#FBBF24" : "#4ADE80" },
          ]}
        >
          {mode.toUpperCase()}
        </Text>
      </View>

      {/* Dice display */}
      {state.lastDice && (
        <View style={cp.diceRow}>
          <View
            style={[
              cp.die,
              state.lastDice[0] === state.lastDice[1] && cp.dieDoubles,
            ]}
          >
            <Text style={cp.dieText}>{state.lastDice[0]}</Text>
          </View>
          <View
            style={[
              cp.die,
              state.lastDice[0] === state.lastDice[1] && cp.dieDoubles,
            ]}
          >
            <Text style={cp.dieText}>{state.lastDice[1]}</Text>
          </View>
          {state.lastDice[0] === state.lastDice[1] && (
            <Text style={cp.doubles}>2\u00D7</Text>
          )}
        </View>
      )}

      {/* Phase prompt */}
      <View style={cp.phaseRow}>
        <MaterialCommunityIcons
          name={phaseIcon as any}
          size={11}
          color={phaseColor}
        />
        <Text style={[cp.phaseText, { color: phaseColor }]} numberOfLines={2}>
          {phaseText}
        </Text>
      </View>

      {/* Quick info */}
      <View style={cp.infoCol}>
        {state.plazaPot > 0 && (
          <Text style={[cp.infoLine, { color: "#4ECDC4" }]}>
            Plaza {formatCash(state.plazaPot)}
          </Text>
        )}
        <Text style={[cp.infoLine, { color: secondaryColor }]}>
          T{state.turnNumber} \u00B7 M{state.moveCount}
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const bs = StyleSheet.create({
  board: {
    alignSelf: "center",
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  row: {
    flexDirection: "row",
  },
  middle: {
    flexDirection: "row",
  },
  sideCol: {
    flexDirection: "column",
  },
});

const cs = StyleSheet.create({
  corner: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 3,
  },
  cornerAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 3,
  },
  name: {
    fontSize: 7,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.2,
    lineHeight: 9,
  },
  tokenRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  token: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.5)",
  },
});

const es = StyleSheet.create({
  tile: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  eventOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
    paddingVertical: 1,
  },
  name: {
    fontSize: 6,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 7.5,
    letterSpacing: -0.3,
  },
  typeLabel: {
    fontSize: 4.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
    marginTop: 0,
  },
  tokenRow: {
    flexDirection: "row",
    gap: 1,
    marginTop: 1,
  },
  token: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.5)",
  },
  pipRow: {
    flexDirection: "row",
    gap: 1,
    marginTop: 1,
    alignItems: "center",
  },
  pip: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: "#FBBF24",
  },
  towerBadge: {
    fontSize: 7,
    fontWeight: "900",
    color: "#F59E0B",
  },
  ownerDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 4,
    height: 4,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.3)",
  },
});

const cp = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 6,
    gap: 1,
  },
  // ── Diagonal Deck Panels ──
  deckPanel: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  deckTopLeft: {
    top: 8,
    left: 8,
    backgroundColor: "rgba(251,146,60,0.10)",
    borderColor: "rgba(251,146,60,0.25)",
    transform: [{ rotate: "-45deg" }],
  },
  deckBottomRight: {
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(56,189,248,0.10)",
    borderColor: "rgba(56,189,248,0.25)",
    transform: [{ rotate: "45deg" }],
  },
  deckLabel: {
    fontSize: 5.5,
    fontWeight: "800",
    color: "#FB923C",
    letterSpacing: 0.2,
  },
  // ── Logo ──
  logo: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFD700",
    letterSpacing: 3,
    lineHeight: 16,
  },
  logoSub: {
    fontSize: 8,
    fontWeight: "700",
    color: "rgba(255,215,0,0.50)",
    letterSpacing: 5,
    lineHeight: 10,
    marginTop: -1,
  },
  modeBadge: {
    backgroundColor: "rgba(74,222,128,0.12)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "rgba(74,222,128,0.25)",
    marginTop: 2,
  },
  modeBadgeExpress: {
    backgroundColor: "rgba(251,191,36,0.12)",
    borderColor: "rgba(251,191,36,0.25)",
  },
  modeText: {
    fontSize: 6,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  diceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  die: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  dieDoubles: {
    backgroundColor: "rgba(251,191,36,0.12)",
    borderColor: "rgba(251,191,36,0.3)",
  },
  dieText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F3F4F6",
  },
  doubles: {
    fontSize: 7,
    fontWeight: "800",
    color: "#FBBF24",
    marginLeft: 1,
  },
  phaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
    paddingHorizontal: 6,
  },
  phaseText: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
  infoCol: {
    alignItems: "center",
    gap: 1,
    marginTop: 2,
  },
  infoLine: {
    fontSize: 7,
    fontWeight: "600",
  },
});
