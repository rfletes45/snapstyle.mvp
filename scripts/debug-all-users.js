/**
 * Debug Current User's Streak and Cosmetics
 * This script checks the currently logged-in user's data
 */

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin with your project credentials
const serviceAccount = require(
  path.join(__dirname, "..", "firebase", "serviceAccountKey.json"),
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "gamerapp-37e70",
  });
}

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

async function debugAllUsers() {
  console.log("\n=================================");
  console.log("🔍 DEBUGGING ALL USERS");
  console.log("=================================\n");

  try {
    // Get all users
    const usersSnapshot = await db.collection("Users").get();

    console.log(`Found ${usersSnapshot.size} users\n`);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      console.log("\n-----------------------------------");
      console.log("👤 User:", userData.username || userId);
      console.log("   ID:", userId);
      console.log("   Display Name:", userData.displayName);

      // Check inventory
      const inventorySnapshot = await db
        .collection("Users")
        .doc(userId)
        .collection("inventory")
        .get();

      console.log("\n   📦 INVENTORY (" + inventorySnapshot.size + " items):");
      if (inventorySnapshot.empty) {
        console.log("      ❌ No items!");
      } else {
        inventorySnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const date = new Date(data.acquiredAt).toLocaleString();
          console.log(`      ✓ ${doc.id} (acquired: ${date})`);
        });
      }

      // Check friendships and streaks
      const friendsSnapshot = await db
        .collection("Friends")
        .where("users", "array-contains", userId)
        .get();

      console.log("\n   🔥 STREAKS:");
      if (friendsSnapshot.empty) {
        console.log("      No friendships");
      } else {
        for (const friendDoc of friendsSnapshot.docs) {
          const data = friendDoc.data();
          const streakCount = data.streakCount || 0;
          const otherUserId = data.users.find((u) => u !== userId);

          const otherUserDoc = await db
            .collection("Users")
            .doc(otherUserId)
            .get();
          const otherUserName = otherUserDoc.exists
            ? otherUserDoc.data().username
            : "Unknown";

          console.log(`\n      Friend: ${otherUserName}`);
          console.log(`      Streak: ${streakCount} days`);
          console.log(
            `      Last updated: ${data.streakUpdatedDay || "never"}`,
          );
          console.log(`      Friendship ID: ${friendDoc.id}`);

          // Check which milestones should be unlocked
          if (streakCount >= 3) {
            const expectedRewards = Object.entries(MILESTONE_REWARDS)
              .filter(([milestone]) => parseInt(milestone) <= streakCount)
              .map(([milestone, itemId]) => ({ milestone, itemId }));

            console.log(
              `\n      📋 Expected cosmetics for ${streakCount}-day streak:`,
            );
            for (const { milestone, itemId } of expectedRewards) {
              const hasItem = inventorySnapshot.docs.some(
                (doc) => doc.id === itemId,
              );
              const status = hasItem ? "✅ HAS" : "❌ MISSING!";
              console.log(`         ${status} Day ${milestone}: ${itemId}`);
            }
          }
        }
      }
    }

    console.log("\n\n=================================");
    console.log("📊 DIAGNOSTICS COMPLETE");
    console.log("=================================\n");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

debugAllUsers();
