# Play Screen UI/UX Overhaul Plan

**Version:** 1.0  
**Created:** February 2, 2026  
**Status:** Planning Phase  
**Priority:** High

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Design Goals & Principles](#3-design-goals--principles)
4. [Research & Inspiration](#4-research--inspiration)
5. [Architecture Overview](#5-architecture-overview)
6. [Phase 1: Header & Navigation Redesign](#6-phase-1-header--navigation-redesign)
7. [Phase 2: Search & Discovery System](#7-phase-2-search--discovery-system)
8. [Phase 3: Game Card Redesign](#8-phase-3-game-card-redesign)
9. [Phase 4: Category & Browse Experience](#9-phase-4-category--browse-experience)
10. [Phase 5: Game Invites Section](#10-phase-5-game-invites-section)
11. [Phase 6: Active Games Redesign](#11-phase-6-active-games-redesign)
12. [Phase 7: Additional Features](#12-phase-7-additional-features)
13. [Component Specifications](#13-component-specifications)
14. [Animation & Interaction Design](#14-animation--interaction-design)
15. [Implementation Timeline](#15-implementation-timeline)
16. [Success Metrics](#16-success-metrics)

---

## 1. Executive Summary

### 1.1 Vision Statement

Transform the Play screen from a cluttered, bubble-heavy game list into a sleek, app store-inspired gaming hub that feels polished, organized, and delightful to use. The redesign prioritizes discoverability, quick access to active games, and a modern aesthetic that matches contemporary gaming platforms.

### 1.2 Key Changes Overview

| Area         | Current State               | Target State                                                          |
| ------------ | --------------------------- | --------------------------------------------------------------------- |
| Header       | Basic title "Play"          | Compact header with icon buttons (Leaderboard, Achievements, History) |
| Search       | None                        | Full search bar with filters and suggestions                          |
| Game Cards   | Bubbly, rounded, list-style | Modern, tight, sleek cards with subtle depth                          |
| Categories   | Simple list sections        | App Store-style horizontal carousels + grid view                      |
| Game Invites | Mixed with other content    | Dedicated floating/pinned section                                     |
| Recent Games | Full section at bottom      | **REMOVED**                                                           |
| Active Games | Collapsible sections        | Streamlined mini-cards at top                                         |

### 1.3 Primary Objectives

1. **Reduce Visual Clutter** - Remove unnecessary sections, consolidate navigation
2. **Improve Discoverability** - Search bar, smart categorization, featured games
3. **Modern Aesthetic** - Sleek cards, subtle animations, consistent spacing
4. **Quick Access** - Header shortcuts, floating invites, streamlined active games
5. **Scalability** - Design that works as game library grows (10+ games)

---

## 2. Current State Analysis

### 2.1 Current Component Structure

```
GamesHubScreen.tsx (1185 lines)
├── Header (React Navigation default)
├── GameFilterBar (for active games)
├── ActiveGamesSection
│   ├── Your Turn (collapsible)
│   └── Their Turn (collapsible)
├── Universal Invites Section
├── CategorySection (Quick Play)
├── CategorySection (Puzzle)
├── CategorySection (Multiplayer)
├── CategorySection (Daily)
├── Nav Cards Row (Leaderboard, Achievements)
├── Nav Cards Row (Game History)
└── Recent Games Section ← TO BE REMOVED
```

### 2.2 Current Pain Points

| Issue                             | Severity | User Impact                         |
| --------------------------------- | -------- | ----------------------------------- |
| No search capability              | High     | Hard to find games as library grows |
| Bubbly card design feels dated    | Medium   | Doesn't feel premium/modern         |
| Recent Games section adds clutter | Medium   | Redundant with Game History         |
| Nav cards buried at bottom        | High     | Important features hard to find     |
| Invites mixed into content flow   | Medium   | Easy to miss game invites           |
| Categories are basic lists        | Medium   | Not engaging for browsing           |
| No featured/recommended games     | Low      | Missed engagement opportunity       |

### 2.3 Current Styling Issues

```typescript
// Current GameCard styles - too bubbly
gameCard: {
  marginBottom: Spacing.md,
  elevation: 2,
}
gameIconContainer: {
  width: 64,
  height: 64,
  borderRadius: BorderRadius.md,  // Too rounded
}
```

### 2.4 Files to Modify

| File                                       | Purpose              | Changes              |
| ------------------------------------------ | -------------------- | -------------------- |
| `GamesHubScreen.tsx`                       | Main screen          | Complete restructure |
| `components/games/GameCard.tsx`            | Game card component  | Redesign styling     |
| `components/ActiveGamesSection.tsx`        | Active games display | Streamline           |
| `components/games/UniversalInviteCard.tsx` | Invite cards         | Floating treatment   |
| `constants/gamesTheme.ts`                  | Design tokens        | Add new tokens       |

---

## 3. Design Goals & Principles

### 3.1 Visual Design Principles

1. **Tight, Not Bubbly**
   - Reduce border-radius from 12px to 8px or 6px
   - Use sharper corners for a modern feel
   - Subtle shadows instead of heavy elevation

2. **Consistent Spacing**
   - Use 8px grid system consistently
   - Tighter vertical spacing between elements
   - More deliberate white space

3. **Depth Through Subtlety**
   - Layered backgrounds instead of heavy shadows
   - Glass-morphism effects for floating elements
   - Subtle gradients for visual hierarchy

4. **Typography Hierarchy**
   - Bold, clear headings
   - Smaller, muted secondary text
   - Consistent font weights

### 3.2 Interaction Principles

1. **Immediate Feedback** - Touch feedback on all interactive elements
2. **Smooth Transitions** - Spring animations for state changes
3. **Gesture Support** - Swipe actions where appropriate
4. **Progressive Disclosure** - Show more on demand

### 3.3 Information Architecture

```
Play Screen
├── [Header Bar]
│   ├── "Play" Title (left)
│   └── Icon Buttons: Leaderboard | Achievements | History (right)
│
├── [Search Section]
│   └── Search bar with filter chips
│
├── [Game Invites] (Floating/Pinned if any exist)
│   └── Horizontal scroll of invite cards
│
├── [Active Games] (Compact, only if exists)
│   └── Mini-cards showing your turn / their turn
│
├── [Browse Games]
│   ├── Featured Banner (optional)
│   ├── Category: Quick Play (horizontal carousel)
│   ├── Category: Puzzle (horizontal carousel)
│   ├── Category: Multiplayer (horizontal carousel)
│   └── Category: Daily (single card)
│
└── [Bottom Padding for Tab Bar]
```

---

## 4. Research & Inspiration

### 4.1 App Store Design Patterns

**Apple App Store:**

- Large feature cards at top
- Horizontal carousels for categories
- Minimal text, visual-first
- Subtle shadows, rounded corners (but tight)
- Clear hierarchy with bold headings

**Google Play Store:**

- Unified search at top
- Category chips for filtering
- Grid + list hybrid views
- Material Design 3 cards
- Action buttons integrated into cards

**Steam Mobile:**

- Dark theme optimized
- Compact game tiles
- Quick filters
- Prominent play buttons

### 4.2 Gaming App Patterns

**Discord (Activity Panel):**

- Game cards with activity status
- Quick launch buttons
- Invite integration
- Minimal, functional design

**Xbox Game Pass:**

- Large visual tiles
- Category browsing
- Horizontal scrolling
- Play button overlays

### 4.3 Key Takeaways

1. **Visual-First Cards** - Large game icons/artwork, minimal text
2. **Horizontal Carousels** - Natural for category browsing
3. **Persistent Search** - Always accessible at top
4. **Quick Actions** - Play buttons directly on cards
5. **Status Indicators** - Badges for invites, active games, new

---

## 5. Architecture Overview

### 5.1 New Component Structure

```
src/screens/games/
├── PlayScreen.tsx (renamed from GamesHubScreen)
├── components/
│   ├── PlayHeader.tsx (NEW)
│   ├── PlaySearchBar.tsx (NEW)
│   ├── GameInvitesBanner.tsx (NEW)
│   ├── ActiveGamesMini.tsx (NEW)
│   ├── GameCategoryCarousel.tsx (NEW)
│   ├── ModernGameCard.tsx (NEW)
│   ├── FeaturedGameBanner.tsx (NEW)
│   ├── ActiveGamesSection.tsx (existing, modified)
│   └── GameFilterBar.tsx (existing, modified)
```

### 5.2 State Management

```typescript
interface PlayScreenState {
  // Search
  searchQuery: string;
  searchFilters: GameSearchFilters;
  searchResults: ExtendedGameType[];

  // Invites
  gameInvites: UniversalGameInvite[];

  // Active Games
  activeGames: AnyMatch[];
  gameFilters: GameFilters;

  // UI State
  isSearchFocused: boolean;
  selectedCategory: GameCategory | null;

  // Data
  highScores: Map<string, number>;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}
```

### 5.3 New Types

```typescript
// src/types/playScreen.ts

interface GameSearchFilters {
  category?: GameCategory;
  playerCount?: "single" | "multi" | "all";
  hasLeaderboard?: boolean;
  isNew?: boolean;
}

interface FeaturedGame {
  gameType: ExtendedGameType;
  headline: string;
  subheadline: string;
  backgroundColor: string;
  expiresAt?: number;
}

interface GameCategoryConfig {
  id: GameCategory;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  games: ExtendedGameType[];
  layout: "carousel" | "grid" | "single";
}
```

---

## 6. Phase 1: Header & Navigation Redesign

### 6.1 Header Layout

**Current:** Default React Navigation header with "Play" title

**New Design:**

```
┌─────────────────────────────────────────────────────────────┐
│ [Status Bar - Safe Area]                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🎮 Play                          🏆  🎖️  📜               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 PlayHeader Component

```typescript
// src/screens/games/components/PlayHeader.tsx

interface PlayHeaderProps {
  onLeaderboardPress: () => void;
  onAchievementsPress: () => void;
  onHistoryPress: () => void;
  inviteCount?: number;
  yourTurnCount?: number;
}

// Visual Specs:
// - Height: 56px (compact)
// - Background: theme.colors.background (solid)
// - Title: 24px, bold, left-aligned
// - Icon buttons: 40x40px touch targets
// - Icon size: 24px
// - Spacing: 8px between icons
// - Badge: small red dot for notifications
```

### 6.3 Icon Button Specifications

| Button       | Icon      | Badge Condition           |
| ------------ | --------- | ------------------------- |
| Leaderboard  | `trophy`  | Weekly reset reminder     |
| Achievements | `medal`   | New achievements unlocked |
| History      | `history` | None                      |

### 6.4 Implementation

```typescript
function PlayHeader({
  onLeaderboardPress,
  onAchievementsPress,
  onHistoryPress,
  inviteCount = 0,
  yourTurnCount = 0,
}: PlayHeaderProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerContent}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.headerEmoji}>🎮</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Play
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.headerActions}>
          <HeaderIconButton
            icon="trophy"
            color="#FFD700"
            onPress={onLeaderboardPress}
          />
          <HeaderIconButton
            icon="medal"
            color={colors.primary}
            onPress={onAchievementsPress}
          />
          <HeaderIconButton
            icon="history"
            color={colors.textSecondary}
            onPress={onHistoryPress}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'transparent',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEmoji: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
```

---

## 7. Phase 2: Search & Discovery System

### 7.1 Search Bar Design

**Visual Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔍  Search games...                               ⚙️   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [All] [Single Player] [Multiplayer] [Puzzle] [Quick Play]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Search Component Specifications

```typescript
// src/screens/games/components/PlaySearchBar.tsx

interface PlaySearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  filters: GameSearchFilters;
  onFiltersChange: (filters: GameSearchFilters) => void;
  isFocused: boolean;
}

// Visual Specs:
// - Container padding: 16px horizontal
// - Search input height: 44px
// - Border radius: 8px (tight, not bubbly)
// - Background: surfaceVariant
// - Icon: 20px, textSecondary color
// - Placeholder: "Search games..."
// - Filter chips: 8px below search bar
// - Chip height: 32px
// - Chip border radius: 16px
// - Chip gap: 8px
```

### 7.3 Filter Chips

| Chip          | Filter Value             | Default  |
| ------------- | ------------------------ | -------- |
| All           | `category: undefined`    | Selected |
| Single Player | `playerCount: 'single'`  |          |
| Multiplayer   | `playerCount: 'multi'`   |          |
| Puzzle        | `category: 'puzzle'`     |          |
| Quick Play    | `category: 'quick_play'` |          |

### 7.4 Search Logic

```typescript
function searchGames(
  query: string,
  filters: GameSearchFilters,
  allGames: ExtendedGameType[],
): ExtendedGameType[] {
  return allGames.filter((gameId) => {
    const metadata = GAME_METADATA[gameId];
    if (!metadata || !metadata.isAvailable) return false;

    // Text search
    if (query) {
      const searchLower = query.toLowerCase();
      const matchesName = metadata.name.toLowerCase().includes(searchLower);
      const matchesDesc = metadata.description
        .toLowerCase()
        .includes(searchLower);
      if (!matchesName && !matchesDesc) return false;
    }

    // Category filter
    if (filters.category && metadata.category !== filters.category) {
      return false;
    }

    // Player count filter
    if (filters.playerCount === "single" && metadata.isMultiplayer) {
      return false;
    }
    if (filters.playerCount === "multi" && !metadata.isMultiplayer) {
      return false;
    }

    return true;
  });
}
```

### 7.5 Search Results View

When search is active, replace the normal browse view with search results:

```
┌─────────────────────────────────────────────────────────────┐
│ Search Results for "tap"                                    │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [ModernGameCard: Reaction Tap]                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [ModernGameCard: Timed Tap]                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ No more results                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Phase 3: Game Card Redesign

### 8.1 Current vs New Design

**Current Card (Bubbly):**

```
┌────────────────────────────────────────────┐
│  ╭───────╮                                 │
│  │  🐦   │  Flappy Snap          >        │
│  │       │  Tap to fly through...          │
│  ╰───────╯  🏆 Best: 42                    │
└────────────────────────────────────────────┘
  ^ Large rounded corners, heavy shadows
```

**New Card (Modern/Tight):**

```
┌──────────────────────────────────────────────┐
│ ┌──────┐                                     │
│ │  🐦  │  Flappy Snap                 PLAY  │
│ │      │  Quick Play • Best: 42             │
│ └──────┘                                     │
└──────────────────────────────────────────────┘
  ^ Subtle corners (6px), minimal shadow, integrated button
```

### 8.2 ModernGameCard Specifications

```typescript
// src/screens/games/components/ModernGameCard.tsx

interface ModernGameCardProps {
  gameType: ExtendedGameType;
  personalBest?: string | null;
  onPress: () => void;
  variant?: "default" | "compact" | "featured";
  showPlayButton?: boolean;
  isNew?: boolean;
  isLocked?: boolean;
  style?: ViewStyle;
}

// Visual Specs:
// - Card height: 72px (default), 56px (compact), 140px (featured)
// - Border radius: 6px
// - Background: surface
// - Shadow: subtle (elevation 1)
// - Border: 1px surfaceVariant (optional, dark mode)
// - Icon container: 48x48px
// - Icon border radius: 6px
// - Icon background: category accent color at 10% opacity
// - Play button: 32px height, primary color, "PLAY" text
// - Spacing: 12px internal padding
```

### 8.3 Card Layouts

**Default Layout (72px):**

```
┌────────────────────────────────────────────────────────────┐
│ ┌────────┐  Title                                  [PLAY]  │
│ │  Icon  │  Category • Stat                                │
│ └────────┘                                                 │
└────────────────────────────────────────────────────────────┘
```

**Compact Layout (56px):**

```
┌────────────────────────────────────────────────────────────┐
│ ┌──────┐  Title                                     [>]    │
│ │ Icon │  Category                                         │
│ └──────┘                                                   │
└────────────────────────────────────────────────────────────┘
```

**Featured Layout (140px):**

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│      ┌────────────┐                                        │
│      │    Icon    │                                        │
│      │    (lg)    │                                        │
│      └────────────┘                                        │
│           Title                                            │
│         Subtitle                                           │
│                                            [PLAY NOW]      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 8.4 Implementation

```typescript
function ModernGameCard({
  gameType,
  personalBest,
  onPress,
  variant = 'default',
  showPlayButton = true,
  isNew = false,
  isLocked = false,
  style,
}: ModernGameCardProps) {
  const { colors, isDark } = useAppTheme();
  const metadata = GAME_METADATA[gameType];
  const scale = useSharedValue(1);

  const categoryColor = getCategoryColor(metadata.category, isDark);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isLocked}
        style={[
          styles.card,
          styles[`card_${variant}`],
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : 'transparent',
          },
          isLocked && styles.cardLocked,
        ]}
      >
        {/* Icon */}
        <View style={[
          styles.iconContainer,
          styles[`icon_${variant}`],
          { backgroundColor: `${categoryColor}15` }
        ]}>
          <Text style={styles[`iconEmoji_${variant}`]}>
            {metadata.icon}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {metadata.name}
            </Text>
            {isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </View>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {getCategoryLabel(metadata.category)}
            {personalBest && ` • Best: ${personalBest}`}
          </Text>
        </View>

        {/* Action */}
        {showPlayButton && !isLocked ? (
          <View style={[styles.playButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.playButtonText}>PLAY</Text>
          </View>
        ) : isLocked ? (
          <MaterialCommunityIcons
            name="lock"
            size={20}
            color={colors.textMuted}
          />
        ) : (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.textSecondary}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  card_default: {
    height: 72,
    padding: 12,
  },
  card_compact: {
    height: 56,
    padding: 10,
  },
  card_featured: {
    height: 140,
    padding: 16,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLocked: {
    opacity: 0.6,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  icon_default: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  icon_compact: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  icon_featured: {
    width: 64,
    height: 64,
    marginBottom: 12,
  },
  iconEmoji_default: {
    fontSize: 24,
  },
  iconEmoji_compact: {
    fontSize: 18,
  },
  iconEmoji_featured: {
    fontSize: 32,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  newBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  playButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
  },
  playButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
```

---

## 9. Phase 4: Category & Browse Experience

### 9.1 Category Carousel Layout

Replace vertical list sections with horizontal carousels:

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ Quick Play                                    See All >  │
│ Fast-paced action games                                     │
├─────────────────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │
│ │  🐦   │ │  ⚡   │ │  ⏱️   │ │  ⚪   │  →→→              │
│ │Flappy │ │Reaction│ │ Timed │ │Bounce │                    │
│ └────────┘ └────────┘ └────────┘ └────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 GameCategoryCarousel Component

```typescript
// src/screens/games/components/GameCategoryCarousel.tsx

interface GameCategoryCarouselProps {
  category: GameCategoryConfig;
  highScores: Map<string, number>;
  onGamePress: (gameType: ExtendedGameType) => void;
  onSeeAllPress: () => void;
}

// Visual Specs:
// - Section header height: 48px
// - Title: 18px, bold
// - Subtitle: 13px, secondary color
// - "See All" button: 13px, primary color
// - Card width: 100px (square-ish tiles)
// - Card height: 110px
// - Card gap: 10px
// - Horizontal padding: 16px
// - Snap to cards on scroll
```

### 9.3 Category Configurations

```typescript
const CATEGORY_CONFIGS: GameCategoryConfig[] = [
  {
    id: "quick_play",
    title: "⚡ Quick Play",
    subtitle: "Fast-paced action games",
    icon: "lightning-bolt",
    accentColor: "#FF6B6B",
    games: [
      "flappy_snap",
      "reaction_tap",
      "timed_tap",
      "bounce_blitz",
      "snap_snake",
    ],
    layout: "carousel",
  },
  {
    id: "puzzle",
    title: "🧩 Puzzle",
    subtitle: "Test your brain",
    icon: "puzzle",
    accentColor: "#4ECDC4",
    games: ["snap_2048", "memory_snap"],
    layout: "carousel",
  },
  {
    id: "multiplayer",
    title: "👥 Multiplayer",
    subtitle: "Challenge your friends",
    icon: "account-group",
    accentColor: "#6C5CE7",
    games: ["tic_tac_toe", "checkers", "chess", "crazy_eights"],
    layout: "carousel",
  },
  {
    id: "daily",
    title: "📅 Daily Challenge",
    subtitle: "New puzzle every day",
    icon: "calendar-today",
    accentColor: "#FFD700",
    games: ["word_snap"],
    layout: "single",
  },
];
```

### 9.4 Carousel Card (Tile) Design

For horizontal carousels, use a more compact tile design:

```
┌─────────────┐
│             │
│     🐦      │
│             │
├─────────────┤
│ Flappy Snap │
│    ★ 42     │
└─────────────┘
```

```typescript
interface CarouselGameTileProps {
  gameType: ExtendedGameType;
  personalBest?: string | null;
  onPress: () => void;
  isNew?: boolean;
}

// Visual Specs:
// - Width: 100px
// - Height: 110px
// - Border radius: 8px
// - Icon area: 60px height
// - Text area: 50px height
// - Icon size: 32px
// - Title: 12px, semibold, center
// - Score: 11px, secondary, center
```

### 9.5 Daily Challenge Special Treatment

For single-game categories like Daily Challenge:

```
┌─────────────────────────────────────────────────────────────┐
│ 📅 Daily Challenge                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📝   Word Snap                                     │   │
│  │       Guess the daily word!              [PLAY]     │   │
│  │                                                     │   │
│  │  🔥 3 Day Streak    ✅ Today Complete              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Phase 5: Game Invites Section

### 10.1 Design Philosophy

Game invites should be **prominent but not intrusive**. They should appear above the main browse content but collapse gracefully when empty.

### 10.2 Invites Banner Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 📬 Game Invites                                        (3)  │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ ♟️ Chess     │ │ 🎴 Crazy 8s │ │ ⭕ Tic-Tac  │  →→→     │
│ │ From: Alex   │ │ From: Sarah  │ │ From: Mike   │         │
│ │ [Join]       │ │ [Join]       │ │ [Join]       │         │
│ └──────────────┘ └──────────────┘ └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 10.3 GameInvitesBanner Component

```typescript
// src/screens/games/components/GameInvitesBanner.tsx

interface GameInvitesBannerProps {
  invites: UniversalGameInvite[];
  currentUserId: string;
  onJoinInvite: (invite: UniversalGameInvite) => void;
  onDeclineInvite: (invite: UniversalGameInvite) => void;
  onViewAllPress: () => void;
}

// Visual Specs:
// - Container background: surfaceVariant at 50% opacity
// - Container border radius: 12px
// - Container padding: 12px
// - Header height: 32px
// - Title: 15px, semibold
// - Badge: 20px circular, primary color
// - Card width: 140px
// - Card height: 100px
// - Card gap: 10px
// - Horizontal scroll with snap
```

### 10.4 Invite Card (Compact)

```typescript
interface CompactInviteCardProps {
  invite: UniversalGameInvite;
  onJoin: () => void;
  onDecline: () => void;
}

// Visual Specs:
// - Width: 140px
// - Height: 100px
// - Border radius: 8px
// - Background: surface
// - Shadow: subtle
// - Icon: 24px emoji
// - Game name: 13px, semibold
// - Host name: 11px, secondary
// - Join button: 28px height, primary color
// - Decline: X button, top right corner
```

### 10.5 Empty State

When no invites exist, the section doesn't render at all (no empty state).

### 10.6 Animation

- Invites slide in from right when new ones arrive
- Accepted/declined invites slide out
- Badge count animates on change

---

## 11. Phase 6: Active Games Redesign

### 11.1 Streamlined Active Games

Replace the full collapsible sections with a compact mini-card row:

```
┌─────────────────────────────────────────────────────────────┐
│ 🎮 Your Games                              View All (8) >   │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────┐ ┌───────────────────┐                 │
│ │ 🔴 Your Turn (3)  │ │ ⏳ Waiting (5)   │                  │
│ │ Chess vs Alex     │ │ Checkers vs Sam  │                  │
│ │ Tic-Tac vs Mike   │ │                  │                  │
│ └───────────────────┘ └───────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 ActiveGamesMini Component

```typescript
// src/screens/games/components/ActiveGamesMini.tsx

interface ActiveGamesMiniProps {
  games: AnyMatch[];
  currentUserId: string;
  onGamePress: (game: AnyMatch) => void;
  onViewAllPress: () => void;
}

// Visual Specs:
// - Container: 16px horizontal padding
// - Two columns: "Your Turn" and "Waiting"
// - Column width: 50% - 8px gap
// - Column border radius: 8px
// - Column background: surface
// - Column max-height: 120px (show ~3 games)
// - Your Turn: red accent border/indicator
// - Waiting: gray accent
// - Game item: 36px height
// - Game icon: 20px emoji
// - Game text: 13px
// - Opponent name: 11px, truncated
```

### 11.3 Mini Game Item

```typescript
interface MiniGameItemProps {
  game: AnyMatch;
  onPress: () => void;
}

// Layout:
// [🎮] Game vs Opponent    [>]
```

### 11.4 When to Show

- Only show if `activeGames.length > 0`
- Show max 3 games per column
- "View All" links to full ActiveGamesSection (new screen or modal)

---

## 12. Phase 7: Additional Features

### 12.1 Featured Games Banner

Highlight new or promoted games with a large banner:

```
┌─────────────────────────────────────────────────────────────┐
│ ╭─────────────────────────────────────────────────────────╮ │
│ │                    🎴                                   │ │
│ │              CRAZY EIGHTS                               │ │
│ │         Now with 4-player support!                      │ │
│ │                                                         │ │
│ │                   [PLAY NOW]                            │ │
│ ╰─────────────────────────────────────────────────────────╯ │
└─────────────────────────────────────────────────────────────┘
```

**Specs:**

- Height: 160px
- Full width with 16px margin
- Gradient background based on game category
- Large centered icon
- Bold headline
- Subheadline
- CTA button

### 12.2 Quick Match Button

Floating action button for instant multiplayer matching:

```
                                                    ┌───────┐
                                                    │  ⚡   │
                                                    │ QUICK │
                                                    │ MATCH │
                                                    └───────┘
```

**Specs:**

- Position: Bottom right, above tab bar
- Size: 60x60px circular
- Shows modal to select game type
- Initiates matchmaking

### 12.3 Recently Played (Contextual)

Instead of a full section, show recently played games contextually:

- In search suggestions when search is focused
- As "Continue" chips below active games
- In category carousels (moved to front)

### 12.4 Game Statistics Summary

Small stats card showing overall gaming activity:

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 This Week                                                │
│ 23 games played • 15 wins • 65% win rate                   │
└─────────────────────────────────────────────────────────────┘
```

### 12.5 Friends Playing Now

Show which friends are currently in games:

```
┌─────────────────────────────────────────────────────────────┐
│ 🟢 Friends Playing                                          │
│ Alex is playing Chess • Sarah is in Word Snap              │
└─────────────────────────────────────────────────────────────┘
```

### 12.6 Game Recommendations

AI-powered or rule-based game recommendations:

```
┌─────────────────────────────────────────────────────────────┐
│ 💡 Recommended for You                                      │
│ Based on your play history                                  │
├─────────────────────────────────────────────────────────────┤
│ [Memory Snap tile] [Snap 2048 tile]                        │
└─────────────────────────────────────────────────────────────┘
```

### 12.7 Tournaments & Events (Future)

Placeholder for competitive events:

```
┌─────────────────────────────────────────────────────────────┐
│ 🏆 Weekly Tournament                                        │
│ Chess Championship - Starts in 2 days                       │
│                                           [Learn More]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Component Specifications

### 13.1 Design Tokens

Add to `constants/gamesTheme.ts`:

```typescript
// New Design Tokens for Play Screen Overhaul

export const PLAY_SCREEN_TOKENS = {
  // Spacing
  spacing: {
    headerHeight: 56,
    searchBarHeight: 44,
    sectionGap: 24,
    cardGap: 10,
    horizontalPadding: 16,
  },

  // Border Radius (tighter/modern)
  borderRadius: {
    card: 6,
    cardLarge: 8,
    button: 4,
    chip: 16,
    icon: 6,
    container: 12,
  },

  // Shadows (subtle)
  shadows: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    cardHover: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    floating: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
  },

  // Typography
  typography: {
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 28,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 22,
    },
    sectionSubtitle: {
      fontSize: 13,
      fontWeight: "400",
      lineHeight: 18,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 20,
    },
    cardSubtitle: {
      fontSize: 12,
      fontWeight: "400",
      lineHeight: 16,
    },
    buttonText: {
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 16,
    },
  },

  // Colors (extend existing)
  colors: {
    yourTurnAccent: "#FF3B30",
    waitingAccent: "#8E8E93",
    newBadge: "#FF3B30",
    inviteBadge: "#FF9500",
  },
};
```

### 13.2 Component Hierarchy

```
PlayScreen
├── PlayHeader
│   └── HeaderIconButton (x3)
├── PlaySearchBar
│   ├── SearchInput
│   └── FilterChips
├── GameInvitesBanner (conditional)
│   └── CompactInviteCard (x N)
├── ActiveGamesMini (conditional)
│   ├── YourTurnColumn
│   │   └── MiniGameItem (x max 3)
│   └── WaitingColumn
│       └── MiniGameItem (x max 3)
├── ScrollView (main content)
│   ├── FeaturedGameBanner (optional)
│   ├── GameCategoryCarousel (Quick Play)
│   │   └── CarouselGameTile (x N)
│   ├── GameCategoryCarousel (Puzzle)
│   │   └── CarouselGameTile (x N)
│   ├── GameCategoryCarousel (Multiplayer)
│   │   └── CarouselGameTile (x N)
│   └── DailyChallengeCard
└── QuickMatchFAB (optional, future)
```

### 13.3 Shared Components

| Component        | Location           | Reusable |
| ---------------- | ------------------ | -------- |
| HeaderIconButton | `components/ui`    | Yes      |
| CategoryBadge    | `components/games` | Yes      |
| NewBadge         | `components/ui`    | Yes      |
| StatChip         | `components/ui`    | Yes      |

---

## 14. Animation & Interaction Design

### 14.1 Micro-Interactions

| Interaction    | Animation           | Duration             |
| -------------- | ------------------- | -------------------- |
| Card press     | Scale to 0.98       | Spring (damping: 15) |
| Card release   | Scale to 1.0        | Spring (damping: 15) |
| Invite arrive  | Slide in from right | 300ms ease-out       |
| Invite dismiss | Slide out + fade    | 200ms ease-in        |
| Search focus   | Content shift down  | 200ms ease           |
| Filter select  | Chip scale bounce   | Spring               |
| Section expand | Height animate      | 250ms ease           |

### 14.2 Screen Transitions

| Transition      | Type             | Duration |
| --------------- | ---------------- | -------- |
| To game screen  | Slide from right | 300ms    |
| To leaderboard  | Slide from right | 300ms    |
| To achievements | Slide from right | 300ms    |
| Search expand   | Shared element   | 250ms    |

### 14.3 Loading States

**Skeleton Loading:**

- Gray pulsing placeholder cards
- Match final layout dimensions
- 3 skeleton cards per carousel

**Pull to Refresh:**

- Standard iOS/Android pull indicator
- Primary color
- Refresh all data

### 14.4 Haptic Feedback

| Action        | Haptic Type          |
| ------------- | -------------------- |
| Card press    | Light impact         |
| Button press  | Medium impact        |
| Invite action | Success notification |
| Game start    | Heavy impact         |
| Error         | Error notification   |

---

## 15. Implementation Timeline

### Phase 1: Foundation (Week 1)

- [ ] Create new file structure
- [ ] Implement design tokens
- [ ] Build PlayHeader component
- [ ] Build PlaySearchBar component (without search logic)

### Phase 2: Core Components (Week 2)

- [ ] Build ModernGameCard component
- [ ] Build CarouselGameTile component
- [ ] Build GameCategoryCarousel component
- [ ] Implement search logic

### Phase 3: Specialized Sections (Week 3)

- [ ] Build GameInvitesBanner component
- [ ] Build CompactInviteCard component
- [ ] Build ActiveGamesMini component
- [ ] Wire up invite actions

### Phase 4: Integration (Week 4)

- [ ] Refactor GamesHubScreen → PlayScreen
- [ ] Remove Recent Games section
- [ ] Integrate all new components
- [ ] Test navigation flows

### Phase 5: Polish (Week 5)

- [ ] Add all animations
- [ ] Implement haptic feedback
- [ ] Build loading skeletons
- [ ] Performance optimization

### Phase 6: Additional Features (Week 6+)

- [ ] Featured Game Banner
- [ ] Friends Playing Now
- [ ] Game Recommendations
- [ ] Quick Match FAB

---

## 16. Success Metrics

### 16.1 User Experience Metrics

| Metric               | Current | Target | Measurement          |
| -------------------- | ------- | ------ | -------------------- |
| Time to find a game  | ~8s     | <3s    | Analytics            |
| Game discovery rate  | -       | +30%   | Games played variety |
| Invite response rate | ~40%    | >70%   | Invite acceptance    |
| Screen engagement    | -       | +50%   | Time on screen       |

### 16.2 Technical Metrics

| Metric               | Current | Target  | Measurement         |
| -------------------- | ------- | ------- | ------------------- |
| Screen load time     | ~800ms  | <400ms  | Performance monitor |
| Frame rate           | ~55fps  | >58fps  | Performance monitor |
| Component re-renders | -       | Minimal | React DevTools      |
| Bundle size impact   | -       | <50KB   | Bundle analyzer     |

### 16.3 Visual Polish Checklist

- [ ] All cards use 6px border radius
- [ ] Consistent 8px spacing grid
- [ ] Shadows are subtle (opacity < 0.1)
- [ ] Typography hierarchy is clear
- [ ] Colors match category system
- [ ] Dark mode optimized
- [ ] Touch targets ≥ 44px
- [ ] Loading states for all data

---

## Appendix A: File Changes Summary

### Files to Create

```
src/screens/games/components/PlayHeader.tsx
src/screens/games/components/PlaySearchBar.tsx
src/screens/games/components/ModernGameCard.tsx
src/screens/games/components/CarouselGameTile.tsx
src/screens/games/components/GameCategoryCarousel.tsx
src/screens/games/components/GameInvitesBanner.tsx
src/screens/games/components/CompactInviteCard.tsx
src/screens/games/components/ActiveGamesMini.tsx
src/screens/games/components/MiniGameItem.tsx
src/screens/games/components/FeaturedGameBanner.tsx
src/types/playScreen.ts
```

### Files to Modify

```
src/screens/games/GamesHubScreen.tsx (rename to PlayScreen.tsx)
src/screens/games/components/index.ts
src/components/games/index.ts
src/navigation/RootNavigator.tsx (if route name changes)
constants/gamesTheme.ts
```

### Files to Remove

```
(None - deprecate in place)
```

---

## Appendix B: Migration Strategy

### Step 1: Parallel Development

Build new components alongside existing ones without breaking current functionality.

### Step 2: Feature Flag

```typescript
// constants/featureFlags.ts
export const PLAY_SCREEN_V2 = __DEV__; // Enable in dev first
```

### Step 3: A/B Testing

Deploy both versions, route 10% of users to V2, measure metrics.

### Step 4: Full Rollout

After validation, enable for all users and deprecate old components.

---

## Appendix C: Accessibility Considerations

### Screen Reader Support

- All interactive elements have accessibility labels
- Game cards announce: "Game name, category, personal best"
- Invites announce: "Game invite from [host] for [game]"

### Dynamic Type

- All text scales with system font size
- Minimum touch targets maintained at all sizes

### Reduced Motion

- Respect `prefers-reduced-motion` setting
- Disable spring animations when enabled
- Use simple opacity transitions instead

### Color Contrast

- All text meets WCAG AA contrast ratios
- Don't rely solely on color to convey information
- Status indicators have icons + text

---

_Document created by AI Assistant for Vibe App Development Team_
