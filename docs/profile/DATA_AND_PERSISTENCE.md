# Data and Persistence

Last verified: 2026-04-01

## Layout Storage

The board layout is stored at:

- `Users/{uid}/ProfileLayout/board`

Current saved document shape:

```ts
{
  schemaVersion: number,
  widgets: WidgetInstance[],
  updatedAt: string
}
```

`updatedAt` is currently written as an ISO string.

## Widget Instance Shape

Each widget instance includes:

- `instanceId`
- `widgetType`
- `size`
- `x`
- `y`
- `visible`
- `pinned`
- `config`
- `createdAt`
- `updatedAt`

`createdAt` and `updatedAt` are currently ISO-string timestamps.

## Persistence Behavior

Current owner flow:

1. load board doc
2. validate and normalize widget data
3. generate defaults if missing or unrecoverable
4. persist defaults for owners when needed
5. save the full widget array on board edits

Current viewed-profile flow:

1. load the target user’s board in read-only mode
2. validate it the same way
3. do not persist defaults
4. do not save edits

That read-only behavior is important because older docs implied viewed profiles were rendered from a completely different persistence model.

## Source Of Truth Rules

### Layout

- canonical source: `Users/{uid}/ProfileLayout/board`

### Profile identity and visuals

- canonical source: `Users/{uid}`

### Streaks

- canonical source: `Friends/{friendshipId}`

### Wallet

- canonical source: `Wallets/{uid}`

### Tasks

- canonical sources:
  - `Tasks`
  - `Users/{uid}/TaskProgress`

### Conversation layout mode

- canonical durable source: `Users/{uid}.conversationDisplayMode`
- fast local cache: AsyncStorage

### Theme mode

- canonical durable source: theme fields on `Users/{uid}`
- fast local cache: AsyncStorage

### Cosmetic ownership

- canonical source: `Users/{uid}/Entitlements/{cosmeticId}`

## Widget Data Sources

High-level data ownership by widget family:

- `profile-header`
  - profile document, picture data, level/progression, pending rewards
- `social-proof`
  - streak summaries and related social activity
- `friends`
  - friend graph reads
- `badges`, `achievements`
  - featured profile data and achievement collections
- `favorite-game`, `profile-stats`
  - game stats and PB-derived summaries
- `recent-activity`
  - recent user activity data
- `tasks-overview`
  - tasks and task progress
- `wallet-balance`
  - wallet subscription
- `theme-mode`
  - theme context
- `chat-layout-mode`
  - conversation display mode context

## Validation and Migration

`useBoardPersistence.ts` currently:

- rejects newer unsupported schema versions
- filters unknown widget types
- normalizes missing timestamps
- repairs missing `profile-header`
- falls back to generated defaults when necessary

## Important Current-State Notes

- profile docs must not describe wallet/tasks/theme/chat-layout data as separate non-board surfaces only; those values are now also present as board widgets
- viewed profiles read persisted board data instead of rendering a bespoke fixed layout
