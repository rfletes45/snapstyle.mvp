/**
 * PresenceIndicator Component
 *
 * Displays a small green/gray dot to indicate online/offline status.
 * Can be overlaid on avatars or shown inline with text.
 *
 * @module components/ui/PresenceIndicator
 */

import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

interface PresenceIndicatorProps {
  /** Whether the user is online */
  online: boolean;
  /** Size of the indicator (default: 10) */
  size?: number;
  /** Position for avatar overlay: 'bottom-right' (default), 'top-right' */
  position?: "bottom-right" | "top-right" | "inline";
  /** Additional styles for positioning */
  style?: ViewStyle;
  /** Border color (for avatar overlay, usually matches background) */
  borderColor?: string;
}

/**
 * Online presence indicator dot
 *
 * @example
 * ```tsx
 * // Standalone
 * <PresenceIndicator online={isOnline} />
 *
 * // Overlay on avatar
 * <View>
 *   <Avatar />
 *   <PresenceIndicator
 *     online={isOnline}
 *     position="bottom-right"
 *     borderColor={theme.colors.surface}
 *   />
 * </View>
 *
 * // Inline with text
 * <View style={{ flexDirection: 'row', alignItems: 'center' }}>
 *   <PresenceIndicator online={isOnline} position="inline" />
 *   <Text>{isOnline ? 'Online' : 'Offline'}</Text>
 * </View>
 * ```
 */
export const PresenceIndicator: React.FC<PresenceIndicatorProps> = React.memo(
  ({ online, size = 10, position = "bottom-right", style, borderColor }) => {
    const theme = useTheme();

    const dotColor = online ? "#4CAF50" : theme.colors.outline;
    const border = borderColor || theme.colors.surface;

    const positionStyles: Record<string, ViewStyle> = {
      "bottom-right": {
        position: "absolute",
        bottom: 0,
        right: 0,
      },
      "top-right": {
        position: "absolute",
        top: 0,
        right: 0,
      },
      inline: {
        marginRight: 6,
      },
    };

    return (
      <View
        style={[
          styles.indicator,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: dotColor,
            borderColor: position !== "inline" ? border : "transparent",
            borderWidth: position !== "inline" ? 2 : 0,
          },
          positionStyles[position],
          style,
        ]}
      />
    );
  },
);

PresenceIndicator.displayName = "PresenceIndicator";

const styles = StyleSheet.create({
  indicator: {
    // Base styles - specifics set via props
  },
});
