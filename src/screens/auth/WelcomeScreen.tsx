import React from "react";
import { View, StyleSheet } from "react-native";
import { Button, Title, Paragraph } from "react-native-paper";

export default function WelcomeScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Title style={styles.title}>SnapStyle</Title>
        <Paragraph style={styles.subtitle}>Streaks • Stories • Snaps</Paragraph>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate("Signup")}
            style={styles.button}
            buttonColor="#FFFC00"
            textColor="#000"
          >
            Create Account
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Login")}
            style={styles.button}
          >
            Sign In
          </Button>
        </View>
      </View>
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
  content: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#FFFC00",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
    marginBottom: 40,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  button: {
    paddingVertical: 6,
  },
});
