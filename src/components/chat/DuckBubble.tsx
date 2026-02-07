/**
 * DUCK BUBBLE
 * A picture-sized message bubble showing the duck design.
 * Sent when the user taps the 🦆 duck button in the composer.
 * Uses the bundled duck.jpeg asset.
 */

import React from "react";
import { Dimensions, Image, StyleSheet, View } from "react-native";

const SCREEN_W = Dimensions.get("window").width;

/** Width of the duck bubble — scaled down ~25% from a standard image attachment */
const BUBBLE_W = SCREEN_W * 0.49;
const BUBBLE_H = BUBBLE_W * 0.67;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const DUCK_IMAGE = require("../../../assets/images/duck.jpeg");

interface DuckBubbleProps {
  /** Whether the message was sent by the current user */
  isMine?: boolean;
}

const DuckBubble: React.FC<DuckBubbleProps> = ({ isMine = true }) => {
  return (
    <View
      style={[
        styles.container,
        isMine ? styles.containerMine : styles.containerOther,
      ]}
    >
      <Image source={DUCK_IMAGE} style={styles.image} resizeMode="cover" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: BUBBLE_W,
    height: BUBBLE_H,
    overflow: "hidden",
    borderRadius: 16,
  },
  containerMine: {
    alignSelf: "flex-end",
  },
  containerOther: {
    alignSelf: "flex-start",
  },
  image: {
    width: BUBBLE_W,
    height: BUBBLE_H,
    borderRadius: 16,
  },
});

export default React.memo(DuckBubble);
