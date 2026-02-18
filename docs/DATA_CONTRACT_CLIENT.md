# Client Data Contract

Last verified: 2026-02-18

## Canonical Type Sources

Use these files as source-of-truth before adding/renaming fields:

| Domain | Canonical type files | Notes |
| --- | --- | --- |
| User/Profile | `src/types/userProfile.ts`, `src/types/models.ts` | `userProfile.ts` is primary for profile privacy/theme/status/badges. |
| Messaging | `src/types/messaging.ts` | Covers message payloads, member state, outbox, settings V3, requests. |
| Games invites/matches | `src/types/turnBased.ts`, `src/types/games.ts` | Invite and turn-based data model contracts. |
| Game protocol/session | `src/types/gameProtocol.ts`, `src/types/gameSession.ts`, `src/types/gameErrors.ts` | Protocol/version and join option wire contract. |

## Segment 5 Consolidation

One duplicate type surface was consolidated:

- `src/services/gameInvites.ts`
  - `InviteStatus` is now an alias to canonical `GameInviteStatus` from `src/types/turnBased.ts`.
  - This removes duplicated literal status unions in the service layer while preserving compatibility.

## High-Risk Runtime Guards Added

### Firestore snapshot decoding

- `src/types/messaging.ts`
  - `decodeMessageRequest(raw, fallbackChatId)` validates and decodes unknown request docs into `MessageRequest`.
- `src/hooks/useMessageRequests.ts`
  - now uses `decodeMessageRequest` when mapping `Users/{uid}/MessageRequests` snapshots.

### Callable response validation

- `src/types/messaging.ts`
  - `isMessageRequestResponse(value)` validates callable response shape.
- `src/hooks/useMessageRequests.ts`
  - validates `acceptMessageRequest` / `declineMessageRequest` response payloads before treating calls as successful.

### Game protocol wire boundary

- `src/types/gameSession.ts`
  - `isGameJoinOptions(value)` runtime guard for Colyseus join payloads.
  - `assertGameJoinOptions(value)` assertion helper.
- `src/services/colyseusJoin.ts`
  - now asserts join payload validity before returning options to room join code.

## Invariants To Preserve

- Messaging:
  - idempotent send identity (`clientId` + `idempotencyKey`)
  - authoritative order by `serverReceivedAt`
  - watermark read/delivery model over per-message mutation
  - outbox states remain stable (`queued` / `uploading` / `sending` / `failed`)
- Games:
  - `GAME_PROTOCOL_VERSION` must stay aligned with server
  - join options must include valid auth token, protocol version, build info, trace ID
- Profile:
  - privacy and theme shapes must remain compatible with Firestore rules and fallback hydration.
