import {
  PoolBall,
  PoolMatchState,
  ShotResult,
  canPlaceCueBall,
  createInitialBalls,
  createInitialMatchState,
  createTable,
  evaluateShot,
  placeCueBall,
  simulateShot,
} from "@/services/games/poolEngine";

function makeBall(id: number, x: number, y: number): PoolBall {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    spin: { x: 0, y: 0 },
    pocketed: false,
  };
}

function makeShotResult(overrides: Partial<ShotResult>): ShotResult {
  const baseBalls = [makeBall(0, 100, 200), makeBall(1, 120, 200), makeBall(8, 140, 200)];
  return {
    frames: [baseBalls],
    pocketed: [],
    firstContact: 1,
    railContacts: 1,
    cueScratch: false,
    duration: 1200,
    finalBalls: baseBalls,
    ...overrides,
  };
}

describe("poolEngine", () => {
  it("resolves head-on ball collisions and captures first contact", () => {
    const table = createTable();
    const balls = [
      makeBall(0, table.width * 0.3, table.height * 0.5),
      makeBall(1, table.width * 0.3 + table.ballRadius * 2.2, table.height * 0.5),
    ];

    const result = simulateShot(
      balls,
      { angle: 0, power: 0.45, english: { x: 0, y: 0 } },
      table,
    );

    const object = result.finalBalls.find((ball) => ball.id === 1)!;
    expect(result.firstContact).toBe(1);
    expect(object.x).toBeGreaterThan(balls[1].x);
  });

  it("detects cushion contact and keeps balls in bounds", () => {
    const table = createTable();
    const balls = [makeBall(0, table.width * 0.5, table.height * 0.3)];

    const result = simulateShot(
      balls,
      { angle: 0, power: 0.95, english: { x: 0, y: 0 } },
      table,
    );

    const cue = result.finalBalls.find((ball) => ball.id === 0)!;
    expect(result.railContacts).toBeGreaterThan(0);
    expect(cue.x).toBeGreaterThanOrEqual(0);
    expect(cue.y).toBeGreaterThanOrEqual(0);
    expect(cue.x).toBeLessThanOrEqual(table.width);
    expect(cue.y).toBeLessThanOrEqual(table.height);
  });

  it("detects pocketing and cue scratch", () => {
    const table = createTable();
    const balls = [makeBall(0, table.width * 0.15, table.height * 0.15)];

    const result = simulateShot(
      balls,
      { angle: -Math.PI * 0.75, power: 0.95, english: { x: 0, y: 0 } },
      table,
    );

    expect(result.pocketed).toContain(0);
    expect(result.cueScratch).toBe(true);
  });

  it("produces a finite simulation window", () => {
    const table = createTable();
    const balls = createInitialBalls(table);
    const result = simulateShot(
      balls,
      { angle: -Math.PI / 2, power: 0.7, english: { x: 0.15, y: -0.2 } },
      table,
    );

    expect(result.frames.length).toBeGreaterThan(1);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThan(120000);
  });

  it("applies top spin and draw differently", () => {
    const table = createTable();
    const startX = table.width * 0.5;
    const startY = table.height * 0.7;
    const targetY = table.height * 0.45;
    const balls = [makeBall(0, startX, startY), makeBall(1, startX, targetY)];

    const follow = simulateShot(
      balls,
      { angle: -Math.PI / 2, power: 0.55, english: { x: 0, y: 0.8 } },
      table,
    );
    const draw = simulateShot(
      balls,
      { angle: -Math.PI / 2, power: 0.55, english: { x: 0, y: -0.8 } },
      table,
    );

    const cueFollow = follow.finalBalls.find((ball) => ball.id === 0)!;
    const cueDraw = draw.finalBalls.find((ball) => ball.id === 0)!;
    expect(cueFollow.y).toBeLessThan(cueDraw.y);
  });

  it("flags break foul when no rail/pocket requirement is missed", () => {
    const state = createInitialMatchState();
    const result = makeShotResult({ railContacts: 0, pocketed: [] });
    const evaluation = evaluateShot(state, result);

    expect(evaluation.foulType).toBe("no_rail");
    expect(evaluation.nextState.ballInHand).toBe(true);
  });

  it("flags scratch foul", () => {
    const state = createInitialMatchState();
    const result = makeShotResult({ cueScratch: true });
    const evaluation = evaluateShot(state, result);

    expect(evaluation.foulType).toBe("scratch");
    expect(evaluation.nextState.ballInHand).toBe(true);
  });

  it("wins when legally pocketing the eight ball", () => {
    const state: PoolMatchState = {
      ...createInitialMatchState(),
      breakShot: false,
      openTable: false,
      currentPlayer: 0,
      players: [
        { group: "solids", remaining: 0, fouls: 0 },
        { group: "stripes", remaining: 1, fouls: 0 },
      ],
      phase: "shooting-eight",
    };

    const finalBalls = [makeBall(0, 100, 200), { ...makeBall(8, 150, 200), pocketed: true }];
    const result = makeShotResult({
      firstContact: 8,
      pocketed: [8],
      finalBalls,
    });
    const evaluation = evaluateShot(state, result);

    expect(evaluation.winner).toBe(0);
    expect(evaluation.nextState.phase).toBe("game-over");
  });

  it("loses when pocketing the eight ball early", () => {
    const state: PoolMatchState = {
      ...createInitialMatchState(),
      breakShot: false,
      openTable: false,
      currentPlayer: 0,
      players: [
        { group: "solids", remaining: 3, fouls: 0 },
        { group: "stripes", remaining: 4, fouls: 0 },
      ],
    };

    const result = makeShotResult({ firstContact: 8, pocketed: [8] });
    const evaluation = evaluateShot(state, result);
    expect(evaluation.foulType).toBe("early_eight");
    expect(evaluation.winner).toBe(1);
  });

  it("enforces ball-in-hand placement overlap rules", () => {
    const table = createTable();
    const balls = createInitialBalls(table);
    const occupied = balls.find((ball) => ball.id !== 0)!;
    const legal = canPlaceCueBall(balls, occupied.x, occupied.y, table, false);
    expect(legal).toBe(false);

    const placed = placeCueBall(balls, table.width * 0.6, table.height * 0.8);
    const cue = placed.find((ball) => ball.id === 0)!;
    expect(cue.pocketed).toBe(false);
    expect(cue.vx).toBe(0);
    expect(cue.vy).toBe(0);
  });

  it("runs multiple sequential shots without crashing", () => {
    const table = createTable();
    let balls = createInitialBalls(table);

    for (let i = 0; i < 6; i += 1) {
      const shot = {
        angle: -Math.PI / 2 + i * 0.15,
        power: 0.35 + (i % 3) * 0.2,
        english: { x: (i % 2 ? 0.2 : -0.2), y: i % 3 === 0 ? 0.3 : -0.1 },
      };
      const result = simulateShot(balls, shot, table);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(120000);
      balls = result.finalBalls;
    }
  });
});
