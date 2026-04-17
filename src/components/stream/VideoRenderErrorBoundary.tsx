/**
 * VideoRenderErrorBoundary
 *
 * Catches render errors in the video subtree (ParticipantView, StreamCall, etc.)
 * and falls back to audio-call UI instead of crashing the entire screen.
 * The underlying call stays alive — only the video rendering is disabled.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  children: React.ReactNode;
  /** Fallback UI to show instead of the video subtree on error */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class VideoRenderErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      "[VideoRenderErrorBoundary] Video subtree crashed — falling back to audio UI.",
      {
        message: error.message,
        componentStack: info.componentStack,
      },
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <DefaultVideoErrorFallback />;
    }
    return this.props.children;
  }
}

function DefaultVideoErrorFallback() {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="video-off-outline" size={48} color="#aaa" />
      <Text style={styles.title}>Video unavailable</Text>
      <Text style={styles.subtitle}>Call continued in audio mode</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 6,
  },
});
