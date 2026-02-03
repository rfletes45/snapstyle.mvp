/**
 * Avatar Assets Barrel Export
 *
 * Central export point for all avatar asset definitions.
 */

// Skin tones
export { SKIN_TONES, getSkinTone, getSkinToneColors } from "./skinTones";

// Face shapes
export { FACE_SHAPES, getFaceShape } from "./faceShapes";

// Eye styles, eyebrows, and eyelashes
export {
  DEFAULT_EYEBROW_STYLE,
  DEFAULT_EYELASH_STYLE,
  DEFAULT_EYE_COLOR,
  DEFAULT_EYE_STYLE,
  EYEBROW_STYLES,
  EYELASH_STYLES,
  EYE_COLORS,
  EYE_STYLES,
  getEyeColor,
  getEyeStyle,
  getEyebrowStyle,
  getEyelashStyle,
} from "./eyeStyles";

// Nose styles
export { DEFAULT_NOSE_STYLE, NOSE_STYLES, getNoseStyle } from "./noseStyles";

// Mouth styles
export {
  DEFAULT_LIP_COLOR,
  DEFAULT_MOUTH_STYLE,
  LIP_COLORS,
  MOUTH_STYLES,
  getLipColor,
  getMouthStyle,
} from "./mouthStyles";

// Ear styles
export { DEFAULT_EAR_STYLE, EAR_STYLES, getEarStyle } from "./earStyles";

// Hair colors
export {
  DEFAULT_HAIR_COLOR,
  HAIR_COLORS,
  getFantasyHairColors,
  getHairColor,
  getHairColorSafe,
  getHairGradientColors,
  getNaturalHairColors,
} from "./hairColors";

// Hair styles
export {
  DEFAULT_HAIR_STYLE,
  HAIR_STYLES,
  getBaldHairStyles,
  getHairStyle,
  getHairStyleSafe,
  getHairStylesByCategory,
  getHairStylesByTexture,
  getHatCompatibleHairStyles,
  getLongHairStyles,
  getMediumHairStyles,
  getShortHairStyles,
  getSpecialHairStyles,
} from "./hairStyles";

// Facial hair styles
export {
  DEFAULT_FACIAL_HAIR_STYLE,
  FACIAL_HAIR_STYLES,
  getAllFacialHairStyles,
  getBeardStyles,
  getFacialHairStyle,
  getFacialHairStyleSafe,
  getMustacheStyles,
} from "./facialHairStyles";

// Body shapes
export {
  BODY_SHAPES,
  DEFAULT_BODY_SHAPE,
  getBodyShape,
  getBodyShapeSafe,
} from "./bodyShapes";
export type { BodyShapeData } from "./bodyShapes";

// Clothing - Tops
export {
  CLOTHING_TOPS,
  DEFAULT_CLOTHING_TOP,
  getAllClothingTopIds,
  getClothingTop,
  getClothingTopSafe,
  getClothingTopsByCategory,
  getClothingTopsByLayer,
  getColorizableTops,
} from "./clothingTops";
export type {
  ClothingRarity,
  ClothingTopCategory,
  ClothingTopData,
} from "./clothingTops";

// Clothing - Bottoms
export {
  CLOTHING_BOTTOMS,
  DEFAULT_CLOTHING_BOTTOM,
  getAllClothingBottomIds,
  getClothingBottom,
  getClothingBottomSafe,
  getClothingBottomsByCategory,
  getClothingBottomsByLength,
  getColorizableBottoms,
} from "./clothingBottoms";
export type {
  ClothingBottomCategory,
  ClothingBottomData,
} from "./clothingBottoms";

// Clothing - Outfits
export {
  CLOTHING_OUTFITS,
  DEFAULT_OUTFIT,
  getAllOutfitIds,
  getDresses,
  getJumpsuitsAndRompers,
  getOutfit,
  getOutfitSafe,
  getOutfitsByCategory,
} from "./clothingOutfits";
export type { ClothingOutfitData, OutfitCategory } from "./clothingOutfits";

// =============================================================================
// ACCESSORIES (Phase 5)
// =============================================================================

// Headwear
export {
  DEFAULT_HEADWEAR,
  HEADWEAR,
  getAllHeadwearIds,
  getColorizableHeadwear,
  getHeadwear,
  getHeadwearByCategory,
  getHeadwearSafe,
} from "./headwear";
export type {
  HeadwearCategory,
  HeadwearData,
  HeadwearHairInteraction,
  HeadwearRarity,
} from "./headwear";

// Eyewear
export {
  DEFAULT_EYEWEAR,
  EYEWEAR,
  getAllEyewearIds,
  getColorizableEyewear,
  getEyewear,
  getEyewearByCategory,
  getEyewearSafe,
  getGlasses,
  getSunglasses,
} from "./eyewear";
export type { EyewearCategory, EyewearData, EyewearRarity } from "./eyewear";

// Neckwear
export {
  DEFAULT_NECKWEAR,
  NECKWEAR,
  getAllNeckwearIds,
  getColorizableNeckwear,
  getFormalNeckwear,
  getJewelryNeckwear,
  getNeckwear,
  getNeckwearByCategory,
  getNeckwearByRarity,
  getNeckwearSafe,
  getScarves,
} from "./neckwear";
export type {
  NeckwearCategory,
  NeckwearData,
  NeckwearRarity,
} from "./neckwear";

// Earwear
export {
  DEFAULT_EARWEAR,
  EARWEAR,
  getAllEarwearIds,
  getColorizableEarwear,
  getDangleEarwear,
  getEarwear,
  getEarwearByCategory,
  getEarwearByRarity,
  getEarwearSafe,
  getHoopEarwear,
  getStudEarwear,
} from "./earwear";
export type { EarwearCategory, EarwearData, EarwearRarity } from "./earwear";

// Wristwear
export {
  DEFAULT_WRISTWEAR,
  WRISTWEAR,
  getAllWristwearIds,
  getBracelets,
  getColorizableWristwear,
  getWatches,
  getWristwear,
  getWristwearByCategory,
  getWristwearByHand,
  getWristwearByRarity,
  getWristwearSafe,
  hasLeftWristwear,
  hasRightWristwear,
} from "./wristwear";
export type {
  WristwearCategory,
  WristwearData,
  WristwearHand,
  WristwearRarity,
} from "./wristwear";
