"use strict";
/**
 * Mini Golf — Server-side Course Pack (duplicated for parity)
 *
 * MUST remain in sync with src/gamesV4/games/miniGolf/courses/pigeonClassic.ts
 * The hole geometry is identical to ensure deterministic simulation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIGEON_CLASSIC = void 0;
exports.getCoursePack = getCoursePack;
exports.getTotalPar = getTotalPar;
function rectWalls(w, h, inset = 0.05) {
    return [
        {
            points: [
                { x: inset, y: inset },
                { x: w - inset, y: inset },
                { x: w - inset, y: h - inset },
                { x: inset, y: h - inset },
            ],
            loop: true,
        },
    ];
}
const hole01 = {
    id: "pigeon_01",
    name: "Warmup Lane",
    par: 2,
    bounds: { width: 3, height: 8 },
    tee: { x: 1.5, y: 7 },
    cup: { x: 1.5, y: 1 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(3, 8),
        {
            points: [
                { x: 2.2, y: 4.5 },
                { x: 2.2, y: 3.5 },
            ],
            loop: false,
        },
    ],
};
const hole02 = {
    id: "pigeon_02",
    name: "Pocket Corner",
    par: 2,
    bounds: { width: 5, height: 8 },
    tee: { x: 1.5, y: 7 },
    cup: { x: 3.5, y: 1.5 },
    cupRadius: 0.15,
    walls: [
        {
            points: [
                { x: 0.05, y: 0.05 },
                { x: 5, y: 0.05 },
                { x: 5, y: 3 },
                { x: 3, y: 3 },
                { x: 3, y: 5 },
                { x: 3, y: 8 },
                { x: 0.05, y: 8 },
            ],
            loop: true,
        },
        {
            points: [
                { x: 2, y: 3 },
                { x: 2, y: 5 },
            ],
            loop: false,
        },
    ],
};
const hole03 = {
    id: "pigeon_03",
    name: "Twin Posts",
    par: 3,
    bounds: { width: 4, height: 9 },
    tee: { x: 2, y: 8 },
    cup: { x: 2, y: 1 },
    cupRadius: 0.15,
    walls: rectWalls(4, 9),
    bumpers: [
        { pos: { x: 1.3, y: 5 }, radius: 0.2, restitution: 0.8 },
        { pos: { x: 2.7, y: 5 }, radius: 0.2, restitution: 0.8 },
        { pos: { x: 1.6, y: 3 }, radius: 0.2, restitution: 0.8 },
        { pos: { x: 2.4, y: 3 }, radius: 0.2, restitution: 0.8 },
    ],
};
const hole04 = {
    id: "pigeon_04",
    name: "Sand Trap Split",
    par: 3,
    bounds: { width: 4, height: 9 },
    tee: { x: 2, y: 8 },
    cup: { x: 2, y: 1 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(4, 9),
        {
            points: [
                { x: 2, y: 3 },
                { x: 2, y: 5 },
            ],
            loop: false,
        },
    ],
    surfaces: [
        {
            type: "sand",
            vertices: [
                { x: 0.3, y: 3.5 },
                { x: 1.8, y: 3.5 },
                { x: 1.8, y: 5 },
                { x: 0.3, y: 5 },
            ],
        },
        {
            type: "sand",
            vertices: [
                { x: 2.2, y: 4 },
                { x: 3.7, y: 4 },
                { x: 3.7, y: 5.5 },
                { x: 2.2, y: 5.5 },
            ],
        },
    ],
};
const hole05 = {
    id: "pigeon_05",
    name: "Water Shelf",
    par: 3,
    bounds: { width: 4, height: 9 },
    tee: { x: 2, y: 8 },
    cup: { x: 2, y: 1.5 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(4, 9),
        {
            points: [
                { x: 0.05, y: 4.5 },
                { x: 1.2, y: 4.5 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 2.8, y: 4.5 },
                { x: 3.95, y: 4.5 },
            ],
            loop: false,
        },
    ],
    hazards: [
        {
            type: "water",
            vertices: [
                { x: 0.3, y: 4.7 },
                { x: 1.5, y: 4.7 },
                { x: 1.5, y: 6 },
                { x: 0.3, y: 6 },
            ],
        },
        {
            type: "water",
            vertices: [
                { x: 2.5, y: 4.7 },
                { x: 3.7, y: 4.7 },
                { x: 3.7, y: 6 },
                { x: 2.5, y: 6 },
            ],
        },
    ],
};
const hole06 = {
    id: "pigeon_06",
    name: "Bumper Pinball",
    par: 3,
    bounds: { width: 4, height: 9 },
    tee: { x: 2, y: 8 },
    cup: { x: 2, y: 1 },
    cupRadius: 0.15,
    walls: rectWalls(4, 9),
    bumpers: [
        { pos: { x: 1.3, y: 6 }, radius: 0.25, restitution: 1.3 },
        { pos: { x: 2.7, y: 6 }, radius: 0.25, restitution: 1.3 },
        { pos: { x: 2, y: 4.5 }, radius: 0.3, restitution: 1.3 },
        { pos: { x: 1, y: 3 }, radius: 0.25, restitution: 1.3 },
        { pos: { x: 3, y: 3 }, radius: 0.25, restitution: 1.3 },
        { pos: { x: 2, y: 2 }, radius: 0.2, restitution: 1.3 },
    ],
};
const hole07 = {
    id: "pigeon_07",
    name: "S-Curve Rail",
    par: 4,
    bounds: { width: 5, height: 10 },
    tee: { x: 1.5, y: 9 },
    cup: { x: 3.5, y: 1 },
    cupRadius: 0.15,
    walls: [
        {
            points: [
                { x: 0.05, y: 0.05 },
                { x: 5, y: 0.05 },
                { x: 5, y: 10 },
                { x: 0.05, y: 10 },
            ],
            loop: true,
        },
        {
            points: [
                { x: 3, y: 8 },
                { x: 3, y: 6.5 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 2, y: 5.5 },
                { x: 2, y: 4 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 3, y: 3 },
                { x: 3, y: 1.5 },
            ],
            loop: false,
        },
    ],
};
const hole08 = {
    id: "pigeon_08",
    name: "Bridge Over Water",
    par: 4,
    bounds: { width: 5, height: 10 },
    tee: { x: 2.5, y: 9 },
    cup: { x: 2.5, y: 1 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(5, 10),
        {
            points: [
                { x: 1.8, y: 6.5 },
                { x: 1.8, y: 4.5 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 3.2, y: 6.5 },
                { x: 3.2, y: 4.5 },
            ],
            loop: false,
        },
    ],
    hazards: [
        {
            type: "water",
            vertices: [
                { x: 0.3, y: 4.5 },
                { x: 1.6, y: 4.5 },
                { x: 1.6, y: 6.5 },
                { x: 0.3, y: 6.5 },
            ],
        },
        {
            type: "water",
            vertices: [
                { x: 3.4, y: 4.5 },
                { x: 4.7, y: 4.5 },
                { x: 4.7, y: 6.5 },
                { x: 3.4, y: 6.5 },
            ],
        },
    ],
};
const hole09 = {
    id: "pigeon_09",
    name: "Slope Nudge",
    par: 3,
    bounds: { width: 4, height: 9 },
    tee: { x: 2, y: 8 },
    cup: { x: 2, y: 1 },
    cupRadius: 0.15,
    walls: rectWalls(4, 9),
    slopes: [
        {
            vertices: [
                { x: 0.3, y: 4 },
                { x: 3.7, y: 4 },
                { x: 3.7, y: 5.5 },
                { x: 0.3, y: 5.5 },
            ],
            force: { x: 1.5, y: 0 },
        },
        {
            vertices: [
                { x: 0.3, y: 1.5 },
                { x: 3.7, y: 1.5 },
                { x: 3.7, y: 2.5 },
                { x: 0.3, y: 2.5 },
            ],
            force: { x: -1.0, y: 0 },
        },
    ],
};
const hole10 = {
    id: "pigeon_10",
    name: "Windmill Gate",
    par: 4,
    bounds: { width: 4, height: 10 },
    tee: { x: 2, y: 9 },
    cup: { x: 2, y: 1 },
    cupRadius: 0.15,
    walls: rectWalls(4, 10),
    rotatingGates: [
        {
            pivot: { x: 2, y: 5 },
            length: 1.8,
            thickness: 0.12,
            angularVelocity: 0.03,
            initialAngle: 0,
        },
    ],
};
const hole11 = {
    id: "pigeon_11",
    name: "Conveyor Strip",
    par: 4,
    bounds: { width: 4, height: 10 },
    tee: { x: 2, y: 9 },
    cup: { x: 2, y: 1 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(4, 10),
        {
            points: [
                { x: 0.8, y: 2.5 },
                { x: 1.5, y: 1.5 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 3.2, y: 2.5 },
                { x: 2.5, y: 1.5 },
            ],
            loop: false,
        },
    ],
    conveyors: [
        {
            vertices: [
                { x: 0.3, y: 5 },
                { x: 3.7, y: 5 },
                { x: 3.7, y: 6.5 },
                { x: 0.3, y: 6.5 },
            ],
            force: { x: -2, y: 0 },
        },
        {
            vertices: [
                { x: 0.3, y: 3 },
                { x: 3.7, y: 3 },
                { x: 3.7, y: 4.5 },
                { x: 0.3, y: 4.5 },
            ],
            force: { x: 2, y: 0 },
        },
    ],
};
const hole12 = {
    id: "pigeon_12",
    name: "Ice Alley",
    par: 3,
    bounds: { width: 3, height: 9 },
    tee: { x: 1.5, y: 8 },
    cup: { x: 1.5, y: 1 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(3, 9),
        {
            points: [
                { x: 0.05, y: 5 },
                { x: 1.5, y: 5 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 1.5, y: 3.5 },
                { x: 2.95, y: 3.5 },
            ],
            loop: false,
        },
    ],
    surfaces: [
        {
            type: "ice",
            vertices: [
                { x: 0.1, y: 0.1 },
                { x: 2.9, y: 0.1 },
                { x: 2.9, y: 8.9 },
                { x: 0.1, y: 8.9 },
            ],
        },
    ],
};
const hole13 = {
    id: "pigeon_13",
    name: "Spinner Bowl",
    par: 4,
    bounds: { width: 5, height: 10 },
    tee: { x: 2.5, y: 9 },
    cup: { x: 2.5, y: 1.5 },
    cupRadius: 0.15,
    walls: rectWalls(5, 10),
    bumpers: [
        { pos: { x: 1.5, y: 5 }, radius: 0.3, restitution: 1.2 },
        { pos: { x: 3.5, y: 5 }, radius: 0.3, restitution: 1.2 },
        { pos: { x: 2.5, y: 4 }, radius: 0.3, restitution: 1.2 },
        { pos: { x: 2.5, y: 6 }, radius: 0.3, restitution: 1.2 },
    ],
    rotatingGates: [
        {
            pivot: { x: 2.5, y: 5 },
            length: 1.4,
            thickness: 0.1,
            angularVelocity: 0.04,
            initialAngle: 0,
        },
    ],
};
const hole14 = {
    id: "pigeon_14",
    name: "Portal Pair",
    par: 4,
    bounds: { width: 5, height: 10 },
    tee: { x: 1.5, y: 9 },
    cup: { x: 3.5, y: 1 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(5, 10),
        {
            points: [
                { x: 2.5, y: 7 },
                { x: 2.5, y: 3 },
            ],
            loop: false,
        },
    ],
    portals: [
        {
            id: "portal_a",
            pos: { x: 1.5, y: 3.5 },
            radius: 0.25,
            targetId: "portal_b",
            exitOffset: { x: 0, y: -0.5 },
        },
        {
            id: "portal_b",
            pos: { x: 3.5, y: 6.5 },
            radius: 0.25,
            targetId: "portal_a",
            exitOffset: { x: 0, y: -0.5 },
        },
    ],
};
const hole15 = {
    id: "pigeon_15",
    name: "Bump + Ramp",
    par: 5,
    bounds: { width: 5, height: 12 },
    tee: { x: 2.5, y: 11 },
    cup: { x: 2.5, y: 1 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(5, 12),
        {
            points: [
                { x: 0.05, y: 8 },
                { x: 3.5, y: 8 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 1.5, y: 6 },
                { x: 4.95, y: 6 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 0.05, y: 4 },
                { x: 3.5, y: 4 },
            ],
            loop: false,
        },
    ],
    bumpers: [
        { pos: { x: 4, y: 9 }, radius: 0.3, restitution: 1.2 },
        { pos: { x: 1, y: 7 }, radius: 0.3, restitution: 1.2 },
        { pos: { x: 4, y: 5 }, radius: 0.3, restitution: 1.2 },
    ],
    boosts: [
        {
            vertices: [
                { x: 1.5, y: 2.5 },
                { x: 3.5, y: 2.5 },
                { x: 3.5, y: 3.5 },
                { x: 1.5, y: 3.5 },
            ],
            impulse: { x: 0, y: -3 },
        },
    ],
};
const hole16 = {
    id: "pigeon_16",
    name: "Needle Thread",
    par: 5,
    bounds: { width: 4, height: 12 },
    tee: { x: 2, y: 11 },
    cup: { x: 2, y: 1 },
    cupRadius: 0.13,
    walls: [
        ...rectWalls(4, 12),
        {
            points: [
                { x: 0.05, y: 9 },
                { x: 1.5, y: 9 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 2.5, y: 9 },
                { x: 3.95, y: 9 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 0.05, y: 7 },
                { x: 1.3, y: 7 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 2.7, y: 7 },
                { x: 3.95, y: 7 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 0.05, y: 5 },
                { x: 1.6, y: 5 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 2.4, y: 5 },
                { x: 3.95, y: 5 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 0.05, y: 3 },
                { x: 1.4, y: 3 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 2.6, y: 3 },
                { x: 3.95, y: 3 },
            ],
            loop: false,
        },
    ],
    surfaces: [
        {
            type: "rough",
            vertices: [
                { x: 0.3, y: 5.2 },
                { x: 3.7, y: 5.2 },
                { x: 3.7, y: 6.8 },
                { x: 0.3, y: 6.8 },
            ],
        },
    ],
};
const hole17 = {
    id: "pigeon_17",
    name: "Split Decision",
    par: 5,
    bounds: { width: 6, height: 10 },
    tee: { x: 3, y: 9 },
    cup: { x: 3, y: 1 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(6, 10),
        {
            points: [
                { x: 2.3, y: 7.5 },
                { x: 3.7, y: 7.5 },
                { x: 3.7, y: 3 },
                { x: 2.3, y: 3 },
            ],
            loop: true,
        },
    ],
    surfaces: [
        {
            type: "sand",
            vertices: [
                { x: 0.3, y: 4 },
                { x: 2.1, y: 4 },
                { x: 2.1, y: 5.5 },
                { x: 0.3, y: 5.5 },
            ],
        },
    ],
    hazards: [
        {
            type: "water",
            vertices: [
                { x: 3.9, y: 5 },
                { x: 5.7, y: 5 },
                { x: 5.7, y: 6.5 },
                { x: 3.9, y: 6.5 },
            ],
        },
    ],
    bumpers: [
        { pos: { x: 1.2, y: 3.5 }, radius: 0.2, restitution: 1.1 },
        { pos: { x: 4.8, y: 3.5 }, radius: 0.2, restitution: 1.1 },
    ],
};
const hole18 = {
    id: "pigeon_18",
    name: "Final Gauntlet",
    par: 6,
    bounds: { width: 6, height: 14 },
    tee: { x: 3, y: 13 },
    cup: { x: 3, y: 1 },
    cupRadius: 0.15,
    walls: [
        ...rectWalls(6, 14),
        {
            points: [
                { x: 4, y: 12 },
                { x: 4, y: 10 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 2, y: 9 },
                { x: 2, y: 7 },
            ],
            loop: false,
        },
        {
            points: [
                { x: 4, y: 6 },
                { x: 4, y: 4 },
            ],
            loop: false,
        },
    ],
    bumpers: [
        { pos: { x: 1.5, y: 11 }, radius: 0.3, restitution: 1.3 },
        { pos: { x: 4.5, y: 8 }, radius: 0.3, restitution: 1.3 },
        { pos: { x: 1.5, y: 5 }, radius: 0.3, restitution: 1.3 },
        { pos: { x: 4.5, y: 3 }, radius: 0.25, restitution: 1.2 },
    ],
    surfaces: [
        {
            type: "ice",
            vertices: [
                { x: 0.3, y: 7 },
                { x: 5.7, y: 7 },
                { x: 5.7, y: 9 },
                { x: 0.3, y: 9 },
            ],
        },
        {
            type: "sand",
            vertices: [
                { x: 0.3, y: 4 },
                { x: 5.7, y: 4 },
                { x: 5.7, y: 6 },
                { x: 0.3, y: 6 },
            ],
        },
    ],
    hazards: [
        {
            type: "water",
            vertices: [
                { x: 0.3, y: 2 },
                { x: 2, y: 2 },
                { x: 2, y: 3 },
                { x: 0.3, y: 3 },
            ],
        },
        {
            type: "water",
            vertices: [
                { x: 4, y: 2 },
                { x: 5.7, y: 2 },
                { x: 5.7, y: 3 },
                { x: 4, y: 3 },
            ],
        },
    ],
    rotatingGates: [
        {
            pivot: { x: 3, y: 3 },
            length: 1.6,
            thickness: 0.12,
            angularVelocity: 0.025,
            initialAngle: 0,
        },
    ],
    conveyors: [
        {
            vertices: [
                { x: 0.3, y: 10 },
                { x: 5.7, y: 10 },
                { x: 5.7, y: 12 },
                { x: 0.3, y: 12 },
            ],
            force: { x: 2, y: 0 },
        },
    ],
};
exports.PIGEON_CLASSIC = {
    id: "pigeon_classic",
    name: "Pigeon Classic",
    holes: [
        hole01,
        hole02,
        hole03,
        hole04,
        hole05,
        hole06,
        hole07,
        hole08,
        hole09,
        hole10,
        hole11,
        hole12,
        hole13,
        hole14,
        hole15,
        hole16,
        hole17,
        hole18,
    ],
};
function getCoursePack(id) {
    if (id === "pigeon_classic")
        return exports.PIGEON_CLASSIC;
    return null;
}
function getTotalPar(pack, holeCount) {
    return pack.holes.slice(0, holeCount).reduce((sum, h) => sum + h.par, 0);
}
//# sourceMappingURL=courses.js.map