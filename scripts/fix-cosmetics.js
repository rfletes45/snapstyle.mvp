/**
 * Fix Cosmetics Script
 * Manually grants cosmetic items for reached milestones
 *
 * Usage: node scripts/fix-cosmetics.js <userId>
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

async function fixUserCosmetics(userId) {
  console.log("\n=================================");
  console.log("🔧 COSMETICS FIX SCRIPT");
  console.log("=================================\n");
  console.log("User ID:", userId);

  try {
    // Get user's current inventory
    const inventorySnapshot = await db
      .collection("Users")
      .doc(userId)
      .collection("inventory")
      .get();

    const ownedItems = new Set(inventorySnapshot.docs.map((doc) => doc.id));

    // Get all friendships with streaks
    const friendsSnapshot = await db
      .collection("Friends")
      .where("users", "array-contains", userId)
      .get();

    if (friendsSnapshot.empty) {
      console.log("❌ No friendships found!");
      process.exit(1);
    }

    // Find highest streak
    let maxStreak = 0;
    for (const friendDoc of friendsSnapshot.docs) {
      const streakCount = friendDoc.data().streakCount || 0;
      if (streakCount > maxStreak) {
        maxStreak = streakCount;
      }
    }

    console.log(`\nHighest streak: ${maxStreak} days`);

    // Grant all milestone rewards up to max streak
    const itemsToGrant = [];
    for (const [milestone, itemId] of Object.entries(MILESTONE_REWARDS)) {
      if (parseInt(milestone) <= maxStreak && !ownedItems.has(itemId)) {
        itemsToGrant.push({ milestone, itemId });
      }
    }

    if (itemsToGrant.length === 0) {
      console.log("\n✅ No missing items! User has all earned rewards.");
      process.exit(0);
    }

    console.log(`\nGranting ${itemsToGrant.length} missing items:\n`);

    for (const { milestone, itemId } of itemsToGrant) {
      console.log(`  Adding: ${itemId} (${milestone}-day milestone)...`);

      await db
        .collection("Users")
        .doc(userId)
        .collection("inventory")
        .doc(itemId)
        .set({
          itemId,
          acquiredAt: Date.now(),
        });

      console.log(`  ✓ Added ${itemId}`);
    }

    console.log("\n=================================");
    console.log("✅ FIX COMPLETE");
    console.log("=================================\n");
    console.log(`Granted ${itemsToGrant.length} items to user ${userId}`);
    console.log(
      "\nThe user should now see these items in their Avatar Customizer.\n",
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

// Get userId from command line args
const userId = process.argv[2];

if (!userId) {
  console.error("Usage: node scripts/fix-cosmetics.js <userId>");
  process.exit(1);
}

fixUserCosmetics(userId);
