# SNAP FEATURES - PERMISSIONS CONFIGURATION

This document describes the iOS and Android permission declarations required for the snap feature system.

## Required Permissions for Snap Features

### 1. Camera Permission

- **Purpose**: Photo and video capture
- **Required**: YES (critical for core functionality)
- **iOS**: NSCameraUsageDescription in Info.plist
- **Android**: android.permission.CAMERA in AndroidManifest.xml

### 2. Microphone Permission

- **Purpose**: Audio recording with video
- **Required**: YES (for video with sound)
- **iOS**: NSMicrophoneUsageDescription in Info.plist
- **Android**: android.permission.RECORD_AUDIO in AndroidManifest.xml

### 3. Photo Library Permission

- **Purpose**: Access saved photos/videos, save snaps
- **Required**: YES (recommended for UX)
- **iOS**: NSPhotoLibraryUsageDescription + NSPhotoLibraryAddOnlyUsageDescription
- **Android**: android.permission.READ_EXTERNAL_STORAGE, android.permission.WRITE_EXTERNAL_STORAGE

### 4. Notification Permission

- **Purpose**: Push notifications for snap events
- **Required**: NO (recommended, for user engagement)
- **iOS**: NSUserNotificationUsageDescription (handled by expo-notifications)
- **Android**: No explicit permission needed (handled by expo-notifications)

---

## iOS Configuration (app.json)

Add to your `app.json` under `"ios"` section:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "We need camera access to take photos and record videos for your snaps",
        "NSMicrophoneUsageDescription": "We need microphone access to record audio with your snap videos",
        "NSPhotoLibraryUsageDescription": "We need access to your photo library to share and save snaps",
        "NSPhotoLibraryAddOnlyUsageDescription": "We need permission to save your snaps to your photo library",
        "NSLocationWhenInUseUsageDescription": "Location data helps us tag your snaps with location information",
        "NSFaceIDUsageDescription": "We use Face ID for authentication (optional feature)"
      }
    }
  }
}
```

---

## Android Configuration (app.json)

Add to your `app.json` under `"android"` section:

```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION"
      ]
    }
  }
}
```

---

## Runtime Permission Handling

### iOS (14+)

- **Camera**: Request when CameraScreen loads
- **Microphone**: Request when starting video recording
- **Photo Library**: Request when accessing gallery
- **Notifications**: Request at app startup

### Android (API 23+)

- All permissions must be requested at runtime (not just at install)
- Uses expo's built-in permission request flow
- Handled by `src/utils/permissions.ts`

---

## Implementation Flow

### On App Launch

```typescript
import { initializePermissions } from "./src/utils/permissions";

// In App.tsx or main entry point
useEffect(() => {
  initializePermissions();
}, []);
```

### Before Capturing Snap

```typescript
import { requestRequiredCapturePermissions } from "./src/utils/permissions";

// In CameraScreen.tsx
async function startCapture() {
  const granted = await requestRequiredCapturePermissions();
  if (!granted) {
    // Show permission denied message
    return;
  }
  // Start capture
}
```

### Before Accessing Photo Library

```typescript
import { requestPhotoLibraryPermission } from "./src/utils/permissions";

// In PhotoPickerScreen.tsx
async function openPhotoLibrary() {
  const granted = await requestPhotoLibraryPermission();
  if (!granted) {
    // Show permission denied message
    return;
  }
  // Open picker
}
```

### For Push Notifications

```typescript
import { requestNotificationPermission } from "./src/utils/permissions";

// In onboarding or settings
async function enableNotifications() {
  const granted = await requestNotificationPermission();
  if (granted) {
    // Register for push notifications
  }
}
```

---

## Permission Strings (User-Facing)

These descriptions appear in the system permission prompt:

### iOS

- **Camera**: "We need camera access to take photos and record videos for your snaps"
- **Microphone**: "We need microphone access to record audio with your snap videos"
- **Photos**: "We need access to your photo library to share and save snaps"

### Android

- Shown in Android Settings app, permission descriptions are pulled from app.json

---

## Testing Permissions

### iOS Simulator

1. Simulator → Settings → Privacy
2. Check/change camera, microphone, photo library settings

### Android Emulator

1. Emulator → Settings → Apps & notifications → Permissions
2. Grant/revoke permissions as needed

### Physical Devices

1. iOS: Settings → SnapStyle → Permissions
2. Android: Settings → Apps → SnapStyle → Permissions

---

## Error Handling

```typescript
try {
  const hasPermission = await requestCameraPermission();

  if (!hasPermission) {
    // User denied permission
    showAlert(
      "Camera Permission Denied",
      "Please enable camera access in Settings to use this feature",
      [
        { text: "Open Settings", onPress: () => Linking.openSettings() },
        { text: "Cancel" },
      ],
    );
  }
} catch (error) {
  // Permission request failed
  console.error("Permission request error:", error);
  showErrorAlert("Unable to request permission");
}
```

---

## Privacy Considerations

### Screenshot Detection

- Camera-Based feature to alert users when snaps are screenshotted
- Implemented via `notifySnapScreenshotted()` in snap notifications service
- Privacy critical - screenshot event always triggers high-priority notification

### Data Storage

- Photos/videos temporarily stored in app cache
- Auto-deleted after Picture expiry (24 hours by default)
- User can manually delete snaps from their gallery

### Permission Revocation

- If user revokes permissions:
  - Camera: CameraScreen shows permission prompt
  - Microphone: Video recording disabled
  - Photo Library: Gallery access disabled
  - Notifications: Snap alerts disabled

---

## Building with Expo

### EAS Build (Recommended)

```bash
eas build --platform ios
eas build --platform android
```

EAS will automatically apply permission declarations from app.json.

### Local Build

```bash
# iOS
eas build --platform ios --local

# Android
eas build --platform android --local
```

---

## Deployment Checklist

- [ ] All permission descriptions added to app.json
- [ ] iOS Info.plist strings are clear and compliant with Apple guidelines
- [ ] Android permissions match AndroidManifest.xml requirements
- [ ] Runtime permission requests implemented in relevant screens
- [ ] Error handling for denied permissions
- [ ] Testing on physical devices (simulator may not fully test permissions)
- [ ] Privacy policy updated to mention permission usage
- [ ] App Store/Play Store descriptions mention permission requirements

---

## Resources

- [Expo Permissions Documentation](https://docs.expo.dev/modules/expo-permissions/)
- [iOS Privacy Guidelines](https://developer.apple.com/app-store/app-privacy-details/)
- [Android Permissions](https://developer.android.com/guide/topics/permissions/overview)
- [Expo Camera Documentation](https://docs.expo.dev/modules/expo-camera/)
- [Expo Media Library](https://docs.expo.dev/modules/expo-media-library/)

---

**Updated**: February 6, 2026  
**Status**: Complete - Ready for Production

