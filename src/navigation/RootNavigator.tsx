import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  getFocusedRouteNameFromRoute,
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import AppGate from "@/components/AppGate";
import WarningModal from "@/components/WarningModal";
import { navigationRef } from "@/services/navigationRef";
import { useAppTheme } from "@/store/ThemeContext";

// Auth screens
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import ProfileSetupScreen from "@/screens/auth/ProfileSetupScreen";
import SignupScreen from "@/screens/auth/SignupScreen";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";

// App screens
import CartCourseScreen from "@/components/games/CartCourse/CartCourseScreen";
import { withErrorBoundary } from "@/components/withErrorBoundary";
import { PROFILE_FEATURES } from "@/constants/featureFlags";
import ChatListScreen from "@/screens/chat/ChatListScreenV2";
import ChatScreen from "@/screens/chat/ChatScreen";
import ScheduledMessagesScreen from "@/screens/chat/ScheduledMessagesScreen";
import { SnapViewerScreen } from "@/screens/chat/SnapViewerScreen";
import FriendsScreen from "@/screens/friends/FriendsScreen";
import AchievementsScreen from "@/screens/games/AchievementsScreen";
import BounceBlitzGameScreen from "@/screens/games/BounceBlitzGameScreen";
import BrickBreakerGameScreen from "@/screens/games/BrickBreakerGameScreen";
import CheckersGameScreen from "@/screens/games/CheckersGameScreen";
import ChessGameScreen from "@/screens/games/ChessGameScreen";
import CrazyEightsGameScreen from "@/screens/games/CrazyEightsGameScreen";
import GameHistoryScreen from "@/screens/games/GameHistoryScreen";
import GamesHubScreen from "@/screens/games/GamesHubScreen";
import LeaderboardScreen from "@/screens/games/LeaderboardScreen";
import MemorySnapGameScreen from "@/screens/games/MemorySnapGameScreen";
import ReactionTapGameScreen from "@/screens/games/ReactionTapGameScreen";
import Snap2048GameScreen from "@/screens/games/Snap2048GameScreen";
import SnapAimGameScreen from "@/screens/games/SnapAimGameScreen";
import SnapDotsGameScreen from "@/screens/games/SnapDotsGameScreen";
import SnapFourGameScreen from "@/screens/games/SnapFourGameScreen";
import SnapGomokuGameScreen from "@/screens/games/SnapGomokuGameScreen";
import SnapLightsGameScreen from "@/screens/games/SnapLightsGameScreen";
import SnapMinesweeperGameScreen from "@/screens/games/SnapMinesweeperGameScreen";
import SnapNumberGameScreen from "@/screens/games/SnapNumberGameScreen";
import SnapSnakeGameScreen from "@/screens/games/SnapSnakeGameScreen";
import SnapStackGameScreen from "@/screens/games/SnapStackGameScreen";
import SpectatorViewScreen from "@/screens/games/SpectatorViewScreen";
import TicTacToeGameScreen from "@/screens/games/TicTacToeGameScreen";
import TileSlideGameScreen from "@/screens/games/TileSlideGameScreen";
import TimedTapGameScreen from "@/screens/games/TimedTapGameScreen";
import WordSnapGameScreen from "@/screens/games/WordSnapGameScreen";
// Phase 3 game screens
import SnapCrosswordGameScreen from "@/screens/games/SnapCrosswordGameScreen";
import SnapDrawGameScreen from "@/screens/games/SnapDrawGameScreen";
import SnapHexGameScreen from "@/screens/games/SnapHexGameScreen";
import SnapMatchGameScreen from "@/screens/games/SnapMatchGameScreen";
import SnapNonogramGameScreen from "@/screens/games/SnapNonogramGameScreen";
import SnapPipesGameScreen from "@/screens/games/SnapPipesGameScreen";
import SnapPongGameScreen from "@/screens/games/SnapPongGameScreen";
import SnapRaceGameScreen from "@/screens/games/SnapRaceGameScreen";
import SnapReversiGameScreen from "@/screens/games/SnapReversiGameScreen";
import SnapSliceGameScreen from "@/screens/games/SnapSliceGameScreen";
import SnapWarGameScreen from "@/screens/games/SnapWarGameScreen";
import SnapWordsGameScreen from "@/screens/games/SnapWordsGameScreen";
import TapTapSnapGameScreen from "@/screens/games/TapTapSnapGameScreen";
import BadgeCollectionScreen from "@/screens/profile/BadgeCollectionScreen";
import MutualFriendsListScreen from "@/screens/profile/MutualFriendsListScreen";
import OwnProfileScreen from "@/screens/profile/OwnProfileScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import SetStatusScreen from "@/screens/profile/SetStatusScreen";
import UserProfileScreen from "@/screens/profile/UserProfileScreen";
import BlockedUsersScreen from "@/screens/settings/BlockedUsersScreen";
import PrivacySettingsScreen from "@/screens/settings/PrivacySettingsScreen";
import SettingsScreen from "@/screens/settings/SettingsScreen";
import ThemeSettingsScreen from "@/screens/settings/ThemeSettingsScreen";
import StoriesScreen from "@/screens/stories/StoriesScreen";
import StoryViewerScreen from "@/screens/stories/StoryViewerScreen";
// DebugScreens only loaded in development
const DebugScreen = __DEV__
  ? require("@/screens/debug/DebugScreen").default
  : () => null;
const LocalStorageDebugScreen = __DEV__
  ? require("@/screens/debug/LocalStorageDebugScreen").default
  : () => null;

import TasksScreen from "@/screens/tasks/TasksScreen";
import WalletScreen from "@/screens/wallet/WalletScreen";

import { SHOP_FEATURES } from "@/constants/featureFlags";
import PointsShopScreen from "@/screens/shop/PointsShopScreen";
import PremiumShopScreen from "@/screens/shop/PremiumShopScreen";
import PurchaseHistoryScreen from "@/screens/shop/PurchaseHistoryScreen";
import ShopHubScreen from "@/screens/shop/ShopHubScreen";
import ShopScreen from "@/screens/shop/ShopScreen";

import GroupChatCreateScreen from "@/screens/groups/GroupChatCreateScreen";
import GroupChatInfoScreen from "@/screens/groups/GroupChatInfoScreen";
import GroupChatScreen from "@/screens/groups/GroupChatScreen";
import GroupInvitesScreen from "@/screens/groups/GroupInvitesScreen";

import ChatSettingsScreen from "@/screens/chat/ChatSettingsScreen";

import InboxSearchScreen from "@/screens/chat/InboxSearchScreen";
import InboxSettingsScreen from "@/screens/chat/InboxSettingsScreen";

import AdminReportsQueueScreen from "@/screens/admin/AdminReportsQueueScreen";

// Social screens
import ActivityFeedScreen from "@/screens/social/ActivityFeedScreen";

// Camera screens
import CameraScreen from "@/screens/camera/CameraScreen";
import CameraShareScreen from "@/screens/camera/ShareScreen";

// Call screens
import {
  AudioCallScreen,
  CallHistoryScreen,
  CallSettingsScreen,
  GroupCallScreen,
  VideoCallScreen,
} from "@/screens/calls";

const Stack = createNativeStackNavigator<any>();
const Tab = createBottomTabNavigator<any>();

// Wrap game screens with ErrorBoundary to prevent crashes from bubbling up
const SafeBounceBlitzGame = withErrorBoundary(BounceBlitzGameScreen);
const SafeBrickBreakerGame = withErrorBoundary(BrickBreakerGameScreen);
const SafeCheckersGame = withErrorBoundary(CheckersGameScreen);
const SafeChessGame = withErrorBoundary(ChessGameScreen);
const SafeCrazyEightsGame = withErrorBoundary(CrazyEightsGameScreen);
const SafeMemorySnapGame = withErrorBoundary(MemorySnapGameScreen);
const SafeReactionTapGame = withErrorBoundary(ReactionTapGameScreen);
const SafeSnap2048Game = withErrorBoundary(Snap2048GameScreen);
const SafeSnapSnakeGame = withErrorBoundary(SnapSnakeGameScreen);
const SafeTicTacToeGame = withErrorBoundary(TicTacToeGameScreen);
const SafeTileSlideGame = withErrorBoundary(TileSlideGameScreen);
const SafeTimedTapGame = withErrorBoundary(TimedTapGameScreen);
const SafeWordSnapGame = withErrorBoundary(WordSnapGameScreen);
const SafeCartCourseGame = withErrorBoundary(CartCourseScreen);
const SafeSnapStackGame = withErrorBoundary(SnapStackGameScreen);
const SafeSnapFourGame = withErrorBoundary(SnapFourGameScreen);
const SafeSnapMinesweeperGame = withErrorBoundary(SnapMinesweeperGameScreen);
const SafeSnapNumberGame = withErrorBoundary(SnapNumberGameScreen);
const SafeSnapDotsGame = withErrorBoundary(SnapDotsGameScreen);
const SafeSnapAimGame = withErrorBoundary(SnapAimGameScreen);
const SafeSnapLightsGame = withErrorBoundary(SnapLightsGameScreen);
const SafeSnapGomokuGame = withErrorBoundary(SnapGomokuGameScreen);
// Phase 3 safe wrappers
const SafeSnapPongGame = withErrorBoundary(SnapPongGameScreen);
const SafeSnapWarGame = withErrorBoundary(SnapWarGameScreen);
const SafeSnapReversiGame = withErrorBoundary(SnapReversiGameScreen);
const SafeSnapCrosswordGame = withErrorBoundary(SnapCrosswordGameScreen);
const SafeSnapPipesGame = withErrorBoundary(SnapPipesGameScreen);
const SafeSnapNonogramGame = withErrorBoundary(SnapNonogramGameScreen);
const SafeTapTapSnapGame = withErrorBoundary(TapTapSnapGameScreen);
const SafeSnapSliceGame = withErrorBoundary(SnapSliceGameScreen);
const SafeSnapRaceGame = withErrorBoundary(SnapRaceGameScreen);
const SafeSnapHexGame = withErrorBoundary(SnapHexGameScreen);
const SafeSnapDrawGame = withErrorBoundary(SnapDrawGameScreen);
const SafeSnapMatchGame = withErrorBoundary(SnapMatchGameScreen);
const SafeSnapWordsGame = withErrorBoundary(SnapWordsGameScreen);

/**
 * Routes that should hide the bottom tab bar.
 * NOTE: Most full-screen routes (ChatDetail, GroupChat, etc.) are now at the
 * root stack level and naturally overlay the tabs. This set is only for
 * routes that remain nested within tab stacks.
 */
const ROUTES_WITH_HIDDEN_TAB_BAR = new Set([
  // Moments stack routes
  "StoryViewer",
  "CreateStory",
  // Game screens in PlayStack - hide tab bar for immersive gameplay
  "ReactionTapGame",
  "TimedTapGame",
  "BounceBlitzGame",
  "MemorySnapGame",
  "WordSnapGame",
  "Snap2048Game",
  "SnapSnakeGame",
  "BrickBreakerGame",
  "TileSlideGame",
  "TicTacToeGame",
  "CheckersGame",
  "ChessGame",
  "CrazyEightsGame",
  "CartCourseGame",
  "SnapStackGame",
  "SnapFourGame",
  "SnapMinesweeperGame",
  "SnapNumberGame",
  "SnapDotsGame",
  "SnapAimGame",
  "SnapLightsGame",
  "SnapGomokuGame",
  // Phase 3 game screens
  "SnapPongGame",
  "SnapWarGame",
  "SnapReversiGame",
  "SnapCrosswordGame",
  "SnapPipesGame",
  "SnapNonogramGame",
  "TapTapSnapGame",
  "SnapSliceGame",
  "SnapRaceGame",
  "SnapHexGame",
  "SnapDrawGame",
  "SnapMatchGame",
  "SnapWordsGame",
  "SpectatorView",
  "Leaderboard",
  "Achievements",
  "GameHistory",
]);

/**
 * Helper to get the tab bar style based on the focused route in a nested stack.
 * NOTE: With the new architecture where chat screens are at the root level,
 * this is only needed for screens that remain in nested stacks (like StoryViewer).
 */
function getTabBarStyle(route: any, defaultStyle: any) {
  const routeName = getFocusedRouteNameFromRoute(route);

  // If we're on a route that should hide the tab bar, return hidden style
  if (routeName && ROUTES_WITH_HIDDEN_TAB_BAR.has(routeName)) {
    return {
      display: "none" as const,
      height: 0,
    };
  }

  // Otherwise return the default tab bar style
  return defaultStyle;
}

function AuthStack() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: "simple_push",
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}

/**
 * Inbox Stack (rebranded from Chat)
 * Contains only the list screen - chat detail screens are at root level
 * to allow them to slide over the tab bar smoothly.
 */
function InboxStack() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBackground,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: "simple_push",
      }}
    >
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ScheduledMessages"
        component={ScheduledMessagesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupInvites"
        component={GroupInvitesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="InboxSettings"
        component={InboxSettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="InboxSearch"
        component={InboxSearchScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

/**
 * Moments Stack (rebranded from Stories)
 */
function MomentsStack() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBackground,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: "simple_push",
      }}
    >
      <Stack.Screen
        name="StoriesList"
        component={StoriesScreen}
        options={{ title: "Moments" }}
      />
      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
    </Stack.Navigator>
  );
}

/**
 * Play Stack (rebranded from Games)
 */
function PlayStack() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBackground,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: "simple_push",
      }}
    >
      <Stack.Screen
        name="GamesHub"
        component={GamesHubScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ReactionTapGame"
        component={SafeReactionTapGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TimedTapGame"
        component={SafeTimedTapGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="BounceBlitzGame"
        component={SafeBounceBlitzGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="MemorySnapGame"
        component={SafeMemorySnapGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="WordSnapGame"
        component={SafeWordSnapGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="Snap2048Game"
        component={SafeSnap2048Game}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="SnapSnakeGame"
        component={SafeSnapSnakeGame}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      {/* New Single-Player Games (Phase 1) */}
      <Stack.Screen
        name="BrickBreakerGame"
        component={SafeBrickBreakerGame}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="TileSlideGame"
        component={SafeTileSlideGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TicTacToeGame"
        component={SafeTicTacToeGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="CheckersGame"
        component={SafeCheckersGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="ChessGame"
        component={SafeChessGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="CrazyEightsGame"
        component={SafeCrazyEightsGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="CartCourseGame"
        component={SafeCartCourseGame}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      {/* New Phase 2 Games */}
      <Stack.Screen
        name="SnapStackGame"
        component={SafeSnapStackGame}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="SnapFourGame"
        component={SafeSnapFourGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapMinesweeperGame"
        component={SafeSnapMinesweeperGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapNumberGame"
        component={SafeSnapNumberGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapDotsGame"
        component={SafeSnapDotsGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapAimGame"
        component={SafeSnapAimGame}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="SnapLightsGame"
        component={SafeSnapLightsGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapGomokuGame"
        component={SafeSnapGomokuGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      {/* Phase 3 Games */}
      <Stack.Screen
        name="SnapPongGame"
        component={SafeSnapPongGame}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="SnapWarGame"
        component={SafeSnapWarGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapReversiGame"
        component={SafeSnapReversiGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapCrosswordGame"
        component={SafeSnapCrosswordGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapPipesGame"
        component={SafeSnapPipesGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapNonogramGame"
        component={SafeSnapNonogramGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TapTapSnapGame"
        component={SafeTapTapSnapGame}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="SnapSliceGame"
        component={SafeSnapSliceGame}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="SnapRaceGame"
        component={SafeSnapRaceGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapHexGame"
        component={SafeSnapHexGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapDrawGame"
        component={SafeSnapDrawGame}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="SnapMatchGame"
        component={SafeSnapMatchGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SnapWordsGame"
        component={SafeSnapWordsGame}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      {/* Spectator View for watching single-player games */}
      <Stack.Screen
        name="SpectatorView"
        component={SpectatorViewScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GameHistory"
        component={GameHistoryScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

/**
 * Profile Stack with settings and economy screens
 */
function ProfileStack() {
  const { colors } = useAppTheme();

  // Use new OwnProfileScreen when feature flag is enabled
  const ProfileMainScreen = PROFILE_FEATURES.NEW_PROFILE_LAYOUT
    ? OwnProfileScreen
    : ProfileScreen;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBackground,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: "simple_push",
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={ProfileMainScreen}
        options={{ headerShown: false }}
      />
      {/* Debug screens only available in development */}
      {__DEV__ && (
        <Stack.Screen
          name="Debug"
          component={DebugScreen}
          options={{ title: "Debug Info" }}
        />
      )}
      {__DEV__ && (
        <Stack.Screen
          name="LocalStorageDebug"
          component={LocalStorageDebugScreen}
          options={{ title: "Local Storage Debug" }}
        />
      )}
      <Stack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ title: "Blocked" }}
      />
      <Stack.Screen
        name="PrivacySettings"
        component={PrivacySettingsScreen}
        options={{ title: "Privacy Settings" }}
      />
      <Stack.Screen
        name="BadgeCollection"
        component={BadgeCollectionScreen}
        options={{ title: "Badges" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Shop"
        component={ShopScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminReports"
        component={AdminReportsQueueScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

/**
 * Main App Tabs - Rebranded
 * Shop | Play | Inbox | Moments | Profile
 */
function AppTabs() {
  const { colors } = useAppTheme();

  // Default tab bar style
  const defaultTabBarStyle = {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  };

  return (
    <Tab.Navigator
      initialRouteName="Inbox"
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.headerBackground,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        // Hide tab bar when keyboard is shown (prevents jump on iOS)
        tabBarHideOnKeyboard: true,
        tabBarStyle: defaultTabBarStyle,
        // Set scene container background to prevent white flicker
        sceneStyle: { backgroundColor: colors.background },
        // Improves performance by keeping screens mounted but frozen
        lazy: true,
        tabBarIcon: ({ color, size }) => {
          let iconName: string = "message-outline";

          switch (route.name) {
            case "Shop":
              iconName = "store-outline";
              break;
            case "Play":
              iconName = "gamepad-variant-outline";
              break;
            case "Inbox":
              iconName = "message-outline";
              break;
            case "Moments":
              iconName = "image-multiple-outline";
              break;
            case "Profile":
              iconName = "account-circle-outline";
              break;
          }

          return (
            <MaterialCommunityIcons
              name={iconName as any}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Shop"
        component={SHOP_FEATURES.SHOP_HUB ? ShopHubScreen : ShopScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Play"
        component={PlayStack}
        options={({ route }) => ({
          headerShown: false,
          tabBarStyle: getTabBarStyle(route, defaultTabBarStyle),
        })}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxStack}
        options={{
          headerShown: false,
          // Tab bar always visible - chat screens slide over from root level
        }}
      />
      <Tab.Screen
        name="Moments"
        component={MomentsStack}
        options={({ route }) => ({
          headerShown: false,
          tabBarStyle: getTabBarStyle(route, defaultTabBarStyle),
        })}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={({ route }) => ({
          headerShown: false,
          tabBarStyle: getTabBarStyle(route, defaultTabBarStyle),
        })}
      />
    </Tab.Navigator>
  );
}

/**
 * Main App Stack
 * Contains AppTabs as the base and full-screen overlay screens.
 * This architecture ensures chat/game screens slide OVER the tab bar
 * instead of being constrained within the tab's content area.
 */
function MainStack() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBackground,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        // Use simple_push animation - no rounded corners like iOS card style
        animation: "simple_push",
      }}
    >
      {/* Main tabs as the base screen */}
      <Stack.Screen
        name="MainTabs"
        component={AppTabs}
        options={{ headerShown: false }}
      />

      {/* Full-screen chat screens - slide over tabs */}
      <Stack.Screen
        name="ChatDetail"
        component={ChatScreen}
        options={{
          title: "Message",
        }}
      />
      <Stack.Screen
        name="GroupChat"
        component={GroupChatScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="GroupChatCreate"
        component={GroupChatCreateScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupChatInfo"
        component={GroupChatInfoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChatSettings"
        component={ChatSettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SnapViewer"
        component={SnapViewerScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />

      {/* Camera screens - full-screen immersive experience */}
      <Stack.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="CameraShare"
        component={CameraShareScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      {/* Call screens - full-screen overlay during calls */}
      <Stack.Screen
        name="AudioCall"
        component={AudioCallScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          gestureEnabled: false, // Prevent accidental swipe-to-dismiss
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="VideoCall"
        component={VideoCallScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          gestureEnabled: false, // Prevent accidental swipe-to-dismiss
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="GroupCall"
        component={GroupCallScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          gestureEnabled: false, // Prevent accidental swipe-to-dismiss during group calls
          animation: "fade",
        }}
      />

      {/* Call History - accessible from profile/settings */}
      <Stack.Screen
        name="CallHistory"
        component={CallHistoryScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      {/* Call Settings - accessible from settings */}
      <Stack.Screen
        name="CallSettings"
        component={CallSettingsScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      {/* Connections screen - accessible from Inbox header */}
      <Stack.Screen
        name="Connections"
        component={FriendsScreen}
        options={{ title: "Connections" }}
      />

      {/* User Profile screen - view other users' profiles */}
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ headerShown: false }}
      />

      {/* Set Status screen - Phase 6 */}
      <Stack.Screen
        name="SetStatus"
        component={SetStatusScreen}
        options={{ headerShown: false }}
      />

      {/* Mutual Friends List screen - Phase 6 */}
      <Stack.Screen
        name="MutualFriendsList"
        component={MutualFriendsListScreen}
        options={{ headerShown: false }}
      />

      {/* Shop Overhaul Screens - accessible from Shop tab */}
      <Stack.Screen
        name="PointsShop"
        component={PointsShopScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PremiumShop"
        component={PremiumShopScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PurchaseHistory"
        component={PurchaseHistoryScreen}
        options={{ headerShown: false }}
      />

      {/* Activity Feed */}
      <Stack.Screen
        name="ActivityFeed"
        component={ActivityFeedScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

/**
 * RootNavigator Props
 */
interface RootNavigatorProps {
  /** Ref to access navigation from outside NavigationContainer */
  navigationRef?: React.RefObject<NavigationContainerRef<any> | null>;
}

/**
 * RootNavigator
 * Uses AppGate for hydration-safe navigation
 * Rebranded: Vibe app with Shop, Play, Inbox, Moments, Profile
 *
 * Navigation flow:
 * - During hydration: LoadingScreen (via AppGate)
 * - Unauthenticated: AuthStack (Welcome, Login, Signup)
 * - Needs profile: ProfileSetupStack
 * - Ready: MainStack (tabs + full-screen overlays)
 */
export default function RootNavigator({
  navigationRef: externalRef,
}: RootNavigatorProps) {
  const { theme } = useAppTheme();

  // Use external ref if provided, otherwise use the shared global one
  const navRef = externalRef || navigationRef;

  // For web, we need a linking configuration
  const linking = {
    prefixes: ["exp://", "exp-app://", "vibe://", "http://", "https://"],
    config: {
      screens: {
        Welcome: "welcome",
        Login: "login",
        Signup: "signup",
        ForgotPassword: "forgot-password",
        ProfileSetup: "profile-setup",
        MainTabs: {
          screens: {
            Shop: "shop",
            Play: {
              screens: {
                GamesHub: "play",
                Leaderboard: "leaderboard",
                Achievements: "achievements",
              },
            },
            Inbox: {
              screens: {
                ChatList: "inbox",
              },
            },
            Moments: "moments",
            Profile: {
              screens: {
                ProfileMain: "profile",
                Settings: "settings",
                BadgeCollection: "badges",
                Wallet: "wallet",
              },
            },
          },
        },
        Connections: "connections",
        ChatDetail: "chat/:friendUid",
        GroupChat: "group/:groupId",
        UserProfile: "user/:userId",
        ActivityFeed: "activity",
      },
    },
  };

  return (
    <AppGate loadingMessage="Just a moment...">
      {({ hydrationState }) => (
        <NavigationContainer
          ref={navRef}
          linking={linking}
          theme={theme.navigation}
        >
          {hydrationState === "ready" ? (
            <>
              <MainStack />
              <WarningModal />
            </>
          ) : hydrationState === "needs_profile" ? (
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: theme.navigation.colors.background,
                },
                animation: "simple_push",
              }}
            >
              <Stack.Screen
                name="ProfileSetup"
                component={ProfileSetupScreen}
              />
            </Stack.Navigator>
          ) : (
            <AuthStack />
          )}
        </NavigationContainer>
      )}
    </AppGate>
  );
}
