/**
 * Games V4 — 2048 Game Screen
 *
 * Polished, mobile-first 2048 with smooth tile animations.
 * Wrapped by the V4 GameScreenShell for solo session management.
 *
 * @module gamesV4/screens/Play2048ScreenV4
 */

import { withGameV4Shell } from "@/gamesV4/components/GameScreenShell";
import Play2048Game from "./play2048/Play2048Game";

export default withGameV4Shell(Play2048Game, "play_2048");
