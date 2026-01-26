/**
 * InAppToast Component
 *
 * A branded toast/banner component for in-app notifications.
 * Renders at the top of the app with safe area padding.
 *
 * Features:
 * - Catppuccin-themed styling
 * - Tap to navigate
 * - Swipe to dismiss
 * - Auto-dismiss animation
 * - Stacking support (max 2)
 */

import {
  InAppNotification,
  NotificationType,
  useInAppNotifications,
} from "@/store/InAppNotificationsContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BorderRadius,
  FontSizes,
  FontWeights,
  Spacing,
} from "../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TOAST_HEIGHT = 72;
const SWIPE_THRESHOLD = 50;

// =============================================================================
// Toast Item
// =============================================================================

interface ToastItemProps {
  notification: InAppNotification;
  index: number;
  onDismiss: (id: string) => void;
  onPress: (notification: InAppNotification) => void;
  topOffset: number;
}

function ToastItem({
  notification,
  index,
  onDismiss,
  onPress,
  topOffset,
}: ToastItemProps) {
  const { colors, isDark } = useAppTheme();
  const translateY = useRef(new Animated.Value(-100)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Slide in animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Allow horizontal or upward swipe
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        // Dismiss if swiped up or horizontally past threshold
        if (
          gestureState.dy < -SWIPE_THRESHOLD ||
          Math.abs(gestureState.dx) > SWIPE_THRESHOLD
        ) {
          // Animate out
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -100,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onDismiss(notification.id);
          });
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    }),
  ).current;

  const getIcon = (
    type: NotificationType,
  ): keyof typeof MaterialCommunityIcons.glyphMap => {
    switch (type) {
      case "message":
        return "message-text";
      case "friend_request":
        return "account-plus";
      default:
        return "bell";
    }
  };

  const getIconColor = (type: NotificationType): string => {
    switch (type) {
      case "message":
        return colors.primary;
      case "friend_request":
        return colors.secondary;
      default:
        return colors.info;
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastItem,
        {
          backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
          top: topOffset + index * (TOAST_HEIGHT + Spacing.xs),
          transform: [{ translateY }, { translateX }],
          opacity,
          shadowColor: isDark ? "#000" : colors.text,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={() => onPress(notification)}
        activeOpacity={0.8}
      >
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: getIconColor(notification.type) + "20" },
          ]}
        >
          <MaterialCommunityIcons
            name={getIcon(notification.type)}
            size={22}
            color={getIconColor(notification.type)}
          />
        </View>

        {/* Text content */}
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text
            style={[styles.body, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {notification.body}
          </Text>
        </View>

        {/* Dismiss hint */}
        <MaterialCommunityIcons
          name="chevron-up"
          size={20}
          color={colors.textMuted}
          style={styles.dismissHint}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// Toast Container
// =============================================================================

interface InAppToastProps {
  /** Navigation callback */
  onNavigate?: (screen: string, params?: Record<string, unknown>) => void;
}

export default function InAppToast({ onNavigate }: InAppToastProps) {
  const insets = useSafeAreaInsets();
  const { notifications, dismiss, onMessageNotificationPressed } =
    useInAppNotifications();

  const handlePress = (notification: InAppNotification) => {
    // For message notifications, trigger the press handler so inbox can mark as read
    if (notification.type === "message" && notification.entityId) {
      onMessageNotificationPressed(notification.entityId);
    }

    // Dismiss the notification
    dismiss(notification.id);

    // Navigate if callback provided
    if (onNavigate && notification.navigateTo) {
      onNavigate(
        notification.navigateTo.screen,
        notification.navigateTo.params,
      );
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  // Add extra spacing on mobile devices to prevent cutoff from dynamic island/notch
  // Mobile needs significant extra padding to display below status bar and notch
  const topPadding =
    Platform.OS === "web"
      ? insets.top + Spacing.lg + Spacing.md
      : insets.top + 16;

  return (
    <View
      style={[
        styles.container,
        {
          pointerEvents: "box-none" as const,
        },
      ]}
    >
      {notifications.map((notification, index) => (
        <ToastItem
          key={notification.id}
          notification={notification}
          index={index}
          onDismiss={dismiss}
          onPress={handlePress}
          topOffset={topPadding}
        />
      ))}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  toastItem: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    height: TOAST_HEIGHT,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  toastContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    marginBottom: 2,
  },
  body: {
    fontSize: FontSizes.sm,
  },
  dismissHint: {
    marginLeft: Spacing.sm,
    opacity: 0.5,
  },
});
