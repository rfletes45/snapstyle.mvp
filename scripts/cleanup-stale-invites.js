/**
 * One-Time Stale Invite Cleanup Script
 *
 * Finds all GameInvites that are either:
 *   1) Non-terminal but have no backing game (stuck active/filling/ready/starting)
 *   2) Terminal but missing chatVisibility: "hidden" (visible in chat)
 *
 * Writes full finalization fields on each so they disappear from chat.
 *
 * Usage:
 *   node scripts/cleanup-stale-invites.js              # Dry run (default)
 *   node scripts/cleanup-stale-invites.js --apply      # Actually write changes
 *   node scripts/cleanup-stale-invites.js --apply --verbose
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const DRY_RUN = !process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

const TERMINAL_STATUSES = new Set([
  "completed",
  "declined",
  "expired",
  "cancelled",
]);
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

async function main() {
  console.log(
    DRY_RUN
      ? "\n🔍 DRY RUN — no changes will be written. Use --apply to write.\n"
      : "\n⚡ APPLY MODE — changes will be written to Firestore.\n",
  );

  const now = Date.now();
  let totalFixed = 0;
  let totalSkipped = 0;
  let totalTerminalHealed = 0;

  // ── Pass 1: Non-terminal invites (stuck active/filling/ready/starting/pending) ──
  console.log("── Pass 1: Non-terminal invites ──");

  const nonTerminalStatuses = [
    "pending",
    "filling",
    "ready",
    "starting",
    "active",
  ];

  for (const status of nonTerminalStatuses) {
    let lastDoc = null;
    let pageCount = 0;

    while (true) {
      let q = db
        .collection("GameInvites")
        .where("status", "==", status)
        .orderBy("createdAt", "asc")
        .limit(200);

      if (lastDoc) {
        q = q.startAfter(lastDoc);
      }

      const snap = await q.get();
      if (snap.empty) break;

      pageCount++;
      lastDoc = snap.docs[snap.docs.length - 1];

      const batch = db.batch();
      let batchCount = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        const ageMs =
          now - (data.createdAt?.toMillis?.() || data.createdAt || now);
        const ageHours = Math.round(ageMs / (60 * 60 * 1000));

        // Skip very recent invites (< 1 hour old) — they may be legitimate
        if (ageMs < 60 * 60 * 1000) {
          totalSkipped++;
          if (VERBOSE) {
            console.log(
              `  SKIP ${doc.id} status=${status} age=${ageHours}h (too recent)`,
            );
          }
          continue;
        }

        const updates = {
          status: "cancelled",
          resolvedAt: now,
          resolvedBy: "script",
          resolutionType: "expire",
          chatVisibility: "hidden",
          chatHiddenAt: now,
          deleteAt: now + SIX_HOURS_MS,
          completedAt: now,
          updatedAt: now,
        };

        if (data.conversationId) {
          updates.chatHiddenInConversationIds = [data.conversationId];
        }

        if (DRY_RUN) {
          console.log(
            `  [DRY] Would finalize ${doc.id} status=${status} game=${data.gameType || "?"} age=${ageHours}h conversationId=${data.conversationId || "none"}`,
          );
        } else {
          batch.update(doc.ref, updates);
          batchCount++;
          if (VERBOSE) {
            console.log(
              `  FIX ${doc.id} status=${status} game=${data.gameType || "?"} age=${ageHours}h`,
            );
          }
        }
        totalFixed++;
      }

      if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
        console.log(
          `  Committed batch: ${batchCount} invites (status=${status}, page=${pageCount})`,
        );
      }

      // If we got fewer than 200, we've exhausted this status
      if (snap.docs.length < 200) break;
    }
  }

  console.log(
    `\n  Pass 1 result: ${totalFixed} invites to finalize, ${totalSkipped} skipped (recent)\n`,
  );

  // ── Pass 2: Terminal invites missing chatVisibility: "hidden" ──
  console.log("── Pass 2: Terminal invites still visible in chat ──");

  for (const status of TERMINAL_STATUSES) {
    let lastDoc = null;

    while (true) {
      let q = db
        .collection("GameInvites")
        .where("status", "==", status)
        .where("chatVisibility", "!=", "hidden")
        .limit(200);

      if (lastDoc) {
        q = q.startAfter(lastDoc);
      }

      const snap = await q.get();
      if (snap.empty) break;

      lastDoc = snap.docs[snap.docs.length - 1];

      const batch = db.batch();
      let batchCount = 0;

      for (const doc of snap.docs) {
        const data = doc.data();

        const patch = {};
        if (data.chatVisibility !== "hidden") {
          patch.chatVisibility = "hidden";
          patch.chatHiddenAt = now;
        }
        if (!data.resolvedAt) patch.resolvedAt = now;
        if (!data.resolvedBy) patch.resolvedBy = "script";
        if (!data.deleteAt) patch.deleteAt = now + SIX_HOURS_MS;
        if (
          (!data.chatHiddenInConversationIds ||
            data.chatHiddenInConversationIds.length === 0) &&
          data.conversationId
        ) {
          patch.chatHiddenInConversationIds = [data.conversationId];
        }

        if (Object.keys(patch).length === 0) continue;

        patch.updatedAt = now;

        if (DRY_RUN) {
          console.log(
            `  [DRY] Would heal ${doc.id} status=${status} missing=[${Object.keys(patch).join(",")}]`,
          );
        } else {
          batch.update(doc.ref, patch);
          batchCount++;
          if (VERBOSE) {
            console.log(
              `  HEAL ${doc.id} status=${status} patched=[${Object.keys(patch).join(",")}]`,
            );
          }
        }
        totalTerminalHealed++;
      }

      if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
        console.log(
          `  Committed batch: ${batchCount} invites healed (status=${status})`,
        );
      }

      if (snap.docs.length < 200) break;
    }
  }

  console.log(
    `\n  Pass 2 result: ${totalTerminalHealed} terminal invites to heal\n`,
  );

  // ── Summary ──
  console.log("══════════════════════════════════════════════");
  console.log(`  Total non-terminal finalized:  ${totalFixed}`);
  console.log(`  Total terminal healed:         ${totalTerminalHealed}`);
  console.log(`  Total skipped (recent):        ${totalSkipped}`);
  console.log(
    `  Grand total touched:           ${totalFixed + totalTerminalHealed}`,
  );
  console.log("══════════════════════════════════════════════");

  if (DRY_RUN) {
    console.log("\n✅ Dry run complete. Run with --apply to write changes.\n");
  } else {
    console.log("\n✅ Cleanup complete. Invites should disappear from chat.\n");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
