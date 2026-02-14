/**
 * Game entry point — wires sim, scene, HUD, and game loop.
 * Supports SOLO (default) and MULTI (Colyseus) modes via URL params.
 *
 * URL params for multiplayer:
 *   ?server=ws://localhost:2567&room=starforge&name=Alice&role=player
 */
import { GameLoop } from "./core/gameLoop";
import balanceJson from "./data/balance.v1.json";
import balanceV2Json from "./data/balance.v2.json";
import type { BalanceV1, BalanceV2 } from "./data/balanceSchema";
import baseSlotsJson from "./data/baseSlots.v2.json";
import type { BaseSlotsV2Catalog } from "./data/baseSlotsSchema";
import branchesJson from "./data/branches.v1.json";
import type { BranchesCatalog } from "./data/branchesSchema";
import contractsJson from "./data/contracts.v1.json";
import type { ContractsCatalog } from "./data/contractsSchema";
import eventsJson from "./data/events.v1.json";
import type { EventsCatalog } from "./data/eventsSchema";
import machineCategoriesJson from "./data/machineCategories.v1.json";
import type { MachineCategoriesCatalog } from "./data/machineCategoriesSchema";
import machinesJson from "./data/machines.v1.json";
import machinesV2Json from "./data/machines.v2.json";
import type { MachinesCatalog, MachinesV2Catalog } from "./data/machinesSchema";
import milestonesJson from "./data/milestones.v1.json";
import type { MilestonesCatalog } from "./data/milestonesSchema";
import rebirthJson from "./data/rebirth.v1.json";
import type { RebirthCatalog, RebirthTreeCatalog } from "./data/rebirthSchema";
import rebirthTreeJson from "./data/rebirthTree.v1.json";
import tierUnlocksJson from "./data/tierUnlocks.v1.json";
import tierUnlocksV2Json from "./data/tierUnlocks.v2.json";
import type {
  TierUnlocksCatalog,
  TierUnlocksV2Catalog,
} from "./data/tierUnlocksSchema";
import upgradesJson from "./data/upgrades.v1.json";
import upgradesV2Json from "./data/upgrades.v2.json";
import type { UpgradesCatalog, UpgradesV2Catalog } from "./data/upgradesSchema";
import wrecksJson from "./data/wrecks.v1.json";
import wrecksV2Json from "./data/wrecks.v2.json";
import type { WrecksCatalog, WrecksV2Catalog } from "./data/wrecksSchema";
import type { PlayerRole } from "./net/messageTypes";
import { createRoomAdapter } from "./net/roomAdapter";
import { SceneController } from "./render/sceneController";
import {
  computePlacement,
  setDerivedBaseCutDamage,
  setDerivedBaseSlots,
  setDerivedBranchesCatalog,
  setDerivedMachinesV2,
  setDerivedMaxAliveBase,
  setDerivedRebirthTree,
  setDerivedUpgradesV2,
} from "./sim/derived";
import {
  setBalanceV2,
  setBranchesCatalog,
  setMachinesV2Catalog,
  setRebirthCatalog,
  setRebirthTreeCatalog,
  setTierUnlocksV2Catalog,
  setUpgradesV2Catalog,
  setWrecksV2Catalog,
} from "./sim/reducer";
import {
  setSimBalanceV2,
  setSimMachinesV2Catalog,
  setSimWrecksV2Catalog,
} from "./sim/sim";
import { createHUD } from "./ui/hud";

const balance = balanceJson as BalanceV1;
const balanceV2 = balanceV2Json as unknown as BalanceV2;
const machinesCatalog = machinesJson as unknown as MachinesCatalog;
const machinesV2 = machinesV2Json as unknown as MachinesV2Catalog;
const upgradesCatalog = upgradesJson as unknown as UpgradesCatalog;
const contractsCatalog = contractsJson as unknown as ContractsCatalog;
const eventsCatalog = eventsJson as unknown as EventsCatalog;
const milestonesCatalog = milestonesJson as unknown as MilestonesCatalog;
const wrecksCatalog = wrecksJson as unknown as WrecksCatalog;
const wrecksV2 = wrecksV2Json as unknown as WrecksV2Catalog;
const tierUnlocksCatalog = tierUnlocksJson as unknown as TierUnlocksCatalog;
const tierUnlocksV2 = tierUnlocksV2Json as unknown as TierUnlocksV2Catalog;
const upgradesV2Catalog = upgradesV2Json as unknown as UpgradesV2Catalog;
const branchesV1 = branchesJson as unknown as BranchesCatalog;
const baseSlotsV2 = baseSlotsJson as unknown as BaseSlotsV2Catalog;
const categoriesCatalog =
  machineCategoriesJson as unknown as MachineCategoriesCatalog;
const rebirthV1 = rebirthJson as unknown as RebirthCatalog;
const rebirthTreeV1 = rebirthTreeJson as unknown as RebirthTreeCatalog;

export async function startGame(): Promise<void> {
  const container = document.getElementById("app")!;

  // Hide viewer debug panel if present
  const debugPanel = document.getElementById("debug-panel");
  if (debugPanel) debugPanel.style.display = "none";

  // Hide viewer info bar — we use HUD instead
  const infoBar = document.getElementById("info-bar");
  if (infoBar) infoBar.style.display = "none";

  // ── Scene (with WebGL error handling) ──────────────────────
  let sceneCtrl: SceneController;
  try {
    sceneCtrl = new SceneController();
    await sceneCtrl.init(container);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Unknown WebGL/rendering error";
    throw new Error(
      `Failed to initialize 3D renderer: ${msg}. ` +
        "Your device may not support WebGL.",
    );
  }

  // ── HUD ────────────────────────────────────────────────
  const hud = createHUD(
    container,
    machinesCatalog,
    upgradesCatalog,
    upgradesV2Catalog,
    contractsCatalog,
    eventsCatalog,
    milestonesCatalog,
    tierUnlocksCatalog,
    categoriesCatalog,
    machinesV2,
    branchesV1,
    tierUnlocksV2,
    rebirthTreeV1,
  );

  // ── V2 catalog wiring (reducer + sim + derived) ────────
  setBalanceV2(balanceV2);
  setWrecksV2Catalog(wrecksV2);
  setSimBalanceV2(balanceV2);
  setSimWrecksV2Catalog(wrecksV2);
  setDerivedBaseCutDamage(balanceV2.cut.baseDamageMicroPerTap);
  setDerivedMaxAliveBase(wrecksV2.spawn.maxAliveBase);
  setDerivedUpgradesV2(upgradesV2Catalog);
  setUpgradesV2Catalog(upgradesV2Catalog);
  setTierUnlocksV2Catalog(tierUnlocksV2);
  setMachinesV2Catalog(machinesV2);
  setBranchesCatalog(branchesV1);
  setDerivedBranchesCatalog(branchesV1);
  setDerivedBaseSlots(baseSlotsV2);
  setDerivedMachinesV2(machinesV2);
  setSimMachinesV2Catalog(machinesV2);
  setRebirthCatalog(rebirthV1);
  setRebirthTreeCatalog(rebirthTreeV1);
  setDerivedRebirthTree(rebirthTreeV1);

  // ── Game loop ──────────────────────────────────────────
  const loop = new GameLoop(
    balance,
    machinesCatalog,
    upgradesCatalog,
    contractsCatalog,
    eventsCatalog,
    milestonesCatalog,
    wrecksCatalog,
    tierUnlocksCatalog,
    {
      onRender(_state, dt) {
        sceneCtrl.renderFrame(dt);
      },
      onStateChange(state) {
        hud.update(state);
        const placement = computePlacement(state.machines, state.meta);
        sceneCtrl.setPlacementMap(placement);
        sceneCtrl.syncMachines(state.machines);
        sceneCtrl.syncWrecks(state.wrecks.active, state.tick);
      },
    },
  );

  // Wire TAP: both HUD button and canvas click
  hud.onTap(() => loop.tap());
  sceneCtrl.setTapCallback(() => loop.tap());

  // Wire camera reframing when HUD layout changes
  hud.onLayoutChange((hudHeightPx) => {
    sceneCtrl.setBottomPadding(hudHeightPx + 16);
    sceneCtrl.reframe();
  });

  // Wire back button — exit to parent (WebView postMessage or history back)
  hud.onBack(() => {
    const params = new URLSearchParams(window.location.search);
    const isEmbedded =
      params.get("embedded") === "1" ||
      typeof (window as unknown as Record<string, unknown>)
        .ReactNativeWebView !== "undefined";
    if (isEmbedded) {
      try {
        const rn = (window as unknown as Record<string, unknown>)
          .ReactNativeWebView as
          | { postMessage?: (msg: string) => void }
          | undefined;
        rn?.postMessage?.(
          JSON.stringify({ source: "starforge", type: "back" }),
        );
      } catch {
        // no bridge
      }
    }
    // Fallback: history back
    if (window.history.length > 1) {
      window.history.back();
    }
  });

  // Wire wreck selection (v2: clicking wreck selects it for dock, not tap)
  sceneCtrl.setWreckTapCallback((wreckId) => loop.selectWreck(wreckId));
  sceneCtrl.setWrecksCatalog(wrecksCatalog);
  sceneCtrl.setWrecksV2Catalog(wrecksV2);

  // Wire auto-rotate toggle
  hud.onAutoRotateToggle((enabled) => sceneCtrl.setAutoRotate(enabled));

  // Wire machine shop
  hud.onBuyMachine((code, qty) => loop.buyMachine(code, qty));

  // Wire upgrade store
  hud.onBuyUpgrade((id) => loop.buyUpgrade(id));

  // Wire v2 upgrade store
  hud.onBuyUpgradeV2((id) => loop.buyUpgradeV2(id));

  // Wire tier upgrades (by code — upgrades whole stack)
  hud.onUpgradeTier((code) => loop.upgradeMachineTier(code));

  // Wire toggle machine enabled
  hud.onToggleMachineEnabled((code, enabled) =>
    loop.toggleMachineEnabled(code, enabled),
  );

  // Wire contracts
  hud.onStartContract((contractId) => loop.startContract(contractId));
  hud.onClaimContract(() => loop.claimContract());

  // Wire events
  hud.onTapEvent(() => loop.tapEvent());

  // Wire milestones
  hud.onDismissMilestone(() => loop.dismissMilestoneToast());

  // Wire Reset
  hud.onReset(() => loop.reset());

  // Wire Rebirth
  hud.onConfirmRebirth(() => loop.confirmRebirth());
  hud.onBuyRebirthNode((nodeId) => loop.buyRebirthNode(nodeId));

  loop.start();

  // ── Multiplayer: check URL params ──────────────────────
  const params = new URLSearchParams(window.location.search);
  const serverEndpoint = params.get("server");
  const roomName = params.get("room") ?? "starforge";
  const playerName = params.get("name") ?? undefined;
  const playerRole = (params.get("role") as PlayerRole) ?? undefined;

  if (serverEndpoint) {
    const adapter = createRoomAdapter();

    // Wire up state and error callbacks BEFORE connecting
    adapter.onState((state) => loop.setRemoteState(state));
    adapter.onError((err) =>
      console.error("[Starforge] Server error:", err.code, err.message),
    );

    // Switch to MULTI mode
    loop.setMode("MULTI");
    loop.setRemoteSend((cmd) => adapter.sendInput(cmd));

    // Enable spectator mode on HUD if applicable
    if (playerRole === "spectator") {
      hud.setSpectatorMode(true);
    }

    adapter
      .connect(serverEndpoint, roomName, {
        name: playerName,
        role: playerRole,
      })
      .then(() => {
        console.log(`[Starforge] Connected to ${serverEndpoint}/${roomName}`);
      })
      .catch((err) => {
        console.error("[Starforge] Failed to connect:", err);
        // Fall back to SOLO mode
        loop.setMode("SOLO");
        hud.setSpectatorMode(false);
      });
  }
}
