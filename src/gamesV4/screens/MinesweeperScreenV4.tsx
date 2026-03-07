/**
 * Games V4 — Minesweeper Game Screen
 *
 * Wraps MinesweeperGame with the V4 GameScreenShell for solo session management.
 *
 * @module gamesV4/screens/MinesweeperScreenV4
 */

import { withGameV4Shell } from "@/gamesV4/components/GameScreenShell";
import MinesweeperGame from "./minesweeper/MinesweeperGame";

export default withGameV4Shell(MinesweeperGame, "minesweeper");
