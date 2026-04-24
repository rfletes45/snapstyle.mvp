import {
  type CameraFilterDefinition,
  type CameraFilterExportPayload,
  type CameraFilterMetadataPayload,
  type CameraFilterPreviewStyle,
  clampCameraFilterIntensity,
  getCameraFilterById,
  getCameraFilterExportPayload,
  getCameraFilterMetadataPayload,
  getCameraFilterPreviewStyle,
  isNormalCameraFilter,
} from "@/services/camera/filters/filterRegistry";
import { useCallback, useMemo, useState } from "react";

export interface CameraFilterControllerSnapshot {
  selectedFilterId: string;
  selectedFilter: CameraFilterDefinition;
  filterIntensity: number;
  hasActiveFilter: boolean;
  previewStyle: CameraFilterPreviewStyle | null;
  exportPayload: CameraFilterExportPayload | null;
  snapMetadataPayload: CameraFilterMetadataPayload | null;
}

export interface CameraFilterController
  extends CameraFilterControllerSnapshot {
  setSelectedFilterId: (filterId: string) => void;
  setFilterIntensity: (intensity: number) => void;
  resetFilter: () => void;
}

export function createCameraFilterControllerSnapshot(
  filterId: string | null | undefined,
  intensity: number,
): CameraFilterControllerSnapshot {
  const selectedFilter = getCameraFilterById(filterId);
  const filterIntensity = clampCameraFilterIntensity(selectedFilter, intensity);
  const hasActiveFilter = !isNormalCameraFilter(selectedFilter);

  return {
    selectedFilterId: selectedFilter.id,
    selectedFilter,
    filterIntensity,
    hasActiveFilter,
    previewStyle: getCameraFilterPreviewStyle(
      selectedFilter,
      filterIntensity,
    ),
    exportPayload: getCameraFilterExportPayload(
      selectedFilter,
      filterIntensity,
    ),
    snapMetadataPayload: getCameraFilterMetadataPayload(
      selectedFilter,
      filterIntensity,
    ),
  };
}

export function useCameraFilterController(
  initialFilterId?: string,
): CameraFilterController {
  const initialFilter = getCameraFilterById(initialFilterId);
  const [selectedFilterId, setSelectedFilterIdState] = useState(
    initialFilter.id,
  );
  const [filterIntensity, setFilterIntensityState] = useState(
    initialFilter.defaultIntensity,
  );

  const snapshot = useMemo(
    () =>
      createCameraFilterControllerSnapshot(
        selectedFilterId,
        filterIntensity,
      ),
    [filterIntensity, selectedFilterId],
  );

  const setSelectedFilterId = useCallback((filterId: string) => {
    const nextFilter = getCameraFilterById(filterId);
    setSelectedFilterIdState(nextFilter.id);
    setFilterIntensityState(nextFilter.defaultIntensity);
  }, []);

  const setFilterIntensity = useCallback(
    (intensity: number) => {
      setFilterIntensityState(
        clampCameraFilterIntensity(snapshot.selectedFilter, intensity),
      );
    },
    [snapshot.selectedFilter],
  );

  const resetFilter = useCallback(() => {
    const normalFilter = getCameraFilterById(undefined);
    setSelectedFilterIdState(normalFilter.id);
    setFilterIntensityState(normalFilter.defaultIntensity);
  }, []);

  return useMemo(
    () => ({
      ...snapshot,
      setSelectedFilterId,
      setFilterIntensity,
      resetFilter,
    }),
    [resetFilter, setFilterIntensity, setSelectedFilterId, snapshot],
  );
}
