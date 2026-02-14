import type {
  FishingSnapshot,
  MinigameSnapshot,
  Rarity,
  ZoneId,
} from "../game/types";
import type {
  BaitViewModel,
  FishInventoryItemViewModel,
  GatePanelViewModel,
  HudViewModel,
  InventoryFilterMode,
  InventorySortMode,
  OasisChecklistViewModel,
  OasisRelicProgressViewModel,
  OnlineStatusViewModel,
  QuestViewModel,
  RodViewModel,
  SettingsViewModel,
  UpgradeViewModel,
  VolcanoChecklistViewModel,
  ZoneBestiaryViewModel,
} from "./types";

type PanelMode =
  | "none"
  | "session_mode_select"
  | "fishing_ready"
  | "fishing_waiting"
  | "fishing_minigame"
  | "fishing_result"
  | "inventory"
  | "bestiary"
  | "shops"
  | "sell"
  | "gate_info"
  | "rod_unlock"
  | "settings"
  | "quests"
  | "dialog";

interface FishingReadyViewModel {
  spotName: string;
  rodName: string;
  rodLuck: number;
  rodSturdiness: number;
  baitName: string;
  baitQuantity: number;
  zoneBonusPercent: number;
  zoneBonusActive: boolean;
  failureHint: string | null;
}

interface FishingResultViewModel {
  success: boolean;
  fishName: string | null;
  fishRarity: Rarity | null;
  reason: string | null;
  inventoryFull: boolean;
}

interface RodUnlockViewModel {
  rodId: string;
  rodName: string;
  luck: number;
  sturdiness: number;
  zoneBonusText: string | null;
  sourceText: string;
}

interface InventoryViewModel {
  fishItems: FishInventoryItemViewModel[];
  rods: RodViewModel[];
  baits: BaitViewModel[];
  upgrades: UpgradeViewModel[];
  inventoryCount: number;
  inventoryCapacity: number;
}

interface ShopViewModel {
  rods: RodViewModel[];
  baits: BaitViewModel[];
  gold: number;
}

interface SellViewModel {
  fishItems: FishInventoryItemViewModel[];
  inventoryCount: number;
  inventoryCapacity: number;
}

export interface GameUICallbacks {
  onPlaySolo: () => void;
  onPlayOnline: () => void;
  onInteractPressed: () => void;
  onOpenBestiary: () => void;
  onOpenInventory: () => void;
  onOpenShops: () => void;
  onOpenQuests: () => void;
  onOpenSettings: () => void;
  onClosePanel: () => void;
  onCastNow: () => void;
  onCancelFishingWait: () => void;
  onGiveUpFishing: () => void;
  onRetryFishing: () => void;
  onFishAgain: () => void;
  onOpenInventoryFromResult: () => void;
  onOpenBestiaryFromResult: () => void;
  onEquipRod: (rodId: string) => void;
  onEquipBait: (baitId: string) => void;
  onBuyBait: (baitId: string, quantity: number) => void;
  onUpgradeInventory: () => void;
  onSellSelected: (fishIds: string[]) => void;
  onSellAll: () => void;
  onCopyInviteLink: () => void;
  onLeaveRoom: () => void;
  onTrackQuest: (questId: string) => void;
  onClaimQuest: (questId: string) => void;
  onClearTrackedQuest: () => void;
  onResetSave: () => void;
  onQuickSell: (mode: "commons" | "commons_uncommons" | "keep_rares") => void;
  onUpdateSettings: (settings: SettingsViewModel) => void;
}

function txtGold(v: number): string {
  return `${v}g`;
}

function txtRarity(v: Rarity): string {
  return v[0].toUpperCase() + v.slice(1);
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  mythic: 4,
};

export class GameUI {
  private readonly root: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly panelLayer: HTMLDivElement;
  private readonly rotateOverlay: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private readonly zoneHint: HTMLDivElement;
  private readonly onlinePanel: HTMLDivElement;
  private readonly interactButton: HTMLButtonElement;
  private readonly hudGold: HTMLDivElement;
  private readonly hudParty: HTMLDivElement;
  private readonly hudInventory: HTMLDivElement;
  private readonly gearRow: HTMLDivElement;
  private readonly inventoryHint: HTMLDivElement;

  private mode: PanelMode = "none";
  private minigameHoldActive = false;
  private selectedSellFish = new Set<string>();
  private inventoryTab: "fish" | "rods" | "bait" | "upgrades" = "fish";
  private inventorySort: InventorySortMode = "rarity_desc";
  private inventoryFilter: InventoryFilterMode = "all";
  private shopsTab: "rods" | "bait" = "rods";
  private bestiaryTab: ZoneId = "beach";
  private currentInventory: InventoryViewModel | null = null;
  private currentShops: ShopViewModel | null = null;
  private currentSell: SellViewModel | null = null;
  private currentBestiary: ZoneBestiaryViewModel[] = [];
  private currentVolcanoChecklist: VolcanoChecklistViewModel | null = null;
  private currentOasisChecklist: OasisChecklistViewModel | null = null;
  private currentOasisRelics: OasisRelicProgressViewModel | null = null;
  private currentQuests: QuestViewModel[] = [];
  private currentSettings: SettingsViewModel | null = null;
  private toastTimer = 0;
  private hintTimer = 0;

  constructor(private readonly callbacks: GameUICallbacks) {
    this.root = document.createElement("div");
    this.root.className = "ui-root";

    this.hud = document.createElement("div");
    this.hud.className = "hud";
    this.hud.innerHTML = `
      <div class="hud-top-row">
        <div class="hud-pill hud-gold">Gold: 0g</div>
        <div class="hud-pill hud-party">Party Bonus: +0%</div>
        <div class="hud-pill hud-inventory">Inventory: 0/10</div>
      </div>
      <div class="hud-gear-row"><div class="hud-pill">Rod: -</div><div class="hud-pill">Bait: - (0)</div><div class="hud-pill">Zone Bonus: --</div></div>
      <div class="hud-inventory-hint hidden"></div>
      <div class="hud-bottom-row">
        <button class="hud-button" data-hud-action="bestiary">Bestiary</button>
        <button class="hud-button" data-hud-action="inventory">Inventory</button>
        <button class="hud-button" data-hud-action="shops">Shops</button>
        <button class="hud-button" data-hud-action="quests">Quests</button>
        <button class="hud-button" data-hud-action="settings">Settings</button>
      </div>
      <button class="interact-button hidden">INTERACT</button>
    `;

    this.panelLayer = document.createElement("div");
    this.panelLayer.className = "panel-layer";

    this.rotateOverlay = document.createElement("div");
    this.rotateOverlay.className = "rotate-overlay";
    this.rotateOverlay.innerHTML = `<div class="rotate-card"><h2>Rotate Device</h2><p>Landscape mode required.</p></div>`;

    this.toastEl = document.createElement("div");
    this.toastEl.className = "toast hidden";

    this.zoneHint = document.createElement("div");
    this.zoneHint.className = "zone-hint hidden";

    this.onlinePanel = document.createElement("div");
    this.onlinePanel.className = "online-panel hidden";

    this.root.append(
      this.hud,
      this.onlinePanel,
      this.panelLayer,
      this.toastEl,
      this.zoneHint,
      this.rotateOverlay,
    );
    document.body.appendChild(this.root);

    this.interactButton = this.hud.querySelector(
      ".interact-button",
    ) as HTMLButtonElement;
    this.hudGold = this.hud.querySelector(".hud-gold") as HTMLDivElement;
    this.hudParty = this.hud.querySelector(".hud-party") as HTMLDivElement;
    this.hudInventory = this.hud.querySelector(
      ".hud-inventory",
    ) as HTMLDivElement;
    this.gearRow = this.hud.querySelector(".hud-gear-row") as HTMLDivElement;
    this.inventoryHint = this.hud.querySelector(
      ".hud-inventory-hint",
    ) as HTMLDivElement;

    this.hud.addEventListener("click", this.onHudClick);
    this.panelLayer.addEventListener("click", this.onPanelClick);
    this.panelLayer.addEventListener("change", this.onPanelChange);
    this.panelLayer.addEventListener("pointerdown", this.onPanelPointerDown);
    this.panelLayer.addEventListener("pointerup", this.onPanelPointerUp);
    this.panelLayer.addEventListener("pointercancel", this.onPanelPointerUp);
    this.onlinePanel.addEventListener("click", this.onOnlineClick);
    this.interactButton.addEventListener("click", () =>
      this.callbacks.onInteractPressed(),
    );
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onWindowKeyDown);
    window.addEventListener("keyup", this.onWindowKeyUp);
    this.onResize();
  }

  openSessionModeSelect(message?: string): void {
    this.mode = "session_mode_select";
    this.panelLayer.innerHTML = `<section class="panel card narrow"><h2>Tropical Island Fishing</h2><p class="subtle">Choose session mode.</p>${message ? `<p class="warning-text">${esc(message)}</p>` : ""}<div class="button-stack"><button class="primary-button" data-action="play-solo">Play Solo</button><button class="secondary-button" data-action="play-online">Play Online</button></div></section>`;
    this.activatePanel();
  }

  setHud(view: HudViewModel): void {
    this.hudGold.textContent = `Gold: ${txtGold(view.gold)}`;
    this.hudParty.textContent = `Party Bonus: +${view.partyBonusPercent}%`;
    this.hudInventory.textContent = `Inventory: ${view.inventoryCount}/${view.inventoryCapacity}`;
    this.gearRow.innerHTML = `<div class="hud-pill">Rod: ${esc(view.equippedRodName)} (L${view.equippedRodLuck}/S${view.equippedRodSturdiness})</div><div class="hud-pill">Bait: ${esc(view.equippedBaitName)} (${view.equippedBaitQuantity})</div><div class="hud-pill">Zone Bonus: ${view.zoneBonusActive ? `+${view.zoneBonusPercent}%` : "--"}</div>`;
  }

  setOnlineStatus(view: OnlineStatusViewModel): void {
    if (!view.connected || !view.roomId) {
      this.onlinePanel.classList.add("hidden");
      this.onlinePanel.innerHTML = "";
      return;
    }
    this.onlinePanel.classList.remove("hidden");
    this.onlinePanel.innerHTML = `<div class="online-row"><strong>Room:</strong> ${esc(view.roomId)}</div><div class="online-row"><strong>Players:</strong> ${view.playerCount}/${view.playerCap}</div><div class="online-row"><strong>Party Bonus:</strong> +${view.partyBonusPercent}%</div><div class="button-row compact"><button class="secondary-button small" data-online-action="copy-link">Copy Invite Link</button><button class="ghost-button small" data-online-action="leave-room">Leave Room</button></div>`;
  }

  setInventoryHint(text: string | null): void {
    if (!text) {
      this.inventoryHint.classList.add("hidden");
      this.inventoryHint.textContent = "";
      return;
    }
    this.inventoryHint.classList.remove("hidden");
    this.inventoryHint.textContent = text;
  }

  showZoneHint(text: string): void {
    this.zoneHint.textContent = text;
    this.zoneHint.classList.remove("hidden");
    this.zoneHint.classList.add("visible");
    if (this.hintTimer) {
      window.clearTimeout(this.hintTimer);
    }
    this.hintTimer = window.setTimeout(() => {
      this.zoneHint.classList.remove("visible");
      this.zoneHint.classList.add("hidden");
    }, 1600);
  }

  setInteractPrompt(label: string | null): void {
    if (!label) {
      this.interactButton.classList.add("hidden");
      return;
    }
    this.interactButton.textContent = label;
    this.interactButton.classList.remove("hidden");
  }

  openFishingReady(view: FishingReadyViewModel): void {
    this.mode = "fishing_ready";
    this.panelLayer.innerHTML = `<section class="panel card narrow"><h2>Fishing Ready</h2><p class="subtle">${esc(view.spotName)}</p><div class="stat-row"><span>Rod</span><strong>${esc(view.rodName)}</strong></div><div class="stat-row"><span>Luck</span><strong>${view.rodLuck}</strong></div><div class="stat-row"><span>Sturdiness</span><strong>${view.rodSturdiness}</strong></div><div class="stat-row"><span>Bait</span><strong>${esc(view.baitName)} (${view.baitQuantity})</strong></div><div class="stat-row"><span>Zone Bonus</span><strong>${view.zoneBonusActive ? `+${view.zoneBonusPercent}%` : "Inactive"}</strong></div>${view.failureHint ? `<p class="warning-text">${esc(view.failureHint)}</p>` : `<p class="subtle">Bait consumed on bite.</p>`}<div class="button-stack"><button class="primary-button" data-action="cast-now">CAST NOW</button><button class="secondary-button" data-action="open-inventory">Change Rod</button><button class="secondary-button" data-action="open-shops">Change Bait</button><button class="ghost-button" data-action="close-panel">Close</button></div></section>`;
    this.activatePanel();
  }

  openFishingWaiting(seconds: number): void {
    this.mode = "fishing_waiting";
    this.panelLayer.innerHTML = `<section class="panel card narrow"><h2>Waiting For Bite</h2><p class="countdown">Estimated bite: ${seconds.toFixed(1)}s</p><div class="button-stack"><button class="secondary-button" data-action="cancel-wait">Cancel Cast</button></div></section>`;
    this.activatePanel();
  }

  openMinigame(snapshot: MinigameSnapshot): void {
    this.mode = "fishing_minigame";
    this.panelLayer.innerHTML = `<section class="panel card wide"><h2>Hooked: ${esc(snapshot.fish.name)}</h2><p class="subtle">Drain: 1.5x when missing.</p><div class="progress-track"><div class="progress-fill"></div></div><div class="minigame-track"><div class="target-box"></div><div class="user-bar"></div></div><div class="minigame-row"><div class="overlap-hint"></div><div class="escape-timer"></div></div><div class="hold-zone" data-action="hold-zone">HOLD ANYWHERE</div><div class="button-stack"><button class="danger-button" data-action="give-up">Give Up</button></div></section>`;
    this.activatePanel();
    this.updateMinigame(snapshot);
  }

  updateMinigame(snapshot: MinigameSnapshot): void {
    const fill = this.panelLayer.querySelector(
      ".progress-fill",
    ) as HTMLDivElement | null;
    const user = this.panelLayer.querySelector(
      ".user-bar",
    ) as HTMLDivElement | null;
    const target = this.panelLayer.querySelector(
      ".target-box",
    ) as HTMLDivElement | null;
    const hint = this.panelLayer.querySelector(
      ".overlap-hint",
    ) as HTMLDivElement | null;
    const timer = this.panelLayer.querySelector(
      ".escape-timer",
    ) as HTMLDivElement | null;
    if (!fill || !user || !target || !hint || !timer) {
      return;
    }
    fill.style.width = `${Math.round(snapshot.progress * 100)}%`;
    user.style.width = `${snapshot.userBarWidth * 100}%`;
    user.style.left = `${snapshot.userBarX * 100}%`;
    target.style.width = `${snapshot.targetWidth * 100}%`;
    target.style.left = `${snapshot.targetX * 100}%`;
    hint.textContent = snapshot.overlap ? "Overlap: good" : "Overlap lost";
    timer.textContent = `Time left: ${snapshot.timeLeftSeconds.toFixed(1)}s`;
  }

  openFishingResult(view: FishingResultViewModel): void {
    this.mode = "fishing_result";
    this.panelLayer.innerHTML = `<section class="panel card narrow"><h2>${view.success ? "Catch Success" : "Catch Failed"}</h2>${view.success ? `<p class="result-fish">${esc(view.fishName ?? "Unknown")}</p><p class="subtle">${view.fishRarity ? txtRarity(view.fishRarity) : ""}</p>` : `<p class="warning-text">${esc(view.reason ?? "Fish escaped")}</p><p class="subtle">Bait consumed on bite.</p>`}${view.inventoryFull ? `<p class="warning-text">Inventory full.</p>` : ""}<div class="button-stack"><button class="primary-button" data-action="${view.success ? "fish-again" : "try-again"}">${view.success ? "Fish Again" : "Try Again"}</button><button class="secondary-button" data-action="open-inventory">Inventory</button><button class="secondary-button" data-action="open-bestiary">Bestiary</button><button class="ghost-button" data-action="close-panel">Close</button></div></section>`;
    this.activatePanel();
  }

  openInventory(view: InventoryViewModel): void {
    this.mode = "inventory";
    this.currentInventory = view;
    this.renderInventory();
    this.activatePanel();
  }

  openBestiary(
    zones: ZoneBestiaryViewModel[],
    volcanoChecklist: VolcanoChecklistViewModel,
    oasisChecklist: OasisChecklistViewModel,
    oasisRelics: OasisRelicProgressViewModel,
    zoneId: ZoneId,
  ): void {
    this.mode = "bestiary";
    this.currentBestiary = zones;
    this.currentVolcanoChecklist = volcanoChecklist;
    this.currentOasisChecklist = oasisChecklist;
    this.currentOasisRelics = oasisRelics;
    this.bestiaryTab = zoneId;
    this.renderBestiary();
    this.activatePanel();
  }

  openGatePanel(view: GatePanelViewModel): void {
    this.mode = "gate_info";
    const rows = view.requirements
      .map(
        (item) =>
          `<div class="check-row ${item.met ? "ok" : ""}">${esc(item.label)}: ${item.current}/${item.required}</div>`,
      )
      .join("");
    this.panelLayer.innerHTML = `<section class="panel card narrow"><h2>${esc(view.title)}</h2><p class="${view.unlocked ? "success-text" : "warning-text"}">${view.unlocked ? "Unlocked" : "Locked"}</p><p class="subtle">${esc(view.description)}</p>${rows}${view.footer ? `<p class="subtle">${esc(view.footer)}</p>` : ""}<div class="button-stack"><button class="secondary-button" data-action="open-bestiary">Open Bestiary</button><button class="ghost-button" data-action="close-panel">Close</button></div></section>`;
    this.activatePanel();
  }

  openRodUnlock(view: RodUnlockViewModel): void {
    this.mode = "rod_unlock";
    this.panelLayer.innerHTML = `<section class="panel card narrow"><h2>New Rod Unlocked!</h2><p class="result-fish">${esc(
      view.rodName,
    )}</p><p class="subtle">${esc(view.sourceText)}</p><div class="stat-row"><span>Luck</span><strong>${
      view.luck
    }</strong></div><div class="stat-row"><span>Sturdiness</span><strong>${view.sturdiness}</strong></div>${
      view.zoneBonusText
        ? `<p class="subtle">${esc(view.zoneBonusText)}</p>`
        : ""
    }<div class="button-stack"><button class="primary-button" data-action="equip-reward-rod" data-rod-id="${
      view.rodId
    }">Equip Now</button><button class="secondary-button" data-action="open-inventory">Open Inventory</button><button class="ghost-button" data-action="close-panel">Close</button></div></section>`;
    this.activatePanel();
  }

  openShops(view: ShopViewModel, tab: "rods" | "bait"): void {
    this.mode = "shops";
    this.currentShops = view;
    this.shopsTab = tab;
    this.renderShops();
    this.activatePanel();
  }

  openSellStand(view: SellViewModel): void {
    this.mode = "sell";
    this.currentSell = view;
    this.selectedSellFish.clear();
    this.renderSell();
    this.activatePanel();
  }

  openSettings(view: SettingsViewModel): void {
    this.mode = "settings";
    this.currentSettings = view;
    this.panelLayer.innerHTML = `<section class="panel card narrow"><h2>Settings</h2><div class="list-wrap"><label class="list-card"><span>Master Volume</span><input type="range" min="0" max="1" step="0.01" value="${view.masterVolume}" data-setting="masterVolume"/></label><label class="list-card"><span>SFX Volume</span><input type="range" min="0" max="1" step="0.01" value="${view.sfxVolume}" data-setting="sfxVolume"/></label><label class="list-card"><span>Music Volume</span><input type="range" min="0" max="1" step="0.01" value="${view.musicVolume}" data-setting="musicVolume"/></label><label class="list-card"><span>Mute</span><input type="checkbox" ${view.muted ? "checked" : ""} data-setting-check="muted"/></label><label class="list-card"><span>Graphics</span><select data-setting="graphicsQuality"><option value="low" ${view.graphicsQuality === "low" ? "selected" : ""}>Low</option><option value="medium" ${view.graphicsQuality === "medium" ? "selected" : ""}>Medium</option><option value="high" ${view.graphicsQuality === "high" ? "selected" : ""}>High</option></select></label><label class="list-card"><span>Show Diagnostics</span><input type="checkbox" ${view.showDiagnostics ? "checked" : ""} data-setting-check="showDiagnostics"/></label><label class="list-card"><span>Mesh Audit</span><input type="checkbox" ${view.meshAuditEnabled ? "checked" : ""} data-setting-check="meshAuditEnabled"/></label><label class="list-card"><span>Decay Micro-Grace</span><input type="checkbox" ${view.decayGraceEnabled ? "checked" : ""} data-setting-check="decayGraceEnabled"/></label></div><p class="subtle">Bait is consumed when a fish bites.</p><div class="button-stack"><button class="danger-button" data-action="reset-save">Reset Save</button><button class="ghost-button" data-action="close-panel">Close</button></div></section>`;
    this.activatePanel();
  }

  openQuests(quests: QuestViewModel[]): void {
    this.mode = "quests";
    this.currentQuests = quests;
    this.renderQuests();
    this.activatePanel();
  }

  openHintDialog(title: string, body: string): void {
    this.mode = "dialog";
    this.panelLayer.innerHTML = `<section class="panel card narrow"><h2>${esc(title)}</h2><p class="subtle">${esc(body)}</p><div class="button-stack"><button class="secondary-button" data-action="open-quests">Open Quests</button><button class="ghost-button" data-action="close-panel">Close</button></div></section>`;
    this.activatePanel();
  }

  closePanel(): void {
    this.mode = "none";
    this.minigameHoldActive = false;
    this.panelLayer.innerHTML = "";
    this.panelLayer.classList.remove("active");
  }

  private activatePanel(): void {
    this.panelLayer.classList.add("active");
  }

  isGameplayInputBlocked(): boolean {
    return this.mode !== "none";
  }

  isMinigameHoldActive(): boolean {
    return this.mode === "fishing_minigame" && this.minigameHoldActive;
  }

  applyFishingState(snapshot: FishingSnapshot): void {
    if (snapshot.state === "waiting_for_bite") {
      if (this.mode !== "fishing_waiting") {
        this.openFishingWaiting(snapshot.biteInSeconds);
      } else {
        const countdown = this.panelLayer.querySelector(".countdown");
        if (countdown) {
          countdown.textContent = `Estimated bite: ${snapshot.biteInSeconds.toFixed(1)}s`;
        }
      }
    } else if (snapshot.state === "minigame" && snapshot.minigame) {
      if (this.mode !== "fishing_minigame") {
        this.openMinigame(snapshot.minigame);
      } else {
        this.updateMinigame(snapshot.minigame);
      }
    }
  }

  showToast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove("hidden");
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(
      () => this.toastEl.classList.add("hidden"),
      1800,
    );
  }

  private renderInventory(): void {
    if (!this.currentInventory) {
      return;
    }
    const v = this.currentInventory;
    const fishItems = applyInventoryFilter(v.fishItems, this.inventoryFilter);
    const sortedFish = sortInventory(fishItems, this.inventorySort);
    const fishRows =
      sortedFish
        .map(
          (item) =>
            `<article class="list-card rarity-${item.rarity}"><div><h4>${esc(item.name)}</h4><p>${txtRarity(
              item.rarity,
            )} | Zone: ${esc(item.zoneId)} | Count: ${item.count}</p></div><strong>${txtGold(item.sellPrice)}</strong></article>`,
        )
        .join("") || `<p class="subtle">No fish match this filter.</p>`;
    const fishControls = `<div class="inline-controls"><label>Sort <select data-action="inventory-sort"><option value="rarity_desc" ${
      this.inventorySort === "rarity_desc" ? "selected" : ""
    }>Rarity</option><option value="sell_desc" ${
      this.inventorySort === "sell_desc" ? "selected" : ""
    }>Sell Value</option><option value="zone" ${
      this.inventorySort === "zone" ? "selected" : ""
    }>Zone</option><option value="newest" ${
      this.inventorySort === "newest" ? "selected" : ""
    }>Newest</option></select></label><label>Filter <select data-action="inventory-filter"><option value="all" ${
      this.inventoryFilter === "all" ? "selected" : ""
    }>All</option><option value="rare_plus" ${
      this.inventoryFilter === "rare_plus" ? "selected" : ""
    }>Rare+</option><option value="beach" ${
      this.inventoryFilter === "beach" ? "selected" : ""
    }>Beach</option><option value="river" ${
      this.inventoryFilter === "river" ? "selected" : ""
    }>River</option></select></label></div>`;
    const fish = `${fishControls}<div class="list-wrap">${fishRows}</div>`;
    const rods =
      v.rods
        .map(
          (r) =>
            `<article class="list-card ${r.phaseLocked ? "locked" : ""}"><div><h4>${esc(r.name)}</h4><p>Luck ${r.luck} | Sturdy ${r.sturdiness}${r.zoneBonusZoneId ? ` | ${r.zoneBonusZoneId} +${r.zoneBonusPercent}%` : ""}</p><p class="subtle">${r.zoneBonusZoneId && r.zoneBonusActive ? "Zone Bonus active" : r.zoneBonusZoneId ? "Zone Bonus inactive" : "No zone passive"}</p></div>${r.owned && !r.phaseLocked ? `<button class="secondary-button small" data-action="equip-rod" data-rod-id="${r.id}">Equip</button>` : `<span class="chip">${r.phaseLocked ? "Locked" : "Not owned"}</span>`}</article>`,
        )
        .join("") || `<p class="subtle">No rods.</p>`;
    const baits =
      v.baits
        .map(
          (b) =>
            `<article class="list-card ${b.phaseLocked ? "locked" : ""}"><div><h4>${esc(b.name)}</h4><p>Luck x${b.luckMultiplier}</p><p>Owned: ${b.quantity}</p></div>${b.phaseLocked ? `<span class="chip">Locked</span>` : `<button class="secondary-button small" data-action="equip-bait" data-bait-id="${b.id}">Equip</button>`}</article>`,
        )
        .join("") || `<p class="subtle">No bait.</p>`;
    const upgrades =
      v.upgrades
        .map(
          (u) =>
            `<article class="list-card ${u.status === "locked" ? "locked" : ""}"><div><h4>Upgrade ${u.level}</h4><p>Capacity ${u.capacity}</p></div>${u.status === "owned" ? `<span class="chip">Owned</span>` : u.status === "available" ? `<button class="primary-button small" data-action="upgrade-inventory">Buy ${txtGold(u.cost)}</button>` : `<span class="chip">Locked</span>`}</article>`,
        )
        .join("") || `<p class="subtle">No upgrades.</p>`;
    const map = { fish, rods, bait: baits, upgrades };
    this.panelLayer.innerHTML = `<section class="panel card wide"><div class="panel-header-row"><h2>Inventory</h2><button class="ghost-button small" data-action="close-panel">Close</button></div><p class="subtle">Capacity ${v.inventoryCount}/${v.inventoryCapacity}</p><div class="tab-strip"><button class="tab-button ${this.inventoryTab === "fish" ? "active" : ""}" data-action="inventory-tab" data-tab="fish">Fish</button><button class="tab-button ${this.inventoryTab === "rods" ? "active" : ""}" data-action="inventory-tab" data-tab="rods">Rods</button><button class="tab-button ${this.inventoryTab === "bait" ? "active" : ""}" data-action="inventory-tab" data-tab="bait">Bait</button><button class="tab-button ${this.inventoryTab === "upgrades" ? "active" : ""}" data-action="inventory-tab" data-tab="upgrades">Upgrades</button></div>${map[this.inventoryTab]}</section>`;
  }

  private renderBestiary(): void {
    const zone =
      this.currentBestiary.find((z) => z.zoneId === this.bestiaryTab) ??
      this.currentBestiary[0];
    if (!zone || !this.currentVolcanoChecklist) {
      return;
    }
    const entries = zone.entries
      .map((e) =>
        e.discovered
          ? `<article class="bestiary-card discovered rarity-${e.rarity}"><h4>${esc(e.name)}</h4><p>${txtRarity(e.rarity)}</p><p>Caught: ${e.caughtCount}</p></article>`
          : `<article class="bestiary-card undiscovered"><h4>???</h4><p>Silhouette</p></article>`,
      )
      .join("");
    const tabs = this.currentBestiary
      .map(
        (z) =>
          `<button class="tab-button ${z.zoneId === zone.zoneId ? "active" : ""}" data-action="bestiary-tab" data-zone="${z.zoneId}">${esc(z.zoneName)}</button>`,
      )
      .join("");
    const v = this.currentVolcanoChecklist;
    this.panelLayer.innerHTML = `<section class="panel card wide"><div class="panel-header-row"><h2>Bestiary</h2><button class="ghost-button small" data-action="close-panel">Close</button></div><div class="tab-strip">${tabs}</div><p class="subtle">${esc(zone.zoneName)} ${zone.discoveredUnique}/${zone.total} (${Math.round(zone.percent)}%)</p><section class="gate-checklist ${v.unlocked ? "unlocked" : ""}"><h4>River Build Progress</h4><div class="check-row ${v.beachUnique >= v.required ? "ok" : ""}">Beach: ${v.beachUnique}/${v.required}</div><div class="check-row ${v.riverUnique >= v.required ? "ok" : ""}">River: ${v.riverUnique}/${v.required}</div><strong>${v.unlocked ? "Core loop complete" : "Catch more unique fish in active zones"}</strong></section><div class="bestiary-grid">${entries}</div></section>`;
  }

  private renderShops(): void {
    if (!this.currentShops) {
      return;
    }
    const v = this.currentShops;
    const rods = v.rods
      .map(
        (r) =>
          `<article class="list-card ${r.phaseLocked ? "locked" : ""}"><div><h4>${esc(r.name)}</h4><p>Luck ${r.luck} | Sturdy ${r.sturdiness}</p></div>${r.owned && !r.phaseLocked ? `<button class="secondary-button small" data-action="equip-rod" data-rod-id="${r.id}">Equip</button>` : `<span class="chip">${r.phaseLocked ? "Locked" : "Unlock in world"}</span>`}</article>`,
      )
      .join("");
    const baits = v.baits
      .map((b) =>
        !b.purchasable
          ? `<article class="list-card locked"><div><h4>${esc(b.name)}</h4><p>Luck x${b.luckMultiplier}</p></div><span class="chip">Locked</span></article>`
          : `<article class="list-card"><div><h4>${esc(b.name)}</h4><p>Luck x${b.luckMultiplier} | Owned ${b.quantity}</p><p>Price ${txtGold(b.price)}</p></div><div class="buy-controls"><input type="number" min="1" max="99" value="1" data-bait-qty="${b.id}" /><button class="primary-button small" data-action="buy-bait" data-bait-id="${b.id}">Buy</button></div></article>`,
      )
      .join("");
    this.panelLayer.innerHTML = `<section class="panel card wide"><div class="panel-header-row"><h2>Shops</h2><button class="ghost-button small" data-action="close-panel">Close</button></div><p class="subtle">Gold: ${txtGold(v.gold)}</p><div class="tab-strip"><button class="tab-button ${this.shopsTab === "rods" ? "active" : ""}" data-action="shops-tab" data-tab="rods">Rod Shop</button><button class="tab-button ${this.shopsTab === "bait" ? "active" : ""}" data-action="shops-tab" data-tab="bait">Bait Shop</button></div><div class="list-wrap">${this.shopsTab === "rods" ? rods : baits}</div></section>`;
  }

  private renderSell(): void {
    if (!this.currentSell) {
      return;
    }
    const rows =
      this.currentSell.fishItems.length === 0
        ? `<p class="subtle">No fish to sell.</p>`
        : this.currentSell.fishItems
            .map(
              (f) =>
                `<label class="list-card selectable rarity-${f.rarity}"><input type="checkbox" data-action="toggle-sell-fish" value="${f.fishId}" ${this.selectedSellFish.has(f.fishId) ? "checked" : ""}/><div><h4>${esc(f.name)}</h4><p>${txtRarity(f.rarity)} | Count: ${f.count}</p></div><strong>${txtGold(f.sellPrice)}</strong></label>`,
            )
            .join("");
    this.panelLayer.innerHTML = `<section class="panel card wide"><div class="panel-header-row"><h2>Sell Stand</h2><button class="ghost-button small" data-action="close-panel">Close</button></div><p class="subtle">Inventory ${this.currentSell.inventoryCount}/${this.currentSell.inventoryCapacity}</p><div class="button-row compact"><button class="secondary-button small" data-action="quick-sell" data-quick-sell="commons">Sell Commons</button><button class="secondary-button small" data-action="quick-sell" data-quick-sell="commons_uncommons">Sell Commons+Uncommons</button><button class="ghost-button small" data-action="quick-sell" data-quick-sell="keep_rares">Keep Rares+</button></div><div class="list-wrap">${rows}</div><div class="button-row"><button class="primary-button" data-action="sell-selected">Sell Selected</button><button class="secondary-button" data-action="sell-all">Sell All</button></div></section>`;
  }

  private renderQuests(): void {
    const rows =
      this.currentQuests.length === 0
        ? `<p class="subtle">No quests available.</p>`
        : this.currentQuests
            .map(
              (q) =>
                `<article class="list-card"><div><h4>${esc(q.title)}</h4><p>${esc(q.description)}</p><p class="subtle">${esc(q.progressText)}</p><p class="subtle">Reward: ${esc(q.rewardText)}</p><p class="subtle">Hint: ${esc(q.hint)}</p></div>${q.status === "active" ? `<button class="ghost-button small" data-action="clear-active-quest">Untrack</button>` : q.status === "claimable" ? `<button class="primary-button small" data-action="claim-quest" data-quest-id="${q.id}">Claim</button>` : q.status === "completed" ? `<span class="chip">Done</span>` : `<button class="secondary-button small" data-action="track-quest" data-quest-id="${q.id}">Track</button>`}</article>`,
            )
            .join("");
    this.panelLayer.innerHTML = `<section class="panel card wide"><div class="panel-header-row"><h2>Quests</h2><button class="ghost-button small" data-action="close-panel">Close</button></div><div class="list-wrap">${rows}</div></section>`;
  }

  private readonly onHudClick = (event: MouseEvent): void => {
    const action = (event.target as HTMLElement).dataset.hudAction;
    if (action === "bestiary") this.callbacks.onOpenBestiary();
    if (action === "inventory") this.callbacks.onOpenInventory();
    if (action === "shops") this.callbacks.onOpenShops();
    if (action === "quests") this.callbacks.onOpenQuests();
    if (action === "settings") this.callbacks.onOpenSettings();
  };

  private readonly onOnlineClick = (event: MouseEvent): void => {
    const action = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-online-action]",
    )?.dataset.onlineAction;
    if (action === "copy-link") this.callbacks.onCopyInviteLink();
    if (action === "leave-room") this.callbacks.onLeaveRoom();
  };

  private readonly onPanelClick = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action]",
    );
    const action = target?.dataset.action;
    if (!action) {
      return;
    }
    if (action === "hold-zone") {
      return;
    }

    if (action === "play-solo") this.callbacks.onPlaySolo();
    if (action === "play-online") this.callbacks.onPlayOnline();
    if (action === "close-panel") this.callbacks.onClosePanel();
    if (action === "cast-now") this.callbacks.onCastNow();
    if (action === "cancel-wait") this.callbacks.onCancelFishingWait();
    if (action === "give-up") this.callbacks.onGiveUpFishing();
    if (action === "try-again") this.callbacks.onRetryFishing();
    if (action === "fish-again") this.callbacks.onFishAgain();
    if (action === "open-inventory")
      this.mode === "fishing_result"
        ? this.callbacks.onOpenInventoryFromResult()
        : this.callbacks.onOpenInventory();
    if (action === "open-bestiary")
      this.mode === "fishing_result"
        ? this.callbacks.onOpenBestiaryFromResult()
        : this.callbacks.onOpenBestiary();
    if (action === "open-shops") this.callbacks.onOpenShops();
    if (action === "open-quests") this.callbacks.onOpenQuests();

    if (action === "inventory-tab") {
      this.inventoryTab =
        (target?.dataset.tab as "fish" | "rods" | "bait" | "upgrades") ??
        "fish";
      this.renderInventory();
    }
    if (action === "shops-tab") {
      this.shopsTab = (target?.dataset.tab as "rods" | "bait") ?? "rods";
      this.renderShops();
    }
    if (action === "bestiary-tab") {
      this.bestiaryTab = (target?.dataset.zone as ZoneId) ?? "beach";
      this.renderBestiary();
    }

    if (action === "equip-rod" && target?.dataset.rodId)
      this.callbacks.onEquipRod(target.dataset.rodId);
    if (action === "equip-reward-rod" && target?.dataset.rodId)
      this.callbacks.onEquipRod(target.dataset.rodId);
    if (action === "equip-bait" && target?.dataset.baitId)
      this.callbacks.onEquipBait(target.dataset.baitId);
    if (action === "buy-bait" && target?.dataset.baitId) {
      const input = this.panelLayer.querySelector<HTMLInputElement>(
        `input[data-bait-qty='${target.dataset.baitId}']`,
      );
      this.callbacks.onBuyBait(
        target.dataset.baitId,
        Math.max(1, Math.floor(Number(input?.value) || 1)),
      );
    }
    if (action === "upgrade-inventory") this.callbacks.onUpgradeInventory();

    if (action === "sell-selected" && this.currentSell) {
      const ids: string[] = [];
      for (const item of this.currentSell.fishItems) {
        if (this.selectedSellFish.has(item.fishId)) {
          for (let i = 0; i < item.count; i += 1) ids.push(item.fishId);
        }
      }
      this.callbacks.onSellSelected(ids);
    }
    if (action === "sell-all") this.callbacks.onSellAll();
    if (action === "quick-sell") {
      const mode = target?.dataset.quickSell;
      if (
        mode === "commons" ||
        mode === "commons_uncommons" ||
        mode === "keep_rares"
      ) {
        this.callbacks.onQuickSell(mode);
      }
    }

    if (action === "track-quest" && target?.dataset.questId)
      this.callbacks.onTrackQuest(target.dataset.questId);
    if (action === "claim-quest" && target?.dataset.questId)
      this.callbacks.onClaimQuest(target.dataset.questId);
    if (action === "clear-active-quest") this.callbacks.onClearTrackedQuest();

    if (action === "reset-save") this.callbacks.onResetSave();
  };

  private readonly onPanelChange = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.action === "toggle-sell-fish") {
      const checkbox = target as HTMLInputElement;
      if (checkbox.checked) this.selectedSellFish.add(checkbox.value);
      else this.selectedSellFish.delete(checkbox.value);
      return;
    }

    if (target.dataset.action === "inventory-sort") {
      const value = target.value;
      if (
        value === "rarity_desc" ||
        value === "sell_desc" ||
        value === "zone" ||
        value === "newest"
      ) {
        this.inventorySort = value;
        this.renderInventory();
      }
      return;
    }

    if (target.dataset.action === "inventory-filter") {
      const value = target.value;
      if (
        value === "all" ||
        value === "rare_plus" ||
        value === "beach" ||
        value === "river"
      ) {
        this.inventoryFilter = value;
        this.renderInventory();
      }
      return;
    }

    if (!this.currentSettings) {
      return;
    }

    const settingKey = target.dataset.setting;
    const settingCheck = target.dataset.settingCheck;
    if (!settingKey && !settingCheck) {
      return;
    }

    const next: SettingsViewModel = { ...this.currentSettings };
    if (
      settingKey === "masterVolume" ||
      settingKey === "sfxVolume" ||
      settingKey === "musicVolume"
    ) {
      next[settingKey] = clamp01(Number(target.value));
    } else if (settingKey === "graphicsQuality") {
      if (
        target.value === "low" ||
        target.value === "medium" ||
        target.value === "high"
      ) {
        next.graphicsQuality = target.value;
      }
    }

    if (
      settingCheck === "muted" ||
      settingCheck === "showDiagnostics" ||
      settingCheck === "meshAuditEnabled" ||
      settingCheck === "decayGraceEnabled"
    ) {
      next[settingCheck] = (target as HTMLInputElement).checked;
    }
    this.currentSettings = next;
    this.callbacks.onUpdateSettings(next);
  };

  private readonly onPanelPointerDown = (event: PointerEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action]",
    );
    if (
      target?.dataset.action === "hold-zone" &&
      this.mode === "fishing_minigame"
    ) {
      this.minigameHoldActive = true;
    }
  };

  private readonly onPanelPointerUp = (): void => {
    if (this.mode === "fishing_minigame") {
      this.minigameHoldActive = false;
    }
  };

  private readonly onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space" && this.mode === "fishing_minigame")
      this.minigameHoldActive = true;
  };

  private readonly onWindowKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space" && this.mode === "fishing_minigame")
      this.minigameHoldActive = false;
  };

  private readonly onResize = (): void => {
    this.rotateOverlay.classList.toggle(
      "visible",
      window.matchMedia("(orientation: portrait)").matches,
    );
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function applyInventoryFilter(
  items: FishInventoryItemViewModel[],
  filter: InventoryFilterMode,
): FishInventoryItemViewModel[] {
  if (filter === "all") {
    return [...items];
  }
  if (filter === "rare_plus") {
    return items.filter(
      (item) =>
        item.rarity === "rare" ||
        item.rarity === "epic" ||
        item.rarity === "mythic",
    );
  }
  return items.filter((item) => item.zoneId === filter);
}

function sortInventory(
  items: FishInventoryItemViewModel[],
  mode: InventorySortMode,
): FishInventoryItemViewModel[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (mode === "sell_desc") {
      if (b.sellPrice !== a.sellPrice) {
        return b.sellPrice - a.sellPrice;
      }
      return b.count - a.count;
    }
    if (mode === "zone") {
      const zoneDiff = a.zoneId.localeCompare(b.zoneId);
      if (zoneDiff !== 0) {
        return zoneDiff;
      }
      return a.name.localeCompare(b.name);
    }
    if (mode === "newest") {
      if (b.lastCaughtAt !== a.lastCaughtAt) {
        return b.lastCaughtAt - a.lastCaughtAt;
      }
      return a.name.localeCompare(b.name);
    }

    const rarityDiff = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
    if (rarityDiff !== 0) {
      return rarityDiff;
    }
    return a.name.localeCompare(b.name);
  });
  return copy;
}
