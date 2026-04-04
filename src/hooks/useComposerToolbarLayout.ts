/**
 * useComposerToolbarLayout
 *
 * Central state and persistence hook for the customizable composer toolbar.
 *
 * ## Responsibilities
 * - **Persistence**: Dual-write to Firestore (`Users/{uid}/settings/composerToolbar`)
 *   and AsyncStorage (`@composer_toolbar_{uid}`). AsyncStorage provides instant
 *   boot; Firestore is authoritative and enables cross-device sync.
 * - **Real-time sync**: An `onSnapshot` listener keeps the local state in sync
 *   with remote changes. Echoes from our own writes are suppressed via a
 *   500 ms `savingRef` guard.
 * - **Edit mode**: Snapshot-based cancel/revert. `enterEditMode` captures the
 *   current layout; `cancelEdit` restores it. `saveAndExit` persists.
 * - **Item operations**: `moveItem` (drag reorder), `addItem`, `removeItem`,
 *   `setMessageBarFlex`, `resetToDefaults`.
 * - **Validation**: `validateLayout` handles unknown item IDs, duplicates,
 *   missing `message-bar`, and forward schema versions.
 *
 * ## State tiers
 * ```
 * Firestore (authoritative)
 *   → AsyncStorage (offline cache)
 *     → React state `items` (working copy)
 *       → snapshotRef (edit-mode rollback)
 * ```
 *
 * ## Key design decisions
 * - `moveItem` uses splice + index-based position reassignment instead of
 *   `normalizePositions` (which sorts by old `.position` and would undo the
 *   splice reorder).
 * - `persist` strips `undefined` values from items before writing to Firestore
 *   to avoid `FirebaseError: Unsupported field value: undefined`.
 * - `sortedItems` memo ensures the returned array is always display-ordered.
 *
 * Modeled after the WidgetBoard's useBoardState + useBoardPersistence.
 *
 * @module hooks/useComposerToolbarLayout
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getFirestoreInstance } from "@/services/firebase";
import { createLogger } from "@/utils/log";

import { getAvailableToolbarItemDefinitions } from "@/components/chat/ComposerToolbar/ComposerToolbarRegistry";
import type {
  ComposerToolbarItem,
  ComposerToolbarItemId,
  ComposerToolbarLayout,
} from "@/components/chat/ComposerToolbar/types";
import {
  DEFAULT_TOOLBAR_ITEMS,
  MAX_TOOLBAR_ITEMS,
  TOOLBAR_SCHEMA_VERSION,
} from "@/components/chat/ComposerToolbar/types";

const logger = createLogger("ComposerToolbar/layout");

// =============================================================================
// AsyncStorage Key
// =============================================================================

function getAsyncStorageKey(userId: string): string {
  return `@composer_toolbar_${userId}`;
}

// =============================================================================
// Firestore Path
// =============================================================================

function getToolbarDocRef(userId: string) {
  const db = getFirestoreInstance();
  return doc(db, "Users", userId, "settings", "composerToolbar");
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate and migrate a persisted toolbar layout.
 * Returns a safe item array or null if unrecoverable.
 */
function validateLayout(data: unknown): ComposerToolbarItem[] | null {
  if (!data || typeof data !== "object") return null;
  const layout = data as Partial<ComposerToolbarLayout>;

  if (typeof layout.schemaVersion !== "number") return null;
  if (layout.schemaVersion > TOOLBAR_SCHEMA_VERSION) {
    logger.warn("Layout from future schema version, using defaults");
    return null;
  }

  if (!Array.isArray(layout.items)) return null;

  const knownIds = new Set<string>(
    getAvailableToolbarItemDefinitions().map((d) => d.itemId),
  );

  const validItems: ComposerToolbarItem[] = [];
  const seenIds = new Set<string>();

  for (const item of layout.items) {
    if (!item || typeof item !== "object") continue;
    if (!knownIds.has(item.id)) continue;
    if (seenIds.has(item.id)) continue; // No duplicates
    seenIds.add(item.id);

    validItems.push({
      id: item.id as ComposerToolbarItemId,
      position:
        typeof item.position === "number" ? item.position : validItems.length,
      ...(typeof item.flexWeight === "number" && {
        flexWeight: item.flexWeight,
      }),
    });
  }

  // Ensure message-bar is always present
  if (!validItems.some((item) => item.id === "message-bar")) {
    validItems.splice(1, 0, { id: "message-bar", position: 1 });
  }

  // Re-normalize positions
  validItems.forEach((item, i) => {
    item.position = i;
  });

  return validItems.length > 0 ? validItems : null;
}

/**
 * Normalize positions to be sequential (0, 1, 2, ...).
 */
function normalizePositions(
  items: ComposerToolbarItem[],
): ComposerToolbarItem[] {
  return items
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({ ...item, position: index }));
}

// =============================================================================
// Hook
// =============================================================================

export interface UseComposerToolbarLayoutResult {
  /** Current toolbar items in display order. */
  items: ComposerToolbarItem[];
  /** Whether the initial load is complete. */
  loaded: boolean;
  /** Whether a save operation is in progress. */
  saving: boolean;
  /** Whether the toolbar is in edit/customize mode. */
  isEditing: boolean;
  /** Enter edit mode (snapshot current state for cancel). */
  enterEditMode: () => void;
  /** Exit edit mode and save changes. */
  saveAndExit: () => Promise<void>;
  /** Exit edit mode and revert to pre-edit snapshot. */
  cancelEdit: () => void;
  /** Move an item to a new position (during drag). */
  moveItem: (itemId: ComposerToolbarItemId, toPosition: number) => void;
  /** Add an item to the toolbar. */
  addItem: (itemId: ComposerToolbarItemId) => void;
  /** Remove an item from the toolbar. */
  removeItem: (itemId: ComposerToolbarItemId) => void;
  /** Update the message bar flex weight. */
  setMessageBarFlex: (flexWeight: number) => void;
  /** Reset to default layout. */
  resetToDefaults: () => void;
}

export function useComposerToolbarLayout(
  userId: string | undefined,
): UseComposerToolbarLayoutResult {
  const [items, setItems] = useState<ComposerToolbarItem[]>(
    DEFAULT_TOOLBAR_ITEMS,
  );
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Snapshot for cancel/revert
  const snapshotRef = useRef<ComposerToolbarItem[]>([]);

  // Firestore listener cleanup
  const unsubRef = useRef<Unsubscribe | null>(null);
  const savingRef = useRef(false);
  const echoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firestoreAvailableRef = useRef(true);

  // ── Load from AsyncStorage (instant boot) then Firestore ──────────

  const loadLayout = useCallback(async () => {
    if (!userId) return;

    // Phase 1: AsyncStorage (instant)
    try {
      const cached = await AsyncStorage.getItem(getAsyncStorageKey(userId));
      if (cached) {
        const parsed = JSON.parse(cached);
        const validated = validateLayout(parsed);
        if (validated) {
          setItems(normalizePositions(validated));
          setLoaded(true);
        }
      }
    } catch {
      logger.warn("Failed to read cached toolbar layout");
    }

    // Phase 2: Firestore (authoritative)
    try {
      const docRef = getToolbarDocRef(userId);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const validated = validateLayout(snapshot.data());
        if (validated) {
          const normalized = normalizePositions(validated);
          setItems(normalized);
          setLoaded(true);
          // Update cache
          await AsyncStorage.setItem(
            getAsyncStorageKey(userId),
            JSON.stringify({
              schemaVersion: TOOLBAR_SCHEMA_VERSION,
              items: normalized,
            }),
          ).catch(() => {});
          return;
        }
      }

      // No saved layout — use defaults and persist
      setItems(DEFAULT_TOOLBAR_ITEMS);
      setLoaded(true);

      try {
        const sanitizedDefaults = DEFAULT_TOOLBAR_ITEMS.map((item) =>
          Object.fromEntries(
            Object.entries(item).filter(([, v]) => v !== undefined),
          ),
        );
        await setDoc(docRef, {
          schemaVersion: TOOLBAR_SCHEMA_VERSION,
          items: sanitizedDefaults,
          updatedAt: new Date().toISOString(),
        });
        await AsyncStorage.setItem(
          getAsyncStorageKey(userId),
          JSON.stringify({
            schemaVersion: TOOLBAR_SCHEMA_VERSION,
            items: DEFAULT_TOOLBAR_ITEMS,
          }),
        ).catch(() => {});
      } catch {
        logger.warn("Could not persist default toolbar layout");
        firestoreAvailableRef.current = false;
      }
    } catch (err) {
      logger.error("Failed to load toolbar layout", err);
      firestoreAvailableRef.current = false;
      if (!loaded) {
        setItems(DEFAULT_TOOLBAR_ITEMS);
        setLoaded(true);
      }
    }
  }, [userId]);

  // ── Real-time listener ────────────────────────────────────────────────

  useEffect(() => {
    loadLayout();

    if (userId) {
      const docRef = getToolbarDocRef(userId);
      unsubRef.current = onSnapshot(
        docRef,
        (snapshot) => {
          if (savingRef.current) return; // Skip echo
          if (snapshot.exists()) {
            const validated = validateLayout(snapshot.data());
            if (validated) {
              setItems(normalizePositions(validated));
            }
          }
        },
        (err) => {
          logger.error("Toolbar layout listener error", err);
          firestoreAvailableRef.current = false;
        },
      );
    }

    return () => {
      unsubRef.current?.();
      if (echoTimeoutRef.current) clearTimeout(echoTimeoutRef.current);
    };
  }, [userId, loadLayout]);

  // ── Persist (dual-write) ──────────────────────────────────────────────

  const persist = useCallback(
    async (newItems: ComposerToolbarItem[]) => {
      if (!userId) return;
      const normalized = normalizePositions(newItems);
      setItems(normalized);

      // Strip undefined values from items to avoid Firestore rejection
      const sanitized = normalized.map((item) =>
        Object.fromEntries(
          Object.entries(item).filter(([, v]) => v !== undefined),
        ),
      );

      const payload = {
        schemaVersion: TOOLBAR_SCHEMA_VERSION,
        items: sanitized,
        updatedAt: new Date().toISOString(),
      };

      // AsyncStorage (always)
      await AsyncStorage.setItem(
        getAsyncStorageKey(userId),
        JSON.stringify(payload),
      ).catch(() => {});

      if (!firestoreAvailableRef.current) return;

      setSaving(true);
      savingRef.current = true;

      try {
        const docRef = getToolbarDocRef(userId);
        await setDoc(docRef, payload);
      } catch (err) {
        logger.error("Failed to save toolbar layout", err);
        firestoreAvailableRef.current = false;
      } finally {
        setSaving(false);
        if (echoTimeoutRef.current) clearTimeout(echoTimeoutRef.current);
        echoTimeoutRef.current = setTimeout(() => {
          savingRef.current = false;
          echoTimeoutRef.current = null;
        }, 500);
      }
    },
    [userId],
  );

  // ── Edit Mode ─────────────────────────────────────────────────────────

  const enterEditMode = useCallback(() => {
    snapshotRef.current = items.map((item) => ({ ...item }));
    setIsEditing(true);
  }, [items]);

  const saveAndExit = useCallback(async () => {
    setIsEditing(false);
    await persist(items);
  }, [items, persist]);

  const cancelEdit = useCallback(() => {
    setItems(snapshotRef.current);
    setIsEditing(false);
  }, []);

  // ── Item Operations ───────────────────────────────────────────────────

  const moveItem = useCallback(
    (itemId: ComposerToolbarItemId, toPosition: number) => {
      setItems((prev) => {
        const idx = prev.findIndex((item) => item.id === itemId);
        if (idx === -1) return prev;
        const clamped = Math.max(0, Math.min(toPosition, prev.length - 1));
        if (idx === clamped) return prev;

        const next = [...prev];
        const [moved] = next.splice(idx, 1);
        next.splice(clamped, 0, moved);
        // Reassign positions by array index — don't use normalizePositions
        // because its sort-by-old-.position undoes the splice reorder
        return next.map((item, i) => ({ ...item, position: i }));
      });
    },
    [],
  );

  const addItem = useCallback((itemId: ComposerToolbarItemId) => {
    setItems((prev) => {
      if (prev.length >= MAX_TOOLBAR_ITEMS) return prev;
      if (prev.some((item) => item.id === itemId)) return prev;

      const next = [...prev, { id: itemId, position: prev.length }];
      return normalizePositions(next);
    });
  }, []);

  const removeItem = useCallback((itemId: ComposerToolbarItemId) => {
    if (itemId === "message-bar") return; // Never remove message bar
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== itemId);
      return normalizePositions(next);
    });
  }, []);

  const setMessageBarFlex = useCallback((flexWeight: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === "message-bar" ? { ...item, flexWeight } : item,
      ),
    );
  }, []);

  const resetToDefaults = useCallback(() => {
    setItems([...DEFAULT_TOOLBAR_ITEMS]);
  }, []);

  // ── Memoized sorted items ─────────────────────────────────────────────

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.position - b.position),
    [items],
  );

  return {
    items: sortedItems,
    loaded,
    saving,
    isEditing,
    enterEditMode,
    saveAndExit,
    cancelEdit,
    moveItem,
    addItem,
    removeItem,
    setMessageBarFlex,
    resetToDefaults,
  };
}
