# Group Chat Permission System — Deliverables

## 13A. Architecture Summary

### Overview

A configurable, capability-based permission system for group chats that replaces all hardcoded `role === "admin"` checks with granular, owner-configurable permission flags.

### Key Design Principles

- **Roles for identity, permissions for capability** — Roles (owner/admin/member) remain for organizational hierarchy, but all action gating is done via resolved permission flags.
- **Owner immutability** — Owner always has full permissions. This is not configurable and is enforced at every layer (client, rules, cloud functions).
- **Owner-only invariant** — `MANAGE_PERMISSIONS`, `TRANSFER_OWNERSHIP`, and `DELETE_GROUP` can never be delegated to admin/member, enforced by the resolution function and Firestore security rules.
- **Hierarchy enforcement** — Moderation actions (kick, delete messages, mute, role changes) require the actor to strictly outrank the target in role hierarchy (owner > admin > member).
- **Backward compatibility** — Legacy groups without `permissionsConfig` gracefully fall back to sensible defaults via lazy migration.
- **Single source of truth** — All permission logic lives in `src/permissions/groupPermissions.ts`. No scattered role checks.

### Data Flow

```
Group Document
  └── permissionsConfig: { schemaVersion, admin: {...}, member: {...} }
         │
         ▼
  resolvePermissions(role, config) → GroupPermissionFlags
         │
         ▼
  hasPermission() / hasPermissionOverTarget() → boolean
         │
         ▼
  Contextual helpers (canKickMember, canDeleteMessage, etc.)
         │
         ▼
  UI components & service layer
```

### Permission Categories

| Category         | Permissions                                                        |
| ---------------- | ------------------------------------------------------------------ |
| Messages         | deleteOwnMessages, deleteAnyMessage, pinMessages                   |
| Moderation       | kickMembers, muteMembers                                           |
| Group Management | editGroupName, editGroupPhoto, manageInvites                       |
| Governance       | manageRoles, managePermissions*, transferOwnership*, deleteGroup\* |
| Communication    | mentionEveryone, sendMedia                                         |

\*Owner-only, cannot be delegated

---

## 13B. File-by-File Change List

### New Files

| File                                             | Purpose                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `src/permissions/groupPermissions.ts`            | Core permission module — enums, types, defaults, resolution, evaluation helpers, UI metadata |
| `src/hooks/useGroupPermissions.ts`               | React hook for real-time permission resolution via Firestore snapshots                       |
| `src/screens/groups/GroupPermissionsScreen.tsx`  | Owner-facing UI to configure admin/member permission toggles                                 |
| `__tests__/permissions/groupPermissions.test.ts` | 79 unit tests covering hierarchy, resolution, invariants, edge cases                         |

### Modified Files

| File                                          | Changes                                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/types/models.ts`                         | Added `permissionsConfig?: GroupPermissionsConfig` to `Group` interface                                                                                                                          |
| `src/types/navigation/root.ts`                | Added `GroupPermissions: { groupId: string }` to `MainStackParamList`                                                                                                                            |
| `src/services/groups.ts`                      | Refactored all governance functions to use capability checks; added `updateGroupPermissionsConfig()`, `migrateGroupPermissions()`, `writeAuditLog()`; added self-action and self-transfer guards |
| `src/services/messageActions.ts`              | `canDeleteForAll()` now accepts `permissionsConfig` and uses capability-based evaluation                                                                                                         |
| `firebase-backend/firestore.rules`            | Protected `permissionsConfig` (owner-only write), `ownerId` change protection, `AuditLog` subcollection rules                                                                                    |
| `firebase-backend/functions/src/messaging.ts` | Added server-side permission resolution; `enforceGroupSettings()` now uses capability-based checks                                                                                               |
| `src/navigation/RootNavigator.tsx`            | Registered `GroupPermissions` screen route                                                                                                                                                       |
| `src/screens/groups/GroupChatInfoScreen.tsx`  | Replaced all hardcoded role checks with capability helpers; added lazy migration on group load; added "Admin Permissions" button                                                                 |
| `src/screens/groups/GroupChatScreen.tsx`      | Added `permissionsConfig` state; resolves `userRole` from member data; passes config to `MessageActionsSheet`                                                                                    |
| `src/components/chat/MessageActionsSheet.tsx` | Added `permissionsConfig` prop; passes config to `canDeleteForAll()`                                                                                                                             |

---

## 13C. Security Summary

### Client-Side Enforcement

- All permission checks route through `hasPermission()` / `hasPermissionOverTarget()`
- Owner-only invariant enforced in `resolvePermissions()` — always strips governance flags for non-owners
- Hierarchy enforced via `outranks()` in `hasPermissionOverTarget()`

### Firestore Security Rules

- `permissionsConfig` field protected: only group owner can write
- `ownerId` field protected: only group owner can change
- `AuditLog` subcollection: read by owner/admin, create by members (with UID validation), no update/delete
- All existing group membership validation rules preserved

### Cloud Functions (Server-Side)

- `enforceGroupSettings()` uses `getGroupMemberPermissions()` for capability-based checks
- Server resolves permissions independently from client (no trust of client-supplied flags)
- Falls back to `isGroupAdminOrOwner()` when permission data unavailable

### Invariants Enforced at All Layers

1. Owner always has all permissions (client + server)
2. `MANAGE_PERMISSIONS`, `TRANSFER_OWNERSHIP`, `DELETE_GROUP` never delegated (client resolution + server + Firestore rules)
3. Moderation requires strict hierarchy (client + service layer)
4. Self-action prevention (cannot kick self, transfer to self, change own role)

---

## 13D. QA Summary

### Test Coverage

- **79 unit tests** covering:
  - Role hierarchy (outranks, sameRank, ordering)
  - Permission resolution (owner bypass, admin/member defaults, config overrides)
  - Owner-only invariants (tampered config protection)
  - All 10 contextual action helpers
  - Backward compatibility (null/undefined/partial configs)
  - Permission metadata integrity
  - Configurable permissions filtering

### Edge Cases Handled

- Legacy groups without `permissionsConfig` → graceful fallback to defaults
- Lazy migration on group open (writes config if missing)
- Tampered configs with owner-only flags for non-owners → stripped in resolution
- Null/undefined roles → all checks return false
- Self-action prevention in kick, transfer, role changes
- Admin cannot moderate fellow admin or owner
- Owner cannot be removed

### Manual QA Checklist

- [ ] Create new group → verify `permissionsConfig` written with defaults
- [ ] Open legacy group → verify lazy migration creates config
- [ ] As owner: open Admin Permissions screen, toggle permissions, save
- [ ] As admin: verify toggled permissions take effect (e.g., can/can't kick)
- [ ] As admin: verify cannot access Admin Permissions screen
- [ ] As admin: verify cannot kick other admins
- [ ] As member: verify restricted actions are hidden in UI
- [ ] Transfer ownership → verify roles swap correctly
- [ ] Delete group → verify only owner can do it
- [ ] Check audit log entries created for: role changes, transfers, deletions, permission changes, member removals
