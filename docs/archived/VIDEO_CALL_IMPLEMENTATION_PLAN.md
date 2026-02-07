# Real-Time Video & Phone Call Feature - Implementation Plan

> **Comprehensive plan for implementing voice/video calling in Vibe**
>
> **Status:** Planning  
> **Priority:** High (Vital Feature)  
> **Estimated Timeline:** 6-8 weeks

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Selection & Comparison](#2-technology-selection--comparison)
3. [Architecture Design](#3-architecture-design)
4. [Data Models & Firestore Schema](#4-data-models--firestore-schema)
5. [Implementation Phases](#5-implementation-phases)
6. [Native Configuration (iOS & Android)](#6-native-configuration-ios--android)
7. [Push Notifications & VoIP](#7-push-notifications--voip)
8. [Background Mode & CallKeep Integration](#8-background-mode--callkeep-integration)
9. [UI/UX Components](#9-uiux-components)
10. [Cloud Functions (Signaling Server)](#10-cloud-functions-signaling-server)
11. [Security & Privacy](#11-security--privacy)
12. [Testing Strategy](#12-testing-strategy)
13. [Future: In-Call Games Integration](#13-future-in-call-games-integration)
14. [Cost Analysis](#14-cost-analysis)
15. [Rollout Plan](#15-rollout-plan)

---

## 1. Executive Summary

### Goal

Implement seamless real-time voice and video calling for:

- **1:1 DM calls** (audio + video)
- **Group calls** (up to 8 participants initially)
- **Background mode support** (calls continue when app is minimized)
- **Native call UI integration** (iOS CallKit, Android ConnectionService)

### Key Requirements

| Requirement                     | Priority | Notes                                 |
| ------------------------------- | -------- | ------------------------------------- |
| 1:1 Audio Calls                 | P0       | Must have                             |
| 1:1 Video Calls                 | P0       | Must have                             |
| Group Audio Calls               | P1       | High priority                         |
| Group Video Calls               | P1       | High priority                         |
| Background Audio                | P0       | Must work when app tabbed out         |
| Native Call UI                  | P0       | CallKit/ConnectionService integration |
| Push Notifications for Incoming | P0       | Wake app from killed state            |
| Screen Sharing                  | P2       | Future enhancement                    |
| In-Call Games                   | P3       | Future phase                          |

### Integration Points with Existing Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        VIBE ARCHITECTURE                         │
├──────────────────────────────────────────────────────────────────┤
│  Chat System (Existing)          Call System (New)               │
│  ┌─────────────────────┐         ┌─────────────────────┐        │
│  │ DMChatScreen        │ ──────▶ │ CallButton          │        │
│  │ GroupChatScreen     │         │ (Audio/Video)       │        │
│  └─────────────────────┘         └─────────────────────┘        │
│            │                              │                      │
│            ▼                              ▼                      │
│  ┌─────────────────────┐         ┌─────────────────────┐        │
│  │ Firestore           │         │ CallService         │        │
│  │ (messages)          │         │ (signaling/state)   │        │
│  └─────────────────────┘         └─────────────────────┘        │
│            │                              │                      │
│            ▼                              ▼                      │
│  ┌─────────────────────┐         ┌─────────────────────┐        │
│  │ Cloud Functions     │         │ WebRTC/100ms/Stream │        │
│  │ (sendMessage)       │         │ (media transport)   │        │
│  └─────────────────────┘         └─────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Selection & Comparison

### ✅ CHOSEN: WebRTC (react-native-webrtc)

**Packages:**

- `react-native-webrtc` - WebRTC implementation (4.9k stars, actively maintained)
- `react-native-callkeep` - Native call UI (iOS CallKit + Android ConnectionService)
- `react-native-voip-push-notification` - iOS VoIP push support
- Firestore for signaling (leverages existing infrastructure)

**Why WebRTC:**

- ✅ **Zero per-minute costs** - No usage-based billing
- ✅ **Full control** - Own your infrastructure and data
- ✅ **Scalable** - Cost stays flat as usage grows
- ✅ **Works with Expo** - Via expo-dev-client
- ✅ **Data channels** - Perfect for future in-call games
- ✅ **Industry standard** - Same tech as Discord, Google Meet, etc.
- ✅ **No vendor lock-in** - Open protocol

**Infrastructure Required:**

- STUN servers (free via Google)
- TURN server (~$50-100/month via Twilio or Xirsys)
- Firestore for signaling (existing infrastructure)

**Cost:** ~$50-100/month for TURN server (scales well)

---

### Alternative Considered: Stream Video SDK

**Packages:**

- `@stream-io/video-react-native-sdk`
- Built-in CallKeep integration

**Pros:**

- ✅ Faster initial implementation
- ✅ Built-in UI components
- ✅ Managed infrastructure

**Cons:**

- ❌ **Paid service** ($0.004/min for video) - costs explode at scale
- ❌ **Vendor lock-in** - harder to migrate later
- ❌ **Less control** - can't customize media pipeline
- ❌ **No data channels** - harder to add in-call games

**Why Not Chosen:** At 100K users with 1.5M minutes/month, Stream would cost ~$6,500/month vs WebRTC's ~$500/month

---

### Alternative Considered: 100ms SDK

**Packages:**

- `@100mslive/react-native-hms`
- `@100mslive/react-native-room-kit` (prebuilt UI)

**Pros:**

- ✅ Excellent Expo support
- ✅ Prebuilt room kit for fast implementation
- ✅ Good free tier (10K minutes/month)

**Cons:**

- ❌ Still has per-minute costs
- ❌ Vendor lock-in

**Why Not Chosen:** Same per-minute cost issues as Stream at scale

---

### Alternative Considered: Agora

**Pros:**

- ✅ Industry standard, very reliable
- ✅ Global infrastructure

**Cons:**

- ❌ Most expensive option
- ❌ Complex pricing
- ❌ Vendor lock-in

**Why Not Chosen:** Most expensive of the managed options

---

### **DECISION: WebRTC with Firestore Signaling**

**Implementation Stack:**

```
react-native-webrtc          # Core WebRTC implementation
react-native-callkeep        # iOS CallKit + Android ConnectionService
react-native-voip-push-notification  # iOS VoIP push
Firestore                    # Signaling server (existing infra)
Twilio TURN                  # NAT traversal ($50-100/mo)
```

**Advantages of This Approach:**

1. **Cost-effective at scale** - Flat infrastructure cost regardless of usage
2. **Full ownership** - Control over quality, features, and data
3. **Future-proof** - Data channels enable in-call games later
4. **Leverages existing infra** - Uses your Firestore for signaling
5. **No migration needed** - Build it right the first time

---

## 3. Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React Native)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │ CallContext  │   │ CallService  │   │ CallKeep     │                │
│  │ (React)      │◀─▶│ (Business)   │◀─▶│ Integration  │                │
│  └──────────────┘   └──────────────┘   └──────────────┘                │
│         │                  │                  │                          │
│         ▼                  ▼                  ▼                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │ UI Screens   │   │ WebRTC      │   │ Native Call  │                │
│  │ - Incoming   │   │ Service     │   │ UI (iOS/And) │                │
│  │ - InCall     │   │ (Peer Conn) │   │ CallKeep     │                │
│  │ - Outgoing   │   └──────────────┘   └──────────────┘                │
│  └──────────────┘          │                                            │
│                            ▼                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                           FIREBASE BACKEND                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │ Firestore    │   │ Cloud        │   │ FCM / APNs   │                │
│  │ Calls/{id}   │   │ Functions    │   │ Push Notif   │                │
│  │ Signaling/   │   │ - notify     │   │ - VoIP push  │                │
│  │ {callId}     │   │ - cleanup    │   │ - Data push  │                │
│  └──────────────┘   └──────────────┘   └──────────────┘                │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                        WEBRTC MEDIA INFRASTRUCTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────┐               │
│  │              Peer-to-Peer Media (WebRTC)              │               │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │               │
│  │  │ Google     │  │ Twilio     │  │ Data       │     │               │
│  │  │ STUN (free)│  │ TURN ($)   │  │ Channels   │     │               │
│  │  └────────────┘  └────────────┘  └────────────┘     │               │
│  └──────────────────────────────────────────────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Call State Machine

```
                    ┌─────────────┐
                    │   IDLE      │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │ OUTGOING  │  │ INCOMING  │  │ MISSED    │
    │ (ringing) │  │ (ringing) │  │           │
    └─────┬─────┘  └─────┬─────┘  └───────────┘
          │              │
          │   ┌──────────┼──────────┐
          │   │          │          │
          ▼   ▼          ▼          ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │ CONNECTED │  │ DECLINED  │  │ NO_ANSWER │
    │           │  │           │  │           │
    └─────┬─────┘  └───────────┘  └───────────┘
          │
          ▼
    ┌───────────┐
    │  ENDED    │
    └───────────┘
```

---

## 4. Data Models & Firestore Schema

### Call Document (`Calls/{callId}`)

```typescript
// src/types/call.ts

export type CallType = "audio" | "video";
export type CallScope = "dm" | "group";
export type CallStatus =
  | "ringing" // Call initiated, waiting for answer
  | "connecting" // Call accepted, establishing connection
  | "connected" // Active call
  | "ended" // Call ended normally
  | "declined" // Recipient declined
  | "missed" // No answer within timeout
  | "failed"; // Technical failure

export interface CallParticipant {
  odId: string;
  odname: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  joinedAt: number | null; // null = invited but not joined
  leftAt: number | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  connectionState: "connecting" | "connected" | "disconnected";
}

export interface Call {
  id: string;
  scope: CallScope;
  conversationId: string; // Chat ID or Group ID (links to existing conversation)
  type: CallType;
  status: CallStatus;

  // Participants
  callerId: string; // Who initiated the call
  callerName: string;
  participants: Record<string, CallParticipant>;

  // Timing
  createdAt: number;
  answeredAt: number | null;
  endedAt: number | null;

  // Call metadata
  endReason?: "completed" | "declined" | "missed" | "failed" | "busy";
  duration?: number; // In seconds (calculated on end)

  // Stream/WebRTC specific
  roomId?: string; // External room ID from Stream/WebRTC

  // For group calls
  maxParticipants?: number; // Limit for group calls
}

// Call history entry (denormalized for faster queries)
export interface CallHistoryEntry {
  callId: string;
  odId: string; // Participant user ID
  otherParticipants: {
    odId: string;
    displayName: string;
  }[];
  type: CallType;
  scope: CallScope;
  status: CallStatus;
  direction: "incoming" | "outgoing";
  createdAt: number;
  duration: number | null;
  wasAnswered: boolean;
}
```

### Firestore Collections

```
Firestore
├── Calls/{callId}
│   ├── id: string
│   ├── scope: 'dm' | 'group'
│   ├── conversationId: string
│   ├── type: 'audio' | 'video'
│   ├── status: CallStatus
│   ├── callerId: string
│   ├── callerName: string
│   ├── participants: { [odId]: CallParticipant }
│   ├── createdAt: timestamp
│   ├── answeredAt: timestamp | null
│   ├── endedAt: timestamp | null
│   ├── endReason: string
│   └── roomId: string (external SDK room)
│
├── Users/{odId}/CallHistory/{callId}   // Denormalized for fast queries
│   ├── callId: string
│   ├── direction: 'incoming' | 'outgoing'
│   ├── type: 'audio' | 'video'
│   ├── otherParticipants: array
│   ├── createdAt: timestamp
│   ├── duration: number
│   └── wasAnswered: boolean
│
└── CallSignaling/{callId}/Signals/{signalId}  // WebRTC only
    ├── type: 'offer' | 'answer' | 'ice-candidate'
    ├── from: string (odId)
    ├── to: string (odId)
    ├── payload: object
    └── createdAt: timestamp
```

### Firestore Security Rules Addition

```javascript
// Add to firebase-backend/firestore.rules

// Call documents - participants can read, only caller can create
match /Calls/{callId} {
  allow read: if request.auth != null &&
    request.auth.uid in resource.data.participants;

  allow create: if request.auth != null &&
    request.auth.uid == request.resource.data.callerId;

  allow update: if request.auth != null &&
    request.auth.uid in resource.data.participants;

  allow delete: if false; // Never delete, use status
}

// Call history - users can only read/write their own
match /Users/{odId}/CallHistory/{callId} {
  allow read, write: if request.auth != null &&
    request.auth.uid == odId;
}

// WebRTC signaling - participants only
match /CallSignaling/{callId}/Signals/{signalId} {
  allow read, write: if request.auth != null;
  // More restrictive: check if user is in parent call doc
}
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Core infrastructure and 1:1 audio calls

```
Week 1:
├── Day 1-2: Project setup
│   ├── Install react-native-webrtc, react-native-callkeep
│   ├── Install react-native-voip-push-notification (iOS)
│   ├── Configure Expo dev client (required for native modules)
│   ├── Add native permissions (iOS/Android)
│   ├── Setup Twilio TURN server account
│   └── Create Call types and interfaces
│
├── Day 3-4: Call service layer
│   ├── Create CallService singleton
│   ├── Implement Firestore call document CRUD
│   ├── Create CallContext provider
│   └── Add call state machine
│
└── Day 5: Basic UI
    ├── Create CallButton component
    ├── Add to DMChatScreen header
    └── Create minimal InCallScreen

Week 2:
├── Day 1-2: WebRTC integration
│   ├── Create WebRTCService with RTCPeerConnection
│   ├── Configure ICE servers (STUN + TURN)
│   ├── Implement Firestore signaling (offer/answer/ICE)
│   ├── Handle getUserMedia for audio
│   └── Test basic peer-to-peer audio flow
│
├── Day 3-4: Call lifecycle
│   ├── Initiate outgoing call
│   ├── Receive incoming call (foreground)
│   ├── Accept/decline call
│   ├── End call
│   └── Handle call timeout (30s)
│
└── Day 5: Polish & testing
    ├── Audio quality testing
    ├── Error handling
    └── Basic analytics events
```

### Phase 2: Video & Native Integration (Week 3-4)

**Goal:** Video calls + CallKeep for background

```
Week 3:
├── Day 1-2: Video implementation
│   ├── Add video track management
│   ├── Create VideoCallScreen
│   ├── Implement camera toggle
│   ├── Add video preview (local)
│   └── Remote video rendering
│
├── Day 3-4: CallKeep integration
│   ├── Install react-native-callkeep
│   ├── Configure iOS CallKit
│   ├── Configure Android ConnectionService
│   ├── Handle native call events
│   └── Sync call state with native UI
│
└── Day 5: Background calls
    ├── Test app minimized scenarios
    ├── Handle audio session management
    └── Implement foreground service (Android)

Week 4:
├── Day 1-2: Push notifications
│   ├── Extend existing FCM setup
│   ├── Create call notification Cloud Function
│   ├── Handle notification tap to answer
│   └── iOS VoIP push (if using WebRTC)
│
├── Day 3-4: IncomingCallScreen
│   ├── Full-screen incoming call UI
│   ├── Accept/decline buttons
│   ├── Caller info display
│   └── Ringtone integration
│
└── Day 5: Testing & edge cases
    ├── Call while on another call
    ├── Network disconnection handling
    └── Battery optimization handling
```

### Phase 3: Group Calls (Week 5-6)

**Goal:** Multi-participant calls

```
Week 5:
├── Day 1-2: Group call data model
│   ├── Extend Call type for groups
│   ├── Participant management
│   ├── Add join/leave mid-call
│   └── Firestore triggers for participant changes
│
├── Day 3-4: Group call UI
│   ├── Grid layout for multiple videos
│   ├── Speaker view (highlight active)
│   ├── Participant list overlay
│   └── Invite more participants
│
└── Day 5: Group call features
    ├── Mute all participants (host)
    ├── Remove participant (host)
    └── Pin participant video

Week 6:
├── Day 1-2: Call from group chat
│   ├── Add call button to GroupChatScreen
│   ├── Notify all group members
│   ├── Handle partial joins
│   └── Show who's in call
│
├── Day 3-4: Call quality
│   ├── Implement adaptive bitrate
│   ├── Network quality indicator
│   ├── Auto-disable video on poor connection
│   └── Reconnection handling
│
└── Day 5: Testing
    ├── Test with 8 participants
    ├── Stress testing
    └── Performance profiling
```

### Phase 4: Polish & Launch (Week 7-8)

**Goal:** Production-ready

```
Week 7:
├── Day 1-2: Call history
│   ├── Recent calls screen
│   ├── Call from history
│   ├── Delete call history
│   └── Show missed calls badge
│
├── Day 3-4: Settings & preferences
│   ├── Default camera (front/back)
│   ├── Audio output selection
│   ├── Do not disturb schedule
│   └── Call ringtone selection
│
└── Day 5: Analytics & monitoring
    ├── Call quality metrics
    ├── Call success/failure rates
    ├── Duration analytics
    └── Error tracking

Week 8:
├── Day 1-3: QA & bug fixes
│   ├── Full test suite
│   ├── Device compatibility testing
│   ├── Accessibility review
│   └── Performance optimization
│
├── Day 4: Documentation
│   ├── User guide
│   ├── Technical documentation
│   └── Troubleshooting guide
│
└── Day 5: Staged rollout
    ├── Feature flag setup
    ├── Beta testing group
    └── Monitoring setup
```

---

## 6. Native Configuration (iOS & Android)

### iOS Configuration

#### app.json / app.config.ts

```typescript
// app.config.ts additions
export default {
  expo: {
    // ... existing config
    ios: {
      // ... existing ios config
      infoPlist: {
        // Camera & Microphone (may already exist)
        NSCameraUsageDescription: "Vibe needs camera access for video calls",
        NSMicrophoneUsageDescription: "Vibe needs microphone access for calls",

        // Background modes for calls
        UIBackgroundModes: [
          "audio", // Keep audio playing in background
          "voip", // VoIP calls
          "remote-notification", // Push notifications
          "fetch", // Background fetch
        ],

        // CallKit configuration
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["vibe-call"],
          },
        ],
      },
      entitlements: {
        // Push notification entitlement
        "aps-environment": "production",
        // VoIP entitlement (automatically added with voip background mode)
      },
    },
    plugins: [
      // Existing plugins...

      // WebRTC config plugin
      [
        "@config-plugins/react-native-webrtc",
        {
          cameraPermission: "Vibe needs camera access for video calls",
          microphonePermission: "Vibe needs microphone access for calls",
        },
      ],

      // CallKeep config plugin for native call UI
      [
        "@config-plugins/react-native-callkeep",
        {
          appName: "Vibe",
        },
      ],
    ],
  },
};
```

#### iOS Native Files (ios/Vibe/AppDelegate.mm)

```objective-c
// Add to imports
#import <PushKit/PushKit.h>
#import "RNCallKeep.h"
#import "RNVoipPushNotificationManager.h"

@interface AppDelegate () <PKPushRegistryDelegate>
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {

  // Existing code...

  // Setup CallKeep
  [RNCallKeep setup:@{
    @"appName": @"Vibe",
    @"maximumCallGroups": @3,
    @"maximumCallsPerCallGroup": @1,
    @"supportsVideo": @YES,
    @"ringtoneSound": @"ringtone.mp3"
  }];

  // Register for VoIP pushes
  [RNVoipPushNotificationManager voipRegistration];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// Handle VoIP push
- (void)pushRegistry:(PKPushRegistry *)registry
  didReceiveIncomingPushWithPayload:(PKPushPayload *)payload
  forType:(PKPushType)type
  withCompletionHandler:(void (^)(void))completion {

  // Process the push
  [RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload
    forType:(NSString *)type];

  // Extract call info from payload
  NSString *uuid = payload.dictionaryPayload[@"uuid"];
  NSString *callerName = payload.dictionaryPayload[@"callerName"];
  NSString *handle = payload.dictionaryPayload[@"handle"];
  BOOL hasVideo = [payload.dictionaryPayload[@"hasVideo"] boolValue];

  // Display incoming call immediately (required by iOS 13+)
  [RNCallKeep reportNewIncomingCall:uuid
                             handle:handle
                         handleType:@"generic"
                           hasVideo:hasVideo
                localizedCallerName:callerName
                    supportsHolding:YES
                       supportsDTMF:YES
                   supportsGrouping:YES
                 supportsUngrouping:YES
                        fromPushKit:YES
                            payload:payload.dictionaryPayload
              withCompletionHandler:completion];
}

@end
```

### Android Configuration

#### android/app/src/main/AndroidManifest.xml

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <!-- Permissions -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
  <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

  <!-- Foreground service for calls (Android 11+) -->
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />

  <!-- CallKeep / Connection Service -->
  <uses-permission android:name="android.permission.BIND_TELECOM_CONNECTION_SERVICE" />
  <uses-permission android:name="android.permission.READ_PHONE_STATE" />
  <uses-permission android:name="android.permission.CALL_PHONE" />
  <uses-permission android:name="android.permission.READ_CALL_LOG" />

  <!-- Vibration for incoming calls -->
  <uses-permission android:name="android.permission.VIBRATE" />

  <!-- Wake lock to keep screen on during calls -->
  <uses-permission android:name="android.permission.WAKE_LOCK" />

  <!-- Camera and audio features -->
  <uses-feature android:name="android.hardware.camera" android:required="false" />
  <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
  <uses-feature android:name="android.hardware.audio.output" android:required="false" />
  <uses-feature android:name="android.hardware.microphone" android:required="false" />

  <application
    android:name=".MainApplication"
    ...
    android:supportsRtl="true">

    <!-- Existing activities... -->

    <!-- CallKeep Connection Service -->
    <service
      android:name="io.wazo.callkeep.VoiceConnectionService"
      android:label="Vibe Call"
      android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
      android:foregroundServiceType="phoneCall|microphone|camera"
      android:exported="true">
      <intent-filter>
        <action android:name="android.telecom.ConnectionService" />
      </intent-filter>
    </service>

    <!-- Foreground service for ongoing calls -->
    <service
      android:name=".CallForegroundService"
      android:foregroundServiceType="phoneCall|microphone|camera"
      android:exported="false" />

    <!-- High-priority notification channel for incoming calls -->
    <!-- This is created programmatically in CallService -->

  </application>
</manifest>
```

#### android/app/build.gradle additions

```gradle
android {
    // ... existing config

    defaultConfig {
        // ... existing config

        // For WebRTC (if using)
        missingDimensionStrategy 'react-native-camera', 'general'
    }
}

dependencies {
    // ... existing dependencies

    // CallKeep
    implementation project(':react-native-callkeep')

    // WebRTC (if using react-native-webrtc)
    implementation 'org.webrtc:google-webrtc:1.0.32006'
}
```

---

## 7. Push Notifications & VoIP

### Push Notification Strategy

```
┌────────────────────────────────────────────────────────────────────┐
│                    INCOMING CALL NOTIFICATION FLOW                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Caller Device                    Firebase                         │
│  ┌──────────────┐                ┌──────────────┐                 │
│  │ Initiate     │ ──────────────▶│ Cloud        │                 │
│  │ Call         │  Create Call   │ Function:    │                 │
│  └──────────────┘  Document      │ onCallCreate │                 │
│                                   └──────┬───────┘                 │
│                                          │                         │
│                                          ▼                         │
│                                   ┌──────────────┐                 │
│                                   │ Get Recipient│                 │
│                                   │ FCM Token    │                 │
│                                   └──────┬───────┘                 │
│                                          │                         │
│           ┌──────────────────────────────┼─────────────────┐       │
│           │                              │                 │       │
│           ▼                              ▼                 ▼       │
│    ┌──────────────┐             ┌──────────────┐  ┌──────────────┐│
│    │ iOS: VoIP    │             │ iOS: Data    │  │ Android:     ││
│    │ Push (APNs)  │             │ Push (FCM)   │  │ High Priority││
│    │              │             │              │  │ FCM          ││
│    └──────┬───────┘             └──────┬───────┘  └──────┬───────┘│
│           │                            │                 │        │
│           ▼                            ▼                 ▼        │
│    ┌──────────────┐             ┌──────────────┐  ┌──────────────┐│
│    │ CallKit      │             │ App Launch   │  │ FCM Service  ││
│    │ Display      │             │ (Background) │  │ + CallKeep   ││
│    │ Incoming     │             │ + CallKeep   │  │              ││
│    └──────────────┘             └──────────────┘  └──────────────┘│
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Cloud Function: Send Call Notification

```typescript
// firebase-backend/functions/src/calls/sendCallNotification.ts

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Call } from "../types/call";

const db = admin.firestore();
const messaging = admin.messaging();

export const onCallCreated = functions.firestore
  .document("Calls/{callId}")
  .onCreate(async (snapshot, context) => {
    const call = snapshot.data() as Call;
    const { callId } = context.params;

    // Get all participants except caller
    const recipientIds = Object.keys(call.participants).filter(
      (uid) => uid !== call.callerId,
    );

    // Get FCM tokens for all recipients
    const tokenPromises = recipientIds.map(async (uid) => {
      const userDoc = await db.collection("Users").doc(uid).get();
      const userData = userDoc.data();
      return {
        uid,
        fcmToken: userData?.fcmToken,
        platform: userData?.platform || "ios",
      };
    });

    const recipients = await Promise.all(tokenPromises);

    // Send notifications
    const notificationPromises = recipients
      .filter((r) => r.fcmToken)
      .map(async (recipient) => {
        const message = buildCallNotification(call, callId, recipient);

        try {
          await messaging.send(message);
          console.log(`Call notification sent to ${recipient.uid}`);
        } catch (error) {
          console.error(
            `Failed to send call notification to ${recipient.uid}:`,
            error,
          );
        }
      });

    await Promise.all(notificationPromises);
  });

function buildCallNotification(
  call: Call,
  callId: string,
  recipient: { uid: string; fcmToken: string; platform: string },
) {
  const isVideo = call.type === "video";
  const callerName = call.callerName || "Unknown";

  // Base data payload
  const data = {
    type: "incoming_call",
    callId,
    callerId: call.callerId,
    callerName,
    callType: call.type,
    conversationId: call.conversationId,
    scope: call.scope,
    hasVideo: isVideo ? "true" : "false",
    uuid: callId, // Use callId as UUID for CallKeep
  };

  if (recipient.platform === "ios") {
    // iOS: Send both VoIP push (for CallKit) and data push
    return {
      token: recipient.fcmToken,
      data,
      apns: {
        headers: {
          "apns-push-type": "voip",
          "apns-priority": "10",
          "apns-topic": `${process.env.BUNDLE_ID}.voip`,
        },
        payload: {
          aps: {
            // VoIP pushes don't show notification, they wake app
            "content-available": 1,
          },
          // Custom payload for CallKit
          ...data,
        },
      },
    };
  } else {
    // Android: High priority data message
    return {
      token: recipient.fcmToken,
      data,
      android: {
        priority: "high" as const,
        ttl: 30000, // 30 seconds TTL for calls
        notification: {
          channelId: "vibe-incoming-calls",
          priority: "max" as const,
          visibility: "public" as const,
          title: isVideo ? "📹 Incoming Video Call" : "📞 Incoming Call",
          body: `${callerName} is calling...`,
          sound: "ringtone",
          // Full-screen intent for lock screen
          defaultSound: false,
          defaultVibrateTimings: false,
          vibrateTimingsMillis: [0, 500, 200, 500, 200, 500],
        },
        // Direct boot aware (works when device locked)
        directBootOk: true,
      },
    };
  }
}

// Call ended/declined - cancel notification
export const onCallEnded = functions.firestore
  .document("Calls/{callId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Call;
    const after = change.after.data() as Call;
    const { callId } = context.params;

    // If call transitioned to ended state
    if (
      before.status === "ringing" &&
      ["ended", "declined", "missed", "failed"].includes(after.status)
    ) {
      // Get all participants except caller
      const recipientIds = Object.keys(after.participants).filter(
        (uid) => uid !== after.callerId,
      );

      // Send cancel notification
      const tokenPromises = recipientIds.map(async (uid) => {
        const userDoc = await db.collection("Users").doc(uid).get();
        return userDoc.data()?.fcmToken;
      });

      const tokens = (await Promise.all(tokenPromises)).filter(Boolean);

      if (tokens.length > 0) {
        await messaging.sendEachForMulticast({
          tokens,
          data: {
            type: "call_cancelled",
            callId,
            reason: after.endReason || "cancelled",
          },
          android: {
            priority: "high",
          },
        });
      }
    }
  });
```

### iOS VoIP Push Setup

For iOS, you need to configure VoIP push certificates:

1. **Create VoIP Certificate** in Apple Developer Portal:
   - Go to Certificates, Identifiers & Profiles
   - Create new certificate → VoIP Services Certificate
   - Download and install in Keychain

2. **Export .p12 file** from Keychain Access

3. **Upload to Firebase**:
   - Firebase Console → Project Settings → Cloud Messaging
   - Upload APNs authentication key or certificate

4. **Configure Bundle ID** with .voip suffix in push topic

---

## 8. Background Mode & CallKeep Integration

### CallKeep Service

```typescript
// src/services/callKeepService.ts

import RNCallKeep from "react-native-callkeep";
import { Platform, AppState, AppStateStatus } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { Call, CallStatus } from "../types/call";

class CallKeepService {
  private static instance: CallKeepService;
  private isSetup = false;
  private activeCallId: string | null = null;

  // Callbacks to connect with CallService
  private onAnswerCall?: (callId: string) => void;
  private onEndCall?: (callId: string) => void;
  private onMuteCall?: (callId: string, muted: boolean) => void;
  private onHoldCall?: (callId: string, hold: boolean) => void;

  private constructor() {}

  static getInstance(): CallKeepService {
    if (!CallKeepService.instance) {
      CallKeepService.instance = new CallKeepService();
    }
    return CallKeepService.instance;
  }

  async setup() {
    if (this.isSetup) return;

    const options = {
      ios: {
        appName: "Vibe",
        imageName: "call_icon",
        supportsVideo: true,
        maximumCallGroups: "1",
        maximumCallsPerCallGroup: "1",
        ringtoneSound: "ringtone.mp3",
        includesCallsInRecents: true,
      },
      android: {
        alertTitle: "Permissions Required",
        alertDescription: "Vibe needs access to make and receive calls",
        cancelButton: "Cancel",
        okButton: "OK",
        imageName: "ic_call",
        // Foreground service for Android 11+
        foregroundService: {
          channelId: "vibe-call-channel",
          channelName: "Vibe Calls",
          notificationTitle: "Vibe call in progress",
          notificationIcon: "ic_call_notification",
        },
        selfManaged: false, // Use system-managed for better integration
      },
    };

    try {
      await RNCallKeep.setup(options);
      this.registerEventListeners();
      this.isSetup = true;

      // Mark device as available for calls
      if (Platform.OS === "android") {
        RNCallKeep.setAvailable(true);
      }
    } catch (error) {
      console.error("CallKeep setup error:", error);
    }
  }

  private registerEventListeners() {
    // User answered call from native UI
    RNCallKeep.addEventListener("answerCall", ({ callUUID }) => {
      console.log("CallKeep: answerCall", callUUID);
      this.onAnswerCall?.(callUUID);
    });

    // User ended call from native UI
    RNCallKeep.addEventListener("endCall", ({ callUUID }) => {
      console.log("CallKeep: endCall", callUUID);
      this.onEndCall?.(callUUID);
    });

    // User muted from native UI
    RNCallKeep.addEventListener(
      "didPerformSetMutedCallAction",
      ({ muted, callUUID }) => {
        console.log("CallKeep: muted", muted, callUUID);
        this.onMuteCall?.(callUUID, muted);
      },
    );

    // User toggled hold from native UI
    RNCallKeep.addEventListener(
      "didToggleHoldCallAction",
      ({ hold, callUUID }) => {
        console.log("CallKeep: hold", hold, callUUID);
        this.onHoldCall?.(callUUID, hold);
      },
    );

    // Audio session activated (safe to start audio)
    RNCallKeep.addEventListener("didActivateAudioSession", () => {
      console.log("CallKeep: audio session activated");
      // Start WebRTC audio here
    });

    // Incoming call displayed
    RNCallKeep.addEventListener(
      "didDisplayIncomingCall",
      ({ error, callUUID }) => {
        if (error) {
          console.error("CallKeep: error displaying incoming call:", error);
        }
      },
    );

    // Handle events that occurred before JS was ready (iOS)
    RNCallKeep.addEventListener("didLoadWithEvents", (events) => {
      console.log("CallKeep: early events", events);
      events.forEach((event) => {
        if (event.name === "RNCallKeepPerformAnswerCallAction") {
          this.onAnswerCall?.(event.data.callUUID);
        } else if (event.name === "RNCallKeepPerformEndCallAction") {
          this.onEndCall?.(event.data.callUUID);
        }
      });
    });
  }

  // Set callbacks for call actions
  setCallbacks(callbacks: {
    onAnswerCall: (callId: string) => void;
    onEndCall: (callId: string) => void;
    onMuteCall: (callId: string, muted: boolean) => void;
    onHoldCall: (callId: string, hold: boolean) => void;
  }) {
    this.onAnswerCall = callbacks.onAnswerCall;
    this.onEndCall = callbacks.onEndCall;
    this.onMuteCall = callbacks.onMuteCall;
    this.onHoldCall = callbacks.onHoldCall;
  }

  // Display incoming call (usually called from push notification handler)
  displayIncomingCall(
    callId: string,
    callerName: string,
    callerHandle: string,
    hasVideo: boolean,
  ) {
    this.activeCallId = callId;

    RNCallKeep.displayIncomingCall(
      callId,
      callerHandle,
      callerName,
      "generic",
      hasVideo,
    );
  }

  // Start outgoing call
  startOutgoingCall(
    callId: string,
    calleeName: string,
    calleeHandle: string,
    hasVideo: boolean,
  ) {
    this.activeCallId = callId;

    RNCallKeep.startCall(callId, calleeHandle, calleeName, "generic", hasVideo);
  }

  // Update call when answered
  setCallConnected(callId: string) {
    if (Platform.OS === "android") {
      RNCallKeep.setCurrentCallActive(callId);
    }
  }

  // End call
  endCall(callId: string) {
    RNCallKeep.endCall(callId);
    this.activeCallId = null;
  }

  // End all calls
  endAllCalls() {
    RNCallKeep.endAllCalls();
    this.activeCallId = null;
  }

  // Report call ended (when remote ends)
  reportEndCall(callId: string, reason: number) {
    // Reasons:
    // 1 = FAILED
    // 2 = REMOTE_ENDED
    // 3 = UNANSWERED
    // 4 = ANSWERED_ELSEWHERE
    // 5 = DECLINED_ELSEWHERE
    // 6 = MISSED
    RNCallKeep.reportEndCallWithUUID(callId, reason);
    this.activeCallId = null;
  }

  // Update display (e.g., after name lookup)
  updateDisplay(callId: string, displayName: string, handle: string) {
    RNCallKeep.updateDisplay(callId, displayName, handle);
  }

  // Set mute state
  setMuted(callId: string, muted: boolean) {
    RNCallKeep.setMutedCall(callId, muted);
  }

  // Set hold state
  setOnHold(callId: string, onHold: boolean) {
    RNCallKeep.setOnHold(callId, onHold);
  }

  // Check if there's an active call
  hasActiveCall(): boolean {
    return this.activeCallId !== null;
  }

  getActiveCallId(): string | null {
    return this.activeCallId;
  }

  // Get audio routes (speaker, earpiece, bluetooth)
  async getAudioRoutes() {
    return RNCallKeep.getAudioRoutes();
  }

  // Set audio route
  async setAudioRoute(callId: string, route: string) {
    return RNCallKeep.setAudioRoute(callId, route);
  }
}

export const callKeepService = CallKeepService.getInstance();
```

### Background Message Handler

```typescript
// src/services/backgroundCallHandler.ts

import messaging from "@react-native-firebase/messaging";
import { callKeepService } from "./callKeepService";

// Register background handler (must be called outside React components)
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log("Background message:", remoteMessage);

  const { data } = remoteMessage;

  if (data?.type === "incoming_call") {
    // Initialize CallKeep if needed
    await callKeepService.setup();

    // Display incoming call using native UI
    callKeepService.displayIncomingCall(
      data.callId,
      data.callerName,
      data.callerId,
      data.hasVideo === "true",
    );
  } else if (data?.type === "call_cancelled") {
    // Cancel the incoming call display
    callKeepService.reportEndCall(data.callId, 2); // REMOTE_ENDED
  }
});

// iOS specific: Handle VoIP push registration
export function registerVoipPushToken() {
  // This is handled in native code (AppDelegate.mm)
  // The token is automatically sent to Firebase
}
```

---

## 9. UI/UX Components

### Component Tree

```
src/
├── components/
│   └── calls/
│       ├── CallButton.tsx           # Start call button for chat headers
│       ├── IncomingCallOverlay.tsx  # Full-screen incoming call
│       ├── OutgoingCallScreen.tsx   # Waiting for answer
│       ├── InCallScreen.tsx         # Active call controls
│       ├── VideoCallView.tsx        # Video grid layout
│       ├── CallControls.tsx         # Mute, speaker, camera, end
│       ├── ParticipantVideo.tsx     # Single participant video tile
│       ├── ParticipantsList.tsx     # Group call participants
│       ├── CallQualityIndicator.tsx # Network quality display
│       └── index.ts                 # Barrel export
│
├── screens/
│   └── calls/
│       ├── VideoCallScreen.tsx      # Main video call screen
│       ├── AudioCallScreen.tsx      # Audio-only call screen
│       ├── CallHistoryScreen.tsx    # Recent calls list
│       └── index.ts
│
├── contexts/
│   └── CallContext.tsx              # Call state provider
│
├── hooks/
│   └── calls/
│       ├── useCall.ts               # Main call hook
│       ├── useCallState.ts          # Call status subscription
│       ├── useLocalMedia.ts         # Camera/mic controls
│       ├── useRemoteParticipants.ts # Remote participant tracks
│       └── index.ts
│
└── services/
    └── calls/
        ├── callService.ts           # Main call business logic
        ├── callKeepService.ts       # Native UI integration
        ├── streamService.ts         # Stream SDK wrapper (or webrtcService.ts)
        └── index.ts
```

### CallButton Component

```tsx
// src/components/calls/CallButton.tsx

import React from "react";
import { TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCall } from "../../hooks/calls/useCall";
import { theme } from "../../../constants/theme";

interface CallButtonProps {
  conversationId: string;
  participantId: string; // For DM - the other user
  participantName: string;
  isVideo?: boolean;
  size?: number;
}

export function CallButton({
  conversationId,
  participantId,
  participantName,
  isVideo = false,
  size = 24,
}: CallButtonProps) {
  const navigation = useNavigation();
  const { startCall, hasActiveCall } = useCall();

  const handlePress = async () => {
    if (hasActiveCall) {
      Alert.alert(
        "Call in Progress",
        "You already have an active call. Please end it before starting a new one.",
      );
      return;
    }

    try {
      const callId = await startCall({
        conversationId,
        participantIds: [participantId],
        type: isVideo ? "video" : "audio",
        scope: "dm",
      });

      // Navigate to call screen
      navigation.navigate(isVideo ? "VideoCall" : "AudioCall", {
        callId,
        isOutgoing: true,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to start call. Please try again.");
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons
        name={isVideo ? "videocam" : "call"}
        size={size}
        color={theme.colors.primary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});
```

### IncomingCallOverlay Component

```tsx
// src/components/calls/IncomingCallOverlay.tsx

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Avatar } from "../Avatar";
import { useCall } from "../../hooks/calls/useCall";
import { theme } from "../../../constants/theme";
import { Call } from "../../types/call";

interface IncomingCallOverlayProps {
  call: Call;
  onAnswer: () => void;
  onDecline: () => void;
}

export function IncomingCallOverlay({
  call,
  onAnswer,
  onDecline,
}: IncomingCallOverlayProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  // Animate on mount
  useEffect(() => {
    // Slide in
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    // Vibration pattern
    const vibratePattern =
      Platform.OS === "android" ? [0, 500, 200, 500] : [500];
    Vibration.vibrate(vibratePattern, true);

    return () => {
      pulse.stop();
      Vibration.cancel();
    };
  }, []);

  const callerParticipant = Object.values(call.participants).find(
    (p) => p.odId === call.callerId,
  );

  return (
    <BlurView intensity={90} style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-100, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Caller Avatar */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Avatar
            config={callerParticipant?.avatarConfig}
            size={120}
            style={styles.avatar}
          />
        </Animated.View>

        {/* Caller Name */}
        <Text style={styles.callerName}>
          {callerParticipant?.displayName || "Unknown"}
        </Text>

        {/* Call Type */}
        <View style={styles.callTypeContainer}>
          <Ionicons
            name={call.type === "video" ? "videocam" : "call"}
            size={20}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.callType}>
            {call.type === "video" ? "Video Call" : "Voice Call"}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {/* Decline */}
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={onDecline}
          >
            <Ionicons name="close" size={32} color="#fff" />
            <Text style={styles.actionText}>Decline</Text>
          </TouchableOpacity>

          {/* Answer */}
          <TouchableOpacity
            style={[styles.actionButton, styles.answerButton]}
            onPress={onAnswer}
          >
            <Ionicons
              name={call.type === "video" ? "videocam" : "call"}
              size={32}
              color="#fff"
            />
            <Text style={styles.actionText}>Answer</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    padding: 24,
  },
  avatar: {
    marginBottom: 24,
  },
  callerName: {
    fontSize: 28,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 8,
  },
  callTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 48,
  },
  callType: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 48,
  },
  actionButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  declineButton: {
    backgroundColor: theme.colors.error,
  },
  answerButton: {
    backgroundColor: theme.colors.success,
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
  },
});
```

### InCallScreen Component

```tsx
// src/screens/calls/InCallScreen.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCall } from "../../hooks/calls/useCall";
import { useLocalMedia } from "../../hooks/calls/useLocalMedia";
import { CallControls } from "../../components/calls/CallControls";
import { ParticipantVideo } from "../../components/calls/ParticipantVideo";
import { CallQualityIndicator } from "../../components/calls/CallQualityIndicator";
import { Avatar } from "../../components/Avatar";
import { formatDuration } from "../../utils/time";
import { theme } from "../../../constants/theme";

export function InCallScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { callId, isOutgoing } = route.params as {
    callId: string;
    isOutgoing: boolean;
  };

  const {
    call,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    switchCamera,
  } = useCall(callId);

  const { isMuted, isSpeakerOn, isVideoEnabled, localVideoTrack } =
    useLocalMedia();

  const [duration, setDuration] = useState(0);

  // Duration timer
  useEffect(() => {
    if (call?.status !== "connected") return;

    const interval = setInterval(() => {
      if (call.answeredAt) {
        setDuration(Math.floor((Date.now() - call.answeredAt) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [call?.status, call?.answeredAt]);

  // Handle call ended
  useEffect(() => {
    if (call?.status === "ended" || call?.status === "failed") {
      navigation.goBack();
    }
  }, [call?.status]);

  const handleEndCall = async () => {
    await endCall();
    navigation.goBack();
  };

  const remoteParticipants = Object.values(call?.participants || {}).filter(
    (p) => p.odId !== currentUser.uid,
  );

  const isVideoCall = call?.type === "video";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <CallQualityIndicator />
        <Text style={styles.duration}>
          {call?.status === "connected"
            ? formatDuration(duration)
            : call?.status === "ringing"
              ? "Ringing..."
              : "Connecting..."}
        </Text>
      </View>

      {/* Video Area */}
      <View style={styles.videoContainer}>
        {isVideoCall ? (
          <>
            {/* Remote video (main) */}
            {remoteParticipants.map((participant) => (
              <ParticipantVideo
                key={participant.odId}
                participant={participant}
                style={styles.remoteVideo}
              />
            ))}

            {/* Local video (picture-in-picture) */}
            {isVideoEnabled && (
              <View style={styles.localVideoContainer}>
                <ParticipantVideo
                  track={localVideoTrack}
                  style={styles.localVideo}
                  mirror
                />
                <TouchableOpacity
                  style={styles.switchCameraButton}
                  onPress={switchCamera}
                >
                  <Ionicons name="camera-reverse" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          // Audio call - show avatar
          <View style={styles.audioCallContainer}>
            {remoteParticipants.map((participant) => (
              <View key={participant.odId} style={styles.audioParticipant}>
                <Avatar config={participant.avatarConfig} size={120} />
                <Text style={styles.participantName}>
                  {participant.displayName}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Controls */}
      <CallControls
        isMuted={isMuted}
        isSpeakerOn={isSpeakerOn}
        isVideoEnabled={isVideoEnabled}
        isVideoCall={isVideoCall}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        onToggleVideo={toggleVideo}
        onEndCall={handleEndCall}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  duration: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  videoContainer: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
  },
  localVideoContainer: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#fff",
  },
  localVideo: {
    flex: 1,
  },
  switchCameraButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    padding: 4,
  },
  audioCallContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  audioParticipant: {
    alignItems: "center",
  },
  participantName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    marginTop: 16,
  },
});
```

---

## 10. Cloud Functions (Signaling Server)

### Call Management Functions

```typescript
// firebase-backend/functions/src/calls/index.ts

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Call, CallStatus } from "../types/call";

const db = admin.firestore();

// Generate Stream/Agora token for call
export const generateCallToken = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const { callId, userId } = data;

    // Verify user is participant in call
    const callDoc = await db.collection("Calls").doc(callId).get();
    if (!callDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Call not found");
    }

    const call = callDoc.data() as Call;
    if (!(userId in call.participants)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not a participant",
      );
    }

    // Generate token based on provider
    // Stream example:
    const streamApiKey = process.env.STREAM_API_KEY!;
    const streamApiSecret = process.env.STREAM_API_SECRET!;

    // Use Stream SDK to generate user token
    const { StreamClient } = require("@stream-io/node-sdk");
    const client = new StreamClient(streamApiKey, streamApiSecret);

    const token = client.generateUserToken({ user_id: userId });

    return {
      token,
      apiKey: streamApiKey,
      roomId: call.roomId || callId,
    };
  },
);

// Handle call timeout (no answer after 30s)
export const handleCallTimeout = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    const now = Date.now();
    const timeoutThreshold = 30000; // 30 seconds

    // Find ringing calls that have exceeded timeout
    const ringingCalls = await db
      .collection("Calls")
      .where("status", "==", "ringing")
      .where("createdAt", "<", now - timeoutThreshold)
      .get();

    const batch = db.batch();

    ringingCalls.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "missed" as CallStatus,
        endedAt: now,
        endReason: "missed",
      });
    });

    await batch.commit();

    console.log(`Marked ${ringingCalls.size} calls as missed`);
  });

// Clean up old call signaling data (WebRTC)
export const cleanupCallSignaling = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async () => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    const oldSignals = await db
      .collectionGroup("Signals")
      .where("createdAt", "<", cutoff)
      .limit(500)
      .get();

    const batch = db.batch();
    oldSignals.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  });

// Record call history when call ends
export const onCallUpdated = functions.firestore
  .document("Calls/{callId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Call;
    const after = change.after.data() as Call;
    const { callId } = context.params;

    // Only process when call transitions to terminal state
    const terminalStates: CallStatus[] = [
      "ended",
      "declined",
      "missed",
      "failed",
    ];
    if (
      !terminalStates.includes(after.status) ||
      terminalStates.includes(before.status)
    ) {
      return;
    }

    // Calculate duration
    const duration =
      after.answeredAt && after.endedAt
        ? Math.floor((after.endedAt - after.answeredAt) / 1000)
        : null;

    // Create history entry for each participant
    const batch = db.batch();

    for (const [odId, participant] of Object.entries(after.participants)) {
      const otherParticipants = Object.entries(after.participants)
        .filter(([id]) => id !== odId)
        .map(([, p]) => ({
          odId: p.odId,
          displayName: p.displayName,
        }));

      const historyRef = db
        .collection("Users")
        .doc(odId)
        .collection("CallHistory")
        .doc(callId);

      batch.set(historyRef, {
        callId,
        odId,
        otherParticipants,
        type: after.type,
        scope: after.scope,
        status: after.status,
        direction: odId === after.callerId ? "outgoing" : "incoming",
        createdAt: after.createdAt,
        duration,
        wasAnswered: after.answeredAt !== null,
      });
    }

    await batch.commit();
  });
```

---

## 11. Security & Privacy

### Security Considerations

| Concern                    | Mitigation                                           |
| -------------------------- | ---------------------------------------------------- |
| Unauthorized call access   | Firestore rules verify participant membership        |
| Token theft                | Short-lived tokens (1 hour), regenerate on rejoin    |
| Call spoofing              | Server-side token generation, verify caller identity |
| Privacy (screen recording) | Native APIs don't allow recording without permission |
| MITM attacks               | WebRTC uses DTLS-SRTP encryption by default          |
| Spam calls                 | Rate limiting, blocking integration                  |

### Privacy Features

```typescript
// src/services/calls/privacySettings.ts

export interface CallPrivacySettings {
  // Who can call this user
  allowCallsFrom: "everyone" | "friends_only" | "nobody";

  // Do Not Disturb
  dndEnabled: boolean;
  dndSchedule?: {
    startHour: number; // 0-23
    endHour: number;
    timezone: string;
  };

  // Blocked users can't call
  // Uses existing blocking system
}

// Check if user can receive calls
export async function canReceiveCall(
  recipientId: string,
  callerId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getCallPrivacySettings(recipientId);

  // Check DND
  if (settings.dndEnabled && isInDndWindow(settings.dndSchedule)) {
    return { allowed: false, reason: "dnd" };
  }

  // Check block list
  const isBlocked = await checkIfBlocked(recipientId, callerId);
  if (isBlocked) {
    return { allowed: false, reason: "blocked" };
  }

  // Check allow list
  if (settings.allowCallsFrom === "nobody") {
    return { allowed: false, reason: "disabled" };
  }

  if (settings.allowCallsFrom === "friends_only") {
    const areFriends = await checkFriendship(recipientId, callerId);
    if (!areFriends) {
      return { allowed: false, reason: "not_friends" };
    }
  }

  return { allowed: true };
}
```

---

## 12. Testing Strategy

### Test Categories

```
__tests__/
└── calls/
    ├── unit/
    │   ├── callService.test.ts        # Service logic
    │   ├── callStateMachine.test.ts   # State transitions
    │   └── callUtils.test.ts          # Utility functions
    │
    ├── integration/
    │   ├── callFlow.test.ts           # Full call lifecycle
    │   ├── callNotifications.test.ts  # Push notification flow
    │   └── callHistory.test.ts        # History recording
    │
    └── e2e/
        └── calls.e2e.ts               # End-to-end call tests
```

### Key Test Scenarios

```typescript
// __tests__/calls/integration/callFlow.test.ts

describe('Call Flow', () => {
  describe('1:1 Audio Call', () => {
    it('should initiate outgoing call', async () => {
      const callId = await callService.startCall({
        conversationId: 'chat_123',
        participantIds: ['user_456'],
        type: 'audio',
        scope: 'dm',
      });

      expect(callId).toBeDefined();

      const call = await getCall(callId);
      expect(call.status).toBe('ringing');
      expect(call.callerId).toBe(currentUser.uid);
    });

    it('should receive incoming call', async () => {
      // Simulate incoming call from other user
      const callId = await createIncomingCall({
        callerId: 'user_456',
        recipientId: currentUser.uid,
        type: 'audio',
      });

      // Verify notification was displayed
      expect(mockCallKeep.displayIncomingCall).toHaveBeenCalledWith(
        callId,
        expect.any(String),
        'User 456',
        'generic',
        false
      );
    });

    it('should connect call when answered', async () => {
      const callId = await createRingingCall();

      await callService.answerCall(callId);

      const call = await getCall(callId);
      expect(call.status).toBe('connected');
      expect(call.answeredAt).toBeDefined();
    });

    it('should end call properly', async () => {
      const callId = await createConnectedCall();

      await callService.endCall(callId);

      const call = await getCall(callId);
      expect(call.status).toBe('ended');
      expect(call.endedAt).toBeDefined();
      expect(call.duration).toBeGreaterThan(0);
    });

    it('should mark as missed after timeout', async () => {
      const callId = await createRingingCall();

      // Fast-forward 31 seconds
      jest.advanceTimersByTime(31000);

      const call = await getCall(callId);
      expect(call.status).toBe('missed');
    });
  });

  describe('Group Video Call', () => {
    it('should allow multiple participants to join', async () => {
      const callId = await callService.startGroupCall({
        groupId: 'group_123',
        type: 'video',
      });

      // First participant joins
      await callService.joinCall(callId, 'user_1');

      // Second participant joins
      await callService.joinCall(callId, 'user_2');

      const call = await getCall(callId);
      expect(Object.keys(call.participants).length).toBe(3); // creator + 2
    });

    it('should handle participant leaving mid-call', async () => {
      const callId = await createGroupCallWithParticipants(3);

      await callService.leaveCall(callId, 'user_2');

      const call = await getCall(callId);
      expect(call.participants['user_2'].leftAt).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network disconnection', async () => {
      const callId = await createConnectedCall();

      // Simulate network loss
      mockNetwork.disconnect();

      // Wait for reconnection timeout
      jest.advanceTimersByTime(30000);

      // Should attempt reconnection
      expect(mockWebRTC.reconnect).toHaveBeenCalled();
    });

    it('should handle permission denied', async () => {
      mockPermissions.camera = 'denied';

      await expect(
        callService.startCall({ type: 'video', ... })
      ).rejects.toThrow('Camera permission denied');
    });
  });
});
```

---

## 13. Future: In-Call Games Integration

### Architecture for In-Call Games

```
Phase 3+ (Future)
┌────────────────────────────────────────────────────────────────┐
│                    IN-CALL GAMES ARCHITECTURE                   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Active Video Call                      │  │
│  │  ┌──────────────┐    ┌──────────────┐                   │  │
│  │  │ Video Grid   │    │ Game Overlay │◀── React Native   │  │
│  │  │ (WebRTC)     │    │ (Shared)     │    Game Engine    │  │
│  │  └──────────────┘    └──────────────┘                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Game State Sync                         │  │
│  │  ┌──────────────┐    ┌──────────────┐                   │  │
│  │  │ WebRTC Data  │ OR │ Firestore    │                   │  │
│  │  │ Channel      │    │ Real-time    │                   │  │
│  │  └──────────────┘    └──────────────┘                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Supported Games (reuse existing):                             │
│  • Chess (turn-based via data channel)                         │
│  • Pool (real-time physics sync)                               │
│  • Flappy Bird (competitive/co-op)                             │
│  • Cart Course (competitive racing)                            │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Game Integration Hook

```typescript
// src/hooks/calls/useCallGames.ts (Future)

export function useCallGames(callId: string) {
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const dataChannel = useWebRTCDataChannel(callId);

  const startGame = async (gameType: GameType) => {
    // Notify other participants
    dataChannel.send({
      type: "game_start",
      gameType,
      initiator: currentUser.uid,
    });

    setActiveGame(gameType);
  };

  const sendGameState = (state: any) => {
    dataChannel.send({
      type: "game_state",
      state,
      timestamp: Date.now(),
    });
  };

  // Listen for game events from other participants
  useEffect(() => {
    dataChannel.onMessage((message) => {
      switch (message.type) {
        case "game_start":
          setActiveGame(message.gameType);
          break;
        case "game_state":
          // Update local game state
          break;
        case "game_end":
          setActiveGame(null);
          break;
      }
    });
  }, [dataChannel]);

  return {
    activeGame,
    startGame,
    endGame: () => setActiveGame(null),
    sendGameState,
  };
}
```

---

## 14. Cost Analysis

### WebRTC Cost Breakdown (Monthly)

| Component             | Cost           | Notes                           |
| --------------------- | -------------- | ------------------------------- |
| **Infrastructure**    |                |                                 |
| Twilio TURN Server    | $50-100        | Metered, ~$0.40/GB              |
| Google STUN Servers   | $0             | Free public STUN                |
| Firebase Functions    | $0-20          | Existing infrastructure         |
| Firestore (signaling) | $0-25          | Minimal reads/writes per call   |
| Push Notifications    | $0             | FCM is free                     |
| **Per-Minute Costs**  | **$0**         | No usage-based billing!         |
| **Total**             | **$50-145/mo** | Flat cost regardless of minutes |

### Scaling Projections (WebRTC)

| Users | Calls/Month | Est. Minutes | Monthly Cost | Per-Call Cost |
| ----- | ----------- | ------------ | ------------ | ------------- |
| 1K    | 5K          | 15K          | $75          | $0.015        |
| 10K   | 50K         | 150K         | $150         | $0.003        |
| 100K  | 500K        | 1.5M         | $500         | $0.001        |
| 1M    | 5M          | 15M          | $1,500       | $0.0003       |

**Key Insight:** WebRTC costs scale sub-linearly. The more calls you have, the cheaper each call becomes. This is the opposite of per-minute pricing models.

---

## 15. Rollout Plan

### Phase 1: Internal Testing (Week 1)

- Deploy to TestFlight/Internal Testing track
- Test with team members
- Fix critical bugs

### Phase 2: Beta (Week 2)

- Enable for 5% of users via feature flag
- Monitor error rates and call quality metrics
- Gather feedback

### Phase 3: Gradual Rollout (Week 3-4)

- Increase to 25%, 50%, 75%, 100%
- Monitor server costs and scale
- A/B test UI variations

### Feature Flag Configuration

```typescript
// constants/featureFlags.ts

export const FEATURE_FLAGS = {
  // ... existing flags

  // Calling features
  CALLS_ENABLED: false, // Master switch
  VIDEO_CALLS_ENABLED: false, // Video specifically
  GROUP_CALLS_ENABLED: false, // Group calls
  CALL_RECORDING_ENABLED: false, // Future: recording
};

// Remote config integration
export async function getCallsEnabled(userId: string): Promise<boolean> {
  // Check remote config for user-specific rollout
  const config = await getRemoteConfig();
  return config.get("calls_enabled_percentage") > getUserRolloutBucket(userId);
}
```

---

## Summary

This plan provides a comprehensive roadmap for implementing real-time video and phone calling in Vibe using **WebRTC**. Key decisions:

1. **Technology:** WebRTC via `react-native-webrtc` with Firestore signaling
2. **Native Integration:** `react-native-callkeep` for iOS CallKit & Android ConnectionService
3. **Timeline:** 6-8 weeks for full implementation
4. **Priority:** 1:1 audio → 1:1 video → background mode → group calls
5. **Cost:** $50-145/month flat (no per-minute charges)
6. **Future:** In-call games via WebRTC data channels (built-in capability)

### Why WebRTC Over Managed Services:

| Factor             | WebRTC      | Managed (Stream/Agora) |
| ------------------ | ----------- | ---------------------- |
| Cost at 1M minutes | ~$150/mo    | ~$4,000-6,500/mo       |
| Data channels      | ✅ Built-in | ❌ Separate feature    |
| Vendor lock-in     | ❌ None     | ✅ High                |
| Control            | Full        | Limited                |
| Complexity         | Higher      | Lower                  |

The implementation leverages your existing Firebase infrastructure for signaling, follows your local-first architecture patterns, and integrates seamlessly with the existing chat system.

