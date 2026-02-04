/**
 * useTiltControls Hook
 * Simplified hook for accessing tilt controls
 */

import { useCallback, useEffect, useState } from "react";
import { TiltController, getTiltController } from "../engine/TiltController";
import { TiltInput } from "../types/cartCourse.types";

// ============================================
// Hook Return Type
// ============================================

interface UseTiltControlsReturn {
  tilt: TiltInput;
  isActive: boolean;
  calibrate: () => void;
  start: () => Promise<void>;
  stop: () => void;
}

// ============================================
// useTiltControls Hook
// ============================================

export function useTiltControls(): UseTiltControlsReturn {
  const [tilt, setTilt] = useState<TiltInput>({
    x: 0,
    y: 0,
    pitch: 0,
    roll: 0,
  });
  const [isActive, setIsActive] = useState(false);
  const [controller] = useState<TiltController>(() => getTiltController());

  const start = useCallback(async () => {
    await controller.start((newTilt) => {
      setTilt(newTilt);
    });
    setIsActive(true);
  }, [controller]);

  const stop = useCallback(() => {
    controller.stop();
    setIsActive(false);
  }, [controller]);

  const calibrate = useCallback(() => {
    controller.calibrate();
  }, [controller]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      controller.stop();
    };
  }, [controller]);

  return {
    tilt,
    isActive,
    calibrate,
    start,
    stop,
  };
}
