/**
 * Tilt Controller
 * Handles accelerometer input for tilt-based controls
 */

import { Accelerometer, AccelerometerMeasurement } from "expo-sensors";
import { TILT_CONFIG } from "../data/constants";
import { TiltInput } from "../types/cartCourse.types";

// ============================================
// Tilt Controller Class
// ============================================

export class TiltController {
  private subscription: { remove: () => void } | null = null;
  private tiltHistory: TiltInput[] = [];
  private currentTilt: TiltInput = { x: 0, y: 0, pitch: 0, roll: 0 };
  private calibrationOffset: { pitch: number; roll: number } = {
    pitch: 0,
    roll: 0,
  };
  private isActive: boolean = false;
  private config = TILT_CONFIG;

  // ============================================
  // Start Listening
  // ============================================

  async start(onTiltChange: (tilt: TiltInput) => void): Promise<void> {
    if (this.isActive) return;

    // Check if accelerometer is available
    const isAvailable = await Accelerometer.isAvailableAsync();
    if (!isAvailable) {
      console.warn("Accelerometer is not available on this device");
      return;
    }

    // Set update interval
    Accelerometer.setUpdateInterval(this.config.updateInterval);

    // Subscribe to accelerometer updates
    this.subscription = Accelerometer.addListener(
      (data: AccelerometerMeasurement) => {
        this.processAccelerometerData(data, onTiltChange);
      },
    );

    this.isActive = true;
  }

  // ============================================
  // Process Accelerometer Data
  // ============================================

  private processAccelerometerData(
    data: AccelerometerMeasurement,
    onTiltChange: (tilt: TiltInput) => void,
  ): void {
    const { x, y, z } = data;

    // Convert accelerometer readings to tilt angles (degrees)
    // Pitch: rotation around X axis (tilting forward/backward)
    // Roll: rotation around Y axis (tilting left/right)
    const pitch = (Math.atan2(y, Math.sqrt(x * x + z * z)) * 180) / Math.PI;
    const roll = (Math.atan2(x, Math.sqrt(y * y + z * z)) * 180) / Math.PI;

    // Apply calibration offset
    const calibratedPitch = pitch - this.calibrationOffset.pitch;
    const calibratedRoll = roll - this.calibrationOffset.roll;

    // Apply inversion if configured
    const finalRoll = this.config.invertX ? -calibratedRoll : calibratedRoll;
    const finalPitch = this.config.invertY ? -calibratedPitch : calibratedPitch;

    // Create raw tilt input
    const rawTilt: TiltInput = {
      x: finalRoll / this.config.maxTiltAngle, // Normalize to -1 to 1
      y: finalPitch / this.config.maxTiltAngle,
      pitch: finalPitch,
      roll: finalRoll,
    };

    // Apply deadzone
    if (Math.abs(rawTilt.x) < this.config.deadzone) {
      rawTilt.x = 0;
    }
    if (Math.abs(rawTilt.y) < this.config.deadzone) {
      rawTilt.y = 0;
    }

    // Clamp values
    rawTilt.x = Math.max(-1, Math.min(1, rawTilt.x));
    rawTilt.y = Math.max(-1, Math.min(1, rawTilt.y));

    // Apply smoothing
    const smoothedTilt = this.applySmoothingToTilt(rawTilt);

    // Update current tilt
    this.currentTilt = smoothedTilt;

    // Notify callback
    onTiltChange(smoothedTilt);
  }

  // ============================================
  // Apply Smoothing
  // ============================================

  private applySmoothingToTilt(rawTilt: TiltInput): TiltInput {
    // Add to history
    this.tiltHistory.push(rawTilt);

    // Keep history limited (based on smoothing factor - more smoothing = longer history)
    const maxHistorySize = Math.ceil(1 / this.config.smoothingFactor);
    if (this.tiltHistory.length > maxHistorySize) {
      this.tiltHistory.shift();
    }

    // Calculate exponential moving average
    if (this.tiltHistory.length === 1) {
      return rawTilt;
    }

    const smoothed: TiltInput = {
      x: this.lerp(
        this.tiltHistory[this.tiltHistory.length - 2].x,
        rawTilt.x,
        this.config.smoothingFactor,
      ),
      y: this.lerp(
        this.tiltHistory[this.tiltHistory.length - 2].y,
        rawTilt.y,
        this.config.smoothingFactor,
      ),
      pitch: this.lerp(
        this.tiltHistory[this.tiltHistory.length - 2].pitch,
        rawTilt.pitch,
        this.config.smoothingFactor,
      ),
      roll: this.lerp(
        this.tiltHistory[this.tiltHistory.length - 2].roll,
        rawTilt.roll,
        this.config.smoothingFactor,
      ),
    };

    return smoothed;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // ============================================
  // Calibrate
  // ============================================

  calibrate(): void {
    // Set current tilt as the neutral position
    this.calibrationOffset = {
      pitch: this.currentTilt.pitch + this.calibrationOffset.pitch,
      roll: this.currentTilt.roll + this.calibrationOffset.roll,
    };

    // Reset history
    this.tiltHistory = [];

    console.log("Tilt calibrated:", this.calibrationOffset);
  }

  // ============================================
  // Get Current Tilt
  // ============================================

  getCurrentTilt(): TiltInput {
    return { ...this.currentTilt };
  }

  // ============================================
  // Stop Listening
  // ============================================

  stop(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isActive = false;
    this.tiltHistory = [];
  }

  // ============================================
  // Check if Active
  // ============================================

  getIsActive(): boolean {
    return this.isActive;
  }

  // ============================================
  // Update Configuration
  // ============================================

  setConfig(config: Partial<typeof TILT_CONFIG>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================
// Singleton Instance
// ============================================

let tiltControllerInstance: TiltController | null = null;

export function getTiltController(): TiltController {
  if (!tiltControllerInstance) {
    tiltControllerInstance = new TiltController();
  }
  return tiltControllerInstance;
}

export function resetTiltController(): void {
  if (tiltControllerInstance) {
    tiltControllerInstance.stop();
    tiltControllerInstance = null;
  }
}
