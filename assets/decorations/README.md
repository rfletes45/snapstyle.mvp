# Avatar Decorations Assets

This directory contains avatar decoration assets for the new profile system.

## Directory Structure

```
decorations/
├── basic/          # Free starter decorations
├── achievement/    # Earned through achievements
├── premium/        # Purchasable with tokens
├── seasonal/       # Limited-time event decorations
└── exclusive/      # Special/exclusive decorations
```

## Asset Requirements

### Dimensions

- **Size:** 320x320 pixels (REQUIRED - fixed for consistency)
- **Format:** PNG with transparency OR animated GIF
- **Background:** Must be transparent except for decoration elements

### Design Guidelines

1. Decorations should frame the profile picture (circle in center)
2. Leave the center ~200x200 pixels clear for the profile picture
3. Keep important elements away from edges (10px safe zone)
4. For animated GIFs, keep file size under 500KB for performance

### Naming Convention

- Use snake_case: `decoration_name.png` or `decoration_name.gif`
- Be descriptive: `valentines_hearts.png`, `gold_crown.png`
- Include category prefix if helpful: `streak_7.png`, `streak_30.gif`

## Adding New Decorations

1. Create your 320x320 PNG or GIF asset
2. Place it in the appropriate category folder
3. Register in `src/data/avatarDecorations.ts`:

```typescript
{
  id: "unique_id",
  name: "Display Name",
  description: "Short description",
  assetPath: require("@assets/decorations/category/filename.png"),
  animated: false, // true for GIFs
  rarity: "common", // common, rare, epic, legendary, mythic
  obtainMethod: { type: "free" }, // or purchase, achievement, event
  category: "basic", // basic, achievement, premium, seasonal, exclusive
  available: true,
  tags: ["tag1", "tag2"],
  sortOrder: 0,
}
```

## Placeholder Assets

The following placeholder files should be replaced with actual assets:

### Basic (Free)

- [ ] circle_gold.png - Simple golden ring frame
- [ ] circle_silver.png - Simple silver ring frame
- [ ] circle_rainbow.png - Rainbow gradient ring
- [ ] stars.png - Stars border decoration

### Achievement

- [ ] streak_7.png - Week streak frame
- [ ] streak_30.png - Month streak frame (animated)
- [ ] streak_100.gif - Century streak frame (animated)
- [ ] gamer.png - 100 games played
- [ ] social.png - 50 friends milestone
- [ ] champion.gif - #1 leaderboard (animated)

### Premium

- [ ] neon_blue.gif - Blue neon glow (animated)
- [ ] neon_pink.gif - Pink neon glow (animated)
- [ ] diamond.gif - Diamond sparkle (animated)
- [ ] fire.gif - Flames effect (animated)
- [ ] galaxy.gif - Galaxy swirl (animated)
- [ ] hearts.gif - Floating hearts (animated)

### Seasonal

- [ ] valentines_2026.gif - Valentine's Day 2026
- [ ] halloween_2025.gif - Halloween 2025
- [ ] christmas_2025.gif - Christmas 2025
- [ ] spring_2026.png - Spring 2026

### Exclusive

- [ ] beta_tester.png - Beta tester badge
- [ ] founder.gif - Founding member (animated)
- [ ] influencer.gif - Verified influencer (animated)

## Testing Decorations

Use the decoration picker component to preview decorations at different sizes:

- Full size: 320x320
- Profile header: 120x120
- List item: 48x48
- Message avatar: 36x36
