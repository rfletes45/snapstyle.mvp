# Digital Avatar System - Comprehensive Implementation Plan

**Version:** 2.0  
**Created:** February 2, 2026  
**Last Updated:** February 2, 2026  
**Status:** Planning Phase  
**Priority:** Critical - Core Feature  
**Estimated Complexity:** Very High

---

## Changelog

| Version | Date        | Changes                                                                                                                                                                                                                                                                                                         |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.0     | Feb 2, 2026 | Enhanced all implementation phases with day-by-day tasks, added detailed file path mappings, expanded Firebase schema with complete security rules, added comprehensive testing strategy with unit/integration/E2E tests, added complete migration script implementation, added full type definitions reference |
| 1.0     | Feb 2, 2026 | Initial comprehensive plan created                                                                                                                                                                                                                                                                              |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Analysis](#2-current-system-analysis)
3. [Target System Architecture](#3-target-system-architecture)
4. [Avatar Anatomy System](#4-avatar-anatomy-system)
5. [Facial Features System](#5-facial-features-system)
6. [Body Customization System](#6-body-customization-system)
7. [Clothing System](#7-clothing-system)
8. [Accessories System](#8-accessories-system)
9. [Rendering Architecture](#9-rendering-architecture)
10. [Asset Pipeline](#10-asset-pipeline)
11. [Data Models & Firebase Schema](#11-data-models--firebase-schema)
12. [Component Architecture](#12-component-architecture)
13. [Performance Optimization](#13-performance-optimization)
14. [Animation System](#14-animation-system)
15. [Customization UI](#15-customization-ui)
16. [Migration Strategy](#16-migration-strategy)
17. [Implementation Phases](#17-implementation-phases)
18. [Technical Specifications](#18-technical-specifications)
19. [Integration Points with Existing Code](#19-integration-points-with-existing-code)
20. [Type Definitions Reference](#20-type-definitions-reference)
21. [Appendices](#appendix-a-asset-inventory)

---

## 1. Executive Summary

### 1.1 Vision Statement

Transform the current simple colored-circle avatar with emoji overlays into a sophisticated, fully-customizable digital avatar system comparable to Snapchat's Bitmoji. Users will be able to create unique digital representations of themselves with customizable body features, facial characteristics, clothing, and accessories.

### 1.2 Core Requirements

| Category        | Features                                         |
| --------------- | ------------------------------------------------ |
| **Body**        | Skin tone, body shape, height proportions        |
| **Face Shape**  | Head shape, face width, jawline, chin            |
| **Eyes**        | Shape, size, color, spacing, eyelashes, eyebrows |
| **Nose**        | Shape, size, width, bridge                       |
| **Mouth**       | Shape, size, lip thickness, lip color            |
| **Ears**        | Shape, size, position                            |
| **Hair**        | Style, color, length, texture, facial hair       |
| **Clothing**    | Tops, bottoms, full outfits, layers              |
| **Accessories** | Hats, glasses, jewelry, watches, bags            |

### 1.3 Key Differences from Current System

| Aspect        | Current                                         | Target                                   |
| ------------- | ----------------------------------------------- | ---------------------------------------- |
| Avatar Type   | Colored circle + Material icon + emoji overlays | Fully rendered character with body parts |
| Customization | ~8 base colors, ~20 cosmetic items              | 500+ customization combinations          |
| Rendering     | React Native Views + Text (emoji)               | SVG-based layered rendering              |
| Skin Tones    | None (just circle color)                        | 12+ realistic skin tones                 |
| Body Features | None                                            | Full face/body customization             |
| Clothing      | Emoji overlays only                             | Proper layered clothing system           |
| Hair          | None                                            | 50+ hairstyles with color options        |

### 1.4 Files to Create

```
src/
├── components/
│   └── avatar/
│       ├── index.ts                    # Public exports
│       ├── DigitalAvatar.tsx           # Main avatar component
│       ├── AvatarSvgRenderer.tsx       # SVG rendering engine
│       ├── AvatarParts/
│       │   ├── index.ts
│       │   ├── Body.tsx                # Body shape SVG
│       │   ├── Head.tsx                # Head/face shape SVG
│       │   ├── Eyes.tsx                # Eyes SVG (includes eyebrows)
│       │   ├── Nose.tsx                # Nose SVG
│       │   ├── Mouth.tsx               # Mouth SVG
│       │   ├── Ears.tsx                # Ears SVG
│       │   ├── Hair.tsx                # Hair SVG (includes facial hair)
│       │   ├── Clothing.tsx            # Clothing layers SVG
│       │   └── Accessories.tsx         # Accessories SVG
│       └── AvatarCustomizer/
│           ├── index.ts
│           ├── AvatarCustomizerModal.tsx
│           ├── CategoryTabs.tsx
│           ├── FeatureSliders.tsx
│           ├── ColorPickers.tsx
│           ├── ItemGrids.tsx
│           └── PreviewPanel.tsx
├── data/
│   └── avatarAssets/
│       ├── index.ts                    # Master exports
│       ├── skinTones.ts                # Skin tone definitions
│       ├── faceShapes.ts               # Face shape definitions
│       ├── eyeStyles.ts                # Eye styles and colors
│       ├── noseStyles.ts               # Nose style definitions
│       ├── mouthStyles.ts              # Mouth style definitions
│       ├── earStyles.ts                # Ear style definitions
│       ├── hairStyles.ts               # Hair style definitions
│       ├── hairColors.ts               # Hair color definitions
│       ├── facialHair.ts               # Facial hair styles
│       ├── bodyShapes.ts               # Body type definitions
│       ├── clothingTops.ts             # Top clothing items
│       ├── clothingBottoms.ts          # Bottom clothing items
│       ├── clothingOutfits.ts          # Full outfit definitions
│       └── accessories.ts              # All accessory definitions
├── types/
│   └── avatar.ts                       # Avatar type definitions
├── services/
│   └── avatarService.ts                # Avatar CRUD operations
├── hooks/
│   └── useAvatarCustomization.ts       # Avatar customization hook
└── utils/
    └── avatarHelpers.ts                # Avatar utility functions
```

### 1.5 Files to Modify

```
src/components/Avatar.tsx               # Deprecate, redirect to DigitalAvatar
src/components/AvatarCustomizer.tsx     # Complete rewrite
src/components/AvatarWithFrame.tsx      # Update to use DigitalAvatar
src/types/models.ts                     # Extend AvatarConfig
src/types/profile.ts                    # Extend ExtendedAvatarConfig
src/data/cosmetics.ts                   # Update to new system
src/data/extendedCosmetics.ts           # Update to new system
src/services/cosmetics.ts               # Update for new avatar data
src/services/users.ts                   # Update avatar config handling
firebase-backend/firestore.rules        # Add avatar validation rules
```

---

## 2. Current System Analysis

### 2.1 Current Avatar Structure

```typescript
// Current AvatarConfig in src/types/models.ts
interface AvatarConfig {
  baseColor: string; // Circle background color (e.g., "#FF6B6B")
  hat?: string; // Hat item ID (renders emoji on top)
  glasses?: string; // Glasses item ID (renders emoji in middle)
  background?: string; // Background effect ID
}
```

### 2.2 Current Rendering Approach

```typescript
// Current Avatar.tsx simplified
function Avatar({ config, size }) {
  return (
    <View style={{ backgroundColor: config.baseColor, borderRadius: size/2 }}>
      {/* Material icon as base "face" */}
      <MaterialCommunityIcons name="account-circle" size={size*0.7} />

      {/* Emoji overlays for hat/glasses */}
      {config.hat && <Text style={hatStyle}>{hatEmoji}</Text>}
      {config.glasses && <Text style={glassesStyle}>{glassesEmoji}</Text>}
    </View>
  );
}
```

### 2.3 Current Limitations

1. **No Real Avatar** - Just a colored circle with a generic icon
2. **No Body Parts** - No face features, no body customization
3. **Limited Expression** - Can't create unique-looking avatars
4. **Emoji-Based Items** - Clothing/accessories are just emoji text
5. **No Skin Tones** - Base color is just a background, not skin
6. **No Layering** - Items just overlay, don't interact properly
7. **No Animation Support** - Static rendering only

### 2.4 Current Cosmetic Items

From `src/data/cosmetics.ts`:

- 7 backgrounds (gradient effects)
- 8 hats (emoji-based: 🔥, 👑, 🎉, 🧢, etc.)
- 7 glasses (emoji-based: 😎, 👓, 🕶️, etc.)

From `src/data/extendedCosmetics.ts`:

- 9 clothing tops (emoji placeholders)
- 5 clothing bottoms (emoji placeholders)
- 6 neck accessories (emoji placeholders)
- 4 ear accessories (emoji placeholders)
- 5 hand accessories (emoji placeholders)
- 10 profile frames (border effects)
- 7 profile banners

---

## 3. Target System Architecture

### 3.1 Layered SVG Rendering System

The avatar will be rendered as a stack of SVG layers, from back to front:

```
Layer Stack (bottom to top):
┌─────────────────────────────────────┐
│ 12. Special Effects (aura, sparkle) │
├─────────────────────────────────────┤
│ 11. Headwear (hats, headbands)      │
├─────────────────────────────────────┤
│ 10. Hair (front portions)           │
├─────────────────────────────────────┤
│ 9. Eyewear (glasses, goggles)       │
├─────────────────────────────────────┤
│ 8. Facial Features (eyes, nose)     │
├─────────────────────────────────────┤
│ 7. Ear Accessories                  │
├─────────────────────────────────────┤
│ 6. Hair (back portions)             │
├─────────────────────────────────────┤
│ 5. Ears                             │
├─────────────────────────────────────┤
│ 4. Head/Face Shape                  │
├─────────────────────────────────────┤
│ 3. Neck Accessories                 │
├─────────────────────────────────────┤
│ 2. Clothing (tops)                  │
├─────────────────────────────────────┤
│ 1. Body Base                        │
├─────────────────────────────────────┤
│ 0. Background (optional frame)      │
└─────────────────────────────────────┘
```

### 3.2 Technology Stack

| Component        | Technology                | Rationale                             |
| ---------------- | ------------------------- | ------------------------------------- |
| SVG Rendering    | `react-native-svg`        | Cross-platform, scalable, colorizable |
| Animation        | `react-native-reanimated` | Already in project, smooth animations |
| State Management | React Context + Hooks     | Consistent with codebase patterns     |
| Storage          | Firebase Firestore        | Existing infrastructure               |
| Asset Bundling   | Metro bundler             | Standard for Expo                     |

### 3.3 Avatar Coordinate System

```
SVG Viewbox: 0 0 200 300 (width: 200, height: 300)

Key Anchor Points (y-axis is inverted in SVG):
┌────────────────────────────────────────┐
│                 (100, 0)               │  ← Top center
│                    │                   │
│         ┌──────────┼──────────┐        │
│         │    HEAD CENTER      │        │  ← (100, 60)
│         │      (100, 60)      │        │
│         │         ●          │         │
│    (30, 80) ●    │    ● (170, 80)     │  ← Ear anchors
│         │         │          │         │
│         └─────────┼──────────┘         │
│                   │                    │
│         ┌─────────┼──────────┐         │
│         │   BODY CENTER      │         │  ← (100, 180)
│         │     (100, 180)     │         │
│         │         ●          │         │
│         │         │          │         │
│         └─────────┼──────────┘         │
│                   │                    │
│              (100, 300)                │  ← Bottom center
└────────────────────────────────────────┘
```

---

## 4. Avatar Anatomy System

### 4.1 Complete Anatomy Breakdown

```typescript
// src/types/avatar.ts

/**
 * Complete digital avatar configuration
 * This replaces the simple AvatarConfig for sophisticated avatars
 */
interface DigitalAvatarConfig {
  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION & METADATA
  // ═══════════════════════════════════════════════════════════════════════════
  version: 2; // Avatar system version for migrations
  createdAt: number; // Timestamp of creation
  updatedAt: number; // Timestamp of last update

  // ═══════════════════════════════════════════════════════════════════════════
  // BODY CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  body: {
    skinTone: SkinToneId; // e.g., "skin_01" through "skin_12"
    shape: BodyShapeId; // e.g., "slim", "average", "athletic", "curvy"
    height: number; // 0.8 to 1.2 scale factor
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FACE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  face: {
    shape: FaceShapeId; // e.g., "oval", "round", "square", "heart"
    width: number; // 0.8 to 1.2 scale factor
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EYES CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  eyes: {
    style: EyeStyleId; // Shape of eye (almond, round, etc.)
    color: EyeColorId; // Iris color
    size: number; // 0.8 to 1.2 scale
    spacing: number; // 0.8 to 1.2 (closer to wider apart)
    tilt: number; // -10 to 10 degrees

    // Eyebrows (included with eyes for cohesion)
    eyebrows: {
      style: EyebrowStyleId; // e.g., "natural", "arched", "thick"
      color: HairColorId; // Usually matches hair color
      thickness: number; // 0.8 to 1.2
    };

    // Eyelashes
    eyelashes: {
      style: EyelashStyleId; // e.g., "none", "natural", "long", "dramatic"
      color: string; // Usually black/brown
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NOSE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  nose: {
    style: NoseStyleId; // e.g., "small", "button", "roman", "wide"
    size: number; // 0.8 to 1.2 scale
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUTH CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  mouth: {
    style: MouthStyleId; // e.g., "smile", "neutral", "smirk"
    size: number; // 0.8 to 1.2 scale
    lipColor: LipColorId; // Lip tint/color
    lipThickness: number; // 0.8 to 1.2
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EARS CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  ears: {
    style: EarStyleId; // e.g., "small", "medium", "large", "pointed"
    size: number; // 0.8 to 1.2 scale
    visible: boolean; // Can be hidden by hair
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HAIR CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  hair: {
    style: HairStyleId; // e.g., "short_crop", "long_wavy", "bald"
    color: HairColorId; // Primary hair color
    highlightColor?: HairColorId; // Optional highlights

    // Facial hair (for applicable users)
    facialHair: {
      style: FacialHairStyleId; // e.g., "none", "stubble", "beard", "goatee"
      color: HairColorId; // Usually matches hair color
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOTHING CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  clothing: {
    top: ClothingTopId | null; // Shirt, jacket, etc.
    bottom: ClothingBottomId | null; // Pants, skirt, etc.
    outfit: ClothingOutfitId | null; // Full outfit (overrides top/bottom)
    layer?: ClothingLayerId | null; // Jacket/coat over top
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSORIES CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  accessories: {
    headwear: HeadwearId | null; // Hats, headbands, etc.
    eyewear: EyewearId | null; // Glasses, sunglasses, etc.
    earwear: EarwearId | null; // Earrings, earbuds, etc.
    neckwear: NeckwearId | null; // Necklaces, scarves, etc.
    wristwear: WristwearId | null; // Watches, bracelets, etc.
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY COMPATIBILITY (from existing AvatarConfig)
  // ═══════════════════════════════════════════════════════════════════════════
  legacy?: {
    baseColor?: string; // Old circle color
    hat?: string; // Old hat item ID
    glasses?: string; // Old glasses item ID
    background?: string; // Old background ID
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE CUSTOMIZATION (from ExtendedAvatarConfig)
  // ═══════════════════════════════════════════════════════════════════════════
  profile?: {
    frame: string | null; // Profile frame ID
    banner: string | null; // Profile banner ID
    theme: string | null; // Profile theme ID
    chatBubble: string | null; // Chat bubble style ID
    nameEffect: string | null; // Name effect ID
    featuredBadges: string[]; // Up to 5 badge IDs
  };
}
```

### 4.2 Preset System

For users who don't want to customize every detail, provide presets:

```typescript
interface AvatarPreset {
  id: string;
  name: string;
  description: string;
  preview: string; // Preview image path
  category: "masculine" | "feminine" | "androgynous" | "fantasy";
  config: Partial<DigitalAvatarConfig>; // Preset values
  locked: boolean;
  unlockRequirement?: {
    type: "free" | "level" | "purchase" | "achievement";
    value?: number | string;
  };
}

// Example presets
const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "preset_classic_m1",
    name: "Classic Alex",
    description: "A friendly, approachable look",
    preview: "presets/classic_m1.png",
    category: "masculine",
    config: {
      body: { skinTone: "skin_03", shape: "average", height: 1.0 },
      face: { shape: "oval", width: 1.0 },
      eyes: {
        style: "eye_natural",
        color: "brown",
        size: 1.0,
        spacing: 1.0,
        tilt: 0,
      },
      hair: { style: "hair_short_classic", color: "brown_dark" },
      // ... etc
    },
    locked: false,
  },
  // ... more presets
];
```

---

## 5. Facial Features System

### 5.1 Face Shapes

```typescript
// src/data/avatarAssets/faceShapes.ts

interface FaceShape {
  id: FaceShapeId;
  name: string;
  svgPath: string; // SVG path data for face outline
  chinOffset: number; // Y offset for chin position
  jawWidth: number; // Base jaw width multiplier
  cheekCurve: number; // Cheek roundness factor
}

type FaceShapeId =
  | "oval" // Classic oval, balanced proportions
  | "round" // Circular, soft features
  | "square" // Strong jawline, angular
  | "rectangle" // Longer face, squared jaw
  | "heart" // Wide forehead, pointed chin
  | "triangle" // Narrow forehead, wide jaw
  | "diamond" // Wide cheekbones, narrow forehead and jaw
  | "oblong"; // Long and narrow

const FACE_SHAPES: FaceShape[] = [
  {
    id: "oval",
    name: "Oval",
    svgPath:
      "M100,20 C140,20 165,50 170,90 C175,130 165,170 150,195 C135,220 115,235 100,240 C85,235 65,220 50,195 C35,170 25,130 30,90 C35,50 60,20 100,20 Z",
    chinOffset: 0,
    jawWidth: 1.0,
    cheekCurve: 0.5,
  },
  {
    id: "round",
    name: "Round",
    svgPath:
      "M100,15 C150,15 180,60 180,120 C180,180 150,225 100,225 C50,225 20,180 20,120 C20,60 50,15 100,15 Z",
    chinOffset: -10,
    jawWidth: 1.1,
    cheekCurve: 0.8,
  },
  {
    id: "square",
    name: "Square",
    svgPath:
      "M100,20 C135,20 165,35 175,70 C180,105 180,160 175,200 C165,225 135,235 100,235 C65,235 35,225 25,200 C20,160 20,105 25,70 C35,35 65,20 100,20 Z",
    chinOffset: 5,
    jawWidth: 1.2,
    cheekCurve: 0.2,
  },
  // ... more shapes
];
```

### 5.2 Eye Styles

```typescript
// src/data/avatarAssets/eyeStyles.ts

interface EyeStyle {
  id: EyeStyleId;
  name: string;
  svgPath: string; // Path for eye shape
  pupilPosition: { x: number; y: number };
  irisSize: number;
  pupilSize: number;
  scleraPath: string; // White of eye path
}

type EyeStyleId =
  | "eye_natural" // Default natural eye
  | "eye_almond" // Almond-shaped, slightly angled
  | "eye_round" // Large, round eyes
  | "eye_hooded" // Partially covered by lid
  | "eye_upturned" // Outer corners point up
  | "eye_downturned" // Outer corners point down
  | "eye_monolid" // Single eyelid, no crease
  | "eye_wide" // Extra large, expressive
  | "eye_narrow" // Thin, elegant
  | "eye_cat"; // Dramatic cat eye shape

interface EyeColor {
  id: EyeColorId;
  name: string;
  irisColors: {
    outer: string; // Outer iris ring
    middle: string; // Middle iris
    inner: string; // Inner iris (near pupil)
  };
  pupilColor: string; // Usually black
  highlight: string; // Reflection highlight color
}

type EyeColorId =
  | "brown_dark"
  | "brown_light"
  | "brown_honey"
  | "hazel"
  | "green"
  | "green_light"
  | "blue"
  | "blue_light"
  | "blue_gray"
  | "gray"
  | "amber"
  | "violet" // Rare/fantasy
  | "heterochromia"; // Two different colors (special)

const EYE_COLORS: EyeColor[] = [
  {
    id: "brown_dark",
    name: "Dark Brown",
    irisColors: {
      outer: "#3D2314",
      middle: "#5D3A1A",
      inner: "#8B4513",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "blue",
    name: "Blue",
    irisColors: {
      outer: "#1E3A5F",
      middle: "#2E5A8F",
      inner: "#4A90D9",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  // ... more colors
];
```

### 5.3 Eyebrow Styles

```typescript
// src/data/avatarAssets/eyeStyles.ts (continued)

interface EyebrowStyle {
  id: EyebrowStyleId;
  name: string;
  svgPath: string; // Path for eyebrow shape
  thickness: number; // Base thickness
  arch: number; // Arch height (0-1)
  tailLength: number; // How far brow extends
}

type EyebrowStyleId =
  | "brow_natural" // Soft, natural shape
  | "brow_straight" // Horizontal, minimal arch
  | "brow_arched" // High arch
  | "brow_rounded" // Soft curved arch
  | "brow_angled" // Sharp angle at peak
  | "brow_thick" // Bold, bushy
  | "brow_thin" // Delicate, thin
  | "brow_feathered" // Soft, feathered texture
  | "brow_none"; // No visible eyebrows
```

### 5.4 Nose Styles

```typescript
// src/data/avatarAssets/noseStyles.ts

interface NoseStyle {
  id: NoseStyleId;
  name: string;
  svgPath: string;
  bridgeWidth: number; // Width at bridge
  tipWidth: number; // Width at tip
  nostrilSize: number; // Nostril visibility
  length: number; // Nose length factor
}

type NoseStyleId =
  | "nose_small" // Small, understated
  | "nose_button" // Round, cute button nose
  | "nose_straight" // Straight bridge
  | "nose_roman" // Prominent bridge with curve
  | "nose_snub" // Upturned tip
  | "nose_aquiline" // Pronounced, curved bridge
  | "nose_wide" // Wider nostrils and tip
  | "nose_narrow" // Thin, elongated
  | "nose_flat" // Flatter bridge
  | "nose_pointed"; // Sharp, defined tip

const NOSE_STYLES: NoseStyle[] = [
  {
    id: "nose_small",
    name: "Small",
    svgPath: "M95,75 L100,85 L105,75 M92,85 Q100,92 108,85",
    bridgeWidth: 0.8,
    tipWidth: 0.9,
    nostrilSize: 0.7,
    length: 0.85,
  },
  // ... more styles
];
```

### 5.5 Mouth Styles

```typescript
// src/data/avatarAssets/mouthStyles.ts

interface MouthStyle {
  id: MouthStyleId;
  name: string;
  upperLipPath: string; // Upper lip SVG path
  lowerLipPath: string; // Lower lip SVG path
  teethPath?: string; // Optional teeth visibility
  expression: "neutral" | "smile" | "smirk" | "frown" | "open";
}

type MouthStyleId =
  | "mouth_neutral" // Neutral, relaxed
  | "mouth_smile" // Friendly smile
  | "mouth_grin" // Big, toothy grin
  | "mouth_smirk" // Asymmetric smirk
  | "mouth_pout" // Pouty lips
  | "mouth_thin" // Thin lips
  | "mouth_full" // Full, plump lips
  | "mouth_wide" // Wide mouth
  | "mouth_small"; // Small, delicate

interface LipColor {
  id: LipColorId;
  name: string;
  color: string;
  glossy: boolean;
}

type LipColorId =
  | "lip_natural_light"
  | "lip_natural_medium"
  | "lip_natural_dark"
  | "lip_pink"
  | "lip_rose"
  | "lip_red"
  | "lip_berry"
  | "lip_nude"
  | "lip_coral"
  | "lip_mauve";
```

### 5.6 Ear Styles

```typescript
// src/data/avatarAssets/earStyles.ts

interface EarStyle {
  id: EarStyleId;
  name: string;
  svgPath: string;
  lobeSize: number; // Earlobe prominence
  angle: number; // How much ears stick out
}

type EarStyleId =
  | "ear_small" // Small, close to head
  | "ear_medium" // Average size
  | "ear_large" // Larger, more prominent
  | "ear_pointed" // Slightly pointed (fantasy option)
  | "ear_elf" // Distinctly pointed (fantasy)
  | "ear_round" // Rounded shape
  | "ear_detached" // Detached earlobes
  | "ear_attached"; // Attached earlobes
```

---

## 6. Body Customization System

### 6.1 Skin Tone System

```typescript
// src/data/avatarAssets/skinTones.ts

interface SkinTone {
  id: SkinToneId;
  name: string;
  baseColor: string; // Primary skin color
  shadowColor: string; // Shadow/contour color
  highlightColor: string; // Highlight color
  blushColor: string; // Blush tint color
  undertone: "warm" | "neutral" | "cool";
}

type SkinToneId =
  // Light spectrum
  | "skin_01" // Porcelain
  | "skin_02" // Fair
  | "skin_03" // Light
  | "skin_04" // Light Medium
  // Medium spectrum
  | "skin_05" // Medium Light
  | "skin_06" // Medium
  | "skin_07" // Medium Tan
  | "skin_08" // Olive
  // Dark spectrum
  | "skin_09" // Tan
  | "skin_10" // Caramel
  | "skin_11" // Brown
  | "skin_12"; // Deep

const SKIN_TONES: SkinTone[] = [
  {
    id: "skin_01",
    name: "Porcelain",
    baseColor: "#FFF0E6",
    shadowColor: "#E8D4C8",
    highlightColor: "#FFFAF7",
    blushColor: "#FFB5B5",
    undertone: "cool",
  },
  {
    id: "skin_06",
    name: "Medium",
    baseColor: "#C68642",
    shadowColor: "#A06832",
    highlightColor: "#D9A066",
    blushColor: "#D98080",
    undertone: "warm",
  },
  {
    id: "skin_12",
    name: "Deep",
    baseColor: "#4A3728",
    shadowColor: "#2E221A",
    highlightColor: "#6B4D3A",
    blushColor: "#8B5A5A",
    undertone: "warm",
  },
  // ... all 12 tones
];
```

### 6.2 Body Shapes

```typescript
// src/data/avatarAssets/bodyShapes.ts

interface BodyShape {
  id: BodyShapeId;
  name: string;
  torsoPath: string; // SVG path for torso
  shoulderWidth: number; // Shoulder width multiplier
  waistWidth: number; // Waist width multiplier
  hipWidth: number; // Hip width multiplier
}

type BodyShapeId =
  | "body_slim" // Narrow, lean build
  | "body_average" // Standard proportions
  | "body_athletic" // Muscular, V-taper
  | "body_curvy" // Wider hips, defined waist
  | "body_broad" // Wide shoulders and frame
  | "body_stocky" // Shorter, wider build
  | "body_tall" // Elongated proportions
  | "body_petite"; // Smaller frame overall
```

---

## 7. Clothing System

### 7.1 Clothing Architecture

```typescript
// src/data/avatarAssets/clothingTops.ts

interface ClothingTop {
  id: ClothingTopId;
  name: string;
  description: string;
  category: ClothingCategory;

  // SVG rendering
  svgPath: string;
  fillColor: string; // Default/base color
  colorizable: boolean; // Can user change color?
  colorOptions?: string[]; // Available colors if customizable

  // Layering
  layer: "base" | "outer"; // Base layer vs jacket/coat
  sleeveType: "none" | "short" | "long" | "three-quarter";
  neckline: "crew" | "v-neck" | "collar" | "turtle" | "off-shoulder";

  // Unlock
  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;

  // Metadata
  tags: string[];
  setId?: string; // Part of a matching set
  sortOrder: number;
}

type ClothingCategory =
  | "tshirt"
  | "shirt"
  | "blouse"
  | "sweater"
  | "hoodie"
  | "jacket"
  | "coat"
  | "tank"
  | "dress_top"
  | "uniform"
  | "costume";

// Example clothing tops
const CLOTHING_TOPS: ClothingTop[] = [
  {
    id: "top_none",
    name: "No Top",
    description: "No top clothing",
    category: "tshirt",
    svgPath: "",
    fillColor: "transparent",
    colorizable: false,
    layer: "base",
    sleeveType: "none",
    neckline: "crew",
    rarity: "common",
    unlock: { type: "starter" },
    tags: [],
    sortOrder: 0,
  },
  {
    id: "top_tee_basic",
    name: "Basic Tee",
    description: "A classic, comfortable t-shirt",
    category: "tshirt",
    svgPath:
      "M60,120 L60,200 L140,200 L140,120 L160,100 L160,140 L140,145 L140,200 L60,200 L60,145 L40,140 L40,100 L60,120 Z",
    fillColor: "#FFFFFF",
    colorizable: true,
    colorOptions: [
      "#FFFFFF",
      "#000000",
      "#FF0000",
      "#0000FF",
      "#00FF00",
      "#FFFF00",
      "#FF00FF",
      "#00FFFF",
    ],
    layer: "base",
    sleeveType: "short",
    neckline: "crew",
    rarity: "common",
    unlock: { type: "free" },
    tags: ["casual", "basic"],
    sortOrder: 1,
  },
  {
    id: "top_hoodie_zip",
    name: "Zip Hoodie",
    description: "Cozy hoodie with a front zip",
    category: "hoodie",
    svgPath: "...", // Complex path for hoodie
    fillColor: "#4A4A4A",
    colorizable: true,
    colorOptions: ["#4A4A4A", "#1A1A1A", "#8B0000", "#00008B", "#228B22"],
    layer: "outer",
    sleeveType: "long",
    neckline: "collar",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 200 },
    tags: ["casual", "cozy", "streetwear"],
    sortOrder: 10,
  },
  // ... more tops
];
```

### 7.2 Clothing Bottoms

```typescript
// src/data/avatarAssets/clothingBottoms.ts

interface ClothingBottom {
  id: ClothingBottomId;
  name: string;
  description: string;
  category: BottomCategory;

  svgPath: string;
  fillColor: string;
  colorizable: boolean;
  colorOptions?: string[];

  length: "mini" | "short" | "knee" | "midi" | "full";
  fit: "tight" | "regular" | "loose" | "wide";

  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;
  tags: string[];
  setId?: string;
  sortOrder: number;
}

type BottomCategory =
  | "jeans"
  | "pants"
  | "shorts"
  | "skirt"
  | "leggings"
  | "sweatpants"
  | "dress_bottom"
  | "uniform"
  | "costume";
```

### 7.3 Full Outfits

```typescript
// src/data/avatarAssets/clothingOutfits.ts

interface ClothingOutfit {
  id: ClothingOutfitId;
  name: string;
  description: string;

  // Full outfit replaces top + bottom
  svgPath: string;
  fillColor: string;
  colorizable: boolean;
  colorOptions?: string[];

  type: "dress" | "jumpsuit" | "costume" | "uniform" | "sportswear";

  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;
  tags: string[];
  sortOrder: number;
}

// Example outfits
const CLOTHING_OUTFITS: ClothingOutfit[] = [
  {
    id: "outfit_casual_dress",
    name: "Casual Dress",
    description: "A comfortable everyday dress",
    svgPath: "...",
    fillColor: "#E0BBE4",
    colorizable: true,
    colorOptions: ["#E0BBE4", "#957DAD", "#D291BC", "#FEC8D8", "#FFDFD3"],
    type: "dress",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 250 },
    tags: ["casual", "feminine"],
    sortOrder: 1,
  },
  {
    id: "outfit_tuxedo",
    name: "Classic Tuxedo",
    description: "Elegant formal attire",
    svgPath: "...",
    fillColor: "#1C1C1C",
    colorizable: false,
    type: "costume",
    rarity: "legendary",
    unlock: { type: "achievement", achievementId: "games_1000" },
    tags: ["formal", "elegant"],
    sortOrder: 20,
  },
  // ... more outfits
];
```

---

## 8. Accessories System

### 8.1 Headwear

```typescript
// src/data/avatarAssets/accessories.ts

interface Headwear {
  id: HeadwearId;
  name: string;
  description: string;
  category: HeadwearCategory;

  svgPath: string;
  fillColor: string;
  colorizable: boolean;
  colorOptions?: string[];

  // Positioning
  position: "top" | "full" | "back" | "side";
  hidesHair: "none" | "partial" | "full"; // How much hair is hidden

  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;
  tags: string[];
  sortOrder: number;
}

type HeadwearCategory =
  | "hat"
  | "cap"
  | "beanie"
  | "headband"
  | "crown"
  | "helmet"
  | "hood"
  | "bow"
  | "costume";

const HEADWEAR: Headwear[] = [
  {
    id: "hat_none",
    name: "No Hat",
    description: "Show off your hairstyle",
    category: "hat",
    svgPath: "",
    fillColor: "transparent",
    colorizable: false,
    position: "top",
    hidesHair: "none",
    rarity: "common",
    unlock: { type: "starter" },
    tags: [],
    sortOrder: 0,
  },
  {
    id: "hat_baseball",
    name: "Baseball Cap",
    description: "Classic sporty look",
    category: "cap",
    svgPath: "...",
    fillColor: "#1E3A8A",
    colorizable: true,
    colorOptions: ["#1E3A8A", "#DC2626", "#16A34A", "#000000", "#FFFFFF"],
    position: "top",
    hidesHair: "partial",
    rarity: "common",
    unlock: { type: "free" },
    tags: ["casual", "sporty"],
    sortOrder: 1,
  },
  {
    id: "hat_crown_gold",
    name: "Golden Crown",
    description: "Royalty status achieved",
    category: "crown",
    svgPath: "...",
    fillColor: "#FFD700",
    colorizable: false,
    position: "top",
    hidesHair: "none",
    rarity: "legendary",
    unlock: { type: "milestone", milestoneType: "streak", milestoneValue: 100 },
    tags: ["premium", "royalty"],
    sortOrder: 50,
  },
  // ... more headwear
];
```

### 8.2 Eyewear

```typescript
interface Eyewear {
  id: EyewearId;
  name: string;
  description: string;
  category: EyewearCategory;

  // Frame SVG
  framePath: string;
  frameColor: string;

  // Lens SVG
  lensPath: string;
  lensColor: string;
  lensOpacity: number; // 0 = clear, 1 = opaque

  colorizable: boolean;
  colorOptions?: string[];

  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;
  tags: string[];
  sortOrder: number;
}

type EyewearCategory =
  | "glasses"
  | "sunglasses"
  | "goggles"
  | "monocle"
  | "eyepatch"
  | "costume";
```

### 8.3 Other Accessories

```typescript
interface NeckwearAccessory {
  id: NeckwearId;
  name: string;
  description: string;
  category: "necklace" | "chain" | "scarf" | "tie" | "bowtie" | "choker";
  svgPath: string;
  fillColor: string;
  colorizable: boolean;
  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;
  sortOrder: number;
}

interface EarwearAccessory {
  id: EarwearId;
  name: string;
  description: string;
  category: "earring" | "earbud" | "headphones" | "ear_cuff";
  svgPath: string;
  fillColor: string;
  colorizable: boolean;
  bilateral: boolean; // Same on both ears?
  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;
  sortOrder: number;
}

interface WristwearAccessory {
  id: WristwearId;
  name: string;
  description: string;
  category: "watch" | "bracelet" | "bangle" | "smartwatch";
  svgPath: string;
  fillColor: string;
  colorizable: boolean;
  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;
  sortOrder: number;
}
```

---

## 9. Rendering Architecture

### 9.1 SVG Rendering Component

```typescript
// src/components/avatar/AvatarSvgRenderer.tsx

import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle, Defs, LinearGradient, Stop, ClipPath } from 'react-native-svg';
import type { DigitalAvatarConfig } from '@/types/avatar';

interface AvatarSvgRendererProps {
  config: DigitalAvatarConfig;
  size: number;
  showBody?: boolean;        // Full body or head only
  animated?: boolean;        // Enable animations
  onRender?: () => void;     // Callback when render complete
}

const VIEWBOX_WIDTH = 200;
const VIEWBOX_HEIGHT_HEAD = 150;  // Head only
const VIEWBOX_HEIGHT_FULL = 300;  // Full body

function AvatarSvgRendererBase({
  config,
  size,
  showBody = false,
  animated = false,
}: AvatarSvgRendererProps) {

  // Calculate viewbox based on mode
  const viewboxHeight = showBody ? VIEWBOX_HEIGHT_FULL : VIEWBOX_HEIGHT_HEAD;
  const aspectRatio = VIEWBOX_WIDTH / viewboxHeight;
  const height = size / aspectRatio;

  // Memoize computed values
  const skinColors = useMemo(() => getSkinColors(config.body.skinTone), [config.body.skinTone]);
  const hairColors = useMemo(() => getHairColors(config.hair.color), [config.hair.color]);
  const eyeColors = useMemo(() => getEyeColors(config.eyes.color), [config.eyes.color]);

  return (
    <View style={[styles.container, { width: size, height }]}>
      <Svg
        width={size}
        height={height}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${viewboxHeight}`}
      >
        {/* Definitions for gradients, clips, etc. */}
        <Defs>
          {/* Skin gradient */}
          <LinearGradient id="skinGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={skinColors.highlight} />
            <Stop offset="50%" stopColor={skinColors.base} />
            <Stop offset="100%" stopColor={skinColors.shadow} />
          </LinearGradient>

          {/* Hair gradient */}
          <LinearGradient id="hairGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={hairColors.highlight} />
            <Stop offset="100%" stopColor={hairColors.base} />
          </LinearGradient>

          {/* Eye iris gradient */}
          <LinearGradient id="irisGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={eyeColors.outer} />
            <Stop offset="50%" stopColor={eyeColors.middle} />
            <Stop offset="100%" stopColor={eyeColors.inner} />
          </LinearGradient>

          {/* Face clip path */}
          <ClipPath id="faceClip">
            <Path d={getFaceShape(config.face.shape).svgPath} />
          </ClipPath>
        </Defs>

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 0: Body (if showing full body)
            ═══════════════════════════════════════════════════════════════════ */}
        {showBody && (
          <G id="body-layer">
            <BodySvg
              shape={config.body.shape}
              skinGradient="url(#skinGradient)"
              clothingTop={config.clothing.top}
              clothingBottom={config.clothing.bottom}
              outfit={config.clothing.outfit}
            />
          </G>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 1: Neck (with optional neckwear)
            ═══════════════════════════════════════════════════════════════════ */}
        <G id="neck-layer">
          <NeckSvg skinGradient="url(#skinGradient)" />
          {config.accessories.neckwear && (
            <NeckwearSvg itemId={config.accessories.neckwear} />
          )}
        </G>

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 2: Hair Back (behind head)
            ═══════════════════════════════════════════════════════════════════ */}
        <G id="hair-back-layer">
          <HairBackSvg
            style={config.hair.style}
            gradient="url(#hairGradient)"
          />
        </G>

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 3: Ears
            ═══════════════════════════════════════════════════════════════════ */}
        {config.ears.visible && (
          <G id="ears-layer">
            <EarsSvg
              style={config.ears.style}
              size={config.ears.size}
              skinGradient="url(#skinGradient)"
            />
            {config.accessories.earwear && (
              <EarwearSvg itemId={config.accessories.earwear} />
            )}
          </G>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 4: Head/Face Shape
            ═══════════════════════════════════════════════════════════════════ */}
        <G id="face-layer">
          <FaceSvg
            shape={config.face.shape}
            width={config.face.width}
            skinGradient="url(#skinGradient)"
          />
        </G>

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 5: Facial Features (clipped to face)
            ═══════════════════════════════════════════════════════════════════ */}
        <G id="features-layer" clipPath="url(#faceClip)">
          {/* Eyebrows */}
          <EyebrowsSvg
            style={config.eyes.eyebrows.style}
            color={config.eyes.eyebrows.color}
            thickness={config.eyes.eyebrows.thickness}
          />

          {/* Eyes */}
          <EyesSvg
            style={config.eyes.style}
            size={config.eyes.size}
            spacing={config.eyes.spacing}
            tilt={config.eyes.tilt}
            irisGradient="url(#irisGradient)"
          />

          {/* Eyelashes */}
          {config.eyes.eyelashes.style !== 'none' && (
            <EyelashesSvg
              style={config.eyes.eyelashes.style}
              color={config.eyes.eyelashes.color}
            />
          )}

          {/* Nose */}
          <NoseSvg
            style={config.nose.style}
            size={config.nose.size}
            skinColor={skinColors.base}
            shadowColor={skinColors.shadow}
          />

          {/* Mouth */}
          <MouthSvg
            style={config.mouth.style}
            size={config.mouth.size}
            lipColor={config.mouth.lipColor}
            thickness={config.mouth.lipThickness}
          />

          {/* Facial Hair */}
          {config.hair.facialHair.style !== 'none' && (
            <FacialHairSvg
              style={config.hair.facialHair.style}
              color={config.hair.facialHair.color}
            />
          )}
        </G>

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 6: Hair Front (over face)
            ═══════════════════════════════════════════════════════════════════ */}
        <G id="hair-front-layer">
          <HairFrontSvg
            style={config.hair.style}
            gradient="url(#hairGradient)"
          />
        </G>

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 7: Eyewear
            ═══════════════════════════════════════════════════════════════════ */}
        {config.accessories.eyewear && (
          <G id="eyewear-layer">
            <EyewearSvg itemId={config.accessories.eyewear} />
          </G>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 8: Headwear
            ═══════════════════════════════════════════════════════════════════ */}
        {config.accessories.headwear && (
          <G id="headwear-layer">
            <HeadwearSvg
              itemId={config.accessories.headwear}
              hairStyle={config.hair.style}
            />
          </G>
        )}
      </Svg>
    </View>
  );
}

export const AvatarSvgRenderer = memo(AvatarSvgRendererBase);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
```

### 9.2 Individual Part Components

Each body part is a separate component for modularity:

```typescript
// src/components/avatar/AvatarParts/Eyes.tsx

import React from 'react';
import { G, Path, Circle, Ellipse } from 'react-native-svg';
import { getEyeStyle } from '@/data/avatarAssets/eyeStyles';

interface EyesSvgProps {
  style: EyeStyleId;
  size: number;           // Scale factor (0.8 - 1.2)
  spacing: number;        // Spacing factor (0.8 - 1.2)
  tilt: number;           // Rotation in degrees (-10 to 10)
  irisGradient: string;   // Reference to gradient definition
}

// Base positions for eyes
const LEFT_EYE_CENTER = { x: 70, y: 70 };
const RIGHT_EYE_CENTER = { x: 130, y: 70 };
const EYE_BASE_WIDTH = 20;
const EYE_BASE_HEIGHT = 12;

export function EyesSvg({
  style,
  size,
  spacing,
  tilt,
  irisGradient,
}: EyesSvgProps) {
  const eyeStyle = getEyeStyle(style);

  // Calculate adjusted positions based on spacing
  const spacingOffset = (spacing - 1) * 15; // Adjust spacing
  const leftEye = { x: LEFT_EYE_CENTER.x - spacingOffset, y: LEFT_EYE_CENTER.y };
  const rightEye = { x: RIGHT_EYE_CENTER.x + spacingOffset, y: RIGHT_EYE_CENTER.y };

  // Scale factors
  const scaledWidth = EYE_BASE_WIDTH * size;
  const scaledHeight = EYE_BASE_HEIGHT * size;
  const irisRadius = scaledWidth * 0.35;
  const pupilRadius = irisRadius * 0.4;

  const renderEye = (center: { x: number; y: number }, isLeft: boolean) => {
    const rotationOrigin = `${center.x} ${center.y}`;
    const eyeTilt = isLeft ? -tilt : tilt;

    return (
      <G
        transform={`rotate(${eyeTilt}, ${center.x}, ${center.y})`}
        key={isLeft ? 'left-eye' : 'right-eye'}
      >
        {/* Sclera (white of eye) */}
        <Ellipse
          cx={center.x}
          cy={center.y}
          rx={scaledWidth / 2}
          ry={scaledHeight / 2}
          fill="#FFFFFF"
          stroke="#E8E8E8"
          strokeWidth={0.5}
        />

        {/* Iris */}
        <Circle
          cx={center.x}
          cy={center.y}
          r={irisRadius}
          fill={irisGradient}
        />

        {/* Pupil */}
        <Circle
          cx={center.x}
          cy={center.y}
          r={pupilRadius}
          fill="#000000"
        />

        {/* Highlight/reflection */}
        <Circle
          cx={center.x - irisRadius * 0.3}
          cy={center.y - irisRadius * 0.3}
          r={pupilRadius * 0.5}
          fill="#FFFFFF"
          opacity={0.8}
        />

        {/* Upper eyelid line */}
        <Path
          d={`M${center.x - scaledWidth/2},${center.y} Q${center.x},${center.y - scaledHeight/2 - 2} ${center.x + scaledWidth/2},${center.y}`}
          stroke="#8B7355"
          strokeWidth={1}
          fill="none"
        />
      </G>
    );
  };

  return (
    <G id="eyes">
      {renderEye(leftEye, true)}
      {renderEye(rightEye, false)}
    </G>
  );
}
```

### 9.3 Main Avatar Component

```typescript
// src/components/avatar/DigitalAvatar.tsx

import React, { memo, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { AvatarSvgRenderer } from './AvatarSvgRenderer';
import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import type { DigitalAvatarConfig, AvatarConfig } from '@/types/avatar';
import { isDigitalAvatarConfig, convertLegacyConfig } from '@/utils/avatarHelpers';

interface DigitalAvatarProps {
  /** Avatar configuration - supports both legacy and new formats */
  config: DigitalAvatarConfig | AvatarConfig;
  /** Avatar size in pixels */
  size?: number;
  /** Show full body or head only */
  showBody?: boolean;
  /** Enable animation effects */
  animated?: boolean;
  /** Show border/frame around avatar */
  showFrame?: boolean;
  /** Frame ID to display (overrides config) */
  frameId?: string | null;
  /** Press handler */
  onPress?: () => void;
  /** Additional container style */
  style?: ViewStyle;
}

function DigitalAvatarBase({
  config,
  size = 80,
  showBody = false,
  animated = false,
  showFrame = false,
  frameId,
  onPress,
  style,
}: DigitalAvatarProps) {

  // Normalize config to digital avatar format
  const normalizedConfig = useMemo(() => {
    if (isDigitalAvatarConfig(config)) {
      return config;
    }
    return convertLegacyConfig(config);
  }, [config]);

  // Determine frame to show
  const effectiveFrameId = frameId ?? normalizedConfig.profile?.frame ?? null;

  const avatar = (
    <AvatarSvgRenderer
      config={normalizedConfig}
      size={size}
      showBody={showBody}
      animated={animated}
    />
  );

  // Wrap with frame if needed
  const framedAvatar = showFrame && effectiveFrameId ? (
    <AvatarWithFrame
      config={normalizedConfig}
      size={size}
      frame={effectiveFrameId}
      showEffects={animated}
    >
      {avatar}
    </AvatarWithFrame>
  ) : avatar;

  // Make pressable if handler provided
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={style}>
        {framedAvatar}
      </Pressable>
    );
  }

  return <View style={style}>{framedAvatar}</View>;
}

export const DigitalAvatar = memo(DigitalAvatarBase);
export default DigitalAvatar;
```

---

## 10. Asset Pipeline

### 10.1 SVG Path Generation Strategy

For production, SVG paths should be created by designers and exported as path data:

```typescript
// Development workflow:
// 1. Designer creates avatar part in Figma/Illustrator
// 2. Export as SVG
// 3. Extract path data
// 4. Add to asset catalog

// Example structure for asset files:
interface AvatarAssetFile {
  metadata: {
    version: string;
    createdAt: string;
    author: string;
  };
  assets: Record<
    string,
    {
      id: string;
      paths: string[];
      colors: Record<string, string>;
      anchors: Record<string, { x: number; y: number }>;
    }
  >;
}
```

### 10.2 Color Mapping System

```typescript
// src/utils/avatarColors.ts

/**
 * Maps semantic color names to actual hex values
 * Allows theming and consistency across the avatar system
 */
export const AVATAR_COLOR_PALETTE = {
  // Skin tones
  skin: {
    porcelain: "#FFF0E6",
    fair: "#FFE4C4",
    light: "#F5DEB3",
    medium: "#DEB887",
    tan: "#D2691E",
    brown: "#8B4513",
    deep: "#4A3728",
  },

  // Hair colors
  hair: {
    black: "#1A1A1A",
    darkBrown: "#3D2314",
    brown: "#6B4423",
    lightBrown: "#A67B5B",
    auburn: "#922724",
    ginger: "#B5651D",
    blonde: "#E6BE8A",
    platinumBlonde: "#E8E4C9",
    gray: "#808080",
    white: "#F5F5F5",
    // Fantasy colors
    blue: "#4A90D9",
    purple: "#8B5CF6",
    pink: "#EC4899",
    green: "#22C55E",
    red: "#EF4444",
  },

  // Eye colors
  eyes: {
    brown: "#6B4423",
    hazel: "#8E7618",
    green: "#228B22",
    blue: "#4169E1",
    gray: "#708090",
    amber: "#FFBF00",
  },

  // Lip colors
  lips: {
    natural: "#C4A484",
    pink: "#FFB6C1",
    rose: "#FF007F",
    red: "#DC143C",
    berry: "#8B008B",
  },
};
```

### 10.3 Asset Validation

```typescript
// src/utils/avatarValidation.ts

import { DigitalAvatarConfig } from "@/types/avatar";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates avatar configuration for completeness and correctness
 */
export function validateAvatarConfig(
  config: DigitalAvatarConfig,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.version) errors.push("Missing version field");
  if (!config.body?.skinTone) errors.push("Missing skin tone");
  if (!config.face?.shape) errors.push("Missing face shape");
  if (!config.eyes?.style) errors.push("Missing eye style");
  if (!config.eyes?.color) errors.push("Missing eye color");
  if (!config.hair?.style) errors.push("Missing hair style");
  if (!config.hair?.color) errors.push("Missing hair color");

  // Range validations
  if (
    config.body?.height &&
    (config.body.height < 0.8 || config.body.height > 1.2)
  ) {
    errors.push("Body height out of range (0.8-1.2)");
  }
  if (config.eyes?.size && (config.eyes.size < 0.8 || config.eyes.size > 1.2)) {
    errors.push("Eye size out of range (0.8-1.2)");
  }
  if (config.eyes?.tilt && (config.eyes.tilt < -10 || config.eyes.tilt > 10)) {
    errors.push("Eye tilt out of range (-10 to 10)");
  }

  // Warnings for missing optional fields
  if (!config.accessories?.headwear) warnings.push("No headwear selected");
  if (!config.accessories?.eyewear) warnings.push("No eyewear selected");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

---

## 11. Data Models & Firebase Schema

### 11.1 Firestore Schema Updates

The digital avatar system extends the existing User document structure. Here's the complete schema:

```typescript
// Users/{uid} document structure update

interface UserDocument {
  uid: string;
  username: string;
  usernameLower: string;
  displayName: string;

  // NEW: Digital avatar configuration (primary)
  digitalAvatar?: DigitalAvatarConfig;

  // EXISTING: Keep for backwards compatibility during migration
  avatarConfig: AvatarConfig; // Old simple config - DO NOT REMOVE until migration complete

  // Existing fields unchanged
  expoPushToken?: string;
  createdAt: number;
  lastActive: number;

  // From existing profile.ts ExtendedUserProfile
  cosmeticInventory?: Record<string, { acquiredAt: number }>;
  equippedCosmetics?: Partial<Record<ExtendedCosmeticSlot, string>>;
}
```

**Field Size Estimates:**
| Field | Estimated Size | Notes |
|-------|---------------|-------|
| digitalAvatar | ~2-3 KB | Complete avatar config with all options |
| avatarConfig | ~100 bytes | Legacy simple config |

**Firestore Document Limits:** Max 1MB per document - avatar config is well within limits.

### 11.2 Firestore Security Rules Updates

Add these rules to `firebase-backend/firestore.rules`:

```plaintext
// firebase-backend/firestore.rules additions
// Add these helper functions BEFORE the match /Users/{uid} block

// ============================================================
// DIGITAL AVATAR VALIDATION HELPERS
// ============================================================

// Validate skin tone is a valid ID
function validSkinTone(tone) {
  return tone is string && tone.size() > 0 && tone.size() < 50;
}

// Validate body config
function validBodyConfig(body) {
  return body.keys().hasAll(['skinTone', 'shape', 'height']) &&
         validSkinTone(body.skinTone) &&
         body.shape is string &&
         body.height is number &&
         body.height >= 0.8 &&
         body.height <= 1.2;
}

// Validate face config
function validFaceConfig(face) {
  return face.keys().hasAll(['shape', 'width']) &&
         face.shape is string &&
         face.width is number &&
         face.width >= 0.8 &&
         face.width <= 1.2;
}

// Validate eyes config
function validEyesConfig(eyes) {
  return eyes.keys().hasAll(['style', 'color', 'size', 'spacing', 'tilt']) &&
         eyes.style is string &&
         eyes.color is string &&
         eyes.size is number && eyes.size >= 0.8 && eyes.size <= 1.2 &&
         eyes.spacing is number && eyes.spacing >= 0.8 && eyes.spacing <= 1.2 &&
         eyes.tilt is number && eyes.tilt >= -10 && eyes.tilt <= 10;
}

// Validate hair config
function validHairConfig(hair) {
  return hair.keys().hasAll(['style', 'color']) &&
         hair.style is string &&
         hair.color is string;
}

// Main digital avatar validator
function validDigitalAvatar(avatar) {
  return avatar.version == 2 &&
         avatar.keys().hasAll(['body', 'face', 'eyes', 'nose', 'mouth', 'hair']) &&
         validBodyConfig(avatar.body) &&
         validFaceConfig(avatar.face) &&
         validEyesConfig(avatar.eyes) &&
         avatar.nose is map && avatar.nose.style is string &&
         avatar.mouth is map && avatar.mouth.style is string &&
         validHairConfig(avatar.hair);
}

// ============================================================
// UPDATED USER RULES (modify existing allow update rule)
// ============================================================

// In the existing match /Users/{uid} block, UPDATE the allow update rule:
allow update: if isAuth() && isOwner(uid) &&
  // Prevent changing uid
  request.resource.data.uid == resource.data.uid &&
  // Validate updated fields if present
  (!request.resource.data.keys().hasAll(['username']) ||
   validStringLength(request.resource.data.username, 3, 20)) &&
  (!request.resource.data.keys().hasAll(['displayName']) ||
   validStringLength(request.resource.data.displayName, 1, 50)) &&
  // NEW: Validate digital avatar if present in update
  (!request.resource.data.keys().hasAll(['digitalAvatar']) ||
   validDigitalAvatar(request.resource.data.digitalAvatar));
```

### 11.3 Avatar Service

Complete implementation for `src/services/avatarService.ts`:

```typescript
// src/services/avatarService.ts

import {
  doc,
  updateDoc,
  getDoc,
  writeBatch,
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import type { DigitalAvatarConfig, AvatarConfig } from "@/types/avatar";
import { validateAvatarConfig } from "@/utils/avatarValidation";
import {
  convertLegacyConfig,
  isDigitalAvatarConfig,
  getDefaultAvatarConfig,
} from "@/utils/avatarHelpers";

// Re-export for convenience
export { getDefaultAvatarConfig };

/**
 * Save user's digital avatar configuration to Firestore
 *
 * @param userId - The user's UID
 * @param config - The digital avatar configuration
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function saveDigitalAvatar(
  userId: string,
  config: DigitalAvatarConfig,
): Promise<{ success: boolean; error?: string }> {
  // Validate before saving
  const validation = validateAvatarConfig(config);
  if (!validation.valid) {
    console.error("Invalid avatar config:", validation.errors);
    return {
      success: false,
      error: `Invalid configuration: ${validation.errors.join(", ")}`,
    };
  }

  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    // Update with timestamp
    const updatedConfig: DigitalAvatarConfig = {
      ...config,
      updatedAt: Date.now(),
    };

    await updateDoc(userRef, {
      digitalAvatar: updatedConfig,
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving digital avatar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user's digital avatar configuration from Firestore
 * Handles legacy config conversion automatically
 *
 * @param userId - The user's UID
 * @returns Promise<DigitalAvatarConfig | null>
 */
export async function getDigitalAvatar(
  userId: string,
): Promise<DigitalAvatarConfig | null> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.warn(`User ${userId} not found`);
      return null;
    }

    const data = userDoc.data();

    // Return digital avatar if exists and valid
    if (data.digitalAvatar && isDigitalAvatarConfig(data.digitalAvatar)) {
      return data.digitalAvatar as DigitalAvatarConfig;
    }

    // Convert legacy config if no digital avatar
    if (data.avatarConfig) {
      const converted = convertLegacyConfig(data.avatarConfig);
      return converted;
    }

    // Return default config if nothing exists
    return getDefaultAvatarConfig();
  } catch (error) {
    console.error("Error getting digital avatar:", error);
    return null;
  }
}

/**
 * Batch migrate multiple users from legacy to digital avatar
 * For use in migration scripts - processes in batches of 500 (Firestore limit)
 *
 * @param userIds - Array of user IDs to migrate
 * @returns Promise<{ migrated: number; skipped: number; failed: number; errors: string[] }>
 */
export async function batchMigrateAvatars(userIds: string[]): Promise<{
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const db = getFirestoreInstance();
  const errors: string[] = [];
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  // Process in batches of 500 (Firestore batch limit)
  const batchSize = 500;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batchUserIds = userIds.slice(i, i + batchSize);
    const batch = writeBatch(db);

    for (const userId of batchUserIds) {
      try {
        const userRef = doc(db, "Users", userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
          errors.push(`User ${userId} not found`);
          failed++;
          continue;
        }

        const data = userDoc.data();

        // Skip if already has digital avatar
        if (data.digitalAvatar) {
          skipped++;
          continue;
        }

        // Convert legacy config
        const digitalAvatar = convertLegacyConfig(
          data.avatarConfig || { baseColor: "#FF6B6B" },
        );

        batch.update(userRef, {
          digitalAvatar: {
            ...digitalAvatar,
            migratedAt: Date.now(),
          },
        });

        migrated++;
      } catch (error) {
        errors.push(`Error processing ${userId}: ${error}`);
        failed++;
      }
    }

    // Commit this batch
    try {
      await batch.commit();
      console.log(`Committed batch ${Math.floor(i / batchSize) + 1}`);
    } catch (error) {
      errors.push(`Batch commit error: ${error}`);
    }
  }

  return { migrated, skipped, failed, errors };
}
```

### 11.4 Default Avatar Configuration

```typescript
// src/utils/avatarHelpers.ts (partial - getDefaultAvatarConfig function)

/**
 * Generate default avatar configuration for new users
 */
export function getDefaultAvatarConfig(): DigitalAvatarConfig {
  return {
    version: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),

    body: {
      skinTone: "skin_06", // Medium skin tone
      shape: "body_average",
      height: 1.0,
    },

    face: {
      shape: "oval",
      width: 1.0,
    },

    eyes: {
      style: "eye_natural",
      color: "brown_dark",
      size: 1.0,
      spacing: 1.0,
      tilt: 0,
      eyebrows: {
        style: "brow_natural",
        color: "brown_dark",
        thickness: 1.0,
      },
      eyelashes: {
        style: "natural",
        color: "#000000",
      },
    },

    nose: {
      style: "nose_small",
      size: 1.0,
    },

    mouth: {
      style: "mouth_smile",
      size: 1.0,
      lipColor: "lip_natural_medium",
      lipThickness: 1.0,
    },

    ears: {
      style: "ear_medium",
      size: 1.0,
      visible: true,
    },

    hair: {
      style: "hair_short_classic",
      color: "brown_dark",
      facialHair: {
        style: "none",
        color: "brown_dark",
      },
    },

    clothing: {
      top: "top_tee_basic",
      bottom: "bottom_jeans_blue",
      outfit: null,
    },

    accessories: {
      headwear: null,
      eyewear: null,
      earwear: null,
      neckwear: null,
      wristwear: null,
    },
  };
}
```

---

## 12. Component Architecture

### 12.1 Component Hierarchy

```
src/components/avatar/
├── index.ts                         # Public exports
│
├── DigitalAvatar.tsx                # Main component (public API)
│   ├── Uses: AvatarSvgRenderer
│   ├── Uses: AvatarWithFrame (from existing components)
│   └── Handles: Legacy config conversion
│
├── AvatarSvgRenderer.tsx            # Core SVG rendering
│   ├── Composes all part components
│   ├── Manages layer ordering
│   └── Handles gradients and clipping
│
├── AvatarParts/                     # Individual SVG part components
│   ├── index.ts
│   ├── Body.tsx                     # Body shape and skin
│   ├── Head.tsx                     # Face shape
│   ├── Eyes.tsx                     # Eyes + eyebrows + lashes
│   ├── Nose.tsx                     # Nose styles
│   ├── Mouth.tsx                    # Mouth + lips
│   ├── Ears.tsx                     # Ear shapes
│   ├── Hair.tsx                     # Hair styles (front + back)
│   ├── FacialHair.tsx               # Beards, mustaches
│   ├── Clothing.tsx                 # All clothing rendering
│   └── Accessories.tsx              # All accessories rendering
│
└── AvatarCustomizer/                # Customization UI
    ├── index.ts
    ├── AvatarCustomizerModal.tsx    # Main customization modal
    ├── CategoryTabs.tsx             # Tab navigation
    ├── SkinTonePicker.tsx           # Skin tone selection
    ├── FeatureSliders.tsx           # Size/position sliders
    ├── StylePicker.tsx              # Style selection grids
    ├── ColorPicker.tsx              # Color selection
    ├── ClothingPicker.tsx           # Clothing selection
    ├── AccessoryPicker.tsx          # Accessory selection
    ├── PresetPicker.tsx             # Preset selection
    └── PreviewPanel.tsx             # Live avatar preview
```

### 12.2 Hook for Customization State

```typescript
// src/hooks/useAvatarCustomization.ts

import { useState, useCallback, useMemo, useRef } from "react";
import { DigitalAvatarConfig } from "@/types/avatar";
import { saveDigitalAvatar } from "@/services/avatarService";
import { validateAvatarConfig } from "@/utils/avatarValidation";

interface UseAvatarCustomizationOptions {
  initialConfig: DigitalAvatarConfig;
  userId: string;
  onSave?: (config: DigitalAvatarConfig) => void;
}

interface UseAvatarCustomizationReturn {
  // Current config (live preview)
  config: DigitalAvatarConfig;

  // Update functions
  updateBody: (updates: Partial<DigitalAvatarConfig["body"]>) => void;
  updateFace: (updates: Partial<DigitalAvatarConfig["face"]>) => void;
  updateEyes: (updates: Partial<DigitalAvatarConfig["eyes"]>) => void;
  updateNose: (updates: Partial<DigitalAvatarConfig["nose"]>) => void;
  updateMouth: (updates: Partial<DigitalAvatarConfig["mouth"]>) => void;
  updateEars: (updates: Partial<DigitalAvatarConfig["ears"]>) => void;
  updateHair: (updates: Partial<DigitalAvatarConfig["hair"]>) => void;
  updateClothing: (updates: Partial<DigitalAvatarConfig["clothing"]>) => void;
  updateAccessories: (
    updates: Partial<DigitalAvatarConfig["accessories"]>,
  ) => void;

  // Preset application
  applyPreset: (presetId: string) => void;

  // Validation
  validation: ValidationResult;
  isValid: boolean;

  // Save/Reset
  save: () => Promise<boolean>;
  reset: () => void;
  hasChanges: boolean;

  // State
  isSaving: boolean;
  error: string | null;
}

export function useAvatarCustomization({
  initialConfig,
  userId,
  onSave,
}: UseAvatarCustomizationOptions): UseAvatarCustomizationReturn {
  const [config, setConfig] = useState<DigitalAvatarConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialConfigRef = useRef(initialConfig);

  // Validation
  const validation = useMemo(() => validateAvatarConfig(config), [config]);

  // Check for changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(initialConfigRef.current);
  }, [config]);

  // Update functions
  const updateBody = useCallback(
    (updates: Partial<DigitalAvatarConfig["body"]>) => {
      setConfig((prev) => ({
        ...prev,
        body: { ...prev.body, ...updates },
      }));
    },
    [],
  );

  const updateFace = useCallback(
    (updates: Partial<DigitalAvatarConfig["face"]>) => {
      setConfig((prev) => ({
        ...prev,
        face: { ...prev.face, ...updates },
      }));
    },
    [],
  );

  const updateEyes = useCallback(
    (updates: Partial<DigitalAvatarConfig["eyes"]>) => {
      setConfig((prev) => ({
        ...prev,
        eyes: { ...prev.eyes, ...updates },
      }));
    },
    [],
  );

  // ... similar for other update functions

  // Save function
  const save = useCallback(async () => {
    if (!validation.valid) {
      setError("Invalid configuration: " + validation.errors.join(", "));
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const success = await saveDigitalAvatar(userId, config);
      if (success) {
        initialConfigRef.current = config;
        onSave?.(config);
        return true;
      } else {
        setError("Failed to save avatar");
        return false;
      }
    } catch (err) {
      setError("Error saving avatar");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [config, validation, userId, onSave]);

  // Reset function
  const reset = useCallback(() => {
    setConfig(initialConfigRef.current);
    setError(null);
  }, []);

  return {
    config,
    updateBody,
    updateFace,
    updateEyes,
    updateNose,
    updateMouth,
    updateEars,
    updateHair,
    updateClothing,
    updateAccessories,
    applyPreset: () => {}, // TODO: Implement
    validation,
    isValid: validation.valid,
    save,
    reset,
    hasChanges,
    isSaving,
    error,
  };
}
```

---

## 13. Performance Optimization

### 13.1 Memoization Strategy

```typescript
// All avatar part components should be memoized:
export const EyesSvg = memo(EyesSvgBase);
export const NoseSvg = memo(NoseSvgBase);
// etc.

// Use useMemo for computed values:
const eyePositions = useMemo(
  () => calculateEyePositions(config.eyes.spacing, config.eyes.size),
  [config.eyes.spacing, config.eyes.size],
);

// Use useCallback for handlers:
const handleSkinToneChange = useCallback(
  (toneId: SkinToneId) => {
    updateBody({ skinTone: toneId });
  },
  [updateBody],
);
```

### 13.2 SVG Optimization

```typescript
// Simplify paths where possible
// Use integer coordinates when possible (faster rendering)
// Avoid nested transforms when one transform will do
// Use clipPaths sparingly - they're expensive

// Good:
<Path d="M10,20 L30,20 L30,40 L10,40 Z" />

// Avoid:
<G transform="translate(10, 0)">
  <G transform="rotate(5)">
    <G transform="scale(1.1)">
      <Path d="..." />
    </G>
  </G>
</G>

// Better - combine transforms:
<Path d="..." transform="translate(10,0) rotate(5) scale(1.1)" />
```

### 13.3 Caching Rendered Avatars

```typescript
// For static contexts (chat lists, etc.), cache rendered avatars

import { useMemo } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

interface CachedAvatarProps {
  config: DigitalAvatarConfig;
  size: number;
  cacheKey: string;
}

const avatarCache = new Map<string, string>();

function CachedAvatar({ config, size, cacheKey }: CachedAvatarProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const avatarRef = useRef<View>(null);

  useEffect(() => {
    // Check cache first
    const cached = avatarCache.get(cacheKey);
    if (cached) {
      setImageUri(cached);
      return;
    }

    // Render and cache
    const captureAvatar = async () => {
      if (avatarRef.current) {
        const uri = await captureRef(avatarRef, {
          format: 'png',
          quality: 0.8,
        });
        avatarCache.set(cacheKey, uri);
        setImageUri(uri);
      }
    };

    const timeout = setTimeout(captureAvatar, 100);
    return () => clearTimeout(timeout);
  }, [cacheKey]);

  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={{ width: size, height: size }} />;
  }

  return (
    <View ref={avatarRef}>
      <DigitalAvatar config={config} size={size} />
    </View>
  );
}
```

### 13.4 Lazy Loading Asset Data

```typescript
// Large asset catalogs should be lazy loaded

// Instead of importing all at once:
// import { ALL_HAIR_STYLES } from '@/data/avatarAssets/hairStyles';

// Use dynamic imports:
let hairStylesCache: HairStyle[] | null = null;

async function getHairStyles(): Promise<HairStyle[]> {
  if (!hairStylesCache) {
    const module = await import("@/data/avatarAssets/hairStyles");
    hairStylesCache = module.HAIR_STYLES;
  }
  return hairStylesCache;
}
```

---

## 14. Animation System

### 14.1 Idle Animations

```typescript
// src/components/avatar/animations/IdleAnimation.tsx

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface IdleAnimationProps {
  children: React.ReactNode;
  enabled: boolean;
}

export function IdleAnimation({ children, enabled }: IdleAnimationProps) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (enabled) {
      // Subtle floating motion
      translateY.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false
      );

      // Subtle rotation
      rotate.value = withRepeat(
        withSequence(
          withTiming(-1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true
      );
    }
  }, [enabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
```

### 14.2 Blink Animation

```typescript
// Eyes can blink periodically

interface BlinkingEyesProps {
  // ... normal eye props
  enableBlink: boolean;
  blinkInterval?: number; // ms between blinks
}

function BlinkingEyes({ enableBlink, blinkInterval = 4000, ...props }: BlinkingEyesProps) {
  const eyelidHeight = useSharedValue(0);

  useEffect(() => {
    if (enableBlink) {
      const blink = () => {
        eyelidHeight.value = withSequence(
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 150 }),
        );
      };

      const interval = setInterval(blink, blinkInterval + Math.random() * 2000);
      return () => clearInterval(interval);
    }
  }, [enableBlink, blinkInterval]);

  const eyelidStyle = useAnimatedStyle(() => ({
    scaleY: eyelidHeight.value,
  }));

  return (
    <G>
      <EyesSvg {...props} />
      {/* Eyelid overlay for blink */}
      <Animated.View style={eyelidStyle}>
        {/* Eyelid SVG paths */}
      </Animated.View>
    </G>
  );
}
```

---

## 15. Customization UI

### 15.1 Customization Modal Structure

```typescript
// src/components/avatar/AvatarCustomizer/AvatarCustomizerModal.tsx

interface AvatarCustomizerModalProps {
  visible: boolean;
  onClose: () => void;
  initialConfig: DigitalAvatarConfig;
  userId: string;
  onSave: (config: DigitalAvatarConfig) => void;
}

export function AvatarCustomizerModal({
  visible,
  onClose,
  initialConfig,
  userId,
  onSave,
}: AvatarCustomizerModalProps) {
  const {
    config,
    updateBody,
    updateFace,
    updateEyes,
    // ... other update functions
    save,
    reset,
    hasChanges,
    isSaving,
  } = useAvatarCustomization({ initialConfig, userId, onSave });

  const [activeCategory, setActiveCategory] = useState<CustomizationCategory>('face');

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Customize Avatar</Text>
          <TouchableOpacity onPress={save} disabled={!hasChanges || isSaving}>
            <Text>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Preview Panel - Live avatar preview */}
        <View style={styles.preview}>
          <DigitalAvatar config={config} size={200} animated />
        </View>

        {/* Category Tabs */}
        <CategoryTabs
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        {/* Category Content */}
        <ScrollView style={styles.content}>
          {activeCategory === 'presets' && (
            <PresetPicker onSelect={applyPreset} />
          )}

          {activeCategory === 'face' && (
            <FaceCustomizer
              config={config}
              onUpdateFace={updateFace}
              onUpdateNose={updateNose}
              onUpdateMouth={updateMouth}
            />
          )}

          {activeCategory === 'eyes' && (
            <EyesCustomizer
              config={config}
              onUpdate={updateEyes}
            />
          )}

          {activeCategory === 'hair' && (
            <HairCustomizer
              config={config}
              onUpdate={updateHair}
            />
          )}

          {activeCategory === 'body' && (
            <BodyCustomizer
              config={config}
              onUpdate={updateBody}
            />
          )}

          {activeCategory === 'clothing' && (
            <ClothingCustomizer
              config={config}
              onUpdate={updateClothing}
            />
          )}

          {activeCategory === 'accessories' && (
            <AccessoriesCustomizer
              config={config}
              onUpdate={updateAccessories}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

type CustomizationCategory =
  | 'presets'
  | 'face'
  | 'eyes'
  | 'hair'
  | 'body'
  | 'clothing'
  | 'accessories';
```

### 15.2 Category Components

```typescript
// Face Customizer Example
function FaceCustomizer({ config, onUpdateFace, onUpdateNose, onUpdateMouth }) {
  return (
    <View>
      {/* Skin Tone */}
      <Section title="Skin Tone">
        <SkinToneGrid
          selected={config.body.skinTone}
          onSelect={(tone) => onUpdateBody({ skinTone: tone })}
        />
      </Section>

      {/* Face Shape */}
      <Section title="Face Shape">
        <StyleGrid
          items={FACE_SHAPES}
          selected={config.face.shape}
          onSelect={(shape) => onUpdateFace({ shape })}
          renderItem={(shape) => (
            <FaceShapePreview shape={shape} skinTone={config.body.skinTone} />
          )}
        />
      </Section>

      {/* Face Width */}
      <Section title="Face Width">
        <Slider
          value={config.face.width}
          minimumValue={0.8}
          maximumValue={1.2}
          step={0.05}
          onValueChange={(width) => onUpdateFace({ width })}
        />
      </Section>

      {/* Nose Style */}
      <Section title="Nose">
        <StyleGrid
          items={NOSE_STYLES}
          selected={config.nose.style}
          onSelect={(style) => onUpdateNose({ style })}
        />
        <Slider
          label="Size"
          value={config.nose.size}
          minimumValue={0.8}
          maximumValue={1.2}
          onValueChange={(size) => onUpdateNose({ size })}
        />
      </Section>

      {/* Mouth Style */}
      <Section title="Mouth">
        <StyleGrid
          items={MOUTH_STYLES}
          selected={config.mouth.style}
          onSelect={(style) => onUpdateMouth({ style })}
        />
        <ColorGrid
          title="Lip Color"
          colors={LIP_COLORS}
          selected={config.mouth.lipColor}
          onSelect={(color) => onUpdateMouth({ lipColor: color })}
        />
      </Section>
    </View>
  );
}
```

### 15.3 Slider Component

```typescript
// Reusable slider for numeric adjustments
interface FeatureSliderProps {
  label: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
  leftLabel?: string;
  rightLabel?: string;
}

function FeatureSlider({
  label,
  value,
  minimumValue,
  maximumValue,
  step = 0.05,
  onValueChange,
  leftLabel,
  rightLabel,
}: FeatureSliderProps) {
  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderRow}>
        {leftLabel && <Text style={styles.endLabel}>{leftLabel}</Text>}
        <Slider
          style={styles.slider}
          value={value}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          onValueChange={onValueChange}
          minimumTrackTintColor={theme.colors.primary}
          thumbTintColor={theme.colors.primary}
        />
        {rightLabel && <Text style={styles.endLabel}>{rightLabel}</Text>}
      </View>
    </View>
  );
}
```

---

## 16. Migration Strategy

### 16.1 Phase 1: Parallel Systems

During the transition period, both avatar systems run simultaneously:

```typescript
// src/components/Avatar.tsx - Updated to support both systems

import React from 'react';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { DigitalAvatar } from './avatar';
import { LegacyAvatar } from './LegacyAvatar'; // Renamed from current Avatar
import { isDigitalAvatarConfig } from '@/utils/avatarHelpers';
import type { DigitalAvatarConfig, AvatarConfig } from '@/types/avatar';

interface AvatarProps {
  config: DigitalAvatarConfig | AvatarConfig;
  size?: number;
  showBody?: boolean;
  onPress?: () => void;
}

export function Avatar({ config, size = 48, showBody, onPress }: AvatarProps) {
  // Feature flag check
  if (!FEATURE_FLAGS.DIGITAL_AVATAR_ENABLED) {
    return <LegacyAvatar config={config as AvatarConfig} size={size} onPress={onPress} />;
  }

  // Check if digital avatar config
  if (isDigitalAvatarConfig(config)) {
    return <DigitalAvatar config={config} size={size} showBody={showBody} onPress={onPress} />;
  }

  // Fall back to legacy avatar for old configs
  return <LegacyAvatar config={config} size={size} onPress={onPress} />;
}
```

### 16.2 Phase 2: Auto-Migration

#### 16.2.1 Migration Utilities

```typescript
// src/utils/avatarMigration.ts

import type { AvatarConfig } from "@/types/models";
import type { DigitalAvatarConfig, SkinToneId } from "@/types/avatar";
import { getDefaultAvatarConfig } from "./avatarHelpers";

/**
 * Map legacy baseColor to closest skin tone
 * The old system used baseColor as avatar circle color
 * We interpret warm colors as skin tones, cool colors get default
 */
const COLOR_TO_SKIN_MAP: Record<string, SkinToneId> = {
  // Existing color options from current cosmetics.ts
  "#FF6B6B": "skin_06", // Red-ish -> medium (default accent)
  "#4ECDC4": "skin_05", // Teal -> use default skin, apply to clothing
  "#45B7D1": "skin_05", // Blue -> use default skin
  "#96CEB4": "skin_05", // Green -> use default skin
  "#FFEAA7": "skin_03", // Yellow/light -> fair skin
  "#DDA0DD": "skin_05", // Plum -> use default
  "#98D8C8": "skin_04", // Mint -> use default
  "#F7DC6F": "skin_03", // Gold -> fair
  "#BB8FCE": "skin_05", // Purple -> use default
  "#85C1E9": "skin_05", // Sky blue -> use default
  // Add actual skin-like colors if they exist
  "#FFDAB9": "skin_03", // Peach
  "#DEB887": "skin_06", // Burlywood
  "#D2691E": "skin_08", // Chocolate
  "#8B4513": "skin_10", // Saddle brown
};

/**
 * Map legacy hat emojis to new headwear IDs
 * Based on actual emojis in src/data/cosmetics.ts
 */
const HAT_EMOJI_MAP: Record<string, string> = {
  // From cosmetics.ts COSMETIC_ITEMS with slot: 'hat'
  "🔥": "headwear_flame", // hat_flame
  "👑": "headwear_crown_royal", // hat_crown
  "😇": "headwear_halo", // hat_legendary
  "🎉": "headwear_party_hat", // hat_party
  "🧢": "headwear_baseball_cap", // hat_cap
  "🎿": "headwear_beanie_basic", // hat_beanie (ski emoji used)
  "🎩": "headwear_top_hat", // hat_tophat
};

/**
 * Map legacy glasses emojis to new eyewear IDs
 * Based on actual emojis in src/data/cosmetics.ts
 */
const GLASSES_EMOJI_MAP: Record<string, string> = {
  // From cosmetics.ts COSMETIC_ITEMS with slot: 'glasses'
  "😎": "eyewear_aviator_sun", // glasses_cool
  "👓": "eyewear_round_thin", // glasses_round
  "🕶️": "eyewear_aviator_sun", // glasses_sunglasses
  "🥽": "eyewear_goggles_ski", // glasses_vr
  "🤩": "eyewear_star_glasses", // glasses_star
  "🤓": "eyewear_round_thick", // glasses_nerd
};

/**
 * Find closest skin tone for a hex color
 */
export function mapColorToSkinTone(hexColor: string): SkinToneId {
  // Direct match
  if (COLOR_TO_SKIN_MAP[hexColor.toUpperCase()]) {
    return COLOR_TO_SKIN_MAP[hexColor.toUpperCase()];
  }

  // Default to medium skin tone
  return "skin_06";
}

/**
 * Map legacy hat emoji to headwear ID
 */
export function mapLegacyHat(emoji: string): string | null {
  return HAT_EMOJI_MAP[emoji] || null;
}

/**
 * Map legacy glasses emoji to eyewear ID
 */
export function mapLegacyGlasses(emoji: string): string | null {
  return GLASSES_EMOJI_MAP[emoji] || null;
}

/**
 * Convert legacy AvatarConfig to DigitalAvatarConfig
 */
export function convertLegacyConfig(legacy: AvatarConfig): DigitalAvatarConfig {
  // Start with default config
  const digital = getDefaultAvatarConfig();

  // Map skin tone from base color
  digital.body.skinTone = mapColorToSkinTone(legacy.baseColor);

  // Map hat to headwear
  if (legacy.hat) {
    const headwear = mapLegacyHat(legacy.hat);
    if (headwear) {
      digital.accessories.headwear = headwear;
    }
  }

  // Map glasses to eyewear
  if (legacy.glasses) {
    const eyewear = mapLegacyGlasses(legacy.glasses);
    if (eyewear) {
      digital.accessories.eyewear = eyewear;
    }
  }

  // Store original color as clothing color hint
  // (could be used to set initial shirt color)
  digital._legacyColor = legacy.baseColor;

  // Store legacy config for reference/debugging
  digital.legacy = legacy;

  return digital;
}
```

#### 16.2.2 Migration Script

Create a migration script that can be run manually or as part of deployment:

```typescript
// scripts/migrate-avatars.ts

/**
 * Migration script for converting legacy avatars to digital avatars
 *
 * Usage:
 *   npx ts-node scripts/migrate-avatars.ts --dry-run
 *   npx ts-node scripts/migrate-avatars.ts --production --batch-size=100
 *
 * Options:
 *   --dry-run       Preview what would be migrated without making changes
 *   --production    Run against production (requires confirmation)
 *   --batch-size=N  Number of users to process per batch (default: 100)
 *   --limit=N       Maximum total users to migrate (for testing)
 */

import * as admin from "firebase-admin";
import { convertLegacyConfig } from "../src/utils/avatarMigration";

// Initialize Firebase Admin
const serviceAccount = require("./service-account-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  limit?: number;
}

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

async function migrateAvatars(
  options: MigrationOptions,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  console.log(`Starting migration (dryRun: ${options.dryRun})`);
  console.log(`Batch size: ${options.batchSize}`);
  if (options.limit) console.log(`Limit: ${options.limit}`);

  // Query users without digitalAvatar
  let query = db.collection("Users").where("digitalAvatar", "==", null);

  // Also get users where digitalAvatar doesn't exist
  // Note: Firestore doesn't support "field doesn't exist" query
  // So we query all and filter

  const allUsersQuery = db.collection("Users");
  const snapshot = await allUsersQuery.get();

  const usersToMigrate = snapshot.docs.filter((doc) => {
    const data = doc.data();
    return !data.digitalAvatar && data.avatarConfig;
  });

  stats.total = usersToMigrate.length;
  console.log(`Found ${stats.total} users to migrate`);

  // Apply limit if specified
  const docsToProcess = options.limit
    ? usersToMigrate.slice(0, options.limit)
    : usersToMigrate;

  // Process in batches
  for (let i = 0; i < docsToProcess.length; i += options.batchSize) {
    const batch = docsToProcess.slice(i, i + options.batchSize);
    const writeBatch = db.batch();

    console.log(`Processing batch ${Math.floor(i / options.batchSize) + 1}...`);

    for (const doc of batch) {
      try {
        const userData = doc.data();
        const legacyConfig = userData.avatarConfig || { baseColor: "#FF6B6B" };

        // Convert to digital avatar
        const digitalAvatar = convertLegacyConfig(legacyConfig);
        digitalAvatar.migratedAt = Date.now();
        digitalAvatar.migratedFrom = "legacy";

        if (options.dryRun) {
          console.log(`  Would migrate ${doc.id}:`, {
            from: legacyConfig,
            to: {
              skinTone: digitalAvatar.body.skinTone,
              headwear: digitalAvatar.accessories.headwear,
              eyewear: digitalAvatar.accessories.eyewear,
            },
          });
          stats.migrated++;
        } else {
          writeBatch.update(doc.ref, { digitalAvatar });
          stats.migrated++;
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push(`Error migrating ${doc.id}: ${error}`);
        console.error(`  Failed to migrate ${doc.id}:`, error);
      }
    }

    // Commit batch (unless dry run)
    if (!options.dryRun) {
      try {
        await writeBatch.commit();
        console.log(`  Batch committed successfully`);
      } catch (error) {
        console.error(`  Batch commit failed:`, error);
        stats.errors.push(`Batch commit error: ${error}`);
      }
    }
  }

  return stats;
}

// Parse command line arguments
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: true, // Safe default
    batchSize: 100,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--production") {
      options.dryRun = false;
    } else if (arg.startsWith("--batch-size=")) {
      options.batchSize = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.split("=")[1], 10);
    }
  }

  return options;
}

// Main execution
async function main() {
  const options = parseArgs();

  if (!options.dryRun) {
    // Production safety check
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirmed = await new Promise<boolean>((resolve) => {
      rl.question(
        '⚠️  Running in PRODUCTION mode. Type "yes" to confirm: ',
        (answer: string) => {
          rl.close();
          resolve(answer.toLowerCase() === "yes");
        },
      );
    });

    if (!confirmed) {
      console.log("Migration cancelled.");
      process.exit(0);
    }
  }

  const stats = await migrateAvatars(options);

  console.log("\n========== Migration Complete ==========");
  console.log(`Total users found: ${stats.total}`);
  console.log(`Successfully migrated: ${stats.migrated}`);
  console.log(`Skipped (already had digital avatar): ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log("\nErrors:");
    stats.errors.forEach((e) => console.log(`  - ${e}`));
  }

  if (options.dryRun) {
    console.log("\n(This was a dry run. No changes were made.)");
  }

  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(console.error);
```

### 16.3 Phase 3: Deprecation

After successful migration and monitoring period (2-4 weeks):

```typescript
// Mark legacy components as deprecated

/**
 * @deprecated Use DigitalAvatar instead. This component will be removed in v2.0.
 * Migration guide: docs/DIGITAL_AVATAR_SYSTEM_PLAN.md#migration
 */
export function LegacyAvatar(props: LegacyAvatarProps) {
  if (__DEV__) {
    console.warn(
      "[DEPRECATED] LegacyAvatar is deprecated. Use DigitalAvatar instead.\n" +
        "See: docs/DIGITAL_AVATAR_SYSTEM_PLAN.md#migration",
    );
  }
  // ... existing implementation
}

// Log analytics for legacy usage monitoring
function trackLegacyAvatarUsage(userId: string) {
  analytics.track("legacy_avatar_rendered", {
    userId,
    timestamp: Date.now(),
  });
}
```

#### 16.3.1 Cleanup Checklist

After deprecation period (3-6 months post-launch):

- [ ] Remove `LegacyAvatar` component
- [ ] Remove `avatarConfig` field from User type (keep in Firestore for archival)
- [ ] Remove legacy emoji mappings
- [ ] Remove feature flags for digital avatar (always enabled)
- [ ] Update all documentation
- [ ] Archive migration scripts

---

## 17. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Week 1: Setup & Core Types**

Day 1-2: Package Installation & Verification

- [ ] Install `react-native-svg@^15.0.0`:
  ```powershell
  cd c:\Users\rflet\OneDrive\Desktop\snapstyle-mvp
  npx expo install react-native-svg
  ```
- [ ] Create verification test component to ensure SVG renders on iOS/Android
- [ ] Verify expo-prebuild not needed (Expo SDK 50+ includes native SVG support)

Day 3-4: Type Definitions

- [ ] Create `src/types/avatar.ts` with complete `DigitalAvatarConfig` interface
- [ ] Update `src/types/models.ts` to add `digitalAvatar?: DigitalAvatarConfig` to User interface
- [ ] Add type guards: `isDigitalAvatarConfig()` and `isLegacyAvatarConfig()`
- [ ] Create ID type unions for all asset categories (SkinToneId, EyeStyleId, etc.)
- [ ] Update `src/types/index.ts` to re-export new avatar types

Day 5: Directory Structure Creation

- [ ] Create folder structure:

  ```
  src/components/avatar/
  ├── index.ts
  ├── DigitalAvatar.tsx
  ├── AvatarSvgRenderer.tsx
  ├── AvatarParts/
  │   └── index.ts
  └── AvatarCustomizer/
      └── index.ts

  src/data/avatarAssets/
  ├── index.ts
  ├── skinTones.ts
  ├── faceShapes.ts
  ├── eyeStyles.ts
  ├── noseStyles.ts
  ├── mouthStyles.ts
  ├── earStyles.ts
  ├── hairStyles.ts
  └── facialHairStyles.ts
  ```

Day 6-7: Basic Data Files

- [ ] Create `src/data/avatarAssets/skinTones.ts`:
  - Define SKIN_TONES array with 12 skin tone definitions
  - Include hex colors, names, and gradient data for shading
- [ ] Create `src/data/avatarAssets/faceShapes.ts`:
  - Define FACE_SHAPES with 8 face shape SVG path data
  - Include anchor points for feature placement
- [ ] Create `src/data/avatarAssets/index.ts` barrel export

**Week 2: Core Rendering Components**

Day 8-9: AvatarSvgRenderer Skeleton

- [ ] Create `src/components/avatar/AvatarSvgRenderer.tsx`:
  - Import from `react-native-svg`: Svg, G, Defs, LinearGradient, Stop, ClipPath
  - Set up viewBox="0 0 200 300" coordinate system
  - Create gradient definitions for skin, hair, eyes
  - Implement layer structure with G elements for each layer
  - Add size prop scaling logic

Day 10-11: Head/Face Component

- [ ] Create `src/components/avatar/AvatarParts/Head.tsx`:
  - Accept faceShape and skinTone props
  - Render face SVG path from face shape data
  - Apply skin tone gradient fill
  - Add subtle shading paths for 3D effect
- [ ] Integrate Head into AvatarSvgRenderer

Day 12-13: Eyes Component

- [ ] Create `src/components/avatar/AvatarParts/Eyes.tsx`:
  - Implement 3 initial eye styles: natural, round, almond
  - Support 5 eye colors: brown, blue, green, hazel, gray
  - Include eyebrows (basic arch style)
  - Add size, spacing, tilt adjustments
  - Render sclera, iris, pupil, highlight
- [ ] Create `src/data/avatarAssets/eyeStyles.ts` with path data

Day 14: Nose & Mouth Components

- [ ] Create `src/components/avatar/AvatarParts/Nose.tsx`:
  - Implement 5 nose styles: small, medium, button, pointed, wide
  - Support size scaling
- [ ] Create `src/components/avatar/AvatarParts/Mouth.tsx`:
  - Implement 5 mouth styles: smile, neutral, slight_smile, open_smile, closed
  - Support lip color and thickness
- [ ] Create `src/data/avatarAssets/noseStyles.ts`
- [ ] Create `src/data/avatarAssets/mouthStyles.ts`

End of Week 2 Milestone:

- [ ] Create `src/components/avatar/DigitalAvatar.tsx` main component
- [ ] Render head-only avatar with basic facial features
- [ ] Test rendering in a dev screen (temporary test in ProfileScreen)

### Phase 2: Facial Features (Weeks 3-4)

**Week 3: Eyes Complete & Ears**

Day 15-16: Complete Eye Styles

- [ ] Add remaining eye styles to `src/data/avatarAssets/eyeStyles.ts`:
  - Round, almond, hooded, monolid, upturned, downturned, wide_set, close_set, deep_set, prominent
- [ ] Update `src/components/avatar/AvatarParts/Eyes.tsx` to render all styles
- [ ] Add eye reflection/highlight variations

Day 17: Complete Eye Colors

- [ ] Expand `eyeStyles.ts` with 12 eye colors:
  - brown_dark, brown_light, hazel_gold, hazel_green
  - green_forest, green_light, green_gray
  - blue_deep, blue_light, blue_gray
  - gray_dark, gray_light, amber
- [ ] Create iris gradient definitions for each color

Day 18-19: Eyebrow Styles

- [ ] Add eyebrow section to `eyeStyles.ts`:
  - 9 styles: natural, thick, thin, arched_high, arched_soft, straight, angled, rounded, bushy
- [ ] Update Eyes.tsx to accept eyebrow props
- [ ] Support eyebrow color (tied to hair color by default, overrideable)
- [ ] Add eyebrow thickness slider support (0.8-1.2)

Day 20: Eyelash Styles

- [ ] Add eyelash definitions:
  - 5 styles: natural, long, dramatic, wispy, none
- [ ] Render eyelashes as Path elements above eyes
- [ ] Support eyelash color (default black, customizable)

Day 21: Eye Animations

- [ ] Create `src/components/avatar/animations/BlinkAnimation.tsx`
- [ ] Implement eyelid close/open using Reanimated's `useSharedValue`
- [ ] Add random blink interval (3-6 seconds)
- [ ] Create `enableBlink` prop for Eyes component

**Week 4: Nose, Mouth, Ears Complete**

Day 22-23: Complete Nose Styles

- [ ] Expand `src/data/avatarAssets/noseStyles.ts` to 10 styles:
  - small, medium, large, button, pointed, wide, narrow, hooked, upturned, flat
- [ ] Each style needs: SVG path, nostrils path, highlight path
- [ ] Update Nose.tsx with size scaling (0.8-1.2)

Day 24-25: Complete Mouth Styles

- [ ] Expand `src/data/avatarAssets/mouthStyles.ts` to 10 styles:
  - smile, big_smile, slight_smile, neutral, smirk, open, laugh, pout, frown, kissy
- [ ] Each style needs: upper lip path, lower lip path, teeth path (if open)
- [ ] Implement lip colors in `mouthStyles.ts`:
  - natural_light, natural_medium, natural_dark, pink_soft, pink_bright
  - rose, red_classic, red_dark, berry, nude
- [ ] Add lip thickness support (0.8-1.2)

Day 26-27: Ear Styles

- [ ] Create `src/data/avatarAssets/earStyles.ts` with 8 styles:
  - small, medium, large, pointed, round, attached, detached, elf
- [ ] Create `src/components/avatar/AvatarParts/Ears.tsx`:
  - Render both left and right ears
  - Apply skin tone fill
  - Support size scaling (0.8-1.2)
  - Support visibility toggle (for avatars with long hair covering ears)
- [ ] Position ears relative to face shape

Day 28: Week 4 Integration

- [ ] Ensure all facial feature components integrate properly
- [ ] Test feature combinations (different face shapes with features)
- [ ] Verify no z-index/layering issues
- [ ] Add snapshot tests for each facial feature style

### Phase 3: Hair System (Weeks 5-6)

**Week 5: Hair Architecture & Basic Styles**

Day 29-30: Hair Rendering Architecture

- [ ] Design two-part hair system:
  - `HairBackSvg` - renders behind head (back of hair, ponytails)
  - `HairFrontSvg` - renders over forehead, face edges
- [ ] Create `src/components/avatar/AvatarParts/Hair.tsx`:
  - Export both HairBackSvg and HairFrontSvg
  - Accept style, color, and hairline props
- [ ] Update AvatarSvgRenderer layer order:
  - Layer 3: Hair Back (behind head)
  - Layer 6: Hair Front (over face)

Day 31-32: Hair Color System

- [ ] Create `src/data/avatarAssets/hairColors.ts`:
  - 15 natural colors: black, dark_brown, medium_brown, light_brown, auburn,
    chestnut, copper, strawberry_blonde, golden_blonde, platinum_blonde,
    dirty_blonde, gray_dark, gray_light, silver, white
  - 5 fantasy colors: blue, purple, pink, green, red
- [ ] Each color includes: primary hex, shadow hex, highlight hex
- [ ] Create hair gradient definitions

Day 33-35: Basic Hair Styles (15 styles)

- [ ] Create `src/data/avatarAssets/hairStyles.ts` with initial 15 styles:

  Short styles (5):
  - `short_classic` - Traditional short cut
  - `short_textured` - Messy/textured short
  - `short_fade` - Fade/undercut
  - `short_buzz` - Buzz cut
  - `short_cropped` - Close cropped

  Medium styles (5):
  - `medium_wavy` - Wavy medium length
  - `medium_straight` - Straight medium
  - `medium_curly` - Curly medium
  - `medium_bob` - Bob cut
  - `medium_layered` - Layered cut

  Long styles (5):
  - `long_straight` - Long straight
  - `long_wavy` - Long wavy
  - `long_curly` - Long curly
  - `long_braided` - Braided
  - `long_ponytail` - Ponytail

- [ ] Each style data structure:
  ```typescript
  interface HairStyleData {
    id: HairStyleId;
    name: string;
    category: "short" | "medium" | "long" | "bald" | "special";
    backPaths: string[]; // SVG paths for hair behind head
    frontPaths: string[]; // SVG paths for hair over face
    hairlineType: "standard" | "receding" | "widows_peak" | "rounded";
    coversEars: boolean; // Hint for ear rendering
    hatCompatible: boolean; // Can wear hats easily
  }
  ```

**Week 6: Complete Hair & Facial Hair**

Day 36-38: Complete Hair Styles (35 more = 50 total)

- [ ] Add 35 additional hair styles across categories:

  Short (5 more = 10 total):
  - short_spiky, short_slicked, short_mohawk, short_quiff, short_crew

  Medium (5 more = 10 total):
  - medium_shaggy, medium_asymmetric, medium_bangs, medium_side_part, medium_afro_short

  Long (10 more = 15 total):
  - long_buns, long_half_up, long_side_swept, long_pigtails, long_dreads,
    long_afro, long_box_braids, long_cornrows, long_messy, long_elegant

  Bald/Special (10):
  - bald_full, bald_pattern, bald_top, bald_shaved_sides
  - special_undercut_long, special_mullet, special_pompadour, special_fauxhawk,
    special_liberty_spikes, special_man_bun

Day 39-40: Facial Hair System

- [ ] Create `src/data/avatarAssets/facialHairStyles.ts` with 10 styles:
  - none, stubble, goatee, mustache, full_beard, short_beard,
    long_beard, soul_patch, mutton_chops, handlebar
- [ ] Create `src/components/avatar/AvatarParts/FacialHair.tsx`:
  - Render on face layer (after mouth, before hair front)
  - Use hair color by default (overrideable)
  - Position relative to mouth/chin
- [ ] Each facial hair needs: main path, shadow path

Day 41-42: Hair Interaction & Polish

- [ ] Implement hat interaction system:
  - When headwear equipped, modify hair rendering
  - Some hats hide hair front, some show modified version
  - Add `hatOverride` paths to hair styles that need special hat rendering
- [ ] Add hair highlights support:
  - Optional secondary color for streaks/highlights
  - Highlight paths defined per hair style
- [ ] Add hair texture hints (straight, wavy, curly, coily)

### Phase 4: Body & Clothing (Weeks 7-8)

**Week 7: Body System & Basic Clothing**

Day 43-44: Body Shape System

- [ ] Create `src/data/avatarAssets/bodyShapes.ts` with 8 body types:

  ```typescript
  interface BodyShapeData {
    id: BodyShapeId;
    name: string;
    torsoPath: string; // Upper body outline
    armsPath: string; // Arm shapes
    shoulderWidth: number; // Relative (0.8-1.2)
    waistRatio: number; // Waist to shoulder ratio
    armLength: number; // Relative arm length
    neckWidth: number; // Neck width factor
  }
  ```

  Body types: slim, average, athletic, broad, curvy, stocky, tall, petite

- [ ] Create `src/components/avatar/AvatarParts/Body.tsx`:
  - Render neck, shoulders, torso, arms
  - Apply skin tone to visible skin areas
  - Support height scaling (0.8-1.2)

Day 45-46: Clothing Layer Architecture

- [ ] Design clothing rendering system:
  - Clothing renders over body in specific layer
  - Support for tops, bottoms, and full outfits
  - Outfit overrides individual top/bottom
- [ ] Create `src/components/avatar/AvatarParts/Clothing.tsx`:
  - ClothingTop component for shirts, jackets
  - ClothingBottom component for pants, skirts
  - ClothingOutfit component for full-body items
- [ ] Each clothing item needs:
  ```typescript
  interface ClothingItemData {
    id: string;
    name: string;
    slot: "top" | "bottom" | "outfit";
    category: string; // tshirt, hoodie, jeans, etc.
    paths: {
      main: string[]; // Primary garment paths
      details: string[]; // Buttons, pockets, etc.
      shadows: string[]; // Shadow/fold paths
    };
    colors: {
      primary: string;
      secondary?: string;
      accent?: string;
    };
    colorizable: boolean; // Can user change colors?
    layerOrder: number; // For layering (jacket over shirt)
  }
  ```

Day 47-49: Basic Clothing Items (20 items)

- [ ] Create `src/data/avatarAssets/clothingItems.ts`:

  Tops (10):
  - top_tshirt_basic - Plain t-shirt
  - top_tshirt_vneck - V-neck t-shirt
  - top_polo - Polo shirt
  - top_button_down - Button-down shirt
  - top_hoodie - Hoodie
  - top_sweater - Crewneck sweater
  - top_tank - Tank top
  - top_jacket_casual - Casual jacket
  - top_blazer - Blazer
  - top_crop_top - Crop top

  Bottoms (10):
  - bottom_jeans_regular - Regular jeans
  - bottom_jeans_skinny - Skinny jeans
  - bottom_chinos - Chino pants
  - bottom_shorts - Casual shorts
  - bottom_joggers - Jogger pants
  - bottom_skirt_mini - Mini skirt
  - bottom_skirt_midi - Midi skirt
  - bottom_leggings - Leggings
  - bottom_dress_pants - Dress pants
  - bottom_cargo - Cargo pants

**Week 8: Complete Clothing System**

Day 50-52: Complete Clothing Catalog (40 more = 60 total)

- [ ] Add 20 more tops:
  - top_crop_hoodie, top_cardigan, top_turtleneck, top_sweatshirt,
    top_denim_jacket, top_leather_jacket, top_bomber, top_puffer,
    top_flannel, top_henley, top_jersey, top_dress_shirt,
    top_blouse, top_cami, top_tube_top, top_off_shoulder,
    top_bodysuit, top_vest, top_windbreaker, top_raincoat

- [ ] Add 20 more bottoms:
  - bottom_shorts_sport, bottom_shorts_denim, bottom_culottes,
    bottom_wide_leg, bottom_bootcut, bottom_flare, bottom_high_waist,
    bottom_skirt_maxi, bottom_skirt_pleated, bottom_skirt_denim,
    bottom_overalls_bottom, bottom_capris, bottom_palazzo,
    bottom_track_pants, bottom_sweatpants, bottom_bermuda,
    bottom_paper_bag, bottom_biker_shorts, bottom_harem, bottom_sailor

Day 53-54: Full Outfit System

- [ ] Create `src/data/avatarAssets/outfits.ts` with 15 full outfits:
  - outfit_casual_summer, outfit_casual_winter, outfit_business_casual,
    outfit_formal_suit, outfit_formal_dress, outfit_athleisure,
    outfit_sporty, outfit_streetwear, outfit_boho, outfit_preppy,
    outfit_punk, outfit_vintage, outfit_minimalist, outfit_glam,
    outfit_uniform_server (special)
- [ ] Outfits override both top and bottom slots
- [ ] Outfits can include integrated accessories (belts, etc.)

Day 55-56: Clothing Customization

- [ ] Implement clothing color customization:
  - Color picker for colorizable items
  - Preset color palettes per item category
  - Store customized colors in config
- [ ] Add clothing layer support:
  - Render jacket over shirt
  - Support tucked in/out variations
  - Handle sleeve interaction with accessories

### Phase 5: Accessories (Weeks 9-10)

**Week 9: Headwear & Eyewear**

Day 57-59: Headwear System (30+ items)

- [ ] Create `src/data/avatarAssets/headwear.ts`:

  ```typescript
  interface HeadwearData {
    id: string;
    name: string;
    category: "hat" | "cap" | "beanie" | "headband" | "crown" | "special";
    paths: {
      main: string[];
      details: string[];
      back?: string[]; // Parts behind head (if any)
    };
    colors: { primary: string; secondary?: string };
    colorizable: boolean;
    hairInteraction: "hide" | "partial" | "none"; // How it affects hair
    fitAnchor: { x: number; y: number }; // Position anchor

    // Unlock info (integrates with existing ExtendedCosmeticItem system)
    rarity: ExtendedCosmeticRarity;
    unlock: CosmeticUnlock;
  }
  ```

  Hats/Caps (15):
  - headwear_baseball_cap, headwear_snapback, headwear_dad_hat,
    headwear_bucket_hat, headwear_fedora, headwear_cowboy,
    headwear_top_hat, headwear_bowler, headwear_newsboy,
    headwear_beret, headwear_sun_hat, headwear_visor,
    headwear_trucker, headwear_fitted, headwear_safari

  Beanies/Winter (5):
  - headwear_beanie_basic, headwear_beanie_pom, headwear_beanie_slouch,
    headwear_ear_flap, headwear_trapper

  Headbands/Special (10):
  - headwear_headband_sport, headwear_headband_thin, headwear_bandana,
    headwear_crown_simple, headwear_crown_royal, headwear_tiara,
    headwear_party_hat, headwear_graduation_cap, headwear_chef_hat,
    headwear_halo

- [ ] Create `src/components/avatar/AvatarParts/Headwear.tsx`:
  - Render in headwear layer (layer 8)
  - Pass hairInteraction to Hair component
  - Support different anchor points per hat style

Day 60-62: Eyewear System (20+ items)

- [ ] Create `src/data/avatarAssets/eyewear.ts`:

  ```typescript
  interface EyewearData {
    id: string;
    name: string;
    category: "glasses" | "sunglasses" | "goggles" | "special";
    paths: {
      frame: string[]; // Frame paths
      lens: string[]; // Lens paths (can be transparent)
      bridge: string; // Bridge path
    };
    lensColor?: string; // For sunglasses/tinted
    lensOpacity?: number; // 0-1
    frameColor: string;
    colorizable: boolean;

    rarity: ExtendedCosmeticRarity;
    unlock: CosmeticUnlock;
  }
  ```

  Glasses (10):
  - eyewear_round_thin, eyewear_round_thick, eyewear_rectangular,
    eyewear_square, eyewear_cat_eye, eyewear_aviator_clear,
    eyewear_wayfare, eyewear_oversized, eyewear_reading,
    eyewear_rimless

  Sunglasses (8):
  - eyewear_aviator_sun, eyewear_wayfare_sun, eyewear_sport,
    eyewear_round_sun, eyewear_shield, eyewear_mirrored,
    eyewear_gradient, eyewear_clip_on

  Special (2):
  - eyewear_3d_glasses, eyewear_monocle

- [ ] Create `src/components/avatar/AvatarParts/Eyewear.tsx`:
  - Render in eyewear layer (layer 7, over eyes)
  - Handle lens transparency/tint

**Week 10: Other Accessories & Integration**

Day 63-64: Neckwear System (15+ items)

- [ ] Create `src/data/avatarAssets/neckwear.ts`:

  Jewelry (7):
  - neckwear_chain_gold, neckwear_chain_silver, neckwear_pendant,
    neckwear_choker, neckwear_pearls, neckwear_beads, neckwear_locket

  Clothing (5):
  - neckwear_tie, neckwear_bow_tie, neckwear_scarf_wrap,
    neckwear_scarf_long, neckwear_bandana_neck

  Special (3):
  - neckwear_headphones, neckwear_lanyard, neckwear_medal

- [ ] Create `src/components/avatar/AvatarParts/Neckwear.tsx`:
  - Render around neck area
  - Layer above clothing collar

Day 65-66: Earwear System (10+ items)

- [ ] Create `src/data/avatarAssets/earwear.ts`:

  Earrings (8):
  - earwear_studs_simple, earwear_studs_diamond, earwear_hoops_small,
    earwear_hoops_large, earwear_dangles, earwear_ear_cuff,
    earwear_plugs, earwear_cartilage

  Tech/Special (2):
  - earwear_airpods, earwear_hearing_aid

- [ ] Create `src/components/avatar/AvatarParts/Earwear.tsx`:
  - Render on ear positions
  - Respect ear visibility (hidden by hair = hidden earwear)

Day 67-68: Wristwear System (10+ items)

- [ ] Create `src/data/avatarAssets/wristwear.ts`:

  Watches (4):
  - wristwear_watch_classic, wristwear_watch_sport, wristwear_smartwatch,
    wristwear_watch_fancy

  Bracelets (6):
  - wristwear_bracelet_chain, wristwear_bracelet_beaded,
    wristwear_bracelet_leather, wristwear_bracelet_friendship,
    wristwear_bangle, wristwear_sweatband

- [ ] Create `src/components/avatar/AvatarParts/Wristwear.tsx`:
  - Render on wrist position (only visible if body shown)
  - Account for sleeve length

Day 69-70: Accessory Integration

- [ ] Integrate accessory system with existing `ExtendedCosmeticItem` in `src/types/profile.ts`
- [ ] Connect to existing inventory system (`src/services/cosmetics.ts`)
- [ ] Create unified `src/components/avatar/AvatarParts/Accessories.tsx`:
  - Composes all accessory types
  - Handles unlock status checks
- [ ] Add accessory preview in shop system

### Phase 6: Customization UI (Weeks 11-12)

**Week 11: Customizer Framework**

Day 71-72: Modal Framework & Navigation

- [ ] Create `src/components/avatar/AvatarCustomizer/AvatarCustomizerModal.tsx`:
  - Full-screen modal with slide animation
  - Header: Cancel, Title, Save buttons
  - Integrate with existing modal patterns (see `FriendPickerModal.tsx`, `BlockUserModal.tsx`)
- [ ] Create `src/components/avatar/AvatarCustomizer/CategoryTabs.tsx`:
  - Horizontal scrollable tabs
  - Categories: Presets, Face, Eyes, Hair, Body, Clothing, Accessories
  - Active state indicator
  - Tab icons for visual clarity

Day 73-74: Preview Panel & Live Updates

- [ ] Create `src/components/avatar/AvatarCustomizer/PreviewPanel.tsx`:
  - Large avatar preview (200px+)
  - Toggle body/head-only view
  - Optional animated mode toggle
  - Background options (to see avatar against different colors)
- [ ] Implement `useAvatarCustomization` hook (already defined in plan)
- [ ] Connect preview to hook state for live updates

Day 75-76: Skin Tone & Face Pickers

- [ ] Create `src/components/avatar/AvatarCustomizer/SkinTonePicker.tsx`:
  - Grid of skin tone swatches (12 options)
  - Swatches show actual skin color with border
  - Selected state with checkmark
  - Accessibility: color names shown on press
- [ ] Create `src/components/avatar/AvatarCustomizer/FaceCustomizer.tsx`:
  - Face shape grid with mini previews
  - Nose style picker
  - Mouth style picker
  - Lip color picker
  - Ear visibility toggle

Day 77: Feature Sliders

- [ ] Create `src/components/avatar/AvatarCustomizer/FeatureSliders.tsx`:
  - Reusable slider component with labels
  - Min/Max labels (e.g., "Smaller" / "Larger")
  - Current value indicator
  - Haptic feedback on value change
- [ ] Implement sliders for:
  - Face width (0.8-1.2)
  - Eye size, spacing, tilt
  - Nose size
  - Mouth size, lip thickness
  - Ear size
  - Body height

**Week 12: Style Pickers & Advanced Features**

Day 78-79: Style Grid Component

- [ ] Create `src/components/avatar/AvatarCustomizer/StylePicker.tsx`:
  - Generic style grid component for any asset type
  - Thumbnail rendering for each option
  - Category filters (for large lists like hair)
  - Search functionality
  - Selected state border
  - Locked items show lock icon with unlock requirements

Day 80: Color Pickers

- [ ] Create `src/components/avatar/AvatarCustomizer/ColorPicker.tsx`:
  - Color swatch grid
  - Support for predefined palettes
  - Optional custom color input (hex)
  - Tabs for natural vs fantasy colors (hair)
- [ ] Integrate color pickers for:
  - Hair color
  - Eye color
  - Eyebrow color (defaults to hair)
  - Clothing colors (where colorizable)

Day 81-82: Preset System

- [ ] Create `src/data/avatarPresets.ts`:
  - 20+ curated preset avatars
  - Presets are complete DigitalAvatarConfig objects
  - Categories: Default, Popular, Themed (seasons, holidays)
- [ ] Create `src/components/avatar/AvatarCustomizer/PresetPicker.tsx`:
  - Grid of preset avatar thumbnails
  - Apply preset copies all values
  - "Randomize" button generates random valid config
- [ ] Implement randomizer:
  - Pick random valid values for each field
  - Ensure coherent combinations (matching skin tone for ears, etc.)

Day 83-84: Save/Load & Undo/Redo

- [ ] Implement save functionality:
  - Validate config before save
  - Call `saveDigitalAvatar` from avatarService
  - Show success/error toast
  - Close modal on success
- [ ] Implement history stack for undo/redo:
  - Store config snapshots on changes
  - Max history size: 20
  - Undo/Redo buttons in header
- [ ] Add discard changes confirmation dialog

### Phase 7: Integration & Polish (Weeks 13-14)

**Week 13: Backend & Data Integration**

Day 85-86: Firebase Schema Updates

- [ ] Update `src/types/models.ts` User interface:
  ```typescript
  export interface User {
    // ... existing fields ...
    digitalAvatar?: DigitalAvatarConfig; // New field
    avatarConfig: AvatarConfig; // Keep for backwards compat
  }
  ```
- [ ] Update `firebase-backend/firestore.rules`:
  - Add `validDigitalAvatar()` helper function
  - Add validation in Users/{uid} update rule
  - Test rules with Firebase Emulator
- [ ] Update `firebase-backend/firestore.indexes.json` if needed

Day 87-88: Avatar Service Implementation

- [ ] Create `src/services/avatarService.ts`:
  - `saveDigitalAvatar(userId, config)` - Save to Firestore
  - `getDigitalAvatar(userId)` - Fetch from Firestore
  - `getDefaultAvatarConfig()` - Return default config
  - `convertLegacyConfig(legacy)` - Convert old config to new
- [ ] Update `src/services/index.ts` to export avatar service
- [ ] Add error handling and retry logic

Day 89-90: Migration Infrastructure

- [ ] Create `scripts/migrate-avatars.ts`:
  - Batch migration script for existing users
  - Reads all users with only `avatarConfig`
  - Converts to `digitalAvatar` using `convertLegacyConfig`
  - Writes back to Firestore
  - Dry-run mode for testing
  - Progress logging
- [ ] Create legacy config mapping:

  ```typescript
  // Map old baseColor (hex) to closest skin tone
  const COLOR_TO_SKIN_MAP: Record<string, SkinToneId> = {
    "#FF6B6B": "skin_06", // Default red-ish -> medium
    "#4ECDC4": "skin_05", // Teal -> light medium
    // ... map all existing colors
  };

  // Map old hat emojis to new headwear
  const HAT_EMOJI_MAP: Record<string, string> = {
    "🎩": "headwear_top_hat",
    "👒": "headwear_sun_hat",
    "🧢": "headwear_baseball_cap",
    // ... map all existing hats
  };
  ```

- [ ] Create `src/utils/avatarMigration.ts` with mapping utilities

Day 91: Integration with Existing Components

- [ ] Update `src/components/Avatar.tsx`:
  - Import DigitalAvatar
  - Add type check: if digital config, use DigitalAvatar
  - Otherwise use legacy rendering
  - Deprecation warning in **DEV** mode
- [ ] Update all Avatar usages to pass correct props:
  - Search for `<Avatar` in codebase
  - Ensure config prop supports both types

**Week 14: Performance & Accessibility**

Day 92-93: Performance Optimization

- [ ] Profile avatar rendering with React DevTools
- [ ] Implement memoization:
  - Memoize all AvatarParts components
  - Use useMemo for computed paths
  - Use useCallback for handlers
- [ ] Implement avatar caching:
  - Create `src/utils/avatarCache.ts`
  - Cache rendered avatar as image for static contexts
  - Invalidate cache on config change
  - Use in chat lists, friend lists
- [ ] Lazy load asset data:
  - Dynamic imports for large style catalogs
  - Preload common styles, lazy load others

Day 94-95: Animation Polish

- [ ] Refine idle animation timing
- [ ] Add customizer transition animations:
  - Category switch animation
  - Style selection animation
  - Preview update animation
- [ ] Add micro-interactions:
  - Haptics on selection
  - Sound effects (optional, respect settings)
- [ ] Test animation performance on low-end devices

Day 96-97: Accessibility Review

- [ ] Add screen reader labels to all interactive elements
- [ ] Ensure color pickers announce color names
- [ ] Add keyboard navigation support for web
- [ ] Test with VoiceOver (iOS) and TalkBack (Android)
- [ ] Add reduced motion support:
  - Check `prefers-reduced-motion` setting
  - Disable idle animations when enabled
  - Reduce customizer animations

Day 98: Documentation & Testing

- [ ] Write unit tests for:
  - Avatar validation functions
  - Config conversion functions
  - Individual AvatarParts components
- [ ] Write integration tests for:
  - Full avatar rendering
  - Customizer flow
  - Save/load functionality
- [ ] Add snapshot tests for visual regression
- [ ] Update `docs/01_ARCHITECTURE.md` with avatar system overview
- [ ] Add inline JSDoc comments to all public APIs

### Phase 8: Rollout (Weeks 15-16)

**Week 15: Feature Flag & Beta Testing**

Day 99-100: Feature Flag Implementation

- [ ] Add feature flag in `src/constants/featureFlags.ts`:
  ```typescript
  export const FEATURE_FLAGS = {
    // ... existing flags
    DIGITAL_AVATAR_ENABLED:
      __DEV__ || process.env.DIGITAL_AVATAR_BETA === "true",
    DIGITAL_AVATAR_CUSTOMIZER:
      __DEV__ || process.env.DIGITAL_AVATAR_BETA === "true",
  };
  ```
- [ ] Wrap DigitalAvatar usage with feature flag check:

  ```typescript
  import { FEATURE_FLAGS } from '@/constants/featureFlags';

  function AvatarWrapper({ config, ...props }) {
    if (FEATURE_FLAGS.DIGITAL_AVATAR_ENABLED && isDigitalAvatarConfig(config)) {
      return <DigitalAvatar config={config} {...props} />;
    }
    return <LegacyAvatar config={config} {...props} />;
  }
  ```

- [ ] Add remote config support via Firebase Remote Config (optional)

Day 101-102: Beta Testing Group Setup

- [ ] Create beta tester user list in Firebase
- [ ] Enable feature flag for beta users only
- [ ] Set up feedback collection:
  - In-app feedback form
  - Discord channel for beta feedback
- [ ] Create beta testing checklist:
  - Test all customization options
  - Test performance on various devices
  - Test edge cases (no avatar, corrupted config, etc.)

Day 103-105: Beta Testing & Bug Fixing

- [ ] Monitor error logs (Sentry/Firebase Crashlytics)
- [ ] Track performance metrics:
  - Avatar render time
  - Customizer load time
  - Memory usage
- [ ] Fix reported bugs
- [ ] Iterate on UI based on feedback
- [ ] Test on multiple device types:
  - iPhone (various sizes)
  - Android (various manufacturers)
  - Low-end devices

**Week 16: General Rollout**

Day 106-107: Gradual Rollout

- [ ] Enable for 10% of users (day 106)
- [ ] Monitor metrics and error rates
- [ ] Enable for 50% of users (day 107)
- [ ] Continue monitoring

Day 108-109: Full Rollout

- [ ] Enable for 100% of users
- [ ] Add "What's New" notification for new avatar system
- [ ] Create tutorial/onboarding for customizer:
  - First-time user sees quick intro
  - Highlight key features
  - Option to skip

Day 110-111: Legacy Deprecation

- [ ] Add deprecation notice to LegacyAvatar component
- [ ] Log usage of legacy config in analytics
- [ ] Plan legacy code removal (3-6 months post-launch)
- [ ] Run migration script for any remaining legacy users:
  ```powershell
  # Production migration (with caution)
  npx ts-node scripts/migrate-avatars.ts --production --batch-size=100
  ```

Day 112: Post-Launch Tasks

- [ ] Collect user feedback via in-app survey
- [ ] Analyze usage metrics:
  - Most popular customization options
  - Customizer completion rate
  - Time spent in customizer
- [ ] Create roadmap for future avatar features:
  - More styles and accessories
  - Seasonal/limited items
  - Animation poses
  - Avatar reactions in chat
- [ ] Final documentation updates
- [ ] Team retrospective

---

## 19. Integration Points with Existing Code

This section details exactly how the new avatar system integrates with the existing codebase.

### 19.1 Files to Modify

| File                                  | Modification                                                |
| ------------------------------------- | ----------------------------------------------------------- |
| `src/types/models.ts`                 | Add `digitalAvatar?: DigitalAvatarConfig` to User interface |
| `src/types/index.ts`                  | Re-export new avatar types                                  |
| `src/components/Avatar.tsx`           | Add DigitalAvatar conditional rendering                     |
| `src/components/AvatarCustomizer.tsx` | Redirect to new customizer or deprecate                     |
| `src/components/AvatarWithFrame.tsx`  | Support DigitalAvatarConfig input                           |
| `src/services/index.ts`               | Export avatarService                                        |
| `src/hooks/index.ts`                  | Export useAvatarCustomization hook                          |
| `firebase-backend/firestore.rules`    | Add digitalAvatar validation                                |
| `src/constants/featureFlags.ts`       | Add DIGITAL_AVATAR_ENABLED flag                             |

### 19.2 Files to Create

```
src/
├── types/
│   └── avatar.ts                    # New file: DigitalAvatarConfig types
│
├── components/
│   └── avatar/
│       ├── index.ts
│       ├── DigitalAvatar.tsx
│       ├── AvatarSvgRenderer.tsx
│       ├── AvatarParts/
│       │   ├── index.ts
│       │   ├── Body.tsx
│       │   ├── Head.tsx
│       │   ├── Eyes.tsx
│       │   ├── Nose.tsx
│       │   ├── Mouth.tsx
│       │   ├── Ears.tsx
│       │   ├── Hair.tsx
│       │   ├── FacialHair.tsx
│       │   ├── Clothing.tsx
│       │   ├── Headwear.tsx
│       │   ├── Eyewear.tsx
│       │   ├── Neckwear.tsx
│       │   ├── Earwear.tsx
│       │   └── Wristwear.tsx
│       ├── AvatarCustomizer/
│       │   ├── index.ts
│       │   ├── AvatarCustomizerModal.tsx
│       │   ├── CategoryTabs.tsx
│       │   ├── PreviewPanel.tsx
│       │   ├── SkinTonePicker.tsx
│       │   ├── FaceCustomizer.tsx
│       │   ├── EyesCustomizer.tsx
│       │   ├── HairCustomizer.tsx
│       │   ├── BodyCustomizer.tsx
│       │   ├── ClothingCustomizer.tsx
│       │   ├── AccessoriesCustomizer.tsx
│       │   ├── StylePicker.tsx
│       │   ├── ColorPicker.tsx
│       │   ├── FeatureSliders.tsx
│       │   └── PresetPicker.tsx
│       └── animations/
│           ├── IdleAnimation.tsx
│           └── BlinkAnimation.tsx
│
├── data/
│   └── avatarAssets/
│       ├── index.ts
│       ├── skinTones.ts
│       ├── faceShapes.ts
│       ├── eyeStyles.ts
│       ├── noseStyles.ts
│       ├── mouthStyles.ts
│       ├── earStyles.ts
│       ├── hairStyles.ts
│       ├── hairColors.ts
│       ├── facialHairStyles.ts
│       ├── bodyShapes.ts
│       ├── clothingItems.ts
│       ├── outfits.ts
│       ├── headwear.ts
│       ├── eyewear.ts
│       ├── neckwear.ts
│       ├── earwear.ts
│       └── wristwear.ts
│   └── avatarPresets.ts
│
├── services/
│   └── avatarService.ts
│
├── hooks/
│   └── useAvatarCustomization.ts
│
├── utils/
│   ├── avatarHelpers.ts              # Type guards, converters
│   ├── avatarColors.ts               # Color palette utilities
│   ├── avatarValidation.ts           # Config validation
│   ├── avatarMigration.ts            # Legacy migration utilities
│   └── avatarCache.ts                # Render caching
│
scripts/
└── migrate-avatars.ts                # Batch migration script
```

### 19.3 Existing System Integration

**Profile Screen (`src/screens/ProfileScreen.tsx`):**

- Replace Avatar component with conditional DigitalAvatar/Avatar
- Update "Edit Avatar" button to open new AvatarCustomizerModal
- Pass user.digitalAvatar || user.avatarConfig to component

**Chat/Messages:**

- Avatar displays in chat bubbles already use Avatar component
- Once Avatar.tsx updated, chat will automatically use new avatars
- Consider caching avatars in chat for performance

**Friends List:**

- Similar to chat, uses Avatar component
- Automatic update after Avatar.tsx modification

**Cosmetics System (`src/services/cosmetics.ts`):**

- Extend to handle digital avatar accessories
- Map new accessory IDs to inventory items
- Unlock flow remains the same

**Shop (`src/components/shop/`):**

- Add digital avatar items to shop
- Preview items on user's avatar
- Purchase flow unchanged

---

## 20. Type Definitions Reference

This section provides the complete type definitions for the digital avatar system. These should be placed in `src/types/avatar.ts`.

### 20.1 Complete DigitalAvatarConfig Type

```typescript
// src/types/avatar.ts

import type { AvatarConfig } from "./models";
import type { ExtendedCosmeticRarity, CosmeticUnlock } from "./profile";

// ============================================================
// ID TYPE UNIONS
// ============================================================

/** Available skin tone IDs */
export type SkinToneId =
  | "skin_01"
  | "skin_02"
  | "skin_03"
  | "skin_04"
  | "skin_05"
  | "skin_06"
  | "skin_07"
  | "skin_08"
  | "skin_09"
  | "skin_10"
  | "skin_11"
  | "skin_12";

/** Available face shape IDs */
export type FaceShapeId =
  | "oval"
  | "round"
  | "square"
  | "heart"
  | "oblong"
  | "diamond"
  | "triangle"
  | "rectangle";

/** Available eye style IDs */
export type EyeStyleId =
  | "eye_natural"
  | "eye_round"
  | "eye_almond"
  | "eye_hooded"
  | "eye_monolid"
  | "eye_upturned"
  | "eye_downturned"
  | "eye_wide_set"
  | "eye_close_set"
  | "eye_deep_set";

/** Available eye color IDs */
export type EyeColorId =
  | "brown_dark"
  | "brown_light"
  | "hazel_gold"
  | "hazel_green"
  | "green_forest"
  | "green_light"
  | "green_gray"
  | "blue_deep"
  | "blue_light"
  | "blue_gray"
  | "gray_dark"
  | "gray_light"
  | "amber";

/** Available eyebrow style IDs */
export type EyebrowStyleId =
  | "brow_natural"
  | "brow_thick"
  | "brow_thin"
  | "brow_arched_high"
  | "brow_arched_soft"
  | "brow_straight"
  | "brow_angled"
  | "brow_rounded"
  | "brow_bushy";

/** Available nose style IDs */
export type NoseStyleId =
  | "nose_small"
  | "nose_medium"
  | "nose_large"
  | "nose_button"
  | "nose_pointed"
  | "nose_wide"
  | "nose_narrow"
  | "nose_hooked"
  | "nose_upturned"
  | "nose_flat";

/** Available mouth style IDs */
export type MouthStyleId =
  | "mouth_smile"
  | "mouth_big_smile"
  | "mouth_slight_smile"
  | "mouth_neutral"
  | "mouth_smirk"
  | "mouth_open"
  | "mouth_laugh"
  | "mouth_pout"
  | "mouth_frown"
  | "mouth_kissy";

/** Available lip color IDs */
export type LipColorId =
  | "lip_natural_light"
  | "lip_natural_medium"
  | "lip_natural_dark"
  | "lip_pink_soft"
  | "lip_pink_bright"
  | "lip_rose"
  | "lip_red_classic"
  | "lip_red_dark"
  | "lip_berry"
  | "lip_nude";

/** Available ear style IDs */
export type EarStyleId =
  | "ear_small"
  | "ear_medium"
  | "ear_large"
  | "ear_pointed"
  | "ear_round"
  | "ear_attached"
  | "ear_detached"
  | "ear_elf";

/** Available body shape IDs */
export type BodyShapeId =
  | "body_slim"
  | "body_average"
  | "body_athletic"
  | "body_broad"
  | "body_curvy"
  | "body_stocky"
  | "body_tall"
  | "body_petite";

/** Available hair style IDs */
export type HairStyleId =
  // Short styles
  | "hair_short_classic"
  | "hair_short_textured"
  | "hair_short_fade"
  | "hair_short_buzz"
  | "hair_short_cropped"
  | "hair_short_spiky"
  | "hair_short_slicked"
  | "hair_short_mohawk"
  | "hair_short_quiff"
  | "hair_short_crew"
  // Medium styles
  | "hair_medium_wavy"
  | "hair_medium_straight"
  | "hair_medium_curly"
  | "hair_medium_bob"
  | "hair_medium_layered"
  | "hair_medium_shaggy"
  | "hair_medium_asymmetric"
  | "hair_medium_bangs"
  | "hair_medium_side_part"
  | "hair_medium_afro_short"
  // Long styles
  | "hair_long_straight"
  | "hair_long_wavy"
  | "hair_long_curly"
  | "hair_long_braided"
  | "hair_long_ponytail"
  | "hair_long_buns"
  | "hair_long_half_up"
  | "hair_long_side_swept"
  | "hair_long_pigtails"
  | "hair_long_dreads"
  | "hair_long_afro"
  | "hair_long_box_braids"
  | "hair_long_cornrows"
  | "hair_long_messy"
  | "hair_long_elegant"
  // Bald/Special
  | "hair_bald_full"
  | "hair_bald_pattern"
  | "hair_bald_top"
  | "hair_bald_shaved_sides"
  | "hair_special_undercut_long"
  | "hair_special_mullet"
  | "hair_special_pompadour"
  | "hair_special_fauxhawk"
  | "hair_special_liberty_spikes"
  | "hair_special_man_bun";

/** Available hair color IDs */
export type HairColorId =
  // Natural colors
  | "black"
  | "dark_brown"
  | "medium_brown"
  | "light_brown"
  | "auburn"
  | "chestnut"
  | "copper"
  | "strawberry_blonde"
  | "golden_blonde"
  | "platinum_blonde"
  | "dirty_blonde"
  | "gray_dark"
  | "gray_light"
  | "silver"
  | "white"
  // Fantasy colors
  | "fantasy_blue"
  | "fantasy_purple"
  | "fantasy_pink"
  | "fantasy_green"
  | "fantasy_red";

/** Available facial hair style IDs */
export type FacialHairStyleId =
  | "none"
  | "stubble"
  | "goatee"
  | "mustache"
  | "full_beard"
  | "short_beard"
  | "long_beard"
  | "soul_patch"
  | "mutton_chops"
  | "handlebar";

// ============================================================
// MAIN AVATAR CONFIG INTERFACE
// ============================================================

/**
 * Digital Avatar Configuration
 * Complete configuration for a Bitmoji-style avatar
 */
export interface DigitalAvatarConfig {
  /** Config version (always 2 for digital avatars) */
  version: 2;

  /** Timestamp when avatar was created */
  createdAt: number;

  /** Timestamp when avatar was last modified */
  updatedAt: number;

  /** Body configuration */
  body: {
    skinTone: SkinToneId;
    shape: BodyShapeId;
    /** Height scaling factor (0.8 - 1.2) */
    height: number;
  };

  /** Face shape configuration */
  face: {
    shape: FaceShapeId;
    /** Width scaling factor (0.8 - 1.2) */
    width: number;
  };

  /** Eyes configuration */
  eyes: {
    style: EyeStyleId;
    color: EyeColorId;
    /** Size scaling factor (0.8 - 1.2) */
    size: number;
    /** Spacing factor (0.8 - 1.2) */
    spacing: number;
    /** Tilt in degrees (-10 to 10) */
    tilt: number;

    eyebrows: {
      style: EyebrowStyleId;
      color: HairColorId;
      /** Thickness factor (0.8 - 1.2) */
      thickness: number;
    };

    eyelashes: {
      style: "none" | "natural" | "long" | "dramatic" | "wispy";
      color: string; // Hex color, defaults to #000000
    };
  };

  /** Nose configuration */
  nose: {
    style: NoseStyleId;
    /** Size scaling factor (0.8 - 1.2) */
    size: number;
  };

  /** Mouth configuration */
  mouth: {
    style: MouthStyleId;
    /** Size scaling factor (0.8 - 1.2) */
    size: number;
    lipColor: LipColorId;
    /** Lip thickness factor (0.8 - 1.2) */
    lipThickness: number;
  };

  /** Ears configuration */
  ears: {
    style: EarStyleId;
    /** Size scaling factor (0.8 - 1.2) */
    size: number;
    /** Whether ears are visible (may be hidden by hair) */
    visible: boolean;
  };

  /** Hair configuration */
  hair: {
    style: HairStyleId;
    color: HairColorId;
    /** Optional highlight color for streaks */
    highlightColor?: HairColorId;

    facialHair: {
      style: FacialHairStyleId;
      color: HairColorId;
    };
  };

  /** Clothing configuration */
  clothing: {
    /** Top item ID (shirt, jacket, etc.) - null for none */
    top: string | null;
    /** Bottom item ID (pants, skirt, etc.) - null for none */
    bottom: string | null;
    /** Full outfit ID - overrides top and bottom */
    outfit: string | null;
    /** Optional custom colors for colorizable clothing */
    customColors?: {
      topPrimary?: string;
      topSecondary?: string;
      bottomPrimary?: string;
    };
  };

  /** Accessories configuration */
  accessories: {
    headwear: string | null;
    eyewear: string | null;
    earwear: string | null;
    neckwear: string | null;
    wristwear: string | null;
  };

  /** Profile/frame configuration (optional) */
  profile?: {
    frame: string | null;
    banner: string | null;
    theme: string | null;
  };

  /** Legacy config reference (for migrated avatars) */
  legacy?: AvatarConfig;

  /** Migration metadata */
  migratedAt?: number;
  migratedFrom?: "legacy";

  /** Hint for clothing color from legacy baseColor */
  _legacyColor?: string;
}

// ============================================================
// TYPE GUARDS
// ============================================================

/**
 * Check if a config is a DigitalAvatarConfig
 */
export function isDigitalAvatarConfig(
  config: unknown,
): config is DigitalAvatarConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  return (
    c.version === 2 &&
    typeof c.body === "object" &&
    typeof c.face === "object" &&
    typeof c.eyes === "object" &&
    typeof c.hair === "object"
  );
}

/**
 * Check if a config is a legacy AvatarConfig
 */
export function isLegacyAvatarConfig(config: unknown): config is AvatarConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  return typeof c.baseColor === "string" && !("version" in c);
}

// ============================================================
// UNION TYPE FOR COMPATIBILITY
// ============================================================

/**
 * Union type for avatar configs during migration period
 */
export type AnyAvatarConfig = DigitalAvatarConfig | AvatarConfig;
```

### 20.2 Required Updates to Existing Types

**File: `src/types/models.ts`**

Add to User interface:

```typescript
export interface User {
  uid: string;
  usernameLower: string;
  username: string;
  displayName: string;
  avatarConfig: AvatarConfig;

  // ADD: Digital avatar config
  digitalAvatar?: DigitalAvatarConfig;

  expoPushToken?: string;
  createdAt: number;
  lastActive: number;
}
```

**File: `src/types/index.ts`**

Add re-export:

```typescript
// Add to existing exports
export * from "./avatar";
export type {
  DigitalAvatarConfig,
  SkinToneId,
  FaceShapeId,
  EyeStyleId,
  EyeColorId,
  HairStyleId,
  HairColorId,
  // ... other ID types
  isDigitalAvatarConfig,
  isLegacyAvatarConfig,
  AnyAvatarConfig,
} from "./avatar";
```

---

### 18.1 Package Requirements

```json
{
  "dependencies": {
    "react-native-svg": "^15.0.0"
  }
}
```

Note: The project already has `react-native-reanimated` which will be used for animations.

### 18.2 Performance Targets

| Metric               | Target      | Measurement            |
| -------------------- | ----------- | ---------------------- |
| Avatar render time   | < 16ms      | First contentful paint |
| Customizer load time | < 500ms     | Modal appearance       |
| Memory per avatar    | < 5MB       | Heap snapshot          |
| SVG complexity       | < 500 nodes | DOM count              |
| Animation FPS        | 60fps       | Animation tests        |

### 18.3 Accessibility Requirements

- All customization options must be keyboard navigable
- Color pickers must show color names, not just swatches
- Screen reader support for all interactive elements
- Sufficient color contrast for all UI elements
- Reduced motion support for animations

### 18.4 Testing Strategy

The testing strategy follows the existing patterns in `__tests__/` and uses Jest as configured in `jest.config.js`.

#### 18.4.1 Unit Tests

Create `__tests__/avatar/` directory for avatar-specific tests:

```typescript
// __tests__/avatar/avatarValidation.test.ts

import { validateAvatarConfig } from "@/utils/avatarValidation";
import { getDefaultAvatarConfig } from "@/utils/avatarHelpers";

describe("validateAvatarConfig", () => {
  it("validates a correct default config", () => {
    const config = getDefaultAvatarConfig();
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects config without version", () => {
    const config = { ...getDefaultAvatarConfig(), version: undefined };
    const result = validateAvatarConfig(config as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing version field");
  });

  it("rejects body height out of range", () => {
    const config = getDefaultAvatarConfig();
    config.body.height = 2.0; // Out of 0.8-1.2 range
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Body height out of range (0.8-1.2)");
  });

  it("rejects eye tilt out of range", () => {
    const config = getDefaultAvatarConfig();
    config.eyes.tilt = 20; // Out of -10 to 10 range
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Eye tilt out of range (-10 to 10)");
  });

  it("includes warnings for missing optional fields", () => {
    const config = getDefaultAvatarConfig();
    config.accessories.headwear = null;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("No headwear selected");
  });
});
```

```typescript
// __tests__/avatar/avatarHelpers.test.ts

import {
  isDigitalAvatarConfig,
  isLegacyAvatarConfig,
  convertLegacyConfig,
  getDefaultAvatarConfig,
} from "@/utils/avatarHelpers";
import type { AvatarConfig } from "@/types/models";

describe("isDigitalAvatarConfig", () => {
  it("returns true for valid digital avatar config", () => {
    const config = getDefaultAvatarConfig();
    expect(isDigitalAvatarConfig(config)).toBe(true);
  });

  it("returns false for legacy config", () => {
    const legacy: AvatarConfig = { baseColor: "#FF6B6B" };
    expect(isDigitalAvatarConfig(legacy)).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isDigitalAvatarConfig(null)).toBe(false);
    expect(isDigitalAvatarConfig(undefined)).toBe(false);
  });
});

describe("convertLegacyConfig", () => {
  it("converts basic legacy config to digital", () => {
    const legacy: AvatarConfig = { baseColor: "#FF6B6B" };
    const digital = convertLegacyConfig(legacy);

    expect(digital.version).toBe(2);
    expect(digital.body.skinTone).toBeDefined();
    expect(digital.face.shape).toBe("oval");
  });

  it("maps legacy hat to headwear", () => {
    const legacy: AvatarConfig = { baseColor: "#FF6B6B", hat: "🎩" };
    const digital = convertLegacyConfig(legacy);

    expect(digital.accessories.headwear).toBe("headwear_top_hat");
  });

  it("maps legacy glasses to eyewear", () => {
    const legacy: AvatarConfig = { baseColor: "#FF6B6B", glasses: "🕶️" };
    const digital = convertLegacyConfig(legacy);

    expect(digital.accessories.eyewear).toBeDefined();
  });

  it("preserves legacy config in output", () => {
    const legacy: AvatarConfig = { baseColor: "#FF6B6B" };
    const digital = convertLegacyConfig(legacy);

    expect(digital.legacy).toEqual(legacy);
  });
});
```

#### 18.4.2 Component Tests

```typescript
// __tests__/avatar/components/DigitalAvatar.test.tsx

import React from 'react';
import { render } from '@testing-library/react-native';
import { DigitalAvatar } from '@/components/avatar';
import { getDefaultAvatarConfig } from '@/utils/avatarHelpers';

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    Svg: View,
    G: View,
    Path: View,
    Circle: View,
    Ellipse: View,
    Rect: View,
    Defs: View,
    LinearGradient: View,
    RadialGradient: View,
    Stop: View,
    ClipPath: View,
  };
});

describe('DigitalAvatar', () => {
  it('renders without crashing', () => {
    const config = getDefaultAvatarConfig();
    const { getByTestId } = render(
      <DigitalAvatar config={config} size={100} testID="avatar" />
    );
    expect(getByTestId('avatar')).toBeTruthy();
  });

  it('renders at specified size', () => {
    const config = getDefaultAvatarConfig();
    const { getByTestId } = render(
      <DigitalAvatar config={config} size={150} testID="avatar" />
    );
    const avatar = getByTestId('avatar');
    expect(avatar.props.style).toMatchObject({ width: 150, height: 150 });
  });

  it('handles legacy config via conversion', () => {
    const legacyConfig = { baseColor: '#FF6B6B' };
    // Should not throw
    expect(() =>
      render(<DigitalAvatar config={legacyConfig as any} size={100} />)
    ).not.toThrow();
  });

  it('accepts showBody prop', () => {
    const config = getDefaultAvatarConfig();
    const { getByTestId } = render(
      <DigitalAvatar config={config} size={100} showBody testID="avatar" />
    );
    expect(getByTestId('avatar')).toBeTruthy();
  });
});
```

#### 18.4.3 Integration Tests

```typescript
// __tests__/avatar/integration/avatarService.test.ts

import {
  saveDigitalAvatar,
  getDigitalAvatar,
  batchMigrateAvatars,
} from "@/services/avatarService";
import { getDefaultAvatarConfig } from "@/utils/avatarHelpers";

// These tests require Firebase Emulator to be running
// Run with: firebase emulators:start --only firestore

describe("avatarService integration", () => {
  const testUserId = "test-user-avatar-service";

  beforeEach(async () => {
    // Clean up test data
    // ... setup code
  });

  describe("saveDigitalAvatar", () => {
    it("saves valid config successfully", async () => {
      const config = getDefaultAvatarConfig();
      const result = await saveDigitalAvatar(testUserId, config);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects invalid config", async () => {
      const invalidConfig = { version: 1 } as any;
      const result = await saveDigitalAvatar(testUserId, invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("adds updatedAt timestamp", async () => {
      const config = getDefaultAvatarConfig();
      const before = Date.now();
      await saveDigitalAvatar(testUserId, config);

      const saved = await getDigitalAvatar(testUserId);
      expect(saved?.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe("getDigitalAvatar", () => {
    it("returns saved digital avatar", async () => {
      const config = getDefaultAvatarConfig();
      config.body.skinTone = "skin_01";
      await saveDigitalAvatar(testUserId, config);

      const retrieved = await getDigitalAvatar(testUserId);
      expect(retrieved?.body.skinTone).toBe("skin_01");
    });

    it("converts legacy config if no digital avatar", async () => {
      // Setup user with only legacy config
      // ... setup code

      const retrieved = await getDigitalAvatar(testUserId);
      expect(retrieved?.version).toBe(2);
    });

    it("returns default config for new users", async () => {
      const retrieved = await getDigitalAvatar("non-existent-user");
      expect(retrieved).toBeNull(); // or default, depending on implementation
    });
  });
});
```

#### 18.4.4 Snapshot Tests

```typescript
// __tests__/avatar/snapshots/avatarSnapshots.test.tsx

import React from 'react';
import { render } from '@testing-library/react-native';
import { DigitalAvatar } from '@/components/avatar';
import { getDefaultAvatarConfig } from '@/utils/avatarHelpers';
import { SKIN_TONES } from '@/data/avatarAssets/skinTones';

describe('Avatar Snapshots', () => {
  it('matches snapshot for default avatar', () => {
    const config = getDefaultAvatarConfig();
    const { toJSON } = render(<DigitalAvatar config={config} size={100} />);
    expect(toJSON()).toMatchSnapshot();
  });

  // Generate tests for each skin tone
  SKIN_TONES.forEach((skinTone) => {
    it(`matches snapshot for skin tone: ${skinTone.id}`, () => {
      const config = getDefaultAvatarConfig();
      config.body.skinTone = skinTone.id;
      const { toJSON } = render(<DigitalAvatar config={config} size={100} />);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  it('matches snapshot with all accessories', () => {
    const config = getDefaultAvatarConfig();
    config.accessories = {
      headwear: 'headwear_baseball_cap',
      eyewear: 'eyewear_round_thin',
      earwear: 'earwear_studs_simple',
      neckwear: 'neckwear_chain_gold',
      wristwear: null,
    };
    const { toJSON } = render(<DigitalAvatar config={config} size={100} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot for full body', () => {
    const config = getDefaultAvatarConfig();
    const { toJSON } = render(
      <DigitalAvatar config={config} size={200} showBody />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
```

#### 18.4.5 E2E Tests

Add E2E tests to `e2e/` directory:

```typescript
// e2e/avatar/avatarCustomization.e2e.ts

import { device, element, by, expect } from "detox";

describe("Avatar Customization", () => {
  beforeAll(async () => {
    await device.launchApp();
    // Login flow...
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it("should open avatar customizer from profile", async () => {
    await element(by.id("tab-profile")).tap();
    await element(by.id("edit-avatar-button")).tap();
    await expect(element(by.id("avatar-customizer-modal"))).toBeVisible();
  });

  it("should change skin tone", async () => {
    await element(by.id("tab-profile")).tap();
    await element(by.id("edit-avatar-button")).tap();
    await element(by.id("category-tab-face")).tap();
    await element(by.id("skin-tone-skin_01")).tap();
    // Verify preview updated
    await expect(element(by.id("avatar-preview"))).toBeVisible();
  });

  it("should save avatar changes", async () => {
    await element(by.id("tab-profile")).tap();
    await element(by.id("edit-avatar-button")).tap();
    await element(by.id("category-tab-hair")).tap();
    await element(by.id("hair-style-short_textured")).tap();
    await element(by.id("save-avatar-button")).tap();
    // Modal should close
    await expect(element(by.id("avatar-customizer-modal"))).not.toBeVisible();
    // Success toast should appear
    await expect(element(by.text("Avatar saved!"))).toBeVisible();
  });

  it("should discard changes on cancel", async () => {
    await element(by.id("tab-profile")).tap();
    await element(by.id("edit-avatar-button")).tap();
    await element(by.id("category-tab-hair")).tap();
    await element(by.id("hair-style-short_textured")).tap();
    await element(by.id("cancel-button")).tap();
    // Should show discard confirmation
    await element(by.text("Discard")).tap();
    await expect(element(by.id("avatar-customizer-modal"))).not.toBeVisible();
  });
});
```

### 18.5 Error Handling

```typescript
// Graceful degradation for missing assets
function SafeAvatarPart({ id, fallback, ...props }) {
  const asset = useAsset(id);

  if (!asset) {
    console.warn(`Avatar asset not found: ${id}, using fallback`);
    return <FallbackPart {...props} />;
  }

  return <AvatarPart asset={asset} {...props} />;
}

// Error boundary for avatar rendering
class AvatarErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <FallbackAvatar />;
    }
    return this.props.children;
  }
}
```

---

## Appendix A: Asset Inventory

### A.1 Required SVG Assets

| Category         | Count    | Priority |
| ---------------- | -------- | -------- |
| Face Shapes      | 8        | P0       |
| Eye Styles       | 10       | P0       |
| Nose Styles      | 10       | P0       |
| Mouth Styles     | 10       | P0       |
| Ear Styles       | 8        | P1       |
| Hair Styles      | 50       | P0       |
| Facial Hair      | 10       | P1       |
| Clothing Tops    | 30       | P1       |
| Clothing Bottoms | 20       | P1       |
| Full Outfits     | 15       | P2       |
| Headwear         | 30       | P1       |
| Eyewear          | 20       | P1       |
| Neckwear         | 15       | P2       |
| Earwear          | 10       | P2       |
| Wristwear        | 10       | P2       |
| **Total**        | **~246** |          |

### A.2 Color Palettes

| Category        | Colors         | Notes                |
| --------------- | -------------- | -------------------- |
| Skin Tones      | 12             | Diverse range        |
| Hair Colors     | 15 + 5 fantasy | Natural + fun        |
| Eye Colors      | 12             | Natural range        |
| Lip Colors      | 10             | Natural + cosmetic   |
| Clothing Colors | 20             | Per colorizable item |

---

## Appendix B: Glossary

| Term        | Definition                                         |
| ----------- | -------------------------------------------------- |
| SVG         | Scalable Vector Graphics - XML-based image format  |
| ViewBox     | SVG coordinate system definition                   |
| Path        | SVG element for complex shapes using path commands |
| Gradient    | Smooth color transition (linear or radial)         |
| ClipPath    | SVG element to mask/crop other elements            |
| Z-Index     | Layer ordering (higher = on top)                   |
| Memoization | Caching technique to avoid re-computation          |

---

## Appendix C: References

### C.1 Inspiration Sources

- Snapchat Bitmoji
- Apple Memoji
- Xbox Avatars
- Nintendo Miis
- Roblox Avatars

### C.2 Technical References

- [react-native-svg Documentation](https://github.com/react-native-svg/react-native-svg)
- [SVG Path Commands](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths)
- [Reanimated Documentation](https://docs.swmansion.com/react-native-reanimated/)

---

_Document created by AI Assistant for SnapStyle MVP Development Team_
_This document is optimized for AI assistant comprehension and implementation guidance_
