/**
 * Fix Streak Script
 * Resets a friendship's streak fields so streaks can start working
 * Run with: node scripts/fix-streak.js <friendshipId>
 *
 * Or to fix ALL friendships with streakCount=0 but streakUpdatedDay set:
 *   node scripts/fix-streak.js --all
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fixStreak(friendshipId) {
  try {
    console.log(`\n🔧 Fixing streak for friendship: ${friendshipId}\n`);

    const friendDoc = await db.collection("Friends").doc(friendshipId).get();

    if (!friendDoc.exists) {
      console.error("❌ Friendship not found");
      return;
    }

    const data = friendDoc.data();

    console.log("Current state:");
    console.log(`  lastSentDay_uid1: ${data.lastSentDay_uid1 || "never"}`);
    console.log(`  lastSentDay_uid2: ${data.lastSentDay_uid2 || "never"}`);
    console.log(`  streakUpdatedDay: ${data.streakUpdatedDay || "never"}`);
    console.log(`  streakCount: ${data.streakCount || 0}\n`);

    // Reset streakUpdatedDay to empty so streak can start fresh
    await friendDoc.ref.update({
      streakUpdatedDay: "",
    });

    console.log("✅ Reset streakUpdatedDay to empty string");
    console.log("   Next time both users message, streak will start at 1!");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function fixAllFriendships() {
  try {
    console.log("\n🔧 Fixing ALL friendships with broken streak state...\n");

    const friendsSnapshot = await db.collection("Friends").get();
    let fixed = 0;

    for (const doc of friendsSnapshot.docs) {
      const data = doc.data();

      // Check if this friendship has the bug: streakUpdatedDay is set but streakCount is 0
      if (data.streakUpdatedDay && data.streakCount === 0) {
        console.log(`Fixing ${doc.id}...`);
        await doc.ref.update({
          streakUpdatedDay: "",
        });
        fixed++;
      }
    }

    console.log(`\n✅ Fixed ${fixed} friendships`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

const arg = process.argv[2];

if (!arg) {
  console.error("Usage:");
  console.error(
    "  node scripts/fix-streak.js <friendshipId>  - Fix a specific friendship",
  );
  console.error(
    "  node scripts/fix-streak.js --all           - Fix all broken friendships",
  );
  process.exit(1);
}

if (arg === "--all") {
  fixAllFriendships().then(() => process.exit(0));
} else {
  fixStreak(arg).then(() => process.exit(0));
}
