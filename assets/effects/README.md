# Face Effect Assets

This directory will contain the PNG/SVG assets for AR face effects.

## Expected Files

Each effect in `faceDetectionService.ts` references an asset path here:

| Effect        | File                | Category    |
| ------------- | ------------------- | ----------- |
| Flower Crown  | `flower_crown.png`  | accessories |
| Dog Filter    | `dog_mask.png`      | masks       |
| Cat Filter    | `cat_mask.png`      | masks       |
| Sunglasses    | `sunglasses.png`    | accessories |
| Glasses       | `glasses.png`       | accessories |
| Crown         | `crown.png`         | accessories |
| Skull Mask    | `skull_mask.png`    | masks       |
| Golden Mask   | `golden_mask.png`   | masks       |
| Heart Eyes    | `heart_eyes.png`    | expressions |
| Devil Horns   | `devil_horns.png`   | expressions |
| Tears         | `tears.png`         | expressions |
| Nose Blush    | `nose_blush.png`    | expressions |
| Bunny Ears    | `bunny_ears.png`    | overlays    |
| Butterfly     | `butterfly.png`     | overlays    |
| Rainbow Mouth | `rainbow_mouth.png` | overlays    |
| Ice Crown     | `ice_crown.png`     | overlays    |

## Asset Guidelines

- **Format**: PNG with transparency (alpha channel)
- **Resolution**: 512×512px recommended (will be scaled at runtime)
- **Orientation**: Face-forward, centered
- **Background**: Transparent

## Current State

Assets are currently rendered as **procedural Skia shapes** in
`FaceEffectOverlay.tsx`. When real PNG assets are created, update the
`EFFECT_ASSETS` map in that component to reference them via `require()`.
