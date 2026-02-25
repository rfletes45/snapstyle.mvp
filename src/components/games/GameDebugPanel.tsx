/**
 * GameDebugPanel — DEV-only diagnostic panel for game state
 *
 * Shows:
 * - Current AsyncStorage recovery bookmark (if any)
 * - Bookmark fields in a readable format
 * - "Clear Stuck Game State" button that wipes the bookmark
 *
 * Only renders when `__DEV__` is true. In production builds the component
 * returns `null` — zero runtime cost.
 *
 * Usage (in GamesHubScreen):
 *   <GameDebugPanel />
 *
 * @module components/games/GameDebugPanel
 */

import {
  clearActiveSession,
  getActiveSessionBookmark,
  type ActiveSessionBookmark,
} from "@/services/gameRecovery";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DebugState {
  bookmark: ActiveSessionBookmark | null;
  loading: boolean;
  lastRefresh: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GameDebugPanel() {
  // Only render in dev mode
  if (!__DEV__) return null;

  return <GameDebugPanelInner />;
}

function GameDebugPanelInner() {
  const [state, setState] = useState<DebugState>({
    bookmark: null,
    loading: true,
    lastRefresh: 0,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const bookmark = await getActiveSessionBookmark();
      setState({
        bookmark,
        loading: false,
        lastRefresh: Date.now(),
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClear = useCallback(async () => {
    await clearActiveSession();
    await refresh();
  }, [refresh]);

  const { bookmark, loading, lastRefresh } = state;

  const age = bookmark
    ? Math.round((Date.now() - bookmark.savedAt) / 1000)
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>🛠️ DEV: Game State Debug</Text>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.statusText}>Loading…</Text>
      ) : bookmark ? (
        <View style={styles.bookmarkBox}>
          <Text style={styles.alertText}>
            ⚠️ Active bookmark found — recovery banner may show
          </Text>
          <Text style={styles.mono}>inviteId: {bookmark.inviteId}</Text>
          <Text style={styles.mono}>gameType: {bookmark.gameType}</Text>
          <Text style={styles.mono}>
            firestoreGameId: {bookmark.firestoreGameId ?? "—"}
          </Text>
          <Text style={styles.mono}>userId: {bookmark.userId}</Text>
          <Text style={styles.mono}>
            isTurnBased: {String(bookmark.isTurnBased)}
          </Text>
          <Text style={styles.mono}>
            savedAt: {new Date(bookmark.savedAt).toLocaleTimeString()}
            {age !== null ? ` (${age}s ago)` : ""}
          </Text>
          <Text style={styles.mono}>
            reconnectionToken: {bookmark.reconnectionToken ? "✓" : "—"}
          </Text>
          <Text style={styles.mono}>
            conversationId: {bookmark.conversationId ?? "—"}
          </Text>

          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <Text style={styles.clearBtnText}>🗑️ Clear Stuck Game State</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.statusText}>
          ✅ No active bookmark — hub is clean
        </Text>
      )}

      {lastRefresh > 0 && (
        <Text style={styles.timestamp}>
          Last check: {new Date(lastRefresh).toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    margin: 12,
    padding: 12,
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e94560",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerText: {
    color: "#e94560",
    fontWeight: "bold",
    fontSize: 13,
  },
  refreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#16213e",
    borderRadius: 4,
  },
  refreshBtnText: {
    color: "#0f3460",
    fontSize: 12,
    fontWeight: "600",
    // Use accent color for text
    // @ts-ignore color override
  },
  statusText: {
    color: "#a0a0b0",
    fontSize: 12,
  },
  alertText: {
    color: "#e94560",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  bookmarkBox: {
    backgroundColor: "#16213e",
    borderRadius: 6,
    padding: 8,
  },
  mono: {
    color: "#c0c0d0",
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 18,
  },
  clearBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#e94560",
    borderRadius: 6,
    alignItems: "center",
  },
  clearBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
  timestamp: {
    color: "#606070",
    fontSize: 10,
    marginTop: 6,
    textAlign: "right",
  },
});
