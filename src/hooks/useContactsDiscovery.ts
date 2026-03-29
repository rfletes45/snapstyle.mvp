/**
 * useContactsDiscovery — Hook for contact-based friend discovery
 *
 * Manages:
 * - Permission status tracking
 * - Contact fetching & matching
 * - Sync timestamps
 * - Permission request flow (only on explicit user action)
 *
 * @module hooks/useContactsDiscovery
 */

import {
  ContactMatchResult,
  ContactPermissionStatus,
  fetchContacts,
  getContactPermissionStatus,
  getContactSyncTimestamp,
  matchContacts,
  requestContactPermission,
  saveContactSyncTimestamp,
} from "@/services/contacts";
import { useAuth } from "@/store/AuthContext";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useRef, useState } from "react";

const logger = createLogger("hooks/useContactsDiscovery");

export interface ContactsDiscoveryState {
  permissionStatus: ContactPermissionStatus;
  matchResult: ContactMatchResult | null;
  loading: boolean;
  error: string | null;
  lastSyncedAt: number | null;
  /** Request permission — only call on explicit user tap */
  requestPermission: () => Promise<ContactPermissionStatus>;
  /** Sync contacts (fetch + match) — requires permission already granted */
  syncContacts: () => Promise<void>;
  /** Reset state */
  reset: () => void;
}

export function useContactsDiscovery(): ContactsDiscoveryState {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [permissionStatus, setPermissionStatus] =
    useState<ContactPermissionStatus>("undetermined");
  const [matchResult, setMatchResult] = useState<ContactMatchResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const syncInProgress = useRef(false);

  // Check initial permission status (but do NOT request)
  useEffect(() => {
    getContactPermissionStatus().then(setPermissionStatus);
  }, []);

  // Load last sync timestamp
  useEffect(() => {
    if (uid) {
      getContactSyncTimestamp(uid).then(setLastSyncedAt);
    }
  }, [uid]);

  const requestPermission = useCallback(async () => {
    const status = await requestContactPermission();
    setPermissionStatus(status);
    return status;
  }, []);

  const syncContacts = useCallback(async () => {
    if (!uid) return;
    if (syncInProgress.current) return;

    syncInProgress.current = true;
    setLoading(true);
    setError(null);

    try {
      const contacts = await fetchContacts();

      if (contacts.length === 0) {
        setMatchResult({
          onAppUsers: [],
          inviteableContacts: [],
          alreadyFriendUids: new Set(),
          pendingRequestUids: new Set(),
        });
        return;
      }

      const result = await matchContacts(contacts, uid);
      setMatchResult(result);

      // Save sync timestamp
      await saveContactSyncTimestamp(uid);
      setLastSyncedAt(Date.now());
    } catch (err) {
      logger.error("Contact sync error:", err);
      setError("Failed to sync contacts. Please try again.");
    } finally {
      setLoading(false);
      syncInProgress.current = false;
    }
  }, [uid]);

  const reset = useCallback(() => {
    setMatchResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    permissionStatus,
    matchResult,
    loading,
    error,
    lastSyncedAt,
    requestPermission,
    syncContacts,
    reset,
  };
}
