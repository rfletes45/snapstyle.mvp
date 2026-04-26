/**
 * Games V4 - UserAvatar
 *
 * Reusable avatar component for game screens. It uses the canonical profile
 * picture renderer so lobby/game UI shows equipped PFP decorations.
 *
 * @module gamesV4/components/UserAvatar
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import React from "react";

export interface UserAvatarProps {
  /** Profile picture URL. */
  profilePictureUrl?: string | null;
  /** Display name used for initials fallback. */
  displayName?: string;
  /** Unique user ID, used as a fallback name seed. */
  uid?: string;
  /** Equipped profile-picture decoration ID. */
  decorationId?: string | null;
  /** Diameter in logical pixels. Default 32. */
  size?: number;
  /** Kept for compatibility with older callers. */
  fallbackIcon?: string;
}

export default function UserAvatar({
  profilePictureUrl,
  displayName,
  uid,
  decorationId,
  size = 32,
}: UserAvatarProps): React.JSX.Element {
  return (
    <ProfilePictureWithDecoration
      pictureUrl={profilePictureUrl}
      name={displayName || uid || "Player"}
      decorationId={decorationId}
      size={size}
      loading={false}
    />
  );
}
