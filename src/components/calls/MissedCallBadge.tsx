/**
 * MissedCallBadge - Displays count of unseen missed calls
 * Shows on tab bar and call history button
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import { callHistoryService } from "@/services/calls";

interface MissedCallBadgeProps {
  size?: "small" | "medium" | "large";
  style?: object;
  maxCount?: number;
}

export function MissedCallBadge({
  size = "medium",
  style,
  maxCount = 99,
}: MissedCallBadgeProps) {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCount = async () => {
      try {
        const missedCount = await callHistoryService.getUnseenMissedCallCount();
        if (mounted) {
          setCount(missedCount);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading missed call count:", error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadCount();

    // Refresh periodically
    const interval = setInterval(loadCount, 30000); // Every 30 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (isLoading || count === 0) {
    return null;
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  const sizeStyles = {
    small: styles.badgeSmall,
    medium: styles.badgeMedium,
    large: styles.badgeLarge,
  };

  const textStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  return (
    <View style={[styles.badge, sizeStyles[size], style]}>
      <Text style={[styles.badgeText, textStyles[size]]}>{displayCount}</Text>
    </View>
  );
}

/**
 * Hook to get missed call count
 */
export function useMissedCallCount() {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCount = async () => {
      try {
        const missedCount = await callHistoryService.getUnseenMissedCallCount();
        if (mounted) {
          setCount(missedCount);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading missed call count:", error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadCount();

    // Refresh periodically
    const interval = setInterval(loadCount, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const refresh = async () => {
    try {
      const missedCount = await callHistoryService.getUnseenMissedCallCount();
      setCount(missedCount);
    } catch (error) {
      console.error("Error refreshing missed call count:", error);
    }
  };

  const markAsSeen = async () => {
    await callHistoryService.markMissedCallsSeen();
    setCount(0);
  };

  return { count, isLoading, refresh, markAsSeen };
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: theme.colors.error,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 18,
  },

  // Size variants
  badgeSmall: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  badgeMedium: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
  },
  badgeLarge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
  },

  // Text
  badgeText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 12,
  },
  textLarge: {
    fontSize: 14,
  },
});

export default MissedCallBadge;
