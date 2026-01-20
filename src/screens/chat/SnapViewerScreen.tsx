/**
 * Snap Viewer Screen
 * Fullscreen display of photo snaps in view-once mode
 * On close: marks snap as opened and deletes message doc immediately
 * Handles download, display, and cleanup
 */

import React, { useEffect, useState } from "react";
import { View, Image, ActivityIndicator, Alert } from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { downloadSnapImage, deleteSnapImage } from "@/services/storage";
import { markSnapOpened } from "@/services/chat";
import { useAuth } from "@/store/AuthContext";

interface SnapViewerScreenProps {
  route: any;
  navigation: any;
}

export function SnapViewerScreen({ route, navigation }: SnapViewerScreenProps) {
  const { messageId, chatId, storagePath } = route.params;
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch and display snap image
  useEffect(() => {
    const loadSnap = async () => {
      try {
        setLoading(true);
        const uri = await downloadSnapImage(storagePath);
        setImageUri(uri);
        setError(null);
      } catch (err: any) {
        console.error("Failed to load snap:", err);
        setError("Failed to load snap");
        setLoading(false);
      }
    };

    loadSnap();
  }, [storagePath]);

  // Handle snap dismissal (view-once: mark opened + delete message + delete storage file)
  const handleDismiss = async () => {
    if (!currentUser) return;

    try {
      // Mark snap as opened in Firestore (records metadata)
      await markSnapOpened(chatId, messageId, currentUser.uid);

      // Delete snap from Storage
      await deleteSnapImage(storagePath);

      // Navigate back to chat
      navigation.goBack();
    } catch (err: any) {
      console.error("Error marking snap opened:", err);
      Alert.alert(
        "Error",
        "Failed to save snap view. The snap may still be visible to the sender.",
      );
      // Still navigate back even on error (Cloud Function cleanup will handle fallback)
      navigation.goBack();
    }
  };

  // Screen layout: fullscreen image with black background

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <Text style={{ color: "#FFF", fontSize: 16, textAlign: "center" }}>
          {error}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <ActivityIndicator size="large" color="#FFFC00" />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
      onTouchEnd={handleDismiss}
    >
      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: "100%",
            height: "100%",
            resizeMode: "contain",
          }}
        />
      )}
    </View>
  );
}
