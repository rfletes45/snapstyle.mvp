/**
 * Gifting Cloud Functions
 *
 * Handles secure gift sending and receiving.
 *
 * Functions:
 * - sendGift: Validate purchase and create gift record
 * - openGift: Grant gift items to recipient
 * - expireGifts: Scheduled function to expire old gifts
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.2
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// =============================================================================
// Constants
// =============================================================================

const GIFT_EXPIRY_DAYS = 30;
const MAX_MESSAGE_LENGTH = 200;

// =============================================================================
// Types
// =============================================================================

interface SendGiftRequest {
  itemId: string;
  itemType: "tokenPack" | "bundle" | "exclusive";
  recipientUid: string;
  message?: string;
  platform: "ios" | "android";
  purchaseToken?: string;
  receiptData?: string;
  transactionId?: string;
}

interface SendGiftResponse {
  success: boolean;
  giftId?: string;
  error?: string;
}

interface OpenGiftRequest {
  giftId: string;
}

interface OpenGiftResponse {
  success: boolean;
  itemsReceived?: string[];
  tokensReceived?: number;
  error?: string;
}

// =============================================================================
// Send Gift Function
// =============================================================================

/**
 * Send a gift to another user
 *
 * Flow:
 * 1. Validate authentication
 * 2. Verify recipient exists and is not sender
 * 3. Validate purchase receipt
 * 4. Create gift record
 * 5. Send push notification to recipient
 */
export const sendGift = functions.https.onCall(
  async (data: SendGiftRequest, context): Promise<SendGiftResponse> => {
    // 1. Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to send gifts",
      );
    }

    const senderUid = context.auth.uid;
    const {
      itemId,
      itemType,
      recipientUid,
      message,
      platform,
      purchaseToken,
      receiptData,
      transactionId,
    } = data;

    // Validate required fields
    if (!itemId || !itemType || !recipientUid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields",
      );
    }

    const db = admin.firestore();

    try {
      // 2. Verify recipient exists and is not sender
      if (recipientUid === senderUid) {
        return { success: false, error: "You cannot gift to yourself" };
      }

      const recipientDoc = await db.collection("Users").doc(recipientUid).get();
      if (!recipientDoc.exists) {
        return { success: false, error: "Recipient not found" };
      }

      const recipientData = recipientDoc.data();
      const recipientName = recipientData?.displayName || "User";

      // Get sender info
      const senderDoc = await db.collection("Users").doc(senderUid).get();
      const senderData = senderDoc.data();
      const senderName = senderData?.displayName || "A friend";

      // 3. Validate purchase receipt
      // In development, skip validation
      const isDev = process.env.FUNCTIONS_EMULATOR === "true";

      if (!isDev && purchaseToken) {
        // For production, validate the receipt data
        // Note: Full validation should be done in validateReceipt module
        // Here we just check basic fields exist
        if (!transactionId && !receiptData) {
          console.error("[sendGift] Missing purchase verification data");
          return { success: false, error: "Purchase validation failed" };
        }

        // Log for audit
        console.log("[sendGift] Purchase token provided for validation:", {
          platform,
          productId: itemId,
          hasReceiptData: !!receiptData,
          transactionId,
        });
      }

      // Get product info
      const productDoc = await db
        .collection("PremiumProducts")
        .doc(itemId)
        .get();
      if (!productDoc.exists) {
        return { success: false, error: "Product not found" };
      }

      const productData = productDoc.data();
      const itemName = productData?.name || "Gift";
      const itemImagePath = productData?.imagePath || "🎁";

      // 4. Create gift record
      const now = Date.now();
      const expiresAt = now + GIFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      const giftData = {
        senderUid,
        senderName,
        recipientUid,
        recipientName,
        itemId,
        itemType,
        itemName,
        itemImagePath,
        message:
          (message || "").trim().slice(0, MAX_MESSAGE_LENGTH) ||
          "Enjoy this gift! 🎁",
        purchaseId: transactionId || purchaseToken || `gift_${now}`,
        status: "pending",
        sentAt: now,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const giftRef = await db.collection("Gifts").add(giftData);

      console.log(
        `[gifting] Gift created: ${giftRef.id} from ${senderUid} to ${recipientUid}`,
      );

      // 5. Send push notification to recipient
      try {
        const recipientTokens = recipientData?.fcmTokens || [];

        if (recipientTokens.length > 0) {
          await admin.messaging().sendEachForMulticast({
            tokens: recipientTokens,
            notification: {
              title: "🎁 You received a gift!",
              body: `${senderName} sent you ${itemName}`,
            },
            data: {
              type: "gift_received",
              giftId: giftRef.id,
              senderUid,
              senderName,
            },
          });

          console.log(`[gifting] Push notification sent to ${recipientUid}`);
        }
      } catch (pushError) {
        // Don't fail the gift if push fails
        console.error("[gifting] Push notification failed:", pushError);
      }

      return {
        success: true,
        giftId: giftRef.id,
      };
    } catch (error) {
      console.error("[gifting] sendGift error:", error);
      throw new functions.https.HttpsError("internal", "Failed to send gift");
    }
  },
);

// =============================================================================
// Open Gift Function
// =============================================================================

/**
 * Open a received gift and claim the items
 *
 * Flow:
 * 1. Validate authentication
 * 2. Verify gift belongs to user
 * 3. Check gift not expired/already opened
 * 4. Grant items/tokens to user
 * 5. Update gift status
 */
export const openGift = functions.https.onCall(
  async (data: OpenGiftRequest, context): Promise<OpenGiftResponse> => {
    // 1. Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to open gifts",
      );
    }

    const uid = context.auth.uid;
    const { giftId } = data;

    if (!giftId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Gift ID is required",
      );
    }

    const db = admin.firestore();

    try {
      // Get gift
      const giftRef = db.collection("Gifts").doc(giftId);
      const giftDoc = await giftRef.get();

      if (!giftDoc.exists) {
        return { success: false, error: "Gift not found" };
      }

      const gift = giftDoc.data()!;

      // 2. Verify gift belongs to user
      if (gift.recipientUid !== uid) {
        return { success: false, error: "This gift is not for you" };
      }

      // 3. Check status
      if (gift.status === "opened") {
        return { success: false, error: "Gift already opened" };
      }

      if (gift.status === "expired" || Date.now() > gift.expiresAt) {
        await giftRef.update({ status: "expired" });
        return { success: false, error: "Gift has expired" };
      }

      // 4. Grant items/tokens based on gift type
      let itemsReceived: string[] = [];
      let tokensReceived = 0;

      const productDoc = await db
        .collection("PremiumProducts")
        .doc(gift.itemId)
        .get();

      if (productDoc.exists) {
        const product = productDoc.data()!;

        // Handle different product types
        switch (gift.itemType) {
          case "tokenPack":
            // Grant tokens
            tokensReceived = (product.tokens || 0) + (product.bonusTokens || 0);
            if (tokensReceived > 0) {
              await db
                .collection("Users")
                .doc(uid)
                .collection("wallet")
                .doc("tokens")
                .set(
                  {
                    balance:
                      admin.firestore.FieldValue.increment(tokensReceived),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                  },
                  { merge: true },
                );
            }
            break;

          case "bundle":
            // Grant bundle items
            const bundleItems = product.items || [];
            itemsReceived = bundleItems.map((item: any) => item.itemId);

            // Grant tokens if bundle includes them
            if (product.bonusTokens) {
              tokensReceived = product.bonusTokens;
              await db
                .collection("Users")
                .doc(uid)
                .collection("wallet")
                .doc("tokens")
                .set(
                  {
                    balance:
                      admin.firestore.FieldValue.increment(tokensReceived),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                  },
                  { merge: true },
                );
            }

            // Add items to user's inventory
            const inventoryBatch = db.batch();
            for (const itemId of itemsReceived) {
              const invRef = db
                .collection("Users")
                .doc(uid)
                .collection("inventory")
                .doc(itemId);
              inventoryBatch.set(invRef, {
                itemId,
                unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
                source: "gift",
                giftId,
              });
            }
            await inventoryBatch.commit();
            break;

          case "exclusive":
            // Grant single exclusive item
            itemsReceived = [gift.itemId];
            await db
              .collection("Users")
              .doc(uid)
              .collection("inventory")
              .doc(gift.itemId)
              .set({
                itemId: gift.itemId,
                unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
                source: "gift",
                giftId,
              });
            break;
        }
      }

      // 5. Update gift status
      await giftRef.update({
        status: "opened",
        openedAt: Date.now(),
      });

      console.log(
        `[gifting] Gift ${giftId} opened. Items: ${itemsReceived.length}, Tokens: ${tokensReceived}`,
      );

      // Notify sender that gift was opened
      try {
        const senderDoc = await db
          .collection("Users")
          .doc(gift.senderUid)
          .get();
        const senderTokens = senderDoc.data()?.fcmTokens || [];

        if (senderTokens.length > 0) {
          await admin.messaging().sendEachForMulticast({
            tokens: senderTokens,
            notification: {
              title: "🎁 Gift opened!",
              body: `${gift.recipientName} opened your gift`,
            },
            data: {
              type: "gift_opened",
              giftId,
              recipientUid: uid,
            },
          });
        }
      } catch (pushError) {
        console.error("[gifting] Failed to notify sender:", pushError);
      }

      return {
        success: true,
        itemsReceived,
        tokensReceived,
      };
    } catch (error) {
      console.error("[gifting] openGift error:", error);
      throw new functions.https.HttpsError("internal", "Failed to open gift");
    }
  },
);

// =============================================================================
// Expire Gifts Function
// =============================================================================

/**
 * Scheduled function to expire old gifts
 * Runs hourly
 */
export const expireGifts = functions.pubsub
  .schedule("0 * * * *") // Every hour
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const now = Date.now();

    try {
      // Find gifts that should be expired
      const expiredQuery = await db
        .collection("Gifts")
        .where("status", "in", ["pending", "delivered"])
        .where("expiresAt", "<=", now)
        .get();

      if (expiredQuery.empty) {
        console.log("[gifting] No gifts to expire");
        return null;
      }

      // Batch update to expired
      const batch = db.batch();
      let count = 0;

      expiredQuery.forEach((doc) => {
        batch.update(doc.ref, { status: "expired" });
        count++;
      });

      await batch.commit();

      console.log(`[gifting] Expired ${count} gifts`);
      return null;
    } catch (error) {
      console.error("[gifting] expireGifts error:", error);
      return null;
    }
  });

// =============================================================================
// Get Gift History Function
// =============================================================================

/**
 * Get user's gift history (sent and received)
 */
export const getGiftHistory = functions.https.onCall(
  async (data: { type: "sent" | "received"; limit?: number }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const uid = context.auth.uid;
    const { type, limit = 50 } = data;

    const db = admin.firestore();

    try {
      const field = type === "sent" ? "senderUid" : "recipientUid";

      const query = await db
        .collection("Gifts")
        .where(field, "==", uid)
        .orderBy("sentAt", "desc")
        .limit(limit)
        .get();

      const gifts = query.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { success: true, gifts };
    } catch (error) {
      console.error("[gifting] getGiftHistory error:", error);
      throw new functions.https.HttpsError("internal", "Failed to get history");
    }
  },
);
