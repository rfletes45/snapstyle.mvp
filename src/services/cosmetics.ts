/**
 * Cosmetics Service - Inventory management
 * Phase 7: Avatar + Cosmetics
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import type { InventoryItem, AvatarConfig } from "@/types/models";
import {
  getItemById,
  getStarterItems,
  getFreeItems,
  MILESTONE_REWARDS,
} from "@/data/cosmetics";
import { updateProfile } from "./users";

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
    console.error("Error getting inventory:", error);
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
    console.error("Error checking item:", error);
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
      console.error("Item not found in catalog:", itemId);
      return false;
    }

    // Check if user already has this item
    const alreadyHas = await hasItem(userId, itemId);
    if (alreadyHas) {
      console.log("User already has item:", itemId);
      return true;
    }

    const db = getFirestoreInstance();
    const itemRef = doc(db, "Users", userId, "inventory", itemId);

    await setDoc(itemRef, {
      itemId,
      acquiredAt: Date.now(),
    });

    console.log("Added item to inventory:", itemId);
    return true;
  } catch (error) {
    console.error("Error adding to inventory:", error);
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

  console.log(
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
    console.log("User already has milestone reward:", rewardItemId);
    return null;
  }

  // Grant the reward
  const success = await addToInventory(userId, rewardItemId);
  if (success) {
    console.log(
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
    console.error("Error updating avatar config:", error);
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
    console.error("Item not found:", itemId);
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
      console.error("User does not own item:", itemId);
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
 * Get all items user can access (owned + free)
 */
export async function getAccessibleItems(userId: string): Promise<string[]> {
  // Get user's inventory
  const inventory = await getUserInventory(userId);
  const ownedItemIds = inventory.map((item) => item.itemId);

  // Add free items
  const freeItems = getFreeItems();
  const freeItemIds = freeItems.map((item) => item.id);

  // Combine and dedupe
  return [...new Set([...ownedItemIds, ...freeItemIds])];
}
