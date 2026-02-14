import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, StatusBar, StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import {
  buildFishingGameUrl,
  getFishingGameBaseUrlCandidates,
  getFishingGameOriginFromBaseUrl,
} from "@/config/fishingGame";
import { Spacing } from "@/constants/theme";
import { useScreenOrientation } from "@/hooks/useScreenOrientation";
import type { PlayStackParamList } from "@/types/navigation/root";

type Props = NativeStackScreenProps<PlayStackParamList, "TropicalFishingGame">;

type LaunchMode = "join" | "game" | "spectate";

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

function getLaunchMode(matchId?: string, spectatorMode?: boolean): LaunchMode {
  if (spectatorMode) {
    return "spectate";
  }
  if (matchId) {
    return "join";
  }
  return "game";
}

function asRouteParams(value: unknown): RouteParamsShape {
  if (!value || typeof value !== "object") {
    return {};
  }
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

async function probeFishingHost(baseUrl: string): Promise<ProbeResult> {
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

export default function TropicalFishingGameScreen({
  navigation,
  route,
}: Props) {
  const theme = useTheme();
  const params = asRouteParams(route.params);
  const launchMode = getLaunchMode(params.matchId, params.spectatorMode);

  // ── Landscape orientation lock ──────────────────────────────────────
  // Lock to landscape while this screen is active. Portrait is
  // restored automatically on unmount via the hook's cleanup.
  useScreenOrientation("LANDSCAPE_SENSOR");

  // Hide the status bar for a fully immersive landscape experience.
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
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playersInRoom, setPlayersInRoom] = useState<number | null>(null);
  const [isProbing, setIsProbing] = useState(true);
  const [probeReport, setProbeReport] = useState<string[]>([]);
  const [resolvedBaseUrl, setResolvedBaseUrl] = useState<string | null>(null);

  const baseUrlCandidates = useMemo(
    () => getFishingGameBaseUrlCandidates(),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const pickReachableBaseUrl = async () => {
      setIsProbing(true);
      setLoadError(null);
      setResolvedBaseUrl(null);
      setProbeReport([]);

      const nextReport: string[] = [];
      for (const candidate of baseUrlCandidates) {
        const probeResult = await probeFishingHost(candidate);
        const line = getProbeLine(candidate, probeResult);
        nextReport.push(line);
        if (!cancelled) {
          setProbeReport([...nextReport]);
        }
        if (probeResult.status === "reachable") {
          if (!cancelled) {
            setResolvedBaseUrl(candidate);
          }
          break;
        }
      }

      if (
        !cancelled &&
        nextReport.length > 0 &&
        !nextReport.some((line) => line.includes("-> reachable"))
      ) {
        setLoadError(
          "No reachable fishing host. Start colyseus-server with the embedded /fishing host, or set EXPO_PUBLIC_FISHING_GAME_URL.",
        );
      }

      if (!cancelled) {
        setIsProbing(false);
      }
    };

    void pickReachableBaseUrl();
    return () => {
      cancelled = true;
    };
  }, [baseUrlCandidates, webViewKey]);

  const allowedOrigin = useMemo(
    () =>
      resolvedBaseUrl ? getFishingGameOriginFromBaseUrl(resolvedBaseUrl) : null,
    [resolvedBaseUrl],
  );

  const launchUrl = useMemo(() => {
    if (!resolvedBaseUrl) {
      return null;
    }
    return buildFishingGameUrl({
      mode: launchMode,
      firestoreGameId: params.matchId,
      inviteCode: params.matchId,
      roomId: params.roomId,
      inviteId: params.inviteId,
      source: params.entryPoint ?? "play",
      embedded: true,
      baseUrl: resolvedBaseUrl,
    });
  }, [
    resolvedBaseUrl,
    launchMode,
    params.matchId,
    params.roomId,
    params.inviteId,
    params.entryPoint,
  ]);

  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload: unknown = JSON.parse(event.nativeEvent.data);
      if (!payload || typeof payload !== "object") {
        return;
      }
      const data = payload as {
        source?: string;
        type?: string;
        roomId?: string;
        playerCount?: number;
      };
      if (data.source !== "tropical_fishing") {
        return;
      }
      if (data.type === "online_status") {
        setRoomCode(
          typeof data.roomId === "string" && data.roomId.length > 0
            ? data.roomId
            : null,
        );
        setPlayersInRoom(
          typeof data.playerCount === "number" &&
            Number.isFinite(data.playerCount)
            ? data.playerCount
            : null,
        );
      }
    } catch {
      // Ignore non-JSON bridge messages.
    }
  }, []);

  const shouldAllowNavigation = useCallback(
    (url: string): boolean => {
      if (url.startsWith("about:blank")) {
        return true;
      }
      if (!allowedOrigin) {
        return true;
      }
      if (url.startsWith(allowedOrigin)) {
        return true;
      }
      Alert.alert(
        "External link blocked",
        "Fishing remains embedded in-app. Open external links from chat or browser instead.",
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

  const shouldShowSessionHint = params.matchId || params.roomId || roomCode;

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
              Tropical Fishing
            </Text>
            <Text
              style={[styles.body, { color: theme.colors.onSurfaceVariant }]}
            >
              Failed to load embedded fishing client.
            </Text>
            <Text style={[styles.meta, { color: theme.colors.error }]}>
              {loadError}
            </Text>
            {probeReport.length > 0 ? (
              <Text
                style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}
              >
                Probe report:\n{probeReport.join("\n")}
              </Text>
            ) : null}
            <Text
              style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}
            >
              Integrated host: `cd client && npm run build`, then `cd
              colyseus-server && npm run dev`
            </Text>
            <Text
              style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}
            >
              Optional standalone dev host: `cd client && npm run dev -- --host`
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

  return (
    <View style={[styles.container, { backgroundColor: "#041421" }]}>
      {/* ── WebView fills entire screen for full immersion ──────────── */}
      {isProbing || !launchUrl ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <Card style={styles.loadingCard}>
            <Card.Content>
              <Text style={styles.loadingText}>Resolving fishing host...</Text>
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
            mediaPlaybackRequiresUserAction
            onMessage={handleWebViewMessage}
            onShouldStartLoadWithRequest={(request) =>
              shouldAllowNavigation(request.url)
            }
            onLoadStart={() => {
              setLoading(true);
            }}
            onLoadEnd={() => {
              setLoading(false);
            }}
            onError={(event) => {
              setLoadError(
                event.nativeEvent.description ||
                  "Unable to load fishing client.",
              );
            }}
            onHttpError={handleHttpError}
          />

          {loading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <Card style={styles.loadingCard}>
                <Card.Content>
                  <Text style={styles.loadingText}>
                    Loading tropical island...
                  </Text>
                </Card.Content>
              </Card>
            </View>
          ) : null}
        </>
      )}

      {/* ── Floating top bar – translucent overlay for landscape ──── */}
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={styles.topBarOverlay}
        pointerEvents="box-none"
      >
        <View style={styles.topBar}>
          <Button
            compact
            mode="contained-tonal"
            onPress={() => navigation.goBack()}
          >
            Back
          </Button>

          <View style={styles.statusWrap}>
            <Text style={styles.title}>Tropical Fishing</Text>
            {shouldShowSessionHint ? (
              <Text style={styles.statusText}>
                Session: {params.matchId ?? params.roomId ?? roomCode}
                {playersInRoom !== null ? `  |  Players: ${playersInRoom}` : ""}
              </Text>
            ) : (
              <Text style={styles.statusText}>In-app mode</Text>
            )}
            {resolvedBaseUrl ? (
              <Text style={styles.endpointText}>Host: {resolvedBaseUrl}</Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      {params.spectatorMode ? (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Spectating is not supported for fishing. The server rejects spectate
            joins.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(4,20,33,0.72)",
  },
  statusWrap: {
    flex: 1,
  },
  title: {
    color: "#f4f7fa",
    fontSize: 15,
    fontWeight: "700",
  },
  statusText: {
    color: "rgba(244,247,250,0.78)",
    fontSize: 12,
    marginTop: 2,
  },
  endpointText: {
    color: "rgba(130,214,255,0.88)",
    fontSize: 11,
    marginTop: 2,
  },
  warningBanner: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    backgroundColor: "rgba(220,38,38,0.22)",
  },
  warningText: {
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "600",
  },
  webView: {
    flex: 1,
    backgroundColor: "#041421",
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
