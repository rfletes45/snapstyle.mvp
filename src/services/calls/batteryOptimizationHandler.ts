/**
 * BatteryOptimizationHandler - Handles Android battery optimization exceptions
 * Ensures calls can be received even when device is in Doze mode
 */

import { Alert, Linking, Platform } from "react-native";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/batteryOptimizationHandler");
// Logging helpers
const logInfo = (msg: string, data?: any) =>
  logger.info(`[BatteryOpt] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  logger.error(`[BatteryOpt] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && logger.info(`[BatteryOpt] ${msg}`, data ?? "");

// Battery optimization states
export type BatteryOptimizationState =
  | "ignored" // App is exempt from battery optimization
  | "optimized" // App is being optimized (may miss calls in background)
  | "unknown" // Cannot determine state
  | "not_applicable"; // iOS or unsupported Android version

class BatteryOptimizationHandler {
  private static instance: BatteryOptimizationHandler;
  private hasShownPrompt: boolean = false;
  private lastCheckTime: number = 0;
  private cachedState: BatteryOptimizationState | null = null;

  private constructor() {}

  static getInstance(): BatteryOptimizationHandler {
    if (!BatteryOptimizationHandler.instance) {
      BatteryOptimizationHandler.instance = new BatteryOptimizationHandler();
    }
    return BatteryOptimizationHandler.instance;
  }

  // ============================================================================
  // State Checking
  // ============================================================================

  /**
   * Check if the app is exempt from battery optimization
   */
  async checkState(): Promise<BatteryOptimizationState> {
    if (Platform.OS !== "android") {
      return "not_applicable";
    }

    // Cache result for 5 minutes
    const now = Date.now();
    if (this.cachedState && now - this.lastCheckTime < 5 * 60 * 1000) {
      return this.cachedState;
    }

    try {
      // In production, this would use a native module
      // Example using react-native-device-info or custom native code:
      // const isIgnored = await NativeModules.BatteryOptimization?.isIgnoringBatteryOptimizations();

      // For now, return unknown
      const state: BatteryOptimizationState = "unknown";

      this.cachedState = state;
      this.lastCheckTime = now;

      logDebug("Battery optimization state checked", { state });
      return state;
    } catch (error) {
      logError("Failed to check battery optimization state", error);
      return "unknown";
    }
  }

  /**
   * Check if app needs to request battery optimization exemption
   */
  async needsExemption(): Promise<boolean> {
    const state = await this.checkState();
    return state === "optimized";
  }

  // ============================================================================
  // Request Exemption
  // ============================================================================

  /**
   * Request battery optimization exemption from the user
   * Shows system dialog on Android 6.0+
   */
  async requestExemption(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return true;
    }

    const currentState = await this.checkState();
    if (currentState === "ignored") {
      logDebug("Already exempt from battery optimization");
      return true;
    }

    logInfo("Requesting battery optimization exemption");

    try {
      // In production, this would use a native module to show the system dialog
      // Example:
      // await NativeModules.BatteryOptimization?.requestIgnoreBatteryOptimizations();

      // Alternative: Open battery settings
      await Linking.openSettings();

      return true;
    } catch (error) {
      logError("Failed to request battery optimization exemption", error);
      return false;
    }
  }

  /**
   * Show a user-friendly prompt explaining why battery optimization exemption is needed
   */
  async showExemptionPrompt(options?: {
    title?: string;
    message?: string;
    onSkip?: () => void;
  }): Promise<void> {
    if (Platform.OS !== "android") {
      return;
    }

    // Don't show if already exempt
    const needsPrompt = await this.needsExemption();
    if (!needsPrompt) {
      return;
    }

    // Don't show if already shown this session
    if (this.hasShownPrompt) {
      return;
    }

    const title = options?.title || "Enable Background Calls";
    const message =
      options?.message ||
      "To receive calls when the app is closed, Vibe needs to be excluded from battery optimization.\n\n" +
        "This ensures you don't miss important calls.";

    this.hasShownPrompt = true;

    Alert.alert(
      title,
      message,
      [
        {
          text: "Not Now",
          style: "cancel",
          onPress: options?.onSkip,
        },
        {
          text: "Enable",
          onPress: () => this.requestExemption(),
        },
      ],
      { cancelable: true },
    );
  }

  // ============================================================================
  // Manufacturer-Specific Settings
  // ============================================================================

  /**
   * Open manufacturer-specific battery/power management settings
   * Different Android manufacturers have custom power management that can block background apps
   */
  async openManufacturerSettings(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return false;
    }

    logInfo("Opening manufacturer battery settings");

    try {
      // Try to detect manufacturer and open appropriate settings
      // This would typically use Device.manufacturer from expo-device or react-native-device-info

      // Common manufacturer intent paths:
      // Xiaomi: com.miui.securitycenter
      // Huawei: com.huawei.systemmanager
      // Samsung: com.samsung.android.lool
      // Oppo/Realme: com.coloros.safecenter
      // Vivo: com.vivo.permissionmanager
      // OnePlus: com.oneplus.security

      // For now, open general app settings
      await Linking.openSettings();
      return true;
    } catch (error) {
      logError("Failed to open manufacturer settings", error);
      return false;
    }
  }

  /**
   * Check if this is a manufacturer known for aggressive battery optimization
   */
  async isAggressiveManufacturer(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return false;
    }

    // In production, check Device.manufacturer against known list:
    const aggressiveManufacturers = [
      "xiaomi",
      "huawei",
      "oppo",
      "vivo",
      "realme",
      "oneplus",
      "meizu",
      "asus",
      "lenovo",
    ];

    // Would use: const manufacturer = await Device.manufacturer;
    // For now, return false
    return false;
  }

  /**
   * Show manufacturer-specific instructions if needed
   */
  async showManufacturerInstructions(): Promise<void> {
    if (Platform.OS !== "android") {
      return;
    }

    const isAggressive = await this.isAggressiveManufacturer();
    if (!isAggressive) {
      return;
    }

    Alert.alert(
      "Additional Setup May Be Required",
      "Your device may have additional battery saving features that could prevent calls from coming through.\n\n" +
        "Please make sure Vibe is allowed to run in the background in your device's power management settings.",
      [
        {
          text: "Open Settings",
          onPress: () => this.openManufacturerSettings(),
        },
        {
          text: "Later",
          style: "cancel",
        },
      ],
    );
  }

  // ============================================================================
  // Auto-Start Permission (Xiaomi, Huawei, etc.)
  // ============================================================================

  /**
   * Check and request auto-start permission (for devices that require it)
   */
  async checkAutoStartPermission(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return true;
    }

    try {
      // In production:
      // return await NativeModules.AutoStartPermission?.isEnabled();
      return true;
    } catch (error) {
      logError("Failed to check auto-start permission", error);
      return false;
    }
  }

  /**
   * Open auto-start permission settings
   */
  async openAutoStartSettings(): Promise<boolean> {
    if (Platform.OS !== "android") {
      return false;
    }

    try {
      // In production, open manufacturer-specific auto-start settings
      await Linking.openSettings();
      return true;
    } catch (error) {
      logError("Failed to open auto-start settings", error);
      return false;
    }
  }

  // ============================================================================
  // Complete Setup Check
  // ============================================================================

  /**
   * Perform complete background capability check
   */
  async performCompleteCheck(): Promise<{
    batteryOptimization: BatteryOptimizationState;
    needsManufacturerSetup: boolean;
    isFullyConfigured: boolean;
  }> {
    const batteryState = await this.checkState();
    const isAggressive = await this.isAggressiveManufacturer();

    const isFullyConfigured =
      batteryState === "ignored" || batteryState === "not_applicable";

    return {
      batteryOptimization: batteryState,
      needsManufacturerSetup: isAggressive,
      isFullyConfigured: isFullyConfigured && !isAggressive,
    };
  }

  /**
   * Guide user through complete background setup
   */
  async guideUserSetup(): Promise<void> {
    const check = await this.performCompleteCheck();

    if (check.isFullyConfigured) {
      logDebug("Background calls fully configured");
      return;
    }

    // First, handle battery optimization
    if (check.batteryOptimization === "optimized") {
      await this.showExemptionPrompt();
    }

    // Then, handle manufacturer-specific settings
    if (check.needsManufacturerSetup) {
      await this.showManufacturerInstructions();
    }
  }

  // ============================================================================
  // Reset
  // ============================================================================

  /**
   * Reset cached state and prompt flags
   */
  reset(): void {
    this.cachedState = null;
    this.lastCheckTime = 0;
    this.hasShownPrompt = false;
  }
}

export const batteryOptimizationHandler =
  BatteryOptimizationHandler.getInstance();
