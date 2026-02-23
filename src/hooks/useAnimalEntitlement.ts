/**
 * useAnimalEntitlement Hook
 *
 * Checks whether the current user can send their equipped animal theme.
 * Combines ownership (entitlement check) with equip state (chatAppearance).
 *
 * Rules:
 * - Free/starter animals (duck, turtle) are always allowed
 * - Shop animals (bear, wolf) require an entitlement doc in Firestore
 * - The animal must be equipped (chatAppearance.animalThemeId matches)
 *
 * @module hooks/useAnimalEntitlement
 */

import { hasAnimalImage } from "@/cosmetics/animalAssets";
import { getCosmeticById } from "@/cosmetics/catalog";
import type { ChatAppearance } from "@/cosmetics/types";
import { hasEntitlement } from "@/services/entitlements";
import { useEffect, useState } from "react";

interface AnimalEntitlementState {
  /** The currently equipped animal ID (null if none equipped) */
  equippedAnimalId: string | null;
  /** Whether the user can send this animal (owned + equipped + valid) */
  canSend: boolean;
  /** Whether the entitlement check is still loading */
  loading: boolean;
}

/**
 * Check if an animal theme ID is free (no entitlement required).
 * Free = source is "free" or "starter" in the catalog.
 */
export function isAnimalFree(animalId: string): boolean {
  const def = getCosmeticById(animalId);
  if (!def) return false;
  return (
    def.type === "chat_animal_theme" &&
    (def.source === "free" || def.source === "starter")
  );
}

/**
 * Hook that resolves whether the current user can send their equipped animal.
 *
 * @param uid - Current user ID (null if not authenticated)
 * @param chatAppearance - User's chat appearance settings
 * @returns Entitlement state: equippedAnimalId, canSend, loading
 */
export function useAnimalEntitlement(
  uid: string | null | undefined,
  chatAppearance: ChatAppearance | null | undefined,
): AnimalEntitlementState {
  const equippedAnimalId = chatAppearance?.animalThemeId ?? null;
  const [canSend, setCanSend] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // No user or no equipped animal → can't send
      if (!uid || !equippedAnimalId || !hasAnimalImage(equippedAnimalId)) {
        setCanSend(false);
        setLoading(false);
        return;
      }

      // Free/starter animals are always allowed
      if (isAnimalFree(equippedAnimalId)) {
        if (!cancelled) {
          setCanSend(true);
          setLoading(false);
        }
        return;
      }

      // Shop animals require entitlement check
      try {
        const owned = await hasEntitlement(uid, equippedAnimalId);
        if (!cancelled) {
          setCanSend(owned);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setCanSend(false);
          setLoading(false);
        }
      }
    }

    setLoading(true);
    check();

    return () => {
      cancelled = true;
    };
  }, [uid, equippedAnimalId]);

  return { equippedAnimalId, canSend, loading };
}
