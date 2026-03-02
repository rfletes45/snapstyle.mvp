import type { SessionEntrySource } from "@/types/gameSessionV3";
import type { NavigatorScreenParams } from "@react-navigation/native";

type OptionalRouteParams = Record<string, unknown> | undefined;

/**
 * Standard route params that any multiplayer game screen may receive when
 * entered through the v3 SessionLobbyScreen flow.
 */
export interface V3GameScreenParams {
  /** v3 session document ID (always present in v3 flow). */
  sessionId?: string;
  /**
   * When present, this is the v3 session ID string (truthy = v3 flow).
   * Game screens use this to resolve the session on game-over.
   */
  v3Session?: string;
  /** Colyseus room ID assigned by the server. */
  matchId?: string;
  /** Legacy invite doc ID (dual-write). */
  inviteId?: string;
  /** Firestore turn-based game doc ID (turnBased games only). */
  firestoreGameId?: string;
  /** How the user entered the game. */
  entryPoint?: "play" | "chat";
  /** Whether the user is spectating. */
  spectatorMode?: boolean;
}

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
  SessionLobbyScreen: {
    sessionId: string;
    source: SessionEntrySource;
  };
  SessionGameOverScreen: {
    sessionId: string;
  };
  BounceBlitzGame: OptionalRouteParams;
  WordGame: V3GameScreenParams | undefined;
  Play2048Game: OptionalRouteParams;
  LightsOutGame: V3GameScreenParams | undefined;
  BrickBreakerGame: OptionalRouteParams;
  MinesweeperGame: V3GameScreenParams | undefined;
  TicTacToeGame: V3GameScreenParams | undefined;
  CheckersGame: V3GameScreenParams | undefined;
  ChessGame: V3GameScreenParams | undefined;
  CrazyEightsGame: V3GameScreenParams | undefined;
  FourGame: V3GameScreenParams | undefined;
  DotsGame: V3GameScreenParams | undefined;
  GomokuGame: V3GameScreenParams | undefined;
  PongGame: V3GameScreenParams | undefined;
  ReversiGame: V3GameScreenParams | undefined;
  CrosswordGame: V3GameScreenParams | undefined;
  StarforgeGame: V3GameScreenParams | undefined;
  SketchPartyGameScreen: V3GameScreenParams | undefined;
  MiniGolfDuelsGame: V3GameScreenParams | undefined;
  BattleshipGame: V3GameScreenParams | undefined;
  GameDetails: { gameId: string };
  Leaderboard: { gameId?: string } | undefined;
  Achievements:
    | {
        gameId?: string;
        targetAchievementId?: string;
        /** When set, view this user's unlocked achievements (read-only) */
        profileUid?: string;
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
  BadgeCollection: { userId?: string } | undefined;
  Settings: undefined;
  Wallet: undefined;
  Tasks: { tab?: "daily" | "monthly" } | undefined;
  Shop: undefined;
  AdminReports: undefined;
  LevelRewards: undefined;
  GameStats: { userId?: string } | undefined;
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
  GameStats: { userId?: string } | undefined;
};

export type ProfileSetupStackParamList = {
  ProfileSetup: undefined;
};

export type RootStackParamList = AuthStackParamList &
  MainStackParamList &
  ProfileSetupStackParamList;
