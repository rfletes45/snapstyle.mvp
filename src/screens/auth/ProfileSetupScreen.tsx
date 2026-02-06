import { checkUsernameAvailable, setupNewUser } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import { isValidDisplayName, isValidUsername } from "@/utils/validators";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { Latte } from "../../../constants/theme";

// Avatar colors from Catppuccin palette (vibrant options)
const AVATAR_COLORS = [
  Latte.lavender,
  Latte.pink,
  Latte.mauve,
  Latte.peach,
  Latte.teal,
  Latte.sky,
];

export default function ProfileSetupScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { refreshProfile } = useUser();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );

  // Check username availability when user stops typing
  const handleUsernameChange = async (text: string) => {
    setUsername(text);
    setUsernameAvailable(null);

    if (!text || text.length < 3) {
      return;
    }

    setUsernameCheckLoading(true);
    try {
      const available = await checkUsernameAvailable(text);
      setUsernameAvailable(available);
    } catch (err) {
      console.error("Error checking username:", err);
      setUsernameAvailable(false);
    } finally {
      setUsernameCheckLoading(false);
    }
  };

  const handleSetupProfile = async () => {
    setError("");

    // Validation
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!isValidUsername(username)) {
      setError(
        "Username must be 3-20 characters, alphanumeric and underscores only",
      );
      return;
    }

    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    if (!isValidDisplayName(displayName)) {
      setError("Display name must be 1-50 characters");
      return;
    }

    if (!usernameAvailable) {
      setError("Username is not available");
      return;
    }

    if (!currentFirebaseUser) {
      setError("User not authenticated");
      return;
    }

    setLoading(true);

    try {
      // Setup user profile with username and display name
      const baseColor = AVATAR_COLORS[selectedColorIndex];
      const result = await setupNewUser(
        currentFirebaseUser.uid,
        currentFirebaseUser.email || "",
        username.toLowerCase(),
        displayName,
        baseColor,
      );

      if (!result) {
        setError("Failed to set up profile. Please try again.");
        setLoading(false);
        return;
      }

      // Refresh user profile in context
      await refreshProfile();

      // Auto-navigate to app (navigation happens through RootNavigator when user is fully set up)
      // The app will detect that the user has a profile and navigate to AppTabs
      setLoading(false);
    } catch (err: any) {
      console.error("Profile setup error:", err);
      setError(err.message || "Failed to set up profile. Please try again.");
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Set Up Your Profile
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
        Complete your profile to get started
      </Text>

      {/* Avatar Preview */}
      <View style={styles.avatarSection}>
        <View
          style={[
            styles.avatarPreview,
            {
              backgroundColor: AVATAR_COLORS[selectedColorIndex],
            },
          ]}
        >
          <MaterialCommunityIcons
            name="account-circle"
            size={80}
            color="#fff"
          />
        </View>
        <Text style={styles.avatarLabel}>Avatar Preview</Text>
      </View>

      {/* Avatar Color Selector */}
      <View style={styles.colorSelector}>
        <Text style={styles.colorLabel}>Choose Avatar Color:</Text>
        <View style={styles.colorGrid}>
          {AVATAR_COLORS.map((color, index) => (
            <Button
              key={index}
              onPress={() => setSelectedColorIndex(index)}
              style={[
                styles.colorButton,
                { backgroundColor: color },
                selectedColorIndex === index && styles.colorButtonSelected,
              ]}
              disabled={loading}
            >
              {selectedColorIndex === index && (
                <MaterialCommunityIcons name="check" size={20} color="#000" />
              )}
            </Button>
          ))}
        </View>
      </View>

      {/* Username Input */}
      <View style={styles.inputContainer}>
        <TextInput
          label="Username"
          value={username}
          onChangeText={handleUsernameChange}
          mode="outlined"
          disabled={loading}
          style={styles.input}
          placeholder="@username"
          editable={!loading}
        />
        {usernameCheckLoading && (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.checkIndicator}
          />
        )}
        {usernameAvailable === true && (
          <Text style={styles.availableText}>✓ Username available</Text>
        )}
        {usernameAvailable === false && username.length >= 3 && (
          <Text style={styles.unavailableText}>✗ Username taken</Text>
        )}
      </View>

      {/* Display Name Input */}
      <TextInput
        label="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        mode="outlined"
        disabled={loading}
        style={styles.input}
        placeholder="Your Name"
      />

      {/* Error Message */}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Continue Button */}
      <Button
        mode="contained"
        onPress={handleSetupProfile}
        loading={loading}
        disabled={loading || !usernameAvailable}
        style={styles.button}
      >
        {loading ? "Setting up..." : "Continue"}
      </Button>

      <Text style={[styles.hint, { color: theme.colors.onSurfaceDisabled }]}>
        3-20 characters, alphanumeric and underscores
      </Text>
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
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 28,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    marginBottom: 8,
  },
  avatarLabel: {
    fontSize: 12,
    color: "#999",
  },
  colorSelector: {
    marginBottom: 28,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  colorGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  colorButton: {
    width: "15%",
    aspectRatio: 1,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  colorButtonSelected: {
    borderWidth: 3,
    borderColor: "#333",
  },
  inputContainer: {
    marginBottom: 16,
    position: "relative",
  },
  input: {
    marginBottom: 8,
  },
  checkIndicator: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  availableText: {
    color: "#4CAF50",
    fontSize: 12,
    marginLeft: 4,
  },
  unavailableText: {
    color: "#d32f2f",
    fontSize: 12,
    marginLeft: 4,
  },
  button: {
    marginTop: 12,
    paddingVertical: 6,
  },
  error: {
    color: "#d32f2f",
    marginBottom: 12,
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    color: "#999",
    marginTop: 12,
    textAlign: "center",
  },
});
