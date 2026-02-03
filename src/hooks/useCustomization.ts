/**
 * useCustomization Hook
 *
 * Manages customization state including:
 * - Current avatar configuration
 * - Preview configuration (unsaved changes)
 * - Owned cosmetic items inventory
 * - Save/discard functionality
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 * @see src/types/profile.ts for types
 */

import { COSMETIC_ITEMS, getItemById } from "@/data/cosmetics";
import {
  ALL_EXTENDED_COSMETICS,
  getExtendedItemById,
  getFrameById,
  PROFILE_FRAMES,
} from "@/data/extendedCosmetics";
import { getFirestoreInstance } from "@/services/firebase";
import { useUser } from "@/store/UserContext";
import type {
  CosmeticItemDisplay,
  ExtendedAvatarConfig,
  ExtendedCosmeticSlot,
} from "@/types/profile";
import { normalizeAvatarConfig } from "@/types/profile";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

// Lazy getter for Firestore
const getDb = () => getFirestoreInstance();

export interface UseCustomizationConfig {
  /** User ID */
  uid: string | undefined;
  /** Auto-load inventory on mount */
  autoLoad?: boolean;
}

export interface UseCustomizationReturn {
  /** Current saved configuration */
  currentConfig: ExtendedAvatarConfig;
  /** Preview configuration (may have unsaved changes) */
  previewConfig: ExtendedAvatarConfig;
  /** User's owned item IDs */
  ownedItems: string[];
  /** Inventory organized by slot */
  inventory: Map<ExtendedCosmeticSlot, CosmeticItemDisplay[]>;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Saving state */
  saving: boolean;
  /** Set preview item for a slot */
  setPreviewItem: (slot: ExtendedCosmeticSlot, itemId: string | null) => void;
  /** Set base color */
  setBaseColor: (color: string) => void;
  /** Save all changes */
  saveChanges: () => Promise<boolean>;
  /** Discard all changes */
  discardChanges: () => void;
  /** Check if user owns an item */
  isOwned: (itemId: string) => boolean;
  /** Refresh inventory from server */
  refreshInventory: () => Promise<void>;
}

export function useCustomization({
  uid,
  autoLoad = true,
}: UseCustomizationConfig): UseCustomizationReturn {
  const { profile, refreshProfile } = useUser();

  // State
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  const [previewConfig, setPreviewConfig] = useState<ExtendedAvatarConfig>(() =>
    getDefaultConfig(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Current config from user profile
  const currentConfig = useMemo<ExtendedAvatarConfig>(() => {
    if (!profile?.avatarConfig) {
      return getDefaultConfig();
    }
    return normalizeAvatarConfig(profile.avatarConfig);
  }, [profile]);

  // Sync preview with current when profile changes
  useEffect(() => {
    setPreviewConfig(currentConfig);
  }, [currentConfig]);

  // Load owned items from inventory
  useEffect(() => {
    if (!uid || !autoLoad) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getDb();
    const inventoryRef = collection(db, "Users", uid, "inventory");

    const unsubscribe = onSnapshot(
      inventoryRef,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => doc.id);
        setOwnedItems(items);
        setLoading(false);
      },
      (err) => {
        console.error("[useCustomization] Inventory subscription error:", err);
        setError(err as Error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [uid, autoLoad]);

  // Check if item is owned
  const isOwned = useCallback(
    (itemId: string): boolean => {
      // Check explicit ownership
      if (ownedItems.includes(itemId)) return true;

      // Check if free or starter item from cosmetics
      const cosmeticItem = getItemById(itemId);
      if (cosmeticItem) {
        return (
          cosmeticItem.unlock.type === "free" ||
          cosmeticItem.unlock.type === "starter"
        );
      }

      // Check if free or starter item from extended cosmetics
      const extendedItem = getExtendedItemById(itemId);
      if (extendedItem) {
        return (
          extendedItem.unlock.type === "free" ||
          extendedItem.unlock.type === "starter"
        );
      }

      // Check frames
      const frame = getFrameById(itemId);
      if (frame) {
        return frame.unlock.type === "free" || frame.unlock.type === "starter";
      }

      return false;
    },
    [ownedItems],
  );

  // Build inventory by slot
  const inventory = useMemo<
    Map<ExtendedCosmeticSlot, CosmeticItemDisplay[]>
  >(() => {
    const map = new Map<ExtendedCosmeticSlot, CosmeticItemDisplay[]>();

    // Add legacy cosmetic items
    for (const item of COSMETIC_ITEMS) {
      const slot = item.slot as ExtendedCosmeticSlot;
      const existing = map.get(slot) || [];
      existing.push({
        ...item,
        // Extended fields with defaults
        unlock: {
          type: item.unlock.type,
          milestoneValue:
            item.unlock.type === "milestone" && item.unlock.value
              ? parseInt(item.unlock.value.replace(/\D/g, ""), 10)
              : undefined,
        },
        owned: isOwned(item.id),
        equipped: previewConfig[getSlotKey(slot)] === item.id,
        locked: !isOwned(item.id),
        rarity: item.rarity as any,
      });
      map.set(slot, existing);
    }

    // Add extended cosmetic items
    for (const item of ALL_EXTENDED_COSMETICS) {
      const existing = map.get(item.slot) || [];
      existing.push({
        ...item,
        owned: isOwned(item.id),
        equipped: previewConfig[getSlotKey(item.slot)] === item.id,
        locked: !isOwned(item.id),
      });
      map.set(item.slot, existing);
    }

    // Add frames
    const frames: CosmeticItemDisplay[] = PROFILE_FRAMES.map((frame) => ({
      id: frame.id,
      name: frame.name,
      description: frame.description,
      slot: "profile_frame" as ExtendedCosmeticSlot,
      imagePath: frame.staticImagePath,
      rarity: frame.rarity,
      unlock: frame.unlock,
      owned: isOwned(frame.id),
      equipped: previewConfig.profileFrame === frame.id,
      locked: !isOwned(frame.id),
    }));
    map.set("profile_frame", frames);

    return map;
  }, [ownedItems, previewConfig, isOwned]);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(currentConfig) !== JSON.stringify(previewConfig);
  }, [currentConfig, previewConfig]);

  // Set preview item for a slot
  const setPreviewItem = useCallback(
    (slot: ExtendedCosmeticSlot, itemId: string | null) => {
      const key = getSlotKey(slot);
      setPreviewConfig((prev) => ({
        ...prev,
        [key]: itemId || undefined,
      }));
    },
    [],
  );

  // Set base color
  const setBaseColor = useCallback((color: string) => {
    setPreviewConfig((prev) => ({
      ...prev,
      baseColor: color,
    }));
  }, []);

  // Save changes
  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!uid || !hasChanges) return false;

    setSaving(true);
    setError(null);

    try {
      const db = getDb();
      const userRef = doc(db, "Users", uid);

      await updateDoc(userRef, {
        avatarConfig: previewConfig,
        lastActive: Date.now(),
      });

      // Refresh profile to get updated config
      await refreshProfile();

      console.log("[useCustomization] Saved changes successfully");
      return true;
    } catch (err) {
      console.error("[useCustomization] Save error:", err);
      setError(err as Error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [uid, hasChanges, previewConfig, refreshProfile]);

  // Discard changes
  const discardChanges = useCallback(() => {
    setPreviewConfig(currentConfig);
  }, [currentConfig]);

  // Refresh inventory
  const refreshInventory = useCallback(async () => {
    if (!uid) return;

    setLoading(true);
    try {
      const db = getDb();
      const inventoryRef = collection(db, "Users", uid, "inventory");
      const snapshot = await getDocs(inventoryRef);
      const items = snapshot.docs.map((doc) => doc.id);
      setOwnedItems(items);
    } catch (err) {
      console.error("[useCustomization] Refresh error:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  return {
    currentConfig,
    previewConfig,
    ownedItems,
    inventory,
    loading,
    error,
    hasChanges,
    saving,
    setPreviewItem,
    setBaseColor,
    saveChanges,
    discardChanges,
    isOwned,
    refreshInventory,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get default config
 */
function getDefaultConfig(): ExtendedAvatarConfig {
  return {
    baseColor: "#FFD93D",
    hat: undefined,
    glasses: undefined,
    background: undefined,
    clothingTop: undefined,
    clothingBottom: undefined,
    accessoryNeck: undefined,
    accessoryEar: undefined,
    accessoryHand: undefined,
    profileFrame: undefined,
    profileBanner: undefined,
    profileTheme: undefined,
    chatBubble: undefined,
    nameEffect: undefined,
    featuredBadges: [],
  };
}

/**
 * Map slot to config key
 */
function getSlotKey(slot: ExtendedCosmeticSlot): keyof ExtendedAvatarConfig {
  const mapping: Record<ExtendedCosmeticSlot, keyof ExtendedAvatarConfig> = {
    hat: "hat",
    glasses: "glasses",
    background: "background",
    clothing_top: "clothingTop",
    clothing_bottom: "clothingBottom",
    accessory_neck: "accessoryNeck",
    accessory_ear: "accessoryEar",
    accessory_hand: "accessoryHand",
    profile_frame: "profileFrame",
    profile_banner: "profileBanner",
    profile_theme: "profileTheme",
    chat_bubble: "chatBubble",
    name_effect: "nameEffect",
  };
  return mapping[slot] || "hat";
}

export default useCustomization;
