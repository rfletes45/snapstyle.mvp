/**
 * Sketch Party — Game Module Index
 *
 * Registers the Sketch Party game with the realtime framework.
 *
 * @module games/sketch_party
 */

import { registerRealtimeGame } from "../../core/GameRegistry";
import { SKETCH_PARTY_DEFINITION } from "./Definition";

export { SKETCH_PARTY_DEFINITION } from "./Definition";
export { SketchPartyRoomV2 } from "./Room";

// Auto-register on import
registerRealtimeGame(SKETCH_PARTY_DEFINITION);
