import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  NavigationContainer,
  NavigationContainerRef,
  useNavigation,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Linking, StyleSheet } from "react-native";

import type { HydrationState } from "@/components/AppGate";
import AppGate from "@/components/AppGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import WarningModal from "@/components/WarningModal";
import { ComposerSheetProvider } from "@/contexts/ComposerSheetContext";
import { parseInviteUrl } from "@/services/invites";
import { clearLastOpenChat, getLastOpenChat } from "@/services/lastOpenChat";
import {
  flushPendingNavigation,
  navigate as navigateExternal,
  navigationRef,
} from "@/services/navigationRef";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import type {
  AppTabsParamList,
  AuthStackParamList,
  InboxStackParamList,
  MainStackParamList,
  ProfileSetupStackParamList,
  ProfileTabStackParamList,
  RootStackParamList,
} from "@/types/navigation/root";
import {
  logStartupEvent,
  logStartupMount,
  logStartupUnmount,
} from "@/utils/startupTrace";

// Auth screens
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignupEmailScreen from "@/screens/auth/SignupEmailScreen";
import SignupPasswordScreen from "@/screens/auth/SignupPasswordScreen";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";

// Onboarding screens (post-auth, pre-profile)
import OnboardingCompleteScreen from "@/screens/onboarding/OnboardingCompleteScreen";
import OnboardingDisplayStyleScreen from "@/screens/onboarding/OnboardingDisplayStyleScreen";
import OnboardingPhotoScreen from "@/screens/onboarding/OnboardingPhotoScreen";
import OnboardingUsernameScreen from "@/screens/onboarding/OnboardingUsernameScreen";

// Onboarding state providers
import { OnboardingProvider } from "@/store/OnboardingContext";
import { SignupProvider } from "@/store/SignupContext";

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
import NotificationSettingsScreen from "@/screens/settings/NotificationSettingsScreen";
import PrivacySettingsScreen from "@/screens/settings/PrivacySettingsScreen";
import SettingsScreen from "@/screens/settings/SettingsScreen";
import ShopHubScreen from "@/screens/shop/ShopHubScreen";

import TasksScreen from "@/screens/tasks/TasksScreen";
import WalletScreen from "@/screens/wallet/WalletScreen";

import CosmeticsShopScreen from "@/screens/shop/CosmeticsShopScreen";
import PremiumShopScreen from "@/screens/shop/PremiumShopScreen";
import PurchaseHistoryScreen from "@/screens/shop/PurchaseHistoryScreen";

import GroupChatCreateScreen from "@/screens/groups/GroupChatCreateScreen";
import GroupChatInfoScreen from "@/screens/groups/GroupChatInfoScreen";
import GroupChatScreen from "@/screens/groups/GroupChatScreen";
import GroupInvitesScreen from "@/screens/groups/GroupInvitesScreen";
import GroupPermissionsScreen from "@/screens/groups/GroupPermissionsScreen";

import ChatSettingsScreen from "@/screens/chat/ChatSettingsScreen";

import InboxSettingsScreen from "@/screens/chat/InboxSettingsScreen";

import AdminReportsQueueScreen from "@/screens/admin/AdminReportsQueueScreen";

// Social screens
import ActivityFeedScreen from "@/screens/social/ActivityFeedScreen";

// Camera screens
import { CALL_FEATURES } from "@/constants/featureFlags";

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
import { CallInfoScreen, CallSettingsScreen } from "@/screens/calls";
import CallsScreen from "@/screens/calls/CallsScreen";
// Lazy-load Stream screens to avoid native module crash in Expo Go
const DirectCallScreen = CALL_FEATURES.CALLS_ENABLED
  ? require("@/screens/stream/DirectCallScreen").default
  : () => null;
const VoiceChannelScreen = CALL_FEATURES.CALLS_ENABLED
  ? require("@/screens/stream/VoiceChannelScreen").default
  : () => null;
function CameraScreen(props: any) {
  const Screen = require("@/screens/camera/CameraScreen").default;
  return <Screen {...props} />;
}

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
    <SignupProvider>
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
        <AuthStack_Nav.Screen
          name="SignupEmail"
          component={SignupEmailScreen}
        />
        <AuthStack_Nav.Screen
          name="SignupPassword"
          component={SignupPasswordScreen}
        />
        <AuthStack_Nav.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
        />
      </AuthStack_Nav.Navigator>
    </SignupProvider>
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
      <ProfileStack_Nav.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack_Nav.Screen
        name="PrivacySettings"
        component={PrivacySettingsScreen}
        options={{ title: "Privacy Settings" }}
      />
      <ProfileStack_Nav.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack_Nav.Screen
        name="BadgeCollection"
        component={BadgeCollectionScreen}
        options={{ title: "Badges" }}
      />
      <ProfileStack_Nav.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
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
 * Messages | Calls | Profile
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
          }

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
      })}
    >
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
        name="Profile"
        component={ProfileStack}
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
  const navigation = useNavigation<any>();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    logStartupMount("MainStack");
    return () => {
      logStartupUnmount("MainStack");
    };
  }, []);

  // Resume last open chat on app reopen (one-shot on mount)
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    getLastOpenChat().then((state) => {
      if (!state) {
        logStartupEvent("MainStack restore skipped", {
          reason: "no_last_open_chat",
        });
        return;
      }

      logStartupEvent("MainStack restoring last open chat", {
        screen: state.screen,
        params: state.params,
      });

      // Clear immediately so we don't restore again on next mount
      clearLastOpenChat();
      // Navigate to the persisted chat screen
      navigation.navigate(state.screen, state.params);
    });
  }, [navigation]);

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
        // OPTIMIZATION: Freeze inactive screens in the back stack.
        // When navigating Chat → Thread or Chat → GroupInfo, the chat
        // screen is frozen (no React re-renders, no effects, no state
        // updates) until it regains focus. This makes return-to-chat
        // near-instant since the screen just unfreezes its native view.
        freezeOnBlur: true,
      }}
    >
      <MainStack_Nav.Screen
        name="MainTabs"
        component={AppTabs}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ headerShown: false }}
      />

      <MainStack_Nav.Screen
        name="ChatDetail"
        // Route identity: each friendUid is a distinct route instance.
        // Without this, `navigate("ChatDetail", { friendUid: B })` while a
        // ChatDetail for friendUid A is already mounted would silently
        // reuse the existing screen and bleed state between conversations.
        // With `getId`, React Navigation treats each friendUid as its own
        // route — switching to a different DM replaces the screen, but
        // returning to the same DM (e.g. from a Thread deep-jump) pops
        // back to the existing instance instead of pushing a duplicate.
        getId={({ params }) => (params as any)?.friendUid}
        options={{
          headerShown: false,
        }}
      >
        {(props) => (
          <ErrorBoundary>
            <ComposerSheetProvider>
              <ChatScreen {...props} />
            </ComposerSheetProvider>
          </ErrorBoundary>
        )}
      </MainStack_Nav.Screen>
      <MainStack_Nav.Screen
        name="GroupChat"
        // Route identity: each groupId is a distinct route instance.
        // See ChatDetail above for rationale.
        getId={({ params }) => (params as any)?.groupId}
        options={{
          headerShown: false,
        }}
      >
        {(props) => (
          <ComposerSheetProvider>
            <GroupChatScreen {...props} />
          </ComposerSheetProvider>
        )}
      </MainStack_Nav.Screen>
      <MainStack_Nav.Screen
        name="ThreadView"
        // Route identity: each thread root message is a distinct route.
        // This also prevents duplicate ThreadView entries when a user
        // rapidly taps a reply link twice.
        getId={({ params }) => (params as any)?.rootMessageId}
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        {(props) => (
          <ComposerSheetProvider>
            <ThreadScreen {...props} />
          </ComposerSheetProvider>
        )}
      </MainStack_Nav.Screen>
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
        name="GroupPermissions"
        component={GroupPermissionsScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="ChatSettings"
        component={ChatSettingsScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="InboxSettings"
        component={InboxSettingsScreen}
        options={{ headerShown: false }}
      />
      <MainStack_Nav.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
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

      {CALL_FEATURES.CALLS_ENABLED && (
        <>
          <MainStack_Nav.Screen
            name="DirectCall"
            component={DirectCallScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              gestureEnabled: true,
              animation: "fade",
            }}
          />
          <MainStack_Nav.Screen
            name="VoiceChannel"
            component={VoiceChannelScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              gestureEnabled: true,
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
          <MainStack_Nav.Screen
            name="CallInfo"
            component={CallInfoScreen}
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
        </>
      )}

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

function HydrationStateLogger({
  hydrationState,
}: {
  hydrationState: HydrationState;
}) {
  useEffect(() => {
    logStartupEvent("AppGate hydration state changed", {
      hydrationState,
    });
  }, [hydrationState]);

  return null;
}

interface RootNavigatorProps {
  navigationRef?: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
  onRouteChange?: (routeName: keyof RootStackParamList | undefined) => void;
}

/**
 * Signals the ThemeContext that the user's profile is loaded. This enables
 * loading the stored theme preference for returning users, while keeping the
 * onboarding flow on a stable default theme.
 * Also syncs the Firestore-stored theme to ensure cross-device consistency.
 */
function ProfileReadySignal({
  markProfileReady,
  syncProfileTheme,
}: {
  markProfileReady: () => void;
  syncProfileTheme: (
    profile: { themeId?: string; useSystemTheme?: boolean } | null,
  ) => void;
}) {
  const { profile } = useUser();

  useEffect(() => {
    markProfileReady();
  }, [markProfileReady]);

  // When profile loads, sync the Firestore theme (authoritative remote source)
  useEffect(() => {
    if (profile) {
      syncProfileTheme(profile as any);
    }
  }, [profile, syncProfileTheme]);

  return null;
}

/**
 * RootNavigator
 * Uses AppGate for hydration-safe navigation
 * Three-tab layout: Profile, Messages, Calls
 */
export default function RootNavigator({
  navigationRef: externalRef,
  onRouteChange,
}: RootNavigatorProps) {
  const { theme, markProfileReady, syncProfileTheme } = useAppTheme();
  const { setCurrentScreen } = useInAppNotifications();
  const previousRouteNameRef = useRef<keyof RootStackParamList | undefined>(
    undefined,
  );

  const navRef = externalRef || navigationRef;

  useEffect(() => {
    logStartupMount("RootNavigator");
    return () => {
      logStartupUnmount("RootNavigator");
    };
  }, []);

  const getActiveRouteName = useCallback(() => {
    if (!navRef || !("current" in navRef)) return undefined;
    const currentRef = (navRef as React.RefObject<NavigationContainerRef<any>>)
      .current;
    return currentRef?.getCurrentRoute()?.name as
      | keyof RootStackParamList
      | undefined;
  }, [navRef]);

  // Track the active route name for context-aware notification suppression
  const handleStateChange = useCallback(() => {
    const routeName = getActiveRouteName();
    if (routeName !== previousRouteNameRef.current) {
      logStartupEvent("Navigation route changed", {
        previousRouteName: previousRouteNameRef.current ?? null,
        routeName: routeName ?? null,
      });
      previousRouteNameRef.current = routeName;
    }
    setCurrentScreen(routeName ?? null);
    onRouteChange?.(routeName);
  }, [getActiveRouteName, onRouteChange, setCurrentScreen]);

  const handleReady = useCallback(() => {
    const routeName = getActiveRouteName();
    logStartupEvent("Navigation container ready", {
      routeName: routeName ?? null,
    });
    previousRouteNameRef.current = routeName;
    setCurrentScreen(routeName ?? null);
    onRouteChange?.(routeName);
    logStartupEvent("Flushing pending navigation queue", {
      routeName: routeName ?? null,
    });
    flushPendingNavigation();
  }, [getActiveRouteName, onRouteChange, setCurrentScreen]);

  // ── Inbound friend-invite deep-link handler ──────────────────────
  // Handles two entry points:
  //   1. Cold start: Linking.getInitialURL() returns the URL the OS used
  //      to launch the app. We defer handling until the navigator is ready
  //      (navigationRef has its own queue for pending actions).
  //   2. Warm: Linking.addEventListener('url') fires when a deep link is
  //      opened while the app is backgrounded or already open.
  //
  // Both paths converge on `routeInviteUrl`, which parses the URL and, if
  // it is a valid invite/profile payload, navigates to the Friends screen
  // with `pendingInvite` set. FriendsScreen picks that up and opens the
  // shared FriendInviteConfirmModal.
  useEffect(() => {
    const routeInviteUrl = (url: string | null | undefined) => {
      if (!url) return;
      const parsed = parseInviteUrl(url);
      if (!parsed) return;
      logStartupEvent("Deep link: friend invite received", {
        kind: parsed.kind,
      });
      // `navigateExternal` uses the module-level pending-action queue so it
      // is safe to call during cold start before the navigator is ready.
      navigateExternal("Friends", { pendingInvite: parsed });
    };

    // Cold start
    Linking.getInitialURL()
      .then((url) => routeInviteUrl(url))
      .catch(() => {
        /* ignore */
      });

    // Warm
    const sub = Linking.addEventListener("url", (event) => {
      routeInviteUrl(event?.url);
    });
    return () => {
      sub.remove();
    };
  }, []);

  const linking = useMemo(
    () => ({
      prefixes: ["exp://", "exp-app://", "vibe://", "http://", "https://"],
      config: {
        screens: {
          Welcome: "welcome",
          Login: "login",
          SignupEmail: "signup",
          SignupPassword: "signup/password",
          ForgotPassword: "forgot-password",
          OnboardingUsername: "onboarding/username",
          OnboardingPhoto: "onboarding/photo",
          OnboardingDisplayStyle: "onboarding/style",
          OnboardingComplete: "onboarding/complete",
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
          onReady={handleReady}
          onStateChange={handleStateChange}
        >
          <HydrationStateLogger hydrationState={hydrationState} />
          {hydrationState === "ready" ? (
            <>
              <ProfileReadySignal
                markProfileReady={markProfileReady}
                syncProfileTheme={syncProfileTheme}
              />
              <MainStack />
              <WarningModal />
            </>
          ) : hydrationState === "needs_profile" ? (
            <OnboardingProvider>
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
                  name="OnboardingUsername"
                  component={OnboardingUsernameScreen}
                />
                <ProfileSetupStack_Nav.Screen
                  name="OnboardingPhoto"
                  component={OnboardingPhotoScreen}
                />
                <ProfileSetupStack_Nav.Screen
                  name="OnboardingDisplayStyle"
                  component={OnboardingDisplayStyleScreen}
                />
                <ProfileSetupStack_Nav.Screen
                  name="OnboardingComplete"
                  component={OnboardingCompleteScreen}
                />
              </ProfileSetupStack_Nav.Navigator>
            </OnboardingProvider>
          ) : (
            <AuthStack />
          )}
        </NavigationContainer>
      )}
    </AppGate>
  );
}
