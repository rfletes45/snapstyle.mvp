/**
 * TokenPackCard Component
 *
 * Displays a token pack for purchase in the shop.
 * Responsive width, premium styling, clear value hierarchy.
 *
 * @see src/services/iap.ts for token pack definitions
 */

import { useColors } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface TokenPackCardProps {
  id: string;
  tokens: number;
  bonusTokens: number;
  priceUSD: number;
  popular?: boolean;
  onPurchase: (packId: string) => void;
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
  const colors = useColors();

  const totalTokens = tokens + bonusTokens;
  const bonusPercent =
    bonusTokens > 0 ? Math.round((bonusTokens / tokens) * 100) : 0;

  const getGradientColors = (): readonly [string, string, ...string[]] => {
    if (totalTokens >= 5000) return ["#FFD700", "#E6A200"];
    if (totalTokens >= 1000) return ["#AB47BC", "#7B1FA2"];
    if (totalTokens >= 500) return ["#42A5F5", "#1E88E5"];
    return ["#66BB6A", "#43A047"];
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        popular && styles.cardPopular,
      ]}
      onPress={() => onPurchase(id)}
      disabled={purchasing}
      activeOpacity={0.75}
    >
      {/* Popular badge */}
      {popular && (
        <View style={styles.popularBadge}>
          <MaterialCommunityIcons name="star" size={10} color="#FFD700" />
          <Text style={styles.popularText}>Popular</Text>
        </View>
      )}

      {/* Best Value tag */}
      {bonusPercent >= 20 && (
        <View style={styles.valueTag}>
          <Text style={styles.valueTagText}>Best Value</Text>
        </View>
      )}

      {/* Token icon */}
      <LinearGradient
        colors={getGradientColors()}
        style={styles.iconCircle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.coinEmoji}>{"\u{1FA99}"}</Text>
      </LinearGradient>

      {/* Token amount */}
      <Text style={styles.tokenAmount}>
        {tokens.toLocaleString()}
      </Text>

      {/* Bonus */}
      {bonusTokens > 0 && (
        <Text style={styles.bonusText}>
          +{bonusTokens.toLocaleString()} bonus
        </Text>
      )}

      {/* Price button */}
      <LinearGradient
        colors={popular ? ["#B24BF3", "#8E24AA"] : ["rgba(255,255,255,0.12)", "rgba(255,255,255,0.06)"]}
        style={styles.priceButton}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={[styles.priceText, popular && styles.priceTextPopular]}>
          ${priceUSD.toFixed(2)}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  cardPopular: {
    borderColor: "rgba(178,75,243,0.4)",
    backgroundColor: "rgba(178,75,243,0.06)",
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a0a2e",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 3,
    borderWidth: 1,
    borderColor: "rgba(178,75,243,0.4)",
  },
  popularText: {
    color: "#FFD700",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  valueTag: {
    position: "absolute",
    top: 6,
    right: -2,
    backgroundColor: "#43A047",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    transform: [{ rotate: "12deg" }],
  },
  valueTagText: {
    fontSize: 7,
    fontWeight: "800",
    color: "#fff",
    textTransform: "uppercase",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 8,
  },
  coinEmoji: {
    fontSize: 24,
  },
  tokenAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.2,
  },
  bonusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#66BB6A",
    marginTop: 2,
    marginBottom: 2,
  },
  priceButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    width: "90%",
    alignItems: "center",
  },
  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  priceTextPopular: {
    color: "#fff",
  },
});

export const TokenPackCard = memo(TokenPackCardBase);
export default TokenPackCard;
