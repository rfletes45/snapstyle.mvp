import type { CameraFilterDefinition } from "@/services/camera/filters/filterRegistry";
import { getCameraFilterPreviewStyle } from "@/services/camera/filters/filterRegistry";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

interface Props {
  filter: CameraFilterDefinition | null;
  intensity?: number;
}

const CameraFilterOverlay: React.FC<Props> = React.memo(
  ({ filter, intensity = 1 }) => {
    const previewStyle = useMemo(() => {
      if (!filter) return null;
      return getCameraFilterPreviewStyle(filter, intensity);
    }, [filter, intensity]);

    if (!previewStyle) {
      return null;
    }

    return (
      <View
        pointerEvents="none"
        style={[
          styles.overlay,
          {
            backgroundColor: previewStyle.backgroundColor,
            opacity: previewStyle.opacity,
          },
        ]}
      />
    );
  },
);

CameraFilterOverlay.displayName = "CameraFilterOverlay";

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});

export default CameraFilterOverlay;
