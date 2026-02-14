/**
 * Derived modifiers — aggregates upgrade effects into runtime multipliers.
 * Pure function: (upgradesPurchased, catalog) → DerivedMods.
 * No DOM, no Three.js.
 */
import type { UpgradesCatalog } from "../data/upgradesSchema";
import type { ResourceCaps } from "./types";

// ─── Derived modifier output ────────────────────────────────

export interface DerivedMods {
  /** Multiplicative bonus to tap amount. */
  clickMult: number;
  /** Multiplicative bonus to all machine production. */
  globalProdMult: number;
  /** Per-machine multiplicative production bonus. */
  machineProdMult: Record<string, number>;
  /** Additive cap bonuses (micro-units). */
  capBonusMicro: ResourceCaps;
  /** Per-machine converter efficiency multiplier. */
  converterEfficiency: Record<string, number>;
  /** Per-machine (or "*" wildcard) cost reduction multiplier. */
  costReduction: Record<string, number>;
  /** Additive bonus to contract reveal chance. */
  revealChanceAdd: number;
}

/**
 * Compute derived modifiers from the set of purchased upgrade IDs.
 */
export function computeDerived(
  purchased: readonly string[],
  catalog: UpgradesCatalog,
): DerivedMods {
  const mods: DerivedMods = {
    clickMult: 1,
    globalProdMult: 1,
    machineProdMult: {},
    capBonusMicro: { flux: 0, alloy: 0, signal: 0 },
    converterEfficiency: {},
    costReduction: {},
    revealChanceAdd: 0,
  };

  const purchasedSet = new Set(purchased);

  for (const upg of catalog.upgrades) {
    if (!purchasedSet.has(upg.id)) continue;

    for (const eff of upg.effects) {
      switch (eff.type) {
        case "clickMult":
          mods.clickMult *= eff.mult;
          break;
        case "globalProdMult":
          mods.globalProdMult *= eff.mult;
          break;
        case "machineProdMult":
          mods.machineProdMult[eff.machineCode] =
            (mods.machineProdMult[eff.machineCode] ?? 1) * eff.mult;
          break;
        case "capBonus":
          mods.capBonusMicro[eff.resource] += eff.amountMicro;
          break;
        case "converterEfficiency":
          mods.converterEfficiency[eff.machineCode] =
            (mods.converterEfficiency[eff.machineCode] ?? 1) * eff.mult;
          break;
        case "costReduction":
          mods.costReduction[eff.machineCode] =
            (mods.costReduction[eff.machineCode] ?? 1) * eff.mult;
          break;
        case "revealChanceAdd":
          mods.revealChanceAdd += eff.amount;
          break;
        case "tierUnlock":
          // No runtime modifier — purely a flag check via upgradesPurchased.
          break;
      }
    }
  }

  return mods;
}
