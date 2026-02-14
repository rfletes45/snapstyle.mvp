/**
 * Starforge Module Spec v1 — TypeScript types
 * Generated from starforge_modules_v1.json schema.
 * This is the SINGLE source of truth for all module definitions.
 */

// ─── Primitives ──────────────────────────────────────────────

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

// ─── Geometry Descriptors ────────────────────────────────────

export interface BoxGeom {
  type: "box";
  size: Vec3;
  segments?: Vec3;
}

export interface CylinderGeom {
  type: "cylinder";
  radius: number;
  height: number;
  radialSegments: number;
  heightSegments?: number;
  openEnded?: boolean;
}

export interface TorusGeom {
  type: "torus";
  radius: number;
  tube: number;
  radialSegments: number;
  tubularSegments: number;
}

export interface PlaneGeom {
  type: "plane";
  size: Vec2;
  doubleSided?: boolean;
  alpha?: number;
}

export interface ConeGeom {
  type: "cone";
  radius: number;
  height: number;
  radialSegments: number;
  openEnded?: boolean;
}

export interface TubeGeom {
  type: "tube";
  points: Vec3[];
  radius: number;
  tubularSegments: number;
  radialSegments: number;
  closed?: boolean;
}

export type GeomDescriptor =
  | BoxGeom
  | CylinderGeom
  | TorusGeom
  | PlaneGeom
  | ConeGeom
  | TubeGeom;

// ─── Materials ───────────────────────────────────────────────

export type MaterialId =
  | "MatMetalDark"
  | "MatMetalLight"
  | "MatPlastic"
  | "MatEmissiveCyan"
  | "MatEmissiveOrange"
  | "MatAnomalyMagenta";

export interface MaterialDef {
  id: MaterialId;
  type: "MeshStandardMaterial";
  params: {
    metalness?: number;
    roughness?: number;
    emissive?: string;
    emissiveIntensity?: number;
  };
}

// ─── Parts ───────────────────────────────────────────────────

export interface PartDef {
  name: string;
  geom?: GeomDescriptor;
  pos: Vec3;
  rot: Vec3;
  mat?: MaterialId | string;
  repeat?: RepeatDef;
  /** Nested part group (e.g. CRANE claw) — no geom, contains children */
  parts?: PartDef[];
}

// ─── Repeat Patterns ─────────────────────────────────────────

export interface RepeatItemDef {
  parts: PartDef[];
}

export interface LinePattern {
  type: "line";
  start: Vec3;
  step: Vec3;
}

export interface GridPattern {
  type: "grid";
  origin: Vec3;
  rows: number;
  cols: number;
  step: Vec3;
}

export interface StackPattern {
  type: "stack";
  start: Vec3;
  step: Vec3;
}

export interface CirclePattern {
  type: "circle";
  center: Vec3;
  radius: number;
  axis?: Vec3;
}

export interface OrbitPattern {
  type: "orbit";
  center: Vec3;
  radius: Vec2 | number;
  height?: Vec2;
  phaseSeed?: number;
}

export interface RandomDiskPattern {
  type: "randomDisk";
  center: Vec3;
  radius: number;
  seed?: number;
}

export interface SinglePattern {
  type: "single";
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
}

export type PatternDef =
  | LinePattern
  | GridPattern
  | StackPattern
  | CirclePattern
  | OrbitPattern
  | RandomDiskPattern
  | SinglePattern;

export interface RepeatDef {
  count: number;
  pattern: PatternDef;
  item: RepeatItemDef;
}

// ─── Decals ──────────────────────────────────────────────────

export type DecalId =
  | "DECAL_PANEL_LINE_A"
  | "DECAL_PANEL_LINE_B"
  | "DECAL_PANEL_LINE_C"
  | "DECAL_WARNING_STRIPE"
  | "DECAL_SERIAL_TEXT"
  | "DECAL_BOLT_CLUSTER"
  | "DECAL_SCRATCHES_LIGHT"
  | "DECAL_SCRATCHES_HEAVY";

export interface DecalDef {
  id: DecalId | string;
  size: Vec2;
  pos: Vec3;
  rot: Vec3;
  normal?: Vec3;
  surface?: string;
}

export interface DecalAtlas {
  atlas: string;
  ids: string[];
}

// ─── Anchors + Connectors ────────────────────────────────────

export interface AnchorDef {
  name: string;
  pos: Vec3;
}

export type ConnectorKind =
  | "powerIn"
  | "powerOut"
  | "pipeIn"
  | "pipeOut"
  | "dataIn"
  | "dataOut";

export interface ConnectorDef {
  name: string;
  pos: Vec3;
  kind: ConnectorKind;
}

export interface ConnectorsDef {
  powerIn: ConnectorDef[];
  powerOut: ConnectorDef[];
  pipeIn: ConnectorDef[];
  pipeOut: ConnectorDef[];
  dataIn: ConnectorDef[];
  dataOut: ConnectorDef[];
}

// ─── Interaction Volumes ─────────────────────────────────────

export interface InteractionVolume {
  type: "box" | "sphere";
  name: string;
  size?: Vec3;
  radius?: number;
  pos: Vec3;
}

// ─── Animations ──────────────────────────────────────────────

export type AnimationType =
  | "rotate"
  | "translate"
  | "swing"
  | "bob"
  | "orbit"
  | "followOrbit"
  | "uvScroll"
  | "pulseEmissive"
  | "chaseEmissive"
  | "blinkRandom"
  | "flicker"
  | "shaderTime"
  | "vibrate"
  | "extend"
  | "sway"
  | "tiltToVector"
  | "bank";

export type TriggerType =
  | "always"
  | "interval"
  | "onClick"
  | "onTap"
  | "onCollect"
  | "onBurst"
  | "onContractComplete";

export interface AnimationDef {
  target: string;
  type: AnimationType;
  trigger: TriggerType;
  params: Record<string, unknown>;
}

// Animation param interfaces for each type
export interface RotateParams {
  axis: Vec3;
  speed: number;
}

export interface TranslateParams {
  by: Vec3;
  duration: number;
  ease?: string;
}

export interface SwingParams {
  axis: Vec3;
  angle: number;
  duration: number;
  ease?: string;
}

export interface BobParams {
  amplitude: number;
  freq: number;
  axis: Vec3;
}

export interface PulseEmissiveParams {
  min: number;
  max: number;
  freq: number;
  phase?: number;
}

export interface ChaseEmissiveParams {
  targets: string[];
  speed: number;
  trailLength: number;
}

export interface BlinkRandomParams {
  onTime: Vec2;
  offTime: Vec2;
  intensity?: number;
}

export interface FlickerParams {
  freq: number;
  min: number;
  max: number;
}

export interface UvScrollParams {
  speed: Vec2;
  axis?: string;
}

export interface OrbitAnimParams {
  center: Vec3;
  radius: number;
  speed: number;
  axis?: Vec3;
}

export interface VibrateParams {
  amplitude: number;
  freq: number;
}

export interface ExtendParams {
  axis: Vec3;
  amount: number;
  duration: number;
}

export interface SwayParams {
  axis: Vec3;
  angle: number;
  freq: number;
}

export interface ShaderTimeParams {
  uniform?: string;
}

export interface TiltToVectorParams {
  target: Vec3;
  speed: number;
}

export interface BankParams {
  maxAngle: number;
  axis: Vec3;
}

// ─── VFX ─────────────────────────────────────────────────────

export type VfxType =
  | "sparks"
  | "smoke"
  | "steamLeak"
  | "steam"
  | "pingWave"
  | "lightningArcs"
  | "debrisCubes"
  | "microSparks"
  | "stampFlash"
  | "emberDrift"
  | "inwardDust"
  | "spiralParticles"
  | "laserBeam"
  | "dataPackets"
  | "magnetBeam"
  | "dustPuff"
  | "scrapChunks"
  | "valvePuff"
  | "grabFlash"
  | "nanoGlitter"
  | "neonSmoke"
  | "paperDust"
  | "receiptPaper"
  | "cutLineDecal"
  | "fragmentOrbit"
  | "runeParticles";

export interface VfxDef {
  type: VfxType | string;
  anchor: string;
  trigger: TriggerType;
  params: Record<string, unknown>;
}

// ─── Prefab Instances ────────────────────────────────────────

export interface PrefabDef {
  parts: PartDef[];
  anchors?: AnchorDef[];
}

export interface PrefabInstanceDef {
  name: string;
  prefab: string;
  count?: number;
  pattern?: PatternDef & { phaseSeed?: number; height?: Vec2 };
  overrides?: Record<string, unknown>;
}

// ─── Weakpoints (WRECK-specific) ─────────────────────────────

export interface WeakpointDef {
  name: string;
  pos: Vec3;
  radius: number;
  reward: string;
}

// ─── Tier Definition ─────────────────────────────────────────

export interface TierDef {
  tier: number;
  basePlate?: PartDef;
  parts: PartDef[];
  decals: DecalDef[];
  animations: AnimationDef[];
  vfx: VfxDef[];
  prefabInstances: PrefabInstanceDef[];
  anchors: AnchorDef[];
  connectors: ConnectorsDef;
  interactionVolumes: InteractionVolume[];
  backgroundInstances?: unknown[];
}

// ─── Wreck Archetype Tiers ───────────────────────────────────

export interface WreckTierDef {
  parts: PartDef[] | string;
  addParts?: PartDef[];
  decals?: DecalDef[];
  addDecals?: DecalDef[];
  weakpoints?: WeakpointDef[];
  weakpointsAdd?: WeakpointDef[];
  fx?: unknown[];
}

export interface WreckArchetypeDef {
  tiers: Record<string, WreckTierDef>;
}

// ─── Module Definition ───────────────────────────────────────

export interface ModuleDef {
  code: string;
  name: string;
  footprint: Vec2;
  category: string;
  placement?: string;
  tiers?: TierDef[];
  archetypes?: Record<string, WreckArchetypeDef>;
  sharedVfx?: VfxDef[];
}

// ─── Top-level Schema ────────────────────────────────────────

export interface StarforgeSpec {
  schemaVersion: string;
  units: {
    tile: number;
    world: string;
    rotation: string;
  };
  style: {
    palette: Record<string, string>;
  };
  materials: MaterialDef[];
  decals: DecalAtlas;
  prefabs: Record<string, PrefabDef>;
  modules: Record<string, ModuleDef>;
  notes?: string[];
}

// ─── Runtime types ───────────────────────────────────────────

export interface BuiltModule {
  group: THREE.Group;
  parts: Map<string, THREE.Object3D>;
  anchors: Map<string, THREE.Object3D>;
  connectors: Map<string, THREE.Object3D>;
  animations: AnimationDef[];
  vfx: VfxDef[];
  interactionVolumes: InteractionVolume[];
  moduleDef: ModuleDef;
  tier: number;
}

// Three.js namespace reference for type usage
import type * as THREE from "three";
