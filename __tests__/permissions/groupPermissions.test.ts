/**
 * Tests for the group permission system
 *
 * Covers: role hierarchy, permission resolution, owner-only invariants,
 * contextual action checks, migration defaults, and edge cases.
 */

import {
  canDeleteGroup,
  canDeleteMessage,
  canEditGroupName,
  canEditGroupPhoto,
  canKickMember,
  canManageInvites,
  canManagePermissions,
  canManageRoles,
  canMentionEveryone,
  canMuteMembers,
  canPinMessages,
  canSendMedia,
  canTransferOwnership,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  DEFAULT_PERMISSIONS_CONFIG,
  getConfigurablePermissions,
  getDefaultPermissions,
  GroupPermission,
  type GroupPermissionsConfig,
  hasPermission,
  hasPermissionOverTarget,
  outranks,
  OWNER_ONLY_PERMISSIONS,
  OWNER_PERMISSIONS,
  PERMISSION_METADATA,
  PERMISSIONS_SCHEMA_VERSION,
  resolvePermissions,
  ROLE_HIERARCHY,
  sameRank,
} from "../../src/permissions/groupPermissions";

// =============================================================================
// Role Hierarchy
// =============================================================================

describe("Role Hierarchy", () => {
  it("owner outranks admin", () => {
    expect(outranks("owner", "admin")).toBe(true);
  });

  it("owner outranks member", () => {
    expect(outranks("owner", "member")).toBe(true);
  });

  it("admin outranks member", () => {
    expect(outranks("admin", "member")).toBe(true);
  });

  it("admin does NOT outrank owner", () => {
    expect(outranks("admin", "owner")).toBe(false);
  });

  it("member does NOT outrank admin", () => {
    expect(outranks("member", "admin")).toBe(false);
  });

  it("member does NOT outrank owner", () => {
    expect(outranks("member", "owner")).toBe(false);
  });

  it("same roles do NOT outrank each other", () => {
    expect(outranks("owner", "owner")).toBe(false);
    expect(outranks("admin", "admin")).toBe(false);
    expect(outranks("member", "member")).toBe(false);
  });

  it("sameRank returns true for identical roles", () => {
    expect(sameRank("owner", "owner")).toBe(true);
    expect(sameRank("admin", "admin")).toBe(true);
    expect(sameRank("member", "member")).toBe(true);
  });

  it("sameRank returns false for different roles", () => {
    expect(sameRank("owner", "admin")).toBe(false);
    expect(sameRank("admin", "member")).toBe(false);
  });

  it("hierarchy values are strictly ordered", () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.member);
  });
});

// =============================================================================
// Permission Resolution
// =============================================================================

describe("resolvePermissions", () => {
  it("owner always gets full permissions regardless of config", () => {
    const customConfig: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: { [GroupPermission.KICK_MEMBERS]: false },
      member: {},
    };
    const resolved = resolvePermissions("owner", customConfig);
    expect(resolved).toEqual(OWNER_PERMISSIONS);
  });

  it("owner gets full permissions with null config", () => {
    const resolved = resolvePermissions("owner", null);
    expect(resolved).toEqual(OWNER_PERMISSIONS);
  });

  it("owner gets full permissions with undefined config", () => {
    const resolved = resolvePermissions("owner", undefined);
    expect(resolved).toEqual(OWNER_PERMISSIONS);
  });

  it("admin gets default permissions without config", () => {
    const resolved = resolvePermissions("admin", null);
    expect(resolved).toEqual(DEFAULT_ADMIN_PERMISSIONS);
  });

  it("member gets default permissions without config", () => {
    const resolved = resolvePermissions("member", null);
    expect(resolved).toEqual(DEFAULT_MEMBER_PERMISSIONS);
  });

  it("admin config overrides defaults", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: { [GroupPermission.KICK_MEMBERS]: false },
      member: {},
    };
    const resolved = resolvePermissions("admin", config);
    expect(resolved[GroupPermission.KICK_MEMBERS]).toBe(false);
    // Other permissions should retain defaults
    expect(resolved[GroupPermission.DELETE_ANY_MESSAGE]).toBe(true);
  });

  it("member config overrides defaults", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: {},
      member: { [GroupPermission.PIN_MESSAGES]: true },
    };
    const resolved = resolvePermissions("member", config);
    expect(resolved[GroupPermission.PIN_MESSAGES]).toBe(true);
  });

  it("owner-only permissions are always false for admin even if config says true", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: {
        [GroupPermission.MANAGE_PERMISSIONS]: true,
        [GroupPermission.TRANSFER_OWNERSHIP]: true,
        [GroupPermission.DELETE_GROUP]: true,
      },
      member: {},
    };
    const resolved = resolvePermissions("admin", config);
    expect(resolved[GroupPermission.MANAGE_PERMISSIONS]).toBe(false);
    expect(resolved[GroupPermission.TRANSFER_OWNERSHIP]).toBe(false);
    expect(resolved[GroupPermission.DELETE_GROUP]).toBe(false);
  });

  it("owner-only permissions are always false for member even if config says true", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: {},
      member: {
        [GroupPermission.MANAGE_PERMISSIONS]: true,
        [GroupPermission.TRANSFER_OWNERSHIP]: true,
        [GroupPermission.DELETE_GROUP]: true,
      },
    };
    const resolved = resolvePermissions("member", config);
    expect(resolved[GroupPermission.MANAGE_PERMISSIONS]).toBe(false);
    expect(resolved[GroupPermission.TRANSFER_OWNERSHIP]).toBe(false);
    expect(resolved[GroupPermission.DELETE_GROUP]).toBe(false);
  });

  it("empty config objects fall back to defaults", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: {},
      member: {},
    };
    expect(resolvePermissions("admin", config)).toEqual(
      DEFAULT_ADMIN_PERMISSIONS,
    );
    expect(resolvePermissions("member", config)).toEqual(
      DEFAULT_MEMBER_PERMISSIONS,
    );
  });
});

describe("getDefaultPermissions", () => {
  it("returns owner permissions for owner role", () => {
    expect(getDefaultPermissions("owner")).toEqual(OWNER_PERMISSIONS);
  });

  it("returns admin defaults for admin role", () => {
    expect(getDefaultPermissions("admin")).toEqual(DEFAULT_ADMIN_PERMISSIONS);
  });

  it("returns member defaults for member role", () => {
    expect(getDefaultPermissions("member")).toEqual(DEFAULT_MEMBER_PERMISSIONS);
  });
});

// =============================================================================
// hasPermission
// =============================================================================

describe("hasPermission", () => {
  it("returns true for owner on any permission", () => {
    for (const perm of Object.values(GroupPermission)) {
      expect(hasPermission("owner", perm)).toBe(true);
    }
  });

  it("returns false for null role", () => {
    expect(hasPermission(null, GroupPermission.KICK_MEMBERS)).toBe(false);
  });

  it("returns false for undefined role", () => {
    expect(hasPermission(undefined, GroupPermission.KICK_MEMBERS)).toBe(false);
  });

  it("admin has kickMembers by default", () => {
    expect(hasPermission("admin", GroupPermission.KICK_MEMBERS)).toBe(true);
  });

  it("member does NOT have kickMembers by default", () => {
    expect(hasPermission("member", GroupPermission.KICK_MEMBERS)).toBe(false);
  });

  it("respects custom config for admin", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: { [GroupPermission.KICK_MEMBERS]: false },
      member: {},
    };
    expect(hasPermission("admin", GroupPermission.KICK_MEMBERS, config)).toBe(
      false,
    );
  });
});

// =============================================================================
// hasPermissionOverTarget
// =============================================================================

describe("hasPermissionOverTarget", () => {
  const defaultConfig = DEFAULT_PERMISSIONS_CONFIG;

  it("owner can act on admin", () => {
    expect(
      hasPermissionOverTarget(
        "owner",
        "admin",
        GroupPermission.KICK_MEMBERS,
        defaultConfig,
      ),
    ).toBe(true);
  });

  it("owner can act on member", () => {
    expect(
      hasPermissionOverTarget(
        "owner",
        "member",
        GroupPermission.KICK_MEMBERS,
        defaultConfig,
      ),
    ).toBe(true);
  });

  it("admin can act on member", () => {
    expect(
      hasPermissionOverTarget(
        "admin",
        "member",
        GroupPermission.KICK_MEMBERS,
        defaultConfig,
      ),
    ).toBe(true);
  });

  it("admin cannot act on owner", () => {
    expect(
      hasPermissionOverTarget(
        "admin",
        "owner",
        GroupPermission.KICK_MEMBERS,
        defaultConfig,
      ),
    ).toBe(false);
  });

  it("admin cannot act on fellow admin", () => {
    expect(
      hasPermissionOverTarget(
        "admin",
        "admin",
        GroupPermission.KICK_MEMBERS,
        defaultConfig,
      ),
    ).toBe(false);
  });

  it("member cannot act on anyone", () => {
    expect(
      hasPermissionOverTarget(
        "member",
        "member",
        GroupPermission.KICK_MEMBERS,
        defaultConfig,
      ),
    ).toBe(false);
  });

  it("returns false when actor is null", () => {
    expect(
      hasPermissionOverTarget(null, "member", GroupPermission.KICK_MEMBERS),
    ).toBe(false);
  });

  it("returns false when target is null", () => {
    expect(
      hasPermissionOverTarget("admin", null, GroupPermission.KICK_MEMBERS),
    ).toBe(false);
  });

  it("fails even with permission if hierarchy doesn't allow", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: { [GroupPermission.DELETE_ANY_MESSAGE]: true },
      member: {},
    };
    // Admin has the permission but cannot act on owner
    expect(
      hasPermissionOverTarget(
        "admin",
        "owner",
        GroupPermission.DELETE_ANY_MESSAGE,
        config,
      ),
    ).toBe(false);
  });
});

// =============================================================================
// Contextual Action Checks
// =============================================================================

describe("canDeleteMessage", () => {
  const config = DEFAULT_PERMISSIONS_CONFIG;

  it("anyone can delete own message within edit window", () => {
    expect(canDeleteMessage("u1", "member", "u1", "member", config, true)).toBe(
      true,
    );
  });

  it("member can delete own message outside edit window (has deleteOwnMessages)", () => {
    expect(
      canDeleteMessage("u1", "member", "u1", "member", config, false),
    ).toBe(true);
  });

  it("admin can delete member's message", () => {
    expect(canDeleteMessage("u1", "admin", "u2", "member", config)).toBe(true);
  });

  it("admin cannot delete owner's message", () => {
    expect(canDeleteMessage("u1", "admin", "u2", "owner", config)).toBe(false);
  });

  it("admin cannot delete another admin's message", () => {
    expect(canDeleteMessage("u1", "admin", "u2", "admin", config)).toBe(false);
  });

  it("owner can delete anyone's message", () => {
    expect(canDeleteMessage("u1", "owner", "u2", "admin", config)).toBe(true);
    expect(canDeleteMessage("u1", "owner", "u2", "member", config)).toBe(true);
  });

  it("member cannot delete another member's message", () => {
    expect(canDeleteMessage("u1", "member", "u2", "member", config)).toBe(
      false,
    );
  });

  it("returns false for null actorRole", () => {
    expect(canDeleteMessage("u1", null, "u2", "member", config)).toBe(false);
  });
});

describe("canKickMember", () => {
  const config = DEFAULT_PERMISSIONS_CONFIG;

  it("owner can kick admin", () => {
    expect(canKickMember("owner", "admin", config)).toBe(true);
  });

  it("admin can kick member", () => {
    expect(canKickMember("admin", "member", config)).toBe(true);
  });

  it("admin cannot kick admin", () => {
    expect(canKickMember("admin", "admin", config)).toBe(false);
  });

  it("admin cannot kick owner", () => {
    expect(canKickMember("admin", "owner", config)).toBe(false);
  });

  it("member cannot kick anyone", () => {
    expect(canKickMember("member", "member", config)).toBe(false);
  });

  it("respects config override that removes kick from admin", () => {
    const noKick: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: { [GroupPermission.KICK_MEMBERS]: false },
      member: {},
    };
    expect(canKickMember("admin", "member", noKick)).toBe(false);
  });
});

describe("canManageRoles", () => {
  it("owner can manage admin roles", () => {
    expect(canManageRoles("owner", "admin")).toBe(true);
  });

  it("owner can manage member roles", () => {
    expect(canManageRoles("owner", "member")).toBe(true);
  });

  it("admin cannot manage roles by default", () => {
    expect(canManageRoles("admin", "member")).toBe(false);
  });

  it("admin can manage roles if granted", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: { [GroupPermission.MANAGE_ROLES]: true },
      member: {},
    };
    expect(canManageRoles("admin", "member", config)).toBe(true);
  });

  it("admin with manageRoles still cannot manage owner", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: { [GroupPermission.MANAGE_ROLES]: true },
      member: {},
    };
    expect(canManageRoles("admin", "owner", config)).toBe(false);
  });
});

describe("Owner-only action checks", () => {
  it("canManagePermissions only for owner", () => {
    expect(canManagePermissions("owner")).toBe(true);
    expect(canManagePermissions("admin")).toBe(false);
    expect(canManagePermissions("member")).toBe(false);
    expect(canManagePermissions(null)).toBe(false);
  });

  it("canTransferOwnership only for owner", () => {
    expect(canTransferOwnership("owner")).toBe(true);
    expect(canTransferOwnership("admin")).toBe(false);
    expect(canTransferOwnership("member")).toBe(false);
  });

  it("canDeleteGroup only for owner", () => {
    expect(canDeleteGroup("owner")).toBe(true);
    expect(canDeleteGroup("admin")).toBe(false);
    expect(canDeleteGroup("member")).toBe(false);
  });
});

describe("Other contextual checks", () => {
  const config = DEFAULT_PERMISSIONS_CONFIG;

  it("canEditGroupName - admin yes, member no by default", () => {
    expect(canEditGroupName("admin", config)).toBe(true);
    expect(canEditGroupName("member", config)).toBe(false);
  });

  it("canEditGroupPhoto - admin yes, member no by default", () => {
    expect(canEditGroupPhoto("admin", config)).toBe(true);
    expect(canEditGroupPhoto("member", config)).toBe(false);
  });

  it("canManageInvites - admin yes, member yes by default", () => {
    expect(canManageInvites("admin", config)).toBe(true);
    expect(canManageInvites("member", config)).toBe(true);
  });

  it("canPinMessages - admin yes, member no by default", () => {
    expect(canPinMessages("admin", config)).toBe(true);
    expect(canPinMessages("member", config)).toBe(false);
  });

  it("canMuteMembers - admin over member yes, member no", () => {
    expect(canMuteMembers("admin", "member", config)).toBe(true);
    expect(canMuteMembers("member", "member", config)).toBe(false);
  });

  it("canMentionEveryone - admin yes, member no by default", () => {
    expect(canMentionEveryone("admin", config)).toBe(true);
    expect(canMentionEveryone("member", config)).toBe(false);
  });

  it("canSendMedia - admin yes, member yes by default", () => {
    expect(canSendMedia("admin", config)).toBe(true);
    expect(canSendMedia("member", config)).toBe(true);
  });
});

// =============================================================================
// Owner-Only Invariants
// =============================================================================

describe("Owner-Only Invariants", () => {
  it("OWNER_ONLY_PERMISSIONS list contains expected permissions", () => {
    expect(OWNER_ONLY_PERMISSIONS).toContain(
      GroupPermission.MANAGE_PERMISSIONS,
    );
    expect(OWNER_ONLY_PERMISSIONS).toContain(
      GroupPermission.TRANSFER_OWNERSHIP,
    );
    expect(OWNER_ONLY_PERMISSIONS).toContain(GroupPermission.DELETE_GROUP);
  });

  it("owner-only permissions are true for owner", () => {
    const ownerPerms = resolvePermissions("owner");
    for (const perm of OWNER_ONLY_PERMISSIONS) {
      expect(ownerPerms[perm]).toBe(true);
    }
  });

  it("owner-only permissions are always false for admin even with tampered config", () => {
    const tamperedConfig: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: Object.fromEntries(
        OWNER_ONLY_PERMISSIONS.map((p) => [p, true]),
      ) as any,
      member: {},
    };
    const adminPerms = resolvePermissions("admin", tamperedConfig);
    for (const perm of OWNER_ONLY_PERMISSIONS) {
      expect(adminPerms[perm]).toBe(false);
    }
  });

  it("owner-only permissions are always false for member even with tampered config", () => {
    const tamperedConfig: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: {},
      member: Object.fromEntries(
        OWNER_ONLY_PERMISSIONS.map((p) => [p, true]),
      ) as any,
    };
    const memberPerms = resolvePermissions("member", tamperedConfig);
    for (const perm of OWNER_ONLY_PERMISSIONS) {
      expect(memberPerms[perm]).toBe(false);
    }
  });
});

// =============================================================================
// Default Config
// =============================================================================

describe("DEFAULT_PERMISSIONS_CONFIG", () => {
  it("has correct schema version", () => {
    expect(DEFAULT_PERMISSIONS_CONFIG.schemaVersion).toBe(
      PERMISSIONS_SCHEMA_VERSION,
    );
  });

  it("admin defaults match DEFAULT_ADMIN_PERMISSIONS", () => {
    expect(DEFAULT_PERMISSIONS_CONFIG.admin).toEqual(DEFAULT_ADMIN_PERMISSIONS);
  });

  it("member defaults match DEFAULT_MEMBER_PERMISSIONS", () => {
    expect(DEFAULT_PERMISSIONS_CONFIG.member).toEqual(
      DEFAULT_MEMBER_PERMISSIONS,
    );
  });
});

// =============================================================================
// Permission Metadata
// =============================================================================

describe("Permission Metadata", () => {
  it("every GroupPermission has metadata", () => {
    const allPerms = Object.values(GroupPermission);
    const metaKeys = PERMISSION_METADATA.map((m) => m.key);
    for (const perm of allPerms) {
      expect(metaKeys).toContain(perm);
    }
  });

  it("getConfigurablePermissions excludes owner-only permissions", () => {
    const grouped = getConfigurablePermissions();
    const allKeys: GroupPermission[] = [];
    grouped.forEach((metas) => {
      for (const m of metas) {
        allKeys.push(m.key);
      }
    });
    for (const ownerOnly of OWNER_ONLY_PERMISSIONS) {
      expect(allKeys).not.toContain(ownerOnly);
    }
  });

  it("getConfigurablePermissions groups by category", () => {
    const grouped = getConfigurablePermissions();
    expect(grouped.size).toBeGreaterThan(0);
    grouped.forEach((metas, category) => {
      for (const m of metas) {
        expect(m.category).toBe(category);
      }
    });
  });
});

// =============================================================================
// Backward Compatibility / Migration
// =============================================================================

describe("Backward Compatibility", () => {
  it("null config resolves to sensible defaults for all roles", () => {
    const ownerPerms = resolvePermissions("owner", null);
    const adminPerms = resolvePermissions("admin", null);
    const memberPerms = resolvePermissions("member", null);

    // Owner has all
    for (const perm of Object.values(GroupPermission)) {
      expect(ownerPerms[perm]).toBe(true);
    }

    // Admin has moderation defaults
    expect(adminPerms[GroupPermission.KICK_MEMBERS]).toBe(true);
    expect(adminPerms[GroupPermission.DELETE_ANY_MESSAGE]).toBe(true);

    // Member is restrictive
    expect(memberPerms[GroupPermission.KICK_MEMBERS]).toBe(false);
    expect(memberPerms[GroupPermission.SEND_MEDIA]).toBe(true);
  });

  it("partial config fills missing fields from defaults", () => {
    const config: GroupPermissionsConfig = {
      schemaVersion: 1,
      admin: { [GroupPermission.KICK_MEMBERS]: false },
      member: {},
    };
    const resolved = resolvePermissions("admin", config);
    // Overridden
    expect(resolved[GroupPermission.KICK_MEMBERS]).toBe(false);
    // Not in config, falls back to default
    expect(resolved[GroupPermission.DELETE_ANY_MESSAGE]).toBe(true);
    expect(resolved[GroupPermission.EDIT_GROUP_NAME]).toBe(true);
  });
});
