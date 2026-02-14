/**
 * HUD — DOM-based mobile-friendly bottom bar.
 * Shows 3 resources, TAP button, machine shop, upgrade store, Reset.
 */
import type { BranchesCatalog } from "../data/branchesSchema";
import type { ContractsCatalog } from "../data/contractsSchema";
import type { EventsCatalog } from "../data/eventsSchema";
import type {
  MachineCategoriesCatalog,
  MachineCategory,
} from "../data/machineCategoriesSchema";
import type {
  MachinesCatalog,
  MachinesV2Catalog,
} from "../data/machinesSchema";
import type { MilestonesCatalog } from "../data/milestonesSchema";
import type { RebirthTreeCatalog } from "../data/rebirthSchema";
import type {
  TierUnlocksCatalog,
  TierUnlocksV2Catalog,
} from "../data/tierUnlocksSchema";
import type {
  UpgradesCatalog,
  UpgradesV2Catalog,
} from "../data/upgradesSchema";
import {
  buildConditionContext,
  isMachineV2Visible,
  isUpgradeV2Visible,
} from "../sim/derived";
import { canRebirth, computeRebirthShards, getDerived } from "../sim/reducer";
import type { SimStateV1 } from "../sim/types";
import { microToCompact } from "../sim/types";
import "./styles.css";

export interface HUD {
  /** Full state update. */
  update(state: SimStateV1): void;
  /** Register tap callback. */
  onTap(cb: () => void): void;
  /** Register buy-machine callback (code, qty). */
  onBuyMachine(cb: (code: string, qty: number) => void): void;
  /** Register buy-upgrade callback (v1). */
  onBuyUpgrade(cb: (id: string) => void): void;
  /** Register buy-upgrade-v2 callback. */
  onBuyUpgradeV2(cb: (id: string) => void): void;
  /** Register upgrade-machine-tier callback (by code). */
  onUpgradeTier(cb: (code: string) => void): void;
  /** Register toggle-machine-enabled callback. */
  onToggleMachineEnabled(cb: (code: string, enabled: boolean) => void): void;
  /** Register start-contract callback. */
  onStartContract(cb: (contractId: string) => void): void;
  /** Register claim-contract callback. */
  onClaimContract(cb: () => void): void;
  /** Register tap-event callback. */
  onTapEvent(cb: () => void): void;
  /** Register dismiss-milestone callback. */
  onDismissMilestone(cb: () => void): void;
  /** Register reset callback. */
  onReset(cb: () => void): void;
  /** Register confirm-rebirth callback. */
  onConfirmRebirth(cb: () => void): void;
  /** Register buy-rebirth-node callback. */
  onBuyRebirthNode(cb: (nodeId: string) => void): void;
  /** Register back-button callback (in-viewer back). */
  onBack(cb: () => void): void;
  /** Register layout-change callback (called when HUD height changes). */
  onLayoutChange(cb: (hudHeightPx: number) => void): void;
  /** Register auto-rotate toggle callback. */
  onAutoRotateToggle(cb: (enabled: boolean) => void): void;
  /** Enable or disable spectator mode (dims controls, shows badge). */
  setSpectatorMode(enabled: boolean): void;
  /** Remove the HUD from the DOM. */
  destroy(): void;
}

/**
 * Create and mount the game HUD into a container element.
 */
export function createHUD(
  container: HTMLElement,
  machinesCatalog: MachinesCatalog,
  upgradesCatalog: UpgradesCatalog,
  upgradesV2Catalog: UpgradesV2Catalog,
  contractsCatalog: ContractsCatalog,
  eventsCatalog: EventsCatalog,
  milestonesCatalog: MilestonesCatalog,
  tierUnlocksCatalog: TierUnlocksCatalog,
  categoriesCatalog: MachineCategoriesCatalog,
  machinesV2Catalog?: MachinesV2Catalog,
  branchesCatalog?: BranchesCatalog,
  tierUnlocksV2Catalog?: TierUnlocksV2Catalog,
  rebirthTreeCatalog?: RebirthTreeCatalog,
): HUD {
  const root = document.createElement("div");
  root.id = "game-hud";

  // ── Back button (top-left, safe-area aware) ────────────
  // Guard: only create if not already in DOM (avoids duplicate with RN overlay)
  let backBtn = document.getElementById(
    "sf-back-btn",
  ) as HTMLButtonElement | null;
  if (!backBtn) {
    backBtn = document.createElement("button");
    backBtn.id = "sf-back-btn";
    backBtn.textContent = "← Back";
    container.appendChild(backBtn);
  }

  // ── Resource panel (top-left, vertical stack) ──────────
  const resourcesPanel = document.createElement("div");
  resourcesPanel.id = "resources-panel";

  // ── Auto-rotate toggle (top-right, small icon button) ──
  let autoRotateEnabled = true;
  let autoRotateToggleCb: ((enabled: boolean) => void) | null = null;
  const autoRotateBtn = document.createElement("button");
  autoRotateBtn.id = "auto-rotate-btn";
  autoRotateBtn.textContent = "🔄";
  autoRotateBtn.title = "Toggle auto-rotate";
  autoRotateBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    autoRotateEnabled = !autoRotateEnabled;
    autoRotateBtn.classList.toggle("off", !autoRotateEnabled);
    autoRotateBtn.textContent = autoRotateEnabled ? "🔄" : "🚫";
    autoRotateToggleCb?.(autoRotateEnabled);
  });
  container.appendChild(autoRotateBtn);
  resourcesPanel.id = "resources-panel";

  const fluxEl = makeResPill("⚡", "Flux", "#31d6ff");
  const alloyEl = makeResPill("🔧", "Alloy", "#c0c0c0");
  const signalEl = makeResPill("📡", "Signal", "#88ff33");
  const wreckEl = makeResPill("🛸", "Wrecks", "#ffaa33");
  resourcesPanel.append(fluxEl.root, alloyEl.root, signalEl.root, wreckEl.root);
  container.appendChild(resourcesPanel);

  // ── Boost status widget (top-right, shows active effects) ──
  const boostStatusPanel = document.createElement("div");
  boostStatusPanel.id = "boost-status";
  boostStatusPanel.classList.add("hidden");
  container.appendChild(boostStatusPanel);

  // ── Event status indicator (top-right, below boost panel) ──
  const eventStatusPanel = document.createElement("div");
  eventStatusPanel.id = "event-status";
  eventStatusPanel.classList.add("hidden");
  container.appendChild(eventStatusPanel);

  // ── Event orb ──────────────────────────────────────────
  const eventOrb = document.createElement("button");
  eventOrb.id = "event-orb";
  eventOrb.classList.add("hidden");
  root.appendChild(eventOrb);

  // ── Milestone toast (floating, outside HUD flow) ──────
  const milestoneToast = document.createElement("div");
  milestoneToast.id = "milestone-toast";
  milestoneToast.classList.add("hidden");
  container.appendChild(milestoneToast);

  // ── CUT button (v2: was TAP) ────────────────────────────
  const tapBtn = document.createElement("button");
  tapBtn.id = "tap-btn";
  tapBtn.textContent = "✂️ CUT";
  tapBtn.disabled = true; // disabled until a wreck is docked
  root.appendChild(tapBtn);

  // ── Dock status panel ──────────────────────────────────
  const dockPanel = document.createElement("div");
  dockPanel.id = "dock-status-panel";
  dockPanel.style.cssText =
    "text-align:center;font-size:12px;color:#aaa;margin-bottom:4px;";

  const dockStatusText = document.createElement("div");
  dockStatusText.id = "dock-status-text";
  dockStatusText.textContent = "🔍 Select a wreck";
  dockPanel.appendChild(dockStatusText);

  // HP bar container (hidden when no wreck docked)
  const hpBarWrap = document.createElement("div");
  hpBarWrap.id = "dock-hp-bar-wrap";
  hpBarWrap.style.cssText =
    "display:none;height:8px;background:rgba(255,255,255,0.1);" +
    "border-radius:4px;overflow:hidden;margin-top:4px;";
  const hpBarFill = document.createElement("div");
  hpBarFill.id = "dock-hp-bar-fill";
  hpBarFill.style.cssText =
    "height:100%;background:#ff4444;transition:width 60ms linear;width:100%;";
  hpBarWrap.appendChild(hpBarFill);
  dockPanel.appendChild(hpBarWrap);

  root.insertBefore(dockPanel, tapBtn);

  // ── Button row for Machine shop + Upgrades ─────────────
  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "8px";

  const shopBtn = document.createElement("button");
  shopBtn.id = "shop-toggle-btn";
  shopBtn.textContent = "🏭 Machines";

  const upgradeBtn = document.createElement("button");
  upgradeBtn.id = "upgrade-toggle-btn";
  upgradeBtn.className = "action-toggle-btn";
  upgradeBtn.textContent = "🔬 Upgrades";
  upgradeBtn.style.background = "rgba(51, 255, 136, 0.12)";
  upgradeBtn.style.borderColor = "#33ff8844";
  upgradeBtn.style.color = "#88ffaa";

  const contractsBtn = document.createElement("button");
  contractsBtn.id = "contracts-toggle-btn";
  contractsBtn.className = "action-toggle-btn";
  contractsBtn.textContent = "📜 Contracts";
  contractsBtn.style.background = "rgba(255, 200, 50, 0.12)";
  contractsBtn.style.borderColor = "#ffc83244";
  contractsBtn.style.color = "#ffdd66";

  btnRow.append(shopBtn, upgradeBtn, contractsBtn);
  root.appendChild(btnRow);

  // ── Rebirth button (visible when gate is met) ─────────
  const rebirthBtn = document.createElement("button");
  rebirthBtn.id = "rebirth-btn";
  rebirthBtn.className = "action-toggle-btn";
  rebirthBtn.textContent = "♻️ Rebirth";
  rebirthBtn.style.background = "rgba(200, 50, 255, 0.15)";
  rebirthBtn.style.borderColor = "#c832ff44";
  rebirthBtn.style.color = "#d88aff";
  rebirthBtn.style.display = "none"; // hidden until gate met
  root.appendChild(rebirthBtn);

  // ── Rebirth modal overlay ──────────────────────────────
  const rebirthOverlay = document.createElement("div");
  rebirthOverlay.id = "rebirth-overlay";
  rebirthOverlay.classList.add("hidden");
  rebirthOverlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9998;" +
    "display:flex;align-items:center;justify-content:center;";

  const rebirthModal = document.createElement("div");
  rebirthModal.style.cssText =
    "background:#1a1a2a;border:1px solid #c832ff;border-radius:12px;" +
    "padding:20px;max-width:360px;width:90%;color:#eee;text-align:center;";

  const rebirthModalTitle = document.createElement("h3");
  rebirthModalTitle.textContent = "♻️ Rebirth";
  rebirthModalTitle.style.color = "#d88aff";

  const rebirthShardPreview = document.createElement("div");
  rebirthShardPreview.style.cssText =
    "font-size:20px;margin:12px 0;color:#ffd700;";

  const rebirthInfoText = document.createElement("div");
  rebirthInfoText.style.cssText =
    "font-size:12px;color:#aaa;margin-bottom:16px;";
  rebirthInfoText.innerHTML =
    "<b>Resets:</b> Resources, machines, upgrades, wrecks<br>" +
    "<b>Keeps:</b> Core Shards, rebirth tree, lifetime stats";

  const rebirthHoldBtn = document.createElement("button");
  rebirthHoldBtn.textContent = "Hold to Confirm (1.5s)";
  rebirthHoldBtn.style.cssText =
    "padding:10px 24px;font-size:16px;background:#8b00cc;color:#fff;" +
    "border:2px solid #c832ff;border-radius:8px;cursor:pointer;" +
    "position:relative;overflow:hidden;";

  // Hold-to-confirm logic
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdProgress: HTMLDivElement | null = null;

  function startHold(): void {
    if (holdProgress) holdProgress.remove();
    holdProgress = document.createElement("div");
    holdProgress.style.cssText =
      "position:absolute;left:0;bottom:0;height:4px;background:#ffd700;" +
      "width:0;transition:width 1.5s linear;";
    rebirthHoldBtn.appendChild(holdProgress);
    requestAnimationFrame(() => {
      if (holdProgress) holdProgress.style.width = "100%";
    });
    holdTimer = setTimeout(() => {
      confirmRebirthCb?.();
      rebirthOverlay.classList.add("hidden");
      cancelHold();
    }, 1500);
  }

  function cancelHold(): void {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (holdProgress) {
      holdProgress.remove();
      holdProgress = null;
    }
  }

  rebirthHoldBtn.addEventListener("mousedown", startHold);
  rebirthHoldBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startHold();
  });
  rebirthHoldBtn.addEventListener("mouseup", cancelHold);
  rebirthHoldBtn.addEventListener("mouseleave", cancelHold);
  rebirthHoldBtn.addEventListener("touchend", cancelHold);
  rebirthHoldBtn.addEventListener("touchcancel", cancelHold);

  const rebirthCancelBtn = document.createElement("button");
  rebirthCancelBtn.textContent = "Cancel";
  rebirthCancelBtn.style.cssText =
    "padding:8px 20px;font-size:14px;background:transparent;" +
    "color:#aaa;border:1px solid #555;border-radius:8px;cursor:pointer;margin-top:8px;";
  rebirthCancelBtn.addEventListener("click", () => {
    rebirthOverlay.classList.add("hidden");
    cancelHold();
  });

  rebirthModal.append(
    rebirthModalTitle,
    rebirthShardPreview,
    rebirthInfoText,
    rebirthHoldBtn,
    document.createElement("br"),
    rebirthCancelBtn,
  );
  rebirthOverlay.appendChild(rebirthModal);
  rebirthOverlay.addEventListener("click", (e) => {
    if (e.target === rebirthOverlay) {
      rebirthOverlay.classList.add("hidden");
      cancelHold();
    }
  });
  container.appendChild(rebirthOverlay);

  // ── Rebirth tree panel ─────────────────────────────────
  const rebirthTreePanel = document.createElement("div");
  rebirthTreePanel.id = "rebirth-tree-panel";
  rebirthTreePanel.classList.add("hidden");
  rebirthTreePanel.style.cssText =
    "max-height:280px;overflow-y:auto;padding:8px;";

  const rebirthTreeTitle = document.createElement("h3");
  rebirthTreeTitle.textContent = "🌳 Rebirth Tree";
  rebirthTreeTitle.style.color = "#d88aff";
  rebirthTreePanel.appendChild(rebirthTreeTitle);

  const rebirthTreeShardsLabel = document.createElement("div");
  rebirthTreeShardsLabel.style.cssText =
    "font-size:13px;color:#ffd700;margin-bottom:8px;";
  rebirthTreePanel.appendChild(rebirthTreeShardsLabel);

  const rebirthTreeGrid = document.createElement("div");
  rebirthTreeGrid.style.cssText = "display:flex;flex-direction:column;gap:6px;";
  rebirthTreePanel.appendChild(rebirthTreeGrid);
  root.appendChild(rebirthTreePanel);

  // Rebirth button opens modal, tree panel accessible via separate toggle inside modal
  rebirthBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // Toggle rebirth tree panel if no modal
    if (rebirthTreePanel.classList.contains("hidden")) {
      rebirthTreePanel.classList.remove("hidden");
      setUIStateLazy({ activePanel: "none" }); // close other panels
    } else {
      rebirthTreePanel.classList.add("hidden");
    }
  });

  // Long-press on rebirth button opens the rebirth modal (if gate is met)
  let rebirthBtnHoldTimer: ReturnType<typeof setTimeout> | null = null;
  rebirthBtn.addEventListener("mousedown", () => {
    rebirthBtnHoldTimer = setTimeout(() => {
      rebirthOverlay.classList.remove("hidden");
    }, 400);
  });
  rebirthBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    rebirthBtnHoldTimer = setTimeout(() => {
      rebirthOverlay.classList.remove("hidden");
    }, 400);
  });
  rebirthBtn.addEventListener("mouseup", () => {
    if (rebirthBtnHoldTimer) {
      clearTimeout(rebirthBtnHoldTimer);
      rebirthBtnHoldTimer = null;
    }
  });
  rebirthBtn.addEventListener("mouseleave", () => {
    if (rebirthBtnHoldTimer) {
      clearTimeout(rebirthBtnHoldTimer);
      rebirthBtnHoldTimer = null;
    }
  });
  rebirthBtn.addEventListener("touchend", () => {
    if (rebirthBtnHoldTimer) {
      clearTimeout(rebirthBtnHoldTimer);
      rebirthBtnHoldTimer = null;
    }
  });

  // ── Machine shop panel (tabbed / searchable) ────────────
  const shopPanel = document.createElement("div");
  shopPanel.id = "shop-panel";
  shopPanel.classList.add("hidden");

  const shopHeader = document.createElement("div");
  shopHeader.className = "shop-header";

  const shopTitle = document.createElement("h3");
  shopTitle.textContent = "Machine Shop";
  shopHeader.appendChild(shopTitle);

  // Search input
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search machines…";
  searchInput.className = "shop-search";
  searchInput.addEventListener("input", () => refreshShopFilter());
  shopHeader.appendChild(searchInput);

  shopPanel.appendChild(shopHeader);

  // Category tabs
  const tabBar = document.createElement("div");
  tabBar.className = "shop-tab-bar";

  const ALL_TABS: Array<{ label: string; key: MachineCategory | "ALL" }> = [
    { label: "All", key: "ALL" },
    { label: "⛏ Harvest", key: "HARVEST" },
    { label: "⚙ Convert", key: "CONVERT" },
    { label: "📦 Storage", key: "STORAGE" },
    { label: "🚀 Boost", key: "BOOST" },
    { label: "✨ Special", key: "SPECIAL" },
  ];

  let activeTab: MachineCategory | "ALL" = "ALL";
  const tabBtns: HTMLButtonElement[] = [];

  for (const tab of ALL_TABS) {
    const btn = document.createElement("button");
    btn.className = "shop-tab" + (tab.key === "ALL" ? " active" : "");
    btn.textContent = tab.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      activeTab = tab.key;
      for (const b of tabBtns) b.classList.remove("active");
      btn.classList.add("active");
      refreshShopFilter();
    });
    tabBtns.push(btn);
    tabBar.appendChild(btn);
  }
  shopPanel.appendChild(tabBar);

  // Machine grid — one row per code, built once, updated each frame
  const machineGrid = document.createElement("div");
  machineGrid.id = "machine-grid";
  shopPanel.appendChild(machineGrid);

  root.appendChild(shopPanel);

  // Build reverse lookup: code → category
  const codeToCat = new Map<string, MachineCategory>();
  for (const [cat, codes] of Object.entries(categoriesCatalog.categories)) {
    for (const c of codes) codeToCat.set(c, cat as MachineCategory);
  }

  /** Machine description from behavior type. */
  function machineDesc(code: string): string {
    const def = machinesCatalog.machines[code];
    if (!def) return "";
    const b = def.behavior;
    switch (b.type) {
      case "PRODUCER":
        return `Produces ${b.resource} per second`;
      case "CONVERTER":
        return `Converts ${b.in} → ${b.out}`;
      case "BUFFER":
        return "Increases storage capacity";
      case "BOOSTER":
        return b.clickMult > 1
          ? `Tap ×${b.clickMult}, Production ×${b.globalProdMult}`
          : `Boosts production ×${b.globalProdMult}`;
      case "CONTRACT":
        return "Generates contract signals";
      case "DISCOVERY":
        return `+${(b.revealChanceAdd * 100).toFixed(0)}% discovery chance`;
      case "COSMIC":
        return `Cosmic effect: ${b.special}`;
      default:
        return "";
    }
  }

  // ── Upgrade store overlay ──────────────────────────────
  const upgradeOverlay = document.createElement("div");
  upgradeOverlay.id = "upgrade-overlay";
  upgradeOverlay.classList.add("hidden");

  const upgradePanel = document.createElement("div");
  upgradePanel.id = "upgrade-panel";

  const upgHeader = document.createElement("div");
  upgHeader.style.display = "flex";
  upgHeader.style.justifyContent = "space-between";
  upgHeader.style.alignItems = "center";

  const upgTitle = document.createElement("h3");
  upgTitle.textContent = "Upgrade Store";

  const upgCloseBtn = document.createElement("button");
  upgCloseBtn.textContent = "✕";
  upgCloseBtn.style.background = "transparent";
  upgCloseBtn.style.border = "none";
  upgCloseBtn.style.color = "#aaa";
  upgCloseBtn.style.fontSize = "18px";
  upgCloseBtn.style.cursor = "pointer";
  upgCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // Handled by UIState — setUIState is wired after DOM is built
    setUIStateLazy({ activePanel: "none" });
  });

  upgHeader.append(upgTitle, upgCloseBtn);
  upgradePanel.appendChild(upgHeader);

  const upgList = document.createElement("div");
  upgList.id = "upgrade-list";
  upgradePanel.appendChild(upgList);

  upgradeOverlay.appendChild(upgradePanel);

  // Mount overlay on container, not in HUD (so it covers the screen)
  container.appendChild(upgradeOverlay);

  // Lazy wrapper — setUIState is defined later; this closure resolves it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setUIStateLazy(partial: any): void {
    // setUIState will be defined by the time any click event fires.
    (setUIState as (p: typeof partial) => void)(partial);
  }

  // ── Contracts panel (collapsible) ───────────────────────
  const contractsPanel = document.createElement("div");
  contractsPanel.id = "contracts-panel";
  contractsPanel.classList.add("hidden");

  // Header row — click to toggle minimize
  const contractsHeaderRow = document.createElement("div");
  contractsHeaderRow.className = "contracts-header-row";

  const contractsTitle = document.createElement("h3");
  contractsTitle.textContent = "Contracts";

  const contractsToggleIcon = document.createElement("span");
  contractsToggleIcon.className = "contracts-toggle-icon";
  contractsToggleIcon.textContent = "▼";

  contractsHeaderRow.append(contractsTitle, contractsToggleIcon);
  contractsPanel.appendChild(contractsHeaderRow);

  const activeSection = document.createElement("div");
  activeSection.id = "active-contract";
  contractsPanel.appendChild(activeSection);

  const revealedSection = document.createElement("div");
  revealedSection.id = "revealed-contracts";
  contractsPanel.appendChild(revealedSection);

  // Do NOT add contractsPanel to root (flex flow) — mount it directly
  // on the container with absolute positioning so it doesn't push layout
  // or intercept touches from other HUD buttons.
  container.appendChild(contractsPanel);

  // ── Reset button ───────────────────────────────────────
  const resetBtn = document.createElement("button");
  resetBtn.id = "reset-btn";
  resetBtn.textContent = "Reset Save";
  root.appendChild(resetBtn);

  container.appendChild(root);

  // ════════════════════════════════════════════════════════
  // ── UI State: single source of truth for panel toggling ─
  // ════════════════════════════════════════════════════════
  type ActivePanel = "machines" | "upgrades" | "contracts" | "none";
  interface UIState {
    activePanel: ActivePanel;
    contractsExpanded: boolean;
  }

  const uiState: UIState = { activePanel: "none", contractsExpanded: true };

  function setUIState(partial: Partial<UIState>): void {
    Object.assign(uiState, partial);
    renderUI();
    requestAnimationFrame(() => notifyLayoutChange());
  }

  /** Sync DOM visibility to uiState. */
  function renderUI(): void {
    // Machines panel
    shopPanel.classList.toggle("hidden", uiState.activePanel !== "machines");

    // Upgrades overlay
    upgradeOverlay.classList.toggle(
      "hidden",
      uiState.activePanel !== "upgrades",
    );

    // Contracts panel — visible ONLY when activePanel === "contracts"
    const contractsVisible = uiState.activePanel === "contracts";
    contractsPanel.classList.toggle("hidden", !contractsVisible);
    contractsPanel.classList.toggle(
      "minimized",
      contractsVisible && !uiState.contractsExpanded,
    );
    contractsToggleIcon.textContent = uiState.contractsExpanded ? "▼" : "▶";
  }

  // ── Layout change notification ─────────────────────────
  let layoutChangeCb: ((hudHeightPx: number) => void) | null = null;
  let backCb: (() => void) | null = null;

  /** Measure bottom HUD height and notify the camera. */
  function notifyLayoutChange(): void {
    if (!layoutChangeCb) return;
    const rect = root.getBoundingClientRect();
    const hudH = Math.max(rect.height, 80);
    layoutChangeCb(hudH);
  }

  // Notify on window resize / orientation change
  window.addEventListener("resize", () => {
    requestAnimationFrame(() => notifyLayoutChange());
  });

  // ── Back button handler ────────────────────────────────
  backBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    backCb?.();
  });

  // ── Contracts header row — toggle expand/minimize ──────
  contractsHeaderRow.addEventListener("click", (e) => {
    e.stopPropagation();
    setUIState({ contractsExpanded: !uiState.contractsExpanded });
  });

  // ── Button handlers — drive UIState ────────────────────
  shopBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setUIState({
      activePanel: uiState.activePanel === "machines" ? "none" : "machines",
      contractsExpanded: true,
    });
  });

  upgradeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setUIState({
      activePanel: uiState.activePanel === "upgrades" ? "none" : "upgrades",
      contractsExpanded: true,
    });
  });

  contractsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (uiState.activePanel !== "contracts") {
      // Open fresh — always expanded
      setUIState({ activePanel: "contracts", contractsExpanded: true });
    } else if (uiState.contractsExpanded) {
      // Expanded → minimized
      setUIState({ contractsExpanded: false });
    } else {
      // Minimized → closed (reset expanded for next open)
      setUIState({ activePanel: "none", contractsExpanded: true });
    }
  });

  // Close upgrades overlay from backdrop click
  upgradeOverlay.addEventListener("click", (e) => {
    if (e.target === upgradeOverlay) {
      setUIState({ activePanel: "none" });
    }
  });

  // ── Callbacks ──────────────────────────────────────────
  let tapCb: (() => void) | null = null;
  let buyCb: ((code: string, qty: number) => void) | null = null;
  let buyUpgCb: ((id: string) => void) | null = null;
  let buyUpgV2Cb: ((id: string) => void) | null = null;
  let tierUpgCb: ((code: string) => void) | null = null;
  let toggleMachineEnabledCb:
    | ((code: string, enabled: boolean) => void)
    | null = null;
  let startContractCb: ((contractId: string) => void) | null = null;
  let claimContractCb: (() => void) | null = null;
  let tapEventCb: (() => void) | null = null;
  let dismissMilestoneCb: (() => void) | null = null;
  let resetCb: (() => void) | null = null;
  let confirmRebirthCb: (() => void) | null = null;
  let buyRebirthNodeCb: ((nodeId: string) => void) | null = null;

  // ── Milestone toast auto-dismiss timer ─────────────────
  let toastDismissTimer: ReturnType<typeof setTimeout> | null = null;
  let currentToastId: string | null = null;

  function showToast(id: string, text: string): void {
    // If same toast is already showing, don't restart
    if (id === currentToastId && !milestoneToast.classList.contains("hidden")) {
      return;
    }
    currentToastId = id;
    // Clear existing timer
    if (toastDismissTimer) clearTimeout(toastDismissTimer);

    milestoneToast.textContent = text;
    milestoneToast.classList.remove("hidden", "toast-exit");
    milestoneToast.classList.add("toast-enter");

    // Auto-dismiss after 3.5 seconds
    toastDismissTimer = setTimeout(() => {
      milestoneToast.classList.remove("toast-enter");
      milestoneToast.classList.add("toast-exit");
      // After exit animation, hide completely
      setTimeout(() => {
        milestoneToast.classList.add("hidden");
        milestoneToast.classList.remove("toast-exit");
        currentToastId = null;
        dismissMilestoneCb?.();
      }, 250);
    }, 3500);
  }

  function hideToast(): void {
    if (toastDismissTimer) clearTimeout(toastDismissTimer);
    toastDismissTimer = null;
    currentToastId = null;
    milestoneToast.classList.add("hidden");
    milestoneToast.classList.remove("toast-enter", "toast-exit");
  }

  tapBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tapCb?.();
  });
  tapBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    tapCb?.();
  });

  resetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (confirm("Reset all progress?")) resetCb?.();
  });

  eventOrb.addEventListener("click", (e) => {
    e.stopPropagation();
    tapEventCb?.();
  });
  eventOrb.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    tapEventCb?.();
  });

  milestoneToast.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissMilestoneCb?.();
  });

  // ── Build unified machine rows ─────────────────────────
  interface MachineRowEls {
    row: HTMLDivElement;
    countBadge: HTMLSpanElement;
    costEl: HTMLSpanElement;
    buyBtns: HTMLButtonElement[];
    tierArea: HTMLDivElement;
    toggleBtn: HTMLButtonElement;
    /** True if this row was built from v2 catalog. */
    isV2: boolean;
  }

  const machineRows = new Map<string, MachineRowEls>();

  // Helper: build a single machine row DOM
  function buildMachineRow(
    code: string,
    title: string,
    desc: string,
    isConverter: boolean,
    isV2: boolean,
    category: string,
    maxCount: number,
  ): MachineRowEls {
    const row = document.createElement("div");
    row.className = "mach-row";
    row.dataset.code = code;
    row.dataset.cat = category;

    // ─ Header: name + desc + count badge
    const hdr = document.createElement("div");
    hdr.className = "mach-hdr";

    const nameEl = document.createElement("span");
    nameEl.className = "mach-name";
    nameEl.textContent = title;

    const descEl = document.createElement("span");
    descEl.className = "mach-desc";
    descEl.textContent = desc;

    const countBadge = document.createElement("span");
    countBadge.className = "mach-badge";
    countBadge.textContent = "×0";

    hdr.append(nameEl, descEl, countBadge);
    row.appendChild(hdr);

    // ─ Body: cost + buy buttons + toggle
    const body = document.createElement("div");
    body.className = "mach-body";

    const costEl = document.createElement("span");
    costEl.className = "mach-cost";
    body.appendChild(costEl);

    const buyGroup = document.createElement("div");
    buyGroup.className = "mach-buy-group";

    const buyBtns: HTMLButtonElement[] = [];

    if (isV2) {
      // V2: single buy-1 button (unique machines or simple buy)
      const btn = document.createElement("button");
      btn.className = "mach-buy-btn";
      btn.textContent = maxCount === 1 ? "Buy" : "×1";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        buyCb?.(code, 1);
      });
      buyBtns.push(btn);
      buyGroup.appendChild(btn);

      // For stackable machines (maxCount > 1), also show ×10 and MAX
      if (maxCount > 1) {
        for (const opt of [
          { label: "×10", qty: 10 },
          { label: "MAX", qty: 999 },
        ]) {
          const b = document.createElement("button");
          b.className = "mach-buy-btn";
          b.textContent = opt.label;
          const q = opt.qty;
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            buyCb?.(code, q);
          });
          buyBtns.push(b);
          buyGroup.appendChild(b);
        }
      }
    } else {
      // V1: ×1, ×10, ×100, MAX
      for (const opt of [
        { label: "×1", qty: 1 },
        { label: "×10", qty: 10 },
        { label: "×100", qty: 100 },
        { label: "MAX", qty: 999 },
      ]) {
        const btn = document.createElement("button");
        btn.className = "mach-buy-btn";
        btn.textContent = opt.label;
        const q = opt.qty;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          buyCb?.(code, q);
        });
        buyBtns.push(btn);
        buyGroup.appendChild(btn);
      }
    }
    body.appendChild(buyGroup);

    // Toggle enabled — only for converter machines
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "mach-toggle";
    toggleBtn.textContent = "ON";
    const stableCode = code;
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = toggleBtn.dataset.enabled === "1";
      toggleMachineEnabledCb?.(stableCode, !cur);
    });
    if (isConverter) {
      body.appendChild(toggleBtn);
    }

    row.appendChild(body);

    // ─ Tier area
    const tierArea = document.createElement("div");
    tierArea.className = "mach-tier-area";
    row.appendChild(tierArea);

    machineGrid.appendChild(row);
    return { row, countBadge, costEl, buyBtns, tierArea, toggleBtn, isV2 };
  }

  // Build rows from V2 catalog if available, otherwise fall back to V1
  if (machinesV2Catalog) {
    for (const mDef of machinesV2Catalog.machines) {
      const cat = codeToCat.get(mDef.code) ?? "SPECIAL";
      const els = buildMachineRow(
        mDef.code,
        mDef.title,
        mDef.desc,
        mDef.converter,
        true,
        cat,
        mDef.maxCount,
      );
      machineRows.set(mDef.code, els);
    }
  } else {
    for (const [code, _def] of Object.entries(machinesCatalog.machines)) {
      const cat = codeToCat.get(code) ?? "SPECIAL";
      const els = buildMachineRow(
        code,
        code,
        machineDesc(code),
        _def.behavior.type === "CONVERTER",
        false,
        cat,
        999999,
      );
      machineRows.set(code, els);
    }
  }

  /** Filter visible rows by active tab + search text. */
  function refreshShopFilter(): void {
    const q = searchInput.value.trim().toLowerCase();
    for (const [code, els] of machineRows) {
      // Locked machines stay hidden (managed by update())
      if (els.row.classList.contains("hidden-row")) continue;
      const cat = codeToCat.get(code) ?? "SPECIAL";
      const tabMatch = activeTab === "ALL" || cat === activeTab;
      const searchMatch =
        !q ||
        code.toLowerCase().includes(q) ||
        machineDesc(code).toLowerCase().includes(q);
      els.row.style.display = tabMatch && searchMatch ? "" : "none";
    }
  }

  // ── Build upgrade items ────────────────────────────────
  const upgradeItems = new Map<
    string,
    { row: HTMLDivElement; costEl: HTMLSpanElement; btn: HTMLButtonElement }
  >();

  for (const upg of upgradesCatalog.upgrades) {
    const row = document.createElement("div");
    row.className = "upgrade-row";

    const title = document.createElement("div");
    title.className = "upgrade-title";
    title.textContent = upg.name;

    const desc = document.createElement("div");
    desc.className = "upgrade-desc";
    desc.textContent = upg.description;

    const costEl = document.createElement("span");
    costEl.className = "upgrade-cost";

    const btn = document.createElement("button");
    btn.className = "upgrade-buy-btn";
    btn.textContent = "Buy";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      buyUpgCb?.(upg.id);
    });

    row.append(title, desc, costEl, btn);
    upgList.appendChild(row);
    upgradeItems.set(upg.id, { row, costEl, btn });
  }

  // ── Build V2 upgrade items ─────────────────────────────
  // Separator between v1 and v2 upgrades
  const v2Separator = document.createElement("div");
  v2Separator.className = "upgrade-v2-separator";
  v2Separator.textContent = "── Advanced Upgrades ──";
  v2Separator.style.cssText =
    "text-align:center;color:#888;font-size:11px;margin:12px 0 8px;border-top:1px solid #333;padding-top:8px;";
  upgList.appendChild(v2Separator);

  const upgradeV2Items = new Map<
    string,
    { row: HTMLDivElement; costEl: HTMLSpanElement; btn: HTMLButtonElement }
  >();

  for (const upg of upgradesV2Catalog.upgrades) {
    const row = document.createElement("div");
    row.className = "upgrade-row upgrade-v2-row";
    row.style.display = "none"; // hidden until visible condition met

    const title = document.createElement("div");
    title.className = "upgrade-title";
    title.textContent = upg.title;

    const catBadge = document.createElement("span");
    catBadge.className = "upgrade-cat-badge";
    catBadge.textContent = upg.category;
    catBadge.style.cssText =
      "font-size:10px;background:rgba(255,255,255,0.08);color:#aaa;padding:1px 6px;border-radius:4px;margin-left:6px;";

    const desc = document.createElement("div");
    desc.className = "upgrade-desc";
    desc.textContent = upg.desc;

    const costEl = document.createElement("span");
    costEl.className = "upgrade-cost";

    const btn = document.createElement("button");
    btn.className = "upgrade-buy-btn";
    btn.textContent = "Buy";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      buyUpgV2Cb?.(upg.id);
    });

    const titleRow = document.createElement("div");
    titleRow.style.cssText = "display:flex;align-items:center;gap:4px;";
    titleRow.append(title, catBadge);

    row.append(titleRow, desc, costEl, btn);
    upgList.appendChild(row);
    upgradeV2Items.set(upg.id, { row, costEl, btn });
  }

  // ── API ────────────────────────────────────────────────
  return {
    update(state: SimStateV1): void {
      fluxEl.value.textContent = microToCompact(state.resources.flux);
      alloyEl.value.textContent = microToCompact(state.resources.alloy);
      signalEl.value.textContent = microToCompact(state.resources.signal);

      // Update wreck counter
      const wreckCount = Object.keys(state.wrecks.active).length;
      wreckEl.value.textContent = String(wreckCount);

      // ── Dock status + CUT button state ─────────────────
      const dock = state.cutterDock;
      if (dock) {
        switch (dock.status) {
          case "empty":
            dockStatusText.textContent = "🔍 Select a wreck";
            tapBtn.disabled = true;
            tapBtn.textContent = "✂️ CUT";
            hpBarWrap.style.display = "none";
            break;
          case "transit":
            dockStatusText.textContent = "🚀 Wreck inbound…";
            tapBtn.disabled = true;
            tapBtn.textContent = "✂️ CUT";
            hpBarWrap.style.display = "none";
            break;
          case "docked": {
            const dockedWreck = dock.wreckId
              ? state.wrecks.active[dock.wreckId]
              : null;
            if (dockedWreck) {
              const pct = Math.max(
                0,
                (dockedWreck.hpMicro / dockedWreck.maxHpMicro) * 100,
              );
              const rarityLabel =
                dockedWreck.rarity.charAt(0).toUpperCase() +
                dockedWreck.rarity.slice(1);
              dockStatusText.textContent = `⚓ ${rarityLabel} Wreck — HP ${microToCompact(dockedWreck.hpMicro)}/${microToCompact(dockedWreck.maxHpMicro)}`;
              hpBarWrap.style.display = "block";
              hpBarFill.style.width = `${pct}%`;
              // Color HP bar based on remaining %
              if (pct > 50) hpBarFill.style.background = "#44ff44";
              else if (pct > 25) hpBarFill.style.background = "#ffaa00";
              else hpBarFill.style.background = "#ff4444";
            } else {
              dockStatusText.textContent = "⚓ Wreck Docked";
              hpBarWrap.style.display = "none";
            }
            tapBtn.disabled = false;
            tapBtn.textContent = "✂️ CUT";
            break;
          }
        }
      }

      // ── Update unified machine rows ─────────────────────
      const purchasedSet = new Set(state.upgradesPurchased);
      const condCtxMachines = buildConditionContext(state);

      if (machinesV2Catalog) {
        // V2 path — visibility-driven
        for (const mDef of machinesV2Catalog.machines) {
          const els = machineRows.get(mDef.code);
          if (!els) continue;

          const visible = isMachineV2Visible(mDef, condCtxMachines, state.meta);
          if (!visible) {
            els.row.classList.add("hidden-row");
            continue;
          }
          els.row.classList.remove("hidden-row");

          const stack = state.machines[mDef.code];
          const count = stack?.count ?? 0;
          const tier = stack?.tier ?? 1;
          const enabled = stack?.enabled ?? true;

          // Count badge
          if (mDef.maxCount === 1) {
            els.countBadge.textContent = count > 0 ? "✓" : "";
          } else {
            els.countBadge.textContent = count > 0 ? `×${count}` : "";
          }
          els.countBadge.classList.toggle("has-count", count > 0);

          // Cost for next purchase
          const mods = getDerived(state);
          const costReduce =
            (mods.costReduction[mDef.code] ?? 1) *
            (mods.costReduction["*"] ?? 1);
          const growth = Math.pow(mDef.cost.growth, count);
          const costF = Math.round(
            mDef.cost.baseFluxMicro * growth * costReduce,
          );

          // At max count — disable buy
          const atMax = count >= mDef.maxCount;
          if (atMax) {
            els.costEl.textContent = "MAX";
            for (const btn of els.buyBtns) btn.disabled = true;
          } else {
            els.costEl.textContent = `⚡${microToCompact(costF)}`;
            const canAfford = state.resources.flux >= costF;
            for (const btn of els.buyBtns) btn.disabled = !canAfford;
          }

          // Toggle
          els.toggleBtn.textContent = enabled ? "ON" : "OFF";
          els.toggleBtn.dataset.enabled = enabled ? "1" : "0";
          els.toggleBtn.className = "mach-toggle " + (enabled ? "on" : "off");

          // Tier area
          els.tierArea.innerHTML = "";
          if (count === 0) {
            // Not yet owned — hide tier area
          } else if (tier < mDef.tier.maxTier) {
            const nextTier = tier + 1;
            const derivedMods = getDerived(state);
            const v2Unlocked =
              derivedMods.tierUnlockAllowed[mDef.code]?.[nextTier] === true;
            const unlockId = `UNLOCK_T${nextTier}_${mDef.code}`;
            const v1Unlocked = purchasedSet.has(unlockId);
            const isUnlocked = v2Unlocked || v1Unlocked;

            const tierLabel = document.createElement("span");
            tierLabel.className = "mach-tier-label";
            tierLabel.textContent = `T${tier}`;
            els.tierArea.appendChild(tierLabel);

            if (!isUnlocked) {
              // Check for v2 tier unlock upgrade
              const v2UpgId = `UPG_UNLOCK_T${nextTier}_${mDef.code}`;
              const v2Upg = upgradesV2Catalog.upgrades.find(
                (u) => u.id === v2UpgId,
              );
              const condCtxTier = buildConditionContext(state);

              if (v2Upg) {
                const v2Visible = isUpgradeV2Visible(v2Upg, condCtxTier);
                const v2Purchased = state.upgradesPurchasedV2[v2UpgId] === 1;
                const ucF = v2Upg.cost.fluxMicro ?? 0;

                const unlockBtn = document.createElement("button");
                unlockBtn.className = "mach-tier-btn locked";
                if (!v2Visible) {
                  unlockBtn.disabled = true;
                  unlockBtn.textContent = `🔒 T${nextTier} (locked)`;
                } else if (v2Purchased) {
                  unlockBtn.disabled = true;
                  unlockBtn.textContent = `✓ T${nextTier} Unlocked`;
                } else {
                  unlockBtn.disabled = state.resources.flux < ucF;
                  unlockBtn.textContent = `🔓 Unlock T${nextTier} ⚡${microToCompact(ucF)}`;
                }
                unlockBtn.addEventListener("click", (e) => {
                  e.stopPropagation();
                  buyUpgV2Cb?.(v2UpgId);
                });
                els.tierArea.appendChild(unlockBtn);
              } else {
                const lockLabel = document.createElement("span");
                lockLabel.className = "mach-tier-btn locked";
                lockLabel.textContent = `🔒 T${nextTier}`;
                els.tierArea.appendChild(lockLabel);
              }
            } else {
              // Show upgrade button with cost from tierUnlocks.v2
              const tuV2M = tierUnlocksV2Catalog?.machines.find(
                (m) => m.code === mDef.code,
              );
              const tuV2T = tuV2M?.tiers[String(nextTier)];
              const tierCostF = tuV2T?.cost.fluxMicro ?? 0;
              const tierCostA = tuV2T?.cost.alloyMicro ?? 0;
              const tierCostS = tuV2T?.cost.signalMicro ?? 0;

              let costLabel = "";
              if (tierCostF > 0) costLabel += ` ⚡${microToCompact(tierCostF)}`;
              if (tierCostA > 0) costLabel += ` 🔩${microToCompact(tierCostA)}`;
              if (tierCostS > 0) costLabel += ` 📡${microToCompact(tierCostS)}`;

              const canAffordTier =
                state.resources.flux >= tierCostF &&
                state.resources.alloy >= tierCostA &&
                state.resources.signal >= tierCostS;

              const upgBtn = document.createElement("button");
              upgBtn.className = "mach-tier-btn upgrade";
              upgBtn.textContent = `→ T${nextTier}${costLabel}`;
              upgBtn.disabled = !canAffordTier;
              const tc = mDef.code;
              upgBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                tierUpgCb?.(tc);
              });
              els.tierArea.appendChild(upgBtn);
            }
          } else if (mDef.tier.maxTier > 1) {
            const maxLabel = document.createElement("span");
            maxLabel.className = "mach-tier-max";
            maxLabel.textContent = `T${mDef.tier.maxTier} MAX`;
            els.tierArea.appendChild(maxLabel);
          }
        }
      } else {
        // V1 fallback
        for (const [code, def] of Object.entries(machinesCatalog.machines)) {
          const els = machineRows.get(code);
          if (!els) continue;

          // Visibility: hide locked machines, respect tab/search filter
          const unlocked =
            state.stats.totalFluxEarned >= def.unlock.requiresFluxMicro;
          if (!unlocked) {
            els.row.classList.add("hidden-row");
            continue;
          }
          els.row.classList.remove("hidden-row");

          const stack = state.machines[code];
          const count = stack?.count ?? 0;
          const tier = stack?.tier ?? 1;
          const enabled = stack?.enabled ?? true;

          // Count badge
          els.countBadge.textContent = count > 0 ? `×${count}` : "";
          els.countBadge.classList.toggle("has-count", count > 0);

          // Cost for next single purchase
          const growth = Math.pow(def.costGrowth, count);
          const costF = Math.round((def.buyCost.fluxMicro ?? 0) * growth);
          const costA = Math.round((def.buyCost.alloyMicro ?? 0) * growth);
          const costS = Math.round((def.buyCost.signalMicro ?? 0) * growth);

          const parts: string[] = [];
          if (costF > 0) parts.push(`⚡${microToCompact(costF)}`);
          if (costA > 0) parts.push(`🔧${microToCompact(costA)}`);
          if (costS > 0) parts.push(`📡${microToCompact(costS)}`);
          els.costEl.textContent = parts.join(" ");

          // Can afford single?
          const canAfford =
            state.resources.flux >= costF &&
            state.resources.alloy >= costA &&
            state.resources.signal >= costS;
          for (const btn of els.buyBtns) btn.disabled = !canAfford;

          // Toggle
          els.toggleBtn.textContent = enabled ? "ON" : "OFF";
          els.toggleBtn.dataset.enabled = enabled ? "1" : "0";
          els.toggleBtn.className = "mach-toggle " + (enabled ? "on" : "off");

          // Tier area — rebuild each frame (cheap, small DOM)
          els.tierArea.innerHTML = "";
          if (count === 0) {
            // Not yet owned — hide tier area
          } else if (tier < 3) {
            const nextTier = tier + 1;
            const unlockId = `UNLOCK_T${nextTier}_${code}`;
            // Check both v1 purchased and v2 derived tier unlock
            const derivedMods = getDerived(state);
            const v2Unlocked =
              derivedMods.tierUnlockAllowed[code]?.[nextTier] === true;
            const isUnlocked = purchasedSet.has(unlockId) || v2Unlocked;

            const tierLabel = document.createElement("span");
            tierLabel.className = "mach-tier-label";
            tierLabel.textContent = `T${tier}`;
            els.tierArea.appendChild(tierLabel);

            if (!isUnlocked) {
              // LOCKED — need to buy unlock upgrade
              // Check v2 tier unlock upgrade first
              const v2UpgId = `UPG_UNLOCK_T${nextTier}_${code}`;
              const v2Upg = upgradesV2Catalog.upgrades.find(
                (u) => u.id === v2UpgId,
              );
              const condCtxTier = buildConditionContext(state);

              if (v2Upg) {
                // V2 tier unlock — check visibility and cost
                const v2Visible = isUpgradeV2Visible(v2Upg, condCtxTier);
                const v2Purchased = state.upgradesPurchasedV2[v2UpgId] === 1;
                const costF = v2Upg.cost.fluxMicro ?? 0;
                const costA = v2Upg.cost.alloyMicro ?? 0;
                const costS = v2Upg.cost.signalMicro ?? 0;

                const costParts: string[] = [];
                if (costF > 0) costParts.push(`⚡${microToCompact(costF)}`);
                if (costA > 0) costParts.push(`🔧${microToCompact(costA)}`);
                if (costS > 0) costParts.push(`📡${microToCompact(costS)}`);

                const canAffordU =
                  state.resources.flux >= costF &&
                  state.resources.alloy >= costA &&
                  state.resources.signal >= costS;

                const unlockBtn = document.createElement("button");
                unlockBtn.className = "mach-tier-btn locked";
                if (!v2Visible) {
                  unlockBtn.disabled = true;
                  unlockBtn.textContent = `🔒 T${nextTier} (locked)`;
                } else if (v2Purchased) {
                  unlockBtn.disabled = true;
                  unlockBtn.textContent = `✓ T${nextTier} Unlocked`;
                } else {
                  unlockBtn.disabled = !canAffordU;
                  unlockBtn.textContent = `🔓 Unlock T${nextTier} ${costParts.join(" ")}`;
                }
                unlockBtn.addEventListener("click", (e) => {
                  e.stopPropagation();
                  buyUpgV2Cb?.(v2UpgId);
                });
                els.tierArea.appendChild(unlockBtn);
              } else {
                // Fallback to v1 tier unlock
                const tuDef = tierUnlocksCatalog.perMachine[code];
                const unlockCostDef =
                  nextTier === 2 ? tuDef?.unlockT2.cost : tuDef?.unlockT3.cost;

                const costParts: string[] = [];
                if (unlockCostDef?.fluxMicro)
                  costParts.push(
                    `⚡${microToCompact(unlockCostDef.fluxMicro)}`,
                  );
                if (unlockCostDef?.alloyMicro)
                  costParts.push(
                    `🔧${microToCompact(unlockCostDef.alloyMicro)}`,
                  );
                if (unlockCostDef?.signalMicro)
                  costParts.push(
                    `📡${microToCompact(unlockCostDef.signalMicro)}`,
                  );

                const prereqs =
                  nextTier === 2
                    ? (tuDef?.unlockT2.prereqs ?? [])
                    : (tuDef?.unlockT3.prereqs ?? []);
                const prereqsMet = prereqs.every((p) => purchasedSet.has(p));

                const canAffordU =
                  state.resources.flux >= (unlockCostDef?.fluxMicro ?? 0) &&
                  state.resources.alloy >= (unlockCostDef?.alloyMicro ?? 0) &&
                  state.resources.signal >= (unlockCostDef?.signalMicro ?? 0);

                const unlockBtn = document.createElement("button");
                unlockBtn.className = "mach-tier-btn locked";
                unlockBtn.disabled = !canAffordU || !prereqsMet;
                unlockBtn.textContent = prereqsMet
                  ? `🔓 Unlock T${nextTier} ${costParts.join(" ")}`
                  : `🔒 Need T${nextTier - 1}`;
                const uid = unlockId;
                unlockBtn.addEventListener("click", (e) => {
                  e.stopPropagation();
                  buyUpgCb?.(uid);
                });
                els.tierArea.appendChild(unlockBtn);
              }
            } else {
              // UNLOCKED — show upgrade button
              const tuDef = tierUnlocksCatalog.perMachine[code];
              const tierCostDef =
                nextTier === 2
                  ? tuDef?.tier2UpgradeCost
                  : tuDef?.tier3UpgradeCost;

              const uCostF = tierCostDef?.fluxMicro ?? 0;
              const uCostA = tierCostDef?.alloyMicro ?? 0;
              const uCostS = tierCostDef?.signalMicro ?? 0;

              const costParts: string[] = [];
              if (uCostF > 0) costParts.push(`⚡${microToCompact(uCostF)}`);
              if (uCostA > 0) costParts.push(`🔧${microToCompact(uCostA)}`);
              if (uCostS > 0) costParts.push(`📡${microToCompact(uCostS)}`);

              const canAffordT =
                state.resources.flux >= uCostF &&
                state.resources.alloy >= uCostA &&
                state.resources.signal >= uCostS;

              const upgBtn = document.createElement("button");
              upgBtn.className = "mach-tier-btn upgrade";
              upgBtn.textContent = `→ T${nextTier} ${costParts.join(" ")}`;
              upgBtn.disabled = !canAffordT;
              const tc = code;
              upgBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                tierUpgCb?.(tc);
              });
              els.tierArea.appendChild(upgBtn);
            }
          } else {
            const maxLabel = document.createElement("span");
            maxLabel.className = "mach-tier-max";
            maxLabel.textContent = "T3 MAX";
            els.tierArea.appendChild(maxLabel);
          }
        }
      } // end v1 fallback else

      // Re-apply tab/search filter
      refreshShopFilter();

      // Update upgrade store (hide tierUnlock upgrades — they appear in machines panel)
      for (const upg of upgradesCatalog.upgrades) {
        const item = upgradeItems.get(upg.id);
        if (!item) continue;

        // Hide tier-unlock upgrades from the upgrade store
        const isTierUnlock = upg.effects.some((e) => e.type === "tierUnlock");
        if (isTierUnlock) {
          item.row.style.display = "none";
          continue;
        }

        const purchased = purchasedSet.has(upg.id);
        const fluxUnlocked =
          state.stats.totalFluxEarned >= upg.requiresFluxMicro;
        const prereqsMet =
          !upg.requires || upg.requires.every((r) => purchasedSet.has(r));
        const visible = fluxUnlocked;
        const canBuy = visible && prereqsMet && !purchased;

        item.row.style.display = visible ? "" : "none";
        item.row.classList.toggle("purchased", purchased);
        item.row.classList.toggle("locked", !prereqsMet && !purchased);

        if (purchased) {
          item.btn.textContent = "✓";
          item.btn.disabled = true;
          item.costEl.textContent = "";
        } else {
          // Show cost
          const uParts: string[] = [];
          if (upg.cost.fluxMicro)
            uParts.push(`⚡${microToCompact(upg.cost.fluxMicro)}`);
          if (upg.cost.alloyMicro)
            uParts.push(`🔧${microToCompact(upg.cost.alloyMicro)}`);
          if (upg.cost.signalMicro)
            uParts.push(`📡${microToCompact(upg.cost.signalMicro)}`);
          item.costEl.textContent = uParts.join(" ");

          const canAffordUpg =
            state.resources.flux >= (upg.cost.fluxMicro ?? 0) &&
            state.resources.alloy >= (upg.cost.alloyMicro ?? 0) &&
            state.resources.signal >= (upg.cost.signalMicro ?? 0);

          item.btn.disabled = !canBuy || !canAffordUpg;
          item.btn.textContent = !prereqsMet ? "🔒" : "Buy";
        }
      }

      // Update V2 upgrade items (visibility-driven)
      const condCtx = buildConditionContext(state);
      const derivedMods2 = getDerived(state);
      let anyV2Visible = false;

      for (const upg of upgradesV2Catalog.upgrades) {
        const item = upgradeV2Items.get(upg.id);
        if (!item) continue;

        // Hide tier-unlock upgrades from upgrade store (managed in machine panel)
        const isTierUnlock = upg.category === "tierUnlock";
        if (isTierUnlock) {
          item.row.style.display = "none";
          continue;
        }

        const purchased = state.upgradesPurchasedV2[upg.id] === 1;
        const visible = isUpgradeV2Visible(upg, condCtx);

        if (visible) anyV2Visible = true;

        item.row.style.display = visible ? "" : "none";
        item.row.classList.toggle("purchased", purchased);

        if (purchased) {
          item.btn.textContent = "✓";
          item.btn.disabled = true;
          item.costEl.textContent = "";
        } else {
          // Show cost (with upgradeCostMult applied)
          const costF = Math.floor(
            (upg.cost.fluxMicro ?? 0) * derivedMods2.upgradeCostMult,
          );
          const costA = Math.floor(
            (upg.cost.alloyMicro ?? 0) * derivedMods2.upgradeCostMult,
          );
          const costS = Math.floor(
            (upg.cost.signalMicro ?? 0) * derivedMods2.upgradeCostMult,
          );

          const uParts: string[] = [];
          if (costF > 0) uParts.push(`⚡${microToCompact(costF)}`);
          if (costA > 0) uParts.push(`🔧${microToCompact(costA)}`);
          if (costS > 0) uParts.push(`📡${microToCompact(costS)}`);
          item.costEl.textContent = uParts.join(" ");

          const canAffordV2 =
            state.resources.flux >= costF &&
            state.resources.alloy >= costA &&
            state.resources.signal >= costS;

          item.btn.disabled = !canAffordV2;
          item.btn.textContent = "Buy";
        }
      }

      // Hide v2 separator if no v2 upgrades visible
      v2Separator.style.display = anyV2Visible ? "" : "none";

      // ── Update contracts panel ──────────────────────────
      // Active contract
      activeSection.innerHTML = "";
      const ac = state.contracts.active;
      if (ac && !ac.claimed) {
        const def = contractsCatalog.contracts.find((c) => c.id === ac.id);
        if (def) {
          const hdr = document.createElement("div");
          hdr.className = "contract-active-hdr";
          hdr.textContent = `📜 ${def.title}`;
          activeSection.appendChild(hdr);

          const desc = document.createElement("div");
          desc.className = "contract-desc";
          desc.textContent = def.desc;
          activeSection.appendChild(desc);

          // Requirements progress
          for (const req of def.requirements) {
            const reqEl = document.createElement("div");
            reqEl.className = "contract-req";
            let current = 0;
            let target = 0;
            let label = "";

            switch (req.t) {
              case "EARN_RESOURCE": {
                const earned =
                  state.resources[req.key] -
                  (ac.snapshotResources[req.key] ?? 0);
                current = Math.max(0, earned);
                target = req.amountMicro;
                label = `Earn ${microToCompact(target)} ${req.key}`;
                break;
              }
              case "OWN_MACHINE": {
                if (req.code === "*") {
                  let total = 0;
                  for (const s of Object.values(state.machines))
                    total += s.count;
                  current = total;
                } else {
                  current = state.machines[req.code]?.count ?? 0;
                }
                target = req.count;
                label = `Own ${target} ${req.code === "*" ? "machines" : req.code}`;
                break;
              }
              case "UPGRADES_PURCHASED": {
                current = state.upgradesPurchased.length;
                target = req.count;
                label = `Purchase ${target} upgrades`;
                break;
              }
            }

            const pct = Math.min(1, current / Math.max(1, target));
            reqEl.innerHTML = `
              <div class="contract-req-label">${label}</div>
              <div class="contract-progress-bar">
                <div class="contract-progress-fill" style="width:${(pct * 100).toFixed(1)}%"></div>
              </div>
              <div class="contract-req-count">${req.t === "EARN_RESOURCE" ? microToCompact(current) : current}/${req.t === "EARN_RESOURCE" ? microToCompact(target) : target}</div>
            `;
            activeSection.appendChild(reqEl);
          }

          // Time remaining
          const ticksLeft = Math.max(0, ac.endsAtTick - state.tick);
          const secsLeft = Math.ceil(ticksLeft / 20);
          const timeEl = document.createElement("div");
          timeEl.className = "contract-time";
          timeEl.textContent = `⏱ ${secsLeft}s remaining`;
          activeSection.appendChild(timeEl);

          // Claim button (if completed)
          if (ac.completed) {
            const claimBtn = document.createElement("button");
            claimBtn.className = "contract-claim-btn";
            claimBtn.textContent = "✅ Claim Reward";
            claimBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              claimContractCb?.();
            });
            activeSection.appendChild(claimBtn);
          }
        }
      } else {
        const noActive = document.createElement("div");
        noActive.className = "contract-desc";
        noActive.textContent = ac?.claimed
          ? "Contract claimed! Awaiting new contracts…"
          : "No active contract. Start one below!";
        activeSection.appendChild(noActive);
      }

      // Revealed contracts
      revealedSection.innerHTML = "";
      if (state.contracts.revealed.length === 0) {
        const empty = document.createElement("div");
        empty.className = "contract-desc";
        empty.textContent = "No contracts available yet…";
        revealedSection.appendChild(empty);
      }
      for (const cId of state.contracts.revealed) {
        const def = contractsCatalog.contracts.find((c) => c.id === cId);
        if (!def) continue;

        const row = document.createElement("div");
        row.className = "contract-row";

        const info = document.createElement("div");
        info.className = "contract-info";
        info.innerHTML = `<strong>${def.title}</strong> <span class="contract-diff">★${"★".repeat(def.difficulty - 1)}</span>
          <br/><span class="contract-desc">${def.desc}</span>
          <br/><span class="contract-time">⏱ ${def.durationSec}s</span>`;

        const rewards: string[] = [];
        if (def.rewards.fluxMicro)
          rewards.push(`⚡${microToCompact(def.rewards.fluxMicro)}`);
        if (def.rewards.alloyMicro)
          rewards.push(`🔧${microToCompact(def.rewards.alloyMicro)}`);
        if (def.rewards.signalMicro)
          rewards.push(`📡${microToCompact(def.rewards.signalMicro)}`);

        const rewardEl = document.createElement("span");
        rewardEl.className = "contract-reward";
        rewardEl.textContent = rewards.join(" ");

        const startBtn = document.createElement("button");
        startBtn.className = "contract-start-btn";
        startBtn.textContent = "Start";
        // Disable if already have an active contract
        startBtn.disabled = !!(
          state.contracts.active && !state.contracts.active.claimed
        );
        const contractId = cId;
        startBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          startContractCb?.(contractId);
        });

        row.append(info, rewardEl, startBtn);
        revealedSection.appendChild(row);
      }

      // ── Update event orb ─────────────────────────────────
      const ev = state.events.activeEvent;
      const evDef = ev
        ? eventsCatalog.events.find((e) => e.id === ev.id)
        : null;
      const vfxMap: Record<string, string> = {
        spark: "⚡",
        pulse: "💫",
        ring: "🔮",
        star: "⭐",
      };
      const evColorMap: Record<string, string> = {
        spark: "#ffdd33",
        pulse: "#aa88ff",
        ring: "#33ccff",
        star: "#ffaa00",
      };

      if (ev && !ev.consumed && state.tick < ev.expiresAtTick) {
        const icon = vfxMap[ev.vfxHint] ?? "✨";
        eventOrb.textContent = `${icon} ${evDef?.title ?? "Event"}`;
        eventOrb.classList.remove("hidden");
        eventOrb.disabled = ev.trigger !== "TAP";
        // Per-event aura color
        const auraColor = evColorMap[ev.vfxHint] ?? "#ffffff";
        eventOrb.style.setProperty("--event-aura", auraColor);
        eventOrb.classList.add("event-aura");
      } else {
        eventOrb.classList.add("hidden");
        eventOrb.classList.remove("event-aura");
      }

      // Show active boosts indicator
      const activeProdBoosts = state.events.prodBoosts.filter(
        (b) => state.tick < b.expiresAtTick,
      );
      const activeCapBoosts = state.events.capBoosts.filter(
        (b) => state.tick < b.expiresAtTick,
      );
      const boostCount = activeProdBoosts.length + activeCapBoosts.length;

      if (boostCount > 0) {
        eventOrb.classList.remove("hidden");
        if (!ev || ev.consumed) {
          eventOrb.textContent = `🔥 ${boostCount} boost${boostCount > 1 ? "s" : ""} active`;
          eventOrb.disabled = true;
        }
      }

      // ── Update event status indicator (top-right) ──────────
      if (ev && !ev.consumed && state.tick < ev.expiresAtTick && evDef) {
        eventStatusPanel.classList.remove("hidden");
        eventStatusPanel.innerHTML = "";

        const icon = vfxMap[ev.vfxHint] ?? "✨";
        const auraColor = evColorMap[ev.vfxHint] ?? "#ffffff";
        eventStatusPanel.style.setProperty("--event-border", auraColor);

        const header = document.createElement("div");
        header.className = "event-status-header";
        header.textContent = `${icon} ${evDef.title}`;
        eventStatusPanel.appendChild(header);

        const desc = document.createElement("div");
        desc.className = "event-status-desc";
        // Build effect summary
        const effectParts: string[] = [];
        for (const eff of evDef.effects) {
          switch (eff.t) {
            case "RESOURCE_BURST":
              effectParts.push(
                `+${microToCompact(eff.amountMicro)} ${eff.key}`,
              );
              break;
            case "PROD_BOOST":
              effectParts.push(
                `×${eff.mult} prod ${Math.round(eff.durationTicks / 20)}s`,
              );
              break;
            case "CAP_BOOST":
              effectParts.push(
                `+${microToCompact(eff.amountMicro)} ${eff.key} cap ${Math.round(eff.durationTicks / 20)}s`,
              );
              break;
          }
        }
        desc.textContent = effectParts.join(" · ") || evDef.desc;
        eventStatusPanel.appendChild(desc);

        const ticksLeft = Math.max(0, ev.expiresAtTick - state.tick);
        const secsLeft = Math.ceil(ticksLeft / 20);
        const timer = document.createElement("div");
        timer.className = "event-status-timer";
        timer.textContent = `${secsLeft}s`;
        eventStatusPanel.appendChild(timer);

        if (ev.trigger === "TAP") {
          const hint = document.createElement("div");
          hint.className = "event-status-hint";
          hint.textContent = "Tap orb to activate!";
          eventStatusPanel.appendChild(hint);
        }
      } else {
        eventStatusPanel.classList.add("hidden");
      }

      // ── Update boost status widget (top-right) ────────────
      if (boostCount > 0) {
        boostStatusPanel.classList.remove("hidden");
        boostStatusPanel.innerHTML = "";

        const bHeader = document.createElement("div");
        bHeader.className = "boost-status-header";
        bHeader.textContent = "⚡ Active Effects";
        boostStatusPanel.appendChild(bHeader);

        for (const pb of activeProdBoosts) {
          const ticksLeft = Math.max(0, pb.expiresAtTick - state.tick);
          const secsLeft = Math.ceil(ticksLeft / 20);
          const row = document.createElement("div");
          row.className = "boost-status-row prod-boost";
          row.innerHTML = `<span class="boost-icon">🚀</span><span class="boost-label">Production ×${pb.mult}</span><span class="boost-timer">${secsLeft}s</span>`;
          boostStatusPanel.appendChild(row);
        }

        for (const cb of activeCapBoosts) {
          const ticksLeft = Math.max(0, cb.expiresAtTick - state.tick);
          const secsLeft = Math.ceil(ticksLeft / 20);
          const row = document.createElement("div");
          row.className = "boost-status-row cap-boost";
          row.innerHTML = `<span class="boost-icon">📦</span><span class="boost-label">${cb.key} cap +${microToCompact(cb.amountMicro)}</span><span class="boost-timer">${secsLeft}s</span>`;
          boostStatusPanel.appendChild(row);
        }
      } else {
        boostStatusPanel.classList.add("hidden");
      }

      // ── Update rebirth button + modal + tree ─────────────
      const rebirthReady = canRebirth(state);
      rebirthBtn.style.display =
        rebirthReady || state.meta.rebirthCount > 0 ? "" : "none";
      rebirthBtn.textContent = rebirthReady
        ? "♻️ Rebirth Ready!"
        : `♻️ Rebirth (${state.meta.rebirthCount})`;
      if (rebirthReady) {
        rebirthBtn.style.boxShadow = "0 0 10px #c832ff";
      } else {
        rebirthBtn.style.boxShadow = "";
      }

      // Update shard preview in modal
      if (!rebirthOverlay.classList.contains("hidden")) {
        const shards = computeRebirthShards(state);
        rebirthShardPreview.textContent = `+${shards} Core Shards 💎`;
      }

      // Update rebirth tree panel
      if (
        !rebirthTreePanel.classList.contains("hidden") &&
        rebirthTreeCatalog
      ) {
        rebirthTreeShardsLabel.textContent = `💎 Core Shards: ${state.meta.coreShards}`;
        rebirthTreeGrid.innerHTML = "";
        for (const node of rebirthTreeCatalog.nodes) {
          const purchased = state.meta.rebirthTreePurchased[node.id] === 1;
          const prereqsMet = node.requires.every(
            (r) => state.meta.rebirthTreePurchased[r] === 1,
          );
          const canAfford = state.meta.coreShards >= node.cost;
          const canBuy = !purchased && prereqsMet && canAfford;

          const row = document.createElement("div");
          row.style.cssText =
            "display:flex;justify-content:space-between;align-items:center;" +
            "padding:6px 8px;border-radius:6px;font-size:12px;" +
            (purchased
              ? "background:rgba(80,255,80,0.1);border:1px solid #33ff5544;"
              : prereqsMet
                ? "background:rgba(200,50,255,0.08);border:1px solid #c832ff33;"
                : "background:rgba(100,100,100,0.08);border:1px solid #33333355;opacity:0.5;");

          const info = document.createElement("div");
          info.innerHTML =
            `<div style="font-weight:bold;color:${purchased ? "#88ff88" : "#d88aff"}">${node.title}</div>` +
            `<div style="color:#aaa;font-size:11px">${node.desc}</div>`;

          const btn = document.createElement("button");
          btn.style.cssText =
            "padding:4px 10px;font-size:11px;border-radius:4px;cursor:pointer;" +
            "border:1px solid " +
            (purchased ? "#88ff88" : canBuy ? "#ffd700" : "#555") +
            ";background:" +
            (purchased
              ? "rgba(80,255,80,0.15)"
              : canBuy
                ? "rgba(255,215,0,0.15)"
                : "rgba(50,50,50,0.3)") +
            ";color:" +
            (purchased ? "#88ff88" : canBuy ? "#ffd700" : "#666") +
            ";";
          btn.textContent = purchased ? "✓" : `💎 ${node.cost}`;
          btn.disabled = !canBuy;
          if (canBuy) {
            const nodeId = node.id;
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              buyRebirthNodeCb?.(nodeId);
            });
          }

          row.append(info, btn);
          rebirthTreeGrid.appendChild(row);
        }
      }

      // ── Update milestone toast ───────────────────────────
      if (state.milestones.pendingToast.length > 0) {
        const msId = state.milestones.pendingToast[0];
        const msDef = milestonesCatalog.milestones.find((m) => m.id === msId);
        if (msDef) {
          showToast(msId, `🏆 ${msDef.title}: ${msDef.desc}`);
        }
      } else {
        // No pending toasts — if timer is gone, hide immediately
        if (!toastDismissTimer) {
          hideToast();
        }
      }
    },
    onTap(cb: () => void): void {
      tapCb = cb;
    },
    onBuyMachine(cb: (code: string, qty: number) => void): void {
      buyCb = cb;
    },
    onBuyUpgrade(cb: (id: string) => void): void {
      buyUpgCb = cb;
    },
    onBuyUpgradeV2(cb: (id: string) => void): void {
      buyUpgV2Cb = cb;
    },
    onUpgradeTier(cb: (code: string) => void): void {
      tierUpgCb = cb;
    },
    onToggleMachineEnabled(cb: (code: string, enabled: boolean) => void): void {
      toggleMachineEnabledCb = cb;
    },
    onStartContract(cb: (contractId: string) => void): void {
      startContractCb = cb;
    },
    onClaimContract(cb: () => void): void {
      claimContractCb = cb;
    },
    onTapEvent(cb: () => void): void {
      tapEventCb = cb;
    },
    onDismissMilestone(cb: () => void): void {
      dismissMilestoneCb = cb;
    },
    onReset(cb: () => void): void {
      resetCb = cb;
    },
    onConfirmRebirth(cb: () => void): void {
      confirmRebirthCb = cb;
    },
    onBuyRebirthNode(cb: (nodeId: string) => void): void {
      buyRebirthNodeCb = cb;
    },
    onBack(cb: () => void): void {
      backCb = cb;
    },
    onLayoutChange(cb: (hudHeightPx: number) => void): void {
      layoutChangeCb = cb;
      // Fire once immediately so camera gets an initial framing
      requestAnimationFrame(() => notifyLayoutChange());
    },
    onAutoRotateToggle(cb: (enabled: boolean) => void): void {
      autoRotateToggleCb = cb;
    },
    setSpectatorMode(enabled: boolean): void {
      if (enabled) {
        // Add spectator badge if not present
        let badge = root.querySelector(".spectator-badge") as HTMLDivElement;
        if (!badge) {
          badge = document.createElement("div");
          badge.className = "spectator-badge";
          badge.textContent = "👁 Spectating";
          badge.style.cssText =
            "position:fixed;top:8px;left:50%;transform:translateX(-50%);" +
            "background:rgba(0,0,0,0.7);color:#ffd700;padding:4px 12px;" +
            "border-radius:8px;font-size:14px;z-index:9999;pointer-events:none;";
          root.appendChild(badge);
        }
        // Dim interactive controls
        root.style.pointerEvents = "none";
        root.style.opacity = "0.7";
      } else {
        const badge = root.querySelector(".spectator-badge");
        if (badge) badge.remove();
        root.style.pointerEvents = "";
        root.style.opacity = "";
      }
    },
    destroy(): void {
      root.remove();
      upgradeOverlay.remove();
      milestoneToast.remove();
      backBtn.remove();
      resourcesPanel.remove();
      boostStatusPanel.remove();
      contractsPanel.remove();
      autoRotateBtn.remove();
      if (toastDismissTimer) clearTimeout(toastDismissTimer);
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────

/** Resource pill for the top-left vertical panel. */
function makeResPill(
  icon: string,
  label: string,
  color: string,
): { root: HTMLDivElement; value: HTMLSpanElement } {
  const root = document.createElement("div");
  root.className = "res-pill";

  const iconEl = document.createElement("span");
  iconEl.className = "res-icon";
  iconEl.textContent = icon;

  const labelEl = document.createElement("span");
  labelEl.className = "res-label";
  labelEl.textContent = label;

  const value = document.createElement("span");
  value.className = "res-value";
  value.style.color = color;
  value.textContent = "0";

  root.append(iconEl, labelEl, value);
  return { root, value };
}
