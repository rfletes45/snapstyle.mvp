/**
 * Avatar Test Screen
 *
 * Development screen for testing the digital avatar rendering.
 * Phase 5 - Tests accessory systems (headwear, eyewear, neckwear, earwear, wristwear).
 */

import type {
  BodyShapeId,
  ClothingBottomId,
  ClothingOutfitId,
  ClothingTopId,
  DigitalAvatarConfig,
  EarwearId,
  EyebrowStyleId,
  EyelashStyleId,
  EyeStyleId,
  EyewearId,
  FacialHairStyleId,
  HairColorId,
  HairStyleId,
  HeadwearId,
  NeckwearId,
  SkinToneId,
  WristwearId,
} from "@/types/avatar";
import { getDefaultAvatarConfig } from "@/utils/avatarHelpers";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { AvatarSvgRenderer, DigitalAvatar } from "../components/avatar/index";

// ═══════════════════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════════════════

const SKIN_TONES: SkinToneId[] = [
  "skin_01",
  "skin_02",
  "skin_03",
  "skin_04",
  "skin_05",
  "skin_06",
  "skin_07",
  "skin_08",
  "skin_09",
  "skin_10",
  "skin_11",
  "skin_12",
];

const EYE_STYLES: EyeStyleId[] = [
  "eye_natural",
  "eye_round",
  "eye_almond",
  "eye_hooded",
  "eye_monolid",
  "eye_upturned",
  "eye_downturned",
  "eye_wide_set",
  "eye_close_set",
  "eye_deep_set",
];

const EYEBROW_STYLES: EyebrowStyleId[] = [
  "brow_natural",
  "brow_thick",
  "brow_thin",
  "brow_arched_high",
  "brow_arched_soft",
  "brow_straight",
  "brow_angled",
  "brow_rounded",
  "brow_bushy",
];

const EYELASH_STYLES: EyelashStyleId[] = [
  "none",
  "natural",
  "long",
  "dramatic",
  "wispy",
];

// Phase 3: Hair styles by category
const HAIR_STYLES_SHORT: HairStyleId[] = [
  "hair_short_classic",
  "hair_short_textured",
  "hair_short_fade",
  "hair_short_buzz",
  "hair_short_cropped",
  "hair_short_spiky",
  "hair_short_slicked",
  "hair_short_mohawk",
  "hair_short_quiff",
  "hair_short_crew",
];

const HAIR_STYLES_MEDIUM: HairStyleId[] = [
  "hair_medium_wavy",
  "hair_medium_straight",
  "hair_medium_curly",
  "hair_medium_bob",
  "hair_medium_layered",
  "hair_medium_shaggy",
  "hair_medium_asymmetric",
  "hair_medium_bangs",
  "hair_medium_side_part",
  "hair_medium_afro_short",
];

const HAIR_STYLES_LONG: HairStyleId[] = [
  "hair_long_straight",
  "hair_long_wavy",
  "hair_long_curly",
  "hair_long_braided",
  "hair_long_ponytail",
  "hair_long_buns",
  "hair_long_half_up",
  "hair_long_side_swept",
  "hair_long_pigtails",
  "hair_long_dreads",
  "hair_long_afro",
  "hair_long_box_braids",
  "hair_long_cornrows",
  "hair_long_messy",
  "hair_long_elegant",
];

const HAIR_STYLES_SPECIAL: HairStyleId[] = [
  "hair_bald_full",
  "hair_bald_pattern",
  "hair_bald_top",
  "hair_bald_shaved_sides",
  "hair_special_undercut_long",
  "hair_special_mullet",
  "hair_special_pompadour",
  "hair_special_fauxhawk",
  "hair_special_liberty_spikes",
  "hair_special_man_bun",
];

// Hair colors organized by type
const HAIR_COLORS_NATURAL: HairColorId[] = [
  "black",
  "dark_brown",
  "medium_brown",
  "light_brown",
  "auburn",
  "chestnut",
  "copper",
  "strawberry_blonde",
  "golden_blonde",
  "platinum_blonde",
  "dirty_blonde",
  "gray_dark",
  "gray_light",
  "silver",
  "white",
];

const HAIR_COLORS_FANTASY: HairColorId[] = [
  "fantasy_blue",
  "fantasy_purple",
  "fantasy_pink",
  "fantasy_green",
  "fantasy_red",
];

// Facial hair styles
const FACIAL_HAIR_STYLES: FacialHairStyleId[] = [
  "none",
  "stubble",
  "goatee",
  "mustache",
  "full_beard",
  "short_beard",
  "long_beard",
  "soul_patch",
  "mutton_chops",
  "handlebar",
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: Body & Clothing Test Data
// ═══════════════════════════════════════════════════════════════════════════

// Body shapes
const BODY_SHAPES: BodyShapeId[] = [
  "body_slim",
  "body_average",
  "body_athletic",
  "body_broad",
  "body_curvy",
  "body_stocky",
  "body_tall",
  "body_petite",
];

// Clothing tops by category
const TOPS_TSHIRTS: ClothingTopId[] = [
  "top_tshirt_basic",
  "top_tshirt_vneck",
  "top_tshirt_crew",
  "top_tshirt_oversized",
  "top_tshirt_fitted",
  "top_tshirt_polo",
];

const TOPS_CASUAL: ClothingTopId[] = [
  "top_tank_basic",
  "top_tank_athletic",
  "top_tank_muscle",
  "top_tank_racerback",
  "top_shirt_button_up",
  "top_shirt_flannel",
  "top_shirt_denim",
  "top_shirt_linen",
];

const TOPS_WARM: ClothingTopId[] = [
  "top_sweater_crew",
  "top_sweater_vneck",
  "top_sweater_cardigan",
  "top_sweater_turtleneck",
  "top_hoodie_classic",
  "top_hoodie_zip",
  "top_hoodie_oversized",
  "top_hoodie_cropped",
];

const TOPS_OUTERWEAR: ClothingTopId[] = [
  "top_jacket_denim",
  "top_jacket_leather",
  "top_jacket_bomber",
  "top_jacket_blazer",
  "top_crop_basic",
  "top_crop_halter",
  "top_crop_off_shoulder",
  "top_crop_tube",
];

// Clothing bottoms by category
const BOTTOMS_JEANS: ClothingBottomId[] = [
  "bottom_jeans_regular",
  "bottom_jeans_skinny",
  "bottom_jeans_bootcut",
  "bottom_jeans_wide",
  "bottom_jeans_high_waist",
  "bottom_jeans_ripped",
];

const BOTTOMS_PANTS: ClothingBottomId[] = [
  "bottom_pants_chinos",
  "bottom_pants_dress",
  "bottom_pants_cargo",
  "bottom_pants_wide",
  "bottom_pants_paperbag",
  "bottom_pants_culottes",
];

const BOTTOMS_CASUAL: ClothingBottomId[] = [
  "bottom_shorts_casual",
  "bottom_shorts_denim",
  "bottom_shorts_athletic",
  "bottom_shorts_running",
  "bottom_shorts_bermuda",
  "bottom_shorts_biker",
];

const BOTTOMS_SKIRTS: ClothingBottomId[] = [
  "bottom_skirt_mini",
  "bottom_skirt_denim",
  "bottom_skirt_pleated",
  "bottom_skirt_midi",
  "bottom_skirt_aline",
  "bottom_skirt_pencil",
];

const BOTTOMS_ATHLETIC: ClothingBottomId[] = [
  "bottom_sweatpants",
  "bottom_joggers",
  "bottom_leggings",
  "bottom_yoga",
  "bottom_track_pants",
  "bottom_leggings_capri",
];

// Full outfits
const OUTFITS_ALL: ClothingOutfitId[] = [
  "outfit_none",
  "outfit_dress_casual",
  "outfit_dress_aline",
  "outfit_dress_maxi",
  "outfit_dress_cocktail",
  "outfit_dress_sundress",
  "outfit_jumpsuit_casual",
  "outfit_jumpsuit_denim",
  "outfit_romper",
  "outfit_athletic_set",
  "outfit_yoga_set",
  "outfit_suit",
  "outfit_tuxedo",
  "outfit_superhero",
  "outfit_onesie",
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: Accessory Test Data
// ═══════════════════════════════════════════════════════════════════════════

// Headwear by category
const HEADWEAR_HATS: HeadwearId[] = [
  "headwear_none",
  "headwear_baseball_cap",
  "headwear_fitted_cap",
  "headwear_snapback",
  "headwear_trucker_hat",
  "headwear_bucket_hat",
  "headwear_beanie_cuffed",
  "headwear_beanie_slouchy",
  "headwear_beanie_pom",
];

const HEADWEAR_SPECIAL: HeadwearId[] = [
  "headwear_fedora",
  "headwear_bowler",
  "headwear_top_hat",
  "headwear_crown_gold",
  "headwear_crown_silver",
  "headwear_tiara",
  "headwear_bandana",
  "headwear_sweatband",
  "headwear_headband_thin",
  "headwear_chef_hat",
  "headwear_graduation_cap",
  "headwear_party_hat",
];

// Eyewear by category
const EYEWEAR_GLASSES: EyewearId[] = [
  "eyewear_none",
  "eyewear_round_frame",
  "eyewear_square_frame",
  "eyewear_rectangle_frame",
  "eyewear_oval_frame",
  "eyewear_cat_eye",
  "eyewear_aviator_frame",
  "eyewear_horn_rimmed",
  "eyewear_rimless",
  "eyewear_half_rim",
  "eyewear_reading",
];

const EYEWEAR_SUNGLASSES: EyewearId[] = [
  "eyewear_sunglasses_aviator",
  "eyewear_sunglasses_wayfarer",
  "eyewear_sunglasses_round",
  "eyewear_sunglasses_sport",
  "eyewear_sunglasses_oversized",
  "eyewear_sunglasses_mirror",
  "eyewear_sunglasses_retro",
  "eyewear_sunglasses_cat_eye",
  "eyewear_goggles_swim",
  "eyewear_3d_glasses",
  "eyewear_monocle",
  "eyewear_star_glasses",
];

// Neckwear by category
const NECKWEAR_JEWELRY: NeckwearId[] = [
  "neckwear_none",
  "neckwear_chain_gold",
  "neckwear_chain_silver",
  "neckwear_pendant",
  "neckwear_choker",
  "neckwear_pearls",
  "neckwear_beads",
  "neckwear_locket",
];

const NECKWEAR_CLOTHING: NeckwearId[] = [
  "neckwear_tie",
  "neckwear_bow_tie",
  "neckwear_scarf_wrap",
  "neckwear_scarf_long",
  "neckwear_bandana_neck",
  "neckwear_headphones",
  "neckwear_lanyard",
  "neckwear_medal",
];

// Earwear by category
const EARWEAR_STUDS: EarwearId[] = [
  "earwear_none",
  "earwear_stud_gold",
  "earwear_stud_silver",
  "earwear_stud_diamond",
  "earwear_stud_pearl",
];

const EARWEAR_OTHER: EarwearId[] = [
  "earwear_hoop_gold_small",
  "earwear_hoop_gold_large",
  "earwear_hoop_silver",
  "earwear_dangle_crystal",
  "earwear_dangle_feather",
  "earwear_dangle_chain",
  "earwear_cuff",
  "earwear_plugs",
  "earwear_airpods",
  "earwear_elf",
];

// Wristwear by category
const WRISTWEAR_WATCHES: WristwearId[] = [
  "wristwear_none",
  "wristwear_watch_classic",
  "wristwear_watch_gold",
  "wristwear_watch_silver",
  "wristwear_smartwatch",
  "wristwear_fitness_band",
];

const WRISTWEAR_BRACELETS: WristwearId[] = [
  "wristwear_bracelet_beaded",
  "wristwear_bracelet_chain",
  "wristwear_bracelet_leather",
  "wristwear_bangle_gold",
  "wristwear_bangle_stack",
  "wristwear_sweatband",
  "wristwear_scrunchie",
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AvatarTestScreen() {
  const [config, setConfig] = useState<DigitalAvatarConfig>(
    getDefaultAvatarConfig(),
  );
  const [animated, setAnimated] = useState(true);
  const [showEyelashes, setShowEyelashes] = useState(false);
  const [hairCategory, setHairCategory] = useState<
    "short" | "medium" | "long" | "special"
  >("short");
  // Phase 4 state
  const [topsCategory, setTopsCategory] = useState<
    "tshirts" | "casual" | "warm" | "outerwear"
  >("tshirts");
  const [bottomsCategory, setBottomsCategory] = useState<
    "jeans" | "pants" | "casual" | "skirts" | "athletic"
  >("jeans");
  const [showFullBody, setShowFullBody] = useState(true);

  // Phase 5 state
  const [headwearCategory, setHeadwearCategory] = useState<"hats" | "special">(
    "hats",
  );
  const [eyewearCategory, setEyewearCategory] = useState<
    "glasses" | "sunglasses"
  >("glasses");
  const [neckwearCategory, setNeckwearCategory] = useState<
    "jewelry" | "clothing"
  >("jewelry");
  const [earwearCategory, setEarwearCategory] = useState<"studs" | "other">(
    "studs",
  );
  const [wristwearCategory, setWristwearCategory] = useState<
    "watches" | "bracelets"
  >("watches");

  const updateConfig = (updates: Partial<DigitalAvatarConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...updates,
      updatedAt: Date.now(),
    }));
  };

  const changeSkinTone = (skinTone: SkinToneId) => {
    updateConfig({
      body: { ...config.body, skinTone },
    });
  };

  const changeEyeStyle = (style: EyeStyleId) => {
    updateConfig({
      eyes: { ...config.eyes, style },
    });
  };

  const changeEyebrowStyle = (style: EyebrowStyleId) => {
    updateConfig({
      eyes: {
        ...config.eyes,
        eyebrows: { ...config.eyes.eyebrows, style },
      },
    });
  };

  const changeEyelashStyle = (style: EyelashStyleId) => {
    updateConfig({
      eyes: {
        ...config.eyes,
        eyelashes: {
          ...config.eyes.eyelashes,
          enabled: style !== "none",
          style,
        },
      },
    });
  };

  const toggleEyelashes = (enabled: boolean) => {
    setShowEyelashes(enabled);
    updateConfig({
      eyes: {
        ...config.eyes,
        eyelashes: {
          ...config.eyes.eyelashes,
          enabled,
        },
      },
    });
  };

  // Phase 3: Hair functions
  const changeHairStyle = (style: HairStyleId) => {
    updateConfig({
      hair: { ...config.hair, style },
    });
  };

  const changeHairColor = (color: HairColorId) => {
    updateConfig({
      hair: { ...config.hair, color },
    });
  };

  const changeFacialHairStyle = (style: FacialHairStyleId) => {
    updateConfig({
      hair: {
        ...config.hair,
        facialHair: { ...config.hair.facialHair, style },
      },
    });
  };

  const getHairStylesForCategory = (): HairStyleId[] => {
    switch (hairCategory) {
      case "short":
        return HAIR_STYLES_SHORT;
      case "medium":
        return HAIR_STYLES_MEDIUM;
      case "long":
        return HAIR_STYLES_LONG;
      case "special":
        return HAIR_STYLES_SPECIAL;
    }
  };

  // Phase 4: Body & Clothing functions
  const changeBodyShape = (shape: BodyShapeId) => {
    updateConfig({
      body: { ...config.body, shape },
    });
  };

  const changeClothingTop = (top: ClothingTopId | null) => {
    updateConfig({
      clothing: { ...config.clothing, top, outfit: null },
    });
  };

  const changeClothingBottom = (bottom: ClothingBottomId | null) => {
    updateConfig({
      clothing: { ...config.clothing, bottom, outfit: null },
    });
  };

  const changeOutfit = (outfit: ClothingOutfitId | null) => {
    updateConfig({
      clothing: {
        ...config.clothing,
        outfit,
        // Clear top/bottom when outfit is selected
        top: outfit && outfit !== "outfit_none" ? null : config.clothing.top,
        bottom:
          outfit && outfit !== "outfit_none" ? null : config.clothing.bottom,
      },
    });
  };

  const getTopsForCategory = (): ClothingTopId[] => {
    switch (topsCategory) {
      case "tshirts":
        return TOPS_TSHIRTS;
      case "casual":
        return TOPS_CASUAL;
      case "warm":
        return TOPS_WARM;
      case "outerwear":
        return TOPS_OUTERWEAR;
    }
  };

  const getBottomsForCategory = (): ClothingBottomId[] => {
    switch (bottomsCategory) {
      case "jeans":
        return BOTTOMS_JEANS;
      case "pants":
        return BOTTOMS_PANTS;
      case "casual":
        return BOTTOMS_CASUAL;
      case "skirts":
        return BOTTOMS_SKIRTS;
      case "athletic":
        return BOTTOMS_ATHLETIC;
    }
  };

  // Phase 5: Accessory functions
  const changeHeadwear = (headwear: HeadwearId | null) => {
    updateConfig({
      accessories: {
        ...config.accessories,
        headwear: headwear === "headwear_none" ? null : headwear,
      },
    });
  };

  const changeEyewear = (eyewear: EyewearId | null) => {
    updateConfig({
      accessories: {
        ...config.accessories,
        eyewear: eyewear === "eyewear_none" ? null : eyewear,
      },
    });
  };

  const changeNeckwear = (neckwear: NeckwearId | null) => {
    updateConfig({
      accessories: {
        ...config.accessories,
        neckwear: neckwear === "neckwear_none" ? null : neckwear,
      },
    });
  };

  const changeEarwear = (earwear: EarwearId | null) => {
    updateConfig({
      accessories: {
        ...config.accessories,
        earwear: earwear === "earwear_none" ? null : earwear,
      },
    });
  };

  const changeWristwear = (wristwear: WristwearId | null) => {
    updateConfig({
      accessories: {
        ...config.accessories,
        wristwear: wristwear === "wristwear_none" ? null : wristwear,
      },
    });
  };

  const getHeadwearForCategory = (): HeadwearId[] => {
    switch (headwearCategory) {
      case "hats":
        return HEADWEAR_HATS;
      case "special":
        return HEADWEAR_SPECIAL;
    }
  };

  const getEyewearForCategory = (): EyewearId[] => {
    switch (eyewearCategory) {
      case "glasses":
        return EYEWEAR_GLASSES;
      case "sunglasses":
        return EYEWEAR_SUNGLASSES;
    }
  };

  const getNeckwearForCategory = (): NeckwearId[] => {
    switch (neckwearCategory) {
      case "jewelry":
        return NECKWEAR_JEWELRY;
      case "clothing":
        return NECKWEAR_CLOTHING;
    }
  };

  const getEarwearForCategory = (): EarwearId[] => {
    switch (earwearCategory) {
      case "studs":
        return EARWEAR_STUDS;
      case "other":
        return EARWEAR_OTHER;
    }
  };

  const getWristwearForCategory = (): WristwearId[] => {
    switch (wristwearCategory) {
      case "watches":
        return WRISTWEAR_WATCHES;
      case "bracelets":
        return WRISTWEAR_BRACELETS;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Avatar Test - Phase 5</Text>

      {/* Large Preview with Animation Toggle */}
      <View style={styles.previewContainer}>
        <AvatarSvgRenderer
          config={config}
          size={200}
          showBody={showFullBody}
          animated={animated}
        />
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Animations</Text>
          <Switch value={animated} onValueChange={setAnimated} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show Full Body</Text>
          <Switch value={showFullBody} onValueChange={setShowFullBody} />
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════
          PHASE 4: Body & Clothing System
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Body Shape Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Body Shapes (8)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {BODY_SHAPES.map((shape) => (
              <Pressable
                key={shape}
                style={[
                  styles.optionButton,
                  config.body.shape === shape && styles.selectedOption,
                ]}
                onPress={() => changeBodyShape(shape)}
              >
                <AvatarSvgRenderer
                  config={{
                    ...config,
                    body: { ...config.body, shape: shape },
                  }}
                  size={50}
                  showBody={true}
                  animated={false}
                />
                <Text style={styles.tinyText}>
                  {shape.replace("body_", "")}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Full Outfits Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Full Outfits (15)</Text>
        <Text style={styles.description}>
          Outfits replace both top and bottom clothing.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {OUTFITS_ALL.map((outfit) => (
              <Pressable
                key={outfit}
                style={[
                  styles.optionButton,
                  config.clothing.outfit === outfit && styles.selectedOption,
                ]}
                onPress={() => changeOutfit(outfit)}
              >
                <AvatarSvgRenderer
                  config={{
                    ...config,
                    clothing: {
                      ...config.clothing,
                      outfit,
                      top: null,
                      bottom: null,
                    },
                  }}
                  size={50}
                  showBody={true}
                  animated={false}
                />
                <Text style={styles.tinyText}>
                  {outfit
                    .replace("outfit_", "")
                    .replace(/_/g, " ")
                    .slice(0, 10)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Clothing Tops Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Clothing Tops (30)</Text>
        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {(["tshirts", "casual", "warm", "outerwear"] as const).map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryTab,
                topsCategory === cat && styles.selectedTab,
              ]}
              onPress={() => setTopsCategory(cat)}
            >
              <Text
                style={[
                  styles.tabText,
                  topsCategory === cat && styles.selectedTabText,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {getTopsForCategory().map((top) => (
              <Pressable
                key={top}
                style={[
                  styles.optionButton,
                  config.clothing.top === top && styles.selectedOption,
                ]}
                onPress={() => changeClothingTop(top)}
              >
                <AvatarSvgRenderer
                  config={{
                    ...config,
                    clothing: { ...config.clothing, top, outfit: null },
                  }}
                  size={50}
                  showBody={true}
                  animated={false}
                />
                <Text style={styles.tinyText}>
                  {top
                    .replace("top_tshirt_", "")
                    .replace("top_tank_", "")
                    .replace("top_shirt_", "")
                    .replace("top_sweater_", "")
                    .replace("top_hoodie_", "")
                    .replace("top_jacket_", "")
                    .replace("top_crop_", "")
                    .replace(/_/g, " ")
                    .slice(0, 8)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Clothing Bottoms Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Clothing Bottoms (30)</Text>
        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {(["jeans", "pants", "casual", "skirts", "athletic"] as const).map(
            (cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.categoryTab,
                  bottomsCategory === cat && styles.selectedTab,
                ]}
                onPress={() => setBottomsCategory(cat)}
              >
                <Text
                  style={[
                    styles.tabText,
                    bottomsCategory === cat && styles.selectedTabText,
                  ]}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </Pressable>
            ),
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {getBottomsForCategory().map((bottom) => (
              <Pressable
                key={bottom}
                style={[
                  styles.optionButton,
                  config.clothing.bottom === bottom && styles.selectedOption,
                ]}
                onPress={() => changeClothingBottom(bottom)}
              >
                <AvatarSvgRenderer
                  config={{
                    ...config,
                    clothing: { ...config.clothing, bottom, outfit: null },
                  }}
                  size={50}
                  showBody={true}
                  animated={false}
                />
                <Text style={styles.tinyText}>
                  {bottom
                    .replace("bottom_jeans_", "")
                    .replace("bottom_pants_", "")
                    .replace("bottom_shorts_", "")
                    .replace("bottom_skirt_", "")
                    .replace("bottom_", "")
                    .replace(/_/g, " ")
                    .slice(0, 8)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════
          PHASE 5: Accessories System
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Headwear Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Headwear (21)</Text>
        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {(["hats", "special"] as const).map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryTab,
                headwearCategory === cat && styles.selectedTab,
              ]}
              onPress={() => setHeadwearCategory(cat)}
            >
              <Text
                style={[
                  styles.tabText,
                  headwearCategory === cat && styles.selectedTabText,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {getHeadwearForCategory().map((headwear) => (
              <Pressable
                key={headwear}
                style={[
                  styles.optionButton,
                  (config.accessories.headwear === headwear ||
                    (headwear === "headwear_none" &&
                      !config.accessories.headwear)) &&
                    styles.selectedOption,
                ]}
                onPress={() => changeHeadwear(headwear)}
              >
                <AvatarSvgRenderer
                  config={{
                    ...config,
                    accessories: {
                      ...config.accessories,
                      headwear: headwear === "headwear_none" ? null : headwear,
                    },
                  }}
                  size={50}
                  showBody={false}
                  animated={false}
                />
                <Text style={styles.tinyText}>
                  {headwear
                    .replace("headwear_", "")
                    .replace(/_/g, " ")
                    .slice(0, 10)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Eyewear Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Eyewear (22)</Text>
        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {(["glasses", "sunglasses"] as const).map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryTab,
                eyewearCategory === cat && styles.selectedTab,
              ]}
              onPress={() => setEyewearCategory(cat)}
            >
              <Text
                style={[
                  styles.tabText,
                  eyewearCategory === cat && styles.selectedTabText,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {getEyewearForCategory().map((eyewear) => (
              <Pressable
                key={eyewear}
                style={[
                  styles.optionButton,
                  (config.accessories.eyewear === eyewear ||
                    (eyewear === "eyewear_none" &&
                      !config.accessories.eyewear)) &&
                    styles.selectedOption,
                ]}
                onPress={() => changeEyewear(eyewear)}
              >
                <AvatarSvgRenderer
                  config={{
                    ...config,
                    accessories: {
                      ...config.accessories,
                      eyewear: eyewear === "eyewear_none" ? null : eyewear,
                    },
                  }}
                  size={50}
                  showBody={false}
                  animated={false}
                />
                <Text style={styles.tinyText}>
                  {eyewear
                    .replace("eyewear_sunglasses_", "")
                    .replace("eyewear_", "")
                    .replace(/_/g, " ")
                    .slice(0, 10)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Neckwear Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Neckwear (15)</Text>
        <Text style={styles.description}>
          Full body mode shows necklaces and ties best.
        </Text>
        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {(["jewelry", "clothing"] as const).map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryTab,
                neckwearCategory === cat && styles.selectedTab,
              ]}
              onPress={() => setNeckwearCategory(cat)}
            >
              <Text
                style={[
                  styles.tabText,
                  neckwearCategory === cat && styles.selectedTabText,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {getNeckwearForCategory().map((neckwear) => (
              <Pressable
                key={neckwear}
                style={[
                  styles.optionButton,
                  (config.accessories.neckwear === neckwear ||
                    (neckwear === "neckwear_none" &&
                      !config.accessories.neckwear)) &&
                    styles.selectedOption,
                ]}
                onPress={() => changeNeckwear(neckwear)}
              >
                <AvatarSvgRenderer
                  config={{
                    ...config,
                    accessories: {
                      ...config.accessories,
                      neckwear: neckwear === "neckwear_none" ? null : neckwear,
                    },
                  }}
                  size={50}
                  showBody={true}
                  animated={false}
                />
                <Text style={styles.tinyText}>
                  {neckwear
                    .replace("neckwear_", "")
                    .replace(/_/g, " ")
                    .slice(0, 10)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Earwear Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earwear (15)</Text>
        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {(["studs", "other"] as const).map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryTab,
                earwearCategory === cat && styles.selectedTab,
              ]}
              onPress={() => setEarwearCategory(cat)}
            >
              <Text
                style={[
                  styles.tabText,
                  earwearCategory === cat && styles.selectedTabText,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {getEarwearForCategory().map((earwear) => (
              <Pressable
                key={earwear}
                style={[
                  styles.optionButton,
                  (config.accessories.earwear === earwear ||
                    (earwear === "earwear_none" &&
                      !config.accessories.earwear)) &&
                    styles.selectedOption,
                ]}
                onPress={() => changeEarwear(earwear)}
              >
                <AvatarSvgRenderer
                  config={{
                    ...config,
                    accessories: {
                      ...config.accessories,
                      earwear: earwear === "earwear_none" ? null : earwear,
                    },
                  }}
                  size={50}
                  showBody={false}
                  animated={false}
                />
                <Text style={styles.tinyText}>
                  {earwear
                    .replace("earwear_", "")
                    .replace(/_/g, " ")
                    .slice(0, 10)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Wristwear Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wristwear (13)</Text>
        <Text style={styles.description}>
          Full body mode required to see wristwear.
        </Text>
        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {(["watches", "bracelets"] as const).map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryTab,
                wristwearCategory === cat && styles.selectedTab,
              ]}
              onPress={() => setWristwearCategory(cat)}
            >
              <Text
                style={[
                  styles.tabText,
                  wristwearCategory === cat && styles.selectedTabText,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {getWristwearForCategory().map((wristwear) => (
              <Pressable
                key={wristwear}
                style={[
                  styles.optionButton,
                  (config.accessories.wristwear === wristwear ||
                    (wristwear === "wristwear_none" &&
                      !config.accessories.wristwear)) &&
                    styles.selectedOption,
                ]}
                onPress={() => changeWristwear(wristwear)}
              >
                <AvatarSvgRenderer
                  config={{
                    ...config,
                    accessories: {
                      ...config.accessories,
                      wristwear:
                        wristwear === "wristwear_none" ? null : wristwear,
                    },
                  }}
                  size={50}
                  showBody={true}
                  animated={false}
                />
                <Text style={styles.tinyText}>
                  {wristwear
                    .replace("wristwear_", "")
                    .replace(/_/g, " ")
                    .slice(0, 10)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════
          PHASE 3: Hair System
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Hair Color Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hair Colors (20)</Text>
        <Text style={styles.subsectionTitle}>Natural Colors (15)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {HAIR_COLORS_NATURAL.map((color) => (
              <Pressable
                key={color}
                style={[
                  styles.colorButton,
                  config.hair.color === color && styles.selectedOption,
                ]}
                onPress={() => changeHairColor(color)}
              >
                <DigitalAvatar
                  config={{
                    ...config,
                    hair: { ...config.hair, color },
                  }}
                  size={45}
                />
                <Text style={styles.tinyText}>
                  {color.replace("_", " ").slice(0, 8)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.subsectionTitle}>Fantasy Colors (5)</Text>
        <View style={styles.horizontalRow}>
          {HAIR_COLORS_FANTASY.map((color) => (
            <Pressable
              key={color}
              style={[
                styles.colorButton,
                config.hair.color === color && styles.selectedOption,
              ]}
              onPress={() => changeHairColor(color)}
            >
              <DigitalAvatar
                config={{
                  ...config,
                  hair: { ...config.hair, color },
                }}
                size={45}
              />
              <Text style={styles.tinyText}>
                {color.replace("fantasy_", "")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Hair Style Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hair Styles (50)</Text>
        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {(["short", "medium", "long", "special"] as const).map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.categoryTab,
                hairCategory === cat && styles.selectedTab,
              ]}
              onPress={() => setHairCategory(cat)}
            >
              <Text
                style={[
                  styles.tabText,
                  hairCategory === cat && styles.selectedTabText,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {getHairStylesForCategory().map((style) => (
              <Pressable
                key={style}
                style={[
                  styles.optionButton,
                  config.hair.style === style && styles.selectedOption,
                ]}
                onPress={() => changeHairStyle(style)}
              >
                <DigitalAvatar
                  config={{
                    ...config,
                    hair: { ...config.hair, style },
                  }}
                  size={50}
                />
                <Text style={styles.tinyText}>
                  {style
                    .replace("hair_short_", "")
                    .replace("hair_medium_", "")
                    .replace("hair_long_", "")
                    .replace("hair_bald_", "")
                    .replace("hair_special_", "")
                    .slice(0, 8)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Facial Hair Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Facial Hair (10)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {FACIAL_HAIR_STYLES.map((style) => (
              <Pressable
                key={style}
                style={[
                  styles.optionButton,
                  config.hair.facialHair.style === style &&
                    styles.selectedOption,
                ]}
                onPress={() => changeFacialHairStyle(style)}
              >
                <DigitalAvatar
                  config={{
                    ...config,
                    hair: {
                      ...config.hair,
                      facialHair: { ...config.hair.facialHair, style },
                    },
                  }}
                  size={50}
                />
                <Text style={styles.tinyText}>
                  {style.replace("_", " ").slice(0, 10)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════
          PHASE 2: Eye Features (collapsed)
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Eye Styles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Eye Styles (10)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {EYE_STYLES.map((style) => (
              <Pressable
                key={style}
                style={[
                  styles.optionButton,
                  config.eyes.style === style && styles.selectedOption,
                ]}
                onPress={() => changeEyeStyle(style)}
              >
                <DigitalAvatar
                  config={{ ...config, eyes: { ...config.eyes, style } }}
                  size={50}
                />
                <Text style={styles.optionText}>
                  {style.replace("eye_", "")}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Eyebrow Styles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Eyebrow Styles (9)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalRow}>
            {EYEBROW_STYLES.map((style) => (
              <Pressable
                key={style}
                style={[
                  styles.optionButton,
                  config.eyes.eyebrows.style === style && styles.selectedOption,
                ]}
                onPress={() => changeEyebrowStyle(style)}
              >
                <DigitalAvatar
                  config={{
                    ...config,
                    eyes: {
                      ...config.eyes,
                      eyebrows: { ...config.eyes.eyebrows, style },
                    },
                  }}
                  size={50}
                />
                <Text style={styles.optionText}>
                  {style.replace("brow_", "")}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Eyelash Styles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Eyelash Styles (5)</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show Eyelashes</Text>
          <Switch value={showEyelashes} onValueChange={toggleEyelashes} />
        </View>
        {showEyelashes && (
          <View style={styles.horizontalRow}>
            {EYELASH_STYLES.filter((s) => s !== "none").map((style) => (
              <Pressable
                key={style}
                style={[
                  styles.optionButton,
                  config.eyes.eyelashes.style === style &&
                    styles.selectedOption,
                ]}
                onPress={() => changeEyelashStyle(style)}
              >
                <DigitalAvatar
                  config={{
                    ...config,
                    eyes: {
                      ...config.eyes,
                      eyelashes: { enabled: true, style, color: "#1A1A1A" },
                    },
                  }}
                  size={50}
                />
                <Text style={styles.optionText}>{style}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Skin Tone Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skin Tones (12)</Text>
        <View style={styles.skinToneGrid}>
          {SKIN_TONES.map((tone) => (
            <Pressable
              key={tone}
              style={[
                styles.skinToneButton,
                config.body.skinTone === tone && styles.selectedSkinTone,
              ]}
              onPress={() => changeSkinTone(tone)}
            >
              <DigitalAvatar
                config={{
                  ...config,
                  body: { ...config.body, skinTone: tone },
                }}
                size={40}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Debug Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Config</Text>
        <Text style={styles.debugText}>
          Skin: {config.body.skinTone}
          {"\n"}Body Shape: {config.body.shape}
          {"\n"}Eyes: {config.eyes.style} | Color: {config.eyes.color}
          {"\n"}Eyebrows: {config.eyes.eyebrows.style}
          {"\n"}Eyelashes:{" "}
          {config.eyes.eyelashes.enabled
            ? config.eyes.eyelashes.style
            : "disabled"}
          {"\n"}Hair: {config.hair.style}
          {"\n"}Hair Color: {config.hair.color}
          {"\n"}Facial Hair: {config.hair.facialHair.style}
          {"\n"}Nose: {config.nose.style}
          {"\n"}Mouth: {config.mouth.style}
          {"\n"}Top: {config.clothing.top ?? "none"}
          {"\n"}Bottom: {config.clothing.bottom ?? "none"}
          {"\n"}Outfit: {config.clothing.outfit ?? "none"}
          {"\n"}Animated: {animated ? "Yes" : "No"}
          {"\n"}Full Body: {showFullBody ? "Yes" : "No"}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    color: "#333",
  },
  previewContainer: {
    alignItems: "center",
    marginVertical: 20,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 8,
    color: "#666",
  },
  description: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  horizontalRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
  },
  avatarLabel: {
    alignItems: "center",
    gap: 4,
  },
  smallLabel: {
    fontSize: 11,
    color: "#666",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: "#333",
  },
  optionButton: {
    alignItems: "center",
    padding: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    minWidth: 65,
  },
  colorButton: {
    alignItems: "center",
    padding: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    minWidth: 55,
  },
  selectedOption: {
    borderColor: "#4A90D9",
    backgroundColor: "#E8F4FD",
  },
  optionText: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  tinyText: {
    fontSize: 8,
    color: "#888",
    marginTop: 2,
    textAlign: "center",
  },
  categoryTabs: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 8,
  },
  categoryTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  selectedTab: {
    backgroundColor: "#4A90D9",
  },
  tabText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  selectedTabText: {
    color: "#FFFFFF",
  },
  skinToneGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  skinToneButton: {
    padding: 4,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedSkinTone: {
    borderColor: "#4A90D9",
    backgroundColor: "#E8F4FD",
  },
  debugText: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#666",
    lineHeight: 16,
  },
});
