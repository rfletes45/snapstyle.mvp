/**
 * Pong — Auto-Registration Module
 *
 * Importing this module registers the Pong game definition in the GameRegistry.
 *
 * @module games/pong
 */

import { registerRealtimeGame } from "../../core/GameRegistry";
import { PONG_DEFINITION } from "./Definition";

export { PONG_DEFINITION } from "./Definition";
export { PongRoom } from "./Room";

registerRealtimeGame(PONG_DEFINITION);
