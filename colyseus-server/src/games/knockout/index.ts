/**
 * Knockout — Auto-Registration Module
 *
 * Importing this module registers the Knockout game definition in the GameRegistry.
 *
 * @module games/knockout
 */

import { registerRealtimeGame } from "../../core/GameRegistry";
import { KNOCKOUT_DEFINITION } from "./Definition";

export { KNOCKOUT_DEFINITION } from "./Definition";
export { KnockoutRoom } from "./Room";

registerRealtimeGame(KNOCKOUT_DEFINITION);
