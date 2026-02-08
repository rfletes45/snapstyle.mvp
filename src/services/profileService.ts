/**
 * Profile Service
 *
 * Provides operations for the new profile system including:
 * - Profile data fetching and updates
 * - Profile picture management
 * - Avatar decorations
 * - Bio and status
 * - Privacy settings
 * - Mutual friends
 * - Profile sharing
 * - Relationship detection
 * - Blocking, reporting, and muting
 *
 * @module services/profileService
 */

import type { Friend, FriendRequest } from "@/types/models";
import type {
  ExtendedMuteConfig,
  FriendshipDetails,
  MoodType,
  MutualFriendInfo,
  ProfilePrivacySettings,
  ProfileRelationship,
  ProfileShareData,
  ProfileStatus,
  ReportCategory,
  UserProfileData,
  UserReport,
} from "@/types/userProfile";
import {
  applyPrivacyFilters,
  DEFAULT_PRIVACY_SETTINGS,
  getFriendshipDetails,
} from "@/types/userProfile";
import { log } from "@/utils/log";
import * as ImageManipulator from "expo-image-manipulator";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { Share } from "react-native";
import { isUserBlocked } from "./blocking";
import { getFirestoreInstance } from "./firebase";
import { getFriends } from "./friends";
import { getUserProfile } from "./users";

// =============================================================================
// PROFILE DATA OPERATIONS
// =============================================================================

/**
 * Get full profile data for a user
 * Returns raw data without privacy filtering
 */
export async function getFullProfileData(
  userId: string,
): Promise<UserProfileData | null> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data() as Partial<UserProfileData>;

    // Merge with defaults for any missing fields
    return {
      uid: userId,
      username: userData.username || "",
      usernameLower: userData.usernameLower || "",
      displayName: userData.displayName || "",
      avatarConfig: userData.avatarConfig || { baseColor: "#6366F1" },
      profilePicture: userData.profilePicture || {
        url: null,
        updatedAt: Date.now(),
      },
      avatarDecoration: userData.avatarDecoration || { decorationId: null },
      bio: userData.bio || { text: "", updatedAt: Date.now() },
      status: userData.status,
      gameScores: userData.gameScores || {
        enabled: false,
        displayedGames: [],
        updatedAt: Date.now(),
      },
      theme: userData.theme || {
        equippedThemeId: "default",
        updatedAt: Date.now(),
      },
      featuredBadges: userData.featuredBadges || {
        badgeIds: [],
        updatedAt: Date.now(),
      },
      privacy: userData.privacy || DEFAULT_PRIVACY_SETTINGS,
      ownedDecorations: userData.ownedDecorations || [],
      ownedThemes: userData.ownedThemes || ["default"],
      createdAt: userData.createdAt || Date.now(),
      lastActive: userData.lastActive || Date.now(),
      lastProfileUpdate: userData.lastProfileUpdate || Date.now(),
      profileViews: userData.profileViews,
      expoPushToken: userData.expoPushToken,
    };
  } catch (error) {
    log.error("Error fetching profile data", error);
    return null;
  }
}

/**
 * Subscribe to profile updates in real-time
 */
export function subscribeToProfile(
  userId: string,
  callback: (profile: UserProfileData | null) => void,
): () => void {
  const db = getFirestoreInstance();
  const userRef = doc(db, "Users", userId);

  const unsubscribe = onSnapshot(
    userRef,
    (doc) => {
      if (doc.exists()) {
        const userData = doc.data() as Partial<UserProfileData>;
        callback({
          uid: userId,
          username: userData.username || "",
          usernameLower: userData.usernameLower || "",
          displayName: userData.displayName || "",
          avatarConfig: userData.avatarConfig || { baseColor: "#6366F1" },
          profilePicture: userData.profilePicture || {
            url: null,
            updatedAt: Date.now(),
          },
          avatarDecoration: userData.avatarDecoration || { decorationId: null },
          bio: userData.bio || { text: "", updatedAt: Date.now() },
          status: userData.status,
          gameScores: userData.gameScores || {
            enabled: false,
            displayedGames: [],
            updatedAt: Date.now(),
          },
          theme: userData.theme || {
            equippedThemeId: "default",
            updatedAt: Date.now(),
          },
          featuredBadges: userData.featuredBadges || {
            badgeIds: [],
            updatedAt: Date.now(),
          },
          privacy: userData.privacy || DEFAULT_PRIVACY_SETTINGS,
          ownedDecorations: userData.ownedDecorations || [],
          ownedThemes: userData.ownedThemes || ["default"],
          createdAt: userData.createdAt || Date.now(),
          lastActive: userData.lastActive || Date.now(),
          lastProfileUpdate: userData.lastProfileUpdate || Date.now(),
          profileViews: userData.profileViews,
          expoPushToken: userData.expoPushToken,
        });
      } else {
        callback(null);
      }
    },
    (error) => {
      log.error("Error subscribing to profile", error);
      callback(null);
    },
  );

  return unsubscribe;
}

// =============================================================================
// RELATIONSHIP DETECTION
// =============================================================================

/**
 * Get the relationship between two users
 */
export async function getRelationship(
  currentUserId: string,
  targetUserId: string,
): Promise<ProfileRelationship> {
  // Self check
  if (currentUserId === targetUserId) {
    return { type: "self" };
  }

  try {
    const db = getFirestoreInstance();

    // Check if current user blocked target
    const youBlockedThem = await isUserBlocked(currentUserId, targetUserId);
    if (youBlockedThem) {
      const blockedRef = doc(
        db,
        "Users",
        currentUserId,
        "blockedUsers",
        targetUserId,
      );
      const blockedDoc = await getDoc(blockedRef);
      return {
        type: "blocked_by_you",
        blockedAt: blockedDoc.exists()
          ? blockedDoc.data().blockedAt
          : Date.now(),
      };
    }

    // Check if target blocked current user
    const theyBlockedYou = await isUserBlocked(targetUserId, currentUserId);
    if (theyBlockedYou) {
      return { type: "blocked_by_them" };
    }

    // Check for friendship
    const friendsRef = collection(db, "Friends");
    const friendsQuery = query(
      friendsRef,
      where("users", "array-contains", currentUserId),
    );
    const friendsSnapshot = await getDocs(friendsQuery);

    for (const friendDoc of friendsSnapshot.docs) {
      const friendship = friendDoc.data() as Friend;
      if (friendship.users.includes(targetUserId)) {
        return {
          type: "friend",
          friendshipId: friendDoc.id,
          streakCount: friendship.streakCount,
          friendsSince: friendship.createdAt,
        };
      }
    }

    // Check for pending friend requests
    const requestsRef = collection(db, "FriendRequests");

    // Check if current user sent a request
    const sentQuery = query(
      requestsRef,
      where("from", "==", currentUserId),
      where("to", "==", targetUserId),
      where("status", "==", "pending"),
    );
    const sentSnapshot = await getDocs(sentQuery);

    if (!sentSnapshot.empty) {
      const request = sentSnapshot.docs[0].data() as FriendRequest;
      return {
        type: "pending_sent",
        requestId: sentSnapshot.docs[0].id,
        sentAt: request.createdAt,
      };
    }

    // Check if target user sent a request
    const receivedQuery = query(
      requestsRef,
      where("from", "==", targetUserId),
      where("to", "==", currentUserId),
      where("status", "==", "pending"),
    );
    const receivedSnapshot = await getDocs(receivedQuery);

    if (!receivedSnapshot.empty) {
      const request = receivedSnapshot.docs[0].data() as FriendRequest;
      return {
        type: "pending_received",
        requestId: receivedSnapshot.docs[0].id,
        receivedAt: request.createdAt,
      };
    }

    // No relationship
    return { type: "stranger" };
  } catch (error) {
    log.error("Error getting relationship", error);
    return { type: "stranger" };
  }
}

/**
 * Get friendship details for friends
 */
export async function getFriendshipDetailsForUser(
  currentUserId: string,
  friendUserId: string,
): Promise<FriendshipDetails | null> {
  try {
    const db = getFirestoreInstance();
    const friendsRef = collection(db, "Friends");
    const friendsQuery = query(
      friendsRef,
      where("users", "array-contains", currentUserId),
    );
    const friendsSnapshot = await getDocs(friendsQuery);

    for (const friendDoc of friendsSnapshot.docs) {
      const friendship = friendDoc.data() as Friend;
      if (friendship.users.includes(friendUserId)) {
        return getFriendshipDetails({ ...friendship, id: friendDoc.id });
      }
    }

    return null;
  } catch (error) {
    log.error("Error getting friendship details", error);
    return null;
  }
}

// =============================================================================
// MUTUAL FRIENDS
// =============================================================================

/**
 * Get mutual friends between two users
 */
export async function getMutualFriends(
  currentUserId: string,
  targetUserId: string,
): Promise<MutualFriendInfo[]> {
  try {
    // Get both users' friends lists
    const [currentUserFriends, targetUserFriends] = await Promise.all([
      getFriends(currentUserId),
      getFriends(targetUserId),
    ]);

    // Extract friend user IDs
    const currentFriendIds = new Set(
      currentUserFriends.flatMap((f) =>
        f.users.filter((id) => id !== currentUserId),
      ),
    );
    const targetFriendIds = new Set(
      targetUserFriends.flatMap((f) =>
        f.users.filter((id) => id !== targetUserId),
      ),
    );

    // Find intersection
    const mutualIds = [...currentFriendIds].filter((id) =>
      targetFriendIds.has(id),
    );

    // Fetch profiles for mutual friends
    const mutualFriends: MutualFriendInfo[] = [];

    for (const userId of mutualIds.slice(0, 10)) {
      // Limit to 10
      const profile = await getUserProfile(userId);
      if (profile) {
        mutualFriends.push({
          userId: profile.uid,
          username: profile.username,
          displayName: profile.displayName,
          avatarConfig: profile.avatarConfig,
          profilePictureUrl: undefined, // Would need to fetch from profile data
        });
      }
    }

    return mutualFriends;
  } catch (error) {
    log.error("Error getting mutual friends", error);
    return [];
  }
}

// =============================================================================
// PROFILE PICTURE OPERATIONS
// =============================================================================

/**
 * Upload a profile picture
 * Compresses and uploads to Firebase Storage
 */
export async function uploadProfilePicture(
  userId: string,
  imageUri: string,
): Promise<{ url: string; thumbnailUrl: string }> {
  try {
    const storage = getStorage();
    const db = getFirestoreInstance();

    // Compress and resize main image (max 1024x1024)
    const mainImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1024, height: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );

    // Create thumbnail (128x128)
    const thumbnail = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 128, height: 128 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );

    // Upload main image
    const mainRef = ref(storage, `users/${userId}/profile/picture.jpg`);
    const mainBlob = await fetch(mainImage.uri).then((r) => r.blob());
    await uploadBytes(mainRef, mainBlob);
    const mainUrl = await getDownloadURL(mainRef);

    // Upload thumbnail
    const thumbRef = ref(storage, `users/${userId}/profile/picture_thumb.jpg`);
    const thumbBlob = await fetch(thumbnail.uri).then((r) => r.blob());
    await uploadBytes(thumbRef, thumbBlob);
    const thumbnailUrl = await getDownloadURL(thumbRef);

    // Update user document
    const userRef = doc(db, "Users", userId);
    await updateDoc(userRef, {
      profilePicture: {
        url: mainUrl,
        thumbnailUrl,
        updatedAt: Date.now(),
      },
      lastProfileUpdate: Date.now(),
    });

    log.info("Profile picture uploaded successfully");
    return { url: mainUrl, thumbnailUrl };
  } catch (error) {
    log.error("Error uploading profile picture", error);
    throw error;
  }
}

/**
 * Remove profile picture
 */
export async function removeProfilePicture(userId: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    await updateDoc(userRef, {
      profilePicture: {
        url: null,
        thumbnailUrl: null,
        updatedAt: Date.now(),
      },
      lastProfileUpdate: Date.now(),
    });

    log.info("Profile picture removed");
  } catch (error) {
    log.error("Error removing profile picture", error);
    throw error;
  }
}

// =============================================================================
// BIO OPERATIONS
// =============================================================================

/**
 * Update user bio
 */
export async function updateBio(userId: string, text: string): Promise<void> {
  try {
    // Validate length
    if (text.length > 200) {
      throw new Error("Bio must be 200 characters or less");
    }

    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    await updateDoc(userRef, {
      bio: {
        text: text.trim(),
        updatedAt: Date.now(),
      },
      lastProfileUpdate: Date.now(),
    });

    log.info("Bio updated successfully");
  } catch (error) {
    log.error("Error updating bio", error);
    throw error;
  }
}

// =============================================================================
// STATUS/MOOD OPERATIONS
// =============================================================================

/**
 * Set user status/mood
 */
export async function setStatus(
  userId: string,
  text: string,
  mood: MoodType,
  expiresIn?: number, // milliseconds until expiry
): Promise<void> {
  try {
    if (text.length > 50) {
      throw new Error("Status must be 50 characters or less");
    }

    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    const status: ProfileStatus = {
      text: text.trim(),
      mood,
      setAt: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
    };

    await updateDoc(userRef, {
      status,
      lastProfileUpdate: Date.now(),
    });

    log.info("Status updated successfully");
  } catch (error) {
    log.error("Error setting status", error);
    throw error;
  }
}

/**
 * Clear user status
 */
export async function clearStatus(userId: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    await updateDoc(userRef, {
      status: null,
      lastProfileUpdate: Date.now(),
    });

    log.info("Status cleared");
  } catch (error) {
    log.error("Error clearing status", error);
    throw error;
  }
}

// =============================================================================
// GAME SCORES OPERATIONS
// =============================================================================

/**
 * Update game scores display configuration
 * Persists the user's selection of which games to display and their order.
 */
export async function updateGameScoresConfig(
  userId: string,
  config: { enabled: boolean; displayedGames: any[]; updatedAt: number },
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    await updateDoc(userRef, {
      gameScores: {
        enabled: config.enabled,
        displayedGames: config.displayedGames,
        updatedAt: config.updatedAt,
      },
      lastProfileUpdate: Date.now(),
    });

    log.info("Game scores config updated");
  } catch (error) {
    log.error("Error updating game scores config", error);
    throw error;
  }
}

/**
 * Get game scores configuration for a user
 */
export async function getGameScoresConfig(userId: string): Promise<{
  enabled: boolean;
  displayedGames: any[];
  updatedAt: number;
} | null> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    return data?.gameScores || null;
  } catch (error) {
    log.error("Error getting game scores config", error);
    return null;
  }
}

// =============================================================================
// AVATAR DECORATION OPERATIONS
// =============================================================================

/**
 * Equip an avatar decoration
 */
export async function equipDecoration(
  userId: string,
  decorationId: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    // Verify user owns the decoration
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data() as Partial<UserProfileData>;
    let ownedDecorations = userData.ownedDecorations || [];

    // Auto-grant free decorations on first equip
    if (!ownedDecorations.includes(decorationId)) {
      const { getDecorationById } = await import("@/data/avatarDecorations");
      const decoration = getDecorationById(decorationId);
      if (decoration?.obtainMethod.type === "free" && decoration.available) {
        ownedDecorations = [...ownedDecorations, decorationId];
        await updateDoc(userRef, { ownedDecorations });
      } else {
        throw new Error("You do not own this decoration");
      }
    }

    await updateDoc(userRef, {
      avatarDecoration: {
        decorationId,
        equippedAt: Date.now(),
      },
      lastProfileUpdate: Date.now(),
    });

    log.info("Decoration equipped", { data: { decorationId } });
  } catch (error) {
    log.error("Error equipping decoration", error);
    throw error;
  }
}

/**
 * Unequip avatar decoration
 */
export async function unequipDecoration(userId: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    await updateDoc(userRef, {
      avatarDecoration: {
        decorationId: null,
      },
      lastProfileUpdate: Date.now(),
    });

    log.info("Decoration unequipped");
  } catch (error) {
    log.error("Error unequipping decoration", error);
    throw error;
  }
}

/**
 * Grant a decoration to user
 */
export async function grantDecoration(
  userId: string,
  decorationId: string,
  obtainedVia: "free" | "achievement" | "purchase" | "event" | "gift",
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    // Get current owned decorations
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data() as Partial<UserProfileData>;
    const ownedDecorations = userData.ownedDecorations || [];

    if (ownedDecorations.includes(decorationId)) {
      log.warn("User already owns this decoration");
      return;
    }

    // Add to owned decorations
    await updateDoc(userRef, {
      ownedDecorations: [...ownedDecorations, decorationId],
      lastProfileUpdate: Date.now(),
    });

    // Also store in subcollection for detailed tracking
    const ownedRef = doc(db, "Users", userId, "OwnedDecorations", decorationId);
    await setDoc(ownedRef, {
      decorationId,
      obtainedAt: Date.now(),
      obtainedVia,
    });

    log.info("Decoration granted", { data: { decorationId, obtainedVia } });
  } catch (error) {
    log.error("Error granting decoration", error);
    throw error;
  }
}

// =============================================================================
// PRIVACY SETTINGS
// =============================================================================

/**
 * Update privacy settings
 */
async function updatePrivacySettings(
  userId: string,
  settings: Partial<ProfilePrivacySettings>,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    // Get current settings
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data() as Partial<UserProfileData>;
    const currentPrivacy = userData.privacy || {
      showGameScores: "everyone",
      showBadges: "everyone",
      showLastActive: "friends",
      showBio: "everyone",
      showMutualFriends: true,
      showOnlineStatus: true,
      allowProfileSharing: true,
    };

    await updateDoc(userRef, {
      privacy: { ...currentPrivacy, ...settings },
      lastProfileUpdate: Date.now(),
    });

    log.info("Privacy settings updated");
  } catch (error) {
    log.error("Error updating privacy settings", error);
    throw error;
  }
}

// =============================================================================
// FEATURED BADGES
// =============================================================================

/**
 * Update featured badges
 */
async function updateFeaturedBadges(
  userId: string,
  badgeIds: string[],
): Promise<void> {
  try {
    if (badgeIds.length > 5) {
      throw new Error("Maximum 5 featured badges allowed");
    }

    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    await updateDoc(userRef, {
      featuredBadges: {
        badgeIds,
        updatedAt: Date.now(),
      },
      lastProfileUpdate: Date.now(),
    });

    log.info("Featured badges updated", { data: { count: badgeIds.length } });
  } catch (error) {
    log.error("Error updating featured badges", error);
    throw error;
  }
}

// =============================================================================
// THEME OPERATIONS
// =============================================================================

/**
 * Equip a theme
 */
export async function equipTheme(
  userId: string,
  themeId: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    // Verify user owns the theme
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data() as Partial<UserProfileData>;
    const ownedThemes = userData.ownedThemes || ["default"];

    if (!ownedThemes.includes(themeId)) {
      throw new Error("You do not own this theme");
    }

    await updateDoc(userRef, {
      theme: {
        equippedThemeId: themeId,
        updatedAt: Date.now(),
      },
      lastProfileUpdate: Date.now(),
    });

    log.info("Theme equipped", { data: { themeId } });
  } catch (error) {
    log.error("Error equipping theme", error);
    throw error;
  }
}

/**
 * Grant a theme to user
 */
export async function grantTheme(
  userId: string,
  themeId: string,
  obtainedVia: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    const userDoc = await getDoc(userRef);
    const userData = userDoc.data() as Partial<UserProfileData>;
    const ownedThemes = userData.ownedThemes || ["default"];

    if (ownedThemes.includes(themeId)) {
      log.warn("User already owns this theme");
      return;
    }

    await updateDoc(userRef, {
      ownedThemes: [...ownedThemes, themeId],
      lastProfileUpdate: Date.now(),
    });

    // Store in subcollection
    const ownedRef = doc(db, "Users", userId, "OwnedThemes", themeId);
    await setDoc(ownedRef, {
      themeId,
      obtainedAt: Date.now(),
      obtainedVia,
    });

    log.info("Theme granted", { data: { themeId, obtainedVia } });
  } catch (error) {
    log.error("Error granting theme", error);
    throw error;
  }
}

// =============================================================================
// PROFILE SHARING
// =============================================================================

/**
 * Generate profile share data
 */
export async function generateProfileShare(
  userId: string,
): Promise<ProfileShareData | null> {
  try {
    const profile = await getFullProfileData(userId);
    if (!profile) {
      return null;
    }

    // Check if sharing is allowed
    if (!profile.privacy.allowProfileSharing) {
      throw new Error("Profile sharing is disabled");
    }

    // Generate share code (short alphanumeric)
    const shareCode = userId.substring(0, 8).toUpperCase();

    // Generate share URL (would use your app's deep link domain)
    const shareUrl = `https://vibeapp.link/u/${profile.username}`;

    return {
      userId,
      username: profile.username,
      displayName: profile.displayName,
      shareCode,
      shareUrl,
      generatedAt: Date.now(),
    };
  } catch (error) {
    log.error("Error generating profile share", error);
    return null;
  }
}

/**
 * Share profile using native share
 */
async function shareProfile(userId: string): Promise<boolean> {
  try {
    const shareData = await generateProfileShare(userId);
    if (!shareData) {
      return false;
    }

    // Share using React Native's built-in Share API
    const message = `Check out ${shareData.displayName}'s profile on Vibe! ${shareData.shareUrl}`;

    const result = await Share.share({
      message,
      title: `${shareData.displayName}'s Profile`,
      url: shareData.shareUrl, // iOS only
    });

    if (result.action === Share.sharedAction) {
      log.info("Profile shared successfully");
      return true;
    } else if (result.action === Share.dismissedAction) {
      log.info("Share dialog dismissed");
      return false;
    }
    return true;
  } catch (error) {
    log.error("Error sharing profile", error);
    return false;
  }
}

// =============================================================================
// MUTE OPERATIONS
// =============================================================================

/**
 * Mute a user (hide their content but stay friends)
 */
export async function muteUser(
  currentUserId: string,
  targetUserId: string,
  duration?: number, // milliseconds, undefined = indefinite
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const muteRef = doc(db, "Users", currentUserId, "mutedUsers", targetUserId);

    await setDoc(muteRef, {
      mutedUserId: targetUserId,
      mutedAt: Date.now(),
      mutedUntil: duration ? Date.now() + duration : null,
    });

    log.info("User muted", { data: { targetUserId } });
  } catch (error) {
    log.error("Error muting user", error);
    throw error;
  }
}

/**
 * Unmute a user
 */
export async function unmuteUser(
  currentUserId: string,
  targetUserId: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const muteRef = doc(db, "Users", currentUserId, "mutedUsers", targetUserId);

    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(muteRef);

    log.info("User unmuted", { data: { targetUserId } });
  } catch (error) {
    log.error("Error unmuting user", error);
    throw error;
  }
}

/**
 * Check if a user is muted
 */
export async function isUserMuted(
  currentUserId: string,
  targetUserId: string,
): Promise<boolean> {
  try {
    const db = getFirestoreInstance();
    const muteRef = doc(db, "Users", currentUserId, "mutedUsers", targetUserId);
    const muteDoc = await getDoc(muteRef);

    if (!muteDoc.exists()) {
      return false;
    }

    const muteData = muteDoc.data();
    // Check if mute has expired
    if (muteData.mutedUntil && muteData.mutedUntil < Date.now()) {
      // Mute expired, clean it up
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(muteRef);
      return false;
    }

    return true;
  } catch (error) {
    log.error("Error checking mute status", error);
    return false;
  }
}

// =============================================================================
// PROFILE VIEW TRACKING
// =============================================================================

/**
 * Increment profile view count
 */
export async function incrementProfileViews(userId: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    const { increment } = await import("firebase/firestore");
    await updateDoc(userRef, {
      profileViews: increment(1),
    });
  } catch (error) {
    // Non-critical, just log
    log.warn("Error incrementing profile views", {
      data: { error: String(error) },
    });
  }
}

// =============================================================================
// REPORT SERVICE
// =============================================================================

/**
 * Submit a report about a user
 * Reports are stored in a separate collection for moderator review
 */
async function submitUserReport(
  reporterId: string,
  reportedId: string,
  category: ReportCategory,
  description: string,
  evidenceUrls?: string[],
): Promise<string> {
  try {
    // Validate inputs
    if (reporterId === reportedId) {
      throw new Error("Cannot report yourself");
    }

    if (description.length < 10) {
      throw new Error("Report description must be at least 10 characters");
    }

    if (description.length > 1000) {
      throw new Error("Report description must be less than 1000 characters");
    }

    const db = getFirestoreInstance();
    const reportsRef = collection(db, "UserReports");

    const reportData: Omit<UserReport, "id"> = {
      reporterId,
      reportedId,
      category,
      description: description.trim(),
      evidenceUrls: evidenceUrls || [],
      createdAt: Date.now(),
      status: "pending",
    };

    const docRef = await addDoc(reportsRef, reportData);

    log.info("User report submitted", {
      data: { reportId: docRef.id, category },
    });

    return docRef.id;
  } catch (error) {
    log.error("Error submitting user report", error);
    throw error;
  }
}

/**
 * Get reports submitted by a user
 */
async function getMyReports(userId: string): Promise<UserReport[]> {
  try {
    const db = getFirestoreInstance();
    const reportsRef = collection(db, "UserReports");
    const reportsQuery = query(reportsRef, where("reporterId", "==", userId));
    const snapshot = await getDocs(reportsQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UserReport[];
  } catch (error) {
    log.error("Error fetching reports", error);
    return [];
  }
}

// =============================================================================
// EXTENDED MUTE OPERATIONS
// =============================================================================

/**
 * Mute a user with extended options
 */
async function muteUserExtended(
  currentUserId: string,
  targetUserId: string,
  options: {
    duration?: number | null; // milliseconds, null = indefinite
    hideContent?: boolean;
    muteNotifications?: boolean;
    hideStatus?: boolean;
    reason?: string;
  } = {},
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const muteRef = doc(db, "Users", currentUserId, "mutedUsers", targetUserId);

    const muteConfig: ExtendedMuteConfig = {
      muterId: currentUserId,
      mutedId: targetUserId,
      mutedAt: Date.now(),
      mutedUntil: options.duration ? Date.now() + options.duration : null,
      muteSettings: {
        hideContent: options.hideContent ?? true,
        muteNotifications: options.muteNotifications ?? true,
        hideStatus: options.hideStatus ?? true,
      },
      reason: options.reason,
    };

    await setDoc(muteRef, muteConfig);

    log.info("User muted with extended settings", {
      data: { targetUserId, duration: options.duration },
    });
  } catch (error) {
    log.error("Error muting user", error);
    throw error;
  }
}

/**
 * Get mute configuration for a user
 */
async function getMuteConfig(
  currentUserId: string,
  targetUserId: string,
): Promise<ExtendedMuteConfig | null> {
  try {
    const db = getFirestoreInstance();
    const muteRef = doc(db, "Users", currentUserId, "mutedUsers", targetUserId);
    const muteDoc = await getDoc(muteRef);

    if (!muteDoc.exists()) {
      return null;
    }

    const muteData = muteDoc.data() as ExtendedMuteConfig;

    // Check if mute has expired
    if (muteData.mutedUntil && muteData.mutedUntil < Date.now()) {
      // Mute expired, clean it up
      await deleteDoc(muteRef);
      return null;
    }

    return muteData;
  } catch (error) {
    log.error("Error getting mute config", error);
    return null;
  }
}

/**
 * Get all muted users for current user
 */
async function getMutedUsers(userId: string): Promise<ExtendedMuteConfig[]> {
  try {
    const db = getFirestoreInstance();
    const mutedRef = collection(db, "Users", userId, "mutedUsers");
    const snapshot = await getDocs(mutedRef);

    const now = Date.now();
    const mutedUsers: ExtendedMuteConfig[] = [];

    for (const docSnapshot of snapshot.docs) {
      const muteData = docSnapshot.data() as ExtendedMuteConfig;

      // Filter out expired mutes
      if (muteData.mutedUntil && muteData.mutedUntil < now) {
        // Clean up expired mute
        await deleteDoc(docSnapshot.ref);
        continue;
      }

      mutedUsers.push(muteData);
    }

    return mutedUsers;
  } catch (error) {
    log.error("Error getting muted users", error);
    return [];
  }
}

// =============================================================================
// PROFILE DATA WITH PRIVACY
// =============================================================================

/**
 * Get profile data with privacy filters applied
 * Use this when viewing another user's profile
 */
async function getProfileDataForViewer(
  targetUserId: string,
  viewerId: string,
): Promise<Partial<UserProfileData> | null> {
  try {
    // Get full profile data
    const profile = await getFullProfileData(targetUserId);
    if (!profile) {
      return null;
    }

    // Get relationship between viewer and target
    const relationship = await getRelationship(viewerId, targetUserId);

    // Apply privacy filters
    const filteredProfile = applyPrivacyFilters(profile, relationship);

    return filteredProfile;
  } catch (error) {
    log.error("Error getting profile data for viewer", error);
    return null;
  }
}

/**
 * Update comprehensive privacy settings
 */
export async function updateFullPrivacySettings(
  userId: string,
  settings: ProfilePrivacySettings,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);

    // Validate settings
    const validVisibility = ["everyone", "friends", "nobody"];
    const visibilityFields = [
      "profileVisibility",
      "showProfilePicture",
      "showBio",
      "showStatus",
      "showGameScores",
      "showBadges",
      "showLastActive",
      "showOnlineStatus",
      "showFriendshipInfo",
      "showFriendsList",
      "allowFriendRequests",
      "allowMessages",
      "allowCalls",
      "allowGameInvites",
    ];

    for (const field of visibilityFields) {
      if (
        settings[field as keyof ProfilePrivacySettings] &&
        !validVisibility.includes(
          settings[field as keyof ProfilePrivacySettings] as string,
        )
      ) {
        throw new Error(`Invalid value for ${field}`);
      }
    }

    await updateDoc(userRef, {
      privacy: settings,
      lastProfileUpdate: Date.now(),
    });

    log.info("Privacy settings updated");
  } catch (error) {
    log.error("Error updating privacy settings", error);
    throw error;
  }
}

/**
 * Apply a privacy preset
 */
async function applyPrivacyPreset(
  userId: string,
  preset: "public" | "friendsOnly" | "private",
): Promise<void> {
  const { PRIVACY_PRESETS } = await import("@/types/userProfile");
  const presetSettings = PRIVACY_PRESETS[preset].settings;
  await updateFullPrivacySettings(userId, presetSettings);
}
