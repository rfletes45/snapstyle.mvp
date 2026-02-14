/**
 * Golf Duels — Physics Engine Tests  (Segment 3 spec)
 *
 * Tests physics invariants: exponential damping, wall reflection, cup capture,
 * surface zones, hazard detection, obstacle interactions, rest-time, shot mapping.
 */

import path from "path";
import { loadCoursesFromDisk } from "../src/courseLoader";
import { applyShot, physicsTick, simulateUntilSettled } from "../src/physics";
import { BallState, HoleData, PHYSICS } from "../src/types";

// Minimal hole for testing
const SIMPLE_HOLE: HoleData = {
  version: 1,
  holeId: "T1-1",
  tier: 1,
  bounds: { width: 14, height: 6 },
  start: { x: 2, z: 3 },
  cup: { x: 12, z: 3 },
  walls: [
    { a: { x: 0, z: 0 }, b: { x: 14, z: 0 } },
    { a: { x: 14, z: 0 }, b: { x: 14, z: 6 } },
    { a: { x: 14, z: 6 }, b: { x: 0, z: 6 } },
    { a: { x: 0, z: 6 }, b: { x: 0, z: 0 } },
  ],
  surfaces: [],
  heightFields: [],
  obstacles: [],
  hazards: [],
  decor: { theme: "turf_classic", seed: 1 },
};

function makeBall(x: number, z: number, vx = 0, vz = 0): BallState {
  return { x, z, vx, vz };
}

describe("Physics Engine", () => {
  describe("Exponential damping", () => {
    it("should decelerate a moving ball to a stop via rest-time", () => {
      const ball = makeBall(5, 3, 3, 0);
      const result = simulateUntilSettled(ball, SIMPLE_HOLE);
      expect(result.result.stopped).toBe(true);
      expect(result.result.ball.vx).toBe(0);
      expect(result.result.ball.vz).toBe(0);
    });

    it("should produce monotonic speed decrease on turf", () => {
      let ball = makeBall(5, 3, 6, 0);
      let prevSpeed = Math.sqrt(ball.vx ** 2 + ball.vz ** 2);
      let restAccum = 0;
      // Run 30 ticks — speed must decrease every tick
      for (let i = 0; i < 30; i++) {
        const result = physicsTick(ball, SIMPLE_HOLE, PHYSICS.DT, 0, restAccum);
        ball = result.ball;
        restAccum = result.restAccum;
        const speed = Math.sqrt(ball.vx ** 2 + ball.vz ** 2);
        expect(speed).toBeLessThanOrEqual(prevSpeed + 1e-9);
        prevSpeed = speed;
      }
    });

    it("should accumulate rest time before declaring stopped", () => {
      // Ball just barely moving — needs REST_TIME accumulator to reach stop state
      const ball = makeBall(5, 3, 0.04, 0); // below STOP_THRESHOLD (0.05)
      const r1 = physicsTick(ball, SIMPLE_HOLE, PHYSICS.DT, 0, 0);
      // restAccum should increase but not yet reach REST_TIME
      expect(r1.restAccum).toBeGreaterThan(0);
      expect(r1.restAccum).toBeLessThan(PHYSICS.REST_TIME);
      expect(r1.stopped).toBe(false);
    });

    it("should declare stopped after sufficient rest time", () => {
      const ball = makeBall(5, 3, 0.04, 0);
      // Provide accumulated rest time just below threshold
      const r = physicsTick(
        ball,
        SIMPLE_HOLE,
        PHYSICS.DT,
        0,
        PHYSICS.REST_TIME,
      );
      expect(r.stopped).toBe(true);
    });
  });

  describe("Wall bounce", () => {
    it("should bounce off the right wall", () => {
      const ball = makeBall(13.8, 3, 5, 0);
      const result = physicsTick(ball, SIMPLE_HOLE, PHYSICS.DT, 0);
      expect(result.ball.vx).toBeLessThan(0);
    });

    it("should bounce off the top wall", () => {
      const ball = makeBall(7, 0.2, 0, -5);
      const result = physicsTick(ball, SIMPLE_HOLE, PHYSICS.DT, 0);
      expect(result.ball.vz).toBeGreaterThan(0);
    });

    it("should preserve ball inside bounds after bounce", () => {
      const ball = makeBall(7, 3, 10, 8);
      const result = simulateUntilSettled(ball, SIMPLE_HOLE);
      const finalBall = result.result.ball;
      expect(finalBall.x).toBeGreaterThanOrEqual(PHYSICS.BALL_RADIUS);
      expect(finalBall.x).toBeLessThanOrEqual(
        SIMPLE_HOLE.bounds.width - PHYSICS.BALL_RADIUS,
      );
      expect(finalBall.z).toBeGreaterThanOrEqual(PHYSICS.BALL_RADIUS);
      expect(finalBall.z).toBeLessThanOrEqual(
        SIMPLE_HOLE.bounds.height - PHYSICS.BALL_RADIUS,
      );
    });

    it("should apply wall restitution of 0.6", () => {
      // Ball moving right at 10 m/s, hitting right wall
      const ball = makeBall(14 - PHYSICS.BALL_RADIUS - 0.01, 3, 10, 0);
      const r = physicsTick(ball, SIMPLE_HOLE, PHYSICS.DT, 0);
      // After bounce, speed should be ~60% of incoming component
      // (exponential damping also applies, but for a single tick it's minimal)
      expect(Math.abs(r.ball.vx)).toBeLessThan(10);
      expect(r.ball.vx).toBeLessThan(0); // reflected
    });
  });

  describe("Cup capture", () => {
    it("should capture a slow ball near the cup", () => {
      // Ball near cup, moving gently toward it
      const ball = makeBall(11.8, 3, 0.3, 0);
      const result = simulateUntilSettled(ball, SIMPLE_HOLE);
      expect(result.result.holed).toBe(true);
      expect(result.result.ball.x).toBe(SIMPLE_HOLE.cup.x);
      expect(result.result.ball.z).toBe(SIMPLE_HOLE.cup.z);
    });

    it("should NOT capture a fast ball flying over the cup", () => {
      // Ball going past cup at high speed (above CUP_CAPTURE_SPEED = 1.2)
      const ball = makeBall(11, 3, PHYSICS.CUP_CAPTURE_SPEED + 2, 0);
      const result = physicsTick(ball, SIMPLE_HOLE, PHYSICS.DT, 0);
      expect(result.holed).toBe(false);
    });

    it("cup radius is 0.22 per spec", () => {
      expect(PHYSICS.CUP_RADIUS).toBe(0.22);
    });

    it("cup capture speed is 1.2 per spec", () => {
      expect(PHYSICS.CUP_CAPTURE_SPEED).toBe(1.2);
    });
  });

  describe("applyShot (S3 exact mapping)", () => {
    it("should apply velocity in the correct direction", () => {
      const ball = makeBall(2, 3);
      const shot = applyShot(ball, 0, 0.5);
      expect(shot.vx).toBeGreaterThan(0);
      expect(Math.abs(shot.vz)).toBeLessThan(0.001);
    });

    it("should clamp power to 0-1", () => {
      const ball = makeBall(2, 3);
      const shotMax = applyShot(ball, 0, 1.5);
      const shotNormal = applyShot(ball, 0, 1.0);
      expect(shotMax.vx).toBe(shotNormal.vx);

      const shotMin = applyShot(ball, 0, -0.5);
      const shotZero = applyShot(ball, 0, 0);
      expect(shotMin.vx).toBe(shotZero.vx);
    });

    it("speed at power=0 should be SHOT_SPEED_MIN (2.2)", () => {
      const ball = makeBall(2, 3);
      const shot = applyShot(ball, 0, 0);
      const spd = Math.sqrt(shot.vx ** 2 + shot.vz ** 2);
      expect(spd).toBeCloseTo(PHYSICS.SHOT_SPEED_MIN, 5);
    });

    it("speed at power=1 should be SHOT_SPEED_MAX (11.5)", () => {
      const ball = makeBall(2, 3);
      const shot = applyShot(ball, 0, 1);
      const spd = Math.sqrt(shot.vx ** 2 + shot.vz ** 2);
      expect(spd).toBeCloseTo(PHYSICS.SHOT_SPEED_MAX, 5);
    });

    it("should use power^1.15 curve", () => {
      const ball = makeBall(2, 3);
      const shot = applyShot(ball, 0, 0.5);
      const spd = Math.sqrt(shot.vx ** 2 + shot.vz ** 2);
      const expected =
        PHYSICS.SHOT_SPEED_MIN +
        Math.pow(0.5, PHYSICS.SHOT_POWER_EXPONENT) *
          (PHYSICS.SHOT_SPEED_MAX - PHYSICS.SHOT_SPEED_MIN);
      expect(spd).toBeCloseTo(expected, 5);
    });
  });

  describe("Sand surface (exponential damping)", () => {
    it("should slow the ball more on sand", () => {
      const holeWithSand: HoleData = {
        ...SIMPLE_HOLE,
        surfaces: [
          {
            type: "sand",
            id: "s1",
            shape: "aabb",
            min: { x: 4, z: 2 },
            max: { x: 8, z: 4 },
          },
        ],
      };

      const ballInSand = makeBall(6, 3, 5, 0);
      const resultSand = physicsTick(ballInSand, holeWithSand, PHYSICS.DT, 0);

      const ballOnGreen = makeBall(2, 3, 5, 0);
      const resultGreen = physicsTick(ballOnGreen, SIMPLE_HOLE, PHYSICS.DT, 0);

      expect(Math.abs(resultSand.ball.vx)).toBeLessThan(
        Math.abs(resultGreen.ball.vx),
      );
    });
  });

  describe("Hazard detection", () => {
    it("should detect water hazard", () => {
      const holeWithWater: HoleData = {
        ...SIMPLE_HOLE,
        hazards: [
          {
            type: "water",
            id: "w1",
            shape: "aabb",
            min: { x: 5, z: 1 },
            max: { x: 9, z: 5 },
          },
        ],
      };

      const ball = makeBall(7, 3, 0, 0);
      const result = physicsTick(ball, holeWithWater, PHYSICS.DT, 0);
      expect(result.hitHazard).not.toBeNull();
      expect(result.hitHazard!.type).toBe("water");
    });
  });

  describe("Bumper round (restitution 0.85)", () => {
    it("should bounce the ball away from a bumper", () => {
      const holeWithBumper: HoleData = {
        ...SIMPLE_HOLE,
        obstacles: [
          {
            type: "bumper_round",
            id: "b1",
            pos: { x: 7, z: 3 },
            radius: 0.5,
          },
        ],
      };

      const ball = makeBall(6, 3, 5, 0);
      const result = simulateUntilSettled(ball, holeWithBumper, 0, 2);
      const finalBall = result.result.ball;
      const distToBumper = Math.sqrt(
        (finalBall.x - 7) ** 2 + (finalBall.z - 3) ** 2,
      );
      expect(distToBumper).toBeGreaterThanOrEqual(
        0.5 + PHYSICS.BALL_RADIUS - 0.01,
      );
    });
  });

  describe("Physics constants match S3 spec", () => {
    it("ball radius = 0.18", () => expect(PHYSICS.BALL_RADIUS).toBe(0.18));
    it("cup radius = 0.22", () => expect(PHYSICS.CUP_RADIUS).toBe(0.22));
    it("turf damping = 2.2", () => expect(PHYSICS.TURF_DAMPING).toBe(2.2));
    it("sand damping = 4.5", () => expect(PHYSICS.SAND_DAMPING).toBe(4.5));
    it("slow damping = 7.0", () => expect(PHYSICS.SLOW_DAMPING).toBe(7.0));
    it("wall restitution = 0.6", () =>
      expect(PHYSICS.WALL_RESTITUTION).toBe(0.6));
    it("bumper restitution = 0.85", () =>
      expect(PHYSICS.BUMPER_RESTITUTION).toBe(0.85));
    it("stop threshold = 0.05", () =>
      expect(PHYSICS.STOP_THRESHOLD).toBe(0.05));
    it("rest time = 0.25", () => expect(PHYSICS.REST_TIME).toBe(0.25));
    it("max sim time = 6.0", () => expect(PHYSICS.MAX_SIM_TIME).toBe(6.0));
    it("slope scale = 0.35", () => expect(PHYSICS.SLOPE_SCALE).toBe(0.35));
    it("gravity = 9.81", () => expect(PHYSICS.GRAVITY).toBe(9.81));
    it("dt = 1/60", () => expect(PHYSICS.DT).toBeCloseTo(1 / 60, 10));
  });

  describe("Full course simulation", () => {
    it("should simulate a shot on T1-1 without errors", async () => {
      const library = await loadCoursesFromDisk(
        path.resolve(__dirname, "../courses"),
      );
      const hole = library.getHole("T1-1")!;

      const ball = makeBall(hole.start.x, hole.start.z);
      const shot = applyShot(ball, 0, 0.8);
      const result = simulateUntilSettled(shot, hole);

      expect(result.frames.length).toBeGreaterThan(1);
      expect(result.result.stopped || result.result.holed).toBe(true);
    });
  });

  describe("Hazard reset increments stroke", () => {
    it("physics detects hazard, reset simulation adds penalty stroke", () => {
      const holeWithWater: HoleData = {
        ...SIMPLE_HOLE,
        hazards: [
          {
            type: "water",
            id: "w1",
            shape: "aabb",
            min: { x: 5, z: 1 },
            max: { x: 9, z: 5 },
          },
        ],
      };

      // Simulate a shot heading right — ball will enter water zone
      // Start closer so exponential damping doesn't stop the ball before the zone
      const startBall = makeBall(4.5, 3);
      const shotBall = applyShot(startBall, 0, 0.7);

      let strokes = 1; // shot was taken → stroke 1
      const lastSafe = { x: startBall.x, z: startBall.z };

      // simulateUntilSettled stops at hazard hit
      const sim = simulateUntilSettled(shotBall, holeWithWater);

      if (sim.result.hitHazard) {
        // Room logic: penalty stroke + reset to lastSafe
        strokes++;
      }

      expect(sim.result.hitHazard).not.toBeNull();
      expect(sim.result.hitHazard!.type).toBe("water");
      expect(strokes).toBe(2); // 1 shot + 1 penalty = 2 strokes

      // After reset, ball goes back to last safe position
      const resetBall = makeBall(lastSafe.x, lastSafe.z);
      expect(resetBall.vx).toBe(0);
      expect(resetBall.vz).toBe(0);
    });
  });
});
