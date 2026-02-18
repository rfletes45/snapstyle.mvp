# Chat System Cleanup Plan

> Deprecated code to delete, refactor steps, naming fixes, and risk notes.

---

## 1. Overview

The chat system carries debt from the V1→V2 migration and the experimental SQLite mode. This plan identifies concrete cleanup tasks, ordered by risk and effort, with migration steps for each.

**Guiding principles:**

- Never delete code that active clients depend on until all clients are on V2-only.
- Each step must be independently shippable and testable.
- Prefer additive changes first (add tests), then subtractive (remove dead code).

---

## 2. Phase 0 — Add Missing Tests (Pre-Cleanup)

Before removing anything, establish tests that will detect regressions.

| Task                                                                                                   | Files Affected                                                  | Est. Effort |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------- |
| Add backend CF tests for `sendMessageV2`, `editMessageV2`, `deleteMessageForAllV2`, `toggleReactionV2` | `colyseus-server/tests/` or `firebase-backend/functions/tests/` | 3–5 days    |
| Add Firestore security rules tests                                                                     | `firebase-backend/`                                             | 2–3 days    |
| Add unit tests for `outbox.ts`, `messageList.ts`, `messageActions.ts`, `reactions.ts`                  | `__tests__/messaging/`                                          | 2–3 days    |
| Add unit tests for `useChat.ts`, `useUnifiedMessages.ts`                                               | `__tests__/hooks/`                                              | 1–2 days    |

**Risk**: Low — purely additive.

---

## 3. Phase 1 — Remove V1 Dual Writes (Backend)

### 3.1. Stop Writing Legacy Collections

**Current behavior**: Cloud Functions in `firebase-backend/functions/src/messaging.ts` write to **both** V2 (`Chats/{id}/Messages`) and V1 legacy collections simultaneously for backward compatibility.

**Cleanup steps**:

1. Add a feature flag (e.g., `LEGACY_WRITE_ENABLED`) to `messaging.ts` guarding V1 writes.
2. Deploy with flag **on** (no behavior change).
3. Confirm via analytics/logs that no client reads V1 collections.
4. Flip flag **off**, monitor for 2 weeks.
5. Remove the V1 write code paths entirely.

**Files to modify**:

- `firebase-backend/functions/src/messaging.ts` — Remove V1 write branches in `sendMessageV2`, `editMessageV2`, `deleteMessageForAllV2`.
- `firebase-backend/functions/src/legacy.ts` — After V1 write removal, large sections of this 3261-line file become dead code. See §3.2.

**Risk**: **High** — If any client version still reads V1 collections, messages vanish for those users. Must verify via Firestore audit logs that V1 reads are zero before removing V1 writes.

---

### 3.2. Deprecate `legacy.ts`

`firebase-backend/functions/src/legacy.ts` (3261 lines) contains:

- `onNewMessage` trigger (fires on V1 writes)
- Scheduled job for V1 message cleanup
- Various helpers

**Cleanup steps**:

1. After V1 writes are removed (§3.1), the `onNewMessage` trigger never fires.
2. Comment out the trigger export in `firebase-backend/functions/src/index.ts`.
3. Monitor for 1 week.
4. Delete the trigger function.
5. Move any still-needed helpers (e.g., push notification logic) to standalone modules.
6. Eventually delete `legacy.ts` entirely.

**Files to modify**:

- `firebase-backend/functions/src/legacy.ts` — Delete or split.
- `firebase-backend/functions/src/index.ts` — Remove exports.

**Risk**: **Medium** — Push notification logic in `onNewMessage` may be the only path for V1 notifications. Must verify `onNewGroupMessageV2` covers all group notification cases.

---

## 4. Phase 2 — Remove V1 Client Types

### 4.1. Delete V1 Type Definitions

**Current state**: `src/types/models.ts` (~992 lines) contains V1 types `Message`, `GroupMessage`, `Conversation`, etc. alongside non-chat types (`User`, `FriendRequest`, etc.).

**Cleanup steps**:

1. Grep for every usage of V1 chat types:
   - `Message` (not `MessageV2`)
   - `GroupMessage`
   - `Conversation` (as V1 chat type)
2. Replace with V2 equivalents from `src/types/messaging.ts`.
3. Remove V1 chat type definitions from `models.ts`.
4. Keep non-chat types in `models.ts`.

**Files to modify**:

- `src/types/models.ts` — Remove `Message`, `GroupMessage`, and related V1 chat interfaces.
- Every file importing these types.

**Risk**: **Medium** — Many files may import V1 types. The `groupAdapter.ts` conversion layer exists precisely because some code still uses V1 shapes. Once all callsites use V2, the adapter becomes unnecessary.

---

### 4.2. Delete `groupAdapter.ts`

`src/services/messaging/adapters/groupAdapter.ts` converts between `GroupMessage` (V1) and `MessageV2` (V2).

**Prerequisite**: All client code uses `MessageV2` directly (§4.1 complete).

**Cleanup steps**:

1. Remove all calls to `toMessageV2()` and `toGroupMessage()`.
2. Delete `src/services/messaging/adapters/groupAdapter.ts`.
3. Delete `__tests__/messaging/adapters/groupAdapter.test.ts`.
4. Remove adapter barrel export from `src/services/messaging/adapters/index.ts`.

**Risk**: **Low** once §4.1 is complete.

---

## 5. Phase 3 — Remove / Decide on SQLite Mode

### 5.1. Assess SQLite Mode Viability

**Current state**: Feature-flagged behind `USE_LOCAL_STORAGE` in `constants/featureFlags.ts`. The SQLite path uses `src/services/database/repositories/` and is composed into hooks via `useLocalMessages`.

**Decision**: Keep or kill?

| Factor               | Keep                                                                            | Kill                                         |
| -------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| Offline performance  | Better cold-start, faster scroll                                                | Firestore persistence cache is "good enough" |
| Maintenance cost     | High — dual code paths, sync engine, migration scripts                          | Eliminates ~8 files                          |
| Production readiness | Not production-tested (flag is off)                                             | N/A                                          |
| Complexity           | Adds MessageRepository, ConversationRepository, SyncEngine, + schema migrations | Simpler architecture                         |

**Recommendation**: Unless there's a concrete plan to ship SQLite mode within 6 months, **remove it** to reduce maintenance burden.

**Cleanup steps (if removing)**:

1. Set `USE_LOCAL_STORAGE = false` permanently (already the case).
2. Remove all SQLite-related files:
   - `src/services/database/repositories/messageRepository.ts`
   - `src/services/database/repositories/conversationRepository.ts`
   - `src/services/database/repositories/attachmentRepository.ts`
   - `src/services/database/models/`
   - `src/services/sync/syncEngine.ts`
   - `src/hooks/useLocalMessages.ts`
3. Remove SQLite branches from:
   - `src/hooks/useChat.ts` (conditional import / mode switch)
   - `src/hooks/useUnifiedMessages.ts`
4. Remove feature flag `USE_LOCAL_STORAGE` from `constants/featureFlags.ts`.
5. Remove `expo-sqlite` dependency from `package.json` (if no other feature uses it).

**Files affected**: ~10 files.

**Risk**: **Low** — Code is behind a flag that is already off. No production impact.

---

## 6. Phase 4 — Service Layer Consolidation

### 6.1. Finish `attachments.ts` Stubs

**Current state**: `src/services/attachments.ts` contains several functions marked with `// H10` comment stubs (placeholder implementations or incomplete logic).

**Cleanup steps**:

1. Audit each stub for actual usage.
2. Implement or delete based on whether the feature is live.
3. If media upload works end-to-end via `useChatComposer`, the stubs may be for unused planned features — in that case, delete them.

**Risk**: **Low** — Stubs don't affect runtime since they're not called from live code paths.

---

### 6.2. Consolidate Chat Service Files

**Current state**: Multiple overlapping service files:

- `src/services/chatV2.ts` — Callable wrapper for `sendMessageV2`
- `src/services/chat.ts` — V1 service (may still be imported)
- `src/services/messaging/send.ts` — Send pipeline
- `src/services/messaging/messageActions.ts` — Edit/delete
- `src/services/messaging/messageList.ts` — Subscriptions

**Cleanup steps**:

1. Move all V2 chat operations into the `src/services/messaging/` module.
2. Have `chatV2.ts` delegate to `messaging/send.ts` (or merge entirely).
3. Delete `src/services/chat.ts` if no V1 code remains after Phase 2.
4. Ensure `src/services/messaging/index.ts` is the single barrel export for all messaging operations.

**Risk**: **Medium** — Many import paths to update. Use TypeScript compiler errors as a guide.

---

### 6.3. Unify Member State

**Current state**: Member operations are split across:

- `src/services/chatMembers.ts` — DM member operations
- `src/services/messaging/memberState.ts` — Unified facade routing to DM or group
- `src/services/groupMembers.ts` — Group-specific member operations

**Cleanup steps**:

1. Make `memberState.ts` the sole public API (it already routes internally).
2. Make `chatMembers.ts` and `groupMembers.ts` internal (not exported from barrel).
3. Update all direct imports of `chatMembers.ts` / `groupMembers.ts` to go through `memberState.ts`.

**Risk**: **Low** — No logic changes, only import path changes.

---

## 7. Phase 5 — Naming Consistency

### 7.1. Remove V2 Suffixes

Once V1 code is fully removed, the "V2" suffix becomes noise.

| Current Name                    | Proposed Name                        |
| ------------------------------- | ------------------------------------ |
| `MessageV2`                     | `Message`                            |
| `ConversationV2`                | `Conversation`                       |
| `sendMessageV2` (CF)            | `sendMessage`                        |
| `editMessageV2` (CF)            | `editMessage`                        |
| `deleteMessageForAllV2` (CF)    | `deleteMessageForAll`                |
| `toggleReactionV2` (CF)         | `toggleReaction`                     |
| `ChatListScreenV2`              | `ChatListScreen`                     |
| `onNewGroupMessageV2` (trigger) | `onNewGroupMessage`                  |
| `chatV2.ts`                     | `chat.ts` (or merge into messaging/) |

**Cleanup steps**:

1. Rename types/interfaces in `src/types/messaging.ts`.
2. Rename CF exports in `firebase-backend/functions/src/messaging.ts` and update `index.ts`.
3. Rename client-side callable references in `src/services/chatV2.ts`.
4. Rename screen files and update navigation config.
5. Run full TypeScript compile to catch breaks.

**Risk**: **Medium** — CF names are string identifiers used by `httpsCallable('sendMessageV2')`. Renaming requires coordinated deploy: deploy new CF name first (keeping old as alias), update clients, then remove old name.

**CF Rename Strategy**:

1. Deploy CF with **both** old and new names (alias).
2. Ship client update using new name.
3. Wait for 100% client adoption (force update or 30-day window).
4. Delete old CF name.

---

### 7.2. Consistent File Naming

| Current                             | Proposed                         | Reason                             |
| ----------------------------------- | -------------------------------- | ---------------------------------- |
| `src/services/chatV2.ts`            | `src/services/messaging/chat.ts` | Move into messaging module         |
| `src/services/chat.ts`              | Delete                           | V1 only                            |
| `src/hooks/useChatComposer.ts`      | Keep                             | Name is accurate                   |
| `src/hooks/useUnifiedChatScreen.ts` | `src/hooks/useChatScreen.ts`     | "Unified" was a migration-era name |
| `src/hooks/useUnifiedMessages.ts`   | `src/hooks/useMessages.ts`       | Same                               |
| `src/screens/ChatListScreenV2.tsx`  | `src/screens/ChatListScreen.tsx` | Drop V2 suffix                     |

---

## 8. Risk Summary

| Phase                    | Impact if Wrong                   | Rollback Ease   | Recommended Gate                     |
| ------------------------ | --------------------------------- | --------------- | ------------------------------------ |
| 0 — Add tests            | None (additive)                   | N/A             | CI green                             |
| 1 — Remove V1 writes     | **Messages lost for old clients** | Redeploy old CF | Firestore audit logs show 0 V1 reads |
| 2 — Remove V1 types      | Build breaks                      | Revert commit   | TypeScript compiles clean            |
| 3 — Remove SQLite mode   | None (flag already off)           | Revert commit   | CI green                             |
| 4 — Consolidate services | Import breaks                     | Revert commit   | TypeScript compiles clean            |
| 5 — Rename V2→V1         | **CF callable mismatch**          | Redeploy both   | Staged CF deploy with alias          |

---

## 9. Execution Order

```
Phase 0 ─── Add Tests ───────────────────────────────────── (1–2 weeks)
      │
Phase 1 ─── Remove V1 Backend Writes ────────────────────── (1 week + 2 weeks monitor)
      │
Phase 2 ─── Remove V1 Client Types + groupAdapter ───────── (1 week)
      │
Phase 3 ─── Remove SQLite Mode ──────────────────────────── (2–3 days)
      │
Phase 4 ─── Consolidate Services ────────────────────────── (3–5 days)
      │
Phase 5 ─── Rename V2 Suffixes ──────────────────────────── (1 week + staged deploy)
```

**Total estimated time**: 6–8 weeks with monitoring windows.

---

## 10. Files to Delete (Summary)

Once all phases complete, these files can be removed:

| File                                                           | Reason                                      |
| -------------------------------------------------------------- | ------------------------------------------- |
| `src/services/chat.ts`                                         | V1 service, replaced by `messaging/` module |
| `src/services/chatV2.ts`                                       | Merged into `messaging/` module             |
| `src/services/messaging/adapters/groupAdapter.ts`              | V1↔V2 adapter no longer needed              |
| `src/services/database/repositories/messageRepository.ts`      | SQLite mode removed                         |
| `src/services/database/repositories/conversationRepository.ts` | SQLite mode removed                         |
| `src/services/database/repositories/attachmentRepository.ts`   | SQLite mode removed                         |
| `src/services/database/models/*`                               | SQLite mode removed                         |
| `src/services/sync/syncEngine.ts`                              | SQLite mode removed                         |
| `src/hooks/useLocalMessages.ts`                                | SQLite mode removed                         |
| `firebase-backend/functions/src/legacy.ts`                     | V1 triggers/helpers moved or deleted        |
| `__tests__/messaging/adapters/groupAdapter.test.ts`            | Tests for deleted adapter                   |

**Lines of code removed (est.)**: ~4,000–5,000 lines.

---

## 11. Metrics to Track

| Metric                                     | Purpose                          | Target                    |
| ------------------------------------------ | -------------------------------- | ------------------------- |
| V1 collection read count (Firestore audit) | Confirm no V1 readers remain     | 0 for 14 consecutive days |
| CF error rate post-deploy                  | Detect regressions               | ≤ baseline                |
| Message delivery latency (p50, p95)        | Ensure no performance regression | ≤ baseline                |
| Push notification delivery rate            | Catch broken notification paths  | ≥ baseline                |
| TypeScript compile errors                  | Gate for type cleanup phases     | 0                         |
| Test pass rate                             | Gate for all phases              | 100%                      |
