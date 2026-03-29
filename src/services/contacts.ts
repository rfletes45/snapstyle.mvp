/**
 * Contacts Discovery Service
 *
 * Privacy-conscious contact sync pipeline:
 * - Only fetches contacts after explicit user permission grant
 * - Extracts minimal fields (name, phones, emails)
 * - Normalizes and deduplicates identifiers
 * - Matches against existing app users via backend
 *
 * @module services/contacts
 */

import { createLogger } from "@/utils/log";
import * as Contacts from "expo-contacts";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { Platform } from "react-native";
import { getFirestoreInstance } from "./firebase";

const logger = createLogger("services/contacts");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalizedContact {
  id: string;
  name: string;
  phones: string[];
  emails: string[];
  imageUri?: string;
}

export interface ContactMatchResult {
  /** Users already on the app that match a contact */
  onAppUsers: MatchedUser[];
  /** Contacts not on the app (can be invited) */
  inviteableContacts: InviteableContact[];
  /** UIDs already friended */
  alreadyFriendUids: Set<string>;
  /** UIDs with pending requests */
  pendingRequestUids: Set<string>;
}

export interface MatchedUser {
  uid: string;
  username: string;
  displayName: string;
  avatarConfig: any;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
  contactName: string;
  matchType: "phone" | "email";
}

export interface InviteableContact {
  contactId: string;
  name: string;
  phone?: string;
  email?: string;
  imageUri?: string;
  invited?: boolean;
}

export type ContactPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "limited";

// ---------------------------------------------------------------------------
// Permission Handling
// ---------------------------------------------------------------------------

/**
 * Check current contact permission status without requesting.
 */
export async function getContactPermissionStatus(): Promise<ContactPermissionStatus> {
  if (Platform.OS === "web") return "denied";

  const { status } = await Contacts.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  // iOS 18 limited access
  if ((status as string) === "limited") return "limited";
  return "undetermined";
}

/**
 * Request contact permission. Only call after user explicitly taps.
 */
export async function requestContactPermission(): Promise<ContactPermissionStatus> {
  if (Platform.OS === "web") return "denied";

  const { status } = await Contacts.requestPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  if ((status as string) === "limited") return "limited";
  return "denied";
}

// ---------------------------------------------------------------------------
// Contact Fetching & Normalization
// ---------------------------------------------------------------------------

/**
 * Fetch contacts with minimal fields to protect privacy.
 */
export async function fetchContacts(): Promise<NormalizedContact[]> {
  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
      Contacts.Fields.Image,
    ],
    sort: Contacts.SortTypes.FirstName,
  });

  return data
    .filter((c) => c.name) // skip unnamed
    .map((c) => ({
      id: c.id ?? `${c.name}-${Math.random()}`,
      name: c.name ?? "",
      phones: normalizePhones(c.phoneNumbers),
      emails: normalizeEmails(c.emails),
      imageUri: c.image?.uri,
    }))
    .filter((c) => c.phones.length > 0 || c.emails.length > 0); // need at least one identifier
}

/**
 * Normalize phone numbers: strip non-digits, ensure E.164-ish format.
 */
function normalizePhones(phones?: Contacts.PhoneNumber[] | null): string[] {
  if (!phones) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const p of phones) {
    if (!p.number) continue;
    let num = p.number.replace(/[^\d+]/g, "");
    // If no country code, assume US (+1)
    if (!num.startsWith("+")) {
      if (num.length === 10) num = "+1" + num;
      else if (num.length === 11 && num.startsWith("1")) num = "+" + num;
      else continue; // skip ambiguous
    }
    if (!seen.has(num)) {
      seen.add(num);
      result.push(num);
    }
  }
  return result;
}

/**
 * Normalize emails: lowercase, trim.
 */
function normalizeEmails(emails?: Contacts.Email[] | null): string[] {
  if (!emails) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const e of emails) {
    if (!e.email) continue;
    const normalized = e.email.trim().toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Matching Pipeline (Client-side Firestore queries)
// ---------------------------------------------------------------------------

/**
 * Match normalized contacts against app users.
 *
 * For MVP this runs client-side Firestore queries in batches.
 * For scale, migrate to a Cloud Function endpoint.
 */
export async function matchContacts(
  contacts: NormalizedContact[],
  currentUid: string,
): Promise<ContactMatchResult> {
  const db = getFirestoreInstance();
  const matchedUsers: MatchedUser[] = [];
  const matchedUids = new Set<string>();
  const inviteable: InviteableContact[] = [];

  // Collect all unique phones and emails
  const allPhones = new Set<string>();
  const allEmails = new Set<string>();
  const phonesToContact = new Map<string, NormalizedContact>();
  const emailsToContact = new Map<string, NormalizedContact>();

  for (const c of contacts) {
    for (const p of c.phones) {
      allPhones.add(p);
      phonesToContact.set(p, c);
    }
    for (const e of c.emails) {
      allEmails.add(e);
      emailsToContact.set(e, c);
    }
  }

  // Query users by phone (batch of 10 for Firestore `in` limit)
  const phoneArray = Array.from(allPhones);
  for (let i = 0; i < phoneArray.length; i += 10) {
    const batch = phoneArray.slice(i, i + 10);
    try {
      const q = query(collection(db, "Users"), where("phone", "in", batch));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data();
        if (d.id === currentUid) return;
        // Check discoverability
        if (data.discoverability?.phone === false) return;

        const contact = phonesToContact.get(data.phone);
        if (!matchedUids.has(d.id)) {
          matchedUids.add(d.id);
          matchedUsers.push({
            uid: d.id,
            username: data.username,
            displayName: data.displayName,
            avatarConfig: data.avatarConfig,
            profilePictureUrl: data.profilePicture?.url ?? null,
            decorationId: data.avatarDecoration?.decorationId ?? null,
            contactName: contact?.name ?? data.displayName,
            matchType: "phone",
          });
        }
      });
    } catch (err) {
      logger.error("Phone batch query error:", err);
    }
  }

  // Query users by email (batch of 10)
  const emailArray = Array.from(allEmails);
  for (let i = 0; i < emailArray.length; i += 10) {
    const batch = emailArray.slice(i, i + 10);
    try {
      const q = query(collection(db, "Users"), where("email", "in", batch));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data();
        if (d.id === currentUid) return;
        if (data.discoverability?.email === false) return;

        const contact = emailsToContact.get(data.email);
        if (!matchedUids.has(d.id)) {
          matchedUids.add(d.id);
          matchedUsers.push({
            uid: d.id,
            username: data.username,
            displayName: data.displayName,
            avatarConfig: data.avatarConfig,
            profilePictureUrl: data.profilePicture?.url ?? null,
            decorationId: data.avatarDecoration?.decorationId ?? null,
            contactName: contact?.name ?? data.displayName,
            matchType: "email",
          });
        }
      });
    } catch (err) {
      logger.error("Email batch query error:", err);
    }
  }

  // Build inviteable list (contacts NOT matched to any user)
  // Collect all phones/emails that led to a matched user
  const matchedPhones = new Set<string>();
  const matchedEmails = new Set<string>();
  for (const m of matchedUsers) {
    // Find which contact identifier led to this match
    for (const [phone, contact] of phonesToContact) {
      if (matchedUids.has(m.uid)) matchedPhones.add(phone);
    }
    for (const [email, contact] of emailsToContact) {
      if (matchedUids.has(m.uid)) matchedEmails.add(email);
    }
  }

  for (const c of contacts) {
    const hasPhoneMatch = c.phones.some((p) => matchedPhones.has(p));
    const hasEmailMatch = c.emails.some((e) => matchedEmails.has(e));

    if (!hasPhoneMatch && !hasEmailMatch) {
      inviteable.push({
        contactId: c.id,
        name: c.name,
        phone: c.phones[0],
        email: c.emails[0],
        imageUri: c.imageUri,
      });
    }
  }

  // Get current friends to identify "already friends"
  const friendsQ = query(
    collection(db, "Friends"),
    where("users", "array-contains", currentUid),
  );
  const friendsSnap = await getDocs(friendsQ);
  const friendUids = new Set<string>();
  friendsSnap.forEach((d) => {
    const users = d.data().users as string[];
    const other = users.find((u) => u !== currentUid);
    if (other) friendUids.add(other);
  });

  // Get pending requests
  const sentQ = query(
    collection(db, "FriendRequests"),
    where("from", "==", currentUid),
    where("status", "==", "pending"),
  );
  const recvQ = query(
    collection(db, "FriendRequests"),
    where("to", "==", currentUid),
    where("status", "==", "pending"),
  );
  const [sentSnap, recvSnap] = await Promise.all([
    getDocs(sentQ),
    getDocs(recvQ),
  ]);
  const pendingUids = new Set<string>();
  sentSnap.forEach((d) => pendingUids.add(d.data().to as string));
  recvSnap.forEach((d) => pendingUids.add(d.data().from as string));

  return {
    onAppUsers: matchedUsers,
    inviteableContacts: inviteable,
    alreadyFriendUids: friendUids,
    pendingRequestUids: pendingUids,
  };
}

// ---------------------------------------------------------------------------
// Sync Metadata
// ---------------------------------------------------------------------------

/**
 * Save last-synced timestamp for contacts.
 */
export async function saveContactSyncTimestamp(uid: string): Promise<void> {
  const db = getFirestoreInstance();
  await setDoc(
    doc(db, "Users", uid),
    { contactsLastSyncedAt: Date.now() },
    { merge: true },
  );
}

/**
 * Get last-synced timestamp.
 */
export async function getContactSyncTimestamp(
  uid: string,
): Promise<number | null> {
  const db = getFirestoreInstance();
  const snap = await getDoc(doc(db, "Users", uid));
  return snap.data()?.contactsLastSyncedAt ?? null;
}

// ---------------------------------------------------------------------------
// Quick Add: Lookup by Phone or Email
// ---------------------------------------------------------------------------

/**
 * Look up a single user by phone number.
 */
export async function lookupUserByPhone(
  phone: string,
  currentUid: string,
): Promise<MatchedUser | null> {
  const db = getFirestoreInstance();
  let normalized = phone.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+")) {
    if (normalized.length === 10) normalized = "+1" + normalized;
    else if (normalized.length === 11 && normalized.startsWith("1"))
      normalized = "+" + normalized;
  }

  const q = query(collection(db, "Users"), where("phone", "==", normalized));
  const snap = await getDocs(q);

  if (snap.empty) return null;
  const d = snap.docs[0];
  if (d.id === currentUid) return null;
  const data = d.data();
  if (data.discoverability?.phone === false) return null;

  return {
    uid: d.id,
    username: data.username,
    displayName: data.displayName,
    avatarConfig: data.avatarConfig,
    profilePictureUrl: data.profilePicture?.url ?? null,
    decorationId: data.avatarDecoration?.decorationId ?? null,
    contactName: data.displayName,
    matchType: "phone",
  };
}

/**
 * Look up a single user by email.
 */
export async function lookupUserByEmail(
  email: string,
  currentUid: string,
): Promise<MatchedUser | null> {
  const db = getFirestoreInstance();
  const normalized = email.trim().toLowerCase();

  const q = query(collection(db, "Users"), where("email", "==", normalized));
  const snap = await getDocs(q);

  if (snap.empty) return null;
  const d = snap.docs[0];
  if (d.id === currentUid) return null;
  const data = d.data();
  if (data.discoverability?.email === false) return null;

  return {
    uid: d.id,
    username: data.username,
    displayName: data.displayName,
    avatarConfig: data.avatarConfig,
    profilePictureUrl: data.profilePicture?.url ?? null,
    decorationId: data.avatarDecoration?.decorationId ?? null,
    contactName: data.displayName,
    matchType: "email",
  };
}
