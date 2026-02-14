import type {
  BaitDefinition,
  FishDefinition,
  FishingSnapshot,
  MinigameSnapshot,
  RodDefinition,
  ZoneId
} from "../types";
import { rollFish } from "../logic/fishRoll";
import { applySturdinessToMovement, computeBarOverlap, updateCatchProgress } from "../logic/minigameMath";
import { clamp, randomRange } from "../../utils/math";

interface MinigameRuntimeState {
  fish: FishDefinition;
  progress: number;
  userBarX: number;
  userBarWidth: number;
  userVelocity: number;
  targetX: number;
  targetWidth: number;
  targetVelocity: number;
  targetDirectionTimer: number;
  escapeTimerSeconds: number;
  overlap: boolean;
  missGraceSeconds: number;
}

interface ActiveCastData {
  rod: RodDefinition;
  bait: BaitDefinition;
  fishPool: FishDefinition[];
  zoneId: ZoneId;
}

export interface FishingEvents {
  onStateChanged?: (snapshot: FishingSnapshot) => void;
  onBaitConsumeRequested: () => boolean;
  onCatchResolved: (result: { fish: FishDefinition | null; success: boolean; reason: string | null }) => void;
}

export class FishingSystem {
  private state: FishingSnapshot = {
    state: "idle",
    biteInSeconds: 0,
    currentFish: null,
    minigame: null,
    failureReason: null,
    lastResultWasSuccess: false
  };

  private castingTimer = 0;
  private waitingTimer = 0;
  private hookedTimer = 0;
  private minigameState: MinigameRuntimeState | null = null;
  private castData: ActiveCastData | null = null;
  private decayGraceEnabled = false;

  constructor(private readonly events: FishingEvents) {}

  getSnapshot(): FishingSnapshot {
    return this.state;
  }

  setDecayGraceEnabled(enabled: boolean): void {
    this.decayGraceEnabled = enabled;
  }

  openReady(): void {
    this.transition("ready");
  }

  closeToIdle(): void {
    this.castData = null;
    this.minigameState = null;
    this.state = {
      state: "idle",
      biteInSeconds: 0,
      currentFish: null,
      minigame: null,
      failureReason: null,
      lastResultWasSuccess: false
    };
    this.emit();
  }

  startCast(
    rod: RodDefinition,
    bait: BaitDefinition,
    fishPool: FishDefinition[],
    baitQuantity: number,
    zoneId: ZoneId
  ): boolean {
    if (baitQuantity <= 0) {
      this.state = {
        ...this.state,
        state: "ready",
        failureReason: "No bait equipped. Buy or equip bait first."
      };
      this.emit();
      return false;
    }

    this.castData = {
      rod,
      bait,
      fishPool,
      zoneId
    };
    this.castingTimer = 0.28;
    this.transition("casting");
    return true;
  }

  cancelWaiting(): void {
    if (this.state.state === "waiting_for_bite" || this.state.state === "casting") {
      this.transition("ready");
    }
  }

  giveUpMinigame(): void {
    if (this.state.state !== "minigame") {
      return;
    }
    this.resolveFailure("You gave up. Bait was already consumed on bite.");
  }

  retry(): void {
    this.transition("ready");
  }

  update(dtSeconds: number, holdActive: boolean): void {
    switch (this.state.state) {
      case "casting":
        this.castingTimer -= dtSeconds;
        if (this.castingTimer <= 0) {
          this.waitingTimer = randomRange(3, 15);
          this.transition("waiting_for_bite");
        }
        break;
      case "waiting_for_bite":
        this.waitingTimer -= dtSeconds;
        this.state = {
          ...this.state,
          biteInSeconds: Math.max(0, this.waitingTimer)
        };
        this.emit();
        if (this.waitingTimer <= 0) {
          this.triggerHookEvent();
        }
        break;
      case "hooked":
        this.hookedTimer -= dtSeconds;
        if (this.hookedTimer <= 0) {
          this.transition("minigame");
        }
        break;
      case "minigame":
        this.updateMinigame(dtSeconds, holdActive);
        break;
      default:
        break;
    }
  }

  private triggerHookEvent(): void {
    if (!this.castData) {
      this.resolveFailure("Fishing setup missing.");
      return;
    }

    const baitConsumed = this.events.onBaitConsumeRequested();
    if (!baitConsumed) {
      this.resolveFailure("Bait ran out before hook.");
      return;
    }

    const roll = rollFish(this.castData.fishPool, this.castData.rod, this.castData.bait, this.castData.zoneId);
    this.state = {
      ...this.state,
      state: "hooked",
      currentFish: roll.fish,
      failureReason: null
    };

    const userBarWidth = 0.15;
    this.minigameState = {
      fish: roll.fish,
      progress: 0,
      userBarX: 0,
      userBarWidth,
      userVelocity: 0,
      targetX: 0.4,
      targetWidth: roll.fish.targetWidth,
      targetVelocity: roll.fish.targetBaseSpeed,
      targetDirectionTimer: 0.5,
      escapeTimerSeconds: roll.fish.catchTimeSeconds * 2.8,
      overlap: false,
      missGraceSeconds: 0
    };

    this.hookedTimer = 0.35;
    this.emit();
  }

  private updateMinigame(dtSeconds: number, holdActive: boolean): void {
    if (!this.minigameState || !this.castData) {
      this.resolveFailure("Minigame state missing.");
      return;
    }

    const current = this.minigameState;
    const fish = current.fish;
    const rod = this.castData.rod;

    const effectiveSpeed = applySturdinessToMovement(fish.targetBaseSpeed, rod.sturdiness);
    const effectiveErraticness = applySturdinessToMovement(fish.targetErraticness, rod.sturdiness);

    const userAccelRight = 4.8;
    const userPullLeft = 5.3;
    const maxUserVelocity = 1.4;

    if (holdActive) {
      current.userVelocity += userAccelRight * dtSeconds;
    } else {
      current.userVelocity -= userPullLeft * dtSeconds;
    }
    current.userVelocity *= Math.pow(0.92, dtSeconds * 60);
    current.userVelocity = clamp(current.userVelocity, -1.5, maxUserVelocity);

    current.userBarX += current.userVelocity * dtSeconds;
    if (current.userBarX <= 0) {
      current.userBarX = 0;
      current.userVelocity = Math.max(0, current.userVelocity * 0.2);
    }
    if (current.userBarX >= 1 - current.userBarWidth) {
      current.userBarX = 1 - current.userBarWidth;
      current.userVelocity = Math.min(0, current.userVelocity * 0.2);
    }

    current.targetDirectionTimer -= dtSeconds;
    if (current.targetDirectionTimer <= 0) {
      const sign = Math.random() > 0.5 ? 1 : -1;
      const speedFactor = 0.75 + Math.random() * 0.6;
      current.targetVelocity = effectiveSpeed * speedFactor * sign;
      const changeInterval = 1 / Math.max(0.35, effectiveErraticness);
      current.targetDirectionTimer = clamp(changeInterval * (0.6 + Math.random() * 0.8), 0.22, 1.4);
    }

    current.targetX += current.targetVelocity * dtSeconds;
    if (current.targetX <= 0) {
      current.targetX = 0;
      current.targetVelocity = Math.abs(current.targetVelocity) * (0.72 + Math.random() * 0.2);
    }
    if (current.targetX >= 1 - current.targetWidth) {
      current.targetX = 1 - current.targetWidth;
      current.targetVelocity = -Math.abs(current.targetVelocity) * (0.72 + Math.random() * 0.2);
    }

    const overlap = computeBarOverlap(current.userBarX, current.userBarWidth, current.targetX, current.targetWidth);
    current.overlap = overlap;
    if (overlap) {
      current.missGraceSeconds = this.decayGraceEnabled ? 0.1 : 0;
    } else if (current.missGraceSeconds > 0) {
      current.missGraceSeconds = Math.max(0, current.missGraceSeconds - dtSeconds);
    }

    if (overlap || current.missGraceSeconds <= 0) {
      current.progress = updateCatchProgress({
        progress: current.progress,
        catchTimeSeconds: fish.catchTimeSeconds,
        overlap,
        dtSeconds
      });
    }
    current.escapeTimerSeconds = Math.max(0, current.escapeTimerSeconds - dtSeconds);

    this.state = {
      ...this.state,
      minigame: this.toMinigameSnapshot(current, holdActive),
      currentFish: fish
    };
    this.emit();

    if (current.progress >= 1) {
      this.resolveSuccess();
      return;
    }
    if (current.escapeTimerSeconds <= 0) {
      this.resolveFailure("The fish slipped away.");
    }
  }

  private resolveSuccess(): void {
    if (!this.minigameState) {
      return;
    }
    const fish = this.minigameState.fish;
    this.events.onCatchResolved({
      fish,
      success: true,
      reason: null
    });
    this.state = {
      ...this.state,
      state: "result_success",
      currentFish: fish,
      failureReason: null,
      minigame: null,
      lastResultWasSuccess: true
    };
    this.emit();
  }

  private resolveFailure(reason: string): void {
    const fish = this.minigameState?.fish ?? this.state.currentFish ?? null;
    this.events.onCatchResolved({
      fish,
      success: false,
      reason
    });
    this.state = {
      ...this.state,
      state: "result_fail",
      minigame: null,
      failureReason: reason,
      lastResultWasSuccess: false
    };
    this.emit();
  }

  private transition(next: FishingSnapshot["state"]): void {
    this.state = {
      ...this.state,
      state: next,
      biteInSeconds: next === "waiting_for_bite" ? this.waitingTimer : 0,
      failureReason: next === "ready" ? null : this.state.failureReason,
      minigame: next === "minigame" && this.minigameState ? this.toMinigameSnapshot(this.minigameState, false) : null
    };
    if (next === "ready") {
      this.minigameState = null;
      this.state.currentFish = null;
    }
    this.emit();
  }

  private toMinigameSnapshot(runtime: MinigameRuntimeState, holdActive: boolean): MinigameSnapshot {
    return {
      fish: runtime.fish,
      progress: runtime.progress,
      userBarX: runtime.userBarX,
      userBarWidth: runtime.userBarWidth,
      targetX: runtime.targetX,
      targetWidth: runtime.targetWidth,
      holdActive,
      overlap: runtime.overlap,
      timeLeftSeconds: runtime.escapeTimerSeconds
    };
  }

  private emit(): void {
    this.events.onStateChanged?.(this.state);
  }
}
