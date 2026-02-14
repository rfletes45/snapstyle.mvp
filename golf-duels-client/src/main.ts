/**
 * Golf Duels Client — Main Entry Point  (Segment 3)
 *
 * Exposes `startGolfDuelsGame(params)` as the programmatic entry point.
 * Also auto-boots from URL query params when running standalone in browser.
 *
 * Param sources (priority order):
 *  1. Direct JS call: window.startGolfDuelsGame({ ... })
 *  2. URL query string (injected by React Native WebView)
 */

import { GolfGame } from "./game/GolfGame";
import { HUD } from "./game/HUD";
import { GolfClient } from "./net/GolfClient";
import { type ConnectionParams, parseQueryParams } from "./net/params";

import "./styles.css";

// ============================================================================
// Types
// ============================================================================

export interface StartGolfDuelsParams {
  currentUser: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
    authToken: string;
  };
  /** One of these must be provided to connect */
  inviteId?: string;
  matchId?: string;
  roomReservation?: { roomId: string; sessionId: string };
  /** Colyseus server URL (default: derived from window.location) */
  serverUrl?: string;
  /** Callbacks */
  onExit?: () => void;
  onMatchEnd?: (result: {
    winner: string | null;
    p1HolesWon: number;
    p2HolesWon: number;
  }) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// startGolfDuelsGame API
// ============================================================================

let activeGame: GolfGame | null = null;

export async function startGolfDuelsGame(
  params: StartGolfDuelsParams,
): Promise<{ dispose: () => void }> {
  // Dispose previous instance if any
  activeGame?.dispose();

  const container = document.getElementById("app");
  if (!container) throw new Error("Missing #app container");

  // Map params to GolfClient connection format
  const connectionParams: ConnectionParams = {
    serverUrl: params.serverUrl || `ws://${window.location.hostname}:2567`,
    roomName: "golf_duels",
    firestoreGameId: params.inviteId || params.matchId || "",
    role: "player",
    embedded: true,
    token: params.currentUser.authToken,
    uid: params.currentUser.uid,
    displayName: params.currentUser.displayName,
  };

  const hud = new HUD(container);
  hud.showStatus("Connecting...");

  const client = new GolfClient(connectionParams);
  const game = new GolfGame(container, client, hud);
  activeGame = game;

  // Wire callbacks
  if (params.onMatchEnd) {
    const originalOnMatchEnd = client.onMatchEnd;
    client.onMatchEnd = (result) => {
      originalOnMatchEnd?.(result);
      params.onMatchEnd!({
        winner: result.winner,
        p1HolesWon: result.p1HolesWon,
        p2HolesWon: result.p2HolesWon,
      });
    };
  }

  if (params.onError) {
    const originalOnError = client.onError;
    client.onError = (err) => {
      originalOnError?.(err);
      params.onError!(err);
    };
  }

  // Connect
  try {
    await client.connect();
    hud.showStatus("Waiting for opponent...");
  } catch (err) {
    const msg = String(err);
    hud.showError(`Connection failed: ${msg}`);
    params.onError?.(msg);
    sendToRN({ source: "golf_duels", type: "error", message: msg });
    throw err;
  }

  // Start render loop
  game.start();

  // Back / exit handler
  const exitHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Backspace") {
      params.onExit?.();
      sendToRN({ source: "golf_duels", type: "back" });
    }
  };
  window.addEventListener("keydown", exitHandler);

  return {
    dispose: () => {
      window.removeEventListener("keydown", exitHandler);
      game.dispose();
      activeGame = null;
    },
  };
}

// Expose globally for WebView bridge
(window as any).startGolfDuelsGame = startGolfDuelsGame;

// ============================================================================
// Auto-boot from URL params (standalone / WebView mode)
// ============================================================================

async function autoMain() {
  const container = document.getElementById("app");
  if (!container) return;

  const params = parseQueryParams();

  // Show a fullscreen loading splash instead of blank green while waiting
  const splash = document.createElement("div");
  splash.id = "golf-splash";
  splash.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;z-index:100;" +
    "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "color:#fff;font-family:sans-serif;text-align:center;padding:24px;" +
    "background:radial-gradient(ellipse at center,#1a5c2e 0%,#12371d 100%);";
  splash.innerHTML = `
    <div style="font-size:56px;margin-bottom:16px;">⛳</div>
    <div style="font-size:24px;font-weight:700;margin-bottom:8px;">Golf Duels</div>
    <div id="golf-splash-status" style="font-size:14px;opacity:0.8;">Initializing...</div>
  `;
  container.appendChild(splash);

  const splashStatus = splash.querySelector(
    "#golf-splash-status",
  ) as HTMLElement;
  const setSplashStatus = (msg: string) => {
    if (splashStatus) splashStatus.textContent = msg;
  };

  // If no uid in URL and not embedded, wait for programmatic startGolfDuelsGame call
  if (!params.uid && !params.embedded) {
    setSplashStatus("Waiting for game launch...");
    return;
  }

  // If embedded but uid still missing, show a clear message
  if (!params.uid) {
    setSplashStatus("Waiting for authentication...");
    return;
  }

  setSplashStatus("Connecting to server...");

  const hud = new HUD(container);

  const client = new GolfClient(params);
  const game = new GolfGame(container, client, hud);
  activeGame = game;

  // Wire match_end to notify the React Native host so it can update UI / invite
  client.onMatchEnd = (result) => {
    sendToRN({
      source: "golf_duels",
      type: "match_end",
      winner: result.winner,
      reason: result.reason,
      p1HolesWon: result.p1HolesWon,
      p2HolesWon: result.p2HolesWon,
    });
  };

  try {
    await client.connect();
    // Remove splash once connected — the HUD + canvas take over
    splash.remove();
    hud.showStatus("Waiting for opponent...");
  } catch (err) {
    setSplashStatus(`Connection failed: ${err}`);
    sendToRN({ source: "golf_duels", type: "error", message: String(err) });
    return;
  }

  game.start();

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Backspace") {
      sendToRN({ source: "golf_duels", type: "back" });
    }
  });
}

/** Send a message to the React Native WebView host */
function sendToRN(message: Record<string, unknown>) {
  if ((window as any).ReactNativeWebView) {
    (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
  }
}

// Global error handler — shows errors visually instead of blank green screen
window.addEventListener("error", (event) => {
  showFatalError(`JS Error: ${event.message}`);
});
window.addEventListener("unhandledrejection", (event) => {
  showFatalError(`Unhandled: ${event.reason}`);
});

function showFatalError(msg: string) {
  const container = document.getElementById("app");
  if (!container) return;
  // Only inject once
  if (document.getElementById("golf-fatal-error")) return;
  const el = document.createElement("div");
  el.id = "golf-fatal-error";
  el.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;z-index:9999;" +
    "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "background:rgba(0,0,0,0.85);color:#ff6b6b;font-family:sans-serif;" +
    "text-align:center;padding:24px;";
  el.innerHTML = `
    <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Golf Duels Error</div>
    <div style="font-size:13px;opacity:0.9;max-width:320px;word-break:break-word;">${msg}</div>
  `;
  container.appendChild(el);
  sendToRN({ source: "golf_duels", type: "error", message: msg });
}

autoMain().catch((err) => {
  console.error("Golf Duels autoMain failed:", err);
  showFatalError(String(err));
});
