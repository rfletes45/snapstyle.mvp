# Phase A Complete: Brand & Theme Overhaul

## Summary

Implemented the Vibe rebrand with Catppuccin-inspired pastel design system.

## Changes Made

### 1. Branding

- Created [BRANDING.md](BRANDING.md) with:
  - New app name: **Vibe**
  - Tagline: "Share moments, build connections"
  - Complete terminology mapping (Stories→Moments, Snaps→Shots, etc.)
  - Tone of voice guidelines
  - Copy examples for rebranded UI

### 2. Theme System (`constants/theme.ts`)

- Catppuccin-inspired color palettes:
  - **Latte** (Light mode): Warm pastels with mauve primary
  - **Mocha** (Dark mode): Rich deep tones
- Full token system:
  - Backgrounds, surfaces, elevations
  - Primary/secondary colors
  - Status colors (success, warning, error, info)
  - Ritual (streak) colors
  - Card variants
  - Border/divider colors
- React Native Paper themes (`PaperLightTheme`, `PaperDarkTheme`)
- React Navigation themes (`NavigationLightTheme`, `NavigationDarkTheme`)
- Unified `getTheme(isDark)` helper
- Spacing, BorderRadius, FontSizes, Elevation tokens

### 3. Theme Context (`src/store/ThemeContext.tsx`)

- `ThemeProvider` with system preference detection
- `useAppTheme()` hook for full theme access
- `useColors()` convenience hook
- Support for system/light/dark modes

### 4. App Entry (`App.tsx`)

- Wrapped with `ThemeProvider`
- `PaperProvider` receives dynamic theme
- StatusBar adapts to dark/light mode

### 5. Navigation (`src/navigation/RootNavigator.tsx`)

- **Rebranded tabs**: Inbox, Moments, Play, Connections, Profile
- **New icons** (outlined variants, no Snapchat-like)
- All stack navigators use theme colors (no #FFFC00 yellow)
- NavigationContainer receives theme
- Updated linking config routes

### 6. App Config (`app.config.ts`)

- Name: "Vibe"
- Slug: "vibe-app"
- Scheme: "vibe"
- userInterfaceStyle: "automatic" (system preference)

### 7. UI Components Updated

- `EmptyState` - Uses theme colors
- `ErrorState` - Uses theme colors, rebranded copy
- `LoadingState` - Uses theme colors, "Just a moment..." copy
- `ProfileScreen` - Removed all hard-coded #FFFC00 yellow, uses theme

## Definition of Done ✅

- [x] Catppuccin-inspired pastel theme implemented
- [x] Light + Dark mode tokens defined
- [x] Paper + Navigation themes wired
- [x] Tab names rebranded (Inbox, Moments, Play, Connections, Profile)
- [x] Screen titles updated
- [x] Yellow (#FFFC00) removed from navigation
- [x] ProfileScreen uses theme colors
- [x] TypeScript compiles without errors
- [x] BRANDING.md created

## QA Script

### Quick Visual Check

1. `npm start` → Open in Expo Go or web
2. **Check tabs**: Should show Inbox, Moments, Play, Connections, Profile
3. **Check colors**: Headers should be white/subtle, NOT yellow
4. **Check tab icons**: Should be outlined style, mauve/purple when active

### Theme Toggle (Dark Mode)

1. On device: Toggle system dark mode
2. App should switch to dark theme (deep backgrounds, lighter text)
3. Headers should be dark, not jarring

### Profile Screen

1. Navigate to Profile tab
2. Check buttons: Should use theme colors (mauve primary), no gold/yellow
3. Edit profile → Check text inputs have proper styling

### Empty States

1. New user with no connections → Check "No connections yet" styling
2. Empty inbox → Check styling consistency

## Files Modified

- `constants/theme.ts` - Complete rewrite
- `App.tsx` - ThemeProvider + dynamic theming
- `src/navigation/RootNavigator.tsx` - Rebranded + themed
- `src/store/ThemeContext.tsx` - NEW
- `src/components/ui/EmptyState.tsx` - Themed
- `src/components/ui/ErrorState.tsx` - Themed + copy
- `src/components/ui/LoadingState.tsx` - Themed + copy
- `src/screens/profile/ProfileScreen.tsx` - Themed, no hardcoded colors
- `app.config.ts` - Rebranded identity
- `BRANDING.md` - NEW

## Next: Phase B

UX Consistency + Smoother UI:

- FlatList performance tuning
- Consistent Loading/Empty/Error usage across all screens
- AppGate hydration improvements
