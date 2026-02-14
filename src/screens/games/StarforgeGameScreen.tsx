/**
 * StarforgeGameScreen — WebView wrapper for the Starforge incremental game.
 *
 * Embeds the starforge-viewer web client in a full-screen WebView and passes
 * the Colyseus server endpoint + match parameters via URL query params.
 * Follows the same probe→load→error pattern as TropicalFishingGameScreen.
 */
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, StatusBar, StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { shouldUseColyseus } from "@/config/colyseus";
import {
  buildStarforgeGameUrl,
  getStarforgeBaseUrlCandidates,
  getStarforgeOriginFromBaseUrl,
  type StarforgeLaunchMode,
} from "@/config/starforgeGame";
import { Spacing } from "@/constants/theme";
import type { PlayStackParamList } from "@/types/navigation/root";

type Props = NativeStackScreenProps<PlayStackParamList, "StarforgeGame">;

interface RouteParamsShape {
  matchId?: string;
  roomId?: string;
  inviteId?: string;
  spectatorMode?: boolean;
  entryPoint?: string;
}

const PROBE_TIMEOUT_MS = 2400;

type ProbeStatus = "reachable" | "unreachable" | "timeout";

interface ProbeResult {
  status: ProbeStatus;
  detail: string;
}

function getLaunchMode(
  matchId?: string,
  spectatorMode?: boolean,
): StarforgeLaunchMode {
  if (spectatorMode) return "spectate";
  if (matchId) return "join";
  return "game";
}

function asRouteParams(value: unknown): RouteParamsShape {
  if (!value || typeof value !== "object") return {};
  const params = value as Record<string, unknown>;
  return {
    matchId: typeof params.matchId === "string" ? params.matchId : undefined,
    roomId: typeof params.roomId === "string" ? params.roomId : undefined,
    inviteId: typeof params.inviteId === "string" ? params.inviteId : undefined,
    spectatorMode:
      typeof params.spectatorMode === "boolean"
        ? params.spectatorMode
        : undefined,
    entryPoint:
      typeof params.entryPoint === "string" ? params.entryPoint : undefined,
  };
}

async function probeStarforgeHost(baseUrl: string): Promise<ProbeResult> {
  const probeUrl = `${baseUrl.replace(/\/$/, "")}/?embed_probe=1&_t=${Date.now()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(probeUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.ok || response.status < 500) {
      return { status: "reachable", detail: `HTTP ${response.status}` };
    }
    return { status: "unreachable", detail: `HTTP ${response.status}` };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "timeout", detail: `${PROBE_TIMEOUT_MS}ms` };
    }
    return { status: "unreachable", detail: "network_error" };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getProbeLine(baseUrl: string, result: ProbeResult): string {
  if (result.detail.length > 0) {
    return `${baseUrl} -> ${result.status} (${result.detail})`;
  }
  return `${baseUrl} -> ${result.status}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StarforgeGameScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const params = asRouteParams(route.params);
  const launchMode = getLaunchMode(params.matchId, params.spectatorMode);

  // Hide status bar for immersion
  useEffect(() => {
    StatusBar.setHidden(true, "fade");
    if (Platform.OS === "android") {
      StatusBar.setTranslucent(true);
    }
    return () => {
      StatusBar.setHidden(false, "fade");
      if (Platform.OS === "android") {
        StatusBar.setTranslucent(false);
      }
    };
  }, []);

  const [webViewKey, setWebViewKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(true);
  const [probeReport, setProbeReport] = useState<string[]>([]);
  const [resolvedBaseUrl, setResolvedBaseUrl] = useState<string | null>(null);

  const baseUrlCandidates = useMemo(() => getStarforgeBaseUrlCandidates(), []);

  // ── Probe for reachable host ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const pickReachableBaseUrl = async () => {
      setIsProbing(true);
      setLoadError(null);
      setResolvedBaseUrl(null);
      setProbeReport([]);

      const nextReport: string[] = [];
      for (const candidate of baseUrlCandidates) {
        const probeResult = await probeStarforgeHost(candidate);
        const line = getProbeLine(candidate, probeResult);
        nextReport.push(line);
        if (!cancelled) setProbeReport([...nextReport]);

        if (probeResult.status === "reachable") {
          if (!cancelled) setResolvedBaseUrl(candidate);
          break;
        }
      }

      if (
        !cancelled &&
        nextReport.length > 0 &&
        !nextReport.some((l) => l.includes("-> reachable"))
      ) {
        setLoadError(
          "No reachable Starforge host. Start the starforge-viewer dev server, or build and co-locate on colyseus-server.",
        );
      }

      if (!cancelled) setIsProbing(false);
    };

    void pickReachableBaseUrl();
    return () => {
      cancelled = true;
    };
  }, [baseUrlCandidates, webViewKey]);

  const allowedOrigin = useMemo(
    () =>
      resolvedBaseUrl ? getStarforgeOriginFromBaseUrl(resolvedBaseUrl) : null,
    [resolvedBaseUrl],
  );

  const launchUrl = useMemo(() => {
    if (!resolvedBaseUrl) return null;
    const useMultiplayer = shouldUseColyseus("starforge_game");
    return buildStarforgeGameUrl({
      mode: launchMode,
      firestoreGameId: params.matchId,
      role: params.spectatorMode ? "spectator" : "player",
      source: params.entryPoint ?? "play",
      embedded: true,
      baseUrl: resolvedBaseUrl,
      soloOnly: !useMultiplayer,
    });
  }, [
    resolvedBaseUrl,
    launchMode,
    params.matchId,
    params.spectatorMode,
    params.entryPoint,
  ]);

  // ── Bridge messages from WebView ────────────────────────────────────
  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload: unknown = JSON.parse(event.nativeEvent.data);
        if (!payload || typeof payload !== "object") return;
        const data = payload as {
          source?: string;
          type?: string;
          sessionId?: string;
          flux?: number;
          mode?: string;
          message?: string;
        };
        if (data.source !== "starforge") return;

        if (data.type === "error") {
          setLoadError(data.message ?? "Unknown error from Starforge client");
          return;
        }

        if (data.type === "back") {
          navigation.goBack();
          return;
        }

        if (data.type === "session_info") {
          const parts: string[] = [];
          if (data.sessionId) parts.push(`Session: ${data.sessionId}`);
          if (data.mode) parts.push(`Mode: ${data.mode}`);
          if (data.flux !== undefined) parts.push(`Flux: ${data.flux}`);
          setSessionInfo(parts.join("  |  ") || null);
        }
      } catch {
        // Ignore non-JSON messages
      }
    },
    [navigation],
  );

  const shouldAllowNavigation = useCallback(
    (url: string): boolean => {
      if (url.startsWith("about:blank")) return true;
      if (!allowedOrigin) return true;
      if (url.startsWith(allowedOrigin)) return true;
      Alert.alert(
        "External link blocked",
        "Starforge remains embedded in-app.",
      );
      return false;
    },
    [allowedOrigin],
  );

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    setWebViewKey((prev) => prev + 1);
  }, []);

  const handleHttpError = useCallback(
    (event: { nativeEvent: { statusCode: number; url: string } }) => {
      const { statusCode, url } = event.nativeEvent;
      setLoadError(`HTTP ${statusCode} while loading ${url}`);
    },
    [],
  );

  // ── Error state ──────────────────────────────────────────────────────
  if (loadError) {
    return (
      <SafeAreaView
        edges={["left", "right"]}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Card style={styles.card}>
          <Card.Content style={styles.content}>
            <Text
              variant="headlineSmall"
              style={{ color: theme.colors.onSurface }}
            >
              Starforge
            </Text>
            <Text
              style={[styles.body, { color: theme.colors.onSurfaceVariant }]}
            >
              Failed to load the Starforge game client.
            </Text>
            <Text style={[styles.meta, { color: theme.colors.error }]}>
              {loadError}
            </Text>
            {probeReport.length > 0 ? (
              <Text
                style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}
              >
                Probe report:{"\n"}
                {probeReport.join("\n")}
              </Text>
            ) : null}
            <Text
              style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}
            >
              Dev: cd starforge-viewer && npm run dev -- --host
            </Text>
            <Text
              style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}
            >
              Co-located: cd starforge-viewer && npm run build, then cd
              colyseus-server && npm run dev
            </Text>
            <Button mode="contained" onPress={handleRetry}>
              Retry
            </Button>
            <Button mode="text" onPress={() => navigation.goBack()}>
              Back to Play
            </Button>
          </Card.Content>
        </Card>
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: "#0a0c10" }]}>
      {isProbing || !launchUrl ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <Card style={styles.loadingCard}>
            <Card.Content>
              <Text style={styles.loadingText}>
                Resolving Starforge host...
              </Text>
              {probeReport.length > 0 ? (
                <Text style={styles.loadingSubText}>
                  {probeReport[probeReport.length - 1]}
                </Text>
              ) : null}
            </Card.Content>
          </Card>
        </View>
      ) : (
        <>
          <WebView
            key={`${webViewKey}:${launchUrl}`}
            source={{ uri: launchUrl }}
            style={styles.webView}
            originWhitelist={["http://*", "https://*"]}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            // Android: hardware layer for WebGL/Three.js, allow mixed content in dev
            androidLayerType="hardware"
            mixedContentMode="always"
            // iOS: allow WebGL inline
            allowsBackForwardNavigationGestures={false}
            onMessage={handleWebViewMessage}
            onShouldStartLoadWithRequest={(request) =>
              shouldAllowNavigation(request.url)
            }
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={(event) => {
              setLoadError(
                event.nativeEvent.description ||
                  "Unable to load Starforge client.",
              );
            }}
            onHttpError={handleHttpError}
          />

          {loading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <Card style={styles.loadingCard}>
                <Card.Content>
                  <Text style={styles.loadingText}>
                    Initializing Starforge...
                  </Text>
                </Card.Content>
              </Card>
            </View>
          ) : null}
        </>
      )}

      {/* Back button is rendered INSIDE the WebView by hud.ts (#sf-back-btn).
          It sends a postMessage({type:"back"}) which handleWebViewMessage
          routes to navigation.goBack(). No native overlay needed. */}

      {params.spectatorMode ? (
        <View style={styles.spectatorBanner}>
          <Text style={styles.spectatorText}>
            Spectating — inputs are disabled
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  spectatorBanner: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    backgroundColor: "rgba(49,214,255,0.2)",
  },
  spectatorText: {
    color: "#a5e8ff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  webView: {
    flex: 1,
    backgroundColor: "#0a0c10",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  loadingCard: {
    borderRadius: 12,
    width: "100%",
  },
  loadingText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingSubText: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },
  card: {
    borderRadius: 16,
    margin: Spacing.lg,
  },
  content: {
    gap: Spacing.md,
  },
  body: {
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
  },
});
