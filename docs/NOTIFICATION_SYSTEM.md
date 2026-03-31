# Notification System

Last verified: 2026-03-30

## Overview

The current notification system is a unified backend-routed in-app and push pipeline.

Every modern notification goes through:

- [notificationCenter.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/notificationCenter.ts)

The routing decision is exclusive:

- `in_app`
- `push`
- `none`

One event should not intentionally produce both an in-app banner and a push notification.

## Supported Event Types

Current event types in both the backend and client notification context:

- `dm_message`
- `group_message`
- `message_request`
- `friend_request`
- `friend_request_accepted`
- `game_invite`
- `game_lobby_ready`
- `game_turn`
- `game_resolved`
- `achievement_unlocked`
- `gift_received`
- `gift_opened`
- `streak_milestone`
- `streak_at_risk`
- `cosmetic_unlock`
- `story_viewed`

Important corrections from older docs:

- `streak_reminder` is not one of the current notification center event types
- `story_view` is not the current event name; the current type is `story_viewed`

## Categories

Current backend category enum:

- `message`
- `social`
- `games`
- `progression`
- `commerce`
- `system`

## Storage

Canonical collections:

- `Users/{uid}/Notifications/{notificationId}`
- `Users/{uid}/NotificationDevices/{deviceId}`
- `Users/{uid}/NotificationSessions/{deviceId}`
- `Users/{uid}/settings/inbox`

## Delivery Flow

### Server side

The notification center:

1. reads user notification preferences
2. optionally checks DM/group mute state
3. reads fresh notification sessions
4. suppresses notifications when the user is already on the equivalent surface
5. selects `in_app`, `push`, or `none`
6. writes the canonical notification document
7. sends Expo push only if `push` wins

Session freshness threshold:

- `90_000 ms` (90 seconds)

### Client side

Client responsibilities are split across:

- [notifications.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/notifications.ts)
- [InAppNotificationsContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/store/InAppNotificationsContext.tsx)
- [AuthContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/store/AuthContext.tsx)
- [userNotifications.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/userNotifications.ts)

What the client does today:

- registers Expo push tokens
- writes active notification session heartbeats
- shows foreground in-app toasts
- normalizes push tap payloads and navigates
- subscribes to unread badge count

## Device Registration

Expo push registration is separate from Stream call push registration.

This doc covers the app notification pipeline only:

- Expo tokens are stored in `NotificationDevices`
- active session heartbeats are stored in `NotificationSessions`

## Android Channels

Current channel setup in `src/services/notifications.ts`:

- `default`
- `messages`
- `social`
- `game-invites`
- `achievements`
- `vibe-incoming-calls`
- `vibe-group-calls`

The notification center itself routes normal app pushes to these main category channels:

- `messages`
- `social`
- `game-invites`
- `achievements`
- `default`

The `vibe-*` call channels are app-side channel definitions for call-related native notifications.

## Badge Count

Unread badge count is derived from:

- `Users/{uid}/Notifications`
- `badgeEligible == true`
- `readAt == null`

`userNotifications.ts` subscribes to that query and updates the app badge.

## User Preferences

The notification center reads these preference families from `Users/{uid}/settings/inbox`:

- global enable/disable
- in-app enable/disable
- message notifications
- social notifications
- game notifications
- achievement notifications
- gift notifications
- story notifications
- streak notifications
- badge-count enable/disable

## Important Runtime Details

- session heartbeats are updated every 25 seconds from the in-app notifications context
- push taps are normalized through `normalizeNotificationPayload`
- chat notification read-marking must remain scope-aware for DM versus group

## Explicitly Legacy / Incorrect Older Claims

These older claims are not current:

- iOS background modes include `voip`
- call troubleshooting should point at old Firestore/WebRTC call files
- the main event list includes `streak_reminder` or `story_view`

## Recommended Validation

```bash
npm run type-check
npm run lint
npm run test
npm --prefix firebase-backend/functions run build
```
