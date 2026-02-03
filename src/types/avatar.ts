/**
 * Digital Avatar Type Definitions
 *
 * Complete type definitions for the Bitmoji-style digital avatar system.
 * This system replaces the simple colored-circle avatars with fully
 * customizable character representations.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

import type { AvatarConfig } from "./models";

// Re-export AvatarConfig as LegacyAvatarConfig for clarity
export type { AvatarConfig } from "./models";
export type LegacyAvatarConfig = AvatarConfig;

// =============================================================================
// SKIN TONE IDS
// =============================================================================

/** Available skin tone IDs - 12 diverse skin tones */
export type SkinToneId =
  | "skin_01" // Porcelain
  | "skin_02" // Fair
  | "skin_03" // Light
  | "skin_04" // Light Medium
  | "skin_05" // Medium Light
  | "skin_06" // Medium
  | "skin_07" // Medium Tan
  | "skin_08" // Olive
  | "skin_09" // Tan
  | "skin_10" // Caramel
  | "skin_11" // Brown
  | "skin_12"; // Deep

// =============================================================================
// FACE SHAPE IDS
// =============================================================================

/** Available face shape IDs */
export type FaceShapeId =
  | "oval" // Classic oval, balanced proportions
  | "round" // Circular, soft features
  | "square" // Strong jawline, angular
  | "heart" // Wide forehead, pointed chin
  | "oblong" // Long and narrow
  | "diamond" // Wide cheekbones, narrow forehead and jaw
  | "triangle" // Narrow forehead, wide jaw
  | "rectangle"; // Longer face, squared jaw

// =============================================================================
// EYE IDS
// =============================================================================

/** Available eye style IDs */
export type EyeStyleId =
  | "eye_natural" // Default natural eye
  | "eye_round" // Large, round eyes
  | "eye_almond" // Almond-shaped, slightly angled
  | "eye_hooded" // Partially covered by lid
  | "eye_monolid" // Single eyelid, no crease
  | "eye_upturned" // Outer corners point up
  | "eye_downturned" // Outer corners point down
  | "eye_wide_set" // Extra wide apart
  | "eye_close_set" // Closer together
  | "eye_deep_set"; // Set deeper in socket

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
  | "brow_natural" // Soft, natural shape
  | "brow_thick" // Bold, bushy
  | "brow_thin" // Delicate, thin
  | "brow_arched_high" // High arch
  | "brow_arched_soft" // Soft curved arch
  | "brow_straight" // Horizontal, minimal arch
  | "brow_angled" // Sharp angle at peak
  | "brow_rounded" // Soft rounded
  | "brow_bushy"; // Very thick and natural

/** Available eyelash style IDs */
export type EyelashStyleId = "none" | "natural" | "long" | "dramatic" | "wispy";

// =============================================================================
// NOSE IDS
// =============================================================================

/** Available nose style IDs */
export type NoseStyleId =
  | "nose_small" // Small, understated
  | "nose_medium" // Standard size
  | "nose_large" // Larger, prominent
  | "nose_button" // Round, cute button nose
  | "nose_pointed" // Sharp, defined tip
  | "nose_wide" // Wider nostrils and tip
  | "nose_narrow" // Thin, elongated
  | "nose_hooked" // Prominent bridge curve
  | "nose_upturned" // Upturned tip (snub)
  | "nose_flat"; // Flatter bridge

// =============================================================================
// MOUTH IDS
// =============================================================================

/** Available mouth style IDs */
export type MouthStyleId =
  | "mouth_smile" // Friendly smile
  | "mouth_big_smile" // Big, toothy grin
  | "mouth_slight_smile" // Subtle smile
  | "mouth_neutral" // Neutral, relaxed
  | "mouth_smirk" // Asymmetric smirk
  | "mouth_open" // Slightly open
  | "mouth_laugh" // Laughing expression
  | "mouth_pout" // Pouty lips
  | "mouth_frown" // Slight frown
  | "mouth_kissy"; // Puckered lips

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

// =============================================================================
// EAR IDS
// =============================================================================

/** Available ear style IDs */
export type EarStyleId =
  | "ear_small" // Small, close to head
  | "ear_medium" // Average size
  | "ear_large" // Larger, more prominent
  | "ear_pointed" // Slightly pointed
  | "ear_round" // Rounded shape
  | "ear_attached" // Attached earlobes
  | "ear_detached" // Detached earlobes
  | "ear_elf"; // Fantasy pointed ears

// =============================================================================
// BODY IDS
// =============================================================================

/** Available body shape IDs */
export type BodyShapeId =
  | "body_slim" // Narrow, lean build
  | "body_average" // Standard proportions
  | "body_athletic" // Muscular, V-taper
  | "body_broad" // Wide shoulders and frame
  | "body_curvy" // Wider hips, defined waist
  | "body_stocky" // Shorter, wider build
  | "body_tall" // Elongated proportions
  | "body_petite"; // Smaller frame overall

// =============================================================================
// HAIR IDS
// =============================================================================

/** Available hair style IDs */
export type HairStyleId =
  // Short styles
  | "hair_short_classic" // Traditional short cut
  | "hair_short_textured" // Messy/textured short
  | "hair_short_fade" // Fade/undercut
  | "hair_short_buzz" // Buzz cut
  | "hair_short_cropped" // Close cropped
  | "hair_short_spiky" // Spiky short
  | "hair_short_slicked" // Slicked back
  | "hair_short_mohawk" // Mohawk style
  | "hair_short_quiff" // Quiff style
  | "hair_short_crew" // Crew cut
  // Medium styles
  | "hair_medium_wavy" // Wavy medium length
  | "hair_medium_straight" // Straight medium
  | "hair_medium_curly" // Curly medium
  | "hair_medium_bob" // Bob cut
  | "hair_medium_layered" // Layered cut
  | "hair_medium_shaggy" // Shaggy style
  | "hair_medium_asymmetric" // Asymmetric cut
  | "hair_medium_bangs" // With bangs
  | "hair_medium_side_part" // Side parted
  | "hair_medium_afro_short" // Short afro
  // Long styles
  | "hair_long_straight" // Long straight
  | "hair_long_wavy" // Long wavy
  | "hair_long_curly" // Long curly
  | "hair_long_braided" // Braided
  | "hair_long_ponytail" // Ponytail
  | "hair_long_buns" // Bun style
  | "hair_long_half_up" // Half up style
  | "hair_long_side_swept" // Side swept
  | "hair_long_pigtails" // Pigtails
  | "hair_long_dreads" // Dreadlocks
  | "hair_long_afro" // Full afro
  | "hair_long_box_braids" // Box braids
  | "hair_long_cornrows" // Cornrows
  | "hair_long_messy" // Messy long
  | "hair_long_elegant" // Elegant updo
  // Bald/Special
  | "hair_bald_full" // Completely bald
  | "hair_bald_pattern" // Pattern baldness
  | "hair_bald_top" // Bald on top
  | "hair_bald_shaved_sides" // Shaved sides
  | "hair_bald_widows_peak" // Widow's peak baldness
  | "hair_special_undercut_long" // Undercut with long top
  | "hair_special_mullet" // Mullet
  | "hair_special_pompadour" // Pompadour
  | "hair_special_fauxhawk" // Fauxhawk
  | "hair_special_liberty_spikes" // Liberty spikes
  | "hair_special_man_bun" // Man bun
  | "hair_special_space_buns" // Space buns
  | "hair_special_viking" // Viking style
  | "hair_special_twin_tails" // Twin tails
  | "hair_special_mohawk_long"; // Long mohawk

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
  | "none" // No facial hair
  | "stubble" // 5 o'clock shadow
  | "goatee" // Goatee
  | "mustache" // Mustache only
  | "full_beard" // Full beard
  | "short_beard" // Short/trimmed beard
  | "long_beard" // Long beard
  | "soul_patch" // Soul patch
  | "mutton_chops" // Mutton chops
  | "handlebar"; // Handlebar mustache

// =============================================================================
// CLOTHING IDS (Generic string for flexibility)
// =============================================================================

/** Clothing top item ID - specific IDs defined in data files */
export type ClothingTopId = string;

/** Clothing bottom item ID - specific IDs defined in data files */
export type ClothingBottomId = string;

/** Full outfit item ID - specific IDs defined in data files */
export type ClothingOutfitId = string;

/** Clothing layer ID (jacket over shirt) */
export type ClothingLayerId = string;

// =============================================================================
// ACCESSORY IDS (Generic string for flexibility)
// =============================================================================

/** Headwear accessory ID */
export type HeadwearId = string;

/** Eyewear accessory ID */
export type EyewearId = string;

/** Earwear accessory ID */
export type EarwearId = string;

/** Neckwear accessory ID */
export type NeckwearId = string;

/** Wristwear accessory ID */
export type WristwearId = string;

// =============================================================================
// MAIN AVATAR CONFIG INTERFACE
// =============================================================================

/**
 * Digital Avatar Configuration
 *
 * Complete configuration for a Bitmoji-style digital avatar.
 * This replaces the simple AvatarConfig for sophisticated avatars.
 */
export interface DigitalAvatarConfig {
  /** Config version (always 2 for digital avatars) */
  version: 2;

  /** Timestamp when avatar was created */
  createdAt: number;

  /** Timestamp when avatar was last modified */
  updatedAt: number;

  // ═══════════════════════════════════════════════════════════════════════════
  // BODY CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Body configuration */
  body: {
    /** Skin tone ID (e.g., "skin_01" through "skin_12") */
    skinTone: SkinToneId;
    /** Body shape ID (e.g., "body_slim", "body_average") */
    shape: BodyShapeId;
    /** Height scaling factor (0.8 to 1.2) */
    height: number;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FACE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Face shape configuration */
  face: {
    /** Face shape ID (e.g., "oval", "round", "square") */
    shape: FaceShapeId;
    /** Width scaling factor (0.8 to 1.2) */
    width: number;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EYES CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Eyes configuration */
  eyes: {
    /** Eye style ID */
    style: EyeStyleId;
    /** Eye color ID */
    color: EyeColorId;
    /** Size scaling factor (0.8 to 1.2) */
    size: number;
    /** Spacing factor (0.8 to 1.2, closer to wider) */
    spacing: number;
    /** Tilt in degrees (-10 to 10) */
    tilt: number;

    /** Eyebrow configuration */
    eyebrows: {
      /** Eyebrow style ID */
      style: EyebrowStyleId;
      /** Eyebrow color (usually matches hair) */
      color: HairColorId;
      /** Thickness factor (0.8 to 1.2) */
      thickness: number;
    };

    /** Eyelash configuration */
    eyelashes: {
      /** Whether eyelashes are enabled */
      enabled: boolean;
      /** Eyelash style ID */
      style: EyelashStyleId;
      /** Eyelash color (hex, usually black) */
      color: string;
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NOSE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Nose configuration */
  nose: {
    /** Nose style ID */
    style: NoseStyleId;
    /** Size scaling factor (0.8 to 1.2) */
    size: number;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUTH CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Mouth configuration */
  mouth: {
    /** Mouth style ID */
    style: MouthStyleId;
    /** Size scaling factor (0.8 to 1.2) */
    size: number;
    /** Lip color ID */
    lipColor: LipColorId;
    /** Lip thickness factor (0.8 to 1.2) */
    lipThickness: number;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EARS CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Ears configuration */
  ears: {
    /** Ear style ID */
    style: EarStyleId;
    /** Size scaling factor (0.8 to 1.2) */
    size: number;
    /** Whether ears are visible (may be hidden by hair) */
    visible: boolean;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HAIR CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Hair configuration */
  hair: {
    /** Hair style ID */
    style: HairStyleId;
    /** Hair color ID */
    color: HairColorId;
    /** Optional highlight color for streaks */
    highlightColor?: HairColorId;

    /** Facial hair configuration */
    facialHair: {
      /** Facial hair style ID */
      style: FacialHairStyleId;
      /** Facial hair color (usually matches hair) */
      color: HairColorId;
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOTHING CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Clothing configuration */
  clothing: {
    /** Top item ID (shirt, jacket, etc.) - null for none */
    top: ClothingTopId | null;
    /** Bottom item ID (pants, skirt, etc.) - null for none */
    bottom: ClothingBottomId | null;
    /** Full outfit ID - overrides top and bottom when set */
    outfit: ClothingOutfitId | null;
    /** Optional layer over top (jacket/coat) */
    layer?: ClothingLayerId | null;
    /** Custom color for top */
    topColor?: string;
    /** Custom color for bottom */
    bottomColor?: string;
    /** Custom color for outfit */
    outfitColor?: string;
    /** Custom clothing colors (for colorizable items) - legacy */
    customColors?: {
      topPrimary?: string;
      topSecondary?: string;
      bottomPrimary?: string;
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSORIES CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Accessories configuration */
  accessories: {
    /** Headwear ID (hats, headbands, etc.) - null for none */
    headwear: HeadwearId | null;
    /** Custom headwear color (for colorizable items) */
    headwearColor?: string | null;
    /** Eyewear ID (glasses, sunglasses, etc.) - null for none */
    eyewear: EyewearId | null;
    /** Custom eyewear frame color (for colorizable items) */
    eyewearColor?: string | null;
    /** Earwear ID (earrings, earbuds, etc.) - null for none */
    earwear: EarwearId | null;
    /** Custom earwear color (for colorizable items) */
    earwearColor?: string | null;
    /** Neckwear ID (necklaces, scarves, etc.) - null for none */
    neckwear: NeckwearId | null;
    /** Custom neckwear color (for colorizable items) */
    neckwearColor?: string | null;
    /** Wristwear ID (watches, bracelets, etc.) - null for none */
    wristwear: WristwearId | null;
    /** Custom wristwear color (for colorizable items) */
    wristwearColor?: string | null;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE CUSTOMIZATION (Optional)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Profile/frame configuration */
  profile?: {
    /** Profile frame ID */
    frame: string | null;
    /** Profile banner ID */
    banner: string | null;
    /** Profile theme ID */
    theme: string | null;
    /** Chat bubble style ID */
    chatBubble?: string | null;
    /** Name effect ID */
    nameEffect?: string | null;
    /** Featured badge IDs (up to 5) */
    featuredBadges?: string[];
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY COMPATIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  /** Legacy config reference (for migrated avatars) */
  legacy?: AvatarConfig;

  /** Migration timestamp */
  migratedAt?: number;

  /** Migration source indicator */
  migratedFrom?: "legacy";

  /** Legacy color hint for clothing (from old baseColor) */
  _legacyColor?: string;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if a config is a DigitalAvatarConfig (version 2)
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

// =============================================================================
// UNION TYPE FOR COMPATIBILITY
// =============================================================================

/**
 * Union type for avatar configs during migration period
 * Supports both legacy simple configs and new digital avatar configs
 */
export type AnyAvatarConfig = DigitalAvatarConfig | AvatarConfig;

// =============================================================================
// ASSET DATA TYPES
// =============================================================================

/**
 * Skin tone data definition
 */
export interface SkinToneData {
  id: SkinToneId;
  name: string;
  baseColor: string;
  shadowColor: string;
  highlightColor: string;
  blushColor: string;
  undertone: "warm" | "neutral" | "cool";
}

/**
 * Face shape data definition
 */
export interface FaceShapeData {
  id: FaceShapeId;
  name: string;
  svgPath: string;
  chinOffset: number;
  jawWidth: number;
  cheekCurve: number;
}

/**
 * Eye style data definition
 */
export interface EyeStyleData {
  id: EyeStyleId;
  name: string;
  svgPath: string;
  scleraPath: string;
  pupilPosition: { x: number; y: number };
  irisSize: number;
  pupilSize: number;
}

/**
 * Eye color data definition
 */
export interface EyeColorData {
  id: EyeColorId;
  name: string;
  irisColors: {
    outer: string;
    middle: string;
    inner: string;
  };
  pupilColor: string;
  highlight: string;
}

/**
 * Eyebrow style data definition
 */
export interface EyebrowStyleData {
  id: EyebrowStyleId;
  name: string;
  svgPath: string;
  thickness: number;
  arch: number;
  tailLength: number;
}

/**
 * Eyelash style data definition
 */
export interface EyelashStyleData {
  id: EyelashStyleId;
  name: string;
  svgPath: string;
  density: number;
  length: number;
  curl: number;
}

/**
 * Nose style data definition
 */
export interface NoseStyleData {
  id: NoseStyleId;
  name: string;
  svgPath: string;
  bridgeWidth: number;
  tipWidth: number;
  nostrilSize: number;
  length: number;
}

/**
 * Mouth style data definition
 */
export interface MouthStyleData {
  id: MouthStyleId;
  name: string;
  upperLipPath: string;
  lowerLipPath: string;
  teethPath?: string;
  expression: "neutral" | "smile" | "smirk" | "frown" | "open";
}

/**
 * Lip color data definition
 */
export interface LipColorData {
  id: LipColorId;
  name: string;
  color: string;
  glossy: boolean;
}

/**
 * Ear style data definition
 */
export interface EarStyleData {
  id: EarStyleId;
  name: string;
  svgPath: string;
  lobeSize: number;
  angle: number;
}

/**
 * Hair color data definition
 */
export interface HairColorData {
  id: HairColorId;
  name: string;
  baseColor: string;
  shadowColor: string;
  highlightColor: string;
  isFantasy: boolean;
}

/**
 * Hair style data definition
 */
export interface HairStyleData {
  id: HairStyleId;
  name: string;
  category: "short" | "medium" | "long" | "bald" | "special";
  /** SVG paths for hair rendered behind head (ponytails, back of hair) */
  backPaths: string[];
  /** SVG paths for hair rendered over forehead/face edges */
  frontPaths: string[];
  /** Type of hairline */
  hairlineType: "standard" | "receding" | "widows_peak" | "rounded";
  /** Whether this style covers ears (hint for ear rendering) */
  coversEars: boolean;
  /** Whether this style works well with hats */
  hatCompatible: boolean;
  /** Optional paths for hair when wearing a hat */
  hatOverridePaths?: string[];
  /** Hair texture type for this style */
  textureType: "straight" | "wavy" | "curly" | "coily";
}

/**
 * Facial hair style data definition
 */
export interface FacialHairStyleData {
  id: FacialHairStyleId;
  name: string;
  /** Main facial hair SVG path */
  mainPath: string;
  /** Shadow/depth SVG path */
  shadowPath: string;
  /** Position anchor relative to chin (0,0 is chin center) */
  anchorOffset: { x: number; y: number };
  /** Whether this style includes mustache */
  hasMustache: boolean;
  /** Whether this style includes beard */
  hasBeard: boolean;
  /** Thickness factor for rendering (0.5 to 1.5) */
  thickness: number;
}

/**
 * Validation result for avatar config
 */
export interface AvatarValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
