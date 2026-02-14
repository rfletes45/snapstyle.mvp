import * as THREE from "three";
import type { Interactable } from "../types";

export interface MeshOptions {
  name: string;
  category: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  instanceCandidate?: boolean;
  flatShaded?: boolean;
  roughness?: number;
  metalness?: number;
  cullDistanceMultiplier?: number;
  walkableSurface?: boolean;
}

export const TERRAIN_THICKNESS = 2.6;

interface TerrainSlabOptions {
  walkable?: boolean;
  category?: string;
  cullDistanceMultiplier?: number;
}

const MATERIAL_CACHE = new Map<string, THREE.MeshStandardMaterial>();

export function materialFor(
  color: string,
  flatShaded = true,
  roughness = 0.9,
  metalness = 0.03,
): THREE.MeshStandardMaterial {
  const key = `${color}|${flatShaded ? "flat" : "smooth"}|${roughness}|${metalness}`;
  let material = MATERIAL_CACHE.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading: flatShaded,
    });
    MATERIAL_CACHE.set(key, material);
  }
  return material;
}

function configureMesh(mesh: THREE.Mesh, options: MeshOptions): THREE.Mesh {
  mesh.name = options.name;
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  mesh.userData.meshCategory = options.category;
  if (options.instanceCandidate) {
    mesh.userData.instanceCandidate = true;
  }
  if (options.cullDistanceMultiplier !== undefined) {
    mesh.userData.cullDistanceMultiplier = options.cullDistanceMultiplier;
  }
  if (options.walkableSurface) {
    mesh.userData.walkableSurface = true;
  }
  return mesh;
}

export function addBox(
  scene: THREE.Scene,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  options: MeshOptions,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    materialFor(
      color,
      options.flatShaded ?? true,
      options.roughness ?? 0.9,
      options.metalness ?? 0.03,
    ),
  );
  mesh.position.set(position[0], position[1], position[2]);
  configureMesh(mesh, options);
  scene.add(mesh);
  return mesh;
}

export function addDodeca(
  scene: THREE.Scene,
  radius: number,
  position: [number, number, number],
  color: string,
  options: MeshOptions,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(radius, 0),
    materialFor(
      color,
      options.flatShaded ?? true,
      options.roughness ?? 0.9,
      options.metalness ?? 0.03,
    ),
  );
  mesh.position.set(position[0], position[1], position[2]);
  configureMesh(mesh, options);
  scene.add(mesh);
  return mesh;
}

export function addCylinder(
  scene: THREE.Scene,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  position: [number, number, number],
  color: string,
  options: MeshOptions,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    materialFor(
      color,
      options.flatShaded ?? true,
      options.roughness ?? 0.9,
      options.metalness ?? 0.03,
    ),
  );
  mesh.position.set(position[0], position[1], position[2]);
  configureMesh(mesh, options);
  scene.add(mesh);
  return mesh;
}

export function addTerrainSlab(
  scene: THREE.Scene,
  width: number,
  depth: number,
  topY: number,
  x: number,
  z: number,
  color: string,
  name: string,
  options: TerrainSlabOptions = {},
): THREE.Mesh {
  return addBox(
    scene,
    [width, TERRAIN_THICKNESS, depth],
    [x, topY - TERRAIN_THICKNESS * 0.5, z],
    color,
    {
      name,
      category: options.category ?? "terrain",
      castShadow: false,
      receiveShadow: true,
      flatShaded: true,
      cullDistanceMultiplier: options.cullDistanceMultiplier ?? 1.5,
      walkableSurface: options.walkable ?? true,
    },
  );
}

export function addRamp(
  scene: THREE.Scene,
  width: number,
  depth: number,
  fromHeight: number,
  toHeight: number,
  x: number,
  z: number,
  axis: "x" | "z",
  color: string,
  name: string,
): THREE.Mesh {
  // Use same thickness as terrain slabs so no gap is visible underneath.
  const thickness = TERRAIN_THICKNESS;
  const midY = (fromHeight + toHeight) * 0.5;
  const mesh = addBox(
    scene,
    [width, thickness, depth],
    [x, midY - thickness * 0.5, z],
    color,
    {
      name,
      category: "terrain",
      castShadow: false,
      receiveShadow: true,
      flatShaded: true,
      cullDistanceMultiplier: 1.4,
      walkableSurface: true,
    },
  );
  const span = axis === "z" ? depth : width;
  const angle = Math.atan2(toHeight - fromHeight, span);
  if (axis === "z") {
    mesh.rotation.x = -angle;
  } else {
    mesh.rotation.z = angle;
  }
  return mesh;
}

export function addTree(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  // Pseudo-random scale variation from position so each tree looks unique.
  const seed = Math.abs(x * 0.37 + z * 0.53) % 1;
  const trunkScale = 0.88 + seed * 0.24;
  const crownScale = 0.85 + seed * 0.3;
  const trunkH = 2.8 * trunkScale;

  // Tapered bark trunk with visible root flare.
  addCylinder(
    scene,
    0.2 * trunkScale,
    0.38 * trunkScale,
    trunkH,
    6,
    [x, y + trunkH * 0.5, z],
    "#7a4e32",
    {
      name: `${name}_trunk`,
      category: "foliage",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.95,
      roughness: 0.95,
    },
  );
  // Root flare ring at base for grounded look.
  addCylinder(
    scene,
    0.36 * trunkScale,
    0.48 * trunkScale,
    0.22,
    6,
    [x, y + 0.11, z],
    "#6b4228",
    {
      name: `${name}_roots`,
      category: "foliage",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.85,
      roughness: 0.98,
    },
  );

  // Main crown: chunky icosahedron for organic silhouette.
  const crownR = 1.25 * crownScale;
  const crownY = y + trunkH + crownR * 0.6;
  const mainCrown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(crownR, 0),
    materialFor(color, true, 0.92, 0.02),
  );
  mainCrown.position.set(x, crownY, z);
  mainCrown.scale.set(1, 0.78, 0.92);
  mainCrown.rotation.y = seed * Math.PI * 2;
  configureMesh(mainCrown, {
    name: `${name}_crown`,
    category: "foliage",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.95,
  });
  scene.add(mainCrown);

  // Secondary smaller crown sphere offset slightly for fullness.
  const subColor = new THREE.Color(color).offsetHSL(0, 0.03, 0.06);
  const subR = crownR * 0.62;
  const subCrown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(subR, 0),
    materialFor(`#${subColor.getHexString()}`, true, 0.92, 0.02),
  );
  subCrown.position.set(
    x + (seed - 0.5) * crownR * 0.6,
    crownY + crownR * 0.35,
    z + (seed * 0.7 - 0.35) * crownR * 0.5,
  );
  subCrown.rotation.y = seed * Math.PI;
  configureMesh(subCrown, {
    name: `${name}_crown_top`,
    category: "foliage",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
  });
  scene.add(subCrown);
}

export function addPalm(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  // Pseudo-random variation per position.
  const seed = Math.abs(x * 0.29 + z * 0.47) % 1;
  const trunkScale = 0.9 + seed * 0.2;
  const trunkH = 3.6 * trunkScale;
  const leanAngle = 0.04 + seed * 0.08;

  // Slightly curved trunk via two stacked cylinders.
  const lowerH = trunkH * 0.55;
  const upperH = trunkH * 0.5;
  const trunk1 = addCylinder(
    scene,
    0.32 * trunkScale,
    0.46 * trunkScale,
    lowerH,
    6,
    [x, y + lowerH * 0.5, z],
    "#b07040",
    {
      name: `${name}_trunk_lower`,
      category: "foliage",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.95,
      roughness: 0.94,
    },
  );
  trunk1.rotation.z = leanAngle * 0.4;

  const topX = x + Math.sin(leanAngle) * trunkH * 0.45;
  const topY = y + lowerH;
  const trunk2 = addCylinder(
    scene,
    0.24 * trunkScale,
    0.32 * trunkScale,
    upperH,
    6,
    [topX, topY + upperH * 0.5, z],
    "#c08550",
    {
      name: `${name}_trunk_upper`,
      category: "foliage",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.95,
      roughness: 0.94,
    },
  );
  trunk2.rotation.z = leanAngle;

  // Small coconut cluster at crown junction.
  const crownX = topX + Math.sin(leanAngle) * upperH * 0.5;
  const crownY = topY + upperH - 0.1;
  addDodeca(scene, 0.18, [crownX, crownY + 0.05, z], "#8b6914", {
    name: `${name}_coconuts`,
    category: "foliage",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.8,
  });

  // 6 fronds radiating out — each is a thick wedge (box with taper via rotation).
  const frondCount = 6;
  for (let i = 0; i < frondCount; i += 1) {
    const angle = (i / frondCount) * Math.PI * 2 + seed * 0.8;
    const frondLen = (1.8 + seed * 0.4) * trunkScale;
    const frondW = 0.52 * trunkScale;
    const droop = -0.32 - (i % 2) * 0.12;

    const leaf = addBox(
      scene,
      [frondLen, 0.14, frondW],
      [
        crownX + Math.cos(angle) * frondLen * 0.45,
        crownY + 0.12,
        z + Math.sin(angle) * frondLen * 0.45,
      ],
      i % 2 === 0 ? "#1faa4e" : "#26bf58",
      {
        name: `${name}_frond_${i + 1}`,
        category: "foliage",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.95,
      },
    );
    leaf.rotation.y = angle;
    leaf.rotation.x = droop;
    // Leaflet tip: small tapered box at end of frond for natural droop.
    const tipX = crownX + Math.cos(angle) * frondLen * 0.85;
    const tipZ = z + Math.sin(angle) * frondLen * 0.85;
    const tip = addBox(
      scene,
      [frondLen * 0.4, 0.08, frondW * 0.55],
      [tipX, crownY - 0.18, tipZ],
      "#18924a",
      {
        name: `${name}_frond_tip_${i + 1}`,
        category: "foliage",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.85,
      },
    );
    tip.rotation.y = angle;
    tip.rotation.x = droop - 0.45;
  }
}

export function addRock(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  scale: number,
  color: string,
  name: string,
): void {
  const seed = Math.abs(x * 0.17 + z * 0.11) % 1;
  // Main boulder — detail 1 for smoother natural look.
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.95 * scale, 1),
    materialFor(color, true, 0.94, 0.04),
  );
  rock.position.set(x, y + 0.42 * scale, z);
  rock.scale.set(1.0, 0.72, 0.88);
  rock.rotation.y = seed * Math.PI;
  rock.rotation.x = seed * 0.3;
  configureMesh(rock, {
    name,
    category: "rock",
    instanceCandidate: true,
    cullDistanceMultiplier: 1.05,
  });
  scene.add(rock);

  // Small companion pebble for naturalness.
  if (seed > 0.3) {
    const pebbleColor = new THREE.Color(color).offsetHSL(0, -0.02, -0.06);
    const pebble = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.3 * scale, 1),
      materialFor(`#${pebbleColor.getHexString()}`, true, 0.94, 0.04),
    );
    pebble.position.set(
      x + (seed - 0.5) * 1.2 * scale,
      y + 0.14 * scale,
      z + (seed * 0.8 - 0.4) * scale,
    );
    pebble.rotation.y = seed * 2.2;
    configureMesh(pebble, {
      name: `${name}_pebble`,
      category: "rock",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.9,
    });
    scene.add(pebble);
  }
}

export function addShrub(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  const seed = Math.abs(x * 0.43 + z * 0.31) % 1;
  const s = 0.85 + seed * 0.3;

  // Main body: squat dodecahedron for organic rounded shape.
  const body = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.52 * s, 0),
    materialFor(color, true, 0.92, 0.02),
  );
  body.position.set(x, y + 0.38 * s, z);
  body.scale.set(1.15, 0.72, 1.0);
  body.rotation.y = seed * Math.PI * 2;
  configureMesh(body, {
    name: `${name}_body`,
    category: "foliage",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.85,
  });
  scene.add(body);

  // Secondary bump for fullness — slightly offset and lighter.
  const bumpColor = new THREE.Color(color).offsetHSL(0, 0.04, 0.08);
  const bump = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.32 * s, 0),
    materialFor(`#${bumpColor.getHexString()}`, true, 0.92, 0.02),
  );
  bump.position.set(
    x + (seed - 0.5) * 0.3,
    y + 0.52 * s,
    z + (seed * 0.6 - 0.3) * 0.3,
  );
  bump.rotation.y = seed * 1.8;
  configureMesh(bump, {
    name: `${name}_bump`,
    category: "foliage",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.8,
  });
  scene.add(bump);
}

export function addSign(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  const boardBase = new THREE.Color(color);
  const boardFrame = boardBase.clone().offsetHSL(0, -0.08, -0.18);
  const boardInner = boardBase.clone().offsetHSL(0, -0.02, 0.1);
  const boardAccent = boardBase.clone().offsetHSL(0, 0.02, 0.22);

  addCylinder(scene, 0.1, 0.12, 1.26, 6, [x - 0.3, y + 0.63, z], "#7c4a2a", {
    name: `${name}_post_left`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 1,
  });
  addCylinder(scene, 0.1, 0.12, 1.26, 6, [x + 0.3, y + 0.63, z], "#7c4a2a", {
    name: `${name}_post_right`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 1,
  });

  addBox(scene, [0.84, 0.08, 0.16], [x, y + 0.96, z], "#8b5a3c", {
    name: `${name}_crossbar`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 1,
  });

  addBox(
    scene,
    [1.16, 0.7, 0.19],
    [x, y + 1.18, z],
    `#${boardFrame.getHexString()}`,
    {
      name: `${name}_board_frame`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 1,
    },
  );
  addBox(
    scene,
    [0.9, 0.47, 0.1],
    [x, y + 1.18, z + 0.01],
    `#${boardInner.getHexString()}`,
    {
      name: `${name}_board_inner`,
      category: "prop",
      instanceCandidate: true,
      flatShaded: false,
      roughness: 0.72,
      metalness: 0.02,
      cullDistanceMultiplier: 1,
    },
  );
  addBox(scene, [1.24, 0.11, 0.22], [x, y + 1.58, z], "#6f4526", {
    name: `${name}_board_cap`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 1,
  });
  addBox(scene, [1.14, 0.08, 0.22], [x, y + 0.79, z], "#6b4224", {
    name: `${name}_board_sill`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 1,
  });

  const emblem = addCylinder(
    scene,
    0.12,
    0.12,
    0.06,
    12,
    [x, y + 1.19, z + 0.08],
    `#${boardAccent.getHexString()}`,
    {
      name: `${name}_emblem`,
      category: "prop",
      instanceCandidate: true,
      flatShaded: false,
      roughness: 0.58,
      metalness: 0.18,
      cullDistanceMultiplier: 1,
    },
  );
  emblem.rotation.x = Math.PI * 0.5;

  const braceLeft = addBox(
    scene,
    [0.09, 0.42, 0.09],
    [x - 0.22, y + 0.86, z],
    "#7a4a2b",
    {
      name: `${name}_brace_left`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 1,
    },
  );
  braceLeft.rotation.z = -0.46;
  const braceRight = addBox(
    scene,
    [0.09, 0.42, 0.09],
    [x + 0.22, y + 0.86, z],
    "#7a4a2b",
    {
      name: `${name}_brace_right`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 1,
    },
  );
  braceRight.rotation.z = 0.46;
}

export function addReedClump(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  const seed = Math.abs(x * 0.23 + z * 0.41) % 1;
  // 7 stalks in a natural cluster with varied heights and lean angles.
  const offsets: Array<[number, number, number, number]> = [
    [0, 0, 1.0, 0],
    [0.18, -0.12, 0.82, 0.07],
    [-0.2, 0.14, 0.92, -0.06],
    [0.12, 0.22, 0.72, 0.04],
    [-0.1, -0.18, 0.88, -0.08],
    [0.28, 0.06, 0.65, 0.09],
    [-0.26, -0.05, 0.78, -0.05],
  ];

  const darkColor = new THREE.Color(color).offsetHSL(0, -0.04, -0.08);
  for (let idx = 0; idx < offsets.length; idx++) {
    const [ox, oz, hScale, lean] = offsets[idx];
    const h = 0.95 * hScale + seed * 0.2;
    const useColor = idx % 2 === 0 ? color : `#${darkColor.getHexString()}`;
    const stalk = addCylinder(
      scene,
      0.03,
      0.06,
      h,
      5,
      [x + ox, y + h * 0.5, z + oz],
      useColor,
      {
        name: `${name}_stalk_${idx + 1}`,
        category: "foliage",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.8,
      },
    );
    stalk.rotation.z = lean + (seed - 0.5) * 0.04;
    stalk.rotation.x = (idx - 3) * 0.02;

    // Leaf tip at top of taller stalks.
    if (hScale > 0.75) {
      const tipLeaf = addBox(
        scene,
        [0.06, 0.18, 0.22],
        [x + ox, y + h + 0.06, z + oz],
        useColor,
        {
          name: `${name}_tip_${idx + 1}`,
          category: "foliage",
          instanceCandidate: true,
          cullDistanceMultiplier: 0.75,
        },
      );
      tipLeaf.rotation.z = lean * 1.5;
      tipLeaf.rotation.x = -0.25;
    }
  }
}

export function addLanternPost(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  addCylinder(scene, 0.11, 0.14, 1.5, 6, [x, y + 0.75, z], "#7c4a2b", {
    name: `${name}_post`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.95,
    roughness: 0.95,
  });
  // Cap on top of post.
  addCylinder(scene, 0.22, 0.18, 0.12, 6, [x, y + 1.52, z], "#5e3a20", {
    name: `${name}_cap`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
  });
  // Glowing lantern box with emissive.
  const lanternMat = materialFor("#fde68a", false, 0.45, 0);
  lanternMat.emissive = new THREE.Color("#f5c842");
  lanternMat.emissiveIntensity = 0.35;
  const lantern = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    lanternMat,
  );
  lantern.position.set(x, y + 1.73, z);
  lantern.castShadow = true;
  lantern.receiveShadow = true;
  lantern.name = `${name}_lantern`;
  lantern.userData.meshCategory = "prop";
  lantern.userData.instanceCandidate = true;
  lantern.userData.cullDistanceMultiplier = 0.95;
  scene.add(lantern);
}

export function addRopeBridge(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  width: number,
  length: number,
  name: string,
): void {
  addBox(scene, [width, 0.36, length], [x, y + 0.18, z], "#8b6849", {
    name: `${name}_deck`,
    category: "structure",
    cullDistanceMultiplier: 1.1,
    walkableSurface: true,
  });
  addBox(
    scene,
    [width - 0.28, 0.12, length - 0.36],
    [x, y + 0.39, z],
    "#af8a66",
    {
      name: `${name}_plank_layer`,
      category: "structure",
      flatShaded: false,
      cullDistanceMultiplier: 1.1,
      walkableSurface: true,
    },
  );

  const halfW = width * 0.5 - 0.24;
  const halfL = length * 0.5 - 0.45;
  const postRows = [-halfL, -halfL * 0.3, halfL * 0.3, halfL];
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < postRows.length; i += 1) {
      addCylinder(
        scene,
        0.13,
        0.17,
        1.55,
        6,
        [x + side * halfW, y + 0.77, z + postRows[i]],
        "#6f4b33",
        {
          name: `${name}_post_${side > 0 ? "r" : "l"}_${i + 1}`,
          category: "structure",
          instanceCandidate: true,
          cullDistanceMultiplier: 1.1,
        },
      );
    }
  }

  for (const side of [-1, 1] as const) {
    const rope = addCylinder(
      scene,
      0.05,
      0.05,
      length - 0.6,
      6,
      [x + side * halfW, y + 1.38, z],
      "#b8926a",
      {
        name: `${name}_rope_${side > 0 ? "r" : "l"}`,
        category: "structure",
        instanceCandidate: true,
        cullDistanceMultiplier: 1.1,
      },
    );
    rope.rotation.x = Math.PI * 0.5;
  }
}

export function addRodStand(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  accent: string,
  name: string,
): void {
  const rodMainColor = new THREE.Color(accent).offsetHSL(0, -0.06, -0.1);
  const rodTipColor = new THREE.Color(accent).offsetHSL(0, 0.04, 0.2);

  addCylinder(scene, 0.48, 0.56, 0.28, 8, [x, y + 0.14, z], "#7a4c2e", {
    name: `${name}_plinth`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 1,
  });
  addBox(scene, [0.82, 0.12, 0.82], [x, y + 0.32, z], "#8f5a34", {
    name: `${name}_base_plate`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 1,
  });

  addCylinder(scene, 0.09, 0.12, 1.05, 8, [x, y + 0.86, z], "#6f4328", {
    name: `${name}_column`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 1,
  });
  addBox(scene, [0.42, 0.14, 0.22], [x, y + 1.38, z], "#825334", {
    name: `${name}_cradle`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 1,
  });

  const forkLeft = addCylinder(
    scene,
    0.045,
    0.06,
    0.36,
    6,
    [x - 0.11, y + 1.46, z],
    "#6f4328",
    {
      name: `${name}_fork_left`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 1,
    },
  );
  forkLeft.rotation.z = -0.44;
  const forkRight = addCylinder(
    scene,
    0.045,
    0.06,
    0.36,
    6,
    [x + 0.11, y + 1.46, z],
    "#6f4328",
    {
      name: `${name}_fork_right`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 1,
    },
  );
  forkRight.rotation.z = 0.44;

  const butt = addCylinder(
    scene,
    0.04,
    0.055,
    0.96,
    10,
    [x - 0.19, y + 1.27, z + 0.01],
    `#${rodMainColor.getHexString()}`,
    {
      name: `${name}_rod_butt`,
      category: "prop",
      instanceCandidate: true,
      flatShaded: false,
      roughness: 0.5,
      metalness: 0.02,
      cullDistanceMultiplier: 1,
    },
  );
  butt.rotation.z = -0.5;

  const tip = addCylinder(
    scene,
    0.017,
    0.028,
    1.22,
    10,
    [x + 0.33, y + 1.73, z + 0.03],
    `#${rodTipColor.getHexString()}`,
    {
      name: `${name}_rod_tip`,
      category: "prop",
      instanceCandidate: true,
      flatShaded: false,
      roughness: 0.48,
      metalness: 0.06,
      cullDistanceMultiplier: 1,
    },
  );
  tip.rotation.z = -0.58;

  const reel = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.028, 8, 16),
    materialFor("#cbd5e1", false, 0.4, 0.35),
  );
  reel.name = `${name}_reel`;
  reel.position.set(x + 0.04, y + 1.24, z + 0.14);
  reel.rotation.x = Math.PI * 0.5;
  reel.rotation.y = 0.2;
  reel.castShadow = true;
  reel.receiveShadow = true;
  reel.userData.meshCategory = "prop";
  reel.userData.instanceCandidate = true;
  reel.userData.cullDistanceMultiplier = 1;
  scene.add(reel);

  addBox(scene, [0.06, 0.22, 0.06], [x + 0.16, y + 1.26, z + 0.12], "#e2e8f0", {
    name: `${name}_reel_handle`,
    category: "prop",
    instanceCandidate: true,
    flatShaded: false,
    roughness: 0.46,
    metalness: 0.28,
    cullDistanceMultiplier: 1,
  });

  addBox(scene, [0.14, 0.04, 0.04], [x + 0.74, y + 2.02, z + 0.05], "#f8fafc", {
    name: `${name}_rod_hook`,
    category: "prop",
    instanceCandidate: true,
    flatShaded: false,
    roughness: 0.5,
    metalness: 0.2,
    cullDistanceMultiplier: 1,
  });
}

export function addFishingSpotSet(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
  accent: string,
): void {
  addCylinder(scene, 1.5, 1.5, 0.1, 20, [x, y + 0.05, z], "#f8fafc", {
    name: `${name}_stand_ring_base`,
    category: "poi_marker",
    castShadow: false,
    flatShaded: false,
  });
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.09, 8, 24),
    materialFor(accent, false, 0.45, 0),
  );
  ring.name = `${name}_stand_ring`;
  ring.position.set(x, y + 0.12, z);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;
  ring.receiveShadow = true;
  ring.userData.meshCategory = "poi_marker";
  scene.add(ring);

  addSign(scene, x + 1.35, y, z + 0.2, accent, `${name}_fish_sign`);
  addBox(scene, [0.35, 0.25, 0.35], [x - 1.2, y + 0.13, z - 0.22], "#9ca3af", {
    name: `${name}_bucket`,
    category: "prop",
    instanceCandidate: true,
  });
  addBox(scene, [0.45, 0.22, 0.35], [x - 0.84, y + 0.12, z + 0.48], "#fb923c", {
    name: `${name}_tackle_box`,
    category: "prop",
    instanceCandidate: true,
  });
}

// ─── New beach/port detail models ────────────────────────────────

export function addBarrel(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  const seed = Math.abs(x * 0.31 + z * 0.19) % 1;
  // Barrel body — slightly tapered cylinder for cooperage silhouette.
  addCylinder(scene, 0.38, 0.34, 0.92, 10, [x, y + 0.46, z], color, {
    name: `${name}_body`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
    roughness: 0.92,
  });
  // Three metal hoops.
  const hoopColor = "#9ca3af";
  for (const hy of [0.14, 0.46, 0.78]) {
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.37, 0.025, 6, 16),
      materialFor(hoopColor, false, 0.45, 0.32),
    );
    hoop.position.set(x, y + hy, z);
    hoop.rotation.x = Math.PI * 0.5;
    hoop.name = `${name}_hoop_${hy}`;
    hoop.castShadow = false;
    hoop.receiveShadow = true;
    hoop.userData.meshCategory = "prop";
    hoop.userData.instanceCandidate = true;
    hoop.userData.cullDistanceMultiplier = 0.8;
    scene.add(hoop);
  }
  // Lid disc on top.
  addCylinder(scene, 0.35, 0.35, 0.06, 10, [x, y + 0.95, z], "#7a5538", {
    name: `${name}_lid`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.85,
  });
}

export function addDockCrate(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  size: number,
  color: string,
  name: string,
): void {
  const s = size;
  // Main box body.
  addBox(scene, [s, s * 0.82, s], [x, y + s * 0.41, z], color, {
    name: `${name}_body`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
  });
  // Cross-plank accent on front face.
  const plankColor = new THREE.Color(color).offsetHSL(0, -0.04, -0.12);
  addBox(
    scene,
    [s * 0.9, 0.06, s * 0.08],
    [x, y + s * 0.42, z - s * 0.42],
    `#${plankColor.getHexString()}`,
    {
      name: `${name}_plank_h`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.8,
    },
  );
  addBox(
    scene,
    [s * 0.08, s * 0.72, 0.06],
    [x, y + s * 0.38, z - s * 0.42],
    `#${plankColor.getHexString()}`,
    {
      name: `${name}_plank_v`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.8,
    },
  );
  // Rope band on top.
  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(s * 0.35, 0.03, 5, 12),
    materialFor("#bfa078", true, 0.9, 0.02),
  );
  rope.position.set(x, y + s * 0.84, z);
  rope.rotation.x = Math.PI * 0.5;
  rope.name = `${name}_rope`;
  rope.castShadow = false;
  rope.receiveShadow = true;
  rope.userData.meshCategory = "prop";
  rope.userData.instanceCandidate = true;
  rope.userData.cullDistanceMultiplier = 0.75;
  scene.add(rope);
}

export function addBeachUmbrella(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  canopyColor: string,
  name: string,
): void {
  // Pole.
  addCylinder(scene, 0.06, 0.06, 2.6, 6, [x, y + 1.3, z], "#d4d4d8", {
    name: `${name}_pole`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
    roughness: 0.4,
    metalness: 0.25,
  });
  // Canopy — cone geometry for umbrella shape.
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 0.65, 8, 1, true),
    materialFor(canopyColor, true, 0.78, 0.02),
  );
  canopy.position.set(x, y + 2.52, z);
  canopy.name = `${name}_canopy`;
  canopy.castShadow = true;
  canopy.receiveShadow = false;
  canopy.userData.meshCategory = "prop";
  canopy.userData.instanceCandidate = true;
  canopy.userData.cullDistanceMultiplier = 0.95;
  scene.add(canopy);
  // Stripe accent ring around canopy bottom edge.
  const stripe = new THREE.Color(canopyColor).offsetHSL(0, 0.08, 0.18);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.05, 5, 16),
    materialFor(`#${stripe.getHexString()}`, false, 0.7, 0.02),
  );
  ring.position.set(x, y + 2.22, z);
  ring.rotation.x = Math.PI * 0.5;
  ring.name = `${name}_stripe`;
  ring.castShadow = false;
  ring.receiveShadow = true;
  ring.userData.meshCategory = "prop";
  ring.userData.instanceCandidate = true;
  ring.userData.cullDistanceMultiplier = 0.85;
  scene.add(ring);
  // Finial knob on top.
  addDodeca(scene, 0.08, [x, y + 2.88, z], "#f8fafc", {
    name: `${name}_finial`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.8,
  });
}

export function addTikiTorch(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  // Bamboo stake — two-tone cylinder.
  addCylinder(scene, 0.08, 0.12, 1.8, 6, [x, y + 0.9, z], "#b07040", {
    name: `${name}_stake`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
    roughness: 0.94,
  });
  // Node rings on bamboo.
  for (const ny of [0.5, 1.0, 1.5]) {
    addCylinder(scene, 0.1, 0.1, 0.04, 6, [x, y + ny, z], "#9a6030", {
      name: `${name}_node_${ny}`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.8,
    });
  }
  // Fuel cup at top.
  addCylinder(scene, 0.18, 0.14, 0.22, 8, [x, y + 1.88, z], "#5a3a1e", {
    name: `${name}_cup`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.85,
  });
  // Flame — emissive dodecahedron.
  const flameMat = materialFor("#fbbf24", true, 0.6, 0);
  flameMat.emissive = new THREE.Color("#f97316");
  flameMat.emissiveIntensity = 0.5;
  const flame = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.14, 0),
    flameMat,
  );
  flame.position.set(x, y + 2.1, z);
  flame.name = `${name}_flame`;
  flame.castShadow = false;
  flame.receiveShadow = false;
  flame.userData.meshCategory = "prop";
  flame.userData.instanceCandidate = true;
  flame.userData.cullDistanceMultiplier = 0.9;
  scene.add(flame);
}

export function addBoatHull(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  rotY: number,
  name: string,
): void {
  // Hull body — stretched box, slightly tapered look via non-uniform scale.
  const hull = addBox(scene, [3.6, 0.62, 1.4], [x, y + 0.31, z], "#8b6849", {
    name: `${name}_hull`,
    category: "prop",
    cullDistanceMultiplier: 1.1,
  });
  hull.rotation.y = rotY;
  // Bow wedge — narrower box at front.
  const bow = addBox(
    scene,
    [0.9, 0.48, 0.7],
    [x + Math.cos(rotY) * 1.9, y + 0.24, z + Math.sin(rotY) * 1.9],
    "#7a5538",
    {
      name: `${name}_bow`,
      category: "prop",
      cullDistanceMultiplier: 1.05,
    },
  );
  bow.rotation.y = rotY;
  // Stern transom.
  const stern = addBox(
    scene,
    [0.14, 0.52, 1.3],
    [x - Math.cos(rotY) * 1.7, y + 0.28, z - Math.sin(rotY) * 1.7],
    "#6f4b33",
    {
      name: `${name}_stern`,
      category: "prop",
      cullDistanceMultiplier: 1.05,
    },
  );
  stern.rotation.y = rotY;
  // Seat plank.
  const seat = addBox(scene, [0.14, 0.08, 1.1], [x, y + 0.58, z], "#af8a66", {
    name: `${name}_seat`,
    category: "prop",
    cullDistanceMultiplier: 1.0,
  });
  seat.rotation.y = rotY;
  // Gunwale rails (port & starboard).
  for (const side of [-1, 1] as const) {
    const railX = x + Math.sin(rotY) * side * 0.62;
    const railZ = z + Math.cos(rotY) * side * 0.62;
    const rail = addBox(
      scene,
      [3.2, 0.18, 0.1],
      [railX, y + 0.62, railZ],
      "#7a5538",
      {
        name: `${name}_rail_${side > 0 ? "s" : "p"}`,
        category: "prop",
        instanceCandidate: true,
        cullDistanceMultiplier: 1.0,
      },
    );
    rail.rotation.y = rotY;
  }
}

export function addFountain(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  // Base basin — wide shallow cylinder.
  addCylinder(scene, 1.6, 1.8, 0.42, 12, [x, y + 0.21, z], "#d1d5db", {
    name: `${name}_basin`,
    category: "structure",
    cullDistanceMultiplier: 1.1,
    roughness: 0.82,
    metalness: 0.05,
  });
  // Basin rim detail.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.65, 0.1, 6, 20),
    materialFor("#b0b4ba", true, 0.78, 0.08),
  );
  rim.position.set(x, y + 0.44, z);
  rim.rotation.x = Math.PI * 0.5;
  rim.name = `${name}_rim`;
  rim.castShadow = true;
  rim.receiveShadow = true;
  rim.userData.meshCategory = "structure";
  rim.userData.cullDistanceMultiplier = 1.05;
  scene.add(rim);
  // Water inside basin — flat disc.
  const waterMat = materialFor("#7dd3fc", false, 0.18, 0.05);
  const waterDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.45, 0.06, 16),
    waterMat,
  );
  waterDisc.position.set(x, y + 0.38, z);
  waterDisc.name = `${name}_water`;
  waterDisc.castShadow = false;
  waterDisc.receiveShadow = true;
  waterDisc.userData.meshCategory = "water";
  waterDisc.userData.cullDistanceMultiplier = 1.0;
  scene.add(waterDisc);
  // Center pedestal column.
  addCylinder(scene, 0.22, 0.32, 1.1, 8, [x, y + 0.95, z], "#c4c8cc", {
    name: `${name}_pedestal`,
    category: "structure",
    cullDistanceMultiplier: 1.05,
    roughness: 0.76,
    metalness: 0.08,
  });
  // Upper bowl.
  addCylinder(scene, 0.65, 0.48, 0.24, 10, [x, y + 1.52, z], "#cfd3d8", {
    name: `${name}_upper_bowl`,
    category: "structure",
    cullDistanceMultiplier: 1.05,
    roughness: 0.78,
    metalness: 0.06,
  });
  // Upper water disc.
  const upperWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.04, 12),
    waterMat,
  );
  upperWater.position.set(x, y + 1.62, z);
  upperWater.name = `${name}_upper_water`;
  upperWater.castShadow = false;
  upperWater.receiveShadow = true;
  upperWater.userData.meshCategory = "water";
  upperWater.userData.cullDistanceMultiplier = 0.95;
  scene.add(upperWater);
  // Spout finial.
  addDodeca(scene, 0.14, [x, y + 1.82, z], "#b0b4ba", {
    name: `${name}_finial`,
    category: "structure",
    cullDistanceMultiplier: 1.0,
    roughness: 0.7,
    metalness: 0.1,
  });
}

export function addBench(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  rotY: number,
  color: string,
  name: string,
): void {
  const legColor = new THREE.Color(color).offsetHSL(0, -0.04, -0.16);
  const legHex = `#${legColor.getHexString()}`;
  // Seat plank.
  const seat = addBox(scene, [1.6, 0.1, 0.52], [x, y + 0.48, z], color, {
    name: `${name}_seat`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
  });
  seat.rotation.y = rotY;
  // Backrest.
  const back = addBox(scene, [1.6, 0.52, 0.08], [x, y + 0.78, z], color, {
    name: `${name}_back`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
  });
  back.rotation.y = rotY;
  // Four legs.
  const offsets: Array<[number, number]> = [
    [-0.62, -0.18],
    [0.62, -0.18],
    [-0.62, 0.18],
    [0.62, 0.18],
  ];
  for (let i = 0; i < offsets.length; i++) {
    const [ox, oz] = offsets[i];
    const lx = x + Math.cos(rotY) * ox - Math.sin(rotY) * oz;
    const lz = z + Math.sin(rotY) * ox + Math.cos(rotY) * oz;
    addBox(scene, [0.08, 0.48, 0.08], [lx, y + 0.24, lz], legHex, {
      name: `${name}_leg_${i}`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.8,
    });
  }
  // Armrests at ends.
  for (const side of [-1, 1] as const) {
    const ax = x + Math.cos(rotY) * side * 0.72;
    const az = z + Math.sin(rotY) * side * 0.72;
    addBox(scene, [0.08, 0.08, 0.42], [ax, y + 0.62, az], legHex, {
      name: `${name}_arm_${side > 0 ? "r" : "l"}`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.8,
    });
  }
}

export function addFlowerBox(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  rotY: number,
  name: string,
): void {
  // Wooden planter box.
  addBox(scene, [1.1, 0.32, 0.36], [x, y + 0.16, z], "#8b6849", {
    name: `${name}_planter`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.85,
  });
  // Soil inside.
  addBox(scene, [0.96, 0.06, 0.28], [x, y + 0.34, z], "#614a2c", {
    name: `${name}_soil`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.75,
  });
  // 4 flower heads — small coloured dodecahedrons poking up.
  const flowerColors = ["#f472b6", "#fbbf24", "#a78bfa", "#fb923c"];
  for (let i = 0; i < 4; i++) {
    const ox = (i - 1.5) * 0.22;
    const bloom = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.07, 0),
      materialFor(flowerColors[i], true, 0.72, 0.02),
    );
    bloom.position.set(
      x + Math.cos(rotY) * ox,
      y + 0.42,
      z + Math.sin(rotY) * ox,
    );
    bloom.name = `${name}_bloom_${i}`;
    bloom.castShadow = false;
    bloom.receiveShadow = true;
    bloom.userData.meshCategory = "foliage";
    bloom.userData.instanceCandidate = true;
    bloom.userData.cullDistanceMultiplier = 0.7;
    scene.add(bloom);
    // Stem.
    addCylinder(
      scene,
      0.015,
      0.015,
      0.14,
      4,
      [x + Math.cos(rotY) * ox, y + 0.36, z + Math.sin(rotY) * ox],
      "#4ade80",
      {
        name: `${name}_stem_${i}`,
        category: "foliage",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.65,
      },
    );
  }
}

export function addAnchor(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  scale: number,
  name: string,
): void {
  const s = scale;
  const col = "#525252";
  // Shank (vertical bar).
  addBox(scene, [0.1 * s, 1.2 * s, 0.1 * s], [x, y + 0.6 * s, z], col, {
    name: `${name}_shank`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
    roughness: 0.6,
    metalness: 0.35,
  });
  // Crown (bottom curved arm) — two angled boxes.
  for (const side of [-1, 1] as const) {
    const arm = addBox(
      scene,
      [0.52 * s, 0.09 * s, 0.09 * s],
      [x + side * 0.22 * s, y + 0.1 * s, z],
      col,
      {
        name: `${name}_arm_${side > 0 ? "r" : "l"}`,
        category: "prop",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.85,
        roughness: 0.6,
        metalness: 0.35,
      },
    );
    arm.rotation.z = side * 0.45;
    // Fluke tips.
    const fluke = addBox(
      scene,
      [0.14 * s, 0.22 * s, 0.08 * s],
      [x + side * 0.42 * s, y + 0.04 * s, z],
      col,
      {
        name: `${name}_fluke_${side > 0 ? "r" : "l"}`,
        category: "prop",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.8,
        roughness: 0.6,
        metalness: 0.35,
      },
    );
    fluke.rotation.z = side * 0.3;
  }
  // Stock (horizontal cross bar near top).
  addBox(scene, [0.55 * s, 0.08 * s, 0.08 * s], [x, y + 1.05 * s, z], col, {
    name: `${name}_stock`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.85,
    roughness: 0.6,
    metalness: 0.35,
  });
  // Ring at top.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.1 * s, 0.025 * s, 6, 12),
    materialFor(col, false, 0.55, 0.4),
  );
  ring.position.set(x, y + 1.24 * s, z);
  ring.name = `${name}_ring`;
  ring.castShadow = true;
  ring.receiveShadow = true;
  ring.userData.meshCategory = "prop";
  ring.userData.instanceCandidate = true;
  ring.userData.cullDistanceMultiplier = 0.8;
  scene.add(ring);
}

export function addLifebuoy(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  // Post to hang on.
  addCylinder(scene, 0.06, 0.08, 1.1, 6, [x, y + 0.55, z], "#7c4a2b", {
    name: `${name}_post`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.85,
  });
  // Hook peg.
  addBox(scene, [0.15, 0.06, 0.06], [x + 0.07, y + 1.02, z], "#9ca3af", {
    name: `${name}_hook`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.75,
    roughness: 0.5,
    metalness: 0.3,
  });
  // Lifebuoy torus — red/white striped look via two tori.
  const buoy = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.08, 8, 16),
    materialFor("#ef4444", false, 0.65, 0.04),
  );
  buoy.position.set(x + 0.06, y + 0.92, z);
  buoy.name = `${name}_buoy`;
  buoy.castShadow = true;
  buoy.receiveShadow = true;
  buoy.userData.meshCategory = "prop";
  buoy.userData.instanceCandidate = true;
  buoy.userData.cullDistanceMultiplier = 0.9;
  scene.add(buoy);
  // White stripe accent — slightly larger inner torus.
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.045, 6, 16),
    materialFor("#f8fafc", false, 0.6, 0.02),
  );
  stripe.position.set(x + 0.06, y + 0.92, z);
  stripe.rotation.z = Math.PI * 0.25;
  stripe.name = `${name}_stripe`;
  stripe.castShadow = false;
  stripe.receiveShadow = true;
  stripe.userData.meshCategory = "prop";
  stripe.userData.instanceCandidate = true;
  stripe.userData.cullDistanceMultiplier = 0.85;
  scene.add(stripe);
}

export function addDuneGrass(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  // Cluster of thin tall blades — like sea oats / dune grass.
  const seed = Math.abs(x * 0.41 + z * 0.29) % 1;
  const bladeCount = 5 + Math.floor(seed * 3);
  for (let i = 0; i < bladeCount; i++) {
    const angle = (i / bladeCount) * Math.PI * 2 + seed * 1.2;
    const dist = 0.08 + (i % 3) * 0.06;
    const h = 0.45 + (i % 2) * 0.2 + seed * 0.15;
    const lean = 0.12 + (i % 3) * 0.06;
    const blade = addCylinder(
      scene,
      0.015,
      0.03,
      h,
      4,
      [x + Math.cos(angle) * dist, y + h * 0.5, z + Math.sin(angle) * dist],
      i % 2 === 0 ? "#c8b888" : "#d4c494",
      {
        name: `${name}_blade_${i}`,
        category: "foliage",
        castShadow: false,
        instanceCandidate: true,
        cullDistanceMultiplier: 0.6,
      },
    );
    blade.rotation.z = Math.cos(angle) * lean;
    blade.rotation.x = Math.sin(angle) * lean;
  }
}

export function addSurfboard(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  rotY: number,
  name: string,
): void {
  // Main board body — elongated flat box.
  const board = addBox(scene, [2.2, 0.1, 0.48], [x, y + 0.82, z], color, {
    name: `${name}_board`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.95,
    flatShaded: false,
    roughness: 0.55,
    metalness: 0.02,
  });
  board.rotation.y = rotY;
  board.rotation.z = 1.2; // Lean against something.
  // Fin underneath.
  const fin = addBox(
    scene,
    [0.2, 0.16, 0.04],
    [x - 0.7 * Math.cos(rotY), y + 0.52, z - 0.7 * Math.sin(rotY)],
    "#1e40af",
    {
      name: `${name}_fin`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.8,
    },
  );
  fin.rotation.y = rotY;
  fin.rotation.z = 1.2;
  // Stripe decal.
  const stripe = new THREE.Color(color).offsetHSL(0, 0.1, 0.2);
  const decal = addBox(
    scene,
    [0.7, 0.02, 0.32],
    [x + 0.15 * Math.cos(rotY), y + 0.88, z + 0.15 * Math.sin(rotY)],
    `#${stripe.getHexString()}`,
    {
      name: `${name}_stripe`,
      category: "prop",
      instanceCandidate: true,
      flatShaded: false,
      cullDistanceMultiplier: 0.8,
    },
  );
  decal.rotation.y = rotY;
  decal.rotation.z = 1.2;
}

export function addWoodenFence(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  length: number,
  rotY: number,
  name: string,
): void {
  const postCount = Math.max(2, Math.floor(length / 1.4) + 1);
  const spacing = length / (postCount - 1);
  const dx = Math.cos(rotY);
  const dz = Math.sin(rotY);

  for (let i = 0; i < postCount; i++) {
    const px = x + dx * (i * spacing - length * 0.5);
    const pz = z + dz * (i * spacing - length * 0.5);
    const h = 0.82 + (i % 2) * 0.08;
    addCylinder(scene, 0.06, 0.08, h, 5, [px, y + h * 0.5, pz], "#7a5538", {
      name: `${name}_post_${i}`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.85,
    });
  }
  // Two horizontal rails.
  for (const ry of [0.35, 0.65]) {
    const rail = addBox(
      scene,
      [length, 0.08, 0.06],
      [x, y + ry, z],
      "#8b6849",
      {
        name: `${name}_rail_${ry}`,
        category: "prop",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.85,
      },
    );
    rail.rotation.y = rotY;
  }
}

export function addInteractMarker(
  scene: THREE.Scene,
  interactable: Interactable,
): void {
  const colorByType: Record<Interactable["type"], string> = {
    fishing_spot: "#2dd4bf",
    sell_stand: "#fbbf24",
    rod_shop: "#93c5fd",
    bait_shop: "#86efac",
    gate: "#fca5a5",
    zone_rod_pickup: "#f59e0b",
    challenge_start: "#a78bfa",
    quest_board: "#fb7185",
    npc_hint: "#60a5fa",
    puzzle_pillar: "#67e8f9",
    relic_pickup: "#fde047",
  };

  const base = addCylinder(
    scene,
    0.42,
    0.42,
    0.14,
    16,
    [
      interactable.position.x,
      interactable.position.y + 0.07,
      interactable.position.z,
    ],
    "#f8fafc",
    {
      name: `poi_${interactable.id}_base`,
      category: "poi_marker",
      castShadow: false,
      receiveShadow: true,
      flatShaded: false,
      cullDistanceMultiplier: 0.8,
    },
  );
  base.userData.poiMarker = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.04, 8, 24),
    materialFor(colorByType[interactable.type], false),
  );
  ring.name = `poi_${interactable.id}_ring`;
  ring.position.set(
    interactable.position.x,
    interactable.position.y + 0.14,
    interactable.position.z,
  );
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;
  ring.receiveShadow = true;
  ring.userData.meshCategory = "poi_marker";
  ring.userData.poiMarker = true;
  ring.userData.cullDistanceMultiplier = 0.8;
  scene.add(ring);
}

// ─── River-specific prop models ──────────────────────────────────

export function addBambooClump(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  const seed = Math.abs(x * 0.33 + z * 0.47) % 1;
  const stalkCount = 5 + Math.floor(seed * 4);

  for (let i = 0; i < stalkCount; i++) {
    const angle = (i / stalkCount) * Math.PI * 2 + seed * 1.5;
    const dist = 0.1 + (i % 3) * 0.12;
    const h = 3.2 + seed * 1.2 + (i % 2) * 0.6;
    const lean = 0.03 + (i % 3) * 0.02;
    const bambooColor = i % 2 === 0 ? "#6b9b3a" : "#7aac48";

    const stalk = addCylinder(
      scene,
      0.06,
      0.08,
      h,
      6,
      [x + Math.cos(angle) * dist, y + h * 0.5, z + Math.sin(angle) * dist],
      bambooColor,
      {
        name: `${name}_stalk_${i}`,
        category: "foliage",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.95,
        roughness: 0.88,
      },
    );
    stalk.rotation.z = Math.cos(angle) * lean;
    stalk.rotation.x = Math.sin(angle) * lean;

    // Node rings on bamboo for segmented look.
    const nodeCount = Math.floor(h / 0.8);
    for (let n = 1; n < nodeCount; n++) {
      const ny = n * 0.8 + seed * 0.2;
      if (ny < h - 0.3) {
        addCylinder(
          scene,
          0.075,
          0.075,
          0.05,
          6,
          [x + Math.cos(angle) * dist, y + ny, z + Math.sin(angle) * dist],
          "#5a8a2e",
          {
            name: `${name}_node_${i}_${n}`,
            category: "foliage",
            instanceCandidate: true,
            cullDistanceMultiplier: 0.75,
          },
        );
      }
    }

    // Leaf sprays at top of alternating stalks.
    if (i % 2 === 0) {
      for (let l = 0; l < 3; l++) {
        const la = angle + (l - 1) * 0.8;
        const leaf = addBox(
          scene,
          [0.6, 0.04, 0.15],
          [
            x + Math.cos(angle) * dist + Math.cos(la) * 0.3,
            y + h - 0.2 + l * 0.1,
            z + Math.sin(angle) * dist + Math.sin(la) * 0.3,
          ],
          "#4a8a2a",
          {
            name: `${name}_leaf_${i}_${l}`,
            category: "foliage",
            instanceCandidate: true,
            cullDistanceMultiplier: 0.8,
          },
        );
        leaf.rotation.y = la;
        leaf.rotation.x = -0.3 - l * 0.15;
      }
    }
  }
}

export function addLilyPadCluster(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  const seed = Math.abs(x * 0.27 + z * 0.39) % 1;
  const padCount = 3 + Math.floor(seed * 3);

  for (let i = 0; i < padCount; i++) {
    const angle = (i / padCount) * Math.PI * 2 + seed * 2;
    const dist = 0.3 + i * 0.25;
    const padSize = 0.22 + (i % 2) * 0.12 + seed * 0.08;

    const pad = addCylinder(
      scene,
      padSize,
      padSize,
      0.03,
      8,
      [x + Math.cos(angle) * dist, y + 0.01, z + Math.sin(angle) * dist],
      i % 3 === 0 ? "#2d8a4e" : "#3a9d5a",
      {
        name: `${name}_pad_${i}`,
        category: "foliage",
        castShadow: false,
        instanceCandidate: true,
        cullDistanceMultiplier: 0.7,
        roughness: 0.75,
      },
    );
    pad.rotation.y = seed * Math.PI + i * 0.7;

    // Occasional flower on pad.
    if (i % 3 === 0) {
      const flower = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.06, 0),
        materialFor(i % 2 === 0 ? "#f472b6" : "#fbbf24", true, 0.7, 0.02),
      );
      flower.position.set(
        x + Math.cos(angle) * dist,
        y + 0.06,
        z + Math.sin(angle) * dist,
      );
      flower.name = `${name}_flower_${i}`;
      flower.castShadow = false;
      flower.receiveShadow = true;
      flower.userData.meshCategory = "foliage";
      flower.userData.instanceCandidate = true;
      flower.userData.cullDistanceMultiplier = 0.6;
      scene.add(flower);
    }
  }
}

export function addFallenLog(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  length: number,
  rotY: number,
  name: string,
): void {
  const seed = Math.abs(x * 0.19 + z * 0.37) % 1;
  const logRadius = 0.22 + seed * 0.1;

  const log = addCylinder(
    scene,
    logRadius * 0.85,
    logRadius,
    length,
    8,
    [x, y + logRadius, z],
    "#6b4224",
    {
      name: `${name}_body`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 1.0,
      roughness: 0.95,
    },
  );
  log.rotation.z = Math.PI * 0.5;
  log.rotation.y = rotY;

  // Bark rings along the log.
  for (let r = 0; r < Math.floor(length / 0.6); r++) {
    const rx = -length * 0.4 + r * 0.6;
    const ring = addCylinder(
      scene,
      logRadius * 0.9 + 0.02,
      logRadius + 0.02,
      0.06,
      8,
      [x + Math.cos(rotY) * rx, y + logRadius, z + Math.sin(rotY) * rx],
      "#5a3618",
      {
        name: `${name}_ring_${r}`,
        category: "prop",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.8,
      },
    );
    ring.rotation.z = Math.PI * 0.5;
    ring.rotation.y = rotY;
  }

  // Root stump at one end.
  const endX = x + Math.cos(rotY) * length * 0.48;
  const endZ = z + Math.sin(rotY) * length * 0.48;
  addCylinder(
    scene,
    logRadius * 1.3,
    logRadius * 1.1,
    0.15,
    8,
    [endX, y + logRadius, endZ],
    "#5a3618",
    {
      name: `${name}_stump`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.85,
    },
  );

  // Moss accent on the log.
  if (seed > 0.3) {
    const mossX = x + Math.cos(rotY) * length * 0.15;
    const mossZ = z + Math.sin(rotY) * length * 0.15;
    addBox(
      scene,
      [0.35, 0.04, 0.2],
      [mossX, y + logRadius * 1.95, mossZ],
      "#4d8a3a",
      {
        name: `${name}_moss`,
        category: "foliage",
        castShadow: false,
        instanceCandidate: true,
        cullDistanceMultiplier: 0.65,
      },
    );
  }
}

export function addMushroomCluster(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  const seed = Math.abs(x * 0.22 + z * 0.44) % 1;
  const count = 3 + Math.floor(seed * 3);
  const colors = ["#e07848", "#d4a83c", "#c8865a", "#e8a262", "#d09448"];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + seed * 1.8;
    const dist = 0.06 + i * 0.09;
    const stemH = 0.12 + seed * 0.08 + (i % 2) * 0.06;
    const capR = 0.06 + seed * 0.04 + (i % 2) * 0.03;
    const mx = x + Math.cos(angle) * dist;
    const mz = z + Math.sin(angle) * dist;

    addCylinder(
      scene,
      0.02,
      0.025,
      stemH,
      5,
      [mx, y + stemH * 0.5, mz],
      "#f0e8d0",
      {
        name: `${name}_stem_${i}`,
        category: "foliage",
        castShadow: false,
        instanceCandidate: true,
        cullDistanceMultiplier: 0.55,
      },
    );

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(capR, capR * 0.6, 6),
      materialFor(colors[i % colors.length], true, 0.8, 0.02),
    );
    cap.position.set(mx, y + stemH + capR * 0.15, mz);
    cap.name = `${name}_cap_${i}`;
    cap.castShadow = false;
    cap.receiveShadow = true;
    cap.userData.meshCategory = "foliage";
    cap.userData.instanceCandidate = true;
    cap.userData.cullDistanceMultiplier = 0.55;
    scene.add(cap);
  }
}

export function addHangingVine(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  hangLength: number,
  name: string,
): void {
  const seed = Math.abs(x * 0.35 + z * 0.21) % 1;
  const strandCount = 3 + Math.floor(seed * 2);

  for (let i = 0; i < strandCount; i++) {
    const ox = (i - strandCount * 0.5) * 0.18;
    const oz = (seed - 0.5) * 0.12 * i;
    const h = hangLength * (0.7 + (i % 2) * 0.3);
    const vineColor = i % 2 === 0 ? "#3d7a28" : "#4a8c34";

    addCylinder(
      scene,
      0.02,
      0.028,
      h,
      4,
      [x + ox, y - h * 0.5, z + oz],
      vineColor,
      {
        name: `${name}_strand_${i}`,
        category: "foliage",
        castShadow: false,
        instanceCandidate: true,
        cullDistanceMultiplier: 0.8,
      },
    );

    const leafCount = Math.floor(h / 0.3);
    for (let l = 0; l < leafCount; l++) {
      const ly = y - l * 0.3 - 0.15;
      const side = l % 2 === 0 ? 1 : -1;
      addBox(
        scene,
        [0.12, 0.02, 0.05],
        [x + ox + side * 0.06, ly, z + oz],
        "#3a8228",
        {
          name: `${name}_leaf_${i}_${l}`,
          category: "foliage",
          castShadow: false,
          instanceCandidate: true,
          cullDistanceMultiplier: 0.6,
        },
      );
    }
  }
}

export function addSteppingStone(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  scale: number,
  name: string,
): void {
  const seed = Math.abs(x * 0.26 + z * 0.38) % 1;

  const stone = addCylinder(
    scene,
    0.55 * scale,
    0.6 * scale,
    0.18 * scale,
    7,
    [x, y + 0.09 * scale, z],
    "#7d8a78",
    {
      name: `${name}_stone`,
      category: "structure",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.95,
      walkableSurface: true,
    },
  );
  stone.rotation.y = seed * Math.PI;

  if (seed > 0.4) {
    addCylinder(
      scene,
      0.2 * scale,
      0.25 * scale,
      0.03,
      6,
      [x + 0.08, y + 0.19 * scale, z - 0.06],
      "#5d8a48",
      {
        name: `${name}_moss`,
        category: "foliage",
        castShadow: false,
        instanceCandidate: true,
        cullDistanceMultiplier: 0.7,
      },
    );
  }
}

export function addCampfire(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  // Stone ring.
  const stoneCount = 8;
  for (let i = 0; i < stoneCount; i++) {
    const angle = (i / stoneCount) * Math.PI * 2;
    const stoneR = 0.65;
    addDodeca(
      scene,
      0.12 + (i % 2) * 0.03,
      [x + Math.cos(angle) * stoneR, y + 0.08, z + Math.sin(angle) * stoneR],
      i % 2 === 0 ? "#7d8a78" : "#6b7a6e",
      {
        name: `${name}_stone_${i}`,
        category: "prop",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.75,
      },
    );
  }

  // Ash/char ground.
  addCylinder(scene, 0.5, 0.5, 0.04, 10, [x, y + 0.02, z], "#3a3a3a", {
    name: `${name}_ash_patch`,
    category: "prop",
    castShadow: false,
    instanceCandidate: true,
    cullDistanceMultiplier: 0.7,
  });

  // Crossed logs in fire.
  for (let l = 0; l < 3; l++) {
    const la = l * 1.05;
    const flog = addCylinder(
      scene,
      0.04,
      0.055,
      0.6,
      5,
      [x, y + 0.12, z],
      "#5a3618",
      {
        name: `${name}_log_${l}`,
        category: "prop",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.7,
      },
    );
    flog.rotation.z = Math.PI * 0.5;
    flog.rotation.y = la;
    flog.rotation.x = 0.15;
  }

  // Flame — emissive dodecahedron.
  const flameMat = materialFor("#fbbf24", true, 0.6, 0);
  flameMat.emissive = new THREE.Color("#f97316");
  flameMat.emissiveIntensity = 0.6;
  const flame = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.18, 0),
    flameMat,
  );
  flame.position.set(x, y + 0.28, z);
  flame.name = `${name}_flame`;
  flame.castShadow = false;
  flame.receiveShadow = false;
  flame.userData.meshCategory = "prop";
  flame.userData.instanceCandidate = true;
  flame.userData.cullDistanceMultiplier = 0.85;
  scene.add(flame);

  // Secondary flame tip.
  const flame2Mat = materialFor("#ef4444", true, 0.6, 0);
  flame2Mat.emissive = new THREE.Color("#dc2626");
  flame2Mat.emissiveIntensity = 0.45;
  const flame2 = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.1, 0),
    flame2Mat,
  );
  flame2.position.set(x + 0.08, y + 0.38, z - 0.05);
  flame2.name = `${name}_flame_tip`;
  flame2.castShadow = false;
  flame2.receiveShadow = false;
  flame2.userData.meshCategory = "prop";
  flame2.userData.instanceCandidate = true;
  flame2.userData.cullDistanceMultiplier = 0.8;
  scene.add(flame2);
}

export function addCanopyTree(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  const seed = Math.abs(x * 0.31 + z * 0.49) % 1;
  const trunkScale = 0.95 + seed * 0.2;
  const trunkH = 4.5 * trunkScale;

  // Thick trunk with buttress roots.
  addCylinder(
    scene,
    0.28 * trunkScale,
    0.52 * trunkScale,
    trunkH,
    6,
    [x, y + trunkH * 0.5, z],
    "#5a3e28",
    {
      name: `${name}_trunk`,
      category: "foliage",
      instanceCandidate: true,
      cullDistanceMultiplier: 1.1,
      roughness: 0.96,
    },
  );

  // Buttress roots — 3 angled trusses at base.
  for (let r = 0; r < 3; r++) {
    const ra = (r / 3) * Math.PI * 2 + seed * 0.8;
    const root = addBox(
      scene,
      [0.1, 0.6, 0.5],
      [x + Math.cos(ra) * 0.35, y + 0.3, z + Math.sin(ra) * 0.35],
      "#4d3420",
      {
        name: `${name}_root_${r}`,
        category: "foliage",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.9,
        roughness: 0.98,
      },
    );
    root.rotation.y = ra;
    root.rotation.z = 0.3;
  }

  // Wide canopy: 3 layered icosahedrons for dense coverage.
  const crownY = y + trunkH;
  const mainR = 2.8 * trunkScale;

  const lowerCrown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(mainR, 1),
    materialFor(color, true, 0.92, 0.02),
  );
  lowerCrown.position.set(x, crownY + mainR * 0.3, z);
  lowerCrown.scale.set(1.2, 0.45, 1.1);
  lowerCrown.rotation.y = seed * Math.PI * 2;
  configureMesh(lowerCrown, {
    name: `${name}_canopy_lower`,
    category: "foliage",
    instanceCandidate: true,
    cullDistanceMultiplier: 1.15,
  });
  scene.add(lowerCrown);

  const midColor = new THREE.Color(color).offsetHSL(0, 0.03, 0.05);
  const midCrown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(mainR * 0.75, 1),
    materialFor(`#${midColor.getHexString()}`, true, 0.92, 0.02),
  );
  midCrown.position.set(
    x + (seed - 0.5) * 0.8,
    crownY + mainR * 0.7,
    z + (seed - 0.5) * 0.6,
  );
  midCrown.scale.set(1.0, 0.55, 0.95);
  midCrown.rotation.y = seed * Math.PI;
  configureMesh(midCrown, {
    name: `${name}_canopy_mid`,
    category: "foliage",
    instanceCandidate: true,
    cullDistanceMultiplier: 1.1,
  });
  scene.add(midCrown);

  const topColor = new THREE.Color(color).offsetHSL(0, 0.05, 0.08);
  const topCrown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(mainR * 0.5, 0),
    materialFor(`#${topColor.getHexString()}`, true, 0.92, 0.02),
  );
  topCrown.position.set(x, crownY + mainR * 1.0, z);
  topCrown.scale.set(0.9, 0.7, 0.85);
  topCrown.rotation.y = seed * 2.5;
  configureMesh(topCrown, {
    name: `${name}_canopy_top`,
    category: "foliage",
    instanceCandidate: true,
    cullDistanceMultiplier: 1.05,
  });
  scene.add(topCrown);
}

export function addWoodenHut(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  rotY: number,
  name: string,
): void {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);

  // Floor platform.
  const floor = addBox(scene, [4.2, 0.24, 3.4], [x, y + 0.12, z], "#9d7a58", {
    name: `${name}_floor`,
    category: "structure",
    walkableSurface: true,
    cullDistanceMultiplier: 1.1,
  });
  floor.rotation.y = rotY;

  // 4 corner posts.
  const corners: Array<[number, number]> = [
    [-1.8, -1.4],
    [1.8, -1.4],
    [-1.8, 1.4],
    [1.8, 1.4],
  ];
  for (let i = 0; i < corners.length; i++) {
    const [cx, cz] = corners[i];
    const wx = x + cos * cx - sin * cz;
    const wz = z + sin * cx + cos * cz;
    addCylinder(scene, 0.12, 0.16, 2.4, 6, [wx, y + 1.32, wz], "#7a5538", {
      name: `${name}_post_${i}`,
      category: "structure",
      instanceCandidate: true,
      cullDistanceMultiplier: 1.0,
    });
  }

  // Back wall.
  const backWall = addBox(
    scene,
    [4.0, 2.0, 0.14],
    [x + sin * 1.35, y + 1.24, z - cos * 1.35],
    "#8b6849",
    {
      name: `${name}_wall_back`,
      category: "structure",
      cullDistanceMultiplier: 1.05,
    },
  );
  backWall.rotation.y = rotY;

  // Side walls (half-height for open tropical feel).
  for (const side of [-1, 1] as const) {
    const sideWall = addBox(
      scene,
      [0.14, 1.4, 2.6],
      [x + cos * side * 1.9, y + 0.94, z + sin * side * 1.9],
      "#9a6d48",
      {
        name: `${name}_wall_${side > 0 ? "right" : "left"}`,
        category: "structure",
        cullDistanceMultiplier: 1.0,
      },
    );
    sideWall.rotation.y = rotY;
  }

  // Sloped roof — two angled leaf-covered panels.
  for (const side of [-1, 1] as const) {
    const roofPanel = addBox(
      scene,
      [4.6, 0.12, 2.2],
      [
        x + sin * side * 0.85,
        y + 2.72 - Math.abs(side) * 0.15,
        z - cos * side * 0.85,
      ],
      "#5a8a3e",
      {
        name: `${name}_roof_${side > 0 ? "right" : "left"}`,
        category: "structure",
        cullDistanceMultiplier: 1.15,
      },
    );
    roofPanel.rotation.y = rotY;
    roofPanel.rotation.z = side * 0.22;
  }

  // Roof ridge beam.
  const ridge = addBox(scene, [4.8, 0.14, 0.14], [x, y + 2.82, z], "#4d3420", {
    name: `${name}_ridge`,
    category: "structure",
    instanceCandidate: true,
    cullDistanceMultiplier: 1.05,
  });
  ridge.rotation.y = rotY;

  // Front awning overhang.
  const awning = addBox(
    scene,
    [4.4, 0.08, 1.2],
    [x - sin * 2.0, y + 2.45, z + cos * 2.0],
    "#6b9a48",
    {
      name: `${name}_awning`,
      category: "structure",
      cullDistanceMultiplier: 1.0,
    },
  );
  awning.rotation.y = rotY;
  awning.rotation.z = -0.1;

  // Interior table.
  addBox(
    scene,
    [1.2, 0.08, 0.7],
    [x + sin * 0.4, y + 0.72, z - cos * 0.4],
    "#7a5538",
    {
      name: `${name}_table`,
      category: "prop",
      instanceCandidate: true,
      cullDistanceMultiplier: 0.9,
    },
  );

  // Table legs.
  for (const tx of [-0.45, 0.45]) {
    for (const tz of [-0.25, 0.25]) {
      const lx = x + sin * 0.4 + cos * tx - sin * tz;
      const lz = z - cos * 0.4 + sin * tx + cos * tz;
      addCylinder(scene, 0.03, 0.04, 0.48, 4, [lx, y + 0.48, lz], "#6b4224", {
        name: `${name}_table_leg_${tx}_${tz}`,
        category: "prop",
        instanceCandidate: true,
        cullDistanceMultiplier: 0.75,
      });
    }
  }
}

export function addFernCluster(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  const seed = Math.abs(x * 0.38 + z * 0.26) % 1;
  const frondCount = 5 + Math.floor(seed * 3);

  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2 + seed * 1.4;
    const length = 0.5 + seed * 0.3 + (i % 2) * 0.15;
    const spread = 0.55 + (i % 3) * 0.1;
    const fernColor = i % 2 === 0 ? "#3d8a28" : "#4a9c34";

    const frond = addBox(
      scene,
      [length, 0.03, 0.12],
      [
        x + Math.cos(angle) * length * 0.4,
        y + 0.15 + (i % 2) * 0.05,
        z + Math.sin(angle) * length * 0.4,
      ],
      fernColor,
      {
        name: `${name}_frond_${i}`,
        category: "foliage",
        castShadow: false,
        instanceCandidate: true,
        cullDistanceMultiplier: 0.65,
      },
    );
    frond.rotation.y = angle;
    frond.rotation.x = -spread;
  }
}

export function addStoneLantern(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  // Base pedestal.
  addBox(scene, [0.52, 0.22, 0.52], [x, y + 0.11, z], "#7d8a78", {
    name: `${name}_base`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
    roughness: 0.92,
  });
  // Column.
  addCylinder(scene, 0.12, 0.16, 0.8, 6, [x, y + 0.62, z], "#6b7a6e", {
    name: `${name}_column`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.85,
    roughness: 0.94,
  });
  // Lantern housing.
  addBox(scene, [0.42, 0.36, 0.42], [x, y + 1.2, z], "#8a9c84", {
    name: `${name}_housing`,
    category: "prop",
    instanceCandidate: true,
    cullDistanceMultiplier: 0.9,
    roughness: 0.88,
  });
  // Glowing emissive interior.
  const glowMat = materialFor("#fef3c7", false, 0.35, 0);
  glowMat.emissive = new THREE.Color("#fbbf24");
  glowMat.emissiveIntensity = 0.4;
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), glowMat);
  glow.position.set(x, y + 1.2, z);
  glow.name = `${name}_glow`;
  glow.castShadow = false;
  glow.receiveShadow = false;
  glow.userData.meshCategory = "prop";
  glow.userData.instanceCandidate = true;
  glow.userData.cullDistanceMultiplier = 0.85;
  scene.add(glow);
  // Roof cap.
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.28, 4),
    materialFor("#5a6b58", true, 0.9, 0.04),
  );
  cap.position.set(x, y + 1.52, z);
  cap.rotation.y = Math.PI * 0.25;
  cap.name = `${name}_cap`;
  cap.castShadow = true;
  cap.receiveShadow = true;
  cap.userData.meshCategory = "prop";
  cap.userData.instanceCandidate = true;
  cap.userData.cullDistanceMultiplier = 0.85;
  scene.add(cap);
}
