# Social Widgets and Streaks

Last verified: 2026-03-27

← Back to [Profile System Overview](PROFILE_SYSTEM_OVERVIEW.md)

This document covers the social and streak-related widgets, their canonical data sources, and how they connect to the rebuilt streak system.

## Streak System Overview

### What "Streak" Means

A streak is a count of consecutive days that two friends have exchanged messages. Streaks are **per-friendship**, not per-user. Each friendship between two users has its own independent streak count.

### Canonical Architecture

Streaks are **server-authoritative**. The client never writes streak data directly.

```
User sends message → Cloud Function (messaging.ts)
  → Checks if sender/recipient are friends
  → Checks if this is the first message from this sender today (UTC)
  → Updates Friends/{friendshipId}:
      - lastSentDay_uid1 or lastSentDay_uid2
      - If both users sent today: increment streakCount, update streakUpdatedDay
      - Grace period logic if applicable
```

### Firestore Schema

**Collection:** `Friends`

Streak-relevant fields on each friendship document:

| Field               | Type              | Description                                           |
| ------------------- | ----------------- | ----------------------------------------------------- |
| `streakCount`       | number            | Current consecutive day count                         |
| `streakBestCount`   | number            | All-time best streak for this friendship              |
| `streakUpdatedDay`  | string            | UTC date string (YYYY-MM-DD) of last streak increment |
| `lastSentDay_uid1`  | string            | UTC date of last message sent by uid1                 |
| `lastSentDay_uid2`  | string            | UTC date of last message sent by uid2                 |
| `streakGraceUsedAt` | timestamp \| null | When grace protection was last consumed               |
| `participants`      | string[]          | Array of both user UIDs (used for queries)            |
| `blockedBy`         | string \| null    | If set, friendship is blocked                         |

### UTC Calendar Day Logic

All streak calculations use UTC calendar days, not local time:

- "Today" = current UTC date
- A streak increments when **both** users have sent a message on the same UTC day
- A streak breaks if no increment occurs for a full UTC day after `streakUpdatedDay`

### Grace Period

Canonical grace protection mechanics:

- Users get a grace period that prevents streak loss for 1 extra day
- Grace is available once every 30 days (cooldown tracked by `streakGraceUsedAt`)
- Grace is consumed automatically when a streak would otherwise break
- The `useTopStreaks` hook detects grace usage within the last 7 days

### Milestones

**Canonical milestones** (from `src/services/streakCosmetics.ts`):

```
[3, 7, 14, 30, 50, 100, 365]
```

`nextMilestone(count)` returns the next milestone above the current count, or `Infinity` if at/above 365.

### Streak Status Derivation

**Function:** `deriveStreakStatus(streakCount, streakUpdatedDay, lastSentDay_self, lastSentDay_partner)` from `src/services/streakCosmetics.ts`

Returns one of:

- `"active"` — both users sent today, streak is healthy
- `"at_risk"` — streak hasn't been updated today and may expire if not refreshed
- `"expired"` — streak has broken (streakCount dropped to 0)
- `"none"` — no streak established yet

## Streak Widget (Social Proof)

### Widget Metadata

| Property        | Value                                  |
| --------------- | -------------------------------------- |
| Widget type ID  | `social-proof`                         |
| Adapter         | `SocialProofAdapter` in `adapters.tsx` |
| Supported sizes | wide (4×1), large (4×2)                |
| Default size    | wide                                   |
| Data hook       | `useTopStreaks(uid)`                   |

### Data Pipeline

```
Friends collection (Firestore)
  → onSnapshot (real-time, filtered by participants array-contains uid)
  → Filter: streakCount > 0, not blocked
  → Sort by streakCount descending
  → Take top 5
  → Enrich each with partner profile (getUserProfileByUid)
  → Derive status per streak (deriveStreakStatus)
  → Compute nextMilestone per streak
  → Return StreakSummary[] + counts
```

### Privacy Integration

In `OwnProfileScreen`, if `privacy?.showStreaks === "nobody"`:

- `streaks` array is replaced with `[]`
- `activeStreakCount` and `topStreakCount` are set to `0`
- Widget renders the empty state

### Tier System

The widget displays tier badges based on streak count:

| Threshold | Label       | Emoji | Color  |
| --------- | ----------- | ----- | ------ |
| 3 days    | Warming Up  | ✨    | amber  |
| 7 days    | On Fire     | 🔥    | red    |
| 14 days   | Blazing     | 🌟    | orange |
| 30 days   | Unstoppable | ⚡    | yellow |
| 50 days   | Century     | 💪    | blue   |
| 100 days  | Legendary   | 💎    | purple |
| 365 days  | Eternal     | 👑    | gold   |

> Note: These tiers are defined in `adapters.tsx` `STREAK_TIERS` and differ from the milestones in `streakCosmetics.ts` — tiers are visual labels, milestones are progress targets.

### Wide Layout (4×1, 88px)

Single-line display of the user's top streak:

- Section header icon + "Streaks"
- Partner avatar (with decoration) via `ProfilePictureWithDecoration`
- Streak count with 🔥 emoji
- Partner name
- Tier badge chip (colored label)
- At-risk pill (⚠️ yellow) if applicable
- Grace-saved pill ("Saved" green) if applicable

### Large Layout (4×2, 184px)

Rich streak display:

- Header row: "Streaks" + active streak count badge
- **Hero streak** (top streak):
  - Partner avatar (36px)
  - Partner name + tier label
  - Streak count (bold, large)
  - Milestone progress bar: bar showing progress from current count to next milestone
  - At-risk or grace-saved pills
- **Additional streaks row** (streaks 2-5):
  - Row of small partner avatars (28px) each showing 🔥 + count below

### Widget States

| State       | Condition                           | Visual                                                         |
| ----------- | ----------------------------------- | -------------------------------------------------------------- |
| Loading     | `data.loading === true`             | Activity spinner + "Loading streaks..."                        |
| Error       | `data.error !== null`               | Alert triangle icon + "Couldn't load streaks"                  |
| Empty       | No streaks (`streaks.length === 0`) | Users icon + "Start chatting to build streaks!" + optional CTA |
| Active      | At least one streak                 | Full streak display per layout                                 |
| At-risk     | `streak.status === "at_risk"`       | ⚠️ yellow pill on that streak entry                            |
| Grace-saved | `streak.graceUsed === true`         | "Saved" green pill on that streak entry                        |

### Tap Action

Tapping the streak widget navigates to the Friends screen (`navigation.navigate("Friends")`).

## Friends Card

### Data Source

The `FriendsCard` component fetches friend data internally — it receives a `userId` prop and loads friend profiles asynchronously from Firestore.

### Content

- Count of friends as header badge
- Avatar row: up to 8 friend avatars with decoration overlays
- "+N" overflow pill if more than 8 friends
- Each avatar is tappable → navigates to that friend's profile

### Privacy

- `hiddenFromOthers` badge shown on own profile if `showFriendsList === "nobody"`
- `privacyHidden` on other profiles evaluates against viewer relationship

### On UserProfileScreen (Non-Widget)

On the other-user profile, friends are shown as a traditional `OverviewCard` (not a widget). The same `FriendsCard` component is used but with different privacy evaluation logic.

## Mutual Friends

### How Mutual Friends Are Computed

**Service:** `getMutualFriends(currentUserId, targetUserId)` in `profileService.ts`

1. Fetch friend list for `currentUserId`
2. Fetch friend list for `targetUserId`
3. Compute set intersection on UIDs
4. Fetch full profiles for intersecting UIDs (limited to 10)
5. Return `MutualFriendInfo[]` with display name, avatar, decoration

### Own Profile Behavior

On `OwnProfileScreen`, mutual friends data is **not populated** — an empty array is always passed. Mutual friends are semantically meaningless for viewing your own profile (mutual with yourself).

The widget is available in the Widget Gallery, but displays nothing useful on the own-profile board. It is primarily meaningful on `UserProfileScreen`.

### UserProfileScreen Integration

On other users' profiles, mutual friends are loaded on mount and displayed as a dedicated section below the overview cards. This uses `getMutualFriends()` directly, not the widget system.

## Recent Activity

### Data Source

**Firestore collection:** `Users/{uid}/activity`

Activities are written by server-side triggers:

| Event                       | Trigger                   | Type String        |
| --------------------------- | ------------------------- | ------------------ |
| Achievement unlocked        | Game resolution pipeline  | `achievement`      |
| Streak milestone reached    | Messaging Cloud Function  | `streak_milestone` |
| Profile picture/bio updated | Profile service           | `profile_update`   |
| New friend added            | Friend request acceptance | `new_friend`       |
| Shop purchase               | Purchase Cloud Function   | `shop_purchase`    |
| Decoration equipped         | Customization Hub equip   | `decoration_equip` |
| Status changed              | Status update             | `status_change`    |

### Fetch Pattern

In `OwnProfileScreen`, activities are fetched as a side effect:

```typescript
const activities = await fetchUserActivities(uid, 5); // Latest 5
```

Activities are reformatted with:

- Appropriate Material Community icon name per type
- Human-readable text description
- Relative timestamp ("3m ago", "2h ago", "yesterday")

### Privacy

Respects `showRecentActivity` privacy setting. If set to `"nobody"`, the widget shows a "Hidden from others" indicator on own profile.

## UserProfileScreen Social Features

The `UserProfileScreen` (viewing someone else) does **not** use the widget board. It renders social data in a traditional layout:

### Social Proof Section

Still uses `SocialProofSection` component (not the widget adapter):

- Shows if users are friends
- Streak row: 🔥 + count + tier badge (if applicable)
- Activity row: icon + summary + timestamp

### Friendship Details

When viewing a friend's profile:

- Shows streak count with the viewer
- Shows friendship duration ("Friends for 2mo", "Friends for 1y 3mo")
- Shows last active indicator if applicable

### Relationship-Based Actions

| Relationship       | Actions Available                  |
| ------------------ | ---------------------------------- |
| Self               | Share profile                      |
| Stranger           | Add Friend                         |
| Friend             | Message, Call, Remove Friend, Mute |
| Pending (sent)     | Cancel Request                     |
| Pending (received) | Accept, Decline                    |
| Blocked by you     | Unblock                            |
| Blocked by them    | Error view (profile hidden)        |

## Canonical vs Derived Data

| Data Point                  | Type          | Source                                                             |
| --------------------------- | ------------- | ------------------------------------------------------------------ |
| Streak count per friendship | **Canonical** | `Friends/{id}.streakCount` (server-written)                        |
| Streak best count           | **Canonical** | `Friends/{id}.streakBestCount` (server-written)                    |
| Streak status               | **Derived**   | Computed client-side by `deriveStreakStatus()` from streak fields  |
| Streak tier label           | **Derived**   | Computed client-side from count using `STREAK_TIERS` array         |
| Next milestone              | **Derived**   | Computed client-side by `nextMilestone()`                          |
| Active streak count         | **Derived**   | Count of friendships with `streakCount > 0` and non-expired status |
| Top streak count            | **Derived**   | Max `streakCount` across all friendships                           |
| Favorite game               | **Derived**   | Most-played game from personal bests (not user-selected)           |
| Friend count                | **Canonical** | `Users/{uid}.stats.friendCount`                                    |
| Total games/wins            | **Canonical** | `Users/{uid}/GamePB` subcollection (aggregated)                    |
| Mutual friends              | **Derived**   | Set intersection of two users' friend lists                        |
| Recent activities           | **Canonical** | `Users/{uid}/activity` subcollection (server-written)              |

## Key Implementation Files

| File                                                        | Purpose                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| `src/hooks/useTopStreaks.ts`                                | Real-time streak data subscription and enrichment       |
| `src/services/streakCosmetics.ts`                           | `deriveStreakStatus()`, `nextMilestone()`, `MILESTONES` |
| `src/services/friends.ts`                                   | `getUserProfileByUid()` for partner profile enrichment  |
| `src/components/profile/WidgetBoard/adapters.tsx`           | `SocialProofAdapter` renderer                           |
| `src/components/profile/SocialProof/SocialProofSection.tsx` | Legacy component (still used on UserProfileScreen)      |
| `src/components/profile/OverviewCards/FriendsCard.tsx`      | Friends card component                                  |
| `src/services/profileService.ts`                            | `getMutualFriends()`, `fetchUserActivities()`           |

## See Also

- [Profile Widgets Reference](PROFILE_WIDGETS_REFERENCE.md) — widget inventory with all types
- [Data and Persistence](DATA_AND_PERSISTENCE.md) — Firestore paths, source-of-truth rules
- [NOTIFICATION_SYSTEM.md](../NOTIFICATION_SYSTEM.md) — streak reminder notifications
- [Profile System Overview](PROFILE_SYSTEM_OVERVIEW.md) — full documentation map
