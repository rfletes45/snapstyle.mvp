/**
 * Cart Course - Main Game Component
 * Uses react-native-game-engine with Matter.js physics and Skia rendering
 */

import React, { useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { GameEngine } from "react-native-game-engine";

import { VISUAL_CONFIG } from "./data/constants";
import { useCartCourseGame } from "./hooks/useCartCourseGame";
import { SafeSkiaRenderer } from "./renderers/SafeSkiaRenderer";
import { CameraSystem } from "./systems/CameraSystem";
import { CrashDetectionSystem } from "./systems/CrashDetectionSystem";
import { PhysicsSystem } from "./systems/PhysicsSystem";
import { TiltGravitySystem } from "./systems/TiltGravitySystem";
import {
  GameEngineUpdateProps,
  GameEntities,
  GameEvent,
} from "./types/cartCourse.types";

// ============================================
// Game Systems
// ============================================

const createGameSystems = (inputState: { tilt: { x: number; y: number } }) => {
  return [
    // Wrap systems to inject input state
    (entities: GameEntities, props: any) => {
      // Inject tilt into props
      const propsWithTilt: GameEngineUpdateProps = {
        time: props.time || {
          delta: 16,
          current: Date.now(),
          previous: Date.now() - 16,
        },
        touches: props.touches || [],
        dispatch: props.dispatch || (() => {}),
        events: props.events || [],
        input: {
          tilt: inputState.tilt as any,
          leftButton: false,
          rightButton: false,
          leftJoystick: { angle: 0, magnitude: 0 },
          rightJoystick: { angle: 0, magnitude: 0 },
          isBlowing: false,
        },
        tilt: inputState.tilt as any,
      };
      return TiltGravitySystem(entities, propsWithTilt);
    },
    PhysicsSystem as any,
    CrashDetectionSystem as any,
    CameraSystem as any,
  ];
};

// ============================================
// CartCourse Component
// ============================================

export const CartCourse: React.FC = () => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const gameEngineRef = useRef<GameEngine | null>(null);

  const {
    entities,
    gameState,
    inputState,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    calibrateTilt,
    handleEvent,
  } = useCartCourseGame();

  // Handle game events from systems
  const onEvent = useCallback(
    (event: GameEvent) => {
      handleEvent(event);
    },
    [handleEvent],
  );

  // Create systems with current input state
  const systems = createGameSystems(inputState);

  // Render loading state
  if (!entities) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Cart Course...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Game Engine with Skia Renderer */}
      <GameEngine
        ref={(ref) => {
          gameEngineRef.current = ref;
        }}
        style={styles.gameContainer}
        systems={systems}
        entities={entities}
        running={gameState.status === "playing"}
        onEvent={onEvent}
        renderer={(
          gameEntities: GameEntities | null,
          _screen: { width: number; height: number },
          _layout: { width: number; height: number } | null,
        ) => {
          // Safety check - don't render if entities is null (GameEngine initial state)
          if (!gameEntities) {
            return null;
          }
          return <SafeSkiaRenderer entities={gameEntities} />;
        }}
      />

      {/* HUD Overlay */}
      <View style={styles.hudContainer}>
        {/* Top HUD */}
        <View style={styles.topHud}>
          {/* Lives */}
          <View style={styles.hudItem}>
            <Text style={styles.hudText}>❤️ x {gameState.lives}</Text>
          </View>

          {/* Score */}
          <View style={styles.hudItem}>
            <Text style={styles.hudText}>{gameState.score} pts</Text>
          </View>
        </View>

        {/* Tilt Indicator */}
        <View style={styles.tiltIndicator}>
          <View
            style={[
              styles.tiltDot,
              {
                transform: [
                  { translateX: inputState.tilt.x * 30 },
                  { translateY: -inputState.tilt.y * 30 },
                ],
              },
            ]}
          />
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {/* Calibrate Button */}
        <TouchableOpacity style={styles.controlButton} onPress={calibrateTilt}>
          <Text style={styles.controlButtonText}>Calibrate</Text>
        </TouchableOpacity>

        {/* Pause/Resume Button */}
        {gameState.status === "playing" ? (
          <TouchableOpacity style={styles.controlButton} onPress={pauseGame}>
            <Text style={styles.controlButtonText}>Pause</Text>
          </TouchableOpacity>
        ) : gameState.status === "paused" ? (
          <TouchableOpacity style={styles.controlButton} onPress={resumeGame}>
            <Text style={styles.controlButtonText}>Resume</Text>
          </TouchableOpacity>
        ) : null}

        {/* Restart Button */}
        <TouchableOpacity style={styles.controlButton} onPress={restartGame}>
          <Text style={styles.controlButtonText}>Restart</Text>
        </TouchableOpacity>
      </View>

      {/* Start Screen Overlay */}
      {gameState.status === "idle" && (
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <Text style={styles.overlayTitle}>Cart Course</Text>
            <Text style={styles.overlaySubtitle}>
              Tilt your device to control the cart!
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={startGame}>
              <Text style={styles.startButtonText}>Start Game</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calibrateButton}
              onPress={calibrateTilt}
            >
              <Text style={styles.calibrateButtonText}>Calibrate Tilt</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Game Over Overlay */}
      {gameState.status === "complete" && (
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <Text style={styles.overlayTitle}>
              {gameState.lives <= 0 ? "Game Over" : "Course Complete!"}
            </Text>
            <Text style={styles.overlayScore}>Score: {gameState.score}</Text>
            <TouchableOpacity style={styles.startButton} onPress={restartGame}>
              <Text style={styles.startButtonText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Paused Overlay */}
      {gameState.status === "paused" && (
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <Text style={styles.overlayTitle}>Paused</Text>
            <TouchableOpacity style={styles.startButton} onPress={resumeGame}>
              <Text style={styles.startButtonText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calibrateButton}
              onPress={calibrateTilt}
            >
              <Text style={styles.calibrateButtonText}>Calibrate Tilt</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VISUAL_CONFIG.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: VISUAL_CONFIG.colors.background,
  },
  loadingText: {
    color: VISUAL_CONFIG.colors.text,
    fontSize: 18,
  },
  gameContainer: {
    flex: 1,
  },
  hudContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 50,
  },
  topHud: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hudItem: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hudText: {
    color: VISUAL_CONFIG.colors.text,
    fontSize: 16,
    fontWeight: "bold",
  },
  tiltIndicator: {
    position: "absolute",
    top: 100,
    right: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  tiltDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: VISUAL_CONFIG.colors.accents,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  controlButton: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  controlButtonText: {
    color: VISUAL_CONFIG.colors.text,
    fontSize: 14,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayContent: {
    backgroundColor: VISUAL_CONFIG.colors.background,
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: VISUAL_CONFIG.colors.girders,
  },
  overlayTitle: {
    color: VISUAL_CONFIG.colors.text,
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 12,
  },
  overlaySubtitle: {
    color: VISUAL_CONFIG.colors.text,
    fontSize: 16,
    marginBottom: 24,
    opacity: 0.8,
    textAlign: "center",
  },
  overlayScore: {
    color: VISUAL_CONFIG.colors.girders,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: VISUAL_CONFIG.colors.accents,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  startButtonText: {
    color: VISUAL_CONFIG.colors.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  calibrateButton: {
    backgroundColor: "transparent",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: VISUAL_CONFIG.colors.girders,
  },
  calibrateButtonText: {
    color: VISUAL_CONFIG.colors.girders,
    fontSize: 14,
  },
});

export default CartCourse;
