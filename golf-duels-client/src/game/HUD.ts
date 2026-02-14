/**
 * Golf Duels Client — HUD (Heads-Up Display)  (Segment 3)
 *
 * DOM-based overlay that shows:
 *  - Score board (holes won per player)
 *  - Strokes this hole (P1 / P2)
 *  - Current hole info (hole #, tier, par)
 *  - Shot clock countdown
 *  - Power bar (during shot)
 *  - Match progress bar (holes 1..N indicator row)
 *  - Status messages (waiting, your turn, etc.)
 *  - Hole result popup
 *  - Match result screen
 *  - Ready button (pre-game)
 *  - Error display
 */

/** Default total holes in a match */
const DEFAULT_TOTAL_HOLES = 5;

export class HUD {
  private root: HTMLDivElement;

  // Top bar elements
  private scoreP1: HTMLSpanElement;
  private scoreP2: HTMLSpanElement;
  private nameP1: HTMLSpanElement;
  private nameP2: HTMLSpanElement;
  private holeLabel: HTMLSpanElement;
  private shotClockEl: HTMLSpanElement;

  // Strokes this hole
  private strokesRow: HTMLDivElement;
  private strokesP1: HTMLSpanElement;
  private strokesP2: HTMLSpanElement;

  // Match progress bar (holes 1..N)
  private progressRow: HTMLDivElement;
  private holeDots: HTMLSpanElement[] = [];
  private totalHoles = DEFAULT_TOTAL_HOLES;

  // Center overlay
  private statusOverlay: HTMLDivElement;
  private statusText: HTMLSpanElement;

  // Power bar
  private powerBarContainer: HTMLDivElement;
  private powerBarFill: HTMLDivElement;

  // Bottom buttons
  private bottomBar: HTMLDivElement;
  private readyBtn: HTMLButtonElement;

  // Result screen
  private resultScreen: HTMLDivElement;
  private resultTitle: HTMLHeadingElement;
  private resultBody: HTMLDivElement;

  // Error
  private errorBar: HTMLDivElement;

  private onReadyClick: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.id = "hud-root";

    // ---- Top Bar -----------------------------------------------------------
    const topBar = this.el("div", "hud-top-bar");

    const p1Block = this.el("div", "hud-player hud-player-left");
    this.nameP1 = this.el("span", "hud-player-name") as HTMLSpanElement;
    this.nameP1.textContent = "Player 1";
    this.scoreP1 = this.el("span", "hud-player-score") as HTMLSpanElement;
    this.scoreP1.textContent = "0";
    p1Block.append(this.nameP1, this.scoreP1);

    const centerBlock = this.el("div", "hud-center-info");
    this.holeLabel = this.el("span", "hud-hole-label") as HTMLSpanElement;
    this.holeLabel.textContent = "Hole 1";
    this.shotClockEl = this.el("span", "hud-shot-clock") as HTMLSpanElement;
    this.shotClockEl.textContent = "30";
    centerBlock.append(this.holeLabel, this.shotClockEl);

    const p2Block = this.el("div", "hud-player hud-player-right");
    this.nameP2 = this.el("span", "hud-player-name") as HTMLSpanElement;
    this.nameP2.textContent = "Player 2";
    this.scoreP2 = this.el("span", "hud-player-score") as HTMLSpanElement;
    this.scoreP2.textContent = "0";
    p2Block.append(this.nameP2, this.scoreP2);

    topBar.append(p1Block, centerBlock, p2Block);

    // ---- Strokes This Hole -------------------------------------------------
    this.strokesRow = this.el("div", "hud-strokes-row") as HTMLDivElement;
    this.strokesP1 = this.el("span", "hud-strokes-p1") as HTMLSpanElement;
    this.strokesP1.textContent = "P1: 0";
    this.strokesP2 = this.el("span", "hud-strokes-p2") as HTMLSpanElement;
    this.strokesP2.textContent = "P2: 0";
    const strokesLabel = this.el(
      "span",
      "hud-strokes-label",
    ) as HTMLSpanElement;
    strokesLabel.textContent = "Strokes";
    this.strokesRow.append(this.strokesP1, strokesLabel, this.strokesP2);

    // ---- Match Progress Bar ------------------------------------------------
    this.progressRow = this.el("div", "hud-progress-row") as HTMLDivElement;
    this.buildProgressDots(this.totalHoles);

    // ---- Status Overlay ----------------------------------------------------
    this.statusOverlay = this.el("div", "hud-status-overlay") as HTMLDivElement;
    this.statusText = this.el("span", "hud-status-text") as HTMLSpanElement;
    this.statusOverlay.append(this.statusText);
    this.statusOverlay.style.display = "none";

    // ---- Power Bar ---------------------------------------------------------
    this.powerBarContainer = this.el(
      "div",
      "hud-power-bar-container",
    ) as HTMLDivElement;
    this.powerBarFill = this.el("div", "hud-power-bar-fill") as HTMLDivElement;
    this.powerBarContainer.append(this.powerBarFill);
    this.powerBarContainer.style.display = "none";

    // ---- Bottom Bar --------------------------------------------------------
    this.bottomBar = this.el("div", "hud-bottom-bar") as HTMLDivElement;
    this.readyBtn = this.el("button", "hud-ready-btn") as HTMLButtonElement;
    this.readyBtn.textContent = "READY";
    this.readyBtn.style.display = "none";
    this.readyBtn.addEventListener("click", () => this.onReadyClick?.());
    this.bottomBar.append(this.readyBtn);

    // ---- Result Screen -----------------------------------------------------
    this.resultScreen = this.el("div", "hud-result-screen") as HTMLDivElement;
    this.resultTitle = this.el("h1", "hud-result-title") as HTMLHeadingElement;
    this.resultBody = this.el("div", "hud-result-body") as HTMLDivElement;
    this.resultScreen.append(this.resultTitle, this.resultBody);
    this.resultScreen.style.display = "none";

    // ---- Error Bar ---------------------------------------------------------
    this.errorBar = this.el("div", "hud-error-bar") as HTMLDivElement;
    this.errorBar.style.display = "none";

    // Assemble
    this.root.append(
      topBar,
      this.strokesRow,
      this.progressRow,
      this.statusOverlay,
      this.powerBarContainer,
      this.bottomBar,
      this.resultScreen,
      this.errorBar,
    );
    container.appendChild(this.root);
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  setPlayerNames(p1: string, p2: string): void {
    this.nameP1.textContent = p1;
    this.nameP2.textContent = p2;
  }

  updateScore(p1Holes: number, p2Holes: number): void {
    this.scoreP1.textContent = String(p1Holes);
    this.scoreP2.textContent = String(p2Holes);
  }

  /** Update strokes-this-hole counters */
  updateStrokes(p1Strokes: number, p2Strokes: number): void {
    this.strokesP1.textContent = `P1: ${p1Strokes}`;
    this.strokesP2.textContent = `P2: ${p2Strokes}`;
  }

  setHoleLabel(holeNum: number, totalHoles?: number): void {
    if (totalHoles) this.setTotalHoles(totalHoles);
    const suffix = totalHoles ? ` / ${totalHoles}` : "";
    this.holeLabel.textContent = `Hole ${holeNum}${suffix}`;
  }

  /** Set total match holes and rebuild progress dots */
  setTotalHoles(n: number): void {
    if (n !== this.totalHoles) {
      this.totalHoles = n;
      this.buildProgressDots(n);
    }
  }

  /** Highlight progress dots up to the given completed hole number */
  updateMatchProgress(completedHole: number): void {
    for (let i = 0; i < this.holeDots.length; i++) {
      this.holeDots[i].classList.toggle("hud-dot-completed", i < completedHole);
      this.holeDots[i].classList.toggle("hud-dot-current", i === completedHole);
    }
  }

  updateShotClock(seconds: number): void {
    this.shotClockEl.textContent = String(Math.ceil(seconds));
    this.shotClockEl.classList.toggle("hud-shot-clock-urgent", seconds <= 5);
  }

  showStatus(message: string): void {
    this.statusText.textContent = message;
    this.statusOverlay.style.display = "flex";
  }

  hideStatus(): void {
    this.statusOverlay.style.display = "none";
  }

  showPowerBar(power: number): void {
    this.powerBarContainer.style.display = "block";
    const pct = Math.min(100, Math.max(0, power * 100));
    this.powerBarFill.style.width = `${pct}%`;

    // Color: green → yellow → red
    if (pct < 50) {
      this.powerBarFill.style.backgroundColor = `rgb(${Math.round(
        pct * 5.1,
      )}, 200, 50)`;
    } else {
      this.powerBarFill.style.backgroundColor = `rgb(220, ${Math.round(
        (100 - pct) * 4,
      )}, 50)`;
    }
  }

  hidePowerBar(): void {
    this.powerBarContainer.style.display = "none";
  }

  showReadyButton(onClick: () => void): void {
    this.onReadyClick = onClick;
    this.readyBtn.style.display = "block";
  }

  hideReadyButton(): void {
    this.readyBtn.style.display = "none";
  }

  showHoleResult(
    holeNum: number,
    winner: string | null,
    p1Strokes: number,
    p2Strokes: number,
  ): void {
    const resultText = winner
      ? `${winner} wins hole ${holeNum}!`
      : `Hole ${holeNum} halved`;

    this.showStatus(`${resultText}  (${p1Strokes} - ${p2Strokes})`);

    setTimeout(() => this.hideStatus(), 3000);
  }

  showMatchResult(
    winner: string | null,
    p1Holes: number,
    p2Holes: number,
    reason: string,
  ): void {
    if (winner) {
      this.resultTitle.textContent = `${winner} wins!`;
    } else {
      this.resultTitle.textContent = "Match Draw!";
    }

    this.resultBody.innerHTML = `
      <p class="hud-result-score">${p1Holes} - ${p2Holes}</p>
      <p class="hud-result-reason">${reason}</p>
    `;

    this.resultScreen.style.display = "flex";
  }

  showError(message: string): void {
    this.errorBar.textContent = message;
    this.errorBar.style.display = "block";

    setTimeout(() => {
      this.errorBar.style.display = "none";
    }, 5000);
  }

  /** Highlight active player. Pass slot of active player ("p1"/"p2") + local slot */
  setActivePlayer(activeSlot: string, localSlot: string): void {
    if (activeSlot === localSlot) {
      this.showStatus("Your turn — aim and shoot!");
    } else {
      this.showStatus("Opponent's turn…");
    }
  }

  dispose(): void {
    this.root.remove();
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private el(tag: string, className: string): HTMLElement {
    const e = document.createElement(tag);
    e.className = className;
    return e;
  }

  /** Build N dots for match progress indicator */
  private buildProgressDots(count: number): void {
    this.progressRow.innerHTML = "";
    this.holeDots = [];
    for (let i = 0; i < count; i++) {
      const dot = this.el("span", "hud-progress-dot") as HTMLSpanElement;
      dot.textContent = String(i + 1);
      this.holeDots.push(dot);
      this.progressRow.append(dot);
    }
  }
}
