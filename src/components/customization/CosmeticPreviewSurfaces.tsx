import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  BorderRadius,
  Spacing,
  THEME_METADATA,
  type ThemeId,
  type ThemeMeta,
} from "@/constants/theme";
import { relativeLuminance } from "@/cosmetics/chatAppearanceResolver";
import { CHAT_BUBBLE_COLORS } from "@/cosmetics/chatDefaults";
import type { CosmeticDefinition } from "@/cosmetics/types";
import type { ThemeColors } from "@/store/ThemeContext";

export function getThemePreviewMeta(themeId: string): ThemeMeta | null {
  return THEME_METADATA[themeId as ThemeId] ?? null;
}

export function getBubblePreviewColor(
  item: Pick<CosmeticDefinition, "id" | "metadata">,
): string {
  return typeof item.metadata?.bubbleColorValue === "string"
    ? (item.metadata.bubbleColorValue as string)
    : (CHAT_BUBBLE_COLORS[item.id] ?? "#1976D2");
}

interface ThemePreviewSurfaceProps {
  meta: ThemeMeta;
  variant?: "default" | "shopCard";
}

function ThemePreviewSurfaceImpl({
  meta,
  variant = "default",
}: ThemePreviewSurfaceProps) {
  const [bgColor, primaryColor, accentColor] = meta.previewColors;
  const lineColor = meta.isDark ? "#FFFFFF" : "#000000";
  const isShopCard = variant === "shopCard";

  return (
    <View style={styles.fill}>
      <View
        style={[
          styles.themePreviewBg,
          isShopCard && styles.themePreviewBgShopCard,
          { backgroundColor: bgColor },
        ]}
      >
        <View
          style={[styles.themePreviewAccent, { backgroundColor: primaryColor }]}
        />
        <View style={styles.themePreviewContent}>
          <View
            style={[
              styles.themePreviewLine,
              {
                backgroundColor: lineColor,
                width: "70%",
                opacity: 0.8,
              },
            ]}
          />
          <View
            style={[
              styles.themePreviewLine,
              {
                backgroundColor: lineColor,
                width: "50%",
                opacity: 0.5,
              },
            ]}
          />
        </View>
        <View
          style={[
            styles.themePreviewSwatch,
            isShopCard && styles.themePreviewSwatchShopCard,
            { backgroundColor: accentColor },
          ]}
        >
          <View
            style={[
              styles.themePreviewLineSm,
              {
                backgroundColor: lineColor,
                opacity: 0.8,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

export const ThemePreviewSurface = memo(ThemePreviewSurfaceImpl);

interface BubbleColorPreviewSurfaceProps {
  colorHex: string;
}

function BubbleColorPreviewSurfaceImpl({
  colorHex,
}: BubbleColorPreviewSurfaceProps) {
  const textColor = relativeLuminance(colorHex) > 0.179 ? "#000000" : "#FFFFFF";

  return (
    <View style={[styles.bubblePreviewFill, { backgroundColor: colorHex }]}>
      <View style={styles.bubblePreviewRow}>
        <View
          style={[
            styles.bubbleMini,
            { backgroundColor: colorHex, borderColor: textColor + "22" },
          ]}
        >
          <Text style={[styles.bubbleMiniText, { color: textColor }]}>
            Hello!
          </Text>
        </View>
      </View>
    </View>
  );
}

export const BubbleColorPreviewSurface = memo(BubbleColorPreviewSurfaceImpl);

interface ThemeModeBadgeProps {
  isDark: boolean;
  colors: ThemeColors;
}

function ThemeModeBadgeImpl({ isDark, colors }: ThemeModeBadgeProps) {
  return (
    <View
      style={[
        styles.themeModeBadge,
        { backgroundColor: colors.surfaceVariant ?? colors.surface },
      ]}
    >
      <Ionicons
        name={isDark ? "moon" : "sunny"}
        size={10}
        color={colors.textSecondary}
      />
      <Text
        style={[styles.themeModeBadgeText, { color: colors.textSecondary }]}
      >
        {isDark ? "Dark" : "Light"}
      </Text>
    </View>
  );
}

export const ThemeModeBadge = memo(ThemeModeBadgeImpl);

const styles = StyleSheet.create({
  fill: {
    width: "100%",
    height: "100%",
    flex: 1,
  },
  themePreviewBg: {
    flex: 1,
    padding: Spacing.sm,
  },
  themePreviewBgShopCard: {
    paddingTop: 46,
  },
  themePreviewAccent: {
    height: 4,
    width: "40%",
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  themePreviewContent: {
    gap: 4,
  },
  themePreviewLine: {
    height: 6,
    borderRadius: 3,
  },
  themePreviewSwatch: {
    position: "absolute",
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 50,
    height: 30,
    borderRadius: BorderRadius.sm,
    padding: 6,
    justifyContent: "center",
  },
  themePreviewSwatchShopCard: {
    bottom: 48,
  },
  themePreviewLineSm: {
    height: 4,
    width: "80%",
    borderRadius: 2,
  },
  bubblePreviewFill: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.sm,
  },
  bubblePreviewRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  bubbleMini: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderBottomRightRadius: 3,
    borderWidth: 1,
  },
  bubbleMiniText: {
    fontSize: 12,
    fontWeight: "500",
  },
  themeModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  themeModeBadgeText: {
    fontSize: 10,
    fontWeight: "500",
  },
});
