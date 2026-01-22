import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "@/store/ThemeContext";
import AppGate from "@/components/AppGate";
import WarningModal from "@/components/WarningModal";

// Auth screens
import WelcomeScreen from "@/screens/auth/WelcomeScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignupScreen from "@/screens/auth/SignupScreen";
import ProfileSetupScreen from "@/screens/auth/ProfileSetupScreen";

// App screens
import ChatListScreen from "@/screens/chat/ChatListScreen";
import ChatScreen from "@/screens/chat/ChatScreen";
import { SnapViewerScreen } from "@/screens/chat/SnapViewerScreen";
import ScheduledMessagesScreen from "@/screens/chat/ScheduledMessagesScreen";
import StoriesScreen from "@/screens/stories/StoriesScreen";
import StoryViewerScreen from "@/screens/stories/StoryViewerScreen";
import GamesHub from "@/screens/games/GamesHub";
import ReactionTapGameScreen from "@/screens/games/ReactionTapGameScreen";
import TimedTapGameScreen from "@/screens/games/TimedTapGameScreen";
import LeaderboardScreen from "@/screens/games/LeaderboardScreen";
import AchievementsScreen from "@/screens/games/AchievementsScreen";
import FriendsScreen from "@/screens/friends/FriendsScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import DebugScreen from "@/screens/debug/DebugScreen";
import BlockedUsersScreen from "@/screens/settings/BlockedUsersScreen";
import SettingsScreen from "@/screens/settings/SettingsScreen";

// Phase 18: Economy + Tasks
import WalletScreen from "@/screens/wallet/WalletScreen";
import TasksScreen from "@/screens/tasks/TasksScreen";

// Phase 19: Shop
import ShopScreen from "@/screens/shop/ShopScreen";

// Phase 20: Group Chat
import GroupChatCreateScreen from "@/screens/groups/GroupChatCreateScreen";
import GroupChatScreen from "@/screens/groups/GroupChatScreen";
import GroupChatInfoScreen from "@/screens/groups/GroupChatInfoScreen";
import GroupInvitesScreen from "@/screens/groups/GroupInvitesScreen";

// Phase 21: Admin Screens
import AdminReportsQueueScreen from "@/screens/admin/AdminReportsQueueScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
        options={{ title: "Inbox" }}
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
        options={{ title: "Scheduled" }}
      />
      <Stack.Screen
        name="GroupChatCreate"
        component={GroupChatCreateScreen}
        options={{ title: "New Group" }}
      />
      <Stack.Screen
        name="GroupChat"
        component={GroupChatScreen}
        options={({ route }: any) => ({
          title: route.params?.groupName || "Group",
        })}
      />
      <Stack.Screen
        name="GroupChatInfo"
        component={GroupChatInfoScreen}
        options={{ title: "Group Info" }}
      />
      <Stack.Screen
        name="GroupInvites"
        component={GroupInvitesScreen}
        options={{ title: "Invites" }}
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
        component={GamesHub}
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
      <Stack.Screen
        name="Debug"
        component={DebugScreen}
        options={{ title: "Debug Info" }}
      />
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
export default function RootNavigator() {
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
        <NavigationContainer linking={linking} theme={theme.navigation}>
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
