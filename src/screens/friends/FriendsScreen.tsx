import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

export default function FriendsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Friends - Coming in Phase 2</Text>
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
