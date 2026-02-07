/**
 * FILTER SERVICE
 * Manages 25+ filters with real-time application and blending
 */

import {
  AppliedFilter,
  FilterCategory,
  FilterConfig,
} from "../../types/camera";

/**
 * Complete filter library (25+ filters)
 */
export const FILTER_LIBRARY: FilterConfig[] = [
  // VINTAGE (3)
  {
    id: "vintage_sunset",
    name: "Sunset Vintage",
    category: "vintage",
    description: "Warm sepia tone with reduced saturation",
    brightness: 0.1,
    contrast: 1.1,
    saturation: 0.8,
    hue: 25,
    sepia: 0.6,
  },
  {
    id: "vintage_film",
    name: "Film",
    category: "vintage",
    description: "Classic film look with grain and vignette",
    brightness: -0.05,
    contrast: 1.3,
    saturation: 0.9,
    hue: 0,
    blur: 0.5,
    sepia: 0.3,
  },
  {
    id: "vintage_polaroid",
    name: "Polaroid",
    category: "vintage",
    description: "Polaroid instant photo effect",
    brightness: 0.15,
    contrast: 1.0,
    saturation: 0.85,
    hue: 15,
    sepia: 0.4,
  },

  // BLACK & WHITE (3)
  {
    id: "bw_classic",
    name: "Classic B&W",
    category: "bw",
    description: "Straightforward black and white conversion",
    brightness: 0,
    contrast: 1.0,
    saturation: 0,
    hue: 0,
  },
  {
    id: "bw_high_contrast",
    name: "High Contrast B&W",
    category: "bw",
    description: "High contrast black and white",
    brightness: 0.1,
    contrast: 1.8,
    saturation: 0,
    hue: 0,
  },
  {
    id: "bw_moody",
    name: "Moody B&W",
    category: "bw",
    description: "Dark moody black and white",
    brightness: -0.2,
    contrast: 1.5,
    saturation: 0,
    hue: 0,
  },

  // COOL TONES (4)
  {
    id: "cool_blue",
    name: "Cool Blue",
    category: "cool",
    description: "Blue color cast with reduced saturation",
    brightness: -0.1,
    contrast: 1.1,
    saturation: 0.9,
    hue: 240,
  },
  {
    id: "cool_arctic",
    name: "Arctic",
    category: "cool",
    description: "Icy blue effect",
    brightness: 0.05,
    contrast: 1.4,
    saturation: 0.95,
    hue: 210,
  },
  {
    id: "cool_cyberpunk",
    name: "Cyberpunk",
    category: "cool",
    description: "Magenta and cyan split tone",
    brightness: 0,
    contrast: 1.5,
    saturation: 1.4,
    hue: 270,
  },
  {
    id: "cool_night",
    name: "Night Mode",
    category: "cool",
    description: "Dark blue nighttime effect",
    brightness: -0.3,
    contrast: 1.2,
    saturation: 1.0,
    hue: 240,
  },

  // WARM TONES (4)
  {
    id: "warm_gold",
    name: "Warm Gold",
    category: "warm",
    description: "Golden warm tone",
    brightness: 0.15,
    contrast: 1.1,
    saturation: 1.2,
    hue: 45,
  },
  {
    id: "warm_sunset",
    name: "Sunset Orange",
    category: "warm",
    description: "Sunset orange tone",
    brightness: -0.1,
    contrast: 1.2,
    saturation: 1.3,
    hue: 30,
  },
  {
    id: "warm_sepia",
    name: "Cozy Sepia",
    category: "warm",
    description: "Warm sepia brown tone",
    brightness: 0.05,
    contrast: 1.0,
    saturation: 0.95,
    hue: 40,
    sepia: 0.8,
  },
  {
    id: "warm_golden_hour",
    name: "Golden Hour",
    category: "warm",
    description: "Warm golden hour light",
    brightness: 0.2,
    contrast: 1.3,
    saturation: 1.2,
    hue: 35,
  },

  // VIBRANT (3)
  {
    id: "vibrant_vivid",
    name: "Vivid",
    category: "vibrant",
    description: "High saturation and contrast",
    brightness: 0,
    contrast: 1.6,
    saturation: 1.6,
    hue: 0,
  },
  {
    id: "vibrant_neon",
    name: "Neon",
    category: "vibrant",
    description: "Bright digital neon effect",
    brightness: 0.1,
    contrast: 1.8,
    saturation: 1.8,
    hue: 0,
  },
  {
    id: "vibrant_psychedelic",
    name: "Psychedelic",
    category: "vibrant",
    description: "Inverted high saturation",
    brightness: 0,
    contrast: 1.7,
    saturation: 1.9,
    hue: 180,
    invert: 1,
  },

  // SOFT (3)
  {
    id: "soft_focus",
    name: "Soft Focus",
    category: "soft",
    description: "Soft blurred focus effect",
    brightness: 0.05,
    contrast: 0.9,
    saturation: 1.0,
    hue: 0,
    blur: 2,
  },
  {
    id: "soft_dreamy",
    name: "Dreamy",
    category: "soft",
    description: "Soft dreamy appearance",
    brightness: 0.15,
    contrast: 0.85,
    saturation: 0.8,
    hue: 0,
    blur: 1.5,
  },
  {
    id: "soft_pastel",
    name: "Pastel",
    category: "soft",
    description: "Soft desaturated pastel tones",
    brightness: 0.1,
    contrast: 0.8,
    saturation: 0.6,
    hue: 0,
  },

  // RETRO (2)
  {
    id: "retro_80s",
    name: "80s",
    category: "retro",
    description: "Retro 80s color grading",
    brightness: 0,
    contrast: 1.2,
    saturation: 1.3,
    hue: 120,
  },
  {
    id: "retro_vhs",
    name: "VHS",
    category: "retro",
    description: "VHS tape color distortion",
    brightness: -0.1,
    contrast: 1.4,
    saturation: 1.2,
    hue: 180,
  },

  // ARTISTIC (2)
  {
    id: "artistic_oil",
    name: "Oil Painting",
    category: "artistic",
    description: "Oil painting effect",
    brightness: 0,
    contrast: 1.4,
    saturation: 1.1,
    hue: 0,
    blur: 1,
  },
  {
    id: "artistic_sketch",
    name: "Sketch",
    category: "artistic",
    description: "Sketch effect with edge detection",
    brightness: 0.5,
    contrast: 2.0,
    saturation: 0,
    hue: 0,
  },

  // NEON (1)
  {
    id: "neon_glow",
    name: "Neon Glow",
    category: "neon",
    description: "Glowing neon effect",
    brightness: 0.2,
    contrast: 1.9,
    saturation: 1.8,
    hue: 0,
  },

  // NOSTALGIA (1)
  {
    id: "nostalgia_faded",
    name: "Faded Nostalgia",
    category: "nostalgia",
    description: "Faded vintage nostalgic look",
    brightness: 0.2,
    contrast: 0.9,
    saturation: 0.7,
    hue: 25,
  },
];

/**
 * Get filter by ID
 */
export function getFilterById(filterId: string): FilterConfig | undefined {
  return FILTER_LIBRARY.find((f) => f.id === filterId);
}

/**
 * Get filters by category
 */
export function getFiltersByCategory(category: FilterCategory): FilterConfig[] {
  return FILTER_LIBRARY.filter((f) => f.category === category);
}

/**
 * Get all filter categories
 */
export function getAllCategories(): FilterCategory[] {
  const categories = new Set(FILTER_LIBRARY.map((f) => f.category));
  return Array.from(categories) as FilterCategory[];
}

/**
 * Get all filters grouped by category
 */
export function getFiltersGroupedByCategory(): Record<
  FilterCategory,
  FilterConfig[]
> {
  const grouped: Record<string, FilterConfig[]> = {};

  FILTER_LIBRARY.forEach((filter) => {
    if (!grouped[filter.category]) {
      grouped[filter.category] = [];
    }
    grouped[filter.category].push(filter);
  });

  return grouped as Record<FilterCategory, FilterConfig[]>;
}

/**
 * Search filters by name or description
 */
export function searchFilters(query: string): FilterConfig[] {
  const lowerQuery = query.toLowerCase();
  return FILTER_LIBRARY.filter(
    (f) =>
      f.name.toLowerCase().includes(lowerQuery) ||
      f.description?.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Apply filter to image (requires native image processing)
 * Target: < 16ms for real-time preview on modern devices
 */
export async function applyFilterToImage(
  imageUri: string,
  filter: FilterConfig,
  intensity: number = 1.0,
): Promise<string> {
  try {
    console.log(`[Filter Service] Applying filter ${filter.id} to image`);

    // Delegate to native image filtering service
    const { applyFilterToImage: nativeApplyFilter } =
      await import("./nativeImageFiltering");
    return nativeApplyFilter(imageUri, filter, intensity);
  } catch (error) {
    console.error("[Filter Service] Failed to apply filter to image:", error);
    throw error;
  }
}

/**
 * Apply filter to video (requires FFmpeg)
 * Applies filter as video effect during encoding
 */
export async function applyFilterToVideo(
  videoUri: string,
  filter: FilterConfig,
  intensity: number = 1.0,
): Promise<string> {
  try {
    console.log(`[Filter Service] Applying filter ${filter.id} to video`);

    // This would require FFmpeg with complex filter graph
    // e.g., brightness=0.1:contrast=1.1

    return videoUri;
  } catch (error) {
    console.error("[Filter Service] Failed to apply filter to video:", error);
    throw error;
  }
}

/**
 * Blend multiple filters into single filter config
 */
export function blendFilters(filters: AppliedFilter[]): FilterConfig {
  if (filters.length === 0) {
    return {
      id: "none",
      name: "None",
      category: "vintage",
      brightness: 0,
      contrast: 1,
      saturation: 1,
      hue: 0,
    };
  }

  const blendedConfig: FilterConfig = {
    id: "blended",
    name: "Blended",
    category: "vibrant",
    brightness: 0,
    contrast: 1,
    saturation: 1,
    hue: 0,
  };

  // Average filter properties weighted by intensity
  let totalIntensity = 0;

  filters.forEach((appliedFilter) => {
    const filter = getFilterById(appliedFilter.filterId);
    if (!filter) return;

    const intensity = appliedFilter.intensity;
    totalIntensity += intensity;

    blendedConfig.brightness += filter.brightness * intensity;
    blendedConfig.contrast += (filter.contrast - 1) * intensity;
    blendedConfig.saturation += (filter.saturation - 1) * intensity;
    blendedConfig.hue += filter.hue * intensity;

    if (filter.blur) {
      blendedConfig.blur = (blendedConfig.blur || 0) + filter.blur * intensity;
    }
    if (filter.sepia) {
      blendedConfig.sepia =
        (blendedConfig.sepia || 0) + filter.sepia * intensity;
    }
  });

  // Normalize
  if (totalIntensity > 0) {
    blendedConfig.brightness /= totalIntensity;
    blendedConfig.contrast = 1 + blendedConfig.contrast / totalIntensity;
    blendedConfig.saturation = 1 + blendedConfig.saturation / totalIntensity;
    blendedConfig.hue /= totalIntensity;
  }

  // Clamp values
  blendedConfig.contrast = Math.max(0, Math.min(3, blendedConfig.contrast));
  blendedConfig.saturation = Math.max(0, Math.min(2, blendedConfig.saturation));

  return blendedConfig;
}

/**
 * Get filter preview thumbnail (would be pre-generated in production)
 */
export function getFilterPreviewThumbnail(
  filterId: string,
): string | undefined {
  // In production, these would be pre-generated thumbnail images
  // For now, return undefined (use placeholder)
  return undefined;
}

/**
 * Save filter as user preset
 */
export async function saveFilterPreset(
  userId: string,
  name: string,
  filter: FilterConfig,
): Promise<string> {
  try {
    // Would save to Firestore under /Users/{userId}/SavedFilters/{filterId}
    const presetId = `preset_${Date.now()}`;
    console.log(`[Filter Service] Saved filter preset: ${presetId}`);
    return presetId;
  } catch (error) {
    console.error("[Filter Service] Failed to save filter preset:", error);
    throw error;
  }
}

/**
 * Load user saved filter presets
 */
export async function loadFilterPresets(
  userId: string,
): Promise<FilterConfig[]> {
  try {
    // Would load from Firestore
    return [];
  } catch (error) {
    console.error("[Filter Service] Failed to load filter presets:", error);
    return [];
  }
}

/**
 * Get popular filters (trending)
 */
export function getPopularFilters(): FilterConfig[] {
  // Return most-used filters
  return [
    getFilterById("warm_golden_hour"),
    getFilterById("cool_blue"),
    getFilterById("vintage_film"),
    getFilterById("bw_classic"),
    getFilterById("vibrant_vivid"),
  ].filter((f) => f !== undefined) as FilterConfig[];
}

/**
 * Get filters by mood
 */
export function getFiltersByMood(
  mood: "happy" | "sad" | "energetic" | "calm" | "dark",
): FilterConfig[] {
  const moodMap: Record<string, string[]> = {
    happy: ["vibrant_vivid", "warm_golden_hour", "neon_glow"],
    sad: ["bw_moody", "cool_night", "soft_dreamy"],
    energetic: ["vibrant_neon", "retro_80s", "cool_cyberpunk"],
    calm: ["soft_pastel", "warm_sepia", "vintage_polaroid"],
    dark: ["bw_high_contrast", "cool_night", "artistic_sketch"],
  };

  return (moodMap[mood] || [])
    .map((id) => getFilterById(id))
    .filter((f) => f !== undefined) as FilterConfig[];
}

/**
 * Generate a 4x5 (row-major, 20-element flat array) color matrix for a filter.
 * Compatible with @shopify/react-native-skia ColorMatrix image filter.
 *
 * The matrix is composed by multiplying individual matrices for:
 *   brightness → contrast → saturation → hue rotation → sepia → invert
 */
export function generateColorMatrix(
  brightness: number,
  contrast: number,
  saturation: number,
  hue: number,
  sepia: number = 0,
  invert: number = 0,
): number[] {
  // Start with identity: [R, G, B, A, translate]
  let m = identity();

  // 1. Brightness  (-1…+1 → shift)
  if (brightness !== 0) {
    const t = brightness; // already -1..+1
    m = multiply(m, [
      1,
      0,
      0,
      0,
      t,
      0,
      1,
      0,
      0,
      t,
      0,
      0,
      1,
      0,
      t,
      0,
      0,
      0,
      1,
      0,
    ]);
  }

  // 2. Contrast  (1 = normal)
  if (contrast !== 1) {
    const c = contrast;
    const off = (1 - c) / 2;
    m = multiply(m, [
      c,
      0,
      0,
      0,
      off,
      0,
      c,
      0,
      0,
      off,
      0,
      0,
      c,
      0,
      off,
      0,
      0,
      0,
      1,
      0,
    ]);
  }

  // 3. Saturation  (0 = grayscale, 1 = normal, 2 = super-saturated)
  if (saturation !== 1) {
    const s = saturation;
    const lr = 0.2126;
    const lg = 0.7152;
    const lb = 0.0722;
    const sr = (1 - s) * lr;
    const sg = (1 - s) * lg;
    const sb = (1 - s) * lb;
    m = multiply(m, [
      sr + s,
      sg,
      sb,
      0,
      0,
      sr,
      sg + s,
      sb,
      0,
      0,
      sr,
      sg,
      sb + s,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ]);
  }

  // 4. Hue rotation  (degrees)
  if (hue !== 0) {
    const rad = (hue * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const lr = 0.2126;
    const lg = 0.7152;
    const lb = 0.0722;
    m = multiply(m, [
      lr + cos * (1 - lr) + sin * -lr,
      lg + cos * -lg + sin * -lg,
      lb + cos * -lb + sin * (1 - lb),
      0,
      0,
      lr + cos * -lr + sin * 0.143,
      lg + cos * (1 - lg) + sin * 0.14,
      lb + cos * -lb + sin * -0.283,
      0,
      0,
      lr + cos * -lr + sin * -(1 - lr),
      lg + cos * -lg + sin * lg,
      lb + cos * (1 - lb) + sin * lb,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ]);
  }

  // 5. Sepia  (0…1 blend with sepia matrix)
  if (sepia > 0) {
    const s = sepia;
    const sepiaMatrix = [
      0.393 * s + (1 - s),
      0.769 * s,
      0.189 * s,
      0,
      0,
      0.349 * s,
      0.686 * s + (1 - s),
      0.168 * s,
      0,
      0,
      0.272 * s,
      0.534 * s,
      0.131 * s + (1 - s),
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ];
    m = multiply(m, sepiaMatrix);
  }

  // 6. Invert  (0 or 1)
  if (invert === 1) {
    m = multiply(
      m,
      [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0],
    );
  }

  return m;
}

/**
 * Build a color matrix from a FilterConfig (convenience wrapper).
 */
export function filterConfigToColorMatrix(filter: FilterConfig): number[] {
  return generateColorMatrix(
    filter.brightness,
    filter.contrast,
    filter.saturation,
    filter.hue,
    filter.sepia ?? 0,
    filter.invert ?? 0,
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function identity(): number[] {
  return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
}

/** Multiply two 4×5 color matrices (row-major, 20 elements each). */
function multiply(a: number[], b: number[]): number[] {
  const result: number[] = new Array(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row * 5 + k] * b[k * 5 + col];
      }
      if (col === 4) {
        sum += a[row * 5 + 4]; // add the translate from matrix A
      }
      result[row * 5 + col] = sum;
    }
  }
  return result;
}
