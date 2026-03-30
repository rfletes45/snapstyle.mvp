/**
 * Stream utility helpers shared across call services.
 */

import type { AudioOutput } from "@/types/call";

/** Map app AudioOutput values to Stream-compatible default_device. */
export function toStreamDevice(output: AudioOutput): "speaker" | "earpiece" {
  return output === "earpiece" ? "earpiece" : "speaker";
}
