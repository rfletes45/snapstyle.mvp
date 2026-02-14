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
  ReactionTapGame: OptionalRouteParams;
  TimedTapGame: OptionalRouteParams;
  BounceBlitzGame: OptionalRouteParams;
  WordGame: OptionalRouteParams;
  Play2048Game: OptionalRouteParams;
  BrickBreakerGame: OptionalRouteParams;
  TicTacToeGame: OptionalRouteParams;
  CheckersGame: OptionalRouteParams;
  ChessGame: OptionalRouteParams;
  CrazyEightsGame: OptionalRouteParams;
  FourGame: OptionalRouteParams;
  MinesweeperGame: OptionalRouteParams;
  DotsGame: OptionalRouteParams;
  LightsGame: OptionalRouteParams;
  GomokuGame: OptionalRouteParams;
  AirHockeyGame: OptionalRouteParams;
  TropicalFishingGame: OptionalRouteParams;
  PoolGame: OptionalRouteParams;
  PongGame: OptionalRouteParams;
  ReversiGame: OptionalRouteParams;
  CrosswordGame: OptionalRouteParams;
  StarforgeGame: OptionalRouteParams;
  GolfDuelsGame: OptionalRouteParams;
  Leaderboard: { gameId?: string } | undefined;
  Achievements: { gameId?: string } | undefined;
  GameHistory: OptionalRouteParams;
};

export type ProfileTabStackParamList = {
  ProfileMain: undefined;
  Debug: undefined;
  LocalStorageDebug: undefined;
  BlockedUsers: undefined;
  PrivacySettings: undefined;
  BadgeCollection: undefined;
  Settings: undefined;
  ThemeSettings: undefined;
  Wallet: undefined;
  Tasks: undefined;
  Shop: undefined;
  AdminReports: undefined;
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
  PointsShop: { initialCategory?: string } | undefined;
  PremiumShop: { initialTab?: string } | undefined;
  PurchaseHistory: undefined;
  ActivityFeed: undefined;
  SpectatorView: OptionalRouteParams;
};

export type ProfileSetupStackParamList = {
  ProfileSetup: undefined;
};

export type RootStackParamList = AuthStackParamList &
  MainStackParamList &
  ProfileSetupStackParamList;
