/**
 * ContactRecommendationCard — Card for a contact-matched user recommendation
 *
 * Shows profile picture, name, explanation tags, and add button.
 * Used in the horizontal carousel in ContactsDiscoverySection.
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { BorderRadius, Spacing } from "@/constants/theme";
import { ContactRecommendation } from "@/services/contacts";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

interface ContactRecommendationCardProps {
  recommendation: ContactRecommendation;
  onAdd: () => void;
  onPress: () => void;
}

export default React.memo(function ContactRecommendationCard({
  recommendation,
  onAdd,
  onPress,
}: ContactRecommendationCardProps) {
  const { colors } = useTheme();

  // Pick the most relevant explanation tag to display
  const primaryTag = recommendation.explanationTags[0] ?? "Contact match";
  const secondaryTag = recommendation.explanationTags[1];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surfaceVariant }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Reciprocal badge */}
      {recommendation.reciprocal && (
        <View
          style={[
            styles.reciprocalBadge,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name="swap-horizontal"
            size={10}
            color={colors.onPrimaryContainer}
          />
        </View>
      )}

      <ProfilePictureWithDecoration
        pictureUrl={recommendation.profilePictureUrl}
        name={recommendation.displayName || "?"}
        decorationId={recommendation.decorationId}
        size={44}
      />

      <Text
        variant="labelMedium"
        style={[styles.name, { color: colors.onSurface }]}
        numberOfLines={1}
      >
        {recommendation.username || recommendation.displayName}
      </Text>

      <Text
        variant="bodySmall"
        style={[styles.tag, { color: colors.primary }]}
        numberOfLines={1}
      >
        {primaryTag}
      </Text>

      {secondaryTag && (
        <Text
          variant="bodySmall"
          style={[styles.secondaryTag, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {secondaryTag}
        </Text>
      )}

      <Button
        mode="contained-tonal"
        compact
        onPress={onAdd}
        style={styles.addBtn}
        labelStyle={styles.addBtnLabel}
      >
        Add
      </Button>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 120,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: {
        elevation: 1,
      },
    }),
  },
  reciprocalBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  tag: {
    textAlign: "center",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },
  secondaryTag: {
    textAlign: "center",
    fontSize: 9,
    marginTop: 1,
  },
  addBtn: {
    marginTop: 8,
    borderRadius: BorderRadius.full,
    minWidth: 64,
    minHeight: 32,
    alignSelf: "center",
    justifyContent: "center",
  },
  addBtnLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 0,
    marginHorizontal: 12,
  },
});
