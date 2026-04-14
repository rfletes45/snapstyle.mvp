export const GROUPED_CARD_RADIUS = 8;

/**
 * Minimum width difference (px) before a right-side corner flattens.
 * Absorbs tiny reflow jitter so corners remain visually stable.
 */
export const GROUPED_CARD_CORNER_THRESHOLD = 6;

/** Snap a width to the nearest 2px grid. Used by width estimation utilities. */
export function normalizeGroupedCardWidth(width: number): number {
  return Math.max(0, Math.ceil(width / 2) * 2);
}

export interface GroupedCardRadiusStyle {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomLeftRadius: number;
  borderBottomRightRadius: number;
}

export interface BuildGroupedCardRadiiArgs {
  isGroupStart: boolean;
  isGroupEnd: boolean;
  /** Current card's measured natural width (for right-side corner logic). */
  currentWidth?: number;
  /** Previous neighbor's measured natural width. */
  prevWidth?: number;
  /** Next neighbor's measured natural width. */
  nextWidth?: number;
  radius?: number;
}

/**
 * Return the right-edge radius for a non-boundary edge.
 *
 * The corner is rounded (radius) when:
 *  - either width is unknown (safe default), or
 *  - the adjacent card is NOT meaningfully wider than the current one
 *
 * The corner is flat (0) when the adjacent card is wider by at least
 * GROUPED_CARD_CORNER_THRESHOLD px — this creates the visual "tuck"
 * that makes grouped stacks look intentional.
 */
function resolveRightCorner(
  currentWidth: number | undefined,
  adjacentWidth: number | undefined,
  radius: number,
): number {
  if (currentWidth === undefined || adjacentWidth === undefined) {
    return radius;
  }
  return adjacentWidth - currentWidth >= GROUPED_CARD_CORNER_THRESHOLD
    ? 0
    : radius;
}

/**
 * Corner rounding with group-position left edge and width-aware right edge.
 *
 * Left edge: flush through grouped stack (flat for non-boundary messages).
 * Right edge: rounded by default, flattened only when the adjacent neighbor
 * is meaningfully wider (≥ GROUPED_CARD_CORNER_THRESHOLD px).
 *
 * Solo:   all corners rounded
 * Start:  TL=R, TR=R (default), BL=0, BR=width-aware
 * Middle: TL=0, TR=width-aware, BL=0, BR=width-aware
 * End:    TL=0, TR=width-aware, BL=R, BR=R
 */
export function buildGroupedCardRadii(
  args: BuildGroupedCardRadiiArgs,
): GroupedCardRadiusStyle {
  const radius = args.radius ?? GROUPED_CARD_RADIUS;
  const isSolo = args.isGroupStart && args.isGroupEnd;

  if (isSolo) {
    return {
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
      borderBottomLeftRadius: radius,
      borderBottomRightRadius: radius,
    };
  }

  return {
    borderTopLeftRadius: args.isGroupStart ? radius : 0,
    borderTopRightRadius: args.isGroupStart
      ? radius
      : resolveRightCorner(args.currentWidth, args.prevWidth, radius),
    borderBottomLeftRadius: args.isGroupEnd ? radius : 0,
    borderBottomRightRadius: args.isGroupEnd
      ? radius
      : resolveRightCorner(args.currentWidth, args.nextWidth, radius),
  };
}
