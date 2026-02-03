/**
 * Hair Style Definitions
 *
 * 50 hair styles organized by category:
 * - Short: 10 styles
 * - Medium: 10 styles
 * - Long: 15 styles
 * - Bald/Special: 15 styles (5 bald + 10 special)
 *
 * Each style has back paths (behind head) and front paths (over face)
 * for proper layered rendering.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 3: Hair System
 */

import type { HairStyleData, HairStyleId } from "@/types/avatar";

/**
 * Complete hair style catalog
 * Organized by category: short, medium, long, bald, special
 */
export const HAIR_STYLES: HairStyleData[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SHORT STYLES (10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "hair_short_classic",
    name: "Classic Short",
    category: "short",
    backPaths: [
      "M45,30 Q50,15 100,12 Q150,15 155,30 Q160,55 155,75 L150,70 Q145,50 100,45 Q55,50 50,70 L45,75 Q40,55 45,30 Z",
    ],
    frontPaths: [
      "M50,45 Q60,35 100,32 Q140,35 150,45 Q155,55 150,60 Q140,52 100,48 Q60,52 50,60 Q45,55 50,45 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_short_textured",
    name: "Textured Short",
    category: "short",
    backPaths: [
      "M42,32 Q48,12 100,8 Q152,12 158,32 Q165,60 158,78 L152,72 Q148,48 100,42 Q52,48 48,72 L42,78 Q35,60 42,32 Z",
    ],
    frontPaths: [
      // Main front with textured spikes
      "M48,48 Q58,32 100,28 Q142,32 152,48 L150,42 L145,50 L140,44 L135,52 L130,46 Q115,38 100,38 Q85,38 70,46 L65,52 L60,44 L55,50 L50,42 L48,48 Z",
      // Additional texture details
      "M62,45 L58,38 M72,42 L70,35 M82,40 L80,33 M92,39 L91,32 M108,39 L109,32 M118,40 L120,33 M128,42 L130,35 M138,45 L142,38",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_short_fade",
    name: "Fade Cut",
    category: "short",
    backPaths: [
      // Main hair mass
      "M48,35 Q55,18 100,15 Q145,18 152,35 Q158,55 152,70 L148,68 Q144,52 100,48 Q56,52 52,68 L48,70 Q42,55 48,35 Z",
      // Fade gradient sides
      "M45,70 Q48,80 50,90 L52,85 Q52,75 50,68 L45,70 Z",
      "M155,70 Q152,80 150,90 L148,85 Q148,75 150,68 L155,70 Z",
    ],
    frontPaths: [
      "M52,50 Q62,38 100,35 Q138,38 148,50 Q152,58 148,62 Q138,54 100,50 Q62,54 52,62 Q48,58 52,50 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_short_buzz",
    name: "Buzz Cut",
    category: "short",
    backPaths: [
      "M50,42 Q55,28 100,25 Q145,28 150,42 Q155,60 150,72 L145,70 Q142,58 100,55 Q58,58 55,70 L50,72 Q45,60 50,42 Z",
    ],
    frontPaths: [
      "M55,52 Q65,42 100,40 Q135,42 145,52 Q148,58 145,62 Q135,56 100,54 Q65,56 55,62 Q52,58 55,52 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_short_cropped",
    name: "Cropped",
    category: "short",
    backPaths: [
      "M48,38 Q54,20 100,17 Q146,20 152,38 Q158,58 152,72 L148,70 Q145,55 100,50 Q55,55 52,70 L48,72 Q42,58 48,38 Z",
    ],
    frontPaths: [
      "M52,48 Q62,36 100,33 Q138,36 148,48 Q152,56 148,60 Q138,52 100,48 Q62,52 52,60 Q48,56 52,48 Z",
    ],
    hairlineType: "rounded",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_short_spiky",
    name: "Spiky",
    category: "short",
    backPaths: [
      "M45,40 Q52,20 100,15 Q148,20 155,40 Q160,60 155,75 L150,72 Q146,55 100,48 Q54,55 50,72 L45,75 Q40,60 45,40 Z",
    ],
    frontPaths: [
      // Main front with dramatic spikes
      "M50,52 Q58,35 100,30 Q142,35 150,52 L148,38 L142,48 L138,32 L132,46 L128,30 L122,44 L118,28 L112,42 L108,26 L100,40 L92,26 L88,42 L82,28 L78,44 L72,30 L68,46 L62,32 L58,48 L52,38 L50,52 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: false,
    textureType: "straight",
  },
  {
    id: "hair_short_slicked",
    name: "Slicked Back",
    category: "short",
    backPaths: [
      "M42,45 Q50,20 100,15 Q150,20 158,45 Q162,70 158,85 L152,82 Q150,65 100,58 Q50,65 48,82 L42,85 Q38,70 42,45 Z",
    ],
    frontPaths: [
      // Smooth swept back look
      "M48,55 Q58,40 100,35 Q142,40 152,55 Q155,62 152,68 Q142,60 100,55 Q58,60 48,68 Q45,62 48,55 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_short_mohawk",
    name: "Mohawk",
    category: "short",
    backPaths: [
      // Center strip back
      "M85,35 Q90,10 100,5 Q110,10 115,35 Q118,60 115,85 L108,82 Q106,60 100,55 Q94,60 92,82 L85,85 Q82,60 85,35 Z",
    ],
    frontPaths: [
      // Dramatic center mohawk
      "M88,45 Q92,20 100,12 Q108,20 112,45 L110,25 L105,40 L100,18 L95,40 L90,25 L88,45 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: false,
    textureType: "straight",
  },
  {
    id: "hair_short_quiff",
    name: "Quiff",
    category: "short",
    backPaths: [
      "M45,40 Q52,22 100,18 Q148,22 155,40 Q160,62 155,78 L150,75 Q146,58 100,52 Q54,58 50,75 L45,78 Q40,62 45,40 Z",
    ],
    frontPaths: [
      // Voluminous front quiff
      "M50,55 Q58,30 100,22 Q142,30 150,55 L148,45 L140,52 L135,38 L128,50 L120,35 L112,48 L100,28 L88,48 L80,35 L72,50 L65,38 L60,52 L52,45 L50,55 Z",
    ],
    hairlineType: "widows_peak",
    coversEars: false,
    hatCompatible: false,
    textureType: "straight",
  },
  {
    id: "hair_short_crew",
    name: "Crew Cut",
    category: "short",
    backPaths: [
      "M52,45 Q58,32 100,30 Q142,32 148,45 Q152,60 148,70 L145,68 Q142,58 100,55 Q58,58 55,68 L52,70 Q48,60 52,45 Z",
    ],
    frontPaths: [
      "M55,52 Q65,42 100,40 Q135,42 145,52 Q148,58 145,60 Q135,54 100,52 Q65,54 55,60 Q52,58 55,52 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIUM STYLES (10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "hair_medium_wavy",
    name: "Medium Wavy",
    category: "medium",
    backPaths: [
      "M35,35 Q42,10 100,5 Q158,10 165,35 Q172,75 165,120 Q155,135 140,130 Q125,140 100,138 Q75,140 60,130 Q45,135 35,120 Q28,75 35,35 Z",
    ],
    frontPaths: [
      // Wavy front with volume
      "M42,50 Q52,28 100,22 Q148,28 158,50 Q162,65 158,75 Q155,60 148,55 C140,48 130,50 120,55 C110,48 90,48 80,55 C70,50 60,48 52,55 Q45,60 42,75 Q38,65 42,50 Z",
      // Wave details
      "M55,65 Q62,55 75,58 Q88,52 100,58 Q112,52 125,58 Q138,55 145,65",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "wavy",
  },
  {
    id: "hair_medium_straight",
    name: "Medium Straight",
    category: "medium",
    backPaths: [
      "M38,35 Q45,12 100,8 Q155,12 162,35 Q168,72 162,115 Q152,130 130,125 Q115,132 100,130 Q85,132 70,125 Q48,130 38,115 Q32,72 38,35 Z",
    ],
    frontPaths: [
      // Straight bangs with side sweep
      "M45,52 Q55,32 100,28 Q145,32 155,52 Q158,65 155,72 Q148,58 135,55 L130,72 Q115,58 100,62 Q85,58 70,72 L65,55 Q52,58 45,72 Q42,65 45,52 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_medium_curly",
    name: "Medium Curly",
    category: "medium",
    backPaths: [
      "M30,40 Q38,8 100,2 Q162,8 170,40 Q178,85 170,130 Q158,148 135,142 Q118,155 100,152 Q82,155 65,142 Q42,148 30,130 Q22,85 30,40 Z",
    ],
    frontPaths: [
      // Voluminous curls
      "M38,55 Q48,25 100,18 Q152,25 162,55 Q168,72 162,85 L158,75 Q150,62 145,68 Q138,58 130,65 Q122,55 115,62 Q108,52 100,58 Q92,52 85,62 Q78,55 70,65 Q62,58 55,68 Q50,62 42,75 L38,85 Q32,72 38,55 Z",
      // Curl texture
      "M52,80 Q58,70 65,78 Q72,68 80,76 Q88,66 95,74 Q102,64 110,72 Q118,62 125,70 Q132,60 140,68 Q148,58 155,65",
    ],
    hairlineType: "rounded",
    coversEars: true,
    hatCompatible: true,
    textureType: "curly",
  },
  {
    id: "hair_medium_bob",
    name: "Bob Cut",
    category: "medium",
    backPaths: [
      "M40,38 Q48,15 100,10 Q152,15 160,38 Q166,70 160,105 Q152,115 140,112 Q120,120 100,118 Q80,120 60,112 Q48,115 40,105 Q34,70 40,38 Z",
    ],
    frontPaths: [
      // Classic bob with slight curve
      "M45,52 Q55,35 100,30 Q145,35 155,52 Q160,68 155,82 L150,78 Q148,65 140,62 L138,80 Q125,70 100,72 Q75,70 62,80 L60,62 Q52,65 50,78 L45,82 Q40,68 45,52 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_medium_layered",
    name: "Layered Medium",
    category: "medium",
    backPaths: [
      "M35,38 Q42,12 100,6 Q158,12 165,38 Q172,78 165,125 Q155,140 135,135 Q118,145 100,142 Q82,145 65,135 Q45,140 35,125 Q28,78 35,38 Z",
    ],
    frontPaths: [
      // Layered with movement
      "M42,55 Q52,32 100,25 Q148,32 158,55 L156,48 L150,58 L145,50 L138,60 L130,52 L122,62 L115,54 L108,64 L100,55 L92,64 L85,54 L78,62 L70,52 L62,60 L55,50 L50,58 L44,48 L42,55 Z",
      // Layer details
      "M55,72 L52,80 Q60,75 68,82 Q76,74 85,80 Q94,72 100,78 Q106,72 115,80 Q124,74 132,82 Q140,75 148,80 L145,72",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_medium_shaggy",
    name: "Shaggy",
    category: "medium",
    backPaths: [
      "M32,42 Q40,10 100,4 Q160,10 168,42 Q175,85 168,135 Q156,152 132,145 Q116,158 100,155 Q84,158 68,145 Q44,152 32,135 Q25,85 32,42 Z",
    ],
    frontPaths: [
      // Messy shaggy layers
      "M40,58 Q50,28 100,20 Q150,28 160,58 L155,42 L148,55 L142,38 L135,52 L128,35 L120,50 L112,32 L105,48 L100,28 L95,48 L88,32 L80,50 L72,35 L65,52 L58,38 L52,55 L45,42 L40,58 Z",
      // Additional shag texture
      "M48,75 L42,88 M58,70 L52,85 M68,68 L62,82 M78,65 L72,80 M88,63 L82,78 M98,62 L92,77 M108,63 L102,78 M118,65 L112,80 M128,68 L122,82 M138,70 L132,85 M148,75 L142,88",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "wavy",
  },
  {
    id: "hair_medium_asymmetric",
    name: "Asymmetric",
    category: "medium",
    backPaths: [
      "M40,38 Q48,15 100,10 Q152,15 165,38 Q172,75 165,125 Q155,145 130,138 Q115,148 100,145 Q85,142 70,132 Q52,125 42,105 Q35,70 40,38 Z",
    ],
    frontPaths: [
      // Asymmetric with longer side
      "M45,52 Q55,35 100,30 Q148,35 160,52 L158,42 L152,55 L148,45 L142,58 L138,48 L132,62 L128,52 L125,70 Q112,60 100,65 Q88,55 75,62 L72,55 Q62,60 55,70 L52,58 Q48,62 45,52 Z",
      // Long side sweep
      "M130,75 L135,95 L128,90 L132,110 L125,105 L130,125",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_medium_bangs",
    name: "With Bangs",
    category: "medium",
    backPaths: [
      "M38,35 Q45,12 100,8 Q155,12 162,35 Q168,72 162,115 Q152,130 130,125 Q115,135 100,132 Q85,135 70,125 Q48,130 38,115 Q32,72 38,35 Z",
    ],
    frontPaths: [
      // Full bangs across forehead
      "M45,52 Q55,32 100,28 Q145,32 155,52 Q158,60 155,68 L150,62 L148,72 L142,65 L140,75 L135,68 L132,78 L128,70 L125,80 L120,72 L115,82 L110,74 L105,84 L100,76 L95,84 L90,74 L85,82 L80,72 L75,80 L70,68 L65,75 L60,65 L55,72 L52,62 L50,68 Q45,60 45,52 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_medium_side_part",
    name: "Side Part",
    category: "medium",
    backPaths: [
      "M38,35 Q45,12 100,8 Q155,12 162,35 Q168,72 162,115 Q152,130 130,125 Q115,135 100,132 Q85,135 70,125 Q48,130 38,115 Q32,72 38,35 Z",
    ],
    frontPaths: [
      // Clean side part
      "M45,52 Q55,32 70,28 L68,55 L100,30 Q145,35 155,52 Q158,65 155,75 L150,70 Q148,60 140,58 L138,78 Q128,65 115,68 Q102,62 100,72 Q95,58 85,65 L82,78 Q72,65 62,70 L60,58 Q52,60 50,70 L45,75 Q42,65 45,52 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_medium_afro_short",
    name: "Short Afro",
    category: "medium",
    backPaths: [
      "M28,50 Q35,10 100,2 Q165,10 172,50 Q180,95 172,140 Q160,158 130,150 Q115,162 100,160 Q85,162 70,150 Q40,158 28,140 Q20,95 28,50 Z",
    ],
    frontPaths: [
      // Rounded afro texture
      "M35,60 Q45,25 100,18 Q155,25 165,60 Q170,78 165,90 Q160,75 155,80 Q148,70 142,78 Q135,68 128,76 Q120,65 112,74 Q105,62 100,70 Q95,62 88,74 Q80,65 72,76 Q65,68 58,78 Q52,70 45,80 Q40,75 35,90 Q30,78 35,60 Z",
    ],
    hairlineType: "rounded",
    coversEars: true,
    hatCompatible: false,
    textureType: "coily",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LONG STYLES (15)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "hair_long_straight",
    name: "Long Straight",
    category: "long",
    backPaths: [
      "M30,38 Q38,8 100,2 Q162,8 170,38 Q178,90 170,160 Q158,185 130,178 Q115,195 100,192 Q85,195 70,178 Q42,185 30,160 Q22,90 30,38 Z",
    ],
    frontPaths: [
      // Long flowing front
      "M38,55 Q48,30 100,24 Q152,30 162,55 Q168,75 162,95 L158,88 Q155,70 148,68 L145,110 Q135,90 125,95 L122,130 Q112,105 100,110 Q88,105 78,130 L75,95 Q65,90 55,110 L52,68 Q45,70 42,88 L38,95 Q32,75 38,55 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_long_wavy",
    name: "Long Wavy",
    category: "long",
    backPaths: [
      "M28,40 Q36,5 100,0 Q164,5 172,40 Q180,95 172,165 Q160,190 128,182 Q114,200 100,198 Q86,200 72,182 Q40,190 28,165 Q20,95 28,40 Z",
    ],
    frontPaths: [
      // Wavy long front
      "M36,58 Q46,28 100,20 Q154,28 164,58 Q170,80 164,102 L160,92 Q156,72 148,70 C142,75 138,68 132,78 C126,68 120,75 115,70 L112,115 C106,95 94,95 88,115 L85,70 C80,75 74,68 68,78 C62,68 58,75 52,70 Q44,72 40,92 L36,102 Q30,80 36,58 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "wavy",
  },
  {
    id: "hair_long_curly",
    name: "Long Curly",
    category: "long",
    backPaths: [
      "M25,45 Q34,5 100,-2 Q166,5 175,45 Q184,105 175,175 Q162,202 125,192 Q112,212 100,210 Q88,212 75,192 Q38,202 25,175 Q16,105 25,45 Z",
    ],
    frontPaths: [
      // Full curly volume
      "M32,62 Q42,25 100,15 Q158,25 168,62 Q175,88 168,115 L162,100 Q158,78 150,75 Q145,85 138,78 Q132,88 125,80 Q118,90 112,82 Q105,92 100,85 Q95,92 88,82 Q82,90 75,80 Q68,88 62,78 Q55,85 50,75 Q42,78 38,100 L32,115 Q25,88 32,62 Z",
      // Curl details
      "M45,125 Q52,115 58,125 Q65,112 72,122 Q80,108 88,118 Q95,105 102,115 Q110,102 118,112 Q125,100 132,110 Q140,98 148,108 Q155,95 160,105",
    ],
    hairlineType: "rounded",
    coversEars: true,
    hatCompatible: true,
    textureType: "curly",
  },
  {
    id: "hair_long_braided",
    name: "Single Braid",
    category: "long",
    backPaths: [
      // Main hair mass
      "M38,35 Q46,10 100,5 Q154,10 162,35 Q168,70 162,100 Q155,115 130,110 Q115,120 100,118 Q85,120 70,110 Q45,115 38,100 Q32,70 38,35 Z",
      // Braid going down back
      "M85,105 L90,120 L95,115 L100,130 L105,125 L110,140 L115,135 L110,150 L105,145 L100,160 L95,155 L90,170 L95,175 L100,190 L105,185 L100,200 L95,205 L100,218 Q95,225 100,228 Q105,225 100,218",
    ],
    frontPaths: [
      "M45,52 Q55,32 100,26 Q145,32 155,52 Q160,68 155,80 L150,75 Q148,62 140,60 L138,85 Q128,70 115,75 Q102,65 100,78 Q98,65 85,75 Q72,70 62,85 L60,60 Q52,62 50,75 L45,80 Q40,68 45,52 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_long_ponytail",
    name: "Ponytail",
    category: "long",
    backPaths: [
      // Hair pulled back
      "M42,38 Q50,15 100,10 Q150,15 158,38 Q164,65 158,85 Q150,95 130,92 L140,95 Q145,92 155,100 L158,120 L152,135 L155,150 L148,165 L152,180 L145,195 L150,210 Q148,218 145,215 Q142,220 140,215 L135,195 L138,180 L132,165 L135,150 L128,135 L132,120 L125,100 Q115,95 100,98 Q85,95 75,100 L68,120 L72,135 L65,150 L68,165 L62,180 L65,195 L60,215 Q58,220 55,215 Q52,218 50,210 L55,195 L48,180 L52,165 L45,150 L48,135 L42,120 L45,100 Q55,92 50,95 L60,92 Q42,95 36,85 Q30,65 36,38 Z",
    ],
    frontPaths: [
      // Sleek pulled back front
      "M48,55 Q58,38 100,32 Q142,38 152,55 Q156,68 152,78 Q145,65 130,62 Q115,58 100,62 Q85,58 70,62 Q55,65 48,78 Q44,68 48,55 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_long_buns",
    name: "Double Buns",
    category: "long",
    backPaths: [
      // Main hair
      "M40,40 Q48,18 100,12 Q152,18 160,40 Q166,72 160,105 Q152,120 130,115 Q115,125 100,122 Q85,125 70,115 Q48,120 40,105 Q34,72 40,40 Z",
      // Left bun
      "M50,25 Q38,15 35,30 Q32,45 45,50 Q58,55 60,40 Q62,25 50,25 Z",
      // Right bun
      "M150,25 Q162,15 165,30 Q168,45 155,50 Q142,55 140,40 Q138,25 150,25 Z",
    ],
    frontPaths: [
      "M45,55 Q55,38 100,32 Q145,38 155,55 Q160,70 155,82 L150,78 Q148,65 140,62 L138,85 Q125,72 100,75 Q75,72 62,85 L60,62 Q52,65 50,78 L45,82 Q40,70 45,55 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: false,
    textureType: "straight",
  },
  {
    id: "hair_long_half_up",
    name: "Half Up",
    category: "long",
    backPaths: [
      "M32,38 Q40,10 100,4 Q160,10 168,38 Q175,85 168,155 Q158,178 130,170 Q115,185 100,182 Q85,185 70,170 Q42,178 32,155 Q25,85 32,38 Z",
    ],
    frontPaths: [
      // Half up with volume on top
      "M40,55 Q50,30 100,22 Q150,30 160,55 Q165,72 160,88 L155,82 Q152,68 145,65 L142,95 Q132,78 118,82 L115,110 Q108,92 100,95 Q92,92 85,110 L82,82 Q68,78 58,95 L55,65 Q48,68 45,82 L40,88 Q35,72 40,55 Z",
      // Top knot/bun
      "M82,32 Q78,18 85,12 Q92,6 100,8 Q108,6 115,12 Q122,18 118,32 Q115,42 100,45 Q85,42 82,32 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_long_side_swept",
    name: "Side Swept",
    category: "long",
    backPaths: [
      "M30,40 Q38,10 100,4 Q162,10 175,40 Q182,95 175,168 Q162,195 125,185 Q110,202 95,200 Q78,198 62,178 Q38,165 30,140 Q22,90 30,40 Z",
    ],
    frontPaths: [
      // Dramatically swept to one side
      "M38,58 Q48,32 100,25 Q155,32 168,58 L165,48 L158,60 L152,50 L145,62 L138,52 L130,65 L122,55 L115,68 L108,58 L100,72 L92,62 L85,78 L78,68 L70,85 L62,75 L55,92 L48,82 L42,98 L38,88 Q32,72 38,58 Z",
      // Long swept side
      "M55,98 L48,125 L52,120 L45,150 L50,145 L42,175",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_long_pigtails",
    name: "Pigtails",
    category: "long",
    backPaths: [
      // Center part, two tails
      "M45,38 Q52,18 100,12 Q148,18 155,38 Q160,62 155,82 Q148,95 130,90 L142,95 L148,115 L145,135 L150,155 L142,175 L148,195 Q145,205 140,200 L138,175 L145,155 L138,135 L142,115 L135,95 Q115,100 100,98 Q85,100 65,95 L58,115 L62,135 L55,155 L62,175 L60,200 Q55,205 52,195 L58,175 L50,155 L55,135 L52,115 L58,95 L70,90 Q52,95 45,82 Q40,62 45,38 Z",
    ],
    frontPaths: [
      // Center part front
      "M50,55 Q60,38 100,32 Q140,38 150,55 Q155,70 150,82 L145,78 Q142,65 135,62 L132,85 Q122,72 100,75 L100,45 L100,75 Q78,72 68,85 L65,62 Q58,65 55,78 L50,82 Q45,70 50,55 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_long_dreads",
    name: "Dreadlocks",
    category: "long",
    backPaths: [
      // Dread texture background
      "M25,50 Q35,10 100,2 Q165,10 175,50 Q182,110 175,180 Q162,205 125,195 Q110,215 100,212 Q90,215 75,195 Q38,205 25,180 Q18,110 25,50 Z",
    ],
    frontPaths: [
      // Individual dread strands front
      "M35,65 Q45,30 100,22 Q155,30 165,65 L160,55 L162,90 L155,80 L158,120 L150,108 L152,145 L145,132 L142,95 L138,75 L135,55 L130,70 L128,105 L122,92 L118,130 L112,115 L108,85 L105,65 L100,55 L95,65 L92,85 L88,115 L82,130 L78,92 L72,105 L70,70 L65,55 L62,75 L58,95 L55,132 L48,145 L50,108 L42,120 L45,80 L38,90 L40,55 L35,65 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: false,
    textureType: "coily",
  },
  {
    id: "hair_long_afro",
    name: "Full Afro",
    category: "long",
    backPaths: [
      "M15,55 Q25,5 100,-5 Q175,5 185,55 Q195,120 185,190 Q170,220 125,208 Q112,232 100,230 Q88,232 75,208 Q30,220 15,190 Q5,120 15,55 Z",
    ],
    frontPaths: [
      // Large rounded afro
      "M25,70 Q35,25 100,15 Q165,25 175,70 Q182,100 175,130 L168,115 Q162,90 155,95 Q148,82 140,92 Q132,78 125,88 Q118,72 110,82 Q105,65 100,75 Q95,65 90,82 Q82,72 75,88 Q68,78 60,92 Q52,82 45,95 Q38,90 32,115 L25,130 Q18,100 25,70 Z",
    ],
    hairlineType: "rounded",
    coversEars: true,
    hatCompatible: false,
    textureType: "coily",
  },
  {
    id: "hair_long_box_braids",
    name: "Box Braids",
    category: "long",
    backPaths: [
      "M30,45 Q40,12 100,5 Q160,12 170,45 Q178,95 170,170 Q158,195 125,185 Q112,205 100,202 Q88,205 75,185 Q42,195 30,170 Q22,95 30,45 Z",
    ],
    frontPaths: [
      // Multiple braid strands
      "M38,60 Q48,32 100,25 Q152,32 162,60 L160,50 L158,80 L155,70 L152,100 L148,88 L145,118 L142,105 L140,138 L135,58 L132,88 L128,75 L125,108 L122,95 L118,128 L115,62 L112,92 L108,78 L105,112 L100,55 L95,112 L92,78 L88,92 L85,62 L82,128 L78,95 L75,108 L72,75 L68,88 L65,58 L60,138 L58,105 L55,118 L52,88 L48,100 L45,70 L42,80 L40,50 L38,60 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: false,
    textureType: "coily",
  },
  {
    id: "hair_long_cornrows",
    name: "Cornrows",
    category: "long",
    backPaths: [
      "M35,42 Q45,15 100,8 Q155,15 165,42 Q172,85 165,145 Q155,168 125,160 Q112,178 100,175 Q88,178 75,160 Q45,168 35,145 Q28,85 35,42 Z",
    ],
    frontPaths: [
      // Parallel rows pattern
      "M42,58 Q52,35 100,28 Q148,35 158,58 L155,48 L158,78 L152,65 L155,95 L148,82 L150,112 L145,55 L148,85 L142,72 L145,102 L138,88 L140,118 L128,60 L130,90 L125,78 L128,108 L120,95 L122,125 L112,65 L115,95 L108,82 L112,112 L105,98 L108,128 L100,55 L92,128 L95,98 L88,112 L92,82 L85,95 L88,65 L78,125 L80,95 L72,108 L75,78 L70,90 L72,60 L60,118 L62,88 L55,102 L58,72 L52,85 L55,55 L50,112 L52,82 L45,95 L48,65 L42,78 L45,48 L42,58 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "coily",
  },
  {
    id: "hair_long_messy",
    name: "Messy Long",
    category: "long",
    backPaths: [
      "M28,42 Q38,5 100,-2 Q162,5 172,42 Q180,100 172,172 Q160,198 125,188 Q110,208 100,205 Q90,208 75,188 Q40,198 28,172 Q20,100 28,42 Z",
    ],
    frontPaths: [
      // Wild messy strands
      "M35,62 Q45,28 100,18 Q155,28 165,62 L162,45 L158,68 L155,50 L150,72 L148,52 L142,75 L140,55 L135,78 L132,58 L128,82 L125,62 L120,85 L118,65 L112,88 L110,68 L105,92 L100,48 L95,92 L90,68 L88,88 L82,65 L80,85 L75,62 L72,82 L68,58 L65,78 L60,55 L58,75 L52,52 L50,72 L45,50 L42,68 L38,45 L35,62 Z",
      // Additional wild strands
      "M45,85 L38,115 M55,78 L48,108 M68,72 L62,102 M82,68 L75,98 M95,65 L88,95 M105,65 L112,95 M118,68 L125,98 M132,72 L138,102 M145,78 L152,108 M155,85 L162,115",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "wavy",
  },
  {
    id: "hair_long_elegant",
    name: "Elegant Updo",
    category: "long",
    backPaths: [
      // Hair gathered up elegantly
      "M42,42 Q50,20 100,15 Q150,20 158,42 Q164,70 158,92 Q152,105 130,100 L135,95 Q140,88 142,80 L138,92 Q125,98 100,100 Q75,98 62,92 L58,80 Q60,88 65,95 L70,100 Q48,105 42,92 Q36,70 42,42 Z",
      // Elegant bun at back/top
      "M75,15 Q72,0 85,-5 Q95,-10 100,-8 Q105,-10 115,-5 Q128,0 125,15 Q130,30 120,38 Q110,48 100,45 Q90,48 80,38 Q70,30 75,15 Z",
    ],
    frontPaths: [
      // Sleek swept front with volume
      "M48,58 Q58,40 100,35 Q142,40 152,58 Q156,72 152,85 L148,78 Q145,65 138,62 Q128,58 115,60 L112,48 L100,42 L88,48 L85,60 Q72,58 62,62 Q55,65 52,78 L48,85 Q44,72 48,58 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BALD STYLES (5)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "hair_bald_full",
    name: "Fully Bald",
    category: "bald",
    backPaths: [],
    frontPaths: [],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_bald_pattern",
    name: "Pattern Baldness",
    category: "bald",
    backPaths: [
      // Hair around sides and back only
      "M35,80 Q38,65 45,60 Q55,55 65,58 L68,85 Q72,95 78,92 L80,105 Q60,108 45,100 Q35,95 35,80 Z",
      "M165,80 Q162,65 155,60 Q145,55 135,58 L132,85 Q128,95 122,92 L120,105 Q140,108 155,100 Q165,95 165,80 Z",
    ],
    frontPaths: [
      // Receded hairline with temples
      "M55,62 Q62,55 72,58 L70,72 Q68,78 62,75 L55,62 Z",
      "M145,62 Q138,55 128,58 L130,72 Q132,78 138,75 L145,62 Z",
    ],
    hairlineType: "receding",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_bald_top",
    name: "Bald on Top",
    category: "bald",
    backPaths: [
      // Hair around sides and back
      "M32,75 Q35,58 48,55 Q62,52 75,58 L78,95 Q68,105 55,102 Q40,98 32,88 L32,75 Z",
      "M168,75 Q165,58 152,55 Q138,52 125,58 L122,95 Q132,105 145,102 Q160,98 168,88 L168,75 Z",
      // Back continuation
      "M75,95 Q88,100 100,98 Q112,100 125,95 L125,58 Q112,52 100,55 Q88,52 75,58 L75,95 Z",
    ],
    frontPaths: [
      // Side hair visible from front
      "M45,68 Q52,58 65,62 L68,85 Q60,92 50,88 Q45,82 45,68 Z",
      "M155,68 Q148,58 135,62 L132,85 Q140,92 150,88 Q155,82 155,68 Z",
    ],
    hairlineType: "receding",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_bald_shaved_sides",
    name: "Shaved Sides",
    category: "bald",
    backPaths: [
      // Hair on top only
      "M65,40 Q72,20 100,15 Q128,20 135,40 Q140,60 135,78 L130,75 Q128,62 100,58 Q72,62 70,75 L65,78 Q60,60 65,40 Z",
    ],
    frontPaths: [
      "M68,50 Q75,35 100,32 Q125,35 132,50 Q136,62 132,72 Q125,60 100,55 Q75,60 68,72 Q64,62 68,50 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_bald_widows_peak",
    name: "Widow's Peak Receding",
    category: "bald",
    backPaths: [
      "M35,70 Q40,50 55,48 Q72,45 85,52 L88,90 Q75,95 60,92 Q42,88 35,78 L35,70 Z",
      "M165,70 Q160,50 145,48 Q128,45 115,52 L112,90 Q125,95 140,92 Q158,88 165,78 L165,70 Z",
    ],
    frontPaths: [
      // Sharp widow's peak point
      "M55,58 Q68,52 82,58 L85,72 Q75,78 62,75 L55,58 Z",
      "M100,48 L95,55 L100,42 L105,55 L100,48 Z",
      "M145,58 Q132,52 118,58 L115,72 Q125,78 138,75 L145,58 Z",
    ],
    hairlineType: "widows_peak",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIAL STYLES (10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "hair_special_undercut_long",
    name: "Undercut Long",
    category: "special",
    backPaths: [
      // Shaved sides with long top flowing back
      "M60,42 Q68,18 100,12 Q132,18 140,42 Q148,70 140,110 Q132,130 115,125 Q108,135 100,132 Q92,135 85,125 Q68,130 60,110 Q52,70 60,42 Z",
    ],
    frontPaths: [
      // Long flowing top
      "M62,55 Q72,35 100,28 Q128,35 138,55 L135,42 L128,52 L122,38 L115,50 L108,35 L100,48 L92,35 L85,50 L78,38 L72,52 L65,42 L62,55 Z",
      // Long swept bangs
      "M68,65 L62,95 L65,88 L60,115",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_special_mullet",
    name: "Mullet",
    category: "special",
    backPaths: [
      // Business in front, party in back
      "M40,45 Q50,22 100,18 Q150,22 160,45 Q166,75 160,130 Q152,155 125,148 Q112,165 100,162 Q88,165 75,148 Q48,155 40,130 Q34,75 40,45 Z",
    ],
    frontPaths: [
      // Short front
      "M48,55 Q58,40 100,35 Q142,40 152,55 Q156,68 152,78 Q145,65 130,62 L128,80 Q118,70 100,72 Q82,70 72,80 L70,62 Q55,65 48,78 Q44,68 48,55 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: true,
    textureType: "wavy",
  },
  {
    id: "hair_special_pompadour",
    name: "Pompadour",
    category: "special",
    backPaths: [
      "M45,45 Q52,25 100,20 Q148,25 155,45 Q160,70 155,90 L150,88 Q148,72 100,68 Q52,72 50,88 L45,90 Q40,70 45,45 Z",
    ],
    frontPaths: [
      // High dramatic pompadour
      "M48,62 Q55,30 100,15 Q145,30 152,62 L150,45 L145,58 L142,38 L138,55 L135,32 L130,52 L128,28 L122,48 L120,25 L115,45 L112,22 L108,42 L105,20 L100,38 L95,20 L92,42 L88,22 L85,45 L80,25 L78,48 L72,28 L70,52 L65,32 L62,55 L58,38 L55,58 L50,45 L48,62 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: false,
    textureType: "straight",
  },
  {
    id: "hair_special_fauxhawk",
    name: "Fauxhawk",
    category: "special",
    backPaths: [
      // Tapered sides with raised center
      "M50,48 Q58,28 100,22 Q142,28 150,48 Q156,72 150,92 L145,88 Q142,75 100,70 Q58,75 55,88 L50,92 Q44,72 50,48 Z",
    ],
    frontPaths: [
      // Raised center, shorter sides
      "M55,58 Q62,42 100,35 Q138,42 145,58 L142,48 L138,55 L135,42 L130,52 L128,38 L122,50 L118,35 L112,48 L108,32 L105,45 L100,28 L95,45 L92,32 L88,48 L82,35 L78,50 L72,38 L70,52 L65,42 L62,55 L58,48 L55,58 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: false,
    textureType: "straight",
  },
  {
    id: "hair_special_liberty_spikes",
    name: "Liberty Spikes",
    category: "special",
    backPaths: [
      // Base hair
      "M50,55 Q58,40 100,35 Q142,40 150,55 Q155,72 150,85 L145,82 Q142,70 100,65 Q58,70 55,82 L50,85 Q45,72 50,55 Z",
    ],
    frontPaths: [
      // Dramatic spikes
      "M55,62 Q62,48 100,42 Q138,48 145,62 L142,35 L135,55 L130,25 L125,52 L118,18 L112,48 L105,12 L100,45 L95,12 L88,48 L82,18 L75,52 L70,25 L65,55 L58,35 L55,62 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: false,
    textureType: "straight",
  },
  {
    id: "hair_special_man_bun",
    name: "Man Bun",
    category: "special",
    backPaths: [
      // Hair pulled back
      "M42,42 Q50,22 100,18 Q150,22 158,42 Q164,68 158,88 Q150,100 130,95 Q115,102 100,100 Q85,102 70,95 Q50,100 42,88 Q36,68 42,42 Z",
      // Bun on top/back
      "M80,15 Q78,2 90,-2 Q98,-5 100,-3 Q102,-5 110,-2 Q122,2 120,15 Q125,28 115,35 Q105,42 100,40 Q95,42 85,35 Q75,28 80,15 Z",
    ],
    frontPaths: [
      // Swept back front
      "M48,58 Q58,42 100,38 Q142,42 152,58 Q156,70 152,80 Q145,68 130,65 Q115,62 100,65 Q85,62 70,65 Q55,68 48,80 Q44,70 48,58 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: true,
    textureType: "straight",
  },
  {
    id: "hair_special_space_buns",
    name: "Space Buns",
    category: "special",
    backPaths: [
      // Main hair
      "M42,42 Q50,20 100,15 Q150,20 158,42 Q164,72 158,102 Q150,118 130,112 Q115,122 100,120 Q85,122 70,112 Q50,118 42,102 Q36,72 42,42 Z",
      // Left space bun
      "M42,22 Q30,12 28,28 Q26,44 40,48 Q54,52 56,36 Q58,20 42,22 Z",
      // Right space bun
      "M158,22 Q170,12 172,28 Q174,44 160,48 Q146,52 144,36 Q142,20 158,22 Z",
    ],
    frontPaths: [
      "M48,55 Q58,38 100,32 Q142,38 152,55 Q156,70 152,82 L148,78 Q145,65 138,62 L135,85 Q125,72 100,75 Q75,72 65,85 L62,62 Q55,65 52,78 L48,82 Q44,70 48,55 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: false,
    textureType: "straight",
  },
  {
    id: "hair_special_viking",
    name: "Viking Braids",
    category: "special",
    backPaths: [
      // Main hair mass
      "M35,40 Q45,15 100,8 Q155,15 165,40 Q172,78 165,120 Q155,142 130,135 Q115,148 100,145 Q85,148 70,135 Q45,142 35,120 Q28,78 35,40 Z",
      // Side braids
      "M35,85 L32,105 L38,100 L35,120 L42,115 L38,135 L45,130 L42,150 L48,145 L45,165 Q42,172 45,175",
      "M165,85 L168,105 L162,100 L165,120 L158,115 L162,135 L155,130 L158,150 L152,145 L155,165 Q158,172 155,175",
    ],
    frontPaths: [
      // Swept back with warrior look
      "M42,58 Q52,35 100,28 Q148,35 158,58 Q162,72 158,85 L152,78 Q148,65 140,62 L138,88 Q128,72 115,78 Q102,68 100,82 Q98,68 85,78 Q72,72 62,88 L60,62 Q52,65 48,78 L42,85 Q38,72 42,58 Z",
    ],
    hairlineType: "standard",
    coversEars: true,
    hatCompatible: false,
    textureType: "wavy",
  },
  {
    id: "hair_special_twin_tails",
    name: "Twin Tails High",
    category: "special",
    backPaths: [
      // Center hair
      "M48,42 Q55,22 100,18 Q145,22 152,42 Q158,68 152,88 Q145,100 130,95 Q115,102 100,100 Q85,102 70,95 Q55,100 48,88 Q42,68 48,42 Z",
      // Left twin tail
      "M45,30 L35,32 L38,50 L30,55 L35,75 L28,82 L32,105 L25,115 L30,140 L22,152 L28,175 Q25,182 30,185",
      // Right twin tail
      "M155,30 L165,32 L162,50 L170,55 L165,75 L172,82 L168,105 L175,115 L170,140 L178,152 L172,175 Q175,182 170,185",
    ],
    frontPaths: [
      "M52,55 Q62,38 100,32 Q138,38 148,55 Q152,70 148,82 L145,78 Q142,65 135,62 L132,82 Q122,70 100,72 Q78,70 68,82 L65,62 Q58,65 55,78 L52,82 Q48,70 52,55 Z",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: false,
    textureType: "straight",
  },
  {
    id: "hair_special_mohawk_long",
    name: "Long Mohawk",
    category: "special",
    backPaths: [
      // Long center strip
      "M80,40 Q88,8 100,2 Q112,8 120,40 Q128,85 120,145 Q115,165 105,162 Q100,168 95,162 Q85,165 80,145 Q72,85 80,40 Z",
    ],
    frontPaths: [
      // Dramatic long center mohawk
      "M85,52 Q92,22 100,15 Q108,22 115,52 L112,32 L108,48 L105,25 L100,42 L95,25 L92,48 L88,32 L85,52 Z",
      // Flowing strands
      "M92,68 L88,95 L92,88 L90,115 L95,108 L92,135",
      "M108,68 L112,95 L108,88 L110,115 L105,108 L108,135",
    ],
    hairlineType: "standard",
    coversEars: false,
    hatCompatible: false,
    textureType: "straight",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get hair style data by ID
 */
export function getHairStyle(id: HairStyleId): HairStyleData | undefined {
  return HAIR_STYLES.find((style) => style.id === id);
}

/**
 * Get hair style with fallback to default (classic short)
 */
export function getHairStyleSafe(id: HairStyleId): HairStyleData {
  return getHairStyle(id) ?? HAIR_STYLES[0]; // Default to short_classic
}

/**
 * Get all hair styles in a specific category
 */
export function getHairStylesByCategory(
  category: HairStyleData["category"],
): HairStyleData[] {
  return HAIR_STYLES.filter((style) => style.category === category);
}

/**
 * Get short hair styles
 */
export function getShortHairStyles(): HairStyleData[] {
  return getHairStylesByCategory("short");
}

/**
 * Get medium hair styles
 */
export function getMediumHairStyles(): HairStyleData[] {
  return getHairStylesByCategory("medium");
}

/**
 * Get long hair styles
 */
export function getLongHairStyles(): HairStyleData[] {
  return getHairStylesByCategory("long");
}

/**
 * Get bald hair styles
 */
export function getBaldHairStyles(): HairStyleData[] {
  return getHairStylesByCategory("bald");
}

/**
 * Get special hair styles
 */
export function getSpecialHairStyles(): HairStyleData[] {
  return getHairStylesByCategory("special");
}

/**
 * Get hair styles that are hat compatible
 */
export function getHatCompatibleHairStyles(): HairStyleData[] {
  return HAIR_STYLES.filter((style) => style.hatCompatible);
}

/**
 * Get hair styles by texture type
 */
export function getHairStylesByTexture(
  texture: HairStyleData["textureType"],
): HairStyleData[] {
  return HAIR_STYLES.filter((style) => style.textureType === texture);
}

/**
 * Default hair style ID for new avatars
 */
export const DEFAULT_HAIR_STYLE: HairStyleId = "hair_short_classic";
