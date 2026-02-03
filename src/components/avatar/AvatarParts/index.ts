/**
 * Avatar Parts Barrel Export
 *
 * Individual SVG components for avatar body parts.
 * These are composed by AvatarSvgRenderer to create the full avatar.
 */

// Body
export { BodySvg, NeckSvg } from "./Body";
export type { BodySvgProps, NeckSvgProps } from "./Body";

// Clothing
export {
  ClothingBottomSvg,
  ClothingOutfitSvg,
  ClothingTopSvg,
  FullClothingSvg,
} from "./Clothing";
export type {
  ClothingBottomProps,
  ClothingOutfitProps,
  ClothingTopProps,
  FullClothingProps,
} from "./Clothing";

// Facial Features
export { EarsSvg } from "./Ears";
export { EyesSvg } from "./Eyes";
export { FacialHairSvg } from "./FacialHair";
export type { FacialHairSvgProps } from "./FacialHair";
export { HairBackSvg, HairFrontSvg, HairSvg } from "./Hair";
export type { CombinedHairProps, HairSvgProps } from "./Hair";
export { HeadSvg } from "./Head";
export { MouthSvg } from "./Mouth";
export { NoseSvg } from "./Nose";

// Accessories (Phase 5)
export {
  EarwearSvg,
  isDangleEarwear,
  isHoopEarwear,
  isStudEarwear,
} from "./Earwear";
export type { EarwearProps } from "./Earwear";
export { EyewearSvg, getEyewearLensOpacity, isSunglasses } from "./Eyewear";
export {
  HeadwearSvg,
  doesHeadwearHideHair,
  getHeadwearHairInteraction,
} from "./Headwear";
export { NeckwearSvg, isFormalNeckwear, isJewelry, isScarf } from "./Neckwear";
export type { NeckwearProps } from "./Neckwear";
export {
  WristwearSvg,
  isBracelet,
  isMetallicWristwear,
  isWatch,
} from "./Wristwear";
export type { WristwearProps } from "./Wristwear";
