/**
 * Shop Navigator
 *
 * Stack navigator for the shop system providing navigation between:
 * - ShopHubScreen: Entry point with Points Shop and Premium Shop options
 * - PointsShopScreen: Browse and purchase items with tokens
 * - PremiumShopScreen: Browse and purchase items with real money
 * - PurchaseHistoryScreen: View past purchases
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { useAppTheme } from "@/store/ThemeContext";
import type { ShopStackParamList } from "@/types/shop";

// Screens
import PointsShopScreen from "@/screens/shop/PointsShopScreen";
import PremiumShopScreen from "@/screens/shop/PremiumShopScreen";
import ShopHubScreen from "@/screens/shop/ShopHubScreen";
// Phase 4 screens
import PurchaseHistoryScreen from "@/screens/shop/PurchaseHistoryScreen";

const Stack = createNativeStackNavigator<ShopStackParamList>();

/**
 * Shop Navigator Component
 *
 * Provides navigation stack for the shop system.
 * Entry point is ShopHubScreen which allows users to choose between
 * Points Shop (tokens) and Premium Shop (real money).
 */
export default function ShopNavigator() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName="ShopHub"
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
        animation: "slide_from_right",
      }}
    >
      {/* Shop Hub - Entry Point */}
      <Stack.Screen
        name="ShopHub"
        component={ShopHubScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* Points Shop - Token Purchases */}
      <Stack.Screen
        name="PointsShop"
        component={PointsShopScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* Premium Shop - IAP Purchases */}
      <Stack.Screen
        name="PremiumShop"
        component={PremiumShopScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* Purchase History (Phase 4) */}
      <Stack.Screen
        name="PurchaseHistory"
        component={PurchaseHistoryScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
