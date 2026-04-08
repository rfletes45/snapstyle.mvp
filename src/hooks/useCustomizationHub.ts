/**
 * useCustomizationHub Hook
 *
 * State manager for the Customization Hub screen.
 * Handles:
 *   - Active category tab
 *   - Search / filter
 *   - Preview overrides (try-on mode)
 *   - Entitlements subscription (what the user owns)
 *   - Equip / unequip actions
 *
 * NOTE: This hook is equip-only. All purchasing flows live in the Shop.
 *
 * @module hooks/useCustomizationHub
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getCosmeticById, getOwnedCosmeticsByType } from "@/cosmetics/catalog";
import type {
  CosmeticDefinition,
  CosmeticType,
  Entitlement,
} from "@/cosmetics/types";
import {
  grantFreeEntitlement,
  subscribeEntitlements,
} from "@/services/entitlements";
import { getFirestoreInstance } from "@/services/firebase";
import {
  equipChatAnimalTheme,
  equipChatBubbleColor,
  equipChatFont,
  equipChatFontColor,
  equipDecoration,
  equipTheme,
  unequipChatAnimalTheme,
  unequipChatBubbleColor,
  unequipChatFont,
  unequipChatFontColor,
  unequipDecoration,
} from "@/services/profileService";
import { doc, updateDoc } from "firebase/firestore";

import type { HeaderPreviewOverrides } from "@/components/profile/ProfileHeaderVisual";
import { createLogger } from "@/utils/log";

const logger = createLogger("hooks/useCustomizationHub");

// =============================================================================
// Types
// =============================================================================

export type CustomizationTab = CosmeticType; // "badge" | "background" | "decoration" | "theme"

export interface UseCustomizationHubOptions {
  /** Current user's UID */
  uid: string;
  /** Currently equipped decoration ID */
  currentDecorationId: string | null;
  /** Currently equipped background ID */
  currentBackgroundId: string | null;
  /** Currently equipped theme ID */
  currentThemeId: string;
  /** Currently featured badge IDs */
  currentBadgeIds: string[];
  /** Currently equipped chat bubble color ID */
  currentBubbleColorId: string | null;
  /** Currently equipped chat font ID */
  currentFontId: string | null;
  /** Currently equipped chat font color ID */
  currentFontColorId: string | null;
  /** Currently equipped animal theme ID */
  currentAnimalThemeId: string | null;
  /** Callback to set the app-wide UI theme (from ThemeContext). */
  setAppTheme?: (themeId: any) => void;
}

export interface CustomizationHubState {
  // ── Tab & Filter ──────────────────────────────────────────────────────────
  activeTab: CustomizationTab;
  setActiveTab: (tab: CustomizationTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // ── Items ─────────────────────────────────────────────────────────────────
  /** Filtered list of OWNED catalog items for the active tab. */
  filteredItems: CosmeticDefinition[];

  // ── Ownership ─────────────────────────────────────────────────────────────
  entitlements: Entitlement[];
  /** True while the first entitlements snapshot hasn't arrived yet. */
  entitlementsLoading: boolean;
  /** Quick lookup: is this cosmetic ID owned? */
  isOwned: (cosmeticId: string) => boolean;

  // ── Preview (Try-On) ──────────────────────────────────────────────────────
  previewOverrides: HeaderPreviewOverrides;
  /** Start previewing an owned cosmetic. Sets the relevant preview override. */
  previewItem: (item: CosmeticDefinition) => void;
  /** Clear all preview overrides. */
  clearPreview: () => void;
  /** Whether there is an active preview differing from equipped state. */
  hasPreview: boolean;

  // ── Actions ───────────────────────────────────────────────────────────────
  /** Equip / apply the current preview as real profile state. */
  applyPreview: () => Promise<void>;
  /** Equip a specific item (without going through preview first). */
  equipItem: (item: CosmeticDefinition) => Promise<void>;
  /** Unequip the currently equipped item in a slot. */
  unequipSlot: (type: CosmeticType) => Promise<void>;
  /** Toggle a badge in/out of the featured list. */
  toggleFeaturedBadge: (badgeId: string) => void;

  // ── Loading ───────────────────────────────────────────────────────────────
  loading: boolean;
}

// =============================================================================
// Tabs
// =============================================================================

/** Profile-section tabs (visible when section === "profile"). */
export const PROFILE_TABS: {
  id: CustomizationTab;
  label: string;
  icon: string;
}[] = [
  { id: "decoration", label: "Decorations", icon: "star-circle" },
  { id: "background", label: "Backgrounds", icon: "image" },
  { id: "badge", label: "Badges", icon: "shield-star" },
  { id: "theme", label: "Themes", icon: "palette" },
];

/** Chat-section tabs (visible when section === "chat"). */
export const CHAT_TABS: {
  id: CustomizationTab;
  label: string;
  icon: string;
}[] = [
  { id: "chat_bubble_color", label: "Bubble Colors", icon: "chat" },
  { id: "chat_font", label: "Fonts", icon: "format-font" },
  { id: "chat_font_color", label: "Font Colors", icon: "format-color-text" },
  { id: "chat_animal_theme", label: "Animals", icon: "paw" },
];

// =============================================================================
// Hook
// =============================================================================

export function useCustomizationHub(
  options: UseCustomizationHubOptions,
): CustomizationHubState {
  const {
    uid,
    currentDecorationId,
    currentBackgroundId,
    currentThemeId,
    currentBadgeIds,
    currentBubbleColorId,
    currentFontId,
    currentFontColorId,
    currentAnimalThemeId,
    setAppTheme,
  } = options;

  // ── State ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<CustomizationTab>("decoration");
  const [searchQuery, setSearchQuery] = useState("");
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);
  const [previewOverrides, setPreviewOverrides] =
    useState<HeaderPreviewOverrides>({});
  const [loading, setLoading] = useState(false);
  const [stagedBadgeIds, setStagedBadgeIds] =
    useState<string[]>(currentBadgeIds);

  // Keep staged badges in sync with currentBadgeIds when they change upstream
  const prevBadgeIdsRef = useRef(currentBadgeIds);
  useEffect(() => {
    if (
      JSON.stringify(prevBadgeIdsRef.current) !==
      JSON.stringify(currentBadgeIds)
    ) {
      setStagedBadgeIds(currentBadgeIds);
      prevBadgeIdsRef.current = currentBadgeIds;
    }
  }, [currentBadgeIds]);

  // ── Subscriptions ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    setEntitlementsLoading(true);
    const unsub = subscribeEntitlements(
      uid,
      (items) => {
        setEntitlements(items);
        setEntitlementsLoading(false);
      },
      (err) => {
        setEntitlementsLoading(false);
        logger.warn(
          "Entitlements subscription failed; ownership may be stale",
          {
            uid,
            code: (err as any)?.code,
          },
        );
      },
    );
    return unsub;
  }, [uid]);

  // ── Ownership helpers ─────────────────────────────────────────────────────
  const ownedSet = useMemo(() => {
    const set = new Set<string>();
    for (const e of entitlements) {
      set.add(e.cosmeticId);
    }
    return set;
  }, [entitlements]);

  const isOwned = useCallback(
    (cosmeticId: string) => {
      if (ownedSet.has(cosmeticId)) return true;
      // Free / starter items are always considered owned
      const def = getCosmeticById(cosmeticId);
      return def != null && (def.source === "free" || def.source === "starter");
    },
    [ownedSet],
  );

  // ── Filtered items (owned-only) ───────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let items = getOwnedCosmeticsByType(activeTab, ownedSet, {
      includeDefaults: true,
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    return [...items].sort(
      (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
    );
  }, [activeTab, searchQuery, ownedSet]);

  // ── Preview ───────────────────────────────────────────────────────────────
  const previewItem = useCallback((item: CosmeticDefinition) => {
    setPreviewOverrides((prev) => {
      switch (item.type) {
        case "decoration":
          return { ...prev, decorationId: item.id };
        case "background":
          return { ...prev, backgroundId: item.id };
        default:
          return prev;
      }
    });
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewOverrides({});
  }, []);

  const hasPreview = useMemo(() => {
    return (
      previewOverrides.decorationId !== undefined ||
      previewOverrides.backgroundId !== undefined ||
      previewOverrides.featuredBadgeIds !== undefined
    );
  }, [previewOverrides]);

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Write a background ID to the user profile doc. */
  const setEquippedBackground = useCallback(
    async (bgId: string | null) => {
      const db = getFirestoreInstance();
      const userRef = doc(db, "Users", uid);
      await updateDoc(userRef, {
        equippedBackgroundId: bgId,
        lastProfileUpdate: Date.now(),
      });
    },
    [uid],
  );

  /** Write featured badges to the user profile doc. */
  const setFeaturedBadges = useCallback(
    async (badgeIds: string[]) => {
      const db = getFirestoreInstance();
      const userRef = doc(db, "Users", uid);
      await updateDoc(userRef, {
        featuredBadges: { badgeIds, updatedAt: Date.now() },
        lastProfileUpdate: Date.now(),
      });
    },
    [uid],
  );

  const equipItem = useCallback(
    async (item: CosmeticDefinition) => {
      setLoading(true);
      try {
        // Chat cosmetics skip entitlement claim — their equip functions
        // already validate ownership (free/starter items pass directly).
        const isChatCosmetic =
          item.type === "chat_bubble_color" ||
          item.type === "chat_font" ||
          item.type === "chat_font_color" ||
          item.type === "chat_animal_theme";

        // If the item is free/starter and not yet owned, grant entitlement first
        // (except for chat cosmetics which handle this in their equip functions)
        if (
          !isChatCosmetic &&
          (item.source === "free" || item.source === "starter") &&
          !ownedSet.has(item.id)
        ) {
          const granted = await grantFreeEntitlement(uid, item.id);
          if (!granted) {
            throw new Error(`Failed to claim free item: ${item.id}`);
          }
        }

        switch (item.type) {
          case "decoration":
            await equipDecoration(uid, item.id);
            break;
          case "background":
            await setEquippedBackground(item.id);
            break;
          case "theme":
            // Update both app-wide UI theme and profile cosmetic theme
            setAppTheme?.(item.id);
            await equipTheme(uid, item.id);
            break;
          case "badge":
            // Badges use toggle logic (multi-equip up to 5)
            if (!stagedBadgeIds.includes(item.id)) {
              const next = [...stagedBadgeIds, item.id].slice(0, 5);
              setStagedBadgeIds(next);
              await setFeaturedBadges(next);
            }
            break;
          case "chat_bubble_color":
            await equipChatBubbleColor(uid, item.id);
            break;
          case "chat_font":
            await equipChatFont(uid, item.id);
            break;
          case "chat_font_color":
            await equipChatFontColor(uid, item.id);
            break;
          case "chat_animal_theme":
            await equipChatAnimalTheme(uid, item.id);
            break;
        }
        clearPreview();
      } catch (error) {
        logger.error("Error equipping item:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      uid,
      ownedSet,
      stagedBadgeIds,
      clearPreview,
      setEquippedBackground,
      setFeaturedBadges,
      setAppTheme,
    ],
  );

  const unequipSlot = useCallback(
    async (type: CosmeticType) => {
      setLoading(true);
      try {
        switch (type) {
          case "decoration":
            await unequipDecoration(uid);
            break;
          case "background":
            await setEquippedBackground(null);
            break;
          case "theme":
            setAppTheme?.("catppuccin-mocha"); // default app theme
            await equipTheme(uid, "catppuccin-mocha");
            break;
          case "badge":
            setStagedBadgeIds([]);
            await setFeaturedBadges([]);
            break;
          case "chat_bubble_color":
            await unequipChatBubbleColor(uid);
            break;
          case "chat_font":
            await unequipChatFont(uid);
            break;
          case "chat_font_color":
            await unequipChatFontColor(uid);
            break;
          case "chat_animal_theme":
            await unequipChatAnimalTheme(uid);
            break;
        }
        clearPreview();
      } catch (error) {
        logger.error("Error unequipping slot:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [uid, clearPreview, setEquippedBackground, setFeaturedBadges, setAppTheme],
  );

  const applyPreview = useCallback(async () => {
    setLoading(true);
    try {
      if (previewOverrides.decorationId !== undefined) {
        if (previewOverrides.decorationId === null) {
          await unequipDecoration(uid);
        } else {
          await equipDecoration(uid, previewOverrides.decorationId);
        }
      }
      if (previewOverrides.backgroundId !== undefined) {
        await setEquippedBackground(previewOverrides.backgroundId);
      }
      if (previewOverrides.featuredBadgeIds !== undefined) {
        await setFeaturedBadges(previewOverrides.featuredBadgeIds);
      }
      clearPreview();
    } catch (error) {
      logger.error("Error applying preview:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [
    uid,
    previewOverrides,
    clearPreview,
    setEquippedBackground,
    setFeaturedBadges,
  ]);

  const toggleFeaturedBadge = useCallback((badgeId: string) => {
    setStagedBadgeIds((prev) => {
      if (prev.includes(badgeId)) {
        return prev.filter((id) => id !== badgeId);
      }
      if (prev.length >= 5) {
        return prev; // Max 5 badges
      }
      return [...prev, badgeId];
    });
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredItems,
    entitlements,
    entitlementsLoading,
    isOwned,
    previewOverrides,
    previewItem,
    clearPreview,
    hasPreview,
    applyPreview,
    equipItem,
    unequipSlot,
    toggleFeaturedBadge,
    loading,
  };
}
