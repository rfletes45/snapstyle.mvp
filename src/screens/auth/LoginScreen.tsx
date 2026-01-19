import React, { useState } from "react";
import { StyleSheet, ScrollView } from "react-native";
import { TextInput, Button, Text } from "react-native-paper";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getAuthInstance } from "@/services/firebase";

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const auth = getAuthInstance();
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation will happen automatically via AuthContext
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Sign In</Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        keyboardType="email-address"
        disabled={loading}
        style={styles.input}
      />

      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        mode="outlined"
        secureTextEntry
        disabled={loading}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        mode="contained"
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        buttonColor="#FFFC00"
        textColor="#000"
        style={styles.button}
      >
        Sign In
      </Button>

      <Button
        mode="text"
        onPress={() => navigation.navigate("Signup")}
        disabled={loading}
      >
        Don&apos;t have an account? Sign up
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    justifyContent: "center",
    minHeight: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  error: {
    color: "#d32f2f",
    marginBottom: 12,
  },
});
