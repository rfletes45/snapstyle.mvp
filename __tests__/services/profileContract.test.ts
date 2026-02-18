import {
  hydrateProfileData,
  validateBioText,
  validateDisplayName,
  validateFullPrivacySettings,
  validateStatusInput,
} from "@/services/profile/profileContract";
import { DEFAULT_PRIVACY_SETTINGS } from "@/types/userProfile";

describe("Profile contract helpers", () => {
  const fixedNow = 1700000000000;

  describe("hydrateProfileData", () => {
    it("hydrates missing profile fields with safe defaults", () => {
      const hydrated = hydrateProfileData(
        "user_1",
        {
          username: "alice",
          usernameLower: "alice",
          displayName: "Alice",
          avatarConfig: { baseColor: "#123456" },
          createdAt: fixedNow - 1000,
        },
        fixedNow,
      );

      expect(hydrated.uid).toBe("user_1");
      expect(hydrated.theme.equippedThemeId).toBe("default");
      expect(hydrated.ownedThemes).toContain("default");
      expect(hydrated.bio.text).toBe("");
      expect(hydrated.profilePicture.url).toBeNull();
      expect(hydrated.privacy).toEqual(DEFAULT_PRIVACY_SETTINGS);
    });

    it("preserves provided profile fields while filling only gaps", () => {
      const hydrated = hydrateProfileData(
        "user_2",
        {
          username: "bob",
          usernameLower: "bob",
          displayName: "Bob",
          avatarConfig: { baseColor: "#abcdef" },
          theme: { equippedThemeId: "sunset", updatedAt: fixedNow - 5 },
          ownedThemes: ["default", "sunset"],
          privacy: {
            ...DEFAULT_PRIVACY_SETTINGS,
            showStatus: "everyone",
          },
        },
        fixedNow,
      );

      expect(hydrated.theme.equippedThemeId).toBe("sunset");
      expect(hydrated.ownedThemes).toEqual(["default", "sunset"]);
      expect(hydrated.privacy.showStatus).toBe("everyone");
      expect(hydrated.privacy.allowProfileSharing).toBe(
        DEFAULT_PRIVACY_SETTINGS.allowProfileSharing,
      );
    });
  });

  describe("validators", () => {
    it("validates display name and trims whitespace", () => {
      expect(validateDisplayName("  Alice  ")).toBe("Alice");
      expect(() => validateDisplayName("")).toThrow(
        "Display name must be 1-50 characters",
      );
    });

    it("validates bio length", () => {
      expect(validateBioText(" hello ")).toBe("hello");
      expect(() => validateBioText("a".repeat(201))).toThrow(
        "Bio must be 200 characters or less",
      );
    });

    it("validates status text length and mood membership", () => {
      expect(validateStatusInput(" Ready ", "gaming")).toEqual({
        text: "Ready",
        mood: "gaming",
      });
      expect(() => validateStatusInput("x".repeat(51), "happy")).toThrow(
        "Status must be 50 characters or less",
      );
    });

    it("enforces full privacy validator alignment", () => {
      expect(() =>
        validateFullPrivacySettings({
          ...DEFAULT_PRIVACY_SETTINGS,
          showBio: "everyone",
        }),
      ).not.toThrow();

      expect(() =>
        validateFullPrivacySettings({
          ...DEFAULT_PRIVACY_SETTINGS,
          showBio: "public" as any,
        }),
      ).toThrow("Invalid value for showBio");

      expect(() =>
        validateFullPrivacySettings({
          ...DEFAULT_PRIVACY_SETTINGS,
          showMutualFriends: "yes" as any,
        }),
      ).toThrow("Invalid value for showMutualFriends");
    });
  });
});
