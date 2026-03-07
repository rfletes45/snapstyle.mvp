/**
 * Games V4 — Solitaire Klondike Screen (Shell Wrapper)
 *
 * Thin entry point that wraps the game component with the V4 shell.
 *
 * @module gamesV4/screens/SolitaireKlondikeScreenV4
 */

import { withGameV4Shell } from "@/gamesV4/components/GameScreenShell";
import SolitaireKlondikeGame from "./solitaireKlondike/SolitaireKlondikeGame";

export default withGameV4Shell(SolitaireKlondikeGame, "solitaire_klondike");
