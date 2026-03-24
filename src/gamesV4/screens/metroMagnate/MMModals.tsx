/**
 * Metro Magnate — Modals
 *
 * AssetDetailModal: Full property card shown when tapping a board space.
 * HelpModal: Concise in-game rules quick-reference.
 *
 * @module gamesV4/screens/metroMagnate/MMModals
 */

import {
  BOARD_SPACES,
  CIVIC_FEE_AMOUNTS,
  getDistrictCard,
  getSector,
  getServiceNodeCard,
  getTransitLineCard,
} from "@/gamesV4/adapters/metroMagnate/metroMagnateBoard";
import type { MetroMagnatePublicState } from "@/gamesV4/adapters/metroMagnate/metroMagnateTypes";
import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  formatCash,
  getDisplayName,
  getImpLevel,
  getPlayerColor,
  getSpaceAccent,
  getSpaceOwner,
  impLabel,
  isMortgagedProp,
} from "./mmConstants";

// =============================================================================
// Asset Detail Modal
// =============================================================================

interface AssetDetailModalProps {
  spaceIndex: number | null;
  state: MetroMagnatePublicState;
  turnOrder: string[];
  players: GameShellProps["players"];
  myUid: string;
  onClose: () => void;
  textColor: string;
  surfaceColor: string;
  secondaryColor: string;
}

export function AssetDetailModal({
  spaceIndex,
  state,
  turnOrder,
  players,
  myUid,
  onClose,
  textColor,
  surfaceColor,
  secondaryColor,
}: AssetDetailModalProps) {
  if (spaceIndex === null) return null;

  const space = BOARD_SPACES[spaceIndex];
  if (!space) return null;

  const accent = getSpaceAccent(space.type, space.sectorId);
  const owner = getSpaceOwner(state, spaceIndex);
  const impLevel = getImpLevel(state, spaceIndex);
  const mortgaged = isMortgagedProp(state, spaceIndex);
  const sector = space.sectorId ? getSector(space.sectorId) : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: surfaceColor }]}>
          {/* Accent strip */}
          <View style={[s.accentStrip, { backgroundColor: accent }]} />

          <ScrollView
            style={s.sheetScroll}
            contentContainerStyle={s.sheetContent}
          >
            {/* Header */}
            <Text style={[s.sheetTitle, { color: textColor }]}>
              {space.name}
            </Text>
            {sector && (
              <View style={s.sectorRow}>
                <View style={[s.sectorDot, { backgroundColor: accent }]} />
                <Text style={[s.sectorLabel, { color: secondaryColor }]}>
                  {sector.name}
                </Text>
              </View>
            )}
            {!sector && (
              <Text style={[s.typeLabel, { color: secondaryColor }]}>
                {spaceTypeLabel(space.type)}
              </Text>
            )}

            {/* District card */}
            {space.type === "district" &&
              renderDistrict(spaceIndex, impLevel, textColor, secondaryColor)}

            {/* Transit line card */}
            {space.type === "transit_line" &&
              renderTransit(spaceIndex, textColor, secondaryColor)}

            {/* Service node card */}
            {space.type === "service_node" &&
              renderService(spaceIndex, textColor, secondaryColor)}

            {/* Special space descriptions */}
            {space.type === "central_terminal" && (
              <Text style={[s.desc, { color: secondaryColor }]}>
                Pass or land here to collect $200 salary.
              </Text>
            )}
            {space.type === "civic_fee" && (
              <Text style={[s.desc, { color: secondaryColor }]}>
                Pay {formatCash(CIVIC_FEE_AMOUNTS[spaceIndex] ?? 200)} to the
                city.
              </Text>
            )}
            {space.type === "market_shift" && (
              <Text style={[s.desc, { color: secondaryColor }]}>
                Draw a Market Shift card — gain cash, pay fees, or move to a new
                location.
              </Text>
            )}
            {space.type === "city_brief" && (
              <Text style={[s.desc, { color: secondaryColor }]}>
                Draw a City Brief card — receive grants, pay levies, or advance
                around the board.
              </Text>
            )}
            {space.type === "plaza" && (
              <Text style={[s.desc, { color: secondaryColor }]}>
                Grand Plaza — collect the accumulated Civic Fee pot (currently{" "}
                {formatCash(state.plazaPot)}).
              </Text>
            )}
            {space.type === "inspection_hold" && (
              <Text style={[s.desc, { color: secondaryColor }]}>
                Inspection Hold — Pay $50 fine, use an Inspection Pass, or try
                to roll doubles to leave.
              </Text>
            )}
            {space.type === "detour_to_inspection" && (
              <Text style={[s.desc, { color: secondaryColor }]}>
                Detour — go directly to Inspection Hold.
              </Text>
            )}

            {/* Ownership & status */}
            {owner && (
              <View style={s.ownerRow}>
                <View
                  style={[
                    s.ownerDot,
                    { backgroundColor: getPlayerColor(owner, turnOrder) },
                  ]}
                />
                <Text style={[s.ownerText, { color: textColor }]}>
                  Owner: {getDisplayName(owner, players, myUid)}
                </Text>
              </View>
            )}
            {impLevel > 0 && (
              <Text style={[s.impText, { color: "#FBBF24" }]}>
                Level: {impLabel(impLevel)}
              </Text>
            )}
            {mortgaged && (
              <Text style={[s.impText, { color: "#EF4444" }]}>Mortgaged</Text>
            )}
          </ScrollView>

          {/* Close */}
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function renderDistrict(
  spaceIndex: number,
  currentLevel: number,
  textColor: string,
  secondaryColor: string,
) {
  const card = getDistrictCard(spaceIndex);
  if (!card) return null;

  const rentLabels = [
    "Base rent",
    "1 Storefront",
    "2 Storefronts",
    "3 Storefronts",
    "4 Storefronts",
    "Tower",
  ];

  return (
    <View style={s.infoBlock}>
      <InfoRow
        label="Lease Cost"
        value={formatCash(card.leaseCost)}
        text={textColor}
        dim={secondaryColor}
      />
      <InfoRow
        label="Mortgage Value"
        value={formatCash(card.mortgageValue)}
        text={textColor}
        dim={secondaryColor}
      />

      <Text style={[s.subHeading, { color: textColor }]}>Rent Ladder</Text>
      {card.rentLadder.map((rent, i) => (
        <View
          key={i}
          style={[s.rentRow, i === currentLevel && s.rentRowActive]}
        >
          <Text
            style={[
              s.rentLabel,
              { color: i === currentLevel ? textColor : secondaryColor },
            ]}
          >
            {rentLabels[i]}
          </Text>
          <Text
            style={[
              s.rentValue,
              { color: i === currentLevel ? "#4ADE80" : secondaryColor },
            ]}
          >
            {formatCash(rent)}
          </Text>
        </View>
      ))}

      <InfoRow
        label="Improvement Cost"
        value={`${formatCash(card.improvementCost)} each`}
        text={textColor}
        dim={secondaryColor}
      />
      <InfoRow
        label="Tower Cost"
        value={formatCash(card.towerCost)}
        text={textColor}
        dim={secondaryColor}
      />
    </View>
  );
}

function renderTransit(
  spaceIndex: number,
  textColor: string,
  secondaryColor: string,
) {
  const card = getTransitLineCard(spaceIndex);
  if (!card) return null;

  return (
    <View style={s.infoBlock}>
      <InfoRow
        label="Lease Cost"
        value={formatCash(card.leaseCost)}
        text={textColor}
        dim={secondaryColor}
      />
      <InfoRow
        label="Mortgage Value"
        value={formatCash(card.mortgageValue)}
        text={textColor}
        dim={secondaryColor}
      />
      <Text style={[s.subHeading, { color: textColor }]}>
        Rent by Lines Owned
      </Text>
      {card.rentByCount.map((rent, i) => (
        <View key={i} style={s.rentRow}>
          <Text style={[s.rentLabel, { color: secondaryColor }]}>
            {i + 1} line{i > 0 ? "s" : ""}
          </Text>
          <Text style={[s.rentValue, { color: secondaryColor }]}>
            {formatCash(rent)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function renderService(
  spaceIndex: number,
  textColor: string,
  secondaryColor: string,
) {
  const card = getServiceNodeCard(spaceIndex);
  if (!card) return null;

  return (
    <View style={s.infoBlock}>
      <InfoRow
        label="Lease Cost"
        value={formatCash(card.leaseCost)}
        text={textColor}
        dim={secondaryColor}
      />
      <InfoRow
        label="Mortgage Value"
        value={formatCash(card.mortgageValue)}
        text={textColor}
        dim={secondaryColor}
      />
      <Text style={[s.subHeading, { color: textColor }]}>Rent Multiplier</Text>
      {card.multiplierByCount.map((mult, i) => (
        <View key={i} style={s.rentRow}>
          <Text style={[s.rentLabel, { color: secondaryColor }]}>
            {i + 1} node{i > 0 ? "s" : ""}
          </Text>
          <Text style={[s.rentValue, { color: secondaryColor }]}>
            {mult}× dice roll
          </Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({
  label,
  value,
  text,
  dim,
}: {
  label: string;
  value: string;
  text: string;
  dim: string;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={[s.infoLabel, { color: dim }]}>{label}</Text>
      <Text style={[s.infoValue, { color: text }]}>{value}</Text>
    </View>
  );
}

function spaceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    central_terminal: "Central Terminal",
    transit_line: "Transit Line",
    service_node: "Service Node",
    market_shift: "Market Shift",
    city_brief: "City Brief",
    civic_fee: "Civic Fee",
    plaza: "Grand Plaza",
    inspection_hold: "Inspection Hold",
    detour_to_inspection: "Detour to Inspection",
  };
  return map[type] ?? type;
}

// =============================================================================
// Help Modal
// =============================================================================

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
  textColor: string;
  surfaceColor: string;
  secondaryColor: string;
}

export function HelpModal({
  visible,
  onClose,
  textColor,
  surfaceColor,
  secondaryColor,
}: HelpModalProps) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.helpSheet, { backgroundColor: surfaceColor }]}>
          <View style={s.helpHeader}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={20}
              color={textColor}
            />
            <Text style={[s.helpTitle, { color: textColor }]}>
              Metro Magnate — Quick Rules
            </Text>
          </View>

          <ScrollView
            style={s.helpScroll}
            contentContainerStyle={s.helpContent}
          >
            <HelpSection
              title="Goal"
              body="Be the last player standing, or have the highest net worth when all others go bankrupt."
              text={textColor}
              dim={secondaryColor}
            />
            <HelpSection
              title="Turns"
              body="Roll dice and move clockwise around 36 spaces. Doubles let you roll again (3 doubles = Inspection Hold). Pass Central Terminal to collect $200."
              text={textColor}
              dim={secondaryColor}
            />
            <HelpSection
              title="Districts"
              body="Buy when you land, or it goes to auction. Own all 3 in a sector to build improvements (1–4 Storefronts → 1 Tower). Improvements increase rent dramatically."
              text={textColor}
              dim={secondaryColor}
            />
            <HelpSection
              title="Transit Lines"
              body="Own more lines = higher rent. 1 line: $25 → 4 lines: $200."
              text={textColor}
              dim={secondaryColor}
            />
            <HelpSection
              title="Service Nodes"
              body="Rent = dice roll × multiplier. 1 node: ×4, 2 nodes: ×10."
              text={textColor}
              dim={secondaryColor}
            />
            <HelpSection
              title="Special Spaces"
              body={
                "• Central Terminal — collect $200\n" +
                "• Civic Fee — pay $100 or $200\n" +
                "• Market Shift / City Brief — draw a card\n" +
                "• Grand Plaza — collect the tax pot\n" +
                "• Inspection Hold — pay $50 fine, use pass, or roll doubles"
              }
              text={textColor}
              dim={secondaryColor}
            />
            <HelpSection
              title="Mortgages & Debt"
              body="Mortgage properties for quick cash (half lease cost). Unmortgage costs mortgage value + 10% fee. If you can't pay rent, sell improvements or mortgage properties. If still short, declare bankruptcy."
              text={textColor}
              dim={secondaryColor}
            />
            <HelpSection
              title="Trading"
              body="Propose trades during your turn: swap properties, cash, and Inspection Passes with other players."
              text={textColor}
              dim={secondaryColor}
            />
          </ScrollView>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function HelpSection({
  title,
  body,
  text,
  dim,
}: {
  title: string;
  body: string;
  text: string;
  dim: string;
}) {
  return (
    <View style={s.helpSection}>
      <Text style={[s.helpSectionTitle, { color: text }]}>{title}</Text>
      <Text style={[s.helpSectionBody, { color: dim }]}>{body}</Text>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const s = StyleSheet.create({
  /* Shared modal backdrop */
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },

  /* Asset detail sheet */
  sheet: {
    maxHeight: "75%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  accentStrip: {
    height: 5,
    width: "100%",
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  sectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  sectorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectorLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },

  /* Info block */
  infoBlock: {
    marginTop: 16,
    gap: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  subHeading: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  rentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  rentRowActive: {
    backgroundColor: "rgba(74,222,128,0.12)",
  },
  rentLabel: {
    fontSize: 13,
  },
  rentValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* Owner section */
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  ownerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ownerText: {
    fontSize: 14,
    fontWeight: "600",
  },
  impText: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
    marginLeft: 20,
  },

  /* Close button */
  closeBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#60A5FA",
  },

  /* Help modal */
  helpSheet: {
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  helpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  helpScroll: {
    flexShrink: 1,
  },
  helpContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  helpSection: {
    marginBottom: 14,
  },
  helpSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  helpSectionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
});
