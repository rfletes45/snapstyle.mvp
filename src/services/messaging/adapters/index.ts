/**
 * Message Adapters
 *
 * Convert between message formats for backward compatibility.
 * These adapters allow the unified messaging system to work with
 * both legacy GroupMessage format and the new MessageV2 format.
 *
 * @module services/messaging/adapters
 *
 * @example
 * ```typescript
 * import {
 *   fromGroupMessage,
 *   isLegacyGroupMessage,
 *   isMessageV2,
 * } from "@/services/messaging/adapters";
 *
 * // Check message format and convert if needed
 * if (isLegacyGroupMessage(data)) {
 *   const v2Message = fromGroupMessage(data);
 *   // Use v2Message...
 * } else if (isMessageV2(data)) {
 *   // Already V2 format
 * }
 * ```
 */

// Group message adapters
export {
  fromGroupMessage,
  fromGroupMessages,
  isLegacyGroupMessage,
  isMessageV2,
  toGroupMessage,
} from "./groupAdapter";
