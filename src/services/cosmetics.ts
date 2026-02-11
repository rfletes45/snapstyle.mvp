/**
 * Cosmetics Service - Inventory management
 */

import {
  getFreeItems,
  getItemById,
  getStarterItems,
  MILESTONE_REWARDS,
} from "@/data/cosmetics";
import type { AvatarConfig, InventoryItem } from "@/types/models";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { updateProfile } from "./users";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/cosmetics");
// ============================================================
// INVENTORY FUNCTIONS
// ============================================================

/**
 * Get all items in a user's inventory
 */
export async function getUserInventory(
  userId: string,
): Promise<InventoryItem[]> {
  try {
    const db = getFirestoreInstance();
    const inventoryRef = collection(db, "Users", userId, "inventory");
    const snapshot = await getDocs(query(inventoryRef));

    return snapshot.docs.map((doc) => ({
      itemId: doc.id,
      acquiredAt: doc.data().acquiredAt || Date.now(),
    }));
  } catch (error) {
    logger.error("Error getting inventory:", error);
    return [];
  }
}

/**
 * Check if a user has a specific item
 */
export async function hasItem(
  userId: string,
  itemId: string,
): Promise<boolean> {
  try {
    const db = getFirestoreInstance();
    const itemRef = doc(db, "Users", userId, "inventory", itemId);
    const itemDoc = await getDoc(itemRef);
    return itemDoc.exists();
  } catch (error) {
    logger.error("Error checking item:", error);
    return false;
  }
}

/**
 * Add an item to user's inventory
 */
export async function addToInventory(
  userId: string,
  itemId: string,
): Promise<boolean> {
  try {
    // Verify item exists in catalog
    const item = getItemById(itemId);
    if (!item) {
      logger.error("Item not found in catalog:", itemId);
      return false;
    }

    // Check if user already has this item
    const alreadyHas = await hasItem(userId, itemId);
    if (alreadyHas) {
      logger.info("User already has item:", itemId);
      return true;
    }

    const db = getFirestoreInstance();
    const itemRef = doc(db, "Users", userId, "inventory", itemId);

    await setDoc(itemRef, {
      itemId,
      acquiredAt: Date.now(),
    });

    logger.info("Added item to inventory:", itemId);
    return true;
  } catch (error) {
    logger.error("Error adding to inventory:", error);
    return false;
  }
}

/**
 * Grant starter items to a new user
 * Called during profile setup
 */
export async function grantStarterItems(userId: string): Promise<void> {
  const starterItems = getStarterItems();
  const freeItems = getFreeItems();

  // Combine starter and free items (unique)
  const allItems = [...starterItems, ...freeItems];
  const uniqueItemIds = [...new Set(allItems.map((item) => item.id))];

  for (const itemId of uniqueItemIds) {
    await addToInventory(userId, itemId);
  }

  logger.info(
    `Granted ${uniqueItemIds.length} starter items to user ${userId}`,
  );
}

/**
 * Check and grant milestone reward if earned
 * Returns the item ID if a reward was granted, null otherwise
 */
export async function checkAndGrantMilestoneReward(
  userId: string,
  streakCount: number,
): Promise<string | null> {
  // Check if this streak count has a reward
  const rewardItemId = MILESTONE_REWARDS[streakCount];
  if (!rewardItemId) {
    return null;
  }

  // Check if user already has this item
  const alreadyHas = await hasItem(userId, rewardItemId);
  if (alreadyHas) {
    logger.info("User already has milestone reward:", rewardItemId);
    return null;
  }

  // Grant the reward
  const success = await addToInventory(userId, rewardItemId);
  if (success) {
    logger.info(
      `Granted milestone reward ${rewardItemId} for ${streakCount}-day streak`,
    );
    return rewardItemId;
  }

  return null;
}

// ============================================================
// AVATAR CONFIG FUNCTIONS
// ============================================================

/**
 * Update user's avatar configuration (equipped items)
 */
export async function updateAvatarConfig(
  userId: string,
  avatarConfig: AvatarConfig,
): Promise<boolean> {
  try {
    return await updateProfile(userId, { avatarConfig });
  } catch (error) {
    logger.error("Error updating avatar config:", error);
    return false;
  }
}

/**
 * Equip a single item to avatar
 */
export async function equipItem(
  userId: string,
  itemId: string,
  currentConfig: AvatarConfig,
): Promise<boolean> {
  // Verify item exists
  const item = getItemById(itemId);
  if (!item) {
    logger.error("Item not found:", itemId);
    return false;
  }

  // Verify user owns the item (or it's "none" type)
  if (
    itemId !== "hat_none" &&
    itemId !== "glasses_none" &&
    itemId !== "bg_default"
  ) {
    const ownsItem = await hasItem(userId, itemId);
    if (!ownsItem) {
      logger.error("User does not own item:", itemId);
      return false;
    }
  }

  // Update the appropriate slot
  const newConfig: AvatarConfig = { ...currentConfig };
  switch (item.slot) {
    case "hat":
      newConfig.hat = itemId === "hat_none" ? undefined : itemId;
      break;
    case "glasses":
      newConfig.glasses = itemId === "glasses_none" ? undefined : itemId;
      break;
    case "background":
      newConfig.background = itemId === "bg_default" ? undefined : itemId;
      break;
  }

  return await updateAvatarConfig(userId, newConfig);
}

/**
 * Get all items user can access (strictly from inventory)
 * Inventory is the single source of truth for ownership
 * Free items are granted during account setup via grantStarterItems()
 */
export async function getAccessibleItems(userId: string): Promise<string[]> {
  // Get user's inventory - this is the ONLY source of truth
  const inventory = await getUserInventory(userId);
  return inventory.map((item) => item.itemId);
}
