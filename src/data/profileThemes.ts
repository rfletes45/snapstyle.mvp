/**
 * Profile Theme Definitions
 *
 * Static data for all profile themes that can be equipped.
 * Themes customize the profile screen appearance including colors,
 * backgrounds, patterns, and header styles.
 *
 * @see src/types/profile.ts for ProfileTheme interface
 */

import type {
  ExtendedCosmeticRarity,
  GradientConfig,
  ProfileTheme,
} from "@/types/profile";

// =============================================================================
// Helper Types
// =============================================================================

type ThemeColors = ProfileTheme["colors"];
type BackgroundPattern = ProfileTheme["backgroundPattern"];
type HeaderStyle = ProfileTheme["headerStyle"];

// =============================================================================
// Profile Theme Definitions
// =============================================================================

export const PROFILE_THEMES: ProfileTheme[] = [
  // -------------------------
  // FREE/STARTER THEMES
  // -------------------------
  {
    id: "default",
    name: "Default",
    description: "The classic SnapStyle look",
    previewImagePath: "themes/default_preview.png",
    rarity: "common",
    colors: {
      background: "#FFFFFF",
      surface: "#F5F5F5",
      surfaceVariant: "#EEEEEE",
      primary: "#6200EE",
      secondary: "#03DAC6",
      text: "#212121",
      textSecondary: "#757575",
    },
    unlock: { type: "free" },
    sortOrder: 0,
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    description: "Warm, soft pastels for a cozy light experience",
    previewImagePath: "themes/catppuccin_latte_preview.png",
    rarity: "common",
    colors: {
      background: "#eff1f5",
      surface: "#e6e9ef",
      surfaceVariant: "#dce0e8",
      primary: "#8839ef",
      secondary: "#fe640b",
      text: "#4c4f69",
      textSecondary: "#6c6f85",
    },
    unlock: { type: "free" },
    sortOrder: 1,
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    description: "Rich, deep tones for comfortable night viewing",
    previewImagePath: "themes/catppuccin_mocha_preview.png",
    rarity: "common",
    colors: {
      background: "#1e1e2e",
      surface: "#313244",
      surfaceVariant: "#45475a",
      primary: "#cba6f7",
      secondary: "#fab387",
      text: "#cdd6f4",
      textSecondary: "#bac2de",
    },
    unlock: { type: "free" },
    sortOrder: 2,
  },
  {
    id: "dark_mode",
    name: "Dark Mode",
    description: "Easy on the eyes",
    previewImagePath: "themes/dark_preview.png",
    rarity: "common",
    colors: {
      background: "#121212",
      surface: "#1E1E1E",
      surfaceVariant: "#2C2C2C",
      primary: "#BB86FC",
      secondary: "#03DAC6",
      text: "#FFFFFF",
      textSecondary: "#B0B0B0",
    },
    unlock: { type: "free" },
    sortOrder: 3,
  },
  {
    id: "midnight_blue",
    name: "Midnight Blue",
    description: "A calm, professional dark theme",
    previewImagePath: "themes/midnight_blue_preview.png",
    rarity: "common",
    colors: {
      background: "#0D1B2A",
      surface: "#1B263B",
      surfaceVariant: "#415A77",
      primary: "#778DA9",
      secondary: "#E0E1DD",
      text: "#E0E1DD",
      textSecondary: "#778DA9",
    },
    unlock: { type: "starter" },
    sortOrder: 4,
  },

  // -------------------------
  // RARE THEMES (Purchase/Milestone)
  // -------------------------
  {
    id: "sunset_gradient",
    name: "Sunset",
    description: "Warm sunset colors that glow",
    previewImagePath: "themes/sunset_preview.png",
    rarity: "rare",
    colors: {
      background: {
        type: "linear",
        colors: ["#FF6B6B", "#FFA07A", "#FFD93D"],
        angle: 135,
      } as GradientConfig,
      surface: "#FFF5F0",
      surfaceVariant: "#FFE5DC",
      primary: "#FF6B6B",
      secondary: "#FFD93D",
      text: "#4A2C2A",
      textSecondary: "#7A5C5A",
    },
    headerStyle: {
      type: "gradient",
      value: {
        type: "linear",
        colors: ["#FF6B6B", "#FFD93D"],
        angle: 90,
      },
    },
    unlock: { type: "purchase", priceTokens: 500 },
    sortOrder: 10,
  },
  {
    id: "ocean_breeze",
    name: "Ocean Breeze",
    description: "Cool blues inspired by the sea",
    previewImagePath: "themes/ocean_preview.png",
    rarity: "rare",
    colors: {
      background: {
        type: "linear",
        colors: ["#0077B6", "#00B4D8", "#90E0EF"],
        angle: 180,
      } as GradientConfig,
      surface: "#CAF0F8",
      surfaceVariant: "#ADE8F4",
      primary: "#0077B6",
      secondary: "#00B4D8",
      text: "#03045E",
      textSecondary: "#0077B6",
    },
    backgroundPattern: {
      type: "lines",
      color: "#FFFFFF",
      opacity: 0.1,
    },
    unlock: { type: "purchase", priceTokens: 500 },
    sortOrder: 11,
  },
  {
    id: "forest_green",
    name: "Forest",
    description: "Natural greens from the forest",
    previewImagePath: "themes/forest_preview.png",
    rarity: "rare",
    colors: {
      background: "#1A3C40",
      surface: "#2C5F2D",
      surfaceVariant: "#3E7B3E",
      primary: "#97BC62",
      secondary: "#C2E4B8",
      text: "#E8F5E8",
      textSecondary: "#97BC62",
    },
    backgroundPattern: {
      type: "dots",
      color: "#97BC62",
      opacity: 0.1,
    },
    unlock: { type: "milestone", milestoneType: "level", milestoneValue: 10 },
    sortOrder: 12,
  },
  {
    id: "cherry_blossom",
    name: "Cherry Blossom",
    description: "Delicate pink petals in spring",
    previewImagePath: "themes/cherry_preview.png",
    rarity: "rare",
    colors: {
      background: "#FFF0F5",
      surface: "#FFE4EC",
      surfaceVariant: "#FFD1DC",
      primary: "#FF69B4",
      secondary: "#FFB6C1",
      text: "#4A1A2C",
      textSecondary: "#8B4567",
    },
    backgroundPattern: {
      type: "custom",
      color: "#FF69B4",
      opacity: 0.15,
      customPath: "patterns/petals.svg",
    },
    unlock: { type: "purchase", priceTokens: 600 },
    sortOrder: 13,
  },

  // -------------------------
  // EPIC THEMES
  // -------------------------
  {
    id: "aurora_borealis",
    name: "Aurora Borealis",
    description: "Northern lights dance across your profile",
    previewImagePath: "themes/aurora_preview.png",
    rarity: "epic",
    colors: {
      background: {
        type: "linear",
        colors: ["#0B0C10", "#1A1A2E", "#16213E", "#0F3460"],
        angle: 180,
      } as GradientConfig,
      surface: "#1A1A2E",
      surfaceVariant: "#16213E",
      primary: "#00FF88",
      secondary: "#00D9FF",
      text: "#E8E8E8",
      textSecondary: "#00FF88",
    },
    headerStyle: {
      type: "gradient",
      value: {
        type: "linear",
        colors: ["#00FF88", "#00D9FF", "#9B59B6"],
        angle: 45,
      },
    },
    unlock: { type: "purchase", priceTokens: 1000 },
    sortOrder: 20,
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    description: "Neon lights in the digital city",
    previewImagePath: "themes/cyberpunk_preview.png",
    rarity: "epic",
    colors: {
      background: "#0D0D0D",
      surface: "#1A1A2E",
      surfaceVariant: "#2D2D44",
      primary: "#FF0080",
      secondary: "#00FFFF",
      text: "#FFFFFF",
      textSecondary: "#00FFFF",
    },
    backgroundPattern: {
      type: "grid",
      color: "#FF0080",
      opacity: 0.1,
    },
    headerStyle: {
      type: "gradient",
      value: {
        type: "linear",
        colors: ["#FF0080", "#00FFFF"],
        angle: 90,
      },
    },
    unlock: { type: "purchase", priceTokens: 1200 },
    sortOrder: 21,
  },
  {
    id: "galaxy",
    name: "Galaxy",
    description: "Stars and nebulae from deep space",
    previewImagePath: "themes/galaxy_preview.png",
    rarity: "epic",
    colors: {
      background: {
        type: "radial",
        colors: ["#1A0533", "#0D001A", "#000000"],
        centerX: 0.3,
        centerY: 0.2,
      } as GradientConfig,
      surface: "#1A0533",
      surfaceVariant: "#2D1B4E",
      primary: "#9B59B6",
      secondary: "#E74C3C",
      text: "#FFFFFF",
      textSecondary: "#BB8FCE",
    },
    backgroundImage: "themes/galaxy_bg.png",
    backgroundBlur: 2,
    unlock: {
      type: "achievement",
      achievementId: "games_100",
    },
    sortOrder: 22,
  },
  {
    id: "royal_purple",
    name: "Royal",
    description: "Fit for royalty",
    previewImagePath: "themes/royal_preview.png",
    rarity: "epic",
    colors: {
      background: "#1A0A2E",
      surface: "#2D1B4E",
      surfaceVariant: "#4A3563",
      primary: "#FFD700",
      secondary: "#9B59B6",
      text: "#FFFFFF",
      textSecondary: "#FFD700",
    },
    headerStyle: {
      type: "gradient",
      value: {
        type: "linear",
        colors: ["#4A0080", "#9B59B6", "#FFD700"],
        angle: 135,
      },
    },
    unlock: { type: "milestone", milestoneType: "level", milestoneValue: 25 },
    sortOrder: 23,
  },

  // -------------------------
  // LEGENDARY THEMES
  // -------------------------
  {
    id: "golden_hour",
    name: "Golden Hour",
    description: "Luxurious gold accents on velvet black",
    previewImagePath: "themes/golden_preview.png",
    rarity: "legendary",
    colors: {
      background: "#0A0A0A",
      surface: "#1A1A1A",
      surfaceVariant: "#2A2A2A",
      primary: "#FFD700",
      secondary: "#FFA500",
      text: "#FFFFFF",
      textSecondary: "#FFD700",
    },
    backgroundPattern: {
      type: "custom",
      color: "#FFD700",
      opacity: 0.05,
      customPath: "patterns/luxury.svg",
    },
    headerStyle: {
      type: "gradient",
      value: {
        type: "linear",
        colors: ["#FFD700", "#FFA500", "#FF8C00"],
        angle: 45,
      },
    },
    unlock: { type: "purchase", priceTokens: 2500 },
    sortOrder: 30,
  },
  {
    id: "fire_and_ice",
    name: "Fire & Ice",
    description: "The eternal battle of elements",
    previewImagePath: "themes/fire_ice_preview.png",
    rarity: "legendary",
    colors: {
      background: {
        type: "linear",
        colors: ["#1A0A0A", "#0A0A1A"],
        angle: 135,
      } as GradientConfig,
      surface: "#1A1A2E",
      surfaceVariant: "#2D2D44",
      primary: "#FF4500",
      secondary: "#00CED1",
      text: "#FFFFFF",
      textSecondary: "#B0B0B0",
    },
    headerStyle: {
      type: "gradient",
      value: {
        type: "linear",
        colors: ["#FF4500", "#FF6347", "#00CED1", "#40E0D0"],
        angle: 90,
      },
    },
    unlock: {
      type: "achievement",
      achievementId: "streak_100",
    },
    sortOrder: 31,
  },
  {
    id: "holographic",
    name: "Holographic",
    description: "Iridescent shifting colors",
    previewImagePath: "themes/holo_preview.png",
    rarity: "legendary",
    colors: {
      background: {
        type: "linear",
        colors: ["#FF6B6B", "#FFE66D", "#4ECDC4", "#95E1D3", "#FF6B6B"],
        angle: 45,
      } as GradientConfig,
      surface: "rgba(255, 255, 255, 0.9)",
      surfaceVariant: "rgba(255, 255, 255, 0.7)",
      primary: "#FF6B6B",
      secondary: "#4ECDC4",
      text: "#1A1A2E",
      textSecondary: "#4A4A6A",
    },
    unlock: { type: "milestone", milestoneType: "level", milestoneValue: 50 },
    sortOrder: 32,
  },

  // -------------------------
  // MYTHIC THEMES
  // -------------------------
  {
    id: "cosmic_void",
    name: "Cosmic Void",
    description: "Peer into the infinite darkness between stars",
    previewImagePath: "themes/cosmic_void_preview.png",
    rarity: "mythic",
    colors: {
      background: "#000000",
      surface: "#0A0A14",
      surfaceVariant: "#141428",
      primary: "#8B00FF",
      secondary: "#FF00FF",
      text: "#FFFFFF",
      textSecondary: "#8B00FF",
    },
    backgroundImage: "themes/cosmic_void_bg.png",
    headerStyle: {
      type: "gradient",
      value: {
        type: "radial",
        colors: ["#8B00FF", "#4B0082", "#000000"],
        centerX: 0.5,
        centerY: 0,
      },
    },
    unlock: {
      type: "exclusive",
      source: "beta_tester",
    },
    sortOrder: 40,
  },
  {
    id: "diamond_elite",
    name: "Diamond Elite",
    description: "The pinnacle of achievement",
    previewImagePath: "themes/diamond_preview.png",
    rarity: "mythic",
    colors: {
      background: {
        type: "linear",
        colors: ["#E0E8F0", "#B9F2FF", "#87CEEB"],
        angle: 135,
      } as GradientConfig,
      surface: "#FFFFFF",
      surfaceVariant: "#F0F8FF",
      primary: "#00BFFF",
      secondary: "#B9F2FF",
      text: "#1A1A2E",
      textSecondary: "#4682B4",
    },
    backgroundPattern: {
      type: "custom",
      color: "#B9F2FF",
      opacity: 0.3,
      customPath: "patterns/diamonds.svg",
    },
    headerStyle: {
      type: "gradient",
      value: {
        type: "linear",
        colors: ["#B9F2FF", "#00BFFF", "#4169E1", "#00BFFF", "#B9F2FF"],
        angle: 90,
      },
    },
    unlock: { type: "milestone", milestoneType: "level", milestoneValue: 100 },
    sortOrder: 41,
  },
  {
    id: "champion",
    name: "Champion",
    description: "Reserved for true champions",
    previewImagePath: "themes/champion_preview.png",
    rarity: "mythic",
    colors: {
      background: "#0A0A0A",
      surface: "#1A1A1A",
      surfaceVariant: "#2A2A2A",
      primary: "#FFD700",
      secondary: "#FF4500",
      text: "#FFFFFF",
      textSecondary: "#FFD700",
    },
    backgroundImage: "themes/champion_bg.png",
    headerStyle: {
      type: "gradient",
      value: {
        type: "linear",
        colors: ["#FFD700", "#FF8C00", "#FF4500"],
        angle: 45,
      },
    },
    unlock: {
      type: "achievement",
      achievementId: "streak_365",
    },
    sortOrder: 42,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get theme by ID
 */
export function getThemeById(themeId: string): ProfileTheme | undefined {
  return PROFILE_THEMES.find((t) => t.id === themeId);
}

/**
 * Get all available themes (sorted by sortOrder)
 */
export function getAllThemes(): ProfileTheme[] {
  return [...PROFILE_THEMES].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

/**
 * Get themes by rarity
 */
export function getThemesByRarity(
  rarity: ExtendedCosmeticRarity,
): ProfileTheme[] {
  return PROFILE_THEMES.filter((t) => t.rarity === rarity);
}

/**
 * Get free/starter themes
 */
export function getFreeThemes(): ProfileTheme[] {
  return PROFILE_THEMES.filter(
    (t) => t.unlock.type === "free" || t.unlock.type === "starter",
  );
}

/**
 * Get purchasable themes
 */
export function getPurchasableThemes(): ProfileTheme[] {
  return PROFILE_THEMES.filter((t) => t.unlock.type === "purchase");
}

/**
 * Get achievement-unlocked themes
 */
export function getAchievementThemes(): ProfileTheme[] {
  return PROFILE_THEMES.filter((t) => t.unlock.type === "achievement");
}

/**
 * Get milestone-unlocked themes
 */
export function getMilestoneThemes(): ProfileTheme[] {
  return PROFILE_THEMES.filter((t) => t.unlock.type === "milestone");
}

/**
 * Check if a color value is a gradient
 */
export function isGradient(
  color: string | GradientConfig,
): color is GradientConfig {
  return typeof color === "object" && "type" in color && "colors" in color;
}

/**
 * Get the primary color from a color value (gradient or solid)
 */
export function getPrimaryColorFromValue(
  color: string | GradientConfig,
): string {
  if (isGradient(color)) {
    return color.colors[0];
  }
  return color;
}

/**
 * Get total theme count
 */
export function getTotalThemeCount(): number {
  return PROFILE_THEMES.length;
}

/**
 * Get theme count by rarity
 */
export function getThemeCountByRarity(): Record<
  ExtendedCosmeticRarity,
  number
> {
  const counts: Record<ExtendedCosmeticRarity, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
  };

  PROFILE_THEMES.forEach((theme) => {
    counts[theme.rarity]++;
  });

  return counts;
}
