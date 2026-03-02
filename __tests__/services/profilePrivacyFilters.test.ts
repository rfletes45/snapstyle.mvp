import { hydrateProfileData } from "@/services/profile/profileContract";
import { applyPrivacyFilters, DEFAULT_PRIVACY_SETTINGS } from "@/types/userProfile";

function createProfile() {
  return hydrateProfileData("target-user", {
    username: "target",
    usernameLower: "target",
    displayName: "Target User",
    profilePicture: { url: "https://cdn.example/avatar.jpg", updatedAt: 1 },
    avatarDecoration: { decorationId: "sparkle" },
    bio: { text: "hello world", updatedAt: 1 },
    status: { text: "Ready to play", mood: "happy", setAt: 1 },
    featuredBadges: { badgeIds: ["badge-1"], updatedAt: 1 },
    theme: { equippedThemeId: "default", updatedAt: 1 },
    profileViews: 42,
    privacy: {
      ...DEFAULT_PRIVACY_SETTINGS,
      showProfilePicture: "friends",
      showBio: "friends",
      showStatus: "friends",
      showBadges: "friends",
      showLastActive: "friends",
      trackProfileViews: true,
    },
    lastActive: 123456789,
  });
}

describe("applyPrivacyFilters", () => {
  it("returns full profile for self relationship", () => {
    const profile = createProfile();
    const filtered = applyPrivacyFilters(profile, { type: "self" });

    expect(filtered).toBe(profile);
  });

  it("hides friend-only fields for strangers while keeping theme", () => {
    const profile = createProfile();
    const filtered = applyPrivacyFilters(profile, { type: "stranger" });

    expect(filtered.displayName).toBe("Target User");
    expect(filtered.theme).toBeDefined();
    expect(filtered.bio).toBeUndefined();
    expect(filtered.status).toBeUndefined();
    expect(filtered.featuredBadges).toBeUndefined();
    expect(filtered.profilePicture).toBeUndefined();
    expect(filtered.avatarDecoration).toBeUndefined();
    expect(filtered.lastActive).toBeUndefined();
  });

  it("shows friend-visible fields to friends", () => {
    const profile = createProfile();
    const filtered = applyPrivacyFilters(profile, {
      type: "friend",
      friendshipId: "friendship-1",
      streakCount: 7,
      friendsSince: 1,
    });

    expect(filtered.profilePicture).toBeDefined();
    expect(filtered.avatarDecoration).toBeDefined();
    expect(filtered.bio?.text).toBe("hello world");
    expect(filtered.status?.text).toBe("Ready to play");
    expect(filtered.lastActive).toBe(123456789);
    expect(filtered.featuredBadges?.badgeIds).toEqual(["badge-1"]);
  });

  it("returns minimal profile for blocked relationships", () => {
    const profile = createProfile();
    const filtered = applyPrivacyFilters(profile, { type: "blocked_by_them" });

    expect(filtered.uid).toBe("target-user");
    expect(filtered.displayName).toBe("Target User");
    expect(filtered.lastActive).toBe(0);
    expect(filtered.theme).toBeUndefined();
    expect(filtered.bio).toBeUndefined();
    expect(filtered.status).toBeUndefined();
  });
});
