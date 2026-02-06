# New User Onboarding System — Implementation Plan

> **Status**: Planning  
> **Author**: GitHub Copilot  
> **Date**: February 6, 2026  
> **Scope**: Post-signup first-run experience for new Vibe users

---

## 1. Executive Summary

When a new user signs up and completes the existing `ProfileSetupScreen` (username, display name, avatar colour), they're dumped straight into the main app with no guidance. This plan designs a **multi-step onboarding flow** that introduces key features, personalises the experience, and maximises early retention.

### Goals

| Goal                                    | Metric |
| --------------------------------------- | ------ |
| First-session avatar customisation rate | > 80%  |
| First friend added within 24 hrs        | > 40%  |
| First game played within first session  | > 50%  |
| Onboarding completion rate              | > 70%  |

---

## 2. Current Flow (As-Is)

```
WelcomeScreen → Signup → ProfileSetupScreen → Main App
                                 │
                          ┌──────┘
                          │ username
                          │ display name
                          │ avatar colour (6 options)
                          └──────────────────────────
```

### Problems

1. **ProfileSetupScreen** only lets users pick from 6 solid colours — no hats, glasses, backgrounds, or any of the 30+ cosmetic items already catalogued in `src/data/cosmetics.ts`
2. No introduction to the app's core features (chat, games, moments)
3. No prompt to add friends (the app is meaningless without connections)
4. No explanation of the badge/streak/level system
5. Users have to discover everything on their own

---

## 3. Proposed Flow (To-Be)

```
WelcomeScreen → Signup → ProfileSetupScreen (enhanced)
                                │
                          ┌─────┘
                          ▼
                   ┌─────────────┐
                   │  ONBOARDING │
                   │    FLOW     │
                   └─────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   Step 1: Avatar   Step 2: Bio &    Step 3: Discover
   Customisation     Status           & Connect
          │               │               │
          ▼               ▼               ▼
   Step 4: Feature   Step 5: First    ──▶ Main App
   Tour / Tips       Game Prompt           (with tooltips)
```

### Screen-by-Screen Breakdown

---

### Step 0: Enhanced ProfileSetupScreen (upgrade existing)

**File**: `src/screens/auth/ProfileSetupScreen.tsx` (modify in-place)

Current state picks only baseColor. Enhance to be a proper **avatar builder**:

#### Changes Required

1. **Replace 6-colour picker with a full avatar builder**
   - Colour palette: expand from 6 to 12+ colours (all Catppuccin palette colours)
   - Live avatar preview: render the avatar with selected items in real-time
   - Cosmetic selectors (tabs): Hat, Glasses, Background
   - Only show items from `getStarterItems()` and free items (`getFreeItems()`) from `src/data/cosmetics.ts`
   - Each item shown as emoji tile; selected item highlighted with border

2. **Improve the avatar preview**
   - Replace the static `MaterialCommunityIcons account-circle` with a proper rendered avatar
   - Show hat emoji above, glasses on face, background behind circle
   - Scale preview to 150×150px for impact

3. **Retain** username + display name fields (already well-implemented with availability check)

4. **Add "skip" option** so users aren't blocked — they can always customise later from Profile tab

#### Data Flow

```typescript
// ProfileSetupScreen calls setupNewUser with extended config:
await setupNewUser(uid, email, username, displayName, baseColor, {
  hat: selectedHat, // e.g. "hat_party" or "hat_none"
  glasses: selectedGlasses, // e.g. "glasses_round"
  background: selectedBg, // e.g. "bg_default"
});
```

---

### Step 1: OnboardingAvatarScreen (new)

**File**: `src/screens/onboarding/OnboardingAvatarScreen.tsx`

> _"Make it yours"_

If the ProfileSetupScreen enhancement feels too complex for the signup critical path, this is a **post-signup** alternative. Shows after profile setup but before the main app.

| Element       | Detail                                            |
| ------------- | ------------------------------------------------- |
| Header        | "Make It Yours ✨"                                |
| Preview       | Large avatar (200px) with live cosmetic rendering |
| Tabs          | Colour · Hat · Glasses · Background               |
| Items per tab | Starter + Free items from cosmetics catalogue     |
| CTA           | "Looks Good!" → next step                         |
| Skip          | "I'll do this later" → skip to main app           |

#### Components Needed

| Component        | Path                                | Purpose                                            |
| ---------------- | ----------------------------------- | -------------------------------------------------- |
| `AvatarPreview`  | `src/components/AvatarPreview.tsx`  | Renders avatar with hat/glasses/bg overlays        |
| `CosmeticPicker` | `src/components/CosmeticPicker.tsx` | Tab-based item selector grid                       |
| `CosmeticTile`   | `src/components/CosmeticTile.tsx`   | Individual item tile (emoji + name + rarity badge) |

#### Avatar Preview Component Design

```tsx
// AvatarPreview renders a layered avatar with cosmetics
// Layers (back to front):
//   1. Background circle (baseColor)
//   2. Background decoration (emoji, if selected)
//   3. Face emoji (😊)
//   4. Glasses (positioned on face)
//   5. Hat (positioned above face)

interface AvatarPreviewProps {
  baseColor: string;
  hat?: string; // imagePath from CosmeticItem
  glasses?: string; // imagePath from CosmeticItem
  background?: string;
  size?: number;
}
```

---

### Step 2: OnboardingBioScreen (new)

**File**: `src/screens/onboarding/OnboardingBioScreen.tsx`

> _"Tell the world about yourself"_

| Element       | Detail                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Header        | "Express Yourself 💬"                                                                                                                   |
| Bio input     | Multi-line TextInput, max 200 chars, character counter                                                                                  |
| Mood selector | 9 mood options from `ProfileMood` type (happy, excited, chill, busy, gaming, studying, away, sleeping, custom) — rendered as emoji grid |
| Status text   | Optional one-liner paired with selected mood                                                                                            |
| CTA           | "Next" → Step 3                                                                                                                         |
| Skip          | "Skip for now" → Step 3                                                                                                                 |

#### Data Written

```typescript
// Updates UserProfileData.bio and UserProfileData.status
await updateProfile(uid, {
  bio: { text: bioText, updatedAt: Date.now() },
  status: { mood: selectedMood, text: statusText, setAt: Date.now() },
});
```

---

### Step 3: OnboardingConnectScreen (new)

**File**: `src/screens/onboarding/OnboardingConnectScreen.tsx`

> _"Find your friends"_

| Element            | Detail                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| Header             | "Connect with Friends 🤝"                                               |
| Search bar         | Username search (reuse existing user search service)                    |
| Contact sync       | "Find friends from contacts" button (future: expo-contacts integration) |
| Share invite       | "Share your invite link" → deep link `vibe://invite/{username}`         |
| Friend suggestions | If available, show suggested users                                      |
| CTA                | "Continue" → Step 4                                                     |
| Skip               | "I'll add friends later" → Step 4                                       |

---

### Step 4: OnboardingFeaturesScreen (new)

**File**: `src/screens/onboarding/OnboardingFeaturesScreen.tsx`

> _"Here's what you can do"_

A **swipeable carousel** (3-4 cards) introducing core features. Each card:

| Card | Icon | Title   | Description                                                    |
| ---- | ---- | ------- | -------------------------------------------------------------- |
| 1    | 💬   | Chat    | "Send messages, photos, voice notes, and react with emoji"     |
| 2    | 🎮   | Play    | "Challenge friends to 10+ games — Chess, 2048, Pool, and more" |
| 3    | 📸   | Moments | "Share photos and moments with your friends"                   |
| 4    | 🏆   | Earn    | "Earn badges, climb leaderboards, and collect cosmetics"       |

**Implementation**: Use a `FlatList` with `pagingEnabled` + dot indicators.

| Element         | Detail                    |
| --------------- | ------------------------- |
| CTA (last card) | "Let's Go! 🚀" → Main App |
| Skip (any card) | "Skip Tour" → Main App    |

---

### Step 5: First Game Prompt (contextual)

Rather than a separate screen, this is a **contextual tooltip/banner** shown on the Inbox (home) tab during the first session:

```tsx
// Show a dismissible banner at the top of InboxScreen
{
  isFirstSession && (
    <Surface style={styles.firstGameBanner}>
      <Text>🎮 Try your first game!</Text>
      <Button onPress={() => navigate("GamesHub")}>Play Now</Button>
      <IconButton icon="close" onPress={dismissBanner} />
    </Surface>
  );
}
```

**Tracked via**: `Users/{uid}.onboardingCompleted: boolean` + `Users/{uid}.firstGamePlayed: boolean`

---

## 4. Technical Architecture

### 4.1 Navigation Integration

```typescript
// In RootNavigator.tsx, add a new hydration state:
// "needs_onboarding" — user has profile but hasn't completed onboarding

type HydrationState =
  | "loading"
  | "unauthenticated"
  | "needs_profile"
  | "needs_onboarding" // NEW
  | "banned"
  | "ready";

// The AppGate component checks:
// 1. User exists? No → "unauthenticated"
// 2. User has profile? No → "needs_profile"
// 3. User has onboardingCompleted? No → "needs_onboarding"
// 4. User banned? Yes → "banned"
// 5. Otherwise → "ready"
```

**OnboardingStack** (new navigator):

```typescript
function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingAvatar" component={OnboardingAvatarScreen} />
      <Stack.Screen name="OnboardingBio" component={OnboardingBioScreen} />
      <Stack.Screen name="OnboardingConnect" component={OnboardingConnectScreen} />
      <Stack.Screen name="OnboardingFeatures" component={OnboardingFeaturesScreen} />
    </Stack.Navigator>
  );
}
```

### 4.2 New Files

| File                                                  | Type      | Purpose                             |
| ----------------------------------------------------- | --------- | ----------------------------------- |
| `src/screens/onboarding/OnboardingAvatarScreen.tsx`   | Screen    | Avatar customisation with cosmetics |
| `src/screens/onboarding/OnboardingBioScreen.tsx`      | Screen    | Bio + mood/status setup             |
| `src/screens/onboarding/OnboardingConnectScreen.tsx`  | Screen    | Friend search + invite sharing      |
| `src/screens/onboarding/OnboardingFeaturesScreen.tsx` | Screen    | Feature carousel tour               |
| `src/components/AvatarPreview.tsx`                    | Component | Layered avatar with cosmetics       |
| `src/components/CosmeticPicker.tsx`                   | Component | Tab-based cosmetic item selector    |
| `src/components/OnboardingProgress.tsx`               | Component | Step dots / progress bar            |

### 4.3 Modified Files

| File                                      | Change                                            |
| ----------------------------------------- | ------------------------------------------------- |
| `src/components/AppGate.tsx`              | Add `"needs_onboarding"` hydration state          |
| `src/navigation/RootNavigator.tsx`        | Add `OnboardingStack` conditional rendering       |
| `src/screens/auth/ProfileSetupScreen.tsx` | Enhanced avatar builder (cosmetics)               |
| `src/components/Avatar.tsx`               | Upgrade to render hat/glasses/background overlays |
| `src/types/models.ts`                     | Add `onboardingCompleted?: boolean` to User       |
| `src/services/users.ts`                   | Add `completeOnboarding()` function               |

### 4.4 Data Model Changes

```typescript
// Add to User interface in src/types/models.ts:
export interface User {
  // ... existing fields ...
  onboardingCompleted?: boolean; // Set true after onboarding flow
  onboardingCompletedAt?: number; // Timestamp
}

// Optional: track which steps were completed vs skipped
export interface OnboardingProgress {
  avatarCustomised: boolean;
  bioSet: boolean;
  friendAdded: boolean;
  tourCompleted: boolean;
  completedAt?: number;
}
```

---

## 5. Avatar Component Upgrade Plan

The current `Avatar.tsx` is a coloured circle with a 😊 emoji. The onboarding requires it to render cosmetics. Here's the upgrade path:

### Phase 1: Emoji-Based Cosmetics (Quick Win)

Since all cosmetic items already use emoji `imagePath` values (🔥, 👑, 😎, 🕶️, etc.), we can render them as positioned text layers:

```
┌─────────────────────────┐
│      Hat Layer (🔥)     │  ← positioned top-center, above circle
│  ┌───────────────────┐  │
│  │  Background (🌌)  │  │  ← fills circle behind face
│  │                   │  │
│  │   Face (😊)       │  │  ← center of circle
│  │   Glasses (😎)    │  │  ← overlaid on face
│  │                   │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

### Phase 2: Image-Based Cosmetics (Future)

When actual avatar art assets are available:

- Replace emoji layers with `Image` components
- Support SVG/PNG overlays
- Add animation support (idle bounce, equip effects)

---

## 6. Onboarding Progress Component

A reusable progress indicator shown at the top of each onboarding screen:

```tsx
interface OnboardingProgressProps {
  currentStep: number; // 1-based
  totalSteps: number; // typically 4
}

// Renders:
// ● ● ○ ○   Step 2 of 4
//   ████████░░░░░░░░
```

---

## 7. Implementation Order

Recommended phased rollout:

### Phase A — Avatar Builder (Highest Impact)

1. Upgrade `Avatar.tsx` to render hat/glasses/background emoji layers
2. Create `AvatarPreview.tsx` (large, interactive version)
3. Create `CosmeticPicker.tsx` (reusable item grid)
4. Enhance `ProfileSetupScreen.tsx` with cosmetic selection
5. Write tests for avatar rendering with various cosmetic combos

**Effort**: ~3-4 days  
**Impact**: Immediate — every new user gets a better first experience

### Phase B — Onboarding Flow

1. Add `onboardingCompleted` field to User model
2. Create `OnboardingStack` navigator
3. Build `OnboardingAvatarScreen` (if not done in ProfileSetup)
4. Build `OnboardingBioScreen`
5. Build `OnboardingFeaturesScreen`
6. Wire up `AppGate` with `"needs_onboarding"` state
7. Create `OnboardingProgress` component

**Effort**: ~3-4 days  
**Impact**: High — guided first experience

### Phase C — Social Onboarding

1. Build `OnboardingConnectScreen` with user search
2. Add share invite link functionality
3. Add first-session contextual banners (first game prompt)
4. Track onboarding funnel analytics

**Effort**: ~2-3 days  
**Impact**: Medium — drives early social engagement

### Phase D — Polish & Analytics

1. Add onboarding analytics events (step_viewed, step_completed, step_skipped)
2. A/B test skip rates per step
3. Add re-engagement: prompt avatar customisation from Profile tab if skipped
4. Animate transitions between onboarding steps

**Effort**: ~2 days  
**Impact**: Data-driven iteration

---

## 8. Existing Assets Available

These already exist in the codebase and can be leveraged:

| Asset                  | Location                        | Notes                                          |
| ---------------------- | ------------------------------- | ---------------------------------------------- |
| 30+ cosmetic items     | `src/data/cosmetics.ts`         | Hats, glasses, backgrounds with emoji art      |
| Extended cosmetics     | `src/data/extendedCosmetics.ts` | Profile frames, chat bubbles, 14 slots         |
| Avatar decorations     | `src/data/avatarDecorations.ts` | Decoration overlays                            |
| Profile themes         | `src/data/profileThemes.ts`     | Theme presets                                  |
| `AvatarConfig` type    | `src/types/models.ts`           | `baseColor`, `hat?`, `glasses?`, `background?` |
| `ExtendedAvatarConfig` | `src/types/profile.ts`          | 14 cosmetic slots                              |
| `UserProfileData`      | `src/types/userProfile.ts`      | Bio, status, mood, privacy, decorations        |
| Mood types             | `src/types/userProfile.ts`      | 9 mood presets with emoji                      |
| `getStarterItems()`    | `src/data/cosmetics.ts`         | Items every new user gets                      |
| `getFreeItems()`       | `src/data/cosmetics.ts`         | Items available without unlocking              |
| User search service    | `src/services/users.ts`         | `searchUsers()` for friend discovery           |
| `setupNewUser()`       | `src/services/users.ts`         | Called during profile setup                    |
| Badge system           | `src/data/badges.ts`            | 6 categories of badges                         |
| Catppuccin colours     | `constants/theme.ts`            | Full `Latte` palette (~26 colours)             |

---

## 9. Accessibility & Edge Cases

| Scenario                             | Handling                                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| User force-quits during onboarding   | Resume at last incomplete step on next launch                          |
| User already has profile (migration) | Set `onboardingCompleted: true` for existing users                     |
| No network during onboarding         | Cache selections locally, sync when online                             |
| Screen reader                        | All cosmetic items need accessible labels beyond emoji                 |
| Small screens                        | Cosmetic grid should scroll; avatar preview scales with `SCREEN_WIDTH` |

---

## 10. Success Criteria

| Metric                             | Target | How to Measure                                        |
| ---------------------------------- | ------ | ----------------------------------------------------- |
| Onboarding completion rate         | > 70%  | `onboardingCompleted` count / signup count            |
| Avatar customised (not default)    | > 80%  | Check if hat/glasses/bg differ from defaults          |
| Bio set during onboarding          | > 30%  | Check `bio.text.length > 0` on first day              |
| Feature tour viewed                | > 60%  | Analytics event `onboarding_features_viewed`          |
| Friend request sent in first 24h   | > 40%  | Check friend_requests created within 24h of signup    |
| First game played in first session | > 50%  | Check game sessions with timestamp < 1hr after signup |
