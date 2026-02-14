/**
 * Input queue — collects InputCommands to be consumed by the game loop.
 * No Three.js. Minimal DOM awareness (just types).
 */
import type { InputCommand } from "../sim/types";

export class InputQueue {
  private queue: InputCommand[] = [];

  /** Enqueue a command. */
  push(cmd: InputCommand): void {
    this.queue.push(cmd);
  }

  /** Drain all commands whose atTick <= currentTick (sorted by atTick). */
  drain(currentTick: number): InputCommand[] {
    const ready: InputCommand[] = [];
    const keep: InputCommand[] = [];
    for (const cmd of this.queue) {
      if (cmd.atTick <= currentTick) {
        ready.push(cmd);
      } else {
        keep.push(cmd);
      }
    }
    this.queue = keep;
    ready.sort((a, b) => a.atTick - b.atTick);
    return ready;
  }

  /** Number of pending commands. */
  get length(): number {
    return this.queue.length;
  }
}
