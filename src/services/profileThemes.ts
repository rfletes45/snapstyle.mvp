/**
 * Profile Themes Service
 *
 * Handles:
 * - Fetching user's owned themes
 * - Equipping/unequipping themes
 * - Checking theme unlock requirements
 * - Real-time theme subscription
 *
 * @see src/types/profile.ts for ProfileTheme type
 * @see src/data/profileThemes.ts for theme definitions
 */

import {
  getAllThemes as getAllThemeDefinitions,
  getThemeById,
  PROFILE_THEMES,
} from "@/data/profileThemes";
import type { ProfileTheme } from "@/types/profile";
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
// Theme Definitions
// =============================================================================

/**
 * Get all theme definitions
 */
export function getAvailableThemes(): ProfileTheme[] {
  return getAllThemeDefinitions();
}

/**
 * Get a specific theme definition by ID
 */
export function getTheme(themeId: string): ProfileTheme | undefined {
  return getThemeById(themeId);
}

// =============================================================================
// Theme Ownership
// =============================================================================

/**
 * Get user's owned theme IDs from Firestore
 */
export async function getUserOwnedThemes(uid: string): Promise<string[]> {
  const db = getDb();

  try {
    // Check inventory for owned themes
    const inventoryRef = collection(db, "Users", uid, "inventory");
    const snapshot = await getDocs(inventoryRef);

    const ownedThemes: string[] = [];

    // Include free and starter themes by default
    PROFILE_THEMES.forEach((theme) => {
      if (theme.unlock.type === "free" || theme.unlock.type === "starter") {
        ownedThemes.push(theme.id);
      }
    });

    // Add themes from inventory
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Check if this inventory item is a theme
      if (data.slot === "profile_theme" || doc.id.startsWith("theme_")) {
        const themeId = data.itemId || doc.id.replace("theme_", "");
        if (!ownedThemes.includes(themeId)) {
          ownedThemes.push(themeId);
        }
      }
    });

    return ownedThemes;
  } catch (error) {
    console.error("[profileThemes] Error fetching owned themes:", error);
    // Return free themes on error
    return PROFILE_THEMES.filter(
      (t) => t.unlock.type === "free" || t.unlock.type === "starter",
    ).map((t) => t.id);
  }
}

/**
 * Check if user owns a specific theme
 */
export async function userOwnsTheme(
  uid: string,
  themeId: string,
): Promise<boolean> {
  const theme = getThemeById(themeId);
  if (!theme) return false;

  // Free and starter themes are always owned
  if (theme.unlock.type === "free" || theme.unlock.type === "starter") {
    return true;
  }

  const ownedThemes = await getUserOwnedThemes(uid);
  return ownedThemes.includes(themeId);
}

/**
 * Grant a theme to a user (add to inventory)
 * @returns true if granted successfully, false otherwise
 */
export async function grantTheme(
  uid: string,
  themeId: string,
  source?: string,
): Promise<boolean> {
  const db = getDb();

  try {
    // Verify theme exists
    const theme = getThemeById(themeId);
    if (!theme) {
      console.error("[profileThemes] Theme not found:", themeId);
      return false;
    }

    // Check if already owned
    const alreadyOwned = await userOwnsTheme(uid, themeId);
    if (alreadyOwned) {
      console.log("[profileThemes] User already owns theme:", themeId);
      return false;
    }

    // Add to inventory
    const inventoryRef = doc(db, "Users", uid, "inventory", `theme_${themeId}`);
    await setDoc(inventoryRef, {
      itemId: themeId,
      slot: "profile_theme",
      acquiredAt: Date.now(),
      source: source || "granted",
    });

    console.log("[profileThemes] Granted theme:", themeId, "to user:", uid);
    return true;
  } catch (error) {
    console.error("[profileThemes] Error granting theme:", error);
    return false;
  }
}

// =============================================================================
// Theme Equipping
// =============================================================================

/**
 * Get user's currently equipped theme ID
 */
export async function getEquippedTheme(uid: string): Promise<string | null> {
  const db = getDb();

  try {
    const userRef = doc(db, "Users", uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    return data.avatarConfig?.profileTheme || null;
  } catch (error) {
    console.error("[profileThemes] Error getting equipped theme:", error);
    return null;
  }
}

/**
 * Equip a theme (set as active)
 */
export async function equipTheme(
  uid: string,
  themeId: string,
): Promise<boolean> {
  const db = getDb();

  try {
    // Verify user owns theme
    const owned = await userOwnsTheme(uid, themeId);
    if (!owned) {
      console.error("[profileThemes] User does not own theme:", themeId);
      return false;
    }

    // Update user's avatar config
    const userRef = doc(db, "Users", uid);
    await updateDoc(userRef, {
      "avatarConfig.profileTheme": themeId,
    });

    console.log("[profileThemes] Equipped theme:", themeId);
    return true;
  } catch (error) {
    console.error("[profileThemes] Error equipping theme:", error);
    return false;
  }
}

/**
 * Unequip theme (set back to default)
 */
export async function unequipTheme(uid: string): Promise<boolean> {
  const db = getDb();

  try {
    const userRef = doc(db, "Users", uid);
    await updateDoc(userRef, {
      "avatarConfig.profileTheme": "default",
    });

    console.log("[profileThemes] Unequipped theme, set to default");
    return true;
  } catch (error) {
    console.error("[profileThemes] Error unequipping theme:", error);
    return false;
  }
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to user's owned themes
 * @returns Unsubscribe function
 */
export function subscribeToOwnedThemes(
  uid: string,
  onUpdate: (themeIds: string[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getDb();
  const inventoryRef = collection(db, "Users", uid, "inventory");

  return onSnapshot(
    inventoryRef,
    (snapshot) => {
      const ownedThemes: string[] = [];

      // Include free and starter themes
      PROFILE_THEMES.forEach((theme) => {
        if (theme.unlock.type === "free" || theme.unlock.type === "starter") {
          ownedThemes.push(theme.id);
        }
      });

      // Add themes from inventory
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.slot === "profile_theme" || doc.id.startsWith("theme_")) {
          const themeId = data.itemId || doc.id.replace("theme_", "");
          if (!ownedThemes.includes(themeId)) {
            ownedThemes.push(themeId);
          }
        }
      });

      onUpdate(ownedThemes);
    },
    (error) => {
      console.error("[profileThemes] Subscription error:", error);
      onError?.(error as Error);
    },
  );
}

/**
 * Subscribe to user's equipped theme
 */
export function subscribeToEquippedTheme(
  uid: string,
  onUpdate: (themeId: string | null) => void,
): () => void {
  const db = getDb();
  const userRef = doc(db, "Users", uid);

  return onSnapshot(userRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    const data = snapshot.data();
    onUpdate(data.avatarConfig?.profileTheme || null);
  });
}

// =============================================================================
// Theme Unlock Checking
// =============================================================================

/**
 * Check if user meets unlock requirements for a theme
 * @returns Object with canUnlock status and reason
 */
export async function canUnlockTheme(
  uid: string,
  themeId: string,
): Promise<{ canUnlock: boolean; reason?: string }> {
  const theme = getThemeById(themeId);

  if (!theme) {
    return { canUnlock: false, reason: "Theme not found" };
  }

  switch (theme.unlock.type) {
    case "free":
    case "starter":
      return { canUnlock: true };

    case "purchase":
      // Would need to check user's token balance
      // For now, return true (purchase flow handles this)
      return { canUnlock: true, reason: "Available for purchase" };

    case "milestone": {
      // Would need to check user's level/streak/games
      // This is a simplified check
      const { milestoneType, milestoneValue } = theme.unlock;
      return {
        canUnlock: false,
        reason: `Requires ${milestoneType} level ${milestoneValue}`,
      };
    }

    case "achievement": {
      // Would need to check user's achievements
      const { achievementId } = theme.unlock;
      return {
        canUnlock: false,
        reason: `Requires achievement: ${achievementId}`,
      };
    }

    case "exclusive":
      return {
        canUnlock: false,
        reason: `Exclusive: ${theme.unlock.source || "Special event"}`,
      };

    default:
      return { canUnlock: false, reason: "Unknown unlock type" };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all themes with ownership and equipped status
 */
export async function getAllThemesWithStatus(
  uid: string,
): Promise<Array<ProfileTheme & { owned: boolean; equipped: boolean }>> {
  const [ownedThemes, equippedTheme] = await Promise.all([
    getUserOwnedThemes(uid),
    getEquippedTheme(uid),
  ]);

  return PROFILE_THEMES.map((theme) => ({
    ...theme,
    owned: ownedThemes.includes(theme.id),
    equipped: equippedTheme === theme.id,
  }));
}

/**
 * Get theme colors for applying to UI
 */
export function getThemeColors(themeId: string): ProfileTheme["colors"] | null {
  const theme = getThemeById(themeId);
  return theme?.colors || null;
}

/**
 * Get default theme
 */
export function getDefaultTheme(): ProfileTheme {
  return PROFILE_THEMES.find((t) => t.id === "default")!;
}
