# Deprecation Map

> Segment 3/18 deprecation inventory (2026-02-18). Evidence is from repo-local `rg` searches only.

## Search Basis

Targeted terms and scans run in code folders (`src`, `firebase-backend/functions/src`, `colyseus-server/src`, `constants`) excluding `node_modules`, `dist`, and generated libs.

Primary signals used:

- `@deprecated` annotations
- inline `legacy`/`dead code` comments
- replacement hints in code/docs
- caller traces from import/call-site search

## Candidate Modules

| Module | Deprecation signal | Suspected replacement | Current callers (search proof) | Removal risk |
| --- | --- | --- | --- | --- |
| `src/services/chatV2.ts` | File-level `@deprecated` + function-level deprecations | `src/services/messaging/send.ts` + consolidated messaging services | Active callers: `src/services/messaging/send.ts`, `src/hooks/useOutboxProcessor.ts`, `src/hooks/useUnifiedMessages.ts`, `src/hooks/useSnapCapture.ts`, `src/screens/chat/ChatScreen.tsx` | High |
| `src/services/messageList.ts` | File-level `@deprecated` | Local-first message repository path (`useLocalMessages` + DB-first subscribe) | Active caller: `src/services/messaging/subscribe.ts`; tests in `__tests__/messaging/subscribe.test.ts` | Medium |
| `src/services/messaging/subscribe.ts` | File-level `@deprecated` | New subscribe stack (planned SQLite-first pipeline) | Active caller: `src/hooks/useUnifiedMessages.ts` | Medium |
| `src/hooks/useUnifiedMessages.ts` | File-level `@deprecated` note (`Use useLocalMessages`) | `useLocalMessages` (already referenced in docs) | Active caller: `src/hooks/useChat.ts` | High |
| `src/services/outbox.ts` | File-level `@deprecated` (SQLite replacement) | SQLite-backed outbox/storage layer | Active callers include `src/services/chatV2.ts`, `src/services/messaging/send.ts`, `src/hooks/useChatDebugInfo.ts` | High |
| `src/hooks/useSnapCapture.ts` | Header: `@deprecated DEAD CODE` | `useAttachmentPicker` + direct camera-send flow (noted in `src/screens/chat/ChatScreen.tsx`) | No runtime import caller found in `src` (only self file + doc/comment mentions) | Low |
| `src/services/gameInvites.ts` legacy API (`sendGameInvite`, `cancelGameInvite`) | Function-level `@deprecated` comments | Universal API (`sendUniversalInvite`, `cancelUniversalInvite`) | `sendGameInvite(`/`cancelGameInvite(` search only finds definitions in this file (+ one comment in `src/services/turnBasedGames.ts`) | Low |
| `src/services/gameInvites.ts` legacy query API (`getPendingInvites`, `subscribeToPendingInvites`) | Function-level `@deprecated No production callers` | `subscribeToPlayPageInvites` | No `src` callers outside defining file; only docs mention old APIs | Low |
| `src/components/games/withGameLobby.tsx` | Legacy lobby wrapper pattern; no active integrations found | `useGameLobbyController` + `MultiplayerLobbyOverlay` | `withGameLobby` search returns only this file (no screen imports) | Low |
| `src/components/profile/LegacyProfileHeader.tsx` | Filename indicates legacy path | New profile layout components/screens (`OwnProfileScreen`, `UserProfileScreen`) | Still imported by `src/screens/profile/ProfileScreen.tsx` and re-exported by `src/components/profile/index.ts` | Medium |
| `src/components/profile/LegacyProfileActions.tsx` | Filename indicates legacy path | New profile action surface under new profile layout | Still imported by `src/screens/profile/ProfileScreen.tsx` and re-exported by `src/components/profile/index.ts` | Medium |
| `src/services/groups.ts::subscribeToGroupMessages` | Function annotated `@deprecated` | `@/services/messaging` subscriptions (`subscribeToConversationMessages`) | No call sites found outside `src/services/groups.ts`; active group subscriptions run via messaging adapters | Low |
| `firebase-backend/functions/src/legacy.ts` | Central legacy module + many wrapper imports from `./legacy` | Extracted modules in `admin.ts`, `economy.ts`, `leaderboards.ts`, `moderation.ts`, `notifications.ts`, `scheduled*.ts`, `social.ts` | Still imported by multiple function modules and `src/index.ts` for stable export names | Very high |
| `constants/theme.ts` deprecated helpers | Function-level `@deprecated` notes | `useAppTheme()` / `getThemeById` paths | Compatibility helpers still present; full caller cleanup not done in this segment | Medium |

## Duplicate / Overlap Hotspots (Not Deletion-Ready)

### Invites

- Game invite flows:
  - Universal API in `src/services/gameInvites.ts` (`sendUniversalInvite`, `claimInviteSlot`, `startGameEarly`)
  - Legacy invite APIs still exported in same file (deprecated)
- Other invite domains coexist:
  - Group chat invites via `src/services/groups.ts`
  - Call invites via `firebase-backend/functions/src/calls.ts` (`GroupCallInvites`)

### Lobby

- Active canonical flow:
  - `src/hooks/useGameLobbyController.ts`
  - `src/components/games/MultiplayerLobbyOverlay.tsx`
- Additional legacy wrapper:
  - `src/components/games/withGameLobby.tsx` (no active caller found)

### Messaging Writes / Subscriptions

- Send pipeline overlap:
  - `src/services/messaging/send.ts` (unified facade)
  - `src/services/chatV2.ts` (deprecated but still called)
- Subscription overlap:
  - `src/services/messaging/subscribe.ts` (deprecated facade)
  - `src/services/messageList.ts` (deprecated Firestore listener implementation)
  - `src/services/groups.ts::subscribeToGroupMessages` (deprecated legacy path)

### Profile Updates

- Domain-specific profile updates in `src/services/profileService.ts`
- Generic profile patch path in `src/services/users.ts::updateProfile`
- Both are still actively used from screens/services

## Notes

- This document is intentionally conservative: no module is marked delete-ready unless caller search was explicit and clean.
- External callers (manual scripts, old release branches, production trigger names) are a risk for backend legacy exports.
