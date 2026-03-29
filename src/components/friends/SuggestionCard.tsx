/**
 * SuggestionCard — "People You May Know" card for suggestions section
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { BorderRadius } from "@/constants/theme";
import type { FriendSuggestion } from "@/services/suggestions";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

interface SuggestionCardProps {
  suggestion: FriendSuggestion;
  onAdd: (uid: string, username: string) => void;
  onDismiss: (uid: string) => void;
  onPress: (uid: string) => void;
  adding?: boolean;
}

export default React.memo(function SuggestionCard({
  suggestion,
  onAdd,
  onDismiss,
  onPress,
  adding,
}: SuggestionCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={() => onPress(suggestion.uid)}
      activeOpacity={0.7}
      accessibilityLabel={`${suggestion.displayName || suggestion.username}, ${suggestion.reasonLabel}`}
    >
      {/* Dismiss X */}
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={() => onDismiss(suggestion.uid)}
        hitSlop={8}
        accessibilityLabel="Dismiss suggestion"
      >
        <MaterialCommunityIcons
          name="close"
          size={16}
          color={colors.onSurfaceVariant}
        />
      </TouchableOpacity>

      <ProfilePictureWithDecoration
        pictureUrl={suggestion.profilePictureUrl}
        name={suggestion.displayName || suggestion.username || "?"}
        decorationId={suggestion.decorationId}
        size={56}
      />

      <Text
        variant="bodyMedium"
        numberOfLines={1}
        style={[styles.name, { color: colors.onSurface }]}
      >
        {suggestion.displayName || suggestion.username}
      </Text>

      <Text
        variant="bodySmall"
        numberOfLines={1}
        style={[styles.username, { color: colors.onSurfaceVariant }]}
      >
        @{suggestion.username}
      </Text>

      {/* Reason chip */}
      <View
        style={[
          styles.reasonChip,
          { backgroundColor: colors.secondaryContainer },
        ]}
      >
        <Text
          variant="labelSmall"
          style={{ color: colors.onSecondaryContainer, fontSize: 10 }}
          numberOfLines={1}
        >
          {suggestion.reasonLabel}
        </Text>
      </View>

      <Button
        mode="contained"
        compact
        onPress={() => onAdd(suggestion.uid, suggestion.username)}
        loading={adding}
        disabled={adding}
        style={styles.addBtn}
        labelStyle={{ fontSize: 12 }}
      >
        Add
      </Button>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 140,
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.lg,
    marginRight: 10,
    elevation: 1,
  },
  dismissBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    padding: 4,
  },
  name: {
    marginTop: 8,
    fontWeight: "600",
    textAlign: "center",
  },
  username: {
    marginTop: 1,
    textAlign: "center",
  },
  reasonChip: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  addBtn: {
    marginTop: 8,
    minWidth: 80,
  },
});
