import { MainNavCustomizationSheet } from "@/components/navigation/MainNavCustomizationSheet";
import { ButtonCornerBadge } from "@/components/ui/ButtonCornerBadge";
import { useMainNavCustomization } from "@/hooks/useMainNavCustomization";
import {
  getMainNavItemDefinition,
  type MainNavItemDefinition,
} from "@/navigation/mainNav";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MaterialCommunityIconName = React.ComponentProps<
  typeof MaterialCommunityIcons
>["name"];

interface MainNavBarProps extends BottomTabBarProps {
  unreadMessagesCount: number;
}

interface VisibleNavEntry {
  definition: MainNavItemDefinition;
  route: BottomTabBarProps["state"]["routes"][number];
  routeIndex: number;
}

function MainNavBarBase({
  state,
  descriptors,
  navigation,
  unreadMessagesCount,
}: MainNavBarProps) {
  const { colors } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { items } = useMainNavCustomization(currentFirebaseUser?.uid);
  const [customizationVisible, setCustomizationVisible] = useState(false);
  const suppressNextPressRef = useRef(false);

  const openCustomization = useCallback(() => {
    suppressNextPressRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCustomizationVisible(true);
  }, []);

  const closeCustomization = useCallback(() => {
    setCustomizationVisible(false);
  }, []);

  const visibleEntries = useMemo<VisibleNavEntry[]>(() => {
    return items.flatMap((item) => {
      const definition = getMainNavItemDefinition(item.id);
      if (!definition) return [];

      const routeIndex = state.routes.findIndex(
        (route) => route.name === definition.routeName,
      );
      if (routeIndex === -1) return [];

      return [
        {
          definition,
          route: state.routes[routeIndex],
          routeIndex,
        },
      ];
    });
  }, [items, state.routes]);

  const compact = visibleEntries.length >= 6;
  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      {visibleEntries.map(({ definition, route, routeIndex }) => {
        const descriptor = descriptors[route.key];
        const isFocused = state.index === routeIndex;
        const color = isFocused ? colors.tabActive : colors.tabInactive;
        const showBadge =
          definition.badgeKey === "messages" && unreadMessagesCount > 0;

        const handlePress = () => {
          if (suppressNextPressRef.current) {
            suppressNextPressRef.current = false;
            return;
          }

          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            Haptics.selectionAsync();
            navigation.navigate(route.name, route.params);
          }
        };

        const handleLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
          openCustomization();
        };

        return (
          <Pressable
            key={definition.itemId}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : undefined}
            accessibilityLabel={
              descriptor.options.tabBarAccessibilityLabel ?? definition.label
            }
            testID={descriptor.options.tabBarButtonTestID}
            onPress={handlePress}
            onLongPress={handleLongPress}
            style={styles.item}
          >
            <View style={styles.iconShell}>
              <MaterialCommunityIcons
                name={definition.icon as MaterialCommunityIconName}
                size={compact ? 22 : 24}
                color={color}
              />
              <ButtonCornerBadge
                visible={showBadge}
                badgeColor={colors.error}
                borderColor={colors.background}
                accessibilityLabel="Unread messages"
              />
            </View>
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                { color, fontWeight: isFocused ? "700" : "600" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {definition.label}
            </Text>
          </Pressable>
        );
      })}
      <MainNavCustomizationSheet
        visible={customizationVisible}
        onClose={closeCustomization}
      />
    </View>
  );
}

export const MainNavBar = memo(MainNavBarBase);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 6,
    minHeight: 92,
    overflow: "visible",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    minWidth: 0,
    gap: 3,
    paddingTop: 2,
  },
  iconShell: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  label: {
    width: "100%",
    textAlign: "center",
    fontSize: 11,
  },
  labelCompact: {
    fontSize: 10,
  },
});
