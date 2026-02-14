/**
 * Trigger system — manages when animations/VFX should fire.
 */
import type { TriggerType } from "../types/schema";

export interface TriggerState {
  active: boolean;
  /** For "interval" triggers: time until next fire */
  nextFire: number;
  /** For "onClick"/"onTap" triggers: time remaining in burst */
  burstRemaining: number;
}

export class TriggerManager {
  private states: Map<string, TriggerState> = new Map();
  private globalClicked = false;
  private globalCollecting = false;

  /**
   * Register a trigger with a unique key.
   */
  register(
    key: string,
    trigger: TriggerType,
    params?: Record<string, unknown>,
  ): void {
    const state: TriggerState = {
      active: trigger === "always",
      nextFire:
        trigger === "interval" ? ((params?.interval as number) ?? 5) : 0,
      burstRemaining: 0,
    };
    this.states.set(key, state);
  }

  /** Fire an onClick/onTap trigger globally (user clicked the module). */
  fireClick(): void {
    this.globalClicked = true;
    for (const [key, state] of this.states) {
      if (key.includes("onClick") || key.includes("onTap")) {
        state.active = true;
        state.burstRemaining = 0.3; // 300ms burst
      }
    }
  }

  /** Set collecting state */
  setCollecting(active: boolean): void {
    this.globalCollecting = active;
    for (const [key, state] of this.states) {
      if (key.includes("onCollect")) {
        state.active = active;
      }
    }
  }

  /** Fire a burst trigger */
  fireBurst(): void {
    for (const [key, state] of this.states) {
      if (key.includes("onBurst")) {
        state.active = true;
        state.burstRemaining = 0.5;
      }
    }
  }

  /** Update triggers each frame. */
  update(dt: number): void {
    this.globalClicked = false;

    for (const [key, state] of this.states) {
      // Interval triggers
      if (key.includes("interval")) {
        state.nextFire -= dt;
        if (state.nextFire <= 0) {
          state.active = true;
          // Will be reset by the consumer
        }
      }

      // Burst timers
      if (state.burstRemaining > 0) {
        state.burstRemaining -= dt;
        if (state.burstRemaining <= 0) {
          state.active = false;
          state.burstRemaining = 0;
        }
      }
    }
  }

  /** Check if a trigger is active. "always" triggers always return true. */
  isActive(key: string): boolean {
    const state = this.states.get(key);
    return state?.active ?? false;
  }

  /** Reset an interval trigger after it fires. */
  resetInterval(key: string, interval: number): void {
    const state = this.states.get(key);
    if (state) {
      state.active = false;
      state.nextFire = interval;
    }
  }
}
