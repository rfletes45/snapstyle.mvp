/**
 * Mechanism System (Phase 3 + Phase 4)
 * react-native-game-engine system for updating all mechanisms
 */

import Matter from "matter-js";
import { isCartOnAutoRotate, updateAutoRotate } from "../mechanisms/AutoRotate";
import {
  applyConveyorForce,
  isCartOnConveyor,
  updateConveyor,
} from "../mechanisms/Conveyor";
import {
  isCartOnFanPlatform,
  updateFanPlatform,
} from "../mechanisms/FanPlatform";
import { updateJoystickGear } from "../mechanisms/JoystickGear";
import {
  isCartOnLauncher,
  launchCart,
  updateLauncherPlatform,
} from "../mechanisms/LauncherPlatform";
import {
  isCartOnLiftPlatform,
  updateLiftPlatform,
} from "../mechanisms/LiftPlatform";
import { updateRotatingGear } from "../mechanisms/RotatingGear";
import {
  AutoRotateMechanism,
  ConveyorMechanism,
  FanPlatformMechanism,
  GameEngineUpdateProps,
  GameEntities,
  JoystickGearMechanism,
  LauncherPlatformMechanism,
  LiftPlatformMechanism,
  Mechanism,
  MechanismType,
  RotatingGearMechanism,
} from "../types/cartCourse.types";

// ============================================
// Mechanism System
// ============================================

export function MechanismSystem(
  entities: GameEntities,
  { time }: GameEngineUpdateProps,
): GameEntities {
  const { mechanisms, input, cart } = entities;

  if (!mechanisms || mechanisms.size === 0) {
    return entities;
  }

  const deltaTime = time.delta;

  // Update each mechanism based on its type and control input
  mechanisms.forEach((mechanism) => {
    switch (mechanism.type) {
      // L/R Button Rotating Gears
      case MechanismType.L_ROTATING_GEAR:
        updateRotatingGear(
          mechanism as RotatingGearMechanism,
          input.leftButton,
          deltaTime,
        );
        break;

      case MechanismType.R_ROTATING_GEAR:
        updateRotatingGear(
          mechanism as RotatingGearMechanism,
          input.rightButton,
          deltaTime,
        );
        break;

      // L/R Button Lift Platforms
      case MechanismType.L_LIFT_PLATFORM:
        updateLiftPlatform(
          mechanism as LiftPlatformMechanism,
          input.leftButton,
          deltaTime,
        );
        break;

      case MechanismType.R_LIFT_PLATFORM:
        updateLiftPlatform(
          mechanism as LiftPlatformMechanism,
          input.rightButton,
          deltaTime,
        );
        break;

      // Joystick Gears
      case MechanismType.LEFT_STICK_GEAR:
        updateJoystickGear(
          mechanism as JoystickGearMechanism,
          {
            x: 0, // Not used directly
            y:
              -Math.sin(input.leftJoystick.angle) *
              input.leftJoystick.magnitude,
            angle: input.leftJoystick.angle,
            magnitude: input.leftJoystick.magnitude,
          },
          deltaTime,
        );
        break;

      case MechanismType.RIGHT_STICK_GEAR:
        updateJoystickGear(
          mechanism as JoystickGearMechanism,
          {
            x: 0,
            y:
              -Math.sin(input.rightJoystick.angle) *
              input.rightJoystick.magnitude,
            angle: input.rightJoystick.angle,
            magnitude: input.rightJoystick.magnitude,
          },
          deltaTime,
        );
        break;

      // ============================================
      // Phase 4 Mechanisms
      // ============================================

      // Launcher Platform (R Button - charge and release)
      case MechanismType.R_LAUNCHER: {
        const launcherMechanism = mechanism as LauncherPlatformMechanism;
        const wasCharging = launcherMechanism.isCharging;

        updateLauncherPlatform(launcherMechanism, input.rightButton, deltaTime);

        // Check if button was released while charging (trigger launch)
        if (
          wasCharging &&
          !input.rightButton &&
          launcherMechanism.chargeLevel > 0
        ) {
          // Check if cart is on launcher and launch it
          if (isCartOnLauncher(launcherMechanism, cart.body)) {
            launchCart(launcherMechanism, cart.body);
          }
        }
        break;
      }

      // Fan Platform (Blow or tap to lift)
      case MechanismType.FAN_PLATFORM: {
        const fanMechanism = mechanism as FanPlatformMechanism;
        updateFanPlatform(fanMechanism, input.isBlowing, deltaTime);
        break;
      }

      // Auto Rotate (Triggered by cart contact)
      case MechanismType.AUTO_ROTATE: {
        const autoRotateMechanism = mechanism as AutoRotateMechanism;
        const isCartOnPlatform = isCartOnAutoRotate(
          autoRotateMechanism,
          cart.body,
        );
        updateAutoRotate(autoRotateMechanism, isCartOnPlatform, deltaTime);
        break;
      }

      // Conveyor Belt (Applies constant velocity)
      case MechanismType.CONVEYOR: {
        const conveyorMechanism = mechanism as ConveyorMechanism;
        updateConveyor(conveyorMechanism, deltaTime);

        // Apply conveyor force to cart if on belt
        if (isCartOnConveyor(conveyorMechanism, cart.body)) {
          applyConveyorForce(conveyorMechanism, cart.body, deltaTime);
        }
        break;
      }

      default:
        break;
    }
  });

  return entities;
}

// ============================================
// Cart Attachment Detection System
// ============================================

export interface CartAttachmentState {
  isAttached: boolean;
  attachedMechanismId: string | null;
  attachedPlatformBody: Matter.Body | null;
}

export function detectCartAttachment(
  entities: GameEntities,
): CartAttachmentState {
  const { mechanisms, cart } = entities;
  const cartBody = cart.body;

  let attachmentState: CartAttachmentState = {
    isAttached: false,
    attachedMechanismId: null,
    attachedPlatformBody: null,
  };

  if (!mechanisms || mechanisms.size === 0) {
    return attachmentState;
  }

  // Check if cart is on any mechanism platform
  mechanisms.forEach((mechanism, id) => {
    // Skip if already found attachment
    if (attachmentState.isAttached) return;

    // Check lift platforms
    if (
      mechanism.type === MechanismType.L_LIFT_PLATFORM ||
      mechanism.type === MechanismType.R_LIFT_PLATFORM
    ) {
      const liftMechanism = mechanism as LiftPlatformMechanism;
      if (isCartOnLiftPlatform(liftMechanism, cartBody)) {
        attachmentState = {
          isAttached: true,
          attachedMechanismId: id,
          attachedPlatformBody: liftMechanism.platform,
        };
      }
    }

    // Check rotating gear platforms
    if (
      mechanism.type === MechanismType.L_ROTATING_GEAR ||
      mechanism.type === MechanismType.R_ROTATING_GEAR
    ) {
      const gearMechanism = mechanism as RotatingGearMechanism;
      if (isCartOnRotatingPlatform(gearMechanism, cartBody)) {
        attachmentState = {
          isAttached: true,
          attachedMechanismId: id,
          attachedPlatformBody: gearMechanism.attachedPlatform,
        };
      }
    }

    // Check joystick gear platforms
    if (
      mechanism.type === MechanismType.LEFT_STICK_GEAR ||
      mechanism.type === MechanismType.RIGHT_STICK_GEAR
    ) {
      const joystickMechanism = mechanism as JoystickGearMechanism;
      if (isCartOnJoystickPlatform(joystickMechanism, cartBody)) {
        attachmentState = {
          isAttached: true,
          attachedMechanismId: id,
          attachedPlatformBody: joystickMechanism.attachedPlatform,
        };
      }
    }

    // ============================================
    // Phase 4 Mechanism Attachment Detection
    // ============================================

    // Check launcher platform
    if (mechanism.type === MechanismType.R_LAUNCHER) {
      const launcherMechanism = mechanism as LauncherPlatformMechanism;
      if (isCartOnLauncher(launcherMechanism, cartBody)) {
        attachmentState = {
          isAttached: true,
          attachedMechanismId: id,
          attachedPlatformBody: launcherMechanism.platform,
        };
      }
    }

    // Check fan platform
    if (mechanism.type === MechanismType.FAN_PLATFORM) {
      const fanMechanism = mechanism as FanPlatformMechanism;
      if (isCartOnFanPlatform(fanMechanism, cartBody)) {
        attachmentState = {
          isAttached: true,
          attachedMechanismId: id,
          attachedPlatformBody: fanMechanism.platform,
        };
      }
    }

    // Check auto rotate platform
    if (mechanism.type === MechanismType.AUTO_ROTATE) {
      const autoRotateMechanism = mechanism as AutoRotateMechanism;
      if (isCartOnAutoRotate(autoRotateMechanism, cartBody)) {
        attachmentState = {
          isAttached: true,
          attachedMechanismId: id,
          attachedPlatformBody: autoRotateMechanism.platform,
        };
      }
    }

    // Check conveyor belt
    if (mechanism.type === MechanismType.CONVEYOR) {
      const conveyorMechanism = mechanism as ConveyorMechanism;
      if (isCartOnConveyor(conveyorMechanism, cartBody)) {
        attachmentState = {
          isAttached: true,
          attachedMechanismId: id,
          attachedPlatformBody: conveyorMechanism.belt,
        };
      }
    }
  });

  return attachmentState;
}

// ============================================
// Helper: Check if cart is on rotating platform
// ============================================

function isCartOnRotatingPlatform(
  mechanism: RotatingGearMechanism,
  cartBody: Matter.Body,
  threshold: number = 5,
): boolean {
  const platformBounds = mechanism.attachedPlatform.bounds;
  const cartPosition = cartBody.position;

  // Check if cart is above the platform and within horizontal bounds
  const isAbove = cartPosition.y < mechanism.attachedPlatform.position.y;
  const isWithinX =
    cartPosition.x >= platformBounds.min.x - threshold &&
    cartPosition.x <= platformBounds.max.x + threshold;
  const isCloseY =
    Math.abs(cartPosition.y - platformBounds.min.y) < threshold * 3;

  return isAbove && isWithinX && isCloseY;
}

// ============================================
// Helper: Check if cart is on joystick platform
// ============================================

function isCartOnJoystickPlatform(
  mechanism: JoystickGearMechanism,
  cartBody: Matter.Body,
  threshold: number = 5,
): boolean {
  const platformBounds = mechanism.attachedPlatform.bounds;
  const cartPosition = cartBody.position;

  const isAbove = cartPosition.y < mechanism.attachedPlatform.position.y;
  const isWithinX =
    cartPosition.x >= platformBounds.min.x - threshold &&
    cartPosition.x <= platformBounds.max.x + threshold;
  const isCloseY =
    Math.abs(cartPosition.y - platformBounds.min.y) < threshold * 3;

  return isAbove && isWithinX && isCloseY;
}

// ============================================
// Get All Mechanism Platforms
// ============================================

export function getAllMechanismPlatforms(
  entities: GameEntities,
): Matter.Body[] {
  const { mechanisms } = entities;
  const platforms: Matter.Body[] = [];

  if (!mechanisms) return platforms;

  mechanisms.forEach((mechanism) => {
    if ("attachedPlatform" in mechanism) {
      platforms.push((mechanism as RotatingGearMechanism).attachedPlatform);
    }
    if ("platform" in mechanism) {
      platforms.push((mechanism as LiftPlatformMechanism).platform);
    }
    // Phase 4: Conveyor belt
    if ("belt" in mechanism) {
      platforms.push((mechanism as ConveyorMechanism).belt);
    }
  });

  return platforms;
}

// ============================================
// Find Mechanism by Platform Body
// ============================================

export function findMechanismByPlatform(
  entities: GameEntities,
  platformBody: Matter.Body,
): Mechanism | null {
  const { mechanisms } = entities;

  if (!mechanisms) return null;

  for (const [_id, mechanism] of mechanisms) {
    if (
      "attachedPlatform" in mechanism &&
      (mechanism as RotatingGearMechanism).attachedPlatform === platformBody
    ) {
      return mechanism;
    }
    if (
      "platform" in mechanism &&
      (mechanism as LiftPlatformMechanism).platform === platformBody
    ) {
      return mechanism;
    }
    // Phase 4: Conveyor belt
    if (
      "belt" in mechanism &&
      (mechanism as ConveyorMechanism).belt === platformBody
    ) {
      return mechanism;
    }
  }

  return null;
}
