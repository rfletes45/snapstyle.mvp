# Visual Enhancement Packages (Condensed)

Last updated: 2026-02-19

This file is retained as a short reference target for Three.js/UI enhancement comments.

## Active Stack

- `three`
- `expo-gl`
- `expo-three`

## Integration Notes

- 3D effects are feature-flag gated (`THREE_JS_FEATURES`).
- On web, native GL constraints may disable these paths.
- Effects are decorative overlays; gameplay logic must remain independent.

## Primary References

- `constants/featureFlags.ts`
- `docs/CONFIGURATION.md`
- `docs/PERFORMANCE.md`
