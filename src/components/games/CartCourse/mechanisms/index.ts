/**
 * Mechanisms Module Index (Phase 3 + Phase 4)
 * Exports all mechanism types and utilities
 */

// ============================================
// Rotating Gear (Phase 3)
// ============================================

export {
  createRotatingGear,
  getGearPlatformPosition,
  removeRotatingGear,
  resetRotatingGear,
  updateRotatingGear,
} from "./RotatingGear";
export type { RotatingGearConfig } from "./RotatingGear";

// ============================================
// Lift Platform (Phase 3)
// ============================================

export {
  createLiftPlatform,
  getLiftPlatformPosition,
  getLiftProgress,
  isCartOnLiftPlatform,
  removeLiftPlatform,
  resetLiftPlatform,
  updateLiftPlatform,
} from "./LiftPlatform";
export type { LiftPlatformConfig } from "./LiftPlatform";

// ============================================
// Joystick Gear (Phase 3)
// ============================================

export {
  createJoystickGear,
  getJoystickGearPlatformPosition,
  removeJoystickGear,
  resetJoystickGear,
  updateJoystickGear,
} from "./JoystickGear";
export type { JoystickGearConfig } from "./JoystickGear";

// ============================================
// Launcher Platform (Phase 4)
// ============================================

export {
  createLauncherPlatform,
  getLauncherChargeLevel,
  isCartOnLauncher,
  launchCart,
  removeLauncherPlatform,
  resetLauncherPlatform,
  updateLauncherPlatform,
} from "./LauncherPlatform";
export type { LauncherPlatformConfig } from "./LauncherPlatform";

// ============================================
// Fan Platform (Phase 4)
// ============================================

export {
  createFanPlatform,
  getFanLiftProgress,
  getFanPlatformPosition,
  isCartOnFanPlatform,
  removeFanPlatform,
  resetFanPlatform,
  updateFanPlatform,
} from "./FanPlatform";
export type { FanPlatformConfig } from "./FanPlatform";

// ============================================
// Auto Rotate (Phase 4)
// ============================================

export {
  createAutoRotate,
  getAutoRotatePosition,
  isCartOnAutoRotate,
  removeAutoRotate,
  resetAutoRotate,
  updateAutoRotate,
} from "./AutoRotate";
export type { AutoRotateConfig } from "./AutoRotate";

// ============================================
// Conveyor (Phase 4)
// ============================================

export {
  applyConveyorForce,
  createConveyor,
  getConveyorPosition,
  getConveyorVelocity,
  isCartOnConveyor,
  removeConveyor,
  resetConveyor,
  setConveyorDirection,
  setConveyorSpeed,
  toggleConveyor,
  updateConveyor,
} from "./Conveyor";
export type { ConveyorConfig } from "./Conveyor";
