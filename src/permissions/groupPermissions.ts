/**
 * Group Chat Permission System
 *
 * Capability-based permission model for group chats.
 * Replaces the old hardcoded role === "admin" checks with configurable,
 * granular permission flags.
 *
 * Architecture:
 * - Roles (owner/admin/member) still exist for identity/organization
 * - Permissions determine what each role can actually do
 * - Owner-configurable admin permissions per group
 * - Centralized evaluation — all UI and backend use these helpers
 *
 * Data model:
 * - Groups/{groupId}.permissionsConfig.admin: { ...flags }
 * - Groups/{groupId}.permissionsConfig.member: { ...flags }
 * - Groups/{groupId}.permissionsConfig.schemaVersion: number
 *
 * @module permissions/groupPermissions
 */

import { GroupRole } from "@/types/models";

// =============================================================================
// Permission Capability Keys
// =============================================================================

/**
 * All granular permission capability keys.
 * Each maps to a boolean flag on the role's permission config.
 */
export enum GroupPermission {
  // --- Messages ---
  /** Delete own messages (after edit window expires) */
  DELETE_OWN_MESSAGES = "deleteOwnMessages",
  /** Delete any member's messages */
  DELETE_ANY_MESSAGE = "deleteAnyMessage",
  /** Pin / unpin messages in the group */
  PIN_MESSAGES = "pinMessages",

  // --- Moderation ---
  /** Kick (remove) regular members from the group */
  KICK_MEMBERS = "kickMembers",
  /** Mute members (prevent them from sending messages temporarily) */
  MUTE_MEMBERS = "muteMembers",

  // --- Group management ---
  /** Edit group name */
  EDIT_GROUP_NAME = "editGroupName",
  /** Edit group photo / avatar */
  EDIT_GROUP_PHOTO = "editGroupPhoto",
  /** Send invites to new members */
  MANAGE_INVITES = "manageInvites",

  // --- Governance ---
  /** Promote members to admin / demote admins to member */
  MANAGE_ROLES = "manageRoles",
  /** Edit the per-group permissions configuration */
  MANAGE_PERMISSIONS = "managePermissions",
  /** Transfer group ownership to another member */
  TRANSFER_OWNERSHIP = "transferOwnership",
  /** Delete the entire group */
  DELETE_GROUP = "deleteGroup",

  // --- Communication ---
  /** Use @everyone / @all mentions */
  MENTION_EVERYONE = "mentionEveryone",
  /** Send media (images, voice, files) in the group */
  SEND_MEDIA = "sendMedia",
}

// =============================================================================
// Permission Flags Type
// =============================================================================

/**
 * A complete set of permission flags for a role.
 * Every key from GroupPermission maps to a boolean.
 */
export type GroupPermissionFlags = Record<GroupPermission, boolean>;

/**
 * Partial permission flags (for storage/overrides where some flags may be omitted).
 */
export type PartialPermissionFlags = Partial<GroupPermissionFlags>;

// =============================================================================
// Permission Config (stored on Group document)
// =============================================================================

/**
 * The permission configuration stored on each group document.
 * Contains per-role permission overrides and a schema version for migration.
 */
export interface GroupPermissionsConfig {
  /** Schema version for forward-compatible migration */
  schemaVersion: number;
  /** Admin role permission flags (owner configures these) */
  admin: PartialPermissionFlags;
  /** Member role permission flags (owner configures these, usually restrictive) */
  member: PartialPermissionFlags;
  /** Timestamp of last permissions change */
  updatedAt?: number;
  /** UID of user who last changed permissions */
  updatedBy?: string;
}

/** Current schema version for permission configs */
export const PERMISSIONS_SCHEMA_VERSION = 1;

// =============================================================================
// Default Permission Presets
// =============================================================================

/**
 * Owner ALWAYS has full capabilities. This is not configurable.
 * This is the authoritative truth — the owner bypass is in evaluatePermission().
 */
export const OWNER_PERMISSIONS: GroupPermissionFlags = {
  [GroupPermission.DELETE_OWN_MESSAGES]: true,
  [GroupPermission.DELETE_ANY_MESSAGE]: true,
  [GroupPermission.PIN_MESSAGES]: true,
  [GroupPermission.KICK_MEMBERS]: true,
  [GroupPermission.MUTE_MEMBERS]: true,
  [GroupPermission.EDIT_GROUP_NAME]: true,
  [GroupPermission.EDIT_GROUP_PHOTO]: true,
  [GroupPermission.MANAGE_INVITES]: true,
  [GroupPermission.MANAGE_ROLES]: true,
  [GroupPermission.MANAGE_PERMISSIONS]: true,
  [GroupPermission.TRANSFER_OWNERSHIP]: true,
  [GroupPermission.DELETE_GROUP]: true,
  [GroupPermission.MENTION_EVERYONE]: true,
  [GroupPermission.SEND_MEDIA]: true,
};

/**
 * Default admin permissions for NEW groups.
 * Owner can later customize these per group.
 * Admins get moderation + group editing but NOT governance actions.
 */
export const DEFAULT_ADMIN_PERMISSIONS: GroupPermissionFlags = {
  [GroupPermission.DELETE_OWN_MESSAGES]: true,
  [GroupPermission.DELETE_ANY_MESSAGE]: true,
  [GroupPermission.PIN_MESSAGES]: true,
  [GroupPermission.KICK_MEMBERS]: true,
  [GroupPermission.MUTE_MEMBERS]: true,
  [GroupPermission.EDIT_GROUP_NAME]: true,
  [GroupPermission.EDIT_GROUP_PHOTO]: true,
  [GroupPermission.MANAGE_INVITES]: true,
  [GroupPermission.MANAGE_ROLES]: false,
  [GroupPermission.MANAGE_PERMISSIONS]: false,
  [GroupPermission.TRANSFER_OWNERSHIP]: false,
  [GroupPermission.DELETE_GROUP]: false,
  [GroupPermission.MENTION_EVERYONE]: true,
  [GroupPermission.SEND_MEDIA]: true,
};

/**
 * Default member permissions. Very restrictive.
 * Members can delete their own messages and send invites.
 */
export const DEFAULT_MEMBER_PERMISSIONS: GroupPermissionFlags = {
  [GroupPermission.DELETE_OWN_MESSAGES]: true,
  [GroupPermission.DELETE_ANY_MESSAGE]: false,
  [GroupPermission.PIN_MESSAGES]: false,
  [GroupPermission.KICK_MEMBERS]: false,
  [GroupPermission.MUTE_MEMBERS]: false,
  [GroupPermission.EDIT_GROUP_NAME]: false,
  [GroupPermission.EDIT_GROUP_PHOTO]: false,
  [GroupPermission.MANAGE_INVITES]: true,
  [GroupPermission.MANAGE_ROLES]: false,
  [GroupPermission.MANAGE_PERMISSIONS]: false,
  [GroupPermission.TRANSFER_OWNERSHIP]: false,
  [GroupPermission.DELETE_GROUP]: false,
  [GroupPermission.MENTION_EVERYONE]: false,
  [GroupPermission.SEND_MEDIA]: true,
};

/**
 * Default permissions config for new groups or legacy groups without config.
 */
export const DEFAULT_PERMISSIONS_CONFIG: GroupPermissionsConfig = {
  schemaVersion: PERMISSIONS_SCHEMA_VERSION,
  admin: { ...DEFAULT_ADMIN_PERMISSIONS },
  member: { ...DEFAULT_MEMBER_PERMISSIONS },
};

// =============================================================================
// Owner-Only Permissions (cannot be granted to admin/member)
// =============================================================================

/**
 * Permissions that are ALWAYS owner-only and cannot be delegated.
 * Even if someone tampers with the config, these are enforced.
 */
export const OWNER_ONLY_PERMISSIONS: readonly GroupPermission[] = [
  GroupPermission.MANAGE_PERMISSIONS,
  GroupPermission.TRANSFER_OWNERSHIP,
  GroupPermission.DELETE_GROUP,
] as const;

// =============================================================================
// Role Hierarchy
// =============================================================================

/** Numeric hierarchy for role comparison. Higher = more authority. */
export const ROLE_HIERARCHY: Record<GroupRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

/**
 * Check if actorRole outranks targetRole in the hierarchy.
 */
export function outranks(actorRole: GroupRole, targetRole: GroupRole): boolean {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

/**
 * Check if two roles are at the same level.
 */
export function sameRank(roleA: GroupRole, roleB: GroupRole): boolean {
  return ROLE_HIERARCHY[roleA] === ROLE_HIERARCHY[roleB];
}

// =============================================================================
// Permission Resolution
// =============================================================================

/**
 * Get the default permissions for a role.
 */
export function getDefaultPermissions(role: GroupRole): GroupPermissionFlags {
  switch (role) {
    case "owner":
      return { ...OWNER_PERMISSIONS };
    case "admin":
      return { ...DEFAULT_ADMIN_PERMISSIONS };
    case "member":
      return { ...DEFAULT_MEMBER_PERMISSIONS };
  }
}

/**
 * Resolve the effective permission flags for a role, merging stored config
 * with defaults. Missing flags fall back to default values.
 *
 * Owner always gets full permissions regardless of config.
 */
export function resolvePermissions(
  role: GroupRole,
  config?: GroupPermissionsConfig | null,
): GroupPermissionFlags {
  // Owner always has full permissions — not configurable
  if (role === "owner") {
    return { ...OWNER_PERMISSIONS };
  }

  const defaults = getDefaultPermissions(role);

  if (!config) {
    return defaults;
  }

  const roleConfig = role === "admin" ? config.admin : config.member;
  if (!roleConfig) {
    return defaults;
  }

  // Merge: stored config takes precedence, defaults fill gaps
  const resolved = { ...defaults };
  for (const key of Object.values(GroupPermission)) {
    if (key in roleConfig) {
      resolved[key] = roleConfig[key]!;
    }
  }

  // Enforce owner-only restrictions: these can never be true for non-owners
  for (const ownerOnly of OWNER_ONLY_PERMISSIONS) {
    resolved[ownerOnly] = false;
  }

  return resolved;
}

// =============================================================================
// Permission Evaluation Helpers
// =============================================================================

/**
 * Check if a user with a given role has a specific permission in a group.
 *
 * @param role - The user's role in the group
 * @param permission - The permission to check
 * @param config - The group's permissions config (may be null for legacy groups)
 * @returns true if the user has the permission
 */
export function hasPermission(
  role: GroupRole | null | undefined,
  permission: GroupPermission,
  config?: GroupPermissionsConfig | null,
): boolean {
  if (!role) return false;
  const resolved = resolvePermissions(role, config);
  return resolved[permission] === true;
}

/**
 * Context-aware permission check for actions that involve a target user.
 * Enforces hierarchy: you cannot moderate someone at or above your rank.
 *
 * @param actorRole - Actor's role
 * @param targetRole - Target's role (the person being acted upon)
 * @param permission - The permission required
 * @param config - The group's permissions config
 * @returns true if the action is allowed
 */
export function hasPermissionOverTarget(
  actorRole: GroupRole | null | undefined,
  targetRole: GroupRole | null | undefined,
  permission: GroupPermission,
  config?: GroupPermissionsConfig | null,
): boolean {
  if (!actorRole || !targetRole) return false;

  // Must have the base permission
  if (!hasPermission(actorRole, permission, config)) return false;

  // Must outrank target — cannot moderate equal or higher rank
  if (!outranks(actorRole, targetRole)) return false;

  return true;
}

// =============================================================================
// Contextual Action Checks
// =============================================================================

/**
 * Can the user delete the given message?
 * Own messages: always allowed if within edit window, otherwise needs deleteOwnMessages.
 * Others' messages: needs deleteAnyMessage + hierarchy check.
 */
export function canDeleteMessage(
  actorUid: string,
  actorRole: GroupRole | null | undefined,
  messageSenderId: string,
  messageSenderRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
  isWithinEditWindow?: boolean,
): boolean {
  if (!actorRole) return false;

  const isOwnMessage = actorUid === messageSenderId;

  if (isOwnMessage) {
    // Own message within edit window — always allowed
    if (isWithinEditWindow) return true;
    // Own message outside edit window — needs permission
    return hasPermission(
      actorRole,
      GroupPermission.DELETE_OWN_MESSAGES,
      config,
    );
  }

  // Other's message: need deleteAnyMessage + must outrank sender
  return hasPermissionOverTarget(
    actorRole,
    messageSenderRole,
    GroupPermission.DELETE_ANY_MESSAGE,
    config,
  );
}

/**
 * Can the user kick the target member?
 */
export function canKickMember(
  actorRole: GroupRole | null | undefined,
  targetRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
): boolean {
  return hasPermissionOverTarget(
    actorRole,
    targetRole,
    GroupPermission.KICK_MEMBERS,
    config,
  );
}

/**
 * Can the user change roles (promote/demote)?
 * Only owner can change roles by default. Can be delegated to admin.
 */
export function canManageRoles(
  actorRole: GroupRole | null | undefined,
  targetRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
): boolean {
  return hasPermissionOverTarget(
    actorRole,
    targetRole,
    GroupPermission.MANAGE_ROLES,
    config,
  );
}

/**
 * Can the user edit group info (name)?
 */
export function canEditGroupName(
  actorRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
): boolean {
  return hasPermission(actorRole, GroupPermission.EDIT_GROUP_NAME, config);
}

/**
 * Can the user edit the group photo?
 */
export function canEditGroupPhoto(
  actorRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
): boolean {
  return hasPermission(actorRole, GroupPermission.EDIT_GROUP_PHOTO, config);
}

/**
 * Can the user manage invites (send invitations)?
 */
export function canManageInvites(
  actorRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
): boolean {
  return hasPermission(actorRole, GroupPermission.MANAGE_INVITES, config);
}

/**
 * Can the user manage the group's permission config?
 * Always owner-only.
 */
export function canManagePermissions(
  actorRole: GroupRole | null | undefined,
): boolean {
  return actorRole === "owner";
}

/**
 * Can the user transfer ownership? Always owner-only.
 */
export function canTransferOwnership(
  actorRole: GroupRole | null | undefined,
): boolean {
  return actorRole === "owner";
}

/**
 * Can the user delete the group? Always owner-only.
 */
export function canDeleteGroup(
  actorRole: GroupRole | null | undefined,
): boolean {
  return actorRole === "owner";
}

/**
 * Can the user pin/unpin messages?
 */
export function canPinMessages(
  actorRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
): boolean {
  return hasPermission(actorRole, GroupPermission.PIN_MESSAGES, config);
}

/**
 * Can the user mute other members?
 */
export function canMuteMembers(
  actorRole: GroupRole | null | undefined,
  targetRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
): boolean {
  return hasPermissionOverTarget(
    actorRole,
    targetRole,
    GroupPermission.MUTE_MEMBERS,
    config,
  );
}

/**
 * Can the user use @everyone / @all mentions?
 */
export function canMentionEveryone(
  actorRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
): boolean {
  return hasPermission(actorRole, GroupPermission.MENTION_EVERYONE, config);
}

/**
 * Can the user send media (images, voice, files)?
 */
export function canSendMedia(
  actorRole: GroupRole | null | undefined,
  config?: GroupPermissionsConfig | null,
): boolean {
  return hasPermission(actorRole, GroupPermission.SEND_MEDIA, config);
}

// =============================================================================
// Permission UI Metadata
// =============================================================================

export interface PermissionMeta {
  key: GroupPermission;
  label: string;
  description: string;
  category: PermissionCategory;
  /** Whether this permission is owner-only and cannot be toggled */
  ownerOnly: boolean;
  /** Whether this permission involves acting on other users (needs hierarchy) */
  targetAware: boolean;
}

export type PermissionCategory =
  | "messages"
  | "moderation"
  | "groupManagement"
  | "governance"
  | "communication";

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategory, string> = {
  messages: "Messages",
  moderation: "Moderation",
  groupManagement: "Group Management",
  governance: "Governance",
  communication: "Communication",
};

export const PERMISSION_CATEGORY_DESCRIPTIONS: Record<
  PermissionCategory,
  string
> = {
  messages: "Control what admins can do with messages",
  moderation: "Actions for managing group members",
  groupManagement: "Settings for editing group details",
  governance: "High-level group control (owner-only)",
  communication: "Messaging capabilities",
};

/**
 * Full metadata for all permissions, used by the settings UI.
 * Ordered by category for display.
 */
export const PERMISSION_METADATA: PermissionMeta[] = [
  // Messages
  {
    key: GroupPermission.DELETE_OWN_MESSAGES,
    label: "Delete Own Messages",
    description: "Delete their own messages after the edit window",
    category: "messages",
    ownerOnly: false,
    targetAware: false,
  },
  {
    key: GroupPermission.DELETE_ANY_MESSAGE,
    label: "Delete Any Message",
    description: "Delete messages sent by other members",
    category: "messages",
    ownerOnly: false,
    targetAware: true,
  },
  {
    key: GroupPermission.PIN_MESSAGES,
    label: "Pin Messages",
    description: "Pin or unpin messages in the group",
    category: "messages",
    ownerOnly: false,
    targetAware: false,
  },

  // Moderation
  {
    key: GroupPermission.KICK_MEMBERS,
    label: "Kick Members",
    description: "Remove members from the group",
    category: "moderation",
    ownerOnly: false,
    targetAware: true,
  },
  {
    key: GroupPermission.MUTE_MEMBERS,
    label: "Mute Members",
    description: "Temporarily mute members from sending messages",
    category: "moderation",
    ownerOnly: false,
    targetAware: true,
  },

  // Group Management
  {
    key: GroupPermission.EDIT_GROUP_NAME,
    label: "Edit Group Name",
    description: "Change the group's display name",
    category: "groupManagement",
    ownerOnly: false,
    targetAware: false,
  },
  {
    key: GroupPermission.EDIT_GROUP_PHOTO,
    label: "Edit Group Photo",
    description: "Change the group's avatar image",
    category: "groupManagement",
    ownerOnly: false,
    targetAware: false,
  },
  {
    key: GroupPermission.MANAGE_INVITES,
    label: "Manage Invites",
    description: "Send invitations to new members",
    category: "groupManagement",
    ownerOnly: false,
    targetAware: false,
  },

  // Governance (owner-only display)
  {
    key: GroupPermission.MANAGE_ROLES,
    label: "Manage Roles",
    description: "Promote members to admin or demote admins",
    category: "governance",
    ownerOnly: false,
    targetAware: true,
  },
  {
    key: GroupPermission.MANAGE_PERMISSIONS,
    label: "Manage Permissions",
    description: "Edit the group's permission settings",
    category: "governance",
    ownerOnly: true,
    targetAware: false,
  },
  {
    key: GroupPermission.TRANSFER_OWNERSHIP,
    label: "Transfer Ownership",
    description: "Transfer group ownership to another member",
    category: "governance",
    ownerOnly: true,
    targetAware: false,
  },
  {
    key: GroupPermission.DELETE_GROUP,
    label: "Delete Group",
    description: "Permanently delete the entire group",
    category: "governance",
    ownerOnly: true,
    targetAware: false,
  },

  // Communication
  {
    key: GroupPermission.MENTION_EVERYONE,
    label: "Mention Everyone",
    description: "Use @everyone to notify all group members",
    category: "communication",
    ownerOnly: false,
    targetAware: false,
  },
  {
    key: GroupPermission.SEND_MEDIA,
    label: "Send Media",
    description: "Send images, voice messages, and files",
    category: "communication",
    ownerOnly: false,
    targetAware: false,
  },
];

/**
 * Get permission metadata grouped by category.
 * Filters out owner-only permissions for the admin config UI.
 */
export function getConfigurablePermissions(): Map<
  PermissionCategory,
  PermissionMeta[]
> {
  const grouped = new Map<PermissionCategory, PermissionMeta[]>();

  for (const meta of PERMISSION_METADATA) {
    if (meta.ownerOnly) continue; // Owner-only permissions are not configurable

    if (!grouped.has(meta.category)) {
      grouped.set(meta.category, []);
    }
    grouped.get(meta.category)!.push(meta);
  }

  return grouped;
}
