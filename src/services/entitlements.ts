/**
 * Entitlements Service
 *
 * Unified ownership model for all cosmetic items.
 * Canonical Firestore path: Users/{uid}/Entitlements/{cosmeticId}
 *
 * This service provides:
 *   - Real-time subscription to a user's entitlements
 *   - Ownership checks
 *   - Filtered queries by cosmetic type
 *   - Back-compat shim for legacy ownedDecorations/OwnedDecorations writes
 *
 * Server-authoritative: purchases and achievement grants should use
 * Cloud Functions. This client service is read-heavy with limited
 * client-side grant support for free items.
 *
 * @module services/entitlements
 */

import { getCosmeticById } from "@/cosmetics/catalog";
import type {
  CosmeticType,
  Entitlement,
  EntitlementDoc,
} from "@/cosmetics/types";
import { createLogger } from "@/utils/log";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

const logger = createLogger("services/entitlements");

// =============================================================================
// Paths
// =============================================================================

function entitlementsCol(uid: string) {
  return collection(getFirestoreInstance(), "Users", uid, "Entitlements");
}

function entitlementDoc(uid: string, cosmeticId: string) {
  return doc(getFirestoreInstance(), "Users", uid, "Entitlements", cosmeticId);
}

// =============================================================================
// Read / Subscribe
// =============================================================================

/**
 * Subscribe to real-time entitlement updates for a user.
 * Returns an unsubscribe function.
 *
 * On permission or network errors the callback still receives the last
 * known list (empty on first load) so callers aren't tricked into
 * thinking the user "owns nothing".  The optional `onError` callback
 * lets the UI surface the error if it wants to.
 */
export function subscribeEntitlements(
  uid: string,
  callback: (entitlements: Entitlement[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const ref = entitlementsCol(uid);
  let lastKnown: Entitlement[] | null = null;

  return onSnapshot(
    ref,
    (snapshot) => {
      const items: Entitlement[] = snapshot.docs.map((d) => {
        const data = d.data() as EntitlementDoc;
        return {
          cosmeticId: data.cosmeticId,
          type: data.type,
          grantedAt: data.grantedAt,
          source: data.source,
        };
      });
      lastKnown = items;
      callback(items);
    },
    (error) => {
      logger.error("Entitlements subscription error:", {
        uid,
        path: `Users/${uid}/Entitlements`,
        code: (error as any)?.code,
        message: error.message,
      });
      // Do NOT reset to [] — keep whatever the caller already had.
      // On first load lastKnown is null, so we emit [] once.
      if (lastKnown === null) {
        callback([]);
      }
      onError?.(error);
    },
  );
}

/**
 * Get all entitlements for a user (one-shot read).
 */
export async function getEntitlements(uid: string): Promise<Entitlement[]> {
  try {
    const snap = await getDocs(entitlementsCol(uid));
    return snap.docs.map((d) => {
      const data = d.data() as EntitlementDoc;
      return {
        cosmeticId: data.cosmeticId,
        type: data.type,
        grantedAt: data.grantedAt,
        source: data.source,
      };
    });
  } catch (error) {
    logger.error("Error reading entitlements:", error);
    return [];
  }
}

/**
 * Check if a user owns a specific cosmetic.
 */
export async function hasEntitlement(
  uid: string,
  cosmeticId: string,
): Promise<boolean> {
  try {
    const snap = await getDoc(entitlementDoc(uid, cosmeticId));
    return snap.exists();
  } catch (error) {
    logger.error("Error checking entitlement:", error);
    return false;
  }
}

/**
 * List entitlements filtered by cosmetic type.
 */
export async function listEntitlementsByType(
  uid: string,
  type: CosmeticType,
): Promise<Entitlement[]> {
  try {
    const q = query(entitlementsCol(uid), where("type", "==", type));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as EntitlementDoc;
      return {
        cosmeticId: data.cosmeticId,
        type: data.type,
        grantedAt: data.grantedAt,
        source: data.source,
      };
    });
  } catch (error) {
    logger.error(`Error listing entitlements for type ${type}:`, error);
    return [];
  }
}

// =============================================================================
// Client-side grant (free items only)
// =============================================================================

/**
 * Grant a free/starter cosmetic to a user from the client.
 * Only works for items with source "free" or "starter" in the catalog.
 * Purchase and achievement grants MUST go through Cloud Functions.
 *
 * Also writes back-compat data for decorations (legacy ownedDecorations).
 */
export async function grantFreeEntitlement(
  uid: string,
  cosmeticId: string,
): Promise<boolean> {
  const def = getCosmeticById(cosmeticId);
  if (!def) {
    logger.error("Cannot grant: cosmetic not in catalog", cosmeticId);
    return false;
  }
  if (def.source !== "free" && def.source !== "starter") {
    logger.error("Cannot client-grant non-free cosmetic", cosmeticId);
    return false;
  }

  try {
    const already = await hasEntitlement(uid, cosmeticId);
    if (already) return true;

    const entDoc: EntitlementDoc = {
      cosmeticId,
      type: def.type,
      grantedAt: Date.now(),
      source: def.source,
    };
    await setDoc(entitlementDoc(uid, cosmeticId), entDoc);

    // Back-compat: if this is a decoration, also update legacy paths
    // TODO: Remove after Prompt 2/3 cutover
    if (def.type === "decoration") {
      await writeLegacyDecorationOwnership(uid, cosmeticId);
    }

    // Back-compat: if this is a theme, also update legacy ownedThemes array
    // TODO: Remove after Prompt 2/3 cutover
    if (def.type === "theme") {
      await writeLegacyThemeOwnership(uid, cosmeticId);
    }

    logger.info("Granted free entitlement:", cosmeticId);
    return true;
  } catch (error) {
    logger.error("Error granting free entitlement:", error);
    return false;
  }
}

// =============================================================================
// Back-compat shims (legacy ownership)
// TODO: Remove these after full cutover to Entitlements in Prompt 2/3
// =============================================================================

/**
 * Write decoration ownership to legacy paths:
 * - Users/{uid}.ownedDecorations array (arrayUnion)
 * - Users/{uid}/OwnedDecorations/{decorationId} subcollection doc
 */
async function writeLegacyDecorationOwnership(
  uid: string,
  decorationId: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", uid);

    // Update ownedDecorations array on user doc
    await updateDoc(userRef, {
      ownedDecorations: arrayUnion(decorationId),
    });

    // Write OwnedDecorations subcollection doc
    const ownedDecRef = doc(db, "Users", uid, "OwnedDecorations", decorationId);
    await setDoc(
      ownedDecRef,
      {
        decorationId,
        obtainedAt: Date.now(),
        obtainedVia: "free",
      },
      { merge: true },
    );
  } catch (error) {
    // Non-fatal: entitlement is the source of truth
    logger.warn("Failed to write legacy decoration ownership:", error);
  }
}

/**
 * Write theme ownership to legacy ownedThemes array on the user doc.
 * Also writes OwnedThemes subcollection doc for back-compat.
 * TODO: Remove after Prompt 2/3 cutover
 */
async function writeLegacyThemeOwnership(
  uid: string,
  themeId: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", uid);

    // Update ownedThemes array on user doc
    await updateDoc(userRef, {
      ownedThemes: arrayUnion(themeId),
    });

    // Write OwnedThemes subcollection doc
    const ownedThemeRef = doc(db, "Users", uid, "OwnedThemes", themeId);
    await setDoc(
      ownedThemeRef,
      {
        themeId,
        obtainedAt: Date.now(),
        obtainedVia: "free",
      },
      { merge: true },
    );
  } catch (error) {
    // Non-fatal: entitlement is the source of truth
    logger.warn("Failed to write legacy theme ownership:", error);
  }
}

/**
 * Write decoration ownership to legacy inventory path (Users/{uid}/inventory).
 * Used by the server-side purchase flow shim.
 * TODO: Remove after Prompt 2/3 cutover
 */
export async function writeLegacyInventoryItem(
  uid: string,
  cosmeticId: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const inventoryRef = doc(db, "Users", uid, "inventory", cosmeticId);
    await setDoc(
      inventoryRef,
      {
        itemId: cosmeticId,
        acquiredAt: Date.now(),
      },
      { merge: true },
    );
  } catch (error) {
    logger.warn("Failed to write legacy inventory item:", error);
  }
}
