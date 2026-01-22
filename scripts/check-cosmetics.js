/**
 * Check Cosmetics Debug Script
 * Use this to check a user's inventory and streak status
 *
 * Usage: node scripts/check-cosmetics.js <userId>
 */

const admin = require("firebase-admin");
const serviceAccount = require("../firebase/serviceAccountKey.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const MILESTONE_REWARDS = {
  3: "hat_flame",
  7: "glasses_cool",
  14: "bg_gradient",
  30: "hat_crown",
  50: "glasses_star",
  100: "bg_rainbow",
  365: "hat_legendary",
};

async function checkUserCosmetics(userId) {
  console.log("\n=================================");
  console.log("🔍 COSMETICS DEBUG CHECK");
  console.log("=================================\n");
  console.log("User ID:", userId);

  try {
    // 1. Get user's inventory
    console.log("\n📦 INVENTORY:");
    const inventorySnapshot = await db
      .collection("Users")
      .doc(userId)
      .collection("inventory")
      .get();

    if (inventorySnapshot.empty) {
      console.log("  ❌ No items in inventory!");
    } else {
      inventorySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const date = new Date(data.acquiredAt).toLocaleString();
        console.log(`  ✓ ${doc.id} (acquired: ${date})`);
      });
    }

    // 2. Get all friendships with streaks
    console.log("\n🔥 STREAKS:");
    const friendsSnapshot = await db
      .collection("Friends")
      .where("users", "array-contains", userId)
      .get();

    if (friendsSnapshot.empty) {
      console.log("  ❌ No friendships found!");
    } else {
      for (const friendDoc of friendsSnapshot.docs) {
        const data = friendDoc.data();
        const streakCount = data.streakCount || 0;
        const otherUserId = data.users.find((u) => u !== userId);

        // Get other user's display name
        const otherUserDoc = await db
          .collection("Users")
          .doc(otherUserId)
          .get();
        const otherUserName = otherUserDoc.exists
          ? otherUserDoc.data().displayName || otherUserDoc.data().username
          : "Unknown";

        console.log(`\n  Friend: ${otherUserName} (${otherUserId})`);
        console.log(`  Streak: ${streakCount} days`);
        console.log(`  Last updated: ${data.streakUpdatedDay || "never"}`);
        console.log(`  User 1 last sent: ${data.lastSentDay_uid1 || "never"}`);
        console.log(`  User 2 last sent: ${data.lastSentDay_uid2 || "never"}`);

        // Check which milestones should be unlocked
        const expectedRewards = Object.entries(MILESTONE_REWARDS)
          .filter(([milestone]) => parseInt(milestone) <= streakCount)
          .map(([milestone, itemId]) => ({ milestone, itemId }));

        if (expectedRewards.length > 0) {
          console.log(`\n  Expected rewards for ${streakCount}-day streak:`);
          for (const { milestone, itemId } of expectedRewards) {
            const hasItem = inventorySnapshot.docs.some(
              (doc) => doc.id === itemId,
            );
            const status = hasItem ? "✓" : "❌ MISSING!";
            console.log(`    ${status} Day ${milestone}: ${itemId}`);
          }
        }
      }
    }

    // 3. Summary
    console.log("\n=================================");
    console.log("📊 SUMMARY");
    console.log("=================================");
    console.log("Next milestones: 3, 7, 14, 30, 50, 100, 365 days");
    console.log("\nIf items are missing:");
    console.log("  1. Check if Cloud Functions are deployed");
    console.log("  2. Check Firebase Functions logs");
    console.log("  3. Manually grant items with fix-cosmetics.js");
    console.log("\n");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

// Get userId from command line args
const userId = process.argv[2];

if (!userId) {
  console.error("Usage: node scripts/check-cosmetics.js <userId>");
  process.exit(1);
}

checkUserCosmetics(userId);
