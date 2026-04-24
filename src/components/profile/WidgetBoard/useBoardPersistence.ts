/**
 * Board Persistence
 *
 * Saves and loads the widget board layout to/from Firestore.
 * Includes schema migration, validation, and fallback to defaults.
 *
 * @module components/profile/WidgetBoard/useBoardPersistence
 */

import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import { getFirestoreInstance } from "@/services/firebase";
import { createLogger } from "@/utils/log";

import { generateDefaultLayout, stableCompact } from "./BoardLayoutEngine";
import { getAllWidgetDefinitions, getWidgetDefinition } from "./WidgetRegistry";
import {
  LAYOUT_SCHEMA_VERSION,
  SIZE_PRESETS,
  type PersistedBoardLayout,
  type WidgetInstance,
  type WidgetTypeId,
} from "./types";

const logger = createLogger("WidgetBoard/persistence");

// =============================================================================
// Firestore Path
// =============================================================================

/** Firestore document path for a user's board layout. */
function getLayoutDocRef(userId: string) {
  const db = getFirestoreInstance();
  return doc(db, "Users", userId, "ProfileLayout", "board");
}

// =============================================================================
// Validation & Migration
// =============================================================================

/**
 * Validate and migrate a persisted layout.
 * Returns a safe layout or null if unrecoverable.
 */
function validateAndMigrate(data: unknown): WidgetInstance[] | null {
  if (!data || typeof data !== "object") return null;
  const layout = data as Partial<PersistedBoardLayout>;

  // Check schema version
  if (typeof layout.schemaVersion !== "number") return null;
  if (layout.schemaVersion > LAYOUT_SCHEMA_VERSION) {
    logger.warn("Layout from future schema version, using defaults");
    return null;
  }

  if (!Array.isArray(layout.widgets)) return null;

  // Build set of known widget types
  const knownTypes = new Set<string>(
    getAllWidgetDefinitions().map((d) => d.widgetType),
  );

  // Filter out unknown/deprecated widget types, validate each instance
  const validWidgets: WidgetInstance[] = [];
  for (const w of layout.widgets) {
    if (!w || typeof w !== "object") continue;
    if (!knownTypes.has(w.widgetType)) {
      logger.info(`Skipping unknown widget type: ${w.widgetType}`);
      continue;
    }
    if (
      !w.instanceId ||
      typeof w.size !== "string" ||
      !(w.size in SIZE_PRESETS)
    ) {
      continue;
    }
    validWidgets.push({
      instanceId: String(w.instanceId),
      widgetType: w.widgetType as WidgetTypeId,
      size: w.size as WidgetInstance["size"],
      x: typeof w.x === "number" ? w.x : 0,
      y: typeof w.y === "number" ? w.y : 0,
      visible: typeof w.visible === "boolean" ? w.visible : true,
      pinned: typeof w.pinned === "boolean" ? w.pinned : false,
      config: w.config && typeof w.config === "object" ? w.config : {},
      createdAt: w.createdAt || new Date().toISOString(),
      updatedAt: w.updatedAt || new Date().toISOString(),
    });
  }

  // Migrate widgets whose persisted size is no longer in supportedSizes
  for (const widget of validWidgets) {
    const def = getWidgetDefinition(widget.widgetType);
    if (def && !def.supportedSizes.includes(widget.size)) {
      logger.info(
        `Migrating ${widget.widgetType} from unsupported size "${widget.size}" to "${def.defaultSize}"`,
      );
      widget.size = def.defaultSize;
    }
  }

  // Ensure mandatory widgets exist
  const hasHeader = validWidgets.some((w) => w.widgetType === "profile-header");
  if (!hasHeader) {
    const defaults = generateDefaultLayout();
    const header = defaults.find((w) => w.widgetType === "profile-header");
    if (header) validWidgets.unshift(header);
  }

  if (validWidgets.length === 0) return null;
  return stableCompact(validWidgets);
}

// =============================================================================
// Hook
// =============================================================================

export interface UseBoardPersistenceOptions {
  /**
   * When true the hook will never write to Firestore.
   * Used when viewing another user's profile — we load their layout
   * but must never create or overwrite their document.
   */
  readOnly?: boolean;
}

export interface UseBoardPersistenceResult {
  /** Current widget instances. */
  widgets: WidgetInstance[];
  /** Whether the initial load is complete. */
  loaded: boolean;
  /** Whether a save operation is in progress. */
  saving: boolean;
  /** Save the current layout to Firestore. */
  save: (widgets: WidgetInstance[]) => Promise<void>;
  /** Force reload from Firestore. */
  reload: () => Promise<void>;
}

export function useBoardPersistence(
  userId: string | undefined,
  options?: UseBoardPersistenceOptions,
): UseBoardPersistenceResult {
  const readOnly = options?.readOnly ?? false;
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const unsubRef = useRef<Unsubscribe | null>(null);
  // Track whether the real-time listener is paused during saves
  const savingRef = useRef(false);
  // Track the echo-guard timeout so we can clear it on subsequent saves
  const echoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether Firestore is available (suppress repeated errors)
  const firestoreAvailableRef = useRef(true);
  // Track whether listener error was already logged (avoid spam)
  const listenerErrorLoggedRef = useRef(false);

  // ── Load / Subscribe ──────────────────────────────────────────────────

  const loadLayout = useCallback(async () => {
    if (!userId) return;
    try {
      const docRef = getLayoutDocRef(userId);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const validated = validateAndMigrate(snapshot.data());
        if (validated) {
          setWidgets(validated);
          setLoaded(true);
          return;
        }
      }

      // No saved layout or invalid — generate defaults
      const defaults = generateDefaultLayout();
      setWidgets(defaults);
      setLoaded(true);

      // Persist defaults (best-effort, don't block on failure)
      // Skip persistence when in readOnly mode (viewing another user's profile)
      if (!readOnly) {
        try {
          await setDoc(docRef, {
            schemaVersion: LAYOUT_SCHEMA_VERSION,
            widgets: defaults,
            updatedAt: new Date().toISOString(),
          });
        } catch {
          logger.warn("Could not persist default layout — using local only");
          firestoreAvailableRef.current = false;
        }
      }
    } catch (err) {
      logger.error("Failed to load board layout", err);
      firestoreAvailableRef.current = false;
      setWidgets(generateDefaultLayout());
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    loadLayout();

    // Real-time listener for external changes (e.g., another device)
    if (userId) {
      const docRef = getLayoutDocRef(userId);
      unsubRef.current = onSnapshot(
        docRef,
        (snapshot) => {
          if (savingRef.current) return; // skip echoed writes
          if (snapshot.exists()) {
            const validated = validateAndMigrate(snapshot.data());
            if (validated) {
              setWidgets(validated);
            }
          }
        },
        (err) => {
          if (!listenerErrorLoggedRef.current) {
            logger.error("Board layout listener error", err);
            listenerErrorLoggedRef.current = true;
          }
          firestoreAvailableRef.current = false;
        },
      );
    }

    return () => {
      unsubRef.current?.();
      if (echoTimeoutRef.current) clearTimeout(echoTimeoutRef.current);
    };
  }, [userId, loadLayout]);

  // ── Save ──────────────────────────────────────────────────────────────

  const save = useCallback(
    async (newWidgets: WidgetInstance[]) => {
      if (!userId || readOnly) return;
      // Always update local state even if Firestore is unavailable
      setWidgets(newWidgets);

      if (!firestoreAvailableRef.current) {
        // Skip remote persistence, succeed locally
        return;
      }

      setSaving(true);
      savingRef.current = true;

      try {
        const docRef = getLayoutDocRef(userId);
        await setDoc(docRef, {
          schemaVersion: LAYOUT_SCHEMA_VERSION,
          widgets: newWidgets.map((w) => ({ ...w })),
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error("Failed to save board layout", err);
        firestoreAvailableRef.current = false;
      } finally {
        setSaving(false);
        // Clear any previous echo-guard timeout before scheduling a new one
        if (echoTimeoutRef.current) clearTimeout(echoTimeoutRef.current);
        echoTimeoutRef.current = setTimeout(() => {
          savingRef.current = false;
          echoTimeoutRef.current = null;
        }, 500);
      }
    },
    [userId],
  );

  // ── Reload ────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    setLoaded(false);
    await loadLayout();
  }, [loadLayout]);

  return { widgets, loaded, saving, save, reload };
}
