import {
  BallGroup,
  FoulType,
  GamePhase,
  PlayerState,
  getBallType,
  groupToBallType,
  oppositeGroup,
} from "@/types/pool";

export interface SpinVector {
  x: number;
  y: number;
}

export interface PoolBall {
  id: number; // 0=cue, 1-7=solids, 8=eight, 9-15=stripes
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: SpinVector;
  pocketed: boolean;
}

export interface ShotParams {
  angle: number; // Radians
  power: number; // 0-1 normalized
  english: SpinVector; // Cue tip offset from center
}

export interface Pocket {
  x: number;
  y: number;
  radius: number;
  kind: "corner" | "side";
}

export interface Cushion {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  normal: { x: number; y: number };
}

export interface TableConfig {
  width: number;
  height: number;
  ballRadius: number;
  pockets: Pocket[];
  cushions: Cushion[];
  headStringY: number;
  footSpot: { x: number; y: number };
}

export interface ShotResult {
  frames: PoolBall[][];
  pocketed: number[];
  firstContact: number | null;
  railContacts: number;
  cueScratch: boolean;
  duration: number;
  finalBalls: PoolBall[];
}

export interface PoolMatchState {
  phase: GamePhase;
  currentPlayer: 0 | 1;
  players: [PlayerState, PlayerState];
  openTable: boolean;
  breakShot: boolean;
  ballInHand: boolean;
  winner: 0 | 1 | null;
  lastFoul: FoulType | null;
  winnerReason: string | null;
  turnNumber: number;
}

export interface ShotEvaluation {
  nextState: PoolMatchState;
  foulType: FoulType | null;
  keepTurn: boolean;
  winner: 0 | 1 | null;
  message: string;
}

const INTERNAL_FPS = 120;
const INTERNAL_DT = 1 / INTERNAL_FPS;
const CAPTURE_STRIDE = 2; // 120hz -> 60hz keyframes
const MAX_STEPS = INTERNAL_FPS * 35;
const STOP_SPEED = 0.1;
const STOP_SPIN = 0.03;

const BALL_RESTITUTION = 0.95;
const CUSHION_RESTITUTION = 0.7;
const ROLLING_FRICTION = 0.42;
const SLIDING_FRICTION = 0.66;
const SPIN_DECAY = 1.75;
const SPIN_TO_VELOCITY = 14;
const SIDE_SPIN_CURVE = 6.5;
const CUSHION_SPIN_EFFECT = 0.18;

const MIN_SHOT_SPEED = 18;
const MAX_SHOT_SPEED = 230;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function length2(x: number, y: number): number {
  return x * x + y * y;
}

function length(x: number, y: number): number {
  return Math.sqrt(length2(x, y));
}

function normalize(x: number, y: number): { x: number; y: number } {
  const l = length(x, y);
  if (l <= 1e-9) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

function cloneBall(ball: PoolBall): PoolBall {
  return {
    id: ball.id,
    x: ball.x,
    y: ball.y,
    vx: ball.vx,
    vy: ball.vy,
    spin: { x: ball.spin.x, y: ball.spin.y },
    pocketed: ball.pocketed,
  };
}

function cloneBalls(balls: PoolBall[]): PoolBall[] {
  return balls.map(cloneBall);
}

function countRemainingByGroup(
  balls: PoolBall[],
  group: BallGroup,
): number {
  const desiredType = groupToBallType(group);
  let count = 0;
  for (const ball of balls) {
    if (ball.pocketed) continue;
    if (getBallType(ball.id) === desiredType) {
      count += 1;
    }
  }
  return count;
}

export function createInitialMatchState(): PoolMatchState {
  return {
    phase: "break",
    currentPlayer: 0,
    players: [
      { group: null, remaining: 7, fouls: 0 },
      { group: null, remaining: 7, fouls: 0 },
    ],
    openTable: true,
    breakShot: true,
    ballInHand: false,
    winner: null,
    lastFoul: null,
    winnerReason: null,
    turnNumber: 0,
  };
}

export function createTable(
  width: number = 220,
  height: number = 420,
): TableConfig {
  const ballRadius = 5.8;
  const cornerPocketRadius = 11.4;
  const sidePocketRadius = 10.1;
  const middleY = height / 2;
  const cornerInset = cornerPocketRadius * 0.95;
  const sideInset = sidePocketRadius * 0.95;

  const pockets: Pocket[] = [
    { x: 0, y: 0, radius: cornerPocketRadius, kind: "corner" },
    { x: width, y: 0, radius: cornerPocketRadius, kind: "corner" },
    { x: 0, y: height, radius: cornerPocketRadius, kind: "corner" },
    { x: width, y: height, radius: cornerPocketRadius, kind: "corner" },
    { x: 0, y: middleY, radius: sidePocketRadius, kind: "side" },
    { x: width, y: middleY, radius: sidePocketRadius, kind: "side" },
  ];

  const cushions: Cushion[] = [
    {
      id: "top",
      x1: cornerInset,
      y1: 0,
      x2: width - cornerInset,
      y2: 0,
      normal: { x: 0, y: 1 },
    },
    {
      id: "bottom",
      x1: cornerInset,
      y1: height,
      x2: width - cornerInset,
      y2: height,
      normal: { x: 0, y: -1 },
    },
    {
      id: "left_top",
      x1: 0,
      y1: cornerInset,
      x2: 0,
      y2: middleY - sideInset,
      normal: { x: 1, y: 0 },
    },
    {
      id: "left_bottom",
      x1: 0,
      y1: middleY + sideInset,
      x2: 0,
      y2: height - cornerInset,
      normal: { x: 1, y: 0 },
    },
    {
      id: "right_top",
      x1: width,
      y1: cornerInset,
      x2: width,
      y2: middleY - sideInset,
      normal: { x: -1, y: 0 },
    },
    {
      id: "right_bottom",
      x1: width,
      y1: middleY + sideInset,
      x2: width,
      y2: height - cornerInset,
      normal: { x: -1, y: 0 },
    },
  ];

  return {
    width,
    height,
    ballRadius,
    pockets,
    cushions,
    headStringY: height * 0.7,
    footSpot: { x: width / 2, y: height * 0.26 },
  };
}

export function createInitialBalls(table: TableConfig): PoolBall[] {
  const spacing = table.ballRadius * 2.05;
  const rowHeight = spacing * Math.sin(Math.PI / 3);
  const foot = table.footSpot;
  const cue: PoolBall = {
    id: 0,
    x: table.width / 2,
    y: table.height * 0.82,
    vx: 0,
    vy: 0,
    spin: { x: 0, y: 0 },
    pocketed: false,
  };

  const rackOrder = [1, 9, 2, 10, 8, 11, 3, 12, 4, 13, 5, 14, 6, 15, 7];
  const balls: PoolBall[] = [cue];
  let index = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col <= row; col += 1) {
      const id = rackOrder[index];
      balls.push({
        id,
        x: foot.x + (col - row / 2) * spacing,
        y: foot.y + row * rowHeight,
        vx: 0,
        vy: 0,
        spin: { x: 0, y: 0 },
        pocketed: false,
      });
      index += 1;
    }
  }

  return balls;
}

function hasMotion(ball: PoolBall): boolean {
  if (ball.pocketed) return false;
  return (
    length2(ball.vx, ball.vy) > STOP_SPEED * STOP_SPEED ||
    length2(ball.spin.x, ball.spin.y) > STOP_SPIN * STOP_SPIN
  );
}

function isMovingTowardPocket(ball: PoolBall, pocket: Pocket): boolean {
  const toPocketX = pocket.x - ball.x;
  const toPocketY = pocket.y - ball.y;
  const toward = toPocketX * ball.vx + toPocketY * ball.vy;
  return toward > 0;
}

function distanceToSegment(
  x: number,
  y: number,
  segment: Cushion,
): { distance: number; closestX: number; closestY: number } {
  const vx = segment.x2 - segment.x1;
  const vy = segment.y2 - segment.y1;
  const wx = x - segment.x1;
  const wy = y - segment.y1;

  const c1 = vx * wx + vy * wy;
  const c2 = vx * vx + vy * vy;
  const t = c2 <= 1e-9 ? 0 : clamp(c1 / c2, 0, 1);

  const cx = segment.x1 + t * vx;
  const cy = segment.y1 + t * vy;
  return { distance: length(x - cx, y - cy), closestX: cx, closestY: cy };
}

function integrateBall(ball: PoolBall): void {
  if (ball.pocketed) return;

  const spinMagnitude = length(ball.spin.x, ball.spin.y);
  const speed = length(ball.vx, ball.vy);

  if (speed > 1e-9) {
    const decel =
      spinMagnitude > 0.2
        ? SLIDING_FRICTION
        : ROLLING_FRICTION;
    const newSpeed = Math.max(0, speed - decel * INTERNAL_DT);
    const ratio = speed > 1e-9 ? newSpeed / speed : 0;
    ball.vx *= ratio;
    ball.vy *= ratio;

    const curve = ball.spin.x * SIDE_SPIN_CURVE * INTERNAL_DT;
    ball.vx += curve;

    const along = normalize(ball.vx, ball.vy);
    const transfer = ball.spin.y * SPIN_TO_VELOCITY * INTERNAL_DT;
    ball.vx += along.x * transfer;
    ball.vy += along.y * transfer;
  }

  const spinDecay = Math.max(0, 1 - SPIN_DECAY * INTERNAL_DT);
  ball.spin.x *= spinDecay;
  ball.spin.y *= spinDecay;

  if (length(ball.vx, ball.vy) < STOP_SPEED) {
    ball.vx = 0;
    ball.vy = 0;
  }
  if (length(ball.spin.x, ball.spin.y) < STOP_SPIN) {
    ball.spin.x = 0;
    ball.spin.y = 0;
  }

  ball.x += ball.vx * INTERNAL_DT;
  ball.y += ball.vy * INTERNAL_DT;
}

function resolveBallCollisions(
  balls: PoolBall[],
  ballRadius: number,
  firstContactRef: { value: number | null },
): void {
  const minDistance = ballRadius * 2;

  for (let i = 0; i < balls.length; i += 1) {
    const a = balls[i];
    if (a.pocketed) continue;
    for (let j = i + 1; j < balls.length; j += 1) {
      const b = balls[j];
      if (b.pocketed) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > minDistance * minDistance) continue;

      const dist = Math.max(1e-6, Math.sqrt(distSq));
      const nx = dx / dist;
      const ny = dy / dist;

      const overlap = minDistance - dist;
      if (overlap > 0) {
        const separate = overlap * 0.5;
        a.x -= nx * separate;
        a.y -= ny * separate;
        b.x += nx * separate;
        b.y += ny * separate;
      }

      if (firstContactRef.value === null) {
        if (a.id === 0 && b.id !== 0) firstContactRef.value = b.id;
        else if (b.id === 0 && a.id !== 0) firstContactRef.value = a.id;
      }

      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const relAlongNormal = rvx * nx + rvy * ny;
      if (relAlongNormal >= 0) continue;

      const impulse = (-(1 + BALL_RESTITUTION) * relAlongNormal) / 2;
      const ix = impulse * nx;
      const iy = impulse * ny;

      a.vx -= ix;
      a.vy -= iy;
      b.vx += ix;
      b.vy += iy;

      const tx = -ny;
      const ty = nx;
      const relTangential = rvx * tx + rvy * ty;
      a.spin.x += relTangential * 0.01;
      b.spin.x -= relTangential * 0.01;
    }
  }
}

function resolveCushionCollisions(
  balls: PoolBall[],
  table: TableConfig,
  railTouched: Set<number>,
): void {
  for (const ball of balls) {
    if (ball.pocketed) continue;
    for (const cushion of table.cushions) {
      const contact = distanceToSegment(ball.x, ball.y, cushion);
      if (contact.distance >= table.ballRadius) continue;

      const penetration = table.ballRadius - contact.distance;
      ball.x += cushion.normal.x * penetration;
      ball.y += cushion.normal.y * penetration;

      const velocityAlongNormal =
        ball.vx * cushion.normal.x + ball.vy * cushion.normal.y;
      if (velocityAlongNormal >= 0) continue;

      ball.vx -=
        (1 + CUSHION_RESTITUTION) * velocityAlongNormal * cushion.normal.x;
      ball.vy -=
        (1 + CUSHION_RESTITUTION) * velocityAlongNormal * cushion.normal.y;

      const tangentX = -cushion.normal.y;
      const tangentY = cushion.normal.x;
      const englishTransfer = ball.spin.x * CUSHION_SPIN_EFFECT;
      ball.vx += tangentX * englishTransfer;
      ball.vy += tangentY * englishTransfer;
      ball.spin.x *= 0.7;

      railTouched.add(ball.id);
    }
  }
}

function detectPocketedBalls(
  balls: PoolBall[],
  table: TableConfig,
  pocketedSet: Set<number>,
): void {
  for (const ball of balls) {
    if (ball.pocketed) continue;
    for (const pocket of table.pockets) {
      const dx = pocket.x - ball.x;
      const dy = pocket.y - ball.y;
      const dist = length(dx, dy);
      const speed = length(ball.vx, ball.vy);

      const immediateSink = dist <= pocket.radius - table.ballRadius * 0.22;
      const trajectorySink =
        dist <= pocket.radius + speed * INTERNAL_DT * 1.15 &&
        isMovingTowardPocket(ball, pocket);
      if (!immediateSink && !trajectorySink) continue;

      ball.pocketed = true;
      ball.vx = 0;
      ball.vy = 0;
      ball.spin.x = 0;
      ball.spin.y = 0;
      ball.x = pocket.x;
      ball.y = pocket.y;
      pocketedSet.add(ball.id);
      break;
    }
  }
}

export function simulateShot(
  balls: PoolBall[],
  shot: ShotParams,
  table: TableConfig,
): ShotResult {
  const world = cloneBalls(balls);
  const cue = world.find((ball) => ball.id === 0 && !ball.pocketed);

  if (cue) {
    const shotPower = clamp(shot.power, 0, 1);
    const speed = MIN_SHOT_SPEED + (MAX_SHOT_SPEED - MIN_SHOT_SPEED) * shotPower;
    cue.vx = Math.cos(shot.angle) * speed;
    cue.vy = Math.sin(shot.angle) * speed;
    cue.spin = {
      x: clamp(shot.english.x, -1, 1),
      y: clamp(shot.english.y, -1, 1),
    };
  }

  const frames: PoolBall[][] = [cloneBalls(world)];
  const pocketedSet = new Set<number>();
  const railTouched = new Set<number>();
  const firstContactRef: { value: number | null } = { value: null };

  for (let step = 0; step < MAX_STEPS; step += 1) {
    for (const ball of world) {
      integrateBall(ball);
    }

    resolveBallCollisions(world, table.ballRadius, firstContactRef);
    resolveCushionCollisions(world, table, railTouched);
    detectPocketedBalls(world, table, pocketedSet);

    if (step % CAPTURE_STRIDE === 0) {
      frames.push(cloneBalls(world));
    }

    const moving = world.some(hasMotion);
    if (!moving) break;
  }

  const last = frames[frames.length - 1];
  const finalBalls = cloneBalls(world);
  if (!last || JSON.stringify(last) !== JSON.stringify(finalBalls)) {
    frames.push(cloneBalls(finalBalls));
  }

  return {
    frames,
    pocketed: [...pocketedSet.values()],
    firstContact: firstContactRef.value,
    railContacts: railTouched.size,
    cueScratch: pocketedSet.has(0),
    duration: Math.round(((frames.length - 1) * 1000) / 60),
    finalBalls,
  };
}

export function canPlaceCueBall(
  balls: PoolBall[],
  x: number,
  y: number,
  table: TableConfig,
  behindHeadStringOnly: boolean,
): boolean {
  const cueRadius = table.ballRadius;
  if (x < cueRadius || x > table.width - cueRadius) return false;
  if (y < cueRadius || y > table.height - cueRadius) return false;

  if (behindHeadStringOnly && y < table.headStringY) return false;

  for (const ball of balls) {
    if (ball.id === 0 || ball.pocketed) continue;
    const dx = ball.x - x;
    const dy = ball.y - y;
    if (dx * dx + dy * dy < (cueRadius * 2) * (cueRadius * 2)) return false;
  }

  return true;
}

export function placeCueBall(
  balls: PoolBall[],
  x: number,
  y: number,
): PoolBall[] {
  return balls.map((ball) => {
    if (ball.id !== 0) return cloneBall(ball);
    return {
      ...cloneBall(ball),
      pocketed: false,
      x,
      y,
      vx: 0,
      vy: 0,
      spin: { x: 0, y: 0 },
    };
  });
}

export function getLegalTargetIds(
  state: PoolMatchState,
  balls: PoolBall[],
  playerIndex: 0 | 1,
): number[] {
  const player = state.players[playerIndex];
  const visible = balls.filter((ball) => !ball.pocketed);

  if (!player.group) {
    return visible
      .filter((ball) => {
        const t = getBallType(ball.id);
        return t === "solid" || t === "stripe";
      })
      .map((ball) => ball.id);
  }

  if (player.remaining <= 0) {
    return visible
      .filter((ball) => ball.id === 8)
      .map((ball) => ball.id);
  }

  const targetType = groupToBallType(player.group);
  return visible
    .filter((ball) => getBallType(ball.id) === targetType)
    .map((ball) => ball.id);
}

function countPocketedByType(pocketedIds: number[], type: "solid" | "stripe"): number {
  let count = 0;
  for (const id of pocketedIds) {
    if (getBallType(id) === type) count += 1;
  }
  return count;
}

function selectGroupFromOpenTable(pocketedIds: number[]): BallGroup | null {
  const solidPocketed = countPocketedByType(pocketedIds, "solid");
  const stripePocketed = countPocketedByType(pocketedIds, "stripe");

  if (solidPocketed === 0 && stripePocketed === 0) return null;
  if (solidPocketed > stripePocketed) return "solids";
  if (stripePocketed > solidPocketed) return "stripes";

  const first = pocketedIds.find((id) => {
    const type = getBallType(id);
    return type === "solid" || type === "stripe";
  });
  if (first === undefined) return null;
  return getBallType(first) === "solid" ? "solids" : "stripes";
}

export function evaluateShot(
  previousState: PoolMatchState,
  shotResult: ShotResult,
): ShotEvaluation {
  const shooter = previousState.currentPlayer;
  const opponent: 0 | 1 = shooter === 0 ? 1 : 0;

  const shooterState: PlayerState = { ...previousState.players[shooter] };
  const opponentState: PlayerState = { ...previousState.players[opponent] };
  const pocketedObjectBalls = shotResult.pocketed.filter((id) => id !== 0);
  const pocketedEight = pocketedObjectBalls.includes(8);

  const firstContactType =
    shotResult.firstContact === null
      ? null
      : getBallType(shotResult.firstContact);

  const shooterGroup = shooterState.group;
  const isShooterOnEight = shooterGroup !== null && shooterState.remaining <= 0;

  let foulType: FoulType | null = null;

  if (shotResult.cueScratch) {
    foulType = "scratch";
  } else if (shotResult.firstContact === null) {
    foulType = "no_contact";
  } else if (shooterGroup) {
    const required = isShooterOnEight ? "eight" : groupToBallType(shooterGroup);
    if (firstContactType !== required) {
      foulType = "wrong_ball_first";
    }
  } else if (firstContactType === "eight") {
    foulType = "wrong_ball_first";
  }

  if (!foulType && shotResult.railContacts <= 0 && pocketedObjectBalls.length <= 0) {
    foulType = "no_rail";
  }

  if (previousState.breakShot && !foulType) {
    const legalBreak =
      shotResult.railContacts >= 4 || pocketedObjectBalls.length > 0;
    if (!legalBreak) {
      foulType = "no_rail";
    }
  }

  if (pocketedEight && (!shooterGroup || shooterState.remaining > 0)) {
    foulType = "early_eight";
  }

  if (previousState.openTable && !foulType && !shooterGroup) {
    const assigned = selectGroupFromOpenTable(pocketedObjectBalls);
    if (assigned) {
      shooterState.group = assigned;
      opponentState.group = oppositeGroup(assigned);
    }
  }

  shooterState.remaining = shooterState.group
    ? countRemainingByGroup(shotResult.finalBalls, shooterState.group)
    : 7;
  opponentState.remaining = opponentState.group
    ? countRemainingByGroup(shotResult.finalBalls, opponentState.group)
    : 7;

  let winner: 0 | 1 | null = null;
  let winnerReason: string | null = null;
  if (pocketedEight) {
    if (foulType) {
      winner = opponent;
      winnerReason = "opponent_foul_on_eight";
    } else {
      winner = shooter;
      winnerReason = "eight_ball";
    }
  }

  let keepTurn = false;
  if (!winner && !foulType) {
    if (shooterState.group === null) {
      keepTurn = pocketedObjectBalls.length > 0;
    } else if (shooterState.remaining <= 0) {
      keepTurn = pocketedEight;
    } else {
      const ownType = groupToBallType(shooterState.group);
      const ownPocketed = pocketedObjectBalls.filter(
        (id) => getBallType(id) === ownType,
      ).length;
      keepTurn = ownPocketed > 0;
    }
  }

  if (foulType) {
    shooterState.fouls += 1;
  } else {
    shooterState.fouls = 0;
  }

  const nextCurrentPlayer: 0 | 1 = keepTurn ? shooter : opponent;
  const nextState: PoolMatchState = {
    phase: winner !== null
      ? "game-over"
      : foulType
        ? "ball-in-hand"
        : (() => {
            const active = keepTurn ? shooterState : opponentState;
            return active.group !== null && active.remaining <= 0
              ? "shooting-eight"
              : "playing";
          })(),
    currentPlayer: nextCurrentPlayer,
    players:
      shooter === 0
        ? [shooterState, opponentState]
        : [opponentState, shooterState],
    openTable: shooterState.group === null || opponentState.group === null,
    breakShot: false,
    ballInHand: !!foulType,
    winner,
    lastFoul: foulType,
    winnerReason,
    turnNumber: previousState.turnNumber + 1,
  };

  const message = winner !== null
    ? winner === shooter
      ? "8-ball pocketed. Shooter wins."
      : "8-ball foul. Opponent wins."
    : foulType
      ? `Foul: ${foulType.replace("_", " ")}`
      : keepTurn
        ? "Legal shot. Shooter continues."
        : "Turn passes.";

  return {
    nextState,
    foulType,
    keepTurn,
    winner,
    message,
  };
}
