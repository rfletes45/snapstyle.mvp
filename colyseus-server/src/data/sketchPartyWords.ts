/**
 * Sketch Party Word Lists
 *
 * Curated, difficulty-tiered word lists for the drawing game.
 * Words are grouped by difficulty. The picker selects from a mix.
 *
 * Loaded once at room creation, cached for the room lifetime.
 */

// =============================================================================
// English Word List (default)
// =============================================================================

const EASY: string[] = [
  "apple",
  "baby",
  "ball",
  "banana",
  "bed",
  "bird",
  "book",
  "box",
  "bread",
  "bus",
  "cake",
  "car",
  "cat",
  "chair",
  "cheese",
  "cloud",
  "clock",
  "cow",
  "cup",
  "dog",
  "door",
  "duck",
  "ear",
  "egg",
  "eye",
  "fish",
  "flag",
  "flower",
  "foot",
  "fork",
  "frog",
  "girl",
  "glass",
  "glove",
  "grape",
  "guitar",
  "hand",
  "hat",
  "heart",
  "horse",
  "house",
  "ice",
  "key",
  "king",
  "kite",
  "lamp",
  "leaf",
  "lemon",
  "lion",
  "lock",
  "moon",
  "mountain",
  "mouse",
  "nose",
  "ocean",
  "orange",
  "pants",
  "paper",
  "pen",
  "pig",
  "pillow",
  "pizza",
  "plane",
  "rain",
  "ring",
  "robot",
  "rock",
  "rocket",
  "rose",
  "shoe",
  "skull",
  "smile",
  "snake",
  "snow",
  "sock",
  "spider",
  "star",
  "sun",
  "sword",
  "table",
  "teeth",
  "tire",
  "tree",
  "truck",
  "umbrella",
  "volcano",
  "water",
  "whale",
  "window",
  "witch",
  "worm",
  "zebra",
];

const MEDIUM: string[] = [
  "airplane",
  "ambulance",
  "anchor",
  "ant",
  "astronaut",
  "backpack",
  "balloon",
  "basket",
  "battery",
  "beach",
  "beard",
  "bicycle",
  "blanket",
  "bowling",
  "bridge",
  "broom",
  "bucket",
  "butterfly",
  "cactus",
  "camera",
  "campfire",
  "candle",
  "cannon",
  "castle",
  "chain",
  "cherry",
  "chimney",
  "compass",
  "cookie",
  "coral",
  "corner",
  "cowboy",
  "crayon",
  "crown",
  "curtain",
  "diamond",
  "dinosaur",
  "dolphin",
  "donkey",
  "dragon",
  "dragonfly",
  "drum",
  "eagle",
  "elephant",
  "envelope",
  "factory",
  "feather",
  "fence",
  "firefighter",
  "flashlight",
  "fountain",
  "garbage",
  "giraffe",
  "glasses",
  "globe",
  "gorilla",
  "hammer",
  "helicopter",
  "helmet",
  "highway",
  "hospital",
  "iceberg",
  "igloo",
  "island",
  "jellyfish",
  "jungle",
  "kangaroo",
  "keyboard",
  "ladder",
  "lantern",
  "library",
  "lighthouse",
  "lizard",
  "magnet",
  "map",
  "medal",
  "mermaid",
  "microphone",
  "mirror",
  "monkey",
  "necklace",
  "newspaper",
  "octopus",
  "owl",
  "parachute",
  "parrot",
  "peacock",
  "penguin",
  "piano",
  "pirate",
  "planet",
  "popcorn",
  "porcupine",
  "potato",
  "pumpkin",
  "rainbow",
  "reindeer",
  "ruby",
  "sandwich",
  "satellite",
  "scarecrow",
  "scissors",
  "seahorse",
  "shadow",
  "skeleton",
  "snowflake",
  "spaceship",
  "sphinx",
  "squirrel",
  "stadium",
  "starfish",
  "submarine",
  "sunflower",
  "surfboard",
  "telescope",
  "tent",
  "thunder",
  "tiger",
  "tornado",
  "treasure",
  "trophy",
  "trumpet",
  "turtle",
  "unicorn",
  "vampire",
  "violin",
  "volcano",
  "walrus",
  "waterfall",
  "windmill",
  "wizard",
];

const HARD: string[] = [
  "abstract",
  "acrobat",
  "aerobics",
  "afterlife",
  "alchemy",
  "algorithm",
  "alliance",
  "anatomy",
  "animation",
  "apocalypse",
  "applause",
  "architect",
  "astronomy",
  "atmosphere",
  "avalanche",
  "backstroke",
  "barricade",
  "biography",
  "blueprint",
  "boomerang",
  "brainstorm",
  "broadband",
  "broccoli",
  "buffering",
  "bulldozer",
  "bungee jumping",
  "camouflage",
  "capitalism",
  "catastrophe",
  "centipede",
  "chameleon",
  "cinnamon",
  "cliffhanger",
  "coincidence",
  "constellation",
  "coral reef",
  "crossbow",
  "dandelion",
  "deadline",
  "democracy",
  "detective",
  "disguise",
  "earthquake",
  "ecosystem",
  "electricity",
  "encryption",
  "evolution",
  "expedition",
  "fingerprint",
  "flamethrower",
  "fossil",
  "frequency",
  "generation",
  "geography",
  "gymnasium",
  "hallucination",
  "harmonica",
  "heatwave",
  "hieroglyphics",
  "hologram",
  "hurricane",
  "hypnosis",
  "imagination",
  "immigration",
  "infection",
  "ingredient",
  "inspiration",
  "interference",
  "kaleidoscope",
  "laboratory",
  "labyrinth",
  "legislation",
  "locomotion",
  "malfunction",
  "marathon",
  "masquerade",
  "metropolis",
  "monastery",
  "mythology",
  "navigation",
  "negotiation",
  "nightmare",
  "observation",
  "origami",
  "palindrome",
  "paradox",
  "phenomenon",
  "photosynthesis",
  "quicksand",
  "revolution",
  "saxophone",
  "silhouette",
  "skyscraper",
  "spaghetti",
  "stampede",
  "superstition",
  "surveillance",
  "temperature",
  "thermometer",
  "thunderstorm",
  "trampoline",
  "tranquility",
  "treadmill",
  "ventriloquist",
  "wilderness",
  "xylophone",
];

// =============================================================================
// Public API
// =============================================================================

export interface WordListOptions {
  language?: string;
  customWordsCsv?: string;
  useCustomWordsOnly?: boolean;
}

/**
 * Load the word pool for a room. Called once per room.
 * Returns the full shuffled pool from which words are drawn each turn.
 */
export function loadWordPool(opts: WordListOptions): string[] {
  const customWords = parseCustomWords(opts.customWordsCsv);

  if (opts.useCustomWordsOnly && customWords.length > 0) {
    return shuffle([...customWords]);
  }

  // Default pool: mix of easy/medium/hard weighted toward easy/medium
  const defaultPool = [...EASY, ...EASY, ...MEDIUM, ...MEDIUM, ...HARD];

  if (customWords.length > 0) {
    // Blend: 50% default 50% custom
    return shuffle([...defaultPool, ...customWords, ...customWords]);
  }

  return shuffle([...defaultPool]);
}

/**
 * Pick N distinct words from a pool, cycling if exhausted.
 */
export function pickWords(
  pool: string[],
  count: number,
  usedSet: Set<string>,
): string[] {
  const available = pool.filter((w) => !usedSet.has(w.toLowerCase()));

  // If we've used most words, reset
  if (available.length < count) {
    usedSet.clear();
    return pickWords(pool, count, usedSet);
  }

  const picked: string[] = [];
  const tempUsed = new Set<string>();
  while (picked.length < count && picked.length < available.length) {
    const idx = Math.floor(Math.random() * available.length);
    const word = available[idx];
    if (!tempUsed.has(word.toLowerCase())) {
      tempUsed.add(word.toLowerCase());
      picked.push(word);
    }
  }

  return picked;
}

// =============================================================================
// Internals
// =============================================================================

function parseCustomWords(csv?: string): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && w.length <= 40);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
