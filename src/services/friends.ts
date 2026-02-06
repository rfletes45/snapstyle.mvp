import { Friend, FriendRequest } from "@/types/models";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { isUserBlocked } from "./blocking";
import { getFirestoreInstance } from "./firebase";
import { getUserProfile } from "./users";

/**
 * Send a friend request by searching for user by username
 * @param fromUid User ID sending request
 * @param toUsername Username of user to add
 * @returns true if request sent successfully
 */
export async function sendFriendRequest(
  fromUid: string,
  toUsername: string,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    // Find user by username
    const usersRef = collection(db, "Users");
    const q = query(
      usersRef,
      where("usernameLower", "==", toUsername.toLowerCase()),
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error("User not found");
    }

    const toUid = snapshot.docs[0].id;

    // Can't add yourself
    if (fromUid === toUid) {
      throw new Error("You cannot add yourself as a friend");
    }

    // Check if you have blocked them
    // Note: We don't check if they blocked you (privacy reasons)
    // If they have blocked you, they simply won't see the request
    const youBlockedThem = await isUserBlocked(fromUid, toUid);

    if (youBlockedThem) {
      throw new Error(
        "You have blocked this user. Unblock them first to send a friend request.",
      );
    }

    // Check if already friends
    const friendsRef = collection(db, "Friends");
    const friendsQuery = query(
      friendsRef,
      where("users", "array-contains", fromUid),
    );
    const friendsSnapshot = await getDocs(friendsQuery);

    const alreadyFriends = friendsSnapshot.docs.some((doc) => {
      const friend = doc.data() as Friend;
      return friend.users.includes(toUid);
    });

    if (alreadyFriends) {
      throw new Error("Already friends with this user");
    }

    // Check if request already exists
    const requestsRef = collection(db, "FriendRequests");
    const existingQuery = query(
      requestsRef,
      where("from", "==", fromUid),
      where("to", "==", toUid),
      where("status", "==", "pending"),
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      throw new Error("Friend request already sent");
    }

    // Create friend request
    const requestId = doc(collection(db, "FriendRequests")).id;
    const requestDocRef = doc(db, "FriendRequests", requestId);

    await setDoc(requestDocRef, {
      from: fromUid,
      to: toUid,
      status: "pending",
      createdAt: Date.now(),
      respondedAt: null,
    });

    return true;
  } catch (error) {
    console.error("Error sending friend request:", error);
    throw error;
  }
}

/**
 * Get all pending friend requests (both sent and received)
 * Filters out requests from/to blocked users
 * @param uid User ID
 * @returns Array of pending requests
 */
export async function getPendingRequests(
  uid: string,
): Promise<FriendRequest[]> {
  const db = getFirestoreInstance();

  try {
    const requestsRef = collection(db, "FriendRequests");

    // Get requests TO the user
    const toQuery = query(
      requestsRef,
      where("to", "==", uid),
      where("status", "==", "pending"),
    );

    // Get requests FROM the user
    const fromQuery = query(
      requestsRef,
      where("from", "==", uid),
      where("status", "==", "pending"),
    );

    // Get blocked users
    const blockedUsersRef = collection(db, "Users", uid, "blockedUsers");
    const blockedSnapshot = await getDocs(blockedUsersRef);
    const blockedUserIds = new Set(blockedSnapshot.docs.map((doc) => doc.id));

    const [toSnapshot, fromSnapshot] = await Promise.all([
      getDocs(toQuery),
      getDocs(fromQuery),
    ]);

    const requests: FriendRequest[] = [];

    // Filter out requests from blocked users
    toSnapshot.forEach((doc) => {
      const request = {
        id: doc.id,
        ...doc.data(),
      } as FriendRequest;

      // Only include if sender is not blocked
      if (!blockedUserIds.has(request.from)) {
        requests.push(request);
      }
    });

    // Filter out requests to blocked users (user shouldn't see their own sent requests to blocked users)
    fromSnapshot.forEach((doc) => {
      const request = {
        id: doc.id,
        ...doc.data(),
      } as FriendRequest;

      // Only include if recipient is not blocked
      if (!blockedUserIds.has(request.to)) {
        requests.push(request);
      }
    });

    // Sort by creation date (newest first) in memory
    requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return requests;
  } catch (error) {
    console.error("Error getting pending requests:", error);
    return [];
  }
}

/**
 * Accept a friend request and create friendship
 * @param requestId Friend request ID
 * @returns true if successful
 */
export async function acceptFriendRequest(requestId: string): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const requestDocRef = doc(db, "FriendRequests", requestId);
    const requestSnapshot = await getDoc(requestDocRef);

    if (!requestSnapshot.exists()) {
      throw new Error("Request not found");
    }

    const request = requestSnapshot.data() as FriendRequest;

    if (request.status !== "pending") {
      throw new Error("Request is not pending");
    }

    const batch = writeBatch(db);

    // Create friendship document
    const friendshipId = doc(collection(db, "Friends")).id;
    const friendshipDocRef = doc(db, "Friends", friendshipId);

    batch.set(friendshipDocRef, {
      users: [request.from, request.to],
      createdAt: Date.now(),
      streakCount: 0,
      streakUpdatedDay: "", // Empty - will be set when first streak is achieved
      lastSentDay_uid1: "",
      lastSentDay_uid2: "",
      blockedBy: null,
    });

    // Update request status
    batch.update(requestDocRef, {
      status: "accepted",
      respondedAt: Date.now(),
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error accepting friend request:", error);
    throw error;
  }
}

/**
 * Decline a friend request
 * @param requestId Friend request ID
 * @returns true if successful
 */
export async function declineFriendRequest(
  requestId: string,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const requestDocRef = doc(db, "FriendRequests", requestId);
    const requestSnapshot = await getDoc(requestDocRef);

    if (!requestSnapshot.exists()) {
      throw new Error("Request not found");
    }

    const request = requestSnapshot.data() as FriendRequest;

    if (request.status !== "pending") {
      throw new Error("Request is not pending");
    }

    await updateDoc(requestDocRef, {
      status: "declined",
      respondedAt: Date.now(),
    });

    return true;
  } catch (error) {
    console.error("Error declining friend request:", error);
    throw error;
  }
}

/**
 * Cancel a friend request sent by current user
 * @param requestId Friend request ID
 * @returns true if successful
 */
export async function cancelFriendRequest(requestId: string): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const requestDocRef = doc(db, "FriendRequests", requestId);
    await deleteDoc(requestDocRef);
    return true;
  } catch (error) {
    console.error("Error canceling friend request:", error);
    throw error;
  }
}

/**
 * Get all friends for a user (excluding blocked users)
 * @param uid User ID
 * @returns Array of friendships
 */
export async function getFriends(uid: string): Promise<Friend[]> {
  const db = getFirestoreInstance();

  try {
    const friendsRef = collection(db, "Friends");
    const q = query(friendsRef, where("users", "array-contains", uid));

    const snapshot = await getDocs(q);
    const friends: Friend[] = [];

    // Get list of blocked users
    const blockedUsersRef = collection(db, "Users", uid, "blockedUsers");
    const blockedSnapshot = await getDocs(blockedUsersRef);
    const blockedUserIds = new Set(blockedSnapshot.docs.map((doc) => doc.id));

    snapshot.forEach((doc) => {
      const friend = {
        id: doc.id,
        ...doc.data(),
      } as Friend;

      // Get the other user's ID
      const otherUserId = friend.users.find((u) => u !== uid);

      // Only include if the other user is not blocked
      if (otherUserId && !blockedUserIds.has(otherUserId)) {
        friends.push(friend);
      }
    });

    // Sort by creation date (newest first) in memory
    friends.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return friends;
  } catch (error) {
    console.error("Error getting friends:", error);
    return [];
  }
}

/**
 * Get friend profile details (for friend list item)
 * @param friendId Friendship document ID
 * @param currentUid Current user's UID
 * @returns Friend data with profile info
 */
export async function getFriendDetails(
  friendId: string,
  currentUid: string,
): Promise<(Friend & { friendUid: string; friendProfile?: any }) | null> {
  const db = getFirestoreInstance();

  try {
    const friendDocRef = doc(db, "Friends", friendId);
    const friendSnapshot = await getDoc(friendDocRef);

    if (!friendSnapshot.exists()) {
      return null;
    }

    const friendData = friendSnapshot.data() as Friend;
    const friendUid = friendData.users.find((uid) => uid !== currentUid);

    if (!friendUid) {
      return null;
    }

    // Get friend's profile
    const friendProfile = await getUserProfile(friendUid);

    return {
      ...friendData,
      friendUid,
      friendProfile,
    };
  } catch (error) {
    console.error("Error getting friend details:", error);
    return null;
  }
}

/**
 * Remove a friend (delete friendship)
 * @param uid1 Current user ID
 * @param uid2 Friend user ID
 * @returns true if successful
 */
export async function removeFriend(
  uid1: string,
  uid2: string,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const friendsRef = collection(db, "Friends");
    const q = query(friendsRef, where("users", "array-contains", uid1));

    const snapshot = await getDocs(q);
    let found = false;

    for (const doc of snapshot.docs) {
      const friend = doc.data() as Friend;
      if (friend.users.includes(uid2)) {
        await deleteDoc(doc.ref);
        found = true;
      }
    }

    if (!found) {
      throw new Error("Friendship not found");
    }

    return true;
  } catch (error) {
    console.error("Error removing friend:", error);
    throw error;
  }
}

/**
 * Block or unblock a friend
 * @param blockerUid User doing the blocking
 * @param blockedUid User being blocked
 * @param block true to block, false to unblock
 * @returns true if successful
 */
async function toggleBlockFriend(
  blockerUid: string,
  blockedUid: string,
  block: boolean,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const friendsRef = collection(db, "Friends");
    const q = query(friendsRef, where("users", "array-contains", blockerUid));

    const snapshot = await getDocs(q);
    let found = false;

    snapshot.forEach((doc) => {
      const friend = doc.data() as Friend;
      if (friend.users.includes(blockedUid)) {
        updateDoc(doc.ref, {
          blockedBy: block ? blockerUid : null,
        });
        found = true;
      }
    });

    if (!found) {
      throw new Error("Friendship not found");
    }

    return true;
  } catch (error) {
    console.error("Error toggling block:", error);
    throw error;
  }
}

/**
 * Find friendship document ID by two user UIDs
 * @param uid1 First user ID
 * @param uid2 Second user ID
 * @returns Friendship document ID or null if not found
 */
async function getFriendshipId(
  uid1: string,
  uid2: string,
): Promise<string | null> {
  const db = getFirestoreInstance();

  try {
    const friendsRef = collection(db, "Friends");
    const q = query(friendsRef, where("users", "array-contains", uid1));

    const snapshot = await getDocs(q);
    for (const friendDoc of snapshot.docs) {
      const friend = friendDoc.data() as Friend;
      if (friend.users.includes(uid2)) {
        return friendDoc.id;
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding friendship ID:", error);
    return null;
  }
}

/**
 * Update streak when a message is sent
 * @param friendshipId Friendship document ID
 * @param senderUid User sending the message
 * @returns true if successful
 */
async function updateStreak(
  friendshipId: string,
  senderUid: string,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const friendDocRef = doc(db, "Friends", friendshipId);
    const friendSnapshot = await getDoc(friendDocRef);

    if (!friendSnapshot.exists()) {
      throw new Error("Friendship not found");
    }

    const friend = friendSnapshot.data() as Friend;
    const today = new Date().toISOString().split("T")[0];
    const lastUpdatedDay = friend.streakUpdatedDay;

    // Determine which user field to update
    const [uid1] = friend.users;
    const isUid1Sending = senderUid === uid1;
    const lastSentDayField = isUid1Sending
      ? "lastSentDay_uid1"
      : "lastSentDay_uid2";
    const lastSentDay = isUid1Sending
      ? friend.lastSentDay_uid1
      : friend.lastSentDay_uid2;

    // If both users sent today, don't update streak
    if (lastSentDay === today) {
      return true;
    }

    // Get other user's last sent day
    const otherSentDay = isUid1Sending
      ? friend.lastSentDay_uid2
      : friend.lastSentDay_uid1;

    let newStreak = friend.streakCount;

    // If both users sent yesterday, increment streak
    if (otherSentDay === lastUpdatedDay && lastUpdatedDay !== today) {
      newStreak = (friend.streakCount || 0) + 1;
    }

    // Update streak info
    await updateDoc(friendDocRef, {
      [lastSentDayField]: today,
      streakUpdatedDay: today,
      streakCount: newStreak,
    });

    return true;
  } catch (error) {
    console.error("Error updating streak:", error);
    throw error;
  }
}

/**
 * Get username for a user by their UID
 * @param uid User ID
 * @returns Username or undefined if not found
 */
async function getUsernameByUid(uid: string): Promise<string | undefined> {
  try {
    const db = getFirestoreInstance();
    const userDocRef = doc(db, "Users", uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return userDoc.data().username;
    }
    return undefined;
  } catch (error) {
    console.error("Error getting username:", error);
    return undefined;
  }
}

/**
 * Get user profile by UID (includes username and avatar config)
 * @param uid User ID
 * @returns User profile or undefined if not found
 */
export async function getUserProfileByUid(uid: string) {
  try {
    const db = getFirestoreInstance();
    const userDocRef = doc(db, "Users", uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        uid,
        username: data.username,
        displayName: data.displayName,
        avatarConfig: data.avatarConfig,
        profilePicture: data.profilePicture || { url: null, updatedAt: 0 },
        avatarDecoration: data.avatarDecoration || { equippedId: null },
      };
    }
    return undefined;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return undefined;
  }
}
