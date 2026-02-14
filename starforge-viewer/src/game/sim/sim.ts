/**
 * Sim — advances the simulation by one tick.
 * Pure function: (state) → newState.
 * No DOM, no Three.js.
 *
 * Each tick:
 *  1. Run machine production / conversion.
 *  2. Clamp to caps.
 *  3. Increment tick counter.
 */
import type { BalanceV1, BalanceV2 } from "../data/balanceSchema";
import type { ContractsCatalog } from "../data/contractsSchema";
import type { EventsCatalog } from "../data/eventsSchema";
import type {
  MachinesCatalog,
  MachinesV2Catalog,
} from "../data/machinesSchema";
import type { MilestonesCatalog } from "../data/milestonesSchema";
import type { UpgradesCatalog } from "../data/upgradesSchema";
import type {
  WreckRarity,
  WrecksCatalog,
  WrecksV2Catalog,
} from "../data/wrecksSchema";
import { computeDerived } from "./derived";
import { createRNG } from "./rng";
import type {
  ContractState,
  CutterDockState,
  EventState,
  MilestoneState,
  ResourceKey,
  Resources,
  SimStateV1,
  WrecksField,
  WreckSpawnTimer,
  WreckState,
} from "./types";

/** Cached catalog — set once at boot. */
let catalog: MachinesCatalog | null = null;
let upgCatalog: UpgradesCatalog | null = null;
let ctrCatalog: ContractsCatalog | null = null;
let evtCatalog: EventsCatalog | null = null;
let mlsCatalog: MilestonesCatalog | null = null;
let wrkCatalog: WrecksCatalog | null = null;
let wrkV2Catalog: WrecksV2Catalog | null = null;
let balV2: BalanceV2 | null = null;
let bal: BalanceV1 | null = null;
let machV2Catalog: MachinesV2Catalog | null = null;
let simHz = 20;

export function setSimCatalog(c: MachinesCatalog): void {
  catalog = c;
}

export function setSimUpgradesCatalog(u: UpgradesCatalog): void {
  upgCatalog = u;
}

export function setSimContractsCatalog(c: ContractsCatalog): void {
  ctrCatalog = c;
}

export function setSimEventsCatalog(c: EventsCatalog): void {
  evtCatalog = c;
}

export function setSimMilestonesCatalog(c: MilestonesCatalog): void {
  mlsCatalog = c;
}

export function setSimWrecksCatalog(c: WrecksCatalog): void {
  wrkCatalog = c;
}

export function setSimBalance(b: BalanceV1): void {
  bal = b;
}

export function setSimBalanceV2(b: BalanceV2): void {
  balV2 = b;
}

export function setSimWrecksV2Catalog(c: WrecksV2Catalog): void {
  wrkV2Catalog = c;
}

export function setSimMachinesV2Catalog(c: MachinesV2Catalog): void {
  machV2Catalog = c;
}

export function setSimHz(hz: number): void {
  simHz = hz;
}

/**
 * Step the simulation forward by one tick.
 */
export function stepTick(state: SimStateV1): SimStateV1 {
  if (!catalog) return { ...state, tick: state.tick + 1 };

  const dt = 1 / simHz; // seconds per tick
  let res: Resources = { ...state.resources };
  let overflowLost = state.stats.overflowLost;

  // Compute derived upgrade mods
  const mods = upgCatalog
    ? computeDerived(
        state.upgradesPurchased,
        upgCatalog,
        state.upgradesPurchasedV2,
        state.machines,
      )
    : null;

  // Compute global production multiplier from BOOSTERs
  let globalProdMult = 1;
  for (const s of Object.values(state.machines)) {
    if (!s.enabled) continue;
    const def = catalog.machines[s.code];
    if (!def || def.behavior.type !== "BOOSTER") continue;
    const tMult = def.tierMult[String(s.tier) as "1" | "2" | "3"];
    // Each copy in the stack contributes — exponentiate by count
    globalProdMult *= Math.pow(def.behavior.globalProdMult ** tMult, s.count);
  }
  // Apply upgrade global prod mult
  if (mods) globalProdMult *= mods.globalProdMult;

  // Apply event prod boosts
  for (const boost of state.events.prodBoosts) {
    if (state.tick < boost.expiresAtTick) {
      globalProdMult *= boost.mult;
    }
  }

  // Compute effective caps (base + event cap boosts)
  const effectiveCaps = { ...state.capsMicro };
  for (const cb of state.events.capBoosts) {
    if (state.tick < cb.expiresAtTick) {
      effectiveCaps[cb.key] += cb.amountMicro;
    }
  }

  // Process each machine stack — production scales linearly with count
  for (const s of Object.values(state.machines)) {
    if (!s.enabled) continue;
    const def = catalog.machines[s.code];
    if (!def) continue;

    const tMult = def.tierMult[String(s.tier) as "1" | "2" | "3"];
    const levelMult = s.level; // linear for now
    const b = def.behavior;

    // Per-machine prod mult from upgrades
    const machineMult = mods?.machineProdMult[s.code] ?? 1;

    switch (b.type) {
      case "PRODUCER": {
        const amount = Math.round(
          b.perSecMicro *
            dt *
            tMult *
            levelMult *
            globalProdMult *
            machineMult *
            s.count,
        );
        res = addResource(res, b.resource, amount);
        break;
      }
      case "CONVERTER": {
        const effMult = mods?.converterEfficiency[s.code] ?? 1;
        const maxConsume = Math.round(
          b.inPerSecMicro *
            dt *
            tMult *
            levelMult *
            globalProdMult *
            machineMult *
            s.count,
        );
        const consumed = Math.min(res[b.in], maxConsume);
        const produced = Math.round(consumed * b.outPerIn * effMult);
        res = addResource(res, b.in, -consumed);
        res = addResource(res, b.out, produced);
        break;
      }
      case "CONTRACT": {
        // Produces signal based on signalPerSecMicro
        const amount = Math.round(
          b.signalPerSecMicro *
            dt *
            tMult *
            levelMult *
            globalProdMult *
            machineMult *
            s.count,
        );
        res = addResource(res, "signal", amount);
        break;
      }
      case "COSMIC": {
        // Late-game: produces all three resources
        const cosmicBase = 20; // micro per sec base
        const amount = Math.round(
          cosmicBase *
            dt *
            tMult *
            levelMult *
            globalProdMult *
            machineMult *
            s.count,
        );
        res = addResource(res, "flux", amount);
        res = addResource(res, "alloy", amount);
        res = addResource(res, "signal", amount);
        break;
      }
      // BUFFER caps are handled in reducer on buy;
      // BOOSTER handled above; DISCOVERY is passive (no tick logic).
      default:
        break;
    }
  }

  // ── V2 machine behaviors ────────────────────────────────────
  if (machV2Catalog && mods) {
    for (const mDef of machV2Catalog.machines) {
      const stack = state.machines[mDef.code];
      if (!stack || stack.count <= 0 || !stack.enabled) continue;

      const tierMult = mDef.tier.tierMult[String(stack.tier)] ?? 1;
      const p = mDef.params as Record<string, unknown>;

      switch (mDef.behaviorType) {
        case "HOPPER": {
          // Recalculate flux cap: base + hopperCount * capPerUnit * tierMult
          const fluxCapBase = balV2?.resources.fluxCapMicroBase ?? 50000;
          const capPerUnit = (p.fluxCapMicroPerUnit as number) ?? 5000;
          effectiveCaps.flux =
            fluxCapBase +
            Math.round(stack.count * capPerUnit * tierMult) +
            (mods.capBonusMicro.flux ?? 0);
          break;
        }
        case "SIGNAL": {
          // Produce signal when a wreck is docked
          if (state.cutterDock?.status === "docked") {
            const signalBase = (p.signalPerSecMicroBase as number) ?? 45;
            const amount = Math.floor(
              (signalBase * tierMult * mods.signalRateMult) / simHz,
            );
            res = addResource(res, "signal", amount);
          }
          break;
        }
        case "CONVERTER_ALLOY_TO_FLUX": {
          // Nanoforge: convert alloy → flux each tick
          const rateBase = (p.alloyToFluxRatePerSecMicroBase as number) ?? 120;
          const convert = Math.floor(
            (rateBase * tierMult * mods.nanoforgeRateMult) / simHz,
          );
          const consumed = Math.min(res.alloy, convert);
          if (consumed > 0) {
            res = addResource(res, "alloy", -consumed);
            res = addResource(res, "flux", consumed);
          }
          break;
        }
        // CUTTER, CRANE, BATTERY, SCANNER, LAB, ASSEMBLER, DYSON
        // → passive effects already applied via derived.ts applyMachineParamEffects
        // DRONE_FETCH → handled below in wreck auto-fetch section
        default:
          break;
      }
    }
  }

  // Clamp to caps (using effective caps including event boosts)
  for (const key of ["flux", "alloy", "signal"] as const) {
    if (res[key] > effectiveCaps[key]) {
      overflowLost += res[key] - effectiveCaps[key];
      res[key] = effectiveCaps[key];
    }
  }

  const dirty =
    res.flux !== state.resources.flux ||
    res.alloy !== state.resources.alloy ||
    res.signal !== state.resources.signal ||
    state.flags.dirty;

  const nextTick = state.tick + 1;

  // ── Contract progress + reveal ──────────────────────────────
  let contracts: ContractState = state.contracts;

  if (ctrCatalog && bal) {
    contracts = { ...contracts };

    // 1. Check active contract progress
    if (
      contracts.active &&
      !contracts.active.completed &&
      !contracts.active.claimed
    ) {
      const ac = contracts.active;
      // Expired?
      if (nextTick >= ac.endsAtTick) {
        // Contract expired — clear it, do NOT mark completed
        contracts = { ...contracts, active: null };
      } else {
        const def = ctrCatalog.contracts.find((c) => c.id === ac.id);
        if (def) {
          const allMet = def.requirements.every((req) => {
            switch (req.t) {
              case "EARN_RESOURCE": {
                const earned =
                  res[req.key] - (ac.snapshotResources[req.key] ?? 0);
                return earned >= req.amountMicro;
              }
              case "OWN_MACHINE": {
                if (req.code === "*") {
                  let total = 0;
                  for (const s of Object.values(state.machines))
                    total += s.count;
                  return total >= req.count;
                }
                const owned = state.machines[req.code]?.count ?? 0;
                return owned >= req.count;
              }
              case "UPGRADES_PURCHASED":
                return state.upgradesPurchased.length >= req.count;
              default:
                return false;
            }
          });
          if (allMet) {
            contracts = {
              ...contracts,
              active: { ...ac, completed: true },
            };
          }
        }
      }
    }

    // 2. Reveal new contracts
    const cfg = bal.contracts;
    if (
      nextTick - contracts.lastRevealRollTick >= cfg.revealIntervalTicks &&
      contracts.revealed.length < cfg.maxRevealed
    ) {
      const rng = createRNG(state.seed + nextTick);
      const roll = rng.nextFloat();

      // Scanner upgrade bonus
      const scannerAdd = mods?.revealChanceAdd ?? 0;
      const chance = cfg.baseRevealChance + scannerAdd;

      if (roll < chance) {
        // Pick a random unrevealed contract
        const usedIds = new Set([
          ...contracts.revealed,
          ...contracts.completed,
          ...(contracts.active ? [contracts.active.id] : []),
        ]);
        const pool = ctrCatalog.contracts.filter((c) => !usedIds.has(c.id));
        if (pool.length > 0) {
          const idx = rng.nextInt(0, pool.length - 1);
          contracts = {
            ...contracts,
            revealed: [...contracts.revealed, pool[idx].id],
            lastRevealRollTick: nextTick,
          };
        }
      } else {
        contracts = { ...contracts, lastRevealRollTick: nextTick };
      }
    }
  }

  // ── Event spawning + expiry + boost cleanup ─────────────────
  let events: EventState = { ...state.events };

  {
    // Expire active event
    if (
      events.activeEvent &&
      !events.activeEvent.consumed &&
      nextTick >= events.activeEvent.expiresAtTick
    ) {
      events = { ...events, activeEvent: null };
    }
    // Clear consumed events (so we can spawn new ones)
    if (events.activeEvent?.consumed) {
      events = { ...events, activeEvent: null };
    }

    // Expire prod boosts
    const aliveProd = events.prodBoosts.filter(
      (b) => nextTick < b.expiresAtTick,
    );
    if (aliveProd.length !== events.prodBoosts.length) {
      events = { ...events, prodBoosts: aliveProd };
    }

    // Expire cap boosts
    const aliveCap = events.capBoosts.filter((b) => nextTick < b.expiresAtTick);
    if (aliveCap.length !== events.capBoosts.length) {
      events = { ...events, capBoosts: aliveCap };
    }

    // Spawn new event — V2 gap-based (deterministic), fall back to V1 interval
    const canSpawnV2 =
      balV2?.events.enabled && evtCatalog && !events.activeEvent;
    const canSpawnV1 = !balV2 && bal && evtCatalog && !events.activeEvent;

    if (canSpawnV2 && evtCatalog) {
      const eV2 = balV2!.events;
      // Compute nextSpawnTick if not yet set
      const nst = events.nextSpawnTick ?? 0;

      if (nextTick >= nst) {
        // Time to spawn — weighted random pick
        const rng = createRNG(state.seed + nextTick + 7919);
        const totalWeight = evtCatalog.events.reduce((s, e) => s + e.weight, 0);
        let r = rng.nextFloat() * totalWeight;
        let picked = evtCatalog.events[0];
        for (const e of evtCatalog.events) {
          r -= e.weight;
          if (r <= 0) {
            picked = e;
            break;
          }
        }

        // Event lifetime: 30s (600 ticks) — generous window
        const lifetimeTicks = 600;
        const activeEvent = {
          id: picked.id,
          spawnedAtTick: nextTick,
          expiresAtTick: nextTick + lifetimeTicks,
          vfxHint: picked.vfxHint as "spark" | "pulse" | "ring" | "star",
          trigger: picked.trigger as "TAP" | "AUTO",
          consumed: false,
        };

        // Schedule next spawn using deterministic gap
        const rng2 = createRNG(state.seed + nextTick + 8191);
        const gapSec =
          eV2.minGapSec + rng2.nextFloat() * (eV2.maxGapSec - eV2.minGapSec);
        const nextEvtTick = nextTick + Math.max(1, Math.floor(gapSec * simHz));

        events = {
          ...events,
          activeEvent,
          lastSpawnRollTick: nextTick,
          nextSpawnTick: nextEvtTick,
        };

        // AUTO events are applied immediately
        if (picked.trigger === "AUTO") {
          for (const eff of picked.effects) {
            switch (eff.t) {
              case "RESOURCE_BURST":
                res = {
                  ...res,
                  [eff.key]: Math.min(
                    res[eff.key] + eff.amountMicro,
                    effectiveCaps[eff.key],
                  ),
                };
                break;
              case "PROD_BOOST":
                events = {
                  ...events,
                  prodBoosts: [
                    ...events.prodBoosts,
                    {
                      mult: eff.mult,
                      expiresAtTick: nextTick + eff.durationTicks,
                    },
                  ],
                };
                break;
              case "CAP_BOOST":
                events = {
                  ...events,
                  capBoosts: [
                    ...events.capBoosts,
                    {
                      key: eff.key,
                      amountMicro: eff.amountMicro,
                      expiresAtTick: nextTick + eff.durationTicks,
                    },
                  ],
                };
                break;
            }
          }
          events = {
            ...events,
            activeEvent: { ...events.activeEvent!, consumed: true },
          };
        }
      }
    } else if (canSpawnV1 && bal && evtCatalog) {
      const eCfg = bal.events;
      if (nextTick - events.lastSpawnRollTick >= eCfg.spawnIntervalTicks) {
        const rng = createRNG(state.seed + nextTick + 7919);
        const roll = rng.nextFloat();

        if (roll < eCfg.baseSpawnChance) {
          const totalWeight = evtCatalog.events.reduce(
            (s, e) => s + e.weight,
            0,
          );
          let r = rng.nextFloat() * totalWeight;
          let picked = evtCatalog.events[0];
          for (const e of evtCatalog.events) {
            r -= e.weight;
            if (r <= 0) {
              picked = e;
              break;
            }
          }

          const activeEvent = {
            id: picked.id,
            spawnedAtTick: nextTick,
            expiresAtTick: nextTick + eCfg.eventLifetimeTicks,
            vfxHint: picked.vfxHint as "spark" | "pulse" | "ring" | "star",
            trigger: picked.trigger as "TAP" | "AUTO",
            consumed: false,
          };

          events = { ...events, activeEvent, lastSpawnRollTick: nextTick };

          if (picked.trigger === "AUTO") {
            for (const eff of picked.effects) {
              switch (eff.t) {
                case "RESOURCE_BURST":
                  res = {
                    ...res,
                    [eff.key]: Math.min(
                      res[eff.key] + eff.amountMicro,
                      effectiveCaps[eff.key],
                    ),
                  };
                  break;
                case "PROD_BOOST":
                  events = {
                    ...events,
                    prodBoosts: [
                      ...events.prodBoosts,
                      {
                        mult: eff.mult,
                        expiresAtTick: nextTick + eff.durationTicks,
                      },
                    ],
                  };
                  break;
                case "CAP_BOOST":
                  events = {
                    ...events,
                    capBoosts: [
                      ...events.capBoosts,
                      {
                        key: eff.key,
                        amountMicro: eff.amountMicro,
                        expiresAtTick: nextTick + eff.durationTicks,
                      },
                    ],
                  };
                  break;
              }
            }
            events = {
              ...events,
              activeEvent: { ...events.activeEvent!, consumed: true },
            };
          }
        } else {
          events = { ...events, lastSpawnRollTick: nextTick };
        }
      }
    }
  }

  // ── Milestone checking ──────────────────────────────────────
  let milestones: MilestoneState = { ...state.milestones };

  if (mlsCatalog) {
    const claimedSet = new Set(milestones.claimed);
    const newlyAchieved: string[] = [];

    for (const ms of mlsCatalog.milestones) {
      if (claimedSet.has(ms.id)) continue;

      let met = false;
      switch (ms.threshold.t) {
        case "RESOURCE_EARNED":
          met =
            state.stats.totalFluxEarned >= ms.threshold.amountMicro &&
            ms.threshold.key === "flux";
          // For alloy/signal, we'd need totalAlloyEarned etc. For now, only flux is tracked.
          break;
        case "TOTAL_TAPS":
          met = state.stats.totalTaps >= ms.threshold.count;
          break;
        case "MACHINES_OWNED": {
          let total = 0;
          for (const s of Object.values(state.machines)) total += s.count;
          met = total >= ms.threshold.count;
          break;
        }
        case "UPGRADES_PURCHASED":
          met = state.upgradesPurchased.length >= ms.threshold.count;
          break;
        case "CONTRACTS_COMPLETED":
          met = state.contracts.completed.length >= ms.threshold.count;
          break;
      }

      if (met) {
        newlyAchieved.push(ms.id);
        // Apply milestone reward
        if (ms.reward.fluxMicro) {
          res = {
            ...res,
            flux: Math.min(res.flux + ms.reward.fluxMicro, effectiveCaps.flux),
          };
        }
        if (ms.reward.alloyMicro) {
          res = {
            ...res,
            alloy: Math.min(
              res.alloy + ms.reward.alloyMicro,
              effectiveCaps.alloy,
            ),
          };
        }
        if (ms.reward.signalMicro) {
          res = {
            ...res,
            signal: Math.min(
              res.signal + ms.reward.signalMicro,
              effectiveCaps.signal,
            ),
          };
        }
      }
    }

    if (newlyAchieved.length > 0) {
      milestones = {
        claimed: [...milestones.claimed, ...newlyAchieved],
        pendingToast: [...milestones.pendingToast, ...newlyAchieved],
      };
    }
  }

  // ── Wreck spawning, despawning & auto-harvest ───────────────
  let wrecks: WrecksField = { ...state.wrecks };
  let cutterDock: CutterDockState = state.cutterDock ?? {
    status: "empty" as const,
    wreckId: null,
    reservedWreckId: null,
  };

  if (bal && wrkCatalog) {
    const wCfg = bal.wrecks;

    // 1. Despawn depleted wrecks
    let activeWrecks = { ...wrecks.active };
    let changed = false;
    for (const [id, w] of Object.entries(activeWrecks)) {
      if (w.depleted) {
        const def = wrkCatalog.wreckArchetypes.find(
          (a) => a.id === w.archetypeId,
        );
        if (def?.despawnOnDepleted) {
          delete activeWrecks[id];
          changed = true;
        }
      }
    }
    if (changed) {
      wrecks = { ...wrecks, active: activeWrecks };
    }

    // 2. Spawn new wrecks
    const activeCount = Object.keys(wrecks.active).length;
    if (
      activeCount < wCfg.maxActiveWrecks &&
      nextTick - wrecks.lastSpawnRollTick >= wCfg.spawnIntervalTicks
    ) {
      const rng = createRNG(state.seed + nextTick + 13337);
      const roll = rng.nextFloat();

      // SCANNER_DEEP upgrade bonus for rare wreck chance
      const scannerRareAdd = mods?.revealChanceAdd ?? 0;

      if (roll < wCfg.baseSpawnChance + scannerRareAdd * 0.5) {
        // Weighted archetype pick
        const totalWeight = wrkCatalog.wreckArchetypes.reduce(
          (s, a) => s + a.weight,
          0,
        );
        let r = rng.nextFloat() * totalWeight;
        let picked = wrkCatalog.wreckArchetypes[0];
        for (const a of wrkCatalog.wreckArchetypes) {
          r -= a.weight;
          if (r <= 0) {
            picked = a;
            break;
          }
        }

        // Position on wreck ring
        const angle = rng.nextFloat() * Math.PI * 2;
        const radius =
          wCfg.wreckRingMinRadius +
          rng.nextFloat() * (wCfg.wreckRingMaxRadius - wCfg.wreckRingMinRadius);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const wreckId = `w${wrecks.nextId}`;
        const newWreck: WreckState = {
          id: wreckId,
          archetypeId: picked.id,
          hpMicro: picked.hpMicro,
          maxHpMicro: picked.hpMicro,
          yieldRemainingMicro: { ...picked.baseYieldMicro },
          x,
          z,
          spawnedAtTick: nextTick,
          depleted: false,
          // V2 defaults for legacy wrecks
          rarity: "common",
          phase: "spawned",
          payoutFluxMicro: 0,
        };

        wrecks = {
          ...wrecks,
          active: { ...wrecks.active, [wreckId]: newWreck },
          nextId: wrecks.nextId + 1,
          lastSpawnRollTick: nextTick,
        };
      } else {
        wrecks = { ...wrecks, lastSpawnRollTick: nextTick };
      }
    }

    // 3. DRONES_MAG v2: auto-fetch nearest spawned wreck → dock (if dock empty)
    const droneStack = state.machines["DRONES_MAG"];
    if (droneStack && droneStack.enabled && droneStack.count > 0) {
      // Compute cooldown from v2 params
      const droneDef = machV2Catalog?.machines.find(
        (m) => m.code === "DRONES_MAG",
      );
      const baseCooldownSec =
        ((droneDef?.params as Record<string, unknown>)
          ?.baseCooldownSec as number) ?? 10;
      const cooldownTicks = Math.max(
        1,
        Math.round(baseCooldownSec * simHz * (mods?.droneCooldownMult ?? 1)),
      );

      if (nextTick % cooldownTicks === 0 && cutterDock.status === "empty") {
        // Find nearest spawned (not in_transit / docked) wreck by distance to dock
        const DOCK_X = 0;
        const DOCK_Z = 1.15;
        let nearest: WreckState | null = null;
        let nearestDist = Infinity;
        for (const w of Object.values(wrecks.active)) {
          if (w.phase !== "spawned") continue;
          const dx = w.x - DOCK_X;
          const dz = w.z - DOCK_Z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = w;
          }
        }

        if (nearest) {
          // Auto-select this wreck (same as applySelectWreck logic)
          const baseTransitTicks = wrkV2Catalog?.spawn.transitBaseTicks ?? 40;
          const transitTicks = Math.max(
            1,
            Math.round(baseTransitTicks * (mods?.transitTicksMult ?? 1)),
          );
          const dockReadyTick = nextTick + transitTicks;

          const updatedWreck: WreckState = {
            ...nearest,
            phase: "in_transit",
            dockReadyTick,
          };

          wrecks = {
            ...wrecks,
            active: { ...wrecks.active, [nearest.id]: updatedWreck },
          };
          cutterDock = {
            status: "transit",
            wreckId: null,
            reservedWreckId: nearest.id,
          };
        }
      }
    }

    // Legacy DRONES_MAG v1 auto-harvest (kept for old wreck types)
    if (
      droneStack &&
      droneStack.enabled &&
      droneStack.count > 0 &&
      nextTick % wCfg.droneHarvestIntervalTicks === 0
    ) {
      // Find nearest non-depleted v1 wreck (phase === undefined or no phase)
      let nearest: WreckState | null = null;
      let nearestDist = Infinity;
      for (const w of Object.values(wrecks.active)) {
        if (w.depleted || w.phase !== "spawned") continue;
        // Only target v1 wrecks (archetypeId !== "v2_wreck")
        if (w.archetypeId === "v2_wreck") continue;
        const dist = Math.sqrt(w.x * w.x + w.z * w.z);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = w;
        }
      }

      if (nearest) {
        const def = wrkCatalog.wreckArchetypes.find(
          (a) => a.id === nearest!.archetypeId,
        );
        if (def) {
          const droneDef = catalog?.machines["DRONES_MAG"];
          const droneTier = droneStack.tier;
          const droneTMult = droneDef
            ? droneDef.tierMult[String(droneTier) as "1" | "2" | "3"]
            : 1;
          const totalDroneDmg = Math.round(
            wCfg.droneTapDamageMicro * droneStack.count * droneTMult,
          );

          const newHp = Math.max(0, nearest.hpMicro - totalDroneDmg);

          // Yield proportional to damage dealt
          const dmgFraction = totalDroneDmg / nearest.maxHpMicro;
          const yF = Math.min(
            Math.round(def.baseYieldMicro.flux * dmgFraction),
            nearest.yieldRemainingMicro.flux,
          );
          const yA = Math.min(
            Math.round(def.baseYieldMicro.alloy * dmgFraction),
            nearest.yieldRemainingMicro.alloy,
          );
          const yS = Math.min(
            Math.round(def.baseYieldMicro.signal * dmgFraction),
            nearest.yieldRemainingMicro.signal,
          );

          res = {
            flux: Math.min(res.flux + yF, effectiveCaps.flux),
            alloy: Math.min(res.alloy + yA, effectiveCaps.alloy),
            signal: Math.min(res.signal + yS, effectiveCaps.signal),
          };

          const updatedYield = {
            flux: nearest.yieldRemainingMicro.flux - yF,
            alloy: nearest.yieldRemainingMicro.alloy - yA,
            signal: nearest.yieldRemainingMicro.signal - yS,
          };

          const depleted =
            newHp <= 0 ||
            (updatedYield.flux <= 0 &&
              updatedYield.alloy <= 0 &&
              updatedYield.signal <= 0);

          const updatedWreck: WreckState = {
            ...nearest,
            hpMicro: newHp,
            yieldRemainingMicro: updatedYield,
            depleted,
          };

          wrecks = {
            ...wrecks,
            active: { ...wrecks.active, [nearest.id]: updatedWreck },
          };
        }
      }
    }
  }

  // ── V2 cutter-dock: transit → docked tick ─────────────────

  if (cutterDock.status === "transit" && cutterDock.reservedWreckId) {
    const reservedId = cutterDock.reservedWreckId;
    const transitWreck = wrecks.active[reservedId];
    if (
      transitWreck &&
      transitWreck.dockReadyTick != null &&
      nextTick >= transitWreck.dockReadyTick
    ) {
      // Wreck arrives at dock
      const dockedWreck: WreckState = {
        ...transitWreck,
        phase: "docked",
      };
      wrecks = {
        ...wrecks,
        active: { ...wrecks.active, [reservedId]: dockedWreck },
      };
      cutterDock = {
        status: "docked",
        wreckId: reservedId,
        reservedWreckId: null,
      };
    }
  }

  // ── V2 weakpoint rolling for docked wreck ─────────────────
  if (
    wrkV2Catalog?.weakpoints.enabled &&
    cutterDock.status === "docked" &&
    cutterDock.wreckId
  ) {
    const dockedW = wrecks.active[cutterDock.wreckId];
    if (dockedW) {
      const hasActive =
        dockedW.weakpointUntilTick != null &&
        nextTick < dockedW.weakpointUntilTick;
      if (!hasActive) {
        const wpCfg = wrkV2Catalog.weakpoints;
        const chance =
          (wpCfg.chancePerSecByRarity[dockedW.rarity] ?? 0) / simHz;
        if (chance > 0) {
          const wpRng = createRNG(state.seed + nextTick + 51337);
          if (wpRng.nextFloat() < chance) {
            const windowTicks =
              wpCfg.windowTicks + (mods?.weakpointWindowTicksAdd ?? 0);
            const updated: WreckState = {
              ...dockedW,
              weakpointUntilTick: nextTick + windowTicks,
            };
            wrecks = {
              ...wrecks,
              active: { ...wrecks.active, [cutterDock.wreckId]: updated },
            };
          }
        }
      }
    }
  }

  // ── V2 wreck spawning (rarity-based, deterministic) ────────
  let wreckSpawn: WreckSpawnTimer = state.wreckSpawn ?? { nextSpawnTick: 100 };

  if (wrkV2Catalog && nextTick >= wreckSpawn.nextSpawnTick) {
    // Count alive wrecks (spawned / in_transit / docked — not depleted)
    let aliveCount = 0;
    for (const w of Object.values(wrecks.active)) {
      if (
        w.phase === "spawned" ||
        w.phase === "in_transit" ||
        w.phase === "docked"
      ) {
        aliveCount++;
      }
    }

    const maxAlive = mods
      ? mods.maxAliveWrecks
      : wrkV2Catalog.spawn.maxAliveBase;

    if (aliveCount < maxAlive) {
      const rng = createRNG(state.seed + nextTick + 31337);

      // Pick rarity by weighted random (apply derived rarityWeightMult)
      const rarities: WreckRarity[] = [
        "common",
        "uncommon",
        "rare",
        "epic",
        "ancient",
      ];
      const rarityMults = mods?.rarityWeightMult ?? {
        common: 1,
        uncommon: 1,
        rare: 1,
        epic: 1,
        ancient: 1,
      };
      const totalWeight = rarities.reduce(
        (s, r) => s + wrkV2Catalog!.rarities[r].weight * (rarityMults[r] ?? 1),
        0,
      );
      let roll = rng.nextFloat() * totalWeight;
      let pickedRarity: WreckRarity = "common";
      for (const r of rarities) {
        roll -= wrkV2Catalog.rarities[r].weight * (rarityMults[r] ?? 1);
        if (roll <= 0) {
          pickedRarity = r;
          break;
        }
      }

      const rarityDef = wrkV2Catalog.rarities[pickedRarity];
      const baseHp = Math.floor(wrkV2Catalog.base.hpMicro * rarityDef.hpMult);
      const basePayout = Math.floor(
        wrkV2Catalog.base.fluxPayoutMicro * rarityDef.fluxMult,
      );

      // Position on wreck ring
      const angle = rng.nextFloat() * Math.PI * 2;
      const radius = rng.rangeFloat(
        wrkV2Catalog.spawn.spawnRadiusMin,
        wrkV2Catalog.spawn.spawnRadiusMax,
      );
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Deterministic ID: tick + random suffix
      const wreckId = `w_${nextTick}_${rng.nextInt(0, 999999999)}`;

      const newWreck: WreckState = {
        id: wreckId,
        archetypeId: "v2_wreck",
        hpMicro: baseHp,
        maxHpMicro: baseHp,
        yieldRemainingMicro: { flux: 0, alloy: 0, signal: 0 },
        x,
        z,
        spawnedAtTick: nextTick,
        depleted: false,
        rarity: pickedRarity,
        phase: "spawned",
        payoutFluxMicro: basePayout,
      };

      wrecks = {
        ...wrecks,
        active: { ...wrecks.active, [wreckId]: newWreck },
        nextId: wrecks.nextId + 1,
      };
    }

    // Schedule next spawn: gap = rng.rangeFloat(min,max) * spawnGapMult
    const rng2 = createRNG(state.seed + nextTick + 41337);
    const gapSec = rng2.rangeFloat(
      wrkV2Catalog.spawn.minGapSec,
      wrkV2Catalog.spawn.maxGapSec,
    );
    const spawnGapMult = mods?.spawnGapMult ?? 1.0;
    const gapTicks = Math.floor(gapSec * simHz * spawnGapMult);
    wreckSpawn = { nextSpawnTick: nextTick + Math.max(1, gapTicks) };
  }

  return {
    ...state,
    tick: nextTick,
    resources: res,
    contracts,
    events,
    milestones,
    wrecks,
    cutterDock,
    wreckSpawn,
    stats: { ...state.stats, overflowLost },
    flags: { ...state.flags, dirty },
  };
}

// ─── Helpers ─────────────────────────────────────────────────

function addResource(
  res: Resources,
  key: ResourceKey,
  amount: number,
): Resources {
  return { ...res, [key]: Math.max(0, res[key] + amount) };
}
