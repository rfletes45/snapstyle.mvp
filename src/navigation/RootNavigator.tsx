import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
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
import ChatListScreen from "@/screens/chat/ChatListScreenV2";
import ChatScreen from "@/screens/chat/ChatScreen";
import ScheduledMessagesScreen from "@/screens/chat/ScheduledMessagesScreen";
import { SnapViewerScreen } from "@/screens/chat/SnapViewerScreen";
import FriendsScreen from "@/screens/friends/FriendsScreen";
import AchievementsScreen from "@/screens/games/AchievementsScreen";
import BounceBlitzGameScreen from "@/screens/games/BounceBlitzGameScreen";
import CheckersGameScreen from "@/screens/games/CheckersGameScreen";
import ChessGameScreen from "@/screens/games/ChessGameScreen";
import CrazyEightsGameScreen from "@/screens/games/CrazyEightsGameScreen";
import FlappySnapGameScreen from "@/screens/games/FlappySnapGameScreen";
import GamesHubScreen from "@/screens/games/GamesHubScreen";
import LeaderboardScreen from "@/screens/games/LeaderboardScreen";
import MemorySnapGameScreen from "@/screens/games/MemorySnapGameScreen";
import ReactionTapGameScreen from "@/screens/games/ReactionTapGameScreen";
import Snap2048GameScreen from "@/screens/games/Snap2048GameScreen";
import SnapSnakeGameScreen from "@/screens/games/SnapSnakeGameScreen";
import TicTacToeGameScreen from "@/screens/games/TicTacToeGameScreen";
import TimedTapGameScreen from "@/screens/games/TimedTapGameScreen";
import WordSnapGameScreen from "@/screens/games/WordSnapGameScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import BlockedUsersScreen from "@/screens/settings/BlockedUsersScreen";
import SettingsScreen from "@/screens/settings/SettingsScreen";
import StoriesScreen from "@/screens/stories/StoriesScreen";
import StoryViewerScreen from "@/screens/stories/StoryViewerScreen";
// DebugScreen only loaded in development
const DebugScreen = __DEV__
  ? require("@/screens/debug/DebugScreen").default
  : () => null;

import TasksScreen from "@/screens/tasks/TasksScreen";
import WalletScreen from "@/screens/wallet/WalletScreen";

import ShopScreen from "@/screens/shop/ShopScreen";

import GroupChatCreateScreen from "@/screens/groups/GroupChatCreateScreen";
import GroupChatInfoScreen from "@/screens/groups/GroupChatInfoScreen";
import GroupChatScreen from "@/screens/groups/GroupChatScreen";
import GroupInvitesScreen from "@/screens/groups/GroupInvitesScreen";

import ChatSettingsScreen from "@/screens/chat/ChatSettingsScreen";

import InboxSearchScreen from "@/screens/chat/InboxSearchScreen";
import InboxSettingsScreen from "@/screens/chat/InboxSettingsScreen";

import AdminReportsQueueScreen from "@/screens/admin/AdminReportsQueueScreen";

const Stack = createNativeStackNavigator<any>();
const Tab = createBottomTabNavigator<any>();

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
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
 * Contains: Inbox list, DM chat, Shot viewer, scheduled, groups
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
      }}
    >
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChatDetail"
        component={ChatScreen}
        options={{ title: "Message" }}
      />
      <Stack.Screen
        name="SnapViewer"
        component={SnapViewerScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="ScheduledMessages"
        component={ScheduledMessagesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupChatCreate"
        component={GroupChatCreateScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupChat"
        component={GroupChatScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupChatInfo"
        component={GroupChatInfoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupInvites"
        component={GroupInvitesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChatSettings"
        component={ChatSettingsScreen}
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
      }}
    >
      <Stack.Screen
        name="GamesHub"
        component={GamesHubScreen}
        options={{ title: "Play" }}
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
        name="FlappySnapGame"
        component={FlappySnapGameScreen}
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
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: "Leaderboard" }}
      />
      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{ title: "Achievements" }}
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
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      {/* Debug screen only available in development */}
      {__DEV__ && (
        <Stack.Screen
          name="Debug"
          component={DebugScreen}
          options={{ title: "Debug Info" }}
        />
      )}
      <Stack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ title: "Blocked" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
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
 * Inbox | Moments | Play | Connections | Profile
 */
function AppTabs() {
  const { colors } = useAppTheme();

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
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: string = "message-outline";

          switch (route.name) {
            case "Inbox":
              iconName = "message-outline";
              break;
            case "Moments":
              iconName = "image-multiple-outline";
              break;
            case "Play":
              iconName = "gamepad-variant-outline";
              break;
            case "Connections":
              iconName = "account-group-outline";
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
        name="Inbox"
        component={InboxStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Moments"
        component={MomentsStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Play"
        component={PlayStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Connections"
        component={FriendsScreen}
        options={{ title: "Connections" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
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
 * Rebranded: Vibe app with Inbox, Moments, Play, Connections, Profile
 *
 * Navigation flow:
 * - During hydration: LoadingScreen (via AppGate)
 * - Unauthenticated: AuthStack (Welcome, Login, Signup)
 * - Needs profile: ProfileSetupStack
 * - Ready: AppTabs (main app)
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
        Inbox: "inbox",
        Moments: "moments",
        Play: "play",
        Connections: "connections",
        Profile: "profile",
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
              <AppTabs />
              <WarningModal />
            </>
          ) : hydrationState === "needs_profile" ? (
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
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
