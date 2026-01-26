/**
 * Game Collision Detection Utilities
 *
 * Comprehensive collision detection for various game types including:
 * - Circle-circle (balls, pucks)
 * - Circle-rectangle (ball vs paddles, walls)
 * - Point-in-shape (touch detection)
 * - Line-circle (trajectory detection)
 * - Separating Axis Theorem for convex polygons
 *
 * @see docs/06_GAMES_RESEARCH.md Section 3
 */

import {
  Vector2D,
  vec2,
  vec2Add,
  vec2Dot,
  vec2Length,
  vec2Normalize,
  vec2Scale,
  vec2Sub,
} from "./gamePhysics";

// =============================================================================
// Types
// =============================================================================

/**
 * Rectangle defined by position and size
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Circle defined by center and radius
 */
export interface Circle {
  x: number;
  y: number;
  radius: number;
}

/**
 * Line segment defined by two points
 */
export interface Line {
  start: Vector2D;
  end: Vector2D;
}

/**
 * Polygon defined by array of vertices
 */
export interface Polygon {
  vertices: Vector2D[];
}

/**
 * Collision result with penetration info
 */
export interface CollisionResult {
  collided: boolean;
  normal?: Vector2D;
  depth?: number;
  point?: Vector2D;
}

/**
 * Collision side for AABB collisions
 */
export type CollisionSide = "top" | "bottom" | "left" | "right" | "none";

// =============================================================================
// Basic Collision Detection
// =============================================================================

/**
 * Check if two circles are colliding
 */
export function circleCircleCollision(c1: Circle, c2: Circle): CollisionResult {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const minDistance = c1.radius + c2.radius;

  if (distance >= minDistance) {
    return { collided: false };
  }

  // Calculate collision normal and depth
  const normal = distance > 0 ? vec2(dx / distance, dy / distance) : vec2(1, 0); // Default if circles are at same position

  const depth = minDistance - distance;
  const point = vec2(c1.x + normal.x * c1.radius, c1.y + normal.y * c1.radius);

  return { collided: true, normal, depth, point };
}

/**
 * Check if a circle is colliding with a rectangle (AABB)
 */
export function circleRectCollision(
  circle: Circle,
  rect: Rectangle,
): CollisionResult {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance >= circle.radius) {
    return { collided: false };
  }

  // Calculate collision normal
  let normal: Vector2D;
  if (distance > 0) {
    normal = vec2(dx / distance, dy / distance);
  } else {
    // Circle center is inside rectangle, find nearest edge
    const distToLeft = circle.x - rect.x;
    const distToRight = rect.x + rect.width - circle.x;
    const distToTop = circle.y - rect.y;
    const distToBottom = rect.y + rect.height - circle.y;

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    if (minDist === distToLeft) normal = vec2(-1, 0);
    else if (minDist === distToRight) normal = vec2(1, 0);
    else if (minDist === distToTop) normal = vec2(0, -1);
    else normal = vec2(0, 1);
  }

  const depth = circle.radius - distance;
  const point = vec2(closestX, closestY);

  return { collided: true, normal, depth, point };
}

/**
 * Get which side of a rectangle was hit
 */
export function getCollisionSide(
  circle: Circle,
  rect: Rectangle,
  velocity: Vector2D,
): CollisionSide {
  const rectCenterX = rect.x + rect.width / 2;
  const rectCenterY = rect.y + rect.height / 2;

  const dx = circle.x - rectCenterX;
  const dy = circle.y - rectCenterY;

  // Calculate overlap on each axis
  const overlapX = rect.width / 2 + circle.radius - Math.abs(dx);
  const overlapY = rect.height / 2 + circle.radius - Math.abs(dy);

  if (overlapX <= 0 || overlapY <= 0) {
    return "none";
  }

  // Determine side based on smallest overlap and velocity
  if (overlapX < overlapY) {
    return dx > 0 ? "right" : "left";
  } else {
    return dy > 0 ? "bottom" : "top";
  }
}

/**
 * Check if two rectangles are colliding (AABB)
 */
export function rectRectCollision(
  r1: Rectangle,
  r2: Rectangle,
): CollisionResult {
  if (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  ) {
    // Calculate penetration depth
    const overlapX = Math.min(r1.x + r1.width - r2.x, r2.x + r2.width - r1.x);
    const overlapY = Math.min(r1.y + r1.height - r2.y, r2.y + r2.height - r1.y);

    // Normal points from r1 to r2
    const centerDx = r2.x + r2.width / 2 - (r1.x + r1.width / 2);
    const centerDy = r2.y + r2.height / 2 - (r1.y + r1.height / 2);

    let normal: Vector2D;
    let depth: number;

    if (overlapX < overlapY) {
      normal = vec2(centerDx > 0 ? 1 : -1, 0);
      depth = overlapX;
    } else {
      normal = vec2(0, centerDy > 0 ? 1 : -1);
      depth = overlapY;
    }

    return { collided: true, normal, depth };
  }

  return { collided: false };
}

// =============================================================================
// Point Tests
// =============================================================================

/**
 * Check if a point is inside a circle
 */
export function pointInCircle(point: Vector2D, circle: Circle): boolean {
  const dx = point.x - circle.x;
  const dy = point.y - circle.y;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

/**
 * Check if a point is inside a rectangle
 */
export function pointInRect(point: Vector2D, rect: Rectangle): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if a point is inside a polygon (ray casting)
 */
export function pointInPolygon(point: Vector2D, polygon: Polygon): boolean {
  const { vertices } = polygon;
  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];

    if (
      vi.y > point.y !== vj.y > point.y &&
      point.x < ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y) + vi.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

// =============================================================================
// Line Intersections
// =============================================================================

/**
 * Check if a line intersects a circle
 */
export function lineCircleIntersection(
  line: Line,
  circle: Circle,
): Vector2D | null {
  const d = vec2Sub(line.end, line.start);
  const f = vec2Sub(line.start, vec2(circle.x, circle.y));

  const a = vec2Dot(d, d);
  const b = 2 * vec2Dot(f, d);
  const c = vec2Dot(f, f) - circle.radius * circle.radius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return null;
  }

  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);

  // Check if intersection is within line segment
  let t = -1;
  if (t1 >= 0 && t1 <= 1) {
    t = t1;
  } else if (t2 >= 0 && t2 <= 1) {
    t = t2;
  }

  if (t < 0) {
    return null;
  }

  return vec2Add(line.start, vec2Scale(d, t));
}

/**
 * Check if two line segments intersect
 */
export function lineLineIntersection(
  line1: Line,
  line2: Line,
): Vector2D | null {
  const p = line1.start;
  const r = vec2Sub(line1.end, line1.start);
  const q = line2.start;
  const s = vec2Sub(line2.end, line2.start);

  const rxs = r.x * s.y - r.y * s.x;
  const qpxr = (q.x - p.x) * r.y - (q.y - p.y) * r.x;

  if (Math.abs(rxs) < 1e-10) {
    // Lines are parallel
    return null;
  }

  const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / rxs;
  const u = qpxr / rxs;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return vec2Add(p, vec2Scale(r, t));
  }

  return null;
}

/**
 * Check if a line intersects a rectangle
 */
export function lineRectIntersection(
  line: Line,
  rect: Rectangle,
): Vector2D | null {
  const lines: Line[] = [
    { start: vec2(rect.x, rect.y), end: vec2(rect.x + rect.width, rect.y) },
    {
      start: vec2(rect.x + rect.width, rect.y),
      end: vec2(rect.x + rect.width, rect.y + rect.height),
    },
    {
      start: vec2(rect.x + rect.width, rect.y + rect.height),
      end: vec2(rect.x, rect.y + rect.height),
    },
    { start: vec2(rect.x, rect.y + rect.height), end: vec2(rect.x, rect.y) },
  ];

  let closestIntersection: Vector2D | null = null;
  let closestDistance = Infinity;

  for (const rectLine of lines) {
    const intersection = lineLineIntersection(line, rectLine);
    if (intersection) {
      const distance = vec2Length(vec2Sub(intersection, line.start));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIntersection = intersection;
      }
    }
  }

  return closestIntersection;
}

// =============================================================================
// Separating Axis Theorem (SAT)
// =============================================================================

/**
 * Project polygon onto axis
 */
function projectPolygon(
  polygon: Polygon,
  axis: Vector2D,
): { min: number; max: number } {
  let min = vec2Dot(polygon.vertices[0], axis);
  let max = min;

  for (let i = 1; i < polygon.vertices.length; i++) {
    const projection = vec2Dot(polygon.vertices[i], axis);
    if (projection < min) min = projection;
    if (projection > max) max = projection;
  }

  return { min, max };
}

/**
 * Check if projections overlap
 */
function projectionsOverlap(
  proj1: { min: number; max: number },
  proj2: { min: number; max: number },
): boolean {
  return proj1.max >= proj2.min && proj2.max >= proj1.min;
}

/**
 * Get perpendicular axes for SAT test
 */
function getAxes(polygon: Polygon): Vector2D[] {
  const axes: Vector2D[] = [];
  const { vertices } = polygon;

  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    const edge = vec2Sub(p2, p1);
    // Perpendicular to edge (normal)
    const normal = vec2Normalize(vec2(-edge.y, edge.x));
    axes.push(normal);
  }

  return axes;
}

/**
 * SAT collision test for convex polygons
 */
export function satCollision(poly1: Polygon, poly2: Polygon): CollisionResult {
  const axes1 = getAxes(poly1);
  const axes2 = getAxes(poly2);
  const allAxes = [...axes1, ...axes2];

  let minOverlap = Infinity;
  let smallestAxis: Vector2D | null = null;

  for (const axis of allAxes) {
    const proj1 = projectPolygon(poly1, axis);
    const proj2 = projectPolygon(poly2, axis);

    if (!projectionsOverlap(proj1, proj2)) {
      return { collided: false };
    }

    // Calculate overlap
    const overlap = Math.min(proj1.max - proj2.min, proj2.max - proj1.min);

    if (overlap < minOverlap) {
      minOverlap = overlap;
      smallestAxis = axis;
    }
  }

  return {
    collided: true,
    normal: smallestAxis || vec2(0, 0),
    depth: minOverlap,
  };
}

// =============================================================================
// Broadphase Collision Detection
// =============================================================================

/**
 * Spatial hash grid for broadphase collision detection
 */
export class SpatialHashGrid {
  private cellSize: number;
  private grid: Map<string, Set<number>>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  private getKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Clear the grid
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Insert an object (by index) into the grid
   */
  insert(index: number, bounds: Rectangle): void {
    const minX = Math.floor(bounds.x / this.cellSize);
    const maxX = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const minY = Math.floor(bounds.y / this.cellSize);
    const maxY = Math.floor((bounds.y + bounds.height) / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        if (!this.grid.has(key)) {
          this.grid.set(key, new Set());
        }
        this.grid.get(key)!.add(index);
      }
    }
  }

  /**
   * Query for potential collisions
   */
  query(bounds: Rectangle): Set<number> {
    const result = new Set<number>();

    const minX = Math.floor(bounds.x / this.cellSize);
    const maxX = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const minY = Math.floor(bounds.y / this.cellSize);
    const maxY = Math.floor((bounds.y + bounds.height) / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        const cell = this.grid.get(key);
        if (cell) {
          cell.forEach((index) => result.add(index));
        }
      }
    }

    return result;
  }
}

// =============================================================================
// Continuous Collision Detection (CCD)
// =============================================================================

/**
 * Sweep test for moving circle against static circle
 */
export function sweepCircleCircle(
  movingCircle: Circle,
  velocity: Vector2D,
  staticCircle: Circle,
): { hit: boolean; t: number; point?: Vector2D } {
  // Expand static circle by moving circle's radius
  const expandedRadius = movingCircle.radius + staticCircle.radius;

  // Ray from moving circle center
  const line: Line = {
    start: vec2(movingCircle.x, movingCircle.y),
    end: vec2(movingCircle.x + velocity.x, movingCircle.y + velocity.y),
  };

  const expandedCircle: Circle = {
    x: staticCircle.x,
    y: staticCircle.y,
    radius: expandedRadius,
  };

  const intersection = lineCircleIntersection(line, expandedCircle);

  if (!intersection) {
    return { hit: false, t: 1 };
  }

  const t =
    vec2Length(vec2Sub(intersection, line.start)) / vec2Length(velocity);
  return { hit: true, t: Math.max(0, t), point: intersection };
}

/**
 * Sweep test for moving circle against rectangle
 */
export function sweepCircleRect(
  circle: Circle,
  velocity: Vector2D,
  rect: Rectangle,
): { hit: boolean; t: number; normal?: Vector2D } {
  // Minkowski sum: expand rectangle by circle radius
  const expandedRect: Rectangle = {
    x: rect.x - circle.radius,
    y: rect.y - circle.radius,
    width: rect.width + circle.radius * 2,
    height: rect.height + circle.radius * 2,
  };

  const line: Line = {
    start: vec2(circle.x, circle.y),
    end: vec2(circle.x + velocity.x, circle.y + velocity.y),
  };

  const intersection = lineRectIntersection(line, expandedRect);

  if (!intersection) {
    return { hit: false, t: 1 };
  }

  const t =
    vec2Length(vec2Sub(intersection, line.start)) / vec2Length(velocity);

  // Determine collision normal
  let normal: Vector2D;
  const epsilon = 0.001;

  if (Math.abs(intersection.x - expandedRect.x) < epsilon) {
    normal = vec2(-1, 0);
  } else if (
    Math.abs(intersection.x - (expandedRect.x + expandedRect.width)) < epsilon
  ) {
    normal = vec2(1, 0);
  } else if (Math.abs(intersection.y - expandedRect.y) < epsilon) {
    normal = vec2(0, -1);
  } else {
    normal = vec2(0, 1);
  }

  return { hit: true, t: Math.max(0, t), normal };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate bounce reflection
 */
export function reflect(velocity: Vector2D, normal: Vector2D): Vector2D {
  const dot = vec2Dot(velocity, normal);
  return vec2Sub(velocity, vec2Scale(normal, 2 * dot));
}

/**
 * Calculate bounce with energy loss
 */
export function reflectWithDamping(
  velocity: Vector2D,
  normal: Vector2D,
  restitution: number,
): Vector2D {
  const reflected = reflect(velocity, normal);
  return vec2Scale(reflected, restitution);
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Vector2D, p2: Vector2D): number {
  return vec2Length(vec2Sub(p2, p1));
}

/**
 * Calculate squared distance (faster, avoids sqrt)
 */
export function distanceSquared(p1: Vector2D, p2: Vector2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Get bounds of a circle as rectangle
 */
export function circleToBounds(circle: Circle): Rectangle {
  return {
    x: circle.x - circle.radius,
    y: circle.y - circle.radius,
    width: circle.radius * 2,
    height: circle.radius * 2,
  };
}

/**
 * Expand a rectangle by a margin
 */
export function expandRect(rect: Rectangle, margin: number): Rectangle {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}
