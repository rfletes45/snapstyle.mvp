/**
 * useSnapCapture Hook (UNI-05 Extraction)
 *
 * Extracts photo capture functionality from ChatScreen to reduce duplication.
 * Handles camera/gallery permissions, image selection, compression, and upload.
 */

import { sendMessageWithOutbox } from "@/services/chatV2";
import { compressImage, uploadSnapImage } from "@/services/storage";
import { updateStreakAfterMessage } from "@/services/streakCosmetics";
import {
  captureImageFromWebcam,
  pickImageFromWeb,
} from "@/utils/webImagePicker";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { ActionSheetIOS, Alert, Platform } from "react-native";

const DEBUG_CAPTURE = false;

interface UseSnapCaptureConfig {
  /** Current user ID */
  uid: string | undefined;
  /** Friend's user ID (for streak tracking) */
  friendUid: string;
  /** Current chat/conversation ID */
  chatId: string | null;
  /** Optional callback after successful upload */
  onUploadComplete?: () => void;
  /** Enable debug logging */
  debug?: boolean;
  /** Route params from navigation (to receive captured image back) */
  routeParams?: Record<string, any>;
}

interface UseSnapCaptureReturn {
  /** Whether a picture is currently being uploaded */
  uploadingSnap: boolean;
  /** Capture a photo from camera */
  handleCapturePhoto: () => Promise<void>;
  /** Select a photo from gallery */
  handleSelectPhoto: () => Promise<void>;
  /** Show platform-appropriate photo options menu */
  showPhotoMenu: () => void;
  /** Direct upload handler for a given image URI */
  handleSnapUpload: (imageUri: string) => Promise<void>;
}

/**
 * Milestone messages for streak celebrations
 */
const MILESTONE_MESSAGES: Record<number, string> = {
  3: "🔥 3-day streak! You're on fire!\n\nUnlocked: Flame Cap 🔥",
  7: "🔥 1 week streak! Amazing!\n\nUnlocked: Cool Shades 😎",
  14: "🔥 2 week streak! Incredible!\n\nUnlocked: Gradient Glow ✨",
  30: "🔥 30-day streak! One month!\n\nUnlocked: Golden Crown 👑",
  50: "🔥 50-day streak! Legendary!\n\nUnlocked: Star Glasses 🤩",
  100: "💯 100-day streak! Champion!\n\nUnlocked: Rainbow Burst 🌈",
  365: "🏆 365-day streak! One year!\n\nUnlocked: Legendary Halo 😇",
};

export function useSnapCapture(
  config: UseSnapCaptureConfig,
): UseSnapCaptureReturn {
  const {
    uid,
    friendUid,
    chatId,
    onUploadComplete,
    debug = DEBUG_CAPTURE,
    routeParams,
  } = config;
  const [uploadingSnap, setUploadingSnap] = useState(false);
  const navigation = useNavigation<any>();

  // Listen for captured image returned from CameraScreen in chat mode
  useEffect(() => {
    if (routeParams?.capturedImageUri) {
      if (debug) {
        console.log(
          "🔵 [useSnapCapture] Received captured image from Camera:",
          routeParams.capturedImageUri,
        );
      }
      handleSnapUpload(routeParams.capturedImageUri);
    }
  }, [routeParams?.capturedImageUri]);

  // Request media library permission
  const requestMediaLibraryPermission =
    useCallback(async (): Promise<boolean> => {
      try {
        if (debug) {
          console.log(
            "🔵 [useSnapCapture] Requesting media library permissions...",
          );
        }
        const { granted } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (debug) {
          console.log("✅ [useSnapCapture] Media permission result:", granted);
        }

        if (!granted) {
          Alert.alert(
            "Permission Denied",
            "Media library access is required to select photos",
          );
          return false;
        }
        return true;
      } catch (error) {
        console.error("❌ [useSnapCapture] Media permission error:", error);
        return true; // On web, permissions don't apply - continue anyway
      }
    }, [debug]);

  // Request camera permission
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (debug) {
        console.log("🔵 [useSnapCapture] Requesting camera permissions...");
      }
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (debug) {
        console.log("✅ [useSnapCapture] Camera permission result:", granted);
      }

      if (!granted) {
        Alert.alert(
          "Permission Denied",
          "Camera access is required to take photos",
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("❌ [useSnapCapture] Camera permission error:", error);
      return true; // On web, permissions don't apply - continue anyway
    }
  }, [debug]);

  // Handle picture upload and send
  const handleSnapUpload = useCallback(
    async (imageUri: string): Promise<void> => {
      if (debug) {
        console.log("🔵 [useSnapCapture] Starting upload with URI:", imageUri);
      }

      if (!uid || !chatId) {
        console.error("❌ [useSnapCapture] Missing uid or chatId:", {
          uid,
          chatId,
        });
        Alert.alert("Error", "Chat not initialized");
        return;
      }

      try {
        setUploadingSnap(true);

        // Compress image
        if (debug) {
          console.log("🔵 [useSnapCapture] Starting compression...");
        }
        const compressedUri = await compressImage(imageUri);
        if (debug) {
          console.log(
            "✅ [useSnapCapture] Compression complete:",
            compressedUri,
          );
        }

        // Upload to Storage and get storagePath
        const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (debug) {
          console.log(
            "🔵 [useSnapCapture] Uploading to Storage with messageId:",
            messageId,
          );
        }
        const storagePath = await uploadSnapImage(
          chatId,
          messageId,
          compressedUri,
        );
        if (debug) {
          console.log(
            "✅ [useSnapCapture] Upload complete, storagePath:",
            storagePath,
          );
        }

        // Send as image message using V2
        if (debug) {
          console.log("🔵 [useSnapCapture] Sending message via V2...");
        }
        const { sendPromise } = await sendMessageWithOutbox({
          conversationId: chatId,
          scope: "dm",
          kind: "media",
          text: storagePath, // Storage path as content
        });
        if (debug) {
          console.log(
            "✅ [useSnapCapture] Message enqueued, waiting for send...",
          );
        }

        // Wait for send to complete
        const sendResult = await sendPromise;
        if (!sendResult.success) {
          throw new Error(sendResult.error || "Failed to send picture");
        }
        if (debug) {
          console.log("✅ [useSnapCapture] Message sent successfully");
        }

        // Update streak (separate from V2 message sending)
        const { newCount, milestoneReached } = await updateStreakAfterMessage(
          uid,
          friendUid,
        );
        console.log("✅ [useSnapCapture] Streak updated:", {
          newCount,
          milestoneReached,
        });

        // Show celebration if milestone reached
        if (milestoneReached) {
          const message =
            MILESTONE_MESSAGES[milestoneReached] ||
            `🎉 ${milestoneReached}-day streak milestone!`;
          Alert.alert("Streak Milestone! 🎉", message);
        } else {
          Alert.alert("Success", "Picture sent!");
        }

        onUploadComplete?.();
      } catch (error) {
        console.error("❌ [useSnapCapture] Error:", error);
        Alert.alert("Error", `Failed to send picture: ${String(error)}`);
      } finally {
        setUploadingSnap(false);
      }
    },
    [uid, chatId, friendUid, debug, onUploadComplete],
  );

  // Capture photo from camera — navigates to built-in CameraScreen
  const handleCapturePhoto = useCallback(async (): Promise<void> => {
    if (debug) {
      console.log("🔵 [useSnapCapture] Starting camera capture");
    }

    try {
      if (debug) {
        console.log("🔵 [useSnapCapture] Platform:", Platform.OS);
      }

      // On web, use webcam or file picker
      if (Platform.OS === "web") {
        if (debug) {
          console.log("🔵 [useSnapCapture] Using web-specific capture");
        }
        const imageUri = await captureImageFromWebcam();
        if (imageUri) {
          if (debug) {
            console.log("✅ [useSnapCapture] Image captured, uploading...");
          }
          await handleSnapUpload(imageUri);
        }
      } else {
        // On native platforms, navigate to the built-in CameraScreen
        if (debug) {
          console.log(
            "🔵 [useSnapCapture] Navigating to Camera screen (chat mode)",
          );
        }
        navigation.navigate("Camera", {
          mode: "chat",
          returnRoute: "ChatDetail",
          returnData: { friendUid, chatId },
        });
      }
    } catch (error) {
      console.error("❌ [useSnapCapture] Camera error:", error);
      Alert.alert("Error", `Failed to capture photo: ${String(error)}`);
    }
  }, [debug, handleSnapUpload, navigation, friendUid, chatId]);

  // Select photo from gallery
  const handleSelectPhoto = useCallback(async (): Promise<void> => {
    if (debug) {
      console.log("🔵 [useSnapCapture] Starting gallery selection");
    }
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      if (debug) {
        console.warn("⚠️  [useSnapCapture] Permission denied");
      }
      return;
    }

    try {
      if (debug) {
        console.log("🔵 [useSnapCapture] Platform:", Platform.OS);
      }

      let imageUri: string | null = null;

      // On web, use file picker
      if (Platform.OS === "web") {
        if (debug) {
          console.log("🔵 [useSnapCapture] Using web file picker");
        }
        imageUri = await pickImageFromWeb();
      } else {
        // On native platforms, use expo-image-picker
        if (debug) {
          console.log("🔵 [useSnapCapture] Launching image library...");
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          aspect: [1, 1],
          quality: 1,
        });

        if (debug) {
          console.log("✅ [useSnapCapture] Library result:", {
            canceled: result.canceled,
            assetsCount: result.assets?.length || 0,
          });
        }

        if (!result.canceled && result.assets.length > 0) {
          imageUri = result.assets[0].uri;
        }
      }

      if (imageUri) {
        if (debug) {
          console.log("✅ [useSnapCapture] Image selected, uploading...");
        }
        await handleSnapUpload(imageUri);
      } else if (debug) {
        console.log("ℹ️  [useSnapCapture] User cancelled selection");
      }
    } catch (error) {
      console.error("❌ [useSnapCapture] Gallery error:", error);
      Alert.alert("Error", `Failed to select photo: ${String(error)}`);
    }
  }, [debug, requestMediaLibraryPermission, handleSnapUpload]);

  // Show photo options menu
  const showPhotoMenu = useCallback((): void => {
    if (debug) {
      console.log(
        "🔵 [useSnapCapture] Opening photo menu, platform:",
        Platform.OS,
      );
    }

    if (Platform.OS === "web") {
      // On web, Alert doesn't work reliably with multiple buttons
      // Use browser's confirm() for a simple choice
      if (debug) {
        console.log("🔵 [useSnapCapture] Using web-specific menu");
      }

      const useCamera = window.confirm(
        "Send Picture\n\nClick OK to take a photo with camera, or Cancel to choose from gallery.",
      );

      if (debug) {
        console.log(
          "🔵 [useSnapCapture] User choice:",
          useCamera ? "camera" : "gallery",
        );
      }

      if (useCamera) {
        handleCapturePhoto().catch((error) => {
          console.error("❌ [useSnapCapture] Camera error:", error);
        });
      } else {
        handleSelectPhoto().catch((error) => {
          console.error("❌ [useSnapCapture] Gallery error:", error);
        });
      }
    } else if (Platform.OS === "ios") {
      if (debug) {
        console.log("🔵 [useSnapCapture] Using ActionSheetIOS");
      }
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Gallery"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (debug) {
            console.log("🔵 [useSnapCapture] Selected option:", buttonIndex);
          }
          if (buttonIndex === 1) {
            handleCapturePhoto();
          } else if (buttonIndex === 2) {
            handleSelectPhoto();
          }
        },
      );
    } else {
      // Android: show alert dialog
      if (debug) {
        console.log("🔵 [useSnapCapture] Using Alert dialog");
      }
      Alert.alert("Send Picture", "Choose an option", [
        {
          text: "Cancel",
          onPress: () => {
            if (debug) console.log("🔵 [useSnapCapture] Cancel pressed");
          },
        },
        {
          text: "Take Photo",
          onPress: () => {
            if (debug) console.log("🔵 [useSnapCapture] Take Photo pressed");
            handleCapturePhoto();
          },
        },
        {
          text: "Choose from Gallery",
          onPress: () => {
            if (debug)
              console.log("🔵 [useSnapCapture] Choose from Gallery pressed");
            handleSelectPhoto();
          },
        },
      ]);
    }
  }, [debug, handleCapturePhoto, handleSelectPhoto]);

  return {
    uploadingSnap,
    handleCapturePhoto,
    handleSelectPhoto,
    showPhotoMenu,
    handleSnapUpload,
  };
}
