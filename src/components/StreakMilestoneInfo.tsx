import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { useColors } from "../store/ThemeContext";

interface StreakMilestoneInfoProps {
  currentStreak: number;
}

const MILESTONES = [
  { day: 3, reward: "Flame Cap 🔥", rarity: "common" },
  { day: 7, reward: "Cool Shades 😎", rarity: "common" },
  { day: 14, reward: "Gradient Glow ✨", rarity: "rare" },
  { day: 30, reward: "Golden Crown 👑", rarity: "rare" },
  { day: 50, reward: "Star Glasses 🤩", rarity: "rare" },
  { day: 100, reward: "Rainbow Burst 🌈", rarity: "epic" },
  { day: 365, reward: "Legendary Halo 😇", rarity: "epic" },
];

export default function StreakMilestoneInfo({
  currentStreak,
}: StreakMilestoneInfoProps) {
  const colors = useColors();
  // Find next milestone
  const nextMilestone = MILESTONES.find((m) => m.day > currentStreak);
  const completedMilestones = MILESTONES.filter((m) => m.day <= currentStreak);
  const daysToNext = nextMilestone ? nextMilestone.day - currentStreak : 0;

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.title}>
          🔥 Streak Milestones
        </Text>

        {currentStreak === 0 ? (
          <Text variant="bodyMedium" style={styles.text}>
            Start a streak with your friend to unlock exclusive cosmetics!
          </Text>
        ) : (
          <>
            <Text variant="bodyMedium" style={styles.text}>
              Current streak:{" "}
              <Text style={styles.bold}>{currentStreak} days</Text>
            </Text>

            {completedMilestones.length > 0 && (
              <View style={styles.section}>
                <Text variant="bodySmall" style={styles.sectionTitle}>
                  ✓ Unlocked:
                </Text>
                {completedMilestones.map((milestone) => (
                  <Text
                    key={milestone.day}
                    variant="bodySmall"
                    style={[styles.unlocked, { color: colors.success }]}
                  >
                    • Day {milestone.day}: {milestone.reward}
                  </Text>
                ))}
              </View>
            )}

            {nextMilestone && (
              <View style={styles.section}>
                <Text variant="bodySmall" style={styles.sectionTitle}>
                  Next reward:
                </Text>
                <Text
                  variant="bodyMedium"
                  style={[styles.nextReward, { color: colors.warning }]}
                >
                  Day {nextMilestone.day}: {nextMilestone.reward}
                </Text>
                <Text variant="bodySmall" style={styles.daysRemaining}>
                  {daysToNext} {daysToNext === 1 ? "day" : "days"} to go!
                </Text>
              </View>
            )}
          </>
        )}

        <Text variant="bodySmall" style={styles.footer}>
          All milestones: 3, 7, 14, 30, 50, 100, 365 days
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  text: {
    marginBottom: 8,
  },
  bold: {
    fontWeight: "bold",
  },
  section: {
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 4,
    opacity: 0.7,
  },
  unlocked: {
    marginLeft: 8,
    marginTop: 2,
  },
  nextReward: {
    marginLeft: 8,
    fontWeight: "600",
  },
  daysRemaining: {
    marginLeft: 8,
    marginTop: 2,
    opacity: 0.7,
  },
  footer: {
    marginTop: 12,
    opacity: 0.6,
    fontStyle: "italic",
  },
});
