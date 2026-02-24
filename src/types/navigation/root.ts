import type { NavigatorScreenParams } from "@react-navigation/native";

type OptionalRouteParams = Record<string, unknown> | undefined;

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ProfileSetup: undefined;
};

export type InboxStackParamList = {
  ChatList: undefined;
  ScheduledMessages: undefined;
  GroupInvites: undefined;
  InboxSettings: undefined;
  InboxSearch: undefined;
};

export type MomentsStackParamList = {
  StoriesList: undefined;
  StoryViewer: OptionalRouteParams;
};

export type PlayStackParamList = {
  GamesHub: undefined;
  BounceBlitzGame: OptionalRouteParams;
  WordGame: OptionalRouteParams;
  Play2048Game: OptionalRouteParams;
  LightsOutGame: OptionalRouteParams;
  BrickBreakerGame: OptionalRouteParams;
  TicTacToeGame: OptionalRouteParams;
  CheckersGame: OptionalRouteParams;
  ChessGame: OptionalRouteParams;
  CrazyEightsGame: OptionalRouteParams;
  FourGame: OptionalRouteParams;
  MinesweeperGame: OptionalRouteParams;
  DotsGame: OptionalRouteParams;
  GomokuGame: OptionalRouteParams;
  PongGame: OptionalRouteParams;
  ReversiGame: OptionalRouteParams;
  CrosswordGame: OptionalRouteParams;
  StarforgeGame: OptionalRouteParams;
  SketchPartyGameScreen: OptionalRouteParams;
  MiniGolfDuelsGame: OptionalRouteParams;
  BattleshipGame: OptionalRouteParams;
  GameDetails: { gameId: string };
  Leaderboard: { gameId?: string } | undefined;
  Achievements:
    | {
        gameId?: string;
        targetAchievementId?: string;
      }
    | undefined;
  GameHistory: OptionalRouteParams;
  LevelRewards: undefined;
};

export type ProfileTabStackParamList = {
  ProfileMain: undefined;
  Customization:
    | { initialTab?: string; initialSection?: "profile" | "chat" }
    | undefined;
  Debug: undefined;
  LocalStorageDebug: undefined;
  BlockedUsers: undefined;
  PrivacySettings: undefined;
  BadgeCollection: undefined;
  Settings: undefined;
  Wallet: undefined;
  Tasks: { tab?: "daily" | "monthly" } | undefined;
  Shop: undefined;
  AdminReports: undefined;
  LevelRewards: undefined;
};

export type AppTabsParamList = {
  Shop: undefined;
  Play: NavigatorScreenParams<PlayStackParamList> | undefined;
  Inbox: NavigatorScreenParams<InboxStackParamList> | undefined;
  Moments: NavigatorScreenParams<MomentsStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileTabStackParamList> | undefined;
};

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<AppTabsParamList> | undefined;
  ChatDetail:
    | {
        friendUid: string;
        friendName?: string;
        initialData?: Record<string, unknown>;
      }
    | undefined;
  GroupChat: { groupId: string; groupName?: string } | undefined;
  ThreadView: {
    conversationId: string;
    scope: "dm" | "group";
    rootMessageId: string;
  };
  GroupChatCreate: undefined;
  GroupChatInfo: { groupId: string } | undefined;
  ChatSettings: OptionalRouteParams;
  SnapViewer: OptionalRouteParams;
  Camera: OptionalRouteParams;
  CameraShare: OptionalRouteParams;
  AudioCall: OptionalRouteParams;
  VideoCall: OptionalRouteParams;
  GroupCall: OptionalRouteParams;
  CallHistory: undefined;
  CallSettings: undefined;
  Connections: undefined;
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
  SpectatorView: OptionalRouteParams;
};

export type ProfileSetupStackParamList = {
  ProfileSetup: undefined;
};

export type RootStackParamList = AuthStackParamList &
  MainStackParamList &
  ProfileSetupStackParamList;
