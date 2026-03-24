import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useCallback, useMemo } from "react";
import { StyleSheet } from "react-native";

import AppGate from "@/components/AppGate";
import WarningModal from "@/components/WarningModal";
import { navigationRef } from "@/services/navigationRef";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  AppTabsParamList,
  AuthStackParamList,
  InboxStackParamList,
  MainStackParamList,
  ProfileSetupStackParamList,
  ProfileTabStackParamList,
  RootStackParamList,
} from "@/types/navigation/root";

// Auth screens
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import ProfileSetupScreen from "@/screens/auth/ProfileSetupScreen";
import SignupScreen from "@/screens/auth/SignupScreen";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";

// App screens
import ChatListScreen from "@/screens/chat/ChatListScreenV2";
import ChatScreen from "@/screens/chat/ChatScreen";
import ScheduledMessagesScreen from "@/screens/chat/ScheduledMessagesScreen";
import { SnapViewerScreen } from "@/screens/chat/SnapViewerScreen";
import ThreadScreen from "@/screens/chat/ThreadScreen";
import { CustomizationHubScreen } from "@/screens/customization";
import FriendsScreen from "@/screens/friends/FriendsScreen";
import BadgeCollectionScreen from "@/screens/profile/BadgeCollectionScreen";
import MutualFriendsListScreen from "@/screens/profile/MutualFriendsListScreen";
import OwnProfileScreen from "@/screens/profile/OwnProfileScreen";
import SetStatusScreen from "@/screens/profile/SetStatusScreen";
import UserProfileScreen from "@/screens/profile/UserProfileScreen";
import BlockedUsersScreen from "@/screens/settings/BlockedUsersScreen";
import PrivacySettingsScreen from "@/screens/settings/PrivacySettingsScreen";
import SettingsScreen from "@/screens/settings/SettingsScreen";
import ShopHubScreen from "@/screens/shop/ShopHubScreen";

// Debug screens only loaded in development
const DebugScreen = __DEV__
  ? require("@/screens/debug/DebugScreen").default
  : () => null;
const LocalStorageDebugScreen = __DEV__
  ? require("@/screens/debug/LocalStorageDebugScreen").default
  : () => null;

import TasksScreen from "@/screens/tasks/TasksScreen";
import WalletScreen from "@/screens/wallet/WalletScreen";

import CosmeticsShopScreen from "@/screens/shop/CosmeticsShopScreen";
import PremiumShopScreen from "@/screens/shop/PremiumShopScreen";
import PurchaseHistoryScreen from "@/screens/shop/PurchaseHistoryScreen";

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
import { CALL_FEATURES } from "@/constants/featureFlags";
import CameraScreen from "@/screens/camera/CameraScreen";
import CameraShareScreen from "@/screens/camera/ShareScreen";

// Game V4 screens
import AchievementSectionScreen from "@/gamesV4/screens/AchievementSectionScreen";
import AchievementsHubScreen from "@/gamesV4/screens/AchievementsHubScreen";
import GameDetailScreenV4 from "@/gamesV4/screens/GameDetailScreenV4";
import GameLeaderboardScreenV4 from "@/gamesV4/screens/GameLeaderboardScreenV4";
import GameLobbyScreenV4 from "@/gamesV4/screens/GameLobbyScreenV4";
import GameOverScreenV4 from "@/gamesV4/screens/GameOverScreenV4";
import GamePlayDispatcherV4 from "@/gamesV4/screens/GamePlayDispatcherV4";
import GamesHubScreenV4 from "@/gamesV4/screens/GamesHubScreenV4";
import GameStatsScreenV4 from "@/gamesV4/screens/GameStatsScreenV4";
import LevelRewardsScreen from "@/gamesV4/screens/LevelRewardsScreen";

// Profile screens (standalone routes)
import ProfileAchievementsScreen from "@/screens/profile/ProfileAchievementsScreen";

// Call screens (Stream-based)
import { CallSettingsScreen } from "@/screens/calls";
import CallsScreen from "@/screens/calls/CallsScreen";
// Lazy-load Stream screens to avoid native module crash in Expo Go
const DirectCallScreen = CALL_FEATURES.CALLS_ENABLED
  ? require("@/screens/stream/DirectCallScreen").default
  : () => null;
const VoiceChannelScreen = CALL_FEATURES.CALLS_ENABLED
  ? require("@/screens/stream/VoiceChannelScreen").default
  : () => null;

const AuthStack_Nav = createNativeStackNavigator<AuthStackParamList>();
const InboxStack_Nav = createNativeStackNavigator<InboxStackParamList>();
const ProfileStack_Nav = createNativeStackNavigator<ProfileTabStackParamList>();
const MainStack_Nav = createNativeStackNavigator<MainStackParamList>();
const ProfileSetupStack_Nav =
  createNativeStackNavigator<ProfileSetupStackParamList>();
const Tab = createBottomTabNavigator<AppTabsParamList>();

function AuthStack() {
  const { colors } = useAppTheme();

  return (
    <AuthStack_Nav.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: "simple_push",
      }}
    >
      <AuthStack_Nav.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack_Nav.Screen name="Login" component={LoginScreen} />
      <AuthStack_Nav.Screen name="Signup" component={SignupScreen} />
      <AuthStack_Nav.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />
      <AuthStack_Nav.Screen
        name="ProfileSetup"
        component={ProfileSetupScreen}
      />
    </AuthStack_Nav.Navigator>
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
    <InboxStack_Nav.Navigator
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
      <InboxStack_Nav.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ headerShown: false }}
      />
      <InboxStack_Nav.Screen
        name="ScheduledMessages"
        component={ScheduledMessagesScreen}
        options={{ headerShown: false }}
      />
      <InboxStack_Nav.Screen
        name="GroupInvites"
        component={GroupInvitesScreen}
        options={{ headerShown: false }}
      />
      <InboxStack_Nav.Screen
        name="InboxSettings"
        component={InboxSettingsScreen}
        options={{ headerShown: false }}
      />
      <InboxStack_Nav.Screen
        name="InboxSearch"
        component={InboxSearchScreen}
        options={{ headerShown: false }}
      />
    </InboxStack_Nav.Navigator>
  );
}

/**
 * Profile Stack with settings and economy screens
 */
function ProfileStack() {
  const { colors } = useAppTheme();

  const ProfileMainScreen = OwnProfileScreen;

  return (
    <ProfileStack_Nav.Navigator
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
      <ProfileStack_Nav.Screen
        name="ProfileMain"
        component={ProfileMainScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack_Nav.Screen
        name="Customization"
        component={CustomizationHubScreen}
        options={{ headerShown: false }}
      />
      {__DEV__ && (
        <ProfileStack_Nav.Screen
          name="Debug"
          component={DebugScreen}
          options={{ title: "Debug Info" }}
        />
      )}
      {__DEV__ && (
        <ProfileStack_Nav.Screen
          name="LocalStorageDebug"
          component={LocalStorageDebugScreen}
          options={{ title: "Local Storage Debug" }}
        />
      )}
      <ProfileStack_Nav.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ title: "Blocked" }}
      />
      <ProfileStack_Nav.Screen
        name="PrivacySettings"
        component={PrivacySettingsScreen}
        options={{ title: "Privacy Settings" }}
      />
      <ProfileStack_Nav.Screen
        name="BadgeCollection"
        component={BadgeCollectionScreen}
        options={{ title: "Badges" }}
      />
      <ProfileStack_Nav.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <ProfileStack_Nav.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack_Nav.Screen
        name="Shop"
        component={ShopHubScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack_Nav.Screen
        name="AdminReports"
        component={AdminReportsQueueScreen}
        options={{ headerShown: false }}
      />
    </ProfileStack_Nav.Navigator>
  );
}

/**
 * Main App Tabs
 * Profile | Messages | Shop
 */
function AppTabs() {
  const { colors } = useAppTheme();
  type MaterialCommunityIconName = React.ComponentProps<
    typeof MaterialCommunityIcons
  >["name"];

  const defaultTabBarStyle = {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    height: 110,
    paddingTop: 10,
    paddingBottom: 28,
  };

  const tabBarItemStyle = {
    paddingTop: 8,
    paddingBottom: 4,
  };

  return (
    <Tab.Navigator
      initialRouteName="Messages"
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
        tabBarHideOnKeyboard: true,
        tabBarStyle: defaultTabBarStyle,
        tabBarItemStyle: tabBarItemStyle,
        sceneStyle: { backgroundColor: colors.background },
        lazy: true,
        tabBarIcon: ({ color, size }) => {
          let iconName: MaterialCommunityIconName = "message-outline";

          switch (route.name) {
            case "Profile":
              iconName = "account-circle-outline";
              break;
            case "Messages":
              iconName = "message-outline";
              break;
            case "Calls":
              iconName = "phone-outline";
              break;
            case "Shop":
              iconName = "store-outline";
              break;
          }

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Messages"
        component={InboxStack}
        options={{
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Calls"
        component={CallsScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopHubScreen}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}

/**
 * Main App Stack
 * Contains AppTabs as the base and full-screen overlay screens.
 */
function MainStack() {
  const { colors } = useAppTheme();

  return (
    <MainStack_Nav.Navigator
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
      <MainStack_Nav.Screen
        name="MainTabs"
        component={AppTabs}
        options={{ headerShown: false }}
      />

      <MainStack_Nav.Screen
        name="ChatDetail"
        component={ChatScreen}
        options={{
          headerShown: false,
        }}
      />
      <MainStack_Nav.Screen
        name="GroupChat"
        component={GroupChatScreen}
        options={{
          headerShown: false,
        }}
      />
      <MainStack_Nav.Screen
        name="ThreadView"
        component={ThreadScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <MainStack_Nav.Screen
        name="GroupChatCreate"
        component={GroupChatCreateScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="GroupChatInfo"
        component={GroupChatInfoScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="ChatSettings"
        component={ChatSettingsScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="SnapViewer"
        component={SnapViewerScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />

      <MainStack_Nav.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />

      <MainStack_Nav.Screen
        name="CameraShare"
        component={CameraShareScreen}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />

      {CALL_FEATURES.CALLS_ENABLED && (
        <>
          <MainStack_Nav.Screen
            name="DirectCall"
            component={DirectCallScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              gestureEnabled: false,
              animation: "fade",
            }}
          />
          <MainStack_Nav.Screen
            name="VoiceChannel"
            component={VoiceChannelScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              gestureEnabled: false,
              animation: "fade",
            }}
          />

          <MainStack_Nav.Screen
            name="CallSettings"
            component={CallSettingsScreen}
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
        </>
      )}

      <MainStack_Nav.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ headerShown: false }}
      />

      <MainStack_Nav.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ headerShown: false }}
      />

      <MainStack_Nav.Screen
        name="SetStatus"
        component={SetStatusScreen}
        options={{ headerShown: false }}
      />

      <MainStack_Nav.Screen
        name="MutualFriendsList"
        component={MutualFriendsListScreen}
        options={{ headerShown: false }}
      />

      <MainStack_Nav.Screen
        name="CosmeticsShop"
        component={CosmeticsShopScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="PremiumShop"
        component={PremiumShopScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="PurchaseHistory"
        component={PurchaseHistoryScreen}
        options={{ headerShown: false }}
      />

      <MainStack_Nav.Screen
        name="Customization"
        component={CustomizationHubScreen}
        options={{ headerShown: false }}
      />

      <MainStack_Nav.Screen
        name="ActivityFeed"
        component={ActivityFeedScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="GameLobbyV4"
        component={GameLobbyScreenV4}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="GamesHub"
        component={GamesHubScreenV4}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="GamePlayV4"
        component={GamePlayDispatcherV4}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="GameOverV4"
        component={GameOverScreenV4}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="GameDetailV4"
        component={GameDetailScreenV4}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="GameLeaderboardV4"
        component={GameLeaderboardScreenV4}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="GameStatsV4"
        component={GameStatsScreenV4}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="AchievementsHub"
        component={AchievementsHubScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="AchievementSection"
        component={AchievementSectionScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="ProfileAchievements"
        component={ProfileAchievementsScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="LevelRewards"
        component={LevelRewardsScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ headerShown: false }}
      />
    </MainStack_Nav.Navigator>
  );
}

interface RootNavigatorProps {
  navigationRef?: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
}

/**
 * RootNavigator
 * Uses AppGate for hydration-safe navigation
 * Three-tab layout: Profile, Messages, Shop
 */
export default function RootNavigator({
  navigationRef: externalRef,
}: RootNavigatorProps) {
  const { theme } = useAppTheme();
  const { setCurrentScreen } = useInAppNotifications();

  const navRef = externalRef || navigationRef;

  // Track the active route name for context-aware notification suppression
  const handleStateChange = useCallback(() => {
    if (!navRef || !("current" in navRef)) return;
    const currentRef = (navRef as React.RefObject<NavigationContainerRef<any>>)
      .current;
    if (!currentRef) return;
    const route = currentRef.getCurrentRoute();
    if (route?.name) {
      setCurrentScreen(route.name);
    }
  }, [navRef, setCurrentScreen]);

  const linking = useMemo(
    () => ({
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
              Profile: {
                screens: {
                  ProfileMain: "profile",
                  Settings: "settings",
                  BadgeCollection: "badges",
                },
              },
              Messages: {
                screens: {
                  ChatList: "messages",
                },
              },
              Calls: "calls",
              Shop: "shop",
            },
          },
          Friends: "friends",
          ChatDetail: "chat/:friendUid",
          GroupChat: "group/:groupId",
          UserProfile: "user/:userId",
          ActivityFeed: "activity",
          GameLobbyV4: "game/lobby/:inviteId",
          GamesHub: "games",
          GamePlayV4: "game/play/:sessionId",
          GameOverV4: "game/over/:sessionId",
          GameDetailV4: "game/detail/:gameId",
          GameLeaderboardV4: "game/leaderboard/:gameId",
          GameStatsV4: "game/stats",
          Wallet: "wallet",
        },
      },
    }),
    [],
  );

  return (
    <AppGate loadingMessage="Just a moment...">
      {({ hydrationState }) => (
        <NavigationContainer
          ref={navRef}
          linking={linking}
          theme={theme.navigation}
          onStateChange={handleStateChange}
        >
          {hydrationState === "ready" ? (
            <>
              <MainStack />
              <WarningModal />
            </>
          ) : hydrationState === "needs_profile" ? (
            <ProfileSetupStack_Nav.Navigator
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: theme.navigation.colors.background,
                },
                animation: "simple_push",
              }}
            >
              <ProfileSetupStack_Nav.Screen
                name="ProfileSetup"
                component={ProfileSetupScreen}
              />
            </ProfileSetupStack_Nav.Navigator>
          ) : (
            <AuthStack />
          )}
        </NavigationContainer>
      )}
    </AppGate>
  );
}
