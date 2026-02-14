/**
 * Snap Viewer Screen
 * Fullscreen display of photo snaps in view-once mode
 * On close: marks snap as opened and deletes message doc immediately
 * Handles download, display, and cleanup
 */

import { markSnapOpened } from "@/services/snaps";
import { deleteSnapImage, downloadSnapImage } from "@/services/storage";
import { useAuth } from "@/store/AuthContext";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/chat/SnapViewerScreen");
interface SnapViewerScreenProps {
  route: any;
  navigation: any;
}

export function SnapViewerScreen({ route, navigation }: SnapViewerScreenProps) {
  const { messageId, chatId, storagePath } = route.params;
  const { currentFirebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch and display snap image
  useEffect(() => {
    const loadSnap = async () => {
      try {
        logger.info("🔵 [SnapViewerScreen] Loading snap:", {
          storagePath,
          messageId,
          chatId,
        });
        setLoading(true);
        setError(null);

        const uri = await downloadSnapImage(storagePath);
        logger.info("✅ [SnapViewerScreen] Snap loaded successfully");
        setImageUri(uri);
      } catch (err: any) {
        logger.error("❌ [SnapViewerScreen] Failed to load snap:", err);
        setError(err.message || "Failed to load picture");
      } finally {
        setLoading(false);
      }
    };

    loadSnap();
  }, [storagePath, messageId, chatId]);

  // Handle snap dismissal (view-once: mark opened + delete message + delete storage file)
  const handleDismiss = useCallback(async () => {
    if (!currentFirebaseUser) {
      logger.error("❌ [SnapViewerScreen] No user logged in");
      return;
    }

    try {
      logger.info(
        "🔵 [SnapViewerScreen] Dismissing snap and marking as opened",
      );

      // Mark snap as opened in Firestore (records metadata)
      await markSnapOpened(chatId, messageId, currentFirebaseUser.uid);
      logger.info("✅ [SnapViewerScreen] Snap marked as opened");

      // Delete snap from Storage
      await deleteSnapImage(storagePath);
      logger.info("✅ [SnapViewerScreen] Snap deleted from storage");

      // Navigate back to chat
      navigation.goBack();
    } catch (err: any) {
      logger.error("❌ [SnapViewerScreen] Error marking snap opened:", err);
      Alert.alert(
        "Error",
        "Failed to save picture view. The picture may still be visible to the sender.",
      );
      // Still navigate back even on error (Cloud Function cleanup will handle fallback)
      navigation.goBack();
    }
  }, [currentFirebaseUser, chatId, messageId, storagePath, navigation]);

  // Screen layout: fullscreen image with black background

  const containerStyle = [
    styles.container,
    { paddingTop: insets.top, paddingBottom: insets.bottom },
  ];

  if (error) {
    return (
      <View style={containerStyle}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={containerStyle}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {Platform.OS === "web" ? (
        <Pressable
          onPress={handleDismiss}
          style={styles.pressableContainer}
          accessibilityRole="button"
          accessibilityLabel="Dismiss snap"
        >
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.snapImage}
              accessibilityLabel="Snap photo"
            />
          )}
        </Pressable>
      ) : (
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.pressableContainer}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Tap to dismiss snap"
        >
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.snapImage}
              accessibilityLabel="Snap photo"
            />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
  },
  pressableContainer: {
    width: "100%",
    height: "100%",
  },
  snapImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
});
