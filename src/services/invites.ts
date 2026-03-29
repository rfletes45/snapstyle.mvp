/**
 * Invite & Share Link Service
 *
 * Generates invite codes, share URLs, and manages invite events.
 * Uses custom domain links (NOT Firebase Dynamic Links).
 *
 * @module services/invites
 */

import { createLogger } from "@/utils/log";
import * as Clipboard from "expo-clipboard";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { Platform, Share } from "react-native";
import { getFirestoreInstance } from "./firebase";

const logger = createLogger("services/invites");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_DOMAIN = "https://snapstyle.app";
const INVITE_PATH = "/invite";
const PROFILE_PATH = "/u";

// ---------------------------------------------------------------------------
// Invite Code Management
// ---------------------------------------------------------------------------

/**
 * Generate a short random invite code (8 chars, alphanumeric).
 */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get or create an invite code for the current user.
 * Stored in Users/{uid}.inviteCode
 */
export async function getOrCreateInviteCode(uid: string): Promise<string> {
  const db = getFirestoreInstance();
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);

  if (snap.exists() && snap.data().inviteCode) {
    return snap.data().inviteCode as string;
  }

  // Generate unique code
  let code = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await getDocs(
      query(collection(db, "Users"), where("inviteCode", "==", code)),
    );
    if (existing.empty) break;
    code = generateCode();
    attempts++;
  }

  await setDoc(userRef, { inviteCode: code }, { merge: true });
  return code;
}

// ---------------------------------------------------------------------------
// URL Builders
// ---------------------------------------------------------------------------

export function buildInviteUrl(code: string): string {
  return `${APP_DOMAIN}${INVITE_PATH}/${code}`;
}

export function buildProfileUrl(username: string): string {
  return `${APP_DOMAIN}${PROFILE_PATH}/${username}`;
}

// ---------------------------------------------------------------------------
// Share Actions
// ---------------------------------------------------------------------------

/**
 * Share an invite link via the native share sheet.
 */
export async function shareInviteLink(
  uid: string,
  username: string,
): Promise<"shared" | "dismissed" | "error"> {
  try {
    const code = await getOrCreateInviteCode(uid);
    const url = buildInviteUrl(code);
    const message =
      Platform.OS === "ios"
        ? `Join me on SnapStyle! ${url}`
        : `Join me on SnapStyle!\n${url}`;

    const result = await Share.share(
      { message },
      { dialogTitle: "Share your invite" },
    );

    if (result.action === Share.sharedAction) {
      await logInviteEvent(uid, "share_link", { code });
      return "shared";
    }
    return "dismissed";
  } catch (err) {
    logger.error("Failed to share invite link:", err);
    return "error";
  }
}

/**
 * Copy invite link to clipboard.
 */
export async function copyInviteLink(uid: string): Promise<string> {
  const code = await getOrCreateInviteCode(uid);
  const url = buildInviteUrl(code);
  await Clipboard.setStringAsync(url);
  await logInviteEvent(uid, "copy_link", { code });
  return url;
}

/**
 * Share a profile link via native share sheet.
 */
export async function shareProfileLink(
  username: string,
): Promise<"shared" | "dismissed" | "error"> {
  try {
    const url = buildProfileUrl(username);
    const message =
      Platform.OS === "ios"
        ? `Check out my profile on SnapStyle! ${url}`
        : `Check out my profile on SnapStyle!\n${url}`;

    const result = await Share.share(
      { message },
      { dialogTitle: "Share your profile" },
    );

    return result.action === Share.sharedAction ? "shared" : "dismissed";
  } catch (err) {
    logger.error("Failed to share profile link:", err);
    return "error";
  }
}

/**
 * Share an invite message to a specific contact (via SMS-style share).
 */
export async function shareInviteToContact(
  uid: string,
  contactName: string,
): Promise<"shared" | "dismissed" | "error"> {
  try {
    const code = await getOrCreateInviteCode(uid);
    const url = buildInviteUrl(code);
    const message = `Hey ${contactName}! Join me on SnapStyle — let's play games and chat! ${url}`;

    const result = await Share.share(
      { message },
      { dialogTitle: `Invite ${contactName}` },
    );

    if (result.action === Share.sharedAction) {
      await logInviteEvent(uid, "invite_contact", { code, contactName });
      return "shared";
    }
    return "dismissed";
  } catch (err) {
    logger.error("Failed to share invite to contact:", err);
    return "error";
  }
}

// ---------------------------------------------------------------------------
// Invite Event Logging
// ---------------------------------------------------------------------------

async function logInviteEvent(
  uid: string,
  type: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    // Store under user's own subcollection to satisfy security rules
    const eventRef = doc(collection(db, "Users", uid, "inviteEvents"));
    await setDoc(eventRef, {
      type,
      metadata: metadata || {},
      createdAt: Date.now(),
    });
  } catch (err) {
    logger.error("Failed to log invite event:", err);
  }
}

// ---------------------------------------------------------------------------
// Invite Code Resolution
// ---------------------------------------------------------------------------

/**
 * Look up which user owns a given invite code.
 * @returns uid if found, null otherwise.
 */
export async function resolveInviteCode(code: string): Promise<string | null> {
  try {
    const db = getFirestoreInstance();
    const q = query(collection(db, "Users"), where("inviteCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch (err) {
    logger.error("Failed to resolve invite code:", err);
    return null;
  }
}
