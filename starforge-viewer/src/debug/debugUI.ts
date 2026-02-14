/**
 * DebugUI — wires up the HTML controls to the viewer state.
 */
import type { ModuleBuilder } from "../builder/moduleBuilder";

export interface DebugUICallbacks {
  onModuleChange: (code: string, tier: number, archetype?: string) => void;
  onToggleConnectors: (show: boolean) => void;
  onToggleAnchors: (show: boolean) => void;
  onToggleWireframe: (show: boolean) => void;
  onToggleAutoRotate: (enabled: boolean) => void;
}

export function initDebugUI(
  builder: ModuleBuilder,
  callbacks: DebugUICallbacks,
): void {
  const moduleSelect = document.getElementById(
    "module-select",
  ) as HTMLSelectElement;
  const tierSelect = document.getElementById(
    "tier-select",
  ) as HTMLSelectElement;
  const archetypeSelect = document.getElementById(
    "archetype-select",
  ) as HTMLSelectElement;
  const showConnectors = document.getElementById(
    "show-connectors",
  ) as HTMLInputElement;
  const showAnchors = document.getElementById(
    "show-anchors",
  ) as HTMLInputElement;
  const showWireframe = document.getElementById(
    "show-wireframe",
  ) as HTMLInputElement;
  const autoRotate = document.getElementById("auto-rotate") as HTMLInputElement;

  // Populate module dropdown — prioritize the 5 target modules
  const priorityOrder = ["BASE", "CUTTER", "MAGDOCK", "WRECK", "SIGNAL"];
  const allCodes = builder.getModuleCodes();
  const sortedCodes = [
    ...priorityOrder.filter((c) => allCodes.includes(c)),
    ...allCodes.filter((c) => !priorityOrder.includes(c)),
  ];

  for (const code of sortedCodes) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.text = `${code}`;
    moduleSelect.appendChild(opt);
  }

  function updateTierSelect(code: string): void {
    tierSelect.innerHTML = "";
    const count = builder.getTierCount(code);
    for (let i = 1; i <= count; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.text = `Tier ${i}`;
      tierSelect.appendChild(opt);
    }
  }

  function updateArchetypeSelect(code: string): void {
    archetypeSelect.innerHTML = "";
    if (builder.isWreck(code)) {
      const archetypes = builder.getArchetypes(code);
      for (const arch of archetypes) {
        const opt = document.createElement("option");
        opt.value = arch;
        opt.text = arch;
        archetypeSelect.appendChild(opt);
      }
      archetypeSelect.disabled = false;
    } else {
      const opt = document.createElement("option");
      opt.value = "";
      opt.text = "N/A";
      archetypeSelect.appendChild(opt);
      archetypeSelect.disabled = true;
    }
  }

  function fireChange(): void {
    const code = moduleSelect.value;
    const tier = parseInt(tierSelect.value) || 1;
    const archetype = archetypeSelect.value || undefined;
    callbacks.onModuleChange(code, tier, archetype);
  }

  moduleSelect.addEventListener("change", () => {
    const code = moduleSelect.value;
    updateTierSelect(code);
    updateArchetypeSelect(code);
    fireChange();
  });

  tierSelect.addEventListener("change", fireChange);
  archetypeSelect.addEventListener("change", fireChange);

  showConnectors.addEventListener("change", () => {
    callbacks.onToggleConnectors(showConnectors.checked);
  });

  showAnchors.addEventListener("change", () => {
    callbacks.onToggleAnchors(showAnchors.checked);
  });

  showWireframe.addEventListener("change", () => {
    callbacks.onToggleWireframe(showWireframe.checked);
  });

  autoRotate.addEventListener("change", () => {
    callbacks.onToggleAutoRotate(autoRotate.checked);
  });

  // Initialize with first module
  if (sortedCodes.length > 0) {
    moduleSelect.value = sortedCodes[0];
    updateTierSelect(sortedCodes[0]);
    updateArchetypeSelect(sortedCodes[0]);
    fireChange();
  }
}
