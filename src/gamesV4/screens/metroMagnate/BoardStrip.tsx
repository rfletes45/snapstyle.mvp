/**
 * Metro Magnate — Board Strip
 *
 * Horizontal scrollable board showing all 36 spaces with:
 * - Sector/type color strip
 * - Space name
 * - Player position tokens
 * - Improvement level pips
 * - Ownership border tint
 * - Mortgage dimming
 *
 * Auto-scrolls to the viewing player's current position.
 * Tap a cell to open the asset detail modal.
 *
 * @module gamesV4/screens/metroMagnate/BoardStrip
 */

import { BOARD_SPACES } from "@/gamesV4/adapters/metroMagnate/metroMagnateBoard";
import type { MetroMagnatePublicState } from "@/gamesV4/adapters/metroMagnate/metroMagnateTypes";
import React, { useEffect, useMemo, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getImpLevel,
  getPlayerColor,
  getSpaceAccent,
  getSpaceOwner,
  isMortgagedProp,
} from "./mmConstants";

const CELL_W = 58;
const CELL_H = 76;
const CELL_GAP = 4;

interface BoardStripProps {
  state: MetroMagnatePublicState;
  myUid: string;
  turnOrder: string[];
  onSpacePress: (index: number) => void;
  surfaceColor: string;
  textColor: string;
}

export function BoardStrip({
  state,
  myUid,
  turnOrder,
  onSpacePress,
  surfaceColor,
  textColor,
}: BoardStripProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to current player's position
  const myPlayer = state.players.find((p) => p.uid === myUid);
  const myPos = myPlayer?.position ?? 0;

  useEffect(() => {
    const offset = Math.max(0, myPos * (CELL_W + CELL_GAP) - 100);
    scrollRef.current?.scrollTo({ x: offset, animated: true });
  }, [myPos]);

  // Precompute which players are on each space
  const positionMap = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const p of state.players) {
      if (p.isBankrupt) continue;
      if (!map[p.position]) map[p.position] = [];
      map[p.position].push(p.uid);
    }
    return map;
  }, [state.players]);

  return (
    <View style={[s.container, { backgroundColor: surfaceColor }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
      >
        {BOARD_SPACES.map((space) => {
          const idx = space.index;
          const accent = getSpaceAccent(space.type, space.sectorId);
          const owner = getSpaceOwner(state, idx);
          const impLevel = getImpLevel(state, idx);
          const mortgaged = isMortgagedProp(state, idx);
          const playersHere = positionMap[idx] ?? [];
          const isMyPos = idx === myPos && !myPlayer?.isBankrupt;

          const ownerBorder =
            owner && !isMyPos
              ? getPlayerColor(owner, turnOrder) + "70"
              : "transparent";

          return (
            <TouchableOpacity
              key={idx}
              style={[
                s.cell,
                {
                  borderColor: isMyPos ? "#FFFFFF" : ownerBorder,
                  borderWidth: isMyPos ? 2 : owner ? 1.5 : 1,
                },
                isMyPos && s.cellActive,
                mortgaged && s.cellMortgaged,
              ]}
              onPress={() => onSpacePress(idx)}
              activeOpacity={0.7}
            >
              {/* Sector/type color strip */}
              <View style={[s.colorStrip, { backgroundColor: accent }]} />

              {/* Space name */}
              <Text
                style={[
                  s.spaceName,
                  mortgaged && s.mortgagedText,
                  { color: textColor },
                ]}
                numberOfLines={2}
              >
                {space.name}
              </Text>

              {/* Player tokens */}
              {playersHere.length > 0 && (
                <View style={s.tokenRow}>
                  {playersHere.slice(0, 6).map((uid) => (
                    <View
                      key={uid}
                      style={[
                        s.token,
                        {
                          backgroundColor: getPlayerColor(uid, turnOrder),
                        },
                      ]}
                    />
                  ))}
                </View>
              )}

              {/* Improvement pips */}
              {impLevel > 0 && (
                <View style={s.pipRow}>
                  {impLevel < 5 ? (
                    Array.from({ length: impLevel }).map((_, i) => (
                      <View key={i} style={s.pip} />
                    ))
                  ) : (
                    <Text style={s.towerBadge}>T</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  strip: {
    paddingHorizontal: 10,
    gap: CELL_GAP,
    alignItems: "flex-end",
  },
  cell: {
    width: CELL_W,
    height: CELL_H,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "transparent",
    overflow: "hidden",
    alignItems: "center",
  },
  cellActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  cellMortgaged: {
    opacity: 0.45,
  },
  colorStrip: {
    width: "100%",
    height: 4,
  },
  spaceName: {
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 2,
    marginTop: 3,
    lineHeight: 11,
    flex: 1,
  },
  mortgagedText: {
    color: "#6B7280",
  },
  tokenRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 2,
  },
  token: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.3)",
  },
  pipRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 3,
    alignItems: "center",
  },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FBBF24",
  },
  towerBadge: {
    fontSize: 9,
    fontWeight: "900",
    color: "#F59E0B",
    letterSpacing: -0.5,
  },
});
