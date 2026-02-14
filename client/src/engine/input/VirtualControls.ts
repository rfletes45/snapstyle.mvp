import * as THREE from "three";
import { clamp } from "../../utils/math";

const KEY_TO_AXIS: Record<string, THREE.Vector2> = {
  w: new THREE.Vector2(0, 1),
  arrowup: new THREE.Vector2(0, 1),
  s: new THREE.Vector2(0, -1),
  arrowdown: new THREE.Vector2(0, -1),
  a: new THREE.Vector2(-1, 0),
  arrowleft: new THREE.Vector2(-1, 0),
  d: new THREE.Vector2(1, 0),
  arrowright: new THREE.Vector2(1, 0),
};

export class VirtualControls {
  private readonly root: HTMLDivElement;
  private readonly leftPad: HTMLDivElement;
  private readonly leftStick: HTMLDivElement;
  private readonly rightLookZone: HTMLDivElement;
  private readonly jumpButton: HTMLButtonElement;

  private readonly movement = new THREE.Vector2();
  private readonly keyboardMovement = new THREE.Vector2();
  private readonly lookDelta = new THREE.Vector2();
  private readonly pressedKeys = new Set<string>();

  private joystickPointerId: number | null = null;
  private lookPointerId: number | null = null;
  private pointerLocked = false;
  private joystickCenter = new THREE.Vector2();
  private joystickRadius = 1;
  private lookLast = new THREE.Vector2();
  private enabled = true;
  private isTouchDevice = false;
  private jumpPressed = false;

  constructor(
    parent: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    this.root = document.createElement("div");
    this.root.className = "touch-layer";

    this.leftPad = document.createElement("div");
    this.leftPad.className = "virtual-joystick";
    this.leftStick = document.createElement("div");
    this.leftStick.className = "virtual-joystick-stick";
    this.leftPad.appendChild(this.leftStick);

    this.rightLookZone = document.createElement("div");
    this.rightLookZone.className = "look-zone";
    this.rightLookZone.textContent = "LOOK";

    this.jumpButton = document.createElement("button");
    this.jumpButton.className = "jump-button";
    this.jumpButton.textContent = "JUMP";
    this.jumpButton.addEventListener("pointerdown", this.onJumpDown);
    this.jumpButton.addEventListener("pointerup", this.onJumpUp);
    this.jumpButton.addEventListener("pointercancel", this.onJumpUp);

    // Only show touch controls on touch devices
    if (!this.isTouchDevice) {
      this.leftPad.style.display = "none";
      this.rightLookZone.style.display = "none";
      this.jumpButton.style.display = "none";
    }

    this.root.appendChild(this.leftPad);
    this.root.appendChild(this.rightLookZone);
    this.root.appendChild(this.jumpButton);
    parent.appendChild(this.root);

    this.leftPad.addEventListener("pointerdown", this.onJoystickDown);
    window.addEventListener("pointermove", this.onJoystickMove);
    window.addEventListener("pointerup", this.onJoystickUp);
    window.addEventListener("pointercancel", this.onJoystickUp);

    this.rightLookZone.addEventListener("pointerdown", this.onLookDown);
    window.addEventListener("pointermove", this.onLookMove);
    window.addEventListener("pointerup", this.onLookUp);
    window.addEventListener("pointercancel", this.onLookUp);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    this.canvas.addEventListener("click", this.onCanvasClick);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onMouseLookMove);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.resetMovement();
      this.lookDelta.set(0, 0);
      this.joystickPointerId = null;
      this.lookPointerId = null;
      this.leftStick.style.transform = "translate(-50%, -50%)";
      if (this.pointerLocked && document.pointerLockElement === this.canvas) {
        document.exitPointerLock();
      }
    }
  }

  getMovementInput(): THREE.Vector2 {
    const combined = this.movement.clone().add(this.keyboardMovement);
    if (combined.lengthSq() > 1) {
      combined.normalize();
    }
    return combined;
  }

  consumeLookDelta(): THREE.Vector2 {
    const delta = this.lookDelta.clone();
    this.lookDelta.set(0, 0);
    return delta;
  }

  /** Returns true once per press (consumed on read). */
  consumeJump(): boolean {
    const pressed = this.jumpPressed;
    this.jumpPressed = false;
    return pressed;
  }

  dispose(): void {
    this.leftPad.removeEventListener("pointerdown", this.onJoystickDown);
    window.removeEventListener("pointermove", this.onJoystickMove);
    window.removeEventListener("pointerup", this.onJoystickUp);
    window.removeEventListener("pointercancel", this.onJoystickUp);

    this.rightLookZone.removeEventListener("pointerdown", this.onLookDown);
    window.removeEventListener("pointermove", this.onLookMove);
    window.removeEventListener("pointerup", this.onLookUp);
    window.removeEventListener("pointercancel", this.onLookUp);

    this.jumpButton.removeEventListener("pointerdown", this.onJumpDown);
    this.jumpButton.removeEventListener("pointerup", this.onJumpUp);
    this.jumpButton.removeEventListener("pointercancel", this.onJumpUp);

    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);

    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onMouseLookMove);

    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }

    this.root.remove();
  }

  private readonly onJoystickDown = (event: PointerEvent): void => {
    if (!this.enabled || this.joystickPointerId !== null) {
      return;
    }

    this.joystickPointerId = event.pointerId;
    const rect = this.leftPad.getBoundingClientRect();
    this.joystickCenter = new THREE.Vector2(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    this.joystickRadius = rect.width * 0.38;
    this.updateJoystick(event.clientX, event.clientY);
  };

  private readonly onJoystickMove = (event: PointerEvent): void => {
    if (!this.enabled || this.joystickPointerId !== event.pointerId) {
      return;
    }
    this.updateJoystick(event.clientX, event.clientY);
  };

  private readonly onJoystickUp = (event: PointerEvent): void => {
    if (this.joystickPointerId !== event.pointerId) {
      return;
    }
    this.joystickPointerId = null;
    this.movement.set(0, 0);
    this.leftStick.style.transform = "translate(-50%, -50%)";
  };

  private updateJoystick(clientX: number, clientY: number): void {
    const deltaX = clientX - this.joystickCenter.x;
    const deltaY = clientY - this.joystickCenter.y;
    const distance = Math.hypot(deltaX, deltaY);
    const clampedDistance = Math.min(distance, this.joystickRadius);
    const angle = Math.atan2(deltaY, deltaX);
    const normalizedX =
      (Math.cos(angle) * clampedDistance) / this.joystickRadius;
    const normalizedY =
      (Math.sin(angle) * clampedDistance) / this.joystickRadius;

    this.movement.set(normalizedX, -normalizedY);

    const stickOffsetX = normalizedX * this.joystickRadius;
    const stickOffsetY = -normalizedY * this.joystickRadius;
    this.leftStick.style.transform = `translate(calc(-50% + ${stickOffsetX}px), calc(-50% + ${stickOffsetY}px))`;
  }

  private readonly onLookDown = (event: PointerEvent): void => {
    if (!this.enabled || this.lookPointerId !== null) {
      return;
    }

    this.lookPointerId = event.pointerId;
    this.lookLast.set(event.clientX, event.clientY);
  };

  private readonly onLookMove = (event: PointerEvent): void => {
    if (!this.enabled || this.lookPointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - this.lookLast.x;
    const dy = event.clientY - this.lookLast.y;
    this.lookLast.set(event.clientX, event.clientY);
    this.lookDelta.x += dx;
    this.lookDelta.y += dy;
  };

  private readonly onLookUp = (event: PointerEvent): void => {
    if (this.lookPointerId !== event.pointerId) {
      return;
    }
    this.lookPointerId = null;
  };

  private readonly onJumpDown = (event: Event): void => {
    event.preventDefault();
    if (!this.enabled) return;
    this.jumpPressed = true;
  };

  private readonly onJumpUp = (): void => {
    // Jump is consumed per-press via consumeJump(), no state to reset.
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === " " || key === "spacebar") {
      event.preventDefault();
      if (this.enabled) this.jumpPressed = true;
      return;
    }
    if (KEY_TO_AXIS[key]) {
      this.pressedKeys.add(key);
      this.recalculateKeyboardMovement();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (KEY_TO_AXIS[key]) {
      this.pressedKeys.delete(key);
      this.recalculateKeyboardMovement();
    }
  };

  private recalculateKeyboardMovement(): void {
    this.keyboardMovement.set(0, 0);
    for (const key of this.pressedKeys) {
      this.keyboardMovement.add(KEY_TO_AXIS[key]);
    }
    this.keyboardMovement.x = clamp(this.keyboardMovement.x, -1, 1);
    this.keyboardMovement.y = clamp(this.keyboardMovement.y, -1, 1);
    if (this.keyboardMovement.lengthSq() > 1) {
      this.keyboardMovement.normalize();
    }
  }

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly onCanvasClick = (): void => {
    if (!this.enabled || this.isTouchDevice) {
      return;
    }
    if (document.pointerLockElement !== this.canvas) {
      void this.canvas.requestPointerLock();
    }
  };

  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private readonly onMouseLookMove = (event: MouseEvent): void => {
    if (!this.enabled || !this.pointerLocked) {
      return;
    }
    this.lookDelta.x += event.movementX;
    this.lookDelta.y += event.movementY;
  };

  private resetMovement(): void {
    this.movement.set(0, 0);
    this.keyboardMovement.set(0, 0);
    this.pressedKeys.clear();
  }
}
