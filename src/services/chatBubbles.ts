/**
 * Chat Bubbles Service
 *
 * Handles:
 * - Fetching user's owned chat bubble styles
 * - Equipping/unequipping bubble styles
 * - Checking bubble style unlock requirements
 * - Real-time bubble style subscription
 *
 * @see src/types/profile.ts for ChatBubbleStyle type
 * @see src/data/chatBubbles.ts for bubble style definitions
 */

import {
  CHAT_BUBBLE_STYLES,
  getAllBubbleStyles as getAllBubbleStyleDefinitions,
  getBubbleStyleById,
  getDefaultBubbleStyle,
} from "@/data/chatBubbles";
import type { ChatBubbleStyle } from "@/types/profile";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

// Lazy getter for Firestore
const getDb = () => getFirestoreInstance();

// =============================================================================
// Bubble Style Definitions
// =============================================================================

/**
 * Get all bubble style definitions
 */
export function getAvailableBubbleStyles(): ChatBubbleStyle[] {
  return getAllBubbleStyleDefinitions();
}

/**
 * Get a specific bubble style definition by ID
 */
export function getBubbleStyle(styleId: string): ChatBubbleStyle | undefined {
  return getBubbleStyleById(styleId);
}

// =============================================================================
// Bubble Style Ownership
// =============================================================================

/**
 * Get user's owned bubble style IDs from Firestore
 */
export async function getUserOwnedBubbleStyles(uid: string): Promise<string[]> {
  const db = getDb();

  try {
    // Check inventory for owned bubble styles
    const inventoryRef = collection(db, "Users", uid, "inventory");
    const snapshot = await getDocs(inventoryRef);

    const ownedStyles: string[] = [];

    // Include free and starter styles by default
    CHAT_BUBBLE_STYLES.forEach((style) => {
      if (style.unlock.type === "free" || style.unlock.type === "starter") {
        ownedStyles.push(style.id);
      }
    });

    // Add styles from inventory
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Check if this inventory item is a bubble style
      if (data.slot === "chat_bubble" || doc.id.startsWith("bubble_")) {
        const styleId = data.itemId || doc.id.replace("bubble_", "");
        if (!ownedStyles.includes(styleId)) {
          ownedStyles.push(styleId);
        }
      }
    });

    return ownedStyles;
  } catch (error) {
    console.error("[chatBubbles] Error fetching owned styles:", error);
    // Return free styles on error
    return CHAT_BUBBLE_STYLES.filter(
      (s) => s.unlock.type === "free" || s.unlock.type === "starter",
    ).map((s) => s.id);
  }
}

/**
 * Check if user owns a specific bubble style
 */
export async function userOwnsBubbleStyle(
  uid: string,
  styleId: string,
): Promise<boolean> {
  const style = getBubbleStyleById(styleId);
  if (!style) return false;

  // Free and starter styles are always owned
  if (style.unlock.type === "free" || style.unlock.type === "starter") {
    return true;
  }

  const ownedStyles = await getUserOwnedBubbleStyles(uid);
  return ownedStyles.includes(styleId);
}

/**
 * Grant a bubble style to a user (add to inventory)
 * @returns true if granted successfully, false otherwise
 */
export async function grantBubbleStyle(
  uid: string,
  styleId: string,
  source?: string,
): Promise<boolean> {
  const db = getDb();

  try {
    // Verify style exists
    const style = getBubbleStyleById(styleId);
    if (!style) {
      console.error("[chatBubbles] Style not found:", styleId);
      return false;
    }

    // Check if already owned
    const alreadyOwned = await userOwnsBubbleStyle(uid, styleId);
    if (alreadyOwned) {
      console.log("[chatBubbles] User already owns style:", styleId);
      return false;
    }

    // Add to inventory
    const inventoryRef = doc(
      db,
      "Users",
      uid,
      "inventory",
      `bubble_${styleId}`,
    );
    await setDoc(inventoryRef, {
      itemId: styleId,
      slot: "chat_bubble",
      acquiredAt: Date.now(),
      source: source || "granted",
    });

    console.log("[chatBubbles] Granted style:", styleId, "to user:", uid);
    return true;
  } catch (error) {
    console.error("[chatBubbles] Error granting style:", error);
    return false;
  }
}

// =============================================================================
// Bubble Style Equipping
// =============================================================================

/**
 * Get user's currently equipped bubble style ID
 */
export async function getEquippedBubbleStyle(
  uid: string,
): Promise<string | null> {
  const db = getDb();

  try {
    const userRef = doc(db, "Users", uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    return data.avatarConfig?.chatBubble || null;
  } catch (error) {
    console.error("[chatBubbles] Error getting equipped style:", error);
    return null;
  }
}

/**
 * Equip a bubble style (set as active)
 */
export async function equipBubbleStyle(
  uid: string,
  styleId: string,
): Promise<boolean> {
  const db = getDb();

  try {
    // Verify user owns style
    const owned = await userOwnsBubbleStyle(uid, styleId);
    if (!owned) {
      console.error("[chatBubbles] User does not own style:", styleId);
      return false;
    }

    // Update user's avatar config
    const userRef = doc(db, "Users", uid);
    await updateDoc(userRef, {
      "avatarConfig.chatBubble": styleId,
    });

    console.log("[chatBubbles] Equipped style:", styleId);
    return true;
  } catch (error) {
    console.error("[chatBubbles] Error equipping style:", error);
    return false;
  }
}

/**
 * Unequip bubble style (set back to default)
 */
export async function unequipBubbleStyle(uid: string): Promise<boolean> {
  const db = getDb();

  try {
    const userRef = doc(db, "Users", uid);
    await updateDoc(userRef, {
      "avatarConfig.chatBubble": "default",
    });

    console.log("[chatBubbles] Unequipped style, set to default");
    return true;
  } catch (error) {
    console.error("[chatBubbles] Error unequipping style:", error);
    return false;
  }
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to user's owned bubble styles
 * @returns Unsubscribe function
 */
export function subscribeToOwnedBubbleStyles(
  uid: string,
  onUpdate: (styleIds: string[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getDb();
  const inventoryRef = collection(db, "Users", uid, "inventory");

  return onSnapshot(
    inventoryRef,
    (snapshot) => {
      const ownedStyles: string[] = [];

      // Include free and starter styles
      CHAT_BUBBLE_STYLES.forEach((style) => {
        if (style.unlock.type === "free" || style.unlock.type === "starter") {
          ownedStyles.push(style.id);
        }
      });

      // Add styles from inventory
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.slot === "chat_bubble" || doc.id.startsWith("bubble_")) {
          const styleId = data.itemId || doc.id.replace("bubble_", "");
          if (!ownedStyles.includes(styleId)) {
            ownedStyles.push(styleId);
          }
        }
      });

      onUpdate(ownedStyles);
    },
    (error) => {
      console.error("[chatBubbles] Subscription error:", error);
      onError?.(error as Error);
    },
  );
}

/**
 * Subscribe to user's equipped bubble style
 */
export function subscribeToEquippedBubbleStyle(
  uid: string,
  onUpdate: (styleId: string | null) => void,
): () => void {
  const db = getDb();
  const userRef = doc(db, "Users", uid);

  return onSnapshot(userRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    const data = snapshot.data();
    onUpdate(data.avatarConfig?.chatBubble || null);
  });
}

// =============================================================================
// Bubble Style Unlock Checking
// =============================================================================

/**
 * Check if user meets unlock requirements for a bubble style
 * @returns Object with canUnlock status and reason
 */
export async function canUnlockBubbleStyle(
  uid: string,
  styleId: string,
): Promise<{ canUnlock: boolean; reason?: string }> {
  const style = getBubbleStyleById(styleId);

  if (!style) {
    return { canUnlock: false, reason: "Style not found" };
  }

  switch (style.unlock.type) {
    case "free":
    case "starter":
      return { canUnlock: true };

    case "purchase":
      // Would need to check user's token balance
      // For now, return true (purchase flow handles this)
      return { canUnlock: true, reason: "Available for purchase" };

    case "milestone": {
      // Would need to check user's level/streak/games
      const { milestoneType, milestoneValue } = style.unlock;
      return {
        canUnlock: false,
        reason: `Requires ${milestoneType} level ${milestoneValue}`,
      };
    }

    case "achievement": {
      // Would need to check user's achievements
      const { achievementId } = style.unlock;
      return {
        canUnlock: false,
        reason: `Requires achievement: ${achievementId}`,
      };
    }

    case "exclusive":
      return {
        canUnlock: false,
        reason: `Exclusive: ${style.unlock.source || "Special event"}`,
      };

    default:
      return { canUnlock: false, reason: "Unknown unlock type" };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all bubble styles with ownership and equipped status
 */
export async function getAllBubbleStylesWithStatus(
  uid: string,
): Promise<Array<ChatBubbleStyle & { owned: boolean; equipped: boolean }>> {
  const [ownedStyles, equippedStyle] = await Promise.all([
    getUserOwnedBubbleStyles(uid),
    getEquippedBubbleStyle(uid),
  ]);

  return CHAT_BUBBLE_STYLES.map((style) => ({
    ...style,
    owned: ownedStyles.includes(style.id),
    equipped: equippedStyle === style.id,
  }));
}

/**
 * Get bubble style for applying to messages
 * Falls back to default if not found
 */
export function getBubbleStyleForMessage(
  styleId: string | null | undefined,
): ChatBubbleStyle {
  if (!styleId) {
    return getDefaultBubbleStyle();
  }

  const style = getBubbleStyleById(styleId);
  return style || getDefaultBubbleStyle();
}

/**
 * Get user's bubble style for chat display
 * This is used by chat components to get the style to apply
 */
export async function getUserBubbleStyleForChat(
  uid: string,
): Promise<ChatBubbleStyle> {
  const equippedStyleId = await getEquippedBubbleStyle(uid);
  return getBubbleStyleForMessage(equippedStyleId);
}
