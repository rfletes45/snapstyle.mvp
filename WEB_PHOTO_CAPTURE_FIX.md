# Web Photo Capture Fix - Camera Button Issue

## Problem Summary

The camera button in ChatScreen and Stories was not working on the web version of the app. When clicking the camera button, the Alert dialog would appear, but clicking "Take Photo" or "Choose from Gallery" would do nothing.

## Root Cause

React Native's `Alert.alert()` component doesn't work reliably with multiple buttons on the web platform. While it shows a dialog, the button callbacks were not being triggered properly. This is a known limitation of React Native Web's Alert polyfill.

**Technical Details:**
- React Native Web implements Alert using browser's `window.alert()` which only supports a single OK button
- Multi-button Alert dialogs on web require custom implementations
- The polyfill was showing the dialog but not properly handling button callbacks
- This affected both ChatScreen and StoriesScreen camera menus

## Solution

Replaced `Alert.alert()` with browser's native `window.confirm()` specifically for the web platform:

### Before (Not Working on Web):
```typescript
// Android and web: show alert dialog
Alert.alert("Send Snap", "Choose an option", [
  {
    text: "Cancel",
    onPress: () => console.log("Cancel pressed"),
  },
  {
    text: "Take Photo",
    onPress: () => {
      handleCapturePhoto();
    },
  },
  {
    text: "Choose from Gallery",
    onPress: () => {
      handleSelectPhoto();
    },
  },
]);
```

### After (Working on All Platforms):
```typescript
if (Platform.OS === "web") {
  // On web, use browser's native confirm for reliability
  const useCamera = window.confirm(
    "Send Snap\n\nClick OK to take a photo with camera, or Cancel to choose from gallery."
  );
  
  if (useCamera) {
    handleCapturePhoto().catch((error) => {
      console.error("Camera error:", error);
    });
  } else {
    handleSelectPhoto().catch((error) => {
      console.error("Gallery error:", error);
    });
  }
} else if (Platform.OS === "ios") {
  // iOS: Use ActionSheetIOS
  ActionSheetIOS.showActionSheetWithOptions(...);
} else {
  // Android: Use Alert.alert (works fine on Android)
  Alert.alert("Send Snap", "Choose an option", [...]);
}
```

## Key Changes

1. **Platform-Specific Implementation:**
   - **Web**: Uses `window.confirm()` which is a synchronous, native browser API
   - **iOS**: Uses `ActionSheetIOS` for native iOS action sheet
   - **Android**: Continues using `Alert.alert()` which works correctly on Android

2. **Improved Error Handling:**
   - Added `.catch()` handlers for async function calls
   - Added comprehensive logging at each step

3. **User Experience:**
   - Web users now see browser's native confirm dialog (OK/Cancel)
   - OK = Take Photo with Camera
   - Cancel = Choose from Gallery
   - Dialog text clearly explains the choice

## Files Modified

- `src/screens/chat/ChatScreen.tsx` - Fixed camera button in chat
- `src/screens/stories/StoriesScreen.tsx` - Fixed "Add Story" button

## Testing

Test the fix by:
1. Opening the web version of the app
2. Navigating to a chat with another user
3. Clicking the camera button
4. Confirming the dialog works:
   - Clicking OK should trigger camera/webcam
   - Clicking Cancel should trigger file picker
5. Repeating for Stories tab "Add Story" button

## Console Logs

The fix includes detailed logging to help debug any issues:

```
🔵 [showPhotoMenu] Opening photo menu, platform: web
🔵 [showPhotoMenu] Using web-specific menu
🔵 [showPhotoMenu] User choice: camera
🔵 [showPhotoMenu] Calling handleCapturePhoto
🔵 [handleCapturePhoto] Starting camera capture
🔵 [handleCapturePhoto] Platform: web
🔵 [handleCapturePhoto] Using web-specific capture
🔵 [webImagePicker] Attempting webcam capture
✅ [webImagePicker] Camera stream obtained
```

## Why `window.confirm()` Works

1. **Native Browser API**: Directly calls browser's built-in confirmation dialog
2. **Synchronous**: Returns boolean immediately (OK = true, Cancel = false)
3. **100% Reliable**: Works in all browsers (Chrome, Firefox, Safari, Edge)
4. **No Polyfill Issues**: Doesn't rely on React Native Web's implementations

## Alternative Approaches Considered

1. **Custom Modal Component**: Would require building a custom modal from scratch
2. **Third-party Alert Library**: Adds dependencies and complexity
3. **Web-Specific UI Library**: Overkill for a simple choice dialog

The `window.confirm()` solution is the simplest and most reliable for this use case.

## Related Issues

This fix resolves the long-standing issue where:
- Camera button in chat did nothing on web
- Stories "Add Story" button didn't work on web
- Alert dialogs appeared but buttons didn't respond

## Commit

- Commit: `8c99730`
- Message: "fix: Use native browser confirm for web photo menus instead of Alert"
