export type CameraFilterCost = "safe" | "medium" | "expensive";

export type CameraFilterRenderMode =
  | "none"
  | "colorMatrix"
  | "overlayApproximation"
  | "futureShader";

export interface CameraFilterDefinition {
  id: string;
  label: string;
  description?: string;

  defaultIntensity: number;
  minIntensity: number;
  maxIntensity: number;

  previewTint?: string;
  previewOpacity?: number;

  colorMatrix?: readonly number[];

  livePreviewSupported: boolean;
  exportSupported: boolean;

  cost: CameraFilterCost;
  renderMode: CameraFilterRenderMode;

  schemaVersion: number;
}

export interface CameraFilterPreviewStyle {
  backgroundColor: string;
  opacity: number;
}

export interface CameraFilterExportPayload {
  filterId: string;
  filterLabel: string;
  filterIntensity: number;
  filterSchemaVersion: number;
  filterFlattened: true;
  renderMode: CameraFilterRenderMode;
  colorMatrix?: readonly number[];
}

export interface CameraFilterMetadataPayload {
  filterId: string;
  filterIntensity: number;
  filterSchemaVersion: number;
  filterFlattened: true;
}

export const CAMERA_FILTER_SCHEMA_VERSION = 1;
export const NORMAL_CAMERA_FILTER_ID = "normal";

export const IDENTITY_COLOR_MATRIX = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
] as const;

export const CAMERA_FILTERS = [
  {
    id: NORMAL_CAMERA_FILTER_ID,
    label: "Normal",
    description: "No filter",
    defaultIntensity: 0,
    minIntensity: 0,
    maxIntensity: 0,
    livePreviewSupported: true,
    exportSupported: true,
    cost: "safe",
    renderMode: "none",
    schemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
  },
  {
    id: "warm",
    label: "Warm",
    description: "Soft warm highlights",
    defaultIntensity: 1,
    minIntensity: 0,
    maxIntensity: 1,
    previewTint: "#F7B267",
    previewOpacity: 0.16,
    colorMatrix: [
      1.08, 0, 0, 0, 0.025,
      0, 1.02, 0, 0, 0.01,
      0, 0, 0.92, 0, -0.015,
      0, 0, 0, 1, 0,
    ],
    livePreviewSupported: true,
    exportSupported: true,
    cost: "safe",
    renderMode: "colorMatrix",
    schemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
  },
  {
    id: "cool",
    label: "Cool",
    description: "Clean cool cast",
    defaultIntensity: 1,
    minIntensity: 0,
    maxIntensity: 1,
    previewTint: "#79B8FF",
    previewOpacity: 0.15,
    colorMatrix: [
      0.94, 0, 0, 0, -0.01,
      0, 1.0, 0, 0, 0,
      0, 0, 1.1, 0, 0.02,
      0, 0, 0, 1, 0,
    ],
    livePreviewSupported: true,
    exportSupported: true,
    cost: "safe",
    renderMode: "colorMatrix",
    schemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
  },
  {
    id: "vivid",
    label: "Vivid",
    description: "Higher contrast and color",
    defaultIntensity: 1,
    minIntensity: 0,
    maxIntensity: 1,
    previewTint: "#FFFFFF",
    previewOpacity: 0.08,
    colorMatrix: [
      1.22, -0.08, -0.04, 0, -0.035,
      -0.06, 1.2, -0.04, 0, -0.025,
      -0.04, -0.08, 1.24, 0, -0.035,
      0, 0, 0, 1, 0,
    ],
    livePreviewSupported: true,
    exportSupported: true,
    cost: "safe",
    renderMode: "colorMatrix",
    schemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
  },
  {
    id: "mono",
    label: "Mono",
    description: "Neutral black and white",
    defaultIntensity: 1,
    minIntensity: 0,
    maxIntensity: 1,
    previewTint: "#D8D8D8",
    previewOpacity: 0.18,
    colorMatrix: [
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0, 0, 0, 1, 0,
    ],
    livePreviewSupported: true,
    exportSupported: true,
    cost: "safe",
    renderMode: "colorMatrix",
    schemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
  },
  {
    id: "fade",
    label: "Fade",
    description: "Lifted shadows and softer contrast",
    defaultIntensity: 1,
    minIntensity: 0,
    maxIntensity: 1,
    previewTint: "#E7DFD0",
    previewOpacity: 0.14,
    colorMatrix: [
      0.92, 0, 0, 0, 0.07,
      0, 0.92, 0, 0, 0.07,
      0, 0, 0.92, 0, 0.07,
      0, 0, 0, 1, 0,
    ],
    livePreviewSupported: true,
    exportSupported: true,
    cost: "safe",
    renderMode: "colorMatrix",
    schemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
  },
  {
    id: "noir",
    label: "Noir",
    description: "Crisp high-contrast monochrome",
    defaultIntensity: 1,
    minIntensity: 0,
    maxIntensity: 1,
    previewTint: "#111111",
    previewOpacity: 0.22,
    colorMatrix: [
      0.32, 1.07, 0.11, 0, -0.16,
      0.32, 1.07, 0.11, 0, -0.16,
      0.32, 1.07, 0.11, 0, -0.16,
      0, 0, 0, 1, 0,
    ],
    livePreviewSupported: true,
    exportSupported: true,
    cost: "safe",
    renderMode: "colorMatrix",
    schemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
  },
  {
    id: "soft",
    label: "Soft",
    description: "Gentle low-contrast color",
    defaultIntensity: 1,
    minIntensity: 0,
    maxIntensity: 1,
    previewTint: "#F4D7E6",
    previewOpacity: 0.12,
    colorMatrix: [
      0.98, 0.02, 0, 0, 0.025,
      0.02, 0.98, 0, 0, 0.02,
      0.02, 0, 0.98, 0, 0.025,
      0, 0, 0, 1, 0,
    ],
    livePreviewSupported: true,
    exportSupported: true,
    cost: "safe",
    renderMode: "colorMatrix",
    schemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Warm orange-pink grade",
    defaultIntensity: 1,
    minIntensity: 0,
    maxIntensity: 1,
    previewTint: "#FF7A59",
    previewOpacity: 0.18,
    colorMatrix: [
      1.12, 0.02, 0, 0, 0.03,
      0.02, 0.98, 0, 0, 0,
      0, 0, 0.9, 0, -0.02,
      0, 0, 0, 1, 0,
    ],
    livePreviewSupported: true,
    exportSupported: true,
    cost: "safe",
    renderMode: "colorMatrix",
    schemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
  },
] as const satisfies readonly CameraFilterDefinition[];

const FILTER_BY_ID = new Map<string, CameraFilterDefinition>(
  CAMERA_FILTERS.map((filter) => [filter.id, filter]),
);

export function getCameraFilterById(
  filterId: string | null | undefined,
): CameraFilterDefinition {
  return FILTER_BY_ID.get(filterId ?? "") ?? CAMERA_FILTERS[0];
}

export function isNormalCameraFilter(
  filter: CameraFilterDefinition | string | null | undefined,
): boolean {
  const id = typeof filter === "string" ? filter : filter?.id;
  return !id || id === NORMAL_CAMERA_FILTER_ID;
}

export function clampCameraFilterIntensity(
  filter: CameraFilterDefinition,
  intensity: number,
): number {
  if (isNormalCameraFilter(filter)) {
    return filter.defaultIntensity;
  }

  if (!Number.isFinite(intensity)) {
    return filter.defaultIntensity;
  }

  return Math.max(filter.minIntensity, Math.min(filter.maxIntensity, intensity));
}

export function getInterpolatedColorMatrix(
  filter: CameraFilterDefinition,
  intensity: number,
): readonly number[] | null {
  if (isNormalCameraFilter(filter) || !filter.colorMatrix) {
    return null;
  }

  const clampedIntensity = clampCameraFilterIntensity(filter, intensity);
  if (clampedIntensity <= 0) {
    return null;
  }

  if (clampedIntensity >= filter.maxIntensity) {
    return filter.colorMatrix;
  }

  const span = filter.maxIntensity - filter.minIntensity;
  const t =
    span <= 0
      ? 1
      : (clampedIntensity - filter.minIntensity) / Math.max(span, 0.0001);

  return filter.colorMatrix.map(
    (value, index) => IDENTITY_COLOR_MATRIX[index] + (value - IDENTITY_COLOR_MATRIX[index]) * t,
  );
}

export function getCameraFilterPreviewStyle(
  filter: CameraFilterDefinition,
  intensity: number,
): CameraFilterPreviewStyle | null {
  if (
    isNormalCameraFilter(filter) ||
    !filter.previewTint ||
    !filter.previewOpacity
  ) {
    return null;
  }

  const clampedIntensity = clampCameraFilterIntensity(filter, intensity);
  const opacity =
    filter.maxIntensity <= 0
      ? 0
      : filter.previewOpacity * (clampedIntensity / filter.maxIntensity);

  if (opacity <= 0.005) {
    return null;
  }

  return {
    backgroundColor: filter.previewTint,
    opacity: Math.min(0.45, Math.max(0, opacity)),
  };
}

export function getCameraFilterExportPayload(
  filter: CameraFilterDefinition,
  intensity: number,
): CameraFilterExportPayload | null {
  if (isNormalCameraFilter(filter) || !filter.exportSupported) {
    return null;
  }

  const clampedIntensity = clampCameraFilterIntensity(filter, intensity);
  const colorMatrix = getInterpolatedColorMatrix(filter, clampedIntensity);

  return {
    filterId: filter.id,
    filterLabel: filter.label,
    filterIntensity: clampedIntensity,
    filterSchemaVersion: filter.schemaVersion,
    filterFlattened: true,
    renderMode: filter.renderMode,
    colorMatrix: colorMatrix ?? undefined,
  };
}

export function getCameraFilterMetadataPayload(
  filter: CameraFilterDefinition,
  intensity: number,
): CameraFilterMetadataPayload | null {
  const exportPayload = getCameraFilterExportPayload(filter, intensity);
  if (!exportPayload) {
    return null;
  }

  return {
    filterId: exportPayload.filterId,
    filterIntensity: exportPayload.filterIntensity,
    filterSchemaVersion: exportPayload.filterSchemaVersion,
    filterFlattened: true,
  };
}

export function getCameraFilterVideoExportPayload(): null {
  // TODO(camera-video-filters): implement real video filter processing with a
  // stable native transcoding pipeline before claiming video filter support.
  return null;
}
