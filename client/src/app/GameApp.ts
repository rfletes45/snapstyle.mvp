import * as THREE from "three";
import { BAIT_DEFINITIONS } from "../data/baits";
import {
  DEV_GOLD_GRANT,
  INVENTORY_CAPACITY_BY_LEVEL,
  INVENTORY_UPGRADE_COST_BY_LEVEL,
} from "../data/config";
import { ALL_FISH_BY_ID, FISH_BY_ZONE } from "../data/fish";
import { getQualityPreset, type QualityPreset } from "../data/quality";
import { getQuestById, QUEST_DEFINITIONS } from "../data/quests";
import { getRodById, ROD_DEFINITIONS } from "../data/rods";
import { PLAYABLE_PHASE4_ZONES } from "../data/zones";
import { AudioManager, type SoundEventId } from "../engine/audio/AudioManager";
import type { BoxCollider } from "../engine/collision";
import { MeshAuditHelper } from "../engine/debug/MeshAudit";
import { FollowCamera } from "../engine/FollowCamera";
import { VirtualControls } from "../engine/input/VirtualControls";
import { optimizeStaticInstances } from "../engine/perf/StaticInstanceOptimizer";
import { WorldCullingController } from "../engine/perf/WorldCullingController";
import { PlayerController } from "../engine/PlayerController";
import { RemotePlayerAvatar } from "../engine/RemotePlayerAvatar";
import { RendererHost } from "../engine/RendererHost";
import { ParticleManager } from "../engine/vfx/ParticleManager";
import { ZoneVisualController } from "../engine/visuals/ZoneVisualController";
import type { Interactable } from "../engine/world/types";
import { buildBeachHub } from "../engine/world/WorldBuilder";
import { computeZoneBonusFactor } from "../game/logic/fishRoll";
import {
  getOasisChecklist,
  getZoneProgress,
  isOasisUnlocked,
  isVolcanoUnlocked,
} from "../game/logic/progression";
import { getQuestProgress } from "../game/logic/quests";
import { SaveStore } from "../game/state/SaveStore";
import { FishingSystem } from "../game/systems/FishingSystem";
import type { FishingSnapshot, Rarity, SaveData, ZoneId } from "../game/types";
import { MultiplayerClient } from "../net/MultiplayerClient";
import type {
  NetCelebrationRarity,
  NetFishingState,
  RemotePlayerSnapshot,
} from "../net/types";
import { DiagnosticsOverlay } from "../ui/DiagnosticsOverlay";
import { GameUI } from "../ui/GameUI";
import type {
  BaitViewModel,
  BestiaryEntryViewModel,
  FishInventoryItemViewModel,
  GatePanelViewModel,
  QuestViewModel,
  RodViewModel,
  SettingsViewModel,
  UpgradeViewModel,
  ZoneBestiaryViewModel,
} from "../ui/types";

const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  mythic: 4,
};

const PLAYER_CAP = 10;
const LOCAL_SYNC_INTERVAL_SECONDS = 1 / 12;
const POSITION_EPSILON = 0.03;
const YAW_EPSILON = 0.02;
const CHALLENGE_GOAL_RADIUS = 1.7;
const NEAR_FULL_THRESHOLD = 0.85;

interface JoinIntent {
  roomId?: string;
  firestoreGameId?: string;
  inviteCode?: string;
  mode: "join" | "game" | "spectate";
}

interface TransformSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

type ChallengeZone = "beach" | "river" | "cave" | "volcano" | "oasis";
type RelicZone = "beach" | "river" | "cave";
type OasisPlateId = "oasis_plate_a" | "oasis_plate_b" | "oasis_plate_c";

interface TimedChallengeRuntime {
  zone: "beach" | "river" | "volcano";
  timeLeft: number;
  checkpoint: THREE.Vector3;
  goal: THREE.Vector3;
  hazardRects: Rect[];
  resetCooldownSeconds: number;
}

interface AutomationCameraPreset {
  yaw: number;
  pitch: number;
}

type AutomationViewId =
  | "beach_plaza"
  | "beach_reef"
  | "river_bridge"
  | "river_pool";

interface AutomationViewPreset {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

const AUTOMATION_CAMERA_PRESETS: AutomationCameraPreset[] = [
  { yaw: 0.48, pitch: -0.08 },
  { yaw: 0, pitch: 0 },
  { yaw: -0.48, pitch: -0.08 },
];

const AUTOMATION_VIEW_PRESETS: Record<AutomationViewId, AutomationViewPreset> =
  {
    beach_plaza: {
      x: -4.8,
      z: 45.8,
      yaw: 0,
      pitch: -0.1,
    },
    beach_reef: {
      x: 9.1,
      z: 5.2,
      yaw: -0.72,
      pitch: -0.09,
    },
    river_bridge: {
      x: 31.6,
      z: 16.1,
      yaw: -0.2,
      pitch: -0.08,
    },
    river_pool: {
      x: 54.2,
      z: 15.8,
      yaw: -0.95,
      pitch: -0.1,
    },
  };

const ZONE_LABELS: Record<ZoneId, string> = {
  beach: "Beach",
  river: "River",
  cave: "Cave",
  volcano: "Volcano",
  oasis: "Oasis",
};

const ZONE_ROD_PICKUP_MAP = {
  beach_zone_rod_pickup: {
    pickupKey: "beachZoneRod",
    rodId: "beach_zone_luck_rod",
    zone: "beach",
  },
  river_zone_rod_pickup: {
    pickupKey: "riverZoneRod",
    rodId: "river_zone_luck_rod",
    zone: "river",
  },
  cave_zone_rod_pickup: {
    pickupKey: "caveZoneRod",
    rodId: "cave_zone_luck_rod",
    zone: "cave",
  },
  volcano_zone_rod_pickup: {
    pickupKey: "volcanoZoneRod",
    rodId: "volcano_zone_luck_rod",
    zone: "volcano",
  },
  oasis_zone_rod_pickup: {
    pickupKey: "oasisZoneRod",
    rodId: "oasis_zone_luck_rod",
    zone: "oasis",
  },
} as const;

const CHALLENGE_ROD_BY_ZONE: Record<ChallengeZone, string> = {
  beach: "beach_challenge_rod",
  river: "river_challenge_rod",
  cave: "cave_challenge_rod",
  volcano: "volcano_challenge_rod",
  oasis: "oasis_challenge_rod",
};

const NPC_HINTS: Record<string, { title: string; body: string }> = {
  npc_hint_beach: {
    title: "Scout Nori",
    body: "Beach luck rod sits on a stand by the pier fishing ring. Dock posts mark the beach challenge route.",
  },
  npc_hint_river: {
    title: "River Ranger",
    body: "Cross the rope bridge, then follow the high bank trail. The luck rod waits by the waterfall pool, and the challenge route branches below the bridge.",
  },
  npc_hint_cave: {
    title: "Miner Glint",
    body: "The crystal puzzle hides in the eastern chamber. Rotate each pillar until the facet markers align. The luck rod gleams somewhere in the grand cavern.",
  },
};

const RELIC_PICKUP_MAP: Record<string, { relicZone: RelicZone; name: string }> =
  {
    relic_beach_shell_sigill: { relicZone: "beach", name: "Shell Sigill" },
    relic_river_totem_piece: { relicZone: "river", name: "Totem Piece" },
    relic_cave_crystal_key: { relicZone: "cave", name: "Crystal Key" },
  };

const CAVE_PUZZLE_TARGET: Record<string, number> = {
  cave_pillar_a: 1,
  cave_pillar_b: 2,
  cave_pillar_c: 3,
};

const OASIS_PLATE_RECT: Record<OasisPlateId, Rect> = {
  oasis_plate_a: { minX: 151.1, maxX: 152.5, minZ: 86.7, maxZ: 88.1 },
  oasis_plate_b: { minX: 155.1, maxX: 156.5, minZ: 91.5, maxZ: 92.9 },
  oasis_plate_c: { minX: 159.4, maxX: 160.8, minZ: 86, maxZ: 87.4 },
};

export class GameApp {
  private readonly rendererHost: RendererHost;
  private readonly player: PlayerController;
  private readonly followCamera: FollowCamera;
  private readonly controls: VirtualControls;
  private readonly world: ReturnType<typeof buildBeachHub>;

  private readonly saveStore = new SaveStore();
  private readonly ui: GameUI;
  private readonly fishingSystem: FishingSystem;
  private readonly multiplayer: MultiplayerClient;
  private readonly zoneVisuals: ZoneVisualController;
  private readonly audio = new AudioManager();
  private readonly particles: ParticleManager;
  private readonly meshAudit: MeshAuditHelper;
  private readonly worldCulling: WorldCullingController;
  private readonly diagnostics = new DiagnosticsOverlay();
  private qualityPreset: QualityPreset = getQualityPreset("medium");

  private readonly remotePlayers = new Map<string, RemotePlayerAvatar>();
  private currentInteractable: Interactable | null = null;
  private activeFishingSpot: Interactable | null = null;
  private currentZone: ZoneId = "beach";
  private mounted = false;
  private pendingFishingInventoryFull = false;
  private partyGoldMultiplier = 1;
  private onlinePlayerCount = 1;
  private sessionActive = false;
  private joinIntent: JoinIntent | null;
  private syncAccumulator = 0;
  private lastSentTransform: TransformSnapshot | null = null;
  private lastSentFishingState: NetFishingState = "idle";
  private fpsEstimate = 60;
  private diagnosticsAccumulator = 0;
  private audioUnlocked = false;
  private previousVolcanoUnlocked = false;
  private previousOasisUnlocked = false;
  private appliedSettingsSignature = "";
  private cullingDebugEnabled = false;
  private poiMarkersVisible = true;
  private zoneVolumesVisible = false;
  private automationManualStepping = false;
  private automationPerspectiveEnabled = false;
  private automationCameraPresetIndex = 0;
  private readonly automationViewId: AutomationViewId | null;
  private automationViewApplied = false;

  private activeTimedChallenge: TimedChallengeRuntime | null = null;
  private caveChallengeStarted = false;
  private cavePuzzleSolved = false;
  private oasisFinalChallengeActive = false;
  private activatedOasisPlates = new Set<OasisPlateId>();
  private cavePillarTurns: Record<string, number> = {
    cave_pillar_a: 0,
    cave_pillar_b: 0,
    cave_pillar_c: 0,
  };

  constructor(mount: HTMLElement) {
    this.rendererHost = new RendererHost(mount);
    const initialSettings = this.saveStore.getSettings();
    this.qualityPreset = getQualityPreset(initialSettings.graphicsQuality);
    this.rendererHost.applyQuality(this.qualityPreset);

    this.world = buildBeachHub(this.rendererHost.scene);
    const instanceResult = optimizeStaticInstances(this.rendererHost.scene);
    if (instanceResult.replacedMeshes > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[perf] instancing replaced ${instanceResult.replacedMeshes} meshes across ${instanceResult.replacedGroups} groups`,
      );
    }

    this.player = new PlayerController(this.world.spawnPosition);
    this.player.group.visible = false; // First-person: hide local player mesh
    this.rendererHost.scene.add(this.player.group);
    this.worldCulling = new WorldCullingController(this.rendererHost.scene);
    this.zoneVisuals = new ZoneVisualController(this.rendererHost.scene);
    this.particles = new ParticleManager(getQualityPreset("high").particleMax);
    this.rendererHost.scene.add(this.particles.points);
    this.meshAudit = new MeshAuditHelper(this.rendererHost.scene);

    this.followCamera = new FollowCamera(this.rendererHost.camera);
    this.controls = new VirtualControls(
      document.body,
      this.rendererHost.renderer.domElement,
    );

    this.joinIntent = this.parseJoinIntent();
    this.automationViewId = this.parseAutomationView();
    this.multiplayer = new MultiplayerClient(this.resolveServerUrl(), {
      onConnected: (info) => {
        this.setPlayerCount(info.playerCount);
        this.ui.showToast(`Connected to room ${info.roomId}.`);
      },
      onDisconnected: () => {
        this.clearRemotePlayers();
        this.setPlayerCount(1);
        this.lastSentTransform = null;
        this.lastSentFishingState = "idle";
        this.sessionActive = true;
      },
      onPlayerCountChanged: (count) => {
        this.setPlayerCount(count);
      },
      onRemotePlayerUpdate: (snapshot) => {
        this.onRemotePlayerSnapshot(snapshot);
      },
      onRemotePlayerRemoved: (sessionId) => {
        this.removeRemotePlayer(sessionId);
      },
      onCelebration: ({ sessionId, rarity }) => {
        this.handleRemoteCelebration(sessionId, rarity);
      },
    });

    this.ui = new GameUI({
      onPlaySolo: this.handlePlaySolo,
      onPlayOnline: () => {
        void this.handlePlayOnline();
      },
      onInteractPressed: this.handleInteractPressed,
      onOpenBestiary: this.openBestiaryPanel,
      onOpenInventory: this.openInventoryPanel,
      onOpenShops: () => this.openShopPanel("rods"),
      onOpenQuests: this.openQuestsPanel,
      onOpenSettings: this.openSettingsPanel,
      onClosePanel: this.handleClosePanel,
      onCastNow: this.handleCastNow,
      onCancelFishingWait: this.handleCancelWait,
      onGiveUpFishing: this.handleGiveUpFishing,
      onRetryFishing: this.handleRetryFishing,
      onFishAgain: this.handleFishAgain,
      onOpenInventoryFromResult: this.openInventoryPanel,
      onOpenBestiaryFromResult: this.openBestiaryPanel,
      onEquipRod: this.handleEquipRod,
      onEquipBait: this.handleEquipBait,
      onBuyBait: this.handleBuyBait,
      onUpgradeInventory: this.handleUpgradeInventory,
      onSellSelected: this.handleSellSelected,
      onSellAll: this.handleSellAll,
      onCopyInviteLink: this.handleCopyInviteLink,
      onLeaveRoom: () => {
        void this.handleLeaveRoom();
      },
      onTrackQuest: this.handleTrackQuest,
      onClaimQuest: this.handleClaimQuest,
      onClearTrackedQuest: this.handleClearTrackedQuest,
      onResetSave: this.handleResetSave,
      onQuickSell: this.handleQuickSell,
      onUpdateSettings: this.handleUpdateSettings,
    });

    this.fishingSystem = new FishingSystem({
      onStateChanged: this.onFishingStateChanged,
      onBaitConsumeRequested: () => {
        const consumed = this.saveStore.consumeEquippedBait();
        if (consumed) {
          this.playSfx("bite");
          this.spawnBiteVfx();
        }
        this.ui.showToast(
          consumed ? "Bait consumed on bite." : "No bait left.",
        );
        return consumed;
      },
      onCatchResolved: ({ fish, success }) => {
        this.pendingFishingInventoryFull = false;
        if (success && fish) {
          const result = this.saveStore.addCatch(fish);
          this.pendingFishingInventoryFull = result.inventoryFull;
          this.ui.showToast(
            result.inventoryFull
              ? "Inventory full. Fish not stored."
              : `Caught ${fish.name}.`,
          );
          this.playSfx("catch");
          this.particles.spawnCatch(this.player.position.clone(), fish.rarity);
          if (fish.rarity === "epic" || fish.rarity === "mythic") {
            this.playSfx("rarity_stinger");
            this.particles.spawnCelebration(
              this.player.position.clone(),
              fish.rarity,
            );
            this.multiplayer.sendCelebration(
              fish.rarity as NetCelebrationRarity,
            );
          }
        } else {
          this.playSfx("fail");
          this.particles.spawnFail(this.player.position.clone());
        }
      },
    });

    const initialState = this.saveStore.getState();
    this.previousVolcanoUnlocked = isVolcanoUnlocked(initialState);
    this.previousOasisUnlocked = isOasisUnlocked(initialState);
    this.applySettings(initialSettings);
    this.zoneVisuals.setZone(this.currentZone);
    this.setPoiMarkersVisible(this.poiMarkersVisible);
    this.setZoneVolumesVisible(this.zoneVolumesVisible);
    this.worldCulling.update(
      this.player.position,
      this.qualityPreset.worldCullDistance,
    );

    this.saveStore.subscribe((saveData) => {
      this.applySettings(saveData.settings);
      this.refreshHud(saveData);
      this.refreshOpenPanelsIfNeeded();
      this.applyVolcanoGateVisual();
      this.applyOasisGateVisual();
      this.applyCavePuzzleVisual();
      this.applyOasisChallengeVisual();
      this.syncChallengeStateFromSave();
      this.handleGateUnlockTransitions(saveData);
    });

    this.setPlayerCount(1);

    const initialMessage =
      this.joinIntent?.mode === "spectate"
        ? "Spectating is not supported. Use Play Online to join as a player."
        : undefined;
    this.ui.openSessionModeSelect(initialMessage);

    window.addEventListener("keydown", this.onDebugKeyDown);
    window.addEventListener("pointerdown", this.onFirstUserGesture, {
      passive: true,
    });
    window.addEventListener("keydown", this.onFirstUserGesture);
    this.registerAutomationHooks();
  }

  start(): void {
    if (this.mounted) {
      return;
    }
    this.mounted = true;
    this.rendererHost.start((dt) => this.update(dt));
  }

  private update(dtSeconds: number): void {
    const elapsedSeconds = this.rendererHost.getElapsedSeconds();
    this.fishingSystem.update(dtSeconds, this.ui.isMinigameHoldActive());

    for (const movingPlatform of this.world.movingPlatforms) {
      const offset =
        Math.sin(elapsedSeconds * movingPlatform.speed + movingPlatform.phase) *
        movingPlatform.amplitude;
      if (movingPlatform.axis === "x") {
        movingPlatform.mesh.position.x = movingPlatform.base + offset;
      } else {
        movingPlatform.mesh.position.z = movingPlatform.base + offset;
      }
    }

    const controlsEnabled =
      this.sessionActive && !this.ui.isGameplayInputBlocked();
    this.controls.setEnabled(controlsEnabled);

    const lookDelta = this.controls.consumeLookDelta();
    if (controlsEnabled) {
      const movementInput = this.controls.getMovementInput();
      if (this.controls.consumeJump()) {
        this.player.requestJump();
      }
      this.player.update(
        dtSeconds,
        movementInput,
        this.followCamera.getYaw(),
        this.getActiveColliders(),
        this.world.worldBounds,
        this.world.getGroundHeight,
      );
      this.updateCurrentZone();
      this.updateNearestInteractable();
      this.updateTimedChallenge(dtSeconds);
      this.updateOasisFinalChallenge();
      this.syncLocalPlayerIfNeeded(dtSeconds);
    } else {
      this.currentInteractable = null;
      this.ui.setInteractPrompt(null);
    }

    for (const avatar of this.remotePlayers.values()) {
      avatar.update(dtSeconds);
    }

    this.followCamera.update(this.player.position, lookDelta, dtSeconds);
    this.zoneVisuals.update(dtSeconds, elapsedSeconds);
    this.particles.update(dtSeconds);
    this.worldCulling.update(
      this.player.position,
      this.qualityPreset.worldCullDistance,
    );

    const instantFps = 1 / Math.max(0.0001, dtSeconds);
    this.fpsEstimate = THREE.MathUtils.lerp(this.fpsEstimate, instantFps, 0.08);
    this.diagnosticsAccumulator += dtSeconds;
    if (this.diagnosticsAccumulator >= 0.2) {
      this.diagnosticsAccumulator = 0;
      this.diagnostics.update({
        fps: this.fpsEstimate,
        pingMs: null,
        playerCount: this.multiplayer.isConnected()
          ? this.onlinePlayerCount
          : 1,
        drawCalls: this.rendererHost.getDrawCalls(),
        zoneId: this.currentZone,
      });
    }
  }

  private updateCurrentZone(): void {
    const x = this.player.position.x;
    const z = this.player.position.z;
    let nextZone = this.currentZone;
    for (const region of this.world.zoneRegions) {
      if (
        x >= region.minX &&
        x <= region.maxX &&
        z >= region.minZ &&
        z <= region.maxZ
      ) {
        nextZone = region.zoneId;
        break;
      }
    }
    if (nextZone !== this.currentZone) {
      this.currentZone = nextZone;
      this.ui.showZoneHint(ZONE_LABELS[nextZone]);
      this.zoneVisuals.setZone(nextZone);
      if (this.audioUnlocked) {
        this.audio.setZoneAmbience(nextZone);
      }
      this.refreshHud(this.saveStore.getState());
    }
  }

  private updateNearestInteractable(): void {
    let closest: Interactable | null = null;
    let closestDistanceSq = Number.POSITIVE_INFINITY;

    for (const interactable of this.world.interactables) {
      const distanceSq = interactable.position.distanceToSquared(
        this.player.position,
      );
      if (distanceSq > interactable.radius * interactable.radius) {
        continue;
      }
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
        closest = interactable;
      }
    }

    this.currentInteractable = closest;
    this.ui.setInteractPrompt(closest ? closest.label : null);
  }

  private updateTimedChallenge(dtSeconds: number): void {
    if (!this.activeTimedChallenge) {
      return;
    }

    this.activeTimedChallenge.timeLeft -= dtSeconds;
    this.activeTimedChallenge.resetCooldownSeconds = Math.max(
      0,
      this.activeTimedChallenge.resetCooldownSeconds - dtSeconds,
    );
    if (this.activeTimedChallenge.timeLeft <= 0) {
      const zone = this.activeTimedChallenge.zone;
      this.activeTimedChallenge = null;
      this.ui.showToast(`${ZONE_LABELS[zone]} challenge failed. Time expired.`);
      return;
    }

    const pos = this.player.position;
    for (const rect of this.activeTimedChallenge.hazardRects) {
      if (
        pos.x >= rect.minX &&
        pos.x <= rect.maxX &&
        pos.z >= rect.minZ &&
        pos.z <= rect.maxZ
      ) {
        if (this.activeTimedChallenge.resetCooldownSeconds > 0) {
          continue;
        }
        this.player.position.copy(this.activeTimedChallenge.checkpoint);
        this.activeTimedChallenge.resetCooldownSeconds = 0.75;
        this.ui.showToast("Challenge reset to checkpoint.");
        return;
      }
    }

    const distanceToGoal = pos.distanceTo(this.activeTimedChallenge.goal);
    if (distanceToGoal <= CHALLENGE_GOAL_RADIUS) {
      const zone = this.activeTimedChallenge.zone;
      this.activeTimedChallenge = null;
      this.completeChallenge(zone);
    }
  }

  private onFishingStateChanged = (snapshot: FishingSnapshot): void => {
    this.ui.applyFishingState(snapshot);
    this.broadcastFishingState(snapshot.state);

    if (snapshot.state === "ready") {
      this.openFishingReadyPanel(snapshot.failureReason);
    }

    if (
      snapshot.state === "result_success" ||
      snapshot.state === "result_fail"
    ) {
      this.ui.openFishingResult({
        success: snapshot.state === "result_success",
        fishName: snapshot.currentFish?.name ?? null,
        fishRarity: snapshot.currentFish?.rarity ?? null,
        reason: snapshot.failureReason,
        inventoryFull: this.pendingFishingInventoryFull,
      });
    }
  };

  private openFishingReadyPanel(failureHint: string | null): void {
    const rod = this.saveStore.getEquippedRod();
    const bait = this.saveStore.getEquippedBait();
    const baitQuantity = this.saveStore.getBaitQuantity(bait.id);
    const zoneBonusFactor = computeZoneBonusFactor(
      rod,
      this.activeFishingSpot?.zoneId ?? this.currentZone,
    );
    const zoneBonusPercent = Math.max(
      0,
      Math.round((zoneBonusFactor - 1) * 100),
    );
    this.ui.openFishingReady({
      spotName: this.activeFishingSpot?.title ?? "Fishing Spot",
      rodName: rod.name,
      rodLuck: rod.luck,
      rodSturdiness: rod.sturdiness,
      baitName: bait.name,
      baitQuantity,
      zoneBonusPercent,
      zoneBonusActive: zoneBonusFactor > 1,
      failureHint,
    });
  }

  private handlePlaySolo = (): void => {
    this.playSfx("ui_click");
    this.sessionActive = true;
    this.ui.closePanel();
    this.setPlayerCount(1);
    void this.multiplayer.leave();
    this.clearRemotePlayers();
    this.ui.showToast("Playing solo.");
  };

  private async handlePlayOnline(): Promise<void> {
    this.playSfx("ui_click");
    const intent = this.joinIntent ?? { mode: "join" as const };
    const roomId = intent.roomId;
    const firestoreGameId = intent.firestoreGameId ?? intent.inviteCode;
    const inviteCode = intent.inviteCode;

    try {
      if (intent.mode === "spectate") {
        try {
          await this.multiplayer.connect({
            roomId,
            firestoreGameId,
            inviteCode,
            mode: "spectate",
          });
        } catch {
          this.ui.showToast("Spectating not supported. Joining as player.");
          await this.multiplayer.connect({
            roomId,
            firestoreGameId,
            inviteCode,
            mode: "join",
          });
        }
      } else {
        await this.multiplayer.connect({
          roomId,
          firestoreGameId,
          inviteCode,
          mode: intent.mode,
        });
      }

      this.sessionActive = true;
      this.ui.closePanel();
      this.refreshHud(this.saveStore.getState());
    } catch (error) {
      const message = this.readableJoinError(
        error instanceof Error ? error.message : "Join failed.",
      );
      this.sessionActive = true;
      this.setPlayerCount(1);
      this.clearRemotePlayers();
      this.ui.closePanel();
      this.ui.showToast(`Online unavailable: ${message} Solo mode active.`);
    }
  }

  private handleInteractPressed = (): void => {
    if (!this.currentInteractable) {
      return;
    }

    const interactable = this.currentInteractable;
    switch (interactable.type) {
      case "fishing_spot":
        this.activeFishingSpot = interactable;
        this.fishingSystem.openReady();
        this.openFishingReadyPanel(null);
        break;
      case "sell_stand":
        this.openSellStandPanel();
        break;
      case "rod_shop":
        this.openShopPanel("rods");
        break;
      case "bait_shop":
        this.openShopPanel("bait");
        break;
      case "gate":
        this.openGateInfo(interactable.id);
        break;
      case "quest_board":
        this.openQuestsPanel();
        break;
      case "npc_hint":
        this.openNpcHint(interactable.id);
        break;
      case "zone_rod_pickup":
        this.tryCollectZoneRod(interactable.id);
        break;
      case "challenge_start":
        this.startChallenge(interactable.id);
        break;
      case "puzzle_pillar":
        this.rotateCavePillar(interactable.id);
        break;
      case "relic_pickup":
        this.tryCollectRelic(interactable.id);
        break;
      default:
        break;
    }
  };

  private handleClosePanel = (): void => {
    this.ui.closePanel();
    this.fishingSystem.closeToIdle();
  };

  private handleCastNow = (): void => {
    const rod = this.saveStore.getEquippedRod();
    const bait = this.saveStore.getEquippedBait();
    const baitQuantity = this.saveStore.getBaitQuantity(bait.id);
    const zoneId = this.activeFishingSpot?.zoneId ?? this.currentZone;
    const fishPool = FISH_BY_ZONE[zoneId];
    const started = this.fishingSystem.startCast(
      rod,
      bait,
      fishPool,
      baitQuantity,
      zoneId,
    );
    if (started) {
      this.playSfx("cast");
      this.ui.showToast("Cast launched.");
    }
  };

  private handleCancelWait = (): void => {
    this.fishingSystem.cancelWaiting();
    this.openFishingReadyPanel(null);
  };

  private handleGiveUpFishing = (): void => {
    this.fishingSystem.giveUpMinigame();
  };

  private handleRetryFishing = (): void => {
    this.fishingSystem.retry();
    this.openFishingReadyPanel(null);
  };

  private handleFishAgain = (): void => {
    const inventoryFull =
      this.saveStore.getInventoryCount() >=
      this.saveStore.getInventoryCapacity();
    if (inventoryFull) {
      this.ui.showToast("Inventory full. Sell fish before casting again.");
      this.openSellStandPanel();
      return;
    }
    this.fishingSystem.retry();
    this.openFishingReadyPanel(null);
  };

  private openNpcHint(interactableId: string): void {
    const hint = NPC_HINTS[interactableId];
    if (!hint) {
      return;
    }
    this.ui.openHintDialog(hint.title, hint.body);
  }

  private openGateInfo(interactableId: string): void {
    if (interactableId === "oasis_gate") {
      const checklist = this.saveStore.getOasisChecklist();
      const view: GatePanelViewModel = {
        title: "Oasis Gate",
        description: "Catch 9 unique fish in Beach, River, Cave, and Volcano.",
        unlocked: checklist.unlocked,
        requirements: [
          {
            label: "Beach",
            current: checklist.beachUnique,
            required: checklist.required,
            met: checklist.beachUnique >= checklist.required,
          },
          {
            label: "River",
            current: checklist.riverUnique,
            required: checklist.required,
            met: checklist.riverUnique >= checklist.required,
          },
          {
            label: "Cave",
            current: checklist.caveUnique,
            required: checklist.required,
            met: checklist.caveUnique >= checklist.required,
          },
          {
            label: "Volcano",
            current: checklist.volcanoUnique,
            required: checklist.required,
            met: checklist.volcanoUnique >= checklist.required,
          },
        ],
        footer: checklist.unlocked
          ? "Gate open. Find 3 relics for the final rod."
          : undefined,
      };
      this.ui.openGatePanel(view);
      return;
    }

    const checklist = this.saveStore.getVolcanoChecklist();
    const view: GatePanelViewModel = {
      title: "Volcano Gate",
      description: "Catch 9 unique fish in Beach and River.",
      unlocked: checklist.unlocked,
      requirements: [
        {
          label: "Beach",
          current: checklist.beachUnique,
          required: checklist.required,
          met: checklist.beachUnique >= checklist.required,
        },
        {
          label: "River",
          current: checklist.riverUnique,
          required: checklist.required,
          met: checklist.riverUnique >= checklist.required,
        },
      ],
    };
    this.ui.openGatePanel(view);
  }

  private tryCollectRelic(interactableId: string): void {
    const relic = RELIC_PICKUP_MAP[interactableId];
    if (!relic) {
      return;
    }
    const result = this.saveStore.collectOasisRelic(relic.relicZone);
    if (result === "already_collected") {
      this.ui.showToast("Relic already collected.");
      return;
    }
    this.playSfx("pickup");
    this.ui.showToast(`Relic found: ${relic.name}.`);
    if (this.saveStore.areAllOasisRelicsCollected()) {
      this.ui.showToast(
        "All relics collected. Final Oasis challenge is ready.",
      );
    }
  }

  private tryCollectZoneRod(interactableId: string): void {
    const config =
      ZONE_ROD_PICKUP_MAP[interactableId as keyof typeof ZONE_ROD_PICKUP_MAP];
    if (!config) {
      return;
    }
    const result = this.saveStore.collectZoneRodPickup(
      config.pickupKey,
      config.rodId,
    );
    if (result === "granted") {
      this.playSfx("pickup");
      const rod = getRodById(config.rodId);
      this.ui.showToast(`New Rod Unlocked: ${this.getRodName(config.rodId)}.`);
      if (rod) {
        this.ui.openRodUnlock({
          rodId: rod.id,
          rodName: rod.name,
          luck: rod.luck,
          sturdiness: rod.sturdiness,
          zoneBonusText: rod.zonePassive
            ? `Zone passive: +${Math.round((rod.zonePassive.zoneLuckBonusMult - 1) * 100)}% luck in ${rod.zonePassive.zoneId}.`
            : null,
          sourceText: `${ZONE_LABELS[config.zone]} pickup`,
        });
      } else {
        this.openInventoryPanel();
      }
    } else if (result === "already_collected") {
      this.ui.showToast("Already collected.");
    } else {
      this.ui.showToast("Unable to claim rod.");
    }
  }

  private startChallenge(interactableId: string): void {
    if (interactableId === "beach_challenge_start") {
      if (this.saveStore.isChallengeCompleted("beach")) {
        this.ui.showToast("Beach challenge already completed.");
        return;
      }
      this.activeTimedChallenge = {
        zone: "beach",
        timeLeft: 45,
        checkpoint: new THREE.Vector3(-1.8, 0, 26.7),
        goal: new THREE.Vector3(8.1, 0, 27.3),
        hazardRects: [
          { minX: -6.2, maxX: -2.2, minZ: 24.8, maxZ: 29.8 },
          { minX: 8.9, maxX: 12.8, minZ: 24.8, maxZ: 30 },
        ],
        resetCooldownSeconds: 0,
      };
      this.player.position.copy(this.activeTimedChallenge.checkpoint);
      this.ui.showToast("Beach challenge started. Reach the chest.");
      return;
    }

    if (interactableId === "river_challenge_start") {
      if (this.saveStore.isChallengeCompleted("river")) {
        this.ui.showToast("River challenge already completed.");
        return;
      }
      this.activeTimedChallenge = {
        zone: "river",
        timeLeft: 55,
        checkpoint: new THREE.Vector3(39.8, 0, -2.3),
        goal: new THREE.Vector3(61.8, 0, -2.3),
        hazardRects: [
          { minX: 40, maxX: 62.6, minZ: -6.7, maxZ: -3.9 },
          { minX: 40, maxX: 62.6, minZ: -0.7, maxZ: 1.5 },
        ],
        resetCooldownSeconds: 0,
      };
      this.player.position.copy(this.activeTimedChallenge.checkpoint);
      this.ui.showToast("River challenge started. Cross the logs.");
      return;
    }

    if (interactableId === "cave_challenge_start") {
      if (this.saveStore.isChallengeCompleted("cave")) {
        this.ui.showToast("Cave challenge already completed.");
        return;
      }
      this.caveChallengeStarted = true;
      this.ui.showToast("Rotate all crystals to align the beam.");
      return;
    }

    if (interactableId === "volcano_challenge_start") {
      if (this.saveStore.isChallengeCompleted("volcano")) {
        this.ui.showToast("Volcano challenge already completed.");
        return;
      }
      this.activeTimedChallenge = {
        zone: "volcano",
        timeLeft: 65,
        checkpoint: new THREE.Vector3(35.8, 0, 88.9),
        goal: new THREE.Vector3(61.2, 0, 94.5),
        hazardRects: [{ minX: 37, maxX: 62.8, minZ: 90.2, maxZ: 98.8 }],
        resetCooldownSeconds: 0,
      };
      this.player.position.copy(this.activeTimedChallenge.checkpoint);
      this.ui.showToast(
        "Volcano challenge started. Cross vents and moving platforms.",
      );
      return;
    }

    if (interactableId === "oasis_challenge_start") {
      if (!this.saveStore.areAllOasisRelicsCollected()) {
        this.ui.showToast("Find 3 relics first: Beach, River, and Cave.");
        return;
      }
      if (this.saveStore.isChallengeCompleted("oasis")) {
        this.ui.showToast("Oasis challenge already completed.");
        return;
      }
      this.oasisFinalChallengeActive = true;
      this.activatedOasisPlates.clear();
      this.applyOasisChallengeVisual();
      this.ui.showToast(
        "Final challenge started. Activate all 3 pressure plates.",
      );
    }
  }

  private rotateCavePillar(interactableId: string): void {
    if (
      !this.caveChallengeStarted ||
      this.saveStore.isChallengeCompleted("cave")
    ) {
      this.ui.showToast("Start the cave challenge first.");
      return;
    }
    const pillar = this.world.puzzlePillars[interactableId];
    if (!pillar) {
      return;
    }
    this.cavePillarTurns[interactableId] =
      ((this.cavePillarTurns[interactableId] ?? 0) + 1) % 4;
    pillar.rotation.y = this.cavePillarTurns[interactableId] * (Math.PI / 2);
    this.ui.showToast(
      `${interactableId.replace("cave_pillar_", "Pillar ")} rotated.`,
    );

    const solved = Object.entries(CAVE_PUZZLE_TARGET).every(
      ([id, target]) => this.cavePillarTurns[id] === target,
    );
    if (solved) {
      this.completeChallenge("cave");
    }
  }

  private completeChallenge(zone: ChallengeZone): void {
    const newlyCompleted = this.saveStore.setChallengeCompleted(zone);
    this.caveChallengeStarted = false;
    if (zone === "oasis") {
      this.oasisFinalChallengeActive = false;
    }
    if (!newlyCompleted) {
      this.ui.showToast(`${ZONE_LABELS[zone]} challenge already completed.`);
      return;
    }

    const rewardRodId = CHALLENGE_ROD_BY_ZONE[zone];
    this.saveStore.unlockRod(rewardRodId);
    this.playSfx("pickup");
    const rewardRod = getRodById(rewardRodId);
    this.ui.showToast(
      `${ZONE_LABELS[zone]} challenge complete. Rod unlocked: ${this.getRodName(rewardRodId)}.`,
    );
    if (rewardRod) {
      this.ui.openRodUnlock({
        rodId: rewardRod.id,
        rodName: rewardRod.name,
        luck: rewardRod.luck,
        sturdiness: rewardRod.sturdiness,
        zoneBonusText: rewardRod.zonePassive
          ? `Zone passive: +${Math.round((rewardRod.zonePassive.zoneLuckBonusMult - 1) * 100)}% luck in ${rewardRod.zonePassive.zoneId}.`
          : null,
        sourceText: `${ZONE_LABELS[zone]} challenge reward`,
      });
    }

    if (zone === "cave") {
      this.cavePuzzleSolved = true;
      this.applyCavePuzzleVisual();
    }
    if (zone === "oasis") {
      this.applyOasisChallengeVisual();
    }
  }

  private openInventoryPanel = (): void => {
    this.ui.openInventory({
      fishItems: this.getFishInventoryViewModel(),
      rods: this.getRodsViewModel(),
      baits: this.getBaitsViewModel(),
      upgrades: this.getUpgradesViewModel(),
      inventoryCount: this.saveStore.getInventoryCount(),
      inventoryCapacity: this.saveStore.getInventoryCapacity(),
    });
  };

  private openBestiaryPanel = (): void => {
    const state = this.saveStore.getState();
    const zones: ZoneBestiaryViewModel[] = PLAYABLE_PHASE4_ZONES.map(
      (zoneId) => {
        const fishList = FISH_BY_ZONE[zoneId];
        const entries: BestiaryEntryViewModel[] = fishList.map((fish) => {
          const entry = state.bestiary[fish.id] ?? {
            discovered: false,
            caughtCount: 0,
          };
          return {
            fishId: fish.id,
            name: fish.name,
            rarity: fish.rarity,
            discovered: entry.discovered,
            caughtCount: entry.caughtCount,
          };
        });

        const progress = getZoneProgress(state, zoneId);
        return {
          zoneId,
          zoneName: ZONE_LABELS[zoneId],
          entries,
          discoveredUnique: progress.discoveredUnique,
          total: progress.total,
          percent: progress.percent,
        };
      },
    );

    const initialZone: ZoneId = PLAYABLE_PHASE4_ZONES.includes(this.currentZone)
      ? this.currentZone
      : "beach";
    this.ui.openBestiary(
      zones,
      this.saveStore.getVolcanoChecklist(),
      this.saveStore.getOasisChecklist(),
      this.saveStore.getState().oasisRelics,
      initialZone,
    );
  };

  private openQuestsPanel = (): void => {
    this.ui.openQuests(this.getQuestViewModels());
  };

  private openShopPanel = (initialTab: "rods" | "bait"): void => {
    this.ui.openShops(
      {
        rods: this.getRodsViewModel(),
        baits: this.getBaitsViewModel(),
        gold: this.saveStore.getState().gold,
      },
      initialTab,
    );
  };

  private openSellStandPanel = (): void => {
    this.ui.openSellStand({
      fishItems: this.getFishInventoryViewModel(),
      inventoryCount: this.saveStore.getInventoryCount(),
      inventoryCapacity: this.saveStore.getInventoryCapacity(),
    });
  };

  private openSettingsPanel = (): void => {
    this.playSfx("ui_click");
    this.ui.openSettings(this.getSettingsViewModel());
  };

  private handleEquipRod = (rodId: string): void => {
    const ok = this.saveStore.equipRod(rodId);
    if (ok) {
      this.playSfx("ui_click");
    }
    this.ui.showToast(ok ? "Rod equipped." : "Rod is locked.");
  };

  private handleEquipBait = (baitId: string): void => {
    const ok = this.saveStore.equipBait(baitId);
    if (ok) {
      this.playSfx("ui_click");
    }
    this.ui.showToast(ok ? "Bait equipped." : "Cannot equip bait.");
  };

  private handleBuyBait = (baitId: string, quantity: number): void => {
    if (!this.isBaitAvailableForPurchase(baitId)) {
      this.ui.showToast("This bait is locked.");
      return;
    }
    const result = this.saveStore.buyBait(baitId, quantity);
    if (result.ok) {
      this.playSfx("purchase");
    }
    this.ui.showToast(
      result.ok ? `Bought ${quantity} bait.` : "Not enough gold.",
    );
  };

  private handleUpgradeInventory = (): void => {
    const result = this.saveStore.purchaseNextInventoryUpgrade();
    if (result.ok) {
      this.playSfx("purchase");
      const newCapacity = INVENTORY_CAPACITY_BY_LEVEL[result.newLevel] ?? 0;
      this.ui.showToast(`Inventory upgraded to ${newCapacity}.`);
    } else {
      this.ui.showToast("Upgrade not available.");
    }
  };

  private handleSellSelected = (fishIds: string[]): void => {
    if (fishIds.length > 0 && this.containsRareOrHigherFishIds(fishIds)) {
      const confirmed = window.confirm(
        "Sell selected fish including Rare+ catches?",
      );
      if (!confirmed) {
        return;
      }
    }
    const result = this.saveStore.sellFish(fishIds, this.partyGoldMultiplier);
    if (result.soldCount <= 0) {
      this.ui.showToast("No fish selected.");
      return;
    }
    const bonusText =
      result.multiplierApplied > 1
        ? ` (+${Math.round((result.multiplierApplied - 1) * 100)}% party)`
        : "";
    this.playSfx("sell");
    this.ui.showToast(
      `Sold ${result.soldCount} fish for ${toGold(result.earnedGold)}${bonusText}.`,
    );
    this.openSellStandPanel();
  };

  private handleSellAll = (): void => {
    if (this.containsRareOrHigherInventory()) {
      const confirmed = window.confirm(
        "Sell all includes Rare+ fish. Continue?",
      );
      if (!confirmed) {
        return;
      }
    }
    const result = this.saveStore.sellAllFish(this.partyGoldMultiplier);
    if (result.soldCount <= 0) {
      this.ui.showToast("No fish to sell.");
      return;
    }
    const bonusText =
      result.multiplierApplied > 1
        ? ` (+${Math.round((result.multiplierApplied - 1) * 100)}% party)`
        : "";
    this.playSfx("sell");
    this.ui.showToast(
      `Sold all (${result.soldCount}) for ${toGold(result.earnedGold)}${bonusText}.`,
    );
    this.openSellStandPanel();
  };

  private handleQuickSell = (
    mode: "commons" | "commons_uncommons" | "keep_rares",
  ): void => {
    const fishIds = this.getQuickSellFishIds(mode);
    if (fishIds.length === 0) {
      this.ui.showToast("No fish match this quick sell filter.");
      return;
    }
    const result = this.saveStore.sellFish(fishIds, this.partyGoldMultiplier);
    if (result.soldCount <= 0) {
      this.ui.showToast("No fish sold.");
      return;
    }
    const bonusText =
      result.multiplierApplied > 1
        ? ` (+${Math.round((result.multiplierApplied - 1) * 100)}% party)`
        : "";
    this.playSfx("sell");
    this.ui.showToast(
      `Quick sold ${result.soldCount} fish for ${toGold(result.earnedGold)}${bonusText}.`,
    );
    this.openSellStandPanel();
  };

  private handleUpdateSettings = (settings: SettingsViewModel): void => {
    this.saveStore.updateSettings(settings);
  };

  private handleTrackQuest = (questId: string): void => {
    if (this.saveStore.isQuestCompleted(questId)) {
      this.ui.showToast("Quest already completed.");
      return;
    }
    this.saveStore.setActiveQuest(questId);
    this.ui.showToast("Quest tracked.");
    this.openQuestsPanel();
  };

  private handleClaimQuest = (questId: string): void => {
    const quest = getQuestById(questId);
    if (!quest) {
      return;
    }
    if (this.saveStore.isQuestCompleted(questId)) {
      this.ui.showToast("Quest already claimed.");
      return;
    }
    const progress = getQuestProgress(quest, this.saveStore.getState());
    if (!progress.completed) {
      this.ui.showToast("Quest requirements not met yet.");
      return;
    }

    this.saveStore.completeQuest(questId);
    if (quest.reward.goldAmount) {
      this.saveStore.addGold(quest.reward.goldAmount);
    }
    if (quest.reward.baitPack) {
      this.saveStore.addBait(
        quest.reward.baitPack.baitType,
        quest.reward.baitPack.quantity,
      );
    }
    this.playSfx("purchase");
    this.ui.showToast(`Quest complete: ${quest.title}`);
    this.openQuestsPanel();
  };

  private handleClearTrackedQuest = (): void => {
    this.saveStore.clearActiveQuest();
    this.ui.showToast("Quest untracked.");
    this.openQuestsPanel();
  };

  private handleCopyInviteLink = (): void => {
    const info = this.multiplayer.getConnectionInfo();
    if (!info?.roomId) {
      this.ui.showToast("No active room.");
      return;
    }

    const handledByNative = this.postNativeMessage("copy_invite_link", {
      roomId: info.roomId,
    });
    if (handledByNative) {
      this.ui.showToast("Invite details sent to app.");
      return;
    }

    const invite = `${window.location.origin}?roomId=${encodeURIComponent(info.roomId)}&mode=join`;
    this.playSfx("ui_click");
    navigator.clipboard
      .writeText(invite)
      .then(() => this.ui.showToast("Invite link copied."))
      .catch(() => this.ui.showToast("Unable to copy invite link."));
  };

  private async handleLeaveRoom(): Promise<void> {
    await this.multiplayer.leave();
    this.clearRemotePlayers();
    this.setPlayerCount(1);
    this.sessionActive = true;
    this.playSfx("ui_click");
    this.ui.showToast("Left room. Solo mode active.");
  }

  private handleResetSave = (): void => {
    const confirmed = window.confirm(
      "Reset local save data? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }
    this.saveStore.replaceFromReset();
    this.fishingSystem.closeToIdle();
    this.activeTimedChallenge = null;
    this.caveChallengeStarted = false;
    this.cavePuzzleSolved = false;
    this.oasisFinalChallengeActive = false;
    this.activatedOasisPlates.clear();
    this.cavePillarTurns = {
      cave_pillar_a: 0,
      cave_pillar_b: 0,
      cave_pillar_c: 0,
    };
    this.resetPuzzleMeshRotations();
    this.ui.closePanel();
    this.applyVolcanoGateVisual();
    this.applyOasisGateVisual();
    this.applyCavePuzzleVisual();
    this.applyOasisChallengeVisual();
    this.ui.showToast("Save reset.");
  };

  private refreshHud(saveData: SaveData): void {
    const rod = this.saveStore.getEquippedRod();
    const bait = this.saveStore.getEquippedBait();
    const zoneBonusFactor = computeZoneBonusFactor(rod, this.currentZone);
    this.ui.setHud({
      gold: saveData.gold,
      inventoryCount: this.saveStore.getInventoryCount(),
      inventoryCapacity: this.saveStore.getInventoryCapacity(),
      equippedRodName: rod.name,
      equippedRodLuck: rod.luck,
      equippedRodSturdiness: rod.sturdiness,
      equippedBaitName: bait.name,
      equippedBaitQuantity: this.saveStore.getBaitQuantity(bait.id),
      partyBonusPercent: Math.round((this.partyGoldMultiplier - 1) * 100),
      zoneBonusActive: zoneBonusFactor > 1,
      zoneBonusPercent: Math.max(0, Math.round((zoneBonusFactor - 1) * 100)),
    });

    const inventoryCount = this.saveStore.getInventoryCount();
    const inventoryCapacity = this.saveStore.getInventoryCapacity();
    const fillRatio =
      inventoryCapacity > 0 ? inventoryCount / inventoryCapacity : 0;
    if (inventoryCount >= inventoryCapacity) {
      this.ui.setInventoryHint("Inventory full. Visit a sell stand.");
    } else if (fillRatio >= NEAR_FULL_THRESHOLD) {
      this.ui.setInventoryHint("Inventory nearly full. Sell soon.");
    } else {
      this.ui.setInventoryHint(null);
    }

    const info = this.multiplayer.getConnectionInfo();
    this.ui.setOnlineStatus({
      connected: this.multiplayer.isConnected(),
      roomId: info?.roomId ?? null,
      playerCount: this.multiplayer.isConnected() ? this.onlinePlayerCount : 1,
      playerCap: PLAYER_CAP,
      partyBonusPercent: Math.round((this.partyGoldMultiplier - 1) * 100),
    });
  }

  private refreshOpenPanelsIfNeeded(): void {
    if (!this.ui.isGameplayInputBlocked()) {
      return;
    }
    const fishingState = this.fishingSystem.getSnapshot().state;
    if (fishingState === "ready") {
      this.openFishingReadyPanel(null);
    }
  }

  private getFishInventoryViewModel(): FishInventoryItemViewModel[] {
    const state = this.saveStore.getState();
    const fishItems: FishInventoryItemViewModel[] = [];
    for (const [fishId, count] of Object.entries(state.fishInventory)) {
      const fish = ALL_FISH_BY_ID[fishId];
      if (!fish || count <= 0) {
        continue;
      }
      fishItems.push({
        fishId,
        name: fish.name,
        zoneId: fish.zone,
        rarity: fish.rarity,
        count,
        sellPrice: fish.sellPrice,
        lastCaughtAt: state.bestiary[fishId]?.lastCaughtAt ?? 0,
      });
    }

    fishItems.sort((a, b) => {
      const rarityDiff = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      if (rarityDiff !== 0) {
        return rarityDiff;
      }
      return a.name.localeCompare(b.name);
    });
    return fishItems;
  }

  private getRodsViewModel(): RodViewModel[] {
    const state = this.saveStore.getState();
    return ROD_DEFINITIONS.map((rod) => {
      const zoneBonusFactor = computeZoneBonusFactor(rod, this.currentZone);
      return {
        id: rod.id,
        name: rod.name,
        luck: rod.luck,
        sturdiness: rod.sturdiness,
        price: rod.price,
        source: rod.source,
        owned: state.ownedRods.includes(rod.id),
        phaseLocked: Boolean(rod.phaseLocked),
        zoneBonusPercent: rod.zonePassive
          ? Math.max(
              0,
              Math.round((rod.zonePassive.zoneLuckBonusMult - 1) * 100),
            )
          : 0,
        zoneBonusZoneId: rod.zonePassive?.zoneId ?? null,
        zoneBonusActive: rod.id === state.equippedRodId && zoneBonusFactor > 1,
      };
    });
  }

  private getBaitsViewModel(): BaitViewModel[] {
    return BAIT_DEFINITIONS.map((bait) => {
      const purchasableNow = this.isBaitAvailableForPurchase(bait.id);
      return {
        id: bait.id,
        name: bait.name,
        luckMultiplier: bait.luckMultiplier,
        price: bait.price,
        quantity: this.saveStore.getBaitQuantity(bait.id),
        purchasable: purchasableNow,
        phaseLocked: !purchasableNow,
      };
    });
  }

  private getUpgradesViewModel(): UpgradeViewModel[] {
    const level = this.saveStore.getState().inventoryCapacityLevel;
    return INVENTORY_CAPACITY_BY_LEVEL.slice(1).map((capacity, index) => {
      const targetLevel = index + 1;
      const status: UpgradeViewModel["status"] =
        targetLevel <= level
          ? "owned"
          : targetLevel === level + 1
            ? "available"
            : "locked";
      return {
        level: targetLevel,
        capacity,
        cost: INVENTORY_UPGRADE_COST_BY_LEVEL[index] ?? 0,
        status,
      };
    });
  }

  private getQuestViewModels(): QuestViewModel[] {
    const save = this.saveStore.getState();
    const activeId = save.quests.activeQuestId;

    return QUEST_DEFINITIONS.map((quest) => {
      const progress = getQuestProgress(quest, save);
      const completed = save.quests.completedQuestIds.includes(quest.id);

      let status: QuestViewModel["status"] = "available";
      if (completed) {
        status = "completed";
      } else if (progress.completed) {
        status = "claimable";
      } else if (activeId === quest.id) {
        status = "active";
      }

      const rewardParts: string[] = [];
      if (quest.reward.goldAmount) {
        rewardParts.push(`${quest.reward.goldAmount}g`);
      }
      if (quest.reward.baitPack) {
        rewardParts.push(
          `${quest.reward.baitPack.quantity} ${quest.reward.baitPack.baitType} bait`,
        );
      }

      return {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        hint: quest.hint,
        progressText: `${progress.current}/${progress.target}`,
        status,
        rewardText: rewardParts.join(" + ") || "-",
      };
    });
  }

  private getSettingsViewModel(): SettingsViewModel {
    const settings = this.saveStore.getSettings();
    return {
      masterVolume: settings.masterVolume,
      sfxVolume: settings.sfxVolume,
      musicVolume: settings.musicVolume,
      muted: settings.muted,
      graphicsQuality: settings.graphicsQuality,
      showDiagnostics: settings.showDiagnostics,
      meshAuditEnabled: settings.meshAuditEnabled,
      decayGraceEnabled: settings.decayGraceEnabled,
    };
  }

  private isBaitAvailableForPurchase(baitId: string): boolean {
    const state = this.saveStore.getState();
    if (
      baitId === "normal" ||
      baitId === "quality" ||
      baitId === "beach" ||
      baitId === "river" ||
      baitId === "cave"
    ) {
      return true;
    }
    if (baitId === "volcano") {
      return isVolcanoUnlocked(state);
    }
    if (baitId === "oasis") {
      return isOasisUnlocked(state);
    }
    return false;
  }

  private syncLocalPlayerIfNeeded(dtSeconds: number): void {
    if (!this.multiplayer.isConnected()) {
      return;
    }
    this.syncAccumulator += dtSeconds;
    if (this.syncAccumulator < LOCAL_SYNC_INTERVAL_SECONDS) {
      return;
    }
    this.syncAccumulator = 0;

    const current: TransformSnapshot = {
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
      yaw: this.player.group.rotation.y,
    };

    if (this.lastSentTransform) {
      const dx = current.x - this.lastSentTransform.x;
      const dy = current.y - this.lastSentTransform.y;
      const dz = current.z - this.lastSentTransform.z;
      const distance = Math.hypot(dx, dy, dz);
      const yawDiff = Math.abs(current.yaw - this.lastSentTransform.yaw);
      if (distance < POSITION_EPSILON && yawDiff < YAW_EPSILON) {
        return;
      }
    }

    this.lastSentTransform = current;
    const animState =
      this.player.getHorizontalSpeed() > 0.2 ? "moving" : "idle";
    this.multiplayer.sendTransform({ ...current, animState });
  }

  private broadcastFishingState(state: FishingSnapshot["state"]): void {
    const netState = toNetFishingState(state);
    if (netState === this.lastSentFishingState) {
      return;
    }
    this.lastSentFishingState = netState;
    this.multiplayer.sendFishingState(netState);
  }

  private onRemotePlayerSnapshot(snapshot: RemotePlayerSnapshot): void {
    const localSessionId = this.multiplayer.getConnectionInfo()?.sessionId;
    if (snapshot.sessionId === localSessionId) {
      return;
    }

    let avatar = this.remotePlayers.get(snapshot.sessionId);
    if (!avatar) {
      avatar = new RemotePlayerAvatar(
        new THREE.Vector3(snapshot.x, snapshot.y, snapshot.z),
      );
      this.remotePlayers.set(snapshot.sessionId, avatar);
      this.rendererHost.scene.add(avatar.group);
    }
    avatar.setTarget(snapshot.x, snapshot.y, snapshot.z, snapshot.yaw);
    avatar.setFishingState(snapshot.fishingState);
  }

  private removeRemotePlayer(sessionId: string): void {
    const avatar = this.remotePlayers.get(sessionId);
    if (!avatar) {
      return;
    }
    avatar.dispose();
    this.rendererHost.scene.remove(avatar.group);
    this.remotePlayers.delete(sessionId);
  }

  private clearRemotePlayers(): void {
    for (const [sessionId] of this.remotePlayers) {
      this.removeRemotePlayer(sessionId);
    }
  }

  private setPlayerCount(count: number): void {
    const clamped = Math.max(1, Math.min(PLAYER_CAP, count));
    this.onlinePlayerCount = clamped;
    this.partyGoldMultiplier = this.multiplayer.isConnected()
      ? 1 + 0.05 * (clamped - 1)
      : 1;
    this.refreshHud(this.saveStore.getState());
    this.postNativeMessage("online_status", {
      roomId: this.multiplayer.getConnectionInfo()?.roomId ?? null,
      playerCount: this.multiplayer.isConnected() ? clamped : 1,
    });
  }

  private postNativeMessage(
    type: string,
    payload: Record<string, unknown>,
  ): boolean {
    const bridge = window.ReactNativeWebView;
    if (!bridge || typeof bridge.postMessage !== "function") {
      return false;
    }
    try {
      bridge.postMessage(
        JSON.stringify({
          source: "tropical_fishing",
          type,
          ...payload,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private applyVolcanoGateVisual(): void {
    const unlocked = isVolcanoUnlocked(this.saveStore.getState());
    const doorMaterial = this.world.volcanoGateDoor
      .material as THREE.MeshStandardMaterial;
    const signMaterial = this.world.volcanoGateSign
      .material as THREE.MeshStandardMaterial;

    this.world.volcanoGateDoor.position.y = unlocked ? 6.1 : 2.1;
    doorMaterial.color.set(unlocked ? "#166534" : "#7f1d1d");
    signMaterial.color.set(unlocked ? "#86efac" : "#fca5a5");
    doorMaterial.needsUpdate = true;
    signMaterial.needsUpdate = true;
  }

  private applyOasisGateVisual(): void {
    const save = this.saveStore.getState();
    const checklist = getOasisChecklist(save);
    const unlocked = checklist.unlocked;
    const doorMaterial = this.world.oasisGateDoor
      .material as THREE.MeshStandardMaterial;
    this.world.oasisGateDoor.position.y = unlocked ? 6.4 : 2.2;
    doorMaterial.color.set(unlocked ? "#166534" : "#7f1d1d");
    doorMaterial.needsUpdate = true;

    const emblemStates: Record<
      "beach" | "river" | "cave" | "volcano",
      boolean
    > = {
      beach: checklist.beachUnique >= checklist.required,
      river: checklist.riverUnique >= checklist.required,
      cave: checklist.caveUnique >= checklist.required,
      volcano: checklist.volcanoUnique >= checklist.required,
    };

    for (const [zoneKey, mesh] of Object.entries(
      this.world.oasisGateEmblems,
    ) as Array<["beach" | "river" | "cave" | "volcano", THREE.Mesh]>) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set(emblemStates[zoneKey] ? "#22c55e" : "#7f1d1d");
      material.needsUpdate = true;
    }
  }

  private syncChallengeStateFromSave(): void {
    this.cavePuzzleSolved = this.saveStore.isChallengeCompleted("cave");
    if (this.saveStore.isChallengeCompleted("oasis")) {
      this.oasisFinalChallengeActive = false;
      this.activatedOasisPlates.clear();
      (Object.keys(this.world.oasisChallengePlates) as OasisPlateId[]).forEach(
        (plateId) => {
          this.activatedOasisPlates.add(plateId);
        },
      );
      return;
    }
    if (!this.oasisFinalChallengeActive) {
      this.activatedOasisPlates.clear();
    }
  }

  private applyCavePuzzleVisual(): void {
    const doorMaterial = this.world.cavePuzzleDoor
      .material as THREE.MeshStandardMaterial;
    this.world.cavePuzzleDoor.position.y = this.cavePuzzleSolved ? 5.2 : 1.6;
    doorMaterial.color.set(this.cavePuzzleSolved ? "#166534" : "#b91c1c");
    doorMaterial.needsUpdate = true;
  }

  private applyOasisChallengeVisual(): void {
    const completed = this.saveStore.isChallengeCompleted("oasis");
    const active = this.oasisFinalChallengeActive;
    const doorMaterial = this.world.oasisFinalDoor
      .material as THREE.MeshStandardMaterial;
    this.world.oasisFinalDoor.position.y = completed ? 5.8 : 1.8;
    doorMaterial.color.set(completed ? "#166534" : "#9f1239");
    doorMaterial.needsUpdate = true;

    for (const [plateId, mesh] of Object.entries(
      this.world.oasisChallengePlates,
    ) as Array<[OasisPlateId, THREE.Mesh]>) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const activePlate = this.activatedOasisPlates.has(plateId);
      material.color.set(
        activePlate ? "#22c55e" : active ? "#facc15" : "#a1a1aa",
      );
      material.needsUpdate = true;
      mesh.position.y = activePlate ? 0.06 : 0.1;
    }
  }

  private updateOasisFinalChallenge(): void {
    if (
      !this.oasisFinalChallengeActive ||
      this.saveStore.isChallengeCompleted("oasis")
    ) {
      return;
    }
    for (const [plateId, rect] of Object.entries(OASIS_PLATE_RECT) as Array<
      [OasisPlateId, Rect]
    >) {
      if (this.activatedOasisPlates.has(plateId)) {
        continue;
      }
      const pos = this.player.position;
      if (
        pos.x >= rect.minX &&
        pos.x <= rect.maxX &&
        pos.z >= rect.minZ &&
        pos.z <= rect.maxZ
      ) {
        this.activatedOasisPlates.add(plateId);
        this.applyOasisChallengeVisual();
        this.ui.showToast(
          `Pressure plate ${plateId.replace("oasis_plate_", "").toUpperCase()} activated.`,
        );
      }
    }

    if (this.activatedOasisPlates.size >= 3) {
      this.completeChallenge("oasis");
    }
  }

  private getActiveColliders(): BoxCollider[] {
    const save = this.saveStore.getState();
    const active = [...this.world.colliders];
    if (!isVolcanoUnlocked(save)) {
      active.push(this.world.volcanoGateCollider);
    }
    if (!isOasisUnlocked(save)) {
      active.push(this.world.oasisGateCollider);
    }
    if (!this.saveStore.isChallengeCompleted("oasis")) {
      active.push(this.world.oasisFinalDoorCollider);
    }
    return active;
  }

  private resetPuzzleMeshRotations(): void {
    for (const [pillarId, mesh] of Object.entries(this.world.puzzlePillars)) {
      const turns = this.cavePillarTurns[pillarId] ?? 0;
      mesh.rotation.y = turns * (Math.PI / 2);
    }
  }

  private applySettings(settings: SaveData["settings"]): void {
    const signature = [
      settings.masterVolume,
      settings.sfxVolume,
      settings.musicVolume,
      settings.muted,
      settings.graphicsQuality,
      settings.showDiagnostics,
      settings.meshAuditEnabled,
      settings.decayGraceEnabled,
    ].join("|");
    if (signature === this.appliedSettingsSignature) {
      return;
    }
    this.appliedSettingsSignature = signature;

    const preset = getQualityPreset(settings.graphicsQuality);
    const qualityChanged = preset.id !== this.qualityPreset.id;
    this.qualityPreset = preset;
    if (qualityChanged) {
      this.rendererHost.applyQuality(this.qualityPreset);
    }

    this.particles.setBudget(this.qualityPreset.particleMax);
    this.particles.setEnabled(this.qualityPreset.vfxEnabled);
    this.audio.applySettings({
      masterVolume: settings.masterVolume,
      sfxVolume: settings.sfxVolume,
      musicVolume: settings.musicVolume,
      muted: settings.muted,
    });
    this.diagnostics.setVisible(settings.showDiagnostics);
    this.meshAudit.setEnabled(settings.meshAuditEnabled);
    this.fishingSystem.setDecayGraceEnabled(settings.decayGraceEnabled);
  }

  private setPoiMarkersVisible(visible: boolean): void {
    this.poiMarkersVisible = visible;
    this.rendererHost.scene.traverse((obj) => {
      if (obj.userData.poiMarker) {
        obj.visible = visible;
      }
    });
  }

  private setZoneVolumesVisible(visible: boolean): void {
    this.zoneVolumesVisible = visible;
    this.rendererHost.scene.traverse((obj) => {
      if (obj.userData.zoneVolumeMarker) {
        obj.visible = visible;
      }
    });
  }

  private handleGateUnlockTransitions(saveData: SaveData): void {
    const volcanoUnlocked = isVolcanoUnlocked(saveData);
    if (volcanoUnlocked && !this.previousVolcanoUnlocked) {
      this.playSfx("gate_unlock");
      this.ui.showToast("Volcano gate unlocked.");
    }
    this.previousVolcanoUnlocked = volcanoUnlocked;

    const oasisUnlocked = isOasisUnlocked(saveData);
    if (oasisUnlocked && !this.previousOasisUnlocked) {
      this.playSfx("gate_unlock");
      this.ui.showToast("Oasis gate unlocked.");
    }
    this.previousOasisUnlocked = oasisUnlocked;
  }

  private handleRemoteCelebration(
    sessionId: string,
    rarity: NetCelebrationRarity,
  ): void {
    const localSessionId = this.multiplayer.getConnectionInfo()?.sessionId;
    if (sessionId === localSessionId) {
      return;
    }
    const avatar = this.remotePlayers.get(sessionId);
    if (!avatar) {
      return;
    }
    avatar.triggerCelebration(rarity);
    this.particles.spawnCelebration(avatar.group.position.clone(), rarity);
  }

  private getQuickSellFishIds(
    mode: "commons" | "commons_uncommons" | "keep_rares",
  ): string[] {
    const fishIds: string[] = [];
    for (const [fishId, count] of Object.entries(
      this.saveStore.getState().fishInventory,
    )) {
      const fish = ALL_FISH_BY_ID[fishId];
      if (!fish || count <= 0) {
        continue;
      }
      const sellable =
        fish.rarity === "common" ||
        ((mode === "commons_uncommons" || mode === "keep_rares") &&
          fish.rarity === "uncommon");
      if (!sellable) {
        continue;
      }
      for (let i = 0; i < count; i += 1) {
        fishIds.push(fishId);
      }
    }
    return fishIds;
  }

  private containsRareOrHigherInventory(): boolean {
    for (const [fishId, count] of Object.entries(
      this.saveStore.getState().fishInventory,
    )) {
      if (count <= 0) {
        continue;
      }
      const fish = ALL_FISH_BY_ID[fishId];
      if (!fish) {
        continue;
      }
      if (RARITY_ORDER[fish.rarity] >= RARITY_ORDER.rare) {
        return true;
      }
    }
    return false;
  }

  private containsRareOrHigherFishIds(fishIds: string[]): boolean {
    for (const fishId of fishIds) {
      const fish = ALL_FISH_BY_ID[fishId];
      if (!fish) {
        continue;
      }
      if (RARITY_ORDER[fish.rarity] >= RARITY_ORDER.rare) {
        return true;
      }
    }
    return false;
  }

  private spawnBiteVfx(): void {
    const position = this.activeFishingSpot?.position ?? this.player.position;
    this.particles.spawnBite(position.clone());
  }

  private playSfx(id: SoundEventId): void {
    if (!this.audioUnlocked) {
      return;
    }
    this.audio.playSfx(id);
  }

  private async unlockAudio(): Promise<void> {
    if (this.audioUnlocked) {
      return;
    }
    const unlocked = await this.audio.unlockByGesture();
    if (!unlocked) {
      return;
    }
    this.audioUnlocked = true;
    this.audio.applySettings(this.saveStore.getSettings());
    this.audio.setZoneAmbience(this.currentZone);
    window.removeEventListener("pointerdown", this.onFirstUserGesture);
    window.removeEventListener("keydown", this.onFirstUserGesture);
  }

  private registerAutomationHooks(): void {
    window.render_game_to_text = () => this.renderGameToText();
    window.advanceTime = (ms: number) => {
      if (this.automationViewId && !this.automationViewApplied) {
        this.applyAutomationView(this.automationViewId);
        this.automationViewApplied = true;
      } else if (!this.automationPerspectiveEnabled) {
        this.applyAutomationCameraPreset();
        this.automationPerspectiveEnabled = true;
      }
      const clampedMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
      const steps = Math.max(1, Math.round(clampedMs / (1000 / 60)));
      if (!this.automationManualStepping) {
        this.rendererHost.setRafPaused(true);
        this.automationManualStepping = true;
      }
      for (let i = 0; i < steps; i += 1) {
        this.rendererHost.step((dt) => this.update(dt), 1 / 60);
      }
    };
  }

  private renderGameToText(): string {
    const saveData = this.saveStore.getState();
    const fishing = this.fishingSystem.getSnapshot();
    const nearest = this.currentInteractable
      ? {
          id: this.currentInteractable.id,
          type: this.currentInteractable.type,
          title: this.currentInteractable.title,
          distance: round2(
            this.currentInteractable.position.distanceTo(this.player.position),
          ),
        }
      : null;
    const nearbyInteractables = this.world.interactables
      .map((interactable) => ({
        id: interactable.id,
        type: interactable.type,
        distance: interactable.position.distanceTo(this.player.position),
      }))
      .filter((item) => item.distance <= 10)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        type: item.type,
        distance: round2(item.distance),
      }));

    const payload = {
      coordinateSystem: "origin center, +x east, +z forward/north, +y up",
      player: {
        x: round2(this.player.position.x),
        y: round2(this.player.position.y),
        z: round2(this.player.position.z),
        yaw: round2(this.followCamera.getYaw()),
        pitch: round2(this.followCamera.getPitch()),
        speed: round2(this.player.getHorizontalSpeed()),
      },
      zone: this.currentZone,
      nearestInteractable: nearest,
      nearbyInteractables,
      fishing: {
        state: fishing.state,
        activeSpotId: this.activeFishingSpot?.id ?? null,
        activeSpotTitle: this.activeFishingSpot?.title ?? null,
      },
      challenge: this.activeTimedChallenge
        ? {
            zone: this.activeTimedChallenge.zone,
            timeLeft: round2(this.activeTimedChallenge.timeLeft),
            checkpoint: {
              x: round2(this.activeTimedChallenge.checkpoint.x),
              z: round2(this.activeTimedChallenge.checkpoint.z),
            },
            goal: {
              x: round2(this.activeTimedChallenge.goal.x),
              z: round2(this.activeTimedChallenge.goal.z),
            },
            hazardCount: this.activeTimedChallenge.hazardRects.length,
          }
        : null,
      bestiaryProgress: {
        beachUnique: getZoneProgress(saveData, "beach").discoveredUnique,
        riverUnique: getZoneProgress(saveData, "river").discoveredUnique,
      },
      gates: {
        volcanoUnlocked: isVolcanoUnlocked(saveData),
        oasisUnlocked: isOasisUnlocked(saveData),
      },
    };

    return JSON.stringify(payload);
  }

  private applyAutomationCameraPreset(): void {
    const preset =
      AUTOMATION_CAMERA_PRESETS[
        this.automationCameraPresetIndex % AUTOMATION_CAMERA_PRESETS.length
      ];
    this.automationCameraPresetIndex += 1;
    const lookDelta = new THREE.Vector2(
      -(preset.yaw / 0.0038),
      -(preset.pitch / 0.0038),
    );
    this.followCamera.update(this.player.position, lookDelta, 0);
  }

  private applyAutomationView(viewId: AutomationViewId): void {
    const preset = AUTOMATION_VIEW_PRESETS[viewId];
    if (!preset) {
      return;
    }
    this.player.position.set(
      preset.x,
      this.world.getGroundHeight(preset.x, preset.z),
      preset.z,
    );
    const lookDelta = new THREE.Vector2(
      -(preset.yaw / 0.0038),
      -(preset.pitch / 0.0038),
    );
    this.followCamera.update(this.player.position, lookDelta, 0);
    this.automationPerspectiveEnabled = true;
    this.activeFishingSpot = null;
    this.currentInteractable = null;
    this.updateCurrentZone();
    this.updateNearestInteractable();
  }

  private parseAutomationView(): AutomationViewId | null {
    const value = new URLSearchParams(window.location.search).get(
      "automationView",
    );
    if (
      value === "beach_plaza" ||
      value === "beach_reef" ||
      value === "river_bridge" ||
      value === "river_pool"
    ) {
      return value;
    }
    return null;
  }

  private parseJoinIntent(): JoinIntent | null {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("roomId") ?? undefined;
    const firestoreGameId =
      params.get("firestoreGameId") ?? params.get("matchId") ?? undefined;
    const inviteCode = params.get("inviteCode") ?? undefined;
    const modeRaw = params.get("mode");
    if (!roomId && !firestoreGameId && !inviteCode && !modeRaw) {
      return null;
    }
    const mode: JoinIntent["mode"] =
      modeRaw === "spectate"
        ? "spectate"
        : modeRaw === "game"
          ? "game"
          : "join";
    return { roomId, firestoreGameId, inviteCode, mode };
  }

  private readableJoinError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("spectat")) {
      return "Spectating not supported.";
    }
    if (
      lower.includes("max clients") ||
      lower.includes("room full") ||
      lower.includes("full")
    ) {
      return "Room full (10 players max).";
    }
    if (lower.includes("not found")) {
      return "Room not found. Ask host for a valid invite.";
    }
    return message || "Unable to join room.";
  }

  private resolveServerUrl(): string {
    const env = import.meta.env.VITE_COLYSEUS_URL as string | undefined;
    if (env && env.length > 0) {
      return env;
    }
    return `${window.location.protocol}//${window.location.hostname}:2567`;
  }

  private getRodName(rodId: string): string {
    return ROD_DEFINITIONS.find((rod) => rod.id === rodId)?.name ?? rodId;
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tag = target.tagName.toLowerCase();
    return (
      target.isContentEditable ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select"
    );
  }

  private async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  }

  private readonly onDebugKeyDown = (event: KeyboardEvent): void => {
    if (this.isEditableTarget(event.target)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "f") {
      event.preventDefault();
      void this.toggleFullscreen();
      return;
    }

    if (key === "escape" && document.fullscreenElement) {
      event.preventDefault();
      void document.exitFullscreen();
      return;
    }

    if (key === "g") {
      this.saveStore.addGold(DEV_GOLD_GRANT);
      this.ui.showToast(`Dev gold +${DEV_GOLD_GRANT}.`);
      return;
    }

    if (key === "c") {
      this.cullingDebugEnabled = !this.cullingDebugEnabled;
      this.worldCulling.setDebugEnabled(this.cullingDebugEnabled);
      this.ui.showToast(
        `Culling debug ${this.cullingDebugEnabled ? "enabled" : "disabled"}.`,
      );
      return;
    }

    if (key === "p") {
      this.setPoiMarkersVisible(!this.poiMarkersVisible);
      this.ui.showToast(
        `POI markers ${this.poiMarkersVisible ? "shown" : "hidden"}.`,
      );
      return;
    }

    if (key === "z") {
      this.setZoneVolumesVisible(!this.zoneVolumesVisible);
      this.ui.showToast(
        `Zone volumes ${this.zoneVolumesVisible ? "shown" : "hidden"}.`,
      );
      return;
    }

    if (key === "m") {
      const next = !this.saveStore.getSettings().meshAuditEnabled;
      this.saveStore.updateSettings({ meshAuditEnabled: next });
      this.ui.showToast(`Mesh audit ${next ? "enabled" : "disabled"}.`);
    }
  };

  private readonly onFirstUserGesture = (): void => {
    void this.unlockAudio();
  };
}

function toGold(value: number): string {
  return `${value}g`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNetFishingState(state: FishingSnapshot["state"]): NetFishingState {
  switch (state) {
    case "casting":
      return "casting";
    case "waiting_for_bite":
    case "hooked":
    case "minigame":
      return "waiting";
    case "result_success":
      return "caught";
    case "result_fail":
      return "fail";
    default:
      return "idle";
  }
}
