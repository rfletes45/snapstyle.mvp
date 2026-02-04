/**
 * TiltCalibration - Phase 7
 * UI component for calibrating device tilt controls
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

// ============================================
// Tilt Calibration Types
// ============================================

export interface TiltCalibrationData {
  offsetX: number;
  offsetY: number;
  sensitivity: number;
  invertX: boolean;
  invertY: boolean;
  calibratedAt: number;
}

export interface TiltCalibrationProps {
  currentTilt: { x: number; y: number };
  onCalibrate: (data: TiltCalibrationData) => void;
  onClose: () => void;
  initialData?: Partial<TiltCalibrationData>;
}

// ============================================
// Tilt Visualizer Component
// ============================================

interface TiltVisualizerProps {
  tiltX: number;
  tiltY: number;
  offsetX: number;
  offsetY: number;
  size?: number;
}

const TiltVisualizer: React.FC<TiltVisualizerProps> = ({
  tiltX,
  tiltY,
  offsetX,
  offsetY,
  size = 150,
}) => {
  // Calculate adjusted tilt
  const adjustedX = tiltX - offsetX;
  const adjustedY = tiltY - offsetY;

  // Clamp and scale to visualizer bounds
  const maxTilt = 0.5;
  const clampedX = Math.max(-maxTilt, Math.min(maxTilt, adjustedX));
  const clampedY = Math.max(-maxTilt, Math.min(maxTilt, adjustedY));

  const indicatorX = (clampedX / maxTilt) * (size / 2 - 15);
  const indicatorY = (clampedY / maxTilt) * (size / 2 - 15);

  return (
    <View style={[styles.visualizer, { width: size, height: size }]}>
      {/* Crosshair */}
      <View style={styles.crosshairH} />
      <View style={styles.crosshairV} />

      {/* Center zone (neutral) */}
      <View style={styles.centerZone} />

      {/* Tilt indicator */}
      <View
        style={[
          styles.tiltIndicator,
          {
            transform: [{ translateX: indicatorX }, { translateY: indicatorY }],
          },
        ]}
      />

      {/* Direction labels */}
      <Text style={[styles.directionLabel, styles.labelTop]}>Forward</Text>
      <Text style={[styles.directionLabel, styles.labelBottom]}>Back</Text>
      <Text style={[styles.directionLabel, styles.labelLeft]}>Left</Text>
      <Text style={[styles.directionLabel, styles.labelRight]}>Right</Text>
    </View>
  );
};

// ============================================
// Sensitivity Slider Component
// ============================================

interface SensitivitySliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const SensitivitySlider: React.FC<SensitivitySliderProps> = ({
  value,
  onChange,
  min = 0.5,
  max = 2.0,
  step = 0.1,
}) => {
  const steps = Math.round((max - min) / step);
  const normalizedValue = (value - min) / (max - min);

  const handlePress = (index: number) => {
    const newValue = min + (index / steps) * (max - min);
    onChange(Math.round(newValue * 10) / 10);
  };

  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderLabel}>Sensitivity</Text>
      <View style={styles.sliderTrack}>
        {Array.from({ length: steps + 1 }).map((_, i) => {
          const isActive = i / steps <= normalizedValue;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.sliderStep, isActive && styles.sliderStepActive]}
              onPress={() => handlePress(i)}
            />
          );
        })}
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderEndLabel}>Low</Text>
        <Text style={styles.sliderValue}>{value.toFixed(1)}x</Text>
        <Text style={styles.sliderEndLabel}>High</Text>
      </View>
    </View>
  );
};

// ============================================
// Toggle Switch Component
// ============================================

interface ToggleSwitchProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  value,
  onChange,
}) => {
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, animValue]);

  const trackColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#555555", "#4CAF50"],
  });

  const thumbPosition = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  return (
    <TouchableOpacity
      style={styles.toggleContainer}
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <Animated.View
        style={[styles.toggleTrack, { backgroundColor: trackColor }]}
      >
        <Animated.View style={[styles.toggleThumb, { left: thumbPosition }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// ============================================
// Calibration Instructions
// ============================================

interface CalibrationInstructionsProps {
  step: number;
}

const CalibrationInstructions: React.FC<CalibrationInstructionsProps> = ({
  step,
}) => {
  const instructions = [
    {
      title: "Step 1: Hold Position",
      description:
        "Hold your device in a comfortable playing position. This will be your neutral tilt.",
    },
    {
      title: "Step 2: Calibrate",
      description:
        'Press "Calibrate Now" to set the current position as center.',
    },
    {
      title: "Step 3: Test",
      description:
        "Tilt your device to test. The indicator should move smoothly in all directions.",
    },
    {
      title: "Step 4: Adjust",
      description:
        "Adjust sensitivity and inversion settings if needed, then save.",
    },
  ];

  const currentStep = instructions[step] || instructions[0];

  return (
    <View style={styles.instructionsContainer}>
      <Text style={styles.instructionTitle}>{currentStep.title}</Text>
      <Text style={styles.instructionText}>{currentStep.description}</Text>
    </View>
  );
};

// ============================================
// Main Calibration Component
// ============================================

export const TiltCalibration: React.FC<TiltCalibrationProps> = ({
  currentTilt,
  onCalibrate,
  onClose,
  initialData,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // State
  const [step, setStep] = useState(0);
  const [offsetX, setOffsetX] = useState(initialData?.offsetX ?? 0);
  const [offsetY, setOffsetY] = useState(initialData?.offsetY ?? 0);
  const [sensitivity, setSensitivity] = useState(
    initialData?.sensitivity ?? 1.0,
  );
  const [invertX, setInvertX] = useState(initialData?.invertX ?? false);
  const [invertY, setInvertY] = useState(initialData?.invertY ?? false);

  // Animation for calibration feedback
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showCalibrated, setShowCalibrated] = useState(false);

  // Calibrate handler
  const handleCalibrate = useCallback(() => {
    setOffsetX(currentTilt.x);
    setOffsetY(currentTilt.y);
    setStep(2);

    // Show feedback animation
    setShowCalibrated(true);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => setShowCalibrated(false), 1000);
    });
  }, [currentTilt, pulseAnim]);

  // Save handler
  const handleSave = useCallback(() => {
    onCalibrate({
      offsetX,
      offsetY,
      sensitivity,
      invertX,
      invertY,
      calibratedAt: Date.now(),
    });
    onClose();
  }, [offsetX, offsetY, sensitivity, invertX, invertY, onCalibrate, onClose]);

  // Reset handler
  const handleReset = useCallback(() => {
    setOffsetX(0);
    setOffsetY(0);
    setSensitivity(1.0);
    setInvertX(false);
    setInvertY(false);
    setStep(0);
  }, []);

  // Calculate adjusted tilt for visualizer
  const adjustedTiltX = invertX ? -currentTilt.x : currentTilt.x;
  const adjustedTiltY = invertY ? -currentTilt.y : currentTilt.y;

  return (
    <View style={styles.container}>
      <View style={styles.modal}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tilt Calibration</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <CalibrationInstructions step={step} />

        {/* Tilt Visualizer */}
        <Animated.View
          style={[
            styles.visualizerContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <TiltVisualizer
            tiltX={adjustedTiltX * sensitivity}
            tiltY={adjustedTiltY * sensitivity}
            offsetX={offsetX}
            offsetY={offsetY}
          />
          {showCalibrated && (
            <View style={styles.calibratedBadge}>
              <Text style={styles.calibratedText}>✓ Calibrated!</Text>
            </View>
          )}
        </Animated.View>

        {/* Raw Values (Debug) */}
        <View style={styles.rawValues}>
          <Text style={styles.rawValueText}>
            Raw: X={currentTilt.x.toFixed(3)} Y={currentTilt.y.toFixed(3)}
          </Text>
          <Text style={styles.rawValueText}>
            Offset: X={offsetX.toFixed(3)} Y={offsetY.toFixed(3)}
          </Text>
        </View>

        {/* Calibrate Button */}
        <TouchableOpacity
          style={styles.calibrateButton}
          onPress={handleCalibrate}
        >
          <Text style={styles.calibrateButtonText}>Calibrate Now</Text>
        </TouchableOpacity>

        {/* Settings */}
        <View style={styles.settingsContainer}>
          <SensitivitySlider value={sensitivity} onChange={setSensitivity} />

          <View style={styles.toggleRow}>
            <ToggleSwitch
              label="Invert Horizontal"
              value={invertX}
              onChange={setInvertX}
            />
            <ToggleSwitch
              label="Invert Vertical"
              value={invertY}
              onChange={setInvertY}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save & Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: "#ff6b6b",
  },

  // Instructions
  instructionsContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 18,
  },

  // Visualizer
  visualizerContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  visualizer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 75,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  crosshairH: {
    position: "absolute",
    width: "60%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  crosshairV: {
    position: "absolute",
    width: 1,
    height: "60%",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  centerZone: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.5)",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
  },
  tiltIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ff6b6b",
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#ff6b6b",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  directionLabel: {
    position: "absolute",
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.5)",
  },
  labelTop: {
    top: 8,
  },
  labelBottom: {
    bottom: 8,
  },
  labelLeft: {
    left: 8,
  },
  labelRight: {
    right: 8,
  },
  calibratedBadge: {
    position: "absolute",
    bottom: -30,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  calibratedText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 12,
  },

  // Raw values
  rawValues: {
    alignItems: "center",
    marginBottom: 12,
  },
  rawValueText: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.5)",
    fontFamily: "monospace",
  },

  // Calibrate button
  calibrateButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  calibrateButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Settings
  settingsContainer: {
    marginBottom: 16,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderLabel: {
    color: "#ffffff",
    fontSize: 14,
    marginBottom: 8,
  },
  sliderTrack: {
    flexDirection: "row",
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    overflow: "hidden",
  },
  sliderStep: {
    flex: 1,
    backgroundColor: "transparent",
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.1)",
  },
  sliderStepActive: {
    backgroundColor: "#4CAF50",
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sliderEndLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
  },
  sliderValue: {
    color: "#4CAF50",
    fontSize: 12,
    fontWeight: "bold",
  },

  // Toggle
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  toggleLabel: {
    color: "#ffffff",
    fontSize: 12,
    marginRight: 8,
    flex: 1,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },

  // Action buttons
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resetButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 8,
  },
  resetButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  saveButton: {
    flex: 2,
    backgroundColor: "#ff6b6b",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default TiltCalibration;
