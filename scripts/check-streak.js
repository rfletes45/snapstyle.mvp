/**
 * Streak Diagnostic Script
 * Run with: node scripts/check-streak.js <username1> <username2>
 *
 * This script checks the Friend document between two users
 * and shows the current streak status
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkStreak(username1, username2) {
  try {
    console.log(
      `\n🔍 Checking streak between ${username1} and ${username2}...\n`,
    );

    // Get user IDs from usernames
    const usersSnapshot = await db
      .collection("Users")
      .where("username", "in", [username1, username2])
      .get();

    if (usersSnapshot.size !== 2) {
      console.error("❌ Could not find both users");
      return;
    }

    const users = [];
    usersSnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });

    const uid1 = users[0].id;
    const uid2 = users[1].id;

    console.log(`User 1: ${users[0].username} (${uid1})`);
    console.log(`User 2: ${users[1].username} (${uid2})\n`);

    // Find friendship
    const friendsSnapshot = await db
      .collection("Friends")
      .where("users", "array-contains", uid1)
      .get();

    let friendship = null;
    friendsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.users.includes(uid2)) {
        friendship = { id: doc.id, ...data };
      }
    });

    if (!friendship) {
      console.error("❌ No friendship found between these users");
      return;
    }

    console.log(`✅ Friendship ID: ${friendship.id}\n`);
    console.log("📊 Streak Data:");
    console.log(`  Streak Count: ${friendship.streakCount || 0}`);
    console.log(
      `  Streak Updated Day: ${friendship.streakUpdatedDay || "never"}`,
    );
    console.log(
      `  Last Sent Day (${users[0].username}): ${friendship.lastSentDay_uid1 || "never"}`,
    );
    console.log(
      `  Last Sent Day (${users[1].username}): ${friendship.lastSentDay_uid2 || "never"}`,
    );
    console.log(`\n  Users array: [${friendship.users.join(", ")}]`);

    const today = new Date().toISOString().split("T")[0];
    console.log(`\n  Today: ${today}`);
    console.log(
      `  ${users[0].username} sent today: ${friendship.lastSentDay_uid1 === today}`,
    );
    console.log(
      `  ${users[1].username} sent today: ${friendship.lastSentDay_uid2 === today}`,
    );

    if (
      friendship.lastSentDay_uid1 === today &&
      friendship.lastSentDay_uid2 === today
    ) {
      if (friendship.streakUpdatedDay !== today) {
        console.log(
          "\n⚠️  Both users sent today but streak not updated! Cloud Function may have failed.",
        );
      } else {
        console.log("\n✅ Streak is up to date!");
      }
    } else {
      console.log("\n⏳ Waiting for both users to send a message today.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }

  process.exit(0);
}

const username1 = process.argv[2];
const username2 = process.argv[3];

if (!username1 || !username2) {
  console.error("Usage: node scripts/check-streak.js <username1> <username2>");
  process.exit(1);
}

checkStreak(username1, username2);
