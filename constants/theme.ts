/**
 * Vibe Design System - Multi-Theme Support
 *
 * 14 Beautiful Themes:
 * 1. Catppuccin Latte (Light) - Original warm pastels
 * 2. Catppuccin Mocha (Dark) - Original deep tones
 * 3. AMOLED Black - True black for OLED screens
 * 4. Neo Tokyo - Cyberpunk neon aesthetic
 * 5. Retro Wave - 80s synthwave vibes
 * 6. Rose Garden - Soft pink pastels
 * 7. Ocean Breeze - Calm blue tones
 * 8. Mint Fresh - Cool green pastels
 * 9. Sunset Glow - Warm orange/coral
 * 10. Lavender Dream - Purple soft tones
 * 11. Dracula - Popular dark theme
 * 12. Nord - Arctic, north-bluish colors
 * 13. Solarized Light - Precision colors for readability
 * 14. Gruvbox Dark - Retro groove colors
 *
 * Single source of truth for:
 * - Color tokens per theme
 * - React Native Paper theme
 * - React Navigation theme
 * - Spacing, radius, typography, elevation
 */

import type { Theme as NavigationTheme } from "@react-navigation/native";
import { Platform } from "react-native";
import type { MD3Theme } from "react-native-paper";
import {
  MD3DarkTheme,
  MD3LightTheme,
  configureFonts,
} from "react-native-paper";

// ============================================================================
// THEME IDENTIFIERS
// ============================================================================

export type ThemeId =
  | "catppuccin-latte" // Light - Original
  | "catppuccin-mocha" // Dark - Original
  | "amoled" // Super dark OLED
  | "amoled-oled-blue" // AMOLED with blue accents
  | "amoled-blood-moon" // AMOLED with red accents
  | "amoled-emerald" // AMOLED with emerald green
  | "amoled-royal-purple" // AMOLED with royal purple
  | "amoled-sunset-orange" // AMOLED with sunset orange
  | "neo-tokyo" // Cyberpunk neon
  | "retro-wave" // 80s synthwave
  | "vaporwave" // Aesthetic pink/teal
  | "aurora-borealis" // Northern lights
  | "neon-sunset" // Vibrant sunset neon
  | "electric-lime" // High energy green
  | "galaxy-purple" // Deep space purple
  | "rose-garden" // Pink pastels
  | "ocean-breeze" // Blue tones
  | "mint-fresh" // Green pastels
  | "sunset-glow" // Warm orange/coral
  | "lavender-dream" // Purple soft
  | "peach-blossom" // Soft peach pastels
  | "sky-cotton" // Light blue cotton candy
  | "honeydew-mint" // Soft green honeydew
  | "dracula" // Popular dark
  | "nord" // Arctic blue
  | "solarized-light" // Precision colors
  | "gruvbox-dark" // Retro groove
  | "night-owl" // Sarah Drasner's accessible theme
  | "aura" // Dalton Menezes purple neon
  | "jellyfish"; // Pawel Borkar hot pink

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  isDark: boolean;
  category: "light" | "dark" | "amoled" | "pastel" | "vibrant";
  previewColors: [string, string, string]; // For theme picker preview
}

export const THEME_METADATA: Record<ThemeId, ThemeMeta> = {
  "catppuccin-latte": {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    description: "Warm, soft pastels for a cozy light experience",
    isDark: false,
    category: "light",
    previewColors: ["#eff1f5", "#8839ef", "#fe640b"],
  },
  "catppuccin-mocha": {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    description: "Rich, deep tones for comfortable night viewing",
    isDark: true,
    category: "dark",
    previewColors: ["#1e1e2e", "#cba6f7", "#fab387"],
  },
  amoled: {
    id: "amoled",
    name: "AMOLED Black",
    description: "True black for OLED battery savings",
    isDark: true,
    category: "amoled",
    previewColors: ["#000000", "#bb86fc", "#03dac6"],
  },
  "neo-tokyo": {
    id: "neo-tokyo",
    name: "Neo Tokyo",
    description: "Cyberpunk neon aesthetic with hot pink accents",
    isDark: true,
    category: "vibrant",
    previewColors: ["#0d0d1a", "#ff2a6d", "#05d9e8"],
  },
  "retro-wave": {
    id: "retro-wave",
    name: "Retro Wave",
    description: "80s synthwave purple and cyan vibes",
    isDark: true,
    category: "vibrant",
    previewColors: ["#1a0a2e", "#ff71ce", "#01cdfe"],
  },
  "rose-garden": {
    id: "rose-garden",
    name: "Rose Garden",
    description: "Soft pink pastels for a feminine touch",
    isDark: false,
    category: "pastel",
    previewColors: ["#fff5f7", "#e91e63", "#ff7f7f"],
  },
  "ocean-breeze": {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    description: "Calm blue tones inspired by the sea",
    isDark: false,
    category: "pastel",
    previewColors: ["#f0f7ff", "#0288d1", "#4dd0e1"],
  },
  "mint-fresh": {
    id: "mint-fresh",
    name: "Mint Fresh",
    description: "Cool green pastels for a refreshing feel",
    isDark: false,
    category: "pastel",
    previewColors: ["#f0fff4", "#00c853", "#69f0ae"],
  },
  "sunset-glow": {
    id: "sunset-glow",
    name: "Sunset Glow",
    description: "Warm orange and coral sunset tones",
    isDark: false,
    category: "pastel",
    previewColors: ["#fff8f0", "#ff6f61", "#ffc107"],
  },
  "lavender-dream": {
    id: "lavender-dream",
    name: "Lavender Dream",
    description: "Soft purple tones for a dreamy aesthetic",
    isDark: false,
    category: "pastel",
    previewColors: ["#f8f5ff", "#7c4dff", "#b388ff"],
  },
  "peach-blossom": {
    id: "peach-blossom",
    name: "Peach Blossom",
    description: "Soft peach and coral pastels",
    isDark: false,
    category: "pastel",
    previewColors: ["#fff5f0", "#ffab91", "#ff8a65"],
  },
  "sky-cotton": {
    id: "sky-cotton",
    name: "Sky Cotton",
    description: "Light blue cotton candy pastels",
    isDark: false,
    category: "pastel",
    previewColors: ["#f0f8ff", "#87ceeb", "#4fc3f7"],
  },
  "honeydew-mint": {
    id: "honeydew-mint",
    name: "Honeydew Mint",
    description: "Soft honeydew green pastels",
    isDark: false,
    category: "pastel",
    previewColors: ["#f0fff0", "#98fb98", "#66cdaa"],
  },
  dracula: {
    id: "dracula",
    name: "Dracula",
    description: "Popular dark theme with vibrant accents",
    isDark: true,
    category: "dark",
    previewColors: ["#282a36", "#bd93f9", "#ff79c6"],
  },
  nord: {
    id: "nord",
    name: "Nord",
    description: "Arctic, north-bluish calm colors",
    isDark: true,
    category: "dark",
    previewColors: ["#2e3440", "#81a1c1", "#88c0d0"],
  },
  "solarized-light": {
    id: "solarized-light",
    name: "Solarized Light",
    description: "Precision colors designed for readability",
    isDark: false,
    category: "light",
    previewColors: ["#fdf6e3", "#268bd2", "#2aa198"],
  },
  "gruvbox-dark": {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    description: "Retro groove colors with warm tones",
    isDark: true,
    category: "dark",
    previewColors: ["#282828", "#fe8019", "#8ec07c"],
  },
  "night-owl": {
    id: "night-owl",
    name: "Night Owl",
    description: "Sarah Drasner's accessible dark theme for night coders",
    isDark: true,
    category: "dark",
    previewColors: ["#011627", "#c792ea", "#7fdbca"],
  },
  aura: {
    id: "aura",
    name: "Aura",
    description: "Dalton Menezes' purple neon aesthetic",
    isDark: true,
    category: "vibrant",
    previewColors: ["#15141b", "#a277ff", "#61ffca"],
  },
  jellyfish: {
    id: "jellyfish",
    name: "Jellyfish",
    description: "Pawel Borkar's vibrant hot pink theme",
    isDark: true,
    category: "vibrant",
    previewColors: ["#1e1e28", "#ff0055", "#00d9ff"],
  },
  "amoled-oled-blue": {
    id: "amoled-oled-blue",
    name: "AMOLED Blue",
    description: "True black with electric blue accents",
    isDark: true,
    category: "amoled",
    previewColors: ["#000000", "#00d4ff", "#0099cc"],
  },
  "amoled-blood-moon": {
    id: "amoled-blood-moon",
    name: "Blood Moon",
    description: "True black with deep red accents",
    isDark: true,
    category: "amoled",
    previewColors: ["#000000", "#ff2d2d", "#8b0000"],
  },
  "amoled-emerald": {
    id: "amoled-emerald",
    name: "AMOLED Emerald",
    description: "True black with emerald green accents",
    isDark: true,
    category: "amoled",
    previewColors: ["#000000", "#50c878", "#2e8b57"],
  },
  "amoled-royal-purple": {
    id: "amoled-royal-purple",
    name: "AMOLED Royal",
    description: "True black with royal purple accents",
    isDark: true,
    category: "amoled",
    previewColors: ["#000000", "#9b59b6", "#6a0dad"],
  },
  "amoled-sunset-orange": {
    id: "amoled-sunset-orange",
    name: "AMOLED Sunset",
    description: "True black with warm sunset orange",
    isDark: true,
    category: "amoled",
    previewColors: ["#000000", "#ff7f50", "#ff4500"],
  },
  vaporwave: {
    id: "vaporwave",
    name: "Vaporwave",
    description: "A E S T H E T I C pink and teal vibes",
    isDark: true,
    category: "vibrant",
    previewColors: ["#1a1a2e", "#ff6ec7", "#00fff9"],
  },
  "aurora-borealis": {
    id: "aurora-borealis",
    name: "Aurora Borealis",
    description: "Northern lights dancing in the sky",
    isDark: true,
    category: "vibrant",
    previewColors: ["#0a192f", "#64ffda", "#7b2cbf"],
  },
  "neon-sunset": {
    id: "neon-sunset",
    name: "Neon Sunset",
    description: "Vibrant sunset with neon glows",
    isDark: true,
    category: "vibrant",
    previewColors: ["#1a0a1a", "#ff6b35", "#f7931e"],
  },
  "electric-lime": {
    id: "electric-lime",
    name: "Electric Lime",
    description: "High energy green neon theme",
    isDark: true,
    category: "vibrant",
    previewColors: ["#0a1a0a", "#32cd32", "#00ff41"],
  },
  "galaxy-purple": {
    id: "galaxy-purple",
    name: "Galaxy Purple",
    description: "Deep space with cosmic purple hues",
    isDark: true,
    category: "vibrant",
    previewColors: ["#0d0221", "#9d4edd", "#c77dff"],
  },
};

// ============================================================================
// BASE COLOR PALETTES
// ============================================================================

/**
 * Catppuccin Latte (Light Mode) - Warm, soft pastels
 */
export const Latte = {
  base: "#eff1f5",
  mantle: "#e6e9ef",
  crust: "#dce0e8",
  surface0: "#ccd0da",
  surface1: "#bcc0cc",
  surface2: "#acb0be",
  text: "#4c4f69",
  subtext1: "#5c5f77",
  subtext0: "#6c6f85",
  overlay2: "#7c7f93",
  overlay1: "#8c8fa1",
  overlay0: "#9ca0b0",
  rosewater: "#dc8a78",
  flamingo: "#dd7878",
  pink: "#ea76cb",
  mauve: "#8839ef",
  red: "#d20f39",
  maroon: "#e64553",
  peach: "#fe640b",
  yellow: "#df8e1d",
  green: "#40a02b",
  teal: "#179299",
  sky: "#04a5e5",
  sapphire: "#209fb5",
  blue: "#1e66f5",
  lavender: "#7287fd",
};

/**
 * Catppuccin Mocha (Dark Mode) - Rich, deep tones
 */
export const Mocha = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",
  rosewater: "#f5e0dc",
  flamingo: "#f2cdcd",
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  sapphire: "#74c7ec",
  blue: "#89b4fa",
  lavender: "#b4befe",
};

/**
 * AMOLED Pure Black
 */
export const Amoled = {
  base: "#000000",
  mantle: "#000000",
  crust: "#000000",
  surface0: "#0a0a0a",
  surface1: "#121212",
  surface2: "#1a1a1a",
  text: "#ffffff",
  subtext1: "#e0e0e0",
  subtext0: "#b0b0b0",
  overlay2: "#808080",
  overlay1: "#606060",
  overlay0: "#404040",
  primary: "#bb86fc",
  secondary: "#03dac6",
  accent: "#cf6679",
  error: "#ff5252",
  success: "#4caf50",
  warning: "#ffab00",
};

/**
 * Neo Tokyo - Cyberpunk Neon
 */
export const NeoTokyo = {
  base: "#0d0d1a",
  mantle: "#080810",
  crust: "#050508",
  surface0: "#1a1a2e",
  surface1: "#252542",
  surface2: "#2f2f52",
  text: "#eaeaea",
  subtext1: "#c0c0c0",
  subtext0: "#909090",
  overlay2: "#707070",
  overlay1: "#505050",
  overlay0: "#303030",
  // Neon colors
  hotPink: "#ff2a6d",
  neonPink: "#ff6b9d",
  electricBlue: "#05d9e8",
  cyan: "#00fff7",
  neonPurple: "#9d4edd",
  neonYellow: "#f9f871",
  laserGreen: "#39ff14",
  error: "#ff3366",
  warning: "#f9f871",
  success: "#39ff14",
};

/**
 * Retro Wave - 80s Synthwave
 */
export const RetroWave = {
  base: "#1a0a2e",
  mantle: "#0f0518",
  crust: "#08020c",
  surface0: "#2a1040",
  surface1: "#3a1855",
  surface2: "#4a2068",
  text: "#fff4f4",
  subtext1: "#e8d8e8",
  subtext0: "#c8b8c8",
  overlay2: "#a898a8",
  overlay1: "#887888",
  overlay0: "#685868",
  // Synthwave colors
  synthPink: "#ff71ce",
  synthPurple: "#b967ff",
  synthBlue: "#01cdfe",
  synthYellow: "#fffb96",
  synthOrange: "#ff9f43",
  gridPurple: "#9d4edd",
  sunsetOrange: "#ff6b35",
  error: "#ff4757",
  warning: "#feca57",
  success: "#5fcd87",
};

/**
 * Rose Garden - Soft Pink Pastels
 */
export const RoseGarden = {
  base: "#fff5f7",
  mantle: "#ffe4e8",
  crust: "#ffd5db",
  surface0: "#ffc5ce",
  surface1: "#ffb5c1",
  surface2: "#ffa5b4",
  text: "#5c3d47",
  subtext1: "#7a5562",
  subtext0: "#98707d",
  overlay2: "#b08a95",
  overlay1: "#c8a5ae",
  overlay0: "#dfc0c8",
  // Rose accents
  rose: "#e91e63",
  roseDark: "#c2185b",
  roseLight: "#f48fb1",
  coral: "#ff7f7f",
  peach: "#ffab91",
  blush: "#fce4ec",
  error: "#d32f2f",
  warning: "#ff9800",
  success: "#4caf50",
};

/**
 * Ocean Breeze - Calm Blue Tones
 */
export const OceanBreeze = {
  base: "#f0f7ff",
  mantle: "#e3f0ff",
  crust: "#d6e9ff",
  surface0: "#c5dfff",
  surface1: "#b4d5ff",
  surface2: "#a3cbff",
  text: "#1a3a5c",
  subtext1: "#2d5478",
  subtext0: "#406f94",
  overlay2: "#5389af",
  overlay1: "#66a3cb",
  overlay0: "#79bde6",
  // Ocean accents
  deepBlue: "#1565c0",
  oceanBlue: "#0288d1",
  skyBlue: "#03a9f4",
  seafoam: "#4dd0e1",
  aqua: "#80deea",
  mist: "#e1f5fe",
  error: "#e53935",
  warning: "#fb8c00",
  success: "#43a047",
};

/**
 * Mint Fresh - Cool Green Pastels
 */
export const MintFresh = {
  base: "#f0fff4",
  mantle: "#e0f7e9",
  crust: "#d0efde",
  surface0: "#b8e6cf",
  surface1: "#a0ddc0",
  surface2: "#88d4b1",
  text: "#1b4332",
  subtext1: "#2d5a45",
  subtext0: "#407158",
  overlay2: "#53886b",
  overlay1: "#669f7e",
  overlay0: "#79b691",
  // Mint accents
  mint: "#00c853",
  mintDark: "#00a844",
  mintLight: "#69f0ae",
  teal: "#009688",
  sage: "#8bc34a",
  lime: "#c6ff00",
  error: "#ff5252",
  warning: "#ffab00",
  success: "#00e676",
};

/**
 * Sunset Glow - Warm Orange/Coral
 */
export const SunsetGlow = {
  base: "#fff8f0",
  mantle: "#ffefe0",
  crust: "#ffe6d0",
  surface0: "#ffdcbc",
  surface1: "#ffd2a8",
  surface2: "#ffc894",
  text: "#5c3d1e",
  subtext1: "#7a5832",
  subtext0: "#987346",
  overlay2: "#b08e5a",
  overlay1: "#c8a96e",
  overlay0: "#dfc482",
  // Sunset accents
  coral: "#ff6f61",
  peach: "#ffab91",
  orange: "#ff9800",
  gold: "#ffc107",
  amber: "#ffb300",
  warmPink: "#ff8a80",
  error: "#f44336",
  warning: "#ff9800",
  success: "#8bc34a",
};

/**
 * Lavender Dream - Purple Soft Tones
 */
export const LavenderDream = {
  base: "#f8f5ff",
  mantle: "#efe8ff",
  crust: "#e6dbff",
  surface0: "#d9ccff",
  surface1: "#ccbdff",
  surface2: "#bfaeff",
  text: "#3d2d5c",
  subtext1: "#574578",
  subtext0: "#715d94",
  overlay2: "#8b75b0",
  overlay1: "#a58dcc",
  overlay0: "#bfa5e8",
  // Lavender accents
  lavender: "#7c4dff",
  lavenderDark: "#651fff",
  lavenderLight: "#b388ff",
  violet: "#9c27b0",
  purple: "#673ab7",
  lilac: "#e1bee7",
  error: "#f44336",
  warning: "#ff9800",
  success: "#4caf50",
};

/**
 * Dracula - Popular Dark Theme
 */
export const Dracula = {
  base: "#282a36",
  mantle: "#21222c",
  crust: "#191a21",
  surface0: "#343746",
  surface1: "#414558",
  surface2: "#4d5269",
  text: "#f8f8f2",
  subtext1: "#e2e2dc",
  subtext0: "#bfbfb8",
  overlay2: "#9c9c96",
  overlay1: "#797974",
  overlay0: "#565652",
  // Dracula accents
  cyan: "#8be9fd",
  green: "#50fa7b",
  orange: "#ffb86c",
  pink: "#ff79c6",
  purple: "#bd93f9",
  red: "#ff5555",
  yellow: "#f1fa8c",
  comment: "#6272a4",
  error: "#ff5555",
  warning: "#ffb86c",
  success: "#50fa7b",
};

/**
 * Nord - Arctic North-Bluish
 */
export const Nord = {
  base: "#2e3440",
  mantle: "#292e39",
  crust: "#242933",
  surface0: "#3b4252",
  surface1: "#434c5e",
  surface2: "#4c566a",
  text: "#eceff4",
  subtext1: "#e5e9f0",
  subtext0: "#d8dee9",
  overlay2: "#b4bece",
  overlay1: "#909dae",
  overlay0: "#6c7d8f",
  // Nord accents
  frost1: "#8fbcbb",
  frost2: "#88c0d0",
  frost3: "#81a1c1",
  frost4: "#5e81ac",
  aurora1: "#bf616a",
  aurora2: "#d08770",
  aurora3: "#ebcb8b",
  aurora4: "#a3be8c",
  aurora5: "#b48ead",
  error: "#bf616a",
  warning: "#ebcb8b",
  success: "#a3be8c",
};

/**
 * Solarized Light
 */
export const SolarizedLight = {
  base: "#fdf6e3",
  mantle: "#eee8d5",
  crust: "#e4ddc8",
  surface0: "#ddd6c1",
  surface1: "#d3ccb6",
  surface2: "#c9c2ab",
  text: "#657b83",
  subtext1: "#586e75",
  subtext0: "#839496",
  overlay2: "#93a1a1",
  overlay1: "#a3b1b1",
  overlay0: "#b3c1c1",
  // Solarized accents
  yellow: "#b58900",
  orange: "#cb4b16",
  red: "#dc322f",
  magenta: "#d33682",
  violet: "#6c71c4",
  blue: "#268bd2",
  cyan: "#2aa198",
  green: "#859900",
  error: "#dc322f",
  warning: "#b58900",
  success: "#859900",
};

/**
 * Gruvbox Dark - Retro Groove
 */
export const GruvboxDark = {
  base: "#282828",
  mantle: "#1d2021",
  crust: "#141617",
  surface0: "#3c3836",
  surface1: "#504945",
  surface2: "#665c54",
  text: "#ebdbb2",
  subtext1: "#d5c4a1",
  subtext0: "#bdae93",
  overlay2: "#a89984",
  overlay1: "#928374",
  overlay0: "#7c6f64",
  // Gruvbox accents
  red: "#fb4934",
  green: "#b8bb26",
  yellow: "#fabd2f",
  blue: "#83a598",
  purple: "#d3869b",
  aqua: "#8ec07c",
  orange: "#fe8019",
  gray: "#928374",
  error: "#fb4934",
  warning: "#fabd2f",
  success: "#b8bb26",
};

/**
 * AMOLED OLED Blue - True black with electric blue
 */
export const AmoledOledBlue = {
  base: "#000000",
  mantle: "#000000",
  crust: "#000000",
  surface0: "#050a0f",
  surface1: "#0a1520",
  surface2: "#0f1f2d",
  text: "#ffffff",
  subtext1: "#e0f0ff",
  subtext0: "#a0c8e0",
  overlay2: "#607080",
  overlay1: "#405060",
  overlay0: "#203040",
  // Electric blue accents
  primary: "#00d4ff",
  secondary: "#0099cc",
  accent: "#4de8ff",
  neonBlue: "#00b8ff",
  deepBlue: "#0066aa",
  iceBlue: "#b3e5fc",
  error: "#ff4444",
  success: "#00e676",
  warning: "#ffab00",
};

/**
 * AMOLED Blood Moon - True black with deep red
 */
export const AmoledBloodMoon = {
  base: "#000000",
  mantle: "#000000",
  crust: "#000000",
  surface0: "#0f0505",
  surface1: "#1a0a0a",
  surface2: "#2a1010",
  text: "#ffffff",
  subtext1: "#ffe0e0",
  subtext0: "#e0a0a0",
  overlay2: "#806060",
  overlay1: "#604040",
  overlay0: "#402020",
  // Blood red accents
  primary: "#ff2d2d",
  secondary: "#cc0000",
  accent: "#ff6666",
  bloodRed: "#8b0000",
  crimson: "#dc143c",
  rosePink: "#ff6b6b",
  error: "#ff0000",
  success: "#4caf50",
  warning: "#ff9800",
};

/**
 * Vaporwave - A E S T H E T I C
 */
export const Vaporwave = {
  base: "#1a1a2e",
  mantle: "#0f0f1e",
  crust: "#08080f",
  surface0: "#2a2a4e",
  surface1: "#3a3a6e",
  surface2: "#4a4a8e",
  text: "#fff0f5",
  subtext1: "#e8d8e8",
  subtext0: "#c8b8d8",
  overlay2: "#a898b8",
  overlay1: "#887898",
  overlay0: "#685878",
  // Vaporwave colors
  hotPink: "#ff6ec7",
  magenta: "#ff00ff",
  cyan: "#00fff9",
  teal: "#00b4d8",
  purple: "#9b59b6",
  lavender: "#e0b0ff",
  peach: "#ffb3ba",
  yellow: "#fdfd96",
  error: "#ff4757",
  warning: "#feca57",
  success: "#00e676",
};

/**
 * Aurora Borealis - Northern lights
 */
export const AuroraBorealis = {
  base: "#0a192f",
  mantle: "#061022",
  crust: "#030815",
  surface0: "#112240",
  surface1: "#1d3557",
  surface2: "#264570",
  text: "#ccd6f6",
  subtext1: "#a8b2d1",
  subtext0: "#8892b0",
  overlay2: "#687590",
  overlay1: "#4a5568",
  overlay0: "#2d3748",
  // Aurora colors
  teal: "#64ffda",
  green: "#00ff87",
  blue: "#57c7ff",
  purple: "#7b2cbf",
  magenta: "#c77dff",
  pink: "#ff6bcb",
  yellow: "#f0e68c",
  orange: "#ff7b00",
  error: "#ff6b6b",
  warning: "#ffd93d",
  success: "#6bff8a",
};

/**
 * Neon Sunset - Vibrant sunset glow
 */
export const NeonSunset = {
  base: "#1a0a1a",
  mantle: "#100610",
  crust: "#080308",
  surface0: "#2d1530",
  surface1: "#402040",
  surface2: "#532a50",
  text: "#fff5f0",
  subtext1: "#ffe8e0",
  subtext0: "#e0c0b8",
  overlay2: "#b89888",
  overlay1: "#987068",
  overlay0: "#784848",
  // Neon sunset colors
  orange: "#ff6b35",
  coral: "#f7931e",
  gold: "#ffa500",
  pink: "#ff1493",
  magenta: "#ff00aa",
  red: "#ff4444",
  yellow: "#ffff00",
  peach: "#ffb89a",
  error: "#ff3333",
  warning: "#ffd700",
  success: "#32cd32",
};

/**
 * Electric Lime - High energy green
 */
export const ElectricLime = {
  base: "#0a1a0a",
  mantle: "#051005",
  crust: "#020802",
  surface0: "#0f2a0f",
  surface1: "#153a15",
  surface2: "#1a4a1a",
  text: "#f0fff0",
  subtext1: "#d8ffd8",
  subtext0: "#a8e8a8",
  overlay2: "#78b878",
  overlay1: "#589858",
  overlay0: "#387838",
  // Electric lime colors
  lime: "#32cd32",
  neonGreen: "#00ff41",
  chartreuse: "#7fff00",
  mint: "#98fb98",
  forest: "#228b22",
  teal: "#20b2aa",
  yellow: "#adff2f",
  cyan: "#00ffcc",
  error: "#ff4444",
  warning: "#ffd700",
  success: "#00ff7f",
};

/**
 * Galaxy Purple - Deep space cosmic
 */
export const GalaxyPurple = {
  base: "#0d0221",
  mantle: "#080118",
  crust: "#04010c",
  surface0: "#150535",
  surface1: "#1e0a4a",
  surface2: "#280f5f",
  text: "#f8f0ff",
  subtext1: "#e8d8ff",
  subtext0: "#c8b0e8",
  overlay2: "#9880c0",
  overlay1: "#785898",
  overlay0: "#583870",
  // Galaxy colors
  purple: "#9d4edd",
  violet: "#c77dff",
  magenta: "#e040fb",
  pink: "#ff6bcb",
  blue: "#7b68ee",
  cyan: "#00d4ff",
  nebula: "#6a0dad",
  starlight: "#e6e6fa",
  error: "#ff5252",
  warning: "#ffc107",
  success: "#69f0ae",
};

/**
 * Night Owl - Sarah Drasner's accessible dark theme
 */
export const NightOwl = {
  base: "#011627",
  mantle: "#010e1a",
  crust: "#000810",
  surface0: "#0b2942",
  surface1: "#1d3b53",
  surface2: "#2d4f67",
  text: "#d6deeb",
  subtext1: "#b2c0d0",
  subtext0: "#8da2b8",
  overlay2: "#6d8ca0",
  overlay1: "#4d6c80",
  overlay0: "#3d5c70",
  // Night Owl accent colors
  purple: "#c792ea",
  green: "#7fdbca",
  yellow: "#ecc48d",
  orange: "#f78c6c",
  red: "#ef5350",
  blue: "#82aaff",
  cyan: "#21c7a8",
  pink: "#ff5874",
  lavender: "#b4a7d6",
  error: "#ef5350",
  warning: "#ecc48d",
  success: "#7fdbca",
};

/**
 * Aura - Dalton Menezes' purple neon aesthetic
 */
export const Aura = {
  base: "#15141b",
  mantle: "#110f18",
  crust: "#0a0810",
  surface0: "#1c1b22",
  surface1: "#252430",
  surface2: "#2d2b3d",
  text: "#edecee",
  subtext1: "#cdccce",
  subtext0: "#b4b4b4",
  overlay2: "#6d6d6d",
  overlay1: "#525156",
  overlay0: "#3d3a45",
  // Aura accent colors
  purple: "#a277ff",
  green: "#61ffca",
  orange: "#ffca85",
  pink: "#f694ff",
  blue: "#82e2ff",
  red: "#ff6767",
  selection: "#3d375e7f",
  cyan: "#61ffca",
  error: "#ff6767",
  warning: "#ffca85",
  success: "#61ffca",
};

/**
 * Jellyfish - Pawel Borkar's hot pink theme
 */
export const Jellyfish = {
  base: "#1e1e28",
  mantle: "#16161e",
  crust: "#0f0f14",
  surface0: "#282835",
  surface1: "#32324a",
  surface2: "#3c3c5a",
  text: "#f8f8f2",
  subtext1: "#e8e8e0",
  subtext0: "#c8c8c0",
  overlay2: "#909090",
  overlay1: "#707080",
  overlay0: "#505060",
  // Jellyfish accent colors
  hotPink: "#ff0055",
  magenta: "#ff00aa",
  cyan: "#00d9ff",
  teal: "#00b4d8",
  purple: "#bd00ff",
  lavender: "#e0b0ff",
  coral: "#ff6b6b",
  gold: "#ffcc00",
  error: "#ff4466",
  warning: "#ffcc00",
  success: "#00ff88",
};

/**
 * AMOLED Emerald - True black with emerald green
 */
export const AmoledEmerald = {
  base: "#000000",
  mantle: "#000000",
  crust: "#000000",
  surface0: "#001a0d",
  surface1: "#00331a",
  surface2: "#004d26",
  text: "#ffffff",
  subtext1: "#e0fff0",
  subtext0: "#a0d8c0",
  overlay2: "#508060",
  overlay1: "#306040",
  overlay0: "#104020",
  // Emerald accents
  primary: "#50c878",
  secondary: "#2e8b57",
  accent: "#98fb98",
  mint: "#00fa9a",
  forest: "#228b22",
  lime: "#32cd32",
  error: "#ff4444",
  success: "#00ff7f",
  warning: "#ffcc00",
};

/**
 * AMOLED Royal Purple - True black with royal purple
 */
export const AmoledRoyalPurple = {
  base: "#000000",
  mantle: "#000000",
  crust: "#000000",
  surface0: "#0d001a",
  surface1: "#1a0033",
  surface2: "#26004d",
  text: "#ffffff",
  subtext1: "#f0e0ff",
  subtext0: "#c0a0d8",
  overlay2: "#705080",
  overlay1: "#503060",
  overlay0: "#301040",
  // Royal purple accents
  primary: "#9b59b6",
  secondary: "#6a0dad",
  accent: "#da70d6",
  violet: "#8a2be2",
  lavender: "#e6e6fa",
  orchid: "#ba55d3",
  error: "#ff4444",
  success: "#4caf50",
  warning: "#ffab00",
};

/**
 * AMOLED Sunset Orange - True black with sunset orange
 */
export const AmoledSunsetOrange = {
  base: "#000000",
  mantle: "#000000",
  crust: "#000000",
  surface0: "#1a0d00",
  surface1: "#331a00",
  surface2: "#4d2600",
  text: "#ffffff",
  subtext1: "#fff0e0",
  subtext0: "#d8c0a0",
  overlay2: "#806050",
  overlay1: "#604030",
  overlay0: "#402010",
  // Sunset orange accents
  primary: "#ff7f50",
  secondary: "#ff4500",
  accent: "#ffa07a",
  coral: "#ff6347",
  gold: "#ffd700",
  amber: "#ffbf00",
  error: "#ff0000",
  success: "#32cd32",
  warning: "#ffd700",
};

/**
 * Peach Blossom - Soft peach pastels
 */
export const PeachBlossom = {
  base: "#fff5f0",
  mantle: "#ffe8e0",
  crust: "#ffdcd0",
  surface0: "#ffcfc0",
  surface1: "#ffc2b0",
  surface2: "#ffb5a0",
  text: "#5c3d30",
  subtext1: "#7a5545",
  subtext0: "#986d5a",
  overlay2: "#b0856f",
  overlay1: "#c89d84",
  overlay0: "#e0b599",
  // Peach accents
  peach: "#ffab91",
  coral: "#ff8a65",
  salmon: "#fa8072",
  apricot: "#fbceb1",
  blush: "#ffe4e1",
  rose: "#ff6f61",
  error: "#d32f2f",
  warning: "#ff9800",
  success: "#4caf50",
};

/**
 * Sky Cotton - Light blue cotton candy
 */
export const SkyCotton = {
  base: "#f0f8ff",
  mantle: "#e6f2ff",
  crust: "#dceeff",
  surface0: "#cce6ff",
  surface1: "#bcdeff",
  surface2: "#acd6ff",
  text: "#1a3a5c",
  subtext1: "#2d5478",
  subtext0: "#406f94",
  overlay2: "#5389af",
  overlay1: "#66a3cb",
  overlay0: "#79bde6",
  // Sky cotton accents
  sky: "#87ceeb",
  azure: "#4fc3f7",
  powder: "#b0e0e6",
  baby: "#89cff0",
  periwinkle: "#ccccff",
  cornflower: "#6495ed",
  error: "#e53935",
  warning: "#fb8c00",
  success: "#43a047",
};

/**
 * Honeydew Mint - Soft honeydew green
 */
export const HoneydewMint = {
  base: "#f0fff0",
  mantle: "#e6ffe6",
  crust: "#dcffdc",
  surface0: "#ccffcc",
  surface1: "#bcffbc",
  surface2: "#acffac",
  text: "#1b4332",
  subtext1: "#2d5a45",
  subtext0: "#407158",
  overlay2: "#53886b",
  overlay1: "#669f7e",
  overlay0: "#79b691",
  // Honeydew accents
  honeydew: "#98fb98",
  mint: "#66cdaa",
  seafoam: "#3cb371",
  spring: "#00ff7f",
  lime: "#90ee90",
  celadon: "#ace1af",
  error: "#ff5252",
  warning: "#ffab00",
  success: "#00e676",
};

// ============================================================================
// SEMANTIC COLOR MAPPING
// ============================================================================

export interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceElevated: string;

  // Primary brand
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;

  // Secondary/Accent
  secondary: string;
  secondaryContainer: string;
  onSecondary: string;
  onSecondaryContainer: string;

  // Tertiary (for special accents)
  tertiary: string;
  tertiaryContainer: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  // Status
  success: string;
  successContainer: string;
  warning: string;
  warningContainer: string;
  error: string;
  errorContainer: string;
  info: string;
  infoContainer: string;

  // Ritual (streak) colors
  ritual: string;
  ritualGlow: string;

  // Cards
  cardConnection: string;
  cardConnectionBorder: string;
  cardRequest: string;
  cardRequestBorder: string;
  cardSent: string;

  // Borders & Dividers
  border: string;
  divider: string;
  outline: string;

  // Overlay
  overlay: string;
  overlayLight: string;

  // Tab bar
  tabActive: string;
  tabInactive: string;

  // Header
  headerBackground: string;
  headerText: string;

  // Special theme-specific colors (optional)
  accent1?: string;
  accent2?: string;
  accent3?: string;
  glow?: string;

  // Message colors (for enhanced theme differentiation)
  messageSentBackground?: string;
  messageSentText?: string;
  messageReceivedBackground?: string;
  messageReceivedText?: string;

  // Chat type differentiation
  dmAccent?: string;
  groupChatAccent?: string;
}

// ============================================================================
// THEME COLOR DEFINITIONS
// ============================================================================

export const CatppuccinLatteColors: ThemeColors = {
  background: Latte.base,
  surface: "#ffffff",
  surfaceVariant: Latte.mantle,
  surfaceElevated: "#ffffff",
  primary: Latte.mauve,
  primaryContainer: "#f3e8ff",
  onPrimary: "#ffffff",
  onPrimaryContainer: Latte.mauve,
  secondary: Latte.peach,
  secondaryContainer: "#fff0e6",
  onSecondary: "#ffffff",
  onSecondaryContainer: Latte.peach,
  tertiary: Latte.teal,
  tertiaryContainer: "#e0f7f7",
  text: Latte.text,
  textSecondary: Latte.subtext1,
  textMuted: Latte.overlay1,
  textOnPrimary: "#ffffff",
  success: Latte.green,
  successContainer: "#e8f5e9",
  warning: Latte.yellow,
  warningContainer: "#fff8e1",
  error: Latte.red,
  errorContainer: "#ffebee",
  info: Latte.sapphire,
  infoContainer: "#e3f2fd",
  ritual: Latte.flamingo,
  ritualGlow: Latte.rosewater,
  cardConnection: "#f5f0ff",
  cardConnectionBorder: Latte.lavender,
  cardRequest: "#fff5eb",
  cardRequestBorder: Latte.peach,
  cardSent: Latte.mantle,
  border: Latte.surface1,
  divider: Latte.surface0,
  outline: Latte.surface2,
  overlay: "rgba(76, 79, 105, 0.5)",
  overlayLight: "rgba(76, 79, 105, 0.3)",
  tabActive: Latte.mauve,
  tabInactive: Latte.overlay1,
  headerBackground: "#ffffff",
  headerText: Latte.text,
};

export const CatppuccinMochaColors: ThemeColors = {
  background: Mocha.base,
  surface: Mocha.surface0,
  surfaceVariant: Mocha.mantle,
  surfaceElevated: Mocha.surface1,
  primary: Mocha.mauve,
  primaryContainer: "#3d2466",
  onPrimary: Mocha.crust,
  onPrimaryContainer: Mocha.lavender,
  secondary: Mocha.peach,
  secondaryContainer: "#5c3d2e",
  onSecondary: Mocha.crust,
  onSecondaryContainer: Mocha.peach,
  tertiary: Mocha.teal,
  tertiaryContainer: "#1d4040",
  text: Mocha.text,
  textSecondary: Mocha.subtext1,
  textMuted: Mocha.overlay1,
  textOnPrimary: Mocha.crust,
  success: Mocha.green,
  successContainer: "#2d4a2d",
  warning: Mocha.yellow,
  warningContainer: "#4a4428",
  error: Mocha.red,
  errorContainer: "#4a2d2d",
  info: Mocha.sapphire,
  infoContainer: "#2d3d4a",
  ritual: Mocha.flamingo,
  ritualGlow: Mocha.rosewater,
  cardConnection: "#2d2640",
  cardConnectionBorder: Mocha.lavender,
  cardRequest: "#402d28",
  cardRequestBorder: Mocha.peach,
  cardSent: Mocha.surface0,
  border: Mocha.surface1,
  divider: Mocha.surface0,
  outline: Mocha.surface2,
  overlay: "rgba(0, 0, 0, 0.6)",
  overlayLight: "rgba(0, 0, 0, 0.4)",
  tabActive: Mocha.mauve,
  tabInactive: Mocha.overlay1,
  headerBackground: Mocha.mantle,
  headerText: Mocha.text,
};

export const AmoledColors: ThemeColors = {
  background: Amoled.base,
  surface: Amoled.surface0,
  surfaceVariant: Amoled.mantle,
  surfaceElevated: Amoled.surface1,
  primary: Amoled.primary,
  primaryContainer: "#2d1f4a",
  onPrimary: "#000000",
  onPrimaryContainer: "#e0c0ff",
  secondary: Amoled.secondary,
  secondaryContainer: "#003d3d",
  onSecondary: "#000000",
  onSecondaryContainer: Amoled.secondary,
  tertiary: Amoled.accent,
  tertiaryContainer: "#4a1f2d",
  text: Amoled.text,
  textSecondary: Amoled.subtext1,
  textMuted: Amoled.overlay1,
  textOnPrimary: "#000000",
  success: Amoled.success,
  successContainer: "#1b3d1b",
  warning: Amoled.warning,
  warningContainer: "#3d3d00",
  error: Amoled.error,
  errorContainer: "#3d1b1b",
  info: "#2196f3",
  infoContainer: "#1b2d3d",
  ritual: Amoled.accent,
  ritualGlow: "#ff8a80",
  cardConnection: "#0a0a14",
  cardConnectionBorder: Amoled.primary,
  cardRequest: "#140a0a",
  cardRequestBorder: Amoled.accent,
  cardSent: Amoled.surface0,
  border: Amoled.surface1,
  divider: "#1a1a1a",
  outline: Amoled.surface2,
  overlay: "rgba(0, 0, 0, 0.85)",
  overlayLight: "rgba(0, 0, 0, 0.7)",
  tabActive: Amoled.primary,
  tabInactive: Amoled.overlay1,
  headerBackground: "#000000",
  headerText: Amoled.text,
  glow: Amoled.primary,
};

export const NeoTokyoColors: ThemeColors = {
  background: NeoTokyo.base,
  surface: NeoTokyo.surface0,
  surfaceVariant: NeoTokyo.mantle,
  surfaceElevated: NeoTokyo.surface1,
  primary: NeoTokyo.hotPink,
  primaryContainer: "#3d0a1f",
  onPrimary: "#000000",
  onPrimaryContainer: NeoTokyo.neonPink,
  secondary: NeoTokyo.electricBlue,
  secondaryContainer: "#0a2d3d",
  onSecondary: "#000000",
  onSecondaryContainer: NeoTokyo.cyan,
  tertiary: NeoTokyo.neonPurple,
  tertiaryContainer: "#2d1f4a",
  text: NeoTokyo.text,
  textSecondary: NeoTokyo.subtext1,
  textMuted: NeoTokyo.overlay1,
  textOnPrimary: "#000000",
  success: NeoTokyo.laserGreen,
  successContainer: "#0a3d0a",
  warning: NeoTokyo.neonYellow,
  warningContainer: "#3d3d0a",
  error: NeoTokyo.error,
  errorContainer: "#3d0a14",
  info: NeoTokyo.electricBlue,
  infoContainer: "#0a1f3d",
  ritual: NeoTokyo.hotPink,
  ritualGlow: NeoTokyo.neonPink,
  cardConnection: "#1a0a2d",
  cardConnectionBorder: NeoTokyo.neonPurple,
  cardRequest: "#2d0a14",
  cardRequestBorder: NeoTokyo.hotPink,
  cardSent: NeoTokyo.surface0,
  border: NeoTokyo.surface1,
  divider: "#1a1a2e",
  outline: NeoTokyo.surface2,
  overlay: "rgba(0, 0, 0, 0.8)",
  overlayLight: "rgba(13, 13, 26, 0.7)",
  tabActive: NeoTokyo.hotPink,
  tabInactive: NeoTokyo.overlay1,
  headerBackground: NeoTokyo.mantle,
  headerText: NeoTokyo.text,
  accent1: NeoTokyo.cyan,
  accent2: NeoTokyo.laserGreen,
  accent3: NeoTokyo.neonYellow,
  glow: NeoTokyo.hotPink,
  // Enhanced message colors - user requested red sent, blue received
  messageSentBackground: "#3d0a14", // Dark red background
  messageSentText: NeoTokyo.hotPink, // Hot pink/red text
  messageReceivedBackground: "#0a1f3d", // Dark blue background
  messageReceivedText: NeoTokyo.electricBlue, // Electric blue text
  // Chat type differentiation - DMs vs Group chats
  dmAccent: NeoTokyo.neonPurple, // Purple for DMs
  groupChatAccent: NeoTokyo.cyan, // Cyan for group chats
};

export const RetroWaveColors: ThemeColors = {
  background: RetroWave.base,
  surface: RetroWave.surface0,
  surfaceVariant: RetroWave.mantle,
  surfaceElevated: RetroWave.surface1,
  primary: RetroWave.synthPink,
  primaryContainer: "#3d1440",
  onPrimary: "#000000",
  onPrimaryContainer: RetroWave.synthPink,
  secondary: RetroWave.synthBlue,
  secondaryContainer: "#0a3d4a",
  onSecondary: "#000000",
  onSecondaryContainer: RetroWave.synthBlue,
  tertiary: RetroWave.synthPurple,
  tertiaryContainer: "#2d144a",
  text: RetroWave.text,
  textSecondary: RetroWave.subtext1,
  textMuted: RetroWave.overlay1,
  textOnPrimary: "#000000",
  success: RetroWave.success,
  successContainer: "#1b3d2d",
  warning: RetroWave.warning,
  warningContainer: "#3d3d1b",
  error: RetroWave.error,
  errorContainer: "#3d1420",
  info: RetroWave.synthBlue,
  infoContainer: "#0a2d3d",
  ritual: RetroWave.synthOrange,
  ritualGlow: RetroWave.synthYellow,
  cardConnection: "#2a1040",
  cardConnectionBorder: RetroWave.synthPurple,
  cardRequest: "#401428",
  cardRequestBorder: RetroWave.synthPink,
  cardSent: RetroWave.surface0,
  border: RetroWave.surface1,
  divider: "#2a1040",
  outline: RetroWave.surface2,
  overlay: "rgba(0, 0, 0, 0.75)",
  overlayLight: "rgba(26, 10, 46, 0.6)",
  tabActive: RetroWave.synthPink,
  tabInactive: RetroWave.overlay1,
  headerBackground: RetroWave.mantle,
  headerText: RetroWave.text,
  accent1: RetroWave.synthBlue,
  accent2: RetroWave.synthYellow,
  accent3: RetroWave.sunsetOrange,
  glow: RetroWave.synthPink,
};

export const RoseGardenColors: ThemeColors = {
  background: RoseGarden.base,
  surface: "#ffffff",
  surfaceVariant: RoseGarden.mantle,
  surfaceElevated: "#ffffff",
  primary: RoseGarden.rose,
  primaryContainer: "#fce4ec",
  onPrimary: "#ffffff",
  onPrimaryContainer: RoseGarden.roseDark,
  secondary: RoseGarden.coral,
  secondaryContainer: "#ffe0e0",
  onSecondary: "#ffffff",
  onSecondaryContainer: "#c62828",
  tertiary: RoseGarden.peach,
  tertiaryContainer: "#ffe8e0",
  text: RoseGarden.text,
  textSecondary: RoseGarden.subtext1,
  textMuted: RoseGarden.overlay1,
  textOnPrimary: "#ffffff",
  success: RoseGarden.success,
  successContainer: "#e8f5e9",
  warning: RoseGarden.warning,
  warningContainer: "#fff3e0",
  error: RoseGarden.error,
  errorContainer: "#ffebee",
  info: "#2196f3",
  infoContainer: "#e3f2fd",
  ritual: RoseGarden.rose,
  ritualGlow: RoseGarden.roseLight,
  cardConnection: "#fff0f3",
  cardConnectionBorder: RoseGarden.roseLight,
  cardRequest: "#fff5f0",
  cardRequestBorder: RoseGarden.peach,
  cardSent: RoseGarden.mantle,
  border: RoseGarden.surface1,
  divider: RoseGarden.surface0,
  outline: RoseGarden.surface2,
  overlay: "rgba(92, 61, 71, 0.5)",
  overlayLight: "rgba(92, 61, 71, 0.3)",
  tabActive: RoseGarden.rose,
  tabInactive: RoseGarden.overlay1,
  headerBackground: "#ffffff",
  headerText: RoseGarden.text,
};

export const OceanBreezeColors: ThemeColors = {
  background: OceanBreeze.base,
  surface: "#ffffff",
  surfaceVariant: OceanBreeze.mantle,
  surfaceElevated: "#ffffff",
  primary: OceanBreeze.oceanBlue,
  primaryContainer: "#e1f5fe",
  onPrimary: "#ffffff",
  onPrimaryContainer: OceanBreeze.deepBlue,
  secondary: OceanBreeze.seafoam,
  secondaryContainer: "#e0f7fa",
  onSecondary: "#004d40",
  onSecondaryContainer: "#00838f",
  tertiary: OceanBreeze.skyBlue,
  tertiaryContainer: "#e3f9ff",
  text: OceanBreeze.text,
  textSecondary: OceanBreeze.subtext1,
  textMuted: OceanBreeze.overlay1,
  textOnPrimary: "#ffffff",
  success: OceanBreeze.success,
  successContainer: "#e8f5e9",
  warning: OceanBreeze.warning,
  warningContainer: "#fff3e0",
  error: OceanBreeze.error,
  errorContainer: "#ffebee",
  info: OceanBreeze.oceanBlue,
  infoContainer: "#e1f5fe",
  ritual: OceanBreeze.skyBlue,
  ritualGlow: OceanBreeze.aqua,
  cardConnection: "#e8f4ff",
  cardConnectionBorder: OceanBreeze.skyBlue,
  cardRequest: "#e0f7fa",
  cardRequestBorder: OceanBreeze.seafoam,
  cardSent: OceanBreeze.mantle,
  border: OceanBreeze.surface1,
  divider: OceanBreeze.surface0,
  outline: OceanBreeze.surface2,
  overlay: "rgba(26, 58, 92, 0.5)",
  overlayLight: "rgba(26, 58, 92, 0.3)",
  tabActive: OceanBreeze.oceanBlue,
  tabInactive: OceanBreeze.overlay1,
  headerBackground: "#ffffff",
  headerText: OceanBreeze.text,
};

export const MintFreshColors: ThemeColors = {
  background: MintFresh.base,
  surface: "#ffffff",
  surfaceVariant: MintFresh.mantle,
  surfaceElevated: "#ffffff",
  primary: MintFresh.mint,
  primaryContainer: "#e8f5e9",
  onPrimary: "#ffffff",
  onPrimaryContainer: MintFresh.mintDark,
  secondary: MintFresh.teal,
  secondaryContainer: "#e0f2f1",
  onSecondary: "#ffffff",
  onSecondaryContainer: "#00695c",
  tertiary: MintFresh.sage,
  tertiaryContainer: "#f1f8e9",
  text: MintFresh.text,
  textSecondary: MintFresh.subtext1,
  textMuted: MintFresh.overlay1,
  textOnPrimary: "#ffffff",
  success: MintFresh.success,
  successContainer: "#e8f5e9",
  warning: MintFresh.warning,
  warningContainer: "#fff8e1",
  error: MintFresh.error,
  errorContainer: "#ffebee",
  info: "#2196f3",
  infoContainer: "#e3f2fd",
  ritual: MintFresh.mint,
  ritualGlow: MintFresh.mintLight,
  cardConnection: "#e8fff0",
  cardConnectionBorder: MintFresh.mintLight,
  cardRequest: "#e0f7f0",
  cardRequestBorder: MintFresh.teal,
  cardSent: MintFresh.mantle,
  border: MintFresh.surface1,
  divider: MintFresh.surface0,
  outline: MintFresh.surface2,
  overlay: "rgba(27, 67, 50, 0.5)",
  overlayLight: "rgba(27, 67, 50, 0.3)",
  tabActive: MintFresh.mint,
  tabInactive: MintFresh.overlay1,
  headerBackground: "#ffffff",
  headerText: MintFresh.text,
};

export const SunsetGlowColors: ThemeColors = {
  background: SunsetGlow.base,
  surface: "#ffffff",
  surfaceVariant: SunsetGlow.mantle,
  surfaceElevated: "#ffffff",
  primary: SunsetGlow.coral,
  primaryContainer: "#ffecb3",
  onPrimary: "#ffffff",
  onPrimaryContainer: "#e65100",
  secondary: SunsetGlow.orange,
  secondaryContainer: "#fff3e0",
  onSecondary: "#ffffff",
  onSecondaryContainer: "#e65100",
  tertiary: SunsetGlow.gold,
  tertiaryContainer: "#fff8e1",
  text: SunsetGlow.text,
  textSecondary: SunsetGlow.subtext1,
  textMuted: SunsetGlow.overlay1,
  textOnPrimary: "#ffffff",
  success: SunsetGlow.success,
  successContainer: "#f1f8e9",
  warning: SunsetGlow.warning,
  warningContainer: "#fff3e0",
  error: SunsetGlow.error,
  errorContainer: "#ffebee",
  info: "#2196f3",
  infoContainer: "#e3f2fd",
  ritual: SunsetGlow.coral,
  ritualGlow: SunsetGlow.warmPink,
  cardConnection: "#fff5e8",
  cardConnectionBorder: SunsetGlow.peach,
  cardRequest: "#fff0e0",
  cardRequestBorder: SunsetGlow.orange,
  cardSent: SunsetGlow.mantle,
  border: SunsetGlow.surface1,
  divider: SunsetGlow.surface0,
  outline: SunsetGlow.surface2,
  overlay: "rgba(92, 61, 30, 0.5)",
  overlayLight: "rgba(92, 61, 30, 0.3)",
  tabActive: SunsetGlow.coral,
  tabInactive: SunsetGlow.overlay1,
  headerBackground: "#ffffff",
  headerText: SunsetGlow.text,
};

export const LavenderDreamColors: ThemeColors = {
  background: LavenderDream.base,
  surface: "#ffffff",
  surfaceVariant: LavenderDream.mantle,
  surfaceElevated: "#ffffff",
  primary: LavenderDream.lavender,
  primaryContainer: "#ede7f6",
  onPrimary: "#ffffff",
  onPrimaryContainer: LavenderDream.lavenderDark,
  secondary: LavenderDream.violet,
  secondaryContainer: "#f3e5f5",
  onSecondary: "#ffffff",
  onSecondaryContainer: "#7b1fa2",
  tertiary: LavenderDream.purple,
  tertiaryContainer: "#ede7f6",
  text: LavenderDream.text,
  textSecondary: LavenderDream.subtext1,
  textMuted: LavenderDream.overlay1,
  textOnPrimary: "#ffffff",
  success: LavenderDream.success,
  successContainer: "#e8f5e9",
  warning: LavenderDream.warning,
  warningContainer: "#fff3e0",
  error: LavenderDream.error,
  errorContainer: "#ffebee",
  info: "#2196f3",
  infoContainer: "#e3f2fd",
  ritual: LavenderDream.lavender,
  ritualGlow: LavenderDream.lavenderLight,
  cardConnection: "#f5f0ff",
  cardConnectionBorder: LavenderDream.lavenderLight,
  cardRequest: "#faf0ff",
  cardRequestBorder: LavenderDream.violet,
  cardSent: LavenderDream.mantle,
  border: LavenderDream.surface1,
  divider: LavenderDream.surface0,
  outline: LavenderDream.surface2,
  overlay: "rgba(61, 45, 92, 0.5)",
  overlayLight: "rgba(61, 45, 92, 0.3)",
  tabActive: LavenderDream.lavender,
  tabInactive: LavenderDream.overlay1,
  headerBackground: "#ffffff",
  headerText: LavenderDream.text,
};

export const DraculaColors: ThemeColors = {
  background: Dracula.base,
  surface: Dracula.surface0,
  surfaceVariant: Dracula.mantle,
  surfaceElevated: Dracula.surface1,
  primary: Dracula.purple,
  primaryContainer: "#2d1f4a",
  onPrimary: Dracula.crust,
  onPrimaryContainer: Dracula.purple,
  secondary: Dracula.pink,
  secondaryContainer: "#3d1f3d",
  onSecondary: Dracula.crust,
  onSecondaryContainer: Dracula.pink,
  tertiary: Dracula.cyan,
  tertiaryContainer: "#1f3d3d",
  text: Dracula.text,
  textSecondary: Dracula.subtext1,
  textMuted: Dracula.comment,
  textOnPrimary: Dracula.crust,
  success: Dracula.green,
  successContainer: "#1f3d1f",
  warning: Dracula.orange,
  warningContainer: "#3d2d1f",
  error: Dracula.red,
  errorContainer: "#3d1f1f",
  info: Dracula.cyan,
  infoContainer: "#1f2d3d",
  ritual: Dracula.pink,
  ritualGlow: Dracula.purple,
  cardConnection: "#2d2640",
  cardConnectionBorder: Dracula.purple,
  cardRequest: "#402d40",
  cardRequestBorder: Dracula.pink,
  cardSent: Dracula.surface0,
  border: Dracula.surface1,
  divider: Dracula.surface0,
  outline: Dracula.surface2,
  overlay: "rgba(0, 0, 0, 0.7)",
  overlayLight: "rgba(0, 0, 0, 0.5)",
  tabActive: Dracula.purple,
  tabInactive: Dracula.comment,
  headerBackground: Dracula.mantle,
  headerText: Dracula.text,
  accent1: Dracula.cyan,
  accent2: Dracula.green,
  accent3: Dracula.yellow,
};

export const NordColors: ThemeColors = {
  background: Nord.base,
  surface: Nord.surface0,
  surfaceVariant: Nord.mantle,
  surfaceElevated: Nord.surface1,
  primary: Nord.frost3,
  primaryContainer: "#2d3a4a",
  onPrimary: Nord.crust,
  onPrimaryContainer: Nord.frost2,
  secondary: Nord.frost1,
  secondaryContainer: "#2d4040",
  onSecondary: Nord.crust,
  onSecondaryContainer: Nord.frost1,
  tertiary: Nord.aurora5,
  tertiaryContainer: "#3d2d40",
  text: Nord.text,
  textSecondary: Nord.subtext1,
  textMuted: Nord.overlay1,
  textOnPrimary: Nord.crust,
  success: Nord.aurora4,
  successContainer: "#2d3d2d",
  warning: Nord.aurora3,
  warningContainer: "#3d3d2d",
  error: Nord.aurora1,
  errorContainer: "#3d2d2d",
  info: Nord.frost2,
  infoContainer: "#2d3a4a",
  ritual: Nord.aurora5,
  ritualGlow: Nord.frost2,
  cardConnection: "#2d3a4a",
  cardConnectionBorder: Nord.frost3,
  cardRequest: "#3d2d40",
  cardRequestBorder: Nord.aurora5,
  cardSent: Nord.surface0,
  border: Nord.surface1,
  divider: Nord.surface0,
  outline: Nord.surface2,
  overlay: "rgba(0, 0, 0, 0.65)",
  overlayLight: "rgba(0, 0, 0, 0.45)",
  tabActive: Nord.frost3,
  tabInactive: Nord.overlay1,
  headerBackground: Nord.mantle,
  headerText: Nord.text,
  accent1: Nord.frost2,
  accent2: Nord.aurora4,
  accent3: Nord.aurora3,
};

export const SolarizedLightColors: ThemeColors = {
  background: SolarizedLight.base,
  surface: "#ffffff",
  surfaceVariant: SolarizedLight.mantle,
  surfaceElevated: "#ffffff",
  primary: SolarizedLight.blue,
  primaryContainer: "#e8f0f8",
  onPrimary: "#ffffff",
  onPrimaryContainer: SolarizedLight.blue,
  secondary: SolarizedLight.cyan,
  secondaryContainer: "#e0f0f0",
  onSecondary: "#ffffff",
  onSecondaryContainer: SolarizedLight.cyan,
  tertiary: SolarizedLight.violet,
  tertiaryContainer: "#f0e8f8",
  text: SolarizedLight.text,
  textSecondary: SolarizedLight.subtext1,
  textMuted: SolarizedLight.overlay1,
  textOnPrimary: "#ffffff",
  success: SolarizedLight.green,
  successContainer: "#f0f8e0",
  warning: SolarizedLight.yellow,
  warningContainer: "#fff8e0",
  error: SolarizedLight.red,
  errorContainer: "#ffe8e8",
  info: SolarizedLight.blue,
  infoContainer: "#e8f0f8",
  ritual: SolarizedLight.orange,
  ritualGlow: SolarizedLight.yellow,
  cardConnection: "#f0f8ff",
  cardConnectionBorder: SolarizedLight.blue,
  cardRequest: "#fff8f0",
  cardRequestBorder: SolarizedLight.orange,
  cardSent: SolarizedLight.mantle,
  border: SolarizedLight.surface1,
  divider: SolarizedLight.surface0,
  outline: SolarizedLight.surface2,
  overlay: "rgba(101, 123, 131, 0.5)",
  overlayLight: "rgba(101, 123, 131, 0.3)",
  tabActive: SolarizedLight.blue,
  tabInactive: SolarizedLight.overlay1,
  headerBackground: "#ffffff",
  headerText: SolarizedLight.text,
};

export const GruvboxDarkColors: ThemeColors = {
  background: GruvboxDark.base,
  surface: GruvboxDark.surface0,
  surfaceVariant: GruvboxDark.mantle,
  surfaceElevated: GruvboxDark.surface1,
  primary: GruvboxDark.orange,
  primaryContainer: "#4a2d1f",
  onPrimary: GruvboxDark.crust,
  onPrimaryContainer: GruvboxDark.orange,
  secondary: GruvboxDark.aqua,
  secondaryContainer: "#2d4a3d",
  onSecondary: GruvboxDark.crust,
  onSecondaryContainer: GruvboxDark.aqua,
  tertiary: GruvboxDark.purple,
  tertiaryContainer: "#3d2d4a",
  text: GruvboxDark.text,
  textSecondary: GruvboxDark.subtext1,
  textMuted: GruvboxDark.gray,
  textOnPrimary: GruvboxDark.crust,
  success: GruvboxDark.green,
  successContainer: "#2d3d1f",
  warning: GruvboxDark.yellow,
  warningContainer: "#3d3d1f",
  error: GruvboxDark.red,
  errorContainer: "#3d1f1f",
  info: GruvboxDark.blue,
  infoContainer: "#2d3d4a",
  ritual: GruvboxDark.orange,
  ritualGlow: GruvboxDark.yellow,
  cardConnection: "#3d362d",
  cardConnectionBorder: GruvboxDark.orange,
  cardRequest: "#3d2d2d",
  cardRequestBorder: GruvboxDark.red,
  cardSent: GruvboxDark.surface0,
  border: GruvboxDark.surface1,
  divider: GruvboxDark.surface0,
  outline: GruvboxDark.surface2,
  overlay: "rgba(0, 0, 0, 0.7)",
  overlayLight: "rgba(0, 0, 0, 0.5)",
  tabActive: GruvboxDark.orange,
  tabInactive: GruvboxDark.gray,
  headerBackground: GruvboxDark.mantle,
  headerText: GruvboxDark.text,
  accent1: GruvboxDark.aqua,
  accent2: GruvboxDark.green,
  accent3: GruvboxDark.yellow,
};

export const AmoledOledBlueColors: ThemeColors = {
  background: AmoledOledBlue.base,
  surface: AmoledOledBlue.surface0,
  surfaceVariant: AmoledOledBlue.mantle,
  surfaceElevated: AmoledOledBlue.surface1,
  primary: AmoledOledBlue.primary,
  primaryContainer: "#002840",
  onPrimary: "#000000",
  onPrimaryContainer: AmoledOledBlue.iceBlue,
  secondary: AmoledOledBlue.secondary,
  secondaryContainer: "#003050",
  onSecondary: "#000000",
  onSecondaryContainer: AmoledOledBlue.neonBlue,
  tertiary: AmoledOledBlue.accent,
  tertiaryContainer: "#003858",
  text: AmoledOledBlue.text,
  textSecondary: AmoledOledBlue.subtext1,
  textMuted: AmoledOledBlue.overlay1,
  textOnPrimary: "#000000",
  success: AmoledOledBlue.success,
  successContainer: "#003318",
  warning: AmoledOledBlue.warning,
  warningContainer: "#332800",
  error: AmoledOledBlue.error,
  errorContainer: "#330000",
  info: AmoledOledBlue.primary,
  infoContainer: "#002840",
  ritual: AmoledOledBlue.neonBlue,
  ritualGlow: AmoledOledBlue.accent,
  cardConnection: "#000810",
  cardConnectionBorder: AmoledOledBlue.primary,
  cardRequest: "#080008",
  cardRequestBorder: AmoledOledBlue.accent,
  cardSent: AmoledOledBlue.surface0,
  border: AmoledOledBlue.surface1,
  divider: "#0a1520",
  outline: AmoledOledBlue.surface2,
  overlay: "rgba(0, 0, 0, 0.9)",
  overlayLight: "rgba(0, 0, 0, 0.75)",
  tabActive: AmoledOledBlue.primary,
  tabInactive: AmoledOledBlue.overlay1,
  headerBackground: "#000000",
  headerText: AmoledOledBlue.text,
  accent1: AmoledOledBlue.neonBlue,
  accent2: AmoledOledBlue.iceBlue,
  accent3: AmoledOledBlue.deepBlue,
  glow: AmoledOledBlue.primary,
};

export const AmoledBloodMoonColors: ThemeColors = {
  background: AmoledBloodMoon.base,
  surface: AmoledBloodMoon.surface0,
  surfaceVariant: AmoledBloodMoon.mantle,
  surfaceElevated: AmoledBloodMoon.surface1,
  primary: AmoledBloodMoon.primary,
  primaryContainer: "#400000",
  onPrimary: "#000000",
  onPrimaryContainer: AmoledBloodMoon.rosePink,
  secondary: AmoledBloodMoon.secondary,
  secondaryContainer: "#330000",
  onSecondary: "#000000",
  onSecondaryContainer: AmoledBloodMoon.crimson,
  tertiary: AmoledBloodMoon.accent,
  tertiaryContainer: "#4a0000",
  text: AmoledBloodMoon.text,
  textSecondary: AmoledBloodMoon.subtext1,
  textMuted: AmoledBloodMoon.overlay1,
  textOnPrimary: "#000000",
  success: AmoledBloodMoon.success,
  successContainer: "#1b3d1b",
  warning: AmoledBloodMoon.warning,
  warningContainer: "#3d2800",
  error: AmoledBloodMoon.error,
  errorContainer: "#4a0000",
  info: "#2196f3",
  infoContainer: "#1b2d3d",
  ritual: AmoledBloodMoon.crimson,
  ritualGlow: AmoledBloodMoon.primary,
  cardConnection: "#100000",
  cardConnectionBorder: AmoledBloodMoon.primary,
  cardRequest: "#180000",
  cardRequestBorder: AmoledBloodMoon.crimson,
  cardSent: AmoledBloodMoon.surface0,
  border: AmoledBloodMoon.surface1,
  divider: "#1a0808",
  outline: AmoledBloodMoon.surface2,
  overlay: "rgba(0, 0, 0, 0.9)",
  overlayLight: "rgba(0, 0, 0, 0.75)",
  tabActive: AmoledBloodMoon.primary,
  tabInactive: AmoledBloodMoon.overlay1,
  headerBackground: "#000000",
  headerText: AmoledBloodMoon.text,
  accent1: AmoledBloodMoon.crimson,
  accent2: AmoledBloodMoon.rosePink,
  accent3: AmoledBloodMoon.bloodRed,
  glow: AmoledBloodMoon.primary,
};

export const VaporwaveColors: ThemeColors = {
  background: Vaporwave.base,
  surface: Vaporwave.surface0,
  surfaceVariant: Vaporwave.mantle,
  surfaceElevated: Vaporwave.surface1,
  primary: Vaporwave.hotPink,
  primaryContainer: "#4a1a40",
  onPrimary: "#000000",
  onPrimaryContainer: Vaporwave.lavender,
  secondary: Vaporwave.cyan,
  secondaryContainer: "#0a4a4a",
  onSecondary: "#000000",
  onSecondaryContainer: Vaporwave.teal,
  tertiary: Vaporwave.purple,
  tertiaryContainer: "#3a1a4a",
  text: Vaporwave.text,
  textSecondary: Vaporwave.subtext1,
  textMuted: Vaporwave.overlay1,
  textOnPrimary: "#000000",
  success: Vaporwave.success,
  successContainer: "#0a3d1f",
  warning: Vaporwave.warning,
  warningContainer: "#3d3d1a",
  error: Vaporwave.error,
  errorContainer: "#3d1420",
  info: Vaporwave.teal,
  infoContainer: "#0a3d4a",
  ritual: Vaporwave.magenta,
  ritualGlow: Vaporwave.hotPink,
  cardConnection: "#2a1a40",
  cardConnectionBorder: Vaporwave.purple,
  cardRequest: "#401a30",
  cardRequestBorder: Vaporwave.hotPink,
  cardSent: Vaporwave.surface0,
  border: Vaporwave.surface1,
  divider: "#2a2a4e",
  outline: Vaporwave.surface2,
  overlay: "rgba(0, 0, 0, 0.75)",
  overlayLight: "rgba(26, 26, 46, 0.6)",
  tabActive: Vaporwave.hotPink,
  tabInactive: Vaporwave.overlay1,
  headerBackground: Vaporwave.mantle,
  headerText: Vaporwave.text,
  accent1: Vaporwave.cyan,
  accent2: Vaporwave.magenta,
  accent3: Vaporwave.yellow,
  glow: Vaporwave.hotPink,
};

export const AuroraBorealisColors: ThemeColors = {
  background: AuroraBorealis.base,
  surface: AuroraBorealis.surface0,
  surfaceVariant: AuroraBorealis.mantle,
  surfaceElevated: AuroraBorealis.surface1,
  primary: AuroraBorealis.teal,
  primaryContainer: "#0a3d40",
  onPrimary: "#000000",
  onPrimaryContainer: AuroraBorealis.green,
  secondary: AuroraBorealis.purple,
  secondaryContainer: "#2d1a4a",
  onSecondary: "#ffffff",
  onSecondaryContainer: AuroraBorealis.magenta,
  tertiary: AuroraBorealis.blue,
  tertiaryContainer: "#1a3d5a",
  text: AuroraBorealis.text,
  textSecondary: AuroraBorealis.subtext1,
  textMuted: AuroraBorealis.overlay1,
  textOnPrimary: "#000000",
  success: AuroraBorealis.success,
  successContainer: "#0a4a2d",
  warning: AuroraBorealis.warning,
  warningContainer: "#4a3d1a",
  error: AuroraBorealis.error,
  errorContainer: "#4a1a1a",
  info: AuroraBorealis.blue,
  infoContainer: "#1a2d4a",
  ritual: AuroraBorealis.magenta,
  ritualGlow: AuroraBorealis.teal,
  cardConnection: "#0a2840",
  cardConnectionBorder: AuroraBorealis.teal,
  cardRequest: "#280a40",
  cardRequestBorder: AuroraBorealis.purple,
  cardSent: AuroraBorealis.surface0,
  border: AuroraBorealis.surface1,
  divider: "#112240",
  outline: AuroraBorealis.surface2,
  overlay: "rgba(0, 0, 0, 0.75)",
  overlayLight: "rgba(10, 25, 47, 0.6)",
  tabActive: AuroraBorealis.teal,
  tabInactive: AuroraBorealis.overlay1,
  headerBackground: AuroraBorealis.mantle,
  headerText: AuroraBorealis.text,
  accent1: AuroraBorealis.green,
  accent2: AuroraBorealis.purple,
  accent3: AuroraBorealis.pink,
  glow: AuroraBorealis.teal,
};

export const NeonSunsetColors: ThemeColors = {
  background: NeonSunset.base,
  surface: NeonSunset.surface0,
  surfaceVariant: NeonSunset.mantle,
  surfaceElevated: NeonSunset.surface1,
  primary: NeonSunset.orange,
  primaryContainer: "#4a1a0a",
  onPrimary: "#000000",
  onPrimaryContainer: NeonSunset.peach,
  secondary: NeonSunset.pink,
  secondaryContainer: "#4a0a2a",
  onSecondary: "#ffffff",
  onSecondaryContainer: NeonSunset.magenta,
  tertiary: NeonSunset.gold,
  tertiaryContainer: "#4a3a0a",
  text: NeonSunset.text,
  textSecondary: NeonSunset.subtext1,
  textMuted: NeonSunset.overlay1,
  textOnPrimary: "#000000",
  success: NeonSunset.success,
  successContainer: "#1a4a1a",
  warning: NeonSunset.warning,
  warningContainer: "#4a4a0a",
  error: NeonSunset.error,
  errorContainer: "#4a0a0a",
  info: "#2196f3",
  infoContainer: "#1a2d4a",
  ritual: NeonSunset.coral,
  ritualGlow: NeonSunset.orange,
  cardConnection: "#2a1520",
  cardConnectionBorder: NeonSunset.orange,
  cardRequest: "#3a0a1a",
  cardRequestBorder: NeonSunset.pink,
  cardSent: NeonSunset.surface0,
  border: NeonSunset.surface1,
  divider: "#2d1530",
  outline: NeonSunset.surface2,
  overlay: "rgba(0, 0, 0, 0.75)",
  overlayLight: "rgba(26, 10, 26, 0.6)",
  tabActive: NeonSunset.orange,
  tabInactive: NeonSunset.overlay1,
  headerBackground: NeonSunset.mantle,
  headerText: NeonSunset.text,
  accent1: NeonSunset.pink,
  accent2: NeonSunset.gold,
  accent3: NeonSunset.coral,
  glow: NeonSunset.orange,
};

export const ElectricLimeColors: ThemeColors = {
  background: ElectricLime.base,
  surface: ElectricLime.surface0,
  surfaceVariant: ElectricLime.mantle,
  surfaceElevated: ElectricLime.surface1,
  primary: ElectricLime.lime,
  primaryContainer: "#0a3d0a",
  onPrimary: "#000000",
  onPrimaryContainer: ElectricLime.mint,
  secondary: ElectricLime.neonGreen,
  secondaryContainer: "#0a4a1a",
  onSecondary: "#000000",
  onSecondaryContainer: ElectricLime.chartreuse,
  tertiary: ElectricLime.teal,
  tertiaryContainer: "#0a4a4a",
  text: ElectricLime.text,
  textSecondary: ElectricLime.subtext1,
  textMuted: ElectricLime.overlay1,
  textOnPrimary: "#000000",
  success: ElectricLime.success,
  successContainer: "#0a4a1f",
  warning: ElectricLime.warning,
  warningContainer: "#4a4a0a",
  error: ElectricLime.error,
  errorContainer: "#4a0a0a",
  info: ElectricLime.cyan,
  infoContainer: "#0a3d4a",
  ritual: ElectricLime.neonGreen,
  ritualGlow: ElectricLime.lime,
  cardConnection: "#0f2a1a",
  cardConnectionBorder: ElectricLime.lime,
  cardRequest: "#1a2a0f",
  cardRequestBorder: ElectricLime.chartreuse,
  cardSent: ElectricLime.surface0,
  border: ElectricLime.surface1,
  divider: "#0f2a0f",
  outline: ElectricLime.surface2,
  overlay: "rgba(0, 0, 0, 0.75)",
  overlayLight: "rgba(10, 26, 10, 0.6)",
  tabActive: ElectricLime.lime,
  tabInactive: ElectricLime.overlay1,
  headerBackground: ElectricLime.mantle,
  headerText: ElectricLime.text,
  accent1: ElectricLime.neonGreen,
  accent2: ElectricLime.chartreuse,
  accent3: ElectricLime.cyan,
  glow: ElectricLime.neonGreen,
};

export const GalaxyPurpleColors: ThemeColors = {
  background: GalaxyPurple.base,
  surface: GalaxyPurple.surface0,
  surfaceVariant: GalaxyPurple.mantle,
  surfaceElevated: GalaxyPurple.surface1,
  primary: GalaxyPurple.purple,
  primaryContainer: "#2a0a4a",
  onPrimary: "#ffffff",
  onPrimaryContainer: GalaxyPurple.starlight,
  secondary: GalaxyPurple.violet,
  secondaryContainer: "#3a1a5a",
  onSecondary: "#000000",
  onSecondaryContainer: GalaxyPurple.pink,
  tertiary: GalaxyPurple.cyan,
  tertiaryContainer: "#0a3d5a",
  text: GalaxyPurple.text,
  textSecondary: GalaxyPurple.subtext1,
  textMuted: GalaxyPurple.overlay1,
  textOnPrimary: "#ffffff",
  success: GalaxyPurple.success,
  successContainer: "#1a4a3d",
  warning: GalaxyPurple.warning,
  warningContainer: "#4a3a0a",
  error: GalaxyPurple.error,
  errorContainer: "#4a1a1a",
  info: GalaxyPurple.cyan,
  infoContainer: "#0a2d4a",
  ritual: GalaxyPurple.magenta,
  ritualGlow: GalaxyPurple.violet,
  cardConnection: "#1a0a3d",
  cardConnectionBorder: GalaxyPurple.purple,
  cardRequest: "#2a0a4a",
  cardRequestBorder: GalaxyPurple.magenta,
  cardSent: GalaxyPurple.surface0,
  border: GalaxyPurple.surface1,
  divider: "#150535",
  outline: GalaxyPurple.surface2,
  overlay: "rgba(0, 0, 0, 0.75)",
  overlayLight: "rgba(13, 2, 33, 0.6)",
  tabActive: GalaxyPurple.purple,
  tabInactive: GalaxyPurple.overlay1,
  headerBackground: GalaxyPurple.mantle,
  headerText: GalaxyPurple.text,
  accent1: GalaxyPurple.violet,
  accent2: GalaxyPurple.cyan,
  accent3: GalaxyPurple.pink,
  glow: GalaxyPurple.purple,
};

export const NightOwlColors: ThemeColors = {
  background: NightOwl.base,
  surface: NightOwl.surface0,
  surfaceVariant: NightOwl.mantle,
  surfaceElevated: NightOwl.surface1,
  primary: NightOwl.purple,
  primaryContainer: "#1d2d4a",
  onPrimary: "#000000",
  onPrimaryContainer: NightOwl.lavender,
  secondary: NightOwl.green,
  secondaryContainer: "#0a3d3d",
  onSecondary: "#000000",
  onSecondaryContainer: NightOwl.cyan,
  tertiary: NightOwl.blue,
  tertiaryContainer: "#1a3d5a",
  text: NightOwl.text,
  textSecondary: NightOwl.subtext1,
  textMuted: NightOwl.overlay1,
  textOnPrimary: "#000000",
  success: NightOwl.success,
  successContainer: "#0a3d2d",
  warning: NightOwl.warning,
  warningContainer: "#3d3d1a",
  error: NightOwl.error,
  errorContainer: "#3d1a1a",
  info: NightOwl.blue,
  infoContainer: "#1a2d4a",
  ritual: NightOwl.pink,
  ritualGlow: NightOwl.purple,
  cardConnection: "#0b2942",
  cardConnectionBorder: NightOwl.purple,
  cardRequest: "#1d3b53",
  cardRequestBorder: NightOwl.orange,
  cardSent: NightOwl.surface0,
  border: NightOwl.surface1,
  divider: "#0b2942",
  outline: NightOwl.surface2,
  overlay: "rgba(0, 0, 0, 0.75)",
  overlayLight: "rgba(1, 22, 39, 0.6)",
  tabActive: NightOwl.purple,
  tabInactive: NightOwl.overlay1,
  headerBackground: NightOwl.mantle,
  headerText: NightOwl.text,
  accent1: NightOwl.green,
  accent2: NightOwl.blue,
  accent3: NightOwl.yellow,
  glow: NightOwl.purple,
};

export const AuraColors: ThemeColors = {
  background: Aura.base,
  surface: Aura.surface0,
  surfaceVariant: Aura.mantle,
  surfaceElevated: Aura.surface1,
  primary: Aura.purple,
  primaryContainer: "#2d1f4a",
  onPrimary: "#000000",
  onPrimaryContainer: Aura.pink,
  secondary: Aura.green,
  secondaryContainer: "#0a3d3d",
  onSecondary: "#000000",
  onSecondaryContainer: Aura.cyan,
  tertiary: Aura.blue,
  tertiaryContainer: "#1a3d5a",
  text: Aura.text,
  textSecondary: Aura.subtext1,
  textMuted: Aura.overlay1,
  textOnPrimary: "#000000",
  success: Aura.success,
  successContainer: "#0a3d2d",
  warning: Aura.warning,
  warningContainer: "#3d3d1a",
  error: Aura.error,
  errorContainer: "#3d1a1a",
  info: Aura.blue,
  infoContainer: "#1a2d4a",
  ritual: Aura.pink,
  ritualGlow: Aura.purple,
  cardConnection: "#1c1b22",
  cardConnectionBorder: Aura.purple,
  cardRequest: "#252430",
  cardRequestBorder: Aura.pink,
  cardSent: Aura.surface0,
  border: Aura.surface1,
  divider: "#1c1b22",
  outline: Aura.surface2,
  overlay: "rgba(0, 0, 0, 0.75)",
  overlayLight: "rgba(21, 20, 27, 0.6)",
  tabActive: Aura.purple,
  tabInactive: Aura.overlay1,
  headerBackground: Aura.mantle,
  headerText: Aura.text,
  accent1: Aura.green,
  accent2: Aura.pink,
  accent3: Aura.orange,
  glow: Aura.purple,
  // Enhanced message colors
  messageSentBackground: "#2d1f4a",
  messageSentText: Aura.purple,
  messageReceivedBackground: "#0a3d3d",
  messageReceivedText: Aura.green,
  dmAccent: Aura.pink,
  groupChatAccent: Aura.blue,
};

export const JellyfishColors: ThemeColors = {
  background: Jellyfish.base,
  surface: Jellyfish.surface0,
  surfaceVariant: Jellyfish.mantle,
  surfaceElevated: Jellyfish.surface1,
  primary: Jellyfish.hotPink,
  primaryContainer: "#3d0a2d",
  onPrimary: "#000000",
  onPrimaryContainer: Jellyfish.coral,
  secondary: Jellyfish.cyan,
  secondaryContainer: "#0a3d4a",
  onSecondary: "#000000",
  onSecondaryContainer: Jellyfish.teal,
  tertiary: Jellyfish.purple,
  tertiaryContainer: "#2d0a4a",
  text: Jellyfish.text,
  textSecondary: Jellyfish.subtext1,
  textMuted: Jellyfish.overlay1,
  textOnPrimary: "#000000",
  success: Jellyfish.success,
  successContainer: "#0a3d1f",
  warning: Jellyfish.warning,
  warningContainer: "#3d3d0a",
  error: Jellyfish.error,
  errorContainer: "#3d0a1a",
  info: Jellyfish.cyan,
  infoContainer: "#0a2d4a",
  ritual: Jellyfish.magenta,
  ritualGlow: Jellyfish.hotPink,
  cardConnection: "#282835",
  cardConnectionBorder: Jellyfish.purple,
  cardRequest: "#32324a",
  cardRequestBorder: Jellyfish.hotPink,
  cardSent: Jellyfish.surface0,
  border: Jellyfish.surface1,
  divider: "#282835",
  outline: Jellyfish.surface2,
  overlay: "rgba(0, 0, 0, 0.75)",
  overlayLight: "rgba(30, 30, 40, 0.6)",
  tabActive: Jellyfish.hotPink,
  tabInactive: Jellyfish.overlay1,
  headerBackground: Jellyfish.mantle,
  headerText: Jellyfish.text,
  accent1: Jellyfish.cyan,
  accent2: Jellyfish.purple,
  accent3: Jellyfish.gold,
  glow: Jellyfish.hotPink,
  // Enhanced message colors
  messageSentBackground: "#3d0a2d",
  messageSentText: Jellyfish.hotPink,
  messageReceivedBackground: "#0a3d4a",
  messageReceivedText: Jellyfish.cyan,
  dmAccent: Jellyfish.magenta,
  groupChatAccent: Jellyfish.teal,
};

export const AmoledEmeraldColors: ThemeColors = {
  background: AmoledEmerald.base,
  surface: AmoledEmerald.surface0,
  surfaceVariant: AmoledEmerald.mantle,
  surfaceElevated: AmoledEmerald.surface1,
  primary: AmoledEmerald.primary,
  primaryContainer: "#003318",
  onPrimary: "#000000",
  onPrimaryContainer: AmoledEmerald.mint,
  secondary: AmoledEmerald.secondary,
  secondaryContainer: "#002610",
  onSecondary: "#000000",
  onSecondaryContainer: AmoledEmerald.lime,
  tertiary: AmoledEmerald.accent,
  tertiaryContainer: "#0a4a2a",
  text: AmoledEmerald.text,
  textSecondary: AmoledEmerald.subtext1,
  textMuted: AmoledEmerald.overlay1,
  textOnPrimary: "#000000",
  success: AmoledEmerald.success,
  successContainer: "#003318",
  warning: AmoledEmerald.warning,
  warningContainer: "#333300",
  error: AmoledEmerald.error,
  errorContainer: "#330000",
  info: AmoledEmerald.lime,
  infoContainer: "#002610",
  ritual: AmoledEmerald.mint,
  ritualGlow: AmoledEmerald.primary,
  cardConnection: "#001a0d",
  cardConnectionBorder: AmoledEmerald.primary,
  cardRequest: "#00260d",
  cardRequestBorder: AmoledEmerald.mint,
  cardSent: AmoledEmerald.surface0,
  border: AmoledEmerald.surface1,
  divider: "#00260d",
  outline: AmoledEmerald.surface2,
  overlay: "rgba(0, 0, 0, 0.9)",
  overlayLight: "rgba(0, 0, 0, 0.75)",
  tabActive: AmoledEmerald.primary,
  tabInactive: AmoledEmerald.overlay1,
  headerBackground: "#000000",
  headerText: AmoledEmerald.text,
  accent1: AmoledEmerald.mint,
  accent2: AmoledEmerald.lime,
  accent3: AmoledEmerald.forest,
  glow: AmoledEmerald.primary,
};

export const AmoledRoyalPurpleColors: ThemeColors = {
  background: AmoledRoyalPurple.base,
  surface: AmoledRoyalPurple.surface0,
  surfaceVariant: AmoledRoyalPurple.mantle,
  surfaceElevated: AmoledRoyalPurple.surface1,
  primary: AmoledRoyalPurple.primary,
  primaryContainer: "#2a0a4a",
  onPrimary: "#ffffff",
  onPrimaryContainer: AmoledRoyalPurple.lavender,
  secondary: AmoledRoyalPurple.secondary,
  secondaryContainer: "#1a0033",
  onSecondary: "#ffffff",
  onSecondaryContainer: AmoledRoyalPurple.orchid,
  tertiary: AmoledRoyalPurple.accent,
  tertiaryContainer: "#3a0a5a",
  text: AmoledRoyalPurple.text,
  textSecondary: AmoledRoyalPurple.subtext1,
  textMuted: AmoledRoyalPurple.overlay1,
  textOnPrimary: "#ffffff",
  success: AmoledRoyalPurple.success,
  successContainer: "#1b3d1b",
  warning: AmoledRoyalPurple.warning,
  warningContainer: "#3d3d00",
  error: AmoledRoyalPurple.error,
  errorContainer: "#3d1b1b",
  info: AmoledRoyalPurple.violet,
  infoContainer: "#1a0033",
  ritual: AmoledRoyalPurple.orchid,
  ritualGlow: AmoledRoyalPurple.primary,
  cardConnection: "#0d001a",
  cardConnectionBorder: AmoledRoyalPurple.primary,
  cardRequest: "#1a0033",
  cardRequestBorder: AmoledRoyalPurple.orchid,
  cardSent: AmoledRoyalPurple.surface0,
  border: AmoledRoyalPurple.surface1,
  divider: "#1a0033",
  outline: AmoledRoyalPurple.surface2,
  overlay: "rgba(0, 0, 0, 0.9)",
  overlayLight: "rgba(0, 0, 0, 0.75)",
  tabActive: AmoledRoyalPurple.primary,
  tabInactive: AmoledRoyalPurple.overlay1,
  headerBackground: "#000000",
  headerText: AmoledRoyalPurple.text,
  accent1: AmoledRoyalPurple.violet,
  accent2: AmoledRoyalPurple.orchid,
  accent3: AmoledRoyalPurple.lavender,
  glow: AmoledRoyalPurple.primary,
};

export const AmoledSunsetOrangeColors: ThemeColors = {
  background: AmoledSunsetOrange.base,
  surface: AmoledSunsetOrange.surface0,
  surfaceVariant: AmoledSunsetOrange.mantle,
  surfaceElevated: AmoledSunsetOrange.surface1,
  primary: AmoledSunsetOrange.primary,
  primaryContainer: "#4a1a00",
  onPrimary: "#000000",
  onPrimaryContainer: AmoledSunsetOrange.accent,
  secondary: AmoledSunsetOrange.secondary,
  secondaryContainer: "#331000",
  onSecondary: "#000000",
  onSecondaryContainer: AmoledSunsetOrange.coral,
  tertiary: AmoledSunsetOrange.gold,
  tertiaryContainer: "#4a3a00",
  text: AmoledSunsetOrange.text,
  textSecondary: AmoledSunsetOrange.subtext1,
  textMuted: AmoledSunsetOrange.overlay1,
  textOnPrimary: "#000000",
  success: AmoledSunsetOrange.success,
  successContainer: "#1a3d1a",
  warning: AmoledSunsetOrange.warning,
  warningContainer: "#4a4a00",
  error: AmoledSunsetOrange.error,
  errorContainer: "#4a0000",
  info: AmoledSunsetOrange.gold,
  infoContainer: "#3a2a00",
  ritual: AmoledSunsetOrange.coral,
  ritualGlow: AmoledSunsetOrange.primary,
  cardConnection: "#1a0d00",
  cardConnectionBorder: AmoledSunsetOrange.primary,
  cardRequest: "#2a1500",
  cardRequestBorder: AmoledSunsetOrange.coral,
  cardSent: AmoledSunsetOrange.surface0,
  border: AmoledSunsetOrange.surface1,
  divider: "#2a1500",
  outline: AmoledSunsetOrange.surface2,
  overlay: "rgba(0, 0, 0, 0.9)",
  overlayLight: "rgba(0, 0, 0, 0.75)",
  tabActive: AmoledSunsetOrange.primary,
  tabInactive: AmoledSunsetOrange.overlay1,
  headerBackground: "#000000",
  headerText: AmoledSunsetOrange.text,
  accent1: AmoledSunsetOrange.coral,
  accent2: AmoledSunsetOrange.gold,
  accent3: AmoledSunsetOrange.amber,
  glow: AmoledSunsetOrange.primary,
};

export const PeachBlossomColors: ThemeColors = {
  background: PeachBlossom.base,
  surface: "#ffffff",
  surfaceVariant: PeachBlossom.mantle,
  surfaceElevated: "#ffffff",
  primary: PeachBlossom.peach,
  primaryContainer: "#ffe4e0",
  onPrimary: "#ffffff",
  onPrimaryContainer: PeachBlossom.coral,
  secondary: PeachBlossom.coral,
  secondaryContainer: "#ffdcd0",
  onSecondary: "#ffffff",
  onSecondaryContainer: PeachBlossom.salmon,
  tertiary: PeachBlossom.rose,
  tertiaryContainer: "#ffe0e0",
  text: PeachBlossom.text,
  textSecondary: PeachBlossom.subtext1,
  textMuted: PeachBlossom.overlay1,
  textOnPrimary: "#ffffff",
  success: PeachBlossom.success,
  successContainer: "#e8f5e9",
  warning: PeachBlossom.warning,
  warningContainer: "#fff3e0",
  error: PeachBlossom.error,
  errorContainer: "#ffebee",
  info: "#2196f3",
  infoContainer: "#e3f2fd",
  ritual: PeachBlossom.coral,
  ritualGlow: PeachBlossom.peach,
  cardConnection: "#fff0f0",
  cardConnectionBorder: PeachBlossom.peach,
  cardRequest: "#ffe8e0",
  cardRequestBorder: PeachBlossom.coral,
  cardSent: PeachBlossom.mantle,
  border: PeachBlossom.surface1,
  divider: PeachBlossom.surface0,
  outline: PeachBlossom.surface2,
  overlay: "rgba(92, 61, 48, 0.5)",
  overlayLight: "rgba(92, 61, 48, 0.3)",
  tabActive: PeachBlossom.peach,
  tabInactive: PeachBlossom.overlay1,
  headerBackground: "#ffffff",
  headerText: PeachBlossom.text,
};

export const SkyCottonColors: ThemeColors = {
  background: SkyCotton.base,
  surface: "#ffffff",
  surfaceVariant: SkyCotton.mantle,
  surfaceElevated: "#ffffff",
  primary: SkyCotton.sky,
  primaryContainer: "#e0f4ff",
  onPrimary: "#1a3a5c",
  onPrimaryContainer: SkyCotton.azure,
  secondary: SkyCotton.azure,
  secondaryContainer: "#d6eeff",
  onSecondary: "#1a3a5c",
  onSecondaryContainer: SkyCotton.cornflower,
  tertiary: SkyCotton.periwinkle,
  tertiaryContainer: "#e8e8ff",
  text: SkyCotton.text,
  textSecondary: SkyCotton.subtext1,
  textMuted: SkyCotton.overlay1,
  textOnPrimary: "#1a3a5c",
  success: SkyCotton.success,
  successContainer: "#e8f5e9",
  warning: SkyCotton.warning,
  warningContainer: "#fff3e0",
  error: SkyCotton.error,
  errorContainer: "#ffebee",
  info: SkyCotton.azure,
  infoContainer: "#e0f4ff",
  ritual: SkyCotton.azure,
  ritualGlow: SkyCotton.sky,
  cardConnection: "#e6f2ff",
  cardConnectionBorder: SkyCotton.sky,
  cardRequest: "#dceeff",
  cardRequestBorder: SkyCotton.azure,
  cardSent: SkyCotton.mantle,
  border: SkyCotton.surface1,
  divider: SkyCotton.surface0,
  outline: SkyCotton.surface2,
  overlay: "rgba(26, 58, 92, 0.5)",
  overlayLight: "rgba(26, 58, 92, 0.3)",
  tabActive: SkyCotton.azure,
  tabInactive: SkyCotton.overlay1,
  headerBackground: "#ffffff",
  headerText: SkyCotton.text,
};

export const HoneydewMintColors: ThemeColors = {
  background: HoneydewMint.base,
  surface: "#ffffff",
  surfaceVariant: HoneydewMint.mantle,
  surfaceElevated: "#ffffff",
  primary: HoneydewMint.honeydew,
  primaryContainer: "#e0ffe0",
  onPrimary: "#1b4332",
  onPrimaryContainer: HoneydewMint.mint,
  secondary: HoneydewMint.mint,
  secondaryContainer: "#d0ffd0",
  onSecondary: "#1b4332",
  onSecondaryContainer: HoneydewMint.seafoam,
  tertiary: HoneydewMint.spring,
  tertiaryContainer: "#c0ffc0",
  text: HoneydewMint.text,
  textSecondary: HoneydewMint.subtext1,
  textMuted: HoneydewMint.overlay1,
  textOnPrimary: "#1b4332",
  success: HoneydewMint.success,
  successContainer: "#e0ffe0",
  warning: HoneydewMint.warning,
  warningContainer: "#fff8e1",
  error: HoneydewMint.error,
  errorContainer: "#ffebee",
  info: "#2196f3",
  infoContainer: "#e3f2fd",
  ritual: HoneydewMint.mint,
  ritualGlow: HoneydewMint.honeydew,
  cardConnection: "#e6ffe6",
  cardConnectionBorder: HoneydewMint.honeydew,
  cardRequest: "#dcffdc",
  cardRequestBorder: HoneydewMint.mint,
  cardSent: HoneydewMint.mantle,
  border: HoneydewMint.surface1,
  divider: HoneydewMint.surface0,
  outline: HoneydewMint.surface2,
  overlay: "rgba(27, 67, 50, 0.5)",
  overlayLight: "rgba(27, 67, 50, 0.3)",
  tabActive: HoneydewMint.mint,
  tabInactive: HoneydewMint.overlay1,
  headerBackground: "#ffffff",
  headerText: HoneydewMint.text,
};

// Map theme IDs to their color definitions
export const THEME_COLORS: Record<ThemeId, ThemeColors> = {
  "catppuccin-latte": CatppuccinLatteColors,
  "catppuccin-mocha": CatppuccinMochaColors,
  amoled: AmoledColors,
  "neo-tokyo": NeoTokyoColors,
  "retro-wave": RetroWaveColors,
  "rose-garden": RoseGardenColors,
  "ocean-breeze": OceanBreezeColors,
  "mint-fresh": MintFreshColors,
  "sunset-glow": SunsetGlowColors,
  "lavender-dream": LavenderDreamColors,
  "peach-blossom": PeachBlossomColors,
  "sky-cotton": SkyCottonColors,
  "honeydew-mint": HoneydewMintColors,
  dracula: DraculaColors,
  nord: NordColors,
  "solarized-light": SolarizedLightColors,
  "gruvbox-dark": GruvboxDarkColors,
  "amoled-oled-blue": AmoledOledBlueColors,
  "amoled-blood-moon": AmoledBloodMoonColors,
  "amoled-emerald": AmoledEmeraldColors,
  "amoled-royal-purple": AmoledRoyalPurpleColors,
  "amoled-sunset-orange": AmoledSunsetOrangeColors,
  vaporwave: VaporwaveColors,
  "aurora-borealis": AuroraBorealisColors,
  "neon-sunset": NeonSunsetColors,
  "electric-lime": ElectricLimeColors,
  "galaxy-purple": GalaxyPurpleColors,
  "night-owl": NightOwlColors,
  aura: AuraColors,
  jellyfish: JellyfishColors,
};

// ============================================================================
// LEGACY COMPATIBILITY (AppColors maps to light theme)
// ============================================================================

// Aliases for backward compatibility
export const LightColors = CatppuccinLatteColors;
export const DarkColors = CatppuccinMochaColors;

/**
 * @deprecated Use theme colors via useAppTheme() hook instead
 * Kept for gradual migration
 */
export const AppColors = {
  primary: LightColors.primary,
  primaryLight: "#c4b5fd",
  primaryDark: "#6d28d9",
  secondary: LightColors.secondary,
  secondaryLight: "#fed7aa",
  secondaryDark: "#c2410c",
  success: LightColors.success,
  successLight: LightColors.successContainer,
  warning: LightColors.warning,
  warningLight: LightColors.warningContainer,
  error: LightColors.error,
  errorLight: LightColors.errorContainer,
  info: LightColors.info,
  infoLight: LightColors.infoContainer,
  streak: LightColors.ritual,
  streakGlow: LightColors.ritualGlow,
  background: LightColors.background,
  surface: LightColors.surface,
  surfaceVariant: LightColors.surfaceVariant,
  friendCard: LightColors.cardConnection,
  friendCardBorder: LightColors.cardConnectionBorder,
  requestCard: LightColors.cardRequest,
  requestCardBorder: LightColors.cardRequestBorder,
  sentRequestCard: LightColors.cardSent,
  textPrimary: LightColors.text,
  textSecondary: LightColors.textSecondary,
  textMuted: LightColors.textMuted,
  textOnPrimary: LightColors.textOnPrimary,
  border: LightColors.border,
  divider: LightColors.divider,
  overlay: LightColors.overlay,
  overlayLight: LightColors.overlayLight,
};

// ============================================================================
// SPACING & LAYOUT
// ============================================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
} as const;

export const FontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const Fonts = Platform.select({
  ios: {
    sans: "System",
    serif: "Georgia",
    rounded: "System",
    mono: "Menlo",
  },
  android: {
    sans: "Roboto",
    serif: "serif",
    rounded: "Roboto",
    mono: "monospace",
  },
  default: {
    sans: "System",
    serif: "serif",
    rounded: "System",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

// ============================================================================
// ELEVATION / SHADOWS
// ============================================================================

export const Elevation = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Glow effect for neon themes
export function createGlow(color: string, intensity: number = 1) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6 * intensity,
    shadowRadius: 12 * intensity,
    elevation: 8,
  };
}

// ============================================================================
// REACT NATIVE PAPER THEME GENERATOR
// ============================================================================

const fontConfig = {
  fontFamily: Fonts?.sans || "System",
};

function createPaperTheme(colors: ThemeColors, isDark: boolean): MD3Theme {
  const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...baseTheme,
    roundness: BorderRadius.md,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      onPrimary: colors.onPrimary,
      primaryContainer: colors.primaryContainer,
      onPrimaryContainer: colors.onPrimaryContainer,
      secondary: colors.secondary,
      onSecondary: colors.onSecondary,
      secondaryContainer: colors.secondaryContainer,
      onSecondaryContainer: colors.onSecondaryContainer,
      tertiary: colors.tertiary,
      onTertiary: colors.textOnPrimary,
      tertiaryContainer: colors.tertiaryContainer,
      onTertiaryContainer: colors.tertiary,
      background: colors.background,
      onBackground: colors.text,
      surface: colors.surface,
      onSurface: colors.text,
      surfaceVariant: colors.surfaceVariant,
      onSurfaceVariant: colors.textSecondary,
      error: colors.error,
      onError: isDark ? colors.background : "#ffffff",
      errorContainer: colors.errorContainer,
      onErrorContainer: colors.error,
      outline: colors.outline,
      outlineVariant: colors.border,
      elevation: {
        level0: "transparent",
        level1: colors.surface,
        level2: colors.surfaceVariant,
        level3: colors.surfaceElevated,
        level4: colors.surfaceElevated,
        level5: colors.surfaceElevated,
      },
    },
    fonts: configureFonts({ config: fontConfig }),
  };
}

// ============================================================================
// REACT NAVIGATION THEME GENERATOR
// ============================================================================

function createNavigationTheme(
  colors: ThemeColors,
  isDark: boolean,
): NavigationTheme {
  return {
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.headerBackground,
      text: colors.headerText,
      border: colors.border,
      notification: colors.error,
    },
    fonts: {
      regular: { fontFamily: Fonts?.sans || "System", fontWeight: "400" },
      medium: { fontFamily: Fonts?.sans || "System", fontWeight: "500" },
      bold: { fontFamily: Fonts?.sans || "System", fontWeight: "700" },
      heavy: { fontFamily: Fonts?.sans || "System", fontWeight: "800" },
    },
  };
}

// Pre-built themes for backward compatibility
export const PaperLightTheme = createPaperTheme(LightColors, false);
export const PaperDarkTheme = createPaperTheme(DarkColors, true);
export const NavigationLightTheme = createNavigationTheme(LightColors, false);
export const NavigationDarkTheme = createNavigationTheme(DarkColors, true);

// ============================================================================
// COMBINED THEME HELPER
// ============================================================================

export interface AppTheme {
  id: ThemeId;
  meta: ThemeMeta;
  colors: ThemeColors;
  paper: MD3Theme;
  navigation: NavigationTheme;
  spacing: typeof Spacing;
  radius: typeof BorderRadius;
  fonts: typeof FontSizes;
  elevation: typeof Elevation;
  isDark: boolean;
}

export function getThemeById(themeId: ThemeId): AppTheme {
  const meta = THEME_METADATA[themeId];
  const colors = THEME_COLORS[themeId];

  return {
    id: themeId,
    meta,
    colors,
    paper: createPaperTheme(colors, meta.isDark),
    navigation: createNavigationTheme(colors, meta.isDark),
    spacing: Spacing,
    radius: BorderRadius,
    fonts: FontSizes,
    elevation: Elevation,
    isDark: meta.isDark,
  };
}

/**
 * @deprecated Use getThemeById instead
 * Kept for backward compatibility
 */
export function getTheme(isDark: boolean): AppTheme {
  return getThemeById(isDark ? "catppuccin-mocha" : "catppuccin-latte");
}

// Get all available themes
export function getAllThemes(): ThemeMeta[] {
  return Object.values(THEME_METADATA);
}

// Get themes by category
export function getThemesByCategory(
  category: ThemeMeta["category"],
): ThemeMeta[] {
  return Object.values(THEME_METADATA).filter((t) => t.category === category);
}

// ============================================================================
// DEFAULT THEME (for static StyleSheet usage)
// ============================================================================

/**
 * Default theme using dark mode colors.
 * Use this for static StyleSheet.create() calls.
 * For dynamic theming, use the useAppTheme() hook from @/store/ThemeContext.
 */
export const theme: AppTheme = getThemeById("catppuccin-mocha");
