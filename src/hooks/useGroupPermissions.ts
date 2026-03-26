/**
 * useGroupPermissions Hook
 *
 * Provides reactive access to the current user's resolved permissions
 * in a group chat. Subscribes to real-time changes.
 *
 * Usage:
 *   const { can, permissions, role, loading } = useGroupPermissions(groupId);
 *   if (can(GroupPermission.KICK_MEMBERS)) { ... }
 *
 * @module hooks/useGroupPermissions
 */

import {
  GroupPermission,
  GroupPermissionFlags,
  GroupPermissionsConfig,
  hasPermission,
  hasPermissionOverTarget,
  resolvePermissions,
} from "@/permissions/groupPermissions";
import { getFirestoreInstance } from "@/services/firebase";
import { useAuth } from "@/store/AuthContext";
import { Group, GroupRole } from "@/types/models";
import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseGroupPermissionsResult {
  /** The user's role in this group */
  role: GroupRole | null;
  /** The resolved permission flags for the user's role */
  permissions: GroupPermissionFlags | null;
  /** The raw permissions config from the group document */
  permissionsConfig: GroupPermissionsConfig | null;
  /** Quick check: does the user have this permission? */
  can: (permission: GroupPermission) => boolean;
  /** Check permission with hierarchy (for actions on other users) */
  canOverTarget: (
    targetRole: GroupRole | null | undefined,
    permission: GroupPermission,
  ) => boolean;
  /** Whether permissions are still loading */
  loading: boolean;
}

export function useGroupPermissions(
  groupId: string | undefined,
  /** Optional: provide role from parent to avoid extra reads */
  externalRole?: GroupRole | null,
  /** Optional: provide group from parent to avoid extra reads */
  externalGroup?: Group | null,
): UseGroupPermissionsResult {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [role, setRole] = useState<GroupRole | null>(externalRole ?? null);
  const [permissionsConfig, setPermissionsConfig] =
    useState<GroupPermissionsConfig | null>(null);
  const [loading, setLoading] = useState(!externalRole || !externalGroup);

  // Sync external role if provided
  useEffect(() => {
    if (externalRole !== undefined) {
      setRole(externalRole);
    }
  }, [externalRole]);

  // Sync external group's permissions config if provided
  useEffect(() => {
    if (externalGroup) {
      setPermissionsConfig(externalGroup.permissionsConfig ?? null);
    }
  }, [externalGroup?.permissionsConfig]);

  // Subscribe to group document for real-time permissions config changes
  useEffect(() => {
    if (!groupId || externalGroup) return;

    const db = getFirestoreInstance();
    const groupRef = doc(db, "Groups", groupId);

    const unsub = onSnapshot(
      groupRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPermissionsConfig(data.permissionsConfig ?? null);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );

    return unsub;
  }, [groupId, externalGroup]);

  // Subscribe to member document for real-time role changes
  useEffect(() => {
    if (!groupId || !uid || externalRole !== undefined) return;

    const db = getFirestoreInstance();
    const memberRef = doc(db, "Groups", groupId, "Members", uid);

    const unsub = onSnapshot(
      memberRef,
      (snap) => {
        if (snap.exists()) {
          setRole(snap.data().role as GroupRole);
        } else {
          setRole(null);
        }
        setLoading(false);
      },
      () => {
        setRole(null);
        setLoading(false);
      },
    );

    return unsub;
  }, [groupId, uid, externalRole]);

  // Resolve permissions for the current role
  const permissions = useMemo(() => {
    if (!role) return null;
    return resolvePermissions(role, permissionsConfig);
  }, [role, permissionsConfig]);

  // Quick permission check
  const can = useCallback(
    (permission: GroupPermission): boolean => {
      return hasPermission(role, permission, permissionsConfig);
    },
    [role, permissionsConfig],
  );

  // Permission check with hierarchy
  const canOverTarget = useCallback(
    (
      targetRole: GroupRole | null | undefined,
      permission: GroupPermission,
    ): boolean => {
      return hasPermissionOverTarget(
        role,
        targetRole,
        permission,
        permissionsConfig,
      );
    },
    [role, permissionsConfig],
  );

  return {
    role,
    permissions,
    permissionsConfig,
    can,
    canOverTarget,
    loading,
  };
}
