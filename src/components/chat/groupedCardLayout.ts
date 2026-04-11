export const GROUPED_CARD_RADIUS = 8;
export const GROUPED_CARD_SNAP_THRESHOLD = 24;

export interface GroupedCardRadiusStyle {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomLeftRadius: number;
  borderBottomRightRadius: number;
}

export interface BuildGroupedCardRadiiArgs {
  isGroupStart: boolean;
  isGroupEnd: boolean;
  currentWidth?: number;
  prevWidth?: number;
  nextWidth?: number;
  radius?: number;
}

export interface ResolveGroupedCardSnapClusterArgs {
  messageId: string;
  getWidth: (id: string) => number | undefined;
  getPrevMessageId: (id: string) => string | undefined;
  getNextMessageId: (id: string) => string | undefined;
  threshold?: number;
}

export function normalizeGroupedCardWidth(width: number): number {
  return Math.max(0, Math.ceil(width / 2) * 2);
}

export function shouldSnapGroupedCardWidths(
  a?: number,
  b?: number,
  threshold = GROUPED_CARD_SNAP_THRESHOLD,
): boolean {
  return a !== undefined && b !== undefined && Math.abs(a - b) <= threshold;
}

function collectSnapClusterIdsInDirection(
  startId: string,
  getAdjacentId: (id: string) => string | undefined,
  getWidth: (id: string) => number | undefined,
  threshold: number,
): string[] {
  const clusterIds: string[] = [];
  let currentId = startId;

  while (true) {
    const adjacentId = getAdjacentId(currentId);
    if (!adjacentId) {
      break;
    }

    const currentWidth = getWidth(currentId);
    const adjacentWidth = getWidth(adjacentId);
    if (!shouldSnapGroupedCardWidths(currentWidth, adjacentWidth, threshold)) {
      break;
    }

    clusterIds.push(adjacentId);
    currentId = adjacentId;
  }

  return clusterIds;
}

export function resolveGroupedCardSnapCluster(
  args: ResolveGroupedCardSnapClusterArgs,
): string[] {
  const {
    messageId,
    getWidth,
    getPrevMessageId,
    getNextMessageId,
    threshold = GROUPED_CARD_SNAP_THRESHOLD,
  } = args;

  if (getWidth(messageId) === undefined) {
    return [];
  }

  const prevIds = collectSnapClusterIdsInDirection(
    messageId,
    getPrevMessageId,
    getWidth,
    threshold,
  ).reverse();
  const nextIds = collectSnapClusterIdsInDirection(
    messageId,
    getNextMessageId,
    getWidth,
    threshold,
  );

  return [...prevIds, messageId, ...nextIds];
}

export function resolveGroupedCardSnappedWidth(
  args: ResolveGroupedCardSnapClusterArgs,
): number | undefined {
  const clusterIds = resolveGroupedCardSnapCluster(args);
  if (clusterIds.length === 0) {
    return undefined;
  }

  let maxWidth = 0;
  for (const id of clusterIds) {
    const width = args.getWidth(id);
    if (width !== undefined && width > maxWidth) {
      maxWidth = width;
    }
  }

  return maxWidth > 0 ? maxWidth : undefined;
}

function resolveDirectionalRightRadius(
  currentWidth: number | undefined,
  adjacentWidth: number | undefined,
  radius: number,
): number {
  if (currentWidth === undefined || adjacentWidth === undefined) {
    return 0;
  }

  return currentWidth > adjacentWidth ? radius : 0;
}

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
      : resolveDirectionalRightRadius(
          args.currentWidth,
          args.prevWidth,
          radius,
        ),
    borderBottomLeftRadius: args.isGroupEnd ? radius : 0,
    borderBottomRightRadius: args.isGroupEnd
      ? radius
      : resolveDirectionalRightRadius(
          args.currentWidth,
          args.nextWidth,
          radius,
        ),
  };
}

export function getGroupedCardMinWidth(
  rawWidth?: number,
  snappedWidth?: number,
): number | undefined {
  if (
    rawWidth === undefined ||
    rawWidth <= 0 ||
    snappedWidth === undefined ||
    snappedWidth <= 0
  ) {
    return undefined;
  }

  return snappedWidth;
}
