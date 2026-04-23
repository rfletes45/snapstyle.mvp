import type { NavigatorScreenParams } from "@react-navigation/native";

type OptionalRouteParams = Record<string, unknown> | undefined;

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  SignupEmail: undefined;
  SignupPassword: undefined;
  ForgotPassword: undefined;
  ProfileSetup: undefined;
};

export type InboxStackParamList = {
  ChatList:
    | {
        initialFilter?: "all" | "unread" | "groups" | "dms" | "archived";
      }
    | undefined;
  ScheduledMessages: undefined;
  GroupInvites: undefined;
  InboxSettings: undefined;
};

export type ProfileTabStackParamList = {
  ProfileMain: undefined;
  Customization:
    | { initialTab?: string; initialSection?: "profile" | "chat" }
    | undefined;
  BlockedUsers: undefined;
  PrivacySettings: undefined;
  NotificationSettings: undefined;
  BadgeCollection: { userId?: string } | undefined;
  Settings: undefined;
  Tasks: { tab?: "daily" | "monthly" } | undefined;
  Shop: undefined;
  AdminReports: undefined;
};

export type AppTabsParamList = {
  Profile: NavigatorScreenParams<ProfileTabStackParamList> | undefined;
  Messages: NavigatorScreenParams<InboxStackParamList> | undefined;
  Calls: undefined;
};

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<AppTabsParamList> | undefined;
  Friends:
    | {
        tab?: "all" | "requests";
        openAddFriends?: boolean;
        /**
         * Set by the deep-link handler to trigger the shared friend-invite
         * confirmation modal on mount. Payload shape mirrors
         * `ParsedInvite` from `@/services/invites` but is kept loose here to
         * avoid a circular type dependency.
         */
        pendingInvite?:
          | { kind: "invite"; code: string }
          | { kind: "profile"; username: string };
      }
    | undefined;
  ChatDetail:
    | {
        friendUid: string;
        friendName?: string;
        initialData?: Record<string, unknown>;
        targetMessageId?: string;
        /** Fresh token that forces the deep-jump effect to re-arm even when
         *  `targetMessageId` is unchanged (e.g. repeated taps from a thread). */
        jumpRequestId?: string;
      }
    | undefined;
  GroupChat:
    | {
        groupId: string;
        groupName?: string;
        targetMessageId?: string;
        /** See `ChatDetail.jumpRequestId`. */
        jumpRequestId?: string;
        initialGroupData?: Record<string, unknown>;
      }
    | undefined;
  ThreadView: {
    conversationId: string;
    scope: "dm" | "group";
    rootMessageId: string;
  };
  GroupChatCreate: undefined;
  GroupChatInfo: { groupId: string } | undefined;
  ChatSettings: OptionalRouteParams;
  InboxSettings: undefined;
  SnapViewer: OptionalRouteParams;
  Camera: OptionalRouteParams;
  DirectCall: {
    callId: string;
    recipientName: string;
    mode: "audio" | "video";
    isOutgoing: boolean;
  };
  VoiceChannel: {
    channelId: string;
    channelName: string;
    groupId: string;
  };
  CallSettings: undefined;
  CallInfo: {
    /** Firestore StreamCallHistory entry id (required for durable reload) */
    entryId: string;
    /** Stream call id */
    callId: string;
    /** Optional Stream session id (disambiguates multi-session reuse) */
    sessionId?: string;
  };
  UserProfile: { userId: string };
  SetStatus: undefined;
  MutualFriendsList:
    | { userId: string; targetUserId: string }
    | { userId: string }
    | undefined;
  PremiumShop: { initialTab?: string } | undefined;
  PurchaseHistory: undefined;
  CosmeticsShop: undefined;
  Customization:
    | { initialTab?: string; initialSection?: "profile" | "chat" }
    | undefined;
  ActivityFeed: undefined;
  GameLobbyV4: { inviteId: string };
  GamePlayV4: { sessionId: string; gameId?: string };
  GameOverV4: { sessionId: string };
  GameDetailV4: { gameId: string };
  GameLeaderboardV4: { gameId: string };
  GameStatsV4: undefined;
  AchievementsHub: undefined;
  AchievementSection: { sectionId: string };
  ProfileAchievements: {
    userId: string;
    displayName?: string;
    featuredIds?: string[];
  };
  LevelRewards: undefined;
  Wallet: undefined;
  GamesHub: undefined;
  GroupPermissions: { groupId: string };
  BlockedUsers: undefined;
};

export type ProfileSetupStackParamList = {
  ProfileSetup: undefined;
  OnboardingUsername: undefined;
  OnboardingPhoto: undefined;
  OnboardingDisplayStyle: undefined;
  OnboardingComplete: undefined;
};

export type RootStackParamList = AuthStackParamList &
  MainStackParamList &
  ProfileSetupStackParamList;
