/**
 * ContactRow — Row for matched contacts and inviteable contacts
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { Spacing } from "@/constants/theme";
import type { InviteableContact, MatchedUser } from "@/services/contacts";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Chip, Text, useTheme } from "react-native-paper";

// ---------------------------------------------------------------------------
// Matched (on-app) user row
// ---------------------------------------------------------------------------

interface MatchedContactRowProps {
  user: MatchedUser;
  status: "none" | "friends" | "pending" | "incoming";
  onAdd: () => void;
  onPress: () => void;
  adding?: boolean;
}

export const MatchedContactRow = React.memo(function MatchedContactRow({
  user,
  status,
  onAdd,
  onPress,
  adding,
}: MatchedContactRowProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${user.displayName}, ${user.contactName}, already on SnapStyle`}
    >
      <ProfilePictureWithDecoration
        pictureUrl={user.profilePictureUrl}
        name={user.displayName || user.username}
        decorationId={user.decorationId}
        size={44}
      />
      <View style={styles.info}>
        <Text
          variant="bodyMedium"
          style={{ color: colors.onSurface, fontWeight: "600" }}
          numberOfLines={1}
        >
          {user.displayName || user.username}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: colors.onSurfaceVariant }}
          numberOfLines={1}
        >
          @{user.username}
          {user.contactName !== user.displayName
            ? ` · ${user.contactName}`
            : ""}
        </Text>
      </View>
      <View style={styles.action}>
        {status === "friends" ? (
          <Chip
            compact
            style={{ backgroundColor: colors.secondaryContainer }}
            textStyle={{ fontSize: 11 }}
          >
            Friends
          </Chip>
        ) : status === "pending" ? (
          <Chip
            compact
            style={{ backgroundColor: colors.surfaceVariant }}
            textStyle={{ fontSize: 11 }}
          >
            Pending
          </Chip>
        ) : (
          <Button
            mode="contained"
            compact
            onPress={onAdd}
            loading={adding}
            disabled={adding}
            labelStyle={{ fontSize: 12 }}
          >
            Add
          </Button>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Inviteable (not on app) contact row
// ---------------------------------------------------------------------------

interface InviteableContactRowProps {
  contact: InviteableContact;
  onInvite: () => void;
  invited?: boolean;
}

export const InviteableContactRow = React.memo(function InviteableContactRow({
  contact,
  onInvite,
  invited,
}: InviteableContactRowProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      {contact.imageUri ? (
        <Image
          source={{ uri: contact.imageUri }}
          style={styles.contactAvatar}
        />
      ) : (
        <View
          style={[
            styles.contactAvatar,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <MaterialCommunityIcons
            name="account-outline"
            size={22}
            color={colors.onSurfaceVariant}
          />
        </View>
      )}
      <View style={styles.info}>
        <Text
          variant="bodyMedium"
          style={{ color: colors.onSurface, fontWeight: "500" }}
          numberOfLines={1}
        >
          {contact.name}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: colors.onSurfaceVariant }}
          numberOfLines={1}
        >
          {contact.phone || contact.email || ""}
        </Text>
      </View>
      <View style={styles.action}>
        {invited ? (
          <Chip
            compact
            style={{ backgroundColor: colors.surfaceVariant }}
            textStyle={{ fontSize: 11 }}
          >
            Invited
          </Chip>
        ) : (
          <Button
            mode="outlined"
            compact
            onPress={onInvite}
            labelStyle={{ fontSize: 12 }}
          >
            Invite
          </Button>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  action: {
    minWidth: 80,
    alignItems: "flex-end",
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
