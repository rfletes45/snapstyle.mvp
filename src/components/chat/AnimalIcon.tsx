/**
 * AnimalIcon
 *
 * Data-driven animal image for the chat composer button.
 * Replaces the hardcoded DuckIcon when an animal theme is equipped.
 * Preserves the exact same dimensions/layout as DuckIcon for 1:1 parity.
 *
 * @module components/chat/AnimalIcon
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { CosmeticImage } from "@/components/CosmeticImage";
import { getAnimalImage } from "@/cosmetics/animalAssets";

interface AnimalIconProps {
  /** Animal theme ID (e.g. "animal_duck", "animal_bear"). Defaults to duck. */
  animalId?: string | null;
  /** Overall size of the icon (height) */
  size?: number;
  /** Whether to render slightly wider than tall (rectangular) — matches DuckIcon behavior */
  wide?: boolean;
}

const AnimalIcon: React.FC<AnimalIconProps> = ({
  animalId,
  size = 40,
  wide = false,
}) => {
  const w = wide ? Math.round(size * 1.3) : size;
  const h = size;
  const radius = 6;
  const imageSource = getAnimalImage(animalId ?? null);

  return (
    <View
      style={[
        styles.container,
        {
          width: w,
          height: h,
          borderRadius: radius,
        },
      ]}
    >
      <CosmeticImage
        source={imageSource}
        style={{
          width: w,
          height: h,
          borderRadius: radius,
        }}
        debugLabel={`animal-icon-${animalId}`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
});

const MemoAnimalIcon = React.memo(AnimalIcon);
export { MemoAnimalIcon as AnimalIcon };
export default MemoAnimalIcon;
