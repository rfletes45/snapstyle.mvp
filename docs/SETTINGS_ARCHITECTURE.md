# Settings Screen Architecture

Last updated: 2026-04-15

## Overview

The Settings screen is organized as a **hub-style directory** with clean top-level categories. Detailed or noisy settings live one level deeper in dedicated sub-screens. The main screen is designed to be scannable, coherent, and scalable.

---

## Main Settings Screen Structure

**File:** `src/screens/settings/SettingsScreen.tsx`
**Route:** `Settings` (in ProfileStack)

### Sections (in order)

| Section              | Type           | Contents                                                         |
| -------------------- | -------------- | ---------------------------------------------------------------- |
| **Account**          | Inline fields  | Display Name (editable), Email (read-only), Username (read-only) |
| **Appearance**       | Inline control | Theme selector: Light / Dark / Auto buttons                      |
| **Preferences**      | Navigation hub | Notifications →, Chats & Messaging →, Calls → (if enabled)       |
| **Privacy & Safety** | Navigation hub | Privacy Settings →, Blocked Users →                              |
| **Admin Tools**      | Navigation row | Reports Queue → (visible only to admins)                         |
| **About**            | Info rows      | Privacy Policy (external link), App Version                      |
| **Account Actions**  | Action buttons | Sign Out, Delete Account                                         |

---

## Sub-Screens

### Notification Settings

**File:** `src/screens/settings/NotificationSettingsScreen.tsx`
**Route:** `NotificationSettings` (in ProfileStack)

All notification toggles that previously cluttered the main Settings screen now live here, organized into groups:

| Group                 | Toggles                                               |
| --------------------- | ----------------------------------------------------- |
| **General**           | All Notifications (master), In-App Banners, App Badge |
| **Messages & Social** | Messages, Social (friend requests)                    |
| **Games & Activity**  | Games, Achievements, Gifts, Ritual Reminders          |
| **Stories**           | Moments                                               |

- Master switch disables all sub-toggles visually when off
- Each toggle syncs to `InboxSettings` in Firestore via `updateInboxSettings()`
- Uses `subscribeToInboxSettings()` for real-time state

### Chats & Messaging (Inbox Settings)

**File:** `src/screens/chat/InboxSettingsScreen.tsx`
**Route:** `InboxSettings` (in InboxStack + MainStack)

| Section                | Contents                                                   |
| ---------------------- | ---------------------------------------------------------- |
| **Notifications**      | Default notification level (All/Mentions/None)             |
| **Privacy**            | Read Receipts, Typing Indicators, Online Status, Last Seen |
| **Preferences**        | Swipe Actions, Confirm Before Delete                       |
| **Conversation Style** | Bubbles / Stacked toggle (moved from main Settings)        |
| **Blocked Users**      | Link to Blocked Users screen                               |

### Calls

**File:** `src/screens/calls/CallSettingsScreen.tsx`
**Route:** `CallSettings` (in MainStack, gated by `CALL_FEATURES.CALLS_ENABLED`)

Camera, Audio, Ringtone, Do Not Disturb, Privacy, Quality & Data, Accessibility.

### Privacy Settings

**File:** `src/screens/settings/PrivacySettingsScreen.tsx`
**Route:** `PrivacySettings` (in ProfileStack)

Granular visibility controls with presets (Public/Friends Only/Private). 5 sections: Profile Visibility, Activity Visibility, Social Visibility, Contact Permissions, Discovery.

### Blocked Users

**File:** `src/screens/settings/BlockedUsersScreen.tsx`
**Route:** `BlockedUsers` (in ProfileStack)

List of blocked users with unblock functionality.

---

## Navigation Map

```
Settings (ProfileStack)
├── NotificationSettings (ProfileStack)
├── InboxSettings (navigate as MainStack overlay)
├── CallSettings (navigate as MainStack overlay, if CALLS_ENABLED)
├── PrivacySettings (ProfileStack)
├── BlockedUsers (ProfileStack)
└── AdminReports (ProfileStack, admin-only)
```

---

## Key Design Decisions

1. **Theme inline, notifications pushed down** — Theme toggle is high-frequency and stays on the main screen. Notification toggles (10+) are low-frequency batch configurations and live in a dedicated sub-screen.

2. **Conversation Style moved to Chats & Messaging** — It's a chat display preference, not a global appearance setting. Placing it in InboxSettingsScreen groups it with related chat preferences.

3. **Privacy Policy moved to About** — It's informational, not a setting. Grouping it with version info under "About" is more natural than placing it under "Privacy & Safety" with actionable controls.

4. **Calls row is feature-gated** — Only shown when `CALL_FEATURES.CALLS_ENABLED` is true, matching the existing call system gate.

5. **Hub-style rows with descriptions** — Each navigation row has a subtitle describing what lives inside, so users can find settings without opening every sub-screen.

---

## Persistence Model

No persistence behavior was changed. All settings continue to use their existing storage:

| Setting Area      | Storage                           | Sync Mechanism                |
| ----------------- | --------------------------------- | ----------------------------- |
| Notifications     | `InboxSettings` Firestore doc     | `subscribeToInboxSettings()`  |
| Chat preferences  | `InboxSettings` Firestore doc     | `subscribeToInboxSettings()`  |
| Conversation mode | `ConversationDisplayModeContext`  | AsyncStorage + Context        |
| Theme             | `ThemeContext`                    | AsyncStorage + Firestore sync |
| Privacy           | `Users/{uid}.privacy` Firestore   | `updateFullPrivacySettings()` |
| Call settings     | `callSettingsService`             | Local + listener pattern      |
| Blocked users     | `Users/{uid}/Blocked/` collection | Real-time Firestore           |

---

## Adding New Settings

To add a new setting:

1. **Top-level inline control**: Add directly to the main `SettingsScreen.tsx` in the appropriate section.
2. **New preference in existing sub-screen**: Add a toggle/row to the relevant sub-screen (e.g., `NotificationSettingsScreen` for a new notification type).
3. **New settings category**: Create a new screen in `src/screens/settings/`, add a route to `ProfileTabStackParamList`, register in `ProfileStack`, and add a navigation row in `SettingsScreen.tsx`.

The notification settings screen uses a declarative `NOTIFICATION_SECTIONS` config array, making it easy to add new notification toggles by adding an entry to the appropriate section.
