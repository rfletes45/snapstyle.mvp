# Profile Theme Assets

## Folder Structure

```
assets/themes/
├── previews/         ← Theme preview thumbnails for the picker
├── backgrounds/      ← Full-screen background images for themes
├── patterns/         ← SVG/PNG pattern overlays
└── README.md         ← This file
```

## Preview Images (previews/)

Used in the theme picker modal to show what a theme looks like.

**Note:** The ThemePreviewCard component renders synthetic previews from
the theme's color definitions, so preview images are **optional** — they
enhance the picker but aren't required for themes to work.

### Specs

- **Size:** 200×300px (portrait aspect ratio)
- **Format:** PNG
- **Naming:** `{theme_id}_preview.png`

### Expected Files

| Filename                       | Theme            |
| ------------------------------ | ---------------- |
| `default_preview.png`          | Default          |
| `catppuccin_latte_preview.png` | Catppuccin Latte |
| `catppuccin_mocha_preview.png` | Catppuccin Mocha |
| `dark_preview.png`             | Dark Mode        |
| `midnight_blue_preview.png`    | Midnight Blue    |
| `sunset_preview.png`           | Sunset           |
| `ocean_preview.png`            | Ocean Breeze     |
| `forest_preview.png`           | Forest           |
| `cherry_preview.png`           | Cherry Blossom   |
| `aurora_preview.png`           | Aurora Borealis  |
| `cyberpunk_preview.png`        | Cyberpunk        |
| `galaxy_preview.png`           | Galaxy           |
| `royal_preview.png`            | Royal            |
| `golden_preview.png`           | Golden Hour      |
| `fire_ice_preview.png`         | Fire & Ice       |
| `holo_preview.png`             | Holographic      |
| `cosmic_void_preview.png`      | Cosmic Void      |
| `diamond_preview.png`          | Diamond Elite    |
| `champion_preview.png`         | Champion         |

## Background Images (backgrounds/)

Full-screen images used as the profile screen background for certain themes.
Only themes with a `backgroundImage` property need these.

### Specs

- **Size:** 1080×1920px (phone aspect ratio) or tileable
- **Format:** PNG (transparency optional)
- **Naming:** `{theme_id}_bg.png`

### Expected Files

| Filename             | Theme       |
| -------------------- | ----------- |
| `galaxy_bg.png`      | Galaxy      |
| `cosmic_void_bg.png` | Cosmic Void |
| `champion_bg.png`    | Champion    |

## Pattern Overlays (patterns/)

Subtle repeating patterns overlaid on theme backgrounds.
Only themes with a `backgroundPattern.customPath` need these.

### Specs

- **Size:** 200×200px tileable pattern, or SVG
- **Format:** PNG or SVG
- **Opacity:** Applied programmatically (usually 5–15%)

### Expected Files

| Filename       | Theme          |
| -------------- | -------------- |
| `petals.svg`   | Cherry Blossom |
| `luxury.svg`   | Golden Hour    |
| `diamonds.svg` | Diamond Elite  |
