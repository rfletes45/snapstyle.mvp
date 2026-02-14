/**
 * GolfDuelsGameScreen — Full game screen with lobby menu, invite flow, and
 * WebView wrapper for the Golf Duels mini-golf game.
 *
 * Follows the same pattern as AirHockeyGameScreen / PoolGameScreen:
 *   menu → invite / play → WebView game → result → menu
 *
 * The actual 3D game runs inside a WebView (golf-duels-client), which handles
 * its own Colyseus connection.  The native side provides:
 *   • Pre-game lobby with Play Online / Invite Friend
 *   • useGameConnection for invite detection
 *   • useGameBackHandler for Android back / iOS swipe
 *   • SpectatorBanner for spectating
 *   • FriendPickerModal for invites & score sharing
 *   • withGameErrorBoundary for crash recovery
 */
import FriendPickerModal from "@/components/FriendPickerModal";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { SpectatorBanner } from "@/components/games/SpectatorBanner";
import {
  buildGolfDuelsGameUrl,
  getGolfDuelsBaseUrlCandidates,
  getGolfDuelsOriginFromBaseUrl,
} from "@/config/golfDuelsGame";
import { Spacing } from "@/constants/theme";
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { useGameNavigation } from "@/hooks/useGameNavigation";
import { sendUniversalInvite } from "@/services/gameInvites";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

// =============================================================================
// Constants
// =============================================================================

const GAME_TYPE = "golf_duels";
const PROBE_TIMEOUT_MS = 2400;

type ScreenMode = "menu" | "playing";

// =============================================================================
// Host probe helpers
// =============================================================================

type ProbeStatus = "reachable" | "unreachable" | "timeout";
interface ProbeResult {
  status: ProbeStatus;
  detail: string;
}

async function probeGolfHost(baseUrl: string): Promise<ProbeResult> {
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

// =============================================================================
// Component
// =============================================================================

function GolfDuelsGameScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  // ── Shared game hooks ───────────────────────────────────────────────
  useGameCompletion({ gameType: GAME_TYPE });
  useGameHaptics();
  const isSpectator = route?.params?.spectatorMode === true;
  const [isGameOver, setIsGameOver] = useState(false);
  const { handleBack } = useGameBackHandler({
    gameType: GAME_TYPE,
    isGameOver,
  });

  // ── Smart post-game navigation (guide §10.2) ───────────────────────
  const { exitGame: navigateAfterGame } = useGameNavigation({
    conversationId: route?.params?.conversationId,
    entryPoint: route?.params?.entryPoint,
    currentUserId: currentFirebaseUser?.uid,
  });

  // ── Invite detection ────────────────────────────────────────────────
  const { resolvedMode, firestoreGameId } = useGameConnection(
    GAME_TYPE,
    route?.params?.matchId,
  );

  // ── Screen state ────────────────────────────────────────────────────
  const [mode, setMode] = useState<ScreenMode>("menu");
  const [matchId, setMatchId] = useState<string | undefined>(
    route?.params?.matchId,
  );

  // ── Auth ────────────────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const resolvedUid = currentFirebaseUser?.uid;
  const resolvedDisplayName =
    currentFirebaseUser?.displayName ?? profile?.displayName ?? "Player";

  useEffect(() => {
    if (currentFirebaseUser) {
      currentFirebaseUser
        .getIdToken()
        .then(setAuthToken)
        .catch(() => {});
    }
  }, [currentFirebaseUser]);

  // ── Auto-transition from invite ─────────────────────────────────────
  useEffect(() => {
    if (resolvedMode === "colyseus" && firestoreGameId) {
      setMatchId(firestoreGameId);
      setMode("playing");
    }
  }, [resolvedMode, firestoreGameId]);

  // If opened as spectator, jump straight into the game
  useEffect(() => {
    if (isSpectator && route?.params?.matchId) {
      setMatchId(route.params.matchId);
      setMode("playing");
    }
  }, [isSpectator, route?.params?.matchId]);

  // ── Friend picker state ─────────────────────────────────────────────
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleInviteFriend = useCallback(() => {
    setShowInvitePicker(true);
  }, []);

  const handleSelectInviteFriend = useCallback(
    async (friend: { friendUid: string; displayName: string }) => {
      setShowInvitePicker(false);
      if (!currentFirebaseUser || !profile) return;
      setInviteLoading(true);
      try {
        await sendUniversalInvite({
          senderId: currentFirebaseUser.uid,
          senderName: profile.displayName || "Player",
          senderAvatar: profile.avatarConfig
            ? JSON.stringify(profile.avatarConfig)
            : undefined,
          gameType: GAME_TYPE as any,
          context: "dm",
          conversationId: "",
          recipientId: friend.friendUid,
          recipientName: friend.displayName,
          settings: { isRated: true, chatEnabled: true },
        });
        Alert.alert(
          "Invite Sent!",
          `Game invite sent to ${friend.displayName}. You'll be notified when they respond.`,
        );
      } catch (error: any) {
        Alert.alert(
          "Error",
          error?.message || "Failed to send game invite. Please try again.",
        );
      } finally {
        setInviteLoading(false);
      }
    },
    [currentFirebaseUser, profile],
  );

  // ── Play Online handler ─────────────────────────────────────────────
  const handlePlayOnline = useCallback(() => {
    // No matchId — the WebView client will joinOrCreate a fresh room
    setMatchId(undefined);
    setMode("playing");
  }, []);

  // ── Go back to menu from game ───────────────────────────────────────
  const goMenu = useCallback(() => {
    setMode("menu");
    setMatchId(undefined);
    setIsGameOver(false);
  }, []);

  /** Smart exit: use useGameNavigation for proper post-game routing
   *  (guide §10.2 — if opened from chat, returns to chat) */
  const exitGameSmart = useCallback(() => {
    navigateAfterGame();
  }, [navigateAfterGame]);

  // ── WebView probing & URL ───────────────────────────────────────────
  const [webViewKey, setWebViewKey] = useState(0);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [probeReport, setProbeReport] = useState<string[]>([]);
  const [resolvedBaseUrl, setResolvedBaseUrl] = useState<string | null>(null);
  const probedOnce = useRef(false);

  const baseUrlCandidates = useMemo(() => getGolfDuelsBaseUrlCandidates(), []);

  // Probe for a reachable host when entering playing mode
  useEffect(() => {
    if (mode !== "playing") return;
    // Re-probe every time we enter playing mode to handle server restarts
    let cancelled = false;

    const pickReachableBaseUrl = async () => {
      setIsProbing(true);
      setLoadError(null);
      setResolvedBaseUrl(null);
      setProbeReport([]);

      const nextReport: string[] = [];
      for (const candidate of baseUrlCandidates) {
        const probeResult = await probeGolfHost(candidate);
        const line = `${candidate} -> ${probeResult.status} (${probeResult.detail})`;
        nextReport.push(line);
        if (!cancelled) setProbeReport([...nextReport]);

        if (probeResult.status === "reachable") {
          if (!cancelled) {
            setResolvedBaseUrl(candidate);
            probedOnce.current = true;
          }
          break;
        }
      }

      if (
        !cancelled &&
        nextReport.length > 0 &&
        !nextReport.some((l) => l.includes("-> reachable"))
      ) {
        setLoadError(
          "No reachable Golf Duels host. Start the golf-duels-client dev server, or build and co-locate on colyseus-server.",
        );
      }

      if (!cancelled) setIsProbing(false);
    };

    void pickReachableBaseUrl();
    return () => {
      cancelled = true;
    };
  }, [mode, baseUrlCandidates, webViewKey]);

  const allowedOrigin = useMemo(
    () =>
      resolvedBaseUrl ? getGolfDuelsOriginFromBaseUrl(resolvedBaseUrl) : null,
    [resolvedBaseUrl],
  );

  const launchUrl = useMemo(() => {
    if (!resolvedBaseUrl || !resolvedUid) return null;
    return buildGolfDuelsGameUrl({
      firestoreGameId: matchId,
      role: isSpectator ? "spectator" : "player",
      displayName: resolvedDisplayName,
      token: authToken,
      uid: resolvedUid,
      embedded: true,
      baseUrl: resolvedBaseUrl,
    });
  }, [
    resolvedBaseUrl,
    matchId,
    isSpectator,
    resolvedDisplayName,
    authToken,
    resolvedUid,
  ]);

  // ── Hide status bar during gameplay ─────────────────────────────────
  useEffect(() => {
    if (mode === "playing") {
      StatusBar.setHidden(true, "fade");
      if (Platform.OS === "android") StatusBar.setTranslucent(true);
    } else {
      StatusBar.setHidden(false, "fade");
      if (Platform.OS === "android") StatusBar.setTranslucent(false);
    }
    return () => {
      StatusBar.setHidden(false, "fade");
      if (Platform.OS === "android") StatusBar.setTranslucent(false);
    };
  }, [mode]);

  // ── Bridge messages from WebView ────────────────────────────────────
  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload: unknown = JSON.parse(event.nativeEvent.data);
        if (!payload || typeof payload !== "object") return;
        const data = payload as {
          source?: string;
          type?: string;
          message?: string;
          winner?: string | null;
          reason?: string;
          p1HolesWon?: number;
          p2HolesWon?: number;
        };
        if (data.source !== "golf_duels") return;

        if (data.type === "error") {
          setLoadError(data.message ?? "Unknown error from Golf Duels client");
          return;
        }

        if (data.type === "match_end") {
          // Mark game as over so back handler skips confirmation (guide §10.1)
          setIsGameOver(true);
          // Auto-navigate back after a delay so the player sees the
          // in-game result screen first.
          setTimeout(() => {
            exitGameSmart();
          }, 6000);
          return;
        }

        if (data.type === "back") {
          goMenu();
          return;
        }
      } catch {
        // Ignore non-JSON messages
      }
    },
    [goMenu, exitGameSmart],
  );

  const shouldAllowNavigation = useCallback(
    (url: string): boolean => {
      if (url.startsWith("about:blank")) return true;
      if (!allowedOrigin) return true;
      if (url.startsWith(allowedOrigin)) return true;
      Alert.alert(
        "External link blocked",
        "Golf Duels remains embedded in-app.",
      );
      return false;
    },
    [allowedOrigin],
  );

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setWebViewLoading(true);
    setWebViewKey((prev) => prev + 1);
  }, []);

  const handleHttpError = useCallback(
    (event: { nativeEvent: { statusCode: number; url: string } }) => {
      const { statusCode, url } = event.nativeEvent;
      setLoadError(`HTTP ${statusCode} while loading ${url}`);
    },
    [],
  );

  // ─── MENU MODE ──────────────────────────────────────────────────────
  if (mode === "menu") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            ⛳ Golf Duels
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Lobby menu */}
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Golf Duels
          </Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Mini-golf head-to-head — 9 holes, closest to par wins!
          </Text>

          <View style={styles.menuButtons}>
            <Button
              mode="contained"
              onPress={handlePlayOnline}
              style={[styles.playBtn, { backgroundColor: colors.primary }]}
              labelStyle={{ color: "#fff", fontSize: 16 }}
              icon="golf"
            >
              Play Online
            </Button>

            <Button
              mode="contained"
              onPress={handleInviteFriend}
              style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
              labelStyle={{ color: "#fff", fontSize: 16 }}
              icon="account-plus"
              loading={inviteLoading}
              disabled={inviteLoading}
            >
              Invite Friend
            </Button>
          </View>
        </View>

        {/* Friend picker modal for invites */}
        <FriendPickerModal
          visible={showInvitePicker}
          onDismiss={() => setShowInvitePicker(false)}
          onSelectFriend={handleSelectInviteFriend}
          currentUserId={currentFirebaseUser?.uid || ""}
          title="Challenge a Friend"
        />
      </View>
    );
  }

  // ─── PLAYING MODE (WebView) ─────────────────────────────────────────

  // Error state
  if (loadError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goMenu} style={styles.backBtn}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            ⛳ Golf Duels
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <Card style={styles.errorCard}>
          <Card.Content style={styles.errorContent}>
            <Text variant="headlineSmall" style={{ color: colors.text }}>
              Connection Failed
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Failed to load the Golf Duels game client.
            </Text>
            <Text style={[styles.meta, { color: "#f44336" }]}>{loadError}</Text>
            {probeReport.length > 0 ? (
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                Probe report:{"\n"}
                {probeReport.join("\n")}
              </Text>
            ) : null}
            <Button mode="contained" onPress={handleRetry}>
              Retry
            </Button>
            <Button mode="text" onPress={goMenu}>
              Back to Menu
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  // Loading / probing
  if (isProbing || !launchUrl) {
    return (
      <View style={[styles.container, { backgroundColor: "#1b5e20" }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goMenu} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.title, { color: "#fff" }]}>⛳ Golf Duels</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a5d6a7" />
          <Text style={styles.loadingText}>Connecting to game server...</Text>
          {probeReport.length > 0 ? (
            <Text style={styles.loadingSubText}>
              {probeReport[probeReport.length - 1]}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  // Game WebView with header overlay
  return (
    <View style={[styles.container, { backgroundColor: "#1b5e20" }]}>
      {/* Spectator banner */}
      {isSpectator && (
        <SpectatorBanner
          spectatorCount={0}
          onLeave={() => {
            goMenu();
          }}
        />
      )}

      {/* Back button overlay — always visible during gameplay */}
      {!isSpectator && (
        <View style={styles.gameHeader}>
          <TouchableOpacity onPress={goMenu} style={styles.gameBackBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <WebView
        key={`${webViewKey}:${launchUrl}`}
        source={{ uri: launchUrl }}
        style={styles.webView}
        originWhitelist={["http://*", "https://*"]}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        androidLayerType="hardware"
        mixedContentMode="always"
        allowsBackForwardNavigationGestures={false}
        onMessage={handleWebViewMessage}
        onShouldStartLoadWithRequest={(request) =>
          shouldAllowNavigation(request.url)
        }
        onLoadStart={() => setWebViewLoading(true)}
        onLoadEnd={() => setWebViewLoading(false)}
        onError={(event) => {
          setLoadError(
            event.nativeEvent.description ||
              "Unable to load Golf Duels client.",
          );
        }}
        onHttpError={handleHttpError}
      />

      {webViewLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <Card style={styles.loadingCard}>
            <Card.Content>
              <Text style={styles.loadingCardText}>Loading Golf Duels...</Text>
            </Card.Content>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Header (menu + loading + error) ───────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  // ── Menu ──────────────────────────────────────────────────────────
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 24, textAlign: "center" },
  menuButtons: { gap: 12, width: "100%", alignItems: "center" },
  playBtn: { minWidth: 200 },
  inviteBtn: { minWidth: 200 },
  // ── Game WebView overlay header ───────────────────────────────────
  gameHeader: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 32,
    left: 12,
    zIndex: 20,
  },
  gameBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  // ── WebView ───────────────────────────────────────────────────────
  webView: {
    flex: 1,
    backgroundColor: "#1b5e20",
  },
  // ── Loading states ────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    marginTop: 16,
    color: "#a5d6a7",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
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
  loadingCardText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  // ── Error state ───────────────────────────────────────────────────
  errorCard: {
    borderRadius: 16,
    margin: Spacing.lg,
  },
  errorContent: {
    gap: Spacing.md,
  },
  body: {
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
  },
});

export default withGameErrorBoundary(GolfDuelsGameScreen, GAME_TYPE);
