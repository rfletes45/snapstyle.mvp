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
import { useAppTheme } from "@/store/ThemeContext";

// Auth screens
import LoginScreen from "@/screens/auth/LoginScreen";
import ProfileSetupScreen from "@/screens/auth/ProfileSetupScreen";
import SignupScreen from "@/screens/auth/SignupScreen";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";

// App screens
import CartCourseScreen from "@/components/games/CartCourse/CartCourseScreen";
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
import SnapSnakeGameScreen from "@/screens/games/SnapSnakeGameScreen";
import SpectatorViewScreen from "@/screens/games/SpectatorViewScreen";
import TicTacToeGameScreen from "@/screens/games/TicTacToeGameScreen";
import TileSlideGameScreen from "@/screens/games/TileSlideGameScreen";
import TimedTapGameScreen from "@/screens/games/TimedTapGameScreen";
import WordSnapGameScreen from "@/screens/games/WordSnapGameScreen";
import BadgeCollectionScreen from "@/screens/profile/BadgeCollectionScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import BlockedUsersScreen from "@/screens/settings/BlockedUsersScreen";
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
        component={ReactionTapGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TimedTapGame"
        component={TimedTapGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="BounceBlitzGame"
        component={BounceBlitzGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="MemorySnapGame"
        component={MemorySnapGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="WordSnapGame"
        component={WordSnapGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="Snap2048Game"
        component={Snap2048GameScreen}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="SnapSnakeGame"
        component={SnapSnakeGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      {/* New Single-Player Games (Phase 1) */}
      <Stack.Screen
        name="BrickBreakerGame"
        component={BrickBreakerGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="TileSlideGame"
        component={TileSlideGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TicTacToeGame"
        component={TicTacToeGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="CheckersGame"
        component={CheckersGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="ChessGame"
        component={ChessGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="CrazyEightsGame"
        component={CrazyEightsGameScreen}
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="CartCourseGame"
        component={CartCourseScreen}
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: false,
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
        component={ProfileScreen}
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
export default function RootNavigator({ navigationRef }: RootNavigatorProps) {
  const { theme } = useAppTheme();

  // For web, we need a linking configuration
  const linking = {
    prefixes: ["exp://", "exp-app://", "http://", "https://"],
    config: {
      screens: {
        Welcome: "welcome",
        Login: "login",
        Signup: "signup",
        ProfileSetup: "profile-setup",
        MainTabs: {
          screens: {
            Shop: "shop",
            Play: "play",
            Inbox: "inbox",
            Moments: "moments",
            Profile: "profile",
          },
        },
        Connections: "connections",
        ChatDetail: "chat/:friendUid",
        GroupChat: "group/:groupId",
      },
    },
  };

  return (
    <AppGate loadingMessage="Just a moment...">
      {({ hydrationState }) => (
        <NavigationContainer
          ref={navigationRef}
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
