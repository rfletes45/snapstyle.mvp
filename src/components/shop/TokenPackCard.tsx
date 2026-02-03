/**
 * TokenPackCard Component
 *
 * Displays a token pack for purchase in the shop.
 * Shows token amount, bonus, and price.
 *
 * @see src/services/iap.ts for token pack definitions
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface TokenPackCardProps {
  /** Token pack ID */
  id: string;
  /** Base token amount */
  tokens: number;
  /** Bonus tokens (if any) */
  bonusTokens: number;
  /** Price in USD */
  priceUSD: number;
  /** Whether this is the popular/recommended pack */
  popular?: boolean;
  /** Handler for purchase */
  onPurchase: (packId: string) => void;
  /** Whether purchase is in progress */
  purchasing?: boolean;
}

function TokenPackCardBase({
  id,
  tokens,
  bonusTokens,
  priceUSD,
  popular = false,
  onPurchase,
  purchasing = false,
}: TokenPackCardProps) {
  const theme = useTheme();

  const totalTokens = tokens + bonusTokens;
  const bonusPercent =
    bonusTokens > 0 ? Math.round((bonusTokens / tokens) * 100) : 0;

  // Gradient based on pack size
  const getGradientColors = (): readonly [string, string, ...string[]] => {
    if (totalTokens >= 5000) return ["#FFD700", "#FFA500"]; // Gold for largest
    if (totalTokens >= 1000) return ["#9C27B0", "#673AB7"]; // Purple for large
    if (totalTokens >= 500) return ["#2196F3", "#03A9F4"]; // Blue for medium
    return ["#4CAF50", "#8BC34A"]; // Green for small
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderColor: popular ? "#FFD700" : theme.colors.outline,
          borderWidth: popular ? 2 : 1,
        },
      ]}
      onPress={() => onPurchase(id)}
      disabled={purchasing}
      activeOpacity={0.8}
    >
      {/* Popular badge */}
      {popular && (
        <View style={styles.popularBadge}>
          <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
          <Text style={styles.popularText}>Most Popular</Text>
        </View>
      )}

      {/* Token icon with gradient */}
      <LinearGradient
        colors={getGradientColors()}
        style={styles.iconContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.coinEmoji}>🪙</Text>
      </LinearGradient>

      {/* Token amount */}
      <Text style={[styles.tokenAmount, { color: theme.colors.onSurface }]}>
        {tokens.toLocaleString()}
      </Text>

      {/* Bonus indicator */}
      {bonusTokens > 0 && (
        <View style={styles.bonusContainer}>
          <Text style={styles.bonusText}>
            +{bonusTokens.toLocaleString()} Bonus!
          </Text>
          <Text style={styles.bonusPercent}>(+{bonusPercent}%)</Text>
        </View>
      )}

      {/* Price */}
      <View
        style={[
          styles.priceContainer,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        <Text
          style={[styles.priceText, { color: theme.colors.onPrimaryContainer }]}
        >
          ${priceUSD.toFixed(2)}
        </Text>
      </View>

      {/* Value indicator for larger packs */}
      {bonusPercent >= 10 && (
        <View style={styles.valueTag}>
          <Text style={styles.valueText}>Best Value</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 110,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    left: -5,
    right: -5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  popularText: {
    color: "#FFD700",
    fontSize: 10,
    fontWeight: "700",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  coinEmoji: {
    fontSize: 28,
  },
  tokenAmount: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
  },
  bonusContainer: {
    alignItems: "center",
    marginTop: 4,
  },
  bonusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4CAF50",
  },
  bonusPercent: {
    fontSize: 10,
    color: "#4CAF50",
  },
  priceContainer: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
  },
  valueTag: {
    position: "absolute",
    top: 8,
    right: -8,
    backgroundColor: "#FF5722",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    transform: [{ rotate: "15deg" }],
  },
  valueText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
});

export const TokenPackCard = memo(TokenPackCardBase);
export default TokenPackCard;
