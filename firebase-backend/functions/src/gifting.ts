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
import { notifyUser } from "./notificationCenter";

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

function buildGiftHistoryRecord(params: {
  uid: string;
  type: "gift_sent" | "gift_received";
  giftId: string;
  itemId: string;
  itemName: string;
  itemImagePath?: string;
  counterpartyUid: string;
  counterpartyName: string;
  message: string;
  purchasedAt: admin.firestore.Timestamp;
  priceTokens?: number;
  giftStatus: "pending" | "opened" | "expired";
  openedAt?: admin.firestore.Timestamp;
}): Record<string, unknown> {
  const {
    uid,
    type,
    giftId,
    itemId,
    itemName,
    itemImagePath,
    counterpartyUid,
    counterpartyName,
    message,
    purchasedAt,
    priceTokens,
    giftStatus,
    openedAt,
  } = params;

  return {
    type,
    userId: uid,
    itemId,
    itemName,
    itemImagePath: itemImagePath ?? null,
    quantity: 1,
    priceTokens: priceTokens ?? null,
    paymentMethod: "gift",
    purchasedAt,
    giftInfo:
      type === "gift_sent"
        ? {
            recipientId: counterpartyUid,
            recipientName: counterpartyName,
            message,
          }
        : {
            senderId: counterpartyUid,
            senderName: counterpartyName,
            message,
          },
    metadata: {
      giftId,
      giftStatus,
      openedAt: openedAt ?? null,
    },
  };
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
      const nowTs = admin.firestore.Timestamp.now();
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

      const priceTokens =
        typeof productData?.priceTokens === "number"
          ? productData.priceTokens
          : undefined;

      await Promise.all([
        db
          .collection("Users")
          .doc(senderUid)
          .collection("PurchaseHistory")
          .doc(giftRef.id)
          .set(
            buildGiftHistoryRecord({
              uid: senderUid,
              type: "gift_sent",
              giftId: giftRef.id,
              itemId,
              itemName,
              itemImagePath,
              counterpartyUid: recipientUid,
              counterpartyName: recipientName,
              message: giftData.message,
              purchasedAt: nowTs,
              priceTokens,
              giftStatus: "pending",
            }),
            { merge: true },
          ),
        db
          .collection("Users")
          .doc(recipientUid)
          .collection("PurchaseHistory")
          .doc(giftRef.id)
          .set(
            buildGiftHistoryRecord({
              uid: recipientUid,
              type: "gift_received",
              giftId: giftRef.id,
              itemId,
              itemName,
              itemImagePath,
              counterpartyUid: senderUid,
              counterpartyName: senderName,
              message: giftData.message,
              purchasedAt: nowTs,
              giftStatus: "pending",
            }),
            { merge: true },
          ),
      ]);

      // 5. Notify recipient through the shared notification center
      try {
        await notifyUser({
          recipientUid,
          type: "gift_received",
          category: "commerce",
          dedupeKey: `gift_received:${giftRef.id}:${recipientUid}`,
          collapseKey: `gift:${giftRef.id}`,
          title: "Gift received",
          body: `${senderName} sent you ${itemName}`,
          actorUid: senderUid,
          actorName: senderName,
          giftId: giftRef.id,
          route: {
            screen: "PurchaseHistory",
          },
          data: {
            giftId: giftRef.id,
            senderUid,
            senderName,
            itemId,
            itemName,
          },
        });
      } catch (pushError) {
        console.error("[gifting] Gift notification failed:", pushError);
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
            // Grant tokens to canonical wallet
            tokensReceived = (product.tokens || 0) + (product.bonusTokens || 0);
            if (tokensReceived > 0) {
              await db
                .collection("Wallets")
                .doc(uid)
                .set(
                  {
                    tokensBalance:
                      admin.firestore.FieldValue.increment(tokensReceived),
                    tokens:
                      admin.firestore.FieldValue.increment(tokensReceived), // back-compat
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
                .collection("Wallets")
                .doc(uid)
                .set(
                  {
                    tokensBalance:
                      admin.firestore.FieldValue.increment(tokensReceived),
                    tokens:
                      admin.firestore.FieldValue.increment(tokensReceived), // back-compat
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
      const openedAt = admin.firestore.Timestamp.now();

      await giftRef.update({
        status: "opened",
        openedAt: Date.now(),
      });

      await Promise.all([
        db
          .collection("Users")
          .doc(uid)
          .collection("PurchaseHistory")
          .doc(giftId)
          .set(
            {
              metadata: {
                giftId,
                giftStatus: "opened",
                openedAt,
              },
            },
            { merge: true },
          ),
        db
          .collection("Users")
          .doc(gift.senderUid)
          .collection("PurchaseHistory")
          .doc(giftId)
          .set(
            {
              metadata: {
                giftId,
                giftStatus: "opened",
                openedAt,
              },
            },
            { merge: true },
          ),
      ]);

      console.log(
        `[gifting] Gift ${giftId} opened. Items: ${itemsReceived.length}, Tokens: ${tokensReceived}`,
      );

      // Notify sender that gift was opened
      try {
        await notifyUser({
          recipientUid: gift.senderUid,
          type: "gift_opened",
          category: "commerce",
          dedupeKey: `gift_opened:${giftId}:${gift.senderUid}`,
          collapseKey: `gift:${giftId}`,
          title: "Gift opened",
          body: `${gift.recipientName} opened your gift`,
          actorUid: uid,
          actorName: gift.recipientName,
          giftId,
          route: {
            screen: "PurchaseHistory",
          },
          data: {
            giftId,
            recipientUid: uid,
            recipientName: gift.recipientName,
            itemId: gift.itemId,
            itemName: gift.itemName,
          },
        });
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
