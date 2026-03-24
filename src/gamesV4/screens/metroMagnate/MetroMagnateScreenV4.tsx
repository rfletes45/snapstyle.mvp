/**
 * Games V4 — Metro Magnate Gameplay Screen
 *
 * Take 6 — UI/UX redesign: premium mobile-first board game
 *
 * Layout (top to bottom):
 * - Compact gold-accent header
 * - Player summary strip (compact chip cards)
 * - Square perimeter board (36 spaces, center info panel)
 * - Action tray (phase-dependent buttons, bottom-anchored)
 *
 * @module gamesV4/screens/metroMagnate/MetroMagnateScreenV4
 */

import {
  BOARD_SPACES,
  getDistrictCard,
  getServiceNodeCard,
  getTransitLineCard,
} from "@/gamesV4/adapters/metroMagnate/metroMagnateBoard";
import {
  isPropertyMortgaged,
  ownsSector,
} from "@/gamesV4/adapters/metroMagnate/metroMagnateEngine";
import type {
  MetroMagnatePublicState,
  MetroPlayerState,
} from "@/gamesV4/adapters/metroMagnate/metroMagnateTypes";
import {
  GameShellProps,
  withGameV4Shell,
} from "@/gamesV4/components/GameScreenShell";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MetroMagnateBoard } from "./MetroMagnateBoard";
import { computeBoardMetrics } from "./mmBoardLayout";
import {
  asState,
  formatCash,
  getDisplayName,
  getImpLevel,
  getPlayerColor,
  SECTOR_COLORS,
} from "./mmConstants";
import { AssetDetailModal, HelpModal } from "./MMModals";

const SCREEN_W = Dimensions.get("window").width;
const BOARD_METRICS = computeBoardMetrics(Math.min(SCREEN_W - 44, 372));

// =============================================================================
// Player Summary Strip — compact horizontal bar
// =============================================================================

function PlayerStrip({
  state,
  turnOrder,
  players,
  myUid,
  textColor,
  secondaryColor,
  surfaceColor,
  borderColor,
  onPlayerPress,
}: {
  state: MetroMagnatePublicState;
  turnOrder: string[];
  players: GameShellProps["players"];
  myUid: string;
  textColor: string;
  secondaryColor: string;
  surfaceColor: string;
  borderColor: string;
  onPlayerPress: (uid: string) => void;
}) {
  const currentUid = state.currentTurnUid;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={pss.rail}
    >
      {turnOrder.map((uid) => {
        const p = state.players.find((x) => x.uid === uid);
        if (!p) return null;
        const pColor = getPlayerColor(uid, turnOrder);
        const isActive = uid === currentUid;
        const label = getDisplayName(uid, players, myUid);
        const isInspected = state.inspectionHoldTurns.some(
          (h) => h.uid === uid,
        );

        return (
          <TouchableOpacity
            key={uid}
            onPress={() => onPlayerPress(uid)}
            activeOpacity={0.7}
            style={[
              pss.card,
              {
                backgroundColor: isActive
                  ? pColor + "18"
                  : "rgba(255,255,255,0.04)",
                borderColor: isActive
                  ? pColor + "AA"
                  : "rgba(255,255,255,0.08)",
                borderWidth: isActive ? 1.5 : 0.5,
              },
              p.isBankrupt && pss.cardBankrupt,
            ]}
          >
            {/* Active indicator bar */}
            {isActive && (
              <View style={[pss.activeBar, { backgroundColor: pColor }]} />
            )}

            {/* Name row: dot + name + badge */}
            <View style={pss.nameRow}>
              <View
                style={[
                  pss.dot,
                  { backgroundColor: pColor },
                  isActive && {
                    shadowColor: pColor,
                    shadowOpacity: 0.6,
                    shadowRadius: 3,
                    elevation: 2,
                  },
                ]}
              />
              <Text
                style={[pss.name, { color: isActive ? "#F3F4F6" : textColor }]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {p.isBankrupt && <Text style={pss.outBadge}>OUT</Text>}
              {!p.isBankrupt && isInspected && (
                <MaterialCommunityIcons
                  name="shield-alert"
                  size={9}
                  color="#FF6B6B"
                />
              )}
            </View>

            {/* Stats row */}
            {!p.isBankrupt && (
              <View style={pss.statsRow}>
                <Text style={[pss.cash, isActive && { color: pColor }]}>
                  {formatCash(p.cash)}
                </Text>
                <Text style={[pss.stat, { color: secondaryColor }]}>
                  {getPropertyBreakdown(p)}
                </Text>
                {p.inspectionPasses > 0 && (
                  <View style={pss.passBadge}>
                    <MaterialCommunityIcons
                      name="shield-check"
                      size={7}
                      color="#4ECDC4"
                    />
                    <Text style={pss.passCount}>{p.inspectionPasses}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** Compact property breakdown: "3D 1T 1S" format. */
function getPropertyBreakdown(p: MetroPlayerState): string {
  let d = 0,
    t = 0,
    s = 0;
  for (const idx of p.ownedProperties) {
    const type = BOARD_SPACES[idx]?.type;
    if (type === "district") d++;
    else if (type === "transit_line") t++;
    else if (type === "service_node") s++;
  }
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}D`);
  if (t > 0) parts.push(`${t}T`);
  if (s > 0) parts.push(`${s}S`);
  return parts.join(" ") || "0P";
}

const pss = StyleSheet.create({
  rail: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    gap: 5,
    alignItems: "center",
  },
  card: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 72,
    maxWidth: 120,
    overflow: "hidden",
  },
  cardBankrupt: {
    opacity: 0.35,
  },
  activeBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  name: {
    fontSize: 10,
    fontWeight: "700",
    flex: 1,
  },
  outBadge: {
    fontSize: 7,
    fontWeight: "800",
    color: "#EF4444",
    backgroundColor: "rgba(239,68,68,0.15)",
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 2,
    overflow: "hidden",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  cash: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4ADE80",
  },
  stat: {
    fontSize: 8,
    fontWeight: "600",
  },
  passBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(78,205,196,0.12)",
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 3,
  },
  passCount: {
    fontSize: 7,
    fontWeight: "800",
    color: "#4ECDC4",
  },
});

// =============================================================================
// Property Management Panel (modal slide-up)
// =============================================================================

function PropertyPanel({
  visible,
  onClose,
  state,
  myPlayer,
  myUid,
  canManage,
  canSellOrMortgage,
  canAct,
  doMove,
  textColor,
  secondaryColor,
  surfaceColor,
  turnOrder,
}: {
  visible: boolean;
  onClose: () => void;
  state: MetroMagnatePublicState;
  myPlayer: MetroPlayerState;
  myUid: string;
  canManage: boolean;
  canSellOrMortgage: boolean;
  canAct: boolean;
  doMove: (p: Record<string, unknown>) => void;
  textColor: string;
  secondaryColor: string;
  surfaceColor: string;
  turnOrder: string[];
}) {
  // Group properties by sector
  const grouped = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const propIdx of myPlayer.ownedProperties) {
      const space = BOARD_SPACES[propIdx];
      const key = space?.sectorId ?? space?.type ?? "other";
      if (!map[key]) map[key] = [];
      map[key].push(propIdx);
    }
    return Object.entries(map);
  }, [myPlayer.ownedProperties]);

  if (!visible || myPlayer.ownedProperties.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pps.backdrop} onPress={onClose}>
        <Pressable style={[pps.sheet, { backgroundColor: surfaceColor }]}>
          <View style={pps.header}>
            <MaterialCommunityIcons
              name="city-variant"
              size={16}
              color={textColor}
            />
            <Text style={[pps.heading, { color: textColor }]}>
              Your Properties
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={secondaryColor}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={pps.scroll}
            contentContainerStyle={pps.scrollContent}
          >
            {grouped.map(([groupKey, indices]) => {
              const sectorColor = SECTOR_COLORS[groupKey] ?? "#6B7280";
              return (
                <View key={groupKey}>
                  <View
                    style={[
                      pps.groupBar,
                      { backgroundColor: sectorColor + "20" },
                    ]}
                  >
                    <View
                      style={[pps.groupDot, { backgroundColor: sectorColor }]}
                    />
                    <Text
                      style={[pps.groupLabel, { color: sectorColor }]}
                      numberOfLines={1}
                    >
                      {groupName(groupKey)}
                    </Text>
                  </View>
                  {indices.map((propIdx) => (
                    <PropertyRow
                      key={propIdx}
                      propIdx={propIdx}
                      state={state}
                      myUid={myUid}
                      canManage={canManage}
                      canSellOrMortgage={canSellOrMortgage}
                      canAct={canAct}
                      doMove={doMove}
                      textColor={textColor}
                      secondaryColor={secondaryColor}
                      surfaceColor={surfaceColor}
                      turnOrder={turnOrder}
                    />
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PropertyRow({
  propIdx,
  state,
  myUid,
  canManage,
  canSellOrMortgage,
  canAct,
  doMove,
  textColor,
  secondaryColor,
  surfaceColor,
  turnOrder,
}: {
  propIdx: number;
  state: MetroMagnatePublicState;
  myUid: string;
  canManage: boolean;
  canSellOrMortgage: boolean;
  canAct: boolean;
  doMove: (p: Record<string, unknown>) => void;
  textColor: string;
  secondaryColor: string;
  surfaceColor: string;
  turnOrder: string[];
}) {
  const space = BOARD_SPACES[propIdx];
  const district = getDistrictCard(propIdx);
  const mortgaged = isPropertyMortgaged(state, propIdx);
  const level = getImpLevel(state, propIdx);
  const canBuild =
    canManage &&
    district != null &&
    ownsSector(state, myUid, district.sectorId) &&
    level < 5 &&
    !mortgaged;

  return (
    <View style={[pps.row, { backgroundColor: surfaceColor }]}>
      <View style={pps.rowLeft}>
        <Text
          style={[
            pps.propName,
            { color: textColor },
            mortgaged && pps.mortgaged,
          ]}
          numberOfLines={1}
        >
          {space?.name ?? `#${propIdx}`}
        </Text>
        <View style={pps.indicators}>
          {level > 0 && level < 5 && (
            <View style={pps.pipRow}>
              {Array.from({ length: level }).map((_, i) => (
                <View key={i} style={pps.pip} />
              ))}
            </View>
          )}
          {level === 5 && <Text style={pps.towerLabel}>Tower</Text>}
          {mortgaged && <Text style={pps.mortBadge}>MORTGAGED</Text>}
        </View>
      </View>
      <View style={pps.rowActions}>
        {canBuild && (
          <SmallBtn
            icon="plus"
            label="Build"
            color="#10B981"
            onPress={() =>
              doMove({ action: "build_improvement", propertyIndex: propIdx })
            }
            disabled={!canAct}
          />
        )}
        {canSellOrMortgage && level > 0 && (
          <SmallBtn
            icon="minus"
            label="Sell"
            color="#F59E0B"
            onPress={() =>
              doMove({ action: "sell_improvement", propertyIndex: propIdx })
            }
            disabled={!canAct}
          />
        )}
        {canSellOrMortgage && !mortgaged && level === 0 && (
          <SmallBtn
            icon="bank-transfer-out"
            label="Mortgage"
            color="#EF4444"
            onPress={() =>
              doMove({ action: "mortgage_property", propertyIndex: propIdx })
            }
            disabled={!canAct}
          />
        )}
        {canManage && mortgaged && (
          <SmallBtn
            icon="bank-transfer-in"
            label="Lift"
            color="#60A5FA"
            onPress={() =>
              doMove({
                action: "unmortgage_property",
                propertyIndex: propIdx,
              })
            }
            disabled={!canAct}
          />
        )}
      </View>
    </View>
  );
}

function SmallBtn({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  color: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        pps.smallBtn,
        { backgroundColor: color + "20", borderColor: color + "40" },
        disabled && { opacity: 0.4 },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
    >
      <MaterialCommunityIcons name={icon} size={12} color={color} />
      <Text style={[pps.smallBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function groupName(key: string): string {
  const map: Record<string, string> = {
    arts_quarter: "Arts Quarter",
    harbor_ward: "Harbor Ward",
    market_row: "Market Row",
    foundry_belt: "Foundry Belt",
    tech_heights: "Tech Heights",
    civic_square: "Civic Square",
    transit_line: "Transit Lines",
    service_node: "Service Nodes",
  };
  return map[key] ?? key;
}

const pps = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "60%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  heading: {
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 16,
  },
  groupBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  groupDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 2,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  propName: {
    fontSize: 13,
    fontWeight: "600",
  },
  mortgaged: {
    color: "#6B7280",
  },
  indicators: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pipRow: {
    flexDirection: "row",
    gap: 2,
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FBBF24",
  },
  towerLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#F59E0B",
  },
  mortBadge: {
    fontSize: 9,
    fontWeight: "700",
    color: "#EF4444",
    backgroundColor: "rgba(239,68,68,0.12)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: "hidden",
  },
  rowActions: {
    flexDirection: "row",
    gap: 4,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 34,
  },
  smallBtnText: {
    fontSize: 10,
    fontWeight: "700",
  },
});

// =============================================================================
// Player Portfolio Modal (read-only, any player)
// =============================================================================

function PlayerPortfolioModal({
  uid,
  state,
  turnOrder,
  players,
  myUid,
  onClose,
  textColor,
  surfaceColor,
  secondaryColor,
}: {
  uid: string | null;
  state: MetroMagnatePublicState;
  turnOrder: string[];
  players: GameShellProps["players"];
  myUid: string;
  onClose: () => void;
  textColor: string;
  surfaceColor: string;
  secondaryColor: string;
}) {
  const p = uid ? state.players.find((x) => x.uid === uid) : null;
  if (!uid || !p) return null;

  const pColor = getPlayerColor(uid, turnOrder);
  const label = getDisplayName(uid, players, myUid);

  // Group properties by sector/type
  const map: Record<string, number[]> = {};
  for (const propIdx of p.ownedProperties) {
    const space = BOARD_SPACES[propIdx];
    const key = space?.sectorId ?? space?.type ?? "other";
    if (!map[key]) map[key] = [];
    map[key].push(propIdx);
  }
  const grouped = Object.entries(map);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pfm.backdrop} onPress={onClose}>
        <Pressable style={[pfm.sheet, { backgroundColor: surfaceColor }]}>
          {/* Header */}
          <View style={pfm.header}>
            <View style={[pfm.dot, { backgroundColor: pColor }]} />
            <Text style={[pfm.playerName, { color: textColor }]}>{label}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={secondaryColor}
              />
            </TouchableOpacity>
          </View>

          {/* Stat row */}
          <View style={pfm.statsRow}>
            <View style={pfm.statBox}>
              <Text style={[pfm.statValue, { color: "#4ADE80" }]}>
                {formatCash(p.cash)}
              </Text>
              <Text style={[pfm.statLabel, { color: secondaryColor }]}>
                Cash
              </Text>
            </View>
            <View style={pfm.statBox}>
              <Text style={[pfm.statValue, { color: textColor }]}>
                {formatCash(p.netWorth)}
              </Text>
              <Text style={[pfm.statLabel, { color: secondaryColor }]}>
                Net Worth
              </Text>
            </View>
            {p.inspectionPasses > 0 && (
              <View style={pfm.statBox}>
                <View style={pfm.passRow}>
                  <MaterialCommunityIcons
                    name="shield-check"
                    size={12}
                    color="#4ECDC4"
                  />
                  <Text style={[pfm.statValue, { color: "#4ECDC4" }]}>
                    {p.inspectionPasses}
                  </Text>
                </View>
                <Text style={[pfm.statLabel, { color: secondaryColor }]}>
                  Pass{p.inspectionPasses !== 1 ? "es" : ""}
                </Text>
              </View>
            )}
          </View>

          {/* Properties */}
          <ScrollView
            style={pfm.scroll}
            contentContainerStyle={pfm.scrollContent}
          >
            {p.ownedProperties.length === 0 ? (
              <Text style={[pfm.empty, { color: secondaryColor }]}>
                No properties owned
              </Text>
            ) : (
              grouped.map(([groupKey, indices]) => {
                const sectorColor = SECTOR_COLORS[groupKey] ?? "#6B7280";
                return (
                  <View key={groupKey}>
                    <View
                      style={[
                        pfm.groupBar,
                        { backgroundColor: sectorColor + "15" },
                      ]}
                    >
                      <View
                        style={[pfm.groupDot, { backgroundColor: sectorColor }]}
                      />
                      <Text style={[pfm.groupLabel, { color: sectorColor }]}>
                        {groupName(groupKey)}
                      </Text>
                    </View>
                    {indices.map((propIdx) => {
                      const space = BOARD_SPACES[propIdx];
                      const impLvl = getImpLevel(state, propIdx);
                      const mortgaged = isPropertyMortgaged(state, propIdx);
                      return (
                        <View key={propIdx} style={pfm.propRow}>
                          <Text
                            style={[
                              pfm.propName,
                              { color: textColor },
                              mortgaged && { color: "#6B7280" },
                            ]}
                            numberOfLines={1}
                          >
                            {space?.name ?? `#${propIdx}`}
                          </Text>
                          <View style={pfm.propBadges}>
                            {impLvl > 0 && impLvl < 5 && (
                              <View style={pfm.pipRow}>
                                {Array.from({ length: impLvl }).map((_, i) => (
                                  <View key={i} style={pfm.pip} />
                                ))}
                              </View>
                            )}
                            {impLvl === 5 && (
                              <Text style={pfm.towerBadge}>Tower</Text>
                            )}
                            {mortgaged && (
                              <Text style={pfm.mortBadge}>MTG</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const pfm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: "85%",
    maxHeight: "65%",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  playerName: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  statBox: {
    alignItems: "center",
    gap: 1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 8,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  passRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 14,
  },
  empty: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 16,
  },
  groupBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginTop: 6,
  },
  groupDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  groupLabel: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  propRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 1,
  },
  propName: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  propBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pipRow: {
    flexDirection: "row",
    gap: 2,
  },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FBBF24",
  },
  towerBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: "#F59E0B",
  },
  mortBadge: {
    fontSize: 8,
    fontWeight: "700",
    color: "#EF4444",
    backgroundColor: "rgba(239,68,68,0.12)",
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 2,
    overflow: "hidden",
  },
});

// =============================================================================
// Action Tray (bottom)
// =============================================================================

function ActionTray({
  state,
  isMyTurn,
  canAct,
  doMove,
  myPlayer,
  bidAmount,
  setBidAmount,
  players,
  myUid,
  turnOrder,
  actionLoading,
  textColor,
  secondaryColor,
  canManageProps,
  onManageProps,
}: {
  state: MetroMagnatePublicState;
  isMyTurn: boolean;
  canAct: boolean;
  doMove: (p: Record<string, unknown>) => void;
  myPlayer: MetroPlayerState | undefined;
  bidAmount: string;
  setBidAmount: (v: string) => void;
  players: GameShellProps["players"];
  myUid: string;
  turnOrder: string[];
  actionLoading: boolean;
  textColor: string;
  secondaryColor: string;
  canManageProps: boolean;
  onManageProps: () => void;
}) {
  const currentName = getDisplayName(state.currentTurnUid, players, myUid);

  // ── Waiting state (not my turn) ──
  if (!isMyTurn && state.phase !== "game_over") {
    return (
      <View style={ats.tray}>
        <Text style={[ats.waitText, { color: secondaryColor }]}>
          Waiting for {currentName}…
        </Text>
      </View>
    );
  }

  // ── Game Over ──
  if (state.phase === "game_over") {
    const winnerName = state.winnerUid
      ? getDisplayName(state.winnerUid, players, myUid)
      : "???";
    return (
      <View style={ats.tray}>
        <MaterialCommunityIcons name="trophy" size={20} color="#FFD700" />
        <Text style={[ats.waitText, { color: "#FFD700", fontWeight: "800" }]}>
          {state.winnerUid === myUid ? "You win!" : `${winnerName} wins!`}
        </Text>
      </View>
    );
  }

  // ── Pre-roll ──
  if (state.phase === "pre_roll") {
    return (
      <View style={ats.tray}>
        <View style={ats.btnRow}>
          <PrimaryBtn
            icon="dice-multiple"
            label="Roll Dice"
            color="#10B981"
            onPress={() => doMove({ action: "roll_dice" })}
            disabled={!canAct}
          />
          {canManageProps && (
            <SecondaryBtn
              icon="city-variant"
              label="Manage"
              onPress={onManageProps}
            />
          )}
        </View>
      </View>
    );
  }

  // ── Inspection ──
  if (state.phase === "inspection") {
    return (
      <View style={ats.tray}>
        <View style={ats.btnRow}>
          <PrimaryBtn
            icon="cash"
            label="Pay $50"
            color="#EF4444"
            onPress={() =>
              doMove({ action: "pay_inspection_fine", amount: 50 })
            }
            disabled={!canAct || (myPlayer?.cash ?? 0) < 50}
          />
          {(myPlayer?.inspectionPasses ?? 0) > 0 && (
            <PrimaryBtn
              icon="card-account-details"
              label="Pass"
              color="#10B981"
              onPress={() => doMove({ action: "use_inspection_pass" })}
              disabled={!canAct}
            />
          )}
          <PrimaryBtn
            icon="dice-multiple"
            label="Roll"
            color="#6B7280"
            onPress={() => doMove({ action: "wait_in_inspection" })}
            disabled={!canAct}
          />
        </View>
      </View>
    );
  }

  // ── Buying decision ──
  if (state.phase === "buying_decision" && myPlayer) {
    const sp = BOARD_SPACES[myPlayer.position];
    let cost = 0;
    if (sp.type === "district")
      cost = getDistrictCard(sp.index)?.leaseCost ?? 0;
    else if (sp.type === "transit_line")
      cost = getTransitLineCard(sp.index)?.leaseCost ?? 200;
    else if (sp.type === "service_node")
      cost = getServiceNodeCard(sp.index)?.leaseCost ?? 150;

    return (
      <View style={ats.tray}>
        <View style={ats.btnRow}>
          <PrimaryBtn
            icon="home-plus"
            label={`Buy ${formatCash(cost)}`}
            color="#10B981"
            onPress={() => doMove({ action: "buy_property" })}
            disabled={!canAct || myPlayer.cash < cost}
          />
          <PrimaryBtn
            icon="gavel"
            label="Auction"
            color="#6B7280"
            onPress={() => doMove({ action: "decline_property" })}
            disabled={!canAct}
          />
        </View>
      </View>
    );
  }

  // ── Auction ──
  if (state.phase === "auction" && state.activeAuction) {
    const auction = state.activeAuction;
    const propName = BOARD_SPACES[auction.propertyIndex]?.name ?? "Property";
    return (
      <View style={ats.tray}>
        <View style={ats.infoBlock}>
          <Text style={[ats.infoLabel, { color: secondaryColor }]}>
            Auction: {propName}
          </Text>
          <Text style={[ats.infoValue, { color: textColor }]}>
            Bid: {formatCash(auction.currentBid)}
            {auction.currentBidder
              ? ` — ${getDisplayName(auction.currentBidder, players, myUid)}`
              : ""}
          </Text>
        </View>
        <View style={ats.btnRow}>
          <TextInput
            style={ats.bidInput}
            keyboardType="numeric"
            placeholder="Bid $"
            placeholderTextColor="#6B7280"
            value={bidAmount}
            onChangeText={setBidAmount}
          />
          <PrimaryBtn
            icon="gavel"
            label="Bid"
            color="#F59E0B"
            onPress={() => {
              const amt = parseInt(bidAmount, 10);
              if (amt > 0) {
                doMove({ action: "auction_bid", amount: amt });
                setBidAmount("");
              }
            }}
            disabled={!canAct}
          />
          <PrimaryBtn
            icon="hand-wave"
            label="Pass"
            color="#6B7280"
            onPress={() => doMove({ action: "auction_pass" })}
            disabled={!canAct}
          />
        </View>
      </View>
    );
  }

  // ── Trading ──
  if (state.phase === "trading" && state.activeTrade) {
    const trade = state.activeTrade;
    const from = getDisplayName(trade.fromUid, players, myUid);
    return (
      <View style={ats.tray}>
        <View style={ats.infoBlock}>
          <Text style={[ats.infoLabel, { color: secondaryColor }]}>
            Trade from {from}
          </Text>
          <View style={ats.tradeCols}>
            <View style={ats.tradeCol}>
              <Text style={[ats.tradeH, { color: "#4ADE80" }]}>Offer</Text>
              {trade.offeredProperties.map((idx) => (
                <Text key={idx} style={[ats.tradeItem, { color: textColor }]}>
                  {BOARD_SPACES[idx]?.name ?? `#${idx}`}
                </Text>
              ))}
              {trade.offeredCash > 0 && (
                <Text style={[ats.tradeItem, { color: "#4ADE80" }]}>
                  {formatCash(trade.offeredCash)}
                </Text>
              )}
              {trade.offeredInspectionPasses > 0 && (
                <Text style={[ats.tradeItem, { color: textColor }]}>
                  {trade.offeredInspectionPasses} Pass
                  {trade.offeredInspectionPasses > 1 ? "es" : ""}
                </Text>
              )}
            </View>
            <View style={ats.tradeDivider} />
            <View style={ats.tradeCol}>
              <Text style={[ats.tradeH, { color: "#EF4444" }]}>Want</Text>
              {trade.requestedProperties.map((idx) => (
                <Text key={idx} style={[ats.tradeItem, { color: textColor }]}>
                  {BOARD_SPACES[idx]?.name ?? `#${idx}`}
                </Text>
              ))}
              {trade.requestedCash > 0 && (
                <Text style={[ats.tradeItem, { color: "#EF4444" }]}>
                  {formatCash(trade.requestedCash)}
                </Text>
              )}
              {trade.requestedInspectionPasses > 0 && (
                <Text style={[ats.tradeItem, { color: textColor }]}>
                  {trade.requestedInspectionPasses} Pass
                  {trade.requestedInspectionPasses > 1 ? "es" : ""}
                </Text>
              )}
            </View>
          </View>
        </View>
        <View style={ats.btnRow}>
          <PrimaryBtn
            icon="check-circle"
            label="Accept"
            color="#10B981"
            onPress={() => doMove({ action: "accept_trade" })}
            disabled={!canAct}
          />
          <PrimaryBtn
            icon="close-circle"
            label="Reject"
            color="#EF4444"
            onPress={() => doMove({ action: "reject_trade" })}
            disabled={!canAct}
          />
        </View>
      </View>
    );
  }

  // ── Debt Resolution ──
  if (state.phase === "debt_resolution" && state.debtContext) {
    const debt = state.debtContext;
    const creditor = debt.creditorUid
      ? getDisplayName(debt.creditorUid, players, myUid)
      : "the bank";
    const canPay = (myPlayer?.cash ?? 0) >= debt.amount;
    return (
      <View style={ats.tray}>
        <View style={ats.debtBar}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={16}
            color="#EF4444"
          />
          <Text style={[ats.debtText, { color: textColor }]}>
            Owe {formatCash(debt.amount)} to {creditor}
          </Text>
        </View>
        <View style={ats.btnRow}>
          <PrimaryBtn
            icon="cash-check"
            label={`Pay ${formatCash(debt.amount)}`}
            color="#10B981"
            onPress={() => doMove({ action: "pay_debt" })}
            disabled={!canAct || !canPay}
          />
          {canManageProps && (
            <SecondaryBtn
              icon="city-variant"
              label="Manage"
              onPress={onManageProps}
            />
          )}
          <PrimaryBtn
            icon="skull"
            label="Bankrupt"
            color="#EF4444"
            onPress={() => doMove({ action: "declare_bankruptcy" })}
            disabled={!canAct}
          />
        </View>
      </View>
    );
  }

  // ── Post-roll (end turn) ──
  if (state.phase === "post_roll") {
    return (
      <View style={ats.tray}>
        <View style={ats.btnRow}>
          <PrimaryBtn
            icon="check-bold"
            label="End Turn"
            color="#10B981"
            onPress={() => doMove({ action: "end_turn" })}
            disabled={!canAct}
          />
          {canManageProps && (
            <SecondaryBtn
              icon="city-variant"
              label="Manage"
              onPress={onManageProps}
            />
          )}
        </View>
      </View>
    );
  }

  // ── Fallback ──
  return (
    <View style={ats.tray}>
      <Text style={[ats.waitText, { color: secondaryColor }]}>
        {state.phase.replace(/_/g, " ")}
      </Text>
    </View>
  );
}

function PrimaryBtn({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  color: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        ats.primaryBtn,
        { backgroundColor: color },
        disabled && { opacity: 0.35 },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name={icon} size={15} color="#FFF" />
      <Text style={ats.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryBtn({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={ats.secondaryBtn}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name={icon} size={13} color="#9CA3AF" />
      <Text style={ats.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const ats = StyleSheet.create({
  tray: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(12,18,34,0.98)",
    gap: 6,
    alignItems: "center",
  },
  waitText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 4,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: 12,
    minWidth: 90,
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  secondaryBtnText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  /* Auction */
  infoBlock: {
    width: "100%",
    gap: 2,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  bidInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    width: 80,
    fontSize: 13,
    fontWeight: "600",
    color: "#F3F4F6",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  /* Trade */
  tradeCols: {
    flexDirection: "row",
    gap: 0,
    marginTop: 2,
  },
  tradeCol: {
    flex: 1,
    gap: 1,
  },
  tradeH: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tradeDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 8,
  },
  tradeItem: {
    fontSize: 11,
    fontWeight: "500",
  },
  /* Debt */
  debtBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
    backgroundColor: "rgba(239,68,68,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
  },
  debtText: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
});

// =============================================================================
// Main Screen
// =============================================================================

function MetroMagnateInner({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  players,
  submitMove,
  actionLoading,
  actionError,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [selectedSpace, setSelectedSpace] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [viewPlayerUid, setViewPlayerUid] = useState<string | null>(null);

  const state = asState(publicState);
  const canAct = isMyTurn && !isTerminal && !actionLoading && !isSubmitting;

  const doMove = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!canAct) return;
      setIsSubmitting(true);
      try {
        await submitMove(payload);
      } finally {
        setIsSubmitting(false);
      }
    },
    [canAct, submitMove],
  );

  // ── Loading guard ──
  if (!state) {
    return (
      <View style={[ms.root, { backgroundColor: theme.colors.background }]}>
        <Text
          style={{
            color: theme.colors.textSecondary,
            textAlign: "center",
            marginTop: 40,
          }}
        >
          Loading…
        </Text>
      </View>
    );
  }

  const tc = theme.colors;
  const myPlayer = state.players.find((p) => p.uid === myUid);

  // Management flags
  const managementPhases = ["pre_roll", "post_roll"];
  const canManage = isMyTurn && managementPhases.includes(state.phase);
  const canSellOrMortgage =
    isMyTurn &&
    (managementPhases.includes(state.phase) ||
      state.phase === "debt_resolution");
  const canManageProps =
    (canManage || canSellOrMortgage) &&
    (myPlayer?.ownedProperties.length ?? 0) > 0;

  return (
    <View style={[ms.root, { backgroundColor: tc.background }]}>
      {/* ── Header bar ── */}
      <View style={ms.header}>
        <View style={ms.headerLeft}>
          <MaterialCommunityIcons
            name="city-variant-outline"
            size={12}
            color="#FFD700"
          />
          <Text style={ms.headerTitle} numberOfLines={1}>
            METRO MAGNATE
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowHelp(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={ms.helpBtn}
        >
          <MaterialCommunityIcons
            name="help-circle-outline"
            size={14}
            color={tc.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Player Strip ── */}
      <PlayerStrip
        state={state}
        turnOrder={turnOrder}
        players={players}
        myUid={myUid}
        textColor={tc.text}
        secondaryColor={tc.textSecondary}
        surfaceColor={tc.surface}
        borderColor={tc.border}
        onPlayerPress={setViewPlayerUid}
      />

      {/* ── Board ── */}
      <View style={ms.boardWrapper}>
        <MetroMagnateBoard
          state={state}
          myUid={myUid}
          turnOrder={turnOrder}
          players={players}
          metrics={BOARD_METRICS}
          onSpacePress={setSelectedSpace}
          textColor={tc.text}
          surfaceColor={tc.surface}
          secondaryColor={tc.textSecondary}
          isMyTurn={isMyTurn}
        />
      </View>

      {/* Spacer pushes action tray to bottom */}
      <View style={{ flex: 1 }} />

      {/* ── Error Banner ── */}
      {actionError ? (
        <View style={ms.errorBar}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={13}
            color="#EF4444"
          />
          <Text style={ms.errorText} numberOfLines={2}>
            {actionError}
          </Text>
        </View>
      ) : null}

      {/* ── Action Tray (bottom) ── */}
      <ActionTray
        state={state}
        isMyTurn={isMyTurn}
        canAct={canAct}
        doMove={doMove}
        myPlayer={myPlayer}
        bidAmount={bidAmount}
        setBidAmount={setBidAmount}
        players={players}
        myUid={myUid}
        turnOrder={turnOrder}
        actionLoading={actionLoading}
        textColor={tc.text}
        secondaryColor={tc.textSecondary}
        canManageProps={canManageProps}
        onManageProps={() => setShowProps(true)}
      />

      {/* ── Property Management Panel ── */}
      {myPlayer && (
        <PropertyPanel
          visible={showProps}
          onClose={() => setShowProps(false)}
          state={state}
          myPlayer={myPlayer}
          myUid={myUid}
          canManage={canManage}
          canSellOrMortgage={canSellOrMortgage}
          canAct={canAct}
          doMove={doMove}
          textColor={tc.text}
          secondaryColor={tc.textSecondary}
          surfaceColor={tc.surface}
          turnOrder={turnOrder}
        />
      )}

      {/* ── Modals ── */}
      <AssetDetailModal
        spaceIndex={selectedSpace}
        state={state}
        turnOrder={turnOrder}
        players={players}
        myUid={myUid}
        onClose={() => setSelectedSpace(null)}
        textColor={tc.text}
        surfaceColor={tc.surface}
        secondaryColor={tc.textSecondary}
      />
      <HelpModal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
        textColor={tc.text}
        surfaceColor={tc.surface}
        secondaryColor={tc.textSecondary}
      />
      <PlayerPortfolioModal
        uid={viewPlayerUid}
        state={state}
        turnOrder={turnOrder}
        players={players}
        myUid={myUid}
        onClose={() => setViewPlayerUid(null)}
        textColor={tc.text}
        surfaceColor={tc.surface}
        secondaryColor={tc.textSecondary}
      />
    </View>
  );
}

// =============================================================================
// Main Styles
// =============================================================================

const ms = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 0,
    height: 18,
    backgroundColor: "rgba(12,18,34,0.95)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,215,0,0.12)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFD700",
    letterSpacing: 1.2,
  },
  helpBtn: {
    padding: 4,
  },
  boardWrapper: {
    alignItems: "center",
    paddingTop: 0,
  },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239,68,68,0.08)",
    marginHorizontal: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
    marginBottom: 2,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
});

export default withGameV4Shell(MetroMagnateInner, "metro_magnate");
