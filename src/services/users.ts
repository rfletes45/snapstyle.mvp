import { Latte } from "@/constants/theme";
import { User } from "@/types/models";
import {
  collection,
  doc,
  limit as firestoreLimit,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/users");
/**
 * Check if a username is available (not reserved)
 * @param username Username to check
 * @returns true if available, false if taken
 */
export async function checkUsernameAvailable(
  username: string,
): Promise<boolean> {
  const db = getFirestoreInstance();
  const usernamesRef = collection(db, "Usernames");

  try {
    const q = query(
      usernamesRef,
      where("username", "==", username.toLowerCase()),
    );
    const snapshot = await getDocs(q);
    return snapshot.empty; // true if no documents found (available)
  } catch (error) {
    logger.error("Error checking username availability:", error);
    return false; // Assume unavailable if error occurs
  }
}

/**
 * Reserve a username atomically
 * Creates both a Username document and updates the User document in one batch
 * @param username Username to reserve
 * @param uid User ID
 * @returns true if successful, false if username was taken
 */
async function reserveUsername(
  username: string,
  uid: string,
): Promise<boolean> {
  const db = getFirestoreInstance();
  const batch = writeBatch(db);

  const normalizedUsername = username.toLowerCase();

  try {
    // Check if username is available
    const available = await checkUsernameAvailable(normalizedUsername);
    if (!available) {
      return false;
    }

    // Create username document (for uniqueness constraint)
    const usernameDocRef = doc(db, "Usernames", normalizedUsername);
    batch.set(usernameDocRef, {
      username: normalizedUsername,
      uid,
      reservedAt: new Date(),
    });

    // Update user document with username
    const userDocRef = doc(db, "Users", uid);
    batch.update(userDocRef, {
      username: normalizedUsername,
      usernameReservedAt: new Date(),
    });

    // Commit the batch
    await batch.commit();
    return true;
  } catch (error) {
    logger.error("Error reserving username:", error);
    return false;
  }
}

/**
 * Get a user's profile from Firestore
 * @param uid User ID
 * @returns User profile or null if not found
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, "Users", uid);

  try {
    const snapshot = await getDoc(userDocRef);
    if (snapshot.exists()) {
      return snapshot.data() as User;
    }
    return null;
  } catch (error) {
    logger.error("Error fetching user profile:", error);
    return null;
  }
}

/**
 * Create a new user profile in Firestore
 * Note: After calling this, call grantStarterItems(uid) from cosmetics service
 * to give the user their starter items
 * @param uid User ID
 * @param username Username
 * @param displayName Display name
 * @param baseColor Avatar base color (optional)
 * @returns The created user object
 */
async function createUserProfile(
  uid: string,
  username: string,
  displayName: string,
  baseColor?: string,
): Promise<User> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, "Users", uid);

  const now = Date.now();
  const user: User = {
    uid,
    username,
    usernameLower: username.toLowerCase(),
    displayName,
    avatarConfig: {
      baseColor: baseColor || Latte.lavender,
    },
    createdAt: now,
    lastActive: now,
  };

  try {
    await setDoc(userDocRef, user);
    return user;
  } catch (error) {
    logger.error("Error creating user profile:", error);
    throw error;
  }
}

/**
 * Update a user's profile
 * @param uid User ID
 * @param updates Partial user object with fields to update
 * @returns true if successful
 */
export async function updateProfile(
  uid: string,
  updates: Partial<User>,
): Promise<boolean> {
  const db = getFirestoreInstance();
  const userDocRef = doc(db, "Users", uid);

  try {
    await updateDoc(userDocRef, {
      ...updates,
      updatedAt: new Date(),
    });
    return true;
  } catch (error) {
    logger.error("Error updating user profile:", error);
    return false;
  }
}

/**
 * Create a new user and set up their profile
 * Call this after Firebase signUp() succeeds
 * @param uid User ID
 * @param email User email
 * @param username Username
 * @param displayName Display name
 * @param baseColor Avatar base color (optional)
 * @returns The created user object
 */
export async function setupNewUser(
  uid: string,
  email: string,
  username: string,
  displayName: string,
  baseColor?: string,
): Promise<User | null> {
  try {
    // First check if username is available
    const available = await checkUsernameAvailable(username);
    if (!available) {
      throw new Error("Username already taken");
    }

    // Create user profile first
    const user = await createUserProfile(uid, username, displayName, baseColor);

    // Then reserve the username (separate operation)
    const reserved = await reserveUsername(username, uid);
    if (!reserved) {
      throw new Error("Failed to reserve username");
    }

    // Grant starter cosmetic items (lazy import to avoid circular dependency)
    try {
      const { grantStarterItems } = await import("./cosmetics");
      await grantStarterItems(uid);
    } catch (cosmeticError) {
      logger.warn("Failed to grant starter items:", cosmeticError);
      // Don't fail user creation if cosmetics fail
    }

    return user;
  } catch (error) {
    logger.error("Error setting up new user:", error);
    throw error;
  }
}

// =============================================================================
// User search result type
// =============================================================================

export interface UserSearchResult {
  uid: string;
  username: string;
  displayName: string;
  avatarConfig: User["avatarConfig"];
  profilePictureUrl?: string | null;
  decorationId?: string | null;
}

/**
 * Search for users by username or display name prefix.
 *
 * Ranking (applied client-side after Firestore fetch):
 *  1. exact username match
 *  2. username startsWith
 *  3. displayName startsWith
 *  4. username contains
 *  5. displayName contains
 *
 * @param queryText  Text the user typed (min 1 char after trim)
 * @param currentUid UID of the signed-in user (excluded from results)
 * @param maxResults Cap returned results (default 20)
 * @returns Ranked array of UserSearchResult
 */
export async function searchUsers(
  queryText: string,
  currentUid: string,
  maxResults = 20,
): Promise<UserSearchResult[]> {
  const trimmed = queryText.trim().toLowerCase();
  if (trimmed.length === 0) return [];

  const db = getFirestoreInstance();
  const usersRef = collection(db, "Users");

  // Firestore prefix range for usernameLower
  const prefixEnd = trimmed + "\uf8ff";

  try {
    // 1) Prefix query on usernameLower (cheap, indexed)
    const prefixQ = query(
      usersRef,
      where("usernameLower", ">=", trimmed),
      where("usernameLower", "<=", prefixEnd),
      firestoreLimit(50),
    );

    const prefixSnap = await getDocs(prefixQ);
    const seen = new Set<string>();
    const rawResults: Array<{
      uid: string;
      username: string;
      usernameLower: string;
      displayName: string;
      displayNameLower: string;
      avatarConfig: User["avatarConfig"];
      profilePictureUrl?: string | null;
      decorationId?: string | null;
    }> = [];

    const addDoc = (docSnap: any) => {
      const d = docSnap.data();
      const uid = docSnap.id;
      if (uid === currentUid || seen.has(uid)) return;
      seen.add(uid);
      rawResults.push({
        uid,
        username: d.username ?? "",
        usernameLower: (d.usernameLower ?? d.username ?? "").toLowerCase(),
        displayName: d.displayName ?? "",
        displayNameLower: (d.displayName ?? "").toLowerCase(),
        avatarConfig: d.avatarConfig ?? { baseColor: "#ccc" },
        profilePictureUrl: d.profilePicture?.url ?? null,
        decorationId: d.avatarDecoration?.decorationId ?? null,
      });
    };

    prefixSnap.forEach(addDoc);

    // 2) Rank results
    const scored = rawResults.map((r) => {
      let score = 5; // default: displayName contains fallback
      if (r.usernameLower === trimmed) {
        score = 1; // exact
      } else if (r.usernameLower.startsWith(trimmed)) {
        score = 2; // username startsWith
      } else if (r.displayNameLower.startsWith(trimmed)) {
        score = 3; // displayName startsWith
      } else if (r.usernameLower.includes(trimmed)) {
        score = 4; // username contains
      } else if (r.displayNameLower.includes(trimmed)) {
        score = 5; // displayName contains
      }
      return { ...r, score };
    });

    // Filter out results that don't match at all on username or displayName
    const filtered = scored.filter(
      (r) =>
        r.usernameLower.includes(trimmed) ||
        r.displayNameLower.includes(trimmed),
    );

    // Sort by score then alphabetical
    filtered.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.usernameLower.localeCompare(b.usernameLower);
    });

    return filtered.slice(0, maxResults).map((r) => ({
      uid: r.uid,
      username: r.username,
      displayName: r.displayName,
      avatarConfig: r.avatarConfig,
      profilePictureUrl: r.profilePictureUrl,
      decorationId: r.decorationId,
    }));
  } catch (error) {
    logger.error("Error searching users:", error);
    return [];
  }
}
