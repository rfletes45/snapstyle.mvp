import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";

// Auth screens
import WelcomeScreen from "@/screens/auth/WelcomeScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignupScreen from "@/screens/auth/SignupScreen";
import ProfileSetupScreen from "@/screens/auth/ProfileSetupScreen";

// App screens
import ChatListScreen from "@/screens/chat/ChatListScreen";
import ChatScreen from "@/screens/chat/ChatScreen";
import StoriesScreen from "@/screens/stories/StoriesScreen";
import GamesScreen from "@/screens/games/GamesScreen";
import FriendsScreen from "@/screens/friends/FriendsScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";

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

function ChatStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: "#FFFC00",
        },
        headerTintColor: "#000",
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: "Chats" }}
      />
      <Stack.Screen
        name="ChatDetail"
        component={ChatScreen}
        options={{ title: "Chat" }}
      />
    </Stack.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: "#FFFC00",
        },
        headerTintColor: "#000",
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 18,
        },
        tabBarActiveTintColor: "#FFFC00",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#eee",
          borderTopWidth: 1,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName = "chat";
          if (route.name === "Chats") iconName = "chat-multiple";
          else if (route.name === "Stories") iconName = "image-multiple";
          else if (route.name === "Games") iconName = "gamepad-variant";
          else if (route.name === "Friends") iconName = "account-multiple";
          else if (route.name === "Profile") iconName = "account";

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
      <Tab.Screen name="Chats" component={ChatStack} />
      <Tab.Screen name="Stories" component={StoriesScreen} />
      <Tab.Screen name="Games" component={GamesScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { currentFirebaseUser, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUser();

  // Show loading screen while auth state is being determined
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#FFFC00" />
      </View>
    );
  }

  // Determine which navigator to show:
  // 1. If not logged in → show AuthStack (Welcome, Login, Signup)
  // 2. If logged in but profile is loading → show loading spinner (prevents flicker)
  // 3. If logged in but no profile → show ProfileSetup only
  // 4. If logged in with profile → show AppTabs
  const isLoggedIn = !!currentFirebaseUser;
  const hasProfile = !!profile?.username;

  // If logged in but profile is still loading, show loading spinner
  // This prevents the flicker between AppTabs → ProfileSetup → AppTabs
  if (isLoggedIn && profileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#FFFC00" />
      </View>
    );
  }

  // For web, we need a linking configuration
  const linking = {
    prefixes: ["exp://", "exp-app://", "http://", "https://"],
    config: {
      screens: {
        Welcome: "welcome",
        Login: "login",
        Signup: "signup",
        ProfileSetup: "profile-setup",
        Chats: "chats",
        Stories: "stories",
        Games: "games",
        Friends: "friends",
        Profile: "profile",
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      {isLoggedIn && hasProfile ? (
        <AppTabs />
      ) : isLoggedIn && !hasProfile ? (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        </Stack.Navigator>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
