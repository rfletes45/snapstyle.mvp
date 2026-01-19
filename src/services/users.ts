import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { User } from "@/types/models";

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
    const q = query(usernamesRef, where("username", "==", username.toLowerCase()));
    const snapshot = await getDocs(q);
    return snapshot.empty; // true if no documents found (available)
  } catch (error) {
    console.error("Error checking username availability:", error);
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
export async function reserveUsername(
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
    const usernameDocRef = doc(
      db,
      "Usernames",
      normalizedUsername,
    );
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
    console.error("Error reserving username:", error);
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
    console.error("Error fetching user profile:", error);
    return null;
  }
}

/**
 * Create a new user profile in Firestore
 * @param uid User ID
 * @param username Username
 * @param displayName Display name
 * @param baseColor Avatar base color (optional)
 * @returns The created user object
 */
export async function createUserProfile(
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
      baseColor: baseColor || "#FFFC00",
    },
    createdAt: now,
    lastActive: now,
    expoPushToken: undefined,
  };

  try {
    await setDoc(userDocRef, user);
    return user;
  } catch (error) {
    console.error("Error creating user profile:", error);
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
    console.error("Error updating user profile:", error);
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

    // Create user profile
    const user = await createUserProfile(uid, username, displayName, baseColor);

    // Reserve the username
    const reserved = await reserveUsername(username, uid);
    if (!reserved) {
      throw new Error("Failed to reserve username");
    }

    return user;
  } catch (error) {
    console.error("Error setting up new user:", error);
    return null;
  }
}
