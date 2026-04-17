/**
 * InviteContactRow — Row for an inviteable (unmatched) contact
 *
 * Shows contact name, phone/email, and invite button.
 * Invite sends an SMS/share link to the contact.
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { InviteableContact } from "@/services/contacts";
import { shareInviteToContact } from "@/services/invites";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

interface InviteContactRowProps {
  contact: InviteableContact;
  uid: string | undefined;
}

export default React.memo(function InviteContactRow({
  contact,
  uid,
}: InviteContactRowProps) {
  const { colors } = useTheme();
  const [invited, setInvited] = useState(contact.invited ?? false);
  const [loading, setLoading] = useState(false);

  const handleInvite = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      await shareInviteToContact(uid, contact.phone ?? contact.email ?? "");
      setInvited(true);
    } catch {
      // User cancelled share sheet — not an error
    } finally {
      setLoading(false);
    }
  }, [uid, contact.phone, contact.email]);

  const identifier = contact.phone ?? contact.email ?? "";
  const initial = (contact.name?.[0] ?? "?").toUpperCase();

  return (
    <View style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
      {contact.imageUri ? (
        <View
          style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}
        >
          <MaterialCommunityIcons
            name="account"
            size={20}
            color={colors.onPrimaryContainer}
          />
        </View>
      ) : (
        <View
          style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}
        >
          <Text
            variant="labelLarge"
            style={{ color: colors.onPrimaryContainer, fontWeight: "700" }}
          >
            {initial}
          </Text>
        </View>
      )}

      <View style={styles.info}>
        <Text
          variant="bodyMedium"
          style={{ color: colors.onSurface }}
          numberOfLines={1}
        >
          {contact.name}
        </Text>
        {identifier ? (
          <Text
            variant="bodySmall"
            style={{ color: colors.onSurfaceVariant }}
            numberOfLines={1}
          >
            {identifier}
          </Text>
        ) : null}
      </View>

      <Button
        mode={invited ? "outlined" : "contained-tonal"}
        compact
        onPress={handleInvite}
        loading={loading}
        disabled={invited || loading}
        style={styles.inviteBtn}
        labelStyle={styles.inviteBtnLabel}
      >
        {invited ? "Invited" : "Invite"}
      </Button>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  inviteBtn: {
    borderRadius: BorderRadius.full,
    minHeight: 32,
  },
  inviteBtnLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 0,
    marginHorizontal: 10,
  },
});
