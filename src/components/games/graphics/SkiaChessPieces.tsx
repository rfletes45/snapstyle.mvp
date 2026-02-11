/**
 * SkiaChessPieces — SVG chess piece rendering
 *
 * Renders chess pieces as clean SVG paths with gradients and subtle shadows.
 * Replaces Unicode symbols (♔♕♖♗♘♙) with crisp vector artwork.
 */

import React from "react";
import Svg, {
  Defs,
  G,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";

interface ChessPieceProps {
  /** "king" | "queen" | "rook" | "bishop" | "knight" | "pawn" */
  type: string;
  /** "white" | "black" */
  color: string;
  /** Size of the bounding box */
  size: number;
}

// SVG path data for each chess piece — designed at 45×45 viewBox
const PIECE_PATHS: Record<string, string> = {
  king: "M22.5 11.63V6M20 8h5M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7",
  queen:
    "M8 12a2 2 0 11-4 0 2 2 0 014 0zM24.5 7.5a2 2 0 11-4 0 2 2 0 014 0zM41 12a2 2 0 11-4 0 2 2 0 014 0zM16 8.5a2 2 0 11-4 0 2 2 0 014 0zM33 9a2 2 0 11-4 0 2 2 0 014 0zM9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-3.5-7-5 6.5-5-6.5-3.5 7-7.5-13.5L9 26zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5s0-2.5.5-3.5c1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z",
  rook: "M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5M34 14l-3 3H14l-3-3M15 17v7h15v-7M12 25s0 4 2.5 6.5c0 0 .5 1.5-1 2.5H31c-1.5-1-1-2.5-1-2.5C32.5 29 33 25 33 25",
  bishop:
    "M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
  knight:
    "M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3",
  pawn: "M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z",
};

export function SkiaChessPieces({ type, color, size }: ChessPieceProps) {
  const isWhite = color === "white";
  const fillId = `fill_${type}_${color}`;
  const gradColors = isWhite
    ? { from: "#FFFFFF", to: "#E8E0D0" }
    : { from: "#3A3A3A", to: "#1A1A1A" };
  const strokeColor = isWhite ? "#555555" : "#000000";

  const path = PIECE_PATHS[type];
  if (!path) return null;

  // Scale factor from 45×45 viewBox to desired size
  const scale = size / 45;

  return (
    <Svg width={size} height={size} viewBox="0 0 45 45">
      <Defs>
        <SvgLinearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={gradColors.from} />
          <Stop offset="100%" stopColor={gradColors.to} />
        </SvgLinearGradient>
      </Defs>
      <G transform={`scale(1)`}>
        <Path
          d={path}
          fill={`url(#${fillId})`}
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}
