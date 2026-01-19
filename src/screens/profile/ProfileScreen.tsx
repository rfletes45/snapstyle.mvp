import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Button, TextInput, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { getAuthInstance } from "@/services/firebase";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import { updateProfile } from "@/services/users";
import { isValidDisplayName } from "@/utils/validators";

const AVATAR_COLORS = [
  "#FFFC00",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
];

export default function ProfileScreen() {
  const { currentFirebaseUser } = useAuth();
  const { profile, refreshProfile } = useUser();

  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(
    profile?.displayName || "",
  );
  const [selectedColorIndex, setSelectedColorIndex] = useState(
    AVATAR_COLORS.indexOf(profile?.avatarConfig?.baseColor || "#FFFC00"),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSaveChanges = async () => {
    setError("");
    setSuccess("");

    // Validation
    if (!editDisplayName.trim()) {
      setError("Display name is required");
      return;
    }

    if (!isValidDisplayName(editDisplayName)) {
      setError("Display name must be 1-50 characters");
      return;
    }

    if (!currentFirebaseUser) {
      setError("User not authenticated");
      return;
    }

    setLoading(true);

    try {
      const newColor = AVATAR_COLORS[selectedColorIndex];
      const success = await updateProfile(currentFirebaseUser.uid, {
        displayName: editDisplayName,
        avatarConfig: {
          baseColor: newColor,
        },
      });

      if (success) {
        await refreshProfile();
        setSuccess("Profile updated successfully!");
        setIsEditing(false);
        // Clear success message after 2 seconds
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError("Failed to update profile");
      }
    } catch (err: any) {
      console.error("Profile update error:", err);
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
    } catch (error: any) {
      console.error("Sign out error:", error);
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFC00" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <Text style={styles.title}>Profile</Text>

      {/* Avatar Preview */}
      {!isEditing && (
        <View style={styles.avatarSection}>
          <View
            style={[
              styles.avatarPreview,
              {
                backgroundColor: profile.avatarConfig?.baseColor || "#FFFC00",
              },
            ]}
          >
            <MaterialCommunityIcons
              name="account-circle"
              size={80}
              color="#fff"
            />
          </View>
        </View>
      )}

      {/* Profile Info */}
      <View style={styles.infoSection}>
        <Text style={styles.label}>Username</Text>
        <Text style={styles.value}>{profile.username}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{currentFirebaseUser?.email}</Text>

        {!isEditing ? (
          <>
            <Text style={styles.label}>Display Name</Text>
            <Text style={styles.value}>{profile.displayName}</Text>

            <Text style={styles.label}>Avatar Color</Text>
            <Text style={styles.value}>
              {profile.avatarConfig?.baseColor || "#FFFC00"}
            </Text>
          </>
        ) : (
          <>
            {/* Edit Mode */}
            <Text style={styles.label}>Edit Display Name</Text>
            <TextInput
              label="Display Name"
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              mode="outlined"
              style={styles.input}
              disabled={loading}
            />

            <Text style={styles.label}>Choose Avatar Color</Text>
            <View style={styles.colorGrid}>
              {AVATAR_COLORS.map((color, index) => (
                <Button
                  key={color}
                  mode={selectedColorIndex === index ? "contained" : "outlined"}
                  onPress={() => setSelectedColorIndex(index)}
                  buttonColor={color}
                  textColor="#000"
                  style={styles.colorButton}
                  disabled={loading}
                >
                  {selectedColorIndex === index ? "✓" : ""}
                </Button>
              ))}
            </View>
          </>
        )}
      </View>

      {/* Status Messages */}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.successMessage}>{success}</Text> : null}

      {/* Action Buttons */}
      <View style={styles.buttonSection}>
        {!isEditing ? (
          <Button
            mode="contained"
            onPress={() => setIsEditing(true)}
            buttonColor="#FFFC00"
            textColor="#000"
            style={styles.button}
          >
            Edit Profile
          </Button>
        ) : (
          <>
            <Button
              mode="contained"
              onPress={handleSaveChanges}
              loading={loading}
              disabled={loading}
              buttonColor="#4CAF50"
              textColor="#fff"
              style={styles.button}
            >
              Save Changes
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setIsEditing(false);
                setEditDisplayName(profile.displayName);
                setSelectedColorIndex(
                  AVATAR_COLORS.indexOf(
                    profile.avatarConfig?.baseColor || "#FFFC00",
                  ),
                );
                setError("");
              }}
              disabled={loading}
              style={styles.button}
            >
              Cancel
            </Button>
          </>
        )}

        <Button
          mode="contained"
          onPress={handleSignOut}
          buttonColor="#d32f2f"
          textColor="#fff"
          style={[styles.button, styles.signOutButton]}
        >
          Sign Out
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  infoSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    marginTop: 12,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: "#000",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
    marginBottom: 12,
  },
  input: {
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  colorButton: {
    flex: 1,
    minWidth: "45%",
  },
  buttonSection: {
    gap: 12,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 6,
  },
  signOutButton: {
    marginTop: 12,
  },
  error: {
    color: "#d32f2f",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffebee",
    borderRadius: 4,
  },
  successMessage: {
    color: "#4CAF50",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f1f8e9",
    borderRadius: 4,
  },
});
