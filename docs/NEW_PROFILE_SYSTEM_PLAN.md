# New Profile System - Comprehensive Implementation Plan

**Version:** 2.0
**Date:** February 4, 2026
**Status:** Ready for Implementation
**Target Agent:** Claude Opus 4.5

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Requirements](#2-core-requirements)
3. [Type Definitions](#3-type-definitions)
4. [Database Schema](#4-database-schema)
5. [Component Architecture](#5-component-architecture)
6. [Service Layer](#6-service-layer)
7. [Screen Implementations](#7-screen-implementations)
8. [Avatar Decoration System](#8-avatar-decoration-system)
9. [Theme Inheritance System](#9-theme-inheritance-system)
10. [Settings Integration](#10-settings-integration)
11. [Status & Mood Indicator System](#11-status--mood-indicator-system) ⭐ NEW
12. [Mutual Friends Display System](#12-mutual-friends-display-system) ⭐ NEW
13. [Profile Sharing System](#13-profile-sharing-system) ⭐ NEW
14. [Privacy & Visibility Settings](#14-privacy--visibility-settings) ⭐ NEW
15. [Friendship Info Display](#15-friendship-info-display) ⭐ NEW
16. [Block/Report/Mute System](#16-blockreportmute-system) ⭐ NEW
17. [DM Context Menu Migration](#17-dm-context-menu-migration) ⭐ NEW
18. [Implementation Phases](#18-implementation-phases)
19. [File Structure](#19-file-structure)
20. [Testing Requirements](#20-testing-requirements)
21. [Asset Management Guide](#21-asset-management-guide)

---

## 1. Executive Summary

### Vision

Create a completely new profile system that allows users to fully express their identity through custom profile pictures, badges, game scores, bios, and themed backgrounds. The system will support two distinct viewing modes: an editable "My Profile" view and a read-only "User Profile" view for visiting other users' profiles.

### Key Features

| Feature                | Description                                           | Priority |
| ---------------------- | ----------------------------------------------------- | -------- |
| Custom Profile Picture | Upload any image from device library                  | P0       |
| Avatar Decorations     | 320x320 PNG/GIF overlays on profile picture           | P0       |
| Badge Display          | Showcase earned badges on profile                     | P0       |
| Bio Section            | User-editable text bio                                | P0       |
| Top Game Scores        | Optional display of best game performances            | P1       |
| Background Themes      | Customizable profile backgrounds                      | P0       |
| Dual Profile Views     | "My Profile" (editable) vs "User Profile" (view-only) | P0       |
| Theme Inheritance      | View other profiles in their theme or your own        | P1       |
| Social Actions         | Friend/Message/Call buttons on other profiles         | P0       |

### Additional Suggested Features

| Feature                     | Description                                              | Priority |
| --------------------------- | -------------------------------------------------------- | -------- |
| Profile Visibility Settings | Control what others can see on your profile              | P1       |
| Profile Banner              | Header image separate from background                    | P2       |
| Featured Badge Slots        | Up to 5 badges pinned prominently                        | P0       |
| Profile Music               | Optional background music on profile (with user consent) | P3       |
| Last Active Status          | Show when user was last online (with privacy option)     | P1       |
| Mutual Friends Display      | Show shared friends when viewing another profile         | P1       |
| Profile Share               | Generate shareable profile link/QR code                  | P2       |
| Profile Views Counter       | Track how many people visited your profile               | P3       |
| Status/Mood                 | Short status message or mood indicator                   | P1       |
| Social Links                | Optional links to other social platforms                 | P2       |

---

## 2. Core Requirements

### 2.1 Profile Picture System

```typescript
/**
 * REQUIREMENTS:
 * 1. User can select ANY image from their device photo library
 * 2. Image is uploaded to Firebase Storage under users/{uid}/profile/
 * 3. Image is resized/compressed to reasonable size (max 1024x1024)
 * 4. Support for JPEG, PNG, HEIC formats
 * 5. Fallback to colored circle with initials if no picture set
 * 6. Profile picture cached locally for performance
 */
```

### 2.2 Avatar Decorations

```typescript
/**
 * REQUIREMENTS:
 * 1. Decorations are 320x320 pixels (fixed size for consistency)
 * 2. Support PNG format with transparency
 * 3. Support animated GIF format
 * 4. Decoration overlays perfectly on top of profile picture
 * 5. Decorations are stored in assets/decorations/ directory
 * 6. User can own multiple decorations, equip one at a time
 * 7. Decorations can be earned, purchased, or exclusive
 */
```

### 2.3 Badge Display

```typescript
/**
 * REQUIREMENTS:
 * 1. User can feature up to 5 badges on their profile
 * 2. Badges are displayed in a dedicated section
 * 3. Tapping a badge shows details modal
 * 4. Option to view all earned badges
 * 5. Rarity-based styling (common, rare, epic, legendary, mythic)
 */
```

### 2.4 Game Scores Display

```typescript
/**
 * REQUIREMENTS:
 * 1. Optional section - user can toggle visibility
 * 2. Shows top 3-5 game high scores
 * 3. User can select which games to display
 * 4. Includes game icon, name, and score
 * 5. Can compare with viewer's scores when viewing other profiles
 */
```

### 2.5 Bio Section

```typescript
/**
 * REQUIREMENTS:
 * 1. Free-text bio, max 200 characters
 * 2. Support for emoji
 * 3. Optional - can be left empty
 * 4. Profanity filter on save
 * 5. Displayed prominently on profile
 */
```

### 2.6 Background Themes

```typescript
/**
 * REQUIREMENTS:
 * 1. Predefined theme collection (colors, gradients, patterns)
 * 2. Custom image upload option (premium feature)
 * 3. Theme affects entire profile screen appearance
 * 4. Themes can be earned, purchased, or unlocked
 * 5. Default theme for new users
 */
```

### 2.7 Dual Profile Views

```typescript
/**
 * MY PROFILE VIEW (OwnProfileScreen):
 * - Full editing capabilities
 * - Change profile picture
 * - Manage avatar decoration
 * - Edit bio
 * - Manage featured badges
 * - Configure game scores display
 * - Change background theme
 * - Settings button
 * - Sign out button
 * - View all badges button
 * - View all achievements button
 *
 * USER PROFILE VIEW (UserProfileScreen):
 * - Read-only display
 * - Shows their profile picture + decoration
 * - Shows their bio
 * - Shows their featured badges
 * - Shows their game scores (if enabled)
 * - Uses their theme (or viewer's theme based on settings)
 *
 * DYNAMIC ACTION BUTTONS (based on relationship):
 * - Not friends: "Add Friend" button
 * - Friend request pending (you sent): "Request Pending" (disabled or cancel option)
 * - Friend request pending (they sent): "Accept Request" / "Decline"
 * - Already friends: "Message" button, "Call" button, "Remove Friend" option
 * - Blocked: "Unblock" option
 * - You're blocked: Limited profile view or error
 */
```

### 2.8 Theme Inheritance

```typescript
/**
 * REQUIREMENTS:
 * 1. By default, view other profiles using THEIR theme
 * 2. Setting to disable this: "Always use my theme on other profiles"
 * 3. Setting stored in user preferences (local + synced)
 * 4. Smooth theme transition when opening/closing profile
 */
```

---

## 3. Type Definitions

Create these types in `src/types/profile.ts`:

```typescript
// =============================================================================
// PROFILE PICTURE & AVATAR DECORATIONS
// =============================================================================

/**
 * User's profile picture configuration
 */
export interface ProfilePicture {
  /** Firebase Storage URL of the profile picture */
  url: string | null;
  /** Thumbnail URL (lower resolution for lists) */
  thumbnailUrl?: string;
  /** When the picture was last updated */
  updatedAt: number;
  /** Original filename for reference */
  originalFilename?: string;
}

/**
 * Avatar decoration definition (stored in app assets)
 */
export interface AvatarDecoration {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the decoration */
  description?: string;
  /** Path to the decoration asset (PNG or GIF) */
  assetPath: string;
  /** Whether this is an animated decoration (GIF) */
  animated: boolean;
  /** Rarity for display styling */
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  /** How to obtain this decoration */
  obtainMethod: DecorationObtainMethod;
  /** Category for organization */
  category: DecorationCategory;
  /** Whether this is currently available */
  available: boolean;
  /** Tags for filtering */
  tags?: string[];
  /** Sort order in lists */
  sortOrder?: number;
}

export type DecorationCategory =
  | "seasonal" // Holiday/event themed
  | "achievement" // Earned through gameplay
  | "premium" // Purchased
  | "exclusive" // Limited time/special
  | "basic"; // Default/starter options

export interface DecorationObtainMethod {
  type: "free" | "achievement" | "purchase" | "event" | "exclusive";
  /** For achievements */
  achievementId?: string;
  /** For purchases */
  priceTokens?: number;
  priceUSD?: number;
  /** For events */
  eventId?: string;
  eventName?: string;
  /** For time-limited availability */
  availableFrom?: number;
  availableTo?: number;
}

/**
 * User's equipped avatar decoration
 */
export interface UserAvatarDecoration {
  /** ID of the equipped decoration (null if none) */
  decorationId: string | null;
  /** When it was equipped */
  equippedAt?: number;
}

/**
 * User's owned decorations (stored in Firestore)
 */
export interface UserOwnedDecoration {
  decorationId: string;
  obtainedAt: number;
  obtainedVia: "free" | "achievement" | "purchase" | "event" | "gift";
}

// =============================================================================
// PROFILE CONTENT
// =============================================================================

/**
 * User's bio configuration
 */
export interface ProfileBio {
  /** The bio text (max 200 chars) */
  text: string;
  /** When it was last updated */
  updatedAt: number;
}

/**
 * User's profile status/mood
 */
export interface ProfileStatus {
  /** Status text or emoji */
  status: string;
  /** Optional mood indicator */
  mood?: "happy" | "busy" | "gaming" | "away" | "custom";
  /** When it was set */
  setAt: number;
  /** Auto-expire timestamp (optional) */
  expiresAt?: number;
}

/**
 * Game score display configuration
 */
export interface ProfileGameScore {
  gameId: string;
  gameName: string;
  gameIcon: string;
  score: number;
  achievedAt: number;
  /** Position in user's display order */
  displayOrder: number;
}

export interface ProfileGameScoresConfig {
  /** Whether to show game scores on profile */
  enabled: boolean;
  /** Which games to display (max 5) */
  displayedGames: ProfileGameScore[];
  /** Last updated timestamp */
  updatedAt: number;
}

// =============================================================================
// PROFILE THEMES & BACKGROUNDS
// =============================================================================

/**
 * Profile theme/background definition
 */
export interface ProfileTheme {
  id: string;
  name: string;
  description?: string;
  /** Preview image path */
  previewPath: string;
  /** Theme type */
  type: "solid" | "gradient" | "image" | "pattern" | "animated";
  /** Configuration based on type */
  config: ProfileThemeConfig;
  /** Rarity for styling */
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  /** How to obtain */
  obtainMethod: ThemeObtainMethod;
  /** Whether currently available */
  available: boolean;
  /** Text color to use with this theme (light/dark auto-detect) */
  textColorMode: "light" | "dark" | "auto";
}

export type ProfileThemeConfig =
  | SolidThemeConfig
  | GradientThemeConfig
  | ImageThemeConfig
  | PatternThemeConfig
  | AnimatedThemeConfig;

export interface SolidThemeConfig {
  type: "solid";
  color: string;
}

export interface GradientThemeConfig {
  type: "gradient";
  colors: string[];
  angle: number; // 0-360
}

export interface ImageThemeConfig {
  type: "image";
  imageUrl: string;
  /** How to display the image */
  fit: "cover" | "contain" | "fill";
  /** Optional overlay for text readability */
  overlay?: string; // rgba color
}

export interface PatternThemeConfig {
  type: "pattern";
  patternId: string;
  primaryColor: string;
  secondaryColor?: string;
}

export interface AnimatedThemeConfig {
  type: "animated";
  /** Lottie animation or video URL */
  animationUrl: string;
  /** Fallback static image */
  fallbackImageUrl: string;
}

export interface ThemeObtainMethod {
  type: "free" | "default" | "achievement" | "purchase" | "event" | "exclusive";
  achievementId?: string;
  priceTokens?: number;
  priceUSD?: number;
  eventId?: string;
}

/**
 * User's theme configuration
 */
export interface UserThemeConfig {
  /** Currently equipped theme ID */
  equippedThemeId: string;
  /** Custom uploaded background (premium) */
  customBackgroundUrl?: string;
  /** When theme was last changed */
  updatedAt: number;
}

// =============================================================================
// FEATURED BADGES
// =============================================================================

/**
 * User's featured badges configuration
 */
export interface FeaturedBadgesConfig {
  /** Up to 5 featured badge IDs in display order */
  badgeIds: string[];
  /** Last updated timestamp */
  updatedAt: number;
}

// =============================================================================
// FULL USER PROFILE
// =============================================================================

/**
 * Complete user profile data (stored in Firestore Users collection)
 * This extends the existing User model
 */
export interface UserProfileData {
  // Existing User fields (from models.ts)
  uid: string;
  username: string;
  usernameLower: string;
  displayName: string;

  // NEW: Profile picture (replaces avatarConfig)
  profilePicture: ProfilePicture;

  // NEW: Avatar decoration
  avatarDecoration: UserAvatarDecoration;

  // NEW: Bio
  bio: ProfileBio;

  // NEW: Status (optional)
  status?: ProfileStatus;

  // NEW: Game scores display
  gameScores: ProfileGameScoresConfig;

  // NEW: Theme configuration
  theme: UserThemeConfig;

  // NEW: Featured badges
  featuredBadges: FeaturedBadgesConfig;

  // NEW: Privacy settings
  privacy: ProfilePrivacySettings;

  // NEW: Profile metadata
  profileViews?: number;
  lastProfileUpdate: number;

  // Existing fields
  expoPushToken?: string;
  createdAt: number;
  lastActive: number;
}

/**
 * Privacy settings for profile
 */
export interface ProfilePrivacySettings {
  /** Who can see your game scores */
  showGameScores: "everyone" | "friends" | "nobody";
  /** Who can see your badges */
  showBadges: "everyone" | "friends" | "nobody";
  /** Who can see your last active time */
  showLastActive: "everyone" | "friends" | "nobody";
  /** Show mutual friends when viewing your profile */
  showMutualFriends: boolean;
}

// =============================================================================
// PROFILE VIEW CONTEXT
// =============================================================================

/**
 * Context for which profile view to render
 */
export interface ProfileViewContext {
  /** The user whose profile is being viewed */
  userId: string;
  /** Whether this is the current user's own profile */
  isOwnProfile: boolean;
  /** Relationship status with the profile owner */
  relationship: ProfileRelationship;
}

export type ProfileRelationship =
  | { type: "self" }
  | { type: "stranger" }
  | { type: "friend"; friendshipId: string; streakCount: number }
  | { type: "pending_sent"; requestId: string }
  | { type: "pending_received"; requestId: string }
  | { type: "blocked_by_you" }
  | { type: "blocked_by_them" };

// =============================================================================
// PROFILE ACTIONS
// =============================================================================

/**
 * Available actions on a profile based on relationship
 */
export interface ProfileActions {
  canAddFriend: boolean;
  canMessage: boolean;
  canCall: boolean;
  canAcceptRequest: boolean;
  canCancelRequest: boolean;
  canRemoveFriend: boolean;
  canBlock: boolean;
  canUnblock: boolean;
  canReport: boolean;
}

/**
 * Get available actions based on relationship
 */
export function getProfileActions(
  relationship: ProfileRelationship,
): ProfileActions {
  const baseActions: ProfileActions = {
    canAddFriend: false,
    canMessage: false,
    canCall: false,
    canAcceptRequest: false,
    canCancelRequest: false,
    canRemoveFriend: false,
    canBlock: true,
    canUnblock: false,
    canReport: true,
  };

  switch (relationship.type) {
    case "self":
      return { ...baseActions, canBlock: false, canReport: false };
    case "stranger":
      return { ...baseActions, canAddFriend: true };
    case "friend":
      return {
        ...baseActions,
        canMessage: true,
        canCall: true,
        canRemoveFriend: true,
      };
    case "pending_sent":
      return { ...baseActions, canCancelRequest: true };
    case "pending_received":
      return { ...baseActions, canAcceptRequest: true };
    case "blocked_by_you":
      return { ...baseActions, canBlock: false, canUnblock: true };
    case "blocked_by_them":
      return { ...baseActions, canBlock: false, canReport: false };
    default:
      return baseActions;
  }
}
```

---

## 4. Database Schema

### 4.1 Firestore Collections

```
/Users/{uid}
├── uid: string
├── username: string
├── usernameLower: string
├── displayName: string
├── profilePicture: {
│     url: string | null,
│     thumbnailUrl: string | null,
│     updatedAt: number
│   }
├── avatarDecoration: {
│     decorationId: string | null,
│     equippedAt: number
│   }
├── bio: {
│     text: string,
│     updatedAt: number
│   }
├── status: {
│     status: string,
│     mood: string | null,
│     setAt: number,
│     expiresAt: number | null
│   }
├── gameScores: {
│     enabled: boolean,
│     displayedGames: [...],
│     updatedAt: number
│   }
├── theme: {
│     equippedThemeId: string,
│     customBackgroundUrl: string | null,
│     updatedAt: number
│   }
├── featuredBadges: {
│     badgeIds: string[],
│     updatedAt: number
│   }
├── privacy: {
│     showGameScores: string,
│     showBadges: string,
│     showLastActive: string,
│     showMutualFriends: boolean
│   }
├── ownedDecorations: string[]  // Array of decoration IDs
├── ownedThemes: string[]       // Array of theme IDs
├── createdAt: number
├── lastActive: number
└── lastProfileUpdate: number

/Users/{uid}/OwnedDecorations/{decorationId}
├── decorationId: string
├── obtainedAt: number
└── obtainedVia: string

/Users/{uid}/OwnedThemes/{themeId}
├── themeId: string
├── obtainedAt: number
└── obtainedVia: string
```

### 4.2 Firebase Storage Structure

```
/users/{uid}/profile/
├── picture.jpg           # Main profile picture (max 1024x1024)
├── picture_thumb.jpg     # Thumbnail (128x128)
└── custom_background.jpg # Custom theme background (premium)
```

### 4.3 Default Values

```typescript
export const DEFAULT_PROFILE_DATA: Partial<UserProfileData> = {
  profilePicture: {
    url: null,
    thumbnailUrl: null,
    updatedAt: Date.now(),
  },
  avatarDecoration: {
    decorationId: null,
  },
  bio: {
    text: "",
    updatedAt: Date.now(),
  },
  gameScores: {
    enabled: false,
    displayedGames: [],
    updatedAt: Date.now(),
  },
  theme: {
    equippedThemeId: "default",
    updatedAt: Date.now(),
  },
  featuredBadges: {
    badgeIds: [],
    updatedAt: Date.now(),
  },
  privacy: {
    showGameScores: "everyone",
    showBadges: "everyone",
    showLastActive: "friends",
    showMutualFriends: true,
  },
};
```

---

## 5. Component Architecture

### 5.1 Component Tree

```
src/components/profile/
├── index.ts                          # Barrel export
│
├── ProfilePicture/
│   ├── ProfilePicture.tsx            # Main profile picture component
│   ├── ProfilePictureEditor.tsx      # Edit modal for picture
│   ├── ProfilePictureWithDecoration.tsx  # Picture + decoration overlay
│   ├── DecorationOverlay.tsx         # Renders the decoration on top
│   └── DecorationPicker.tsx          # Grid of available decorations
│
├── ProfileHeader/
│   ├── ProfileHeader.tsx             # Full header (picture + name + status)
│   ├── OwnProfileHeader.tsx          # Editable version
│   └── UserProfileHeader.tsx         # Read-only version
│
├── ProfileBio/
│   ├── ProfileBio.tsx                # Bio display
│   ├── ProfileBioEditor.tsx          # Bio edit modal
│   └── ProfileStatus.tsx             # Status/mood display
│
├── ProfileBadges/
│   ├── FeaturedBadges.tsx            # Featured badges display
│   ├── FeaturedBadgesEditor.tsx      # Select featured badges
│   └── BadgePreviewModal.tsx         # Badge detail modal
│
├── ProfileGameScores/
│   ├── GameScoresDisplay.tsx         # Game scores section
│   ├── GameScoresEditor.tsx          # Configure visible games
│   └── ScoreComparisonView.tsx       # Compare with visitor's scores
│
├── ProfileTheme/
│   ├── ProfileBackground.tsx         # Renders the theme background
│   ├── ThemePicker.tsx               # Theme selection grid
│   ├── ThemePreview.tsx              # Preview a theme
│   └── CustomBackgroundUploader.tsx  # Premium custom upload
│
├── ProfileActions/
│   ├── ProfileActionsBar.tsx         # Action buttons container
│   ├── AddFriendButton.tsx           # Add friend action
│   ├── MessageButton.tsx             # Send message action
│   ├── CallButton.tsx                # Start call action
│   ├── MoreOptionsMenu.tsx           # Block/Report/Remove menu
│   └── PendingRequestActions.tsx     # Accept/Decline buttons
│
└── ProfileSettings/
    ├── ProfileSettingsButton.tsx     # Navigate to settings
    ├── PrivacySettingsSection.tsx    # Privacy toggles
    └── SignOutButton.tsx             # Sign out action
```

### 5.2 Key Components Specifications

#### ProfilePictureWithDecoration.tsx

```typescript
interface ProfilePictureWithDecorationProps {
  /** Profile picture URL (null for default) */
  pictureUrl: string | null;
  /** Decoration ID (null for none) */
  decorationId: string | null;
  /** Display size */
  size: number;
  /** User's display name (for fallback initials) */
  displayName: string;
  /** Optional fallback color */
  fallbackColor?: string;
  /** Whether the picture is editable (shows edit icon on press) */
  editable?: boolean;
  /** Called when edit is pressed */
  onEditPress?: () => void;
  /** Loading state */
  loading?: boolean;
}

/**
 * IMPLEMENTATION NOTES:
 * - Profile picture displayed as circle
 * - Decoration overlaid on top with exact positioning
 * - Decoration is always 320x320, scaled to match size prop
 * - Support both PNG and GIF decorations
 * - Use react-native-fast-image for caching
 * - Fallback to colored circle with initials if no picture
 */
```

#### DecorationOverlay.tsx

```typescript
interface DecorationOverlayProps {
  /** Decoration ID to display */
  decorationId: string;
  /** Size to render (will scale 320x320 asset) */
  size: number;
}

/**
 * IMPLEMENTATION NOTES:
 * - Load decoration from local assets or remote URL
 * - For GIFs, use react-native-fast-image with animated prop
 * - Center the decoration perfectly over the profile picture
 * - Handle missing decorations gracefully
 */
```

#### ProfileBackground.tsx

```typescript
interface ProfileBackgroundProps {
  /** Theme configuration */
  theme: ProfileTheme;
  /** Children to render over the background */
  children: React.ReactNode;
  /** Whether to apply a safe area */
  applySafeArea?: boolean;
}

/**
 * IMPLEMENTATION NOTES:
 * - Render full-screen background based on theme type
 * - Solid: Simple background color
 * - Gradient: Use expo-linear-gradient
 * - Image: Use ImageBackground with proper scaling
 * - Pattern: Render repeating pattern
 * - Animated: Use Lottie or Video component
 * - Apply overlay if specified for text readability
 * - Handle loading states for remote images
 */
```

---

## 6. Service Layer

### 6.1 Profile Service (`src/services/profileService.ts`)

```typescript
// =============================================================================
// PROFILE PICTURE OPERATIONS
// =============================================================================

/**
 * Upload a new profile picture from device library
 * - Opens image picker
 * - Compresses and resizes image
 * - Uploads to Firebase Storage
 * - Creates thumbnail
 * - Updates user document
 */
export async function uploadProfilePicture(
  userId: string,
  imageUri: string,
): Promise<{ url: string; thumbnailUrl: string }>;

/**
 * Remove profile picture (revert to default)
 */
export async function removeProfilePicture(userId: string): Promise<void>;

// =============================================================================
// AVATAR DECORATION OPERATIONS
// =============================================================================

/**
 * Equip an avatar decoration
 */
export async function equipDecoration(
  userId: string,
  decorationId: string,
): Promise<void>;

/**
 * Unequip current decoration
 */
export async function unequipDecoration(userId: string): Promise<void>;

/**
 * Get user's owned decorations
 */
export async function getOwnedDecorations(
  userId: string,
): Promise<UserOwnedDecoration[]>;

/**
 * Grant decoration to user (achievement/purchase/gift)
 */
export async function grantDecoration(
  userId: string,
  decorationId: string,
  obtainedVia: string,
): Promise<void>;

// =============================================================================
// BIO OPERATIONS
// =============================================================================

/**
 * Update user's bio
 * - Validates length (max 200)
 * - Runs profanity filter
 * - Updates Firestore
 */
export async function updateBio(userId: string, text: string): Promise<void>;

// =============================================================================
// STATUS OPERATIONS
// =============================================================================

/**
 * Set user's status/mood
 */
export async function setStatus(
  userId: string,
  status: string,
  mood?: string,
  expiresIn?: number,
): Promise<void>;

/**
 * Clear user's status
 */
export async function clearStatus(userId: string): Promise<void>;

// =============================================================================
// GAME SCORES OPERATIONS
// =============================================================================

/**
 * Update game scores display configuration
 */
export async function updateGameScoresConfig(
  userId: string,
  config: ProfileGameScoresConfig,
): Promise<void>;

/**
 * Get user's top scores for all games
 */
export async function getUserTopScores(
  userId: string,
): Promise<ProfileGameScore[]>;

// =============================================================================
// THEME OPERATIONS
// =============================================================================

/**
 * Equip a theme
 */
export async function equipTheme(
  userId: string,
  themeId: string,
): Promise<void>;

/**
 * Get user's owned themes
 */
export async function getOwnedThemes(userId: string): Promise<string[]>;

/**
 * Grant theme to user
 */
export async function grantTheme(
  userId: string,
  themeId: string,
  obtainedVia: string,
): Promise<void>;

/**
 * Upload custom background (premium)
 */
export async function uploadCustomBackground(
  userId: string,
  imageUri: string,
): Promise<string>;

// =============================================================================
// FEATURED BADGES OPERATIONS
// =============================================================================

/**
 * Update featured badges
 */
export async function updateFeaturedBadges(
  userId: string,
  badgeIds: string[],
): Promise<void>;

// =============================================================================
// PRIVACY OPERATIONS
// =============================================================================

/**
 * Update privacy settings
 */
export async function updatePrivacySettings(
  userId: string,
  settings: Partial<ProfilePrivacySettings>,
): Promise<void>;

// =============================================================================
// PROFILE DATA FETCHING
// =============================================================================

/**
 * Get full profile data for a user
 * Applies privacy rules based on viewer
 */
export async function getProfileData(
  userId: string,
  viewerId?: string,
): Promise<UserProfileData>;

/**
 * Get relationship between two users
 */
export async function getRelationship(
  userId: string,
  otherUserId: string,
): Promise<ProfileRelationship>;

/**
 * Subscribe to profile updates (real-time)
 */
export function subscribeToProfile(
  userId: string,
  callback: (profile: UserProfileData) => void,
): () => void;
```

### 6.2 Decoration Data (`src/data/avatarDecorations.ts`)

```typescript
/**
 * Avatar decoration definitions
 * Add new decorations by adding entries to this array
 */
export const AVATAR_DECORATIONS: AvatarDecoration[] = [
  // Example structure - you will add your own decorations here
];

/**
 * Get decoration by ID
 */
export function getDecorationById(id: string): AvatarDecoration | undefined;

/**
 * Get decorations by category
 */
export function getDecorationsByCategory(
  category: DecorationCategory,
): AvatarDecoration[];

/**
 * Get all available decorations
 */
export function getAvailableDecorations(): AvatarDecoration[];
```

### 6.3 Theme Data (`src/data/profileThemes.ts`)

```typescript
/**
 * Profile theme definitions
 */
export const PROFILE_THEMES: ProfileTheme[] = [
  {
    id: "default",
    name: "Default",
    description: "Classic clean look",
    previewPath: "assets/themes/default_preview.png",
    type: "solid",
    config: { type: "solid", color: "#1a1a2e" },
    rarity: "common",
    obtainMethod: { type: "default" },
    available: true,
    textColorMode: "light",
  },
  // Add more themes...
];

export function getThemeById(id: string): ProfileTheme | undefined;
export function getThemesByRarity(rarity: string): ProfileTheme[];
export function getAvailableThemes(): ProfileTheme[];
```

---

## 7. Screen Implementations

### 7.1 OwnProfileScreen.tsx

**Path:** `src/screens/profile/OwnProfileScreen.tsx`

```typescript
/**
 * OwnProfileScreen - Current user's profile (editable)
 *
 * FEATURES:
 * - Full profile display with edit capabilities
 * - Profile picture with decoration (tap to edit)
 * - Bio section (tap to edit)
 * - Featured badges (tap to manage)
 * - Game scores (tap to configure)
 * - Theme background (tap to change)
 * - Settings button (top right)
 * - Sign out option
 *
 * LAYOUT:
 * ┌─────────────────────────────────┐
 * │ [Settings ⚙️]                    │ <- Top bar
 * │                                  │
 * │     ╭────────────────╮          │
 * │     │  Profile Pic   │          │ <- Picture + Decoration
 * │     │  + Decoration  │          │    (tap to edit)
 * │     ╰────────────────╯          │
 * │                                  │
 * │       Display Name              │
 * │       @username                 │
 * │       [Status/Mood]             │ <- Optional status
 * │                                  │
 * │  ┌────────────────────────┐     │
 * │  │ "Bio text goes here"   │     │ <- Bio section
 * │  │ (tap to edit)          │     │
 * │  └────────────────────────┘     │
 * │                                  │
 * │  ── Featured Badges ──          │
 * │  🏆 🎮 🔥 ⭐ 💎               │ <- Up to 5 badges
 * │       (tap to manage)           │
 * │                                  │
 * │  ── Top Scores ──               │ <- Optional section
 * │  [Game] Score | [Game] Score    │
 * │       (tap to configure)        │
 * │                                  │
 * │  ┌─────────┐ ┌─────────┐        │
 * │  │ Wallet  │ │  Shop   │        │ <- Action buttons
 * │  └─────────┘ └─────────┘        │
 * │  ┌─────────┐ ┌─────────┐        │
 * │  │ Badges  │ │ Themes  │        │
 * │  └─────────┘ └─────────┘        │
 * │                                  │
 * │  [Sign Out]                     │ <- Sign out button
 * └─────────────────────────────────┘
 *
 * Background: User's selected theme
 */
```

### 7.2 UserProfileScreen.tsx

**Path:** `src/screens/profile/UserProfileScreen.tsx`

```typescript
/**
 * UserProfileScreen - Other user's profile (read-only)
 *
 * NAVIGATION PARAMS:
 * - userId: string (required)
 *
 * FEATURES:
 * - Read-only profile display
 * - Shows their theme (or viewer's theme based on settings)
 * - Dynamic action buttons based on relationship
 * - Mutual friends display (if enabled)
 *
 * LAYOUT:
 * ┌─────────────────────────────────┐
 * │ [← Back]              [⋮ Menu] │ <- Top bar with options
 * │                                  │
 * │     ╭────────────────╮          │
 * │     │  Profile Pic   │          │ <- Picture + Decoration
 * │     │  + Decoration  │          │
 * │     ╰────────────────╯          │
 * │                                  │
 * │       Display Name              │
 * │       @username                 │
 * │       [Status/Mood]             │
 * │       Last active: 2h ago       │ <- If privacy allows
 * │                                  │
 * │  ┌────────────────────────┐     │
 * │  │ "Their bio text"       │     │
 * │  └────────────────────────┘     │
 * │                                  │
 * │  ── Featured Badges ──          │
 * │  🏆 🎮 🔥 ⭐ 💎               │
 * │       (tap for details)         │
 * │                                  │
 * │  ── Top Scores ──               │ <- If enabled by them
 * │  [Game] Score | [Game] Score    │
 * │  (Your score: XXX)              │ <- Comparison if friend
 * │                                  │
 * │  ── Mutual Friends (3) ──       │ <- If privacy allows
 * │  [Friend] [Friend] [Friend]     │
 * │                                  │
 * │  ┌─────────────────────────────┐│
 * │  │ [Add Friend] / [Message]    ││ <- Dynamic based on
 * │  │ [Call] / [Accept Request]   ││    relationship
 * │  └─────────────────────────────┘│
 * └─────────────────────────────────┘
 *
 * Background: Their theme OR viewer's theme (based on settings)
 */
```

### 7.3 Navigation Updates

Update navigation types in `src/navigation/types.ts`:

```typescript
export type ProfileStackParamList = {
  OwnProfile: undefined;
  UserProfile: { userId: string };
  BadgeCollection: undefined;
  ThemeSelector: undefined;
  DecorationSelector: undefined;
  EditBio: undefined;
  EditGameScores: undefined;
  ProfileSettings: undefined;
};
```

---

## 8. Avatar Decoration System

### 8.1 Asset Structure

```
assets/
└── decorations/
    ├── index.ts              # Export all decorations
    ├── seasonal/
    │   ├── valentines_hearts.png
    │   ├── christmas_lights.gif
    │   ├── halloween_bats.gif
    │   └── ...
    ├── achievement/
    │   ├── gold_crown.png
    │   ├── champion_ring.png
    │   └── ...
    ├── premium/
    │   ├── diamond_frame.png
    │   ├── fire_aura.gif
    │   └── ...
    ├── exclusive/
    │   ├── beta_tester.png
    │   ├── founder.png
    │   └── ...
    └── basic/
        ├── simple_border.png
        ├── star_sparkle.gif
        └── ...
```

### 8.2 Adding New Decorations

**Step 1: Add the image file**

- Place PNG or GIF file in `assets/decorations/{category}/`
- Image MUST be exactly 320x320 pixels
- Use transparency for areas that should show the profile picture

**Step 2: Register in decoration data**

Edit `src/data/avatarDecorations.ts`:

```typescript
import decorationImage from "@assets/decorations/category/filename.png";
// OR for GIFs:
import decorationGif from "@assets/decorations/category/filename.gif";

export const AVATAR_DECORATIONS: AvatarDecoration[] = [
  // ... existing decorations
  {
    id: "unique_decoration_id",
    name: "Display Name",
    description: "Description of the decoration",
    assetPath: decorationImage, // or decorationGif
    animated: false, // true for GIFs
    rarity: "rare", // common | rare | epic | legendary | mythic
    obtainMethod: {
      type: "purchase", // free | achievement | purchase | event | exclusive
      priceTokens: 500, // if purchasable
    },
    category: "premium", // seasonal | achievement | premium | exclusive | basic
    available: true,
    tags: ["optional", "tags"],
    sortOrder: 10,
  },
];
```

**Step 3: Update metro.config.js (if needed)**

Ensure GIF support is enabled:

```javascript
module.exports = {
  resolver: {
    assetExts: [...assetExts, "gif"],
  },
};
```

### 8.3 Decoration Rendering Implementation

```typescript
// DecorationOverlay.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { getDecorationById } from '@/data/avatarDecorations';

interface DecorationOverlayProps {
  decorationId: string;
  size: number;
}

export function DecorationOverlay({ decorationId, size }: DecorationOverlayProps) {
  const decoration = getDecorationById(decorationId);

  if (!decoration) return null;

  // Calculate scale factor from 320x320 to desired size
  const scale = size / 320;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <FastImage
        source={decoration.assetPath}
        style={[styles.decoration, { width: size, height: size }]}
        resizeMode={FastImage.resizeMode.contain}
        // For GIFs - FastImage handles animation automatically
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decoration: {
    position: 'absolute',
  },
});
```

---

## 9. Theme Inheritance System

### 9.1 Theme Context

```typescript
// src/contexts/ProfileThemeContext.tsx

interface ProfileThemeContextValue {
  /** Current effective theme for the screen */
  effectiveTheme: ProfileTheme;
  /** Whether viewing with their theme or your own */
  usingTheirTheme: boolean;
  /** User's own theme preference */
  ownTheme: ProfileTheme;
  /** Toggle to use own theme */
  useOwnTheme: () => void;
  /** Toggle to use their theme */
  useTheirTheme: () => void;
}

/**
 * Provider that wraps profile screens
 * Determines which theme to use based on settings
 */
export function ProfileThemeProvider({
  profileUserId,
  children,
}: {
  profileUserId: string;
  children: React.ReactNode;
}) {
  // 1. Load current user's theme preference setting
  // 2. Load profile owner's theme
  // 3. Determine effective theme based on setting
  // 4. Provide theme context to children
}
```

### 9.2 Settings Integration

Add to user preferences:

```typescript
interface UserPreferences {
  // ... existing preferences

  /** Profile theme viewing preference */
  profileThemePreference: "their_theme" | "my_theme";
}
```

Add setting UI in Settings screen:

```typescript
// In SettingsScreen.tsx
<SettingToggle
  title="Use my theme on other profiles"
  description="When viewing other profiles, use your theme instead of theirs"
  value={preferences.profileThemePreference === 'my_theme'}
  onValueChange={(value) => {
    updatePreference('profileThemePreference', value ? 'my_theme' : 'their_theme');
  }}
/>
```

---

## 10. Settings Integration

### 10.1 Profile Settings Section

Add new settings for profile privacy and preferences:

```typescript
// Settings categories
const PROFILE_SETTINGS = [
  {
    key: "showGameScores",
    title: "Show Game Scores",
    description: "Who can see your game scores on your profile",
    type: "select",
    options: ["everyone", "friends", "nobody"],
  },
  {
    key: "showBadges",
    title: "Show Badges",
    description: "Who can see your badges on your profile",
    type: "select",
    options: ["everyone", "friends", "nobody"],
  },
  {
    key: "showLastActive",
    title: "Show Last Active",
    description: "Who can see when you were last online",
    type: "select",
    options: ["everyone", "friends", "nobody"],
  },
  {
    key: "showMutualFriends",
    title: "Show Mutual Friends",
    description: "Show mutual friends when others view your profile",
    type: "toggle",
  },
  {
    key: "profileThemePreference",
    title: "Use My Theme Everywhere",
    description: "Use your theme when viewing other profiles",
    type: "toggle",
  },
];
```

---

## 11. Status & Mood Indicator System

### 11.1 Overview

The Status/Mood system allows users to express their current state or activity through a combination of predefined moods (with emoji) and optional custom text. This provides at-a-glance context when viewing profiles or in chat lists.

### 11.2 Mood Types

```typescript
/**
 * Available mood types with associated emoji and colors
 */
export const MOOD_CONFIG = {
  chill: {
    emoji: "😌",
    label: "Chilling",
    color: "#4ECDC4",
    description: "Relaxed and available",
  },
  busy: {
    emoji: "💼",
    label: "Busy",
    color: "#FF6B6B",
    description: "Working or occupied",
  },
  gaming: {
    emoji: "🎮",
    label: "Gaming",
    color: "#9B59B6",
    description: "Playing games",
  },
  studying: {
    emoji: "📚",
    label: "Studying",
    color: "#3498DB",
    description: "Studying or learning",
  },
  away: {
    emoji: "🌙",
    label: "Away",
    color: "#95A5A6",
    description: "Away from device",
  },
  excited: {
    emoji: "🎉",
    label: "Excited",
    color: "#F39C12",
    description: "Feeling excited",
  },
  tired: {
    emoji: "😴",
    label: "Tired",
    color: "#7F8C8D",
    description: "Low energy",
  },
  custom: {
    emoji: "💭",
    label: "Custom",
    color: "#1ABC9C",
    description: "Custom status",
  },
} as const;

export type MoodType = keyof typeof MOOD_CONFIG;
```

### 11.3 Status Type Definitions

```typescript
/**
 * User's profile status/mood - EXPANDED
 */
export interface ProfileStatus {
  /** The mood indicator (required) */
  mood: MoodType;

  /** Optional custom text (max 60 characters) */
  text?: string;

  /** When the status was set */
  setAt: number;

  /** Auto-expire timestamp (optional) */
  expiresAt?: number | null;

  /** Who can see this status */
  visibility: "everyone" | "friends" | "nobody";
}

/**
 * Status expiry presets
 */
export const STATUS_EXPIRY_OPTIONS = [
  { label: "Don't clear", value: null },
  { label: "30 minutes", value: 30 * 60 * 1000 },
  { label: "1 hour", value: 60 * 60 * 1000 },
  { label: "4 hours", value: 4 * 60 * 60 * 1000 },
  { label: "Today", value: "end_of_day" }, // Special handling
  { label: "1 week", value: 7 * 24 * 60 * 60 * 1000 },
] as const;
```

### 11.4 Status Components

#### StatusIndicator.tsx

```typescript
/**
 * Compact status indicator for lists and headers
 */
interface StatusIndicatorProps {
  /** The user's current status */
  status: ProfileStatus | null;
  /** Size variant */
  size: "small" | "medium" | "large";
  /** Whether to show the text (or just emoji) */
  showText?: boolean;
  /** Whether status is visible based on privacy */
  visible?: boolean;
}

/**
 * IMPLEMENTATION:
 * - Small: Just emoji (16px)
 * - Medium: Emoji + mood label (for profile header)
 * - Large: Emoji + custom text + mood label (for profile detail)
 * - Show tooltip on long-press with full status
 * - Animate emoji with subtle bounce on mount
 * - Gray out and show "Status hidden" if not visible
 */
```

#### StatusPicker.tsx

```typescript
/**
 * Modal for setting user's status
 */
interface StatusPickerProps {
  visible: boolean;
  currentStatus: ProfileStatus | null;
  onSave: (status: ProfileStatus | null) => void;
  onClose: () => void;
}

/**
 * LAYOUT:
 * ┌─────────────────────────────────────┐
 * │ Set Your Status                  ✕ │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │  How are you feeling?               │
 * │                                     │
 * │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
 * │  │ 😌  │ │ 💼  │ │ 🎮  │ │ 📚  │  │
 * │  │Chill│ │Busy │ │Game │ │Study│  │
 * │  └─────┘ └─────┘ └─────┘ └─────┘  │
 * │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
 * │  │ 🌙  │ │ 🎉  │ │ 😴  │ │ 💭  │  │
 * │  │Away │ │Hype │ │Tired│ │Custom│ │
 * │  └─────┘ └─────┘ └─────┘ └─────┘  │
 * │                                     │
 * │  ┌───────────────────────────────┐ │
 * │  │ What's on your mind? (opt)    │ │
 * │  └───────────────────────────────┘ │
 * │  0/60 characters                    │
 * │                                     │
 * │  Clear after: [Don't clear ▼]      │
 * │                                     │
 * │  Who can see: [Friends ▼]          │
 * │                                     │
 * │  ┌─────────────────────────────┐   │
 * │  │         Set Status          │   │
 * │  └─────────────────────────────┘   │
 * │  ┌─────────────────────────────┐   │
 * │  │        Clear Status         │   │
 * │  └─────────────────────────────┘   │
 * └─────────────────────────────────────┘
 */
```

### 11.5 Status Service Functions

```typescript
// In profileService.ts

/**
 * Set user's status with mood and optional text
 */
export async function setStatus(
  userId: string,
  mood: MoodType,
  text?: string,
  expiresIn?: number | null,
  visibility?: "everyone" | "friends" | "nobody",
): Promise<void> {
  const db = getFirestoreInstance();
  const userRef = doc(db, "Users", userId);

  const status: ProfileStatus = {
    mood,
    text: text?.trim().slice(0, 60),
    setAt: Date.now(),
    expiresAt: expiresIn ? Date.now() + expiresIn : null,
    visibility: visibility || "friends",
  };

  await updateDoc(userRef, {
    status,
    lastProfileUpdate: Date.now(),
  });
}

/**
 * Clear user's status
 */
export async function clearStatus(userId: string): Promise<void> {
  const db = getFirestoreInstance();
  const userRef = doc(db, "Users", userId);

  await updateDoc(userRef, {
    status: deleteField(),
    lastProfileUpdate: Date.now(),
  });
}

/**
 * Check if status is expired and should be hidden
 */
export function isStatusExpired(status: ProfileStatus | null): boolean {
  if (!status) return true;
  if (!status.expiresAt) return false;
  return Date.now() > status.expiresAt;
}

/**
 * Check if current user can see target user's status
 */
export function canViewStatus(
  status: ProfileStatus | null,
  relationship: ProfileRelationship,
): boolean {
  if (!status || isStatusExpired(status)) return false;

  switch (status.visibility) {
    case "everyone":
      return true;
    case "friends":
      return relationship.type === "friend" || relationship.type === "self";
    case "nobody":
      return relationship.type === "self";
    default:
      return false;
  }
}
```

### 11.6 Status Display in Profile

```typescript
/**
 * Where status is displayed:
 *
 * 1. OwnProfileScreen - Below name, with edit button
 * 2. UserProfileScreen - Below name (if visible)
 * 3. Chat list items - Small indicator next to avatar
 * 4. Friends list - Small indicator next to name
 * 5. Profile preview modal - If visible
 *
 * Visual hierarchy:
 * - Mood emoji is always prominent
 * - Custom text is secondary
 * - "Set X hours ago" in tertiary
 */
```

---

## 12. Mutual Friends Display System

### 12.1 Overview

When viewing another user's profile, show a list of friends that both you and the profile owner share. This helps users understand their social connection and provides context for the relationship.

### 12.2 Type Definitions

```typescript
/**
 * Mutual friend information for display
 */
export interface MutualFriendInfo {
  /** The mutual friend's user ID */
  odId: string;
  /** Display name */
  displayName: string;
  /** Username */
  username: string;
  /** Profile picture URL */
  profilePictureUrl?: string;
  /** Avatar config for fallback */
  avatarConfig: AvatarConfig;
}

/**
 * Mutual friends result from service
 */
export interface MutualFriendsResult {
  /** Total count of mutual friends */
  totalCount: number;
  /** First N friends for display (typically 6-10) */
  friends: MutualFriendInfo[];
  /** Whether there are more friends beyond the preview */
  hasMore: boolean;
}
```

### 12.3 Mutual Friends Service

```typescript
// In profileService.ts

/**
 * Get mutual friends between current user and target user
 *
 * Algorithm:
 * 1. Get current user's friend list (user IDs)
 * 2. Get target user's friend list (user IDs)
 * 3. Find intersection of both sets
 * 4. Fetch profile data for mutual friends
 * 5. Sort by relevance (most recently active, or alphabetically)
 */
export async function getMutualFriends(
  currentUserId: string,
  targetUserId: string,
  limit: number = 10,
): Promise<MutualFriendsResult> {
  // Get both users' friend lists
  const [currentUserFriends, targetUserFriends] = await Promise.all([
    getFriends(currentUserId),
    getFriends(targetUserId),
  ]);

  // Extract friend IDs (the other user in each friendship)
  const currentUserFriendIds = new Set(
    currentUserFriends.map((f) => f.users.find((uid) => uid !== currentUserId)),
  );

  const targetUserFriendIds = targetUserFriends
    .map((f) => f.users.find((uid) => uid !== targetUserId))
    .filter(Boolean) as string[];

  // Find mutual friends
  const mutualFriendIds = targetUserFriendIds.filter((id) =>
    currentUserFriendIds.has(id),
  );

  const totalCount = mutualFriendIds.length;

  // Fetch profile data for first N mutual friends
  const limitedIds = mutualFriendIds.slice(0, limit);
  const friendProfiles = await Promise.all(
    limitedIds.map((id) => getUserProfile(id)),
  );

  const friends: MutualFriendInfo[] = friendProfiles
    .filter(Boolean)
    .map((profile) => ({
      odId: profile!.uid,
      displayName: profile!.displayName,
      username: profile!.username,
      profilePictureUrl: profile!.profilePicture?.url,
      avatarConfig: profile!.avatarConfig,
    }));

  return {
    totalCount,
    friends,
    hasMore: totalCount > limit,
  };
}
```

### 12.4 Mutual Friends Component

```typescript
/**
 * MutualFriendsSection.tsx
 *
 * Displays mutual friends on UserProfileScreen
 */
interface MutualFriendsSectionProps {
  /** Current user's ID */
  currentUserId: string;
  /** Profile owner's ID */
  targetUserId: string;
  /** Whether the profile owner allows showing mutual friends */
  showMutualFriends: boolean;
  /** Called when a mutual friend is tapped */
  onFriendPress: (userId: string) => void;
}

/**
 * LAYOUT:
 * ┌─────────────────────────────────────────────────┐
 * │ 👥 Mutual Friends (12)              [See All >]│
 * ├─────────────────────────────────────────────────┤
 * │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
 * │ │ 😊 │ │ 😊 │ │ 😊 │ │ 😊 │ │ 😊 │ │+7  │     │
 * │ │Jane│ │John│ │Alex│ │Sam │ │Pat │ │    │     │
 * │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
 * └─────────────────────────────────────────────────┘
 *
 * BEHAVIOR:
 * - Horizontal scroll for overflow
 * - Tap friend to navigate to their profile
 * - "See All" opens full mutual friends list
 * - "+N" circle shows remaining count
 * - Empty state: "No mutual friends"
 * - Hidden state: Section not shown if privacy disabled
 */
```

### 12.5 Mutual Friends List Screen

```typescript
/**
 * MutualFriendsListScreen.tsx
 *
 * Full list of mutual friends between two users
 */
interface MutualFriendsListScreenProps {
  route: {
    params: {
      currentUserId: string;
      targetUserId: string;
      targetDisplayName: string;
    };
  };
}

/**
 * LAYOUT:
 * ┌─────────────────────────────────────┐
 * │ ← Mutual Friends with {Name}       │
 * ├─────────────────────────────────────┤
 * │ ┌─────────────────────────────────┐ │
 * │ │ 🔍 Search mutual friends        │ │
 * │ └─────────────────────────────────┘ │
 * │                                     │
 * │ ┌───┐ Jane Smith                   │
 * │ │ 😊│ @janesmith                   │
 * │ └───┘                              │
 * │ ─────────────────────────────────── │
 * │ ┌───┐ John Doe                     │
 * │ │ 😊│ @johndoe                     │
 * │ └───┘                              │
 * │ ... (FlatList with virtualization) │
 * └─────────────────────────────────────┘
 *
 * FEATURES:
 * - Search/filter functionality
 * - Pull to refresh
 * - Infinite scroll if >50 mutual friends
 * - Tap to navigate to profile
 */
```

### 12.6 Privacy Considerations

```typescript
/**
 * Mutual friends visibility rules:
 *
 * 1. Target user's privacy.showMutualFriends must be true
 * 2. Current user must NOT be blocked by target
 * 3. Target must NOT be blocked by current user
 * 4. Each mutual friend's profile privacy is respected
 *    (don't show friends who have "friends only" profiles to strangers)
 *
 * Edge cases:
 * - If target has 0 friends: "No mutual friends"
 * - If all mutual friends have hidden profiles: "No mutual friends visible"
 * - If blocked: Section not shown at all
 */
```

---

## 13. Profile Sharing System

### 13.1 Overview

Allow users to share their profile or another user's profile via various methods including native share sheet, deep links, QR codes, and direct in-app sharing.

### 13.2 Type Definitions

```typescript
/**
 * Profile share data structure
 */
export interface ProfileShareData {
  /** The user ID being shared */
  userId: string;
  /** Display name for share preview */
  displayName: string;
  /** Username for the link */
  username: string;
  /** Profile picture URL for preview */
  profilePictureUrl?: string;
  /** Deep link URL */
  shareUrl: string;
  /** Short link (if using link shortener) */
  shortUrl?: string;
  /** QR code data URL (base64 image) */
  qrCodeUrl?: string;
  /** Share message template */
  shareMessage: string;
  /** When this share was generated */
  generatedAt: number;
}

/**
 * Share method options
 */
export type ShareMethod =
  | "native" // Use device's native share sheet
  | "copy_link" // Copy link to clipboard
  | "qr_code" // Show QR code modal
  | "message" // Share via in-app message
  | "twitter" // Share to Twitter/X
  | "instagram"; // Share to Instagram Stories

/**
 * Share analytics event
 */
export interface ProfileShareEvent {
  sharedUserId: string;
  sharedByUserId: string;
  method: ShareMethod;
  timestamp: number;
}
```

### 13.3 Deep Link Structure

```typescript
/**
 * Deep link format for profile sharing
 *
 * Production: https://vibe.app/u/{username}
 * Development: exp://localhost:8081/--/profile/{userId}
 *
 * Universal link configuration required in:
 * - apple-app-site-association (iOS)
 * - assetlinks.json (Android)
 * - app.config.ts / app.json
 */

export const PROFILE_DEEP_LINK = {
  /** Base URL for production */
  baseUrl: "https://vibe.app",

  /** Path pattern */
  path: "/u/",

  /** Generate full share URL */
  generate: (username: string): string => {
    return `https://vibe.app/u/${encodeURIComponent(username)}`;
  },

  /** Parse username from URL */
  parse: (url: string): string | null => {
    const match = url.match(/vibe\.app\/u\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  },
};
```

### 13.4 Profile Sharing Service

```typescript
// In profileService.ts

/**
 * Generate profile share data
 */
export async function generateProfileShare(
  userId: string,
): Promise<ProfileShareData> {
  const profile = await getUserProfile(userId);

  if (!profile) {
    throw new Error("User not found");
  }

  const shareUrl = PROFILE_DEEP_LINK.generate(profile.username);

  const shareMessage = `Check out ${profile.displayName} (@${profile.username}) on Vibe! ${shareUrl}`;

  return {
    userId: profile.uid,
    displayName: profile.displayName,
    username: profile.username,
    profilePictureUrl: profile.profilePicture?.url,
    shareUrl,
    shareMessage,
    generatedAt: Date.now(),
  };
}

/**
 * Generate QR code for profile
 */
export async function generateProfileQRCode(
  userId: string,
  size: number = 256,
): Promise<string> {
  const shareData = await generateProfileShare(userId);

  // Use react-native-qrcode-svg or similar
  // Return base64 data URL of QR code image
  const qrCodeDataUrl = await generateQRCode(shareData.shareUrl, {
    size,
    backgroundColor: "#FFFFFF",
    foregroundColor: "#000000",
    // Include small profile picture in center (optional)
    logo: shareData.profilePictureUrl,
    logoSize: size * 0.2,
  });

  return qrCodeDataUrl;
}

/**
 * Share profile using native share sheet
 */
export async function shareProfileNative(userId: string): Promise<boolean> {
  const shareData = await generateProfileShare(userId);

  try {
    const result = await Share.share({
      message: shareData.shareMessage,
      url: shareData.shareUrl, // iOS only
      title: `${shareData.displayName}'s Profile`,
    });

    if (result.action === Share.sharedAction) {
      // Track share event
      await trackShareEvent(userId, "native");
      return true;
    }
    return false;
  } catch (error) {
    console.error("Share failed:", error);
    return false;
  }
}

/**
 * Copy profile link to clipboard
 */
export async function copyProfileLink(userId: string): Promise<boolean> {
  const shareData = await generateProfileShare(userId);

  await Clipboard.setStringAsync(shareData.shareUrl);
  await trackShareEvent(userId, "copy_link");

  return true;
}

/**
 * Track share event for analytics
 */
async function trackShareEvent(
  sharedUserId: string,
  method: ShareMethod,
): Promise<void> {
  // Log to analytics
  // Optionally store in Firestore for profile view predictions
}
```

### 13.5 Share UI Components

#### ShareProfileButton.tsx

```typescript
/**
 * Button that triggers profile share options
 */
interface ShareProfileButtonProps {
  userId: string;
  variant: "icon" | "text" | "full";
}

/**
 * Variants:
 * - icon: Just share icon (for header)
 * - text: "Share Profile" text button
 * - full: Icon + text in button style
 */
```

#### ShareProfileModal.tsx

```typescript
/**
 * Modal with share options
 */
interface ShareProfileModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

/**
 * LAYOUT:
 * ┌─────────────────────────────────────┐
 * │ Share Profile                    ✕ │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │      ┌─────────────────────┐        │
 * │      │   [Profile Card     │        │
 * │      │    Preview]         │        │
 * │      │   @username         │        │
 * │      └─────────────────────┘        │
 * │                                     │
 * │  ┌─────────────────────────────┐   │
 * │  │ 📤  Share via...            │   │
 * │  └─────────────────────────────┘   │
 * │  ┌─────────────────────────────┐   │
 * │  │ 🔗  Copy Link               │   │
 * │  └─────────────────────────────┘   │
 * │  ┌─────────────────────────────┐   │
 * │  │ 📱  Show QR Code            │   │
 * │  └─────────────────────────────┘   │
 * │  ┌─────────────────────────────┐   │
 * │  │ 💬  Send in Message         │   │
 * │  └─────────────────────────────┘   │
 * │                                     │
 * │  vibe.app/u/username               │
 * │  ─────────────────────────────────  │
 * └─────────────────────────────────────┘
 */
```

#### QRCodeModal.tsx

```typescript
/**
 * Modal displaying QR code for profile
 */
interface QRCodeModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

/**
 * LAYOUT:
 * ┌─────────────────────────────────────┐
 * │ Scan to View Profile             ✕ │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │         ┌───────────────┐          │
 * │         │               │          │
 * │         │   [QR CODE]   │          │
 * │         │               │          │
 * │         │     😊        │          │
 * │         │               │          │
 * │         └───────────────┘          │
 * │                                     │
 * │         @username                   │
 * │         Display Name                │
 * │                                     │
 * │  ┌─────────────────────────────┐   │
 * │  │       Save to Photos        │   │
 * │  └─────────────────────────────┘   │
 * │  ┌─────────────────────────────┐   │
 * │  │         Share QR            │   │
 * │  └─────────────────────────────┘   │
 * └─────────────────────────────────────┘
 *
 * FEATURES:
 * - QR code with profile picture in center
 * - Styled with app branding
 * - Save as image to device
 * - Share QR image directly
 */
```

### 13.6 Deep Link Handler

```typescript
// In navigation setup or App.tsx

/**
 * Handle incoming deep links to profiles
 */
export function useProfileDeepLinkHandler() {
  const navigation = useNavigation();
  const { currentFirebaseUser } = useAuth();

  useEffect(() => {
    // Handle links when app is already open
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleProfileDeepLink(url);
    });

    // Handle links that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) handleProfileDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  async function handleProfileDeepLink(url: string) {
    const username = PROFILE_DEEP_LINK.parse(url);

    if (!username) return;

    // Look up user by username
    const user = await getUserByUsername(username);

    if (!user) {
      // Show "User not found" toast
      return;
    }

    // Navigate to profile
    if (user.uid === currentFirebaseUser?.uid) {
      navigation.navigate("MainTabs", { screen: "Profile" });
    } else {
      navigation.navigate("UserProfile", { userId: user.uid });
    }
  }
}
```

---

## 14. Privacy & Visibility Settings

### 14.1 Overview

Comprehensive privacy controls that allow users to customize exactly what information is visible on their profile and to whom. Settings are granular, with options for "everyone", "friends only", or "nobody".

### 14.2 Complete Privacy Settings Type

```typescript
/**
 * Comprehensive privacy settings for profile
 */
export interface ProfilePrivacySettings {
  // === PROFILE VISIBILITY ===

  /** Who can view your full profile */
  profileVisibility: "everyone" | "friends" | "nobody";

  /** Who can see your online/last active status */
  showOnlineStatus: "everyone" | "friends" | "nobody";

  /** Who can see when you were last active */
  showLastActive: "everyone" | "friends" | "nobody";

  // === CONTENT VISIBILITY ===

  /** Who can see your bio */
  showBio: "everyone" | "friends" | "nobody";

  /** Who can see your featured badges */
  showBadges: "everyone" | "friends" | "nobody";

  /** Who can see your game scores */
  showGameScores: "everyone" | "friends" | "nobody";

  /** Who can see your status/mood */
  showStatus: "everyone" | "friends" | "nobody";

  // === SOCIAL VISIBILITY ===

  /** Show mutual friends on your profile */
  showMutualFriends: boolean;

  /** Who can see your friends list */
  showFriendsList: "everyone" | "friends" | "nobody";

  /** Who can see your friend count */
  showFriendCount: "everyone" | "friends" | "nobody";

  // === INTERACTION PERMISSIONS ===

  /** Who can send you friend requests */
  allowFriendRequests: "everyone" | "friends_of_friends" | "nobody";

  /** Who can send you messages */
  allowMessages: "everyone" | "friends" | "nobody";

  /** Who can call you */
  allowCalls: "friends" | "nobody";

  // === DISCOVERY ===

  /** Whether your profile appears in search results */
  discoverableInSearch: boolean;

  /** Whether your profile can be shared by others */
  allowProfileSharing: boolean;

  /** Whether to show profile view count (to yourself) */
  trackProfileViews: boolean;
}

/**
 * Default privacy settings for new users
 */
export const DEFAULT_PRIVACY_SETTINGS: ProfilePrivacySettings = {
  // Profile visibility
  profileVisibility: "everyone",
  showOnlineStatus: "friends",
  showLastActive: "friends",

  // Content visibility
  showBio: "everyone",
  showBadges: "everyone",
  showGameScores: "everyone",
  showStatus: "friends",

  // Social visibility
  showMutualFriends: true,
  showFriendsList: "friends",
  showFriendCount: "everyone",

  // Interaction permissions
  allowFriendRequests: "everyone",
  allowMessages: "everyone",
  allowCalls: "friends",

  // Discovery
  discoverableInSearch: true,
  allowProfileSharing: true,
  trackProfileViews: true,
};
```

### 14.3 Privacy Enforcement

```typescript
/**
 * Apply privacy settings when fetching profile data
 * Returns filtered profile based on viewer's relationship
 */
export function applyPrivacyFilters(
  profile: UserProfileData,
  viewerId: string | null,
  relationship: ProfileRelationship,
): Partial<UserProfileData> {
  const privacy = profile.privacy;
  const isOwner = relationship.type === "self";
  const isFriend = relationship.type === "friend";

  // Helper to check if content should be visible
  const isVisible = (setting: "everyone" | "friends" | "nobody"): boolean => {
    if (isOwner) return true;
    if (setting === "everyone") return true;
    if (setting === "friends" && isFriend) return true;
    return false;
  };

  // Build filtered profile
  const filtered: Partial<UserProfileData> = {
    uid: profile.uid,
    username: profile.username,
    displayName: profile.displayName,
    profilePicture: profile.profilePicture, // Always visible
    avatarDecoration: profile.avatarDecoration, // Always visible
  };

  // Conditionally include fields based on privacy
  if (isVisible(privacy.showBio)) {
    filtered.bio = profile.bio;
  }

  if (isVisible(privacy.showBadges)) {
    filtered.featuredBadges = profile.featuredBadges;
  }

  if (isVisible(privacy.showGameScores)) {
    filtered.gameScores = profile.gameScores;
  }

  if (isVisible(privacy.showStatus)) {
    filtered.status = profile.status;
  }

  if (isVisible(privacy.showLastActive)) {
    filtered.lastActive = profile.lastActive;
  }

  // Don't include privacy settings in filtered response
  // (except for owner)
  if (isOwner) {
    filtered.privacy = profile.privacy;
  }

  return filtered;
}
```

### 14.4 Privacy Settings UI

```typescript
/**
 * PrivacySettingsScreen.tsx
 *
 * Dedicated screen for all privacy settings
 */

/**
 * LAYOUT:
 * ┌─────────────────────────────────────┐
 * │ ← Privacy Settings                 │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │ PROFILE VISIBILITY                  │
 * │ ─────────────────────────────────── │
 * │ Who can view profile    [Everyone▼]│
 * │ Show online status      [Friends ▼]│
 * │ Show last active        [Friends ▼]│
 * │                                     │
 * │ CONTENT VISIBILITY                  │
 * │ ─────────────────────────────────── │
 * │ Show bio               [Everyone ▼]│
 * │ Show badges            [Everyone ▼]│
 * │ Show game scores       [Everyone ▼]│
 * │ Show status/mood       [Friends ▼] │
 * │                                     │
 * │ SOCIAL                              │
 * │ ─────────────────────────────────── │
 * │ Show mutual friends        [Toggle]│
 * │ Show friends list       [Friends ▼]│
 * │ Show friend count      [Everyone ▼]│
 * │                                     │
 * │ WHO CAN CONTACT YOU                 │
 * │ ─────────────────────────────────── │
 * │ Friend requests        [Everyone ▼]│
 * │ Messages               [Everyone ▼]│
 * │ Calls                  [Friends ▼] │
 * │                                     │
 * │ DISCOVERY                           │
 * │ ─────────────────────────────────── │
 * │ Appear in search           [Toggle]│
 * │ Allow profile sharing      [Toggle]│
 * │ Track profile views        [Toggle]│
 * │                                     │
 * └─────────────────────────────────────┘
 */
```

### 14.5 Privacy Presets

```typescript
/**
 * Quick privacy presets for users who don't want granular control
 */
export const PRIVACY_PRESETS = {
  public: {
    name: "Public",
    description: "Everyone can see your profile and content",
    icon: "🌐",
    settings: {
      profileVisibility: "everyone",
      showOnlineStatus: "everyone",
      showLastActive: "everyone",
      showBio: "everyone",
      showBadges: "everyone",
      showGameScores: "everyone",
      showStatus: "everyone",
      showMutualFriends: true,
      showFriendsList: "everyone",
      allowFriendRequests: "everyone",
      allowMessages: "everyone",
      discoverableInSearch: true,
      allowProfileSharing: true,
    },
  },
  friends: {
    name: "Friends Only",
    description: "Only friends can see most of your profile",
    icon: "👥",
    settings: {
      profileVisibility: "friends",
      showOnlineStatus: "friends",
      showLastActive: "friends",
      showBio: "friends",
      showBadges: "friends",
      showGameScores: "friends",
      showStatus: "friends",
      showMutualFriends: true,
      showFriendsList: "friends",
      allowFriendRequests: "friends_of_friends",
      allowMessages: "friends",
      discoverableInSearch: true,
      allowProfileSharing: false,
    },
  },
  private: {
    name: "Private",
    description: "Maximum privacy - minimal information shown",
    icon: "🔒",
    settings: {
      profileVisibility: "nobody",
      showOnlineStatus: "nobody",
      showLastActive: "nobody",
      showBio: "nobody",
      showBadges: "nobody",
      showGameScores: "nobody",
      showStatus: "nobody",
      showMutualFriends: false,
      showFriendsList: "nobody",
      allowFriendRequests: "nobody",
      allowMessages: "friends",
      discoverableInSearch: false,
      allowProfileSharing: false,
    },
  },
} as const;
```

---

## 15. Friendship Info Display

### 15.1 Overview

When viewing a friend's profile, prominently display relationship information including:

- Current streak count (if active)
- How long you've been friends
- Friend anniversary date

### 15.2 Type Definitions

```typescript
/**
 * Friendship information for display
 */
export interface FriendshipDisplayInfo {
  /** Whether users are friends */
  isFriend: boolean;

  /** Friendship document ID */
  friendshipId?: string;

  /** Current streak count */
  streakCount: number;

  /** Whether streak is currently active (within 24h) */
  streakActive: boolean;

  /** When the friendship started */
  friendsSince: number;

  /** Formatted duration string (e.g., "2 years, 3 months") */
  friendshipDuration: string;

  /** Short duration string (e.g., "2y 3m") */
  friendshipDurationShort: string;

  /** Whether it's the friendship anniversary today */
  isAnniversary: boolean;

  /** Days until next anniversary (if within 30 days) */
  daysUntilAnniversary?: number;

  /** Total messages exchanged (optional stat) */
  totalMessages?: number;

  /** Total games played together (optional stat) */
  gamesPlayedTogether?: number;
}
```

### 15.3 Friendship Info Service

```typescript
// In profileService.ts

/**
 * Get detailed friendship information between two users
 */
export async function getFriendshipInfo(
  userId1: string,
  userId2: string,
): Promise<FriendshipDisplayInfo | null> {
  const db = getFirestoreInstance();

  // Find friendship document
  const friendsRef = collection(db, "Friends");
  const q = query(friendsRef, where("users", "array-contains", userId1));

  const snapshot = await getDocs(q);
  const friendship = snapshot.docs.find((doc) => {
    const data = doc.data();
    return data.users.includes(userId2);
  });

  if (!friendship) {
    return null;
  }

  const data = friendship.data();
  const friendsSince = data.createdAt;
  const streakCount = data.streakCount || 0;
  const lastInteraction = data.lastInteraction || 0;

  // Calculate streak status (active if interacted within 24h)
  const streakActive = Date.now() - lastInteraction < 24 * 60 * 60 * 1000;

  // Calculate duration
  const duration = calculateFriendshipDuration(friendsSince);

  // Check for anniversary
  const { isAnniversary, daysUntil } = checkAnniversary(friendsSince);

  return {
    isFriend: true,
    friendshipId: friendship.id,
    streakCount,
    streakActive,
    friendsSince,
    friendshipDuration: duration.long,
    friendshipDurationShort: duration.short,
    isAnniversary,
    daysUntilAnniversary: daysUntil,
  };
}

/**
 * Calculate human-readable friendship duration
 */
function calculateFriendshipDuration(since: number): {
  long: string;
  short: string;
} {
  const now = Date.now();
  const diff = now - since;

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    const remainingMonths = months % 12;
    return {
      long:
        remainingMonths > 0
          ? `${years} year${years > 1 ? "s" : ""}, ${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`
          : `${years} year${years > 1 ? "s" : ""}`,
      short:
        remainingMonths > 0 ? `${years}y ${remainingMonths}m` : `${years}y`,
    };
  }

  if (months > 0) {
    return {
      long: `${months} month${months > 1 ? "s" : ""}`,
      short: `${months}m`,
    };
  }

  return {
    long: days === 1 ? "1 day" : `${days} days`,
    short: `${days}d`,
  };
}

/**
 * Check if today is the friendship anniversary
 */
function checkAnniversary(since: number): {
  isAnniversary: boolean;
  daysUntil?: number;
} {
  const now = new Date();
  const anniversary = new Date(since);

  // Set anniversary to this year
  anniversary.setFullYear(now.getFullYear());

  // If anniversary already passed this year, check next year
  if (anniversary < now) {
    anniversary.setFullYear(now.getFullYear() + 1);
  }

  const diffDays = Math.ceil(
    (anniversary.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );

  return {
    isAnniversary: diffDays === 0 || diffDays === 365,
    daysUntil: diffDays <= 30 ? diffDays : undefined,
  };
}
```

### 15.4 Friendship Info Component

```typescript
/**
 * FriendshipInfoCard.tsx
 *
 * Displays friendship statistics on UserProfileScreen
 */
interface FriendshipInfoCardProps {
  info: FriendshipDisplayInfo;
  compact?: boolean;
}

/**
 * FULL LAYOUT:
 * ┌─────────────────────────────────────────┐
 * │ 💛 Friends                              │
 * ├─────────────────────────────────────────┤
 * │                                         │
 * │   🔥 142                📅 2y 3m        │
 * │   Current Streak      Friends Since     │
 * │   ━━━━━━━━━━━━━      Jan 15, 2024       │
 * │                                         │
 * │   🎉 Anniversary in 12 days!            │ <- Optional
 * └─────────────────────────────────────────┘
 *
 * COMPACT LAYOUT (for header):
 * ┌─────────────────────────────────┐
 * │ 🔥 142  •  📅 2y 3m friends    │
 * └─────────────────────────────────┘
 *
 * STYLING:
 * - Streak number large and prominent
 * - Fire emoji animated/glowing if streak > 30
 * - Special badge for streak milestones (7, 30, 100, 365)
 * - Anniversary confetti animation if isAnniversary
 */
```

### 15.5 Streak Milestones

```typescript
/**
 * Special recognition for streak milestones
 */
export const STREAK_MILESTONES = [
  { days: 7, name: "Week Warriors", emoji: "⭐", color: "#F1C40F" },
  { days: 30, name: "Monthly Masters", emoji: "🌟", color: "#E74C3C" },
  { days: 100, name: "Century Club", emoji: "💯", color: "#9B59B6" },
  { days: 365, name: "Year of Friendship", emoji: "🏆", color: "#F39C12" },
  { days: 1000, name: "Legendary Bond", emoji: "👑", color: "#E91E63" },
] as const;

/**
 * Get milestone info for a streak count
 */
export function getStreakMilestone(count: number) {
  // Return highest achieved milestone
  return [...STREAK_MILESTONES].reverse().find((m) => count >= m.days);
}
```

---

## 16. Block/Report/Mute System

### 16.1 Overview

Allow users to manage unwanted interactions directly from profiles. This includes blocking (prevents all interaction), reporting (flags to moderators), and muting (hides their content but stays friends).

### 16.2 Type Definitions

```typescript
/**
 * Block record
 */
export interface UserBlock {
  /** ID of the user who did the blocking */
  blockerId: string;
  /** ID of the blocked user */
  blockedId: string;
  /** When the block was created */
  blockedAt: number;
  /** Optional reason (for personal reference) */
  reason?: string;
}

/**
 * Report record
 */
export interface UserReport {
  /** Unique report ID */
  id: string;
  /** Who submitted the report */
  reporterId: string;
  /** Who is being reported */
  reportedUserId: string;
  /** Category of the report */
  category: ReportCategory;
  /** Detailed description */
  description: string;
  /** Screenshots or evidence URLs */
  evidenceUrls?: string[];
  /** When the report was submitted */
  submittedAt: number;
  /** Current status */
  status: "pending" | "reviewed" | "action_taken" | "dismissed";
  /** Moderator notes (internal) */
  moderatorNotes?: string;
}

export type ReportCategory =
  | "harassment"
  | "spam"
  | "inappropriate_content"
  | "impersonation"
  | "threats"
  | "underage"
  | "scam"
  | "other";

/**
 * Mute record (softer than block)
 */
export interface UserMute {
  /** ID of the user who muted */
  oderId: string;
  /** ID of the muted user */
  mutedId: string;
  /** When the mute was created */
  mutedAt: number;
  /** Optional expiry (null = indefinite) */
  expiresAt?: number | null;
  /** What to mute */
  muteSettings: {
    /** Hide their posts/stories */
    hideContent: boolean;
    /** Mute notifications from them */
    muteNotifications: boolean;
    /** Hide from chat list (but keep friend) */
    hideFromChatList: boolean;
  };
}
```

### 16.3 Block Service

```typescript
// In blocking.ts or profileService.ts

/**
 * Block a user
 *
 * Effects:
 * - Remove from friends (if friends)
 * - Cancel pending friend requests
 * - Hide both profiles from each other
 * - Prevent messaging, calling, game invites
 * - Remove from each other's mutual friends calculations
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string,
): Promise<void> {
  const db = getFirestoreInstance();
  const batch = writeBatch(db);

  // 1. Create block record
  const blockRef = doc(db, "Blocks", `${blockerId}_${blockedId}`);
  batch.set(blockRef, {
    blockerId,
    blockedId,
    blockedAt: Date.now(),
    reason,
  });

  // 2. Add to blocker's blocked list for quick lookup
  const blockerRef = doc(db, "Users", blockerId);
  batch.update(blockerRef, {
    blockedUsers: arrayUnion(blockedId),
  });

  // 3. Remove friendship if exists
  const friendshipQuery = await findFriendship(blockerId, blockedId);
  if (friendshipQuery) {
    batch.delete(friendshipQuery.ref);
  }

  // 4. Cancel any pending friend requests
  await cancelPendingRequests(blockerId, blockedId);

  await batch.commit();
}

/**
 * Unblock a user
 */
export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  const db = getFirestoreInstance();
  const batch = writeBatch(db);

  // Remove block record
  const blockRef = doc(db, "Blocks", `${blockerId}_${blockedId}`);
  batch.delete(blockRef);

  // Remove from blocked list
  const blockerRef = doc(db, "Users", blockerId);
  batch.update(blockerRef, {
    blockedUsers: arrayRemove(blockedId),
  });

  await batch.commit();
}

/**
 * Check if a user is blocked
 */
export async function isBlocked(
  userId1: string,
  userId2: string,
): Promise<{ blockedByYou: boolean; blockedByThem: boolean }> {
  const db = getFirestoreInstance();

  const [block1, block2] = await Promise.all([
    getDoc(doc(db, "Blocks", `${userId1}_${userId2}`)),
    getDoc(doc(db, "Blocks", `${userId2}_${userId1}`)),
  ]);

  return {
    blockedByYou: block1.exists(),
    blockedByThem: block2.exists(),
  };
}
```

### 16.4 Report Service

```typescript
// In reporting.ts or profileService.ts

/**
 * Submit a user report
 */
export async function submitReport(
  reporterId: string,
  reportedUserId: string,
  category: ReportCategory,
  description: string,
  evidenceUrls?: string[],
): Promise<string> {
  const db = getFirestoreInstance();

  const reportRef = doc(collection(db, "Reports"));
  const report: UserReport = {
    id: reportRef.id,
    reporterId,
    reportedUserId,
    category,
    description,
    evidenceUrls,
    submittedAt: Date.now(),
    status: "pending",
  };

  await setDoc(reportRef, report);

  // Notify moderation team (via Cloud Function or alert system)
  await notifyModerators(report);

  return reportRef.id;
}

/**
 * Report categories with descriptions
 */
export const REPORT_CATEGORIES: Record<
  ReportCategory,
  { label: string; description: string }
> = {
  harassment: {
    label: "Harassment or Bullying",
    description: "Repeated unwanted contact, threats, or intimidation",
  },
  spam: {
    label: "Spam",
    description: "Unsolicited promotional content or repeated messages",
  },
  inappropriate_content: {
    label: "Inappropriate Content",
    description: "Explicit, offensive, or inappropriate profile content",
  },
  impersonation: {
    label: "Impersonation",
    description: "Pretending to be someone else",
  },
  threats: {
    label: "Threats or Violence",
    description: "Threats of harm or promotion of violence",
  },
  underage: {
    label: "Underage User",
    description: "User appears to be under minimum age",
  },
  scam: {
    label: "Scam or Fraud",
    description: "Attempting to deceive or defraud users",
  },
  other: {
    label: "Other",
    description: "Other issues not covered above",
  },
};
```

### 16.5 Mute Service

```typescript
// In profileService.ts

/**
 * Mute a user (softer than block)
 */
export async function muteUser(
  muterId: string,
  mutedId: string,
  settings?: Partial<UserMute["muteSettings"]>,
  duration?: number, // milliseconds, null = indefinite
): Promise<void> {
  const db = getFirestoreInstance();

  const muteRef = doc(db, "Users", muterId, "MutedUsers", mutedId);

  await setDoc(muteRef, {
    muterId,
    mutedId,
    mutedAt: Date.now(),
    expiresAt: duration ? Date.now() + duration : null,
    muteSettings: {
      hideContent: true,
      muteNotifications: true,
      hideFromChatList: false,
      ...settings,
    },
  });
}

/**
 * Unmute a user
 */
export async function unmuteUser(
  muterId: string,
  mutedId: string,
): Promise<void> {
  const db = getFirestoreInstance();
  const muteRef = doc(db, "Users", muterId, "MutedUsers", mutedId);
  await deleteDoc(muteRef);
}

/**
 * Check if user is muted
 */
export async function isMuted(
  muterId: string,
  mutedId: string,
): Promise<boolean> {
  const db = getFirestoreInstance();
  const muteRef = doc(db, "Users", muterId, "MutedUsers", mutedId);
  const muteDoc = await getDoc(muteRef);

  if (!muteDoc.exists()) return false;

  const data = muteDoc.data() as UserMute;

  // Check if mute has expired
  if (data.expiresAt && Date.now() > data.expiresAt) {
    // Clean up expired mute
    await deleteDoc(muteRef);
    return false;
  }

  return true;
}
```

### 16.6 Profile Actions Menu Component

```typescript
/**
 * MoreOptionsMenu.tsx
 *
 * Three-dot menu on UserProfileScreen with Block/Report/Mute options
 */
interface MoreOptionsMenuProps {
  targetUserId: string;
  relationship: ProfileRelationship;
  isMuted: boolean;
  onClose: () => void;
}

/**
 * MENU LAYOUT:
 * ┌─────────────────────────────────┐
 * │ ╭───────────────────────────╮   │
 * │ │ 📤 Share Profile          │   │
 * │ ╰───────────────────────────╯   │
 * │ ╭───────────────────────────╮   │
 * │ │ 🔇 Mute @username         │   │ <- Toggle if already muted: "Unmute"
 * │ ╰───────────────────────────╯   │
 * │ ───────────────────────────────  │
 * │ ╭───────────────────────────╮   │
 * │ │ 👤 Remove Friend          │   │ <- Only if friends
 * │ ╰───────────────────────────╯   │
 * │ ╭───────────────────────────╮   │
 * │ │ 🚫 Block @username        │   │ <- Red text
 * │ ╰───────────────────────────╯   │
 * │ ╭───────────────────────────╮   │
 * │ │ ⚠️ Report @username       │   │ <- Red text
 * │ ╰───────────────────────────╯   │
 * │                                 │
 * │ [Cancel]                        │
 * └─────────────────────────────────┘
 */
```

### 16.7 Confirmation Modals

```typescript
/**
 * BlockConfirmModal.tsx
 */
/**
 * LAYOUT:
 * ┌─────────────────────────────────┐
 * │ Block @username?                │
 * ├─────────────────────────────────┤
 * │                                 │
 * │ They won't be able to:          │
 * │ • Find your profile             │
 * │ • Send you messages             │
 * │ • See your content              │
 * │ • Invite you to games           │
 * │                                 │
 * │ You will also be removed from   │
 * │ each other's friends list.      │
 * │                                 │
 * │ ┌────────────────────────────┐  │
 * │ │ Optional: Why? (private)   │  │
 * │ └────────────────────────────┘  │
 * │                                 │
 * │ [Cancel]          [Block] ← Red │
 * └─────────────────────────────────┘
 */

/**
 * ReportModal.tsx
 */
/**
 * LAYOUT:
 * ┌─────────────────────────────────┐
 * │ Report @username                │
 * ├─────────────────────────────────┤
 * │                                 │
 * │ What's the issue?               │
 * │                                 │
 * │ ○ Harassment or Bullying        │
 * │ ○ Spam                          │
 * │ ○ Inappropriate Content         │
 * │ ○ Impersonation                 │
 * │ ○ Threats or Violence           │
 * │ ○ Scam or Fraud                 │
 * │ ○ Other                         │
 * │                                 │
 * │ ┌────────────────────────────┐  │
 * │ │ Tell us more... (required) │  │
 * │ │                            │  │
 * │ └────────────────────────────┘  │
 * │                                 │
 * │ □ Also block this user          │
 * │                                 │
 * │ [Cancel]        [Submit Report] │
 * └─────────────────────────────────┘
 */

/**
 * MuteOptionsModal.tsx
 */
/**
 * LAYOUT:
 * ┌─────────────────────────────────┐
 * │ Mute @username                  │
 * ├─────────────────────────────────┤
 * │                                 │
 * │ You'll stay friends, but:       │
 * │                                 │
 * │ [✓] Hide their content          │
 * │ [✓] Mute notifications          │
 * │ [ ] Hide from chat list         │
 * │                                 │
 * │ Mute for:                       │
 * │ ┌─────────────────────────────┐ │
 * │ │ ○ 1 hour                    │ │
 * │ │ ○ 1 day                     │ │
 * │ │ ○ 1 week                    │ │
 * │ │ ● Until I unmute            │ │
 * │ └─────────────────────────────┘ │
 * │                                 │
 * │ [Cancel]              [Mute]    │
 * └─────────────────────────────────┘
 */
```

---

## 17. DM Context Menu Migration

### 17.1 Overview

Replace the old `ProfilePreviewModal` that appears when long-pressing a DM conversation with navigation to the new `UserProfileScreen`. The old modal showed limited information; the new profile screen shows complete profile data.

### 17.2 Current Implementation (TO BE REPLACED)

```typescript
/**
 * CURRENT FLOW (ProfilePreviewModal):
 *
 * 1. User long-presses on a DM conversation in ChatListScreenV2
 * 2. ConversationContextMenu opens
 * 3. User taps "View Profile"
 * 4. ProfilePreviewModal opens with limited info:
 *    - Avatar
 *    - Name
 *    - Username
 *    - Quick actions (Message, Mute, Report, Block)
 *
 * PROBLEMS:
 * - Limited information shown
 * - Can't see badges, bio, game scores
 * - Can't see mutual friends
 * - Can't see friendship stats (streak, duration)
 * - Inconsistent with profile view from other entry points
 */
```

### 17.3 New Implementation

```typescript
/**
 * NEW FLOW:
 *
 * 1. User long-presses on a DM conversation in ChatListScreenV2
 * 2. ConversationContextMenu opens
 * 3. User taps "View Profile"
 * 4. Navigation to UserProfileScreen with userId param
 *
 * BENEFITS:
 * - Consistent profile viewing experience
 * - Full profile information available
 * - All profile actions accessible
 * - Supports new features (status, mutual friends, etc.)
 */

// CHANGES REQUIRED:

// 1. Update ConversationContextMenu.tsx
/**
 * Current onViewProfile callback triggers ProfilePreviewModal
 * Change to navigate to UserProfileScreen instead
 */

// 2. Update ChatListScreenV2.tsx
/**
 * Remove ProfilePreviewModal state management
 * Update context menu callback to use navigation
 */

// 3. ProfilePreviewModal.tsx
/**
 * DEPRECATE or REPURPOSE this component
 * Option A: Delete entirely, use UserProfileScreen for all profile viewing
 * Option B: Keep as "quick peek" with "View Full Profile" button
 *
 * RECOMMENDATION: Option A (delete) for consistency
 */
```

### 17.4 Migration Steps

```typescript
/**
 * Step 1: Update ProfilePreviewModal
 *
 * Change the "View Profile" button action:
 * - OLD: Opens full-screen modal with profile info
 * - NEW: Navigates to UserProfileScreen
 */

// ProfilePreviewModal.tsx changes:
const handleViewFullProfile = useCallback(() => {
  onClose(); // Close the modal first
  navigation.navigate("UserProfile", { userId: targetUserId });
}, [navigation, targetUserId, onClose]);

/**
 * Step 2: Update ConversationContextMenu callbacks
 */

// In ChatListScreenV2.tsx or wherever context menu is handled:
const handleViewProfile = useCallback(
  (userId: string) => {
    navigation.navigate("UserProfile", { userId });
  },
  [navigation],
);

/**
 * Step 3: Remove ProfilePreviewModal usage (if going with Option A)
 */

// Remove from ChatListScreenV2:
// - ProfilePreviewModal import
// - profilePreviewVisible state
// - profilePreviewUserId state
// - ProfilePreviewModal component render

/**
 * Step 4: Update all entry points to user profiles
 */

// Entry points that should navigate to UserProfileScreen:
const PROFILE_ENTRY_POINTS = [
  "DM context menu -> View Profile",
  "Friends list -> tap friend",
  "Mutual friends list -> tap friend",
  "Search results -> tap user",
  "Game history -> tap opponent",
  "Leaderboard -> tap player",
  "Group chat -> tap member",
  "Message -> tap sender avatar",
  "Story viewer -> tap profile",
  "Deep link -> /u/{username}",
];
```

### 17.5 Code Changes

```typescript
/**
 * ConversationContextMenu.tsx - BEFORE
 */
interface ConversationContextMenuProps {
  // ...
  onViewProfile?: () => void; // Opens ProfilePreviewModal
}

/**
 * ConversationContextMenu.tsx - AFTER
 */
interface ConversationContextMenuProps {
  // ...
  onViewProfile?: (userId: string) => void; // Navigates to UserProfileScreen
}

// Usage change:
<MenuOption onPress={() => onViewProfile?.(conversation.friendUid)}>
  <View style={styles.menuOption}>
    <MaterialCommunityIcons name="account" ... />
    <Text>View Profile</Text>
  </View>
</MenuOption>

/**
 * ChatListScreenV2.tsx - Changes
 */

// REMOVE:
const [profilePreviewVisible, setProfilePreviewVisible] = useState(false);
const [profilePreviewUserId, setProfilePreviewUserId] = useState<string | null>(null);

// REMOVE from render:
<ProfilePreviewModal
  visible={profilePreviewVisible}
  userId={profilePreviewUserId}
  onClose={() => setProfilePreviewVisible(false)}
  ...
/>

// ADD/UPDATE:
const handleViewProfile = useCallback((userId: string) => {
  // Close any open menus/modals first
  closeContextMenu();
  // Navigate to full profile screen
  navigation.navigate("UserProfile", { userId });
}, [navigation]);
```

### 17.6 Backwards Compatibility

```typescript
/**
 * ProfilePreviewModal can be kept as a "Quick Look" feature
 * if desired, but should ALWAYS have a path to full profile
 */

interface ProfilePreviewModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onViewFullProfile: () => void; // REQUIRED - must navigate to UserProfileScreen
}

/**
 * Quick Look shows:
 * - Profile picture
 * - Name + username
 * - Status (if visible)
 * - "View Full Profile" button (prominent)
 * - Quick actions: Message, Mute (secondary)
 */
```

---

## 18. Implementation Phases

### Phase 1: Foundation (Week 1)

**Priority: P0**

1. **Type Definitions**
   - [ ] Add all new types to `src/types/profile.ts`
   - [ ] Update `User` interface in `src/types/models.ts`
   - [ ] Create type guards and utility functions

2. **Database Schema**
   - [ ] Update Firestore security rules
   - [ ] Create migration script for existing users
   - [ ] Add default values for new fields

3. **Core Services**
   - [x] Create `profileService.ts` with basic CRUD operations
   - [x] Implement profile picture upload/download
   - [x] Implement bio update with validation

### Phase 2: Profile Picture & Decorations (Week 2)

**Priority: P0**

1. **Profile Picture System**
   - [x] Implement image picker integration
   - [x] Add image compression/resizing
   - [x] Create Firebase Storage upload flow
   - [x] Build thumbnail generation
   - [x] Create `ProfilePicture` component
   - [x] Add fallback to initials circle

2. **Avatar Decorations**
   - [x] Set up asset structure
   - [x] Create decoration data file
   - [x] Build `DecorationOverlay` component
   - [x] Implement `DecorationPicker` UI
   - [x] Add equip/unequip functionality

### Phase 3: Profile Screens (Week 3)

**Priority: P0**

1. **OwnProfileScreen**
   - [ ] Create new screen layout
   - [ ] Implement all editable sections
   - [ ] Add settings/sign out navigation
   - [ ] Integrate with existing badge system

2. **UserProfileScreen**
   - [ ] Create read-only layout
   - [ ] Implement relationship detection
   - [ ] Build dynamic action buttons
   - [ ] Add navigation from friend lists, chat, etc.

3. **Navigation**
   - [ ] Update navigation types
   - [ ] Add new routes
   - [ ] Update existing navigation to user profiles

### Phase 4: Themes & Backgrounds (Week 4)

**Priority: P0**

1. **Theme System**
   - [ ] Create theme data definitions
   - [ ] Build `ProfileBackground` component
   - [ ] Implement theme picker UI
   - [ ] Add theme equip functionality

2. **Theme Inheritance**
   - [ ] Create `ProfileThemeContext`
   - [ ] Add preference to settings
   - [ ] Implement theme switching logic

### Phase 5: Game Scores & Polish (Week 5)

**Priority: P1**

1. **Game Scores Display**
   - [x] Fetch user's top scores
   - [x] Build score display component
   - [x] Add game selection UI
   - [x] Implement score comparison for friends

2. **Privacy & Settings**
   - [x] Implement all privacy controls
   - [x] Add settings UI sections
   - [x] Test privacy rule enforcement

3. **Polish**
   - [x] Add animations and transitions
   - [x] Performance optimization
   - [x] Error handling
   - [x] Loading states

### Phase 6: Advanced Features (Week 6)

**Priority: P2**

1. **Status/Mood System**
   - [x] Implement status setting
   - [x] Add mood indicators
   - [x] Status auto-expiry

2. **Mutual Friends**
   - [x] Calculate mutual friends
   - [x] Display on user profiles
   - [x] Respect privacy settings

3. **Profile Sharing**
   - [x] Generate shareable links
   - [x] QR code generation
   - [x] Deep link handling

### Phase 7: Block/Report/Mute & DM Migration (Week 7)

**Priority: P0**

1. **Block/Report/Mute System**
   - [x] Implement block service with full effects
   - [x] Create report submission flow
   - [x] Build mute functionality with settings
   - [x] Add confirmation modals for all actions
   - [x] Integrate with existing blocking service

2. **DM Context Menu Migration**
   - [x] Update ConversationContextMenu to navigate to UserProfileScreen
   - [x] Remove or repurpose ProfilePreviewModal
   - [x] Test all entry points to user profiles
   - [x] Ensure consistent navigation behavior

3. **Friendship Info Display**
   - [x] Implement friendship duration calculation
   - [x] Add streak display with milestones
   - [x] Build friendship anniversary detection
   - [x] Create FriendshipInfoCard component

---

## 19. File Structure

### New Files to Create

```
src/
├── components/profile/
│   ├── ProfilePicture/
│   │   ├── ProfilePicture.tsx
│   │   ├── ProfilePictureEditor.tsx
│   │   ├── ProfilePictureWithDecoration.tsx
│   │   ├── DecorationOverlay.tsx
│   │   ├── DecorationPicker.tsx
│   │   └── index.ts
│   ├── ProfileHeader/
│   │   ├── OwnProfileHeader.tsx
│   │   ├── UserProfileHeader.tsx
│   │   └── index.ts
│   ├── ProfileBio/
│   │   ├── ProfileBio.tsx
│   │   ├── ProfileBioEditor.tsx
│   │   ├── ProfileStatus.tsx
│   │   └── index.ts
│   ├── ProfileGameScores/
│   │   ├── GameScoresDisplay.tsx
│   │   ├── GameScoresEditor.tsx
│   │   └── index.ts
│   ├── ProfileTheme/
│   │   ├── ProfileBackground.tsx
│   │   ├── ThemePicker.tsx
│   │   └── index.ts
│   ├── ProfileActions/
│   │   ├── ProfileActionsBar.tsx
│   │   ├── AddFriendButton.tsx
│   │   ├── MessageButton.tsx
│   │   ├── CallButton.tsx
│   │   ├── MoreOptionsMenu.tsx
│   │   └── index.ts
│   └── index.ts (updated barrel export)
│
├── screens/profile/
│   ├── OwnProfileScreen.tsx (replaces current ProfileScreen)
│   ├── UserProfileScreen.tsx (new)
│   ├── DecorationSelectorScreen.tsx (new)
│   ├── ThemeSelectorScreen.tsx (new)
│   ├── EditBioScreen.tsx (new)
│   ├── EditGameScoresScreen.tsx (new)
│   └── ProfileSettingsScreen.tsx (new)
│
├── services/
│   └── profileService.ts (new)
│
├── data/
│   ├── avatarDecorations.ts (new)
│   └── profileThemes.ts (updated)
│
├── contexts/
│   └── ProfileThemeContext.tsx (new)
│
├── hooks/
│   ├── useProfileData.ts (updated)
│   ├── useUserProfile.ts (new - for viewing other profiles)
│   ├── useRelationship.ts (new)
│   └── useProfileActions.ts (new)
│
└── types/
    └── profile.ts (major updates)

assets/
└── decorations/
    ├── index.ts
    ├── seasonal/
    ├── achievement/
    ├── premium/
    ├── exclusive/
    └── basic/
```

### New Files for Expanded Features

```
src/
├── components/profile/
│   ├── Status/
│   │   ├── StatusIndicator.tsx       # Compact mood/status display
│   │   ├── StatusPicker.tsx          # Modal to set status
│   │   └── index.ts
│   ├── MutualFriends/
│   │   ├── MutualFriendsSection.tsx  # Horizontal scroll preview
│   │   ├── MutualFriendAvatar.tsx    # Single friend avatar
│   │   └── index.ts
│   ├── FriendshipInfo/
│   │   ├── FriendshipInfoCard.tsx    # Streak + duration display
│   │   ├── StreakBadge.tsx           # Milestone badge component
│   │   └── index.ts
│   ├── ProfileShare/
│   │   ├── ShareProfileButton.tsx    # Trigger share
│   │   ├── ShareProfileModal.tsx     # Share options modal
│   │   ├── QRCodeModal.tsx           # QR code display
│   │   └── index.ts
│   └── ProfileModeration/
│       ├── MoreOptionsMenu.tsx       # Block/Report/Mute menu
│       ├── BlockConfirmModal.tsx     # Block confirmation
│       ├── ReportModal.tsx           # Report submission
│       ├── MuteOptionsModal.tsx      # Mute settings
│       └── index.ts
│
├── screens/profile/
│   ├── MutualFriendsListScreen.tsx   # Full mutual friends list
│   ├── PrivacySettingsScreen.tsx     # Privacy settings
│   └── SetStatusScreen.tsx           # Full-screen status editor
│
├── services/
│   ├── profileService.ts             # Core profile operations
│   ├── mutualFriendsService.ts       # Mutual friends calculations
│   ├── profileShareService.ts        # Profile sharing logic
│   └── moderationService.ts          # Block/Report/Mute operations
│
└── hooks/
    ├── useMutualFriends.ts           # Fetch mutual friends
    ├── useFriendshipInfo.ts          # Fetch friendship details
    ├── useProfileShare.ts            # Profile sharing utilities
    └── useProfileModeration.ts       # Block/mute state management
```

### Files to Modify

```
src/navigation/MainNavigator.tsx      - Add new profile routes
src/navigation/RootNavigator.tsx      - Add UserProfile to MainStack
src/navigation/types.ts               - Add new route types
src/types/models.ts                   - Update User interface
src/screens/friends/FriendsScreen.tsx - Navigate to UserProfileScreen
src/components/chat/inbox/ConversationContextMenu.tsx - Update view profile action
src/components/chat/inbox/ProfilePreviewModal.tsx     - Navigate to UserProfile
src/components/chat/inbox/ChatListScreenV2.tsx        - Remove ProfilePreviewModal usage
src/store/UserContext.tsx             - Add new profile fields
src/screens/settings/SettingsScreen.tsx - Add privacy settings section
constants/featureFlags.ts             - Add new feature flags
```

---

## 20. Testing Requirements

### Unit Tests

```typescript
// __tests__/profile/profileService.test.ts
describe("Profile Service", () => {
  describe("uploadProfilePicture", () => {
    it("should upload and return URLs");
    it("should create thumbnail");
    it("should update user document");
    it("should handle errors gracefully");
  });

  describe("updateBio", () => {
    it("should validate length");
    it("should filter profanity");
    it("should update document");
  });

  // ... more tests
});

// __tests__/profile/statusService.test.ts
describe("Status Service", () => {
  describe("setStatus", () => {
    it("should set mood and text correctly");
    it("should enforce character limit");
    it("should calculate expiry correctly");
    it("should respect visibility setting");
  });

  describe("isStatusExpired", () => {
    it("should return false for non-expired status");
    it("should return true for expired status");
    it("should handle null expiresAt");
  });
});

// __tests__/profile/mutualFriends.test.ts
describe("Mutual Friends Service", () => {
  describe("getMutualFriends", () => {
    it("should find correct intersection of friend lists");
    it("should respect limit parameter");
    it("should return empty for no mutual friends");
    it("should handle blocked users correctly");
  });
});

// __tests__/profile/privacyFilters.test.ts
describe("Privacy Filters", () => {
  describe("applyPrivacyFilters", () => {
    it("should show all data to profile owner");
    it("should filter based on 'friends only' settings");
    it("should hide data when set to 'nobody'");
    it("should show 'everyone' data to strangers");
  });
});

// __tests__/profile/friendshipInfo.test.ts
describe("Friendship Info", () => {
  describe("calculateFriendshipDuration", () => {
    it("should format days correctly");
    it("should format months correctly");
    it("should format years and months correctly");
  });

  describe("checkAnniversary", () => {
    it("should detect anniversary today");
    it("should calculate days until next anniversary");
    it("should handle year boundary correctly");
  });
});

// __tests__/profile/decorations.test.ts
describe("Avatar Decorations", () => {
  it("should load all decorations");
  it("should filter by category");
  it("should validate decoration IDs");
});

// __tests__/profile/themes.test.ts
describe("Profile Themes", () => {
  it("should load all themes");
  it("should apply theme correctly");
  it("should handle theme inheritance");
});
```

### Integration Tests

```typescript
// __tests__/integration/userProfile.test.ts
describe("User Profile Flow", () => {
  it("should show correct actions for strangers");
  it("should show correct actions for friends");
  it("should show streak and duration for friends");
  it("should respect privacy settings");
  it("should apply correct theme based on settings");
  it("should display mutual friends when allowed");
});

// __tests__/integration/profileModeration.test.ts
describe("Profile Moderation Flow", () => {
  it("should block user and remove friendship");
  it("should submit report with category and description");
  it("should mute user with correct settings");
  it("should unblock user correctly");
  it("should handle mute expiry");
});

// __tests__/integration/profileShare.test.ts
describe("Profile Sharing Flow", () => {
  it("should generate share data correctly");
  it("should copy link to clipboard");
  it("should handle deep link navigation");
});
```

### E2E Tests

```typescript
// e2e/profile/ownProfile.e2e.ts
describe("Own Profile Screen", () => {
  it("should allow changing profile picture");
  it("should allow editing bio");
  it("should allow setting status with mood");
  it("should allow managing featured badges");
  it("should allow changing theme");
  it("should allow equipping decorations");
  it("should navigate to privacy settings");
});

// e2e/profile/userProfile.e2e.ts
describe("User Profile Screen", () => {
  it("should navigate from friends list");
  it("should navigate from DM context menu");
  it("should show add friend button for strangers");
  it("should show message button for friends");
  it("should display streak count for friends");
  it("should display friendship duration for friends");
  it("should show mutual friends section");
  it("should open share modal");
  it("should open block confirmation");
  it("should open report modal");
});

// e2e/profile/dmMigration.e2e.ts
describe("DM Context Menu to Profile Migration", () => {
  it("should navigate to UserProfileScreen from DM long-press");
  it("should show full profile instead of preview modal");
  it("should allow block/report from full profile");
});
```

---

## 21. Asset Management Guide

### Adding Avatar Decorations

1. **Create your decoration image**
   - Size: Exactly 320x320 pixels
   - Format: PNG with transparency OR animated GIF
   - Design: Frame/border that surrounds the center (profile pic area)

2. **Name your file**
   - Use snake_case: `decoration_name.png` or `decoration_name.gif`
   - Be descriptive: `valentines_hearts.png`, `gold_crown.png`

3. **Place in correct folder**

   ```
   assets/decorations/{category}/your_decoration.png
   ```

   Categories: `seasonal`, `achievement`, `premium`, `exclusive`, `basic`

4. **Register in data file**

   ```typescript
   // src/data/avatarDecorations.ts

   // Import the asset
   import myDecoration from '@assets/decorations/premium/my_decoration.png';

   // Add to AVATAR_DECORATIONS array
   {
     id: 'my_decoration', // Unique ID
     name: 'My Decoration',
     description: 'A cool decoration',
     assetPath: myDecoration,
     animated: false, // true for GIFs
     rarity: 'epic',
     obtainMethod: { type: 'purchase', priceTokens: 1000 },
     category: 'premium',
     available: true,
     sortOrder: 50,
   }
   ```

5. **Test your decoration**
   - Check it renders correctly at different sizes
   - Verify transparency works
   - For GIFs, verify animation plays

### Adding Profile Themes

1. **Create preview image**
   - Size: 200x300 or similar aspect ratio
   - Shows how the theme will look

2. **Define theme configuration**

   ```typescript
   // src/data/profileThemes.ts

   {
     id: 'sunset_gradient',
     name: 'Sunset',
     description: 'Warm sunset colors',
     previewPath: require('@assets/themes/sunset_preview.png'),
     type: 'gradient',
     config: {
       type: 'gradient',
       colors: ['#FF6B6B', '#FFE66D'],
       angle: 180,
     },
     rarity: 'rare',
     obtainMethod: { type: 'purchase', priceTokens: 500 },
     available: true,
     textColorMode: 'dark', // Use dark text on this background
   }
   ```

---

## Appendix A: Feature Flags

Add to `constants/featureFlags.ts`:

```typescript
export const PROFILE_V2_FEATURES = {
  /** Enable new profile picture system */
  CUSTOM_PROFILE_PICTURES: true,

  /** Enable avatar decorations */
  AVATAR_DECORATIONS: true,

  /** Enable profile themes */
  PROFILE_THEMES: true,

  /** Enable game scores on profile */
  PROFILE_GAME_SCORES: true,

  /** Enable status/mood system */
  PROFILE_STATUS: true, // P1

  /** Enable profile sharing */
  PROFILE_SHARING: true, // P1

  /** Enable mutual friends display */
  MUTUAL_FRIENDS: true,

  /** Enable theme inheritance setting */
  THEME_INHERITANCE: true,

  /** Enable friendship info display (streak, duration) */
  FRIENDSHIP_INFO: true,

  /** Enable block/report/mute from profile */
  PROFILE_MODERATION: true,

  /** Enable custom background upload (premium) */
  CUSTOM_BACKGROUNDS: false, // Premium feature

  /** Use new UserProfileScreen for all profile viewing */
  NEW_PROFILE_NAVIGATION: true,

  /** Debug: Log profile operations */
  DEBUG_PROFILE: __DEV__,
} as const;
```

---

## Appendix B: Migration Script

```typescript
// scripts/migrate-profiles.ts

/**
 * Migration script for existing users to new profile system
 *
 * This script will:
 * 1. Add default values for all new profile fields
 * 2. Migrate avatarConfig to new structure (if applicable)
 * 3. Set up default privacy settings
 * 4. Grant default theme
 */

async function migrateUserProfile(userId: string): Promise<void> {
  const userRef = doc(db, "Users", userId);

  await updateDoc(userRef, {
    // Profile picture (default to null)
    profilePicture: {
      url: null,
      thumbnailUrl: null,
      updatedAt: Date.now(),
    },

    // Avatar decoration (none by default)
    avatarDecoration: {
      decorationId: null,
    },

    // Bio (empty by default)
    bio: {
      text: "",
      updatedAt: Date.now(),
    },

    // Status (null by default - no status set)
    // status: null, // Don't set, let it be undefined

    // Game scores (disabled by default)
    gameScores: {
      enabled: false,
      displayedGames: [],
      updatedAt: Date.now(),
    },

    // Theme (default theme)
    theme: {
      equippedThemeId: "default",
      updatedAt: Date.now(),
    },

    // Featured badges (empty by default)
    featuredBadges: {
      badgeIds: [],
      updatedAt: Date.now(),
    },

    // EXPANDED Privacy settings
    privacy: {
      // Profile visibility
      profileVisibility: "everyone",
      showOnlineStatus: "friends",
      showLastActive: "friends",

      // Content visibility
      showBio: "everyone",
      showBadges: "everyone",
      showGameScores: "everyone",
      showStatus: "friends",

      // Social visibility
      showMutualFriends: true,
      showFriendsList: "friends",
      showFriendCount: "everyone",

      // Interaction permissions
      allowFriendRequests: "everyone",
      allowMessages: "everyone",
      allowCalls: "friends",

      // Discovery
      discoverableInSearch: true,
      allowProfileSharing: true,
      trackProfileViews: true,
    },

    // Owned items (grant default theme)
    ownedThemes: ["default"],
    ownedDecorations: [],

    // Metadata
    lastProfileUpdate: Date.now(),
  });
}

/**
 * Run migration for all users
 */
async function migrateAllUsers(): Promise<void> {
  const db = getFirestoreInstance();
  const usersRef = collection(db, "Users");
  const snapshot = await getDocs(usersRef);

  let migrated = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      await migrateUserProfile(doc.id);
      migrated++;
      console.log(`Migrated user ${doc.id} (${migrated}/${snapshot.size})`);
    } catch (error) {
      errors++;
      console.error(`Failed to migrate user ${doc.id}:`, error);
    }
  }

  console.log(`Migration complete: ${migrated} migrated, ${errors} errors`);
}
```

---

## Summary

This plan provides a comprehensive blueprint for implementing a new profile system with:

### Core Profile Features

1. **Custom profile pictures** - Upload any image from device with compression
2. **Avatar decorations** - 320x320 PNG/GIF overlays on profile pictures
3. **Badge display** - Featured badges showcase (up to 5)
4. **Bio section** - User-editable text (200 char limit)
5. **Game scores** - Optional top scores display with comparisons

### Visual Customization

6. **Profile themes** - Customizable backgrounds (solid, gradient, image, pattern)
7. **Theme inheritance** - View profiles in their theme or yours
8. **Dual profile views** - Editable own profile vs read-only others

### Status & Mood System (Section 11)

9. **8 mood types** - Chill, Busy, Gaming, Studying, Away, Excited, Tired, Custom
10. **Custom status text** - Optional 60-character message
11. **Auto-expiry** - Status clears after set duration
12. **Visibility controls** - Show to everyone, friends, or nobody

### Mutual Friends Display (Section 12)

13. **Mutual friends calculation** - Find shared connections
14. **Horizontal scroll preview** - Show first 6-10 mutual friends
15. **Full list screen** - View all mutual friends with search
16. **Privacy respect** - Hide based on user settings

### Profile Sharing (Section 13)

17. **Native share sheet** - Share via any app
18. **Copy link** - Quick clipboard copy
19. **QR code generation** - Scannable profile code
20. **Deep link handling** - Open profiles from links (vibe.app/u/username)

### Privacy & Visibility (Section 14)

21. **Granular controls** - Per-field visibility settings
22. **Privacy presets** - Public, Friends Only, Private quick settings
23. **Contact permissions** - Control who can message, call, friend request
24. **Discovery settings** - Search visibility, profile sharing permissions

### Friendship Info Display (Section 15)

25. **Streak display** - Current streak count with fire emoji
26. **Streak milestones** - Special badges at 7, 30, 100, 365, 1000 days
27. **Friendship duration** - "Friends for 2 years, 3 months"
28. **Anniversary detection** - Celebrate friendship anniversaries

### Block/Report/Mute (Section 16)

29. **Block user** - Full interaction prevention, removes friendship
30. **Report user** - Submit with category and description
31. **Mute user** - Hide content, mute notifications while staying friends
32. **Confirmation modals** - Safe UX for destructive actions

### DM Context Menu Migration (Section 17)

33. **Replace ProfilePreviewModal** - Navigate to full UserProfileScreen
34. **Consistent navigation** - Same profile view from all entry points
35. **All features accessible** - Block/report/mute, share, mutual friends

**Estimated Timeline:** 7 weeks for full implementation

| Phase | Focus                                     | Duration |
| ----- | ----------------------------------------- | -------- |
| 1     | Foundation (types, schema, core services) | Week 1   |
| 2     | Profile Picture & Decorations             | Week 2   |
| 3     | Profile Screens (Own + User)              | Week 3   |
| 4     | Themes & Backgrounds                      | Week 4   |
| 5     | Game Scores & Polish                      | Week 5   |
| 6     | Status, Mutual Friends, Sharing           | Week 6   |
| 7     | Block/Report/Mute, DM Migration           | Week 7   |

**Dependencies:**

- react-native-fast-image (for optimized image loading + GIF support)
- expo-image-picker (for selecting profile pictures)
- expo-image-manipulator (for resizing/compression)
- expo-linear-gradient (for gradient themes)
- react-native-qrcode-svg (for QR code generation)
- @react-native-clipboard/clipboard (for copy to clipboard)

Execute this plan phase by phase, testing thoroughly at each stage before proceeding.
