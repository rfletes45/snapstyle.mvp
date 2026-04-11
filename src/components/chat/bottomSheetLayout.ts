export const HANDLE_ZONE_HEIGHT = 23;

const DEFAULT_EXPANDED_HEADROOM = 0.05;

export function getKeyboardReplacementSheetHeight(
  keyboardHeight: number,
): number {
  return Math.max(0, keyboardHeight) + HANDLE_ZONE_HEIGHT;
}

export function getKeyboardReplacementSnapFraction(
  keyboardHeight: number,
  screenHeight: number,
  expandedSnap: number,
  expandedHeadroom: number = DEFAULT_EXPANDED_HEADROOM,
): number {
  return Math.min(
    getKeyboardReplacementSheetHeight(keyboardHeight) / screenHeight,
    expandedSnap - expandedHeadroom,
  );
}
