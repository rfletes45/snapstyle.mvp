/**
 * Sketch Party — Word Bank (Server)
 *
 * Word bank and utility functions for the Colyseus server.
 */

export interface WordEntry {
  word: string;
  difficulty: "easy" | "medium" | "hard";
}

export const WORD_BANK: WordEntry[] = [
  // Easy
  { word: "cat", difficulty: "easy" },
  { word: "dog", difficulty: "easy" },
  { word: "sun", difficulty: "easy" },
  { word: "tree", difficulty: "easy" },
  { word: "house", difficulty: "easy" },
  { word: "car", difficulty: "easy" },
  { word: "fish", difficulty: "easy" },
  { word: "star", difficulty: "easy" },
  { word: "moon", difficulty: "easy" },
  { word: "hat", difficulty: "easy" },
  { word: "ball", difficulty: "easy" },
  { word: "bird", difficulty: "easy" },
  { word: "apple", difficulty: "easy" },
  { word: "book", difficulty: "easy" },
  { word: "cake", difficulty: "easy" },
  { word: "flower", difficulty: "easy" },
  { word: "heart", difficulty: "easy" },
  { word: "rain", difficulty: "easy" },
  { word: "snow", difficulty: "easy" },
  { word: "boat", difficulty: "easy" },
  { word: "train", difficulty: "easy" },
  { word: "shoe", difficulty: "easy" },
  { word: "cup", difficulty: "easy" },
  { word: "clock", difficulty: "easy" },
  { word: "key", difficulty: "easy" },
  { word: "bed", difficulty: "easy" },
  { word: "egg", difficulty: "easy" },
  { word: "ice cream", difficulty: "easy" },
  { word: "pizza", difficulty: "easy" },
  { word: "baby", difficulty: "easy" },
  { word: "eye", difficulty: "easy" },
  { word: "lamp", difficulty: "easy" },
  { word: "chair", difficulty: "easy" },
  { word: "door", difficulty: "easy" },
  { word: "cloud", difficulty: "easy" },
  { word: "fire", difficulty: "easy" },
  { word: "flag", difficulty: "easy" },
  { word: "nose", difficulty: "easy" },
  { word: "hand", difficulty: "easy" },
  { word: "foot", difficulty: "easy" },
  // Medium
  { word: "guitar", difficulty: "medium" },
  { word: "bicycle", difficulty: "medium" },
  { word: "airplane", difficulty: "medium" },
  { word: "snowman", difficulty: "medium" },
  { word: "rainbow", difficulty: "medium" },
  { word: "elephant", difficulty: "medium" },
  { word: "butterfly", difficulty: "medium" },
  { word: "lighthouse", difficulty: "medium" },
  { word: "pirate", difficulty: "medium" },
  { word: "robot", difficulty: "medium" },
  { word: "castle", difficulty: "medium" },
  { word: "dragon", difficulty: "medium" },
  { word: "penguin", difficulty: "medium" },
  { word: "campfire", difficulty: "medium" },
  { word: "treasure chest", difficulty: "medium" },
  { word: "volcano", difficulty: "medium" },
  { word: "surfing", difficulty: "medium" },
  { word: "popcorn", difficulty: "medium" },
  { word: "swimming pool", difficulty: "medium" },
  { word: "hamburger", difficulty: "medium" },
  { word: "basketball", difficulty: "medium" },
  { word: "telescope", difficulty: "medium" },
  { word: "headphones", difficulty: "medium" },
  { word: "thunderstorm", difficulty: "medium" },
  { word: "birthday cake", difficulty: "medium" },
  { word: "soccer ball", difficulty: "medium" },
  { word: "palm tree", difficulty: "medium" },
  { word: "waterfall", difficulty: "medium" },
  { word: "skateboard", difficulty: "medium" },
  { word: "hot air balloon", difficulty: "medium" },
  { word: "scarecrow", difficulty: "medium" },
  { word: "anchor", difficulty: "medium" },
  { word: "rocket", difficulty: "medium" },
  { word: "jelly", difficulty: "medium" },
  { word: "candle", difficulty: "medium" },
  { word: "sunflower", difficulty: "medium" },
  { word: "octopus", difficulty: "medium" },
  { word: "kangaroo", difficulty: "medium" },
  { word: "igloo", difficulty: "medium" },
  { word: "tornado", difficulty: "medium" },
  { word: "unicorn", difficulty: "medium" },
  // Hard
  { word: "photosynthesis", difficulty: "hard" },
  { word: "constellation", difficulty: "hard" },
  { word: "earthquake", difficulty: "hard" },
  { word: "democracy", difficulty: "hard" },
  { word: "evolution", difficulty: "hard" },
  { word: "orchestra", difficulty: "hard" },
  { word: "archaeology", difficulty: "hard" },
  { word: "camouflage", difficulty: "hard" },
  { word: "imagination", difficulty: "hard" },
  { word: "perspective", difficulty: "hard" },
  { word: "superstition", difficulty: "hard" },
  { word: "hibernation", difficulty: "hard" },
  { word: "pollution", difficulty: "hard" },
  { word: "meditation", difficulty: "hard" },
  { word: "aurora borealis", difficulty: "hard" },
  { word: "time travel", difficulty: "hard" },
  { word: "black hole", difficulty: "hard" },
  { word: "gravity", difficulty: "hard" },
  { word: "reflection", difficulty: "hard" },
  { word: "invisible", difficulty: "hard" },
];

export function pickRandomWords(
  count: number,
  usedWords: Set<string> = new Set(),
): string[] {
  const available = WORD_BANK.filter((w) => !usedWords.has(w.word));
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((w) => w.word);
}

export function computeMaskedWord(word: string, hintsRevealed: number): string {
  if (hintsRevealed <= 0) {
    return word
      .split("")
      .map((ch) => (ch === " " ? "  " : "_"))
      .join(" ");
  }
  const indices: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== " ") indices.push(i);
  }
  const toReveal = new Set<number>();
  if (indices.length > 0 && hintsRevealed >= 1) toReveal.add(indices[0]);
  if (indices.length > 1 && hintsRevealed >= 2)
    toReveal.add(indices[indices.length - 1]);
  for (let h = 2; h < hintsRevealed && h < indices.length; h++) {
    const step = Math.floor(indices.length / (hintsRevealed + 1));
    toReveal.add(indices[step * (h - 1)] ?? indices[h]);
  }
  return word
    .split("")
    .map((ch, i) => {
      if (ch === " ") return "  ";
      return toReveal.has(i) ? ch : "_";
    })
    .join(" ");
}

export function isCorrectGuess(guess: string, secretWord: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, " ");
  return normalize(guess) === normalize(secretWord);
}
