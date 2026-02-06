/**
 * useProfilePicture - Hook for managing profile picture state and operations
 *
 * Provides:
 * - Current profile picture and decoration state
 * - Methods for updating picture and decoration
 * - Loading and error states
 *
 * @module hooks/useProfilePicture
 */

import {
  equipDecoration,
  getFullProfileData,
  removeProfilePicture,
  subscribeToProfile,
  unequipDecoration,
  uploadProfilePicture,
} from "@/services/profileService";
import type { ProfilePicture, UserAvatarDecoration } from "@/types/userProfile";
import { useCallback, useEffect, useState } from "react";

export interface UseProfilePictureOptions {
  /** User ID to manage profile picture for */
  userId: string;
  /** Whether to subscribe to real-time updates */
  realtime?: boolean;
}

export interface UseProfilePictureReturn {
  /** Profile picture data */
  picture: ProfilePicture | null;
  /** Equipped decoration data */
  decoration: UserAvatarDecoration | null;
  /** Owned decoration IDs */
  ownedDecorations: string[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Upload a new profile picture */
  uploadPicture: (imageUri: string) => Promise<void>;
  /** Remove profile picture */
  removePicture: () => Promise<void>;
  /** Equip a decoration */
  equip: (decorationId: string) => Promise<void>;
  /** Unequip current decoration */
  unequip: () => Promise<void>;
  /** Refresh data */
  refresh: () => Promise<void>;
}

export function useProfilePicture({
  userId,
  realtime = false,
}: UseProfilePictureOptions): UseProfilePictureReturn {
  const [picture, setPicture] = useState<ProfilePicture | null>(null);
  const [decoration, setDecoration] = useState<UserAvatarDecoration | null>(
    null,
  );
  const [ownedDecorations, setOwnedDecorations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setError(null);

      const profileData = await getFullProfileData(userId);

      if (profileData) {
        setPicture(profileData.profilePicture || null);
        setDecoration(profileData.avatarDecoration || null);
        setOwnedDecorations(profileData.ownedDecorations || []);
      }
    } catch (err) {
      console.error("Error fetching profile picture data:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch data"));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchData();

    // Set up real-time subscription if enabled
    if (realtime) {
      const unsubscribe = subscribeToProfile(userId, (profile) => {
        if (profile) {
          setPicture(profile.profilePicture || null);
          setDecoration(profile.avatarDecoration || null);
          setOwnedDecorations(profile.ownedDecorations || []);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [userId, realtime, fetchData]);

  // Upload profile picture
  const uploadPicture = useCallback(
    async (imageUri: string) => {
      if (!userId) throw new Error("No user ID");

      setIsLoading(true);
      setError(null);

      try {
        const { url, thumbnailUrl } = await uploadProfilePicture(
          userId,
          imageUri,
        );
        setPicture({
          url,
          thumbnailUrl,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error("Error uploading picture:", err);
        setError(err instanceof Error ? err : new Error("Failed to upload"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  // Remove profile picture
  const removePicture = useCallback(async () => {
    if (!userId) throw new Error("No user ID");

    setIsLoading(true);
    setError(null);

    try {
      await removeProfilePicture(userId);
      setPicture({
        url: null,
        thumbnailUrl: undefined,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error("Error removing picture:", err);
      setError(err instanceof Error ? err : new Error("Failed to remove"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Equip decoration
  const equip = useCallback(
    async (decorationId: string) => {
      if (!userId) throw new Error("No user ID");

      setIsLoading(true);
      setError(null);

      try {
        await equipDecoration(userId, decorationId);
        setDecoration({
          decorationId,
          equippedAt: Date.now(),
        });
      } catch (err) {
        console.error("Error equipping decoration:", err);
        setError(err instanceof Error ? err : new Error("Failed to equip"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  // Unequip decoration
  const unequip = useCallback(async () => {
    if (!userId) throw new Error("No user ID");

    setIsLoading(true);
    setError(null);

    try {
      await unequipDecoration(userId);
      setDecoration({
        decorationId: null,
      });
    } catch (err) {
      console.error("Error unequipping decoration:", err);
      setError(err instanceof Error ? err : new Error("Failed to unequip"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return {
    picture,
    decoration,
    ownedDecorations,
    isLoading,
    error,
    uploadPicture,
    removePicture,
    equip,
    unequip,
    refresh: fetchData,
  };
}

export default useProfilePicture;
