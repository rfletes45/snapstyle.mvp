import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

export default function GamesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Games - Coming in Phase 6</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  placeholder: {
    fontSize: 16,
    color: "#999",
  },
});
