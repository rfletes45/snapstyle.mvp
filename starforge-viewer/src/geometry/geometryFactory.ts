/**
 * GeometryFactory — creates THREE.BufferGeometry from JSON geometry descriptors.
 * Supports: box, cylinder, torus, plane, cone, tube.
 */
import * as THREE from "three";
import type {
  BoxGeom,
  ConeGeom,
  CylinderGeom,
  GeomDescriptor,
  PlaneGeom,
  TorusGeom,
  TubeGeom,
} from "../types/schema";

export function createGeometry(geom: GeomDescriptor): THREE.BufferGeometry {
  switch (geom.type) {
    case "box":
      return createBox(geom);
    case "cylinder":
      return createCylinder(geom);
    case "torus":
      return createTorus(geom);
    case "plane":
      return createPlane(geom);
    case "cone":
      return createCone(geom);
    case "tube":
      return createTube(geom);
    default:
      console.error(
        `GeometryFactory: unknown geom type "${(geom as GeomDescriptor).type}"`,
      );
      // Return a small marker sphere for unknown types
      return new THREE.SphereGeometry(0.05, 8, 8);
  }
}

function createBox(g: BoxGeom): THREE.BoxGeometry {
  const [w, h, d] = g.size;
  const segs = g.segments ?? [1, 1, 1];
  return new THREE.BoxGeometry(w, h, d, segs[0], segs[1], segs[2]);
}

function createCylinder(g: CylinderGeom): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(
    g.radius,
    g.radius,
    g.height,
    g.radialSegments,
    g.heightSegments ?? 1,
    g.openEnded ?? false,
  );
}

function createTorus(g: TorusGeom): THREE.TorusGeometry {
  return new THREE.TorusGeometry(
    g.radius,
    g.tube,
    g.radialSegments,
    g.tubularSegments,
  );
}

function createPlane(g: PlaneGeom): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(g.size[0], g.size[1]);
}

function createCone(g: ConeGeom): THREE.ConeGeometry {
  return new THREE.ConeGeometry(
    g.radius,
    g.height,
    g.radialSegments,
    1,
    g.openEnded ?? false,
  );
}

function createTube(g: TubeGeom): THREE.TubeGeometry {
  // Build a CatmullRomCurve3 from the points array
  const points = g.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));

  let curve: THREE.Curve<THREE.Vector3>;
  if (points.length === 2) {
    // For 2-point tubes, use a LineCurve3
    curve = new THREE.LineCurve3(points[0], points[1]);
  } else {
    curve = new THREE.CatmullRomCurve3(points, g.closed ?? false);
  }

  return new THREE.TubeGeometry(
    curve,
    g.tubularSegments,
    g.radius,
    g.radialSegments,
    g.closed ?? false,
  );
}
