import type { ZoneId } from "../game/types";

export interface DiagnosticsSnapshot {
  fps: number;
  pingMs: number | null;
  playerCount: number;
  drawCalls: number;
  zoneId: ZoneId;
}

export class DiagnosticsOverlay {
  private readonly root: HTMLDivElement;
  private visible = false;

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "diagnostics-overlay hidden";
    this.root.textContent = "Diagnostics";
    document.body.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.classList.toggle("hidden", !visible);
  }

  update(snapshot: DiagnosticsSnapshot): void {
    if (!this.visible) {
      return;
    }
    this.root.innerHTML = `FPS: ${snapshot.fps.toFixed(1)}<br/>Ping: ${
      snapshot.pingMs === null ? "--" : `${Math.round(snapshot.pingMs)} ms`
    }<br/>Players: ${snapshot.playerCount}<br/>Draw Calls: ${snapshot.drawCalls}<br/>Zone: ${snapshot.zoneId}`;
  }

  dispose(): void {
    this.root.remove();
  }
}
