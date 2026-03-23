# Call System Audit & Reference Document

Audit date: 2026-03-23
Repo: `snapstyle-mvp`
Intent: document the call system as it exists today, not the intended end state.

## 1. Executive Overview

The current call system is a native-only calling stack built around four main pieces:

- client UI and navigation for call entry, incoming-call presentation, and in-call screens
- a React `CallContext` that owns most 1:1 call UI state
- singleton services for call lifecycle (`callService`), media/signaling (`webRTCService`), and native telephony UI (`callKeepService`)
- Firebase-backed persistence and realtime behavior using Firestore `Calls` documents, Firestore `CallSignaling` documents, and Cloud Functions for notifications, timeouts, and call history

At a high level, the app supports:

- 1:1 audio calls
- 1:1 video calls
- a separate group call implementation with host controls and participant layouts
- incoming call presentation via an in-app overlay and native CallKeep UI
- denormalized call history
- a dedicated call settings screen
- optional analytics, adaptive bitrate, call waiting, foreground service, VoIP push, and battery-optimization helpers

The important reality is that these capabilities are not equally mature.

- The 1:1 path is the most complete and coherent.
- The group-call path exists, but it is architecturally split from the main call context and has major integration gaps.
- Background calling, FCM/VoIP push, analytics, adaptive bitrate, foreground service, battery optimization, and some native lifecycle helpers are present in code but only partially wired or placeholder-heavy.
- Firestore is both the session state store and the signaling transport. There is no websocket signaling server or SFU/MCU layer.

The system should be understood as a mixed state: part production runtime, part scaffold for future hardening, and part legacy/stranded implementation.

## 2. Scope Covered

This audit covered the full call-related surface visible in the repository, including:

- app bootstrap and route registration
- DM, group chat, and profile call entry points
- call screens, overlays, controls, group participant UI, history, and settings
- call hooks, React context state, and singleton service modules
- media initialization, WebRTC setup, signaling, audio routing, and teardown
- native CallKeep integration and background/foreground lifecycle helpers
- push notification registration and call-notification handling paths
- backend Cloud Functions for calls
- Firestore rules, indexes, and account-deletion cleanup touching call data
- type definitions, feature flags, and platform/config assumptions

Functionality included in the review:

- regular audio calls
- regular video calls
- incoming ringing/invitation flows
- active in-call UI
- group calls
- permissions
- signaling and media setup
- call history and settings
- notification behavior
- presence/privacy/block/blocking touchpoints
- failure handling, cleanup, and backend lifecycle behavior

Not covered because it is not confirmable from this repo alone:

- Apple PushKit/APNs certificate setup outside the repo
- Firebase Cloud Messaging device-token plumbing outside the repo
- TURN provider credentials or vendor-side configuration
- EAS/CI secrets and deployed environment values
- runtime behavior of native iOS code, since no iOS project directory is present in this snapshot

## 3. File and Module Inventory

### Bootstrap, Navigation, and Gating

- `App.tsx`
  - wraps the app in `CallProvider`
  - boots call-related background helpers on mount
  - renders `IncomingCallOverlay` globally and navigates into call screens after answer
- `src/navigation/RootNavigator.tsx`
  - registers `AudioCall`, `VideoCall`, `GroupCall`, `CallHistory`, and `CallSettings` routes when `CALL_FEATURES.CALLS_ENABLED` is true
  - uses full-screen modal presentation for active call screens
  - defines deep-link config, but does not include call routes
- `src/types/navigation/root.ts`
  - declares call route types
- `constants/featureFlags.ts`
  - central call feature flags
  - only `CALLS_ENABLED` is meaningfully enforced in the current runtime; most granular flags are declarative only
- `src/utils/platform.ts`
  - defines `areNativeCallsAvailable`
  - calls are disabled on web and Expo Go

### Core Runtime State and Hooks

- `src/contexts/CallContext.tsx`
  - main runtime state owner for the current 1:1 calling experience
  - initializes services, subscribes to `callService`, owns incoming-call overlay state, media state, reconnection state, and call timers
  - exposes `startCall`, `answerCall`, `declineCall`, `endCall`, mute/speaker/video/camera actions, and hold/swap helpers
- `src/hooks/calls/useCall.ts`
  - convenience wrapper around `CallContext`
  - exposes `startAudioCall`, `startVideoCall`, `startGroupCall`, `answerCall`, `declineCall`, `endCall`, and derived flags
  - important inconsistency: `startGroupCall` here routes to generic `startCall(scope: "group")`, not `groupCallService.startGroupCall`
- `src/hooks/calls/useLocalMedia.ts`
  - exposes local-stream state and media toggles
  - hardcodes `isFrontCamera = true` instead of reading `webRTCService`
- `src/hooks/calls/useRemoteParticipants.ts`
  - builds remote participant info from `currentCall.participants` plus `remoteStreams`
  - depends on `currentCall` staying fresh, which it often does not
- `src/hooks/useGroupCallParticipants.ts`
  - separate Firestore subscription for group participant state
  - drives host/co-host permissions, raised hands, active speaker, and participant management
  - partially bypasses `groupCallService` by updating Firestore directly for some actions

### 1:1 Call Services

- `src/services/calls/index.ts`
  - safe barrel export and lazy-loader entrypoint
  - exports platform-agnostic services and lazy getters for native ones
- `src/services/calls/callService.ts`
  - primary 1:1 call lifecycle service
  - creates `Calls` docs, subscribes to ringing calls, answers/declines/ends calls, updates participant media flags, and bridges CallKeep callbacks into app behavior
- `src/services/calls/webRTCService.ts`
  - owns local stream, remote streams, peer connections, signaling subscriptions, offer/answer/ICE handling, media toggles, camera switching, and cleanup
  - signaling transport is Firestore, not sockets
- `src/services/calls/callKeepService.ts`
  - wraps `react-native-callkeep`
  - displays native incoming/outgoing UI, sets call active/ended state, manages hold/mute callbacks, and exposes native audio-route control
- `src/services/calls/audioSessionService.ts`
  - audio route abstraction over CallKeep
  - speaker/earpiece logic exists, but most deeper native-session behavior is documented rather than implemented
- `src/services/calls/callReconnectionService.ts`
  - higher-level reconnect monitor using app state and optional NetInfo
  - largely placeholder; actual reconnect work is simulated
- `src/services/calls/backgroundCallHandler.ts`
  - intended FCM background/foreground call notification bridge
  - mostly a handler shell; actual FCM wiring is not present in the inspected app code
- `src/services/calls/voipPushService.ts`
  - intended iOS PushKit/VoIP handler
  - mostly documentation/placeholder code; no real PushKit registration is active
- `src/services/calls/foregroundServiceManager.ts`
  - Android foreground-service abstraction
  - placeholder-heavy; does not call a native module
- `src/services/calls/batteryOptimizationHandler.ts`
  - Android battery optimization UX helper
  - state detection is currently placeholder and usually returns `unknown`
- `src/services/calls/concurrentCallManager.ts`
  - call waiting/hold/swap abstraction
  - mostly unintegrated; `addCall()` is not wired into active runtime flows
- `src/services/calls/ringtoneService.ts`
  - ringtone playback and vibration
  - relies on optional `expo-av` and remote MP3 URLs
- `src/services/calls/adaptiveBitrateService.ts`
  - adaptive quality engine for participant count and network quality
  - present but not wired into the live call runtime

### Group Call Services and UI

- `src/services/calls/groupCallService.ts`
  - separate service for group-call lifecycle
  - creates group `Calls` docs, writes group settings, handles join/leave/end, host controls, raised hands, pinning, active speaker, and invites
- `src/screens/calls/GroupCallScreen.tsx`
  - group-call UI with grid/speaker layout, participant sheet, host controls, and hand raising
  - depends on `useGroupCallParticipants` for participant state but still reads `CallContext.currentCall` for top-level call status
- `src/components/calls/ParticipantListOverlay.tsx`
  - host/co-host participant management sheet
- `src/components/calls/VideoGrid.tsx`
  - grid-layout participant renderer
- `src/components/calls/SpeakerView.tsx`
  - speaker-layout renderer

### Call UI Components and Screens

- `src/components/calls/IncomingCallOverlay.tsx`
  - full-screen incoming-call UI
  - starts/stops ringtone, answers/declines, and navigates to `AudioCall` or `VideoCall`
- `src/components/calls/CallControls.tsx`
  - mute/speaker/video/switch-camera/end-call controls
- `src/components/calls/CallQualityIndicator.tsx`
  - quality indicator UI
- `src/components/calls/CallButton.tsx`
  - DM call buttons used from chat
- `src/components/calls/MissedCallBadge.tsx`
  - badge helper for unseen missed calls
  - no clear integration into primary navigation was found
- `src/components/calls/index.ts`
  - safe barrel export for call components
- `src/screens/calls/AudioCallScreen.tsx`
  - audio-only active call screen
- `src/screens/calls/VideoCallScreen.tsx`
  - video active call screen
- `src/screens/calls/CallHistoryScreen.tsx`
  - call history UI, filtering, stats, deletion, redial
- `src/screens/calls/CallSettingsScreen.tsx`
  - UI for call preferences
- `src/screens/calls/index.ts`
  - exports native screens or stub "Not Available" screens depending on platform

### Call Entry Points Outside the Call Folder

- `src/screens/chat/ChatScreen.tsx`
  - primary DM call entry via `CallButtonGroup` in the header
- `src/screens/groups/GroupChatScreen.tsx`
  - primary group call entry
  - starts group calls through `groupCallService.startGroupCall`
- `src/screens/profile/UserProfileScreen.tsx`
  - has a `handleCall()` path that navigates directly to `AudioCall` without starting a call session
  - this looks stale or broken relative to the main runtime
- `src/components/profile/ProfileActions/ProfileActionsBar.tsx`
  - renders the profile-level "Call" button when `onCall` is provided

### Call History, Settings, and Analytics

- `src/services/calls/callHistoryService.ts`
  - call history CRUD, stats, missed-count helpers, realtime subscription
- `src/services/calls/callSettingsService.ts`
  - local + Firestore settings store, DND logic, privacy preferences, export/import
  - not enforced in the active call runtime
- `src/services/calls/callAnalyticsService.ts`
  - analytics and quality report writer
  - no live caller in the inspected client code

### Types, Policy Touchpoints, and General Notifications

- `src/types/call.ts`
  - canonical call, participant, signaling, history, settings, and analytics types
- `src/types/userProfile.ts`
  - privacy model including `allowCalls` and helper `canCallUser(...)`
- `src/services/blocking.ts`
  - block relationship helpers
- `src/services/notifications.ts`
  - general push registration using Expo Notifications
  - creates Android channels including `vibe-incoming-calls` and `vibe-group-calls`
- `src/store/AuthContext.tsx`
  - registers push tokens and handles general notification responses
- `src/services/notifications/normalizeNotification.ts`
  - normalizes generic notification types
  - does not handle call notification types

### Backend, Rules, and Cleanup

- `firebase-backend/functions/src/calls.ts`
  - backend call notifications, history writing, timeout cleanup, signaling cleanup, and TURN callable
  - also contains several non-exported legacy/experimental functions
- `firebase-backend/functions/src/index.ts`
  - actual Cloud Function export surface
- `firebase-backend/firestore.rules`
  - access rules for `Calls`, `CallSignaling`, `CallHistory`, `GroupCallInvites`, `Analytics`, and `CallQualityReports`
- `firebase-backend/firestore.indexes.json`
  - includes the composite index used by the incoming-calls query
- `firebase-backend/functions/src/deleteAccount.ts`
  - redacts call data and deletes related signaling, invites, analytics, and quality reports during account deletion

### Historical Documentation

- `docs/QA_CALL_SYSTEM_AUDIT.md`
  - historical point-in-time audit
  - useful context, but not a current source of truth

## 4. System Architecture

### High-Level Shape

The system is built as a client-managed WebRTC call stack with Firestore as both:

- the canonical call/session document store, via `Calls/{callId}`
- the signaling transport, via `CallSignaling/{callId}/Signals/{signalId}`

Native telephony presentation is delegated to `react-native-callkeep`. The call backend is lightweight and mostly event-driven:

- create `Calls` doc
- backend sends push
- clients read/write Firestore directly for session state and signaling
- backend records history and enforces scheduled cleanup

### Relationship Between the Major Layers

#### Client UI

UI is split across:

- global incoming-call UI: `IncomingCallOverlay`
- 1:1 active call screens: `AudioCallScreen`, `VideoCallScreen`
- group active call screen: `GroupCallScreen`
- entry points: DM header buttons, group chat call option sheet, profile action button

#### Navigation

`RootNavigator` owns all call routes. Active call screens are full-screen modals with gestures disabled. The app has a global `navigationRef`, and `IncomingCallOverlay` uses a callback from `App.tsx` to navigate into active call screens after answer.

Important architectural note: the navigation layer is scope-agnostic for incoming calls. Incoming calls are navigated purely by `call.type`, not by `call.scope`, so group calls currently do not have a dedicated incoming-navigation path.

#### State Management

The main state owner is `CallContext`, but only for the generic call path. It subscribes to `callService`, not `groupCallService`.

This creates two parallel runtime models:

- 1:1 path: `CallContext` + `callService` + `webRTCService`
- group path: `groupCallService` + `useGroupCallParticipants` + direct screen state

This split is the single biggest architectural theme in the current system. The codebase does not have one unified call state model.

#### Signaling and Realtime Layer

There is no socket or room server. Realtime behavior uses:

- Firestore snapshot listeners on `Calls/{callId}`
- Firestore snapshot listeners on `CallSignaling/{callId}/Signals`

Each signal is a Firestore document. Clients create, consume, and delete these documents directly.

#### Backend / Database

Backend involvement is narrow:

- `onCallCreated`: send push notifications
- `onCallUpdated`: send cancel/end notifications and record history
- `handleCallTimeouts`: scheduled missed-call enforcement
- `cleanupCallSignaling`: scheduled signaling GC
- `getTurnCredentials`: returns ICE server config

The backend is not the signaling owner. It does not broker offers or answers and does not maintain room membership beyond the Firestore call documents.

#### Media / WebRTC Layer

`webRTCService` owns:

- permissions
- local `getUserMedia`
- peer-connection creation
- track wiring
- signaling send/receive
- reconnection attempts
- teardown

The group-call implementation reuses the same `webRTCService`, so there is not a separate group media stack.

#### Notifications

There are two notification systems in the repo:

- general app notifications via Expo Notifications and Expo push tokens
- call-specific backend logic that expects `fcmToken` and optional `voipToken`

Those two systems are not cleanly joined in the current code. That mismatch is a major operational risk.

#### App Lifecycle Integration

App state is observed in several places:

- `CallContext` for Android foreground-service handling during calls
- `backgroundCallHandler` for metadata cleanup
- `AuthContext` for presence and push-token refresh
- `callReconnectionService` for reconnect attempts
- `callSettingsService` for DND checks

These lifecycle integrations are distributed rather than centralized.

## 5. Data Model and State Sources

### Firestore Session Document: `Calls/{callId}`

Primary fields come from `src/types/call.ts`:

- `id`
- `scope`: `"dm"` or `"group"`
- `conversationId`
- `type`: `"audio"` or `"video"`
- `status`: `"ringing" | "connecting" | "connected" | "ended" | "declined" | "missed" | "failed"`
- `callerId`
- `callerName`
- `participants`: keyed by user id
- `participantUids`: flat uid array for queries and rules
- `createdAt`
- `answeredAt`
- `endedAt`
- `endReason`
- `duration`

Group-specific fields live on the same document:

- `maxParticipants`
- `hostId`
- `isLocked`
- `activeSpeakerId`
- `pinnedParticipantId`

### Participant Shape

Each participant includes:

- identity: `odId`, `odname`, `displayName`, `avatarConfig`
- join/leave timing: `joinedAt`, `leftAt`
- media flags: `isMuted`, `isVideoEnabled`
- connection flag: `connectionState`

Group participants add:

- `role`: `"host" | "co-host" | "participant"`
- `raisedHand`, `raisedHandAt`
- `isScreenSharing`
- `audioLevel`

### Group Settings Document

Stored at:

- `Calls/{callId}/Settings/config`

Fields:

- `maxParticipants`
- `allowScreenShare`
- `muteOnJoin`
- `videoOffOnJoin`
- `allowParticipantsToUnmute`
- `hostOnlyInvite`
- `recordingEnabled`

### Signaling Documents

Stored at:

- `CallSignaling/{callId}/Signals/{signalId}`

Fields:

- `id`
- `type`: `"offer" | "answer" | "ice-candidate" | "bye"`
- `from`
- `to`
- `callId`
- `payload`
- `createdAt`

These docs are ephemeral. Clients delete them after processing. A scheduled backend job also removes old leftover docs.

### Call History

Stored per-user at:

- `Users/{uid}/CallHistory/{callId}`

Fields include:

- `callId`
- `odId`
- `otherParticipants`
- `type`
- `scope`
- `status`
- `direction`
- `createdAt`
- `duration`
- `wasAnswered`

Missed-call badge bookkeeping also uses:

- `Users/{uid}.lastMissedCallSeenAt`

### Call Settings

Stored in two places:

- local cache in AsyncStorage (`@call_settings`)
- cloud copy in `Users/{uid}/Settings/calls`

Settings cover:

- camera defaults
- audio defaults
- ringtone/vibration
- DND schedule
- privacy (`allowCallsFrom`)
- video quality and data saver
- accessibility display options

### Group Invites

Stored at:

- `GroupCallInvites/{inviteId}`

Fields include:

- `callId`
- `inviterId`, `inviterName`
- `inviteeId`
- `groupId`, `groupName`
- `callType`
- `createdAt`, `expiresAt`
- `status`

### Analytics and Quality Reports

Optional client-written collections:

- `Analytics/calls/events/{id}`
- `CallQualityReports/{callId}`

Rules exist for these collections, but the live client runtime does not appear to write to them today.

### Push and Device Records Relevant to Calls

General app push registration writes:

- `Users/{uid}.expoPushToken`
- `Users/{uid}/NotificationDevices/{deviceId}`

Call backend code reads:

- `Users/{uid}.fcmToken`
- `Users/{uid}.platform`
- `Users/{uid}.voipToken`

That split is operationally important because the inspected client code does not write `fcmToken`.

### Local Client State Sources

#### `CallContext`

Holds:

- `currentCall`
- `incomingCall`
- `showIncomingCallUI`
- `isConnecting`
- `isConnected`
- `isReconnecting`
- `reconnectionAttempts`
- `isMuted`
- `isSpeakerOn`
- `isVideoEnabled`
- `localStream`
- `remoteStreams`
- `heldCalls`
- `callDuration`
- `networkQuality`

#### Service Singleton State

- `callService.currentCallId`
- `webRTCService.currentCallId`, `currentUserId`, `peerConnections`, `localStream`, `remoteStreams`, media flags
- `groupCallService.currentGroupCallId`, `currentLayout`, `pinnedParticipantId`
- `callKeepService.activeCallId`

### Important State Ownership Caveat

`CallContext.currentCall` is event-sourced, not continuously Firestore-synced.

- `callService` emits `call_started` and `call_answered`
- but its call-document subscription only reacts to terminal states
- it does not continuously publish participant-state updates or `connected` transitions back to the caller side

That means `currentCall`, `currentCall.status`, and `currentCall.participants` can become stale during active calls.

## 6. End-to-End Call Flows

### A. Starting a 1:1 Audio Call

Trigger:

- user taps the audio button from `ChatScreen` header via `CallButtonGroup`

Sequence:

1. `CallButton` checks platform support and whether the user already has an active call.
2. `useCall.startAudioCall(...)` calls `CallContext.startCall(...)` with `scope: "dm"` and `type: "audio"`.
3. `CallContext.startCall(...)` sets local connecting state and delegates to `callService.startCall(...)`.
4. `callService.startCall(...)`:
   - checks auth and active-call guard
   - loads caller and callee user docs
   - builds the `participants` map
   - writes `Calls/{callId}` with `status: "ringing"`
   - stores `currentCallId`
   - subscribes to `Calls/{callId}`
   - initializes `webRTCService`
   - creates an offer for the remote participant
   - starts outgoing CallKeep UI
   - starts a 30-second local timeout
   - emits `call_started`
5. `CallContext` receives `call_started`, recognizes it as outgoing because `event.call.id === callService.getCurrentCallId()`, and sets `currentCall`.
6. `CallButton` navigates to `AudioCall`.
7. Backend `onCallCreated` sends call notification push to the callee if usable tokens exist.

State transitions:

- local client: idle -> connecting/outgoing
- Firestore `Calls` doc: nonexistent -> `ringing`
- signaling: one `offer` doc written to `CallSignaling`

UI changes:

- header button spinner while starting
- `AudioCallScreen` opens
- status text initially shows `Ringing...`

Backend interactions:

- Firestore `Calls` write
- Cloud Function notification trigger

Failure cases:

- auth missing
- user already in a call
- permission denial during media init
- TURN fetch failure falls back to STUN only
- push delivery can fail if no compatible token exists

### B. Starting a 1:1 Video Call

This is the same flow as audio, except:

- `type` is `"video"`
- local media initializes with camera + microphone
- the caller is navigated to `VideoCall`
- CallKeep is told `hasVideo = true`

Video-specific failure cases:

- camera permission denial
- camera initialization/device errors

### C. Receiving an Incoming Call

Trigger:

- a new `Calls` document with `status: "ringing"` appears and includes the current user in `participantUids`

Foreground sequence:

1. `callService.initialize()` installs `subscribeToIncomingCalls()`.
2. That subscription queries:
   - `Calls`
   - `status == "ringing"`
   - `participantUids array-contains currentUser`
   - newest first
   - `limit(1)`
3. On added doc:
   - caller-side docs are skipped
   - calls are skipped if `callService.currentCallId` already exists
   - `callKeepService.displayIncomingCall(...)` is invoked
   - `callService` emits `call_started`
4. `CallContext` interprets the event as incoming, sets `incomingCall`, and shows `IncomingCallOverlay`.
5. `IncomingCallOverlay` plays ringtone/vibration and renders the accept/decline UI.

Background-intended sequence:

1. backend push should arrive
2. app should route payload into `backgroundCallHandler.handleBackgroundMessage(...)`
3. that handler should call `callKeepService.displayIncomingCall(...)`

What is actually confirmed:

- the handler exists
- the handler is not wired to any actual FCM setup in the inspected app code

State transitions:

- Firestore remains `ringing`
- local client: idle -> incoming/ringing

Failure cases:

- incoming query is `limit(1)`, which constrains true call waiting
- if pushes are the only expected background wake mechanism, the repo does not show them fully wired

### D. Accepting an Incoming 1:1 Call

Trigger:

- user taps Accept/Answer in `IncomingCallOverlay`
- or answers from native CallKeep UI

Sequence:

1. overlay captures call info, stops ringtone, and calls `CallContext.answerCall(callId)`.
2. `CallContext.answerCall(...)` hides incoming UI, sets connecting state, and calls `callService.answerCall(callId)`.
3. `callService.answerCall(...)`:
   - verifies auth and membership
   - rejects non-`ringing` calls
   - stores `currentCallId`
   - clears local timeout
   - updates `Calls/{callId}` to `status: "connecting"`, sets `answeredAt`, `joinedAt`, and participant connection state
   - subscribes to `Calls/{callId}`
   - initializes `webRTCService`
   - processes pending signals
   - marks CallKeep connected
   - updates Firestore to `status: "connected"` and participant connection state `connected`
   - re-reads the call doc and emits `call_answered`
4. `CallContext` receives `call_answered`, sets `currentCall`, clears `incomingCall`, hides the overlay, and starts the duration timer.
5. `IncomingCallOverlay` navigates to `AudioCall` or `VideoCall` based on `call.type`.

State transitions:

- Firestore `ringing` -> `connecting` -> `connected`
- local client: incoming -> connecting -> connected

UI changes:

- overlay disappears
- active call screen opens

Failure cases:

- call no longer ringing
- permission or media failure
- signaling offers were missing or delayed

### E. Declining an Incoming Call

Trigger:

- user presses Decline in the in-app overlay

Sequence:

1. overlay stops ringtone and calls `CallContext.declineCall(callId)`.
2. `CallContext` delegates to `callService.declineCall(callId)`.
3. `callService.declineCall(...)` updates Firestore:
   - `status: "declined"`
   - `endedAt`
   - `endReason: "declined"`
4. CallKeep is informed via `reportEndCall`.
5. `callService` emits `call_ended`.
6. `CallContext` clears call UI state.

Failure cases:

- doc missing
- auth missing

Important caveat:

- when the user ends an unanswered incoming call from native CallKeep UI, `callKeepService` routes that action to `callService.endCall(...)`, not `declineCall(...)`
- that means native-UI decline semantics are likely recorded as a normal ended/completed call instead of a decline

### F. Outgoing Call After the Remote Party Answers

Intended behavior:

- caller should transition from ringing to connected
- caller should start duration timer
- caller should see up-to-date call status

What the current code actually does:

- the answering device emits `call_answered` locally
- the caller-side `callService.subscribeToCall(...)` does not emit any event when the remote side changes the call to `connected`
- the caller-side `CallContext.currentCall` therefore remains whatever object was set during `call_started`, usually `status: "ringing"`
- `isConnected` can still become true because `webRTCService` fires connection-state callbacks

Observed impact:

- caller-side UI can have a live remote stream but stale `currentCall.status`
- caller-side duration timer may never start
- participant fields inside `currentCall.participants` do not stay current

### G. Starting a Group Call

Trigger:

- user opens group chat and chooses Audio Call or Video Call from `GroupChatScreen`

Sequence:

1. `GroupChatScreen` checks `CALL_FEATURES.CALLS_ENABLED` and platform support.
2. It gathers all member ids except the current user.
3. It lazily loads `groupCallService` and calls `startGroupCall(groupId, groupName, memberIds, type)`.
4. `groupCallService.startGroupCall(...)`:
   - validates participant count
   - builds group participant map with caller as host
   - writes `Calls/{callId}` with `scope: "group"` and `status: "ringing"`
   - writes `Calls/{callId}/Settings/config`
   - stores `currentGroupCallId`
   - subscribes to the group call doc
   - initializes `webRTCService`
   - starts outgoing CallKeep UI
   - emits `call_started`
5. `GroupChatScreen` navigates to `GroupCall`.

Important current-state issue:

- `CallContext` does not subscribe to `groupCallService`
- `GroupCallScreen` still reads `CallContext.currentCall`
- so the main group screen is not actually connected to the service that started the group call

Related issue:

- `groupCallService.startGroupCall(...)` never sets `answeredAt`
- later group duration logic depends on `answeredAt`

### H. Joining an Existing Group Call

Intended owner:

- `groupCallService.joinGroupCall(callId)`

Sequence inside that service:

1. validate call exists
2. reject locked calls
3. enforce participant cap
4. fetch current user profile and group-call settings
5. add/update local participant entry and `participantUids`
6. set call `status: "connected"`
7. initialize `webRTCService`
8. create offers to all existing connected participants
9. process pending signals
10. mark participant connection state `connected`
11. emit `participant_joined`

What is actually wired for incoming calls:

- incoming call detection is still owned by generic `callService`
- `IncomingCallOverlay.answer()` always calls `CallContext.answerCall()`
- `CallContext.answerCall()` always calls `callService.answerCall()`
- overlay navigation always chooses `AudioCall` or `VideoCall`

Result:

- incoming group calls do not have a dedicated path into `groupCallService.joinGroupCall()`
- incoming group calls are effectively treated like 1:1 calls by the answer flow

### I. Active Group Call Screen Behavior

Current runtime composition:

- participant roster and host state come from `useGroupCallParticipants` directly from Firestore
- media streams come from polling `webRTCService`
- top-level call status, duration start condition, and reconnect label still rely on `CallContext`

Observed consequence:

- the screen mixes three state sources that are not guaranteed to stay aligned

### J. Switching App State During a Call

On Android:

1. `CallContext` watches `AppState`
2. when the app backgrounds and `currentCall` exists, it calls `foregroundServiceManager.startService(...)`
3. when the app returns active and there is no active call, it stops the service

Current limitation:

- `foregroundServiceManager` does not actually talk to a native foreground-service module
- it is effectively a placeholder wrapper around intended behavior

### K. Reconnection Flow

There are two overlapping reconnection mechanisms:

#### `webRTCService` per-peer reconnection

- triggered by RTCPeerConnection `connectionstatechange`
- on `failed` or `disconnected`, closes and recreates the peer connection and sends a new offer
- max 3 attempts per peer

#### `callReconnectionService` app/network monitor

- triggered by `CallContext.handleConnectionLost()`
- watches NetInfo and app state
- emits reconnect UI callbacks
- `performReconnection()` is mostly simulated placeholder logic

Observed risk:

- reconnect ownership is duplicated
- one layer actually recreates peer connections
- the other layer mostly drives UI and eventual forced end-call behavior

### L. Ending a 1:1 Call

Trigger:

- local end-call button
- remote participant ends
- timeout
- failure path

Local sequence:

1. UI calls `CallContext.endCall()`
2. `CallContext` delegates to `callService.endCall(...)`
3. `callService.endCall(...)` updates Firestore:
   - `status: "ended"`
   - `endedAt`
   - `endReason: "completed"`
   - `duration`
4. CallKeep is ended
5. `callService` emits `call_ended`
6. `CallContext` resets local UI state and streams
7. `webRTCService.cleanup()` stops tracks, closes PCs, clears signaling state

Remote sequence:

- remote `callService.subscribeToCall(...)` sees a terminal status and emits `call_ended`

### M. Missed and Timeout Flow

There are two timeout owners:

- caller-side local timeout in `callService.startCallTimeout(...)`
- backend scheduled timeout in `handleCallTimeouts`

Local timeout behavior:

- after 30 seconds, if call still `ringing`, mark `missed`, emit `call_ended`, and clean up

Backend timeout behavior:

- every minute, query stale ringing calls older than 30 seconds and mark them missed

Observed risk:

- timeout ownership is duplicated
- whichever wins first updates the doc; the other path then sees an already-terminal state

### N. Cleanup After Call Completion

Client cleanup:

- clear timeout
- unsubscribe from current call doc
- stop signaling subscription
- send best-effort `bye`
- stop local and remote tracks
- clear peer connection maps
- reset UI state

Backend cleanup:

- `onCallUpdated` records per-user call history when a call becomes terminal
- scheduled signaling cleanup removes stale signaling docs after 24 hours
- account deletion redacts/removes call-related records

## 7. UI/UX Behavior

### DM Entry

- `ChatScreen` renders `CallButtonGroup` in the header
- users can start audio or video directly from the DM header

### Group Entry

- `GroupChatScreen` opens an alert with Audio Call and Video Call options
- group calls are started from there, not from `useCall.startGroupCall()`

### Profile Entry

- `UserProfileScreen` exposes a Call button for friends
- current handler navigates to `AudioCall` without first creating a call session
- this path does not match the rest of the runtime and looks stale

### Incoming Call UX

- `IncomingCallOverlay` is a global full-screen overlay
- shows caller avatar, caller name, and audio/video label
- plays ringtone and vibration through `ringtoneService`
- Accept/Answer routes into active-call screens
- Decline ends the ringing UI and updates Firestore

### Audio Call UX

- avatar-centric UI
- status text is derived from `call.status`
- controls: mute, speaker, end
- screen auto-dismisses when there is no current/incoming call and no connect in progress

### Video Call UX

- remote feed fullscreen when available
- local feed picture-in-picture
- avatar fallback when remote video is absent
- quality indicator shown when connected and not reconnecting
- held-calls banner if `CallContext.heldCalls` contains entries
- back button only navigates back; it does not end the call by itself

### Group Call UX

- grid and speaker layouts
- participant count and raised-hand banner
- participant management overlay with host/co-host actions
- host gets "Leave Only" vs "End for All"
- invite-more button is currently placeholder-only
- stream updates are polled every second rather than event-driven

### Permissions Messaging

- unsupported platform alerts explain that calls require a development build
- media permission failures are converted into user-readable errors in `webRTCService`
- permission strings are defined in `app.config.ts`

### Reconnecting and Quality States

- reconnect labels exist in video and group screens
- quality indicator component exists
- however, no live emitter of `network_quality_changed` was found, so network quality is likely often `unknown`

### Audio vs Video Differences

- video path enables camera and camera-switch controls
- audio path uses avatar UI only
- audio session is intended to default to earpiece for audio and speaker for video

## 8. Signaling / Realtime / Media Behavior

### Signaling Ownership

Signaling is entirely client-driven and Firestore-backed.

- offers, answers, ICE candidates, and bye events are written directly by clients
- recipients subscribe to signaling docs addressed to them
- processed docs are deleted by the recipient

There is no dedicated signaling server.

### Room / Session Lifecycle

The `Calls/{callId}` document is the session record. It serves as:

- the discoverable call/session descriptor
- participant roster
- status machine
- source of push-trigger creation

There is no separate room entity for active media beyond the call doc.

### Peer Connection Topology

`webRTCService` creates one `RTCPeerConnection` per remote participant.

That means group calls are full-mesh.

Implications:

- complexity grows per participant
- bandwidth and CPU costs grow quickly
- max participants are capped at 8, but this is still much heavier than an SFU-based design

### ICE / STUN / TURN

Default ICE config starts with Google STUN servers.

At call init:

- `webRTCService` calls backend `getTurnCredentials`
- backend currently returns STUN-only config with comments saying TURN integration is TODO

So the current live system is functionally STUN-only unless some external, uninspected deployment has changed behavior.

Practical implication:

- NAT traversal will be fragile on symmetric NAT / restrictive mobile networks

### Media Initialization

`webRTCService.initialize(...)` performs:

- TURN fetch
- permission request
- local stream creation
- signaling subscription

Local media constraints include:

- audio echo cancellation
- audio noise suppression
- auto gain control
- video ideal 1280x720 at 30 fps
- default front camera

### Remote Media Handling

- `track` events create or update a `MediaStream` per remote participant id
- `remoteStreams` are stored in a `Map<userId, MediaStream>`
- `CallContext` updates its own `remoteStreams` state from WebRTC callbacks

### Renegotiation and Reconnect

Supported in code:

- new offer creation
- answer handling
- ICE candidate add
- `restartIce(...)`
- reconnection via peer recreation and re-offer

Not clearly wired:

- any higher-level renegotiation policy beyond failure recovery
- adaptive bitrate applying live quality policies to actual runtime peers

### Audio Routing

Speaker toggling spans multiple layers:

- `webRTCService.toggleSpeaker()` only flips a boolean
- `callService.toggleSpeaker()` then routes through `callKeepService.setAudioRoute(...)`
- `audioSessionService` also abstracts route changes via CallKeep

This means the real native route owner is CallKeep, not WebRTC.

### Teardown

On cleanup, `webRTCService`:

- sends best-effort `bye` messages
- unsubscribes from signaling
- closes all peer connections
- stops all local and remote tracks
- clears peer, stream, signal, and reconnect state

## 9. Backend / Server / Cloud Functions Review

### Active Exported Backend Pieces

The deployed/exported call backend surface in `firebase-backend/functions/src/index.ts` is:

- `onCallCreated`
- `onCallUpdated`
- `handleCallTimeouts`
- `cleanupCallSignaling`
- `getTurnCredentials`

### `onCallCreated`

Responsibility:

- send incoming-call push notifications to all non-caller participants when a `Calls/{callId}` doc is created

Behavior:

- reads recipient `Users/{uid}` docs
- expects `fcmToken` and `platform`
- sends iOS alert-style APNs-over-FCM payloads and Android high-priority FCM payloads

### `onCallUpdated`

Responsibility:

- detect terminal call states
- send call-cancelled notification
- record per-user call history

Behavior:

- terminal states include `ended`, `declined`, `missed`, `failed`, `cancelled`
- when a call transitions into a terminal state, it:
  - sends cancel notifications
  - records history
- then, separately, if `before.status === "ringing"` and `isTerminal`, it sends cancel notifications again

Observed issue:

- terminal transitions from `ringing` can trigger duplicate cancel notifications

### `handleCallTimeouts`

Responsibility:

- scheduled missed-call enforcement

Behavior:

- runs every minute
- marks stale ringing calls older than 30 seconds as `missed`

### `cleanupCallSignaling`

Responsibility:

- scheduled garbage collection of old `Signals` docs

Behavior:

- runs every hour
- deletes signaling docs older than 24 hours

### `getTurnCredentials`

Responsibility:

- authenticated callable for ICE server config

Behavior:

- currently returns STUN servers only
- contains comments for future TURN provider integration

### Non-Exported Call Backend Code

`firebase-backend/functions/src/calls.ts` also contains:

- `registerVoIPToken`
- `sendCallNotification`
- `cancelCall`
- `onGroupCallInviteCreated`
- `onGroupCallParticipantJoined`
- `onGroupCallHostAction`

These functions are not exported from `functions/src/index.ts`, so they are not part of the active deployed surface described by this repo snapshot.

This matters because:

- some group-invite backend behavior exists in source but not in deployment exports
- one of the non-exported helper paths still uses an older FCM + VoIP-header approach that conflicts with the active `buildCallNotification()` strategy

### Backend Enforcement That Is Not Present

No visible backend call-creation enforcement was found for:

- friend-only calling
- block relationships
- user privacy `allowCalls`
- local DND/call settings

Firestore rules restrict who may read or modify call data, but they do not implement higher-level calling policy.

## 10. Notifications and App Integration

### General App Notification System

The app's general notification flow uses:

- `expo-notifications`
- `registerForPushNotifications()`
- `savePushToken()`
- `AuthContext` listeners for received/tapped notifications

That system stores `expoPushToken`, not `fcmToken`.

### Call Notification System

The call backend expects:

- `Users/{uid}.fcmToken`
- optionally `Users/{uid}.voipToken`

Within the inspected client code:

- no writer for `fcmToken` was found
- no React Native Firebase Messaging integration was found
- no live PushKit registration package was found

So the current repo shows a transport mismatch between:

- how the app registers for general notifications
- how the call backend expects to deliver call notifications

This is one of the biggest practical risks in the system.

### Incoming Call Payload Handling

The repo contains two intended call-payload handlers:

- `backgroundCallHandler`
- `voipPushService`

But the inspected app bootstrap did not show:

- FCM foreground message wiring
- FCM background message wiring
- PushKit native event wiring

### Notification Taps and Deep Links

`AuthContext` uses `normalizeNotificationPayload(...)` to interpret tapped notifications.

That normalizer handles:

- messages
- friend requests
- games
- achievements
- gifts

It does not handle:

- `incoming_call`
- `call_cancelled`
- `group_call_invite`

So the generic app-notification tap flow is not call-aware.

### Android Channels

There are two separate channel stories:

- `src/services/notifications.ts` really creates:
  - `vibe-incoming-calls`
  - `vibe-group-calls`
- `src/services/calls/backgroundCallHandler.ts` also exposes `createCallNotificationChannel()`, but that function is a placeholder that only logs

The actual useful channel creation for incoming-call notifications therefore lives in the general notification service, not in the call bootstrap helper that `App.tsx` invokes.

### Chat / DM / Group Integration

- DM calling is integrated into the chat header and is the clearest user-facing entry point.
- Group calling starts from group chat, but its runtime is separate from the main call context.
- No clear first-class navigation entry point into Call History or Call Settings was found.

### Presence / Availability

The app has a broader presence system used for online/last-seen display, but the call system itself does not currently use presence to determine:

- whether a user is available
- whether a call should be blocked
- whether an incoming call should be auto-suppressed

### Privacy / Blocking / Friendship

Relevant logic exists elsewhere in the repo:

- `src/types/userProfile.ts` has `canCallUser(...)`
- `src/services/blocking.ts` has `hasBlockBetweenUsers(...)`
- `callSettingsService` has `shouldAllowCall(...)`

But the active call start/receive runtime does not call those checks.

## 11. Platform and Dependency Notes

### Platform Support

Calls are only intended for native builds.

- web: no-op stubs / unavailable screens
- Expo Go: unsupported because native modules are unavailable
- native dev/standalone build: expected runtime

### Important Dependencies Present

- `react-native-webrtc`
- `react-native-callkeep`
- `expo-notifications`
- `expo-network`
- `expo-device`
- `firebase`

### Important Dependencies Missing or Mismatched

- no `@react-native-community/netinfo` in the main app dependencies, though `callReconnectionService` tries to require it
- no `react-native-voip-push-notification`
- no React Native Firebase Messaging package
- `ringtoneService` expects optional `expo-av`, while the app depends on `expo-audio`

### Config and Permission Assumptions

`app.config.ts` declares:

- iOS camera and microphone permission text
- iOS background modes: `audio`, `voip`, `remote-notification`, `fetch`
- iOS URL scheme `vibe-call`
- Android camera, audio, telecom, bluetooth, foreground-service, vibration, and wake permissions

These config declarations are necessary, but they do not prove that the native runtime path is fully implemented.

### Native Project Visibility

- Android project exists in the repo snapshot.
- No iOS project directory is present.
- No custom native call/push integration code was identified from the inspected JS side.

### Group-Call Scaling Assumption

The system assumes:

- max 8 group participants
- full-mesh WebRTC

That is suitable only for small rooms.

## 12. Strengths of the Current System

- The type model in `src/types/call.ts` is broad and gives the system a reasonably clear vocabulary.
- The 1:1 client path has a readable division of responsibility: UI -> `CallContext` -> `callService` -> `webRTCService`/`callKeepService`.
- Firestore rules for calls and signaling are participant-aware and reasonably strict for a client-driven signaling architecture.
- `webRTCService` handles several important implementation details well:
  - permission requests
  - local-stream setup
  - signaling dedupe
  - best-effort cleanup
  - basic connection stats
- `CallKeepService` is wrapped cleanly enough that native telephony UI concerns are mostly isolated.
- `CallHistoryService` and `CallSettingsService` are solid standalone modules even though they are not deeply integrated.
- Account deletion cleanup includes call data, signaling, invites, analytics, and quality reports, which shows lifecycle awareness beyond the happy path.

## 13. Weaknesses / Risks / Technical Debt

### 1. Notification token transport is inconsistent

The clearest systemic risk is that general push registration stores `expoPushToken`, while the call backend reads `fcmToken`. No code in the inspected client writes `fcmToken`, and no RN Firebase Messaging integration was found. If that reading is accurate, incoming call pushes may be unable to reach devices through the currently documented path.

### 2. Background call handling is present in theory but not fully wired

`backgroundCallHandler` and `voipPushService` exist, but the app bootstrap does not wire them to real FCM/PushKit delivery callbacks. The call bootstrap helper that runs in `App.tsx` mostly initializes shells and placeholders.

### 3. Group-call runtime is split from the main call context

Outgoing group calls are started by `groupCallService`, but `CallContext` only subscribes to `callService`. `GroupCallScreen` then mixes `useGroupCallParticipants`, direct `webRTCService` polling, and `CallContext.currentCall`. This creates a structurally fragile group-call experience.

### 4. Incoming group-call flow appears to route through the 1:1 answer path

Incoming call detection is owned by `callService`, and `IncomingCallOverlay` always answers via `callService.answerCall()` and navigates to `AudioCall` or `VideoCall`. There is no dedicated incoming-group-call path into `groupCallService.joinGroupCall()` or `GroupCallScreen`.

### 5. `CallContext.currentCall` is not a live reflection of the Firestore call doc

`currentCall` is only refreshed on selected events. The caller side in particular does not receive a `call_answered` event when the remote party answers. As a result:

- caller-side `call.status` can remain `ringing`
- duration timers can stay wrong
- participant mute/video/connection flags can become stale

### 6. Native CallKeep end actions are semantically ambiguous

`CallKeepService.onEndCall` always calls `callService.endCall()`. For unanswered incoming calls, that is not the same as a decline. This means native decline/cancel behavior can be recorded incorrectly.

### 7. Reconnection ownership is duplicated

`webRTCService` performs real peer reconnection attempts, while `callReconnectionService` separately monitors network/app state and simulates a reconnection process. This duplication makes the system harder to reason about and easier to desynchronize.

### 8. TURN is not actually configured

The backend `getTurnCredentials` callable currently returns STUN servers only. This makes connection reliability much weaker on restrictive networks and mobile NAT conditions.

### 9. Feature flags are mostly not enforced at their own granularity

The codebase declares many call flags:

- group calls
- history
- settings
- analytics
- missed badge
- quality indicator
- rollout percentage

But the runtime mostly keys off `CALLS_ENABLED` alone. `PERCENTAGE_ROLLOUT_ENABLED` and `ROLLOUT_PERCENTAGE` are declared yet not applied in the inspected runtime.

### 10. Several adjacent modules are effectively scaffolding, not production-integrated runtime

This includes:

- `callAnalyticsService`
- `adaptiveBitrateService`
- `concurrentCallManager`
- `foregroundServiceManager`
- `batteryOptimizationHandler`
- `voipPushService`
- parts of `backgroundCallHandler`

They are valuable design intent, but they should not be mistaken for fully live behavior.

### 11. Privacy, friendship, block, and DND logic are not enforced in active call flow

The repo contains policy logic for:

- profile-level call privacy
- block relationships
- call settings DND/privacy

But `CallButton`, `callService.startCall`, and the backend call creation path do not visibly enforce those policies.

### 12. There are redundant or stale responsibilities

- `callService.getCallHistory()` is a stub, while `callHistoryService` is the real implementation
- group state lives partly in `groupCallService`, partly in `useGroupCallParticipants`, and partly in screen-local state
- audio routing is spread across WebRTC, CallKeep, and `audioSessionService`

### 13. Call history redial has a group-scope ambiguity

`CallHistoryScreen` redial uses `entry.callId` as `conversationId` for non-DM entries, which does not obviously map back to the original group conversation id.

### 14. Profile-screen call entry looks stale

The profile call button navigates into `AudioCall` with `recipientId` and `recipientName`, but `AudioCallScreen` expects `callId`. That strongly suggests a dead or incomplete path.

### 15. Observability is scattered

There is extensive logging, but:

- analytics is not integrated
- quality reporting is not live
- there is no single authoritative event stream for call state transitions
- multi-layer reconnect logic makes debugging harder

## 14. Legacy / Deprecated / Suspicious Areas

- `docs/QA_CALL_SYSTEM_AUDIT.md` is historical and references earlier bug-fix work; it should not be treated as the current source of truth.
- `firebase-backend/functions/src/calls.ts` contains a second tier of non-exported functions that look like older or unfinished call infrastructure.
- `sendCallNotification` in that non-exported section still references the older VoIP-header approach that the active notification builder explicitly says was wrong.
- `UserProfileScreen` call entry is suspicious and likely stale.
- `useCall.startGroupCall()` and `GroupChatScreen.handleStartGroupCall()` use different service paths for conceptually the same feature.
- `concurrentCallManager` is mostly disconnected from the live call-service path.
- `participantsSubscription` and `voiceActivityListeners` fields in `groupCallService` are present but not substantively populated in the inspected code.
- `adaptiveBitrateService` is feature-complete on paper but not connected to live peer lifecycle.
- `callService.getCallHistory()` is a stub duplicate of a real service.

## 15. Open Questions / Unclear Areas

- Is `fcmToken` written somewhere outside this repo or by native code not included here? The inspected JS client does not appear to write it.
- Are the non-exported functions in `firebase-backend/functions/src/calls.ts` intentionally undeployed, or is the export surface out of sync with intended behavior?
- Do deployed builds include native/background push wiring not visible in the repo snapshot?
- Are there hidden UI entry points to `CallHistory` and `CallSettings` that were not found by code search?
- Does the current Android native project contain generated manifest/service setup for calls that static grep did not clearly expose?
- Is incoming group calling currently expected to work, or is it knowingly incomplete?
- Was `docs/QA_CALL_SYSTEM_AUDIT.md` fully implemented and deployed, or does it partially describe fixes that may not match all active builds?

Where uncertainty exists above, it is because the missing piece depends on deployment state, native project files not present in the snapshot, or runtime infrastructure outside the repository.

## 16. Recommended Follow-Up Audits

- A notification transport audit that traces device-token creation, storage, backend lookups, delivery path, and tap handling specifically for calls
- A dedicated group-call runtime audit focused on entry, answer, state ownership, and on-device behavior
- A call-state synchronization audit for `CallContext`, `callService`, and active Firestore snapshot propagation during live calls
- A native integration audit covering CallKeep, background execution, audio session behavior, and Android foreground service implementation in generated/native projects
- A privacy/policy audit for block rules, friendship checks, DND, call privacy settings, and abuse prevention
- A testability/observability audit for logging, analytics, and reproducible call-failure diagnostics

## 17. Final System Summary

Today's call system is a Firestore-driven, client-signaled WebRTC stack with a reasonably complete 1:1 native call path, a much less integrated group-call path, and a large ring of adjacent modules that are present but not fully wired. The core live architecture is:

- UI entry point
- `CallContext`
- `callService`
- `webRTCService`
- `callKeepService`
- Firestore `Calls` + Firestore `CallSignaling`
- Cloud Functions for push, timeouts, history, and signaling cleanup

The main risks are not "missing features" so much as split ownership and mismatched assumptions:

- notification transport mismatch (`expoPushToken` vs `fcmToken`)
- incomplete background/push wiring
- stale caller-side call state
- incoming group calls falling through the wrong path
- heavy placeholder usage around native lifecycle, reconnection, analytics, and adaptive quality
- lack of enforcement for privacy/block/DND policy despite those rules existing elsewhere in the codebase

For future AI-assisted work, the safest mental model is:

- treat 1:1 calling as the primary live runtime
- treat group calling as a separate subsystem that is only partially joined to the primary runtime
- assume any module labeled for analytics, adaptive bitrate, battery optimization, foreground service, or VoIP push may express intended architecture more than currently reliable behavior
- verify notification delivery, group-call answer flow, and current-call state synchronization before making changes that depend on them
