/**
 * ContactsDiscoverySection — State-driven contacts discovery UI
 *
 * Renders three states:
 * A. Permission not granted → ContactsPermissionCard
 * B. Permission granted, not synced → Sync CTA
 * C. Synced → Recommendations + Inviteable + Privacy Controls
 *
 * Designed to sit inside the AddFriendsSheet below the tiles/suggestions.
 */

import { ContactsEnablementBanner } from "@/components/ui/ContactsEnablementBanner";
import { CONTACTS_DISCOVERY_ENABLED } from "@/constants/featureFlags";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useContactsDiscovery } from "@/hooks/useContactsDiscovery";
import { useContactsPermission } from "@/hooks/useContactsPermission";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Divider, Switch, Text, useTheme } from "react-native-paper";
import ContactRecommendationCard from "./ContactRecommendationCard";
import InviteContactRow from "./InviteContactRow";

interface ContactsDiscoverySectionProps {
  uid: string | undefined;
  onSendRequest?: (username: string, uid: string) => void;
  onNavigateProfile?: (uid: string) => void;
}

export default React.memo(function ContactsDiscoverySection({
  uid,
  onSendRequest,
  onNavigateProfile,
}: ContactsDiscoverySectionProps) {
  if (!CONTACTS_DISCOVERY_ENABLED) return null;

  const { colors } = useTheme();
  const contactsPerm = useContactsPermission();
  const {
    permissionStatus,
    requestPermission,
    syncState,
    syncContacts,
    recommendations,
    inviteableContacts,
    settings,
    updateSettings,
    removeAllSyncedData,
    lastSyncedAt,
    loading,
    error,
  } = useContactsDiscovery(uid);

  const [showAllInviteable, setShowAllInviteable] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Auto-sync after permission grant via the enablement banner
  const handleBannerEnable = useCallback(async () => {
    const status = await contactsPerm.handleEnableContacts();
    if (status === "granted" || status === "limited") {
      syncContacts();
    }
  }, [contactsPerm, syncContacts]);

  // Re-check permission when the discovery hook updates
  useEffect(() => {
    if (permissionStatus === "granted" || permissionStatus === "limited") {
      contactsPerm.refreshPermission();
    }
  }, [permissionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemoveData = useCallback(() => {
    Alert.alert(
      "Remove Synced Contacts",
      "This will permanently delete all contact data stored on our servers. Your contact sync will be turned off. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeAllSyncedData(),
        },
      ],
    );
  }, [removeAllSyncedData]);

  // ── State A: Permission not fully granted ─────────────────────────────
  if (
    (syncState === "permission_needed" ||
      permissionStatus === "undetermined" ||
      permissionStatus === "denied") &&
    syncState !== "synced" &&
    syncState !== "syncing"
  ) {
    // Show the shared enablement banner (handles all perm states)
    return (
      <View style={styles.section}>
        <ContactsEnablementBanner
          permState={contactsPerm.permState}
          onEnable={handleBannerEnable}
          loading={contactsPerm.loading}
        />
      </View>
    );
  }

  // Also show the limited-access banner above synced content
  const showLimitedBanner =
    contactsPerm.permState === "granted_limited" && syncState === "synced";

  // ── State B: Permission granted, not yet synced ───────────────────────
  if (syncState === "ready_to_sync" || syncState === "error") {
    return (
      <View style={styles.section}>
        <View
          style={[styles.syncCard, { backgroundColor: colors.surfaceVariant }]}
        >
          <View
            style={[
              styles.syncIconWrap,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="sync"
              size={28}
              color={colors.onPrimaryContainer}
            />
          </View>
          <Text
            variant="titleMedium"
            style={[styles.syncTitle, { color: colors.onSurface }]}
          >
            Sync Your Contacts
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.syncDesc, { color: colors.onSurfaceVariant }]}
          >
            We'll match your contacts to find friends already on the app and
            help you invite others. Only hashed identifiers are stored — your
            contacts stay private.
          </Text>
          {error && (
            <Text
              variant="bodySmall"
              style={[styles.errorText, { color: colors.error }]}
            >
              {error}
            </Text>
          )}
          <Button
            mode="contained"
            onPress={syncContacts}
            loading={loading}
            disabled={loading}
            style={styles.syncBtn}
          >
            Sync Contacts
          </Button>
        </View>
      </View>
    );
  }

  // ── State: Syncing ────────────────────────────────────────────────────
  if (syncState === "syncing") {
    return (
      <View style={styles.section}>
        <View
          style={[
            styles.syncingCard,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Text
            variant="bodyMedium"
            style={[styles.syncingText, { color: colors.onSurface }]}
          >
            Syncing contacts…
          </Text>
        </View>
      </View>
    );
  }

  // ── State C: Synced ───────────────────────────────────────────────────
  const displayInviteable = showAllInviteable
    ? inviteableContacts
    : inviteableContacts.slice(0, 5);

  return (
    <View style={styles.section}>
      {/* Limited-access follow-up banner (iOS 18+) */}
      {showLimitedBanner && (
        <ContactsEnablementBanner
          permState="granted_limited"
          onEnable={handleBannerEnable}
          loading={contactsPerm.loading}
        />
      )}

      {/* Recommended from Contacts */}
      {recommendations.length > 0 && (
        <View style={styles.bucket}>
          <Text
            variant="titleSmall"
            style={[styles.bucketTitle, { color: colors.onSurface }]}
          >
            Recommended from Contacts
          </Text>
          <FlatList
            data={recommendations}
            keyExtractor={(item) => item.uid}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recsScroll}
            renderItem={({ item }) => (
              <ContactRecommendationCard
                recommendation={item}
                onAdd={() => onSendRequest?.(item.username, item.uid)}
                onPress={() => onNavigateProfile?.(item.uid)}
              />
            )}
          />
        </View>
      )}

      {/* Invite Contacts */}
      {inviteableContacts.length > 0 && (
        <View style={styles.bucket}>
          <Text
            variant="titleSmall"
            style={[styles.bucketTitle, { color: colors.onSurface }]}
          >
            Invite Contacts
          </Text>
          {displayInviteable.map((contact) => (
            <InviteContactRow
              key={contact.contactId}
              contact={contact}
              uid={uid}
            />
          ))}
          {inviteableContacts.length > 5 && !showAllInviteable && (
            <Button
              mode="text"
              compact
              onPress={() => setShowAllInviteable(true)}
              labelStyle={{ fontSize: 12 }}
            >
              Show {inviteableContacts.length - 5} more
            </Button>
          )}
        </View>
      )}

      {/* Empty state after sync */}
      {recommendations.length === 0 && inviteableContacts.length === 0 && (
        <View
          style={[styles.emptyCard, { backgroundColor: colors.surfaceVariant }]}
        >
          <MaterialCommunityIcons
            name="account-check-outline"
            size={32}
            color={colors.onSurfaceVariant}
          />
          <Text
            variant="bodySmall"
            style={[styles.emptyText, { color: colors.onSurfaceVariant }]}
          >
            No new matches found. Try again later as more people join!
          </Text>
          <Button mode="text" compact onPress={syncContacts} loading={loading}>
            Re-sync
          </Button>
        </View>
      )}

      {/* Privacy Controls */}
      <Divider style={styles.divider} />
      <TouchableOpacity
        style={styles.privacyToggleRow}
        onPress={() => setShowPrivacy(!showPrivacy)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="shield-account-outline"
          size={18}
          color={colors.onSurfaceVariant}
        />
        <Text
          variant="labelMedium"
          style={[styles.privacyToggleText, { color: colors.onSurfaceVariant }]}
        >
          Contacts Privacy
        </Text>
        <MaterialCommunityIcons
          name={showPrivacy ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.onSurfaceVariant}
        />
      </TouchableOpacity>

      {showPrivacy && (
        <View style={styles.privacySection}>
          <View style={styles.privacyRow}>
            <View style={styles.privacyLabelCol}>
              <Text variant="bodyMedium" style={{ color: colors.onSurface }}>
                Sync Contacts
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: colors.onSurfaceVariant }}
              >
                Keep contacts synced to find new friends
              </Text>
            </View>
            <Switch
              value={settings.syncEnabled}
              onValueChange={(val) => updateSettings({ syncEnabled: val })}
            />
          </View>

          <View style={styles.privacyRow}>
            <View style={styles.privacyLabelCol}>
              <Text variant="bodyMedium" style={{ color: colors.onSurface }}>
                Discoverable via Contacts
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: colors.onSurfaceVariant }}
              >
                Let people who have your number find you
              </Text>
            </View>
            <Switch
              value={settings.discoverableViaContacts}
              onValueChange={(val) =>
                updateSettings({ discoverableViaContacts: val })
              }
            />
          </View>

          {lastSyncedAt && (
            <Text
              variant="bodySmall"
              style={[styles.lastSyncText, { color: colors.onSurfaceVariant }]}
            >
              Last synced:{" "}
              {new Date(lastSyncedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          )}

          <Button
            mode="text"
            onPress={handleRemoveData}
            textColor={colors.error}
            compact
            style={styles.removeBtn}
            icon="delete-outline"
          >
            Remove Synced Contacts
          </Button>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.lg,
  },
  deniedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.md,
  },
  deniedText: {
    flex: 1,
    lineHeight: 18,
  },
  syncCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginHorizontal: Spacing.md,
  },
  syncIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  syncTitle: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  syncDesc: {
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 12,
  },
  syncBtn: {
    minWidth: 140,
  },
  syncingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
  },
  syncingText: {
    fontWeight: "500",
  },
  errorText: {
    textAlign: "center",
    marginBottom: 8,
  },
  bucket: {
    marginBottom: Spacing.md,
  },
  bucketTitle: {
    fontWeight: "700",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  recsScroll: {
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    gap: 8,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 18,
  },
  divider: {
    marginVertical: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  privacyToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  privacyToggleText: {
    flex: 1,
    fontWeight: "600",
  },
  privacySection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  privacyLabelCol: {
    flex: 1,
  },
  lastSyncText: {
    marginTop: 4,
    fontSize: 11,
  },
  removeBtn: {
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
});
