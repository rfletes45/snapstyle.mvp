import {
  CAMERA_FILTERS,
  CAMERA_FILTER_SCHEMA_VERSION,
  NORMAL_CAMERA_FILTER_ID,
  clampCameraFilterIntensity,
  getCameraFilterById,
  getCameraFilterExportPayload,
  getCameraFilterMetadataPayload,
  getCameraFilterPreviewStyle,
  getCameraFilterVideoExportPayload,
} from "../../src/services/camera/filters/filterRegistry";
import { createCameraFilterControllerSnapshot } from "../../src/hooks/camera/useCameraFilterController";

describe("camera filter registry", () => {
  it("keeps the normal filter first", () => {
    expect(CAMERA_FILTERS[0].id).toBe(NORMAL_CAMERA_FILTER_ID);
    expect(CAMERA_FILTERS[0].renderMode).toBe("none");
  });

  it("has unique filter ids", () => {
    const ids = CAMERA_FILTERS.map((filter) => filter.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defines valid intensity bounds for every filter", () => {
    for (const filter of CAMERA_FILTERS) {
      expect(filter.minIntensity).toBeLessThanOrEqual(filter.defaultIntensity);
      expect(filter.defaultIntensity).toBeLessThanOrEqual(filter.maxIntensity);
      expect(filter.schemaVersion).toBe(CAMERA_FILTER_SCHEMA_VERSION);
    }
  });

  it("clamps controller intensity and falls back to normal safely", () => {
    const warm = getCameraFilterById("warm");

    expect(clampCameraFilterIntensity(warm, -10)).toBe(warm.minIntensity);
    expect(clampCameraFilterIntensity(warm, 10)).toBe(warm.maxIntensity);

    const snapshot = createCameraFilterControllerSnapshot("missing", 99);
    expect(snapshot.selectedFilterId).toBe(NORMAL_CAMERA_FILTER_ID);
    expect(snapshot.filterIntensity).toBe(0);
    expect(snapshot.hasActiveFilter).toBe(false);
  });

  it("maps selected filters to preview style and export metadata", () => {
    const sunset = getCameraFilterById("sunset");
    const previewStyle = getCameraFilterPreviewStyle(sunset, 0.5);
    const exportPayload = getCameraFilterExportPayload(sunset, 0.5);
    const metadata = getCameraFilterMetadataPayload(sunset, 0.5);

    expect(previewStyle).toMatchObject({
      backgroundColor: sunset.previewTint,
    });
    expect(exportPayload).toMatchObject({
      filterId: "sunset",
      filterSchemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
      filterFlattened: true,
    });
    expect(metadata).toEqual({
      filterId: "sunset",
      filterIntensity: 0.5,
      filterSchemaVersion: CAMERA_FILTER_SCHEMA_VERSION,
      filterFlattened: true,
    });
  });

  it("does not claim video filter export support", () => {
    expect(getCameraFilterVideoExportPayload()).toBeNull();
  });
});
