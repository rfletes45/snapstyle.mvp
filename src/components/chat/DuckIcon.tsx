/**
 * DUCK ICON
 * Renders the duck image used for both the composer button and the chat bubble.
 *
 * Uses the bundled duck.jpeg asset instead of an SVG path.
 */

import React from "react";
import { Image, StyleSheet, View } from "react-native";

// Brand colours for the duck
export const DUCK_BG = "#E8C840"; // golden yellow
export const DUCK_FG = "#4A2F0A"; // dark brown

// eslint-disable-next-line @typescript-eslint/no-var-requires
const DUCK_IMAGE = require("../../../assets/images/duck.jpeg");

interface DuckIconProps {
  /** Overall size of the icon (height) */
  size?: number;
  /** Whether to render as a round button (with background) */
  round?: boolean;
  /** Whether to render slightly wider than tall (rectangular) */
  wide?: boolean;
}

const DuckIcon: React.FC<DuckIconProps> = ({
  size = 40,
  round = false,
  wide = false,
}) => {
  const w = wide ? Math.round(size * 1.3) : size;
  const h = size;
  const radius = 6;

  if (round || wide) {
    return (
      <View
        style={[
          styles.roundContainer,
          {
            width: w,
            height: h,
            borderRadius: radius,
          },
        ]}
      >
        <Image
          source={DUCK_IMAGE}
          style={{
            width: w,
            height: h,
            borderRadius: radius,
          }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <Image
      source={DUCK_IMAGE}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  roundContainer: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default React.memo(DuckIcon);
