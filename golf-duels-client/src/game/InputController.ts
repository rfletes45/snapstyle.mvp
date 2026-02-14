/**
 * Golf Duels Client — Input Controller
 *
 * Handles touch/mouse/keyboard input for aiming and shooting.
 *
 * Input modes:
 * 1. AIMING: Drag on screen to set shot direction
 * 2. POWER: After setting direction, tap+hold or press space to charge power bar
 * 3. ROLLING: No input accepted while ball is moving
 *
 * Desktop: Mouse drag for aim, space key for power
 * Mobile: Touch drag for aim, second tap+hold for power
 */

export type InputMode = "idle" | "aiming" | "power";

export interface InputState {
  mode: InputMode;
  /** Aim angle in radians (0 = right, PI/2 = down in XZ plane) */
  angle: number;
  /** Power 0-1 */
  power: number;
  /** Whether user can currently interact */
  enabled: boolean;
}

export type OnAimCallback = (angle: number) => void;
export type OnShootCallback = (angle: number, power: number) => void;

export class InputController {
  private canvas: HTMLCanvasElement;
  private state: InputState = {
    mode: "idle",
    angle: 0,
    power: 0,
    enabled: false,
  };

  private ballScreenPos = { x: 0, y: 0 };
  private dragStart = { x: 0, y: 0 };
  private powerCharging = false;
  private powerDirection = 1;
  private powerSpeed = 2.0; // Full charge in ~0.5s
  private animFrame: number | null = null;

  onAim: OnAimCallback | null = null;
  onShoot: OnShootCallback | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  getState(): InputState {
    return { ...this.state };
  }

  enable(): void {
    this.state.enabled = true;
    this.state.mode = "aiming";
    this.state.power = 0;
  }

  disable(): void {
    this.state.enabled = false;
    this.state.mode = "idle";
    this.stopPowerCharge();
  }

  /** Update the ball's screen-space position (for drag offset calculation) */
  setBallScreenPosition(x: number, y: number): void {
    this.ballScreenPos = { x, y };
  }

  dispose(): void {
    this.stopPowerCharge();
    // Events are removed when the canvas is removed from DOM
  }

  // ==========================================================================
  // Event Binding
  // ==========================================================================

  private bindEvents(): void {
    // Mouse
    this.canvas.addEventListener("mousedown", this.onPointerDown.bind(this));
    this.canvas.addEventListener("mousemove", this.onPointerMove.bind(this));
    this.canvas.addEventListener("mouseup", this.onPointerUp.bind(this));

    // Touch
    this.canvas.addEventListener("touchstart", this.onTouchStart.bind(this), {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.onTouchMove.bind(this), {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.onTouchEnd.bind(this));

    // Keyboard
    window.addEventListener("keydown", this.onKeyDown.bind(this));
    window.addEventListener("keyup", this.onKeyUp.bind(this));
  }

  // ==========================================================================
  // Pointer Events (Mouse)
  // ==========================================================================

  private onPointerDown(e: MouseEvent): void {
    if (!this.state.enabled) return;

    if (this.state.mode === "aiming") {
      this.dragStart = { x: e.clientX, y: e.clientY };
    } else if (this.state.mode === "power") {
      // Start power charge
      this.startPowerCharge();
    }
  }

  private onPointerMove(e: MouseEvent): void {
    if (!this.state.enabled) return;

    if (this.state.mode === "aiming") {
      const dx = e.clientX - this.ballScreenPos.x;
      const dy = e.clientY - this.ballScreenPos.y;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        // Aim direction is OPPOSITE to drag (slingshot style)
        this.state.angle = Math.atan2(-dy, -dx);
        // Map screen coordinates to XZ plane: screen Y → Z
        this.state.angle = Math.atan2(dy, -dx);
        this.onAim?.(this.state.angle);
      }
    }
  }

  private onPointerUp(_e: MouseEvent): void {
    if (!this.state.enabled) return;

    if (this.state.mode === "aiming") {
      // Lock in aim, switch to power mode
      this.state.mode = "power";
      this.startPowerCharge();
    } else if (this.state.mode === "power") {
      this.commitShot();
    }
  }

  // ==========================================================================
  // Touch Events
  // ==========================================================================

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (!this.state.enabled || e.touches.length === 0) return;

    const touch = e.touches[0];
    if (this.state.mode === "aiming") {
      this.dragStart = { x: touch.clientX, y: touch.clientY };
    } else if (this.state.mode === "power") {
      this.startPowerCharge();
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.state.enabled || e.touches.length === 0) return;

    if (this.state.mode === "aiming") {
      const touch = e.touches[0];
      const dx = touch.clientX - this.ballScreenPos.x;
      const dy = touch.clientY - this.ballScreenPos.y;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this.state.angle = Math.atan2(dy, -dx);
        this.onAim?.(this.state.angle);
      }
    }
  }

  private onTouchEnd(_e: TouchEvent): void {
    if (!this.state.enabled) return;

    if (this.state.mode === "aiming") {
      this.state.mode = "power";
      this.startPowerCharge();
    } else if (this.state.mode === "power") {
      this.commitShot();
    }
  }

  // ==========================================================================
  // Keyboard
  // ==========================================================================

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.state.enabled) return;

    switch (e.key) {
      case "ArrowLeft":
        if (this.state.mode === "aiming") {
          this.state.angle -= 0.05;
          this.onAim?.(this.state.angle);
        }
        break;
      case "ArrowRight":
        if (this.state.mode === "aiming") {
          this.state.angle += 0.05;
          this.onAim?.(this.state.angle);
        }
        break;
      case " ": // Space
        e.preventDefault();
        if (this.state.mode === "aiming") {
          this.state.mode = "power";
          this.startPowerCharge();
        }
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!this.state.enabled) return;

    if (e.key === " " && this.state.mode === "power") {
      this.commitShot();
    }
  }

  // ==========================================================================
  // Power Charge
  // ==========================================================================

  private startPowerCharge(): void {
    if (this.powerCharging) return;
    this.powerCharging = true;
    this.state.power = 0;
    this.powerDirection = 1;

    const start = performance.now();
    const animate = (now: number) => {
      if (!this.powerCharging) return;
      const dt = (now - start) / 1000;
      this.state.power += this.powerDirection * this.powerSpeed * (1 / 60);

      if (this.state.power >= 1) {
        this.state.power = 1;
        this.powerDirection = -1;
      } else if (this.state.power <= 0) {
        this.state.power = 0;
        this.powerDirection = 1;
      }

      this.animFrame = requestAnimationFrame(animate);
    };
    this.animFrame = requestAnimationFrame(animate);
  }

  private stopPowerCharge(): void {
    this.powerCharging = false;
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  private commitShot(): void {
    this.stopPowerCharge();
    const angle = this.state.angle;
    const power = Math.max(0.05, this.state.power);
    this.state.mode = "idle";
    this.state.enabled = false;
    this.onShoot?.(angle, power);
  }
}
