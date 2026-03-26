/**
 * GroupPermissionsScreen
 *
 * Owner-only screen for configuring admin permissions in a group chat.
 * Uses the capability-based permission system (Phase 20B).
 *
 * Features:
 * - Toggle individual admin capabilities
 * - Grouped by category (Messages, Moderation, Group Management, Communication)
 * - Real-time save with optimistic UI
 * - Owner-only access
 * - Clear labels and descriptions
 */

import {
  DEFAULT_PERMISSIONS_CONFIG,
  getConfigurablePermissions,
  GroupPermission,
  GroupPermissionFlags,
  GroupPermissionsConfig,
  PERMISSION_CATEGORY_DESCRIPTIONS,
  PERMISSION_CATEGORY_LABELS,
  PermissionCategory,
  PermissionMeta,
  resolvePermissions,
} from "@/permissions/groupPermissions";
import {
  getGroupPermissionsConfig,
  getUserRole,
  updateGroupPermissionsConfig,
} from "@/services/groups";
import { useAuth } from "@/store/AuthContext";
import { useColors } from "@/store/ThemeContext";
import { GroupRole } from "@/types/models";
import { createLogger } from "@/utils/log";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  Divider,
  Snackbar,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

const logger = createLogger("screens/groups/GroupPermissionsScreen");

const CATEGORY_ICONS: Record<PermissionCategory, string> = {
  messages: "message-text-outline",
  moderation: "shield-outline",
  groupManagement: "cog-outline",
  governance: "crown-outline",
  communication: "bullhorn-outline",
};

export default function GroupPermissionsScreen({ route, navigation }: any) {
  const { groupId } = route.params;
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;
  const colors = useColors();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<GroupRole | null>(null);
  const [config, setConfig] = useState<GroupPermissionsConfig | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [hasChanges, setHasChanges] = useState(false);

  // Resolved admin permissions for display
  const adminPermissions = useMemo<GroupPermissionFlags>(() => {
    return resolvePermissions("admin", config);
  }, [config]);

  // Grouped configurable permissions
  const groupedPermissions = useMemo(() => {
    return getConfigurablePermissions();
  }, []);

  // Load data
  useEffect(() => {
    async function load() {
      if (!groupId || !uid) return;
      try {
        setLoading(true);
        const [role, permConfig] = await Promise.all([
          getUserRole(groupId, uid),
          getGroupPermissionsConfig(groupId),
        ]);

        setUserRole(role);
        setConfig(permConfig ?? DEFAULT_PERMISSIONS_CONFIG);
      } catch (err: any) {
        logger.error("Failed to load permissions:", err);
        Alert.alert("Error", "Failed to load group permissions");
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [groupId, uid]);

  // Handle toggle
  const handleToggle = useCallback(
    (permission: GroupPermission, newValue: boolean) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const updated: GroupPermissionsConfig = {
          ...prev,
          admin: {
            ...prev.admin,
            [permission]: newValue,
          },
        };
        return updated;
      });
      setHasChanges(true);
    },
    [],
  );

  // Save changes
  const handleSave = useCallback(async () => {
    if (!groupId || !uid || !config) return;

    try {
      setSaving(true);
      await updateGroupPermissionsConfig(groupId, uid, {
        admin: config.admin,
        member: config.member,
      });
      setHasChanges(false);
      setSnackbar({ visible: true, message: "Permissions saved!" });
    } catch (err: any) {
      logger.error("Failed to save permissions:", err);
      Alert.alert(
        "Error",
        err.message || "Failed to save permissions. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [groupId, uid, config]);

  // Handle back with unsaved changes
  const handleGoBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved permission changes. Discard them?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } else {
      navigation.goBack();
    }
  }, [hasChanges, navigation]);

  // Access check
  if (!loading && userRole !== "owner") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["bottom"]}
      >
        <Appbar.Header style={{ backgroundColor: colors.background }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Permissions" />
        </Appbar.Header>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="lock-outline"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Owner Only
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Only the group owner can manage permissions.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["bottom"]}
      >
        <Appbar.Header style={{ backgroundColor: colors.background }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Admin Permissions" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading permissions...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <Appbar.Header style={{ backgroundColor: colors.background }}>
        <Appbar.BackAction onPress={handleGoBack} />
        <Appbar.Content title="Admin Permissions" />
        {hasChanges && (
          <Appbar.Action
            icon={saving ? "loading" : "content-save"}
            onPress={handleSave}
            disabled={saving}
          />
        )}
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header info */}
        <View
          style={[styles.infoCard, { backgroundColor: colors.surfaceVariant }]}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color={colors.primary}
          />
          <View style={styles.infoContent}>
            <Text style={[styles.infoText, { color: colors.text }]}>
              Configure what admins are allowed to do in this group. Owners
              always retain full control.
            </Text>
            <Text style={[styles.infoSubtext, { color: colors.textSecondary }]}>
              These settings affect all current and future admins.
            </Text>
          </View>
        </View>

        {/* Permission categories */}
        {Array.from(groupedPermissions.entries()).map(
          ([category, permissions]) => (
            <PermissionCategorySection
              key={category}
              category={category}
              permissions={permissions}
              adminPermissions={adminPermissions}
              onToggle={handleToggle}
              colors={colors}
              theme={theme}
            />
          ),
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Admins can only perform actions enabled above. Members have basic
            access only (send messages, send invites).
          </Text>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={2000}
        style={{ backgroundColor: colors.surfaceVariant }}
      >
        <Text style={{ color: colors.text }}>{snackbar.message}</Text>
      </Snackbar>
    </SafeAreaView>
  );
}

// =============================================================================
// Category Section Component
// =============================================================================

interface CategorySectionProps {
  category: PermissionCategory;
  permissions: PermissionMeta[];
  adminPermissions: GroupPermissionFlags;
  onToggle: (permission: GroupPermission, value: boolean) => void;
  colors: any;
  theme: any;
}

function PermissionCategorySection({
  category,
  permissions,
  adminPermissions,
  onToggle,
  colors,
  theme,
}: CategorySectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons
          name={CATEGORY_ICONS[category] as any}
          size={20}
          color={colors.primary}
        />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {PERMISSION_CATEGORY_LABELS[category]}
        </Text>
      </View>
      <Text
        style={[styles.sectionDescription, { color: colors.textSecondary }]}
      >
        {PERMISSION_CATEGORY_DESCRIPTIONS[category]}
      </Text>

      <View
        style={[
          styles.permissionsList,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {permissions.map((meta, index) => (
          <React.Fragment key={meta.key}>
            <PermissionToggleRow
              meta={meta}
              enabled={adminPermissions[meta.key]}
              onToggle={(value) => onToggle(meta.key, value)}
              colors={colors}
            />
            {index < permissions.length - 1 && (
              <Divider style={{ marginLeft: 16 }} />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// Toggle Row Component
// =============================================================================

interface ToggleRowProps {
  meta: PermissionMeta;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  colors: any;
}

function PermissionToggleRow({
  meta,
  enabled,
  onToggle,
  colors,
}: ToggleRowProps) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionInfo}>
        <Text style={[styles.permissionLabel, { color: colors.text }]}>
          {meta.label}
        </Text>
        <Text
          style={[
            styles.permissionDescription,
            { color: colors.textSecondary },
          ]}
        >
          {meta.description}
        </Text>
      </View>
      <Switch value={enabled} onValueChange={onToggle} color={colors.primary} />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  infoCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    gap: 10,
    alignItems: "flex-start",
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoSubtext: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: "italic",
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionDescription: {
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 28,
  },
  permissionsList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  permissionInfo: {
    flex: 1,
    gap: 2,
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  permissionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
});
