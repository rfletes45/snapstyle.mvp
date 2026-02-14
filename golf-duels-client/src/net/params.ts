/**
 * Golf Duels Client — URL Query Parameter Parser
 *
 * The React Native WebView host injects connection parameters via URL query.
 * Example: ?server=ws://localhost:2567&room=golf_duels&firestoreGameId=abc123&embedded=1
 */

export interface ConnectionParams {
  serverUrl: string;
  roomName: string;
  firestoreGameId: string;
  role: "player" | "spectator";
  embedded: boolean;
  token?: string;
  uid?: string;
  displayName?: string;
}

export function parseQueryParams(): ConnectionParams {
  const params = new URLSearchParams(window.location.search);

  const serverUrl =
    params.get("server") || `ws://${window.location.hostname}:2567`;
  const roomName = params.get("room") || "golf_duels";
  const firestoreGameId = params.get("firestoreGameId") || "";
  const role = params.get("role") === "spectator" ? "spectator" : "player";
  const embedded = params.get("embedded") === "1";
  const token = params.get("token") || undefined;
  const uid = params.get("uid") || undefined;
  const displayName = params.get("displayName") || undefined;

  return {
    serverUrl,
    roomName,
    firestoreGameId,
    role,
    embedded,
    token,
    uid,
    displayName,
  };
}
