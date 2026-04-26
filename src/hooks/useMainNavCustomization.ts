import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getDefaultMainNavItems,
  getMainNavItemDefinition,
  isMainNavItemAvailable,
  MAIN_NAV_SCHEMA_VERSION,
  MAX_MAIN_NAV_ITEMS,
  MIN_MAIN_NAV_ITEMS,
  normalizeMainNavItems,
  validateMainNavLayout,
  type MainNavItem,
  type MainNavItemId,
  type MainNavLayout,
} from "@/navigation/mainNav";
import { getFirestoreInstance } from "@/services/firebase";
import { createLogger } from "@/utils/log";

const logger = createLogger("MainNav/customization");

type LocalLayoutListener = (userId: string, items: MainNavItem[]) => void;

const localLayoutListeners = new Set<LocalLayoutListener>();

function publishLocalLayout(userId: string, items: MainNavItem[]): void {
  for (const listener of localLayoutListeners) {
    listener(userId, items);
  }
}

function getAsyncStorageKey(userId: string): string {
  return `@main_nav_${userId}`;
}

function getMainNavDocRef(userId: string) {
  const db = getFirestoreInstance();
  return doc(db, "Users", userId, "settings", "mainNavigation");
}

function createPayload(
  items: MainNavItem[],
): MainNavLayout & { updatedAt: string } {
  return {
    schemaVersion: MAIN_NAV_SCHEMA_VERSION,
    items: normalizeMainNavItems(items),
    updatedAt: new Date().toISOString(),
  };
}

export interface UseMainNavCustomizationResult {
  items: MainNavItem[];
  loaded: boolean;
  saving: boolean;
  isEditing: boolean;
  enterEditMode: () => void;
  saveAndExit: () => Promise<void>;
  cancelEdit: () => void;
  moveItem: (itemId: MainNavItemId, toPosition: number) => void;
  addItem: (itemId: MainNavItemId) => void;
  removeItem: (itemId: MainNavItemId) => void;
  resetToDefaults: () => void;
}

export function useMainNavCustomization(
  userId: string | undefined,
): UseMainNavCustomizationResult {
  const [items, setItems] = useState<MainNavItem[]>(getDefaultMainNavItems);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const snapshotRef = useRef<MainNavItem[]>([]);
  const unsubRef = useRef<Unsubscribe | null>(null);
  const savingRef = useRef(false);
  const echoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firestoreAvailableRef = useRef(true);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = null;

    if (echoTimeoutRef.current) {
      clearTimeout(echoTimeoutRef.current);
      echoTimeoutRef.current = null;
    }

    savingRef.current = false;
    firestoreAvailableRef.current = true;
    setIsEditing(false);
    setSaving(false);
    setItems(getDefaultMainNavItems());
    setLoaded(!userId);

    if (!userId) return undefined;

    let cancelled = false;
    const docRef = getMainNavDocRef(userId);
    const localLayoutListener: LocalLayoutListener = (
      updatedUserId,
      updatedItems,
    ) => {
      if (updatedUserId !== userId || cancelled) return;
      setItems(normalizeMainNavItems(updatedItems));
      setLoaded(true);
    };

    localLayoutListeners.add(localLayoutListener);

    async function loadLayout() {
      try {
        const cached = await AsyncStorage.getItem(getAsyncStorageKey(userId));
        if (!cancelled && cached) {
          const validated = validateMainNavLayout(JSON.parse(cached));
          if (validated) {
            setItems(normalizeMainNavItems(validated));
            setLoaded(true);
          }
        }
      } catch {
        logger.warn("Failed to read cached main navigation layout");
      }

      try {
        const snapshot = await getDoc(docRef);
        if (cancelled) return;

        if (snapshot.exists()) {
          const validated = validateMainNavLayout(snapshot.data());
          if (validated) {
            const normalized = normalizeMainNavItems(validated);
            setItems(normalized);
            setLoaded(true);
            await AsyncStorage.setItem(
              getAsyncStorageKey(userId),
              JSON.stringify(createPayload(normalized)),
            ).catch(() => undefined);
            return;
          }
        }

        const defaults = getDefaultMainNavItems();
        setItems(defaults);
        setLoaded(true);

        const payload = createPayload(defaults);
        await setDoc(docRef, payload).catch((error) => {
          firestoreAvailableRef.current = false;
          logger.warn(
            "Could not persist default main navigation layout",
            error,
          );
        });
        await AsyncStorage.setItem(
          getAsyncStorageKey(userId),
          JSON.stringify(payload),
        ).catch(() => undefined);
      } catch (error) {
        logger.error("Failed to load main navigation layout", error);
        firestoreAvailableRef.current = false;
        if (!cancelled) {
          setItems(getDefaultMainNavItems());
          setLoaded(true);
        }
      }
    }

    loadLayout();

    unsubRef.current = onSnapshot(
      docRef,
      (snapshot) => {
        if (cancelled || savingRef.current || !snapshot.exists()) return;
        const validated = validateMainNavLayout(snapshot.data());
        if (validated) {
          setItems(normalizeMainNavItems(validated));
          setLoaded(true);
        }
      },
      (error) => {
        logger.error("Main navigation layout listener error", error);
        firestoreAvailableRef.current = false;
      },
    );

    return () => {
      cancelled = true;
      localLayoutListeners.delete(localLayoutListener);
      unsubRef.current?.();
      unsubRef.current = null;
      if (echoTimeoutRef.current) {
        clearTimeout(echoTimeoutRef.current);
        echoTimeoutRef.current = null;
      }
    };
  }, [userId]);

  const persist = useCallback(
    async (newItems: MainNavItem[]) => {
      if (!userId) return;
      const normalized = normalizeMainNavItems(newItems);
      const payload = createPayload(normalized);
      setItems(normalized);

      await AsyncStorage.setItem(
        getAsyncStorageKey(userId),
        JSON.stringify(payload),
      ).catch(() => undefined);
      publishLocalLayout(userId, normalized);

      if (!firestoreAvailableRef.current) return;

      setSaving(true);
      savingRef.current = true;

      try {
        await setDoc(getMainNavDocRef(userId), payload);
      } catch (error) {
        logger.error("Failed to save main navigation layout", error);
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

  const enterEditMode = useCallback(() => {
    snapshotRef.current = items.map((item) => ({ ...item }));
    setIsEditing(true);
  }, [items]);

  const saveAndExit = useCallback(async () => {
    setIsEditing(false);
    await persist(items);
  }, [items, persist]);

  const cancelEdit = useCallback(() => {
    setItems(
      snapshotRef.current.length > 0
        ? snapshotRef.current
        : getDefaultMainNavItems(),
    );
    setIsEditing(false);
  }, []);

  const moveItem = useCallback((itemId: MainNavItemId, toPosition: number) => {
    const definition = getMainNavItemDefinition(itemId);
    if (!definition?.canReorder) return;

    setItems((previousItems) => {
      const currentIndex = previousItems.findIndex(
        (item) => item.id === itemId,
      );
      if (currentIndex === -1) return previousItems;

      const clampedPosition = Math.max(
        0,
        Math.min(toPosition, previousItems.length - 1),
      );
      if (currentIndex === clampedPosition) return previousItems;

      const nextItems = [...previousItems];
      const [movedItem] = nextItems.splice(currentIndex, 1);
      nextItems.splice(clampedPosition, 0, movedItem);
      return nextItems.map((item, position) => ({ ...item, position }));
    });
  }, []);

  const addItem = useCallback((itemId: MainNavItemId) => {
    const definition = getMainNavItemDefinition(itemId);
    if (!definition || !isMainNavItemAvailable(definition)) return;

    setItems((previousItems) => {
      if (previousItems.length >= MAX_MAIN_NAV_ITEMS) return previousItems;
      if (previousItems.some((item) => item.id === itemId))
        return previousItems;

      return normalizeMainNavItems([
        ...previousItems,
        { id: itemId, position: previousItems.length },
      ]);
    });
  }, []);

  const removeItem = useCallback((itemId: MainNavItemId) => {
    const definition = getMainNavItemDefinition(itemId);
    if (!definition?.canRemove) return;

    setItems((previousItems) => {
      if (previousItems.length <= MIN_MAIN_NAV_ITEMS) return previousItems;
      return normalizeMainNavItems(
        previousItems.filter((item) => item.id !== itemId),
      );
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setItems(getDefaultMainNavItems());
  }, []);

  const sortedItems = useMemo(() => normalizeMainNavItems(items), [items]);

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
    resetToDefaults,
  };
}
