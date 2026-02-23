/**
 * AnimalBubble
 *
 * Data-driven animal image message bubble.
 * Replaces DuckBubble when rendering animal-themed messages in chat.
 * Preserves the exact same dimensions/layout as DuckBubble for 1:1 parity.
 *
 * @module components/chat/AnimalBubble
 */

import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";

import { CosmeticImage } from "@/components/CosmeticImage";
import { getAnimalImage } from "@/cosmetics/animalAssets";

const SCREEN_W = Dimensions.get("window").width;

/** Width of the animal bubble — matches DuckBubble (49% of screen width) */
const BUBBLE_W = SCREEN_W * 0.49;
const BUBBLE_H = BUBBLE_W * 0.67;

interface AnimalBubbleProps {
  /** Animal theme ID (e.g. "animal_duck", "animal_bear"). Falls back to duck. */
  animalId?: string | null;
  /** Whether the message was sent by the current user */
  isMine?: boolean;
}

const AnimalBubble: React.FC<AnimalBubbleProps> = ({
  animalId,
  isMine = true,
}) => {
  const imageSource = getAnimalImage(animalId ?? null);

  return (
    <View
      style={[
        styles.container,
        isMine ? styles.containerMine : styles.containerOther,
      ]}
    >
      <CosmeticImage
        source={imageSource}
        style={styles.image}
        debugLabel={`animal-bubble-${animalId}`}
      />
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

const MemoAnimalBubble = React.memo(AnimalBubble);
export { MemoAnimalBubble as AnimalBubble };
export default MemoAnimalBubble;
