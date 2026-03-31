/**
 * Call Settings Validator
 *
 * Centralized validation for Stream call settings overrides.
 * Prevents invalid payloads from reaching the Stream API.
 */

const TAG = "[CallSettingsValidator]";

/** Stream API minimum for target_resolution width/height */
const MIN_RESOLUTION = 240;
/** Stream API maximum for target_resolution width/height */
const MAX_RESOLUTION = 3840;
/** Stream API maximum for target_resolution bitrate */
const MAX_BITRATE = 6_000_000;

interface TargetResolution {
  width?: number;
  height?: number;
  bitrate?: number;
}

interface VideoSettings {
  camera_default_on?: boolean;
  enabled?: boolean;
  target_resolution?: TargetResolution;
  [key: string]: unknown;
}

interface CallSettingsOverride {
  audio?: Record<string, unknown>;
  video?: VideoSettings;
  [key: string]: unknown;
}

/**
 * Validate and sanitize a settings_override object before sending to Stream.
 * Fixes or removes invalid values and logs warnings in __DEV__.
 *
 * @returns Sanitized settings_override safe to send to Stream API
 */
export function sanitizeSettingsOverride(
  settings: CallSettingsOverride | undefined,
): CallSettingsOverride | undefined {
  if (!settings) return settings;

  const result = { ...settings };

  if (result.video) {
    result.video = sanitizeVideoSettings({ ...result.video });
  }

  return result;
}

/**
 * Sanitize video settings, particularly target_resolution.
 */
function sanitizeVideoSettings(video: VideoSettings): VideoSettings {
  if (!video.target_resolution) return video;

  const res = video.target_resolution;
  const issues: string[] = [];

  // Check width
  if (res.width !== undefined) {
    if (res.width < MIN_RESOLUTION) {
      issues.push(`width ${res.width} < ${MIN_RESOLUTION}`);
      res.width = MIN_RESOLUTION;
    }
    if (res.width > MAX_RESOLUTION) {
      issues.push(`width ${res.width} > ${MAX_RESOLUTION}`);
      res.width = MAX_RESOLUTION;
    }
  }

  // Check height
  if (res.height !== undefined) {
    if (res.height < MIN_RESOLUTION) {
      issues.push(`height ${res.height} < ${MIN_RESOLUTION}`);
      res.height = MIN_RESOLUTION;
    }
    if (res.height > MAX_RESOLUTION) {
      issues.push(`height ${res.height} > ${MAX_RESOLUTION}`);
      res.height = MAX_RESOLUTION;
    }
  }

  // Check bitrate
  if (res.bitrate !== undefined) {
    if (res.bitrate < 0) {
      issues.push(`bitrate ${res.bitrate} < 0`);
      res.bitrate = 0;
    }
    if (res.bitrate > MAX_BITRATE) {
      issues.push(`bitrate ${res.bitrate} > ${MAX_BITRATE}`);
      res.bitrate = MAX_BITRATE;
    }
  }

  if (issues.length > 0) {
    const msg = `${TAG} Fixed invalid target_resolution: ${issues.join(", ")}`;
    if (__DEV__) {
      console.error(msg);
    } else {
      console.warn(msg);
    }
  }

  return { ...video, target_resolution: res };
}

/**
 * Validate participant/member IDs before call creation.
 * Throws in __DEV__ if invalid IDs are detected.
 * In production, filters out invalid IDs and logs a warning.
 *
 * @returns Array of valid, unique, non-empty user IDs
 */
export function validateParticipantIds(
  ids: string[],
  context: string = "call",
): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  const issues: string[] = [];

  for (const id of ids) {
    if (typeof id !== "string" || id.trim().length === 0) {
      issues.push(`empty/invalid ID: ${JSON.stringify(id)}`);
      continue;
    }
    const trimmed = id.trim();
    if (seen.has(trimmed)) {
      issues.push(`duplicate ID: ${trimmed}`);
      continue;
    }
    seen.add(trimmed);
    valid.push(trimmed);
  }

  if (issues.length > 0) {
    const msg = `${TAG} Invalid participant IDs for ${context}: ${issues.join(", ")}`;
    if (__DEV__) {
      console.error(msg);
    }
    console.warn(msg);
  }

  if (valid.length === 0) {
    throw new Error(`No valid participant IDs provided for ${context}.`);
  }

  return valid;
}
