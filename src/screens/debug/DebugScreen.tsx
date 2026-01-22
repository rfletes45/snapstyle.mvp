/**
 * Debug Screen - Shows user's streaks and cosmetics inventory
 * Navigate to this screen to see your data
 */

import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Text,
  Card,
  Chip,
  ActivityIndicator,
  Button,
  useTheme,
} from "react-native-paper";
import { useAuth } from "@/store/AuthContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirestoreInstance } from "@/services/firebase";
import { getUserInventory, addToInventory } from "@/services/cosmetics";
import { MILESTONE_REWARDS } from "@/data/cosmetics";
import { Spacing, BorderRadius } from "../../../constants/theme";

interface DebugData {
  userId: string;
  username: string;
  inventory: string[];
  friendships: Array<{
    friendUsername: string;
    streakCount: number;
    streakUpdatedDay: string;
    friendshipId: string;
    missingCosmetics: string[];
  }>;
}

export default function DebugScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;
  const [loading, setLoading] = useState(true);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    if (!uid) return;
    loadDebugData();
  }, [uid]);

  const loadDebugData = async () => {
    if (!uid) return;

    try {
      setLoading(true);
      const db = getFirestoreInstance();

      // Get user data
      const userDoc = await getDocs(query(collection(db, "Users")));
      const currentUser = userDoc.docs.find((doc) => doc.id === uid);
      const username = currentUser?.data().username || "Unknown";

      // Get inventory
      const inventory = await getUserInventory(uid);
      const inventoryIds = inventory.map((item) => item.itemId);

      // Get friendships
      const friendsQuery = query(
        collection(db, "Friends"),
        where("users", "array-contains", uid),
      );
      const friendsSnapshot = await getDocs(friendsQuery);

      const friendships = [];
      for (const friendDoc of friendsSnapshot.docs) {
        const data = friendDoc.data();
        const streakCount = data.streakCount || 0;
        const otherUserId = data.users.find((u: string) => u !== uid);

        // Get friend's username
        const friendUserDoc = await getDocs(query(collection(db, "Users")));
        const friendUser = friendUserDoc.docs.find(
          (doc) => doc.id === otherUserId,
        );
        const friendUsername = friendUser?.data().username || "Unknown";

        // Check for missing cosmetics
        const missingCosmetics: string[] = [];
        for (const [milestone, itemId] of Object.entries(MILESTONE_REWARDS)) {
          if (
            parseInt(milestone) <= streakCount &&
            !inventoryIds.includes(itemId)
          ) {
            missingCosmetics.push(`Day ${milestone}: ${itemId}`);
          }
        }

        friendships.push({
          friendUsername,
          streakCount,
          streakUpdatedDay: data.streakUpdatedDay || "never",
          friendshipId: friendDoc.id,
          missingCosmetics,
        });
      }

      setDebugData({
        userId: uid,
        username,
        inventory: inventoryIds,
        friendships,
      });
    } catch (error) {
      console.error("Error loading debug data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fixMissingCosmetics = async () => {
    if (!uid || !debugData) return;

    try {
      setFixing(true);
      let itemsGranted = 0;

      for (const friendship of debugData.friendships) {
        const { streakCount } = friendship;

        // Grant all milestone rewards up to current streak
        for (const [milestone, itemId] of Object.entries(MILESTONE_REWARDS)) {
          if (
            parseInt(milestone) <= streakCount &&
            !debugData.inventory.includes(itemId)
          ) {
            console.log(`Granting ${itemId} for ${milestone}-day milestone`);
            await addToInventory(uid, itemId);
            itemsGranted++;
          }
        }
      }

      alert(`Successfully granted ${itemsGranted} missing cosmetics!`);
      await loadDebugData(); // Reload data
    } catch (error) {
      console.error("Error fixing cosmetics:", error);
      alert("Error fixing cosmetics. Check console.");
    } finally {
      setFixing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading debug data...</Text>
      </View>
    );
  }

  if (!debugData) {
    return (
      <View style={styles.centered}>
        <Text>No data available</Text>
      </View>
    );
  }

  const hasMissingCosmetics = debugData.friendships.some(
    (f) => f.missingCosmetics.length > 0,
  );

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="🔍 Debug Information" />
        <Card.Content>
          <Text variant="bodyMedium">Username: {debugData.username}</Text>
          <Text variant="bodySmall" style={styles.userId}>
            ID: {debugData.userId}
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="📦 Inventory" />
        <Card.Content>
          <Text variant="bodyMedium">{debugData.inventory.length} items:</Text>
          {debugData.inventory.length === 0 ? (
            <Text style={styles.empty}>No items in inventory</Text>
          ) : (
            <View style={styles.chipContainer}>
              {debugData.inventory.map((itemId) => (
                <Chip key={itemId} style={styles.chip}>
                  {itemId}
                </Chip>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="🔥 Streaks & Missing Cosmetics" />
        <Card.Content>
          {debugData.friendships.length === 0 ? (
            <Text style={styles.empty}>No friendships found</Text>
          ) : (
            debugData.friendships.map((friendship, index) => (
              <View key={index} style={styles.friendshipItem}>
                <Text variant="titleMedium">{friendship.friendUsername}</Text>
                <Text variant="bodyMedium">
                  Streak: {friendship.streakCount} days
                </Text>
                <Text variant="bodySmall">
                  Last updated: {friendship.streakUpdatedDay}
                </Text>

                {friendship.missingCosmetics.length > 0 && (
                  <View style={styles.missingSection}>
                    <Text variant="bodyMedium" style={styles.missingTitle}>
                      ❌ Missing Cosmetics:
                    </Text>
                    {friendship.missingCosmetics.map((item, i) => (
                      <Text key={i} style={styles.missingItem}>
                        • {item}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {hasMissingCosmetics && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.fixTitle}>
              🔧 Fix Missing Cosmetics
            </Text>
            <Text variant="bodyMedium" style={styles.fixDescription}>
              This will automatically grant all cosmetics you've earned through
              your streaks.
            </Text>
            <Button
              mode="contained"
              onPress={fixMissingCosmetics}
              loading={fixing}
              disabled={fixing}
              style={styles.fixButton}
            >
              Fix Now
            </Button>
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="bodySmall" style={styles.footer}>
            Milestones: 3, 7, 14, 30, 50, 100, 365 days
          </Text>
          <Button mode="text" onPress={loadDebugData}>
            Refresh Data
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    marginBottom: Spacing.lg,
  },
  userId: {
    opacity: 0.6,
    fontSize: 10,
    marginTop: Spacing.xs,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.sm,
  },
  chip: {
    margin: Spacing.xs,
  },
  empty: {
    opacity: 0.6,
    fontStyle: "italic",
    marginTop: Spacing.sm,
  },
  friendshipItem: {
    marginBottom: Spacing.lg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    // backgroundColor applied inline via theme.colors.surfaceVariant
  },
  missingSection: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    // backgroundColor applied inline via theme.colors.errorContainer
  },
  missingTitle: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
    // color applied inline via theme.colors.error
  },
  missingItem: {
    marginLeft: Spacing.sm,
    // color applied inline via theme.colors.error
  },
  fixTitle: {
    fontWeight: "bold",
    marginBottom: Spacing.sm,
  },
  fixDescription: {
    marginBottom: Spacing.lg,
  },
  fixButton: {
    marginTop: Spacing.sm,
  },
  footer: {
    opacity: 0.6,
    fontStyle: "italic",
    marginBottom: Spacing.sm,
  },
});
