/**
 * Battleship UI — Semantic Design Tokens
 *
 * Maps the app's global theme tokens into Battleship-specific semantic
 * tokens so the game can be re-skinned without rewriting UI code.
 *
 * Usage:
 *   const t = useBattleshipTheme();
 *   <View style={{ backgroundColor: t.boardBackground }} />
 *
 * @module gamesV4/screens/battleship/battleshipTheme
 */

import type { AppTheme, ThemeColors } from "@/constants/theme";
import {
  BorderRadius,
  Elevation,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import { useMemo } from "react";

// =============================================================================
// Semantic Token Interface
// =============================================================================

export interface BattleshipTokens {
  // ── Board ──
  boardBackground: string;
  boardStroke: string;
  boardCardBg: string;
  gridLine: string;
  gridLineFaint: string;
  coordinateText: string;

  // ── Cells ──
  cellEmpty: string;
  cellShip: string;
  cellHover: string;
  cellSelected: string;
  cellSelectedBorder: string;
  cellPressedOverlay: string;

  // ── Markers ──
  markerMiss: string;
  markerMissRing: string;
  markerHit: string;
  markerHitGlow: string;
  markerSunk: string;
  markerSunkText: string;

  // ── Banners ──
  bannerMyTurn: string;
  bannerMyTurnText: string;
  bannerOpponentTurn: string;
  bannerOpponentTurnText: string;
  bannerNeutral: string;
  bannerNeutralText: string;
  bannerWin: string;
  bannerWinText: string;
  bannerLose: string;
  bannerLoseText: string;

  // ── Event ribbon ──
  ribbonBg: string;
  ribbonText: string;
  ribbonHitBg: string;
  ribbonMissBg: string;
  ribbonSunkBg: string;

  // ── Setup ──
  setupCardBg: string;
  setupCardBorder: string;
  setupCardSelectedBorder: string;
  setupCardPlacedBg: string;
  setupGhostValid: string;
  setupGhostInvalid: string;

  // ── Buttons ──
  fireBtnBg: string;
  fireBtnText: string;
  fireBtnDisabledBg: string;
  confirmBtnBg: string;
  confirmBtnText: string;
  cancelBtnBg: string;
  cancelBtnText: string;

  // ── Surface / Layout ──
  screenBg: string;
  surfacePrimary: string;
  surfaceSecondary: string;
  headerBg: string;
  headerText: string;
  tabActiveTint: string;
  tabInactiveTint: string;
  tabIndicator: string;
  divider: string;

  // ── Text ──
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;

  // ── Status Colors ──
  statusSuccess: string;
  statusWarning: string;
  statusError: string;
  statusInfo: string;

  // ── Misc ──
  isDark: boolean;
  colors: ThemeColors;
}

// =============================================================================
// Token Builder
// =============================================================================

function buildTokens(theme: AppTheme): BattleshipTokens {
  const { colors, isDark } = theme;

  // Derive tinted naval colors from theme palette
  const boardBg = isDark ? "#0D1B2A" : "#E8F0FE";
  const boardCardBg = isDark ? "#1B2838" : "#FFFFFF";
  const gridLine = isDark ? "#2A3F55" : "#B0C4DE";
  const gridLineFaint = isDark ? "#1E3045" : "#D0DCE8";
  const cellEmptyColor = isDark ? "#162233" : "#E0EAF5";
  const coordText = isDark ? "#6B8299" : "#7A93A8";

  return {
    // Board
    boardBackground: boardBg,
    boardStroke: isDark ? "#2A3F55" : "#90A4AE",
    boardCardBg,
    gridLine,
    gridLineFaint,
    coordinateText: coordText,

    // Cells
    cellEmpty: cellEmptyColor,
    cellShip: isDark ? "#3A7BD5" : "#4A90D9",
    cellHover: isDark ? "#1E3A5F" : "#D6E8FF",
    cellSelected: "#FF9500",
    cellSelectedBorder: "#FFB340",
    cellPressedOverlay: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",

    // Markers
    markerMiss: isDark ? "#546E7A" : "#90A4AE",
    markerMissRing: isDark ? "#78909C" : "#B0BEC5",
    markerHit: "#FF3B30",
    markerHitGlow: "rgba(255,59,48,0.35)",
    markerSunk: "#B71C1C",
    markerSunkText: "#FFD54F",

    // Banners
    bannerMyTurn: colors.success,
    bannerMyTurnText: "#FFFFFF",
    bannerOpponentTurn: isDark ? "#2A3040" : "#E0E0E0",
    bannerOpponentTurnText: isDark ? "#B0B8C4" : "#555555",
    bannerNeutral: isDark ? "#2A3040" : "#F0F0F0",
    bannerNeutralText: isDark ? "#9AA0AA" : "#666666",
    bannerWin: colors.success,
    bannerWinText: "#FFFFFF",
    bannerLose: colors.error,
    bannerLoseText: "#FFFFFF",

    // Event ribbon
    ribbonBg: isDark ? "#1A2235" : "#FFF8E1",
    ribbonText: isDark ? "#B0B8C4" : "#5D4037",
    ribbonHitBg: isDark ? "#3D1515" : "#FFEBEE",
    ribbonMissBg: isDark ? "#1A2235" : "#E3F2FD",
    ribbonSunkBg: isDark ? "#4A1010" : "#FCE4EC",

    // Setup
    setupCardBg: isDark ? "#1B2838" : "#FFFFFF",
    setupCardBorder: isDark ? "#2A3F55" : "#D0D8E0",
    setupCardSelectedBorder: colors.primary,
    setupCardPlacedBg: isDark ? "#1A3A1A" : "#E8F5E9",
    setupGhostValid: "rgba(74,144,217,0.35)",
    setupGhostInvalid: "rgba(255,59,48,0.35)",

    // Buttons
    fireBtnBg: "#FF3B30",
    fireBtnText: "#FFFFFF",
    fireBtnDisabledBg: isDark ? "#3A3A3A" : "#CCCCCC",
    confirmBtnBg: colors.primary,
    confirmBtnText: colors.onPrimary,
    cancelBtnBg: isDark ? "#333333" : "#E0E0E0",
    cancelBtnText: isDark ? "#CCCCCC" : "#555555",

    // Surface / Layout
    screenBg: colors.background,
    surfacePrimary: colors.surface,
    surfaceSecondary: isDark ? "#1A2235" : "#F5F7FA",
    headerBg: isDark ? "rgba(13,27,42,0.92)" : "rgba(255,255,255,0.92)",
    headerText: colors.text,
    tabActiveTint: colors.primary,
    tabInactiveTint: isDark ? "#6B7280" : "#9CA3AF",
    tabIndicator: colors.primary,
    divider: colors.divider,

    // Text
    textPrimary: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    textOnAccent: "#FFFFFF",

    // Status
    statusSuccess: colors.success,
    statusWarning: colors.warning,
    statusError: colors.error,
    statusInfo: colors.info,

    // Misc
    isDark,
    colors,
  };
}

// =============================================================================
// React Hook
// =============================================================================

/**
 * Returns memoized Battleship semantic design tokens derived from the
 * current app theme. Use this in every Battleship component instead of
 * accessing theme.colors directly.
 */
export function useBattleshipTheme(): BattleshipTokens {
  const { theme } = useAppTheme();
  return useMemo(() => buildTokens(theme), [theme]);
}

// =============================================================================
// Layout Constants
// =============================================================================

export const BS = {
  spacing: Spacing,
  radius: BorderRadius,
  fonts: FontSizes,
  fontWeights: FontWeights,
  elevation: Elevation,

  /** Minimum touch target (Apple HIG / Material 48dp) */
  minTouchTarget: 44,

  /** Grid padding inside BoardCard */
  gridPadding: 8,

  /** Coordinate rail width */
  coordinateRailWidth: 22,

  /** Header height (excluding safe-area inset) */
  headerHeight: 48,

  /** Phase chip height */
  phaseChipHeight: 26,

  /** Tab bar height */
  tabBarHeight: 44,

  /** Event ribbon height */
  ribbonHeight: 36,
} as const;
