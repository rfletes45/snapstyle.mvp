import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface SystemMessageChipProps {
  text: string;
}

export function SystemMessageChip({
  text,
}: SystemMessageChipProps): React.JSX.Element | null {
  const theme = useTheme();
  const displayText = text.trim();

  if (!displayText) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.text,
          {
            color: theme.colors.onSurfaceVariant,
            backgroundColor: theme.colors.surfaceVariant,
          },
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 12,
  },
  text: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: "hidden",
    textAlign: "center",
  },
});

export default SystemMessageChip;
