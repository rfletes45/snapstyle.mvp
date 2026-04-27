import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CommonActions,
  useNavigation,
  type NavigationProp,
  type ParamListBase,
} from "@react-navigation/native";
import React, { useCallback } from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export const MAIN_HEADER_ACTION_SIZE = 36;
export const MAIN_HEADER_ACTION_GAP = 8;
export const MAIN_HEADER_HORIZONTAL_PADDING = 20;
export const MAIN_HEADER_TOP_PADDING = 8;
export const MAIN_HEADER_BOTTOM_PADDING = 12;

interface MainSettingsHeaderButtonProps {
  iconColor: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function MainSettingsHeaderButton({
  iconColor,
  backgroundColor,
  style,
}: MainSettingsHeaderButtonProps) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const handlePress = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: "MainTabs",
        params: {
          screen: "Profile",
          params: {
            screen: "Settings",
          },
        },
      }),
    );
  }, [navigation]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      style={({ pressed }) => [
        styles.button,
        backgroundColor
          ? {
              backgroundColor,
              opacity: pressed ? 0.82 : 1,
            }
          : {
              opacity: pressed ? 0.72 : 1,
            },
        style,
      ]}
    >
      <MaterialCommunityIcons name="cog-outline" size={22} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MAIN_HEADER_ACTION_SIZE,
    height: MAIN_HEADER_ACTION_SIZE,
    borderRadius: MAIN_HEADER_ACTION_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default MainSettingsHeaderButton;
