/**
 * Starforge — main entry point.
 * Routes between viewer mode (?mode=viewer) and game mode (default).
 */
import { startGame } from "./game/gameMain";
import { startViewer } from "./viewer";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") ?? "game";
const isEmbedded =
  params.get("embedded") === "1" ||
  typeof (window as unknown as Record<string, unknown>).ReactNativeWebView !==
    "undefined";

/**
 * Show a visible error overlay on the page so the user knows something went wrong,
 * and bridge the error to the RN WebView shell via postMessage.
 */
function showFatalError(error: Error | string): void {
  const message = typeof error === "string" ? error : error.message;

  // Show in the info-bar (always present in index.html)
  const infoBar = document.getElementById("info-bar");
  if (infoBar) {
    infoBar.style.display = "";
    infoBar.style.color = "#ff5555";
    infoBar.style.fontSize = "14px";
    infoBar.style.bottom = "50%";
    infoBar.style.left = "0";
    infoBar.style.right = "0";
    infoBar.style.textAlign = "center";
    infoBar.textContent = `❌ ${message}`;
  }

  // Bridge error to React Native WebView
  if (isEmbedded) {
    try {
      const rn = (window as unknown as Record<string, unknown>)
        .ReactNativeWebView as
        | { postMessage?: (msg: string) => void }
        | undefined;
      if (rn?.postMessage) {
        rn.postMessage(
          JSON.stringify({
            source: "starforge",
            type: "error",
            message,
          }),
        );
      }
    } catch {
      // postMessage bridge unavailable
    }
  }
}

if (mode === "viewer") {
  startViewer().catch((err) => {
    console.error("Failed to initialize Starforge viewer:", err);
    showFatalError(err);
  });
} else {
  startGame().catch((err) => {
    console.error("Failed to initialize Starforge game:", err);
    showFatalError(err);
  });
}
