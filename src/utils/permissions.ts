/**
 * PERMISSIONS UTILITY MODULE
 * Handles camera, microphone, photo library, and notification permissions
 * Supports both iOS and Android
 */

import { Camera } from "expo-camera";
import * as Notifications from "expo-notifications";

/**
 * Permission types for picture features
 */
export enum PermissionType {
  CAMERA = "camera",
  MICROPHONE = "microphone",
  PHOTO_LIBRARY = "photo_library",
  NOTIFICATIONS = "notifications",
}

/**
 * Permission status
 */
export enum PermissionStatus {
  GRANTED = "granted",
  DENIED = "denied",
  UNDETERMINED = "undetermined",
}

/**
 * Request camera permission
 * Required for: Photo capture, video recording
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    console.log("[Permissions] Requesting camera permission");

    const { status } = await Camera.requestCameraPermissionsAsync();

    if (status === "granted") {
      console.log("[Permissions] Camera permission granted");
      return true;
    } else {
      console.warn("[Permissions] Camera permission denied");
      return false;
    }
  } catch (error) {
    console.error("[Permissions] Failed to request camera permission:", error);
    return false;
  }
}

/**
 * Request microphone permission
 * Required for: Video with audio recording
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    console.log("[Permissions] Requesting microphone permission");

    const { status } = await Camera.requestMicrophonePermissionsAsync();

    if (status === "granted") {
      console.log("[Permissions] Microphone permission granted");
      return true;
    } else {
      console.warn("[Permissions] Microphone permission denied");
      return false;
    }
  } catch (error) {
    console.error(
      "[Permissions] Failed to request microphone permission:",
      error,
    );
    return false;
  }
}

/**
 * Request photo library permission
 * Required for: Accessing saved photos/videos, saving snaps
 */
export async function requestPhotoLibraryPermission(): Promise<boolean> {
  try {
    console.log("[Permissions] Requesting photo library permission");

    // expo-media-library is not installed; return true as placeholder
    // TODO: Install expo-media-library for production
    console.log("[Permissions] Photo library permission granted (placeholder)");
    return true;
  } catch (error) {
    console.error(
      "[Permissions] Failed to request photo library permission:",
      error,
    );
    return false;
  }
}

/**
 * Request notification permission
 * Required for: Push notifications for picture events
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    console.log("[Permissions] Requesting notification permission");

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status === "granted") {
      console.log("[Permissions] Notification permission granted");
      return true;
    } else {
      console.warn("[Permissions] Notification permission denied");
      return false;
    }
  } catch (error) {
    console.error(
      "[Permissions] Failed to request notification permission:",
      error,
    );
    return false;
  }
}

/**
 * Request all permissions required for picture features
 */
export async function requestAllSnapPermissions(): Promise<{
  camera: boolean;
  microphone: boolean;
  photoLibrary: boolean;
  notifications: boolean;
}> {
  try {
    console.log("[Permissions] Requesting all picture permissions");

    const results = await Promise.all([
      requestCameraPermission(),
      requestMicrophonePermission(),
      requestPhotoLibraryPermission(),
      requestNotificationPermission(),
    ]);

    const permissionStatus = {
      camera: results[0],
      microphone: results[1],
      photoLibrary: results[2],
      notifications: results[3],
    };

    console.log("[Permissions] Permission request results:", permissionStatus);
    return permissionStatus;
  } catch (error) {
    console.error("[Permissions] Failed to request all permissions:", error);
    return {
      camera: false,
      microphone: false,
      photoLibrary: false,
      notifications: false,
    };
  }
}

/**
 * Check if camera permission is granted
 */
export async function hasCameraPermission(): Promise<boolean> {
  try {
    const { status } = await Camera.getCameraPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("[Permissions] Failed to check camera permission:", error);
    return false;
  }
}

/**
 * Check if microphone permission is granted
 */
export async function hasMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Camera.getMicrophonePermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error(
      "[Permissions] Failed to check microphone permission:",
      error,
    );
    return false;
  }
}

/**
 * Check if photo library permission is granted
 */
export async function hasPhotoLibraryPermission(): Promise<boolean> {
  try {
    // expo-media-library is not installed; return true as placeholder
    return true;
  } catch (error) {
    console.error(
      "[Permissions] Failed to check photo library permission:",
      error,
    );
    return false;
  }
}

/**
 * Check if notification permission is granted
 */
export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted;
  } catch (error) {
    console.error(
      "[Permissions] Failed to check notification permission:",
      error,
    );
    return false;
  }
}

/**
 * Check all picture permissions
 */
export async function checkAllSnapPermissions(): Promise<{
  camera: boolean;
  microphone: boolean;
  photoLibrary: boolean;
  notifications: boolean;
  allGranted: boolean;
}> {
  try {
    console.log("[Permissions] Checking all picture permissions");

    const results = await Promise.all([
      hasCameraPermission(),
      hasMicrophonePermission(),
      hasPhotoLibraryPermission(),
      hasNotificationPermission(),
    ]);

    const status = {
      camera: results[0],
      microphone: results[1],
      photoLibrary: results[2],
      notifications: results[3],
      allGranted: results.every((permission) => permission),
    };

    console.log("[Permissions] Permission check results:", status);
    return status;
  } catch (error) {
    console.error("[Permissions] Failed to check all permissions:", error);
    return {
      camera: false,
      microphone: false,
      photoLibrary: false,
      notifications: false,
      allGranted: false,
    };
  }
}

/**
 * Get permission status description (for UI display)
 */
export function getPermissionStatusText(
  permissionType: PermissionType,
  isGranted: boolean,
): string {
  const permissionNames: Record<PermissionType, string> = {
    [PermissionType.CAMERA]: "Camera",
    [PermissionType.MICROPHONE]: "Microphone",
    [PermissionType.PHOTO_LIBRARY]: "Photo Library",
    [PermissionType.NOTIFICATIONS]: "Notifications",
  };

  const name = permissionNames[permissionType];
  return isGranted ? `${name} permission granted` : `${name} permission denied`;
}

/**
 * Get permission error message (for displaying to user)
 */
export function getPermissionErrorMessage(
  permissionType: PermissionType,
): string {
  const messages: Record<PermissionType, string> = {
    [PermissionType.CAMERA]:
      "Camera access is required to take photos and record videos. Please enable it in Settings.",
    [PermissionType.MICROPHONE]:
      "Microphone access is required to record videos with audio. Please enable it in Settings.",
    [PermissionType.PHOTO_LIBRARY]:
      "Photo Library access is required to save pictures and upload photos. Please enable it in Settings.",
    [PermissionType.NOTIFICATIONS]:
      "Notification permission allows you to receive alerts when someone views or reacts to your pictures.",
  };

  return messages[permissionType];
}

/**
 * Check if permission requires iOS-specific handling
 */
export function isIOSSpecificPermission(
  permissionType: PermissionType,
): boolean {
  // NSPhotoLibraryAddOnlyUsageDescription for iOS 14+
  return permissionType === PermissionType.PHOTO_LIBRARY;
}

/**
 * Check if permission requires Android-specific handling
 */
export function isAndroidSpecificPermission(
  permissionType: PermissionType,
): boolean {
  // Android runtime permissions for API 23+
  return (
    permissionType === PermissionType.CAMERA ||
    permissionType === PermissionType.MICROPHONE ||
    permissionType === PermissionType.PHOTO_LIBRARY
  );
}

/**
 * Initialize permission monitoring
 * Should be called on app startup
 */
export async function initializePermissions(): Promise<void> {
  try {
    console.log("[Permissions] Initializing permission monitoring");

    // Check permissions on startup
    const permissions = await checkAllSnapPermissions();

    console.log("[Permissions] Initial permission state:", permissions);

    // Request critical permissions if not already granted
    // Camera is essential for app functionality
    if (!permissions.camera) {
      console.warn(
        "[Permissions] Camera permission not granted - app functionality limited",
      );
    }

    // Notifications are recommended but not critical
    if (!permissions.notifications) {
      console.log(
        "[Permissions] Notification permission not granted - user won't receive alerts",
      );
    }

    console.log("[Permissions] Permission initialization complete");
  } catch (error) {
    console.error("[Permissions] Failed to initialize permissions:", error);
  }
}

/**
 * Get list of required permissions for picture capture
 */
export function getRequiredCapturePermissions(): PermissionType[] {
  return [PermissionType.CAMERA, PermissionType.MICROPHONE];
}

/**
 * Get list of recommended permissions for app
 */
export function getRecommendedPermissions(): PermissionType[] {
  return [
    PermissionType.CAMERA,
    PermissionType.MICROPHONE,
    PermissionType.PHOTO_LIBRARY,
    PermissionType.NOTIFICATIONS,
  ];
}

/**
 * Check if required capture permissions are granted
 */
export async function hasRequiredCapturePermissions(): Promise<boolean> {
  try {
    const permissions = await checkAllSnapPermissions();
    return permissions.camera && permissions.microphone;
  } catch (error) {
    console.error(
      "[Permissions] Failed to check required capture permissions:",
      error,
    );
    return false;
  }
}

/**
 * Request required capture permissions
 */
export async function requestRequiredCapturePermissions(): Promise<boolean> {
  try {
    console.log(
      "[Permissions] Requesting required capture permissions (camera + microphone)",
    );

    const camera = await requestCameraPermission();
    const microphone = await requestMicrophonePermission();

    const allGranted = camera && microphone;

    if (!allGranted) {
      console.warn("[Permissions] Not all required permissions were granted");
    }

    return allGranted;
  } catch (error) {
    console.error(
      "[Permissions] Failed to request required permissions:",
      error,
    );
    return false;
  }
}
