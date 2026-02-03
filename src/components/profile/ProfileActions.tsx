/**
 * ProfileActions Component
 *
 * List of action buttons for profile navigation.
 */

import type { ProfileAction } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Badge, Text, useTheme } from "react-native-paper";

export interface ProfileActionsProps {
  /** List of actions */
  actions: ProfileAction[];
}

function ProfileActionsBase({ actions }: ProfileActionsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.id}
          style={[
            styles.actionItem,
            {
              backgroundColor: theme.colors.surfaceVariant,
              opacity: action.disabled ? 0.5 : 1,
            },
          ]}
          onPress={action.onPress}
          disabled={action.disabled}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    (action.color || theme.colors.primary) + "20",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={action.icon as any}
                size={22}
                color={action.color || theme.colors.primary}
              />
            </View>
            <Text
              style={[styles.actionLabel, { color: theme.colors.onSurface }]}
            >
              {action.label}
            </Text>
          </View>
          <View style={styles.actionRight}>
            {action.badge !== undefined && action.badge > 0 && (
              <Badge style={styles.badge}>{action.badge}</Badge>
            )}
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  actionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: "#FF6B6B",
  },
});

export const ProfileActions = memo(ProfileActionsBase);
export default ProfileActions;
