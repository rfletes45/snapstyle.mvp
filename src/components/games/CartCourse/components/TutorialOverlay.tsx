/**
 * TutorialOverlay - Phase 7
 * Tutorial system with step-by-step instructions
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

// ============================================
// Tutorial Types
// ============================================

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon?: string;
  highlightArea?: {
    x: number | string;
    y: number | string;
    width: number | string;
    height: number | string;
  };
  position?: "top" | "center" | "bottom";
  showSkip?: boolean;
  autoProceed?: boolean;
  autoProceedDelay?: number;
  requiresAction?: string;
}

export interface TutorialConfig {
  steps: TutorialStep[];
  onComplete: () => void;
  onSkip?: () => void;
  canSkip?: boolean;
  theme?: "dark" | "light";
}

export interface TutorialOverlayProps extends TutorialConfig {
  isVisible: boolean;
  currentStep?: number;
  onStepChange?: (step: number) => void;
}

// ============================================
// Tutorial Step Data
// ============================================

export const CART_COURSE_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Cart Course!",
    description:
      "Guide your cart through the obstacle course by tilting your device. Let's learn the basics!",
    icon: "🛒",
    position: "center",
    showSkip: true,
  },
  {
    id: "tilt_controls",
    title: "Tilt to Move",
    description:
      "Tilt your device left or right to control the cart's direction. The cart will roll with gravity!",
    icon: "📱",
    position: "center",
  },
  {
    id: "crash_warning",
    title: "Don't Crash!",
    description:
      "Your cart is fragile. Avoid hitting walls too hard, falling too far, or flipping over.",
    icon: "💥",
    position: "center",
  },
  {
    id: "lives",
    title: "Lives System",
    description:
      "You have 3 lives. Lose one when you crash, but don't worry - you'll restart at the last checkpoint!",
    icon: "❤️",
    position: "top",
    highlightArea: { x: 16, y: 50, width: 100, height: 40 },
  },
  {
    id: "checkpoints",
    title: "Checkpoints",
    description:
      "Pass through checkpoints to save your progress. Each area has one checkpoint.",
    icon: "🚩",
    position: "center",
  },
  {
    id: "collectibles",
    title: "Collect Bananas",
    description:
      "Grab bananas for points! Collect all bananas in a section to reveal bonus coins.",
    icon: "🍌",
    position: "top",
    highlightArea: { x: "35%", y: 50, width: "30%", height: 50 },
  },
  {
    id: "score",
    title: "Scoring",
    description:
      "Earn points from collectibles and time bonuses. Score 2000 points for an extra life!",
    icon: "⭐",
    position: "top",
    highlightArea: { x: "60%", y: 50, width: "35%", height: 60 },
  },
  {
    id: "timer",
    title: "Time Limit",
    description:
      "Complete the course within 10 minutes. Faster completion = bigger time bonus!",
    icon: "⏱️",
    position: "top",
    highlightArea: { x: "65%", y: 50, width: 100, height: 40 },
  },
  {
    id: "l_button",
    title: "L Button",
    description:
      "Tap and hold the left side of the screen to control L-mechanisms like rotating gears.",
    icon: "👈",
    position: "center",
    highlightArea: { x: 0, y: "40%", width: "15%", height: "30%" },
  },
  {
    id: "r_button",
    title: "R Button",
    description:
      "Tap and hold the right side to control R-mechanisms and charge launchers.",
    icon: "👉",
    position: "center",
    highlightArea: { x: "85%", y: "40%", width: "15%", height: "30%" },
  },
  {
    id: "joysticks",
    title: "Joystick Controls",
    description:
      "Some mechanisms need joysticks. Move them with your thumb to rotate gears or tilt platforms.",
    icon: "🕹️",
    position: "bottom",
    highlightArea: { x: "5%", y: "60%", width: "90%", height: "35%" },
  },
  {
    id: "blow_control",
    title: "Blow to Lift!",
    description:
      "Some platforms rise when you blow into the mic! Tap the 💨 button if you prefer not to blow.",
    icon: "💨",
    position: "bottom",
    highlightArea: { x: "40%", y: "85%", width: "20%", height: "12%" },
  },
  {
    id: "ready",
    title: "You're Ready!",
    description:
      "That's everything! Tilt carefully, use mechanisms wisely, and reach the goal. Good luck!",
    icon: "🎮",
    position: "center",
    showSkip: false,
  },
];

// ============================================
// Highlight Overlay Component
// ============================================

interface HighlightOverlayProps {
  area?: TutorialStep["highlightArea"];
  opacity?: number;
}

const HighlightOverlay: React.FC<HighlightOverlayProps> = ({
  area,
  opacity = 0.8,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  if (!area) {
    return (
      <View style={[styles.fullOverlay, { opacity }]} pointerEvents="none" />
    );
  }

  // Parse area values
  const parseValue = (val: number | string, max: number): number => {
    if (typeof val === "number") return val;
    if (val.endsWith("%")) {
      return (parseFloat(val) / 100) * max;
    }
    return parseFloat(val);
  };

  const x = parseValue(area.x, screenWidth);
  const y = parseValue(area.y, screenHeight);
  const w = parseValue(area.width, screenWidth);
  const h = parseValue(area.height, screenHeight);

  return (
    <View style={styles.highlightContainer} pointerEvents="none">
      {/* Top */}
      <View
        style={[styles.overlayPart, { top: 0, left: 0, right: 0, height: y }]}
      />
      {/* Bottom */}
      <View
        style={[
          styles.overlayPart,
          { top: y + h, left: 0, right: 0, bottom: 0 },
        ]}
      />
      {/* Left */}
      <View
        style={[styles.overlayPart, { top: y, left: 0, width: x, height: h }]}
      />
      {/* Right */}
      <View
        style={[
          styles.overlayPart,
          { top: y, left: x + w, right: 0, height: h },
        ]}
      />
      {/* Highlight border */}
      <View
        style={[
          styles.highlightBorder,
          { top: y - 2, left: x - 2, width: w + 4, height: h + 4 },
        ]}
      />
    </View>
  );
};

// ============================================
// Tutorial Card Component
// ============================================

interface TutorialCardProps {
  step: TutorialStep;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  canSkip: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
}

const TutorialCard: React.FC<TutorialCardProps> = ({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  canSkip,
  canGoPrevious,
  canGoNext,
  isLastStep,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step.id, slideAnim, fadeAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  // Position styles
  const positionStyle =
    step.position === "top"
      ? styles.cardTop
      : step.position === "bottom"
        ? styles.cardBottom
        : styles.cardCenter;

  return (
    <Animated.View
      style={[
        styles.card,
        positionStyle,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Icon */}
      {step.icon && <Text style={styles.cardIcon}>{step.icon}</Text>}

      {/* Title */}
      <Text style={styles.cardTitle}>{step.title}</Text>

      {/* Description */}
      <Text style={styles.cardDescription}>{step.description}</Text>

      {/* Progress dots */}
      <View style={styles.progressDots}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i === currentIndex && styles.progressDotActive,
              i < currentIndex && styles.progressDotComplete,
            ]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        {canSkip && step.showSkip !== false && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Skip Tutorial</Text>
          </TouchableOpacity>
        )}

        <View style={styles.navButtons}>
          {canGoPrevious && (
            <TouchableOpacity style={styles.prevButton} onPress={onPrevious}>
              <Text style={styles.prevButtonText}>← Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.nextButton, isLastStep && styles.doneButton]}
            onPress={onNext}
          >
            <Text style={styles.nextButtonText}>
              {isLastStep ? "Start Playing!" : "Next →"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

// ============================================
// Main Tutorial Overlay Component
// ============================================

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  isVisible,
  steps,
  currentStep: externalStep,
  onStepChange,
  onComplete,
  onSkip,
  canSkip = true,
}) => {
  const [internalStep, setInternalStep] = useState(0);
  const currentStepIndex = externalStep ?? internalStep;

  // Reset when becoming visible
  useEffect(() => {
    if (isVisible && externalStep === undefined) {
      setInternalStep(0);
    }
  }, [isVisible, externalStep]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      const nextStep = currentStepIndex + 1;
      if (externalStep === undefined) {
        setInternalStep(nextStep);
      }
      onStepChange?.(nextStep);
    } else {
      onComplete();
    }
  }, [currentStepIndex, steps.length, externalStep, onStepChange, onComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevStep = currentStepIndex - 1;
      if (externalStep === undefined) {
        setInternalStep(prevStep);
      }
      onStepChange?.(prevStep);
    }
  }, [currentStepIndex, externalStep, onStepChange]);

  const handleSkip = useCallback(() => {
    onSkip?.();
    onComplete();
  }, [onSkip, onComplete]);

  if (!isVisible || steps.length === 0) {
    return null;
  }

  const currentStepData = steps[currentStepIndex];
  if (!currentStepData) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Dark overlay with highlight cutout */}
      <HighlightOverlay area={currentStepData.highlightArea} />

      {/* Tutorial card */}
      <TutorialCard
        step={currentStepData}
        currentIndex={currentStepIndex}
        totalSteps={steps.length}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSkip={handleSkip}
        canSkip={canSkip}
        canGoPrevious={currentStepIndex > 0}
        canGoNext={currentStepIndex < steps.length}
        isLastStep={currentStepIndex === steps.length - 1}
      />
    </View>
  );
};

// ============================================
// Quick Tip Component (for contextual hints)
// ============================================

export interface QuickTipProps {
  message: string;
  icon?: string;
  position?: "top" | "bottom";
  isVisible: boolean;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export const QuickTip: React.FC<QuickTipProps> = ({
  message,
  icon,
  position = "top",
  isVisible,
  onDismiss,
  autoDismissMs = 3000,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      if (autoDismissMs > 0) {
        const timer = setTimeout(onDismiss, autoDismissMs);
        return () => clearTimeout(timer);
      }
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, autoDismissMs, onDismiss, fadeAnim, slideAnim]);

  if (!isVisible) {
    return null;
  }

  const positionStyle = position === "top" ? styles.tipTop : styles.tipBottom;

  return (
    <Animated.View
      style={[
        styles.quickTip,
        positionStyle,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.quickTipContent}
        onPress={onDismiss}
        activeOpacity={0.8}
      >
        {icon && <Text style={styles.quickTipIcon}>{icon}</Text>}
        <Text style={styles.quickTipText}>{message}</Text>
        <Text style={styles.quickTipDismiss}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================
// Countdown Overlay Component
// ============================================

export interface CountdownOverlayProps {
  count: number;
  isVisible: boolean;
  onComplete?: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  count,
  isVisible,
  onComplete,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible && count > 0) {
      // Reset and animate
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(1);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.5,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 800,
            delay: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [count, isVisible, scaleAnim, opacityAnim]);

  if (!isVisible) {
    return null;
  }

  const displayText = count > 0 ? count.toString() : "GO!";
  const textColor = count > 0 ? "#ffffff" : "#4CAF50";

  return (
    <View style={styles.countdownContainer} pointerEvents="none">
      <Animated.Text
        style={[
          styles.countdownText,
          {
            color: textColor,
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {displayText}
      </Animated.Text>
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
    zIndex: 999,
  },

  // Overlay
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  highlightContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayPart: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  highlightBorder: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#4CAF50",
    borderRadius: 8,
    borderStyle: "dashed",
  },

  // Card
  card: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardTop: {
    top: 120,
  },
  cardCenter: {
    top: "30%",
  },
  cardBottom: {
    bottom: 150,
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },

  // Progress dots
  progressDots: {
    flexDirection: "row",
    marginBottom: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: "#4CAF50",
    width: 24,
  },
  progressDotComplete: {
    backgroundColor: "rgba(76, 175, 80, 0.5)",
  },

  // Buttons
  buttonRow: {
    width: "100%",
  },
  navButtons: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  skipButton: {
    alignSelf: "center",
    paddingVertical: 8,
    marginBottom: 8,
  },
  skipButtonText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
  },
  prevButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 8,
  },
  prevButtonText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
  },
  nextButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  doneButton: {
    backgroundColor: "#ff6b6b",
  },
  nextButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Quick tip
  quickTip: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  tipTop: {
    top: 100,
  },
  tipBottom: {
    bottom: 100,
  },
  quickTipContent: {
    backgroundColor: "rgba(26, 26, 46, 0.95)",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  quickTipIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  quickTipText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
  },
  quickTipDismiss: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 16,
    marginLeft: 8,
  },

  // Countdown
  countdownContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  countdownText: {
    fontSize: 120,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
});

export default TutorialOverlay;
