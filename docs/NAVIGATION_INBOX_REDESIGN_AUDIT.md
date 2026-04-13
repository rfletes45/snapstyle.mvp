# Navigation & Inbox System — Current State Audit

> **Purpose**: This document provides a complete, accurate snapshot of the current navigation layout, Inbox screen, and related systems. It is intended for an agent to use as a reference when planning and implementing the redesign described in the [Planned Changes](#planned-changes-summary) section.

---

## Table of Contents

1. [Planned Changes Summary](#planned-changes-summary)
2. [Navigation Architecture Overview](#navigation-architecture-overview)
3. [Bottom Tab Bar — Current Layout](#bottom-tab-bar--current-layout)
4. [Moments Tab — Files to Remove](#moments-tab--files-to-remove)
5. [Games Tab — UI to Remove, Screens to Keep](#games-tab--ui-to-remove-screens-to-keep)
6. [Inbox (→ Messages) — Full Component Inventory](#inbox--messages--full-component-inventory)
7. [Archive Feature — Complete Removal Scope](#archive-feature--complete-removal-scope)
8. [Navigation Type Definitions](#navigation-type-definitions)
9. [Deep Linking Configuration](#deep-linking-configuration)
10. [Theme & Styling System](#theme--styling-system)
11. [File-by-File Change Map](#file-by-file-change-map)

---

## Planned Changes Summary

For reference, these are the changes this audit supports (DO NOT implement — audit only):

1. **Remove Moments tab** entirely (navigation UI + all Moments screens)
2. **Remove Games tab** from bottom navigation (keep all game screens & functionality accessible)
3. **Reorder bottom tabs** to: **Profile** | **Inbox (→ Messages)** | **Shop** (left to right, 3 tabs only)
4. **Rename "Inbox" to "Messages"** everywhere (tab label, header text, types)
5. **Redesign Messages (Inbox) UI** to match Snapchat's layout — unified color across header, filters, chat list, and background
6. **Remove archive feature** entirely, keep only delete
7. **Add a Games button** to the Messages header area that navigates to the GamesHub screen

---

## Navigation Architecture Overview

### Stack Hierarchy

```
RootNavigator (NavigationContainer)                    [src/navigation/RootNavigator.tsx]
├── AuthStack (unauthenticated)
│   ├── Welcome
│   ├── Login
│   ├── Signup
│   ├── ForgotPassword
│   └── ProfileSetup
├── ProfileSetupStack (needs_profile)
│   └── ProfileSetup
└── MainStack (authenticated & ready)                  screenOptions: { freezeOnBlur: true }
    ├── MainTabs (Bottom Tab Navigator)                ← MODIFY: Remove Games + Moments tabs
    │   ├── Shop         → ShopHubScreen               ← KEEP (reorder to 3rd)
    │   ├── Inbox        → InboxStack                   ← RENAME to Messages, redesign
    │   │   ├── ChatList → ChatListScreenV2
    │   │   ├── ScheduledMessages
    │   │   ├── GroupInvites
    │   │   ├── InboxSettings
    │   │   └── InboxSearch
    │   ├── Games        → GamesHubScreenV4             ← REMOVE from tabs (keep screen)
    │   ├── Moments      → MomentsStack                 ← REMOVE entirely
    │   │   ├── StoriesList → MomentsUnderConstructionScreen
    │   │   └── StoryViewer
    │   └── Profile      → ProfileStack                 ← KEEP (reorder to 1st)
    └── Full-screen overlays (MainStack screens)        [freezeOnBlur: true — inactive screens frozen]
        ├── ChatDetail, GroupChat, ThreadView, GroupChatCreate, GroupChatInfo
        ├── ChatSettings, SnapViewer, Camera, CameraShare
        ├── AudioCall, VideoCall, GroupCall, CallHistory, CallSettings
        ├── Connections, UserProfile, SetStatus, MutualFriendsList
        ├── CosmeticsShop, PremiumShop, PurchaseHistory, Customization
        ├── ActivityFeed
        ├── GameLobbyV4, GamePlayV4, GameOverV4, GameDetailV4              ← KEEP as MainStack screens
        ├── GameLeaderboardV4, GameStatsV4, AchievementsHub               ← KEEP as MainStack screens
        ├── AchievementSection, ProfileAchievements, LevelRewards         ← KEEP as MainStack screens
        └── Wallet
```

### Key Files

| File                                                                 | Purpose                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx) | All navigators: AuthStack, InboxStack, MomentsStack, ProfileStack, AppTabs, MainStack, RootNavigator |
| [src/navigation/ShopNavigator.tsx](src/navigation/ShopNavigator.tsx) | ShopHub → PremiumShop → PurchaseHistory (NOT used inside tab — ShopHubScreen is directly used)       |
| [src/services/navigationRef.ts](src/services/navigationRef.ts)       | Global imperative navigation ref for external navigation                                             |
| [src/types/navigation/root.ts](src/types/navigation/root.ts)         | All route param type definitions                                                                     |
| [src/types/navigation/index.ts](src/types/navigation/index.ts)       | Barrel re-export of root.ts                                                                          |

---

## Bottom Tab Bar — Current Layout

**File**: [src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx) — `AppTabs()` function (around line 395)

### Current Tab Order (left to right)

| #   | Tab Name | Icon (MaterialCommunityIcons) | Component          | Stack?             |
| --- | -------- | ----------------------------- | ------------------ | ------------------ |
| 1   | Shop     | `store-outline`               | `ShopHubScreen`    | No (direct screen) |
| 2   | Inbox    | `message-outline`             | `InboxStack`       | Yes (nested stack) |
| 3   | Games    | `gamepad-variant`             | `GamesHubScreenV4` | No (direct screen) |
| 4   | Moments  | `image-multiple-outline`      | `MomentsStack`     | Yes (nested stack) |
| 5   | Profile  | `account-circle-outline`      | `ProfileStack`     | Yes (nested stack) |

### Tab Bar Styling

```typescript
// In AppTabs() function
const defaultTabBarStyle = {
  backgroundColor: colors.surface,
  borderTopColor: colors.border,
  borderTopWidth: 1,
};

// Tab colors
tabBarActiveTintColor: colors.tabActive,
tabBarInactiveTintColor: colors.tabInactive,
tabBarHideOnKeyboard: true,
```

### Tab Bar Visibility

Some routes hide the tab bar via `ROUTES_WITH_HIDDEN_TAB_BAR`:

```typescript
const ROUTES_WITH_HIDDEN_TAB_BAR = new Set(["StoryViewer", "CreateStory"]);
```

This set is used by `getTabBarStyle()` to return `{ display: "none", height: 0 }` for those routes.

### Initial Route

```typescript
initialRouteName = "Inbox";
```

---

## Moments Tab — Files to Remove

The Moments feature is currently showing an "Under Construction" placeholder. All these files can be fully removed:

### Screens

| File                                                                                                             | Description                                          | Lines |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----- |
| [src/screens/stories/MomentsUnderConstructionScreen.tsx](src/screens/stories/MomentsUnderConstructionScreen.tsx) | Placeholder "Under Construction" screen              | ~60   |
| [src/screens/stories/StoriesScreen.tsx](src/screens/stories/StoriesScreen.tsx)                                   | Full Moments feed (not currently mounted but exists) | ~450  |
| [src/screens/stories/StoryViewerScreen.tsx](src/screens/stories/StoryViewerScreen.tsx)                           | Fullscreen story viewer                              | ~600  |

### Services

| File                                                                             | Description                                      | Lines |
| -------------------------------------------------------------------------------- | ------------------------------------------------ | ----- |
| [src/services/stories.ts](src/services/stories.ts)                               | Firebase operations for 24-hour expiring stories | ~620  |
| [src/services/story/snapStoryService.ts](src/services/story/snapStoryService.ts) | Alternative "Picture Stories" system             | ~500  |
| [src/services/snaps.ts](src/services/snaps.ts)                                   | View-once picture messages                       | ~50   |

### Navigation References to Remove

In [src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx):

1. **Imports** (lines ~56-57):

   ```typescript
   import MomentsUnderConstructionScreen from "@/screens/stories/MomentsUnderConstructionScreen";
   import StoryViewerScreen from "@/screens/stories/StoryViewerScreen";
   ```

2. **Navigator creation** (line ~121):

   ```typescript
   const MomentsStack_Nav = createNativeStackNavigator<MomentsStackParamList>();
   ```

3. **MomentsStack function** (~lines 240-272):

   ```typescript
   function MomentsStack() { ... }
   ```

4. **Tab.Screen for Moments** (~lines 455-460):

   ```typescript
   <Tab.Screen name="Moments" component={MomentsStack} ... />
   ```

5. **Icon case in switch** (~lines 418-419):

   ```typescript
   case "Moments":
     iconName = "image-multiple-outline";
   ```

6. **ROUTES_WITH_HIDDEN_TAB_BAR** (~lines 128-132):
   ```typescript
   const ROUTES_WITH_HIDDEN_TAB_BAR = new Set(["StoryViewer", "CreateStory"]);
   ```
   This entire set + `getTabBarStyle()` helper can be removed if no other routes need it.

### Type References to Remove

In [src/types/navigation/root.ts](src/types/navigation/root.ts):

1. **MomentsStackParamList** (lines 25-28):

   ```typescript
   export type MomentsStackParamList = {
     StoriesList: undefined;
     StoryViewer: OptionalRouteParams;
   };
   ```

2. **Moments entry in AppTabsParamList** (line 51):
   ```typescript
   Moments: NavigatorScreenParams<MomentsStackParamList> | undefined;
   ```

---

## Games Tab — UI to Remove, Screens to Keep

### What to REMOVE (Tab UI only)

In [src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx):

1. **Tab.Screen for Games** (~line 450):

   ```typescript
   <Tab.Screen
     name="Games"
     component={GamesHubScreenV4}
     options={{ headerShown: false }}
   />
   ```

2. **Icon case in switch** (~lines 414-415):
   ```typescript
   case "Games":
     iconName = "gamepad-variant";
   ```

In [src/types/navigation/root.ts](src/types/navigation/root.ts):

3. **Games entry in AppTabsParamList** (line 49):
   ```typescript
   Games: undefined;
   ```

### What to KEEP (all game screens in MainStack)

These remain as full-screen overlay screens in MainStack — they are accessed via navigation from chat or the new Games header button:

| Route                 | Component                   | File                                              |
| --------------------- | --------------------------- | ------------------------------------------------- |
| `GameLobbyV4`         | `GameLobbyScreenV4`         | src/gamesV4/screens/GameLobbyScreenV4.tsx         |
| `GamePlayV4`          | `GamePlayDispatcherV4`      | src/gamesV4/screens/GamePlayDispatcherV4.tsx      |
| `GameOverV4`          | `GameOverScreenV4`          | src/gamesV4/screens/GameOverScreenV4.tsx          |
| `GameDetailV4`        | `GameDetailScreenV4`        | src/gamesV4/screens/GameDetailScreenV4.tsx        |
| `GameLeaderboardV4`   | `GameLeaderboardScreenV4`   | src/gamesV4/screens/GameLeaderboardScreenV4.tsx   |
| `GameStatsV4`         | `GameStatsScreenV4`         | src/gamesV4/screens/GameStatsScreenV4.tsx         |
| `AchievementsHub`     | `AchievementsHubScreen`     | src/gamesV4/screens/AchievementsHubScreen.tsx     |
| `AchievementSection`  | `AchievementSectionScreen`  | src/gamesV4/screens/AchievementSectionScreen.tsx  |
| `ProfileAchievements` | `ProfileAchievementsScreen` | src/screens/profile/ProfileAchievementsScreen.tsx |
| `LevelRewards`        | `LevelRewardsScreen`        | src/gamesV4/screens/LevelRewardsScreen.tsx        |

### GamesHubScreenV4 — KEEP but re-route access

**File**: [src/gamesV4/screens/GamesHubScreenV4.tsx](src/gamesV4/screens/GamesHubScreenV4.tsx)

This screen needs to become a MainStack screen (promoted from tab to full-screen overlay) so it can be navigated to from the new Games button in the Messages header.

**Current import in RootNavigator.tsx** (line ~100):

```typescript
import GamesHubScreenV4 from "@/gamesV4/screens/GamesHubScreenV4";
```

**Action needed**: Add as a new MainStack screen entry (like `GamesHub: undefined` in `MainStackParamList`) and register it in MainStack.

---

## Inbox (→ Messages) — Full Component Inventory

### Main Screen

**File**: [src/screens/chat/ChatListScreenV2.tsx](src/screens/chat/ChatListScreenV2.tsx) (~900 lines)

**Current render structure**:

```
<View container>
  <InboxHeader />                  ← Header with avatar, title, search, settings, archive toggle
  <InboxTabs />                    ← Filter tabs (hidden when showing archive)
  {showRequestsTab ? (
    <FlatList requests />          ← Friend requests, group invites, message requests
  ) : (
    <FlatList conversations />     ← Conversation list with swipeable items
  )}
  <InboxFAB />                     ← Multi-action FAB (hidden when showing archive)
  <ConversationContextMenu />      ← Long-press popup
  <MuteOptionsSheet />             ← Mute duration picker
  <DeleteConfirmDialog />          ← Delete confirmation
</View>
```

**Current background color**: `colors.background`

### Component Files (src/components/chat/inbox/)

| Component                   | File                                                                                 | Lines | Description                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------- |
| **InboxHeader**             | [InboxHeader.tsx](src/components/chat/inbox/InboxHeader.tsx)                         | ~200  | Top bar: user avatar, centered title ("Inbox"/"Archive"), search, connections, settings, archive toggle buttons |
| **InboxTabs**               | [InboxTabs.tsx](src/components/chat/inbox/InboxTabs.tsx)                             | ~150  | Horizontal scrollable filter tabs: All, Unread, Groups, DMs, Requests — with badge counters                     |
| **ConversationItem**        | [ConversationItem.tsx](src/components/chat/inbox/ConversationItem.tsx)               | ~250  | Single conversation row: avatar, name, last message preview, timestamp, unread badge, pin/mute icons            |
| **SwipeableConversation**   | [SwipeableConversation.tsx](src/components/chat/inbox/SwipeableConversation.tsx)     | ~250  | Swipe gesture wrapper: left swipe = Pin; right swipe = Mute + **Archive** + Delete                              |
| **ConversationContextMenu** | [ConversationContextMenu.tsx](src/components/chat/inbox/ConversationContextMenu.tsx) | ~200  | Long-press menu: Pin, Mute, Mark Unread, **Archive/Unarchive**, View Profile, Delete                            |
| **PinnedSection**           | [PinnedSection.tsx](src/components/chat/inbox/PinnedSection.tsx)                     | ~100  | Pinned conversations header section above main list                                                             |
| **InboxFAB**                | [InboxFAB.tsx](src/components/chat/inbox/InboxFAB.tsx)                               | ~100  | FAB.Group: New Message, New Group, Add Friend                                                                   |
| **EmptyState**              | [EmptyState.tsx](src/components/chat/inbox/EmptyState.tsx)                           | ~100  | Empty states: noConversations, allCaughtUp, noGroups, noDMs, noRequests, **archiveEmpty**                       |
| **DeleteConfirmDialog**     | [DeleteConfirmDialog.tsx](src/components/chat/inbox/DeleteConfirmDialog.tsx)         | ~80   | Delete confirmation dialog                                                                                      |
| **MuteOptionsSheet**        | [MuteOptionsSheet.tsx](src/components/chat/inbox/MuteOptionsSheet.tsx)               | ~100  | Mute duration picker: 1h, 8h, 1d, 1w, forever                                                                   |
| **FriendRequestItem**       | [FriendRequestItem.tsx](src/components/chat/inbox/FriendRequestItem.tsx)             | ~100  | Friend request row: accept/decline                                                                              |
| **GroupInviteItem**         | [GroupInviteItem.tsx](src/components/chat/inbox/GroupInviteItem.tsx)                 | ~100  | Group invite row: accept/decline                                                                                |
| **ProfilePreviewModal**     | [ProfilePreviewModal.tsx](src/components/chat/inbox/ProfilePreviewModal.tsx)         | ~100  | Avatar tap preview (noted as removed in index.ts but file exists)                                               |
| **unreadBadge**             | [unreadBadge.ts](src/components/chat/inbox/unreadBadge.ts)                           | ~30   | Badge text formatting utility                                                                                   |
| **index.ts**                | [index.ts](src/components/chat/inbox/index.ts)                                       | ~55   | Barrel exports for all inbox components                                                                         |

### Hooks

| Hook                        | File                                                                                    | Description                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **useInboxData**            | [src/hooks/useInboxData.ts](src/hooks/useInboxData.ts) (~800 lines)                     | Primary data hook: parallel DM + Group subscriptions, filtering, sorting, archive toggle, caching     |
| **useConversationActions**  | [src/hooks/useConversationActions.ts](src/hooks/useConversationActions.ts) (~500 lines) | Action handlers: togglePin, **toggleArchive**, mute, unmute, deleteConversation, markUnread, markRead |
| **useUnifiedInboxRequests** | [src/hooks/useUnifiedInboxRequests.ts](src/hooks/useUnifiedInboxRequests.ts)            | Friend requests + group invites + message requests                                                    |

### Supporting Screens

| Screen                      | File                                                                                              | Description                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **InboxSearchScreen**       | [src/screens/chat/InboxSearchScreen.tsx](src/screens/chat/InboxSearchScreen.tsx) (~300 lines)     | Search conversations/messages with filter types            |
| **InboxSettingsScreen**     | [src/screens/chat/InboxSettingsScreen.tsx](src/screens/chat/InboxSettingsScreen.tsx) (~300 lines) | Notification level, read receipts, typing indicators, etc. |
| **ScheduledMessagesScreen** | [src/screens/chat/ScheduledMessagesScreen.tsx](src/screens/chat/ScheduledMessagesScreen.tsx)      | View/manage scheduled messages                             |

### InboxHeader — Current Layout Detail

**File**: [src/components/chat/inbox/InboxHeader.tsx](src/components/chat/inbox/InboxHeader.tsx)

```
┌────────────────────────────────────────────────────────────┐
│ [SafeArea Padding]                                          │
│                                                              │
│ [Avatar] [🔍]          Inbox/Archive          [👥] [⚙] [📦] │
│                                                              │
│  Left:                  Center:               Right:         │
│  - User avatar (→ Profile)  Title text       - Connections   │
│  - Search button                              - Settings     │
│                                               - Archive toggle│
└────────────────────────────────────────────────────────────┘
```

**Props**:

```typescript
interface InboxHeaderProps {
  onSearchPress: () => void;
  onSettingsPress: () => void;
  showArchived: boolean; // ← REMOVE (archive feature going away)
  onArchiveToggle: () => void; // ← REMOVE
}
```

**Current styling**:

- `backgroundColor: colors.surface`
- Title color: `colors.text`
- Icon colors: `colors.textSecondary`
- Height: `48 + safeAreaTop`

### InboxTabs — Current Layout Detail

**File**: [src/components/chat/inbox/InboxTabs.tsx](src/components/chat/inbox/InboxTabs.tsx)

**Tab definitions**:

```typescript
const tabs: Tab[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread", badge: unreadCount > 0 ? 1 : undefined },
  { key: "groups", label: "Groups" },
  { key: "dms", label: "DMs" },
  {
    key: "requests",
    label: "Requests",
    badge: requestsCount > 0 ? requestsCount : undefined,
  },
];
```

**Styling**:

- Container: `borderBottomColor: colors.border`
- Active tab: `backgroundColor: colors.primary + "20"` (primary with 20% opacity)
- Active text: `color: colors.primary`
- Inactive text: `color: colors.textSecondary`
- Tab shape: scrollable horizontal ScrollView with rounded pill-shaped tabs

### InboxFilter Type

```typescript
// Defined in useInboxData.ts
export type InboxFilter = "all" | "unread" | "groups" | "dms" | "requests";
```

---

## Archive Feature — Complete Removal Scope

The archive feature is threaded through multiple files. Here is every place it needs to be removed:

### 1. InboxHeader.tsx — Archive Toggle Button

**Current**: Has `showArchived` prop and archive toggle `IconButton` (icon: `"archive"` / `"inbox"`).

**Remove**:

- `showArchived` prop
- `onArchiveToggle` prop
- Archive toggle `IconButton`
- `handleArchiveToggle` callback
- Title switch: `showArchived ? "Archive" : "Inbox"` (→ always "Messages")

### 2. SwipeableConversation.tsx — Archive Swipe Action

**Current**: Right-swipe reveals 3 actions: Mute (warning color), **Archive** (info color), Delete (error color).

**Remove**:

- `onArchive` prop from `SwipeableConversationProps`
- Archive action button in `renderRightActions`
- Reduce `RIGHT_ACTION_WIDTH` from 180 to ~120 (2 actions instead of 3)

### 3. ConversationContextMenu.tsx — Archive Menu Item

**Current**: Menu includes "Archive/Unarchive" item with `onArchive` prop.

**Remove**:

- `onArchive` prop from `ConversationContextMenuProps`
- Archive menu item from `menuItems` array

### 4. ChatListScreenV2.tsx — Archive State & Handlers

**Current**: Uses `showArchived`, `setShowArchived` from `useInboxData`, passes archive handlers everywhere.

**Remove**:

- `showArchived` / `setShowArchived` usage
- `onArchiveToggle` prop passed to `InboxHeader`
- `handleContextMenuArchive` callback
- `onArchive` prop in `ConversationContextMenu`
- `onArchive` prop in `SwipeableConversation` render
- Archive empty state type `"archiveEmpty"` usage

### 5. useInboxData.ts — Archive Filtering

**Current** (line ~690):

```typescript
all = all.filter((c) => c.memberState.archived === showArchived);
```

**Remove**:

- `showArchived` state (line 282): `const [showArchived, setShowArchived] = useState(false);`
- `setShowArchived` from return value
- Archive filter line from `conversations` useMemo
- References in aggregation branch (lines 769-770)

### 6. useConversationActions.ts — toggleArchive Action

**Current**: Exports `toggleArchive` which calls `setDMArchived` or `setGroupArchived`.

**Remove**:

- `toggleArchive` function
- Imports: `setArchived as setDMArchived` from chatMembers, `setGroupArchived` from groupMembers

### 7. EmptyState.tsx — archiveEmpty Type

**Current**: Has `"archiveEmpty"` empty state type with archive icon/title/description.

**Remove**:

- `"archiveEmpty"` from type union
- `archiveEmpty` entry from config object

### 8. Backend Service Functions (can keep but unused)

| Function             | File                         | Note                                                    |
| -------------------- | ---------------------------- | ------------------------------------------------------- |
| `setArchived()`      | src/services/chatMembers.ts  | DM archive toggle — can remove or leave as dead code    |
| `setGroupArchived()` | src/services/groupMembers.ts | Group archive toggle — can remove or leave as dead code |

### 9. InboxConversation Type — archived field

The `memberState.archived` field is part of the `InboxConversation` type. Consider whether to remove it from the type or just stop using it.

---

## Navigation Type Definitions

**File**: [src/types/navigation/root.ts](src/types/navigation/root.ts)

### Current AppTabsParamList (to be modified)

```typescript
export type AppTabsParamList = {
  Shop: undefined;
  Inbox: NavigatorScreenParams<InboxStackParamList> | undefined;
  Games: undefined; // ← REMOVE
  Moments: NavigatorScreenParams<MomentsStackParamList> | undefined; // ← REMOVE
  Profile: NavigatorScreenParams<ProfileTabStackParamList> | undefined;
};
```

### Target AppTabsParamList

```typescript
export type AppTabsParamList = {
  Profile: NavigatorScreenParams<ProfileTabStackParamList> | undefined;
  Messages: NavigatorScreenParams<InboxStackParamList> | undefined; // ← RENAMED from Inbox
  Shop: undefined;
};
```

### InboxStackParamList (rename to MessagesStackParamList)

```typescript
// Current
export type InboxStackParamList = {
  ChatList:
    | { initialFilter?: "all" | "unread" | "groups" | "dms" | "requests" }
    | undefined;
  ScheduledMessages: undefined;
  GroupInvites: undefined;
  InboxSettings: undefined;
  InboxSearch: undefined;
};
```

### MainStackParamList — Add GamesHub

Add a new route for GamesHub since it's being removed from tabs:

```typescript
GamesHub: undefined; // ← NEW: moved from tab to MainStack screen
```

### MomentsStackParamList — REMOVE entirely

```typescript
// DELETE THIS TYPE
export type MomentsStackParamList = {
  StoriesList: undefined;
  StoryViewer: OptionalRouteParams;
};
```

---

## Deep Linking Configuration

**File**: [src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx) (~lines 770-810)

### Current Deep Links to Modify

```typescript
config: {
  screens: {
    // ... auth screens ...
    MainTabs: {
      screens: {
        Shop: "shop",
        Inbox: {                         // ← RENAME key to Messages
          screens: {
            ChatList: "inbox",           // ← Can keep path or change to "messages"
          },
        },
        Games: "games",                  // ← REMOVE (move to MainStack deep link)
        Moments: "moments",             // ← REMOVE entirely
        Profile: {
          screens: {
            ProfileMain: "profile",
            Settings: "settings",
            BadgeCollection: "badges",
          },
        },
      },
    },
    // ...main stack screens...
    // ADD: GamesHub: "games" here at MainStack level
  },
},
```

---

## Theme & Styling System

**File**: [constants/theme.ts](constants/theme.ts)

### Relevant Color Tokens (ThemeColors interface)

For the Snapchat-style unified-color redesign, these are the key tokens:

```typescript
// Backgrounds — currently header and screen use different colors
background: string;           // Screen/scroll area background
surface: string;              // Cards, elevated surfaces, CURRENT header bg
surfaceVariant: string;       // Slight variation for differentiation
surfaceElevated: string;      // Higher elevation surfaces

// Header (separate from surface currently)
headerBackground: string;     // Navigator header background
headerText: string;           // Navigator header text color

// Tab bar
tabActive: string;            // Active tab icon/label color
tabInactive: string;          // Inactive tab icon/label color

// Text
text: string;                 // Primary text
textSecondary: string;        // Secondary/muted text
textMuted: string;            // More muted text

// Primary
primary: string;              // Brand/accent color
primaryContainer: string;     // Primary container bg

// Borders
border: string;               // Standard border
divider: string;              // Divider lines

// Message bubbles (optional per theme)
messageSentBackground?: string;
messageSentText?: string;
messageReceivedBackground?: string;
messageReceivedText?: string;
```

### Current Inbox Color Usage

| Element              | Current Color Token     | Note                                           |
| -------------------- | ----------------------- | ---------------------------------------------- |
| Screen background    | `colors.background`     | Main container                                 |
| Header background    | `colors.surface`        | InboxHeader uses surface, not headerBackground |
| Header title text    | `colors.text`           |                                                |
| Header icon buttons  | `colors.textSecondary`  | Search, connections, settings, archive         |
| Tab container border | `colors.border`         | Bottom border of tabs area                     |
| Active tab bg        | `colors.primary + "20"` | 20% opacity primary                            |
| Active tab text      | `colors.primary`        |                                                |
| Inactive tab text    | `colors.textSecondary`  |                                                |
| Tab bar bg           | `colors.surface`        | Bottom tab navigator                           |
| Tab bar top border   | `colors.border`         |                                                |

**Key observation for Snapchat-style redesign**: Currently, the header (`colors.surface`) and background (`colors.background`) use different colors in most themes. A Snapchat-style design would use a single consistent color across header, tabs, list area, and background — likely a new token or repurposing `colors.background`.

---

## File-by-File Change Map

This is a comprehensive list of every file that needs modification, organized by change type.

### Files to DELETE (Moments removal)

| File                                                   | Reason                              |
| ------------------------------------------------------ | ----------------------------------- |
| src/screens/stories/MomentsUnderConstructionScreen.tsx | Moments screen                      |
| src/screens/stories/StoriesScreen.tsx                  | Moments screen (unused but present) |
| src/screens/stories/StoryViewerScreen.tsx              | Moments viewer                      |
| src/services/stories.ts                                | Moments service                     |
| src/services/story/snapStoryService.ts                 | Story service                       |
| src/services/snaps.ts                                  | Snap service                        |

### Files to MODIFY — Navigation

| File                                 | Changes Required                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **src/navigation/RootNavigator.tsx** | Remove Moments imports, MomentsStack_Nav, MomentsStack(), Moments Tab.Screen, Games Tab.Screen; Remove Moments/Games icon cases; Rename Inbox to Messages; Reorder tabs to Profile/Messages/Shop; Add GamesHub as MainStack screen; Remove ROUTES_WITH_HIDDEN_TAB_BAR if empty; Update deep linking config |
| **src/types/navigation/root.ts**     | Remove MomentsStackParamList; Remove Games + Moments from AppTabsParamList; Rename Inbox → Messages in AppTabsParamList; Rename InboxStackParamList → MessagesStackParamList (optional); Add GamesHub to MainStackParamList                                                                                |
| **src/types/navigation/index.ts**    | No change needed (barrel export)                                                                                                                                                                                                                                                                           |
| **src/services/navigationRef.ts**    | No change needed (generic navigation)                                                                                                                                                                                                                                                                      |

### Files to MODIFY — Inbox → Messages Rename

| File                                          | Changes Required                                                                                                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **src/components/chat/inbox/InboxHeader.tsx** | Remove archive props/button; Change title from "Inbox" to "Messages"; Add Games button (gamepad icon → navigates to GamesHub); Unify background color for Snapchat style                                  |
| **src/components/chat/inbox/InboxTabs.tsx**   | Redesign for Snapchat-style unified color                                                                                                                                                                 |
| **src/components/chat/inbox/index.ts**        | Update exports if props change                                                                                                                                                                            |
| **src/screens/chat/ChatListScreenV2.tsx**     | Remove archive state/handlers; Remove archive prop from InboxHeader; Remove archive from ConversationContextMenu; Remove archive from SwipeableConversation; Redesign container styling for unified color |

### Files to MODIFY — Archive Removal

| File                                                      | Changes Required                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| **src/components/chat/inbox/InboxHeader.tsx**             | Remove showArchived prop, onArchiveToggle prop, archive toggle button |
| **src/components/chat/inbox/SwipeableConversation.tsx**   | Remove onArchive prop, remove archive action from right swipe         |
| **src/components/chat/inbox/ConversationContextMenu.tsx** | Remove onArchive prop, remove archive menu item                       |
| **src/components/chat/inbox/EmptyState.tsx**              | Remove "archiveEmpty" type and config entry                           |
| **src/screens/chat/ChatListScreenV2.tsx**                 | Remove showArchived/setShowArchived usage, archive-related callbacks  |
| **src/hooks/useInboxData.ts**                             | Remove showArchived state, setShowArchived, archive filter line       |
| **src/hooks/useConversationActions.ts**                   | Remove toggleArchive function, remove archive service imports         |
| **src/services/chatMembers.ts**                           | Optionally remove setArchived function                                |
| **src/services/groupMembers.ts**                          | Optionally remove setGroupArchived function                           |

### Files POTENTIALLY Affected (search for "Inbox" string references)

These files may have hardcoded "Inbox" strings that should be updated to "Messages":

| File                                                                         | Likely Reference         |
| ---------------------------------------------------------------------------- | ------------------------ |
| src/screens/chat/InboxSearchScreen.tsx                                       | Screen name, header text |
| src/screens/chat/InboxSettingsScreen.tsx                                     | Screen name, header text |
| Any notification handler that references "Inbox" route name                  | Route name change        |
| src/store/InAppNotificationsContext (if it references "ChatList" or "Inbox") | Screen name checks       |

---

## Appendix: Current Imports in RootNavigator.tsx

For reference, here are all imports at the top of RootNavigator.tsx that are relevant to this redesign:

```typescript
// REMOVE these (Moments):
import MomentsUnderConstructionScreen from "@/screens/stories/MomentsUnderConstructionScreen";
import StoryViewerScreen from "@/screens/stories/StoryViewerScreen";

// KEEP these (Games — still needed for MainStack):
import GamesHubScreenV4 from "@/gamesV4/screens/GamesHubScreenV4";
import GameStatsScreenV4 from "@/gamesV4/screens/GameStatsScreenV4";
// ... (all other game screen imports stay)

// KEEP these (Inbox/Messages):
import ChatListScreen from "@/screens/chat/ChatListScreenV2";
import InboxSearchScreen from "@/screens/chat/InboxSearchScreen";
import InboxSettingsScreen from "@/screens/chat/InboxSettingsScreen";

// KEEP these (Shop, Profile, etc.):
import ShopHubScreen from "@/screens/shop/ShopHubScreen";
// ... all other imports
```

### Navigator Declarations to Modify

```typescript
// KEEP (rename variable optional)
const InboxStack_Nav = createNativeStackNavigator<InboxStackParamList>();

// REMOVE
const MomentsStack_Nav = createNativeStackNavigator<MomentsStackParamList>();

// KEEP
const ProfileStack_Nav = createNativeStackNavigator<ProfileTabStackParamList>();
const MainStack_Nav = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<AppTabsParamList>();
```

---

## Implemented UI Changes — Messages Screen Redesign

> **Status**: Implemented and verified across all 30 themes.

### 1. Unified Background Color

All elements on the Messages screen now share `colors.background` for a single continuous surface:

| Element                 | Before                        | After                           |
| ----------------------- | ----------------------------- | ------------------------------- |
| Screen container        | `colors.background`           | `colors.background` (unchanged) |
| InboxHeader             | `colors.surface`              | `colors.background`             |
| InboxTabs container     | `colors.background`           | `colors.background` (unchanged) |
| ConversationItem rows   | `colors.surface`              | `colors.background`             |
| Message request rows    | `colors.surface`              | `colors.background`             |
| Online indicator border | `colors.surface`              | `colors.background`             |
| Bottom tab bar          | `colors.surface` + 1px border | `colors.background`             |

### 2. Bottom Tab Bar Separator

A hairline border separates the bottom navigation from the content area:

```typescript
borderTopColor: colors.border,   // Theme-aware — was hardcoded #CCCCCC
borderTopWidth: StyleSheet.hairlineWidth,
paddingTop: 8,                   // Extra spacing between border and icons
elevation: 0,                    // No shadow
```

### 3. Header Icon Button Circles

All header icon buttons (search, games, connections, settings) have circular backgrounds. The avatar/PFP is excluded.

**Cross-theme implementation** using `isDark` from `useAppTheme()`:

```typescript
const iconBtnBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
// Applied via: containerColor={iconBtnBg}
```

**Why not a theme token?** Analysis of all 30 themes revealed that `surfaceVariant` is identical to `background` on all 6 AMOLED themes and nearly identical on most dark/light themes, making token-based circles invisible. The `isDark`-based rgba approach guarantees visible contrast on every theme:

- **Light themes**: subtle dark tint (8% black)
- **Dark themes**: subtle light tint (12% white)
- **AMOLED themes**: subtle light tint (12% white on pure black)

### 4. Filter Tab Pill Backgrounds

InboxTabs inactive state also uses `isDark`-aware rgba:

```typescript
const inactiveTabBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
// Active tabs: colors.primary + "18" (unchanged)
```

### 5. FAB Position

`InboxFAB` padding adjusted from 82 → 90 to accommodate the taller tab bar:

```typescript
fabGroup: {
  paddingBottom: 90;
}
```

### Cross-Theme Verification

All color tokens used in the Messages screen redesign were verified against all 30 themes:

| Token           | Required in ThemeColors? | Defined in all 30 themes? |
| --------------- | ------------------------ | ------------------------- |
| `background`    | ✅ Yes                   | ✅ 30/30                  |
| `text`          | ✅ Yes                   | ✅ 30/30                  |
| `textSecondary` | ✅ Yes                   | ✅ 30/30                  |
| `textMuted`     | ✅ Yes                   | ✅ 30/30                  |
| `primary`       | ✅ Yes                   | ✅ 30/30                  |
| `border`        | ✅ Yes                   | ✅ 30/30                  |
| `tabActive`     | ✅ Yes                   | ✅ 30/30                  |
| `tabInactive`   | ✅ Yes                   | ✅ 30/30                  |

Dynamic rgba values (icon circles, inactive tabs) use `isDark` boolean from `useAppTheme()` — no theme token dependency.

### Files Modified

| File                                                                                             | Change                                                                    |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [src/components/chat/inbox/InboxHeader.tsx](src/components/chat/inbox/InboxHeader.tsx)           | `isDark`-based icon circle backgrounds, unified `colors.background`       |
| [src/components/chat/inbox/InboxTabs.tsx](src/components/chat/inbox/InboxTabs.tsx)               | `isDark`-based inactive tab backgrounds                                   |
| [src/components/chat/inbox/ConversationItem.tsx](src/components/chat/inbox/ConversationItem.tsx) | `colors.background` for row + online indicator border                     |
| [src/components/chat/inbox/InboxFAB.tsx](src/components/chat/inbox/InboxFAB.tsx)                 | FAB paddingBottom 82 → 90                                                 |
| [src/screens/chat/ChatListScreenV2.tsx](src/screens/chat/ChatListScreenV2.tsx)                   | Request rows use `colors.background`                                      |
| [src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx)                             | Tab bar: `colors.background` bg, `colors.border` separator, paddingTop: 8 |
