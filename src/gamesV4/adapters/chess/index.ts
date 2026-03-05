/**
 * Games V4 — Chess Adapter Barrel Export
 *
 * Importing this module auto-registers the chess adapter.
 *
 * @module gamesV4/adapters/chess/index
 */

export { default } from "./chessAdapter";
export type {
  ChessMovePayload,
  ChessPublicStateV1,
  Piece,
  PromotionPiece,
  Square,
} from "./chessTypes";
