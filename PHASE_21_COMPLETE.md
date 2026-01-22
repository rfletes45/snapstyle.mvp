# Phase 21: Trust & Safety V1.5 - COMPLETE ✅

## Overview

Phase 21 implements comprehensive trust and safety features including rate limiting, ban/strike system, admin moderation tools, and Expo push token cleanup.

## Definition of Done (DoD)

✅ Rate limiting for friend requests and messages (Cloud Functions)
✅ Expo push token cleanup when invalid
✅ Bans/strikes data model with client enforcement
✅ Admin report queue screen gated by custom claim

## Implementation Summary

### New Types Added (`src/types/models.ts`)

**Ban System:**

- `BanStatus` - "active" | "expired" | "lifted"
- `BanReason` - harassment, spam, inappropriate_content, underage, multiple_violations, fraud, other
- `Ban` - Ban record with uid, status, reason, expiry, admin info
- `BAN_DURATIONS` - Preset durations (1 day, 3 days, 1 week, 1 month, permanent)

**Strike System:**

- `UserStrike` - Strike record with count, history, last reason
- `StrikeRecord` - Individual strike entry with reason, details, timestamp
- `STRIKE_THRESHOLDS` - Auto-ban thresholds (2 strikes = temp ban, 3 = long ban, 5 = permanent)

**Rate Limiting:**

- `RATE_LIMITS` - Configurable limits (20 friend requests/hour, 30 messages/minute, etc.)

**Domain Events:**

- `DomainEvent` - Event record for migration prep
- `EventType` - All event types (user_created, message_sent, ban_applied, etc.)

**Enhanced Report:**

- Added `reviewedBy`, `reviewedAt`, `resolution`, `actionTaken` fields
- Added "dismissed" status

### New Service (`src/services/moderation.ts`)

**Ban Checking:**

- `getUserBan(uid)` - Fetch ban status
- `subscribeToUserBan(uid, callback)` - Real-time ban subscription
- `isUserBanned(uid)` - Quick ban check

**Strike Tracking:**

- `getUserStrikes(uid)` - Get strike history

**Admin Functions (via Cloud Functions):**

- `adminSetBan(targetUid, reason, durationMs, details)` - Apply ban
- `adminLiftBan(targetUid)` - Remove ban
- `adminApplyStrike(targetUid, reason, details, reportId)` - Issue strike
- `adminResolveReport(reportId, resolution, actionTaken)` - Handle report

**Admin Queries:**

- `getPendingReports(limit)` - Fetch pending reports
- `getReportsForUser(targetUid)` - Get all reports for a user
- `subscribeToPendingReports(callback, limit)` - Real-time subscription

**Display Helpers:**

- `BAN_REASON_LABELS` - Human-readable reason labels
- `formatBanDuration(ban)` - Format remaining time

### New Screens

#### AdminReportsQueueScreen (`src/screens/admin/AdminReportsQueueScreen.tsx`)

Admin-only screen for reviewing user reports:

- List of pending reports with reason chips
- View reporter and reported user profiles
- View user strike history
- Take actions: dismiss, warning, strike, or ban
- Ban duration selection
- Resolution notes
- Real-time updates

#### BannedScreen (`src/screens/admin/BannedScreen.tsx`)

Shown to banned users:

- Ban reason and details
- Duration/expiry info
- Sign out option
- Support contact info

### Updated Components

#### AppGate (`src/components/AppGate.tsx`)

Added ban enforcement:

- New "banned" hydration state
- Subscribe to ban status on login
- Show BannedScreen if active ban
- Block all app access when banned

#### SettingsScreen (`src/screens/settings/SettingsScreen.tsx`)

Added admin section:

- Conditionally shown for users with admin custom claim
- Link to AdminReportsQueueScreen

### Cloud Functions (`firebase-backend/functions/src/index.ts`)

**Rate Limiting:**

- `sendFriendRequestWithRateLimit` - Check rate limit for friend requests
- `checkMessageRateLimit` - Check rate limit for messages
- `checkRateLimit()` helper - Generic rate limiter with Firestore tracking

**Expo Token Cleanup:**

- `sendExpoPushNotificationWithCleanup()` - Enhanced push with token cleanup
- `cleanupInvalidPushToken()` - Remove invalid tokens
- `cleanupExpiredPushTokens` - Scheduled cleanup (daily)

**Admin Moderation:**

- `adminSetBan` - Apply ban (requires admin claim)
- `adminLiftBan` - Remove ban (requires admin claim)
- `adminApplyStrike` - Issue strike with auto-ban logic
- `adminResolveReport` - Handle report resolution
- `adminSetAdminClaim` - Grant/revoke admin access
- `initializeFirstAdmin` - HTTP endpoint for first admin setup

**Ban Management:**

- `updateExpiredBans` - Hourly scheduled function to expire bans

**Domain Events:**

- `logDomainEvent()` - Log events for migration prep
- `onNewMessageEvent` - Trigger for message events
- `onNewReport` - Trigger for report events

### Firestore Rules (`firebase-backend/firestore.rules`)

New rules for:

**Bans Collection:**

- User can read own ban only
- Writes are admin-only (via Cloud Functions)

**UserStrikes Collection:**

- User can read own strikes only
- Writes are admin-only (via Cloud Functions)

**Reports Collection (Enhanced):**

- Reporter can read own reports
- Admins can read all reports
- Users can create reports against others
- Only admins can update/resolve reports

**Events Collection:**

- Admins can read for debugging
- Writes are server-only

### Firestore Indexes (`firebase-backend/firestore.indexes.json`)

New indexes for:

- Reports: status + createdAt DESC
- Reports: reportedUserId + createdAt DESC
- Bans: status + expiresAt ASC
- Events: type + createdAt DESC
- Events: processed + createdAt ASC

### Navigation (`src/navigation/RootNavigator.tsx`)

Added route:

- `AdminReports` - Admin reports queue screen

## Data Model

### Collections

```
Bans/
  {uid}/
    - uid: string
    - status: "active" | "expired" | "lifted"
    - reason: BanReason
    - reasonDetails?: string
    - bannedBy: string (admin UID)
    - createdAt: number
    - expiresAt: number | null (null = permanent)
    - liftedAt?: number
    - liftedBy?: string

UserStrikes/
  {uid}/
    - uid: string
    - strikeCount: number
    - lastStrikeAt: number
    - lastStrikeReason?: BanReason
    - strikeHistory: StrikeRecord[]

RateLimits/
  {uid}_{actionType}/
    - uid: string
    - actionType: string
    - actions: number[] (timestamps)
    - updatedAt: number

Events/
  {eventId}/
    - id: string
    - type: EventType
    - uid: string
    - createdAt: number
    - payload: object
    - version: number
    - processed: boolean
```

## Admin Setup

To create the first admin:

1. Set a secret key in Firebase Functions config:

```bash
firebase functions:config:set admin.setup_key="YOUR_SECRET_KEY"
```

2. Deploy functions:

```bash
cd firebase-backend
npm run deploy
```

3. Call the initializeFirstAdmin endpoint with your user UID:

```bash
curl -X POST https://your-project.cloudfunctions.net/initializeFirstAdmin \
  -H "Content-Type: application/json" \
  -d '{"uid": "YOUR_USER_UID", "secretKey": "YOUR_SECRET_KEY"}'
```

4. After the first admin is set, they can grant admin access to other users via the `adminSetAdminClaim` function.

## Testing Checklist

- [ ] Rate limiting prevents excessive friend requests (>20/hour)
- [ ] Rate limiting prevents message spam (>30/min)
- [ ] Invalid push tokens are cleaned up automatically
- [ ] Banned users see BannedScreen immediately
- [ ] Banned users cannot access any app features
- [ ] Ban expiry works correctly (auto-expires)
- [ ] Admin can view pending reports
- [ ] Admin can dismiss reports
- [ ] Admin can issue warnings
- [ ] Admin can apply strikes
- [ ] Admin can ban users with various durations
- [ ] Strikes auto-apply bans at thresholds
- [ ] User strike history is visible to admins
- [ ] Admin section only visible to admins
- [ ] Domain events are logged for key actions

## Deployment Steps

1. Deploy Cloud Functions:

```bash
cd firebase-backend
npm run build
npm run deploy
```

2. Deploy Firestore rules and indexes:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

3. Set up first admin (see Admin Setup above)

## Files Changed/Created

- `src/types/models.ts` - Extended with ban/strike/event types
- `src/services/moderation.ts` - NEW (400+ lines)
- `src/screens/admin/AdminReportsQueueScreen.tsx` - NEW (600+ lines)
- `src/screens/admin/BannedScreen.tsx` - NEW (150 lines)
- `src/components/AppGate.tsx` - Updated with ban enforcement
- `src/screens/settings/SettingsScreen.tsx` - Added admin section
- `src/navigation/RootNavigator.tsx` - Added admin routes
- `firebase-backend/functions/src/index.ts` - Added 500+ lines
- `firebase-backend/firestore.rules` - Added ban/strike/event rules
- `firebase-backend/firestore.indexes.json` - Added new indexes

## Next Phase

Phase 22 can continue with:

- Media pipeline improvements (image compression presets)
- Video feasibility check for Expo managed workflow
- Thumbnail generation strategy
- EJECT_PLAN.md if video requires native code
