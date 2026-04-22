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

/**
 * Canonical deep-link scheme declared in app.config.ts (`scheme: "vibe"`).
 *
 * The previous implementation used `https://snapstyle.app` as the invite
 * domain, but that domain is NOT owned by the app — opening the link led
 * recipients to a random parked/AI site instead of the app. Associated
 * Domains / Android App Links are also not configured, so an https:// URL
 * could never open the app anyway.
 *
 * We now build invite URLs using the real custom scheme. If the app is
 * installed, the OS opens Vibe directly. If it is not installed, the link
 * is inert (no hijacking by an unrelated web site).
 */
const APP_SCHEME = "vibe://";
const INVITE_HOST = "invite";
const PROFILE_HOST = "u";

// Legacy path segments recognised by the inbound URL parser so that links
// already shared before this fix still resolve correctly.
const LEGACY_HTTP_HOSTS = [
  "snapstyle.app",
  "www.snapstyle.app",
  "vibeapp.com",
  "www.vibeapp.com",
];

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
  return `${APP_SCHEME}${INVITE_HOST}/${encodeURIComponent(code)}`;
}

export function buildProfileUrl(username: string): string {
  return `${APP_SCHEME}${PROFILE_HOST}/${encodeURIComponent(username)}`;
}

// ---------------------------------------------------------------------------
// Inbound URL Parsing
// ---------------------------------------------------------------------------

export type ParsedInvite =
  | { kind: "invite"; code: string }
  | { kind: "profile"; username: string }
  | null;

/**
 * Parse an arbitrary URL (from QR scan, deep link, or clipboard) into a
 * canonical invite payload. Accepts:
 *   - vibe://invite/{code}
 *   - vibe://u/{username}
 *   - https://<legacy-host>/invite/{code}
 *   - https://<legacy-host>/u/{username}
 *   - Bare paths like "/invite/XYZ" or "/u/name" (defensive)
 *
 * Returns `null` if the URL is not a recognised invite link. The caller is
 * expected to show an appropriate error in that case.
 */
export function parseInviteUrl(raw: string | null | undefined): ParsedInvite {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try the custom scheme first.
  const schemeMatch = trimmed.match(/^vibe:\/\/([^/?#]+)\/([^/?#\s]+)/i);
  if (schemeMatch) {
    const host = schemeMatch[1].toLowerCase();
    const value = safeDecode(schemeMatch[2]);
    if (host === INVITE_HOST && value) return { kind: "invite", code: value };
    if (host === PROFILE_HOST && value)
      return { kind: "profile", username: value };
    return null;
  }

  // Accept https:// fallback for legacy hosts only (defensive — new links use
  // the custom scheme).
  const httpsMatch = trimmed.match(/^https?:\/\/([^/?#]+)(\/[^?#]*)/i);
  if (httpsMatch) {
    const host = httpsMatch[1].toLowerCase();
    if (!LEGACY_HTTP_HOSTS.includes(host)) return null;
    return matchInvitePath(httpsMatch[2]);
  }

  // Defensive: plain path.
  if (trimmed.startsWith("/")) {
    return matchInvitePath(trimmed);
  }

  return null;
}

function matchInvitePath(path: string): ParsedInvite {
  const invite = path.match(/\/invite\/([^/?#\s]+)/i);
  if (invite) {
    const code = safeDecode(invite[1]);
    return code ? { kind: "invite", code } : null;
  }
  const profile = path.match(/\/u\/([^/?#\s]+)/i);
  if (profile) {
    const username = safeDecode(profile[1]);
    return username ? { kind: "profile", username } : null;
  }
  return null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
    // Include the sender's @handle in the message so the recipient sees who
    // sent it even before tapping the link. The URL itself is the actionable
    // part — tapping it opens Vibe and triggers the add-friend confirmation.
    const senderHandle = username ? `@${username}` : "a friend";
    const message =
      Platform.OS === "ios"
        ? `${senderHandle} invited you to Vibe — tap to add them as a friend: ${url}`
        : `${senderHandle} invited you to Vibe — tap to add them as a friend:\n${url}`;

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
  uid: string,
  username: string,
): Promise<"shared" | "dismissed" | "error"> {
  try {
    // Prefer an invite code (resolves deterministically to *this* user)
    // over the profile URL (resolves by username, which can collide if a
    // username is changed). The invite code URL is the canonical share.
    const code = await getOrCreateInviteCode(uid);
    const url = buildInviteUrl(code);
    const message =
      Platform.OS === "ios"
        ? `Add me on Vibe — @${username}: ${url}`
        : `Add me on Vibe — @${username}:\n${url}`;

    const result = await Share.share(
      { message },
      { dialogTitle: "Share your code" },
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
    const message = `Hey ${contactName}! Join me on Vibe — let's play games and chat! ${url}`;

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
