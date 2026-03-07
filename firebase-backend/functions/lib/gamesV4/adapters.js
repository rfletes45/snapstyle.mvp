"use strict";
/**
 * Games V4 — Backend Adapter System
 *
 * Self-contained adapter framework for the Cloud Functions environment.
 * Contains:
 * - Adapter interface (mirrors client types)
 * - Registry (register/query)
 * - Game runner (validate, apply, outcome)
 * - Pilot adapters (tic_tac_toe, connect_four, play_2048)
 *
 * @module gamesV4/adapters
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeStateForFirestore = serializeStateForFirestore;
exports.deserializeStateFromFirestore = deserializeStateFromFirestore;
exports.registerAdapter = registerAdapter;
exports.getAdapter = getAdapter;
exports.requireAdapter = requireAdapter;
exports.hasAdapter = hasAdapter;
exports.createInitialState = createInitialState;
exports.runMove = runMove;
exports.computeOutcome = computeOutcome;
exports.extractPerformanceMetrics = extractPerformanceMetrics;
// =============================================================================
// Firestore Nested-Array Serialization
// =============================================================================
// Firestore rejects nested arrays (e.g. a 2D board: [[0,1],[2,3]]).
// These helpers convert top-level 2D arrays ↔ Firestore-safe maps so
// game logic can keep using normal 2D arrays while storage works.
//
//   serialize:   board: [[0,1],[2,3]]  →  board: { _nestedArray:true, length:2, "0":[0,1], "1":[2,3] }
//   deserialize: inverse
// Both are idempotent — safe to call on already-(de)serialized data.
function serializeStateForFirestore(state) {
    const result = {};
    for (const [key, value] of Object.entries(state)) {
        if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
            // Nested array → Firestore-safe map
            const map = {
                _nestedArray: true,
                length: value.length,
            };
            for (let i = 0; i < value.length; i++) {
                map[String(i)] = value[i];
            }
            result[key] = map;
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
function deserializeStateFromFirestore(state) {
    const result = {};
    for (const [key, value] of Object.entries(state)) {
        if (value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            value._nestedArray === true) {
            const map = value;
            const length = map.length;
            const arr = [];
            for (let i = 0; i < length; i++) {
                arr.push(map[String(i)]);
            }
            result[key] = arr;
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
// =============================================================================
// Registry
// =============================================================================
const adapters = new Map();
function registerAdapter(adapter) {
    if (adapters.has(adapter.gameId)) {
        throw new Error(`[gamesV4] Adapter already registered for "${adapter.gameId}".`);
    }
    adapters.set(adapter.gameId, adapter);
}
function getAdapter(gameId) {
    return adapters.get(gameId) ?? null;
}
function requireAdapter(gameId) {
    const adapter = adapters.get(gameId);
    if (!adapter) {
        throw new Error(`[gamesV4] No adapter registered for "${gameId}".`);
    }
    return adapter;
}
function hasAdapter(gameId) {
    return adapters.has(gameId);
}
function createInitialState(gameId, players, settings) {
    const adapter = requireAdapter(gameId);
    const rawPublicState = adapter.createInitialPublicState(players, settings);
    const publicState = serializeStateForFirestore(rawPublicState);
    const privateStateByPlayer = adapter.createInitialPrivateState
        ? adapter.createInitialPrivateState(players, settings)
        : {};
    return { publicState, privateStateByPlayer };
}
function runMove(input) {
    const adapter = requireAdapter(input.gameId);
    // Deserialize Firestore-safe maps back to 2D arrays for adapter logic
    const deserialized = deserializeStateFromFirestore(input.publicState);
    if (!adapter.validateMove) {
        return {
            valid: true,
            nextPublicState: input.publicState,
            nextPrivateState: input.privateStateByPlayer,
            scoreDelta: [],
            turnAdvance: true,
            terminal: undefined,
        };
    }
    const result = adapter.validateMove(deserialized, input.privateStateByPlayer, input.movePayload, {
        uid: input.uid,
        turnOrder: input.turnOrder,
        currentTurnIndex: input.currentTurnIndex,
        settings: input.settings,
    });
    // Serialize adapter output back to Firestore-safe format
    const nextPublicState = result.nextPublicState
        ? serializeStateForFirestore(result.nextPublicState)
        : input.publicState;
    return {
        valid: result.ok,
        error: result.error,
        nextPublicState,
        nextPrivateState: result.nextPrivateState ?? input.privateStateByPlayer,
        scoreDelta: result.scoreDelta ?? [],
        turnAdvance: result.turnAdvance ?? true,
        nextTurnPlayerId: result.nextTurnPlayerId,
        terminal: result.terminal,
    };
}
function computeOutcome(gameId, publicState, players, fallbackWinnerIds = []) {
    const adapter = requireAdapter(gameId);
    // Deserialize in case publicState was read from Firestore
    const deserialized = deserializeStateFromFirestore(publicState);
    if (adapter.computeOutcome) {
        return adapter.computeOutcome(deserialized, players);
    }
    return {
        winnerIds: fallbackWinnerIds,
        finalScoreboard: players.map((p, i) => ({
            uid: p.uid,
            score: fallbackWinnerIds.includes(p.uid) ? 1 : 0,
            placement: fallbackWinnerIds.includes(p.uid) ? 1 : i + 1,
            stats: {},
        })),
    };
}
function extractPerformanceMetrics(gameId, publicState, players) {
    const adapter = requireAdapter(gameId);
    // Deserialize in case publicState was read from Firestore
    const deserialized = deserializeStateFromFirestore(publicState);
    if (adapter.extractPerformanceMetrics) {
        return adapter.extractPerformanceMetrics(deserialized, players);
    }
    return {};
}
const TTT_SIZE = 3;
const TTT_LINES = [
    [
        [0, 0],
        [0, 1],
        [0, 2],
    ],
    [
        [1, 0],
        [1, 1],
        [1, 2],
    ],
    [
        [2, 0],
        [2, 1],
        [2, 2],
    ],
    [
        [0, 0],
        [1, 0],
        [2, 0],
    ],
    [
        [0, 1],
        [1, 1],
        [2, 1],
    ],
    [
        [0, 2],
        [1, 2],
        [2, 2],
    ],
    [
        [0, 0],
        [1, 1],
        [2, 2],
    ],
    [
        [0, 2],
        [1, 1],
        [2, 0],
    ],
];
function tttCheckWinner(board) {
    for (const line of TTT_LINES) {
        const [a, b, c] = line;
        const v = board[a[0]][a[1]];
        if (v && v === board[b[0]][b[1]] && v === board[c[0]][c[1]])
            return v;
    }
    return null;
}
function tttIsFull(board) {
    return board.every((r) => r.every((c) => c !== null));
}
registerAdapter({
    gameId: "tic_tac_toe",
    runtimeType: "turnBased",
    maxPlayers: 2,
    minPlayers: 2,
    defaultSettings: {},
    createInitialPublicState() {
        return {
            board: Array.from({ length: TTT_SIZE }, () => Array(TTT_SIZE).fill(null)),
            scores: { X: 0, O: 0, draws: 0 },
            moveCount: 0,
        };
    },
    validateMove(publicState, _priv, movePayload, ctx) {
        const state = publicState;
        const { row, col } = movePayload;
        if (typeof row !== "number" ||
            typeof col !== "number" ||
            row < 0 ||
            row >= TTT_SIZE ||
            col < 0 ||
            col >= TTT_SIZE) {
            return { ok: false, error: "Invalid cell." };
        }
        if (state.board[row][col] !== null) {
            return { ok: false, error: "Cell occupied." };
        }
        const newBoard = state.board.map((r) => [...r]);
        const symbol = ctx.currentTurnIndex === 0 ? "X" : "O";
        newBoard[row][col] = symbol;
        const newState = {
            board: newBoard,
            scores: { ...state.scores },
            moveCount: state.moveCount + 1,
        };
        const winner = tttCheckWinner(newBoard);
        if (winner) {
            if (winner === "X")
                newState.scores.X += 1;
            else
                newState.scores.O += 1;
            return {
                ok: true,
                nextPublicState: newState,
                turnAdvance: false,
                terminal: { type: "win", winnerIds: [ctx.uid] },
            };
        }
        if (tttIsFull(newBoard)) {
            newState.scores.draws += 1;
            return {
                ok: true,
                nextPublicState: newState,
                turnAdvance: false,
                terminal: { type: "draw" },
            };
        }
        return {
            ok: true,
            nextPublicState: newState,
            turnAdvance: true,
        };
    },
    computeOutcome(publicState, players) {
        const state = publicState;
        const winner = tttCheckWinner(state.board);
        if (winner) {
            const winSlot = winner === "X" ? 0 : 1;
            const wId = players.find((p) => p.slotIndex === winSlot)?.uid ?? "";
            const lId = players.find((p) => p.slotIndex !== winSlot)?.uid ?? "";
            return {
                winnerIds: [wId],
                finalScoreboard: [
                    { uid: wId, score: 1, placement: 1, stats: { symbol: winner } },
                    { uid: lId, score: 0, placement: 2, stats: {} },
                ],
            };
        }
        return {
            winnerIds: [],
            finalScoreboard: players.map((p) => ({
                uid: p.uid,
                score: 0,
                placement: 1,
                stats: {},
            })),
        };
    },
    extractPerformanceMetrics(publicState) {
        return { totalMoves: publicState.moveCount };
    },
});
const C4_ROWS = 6;
const C4_COLS = 7;
function c4CheckWin(board, player) {
    for (let r = 0; r < C4_ROWS; r++)
        for (let c = 0; c <= C4_COLS - 4; c++)
            if (board[r][c] === player &&
                board[r][c + 1] === player &&
                board[r][c + 2] === player &&
                board[r][c + 3] === player)
                return true;
    for (let r = 0; r <= C4_ROWS - 4; r++)
        for (let c = 0; c < C4_COLS; c++)
            if (board[r][c] === player &&
                board[r + 1][c] === player &&
                board[r + 2][c] === player &&
                board[r + 3][c] === player)
                return true;
    for (let r = 0; r <= C4_ROWS - 4; r++)
        for (let c = 0; c <= C4_COLS - 4; c++)
            if (board[r][c] === player &&
                board[r + 1][c + 1] === player &&
                board[r + 2][c + 2] === player &&
                board[r + 3][c + 3] === player)
                return true;
    for (let r = 3; r < C4_ROWS; r++)
        for (let c = 0; c <= C4_COLS - 4; c++)
            if (board[r][c] === player &&
                board[r - 1][c + 1] === player &&
                board[r - 2][c + 2] === player &&
                board[r - 3][c + 3] === player)
                return true;
    return false;
}
function c4FindDropRow(board, col) {
    for (let r = C4_ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0)
            return r;
    }
    return -1;
}
registerAdapter({
    gameId: "connect_four",
    runtimeType: "turnBased",
    maxPlayers: 2,
    minPlayers: 2,
    defaultSettings: {},
    createInitialPublicState() {
        return {
            board: Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(0)),
            moveCount: 0,
            lastMove: null,
        };
    },
    validateMove(publicState, _priv, movePayload, ctx) {
        const state = publicState;
        const { col } = movePayload;
        if (typeof col !== "number" || col < 0 || col >= C4_COLS) {
            return { ok: false, error: "Invalid column." };
        }
        const row = c4FindDropRow(state.board, col);
        if (row === -1)
            return { ok: false, error: "Column full." };
        const newBoard = state.board.map((r) => [...r]);
        const piece = (ctx.currentTurnIndex + 1);
        newBoard[row][col] = piece;
        const ns = {
            board: newBoard,
            moveCount: state.moveCount + 1,
            lastMove: { row, col },
        };
        if (c4CheckWin(newBoard, piece)) {
            return {
                ok: true,
                nextPublicState: ns,
                turnAdvance: false,
                terminal: { type: "win", winnerIds: [ctx.uid] },
            };
        }
        if (newBoard[0].every((c) => c !== 0)) {
            return {
                ok: true,
                nextPublicState: ns,
                turnAdvance: false,
                terminal: { type: "draw" },
            };
        }
        return {
            ok: true,
            nextPublicState: ns,
            turnAdvance: true,
        };
    },
    computeOutcome(publicState, players) {
        const state = publicState;
        for (const p of players) {
            const piece = (p.slotIndex + 1);
            if (c4CheckWin(state.board, piece)) {
                const lId = players.find((op) => op.uid !== p.uid)?.uid ?? "";
                return {
                    winnerIds: [p.uid],
                    finalScoreboard: [
                        { uid: p.uid, score: 1, placement: 1, stats: { piece } },
                        { uid: lId, score: 0, placement: 2, stats: {} },
                    ],
                };
            }
        }
        return {
            winnerIds: [],
            finalScoreboard: players.map((p) => ({
                uid: p.uid,
                score: 0,
                placement: 1,
                stats: {},
            })),
        };
    },
    extractPerformanceMetrics(publicState) {
        return {
            totalMoves: publicState.moveCount,
        };
    },
});
const G2048 = 4;
const WIN_TILE = 2048;
function s2048SlideLeft(row) {
    const comp = row.filter((v) => v !== 0);
    const res = [];
    let sc = 0, mg = 0, i = 0;
    while (i < comp.length) {
        if (i + 1 < comp.length && comp[i] === comp[i + 1]) {
            const m = comp[i] * 2;
            res.push(m);
            sc += m;
            mg++;
            i += 2;
        }
        else {
            res.push(comp[i]);
            i++;
        }
    }
    while (res.length < G2048)
        res.push(0);
    return { row: res, score: sc, merges: mg };
}
function s2048Exec(board, dir) {
    const nb = board.map((r) => [...r]);
    let sc = 0, mg = 0;
    if (dir === "left") {
        for (let r = 0; r < G2048; r++) {
            const x = s2048SlideLeft(nb[r]);
            nb[r] = x.row;
            sc += x.score;
            mg += x.merges;
        }
    }
    else if (dir === "right") {
        for (let r = 0; r < G2048; r++) {
            const x = s2048SlideLeft([...nb[r]].reverse());
            nb[r] = x.row.reverse();
            sc += x.score;
            mg += x.merges;
        }
    }
    else if (dir === "up") {
        for (let c = 0; c < G2048; c++) {
            const col = nb.map((r) => r[c]);
            const x = s2048SlideLeft(col);
            for (let r = 0; r < G2048; r++)
                nb[r][c] = x.row[r];
            sc += x.score;
            mg += x.merges;
        }
    }
    else {
        for (let c = 0; c < G2048; c++) {
            const col = nb.map((r) => r[c]).reverse();
            const x = s2048SlideLeft(col);
            const rev = x.row.reverse();
            for (let r = 0; r < G2048; r++)
                nb[r][c] = rev[r];
            sc += x.score;
            mg += x.merges;
        }
    }
    let moved = false;
    outer: for (let r = 0; r < G2048; r++)
        for (let c = 0; c < G2048; c++)
            if (board[r][c] !== nb[r][c]) {
                moved = true;
                break outer;
            }
    return { nb, sc, mg, moved };
}
function s2048CanMove(b) {
    for (let r = 0; r < G2048; r++)
        for (let c = 0; c < G2048; c++) {
            if (b[r][c] === 0)
                return true;
            if (c + 1 < G2048 && b[r][c] === b[r][c + 1])
                return true;
            if (r + 1 < G2048 && b[r][c] === b[r + 1][c])
                return true;
        }
    return false;
}
function s2048Best(b) {
    let best = 0;
    for (const row of b)
        for (const v of row)
            if (v > best)
                best = v;
    return best;
}
function s2048PlaceTile(b, mc) {
    const nb = b.map((r) => [...r]);
    const empty = [];
    for (let r = 0; r < G2048; r++)
        for (let c = 0; c < G2048; c++)
            if (nb[r][c] === 0)
                empty.push([r, c]);
    if (empty.length === 0)
        return nb;
    const [er, ec] = empty[mc % empty.length];
    nb[er][ec] = mc % 10 === 7 ? 4 : 2;
    return nb;
}
registerAdapter({
    gameId: "play_2048",
    runtimeType: "solo",
    maxPlayers: 1,
    minPlayers: 1,
    defaultSettings: {},
    createInitialPublicState() {
        let b = Array.from({ length: G2048 }, () => Array(G2048).fill(0));
        b = s2048PlaceTile(b, 0);
        b = s2048PlaceTile(b, 1);
        return {
            board: b,
            score: 0,
            bestTile: s2048Best(b),
            moveCount: 0,
            mergeCount: 0,
            hasWon: false,
            gameOver: false,
        };
    },
    validateMove(publicState, _priv, movePayload, ctx) {
        const st = publicState;
        const { direction } = movePayload;
        if (!["up", "down", "left", "right"].includes(direction))
            return { ok: false, error: "Invalid direction." };
        if (st.gameOver)
            return { ok: false, error: "Game over." };
        const { nb, sc, mg, moved } = s2048Exec(st.board, direction);
        if (!moved)
            return { ok: false, error: "No effect." };
        const nb2 = s2048PlaceTile(nb, st.moveCount + 1);
        const best = s2048Best(nb2);
        const won = st.hasWon || best >= WIN_TILE;
        const over = !s2048CanMove(nb2);
        const ns = {
            board: nb2,
            score: st.score + sc,
            bestTile: best,
            moveCount: st.moveCount + 1,
            mergeCount: st.mergeCount + mg,
            hasWon: won,
            gameOver: over,
        };
        if (over) {
            return {
                ok: true,
                nextPublicState: ns,
                scoreDelta: [{ uid: ctx.uid, delta: sc }],
                turnAdvance: false,
                terminal: {
                    type: won ? "win" : "timeout",
                    winnerIds: won ? [ctx.uid] : [],
                },
            };
        }
        return {
            ok: true,
            nextPublicState: ns,
            scoreDelta: [{ uid: ctx.uid, delta: sc }],
            turnAdvance: false,
        };
    },
    computeOutcome(publicState, players) {
        const st = publicState;
        const uid = players[0]?.uid ?? "";
        return {
            winnerIds: st.hasWon ? [uid] : [],
            finalScoreboard: [
                {
                    uid,
                    score: st.score,
                    placement: 1,
                    stats: { bestTile: st.bestTile },
                },
            ],
        };
    },
    extractPerformanceMetrics(publicState) {
        const st = publicState;
        return { score: st.score, bestTile: st.bestTile, moveCount: st.moveCount };
    },
});
// ── Chess Helpers ────────────────────────────────────────────────────
function chPieceColor(p) {
    return p[0];
}
function chPieceType(p) {
    return p[1];
}
function chMakePiece(c, t) {
    return `${c}${t}`;
}
function chSqToIdx(sq) {
    const file = sq.charCodeAt(0) - 97;
    const rank = parseInt(sq[1], 10);
    return [8 - rank, file];
}
function chIdxToSq(r, c) {
    return String.fromCharCode(97 + c) + (8 - r);
}
function chInBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}
function chCloneBoard(b) {
    return b.map((r) => [...r]);
}
function chFindKing(b, side) {
    const k = chMakePiece(side, "K");
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (b[r][c] === k)
                return [r, c];
    return null;
}
function chIsValidSquare(s) {
    if (typeof s !== "string" || s.length !== 2)
        return false;
    const f = s.charCodeAt(0), rk = s.charCodeAt(1);
    return f >= 97 && f <= 104 && rk >= 49 && rk <= 56;
}
function chIsValidPromotion(p) {
    return p === undefined || p === "q" || p === "r" || p === "b" || p === "n";
}
// ── Attack Detection ─────────────────────────────────────────────────
const CH_KNIGHT_OFS = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
];
const CH_DIAGS = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
];
const CH_STRAIGHTS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
];
function chIsAttackedBy(b, row, col, attacker) {
    // Pawn
    const pawnDir = attacker === "w" ? 1 : -1;
    const pawn = chMakePiece(attacker, "P");
    for (const dc of [-1, 1]) {
        const pr = row + pawnDir, pc = col + dc;
        if (chInBounds(pr, pc) && b[pr][pc] === pawn)
            return true;
    }
    // Knight
    const knight = chMakePiece(attacker, "N");
    for (const [dr, dc] of CH_KNIGHT_OFS) {
        const nr = row + dr, nc = col + dc;
        if (chInBounds(nr, nc) && b[nr][nc] === knight)
            return true;
    }
    // King
    const king = chMakePiece(attacker, "K");
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0)
                continue;
            const kr = row + dr, kc = col + dc;
            if (chInBounds(kr, kc) && b[kr][kc] === king)
                return true;
        }
    // Sliding
    const bishop = chMakePiece(attacker, "B");
    const rook = chMakePiece(attacker, "R");
    const queen = chMakePiece(attacker, "Q");
    for (const [dr, dc] of CH_DIAGS) {
        let r = row + dr, c = col + dc;
        while (chInBounds(r, c)) {
            const p = b[r][c];
            if (p !== null) {
                if (p === bishop || p === queen)
                    return true;
                break;
            }
            r += dr;
            c += dc;
        }
    }
    for (const [dr, dc] of CH_STRAIGHTS) {
        let r = row + dr, c = col + dc;
        while (chInBounds(r, c)) {
            const p = b[r][c];
            if (p !== null) {
                if (p === rook || p === queen)
                    return true;
                break;
            }
            r += dr;
            c += dc;
        }
    }
    return false;
}
function chIsInCheck(b, side) {
    const kp = chFindKing(b, side);
    if (!kp)
        return false;
    return chIsAttackedBy(b, kp[0], kp[1], side === "w" ? "b" : "w");
}
// ── Move Generation ──────────────────────────────────────────────────
function chApplyMoveToBoard(b, m) {
    const nb = chCloneBoard(b);
    nb[m.fromRow][m.fromCol] = null;
    if (m.isEnPassant)
        nb[m.fromRow][m.toCol] = null;
    if (m.promotion) {
        nb[m.toRow][m.toCol] = chMakePiece(chPieceColor(m.piece), m.promotion.toUpperCase());
    }
    else {
        nb[m.toRow][m.toCol] = m.piece;
    }
    if (m.isCastle) {
        const row = m.fromRow;
        if (m.toCol === 6) {
            nb[row][5] = nb[row][7];
            nb[row][7] = null;
        }
        else if (m.toCol === 2) {
            nb[row][3] = nb[row][0];
            nb[row][0] = null;
        }
    }
    return nb;
}
function chGenPseudoLegalMoves(b, side, castling, ep) {
    const moves = [];
    const opp = side === "w" ? "b" : "w";
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const piece = b[r][c];
            if (piece === null || chPieceColor(piece) !== side)
                continue;
            const type = chPieceType(piece);
            const from = chIdxToSq(r, c);
            if (type === "P") {
                const dir = side === "w" ? -1 : 1;
                const startRow = side === "w" ? 6 : 1;
                const promoRow = side === "w" ? 0 : 7;
                const r1 = r + dir;
                if (chInBounds(r1, c) && b[r1][c] === null) {
                    if (r1 === promoRow) {
                        for (const pr of ["q", "r", "b", "n"])
                            moves.push({
                                from,
                                to: chIdxToSq(r1, c),
                                fromRow: r,
                                fromCol: c,
                                toRow: r1,
                                toCol: c,
                                piece,
                                captured: null,
                                promotion: pr,
                            });
                    }
                    else {
                        moves.push({
                            from,
                            to: chIdxToSq(r1, c),
                            fromRow: r,
                            fromCol: c,
                            toRow: r1,
                            toCol: c,
                            piece,
                            captured: null,
                        });
                        const r2 = r + 2 * dir;
                        if (r === startRow && chInBounds(r2, c) && b[r2][c] === null)
                            moves.push({
                                from,
                                to: chIdxToSq(r2, c),
                                fromRow: r,
                                fromCol: c,
                                toRow: r2,
                                toCol: c,
                                piece,
                                captured: null,
                            });
                    }
                }
                for (const dc of [-1, 1]) {
                    const nc = c + dc;
                    if (!chInBounds(r1, nc))
                        continue;
                    const tgt = b[r1][nc];
                    if (tgt !== null && chPieceColor(tgt) === opp) {
                        if (r1 === promoRow) {
                            for (const pr of ["q", "r", "b", "n"])
                                moves.push({
                                    from,
                                    to: chIdxToSq(r1, nc),
                                    fromRow: r,
                                    fromCol: c,
                                    toRow: r1,
                                    toCol: nc,
                                    piece,
                                    captured: tgt,
                                    promotion: pr,
                                });
                        }
                        else {
                            moves.push({
                                from,
                                to: chIdxToSq(r1, nc),
                                fromRow: r,
                                fromCol: c,
                                toRow: r1,
                                toCol: nc,
                                piece,
                                captured: tgt,
                            });
                        }
                    }
                    if (ep !== null) {
                        const [epR, epC] = chSqToIdx(ep);
                        if (r1 === epR && nc === epC)
                            moves.push({
                                from,
                                to: ep,
                                fromRow: r,
                                fromCol: c,
                                toRow: epR,
                                toCol: epC,
                                piece,
                                captured: chMakePiece(opp, "P"),
                                isEnPassant: true,
                            });
                    }
                }
            }
            else if (type === "N") {
                for (const [dr, dc] of CH_KNIGHT_OFS) {
                    const nr = r + dr, nc = c + dc;
                    if (!chInBounds(nr, nc))
                        continue;
                    const tgt = b[nr][nc];
                    if (tgt !== null && chPieceColor(tgt) === side)
                        continue;
                    moves.push({
                        from,
                        to: chIdxToSq(nr, nc),
                        fromRow: r,
                        fromCol: c,
                        toRow: nr,
                        toCol: nc,
                        piece,
                        captured: tgt,
                    });
                }
            }
            else if (type === "B" || type === "R" || type === "Q") {
                const dirs = type === "B"
                    ? CH_DIAGS
                    : type === "R"
                        ? CH_STRAIGHTS
                        : [...CH_DIAGS, ...CH_STRAIGHTS];
                for (const [dr, dc] of dirs) {
                    let nr = r + dr, nc = c + dc;
                    while (chInBounds(nr, nc)) {
                        const tgt = b[nr][nc];
                        if (tgt !== null) {
                            if (chPieceColor(tgt) === opp)
                                moves.push({
                                    from,
                                    to: chIdxToSq(nr, nc),
                                    fromRow: r,
                                    fromCol: c,
                                    toRow: nr,
                                    toCol: nc,
                                    piece,
                                    captured: tgt,
                                });
                            break;
                        }
                        moves.push({
                            from,
                            to: chIdxToSq(nr, nc),
                            fromRow: r,
                            fromCol: c,
                            toRow: nr,
                            toCol: nc,
                            piece,
                            captured: null,
                        });
                        nr += dr;
                        nc += dc;
                    }
                }
            }
            else if (type === "K") {
                for (let dr = -1; dr <= 1; dr++)
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0)
                            continue;
                        const nr = r + dr, nc = c + dc;
                        if (!chInBounds(nr, nc))
                            continue;
                        const tgt = b[nr][nc];
                        if (tgt !== null && chPieceColor(tgt) === side)
                            continue;
                        moves.push({
                            from,
                            to: chIdxToSq(nr, nc),
                            fromRow: r,
                            fromCol: c,
                            toRow: nr,
                            toCol: nc,
                            piece,
                            captured: tgt,
                        });
                    }
                // Castling
                if (side === "w" && c === 4 && r === 7) {
                    if (castling.wK &&
                        b[7][5] === null &&
                        b[7][6] === null &&
                        b[7][7] === "wR")
                        moves.push({
                            from,
                            to: "g1",
                            fromRow: 7,
                            fromCol: 4,
                            toRow: 7,
                            toCol: 6,
                            piece,
                            captured: null,
                            isCastle: true,
                        });
                    if (castling.wQ &&
                        b[7][1] === null &&
                        b[7][2] === null &&
                        b[7][3] === null &&
                        b[7][0] === "wR")
                        moves.push({
                            from,
                            to: "c1",
                            fromRow: 7,
                            fromCol: 4,
                            toRow: 7,
                            toCol: 2,
                            piece,
                            captured: null,
                            isCastle: true,
                        });
                }
                else if (side === "b" && c === 4 && r === 0) {
                    if (castling.bK &&
                        b[0][5] === null &&
                        b[0][6] === null &&
                        b[0][7] === "bR")
                        moves.push({
                            from,
                            to: "g8",
                            fromRow: 0,
                            fromCol: 4,
                            toRow: 0,
                            toCol: 6,
                            piece,
                            captured: null,
                            isCastle: true,
                        });
                    if (castling.bQ &&
                        b[0][1] === null &&
                        b[0][2] === null &&
                        b[0][3] === null &&
                        b[0][0] === "bR")
                        moves.push({
                            from,
                            to: "c8",
                            fromRow: 0,
                            fromCol: 4,
                            toRow: 0,
                            toCol: 2,
                            piece,
                            captured: null,
                            isCastle: true,
                        });
                }
            }
        }
    return moves;
}
function chFilterLegal(b, moves, side) {
    const opp = side === "w" ? "b" : "w";
    return moves.filter((m) => {
        if (m.isCastle) {
            if (chIsAttackedBy(b, m.fromRow, m.fromCol, opp))
                return false;
            const throughCol = m.toCol === 6 ? 5 : 3;
            if (chIsAttackedBy(b, m.fromRow, throughCol, opp))
                return false;
        }
        return !chIsInCheck(chApplyMoveToBoard(b, m), side);
    });
}
function chGenLegalMoves(b, side, castling, ep) {
    return chFilterLegal(b, chGenPseudoLegalMoves(b, side, castling, ep), side);
}
function chFindLegalMove(b, side, castling, ep, from, to, promo) {
    return (chGenLegalMoves(b, side, castling, ep).find((m) => m.from === from &&
        m.to === to &&
        (promo ? m.promotion === promo : !m.promotion)) ?? null);
}
// ── Position Hash ────────────────────────────────────────────────────
function chPositionHash(b, side, castling, ep) {
    const parts = [];
    for (let r = 0; r < 8; r++) {
        let s = "", empty = 0;
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p === null) {
                empty++;
            }
            else {
                if (empty > 0) {
                    s += empty;
                    empty = 0;
                }
                s += p;
            }
        }
        if (empty > 0)
            s += empty;
        parts.push(s);
    }
    parts.push(side);
    let cs = "";
    if (castling.wK)
        cs += "K";
    if (castling.wQ)
        cs += "Q";
    if (castling.bK)
        cs += "k";
    if (castling.bQ)
        cs += "q";
    parts.push(cs || "-");
    if (ep) {
        const [epR, epC] = chSqToIdx(ep);
        const pawnDir = side === "w" ? 1 : -1;
        const pawn = chMakePiece(side, "P");
        let relevant = false;
        for (const dc of [-1, 1]) {
            const pr = epR + pawnDir, pc = epC + dc;
            if (chInBounds(pr, pc) && b[pr][pc] === pawn) {
                relevant = true;
                break;
            }
        }
        parts.push(relevant ? ep : "-");
    }
    else {
        parts.push("-");
    }
    return parts.join("/");
}
// ── Terminal Detection ───────────────────────────────────────────────
function chIsInsufficient(b) {
    const nonKings = [];
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p && chPieceType(p) !== "K")
                nonKings.push({ piece: p, row: r, col: c });
        }
    if (nonKings.length === 0)
        return true;
    if (nonKings.length === 1) {
        const t = chPieceType(nonKings[0].piece);
        if (t === "N" || t === "B")
            return true;
    }
    if (nonKings.length === 2) {
        const [a, b2] = nonKings;
        if (chPieceType(a.piece) === "B" &&
            chPieceType(b2.piece) === "B" &&
            chPieceColor(a.piece) !== chPieceColor(b2.piece)) {
            if ((a.row + a.col) % 2 === (b2.row + b2.col) % 2)
                return true;
        }
    }
    return false;
}
// ── SAN Generation ───────────────────────────────────────────────────
function chUpdateCastling(castling, m) {
    const nc = { ...castling };
    const t = chPieceType(m.piece), clr = chPieceColor(m.piece);
    if (t === "K") {
        if (clr === "w") {
            nc.wK = false;
            nc.wQ = false;
        }
        else {
            nc.bK = false;
            nc.bQ = false;
        }
    }
    if (t === "R") {
        if (clr === "w") {
            if (m.fromRow === 7 && m.fromCol === 7)
                nc.wK = false;
            if (m.fromRow === 7 && m.fromCol === 0)
                nc.wQ = false;
        }
        else {
            if (m.fromRow === 0 && m.fromCol === 7)
                nc.bK = false;
            if (m.fromRow === 0 && m.fromCol === 0)
                nc.bQ = false;
        }
    }
    if (m.captured) {
        if (m.toRow === 7 && m.toCol === 7)
            nc.wK = false;
        if (m.toRow === 7 && m.toCol === 0)
            nc.wQ = false;
        if (m.toRow === 0 && m.toCol === 7)
            nc.bK = false;
        if (m.toRow === 0 && m.toCol === 0)
            nc.bQ = false;
    }
    return nc;
}
function chComputeEP(m) {
    if (chPieceType(m.piece) === "P" && Math.abs(m.toRow - m.fromRow) === 2) {
        return chIdxToSq((m.fromRow + m.toRow) / 2, m.fromCol);
    }
    return null;
}
function chGenSAN(b, m, side, castling, ep) {
    if (m.isCastle) {
        const nb = chApplyMoveToBoard(b, m);
        const opp = side === "w" ? "b" : "w";
        const inChk = chIsInCheck(nb, opp);
        const nc = chUpdateCastling(castling, m);
        const nep = chComputeEP(m);
        const isMate = inChk && chGenLegalMoves(nb, opp, nc, nep).length === 0;
        return ((m.toCol === 6 ? "O-O" : "O-O-O") + (isMate ? "#" : inChk ? "+" : ""));
    }
    const type = chPieceType(m.piece);
    let san = "";
    if (type === "P") {
        if (m.captured)
            san += m.from[0] + "x";
        san += m.to;
        if (m.promotion)
            san += "=" + m.promotion.toUpperCase();
    }
    else {
        san += type;
        const legal = chGenLegalMoves(b, side, castling, ep);
        const amb = legal.filter((mv) => chPieceType(mv.piece) === type && mv.to === m.to && mv.from !== m.from);
        if (amb.length > 0) {
            if (!amb.some((a) => a.fromCol === m.fromCol))
                san += m.from[0];
            else if (!amb.some((a) => a.fromRow === m.fromRow))
                san += m.from[1];
            else
                san += m.from;
        }
        if (m.captured)
            san += "x";
        san += m.to;
    }
    const nb = chApplyMoveToBoard(b, m);
    const opp = side === "w" ? "b" : "w";
    const nc = chUpdateCastling(castling, m);
    const nep = chComputeEP(m);
    const oppChk = chIsInCheck(nb, opp);
    if (oppChk) {
        san += chGenLegalMoves(nb, opp, nc, nep).length === 0 ? "#" : "+";
    }
    return san;
}
// ── State Application ────────────────────────────────────────────────
function chCreateInitialBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    b[0] = ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"];
    b[1] = Array(8).fill("bP");
    b[6] = Array(8).fill("wP");
    b[7] = ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"];
    return b;
}
function chCreateInitialState() {
    const board = chCreateInitialBoard();
    const castling = {
        wK: true,
        wQ: true,
        bK: true,
        bQ: true,
    };
    const positionHash = chPositionHash(board, "w", castling, null);
    return {
        schemaVersion: 1,
        board,
        sideToMove: "w",
        castling,
        enPassant: null,
        halfmoveClock: 0,
        fullmoveNumber: 1,
        lastMove: null,
        pendingDrawOfferByUid: null,
        positionHash,
        repetitionCounts: { [positionHash]: 1 },
        plyCount: 0,
        capturesByUid: {},
        checksByUid: {},
        castlesByUid: {},
        promotionsByUid: {},
        underPromotionsByUid: {},
        enPassantByUid: {},
        terminal: null,
    };
}
function chApplyMoveToState(state, move, moverUid) {
    const newBoard = chApplyMoveToBoard(state.board, move);
    const opp = state.sideToMove === "w" ? "b" : "w";
    const san = chGenSAN(state.board, move, state.sideToMove, state.castling, state.enPassant);
    const newCastling = chUpdateCastling(state.castling, move);
    const newEP = chComputeEP(move);
    const isPawn = chPieceType(move.piece) === "P";
    const isCapture = move.captured !== null;
    const newHalfmove = isPawn || isCapture ? 0 : state.halfmoveClock + 1;
    const newFullmove = state.sideToMove === "b" ? state.fullmoveNumber + 1 : state.fullmoveNumber;
    const lastMove = {
        from: move.from,
        to: move.to,
        piece: move.piece,
        captured: move.captured,
        promotion: move.promotion,
        san,
    };
    const capturesByUid = { ...state.capturesByUid };
    const checksByUid = { ...state.checksByUid };
    const castlesByUid = { ...state.castlesByUid };
    const promotionsByUid = { ...state.promotionsByUid };
    const underPromotionsByUid = { ...state.underPromotionsByUid };
    const enPassantByUid = { ...state.enPassantByUid };
    if (isCapture)
        capturesByUid[moverUid] = (capturesByUid[moverUid] ?? 0) + 1;
    if (move.isCastle)
        castlesByUid[moverUid] = (castlesByUid[moverUid] ?? 0) + 1;
    if (move.promotion) {
        promotionsByUid[moverUid] = (promotionsByUid[moverUid] ?? 0) + 1;
        if (move.promotion !== "q")
            underPromotionsByUid[moverUid] =
                (underPromotionsByUid[moverUid] ?? 0) + 1;
    }
    if (move.isEnPassant)
        enPassantByUid[moverUid] = (enPassantByUid[moverUid] ?? 0) + 1;
    const oppInCheck = chIsInCheck(newBoard, opp);
    if (oppInCheck)
        checksByUid[moverUid] = (checksByUid[moverUid] ?? 0) + 1;
    const positionHash = chPositionHash(newBoard, opp, newCastling, newEP);
    const repetitionCounts = { ...state.repetitionCounts };
    repetitionCounts[positionHash] = (repetitionCounts[positionHash] ?? 0) + 1;
    let terminal = state.terminal;
    const oppLegal = chGenLegalMoves(newBoard, opp, newCastling, newEP);
    if (oppLegal.length === 0) {
        terminal = oppInCheck
            ? { type: "win", winnerUids: [moverUid], reason: "checkmate" }
            : { type: "draw", reason: "stalemate" };
    }
    if (!terminal && chIsInsufficient(newBoard)) {
        terminal = { type: "draw", reason: "insufficient_material" };
    }
    return {
        schemaVersion: 1,
        board: newBoard,
        sideToMove: opp,
        castling: newCastling,
        enPassant: newEP,
        halfmoveClock: newHalfmove,
        fullmoveNumber: newFullmove,
        lastMove,
        pendingDrawOfferByUid: state.pendingDrawOfferByUid,
        positionHash,
        repetitionCounts,
        plyCount: state.plyCount + 1,
        capturesByUid,
        checksByUid,
        castlesByUid,
        promotionsByUid,
        underPromotionsByUid,
        enPassantByUid,
        terminal,
    };
}
function chHasLostPieces(b, side) {
    const init = chCreateInitialBoard();
    const count = (board, s) => {
        let n = 0;
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p && p[0] === s && p[1] !== "K")
                    n++;
            }
        return n;
    };
    return count(b, side) < count(init, side);
}
// ── Chess Adapter Registration ───────────────────────────────────────
registerAdapter({
    gameId: "chess",
    runtimeType: "turnBased",
    maxPlayers: 2,
    minPlayers: 2,
    defaultSettings: {},
    createInitialPublicState() {
        return chCreateInitialState();
    },
    validateMove(publicState, _priv, movePayload, ctx) {
        const state = publicState;
        const payload = movePayload;
        if (state.terminal)
            return { ok: false, error: "Game is already over." };
        const whiteUid = ctx.turnOrder[0];
        const moverUid = ctx.uid;
        const expectedSide = moverUid === whiteUid ? "w" : "b";
        if (state.sideToMove !== expectedSide)
            return { ok: false, error: "Not your turn." };
        // Accept draw
        if (payload.action === "acceptDraw") {
            if (!state.pendingDrawOfferByUid)
                return { ok: false, error: "No draw offer to accept." };
            if (state.pendingDrawOfferByUid === moverUid)
                return { ok: false, error: "Cannot accept your own draw offer." };
            const ns = {
                ...state,
                terminal: { type: "draw", reason: "draw_agreed" },
                pendingDrawOfferByUid: null,
            };
            return {
                ok: true,
                nextPublicState: ns,
                turnAdvance: false,
                terminal: { type: "draw", reason: "draw_agreed" },
            };
        }
        // Claim draw
        if (payload.action === "claimDraw") {
            if (payload.claim === "threefold") {
                const count = state.repetitionCounts[state.positionHash] ?? 0;
                if (count < 3)
                    return {
                        ok: false,
                        error: `Threefold repetition not met: current position seen ${count} time(s).`,
                    };
                const ns = {
                    ...state,
                    terminal: { type: "draw", reason: "threefold_repetition" },
                    pendingDrawOfferByUid: null,
                };
                return {
                    ok: true,
                    nextPublicState: ns,
                    turnAdvance: false,
                    terminal: { type: "draw", reason: "threefold_repetition" },
                };
            }
            if (payload.claim === "fiftyMove") {
                if (state.halfmoveClock < 100)
                    return {
                        ok: false,
                        error: `50-move rule not met: halfmoveClock is ${state.halfmoveClock}.`,
                    };
                const ns = {
                    ...state,
                    terminal: { type: "draw", reason: "fifty_move_rule" },
                    pendingDrawOfferByUid: null,
                };
                return {
                    ok: true,
                    nextPublicState: ns,
                    turnAdvance: false,
                    terminal: { type: "draw", reason: "fifty_move_rule" },
                };
            }
            return { ok: false, error: "Invalid draw claim." };
        }
        // Normal move
        if (payload.action !== "move")
            return { ok: false, error: "Invalid action." };
        if (!chIsValidSquare(payload.from) || !chIsValidSquare(payload.to))
            return { ok: false, error: "Invalid square coordinates." };
        if (!chIsValidPromotion(payload.promotion))
            return { ok: false, error: "Invalid promotion piece." };
        const [fromRow, fromCol] = chSqToIdx(payload.from);
        const [toRow] = chSqToIdx(payload.to);
        const movingPiece = state.board[fromRow][fromCol];
        if (movingPiece && movingPiece[1] === "P") {
            const promoRank = expectedSide === "w" ? 0 : 7;
            if (toRow === promoRank && !payload.promotion)
                return { ok: false, error: "Promotion piece required." };
            if (toRow !== promoRank && payload.promotion)
                return { ok: false, error: "Cannot promote on this rank." };
        }
        const legalMove = chFindLegalMove(state.board, state.sideToMove, state.castling, state.enPassant, payload.from, payload.to, payload.promotion);
        if (!legalMove)
            return { ok: false, error: "Illegal move." };
        let ns = chApplyMoveToState(state, legalMove, moverUid);
        ns =
            payload.offerDraw && !ns.terminal
                ? { ...ns, pendingDrawOfferByUid: moverUid }
                : { ...ns, pendingDrawOfferByUid: null };
        if (ns.terminal) {
            return {
                ok: true,
                nextPublicState: ns,
                turnAdvance: false,
                terminal: {
                    type: ns.terminal.type,
                    winnerIds: ns.terminal.winnerUids,
                    reason: ns.terminal.reason,
                },
            };
        }
        return {
            ok: true,
            nextPublicState: ns,
            turnAdvance: true,
        };
    },
    computeOutcome(publicState, players) {
        const state = publicState;
        if (state.terminal?.type === "win" && state.terminal.winnerUids?.length) {
            const winnerId = state.terminal.winnerUids[0];
            const loserId = players.find((p) => p.uid !== winnerId)?.uid ?? "";
            return {
                winnerIds: [winnerId],
                finalScoreboard: [
                    {
                        uid: winnerId,
                        score: 1,
                        placement: 1,
                        stats: {
                            side: players[0].uid === winnerId ? "white" : "black",
                            reason: state.terminal.reason,
                            captures: state.capturesByUid[winnerId] ?? 0,
                            checks: state.checksByUid[winnerId] ?? 0,
                        },
                    },
                    {
                        uid: loserId,
                        score: 0,
                        placement: 2,
                        stats: {
                            side: players[0].uid === loserId ? "white" : "black",
                            reason: state.terminal.reason,
                            captures: state.capturesByUid[loserId] ?? 0,
                            checks: state.checksByUid[loserId] ?? 0,
                        },
                    },
                ],
            };
        }
        return {
            winnerIds: [],
            finalScoreboard: players.map((p) => ({
                uid: p.uid,
                score: 0,
                placement: 1,
                stats: {
                    side: p.slotIndex === 0 ? "white" : "black",
                    reason: state.terminal?.reason ?? "unknown",
                    captures: state.capturesByUid[p.uid] ?? 0,
                    checks: state.checksByUid[p.uid] ?? 0,
                },
            })),
        };
    },
    extractPerformanceMetrics(publicState, players) {
        const state = publicState;
        const metrics = {
            totalMoves: state.plyCount,
            endedBy: state.terminal?.reason ?? "unknown",
            capturesByUid: state.capturesByUid,
            promotionsByUid: state.promotionsByUid,
            enPassantByUid: state.enPassantByUid,
            castlesByUid: state.castlesByUid,
            checksByUid: state.checksByUid,
        };
        if (state.terminal?.reason === "checkmate")
            metrics.shortMatePly = state.plyCount;
        if (state.terminal?.type === "win" && state.terminal.winnerUids?.length) {
            const winnerId = state.terminal.winnerUids[0];
            const winnerSlot = (players ?? []).findIndex((p) => p.uid === winnerId);
            metrics.wonWithoutLosingPiece = !chHasLostPieces(state.board, winnerSlot === 0 ? "w" : "b");
        }
        const hasUnderpromotion = {};
        for (const p of players ?? []) {
            hasUnderpromotion[p.uid] = (state.underPromotionsByUid[p.uid] ?? 0) > 0;
        }
        metrics.hasUnderpromotion = hasUnderpromotion;
        return metrics;
    },
});
// ═══════════════════════════════════════════════════════════════════════════════
// Sketch Party (realtime drawing + guessing game)
// ═══════════════════════════════════════════════════════════════════════════════
registerAdapter({
    gameId: "sketch_party_game",
    runtimeType: "realtime",
    maxPlayers: 8,
    minPlayers: 2,
    defaultSettings: {
        maxPlayers: 8,
        rounds: 3,
        drawTimeSec: 80,
        turnChooseTimeSec: 10,
        wordChoices: 3,
        hints: 2,
        customWordsEnabled: false,
    },
    createInitialPublicState(players) {
        const turnOrder = players.map((p) => p.uid).sort(() => Math.random() - 0.5);
        const scores = {};
        for (const p of players)
            scores[p.uid] = 0;
        return {
            currentRound: 1,
            totalRounds: 3,
            currentTurnIndex: 0,
            turnOrder,
            drawerId: turnOrder[0] ?? "",
            phase: "choosing",
            maskedWord: "",
            wordLength: 0,
            scores,
            correctGuessers: [],
            timeRemainingSec: 80,
            drawTimeSec: 80,
            hintsUsed: 0,
            maxHints: 2,
        };
    },
    computeOutcome(publicState, players) {
        const scores = publicState.scores;
        if (!scores) {
            return {
                winnerIds: [],
                finalScoreboard: players.map((p, i) => ({
                    uid: p.uid,
                    score: 0,
                    placement: i + 1,
                    stats: {},
                })),
            };
        }
        const sorted = players
            .map((p) => ({ uid: p.uid, score: scores[p.uid] ?? 0 }))
            .sort((a, b) => b.score - a.score);
        const topScore = sorted[0]?.score ?? 0;
        const winnerIds = topScore > 0
            ? sorted.filter((s) => s.score === topScore).map((s) => s.uid)
            : [];
        return {
            winnerIds,
            finalScoreboard: sorted.map((s, i) => ({
                uid: s.uid,
                score: s.score,
                placement: i + 1,
                stats: {},
            })),
        };
    },
    extractPerformanceMetrics(publicState, players) {
        const scores = publicState.scores;
        return {
            scoresSnapshot: scores ?? {},
            playerCount: players.length,
        };
    },
});
const BS_FLEET_CLASSIC_5 = [
    { shipId: "carrier", name: "Carrier", size: 5 },
    { shipId: "battleship", name: "Battleship", size: 4 },
    { shipId: "cruiser", name: "Cruiser", size: 3 },
    { shipId: "submarine", name: "Submarine", size: 3 },
    { shipId: "destroyer", name: "Destroyer", size: 2 },
];
const BS_FLEET_COMPACT_4 = [
    { shipId: "battleship", name: "Battleship", size: 4 },
    { shipId: "cruiser", name: "Cruiser", size: 3 },
    { shipId: "submarine", name: "Submarine", size: 3 },
    { shipId: "destroyer", name: "Destroyer", size: 2 },
];
function bsGetFleet(preset) {
    return preset === "compact_4" ? BS_FLEET_COMPACT_4 : BS_FLEET_CLASSIC_5;
}
function bsCellKey(r, c) {
    return `${r},${c}`;
}
function bsComputeShipCells(startRow, startCol, size, dir) {
    const cells = [];
    for (let i = 0; i < size; i++) {
        cells.push(dir === "H"
            ? bsCellKey(startRow, startCol + i)
            : bsCellKey(startRow + i, startCol));
    }
    return cells;
}
function bsValidateFleetPlacement(placements, gridSize, fleetPreset, allowAdjacentShips) {
    const fleet = bsGetFleet(fleetPreset);
    if (placements.length !== fleet.length) {
        return {
            valid: false,
            error: `Expected ${fleet.length} ships, got ${placements.length}`,
        };
    }
    const requiredIds = new Set(fleet.map((s) => s.shipId));
    const placedIds = new Set(placements.map((p) => p.shipId));
    for (const id of requiredIds) {
        if (!placedIds.has(id)) {
            return { valid: false, error: `Missing ship: ${id}` };
        }
    }
    const occupiedCells = new Set();
    for (const p of placements) {
        const def = fleet.find((f) => f.shipId === p.shipId);
        if (!def || p.size !== def.size) {
            return { valid: false, error: `Invalid ship size for ${p.shipId}` };
        }
        const cells = bsComputeShipCells(p.startRow, p.startCol, p.size, p.direction);
        for (const ck of cells) {
            const [r, c] = ck.split(",").map(Number);
            if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
                return { valid: false, error: `Ship ${p.shipId} goes out of bounds` };
            }
            if (occupiedCells.has(ck)) {
                return { valid: false, error: `Ships overlap at ${ck}` };
            }
            occupiedCells.add(ck);
        }
    }
    if (!allowAdjacentShips) {
        for (const p of placements) {
            const myCells = new Set(bsComputeShipCells(p.startRow, p.startCol, p.size, p.direction));
            for (const other of placements) {
                if (other.shipId === p.shipId)
                    continue;
                const otherCells = bsComputeShipCells(other.startRow, other.startCol, other.size, other.direction);
                for (const ck of otherCells) {
                    const [r, c] = ck.split(",").map(Number);
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (dr === 0 && dc === 0)
                                continue;
                            if (myCells.has(bsCellKey(r + dr, c + dc))) {
                                return {
                                    valid: false,
                                    error: `Ships ${p.shipId} and ${other.shipId} are adjacent`,
                                };
                            }
                        }
                    }
                }
            }
        }
    }
    return { valid: true };
}
function bsEmptyStats(fleet) {
    return {
        hits: 0,
        misses: 0,
        accuracy: 0,
        shipsRemaining: fleet.length,
        shipsSunk: 0,
        turnsTaken: 0,
    };
}
registerAdapter({
    gameId: "battleship",
    runtimeType: "turnBased",
    maxPlayers: 2,
    minPlayers: 2,
    defaultSettings: {
        gridSize: 10,
        fleetPreset: "classic_5",
        allowAdjacentShips: false,
        shotMode: "single",
        setupTimeLimitSec: 0,
        turnTimeLimitSec: 0,
        autoResolveOnTimeout: false,
        spectatorRevealPolicy: "after_game",
        confirmBeforeFire: true,
        haptics: true,
    },
    createInitialPublicState(players, settings) {
        const gridSize = settings.gridSize ?? 10;
        const fleetPreset = settings.fleetPreset ?? "classic_5";
        const shotMode = settings.shotMode ?? "single";
        const allowAdjacentShips = settings.allowAdjacentShips ?? false;
        const fleet = bsGetFleet(fleetPreset);
        const readyByUid = {};
        const statsByUid = {};
        for (const p of players) {
            readyByUid[p.uid] = false;
            statsByUid[p.uid] = bsEmptyStats(fleet);
        }
        return {
            phase: "setup",
            rules: { gridSize, fleetPreset, shotMode, allowAdjacentShips },
            setup: { readyByUid },
            turnNumber: 0,
            currentTurnUid: null,
            shotsByDefender: {},
            statsByUid,
            lastEvent: null,
            resolved: null,
            moveCount: 0,
        };
    },
    createInitialPrivateState(players, _settings) {
        const result = {};
        for (const p of players) {
            result[p.uid] = {
                placements: [],
                cellToShip: {},
                shipHealth: {},
                aliveShips: [],
                committedAt: 0,
            };
        }
        return result;
    },
    validateMove(publicState, privateStateByPlayer, movePayload, ctx) {
        const state = publicState;
        const phase = state.phase;
        const action = movePayload.action;
        // ── Resign ──
        if (action === "resign") {
            const opponentUid = ctx.turnOrder.find((u) => u !== ctx.uid) ?? "";
            const nextState = {
                ...state,
                phase: "resolved",
                resolved: {
                    winnerUid: opponentUid,
                    reason: "resign",
                    finalStatsByUid: state.statsByUid,
                    reveal: null,
                },
            };
            return {
                ok: true,
                nextPublicState: nextState,
                terminal: { type: "win", winnerIds: [opponentUid], reason: "resign" },
            };
        }
        // ── Place Fleet (setup phase) ──
        if (action === "place_fleet") {
            if (phase !== "setup") {
                return {
                    ok: false,
                    error: "Fleet placement is only available during setup.",
                };
            }
            const placements = movePayload.placements;
            if (!Array.isArray(placements)) {
                return { ok: false, error: "Invalid placements." };
            }
            const gridSize = state.rules.gridSize ?? 10;
            const fleetPreset = state.rules.fleetPreset ??
                "classic_5";
            const allowAdjacentShips = state.rules
                .allowAdjacentShips ?? false;
            const validation = bsValidateFleetPlacement(placements, gridSize, fleetPreset, allowAdjacentShips);
            if (!validation.valid) {
                return { ok: false, error: validation.error };
            }
            // Build private state for this player
            const fleet = bsGetFleet(fleetPreset);
            const cellToShip = {};
            const shipHealth = {};
            const aliveShips = [];
            for (const p of placements) {
                const cells = bsComputeShipCells(p.startRow, p.startCol, p.size, p.direction);
                for (const ck of cells) {
                    cellToShip[ck] = p.shipId;
                }
                shipHealth[p.shipId] = p.size;
                aliveShips.push(p.shipId);
            }
            const myPrivateState = {
                placements,
                cellToShip,
                shipHealth,
                aliveShips,
                committedAt: Date.now(),
            };
            // Update readyByUid
            const readyByUid = {
                ...state.setup.readyByUid,
                [ctx.uid]: true,
            };
            // Check if all players ready → transition to battle
            const allReady = ctx.turnOrder.every((uid) => readyByUid[uid]);
            console.log(`[gamesV4][DEBUG][BS] place_fleet: uid=${ctx.uid}, allReady=${allReady}, readyByUid=${JSON.stringify(readyByUid)}, turnOrder=${JSON.stringify(ctx.turnOrder)}, currentTurnIndex=${ctx.currentTurnIndex}`);
            let nextState;
            if (allReady) {
                // Pick starting player (deterministic from session order)
                const startIndex = 0;
                nextState = {
                    ...state,
                    phase: "battle",
                    setup: { readyByUid },
                    turnNumber: 1,
                    currentTurnUid: ctx.turnOrder[startIndex],
                    lastEvent: "Battle begins!",
                    moveCount: state.moveCount + 1,
                };
            }
            else {
                nextState = {
                    ...state,
                    setup: { readyByUid },
                    lastEvent: `Player deployed their fleet.`,
                    moveCount: state.moveCount + 1,
                };
            }
            const nextPrivate = {};
            nextPrivate[ctx.uid] = myPrivateState;
            console.log(`[gamesV4][DEBUG][BS] place_fleet returning: phase=${nextState.phase}, currentTurnUid=${nextState.currentTurnUid}, moveCount=${nextState.moveCount}, turnAdvance=true`);
            return {
                ok: true,
                nextPublicState: nextState,
                nextPrivateState: nextPrivate,
                // turnAdvance must be TRUE so the session pipeline advances
                // currentTurnPlayerId to the other player. During setup this
                // lets both players submit place_fleet in alternating turns.
                // When allReady, round-robin from player-index-1 wraps to 0,
                // which matches the adapter's currentTurnUid = turnOrder[0].
                turnAdvance: true,
            };
        }
        // ── Fire (battle phase) ──
        if (action === "fire") {
            if (phase !== "battle") {
                return { ok: false, error: "Not in battle phase." };
            }
            if (state.currentTurnUid !== ctx.uid) {
                return { ok: false, error: "Not your turn." };
            }
            const target = movePayload.target;
            if (!target ||
                typeof target.r !== "number" ||
                typeof target.c !== "number") {
                return { ok: false, error: "Invalid target." };
            }
            const gridSize = state.rules.gridSize ?? 10;
            if (target.r < 0 ||
                target.r >= gridSize ||
                target.c < 0 ||
                target.c >= gridSize) {
                return { ok: false, error: "Target out of bounds." };
            }
            const opponentUid = ctx.turnOrder.find((u) => u !== ctx.uid) ?? "";
            const key = bsCellKey(target.r, target.c);
            // Check for duplicate shot
            const shotsOnOpponent = state.shotsByDefender?.[opponentUid] ?? {};
            if (shotsOnOpponent[key]) {
                return { ok: false, error: "Already fired at this cell." };
            }
            // Resolve shot against opponent's private state
            const oppPrivate = (privateStateByPlayer[opponentUid] ?? {});
            const oppCellToShip = oppPrivate.cellToShip ?? {};
            const oppShipHealth = {
                ...(oppPrivate.shipHealth ?? {}),
            };
            const oppAliveShips = [...(oppPrivate.aliveShips ?? [])];
            const hitShipId = oppCellToShip[key] ?? null;
            let shotResult;
            let sunkShipId;
            if (hitShipId) {
                oppShipHealth[hitShipId] = (oppShipHealth[hitShipId] ?? 1) - 1;
                if (oppShipHealth[hitShipId] <= 0) {
                    shotResult = "sunk";
                    sunkShipId = hitShipId;
                    const idx = oppAliveShips.indexOf(hitShipId);
                    if (idx !== -1)
                        oppAliveShips.splice(idx, 1);
                }
                else {
                    shotResult = "hit";
                }
            }
            else {
                shotResult = "miss";
            }
            // Build shot record
            const turnNumber = state.turnNumber ?? 1;
            const newShot = {
                result: shotResult,
                shipId: sunkShipId,
                turnNumber,
            };
            // Update shots
            const shotsByDefender = {
                ...state.shotsByDefender,
            };
            shotsByDefender[opponentUid] = { ...shotsOnOpponent, [key]: newShot };
            // Update attacker stats
            const statsByUid = {
                ...state.statsByUid,
            };
            const myOldStats = statsByUid[ctx.uid] ?? bsEmptyStats(bsGetFleet("classic_5"));
            const newHits = myOldStats.hits + (shotResult !== "miss" ? 1 : 0);
            const newMisses = myOldStats.misses + (shotResult === "miss" ? 1 : 0);
            const total = newHits + newMisses;
            statsByUid[ctx.uid] = {
                hits: newHits,
                misses: newMisses,
                accuracy: total > 0 ? Math.round((newHits / total) * 100) : 0,
                shipsRemaining: myOldStats.shipsRemaining,
                shipsSunk: myOldStats.shipsSunk + (shotResult === "sunk" ? 1 : 0),
                turnsTaken: myOldStats.turnsTaken + 1,
            };
            // Update defender shipsRemaining
            const oppOldStats = statsByUid[opponentUid] ?? bsEmptyStats(bsGetFleet("classic_5"));
            statsByUid[opponentUid] = {
                ...oppOldStats,
                shipsRemaining: oppAliveShips.length,
            };
            // Build event
            let event = `Shot at ${String.fromCharCode(65 + target.c)}${target.r + 1}: `;
            if (shotResult === "sunk") {
                event += `HIT & SUNK ${sunkShipId}!`;
            }
            else if (shotResult === "hit") {
                event += "HIT!";
            }
            else {
                event += "MISS";
            }
            // Check for win
            const allSunk = oppAliveShips.length === 0;
            // Update opponent private state
            const nextPrivate = {};
            nextPrivate[opponentUid] = {
                ...oppPrivate,
                shipHealth: oppShipHealth,
                aliveShips: oppAliveShips,
            };
            if (allSunk) {
                // Game over — attacker wins
                const fleet = bsGetFleet(state.rules.fleetPreset ??
                    "classic_5");
                // Build reveal (opponent placements only)
                const oppPlacements = oppPrivate.placements ?? [];
                const myPrivate = (privateStateByPlayer[ctx.uid] ?? {});
                const myPlacements = myPrivate.placements ?? [];
                const reveal = {
                    placementsByUid: {
                        [ctx.uid]: myPlacements,
                        [opponentUid]: oppPlacements,
                    },
                };
                const nextState = {
                    ...state,
                    phase: "resolved",
                    shotsByDefender,
                    statsByUid,
                    lastEvent: `${event} — ALL SHIPS SUNK! Victory!`,
                    resolved: {
                        winnerUid: ctx.uid,
                        reason: "all_sunk",
                        finalStatsByUid: statsByUid,
                        reveal,
                    },
                    moveCount: state.moveCount + 1,
                };
                return {
                    ok: true,
                    nextPublicState: nextState,
                    nextPrivateState: nextPrivate,
                    terminal: { type: "win", winnerIds: [ctx.uid], reason: "all_sunk" },
                };
            }
            // Advance turn
            const nextTurnUid = opponentUid;
            const nextState = {
                ...state,
                turnNumber: turnNumber + 1,
                currentTurnUid: nextTurnUid,
                shotsByDefender,
                statsByUid,
                lastEvent: event,
                moveCount: state.moveCount + 1,
            };
            return {
                ok: true,
                nextPublicState: nextState,
                nextPrivateState: nextPrivate,
                turnAdvance: true,
            };
        }
        // ── Salvo Fire (battle phase) ──
        if (action === "salvo_fire") {
            if (phase !== "battle") {
                return { ok: false, error: "Not in battle phase." };
            }
            if (state.currentTurnUid !== ctx.uid) {
                return { ok: false, error: "Not your turn." };
            }
            const targets = movePayload.targets;
            if (!Array.isArray(targets) || targets.length === 0) {
                return { ok: false, error: "Invalid targets." };
            }
            const gridSize = state.rules.gridSize ?? 10;
            const opponentUid = ctx.turnOrder.find((u) => u !== ctx.uid) ?? "";
            // Expected count = attacker's shipsRemaining
            const myOldStats = state.statsByUid[ctx.uid] ??
                bsEmptyStats(bsGetFleet("classic_5"));
            if (targets.length !== myOldStats.shipsRemaining) {
                return {
                    ok: false,
                    error: `Salvo requires exactly ${myOldStats.shipsRemaining} targets.`,
                };
            }
            // Validate all targets
            const targetKeys = new Set();
            const shotsOnOpponent = state.shotsByDefender?.[opponentUid] ?? {};
            for (const t of targets) {
                if (t.r < 0 || t.r >= gridSize || t.c < 0 || t.c >= gridSize) {
                    return { ok: false, error: `Target (${t.r},${t.c}) out of bounds.` };
                }
                const k = bsCellKey(t.r, t.c);
                if (targetKeys.has(k)) {
                    return { ok: false, error: `Duplicate target: ${k}` };
                }
                if (shotsOnOpponent[k]) {
                    return { ok: false, error: `Already fired at ${k}.` };
                }
                targetKeys.add(k);
            }
            // Resolve all shots
            const oppPrivate = (privateStateByPlayer[opponentUid] ?? {});
            const oppCellToShip = oppPrivate.cellToShip ?? {};
            const oppShipHealth = {
                ...(oppPrivate.shipHealth ?? {}),
            };
            const oppAliveShips = [...(oppPrivate.aliveShips ?? [])];
            const turnNumber = state.turnNumber ?? 1;
            const shotsByDefender = {
                ...state.shotsByDefender,
            };
            const updatedShots = { ...shotsOnOpponent };
            let newHits = myOldStats.hits;
            let newMisses = myOldStats.misses;
            let newSunk = myOldStats.shipsSunk;
            const events = [];
            for (const t of targets) {
                const k = bsCellKey(t.r, t.c);
                const hitShipId = oppCellToShip[k] ?? null;
                let shotResult;
                let sunkShipId;
                if (hitShipId) {
                    oppShipHealth[hitShipId] = (oppShipHealth[hitShipId] ?? 1) - 1;
                    if (oppShipHealth[hitShipId] <= 0) {
                        shotResult = "sunk";
                        sunkShipId = hitShipId;
                        const idx = oppAliveShips.indexOf(hitShipId);
                        if (idx !== -1)
                            oppAliveShips.splice(idx, 1);
                        newSunk++;
                    }
                    else {
                        shotResult = "hit";
                    }
                    newHits++;
                }
                else {
                    shotResult = "miss";
                    newMisses++;
                }
                updatedShots[k] = {
                    result: shotResult,
                    shipId: sunkShipId,
                    turnNumber,
                };
                const label = `${String.fromCharCode(65 + t.c)}${t.r + 1}`;
                events.push(`${label}:${shotResult.toUpperCase()}${sunkShipId ? `(${sunkShipId})` : ""}`);
            }
            shotsByDefender[opponentUid] = updatedShots;
            const total = newHits + newMisses;
            const statsByUid = {
                ...state.statsByUid,
            };
            statsByUid[ctx.uid] = {
                hits: newHits,
                misses: newMisses,
                accuracy: total > 0 ? Math.round((newHits / total) * 100) : 0,
                shipsRemaining: myOldStats.shipsRemaining,
                shipsSunk: newSunk,
                turnsTaken: myOldStats.turnsTaken + 1,
            };
            const oppOldStats = statsByUid[opponentUid] ?? bsEmptyStats(bsGetFleet("classic_5"));
            statsByUid[opponentUid] = {
                ...oppOldStats,
                shipsRemaining: oppAliveShips.length,
            };
            const event = `Salvo: ${events.join(", ")}`;
            const allSunk = oppAliveShips.length === 0;
            const nextPrivate = {};
            nextPrivate[opponentUid] = {
                ...oppPrivate,
                shipHealth: oppShipHealth,
                aliveShips: oppAliveShips,
            };
            if (allSunk) {
                const oppPlacements = oppPrivate.placements ?? [];
                const myPrivate = (privateStateByPlayer[ctx.uid] ?? {});
                const myPlacements = myPrivate.placements ?? [];
                const reveal = {
                    placementsByUid: {
                        [ctx.uid]: myPlacements,
                        [opponentUid]: oppPlacements,
                    },
                };
                const nextState = {
                    ...state,
                    phase: "resolved",
                    shotsByDefender,
                    statsByUid,
                    lastEvent: `${event} — ALL SHIPS SUNK! Victory!`,
                    resolved: {
                        winnerUid: ctx.uid,
                        reason: "all_sunk",
                        finalStatsByUid: statsByUid,
                        reveal,
                    },
                    moveCount: state.moveCount + 1,
                };
                return {
                    ok: true,
                    nextPublicState: nextState,
                    nextPrivateState: nextPrivate,
                    terminal: { type: "win", winnerIds: [ctx.uid], reason: "all_sunk" },
                };
            }
            const nextState = {
                ...state,
                turnNumber: turnNumber + 1,
                currentTurnUid: opponentUid,
                shotsByDefender,
                statsByUid,
                lastEvent: event,
                moveCount: state.moveCount + 1,
            };
            return {
                ok: true,
                nextPublicState: nextState,
                nextPrivateState: nextPrivate,
                turnAdvance: true,
            };
        }
        return { ok: false, error: `Unknown action: ${action}` };
    },
    computeOutcome(publicState, players) {
        const state = publicState;
        const resolved = state.resolved;
        const winnerUid = resolved?.winnerUid;
        const statsByUid = state.statsByUid ?? {};
        const sorted = players
            .map((p) => {
            const s = statsByUid[p.uid] ?? bsEmptyStats(bsGetFleet("classic_5"));
            const isWinner = p.uid === winnerUid;
            // Score: Winner gets 100 + shipsRemaining*10 + accuracy bonus - turns penalty
            // Loser gets shipsSunk*10 + accuracy bonus (lower weight)
            const score = isWinner
                ? 100 +
                    s.shipsRemaining * 10 +
                    Math.round((s.accuracy * 50) / 100) -
                    s.turnsTaken
                : s.shipsSunk * 10 + Math.round((s.accuracy * 25) / 100);
            return {
                uid: p.uid,
                score: Math.max(0, score),
                stats: s,
            };
        })
            .sort((a, b) => b.score - a.score);
        return {
            winnerIds: winnerUid ? [winnerUid] : [],
            finalScoreboard: sorted.map((s, i) => ({
                uid: s.uid,
                score: s.score,
                placement: i + 1,
                stats: s.stats,
            })),
        };
    },
    extractPerformanceMetrics(publicState, players) {
        const state = publicState;
        const statsByUid = state.statsByUid ?? {};
        const turnNumber = state.turnNumber ?? 0;
        const phase = state.phase ?? "unknown";
        const rules = state.rules ?? {};
        return {
            phase,
            turnNumber,
            gridSize: rules.gridSize,
            fleetPreset: rules.fleetPreset,
            shotMode: rules.shotMode,
            statsByUid,
        };
    },
    validateSettings(patch) {
        const clean = {};
        if (patch.gridSize !== undefined) {
            const g = Number(patch.gridSize);
            clean.gridSize = [8, 10, 12].includes(g) ? g : 10;
        }
        if (patch.fleetPreset !== undefined) {
            clean.fleetPreset = ["classic_5", "compact_4"].includes(patch.fleetPreset)
                ? patch.fleetPreset
                : "classic_5";
        }
        if (patch.allowAdjacentShips !== undefined) {
            clean.allowAdjacentShips = Boolean(patch.allowAdjacentShips);
        }
        if (patch.shotMode !== undefined) {
            clean.shotMode = ["single", "salvo"].includes(patch.shotMode)
                ? patch.shotMode
                : "single";
        }
        if (patch.confirmBeforeFire !== undefined) {
            clean.confirmBeforeFire = Boolean(patch.confirmBeforeFire);
        }
        if (patch.haptics !== undefined) {
            clean.haptics = Boolean(patch.haptics);
        }
        return clean;
    },
});
// =============================================================================
// 🧱  BRICK BREAKER — Solo campaign adapter (server-side)
// =============================================================================
// ── Brick Breaker Constants ──────────────────────────────────────────
const BB_FIELD_W = 6.5;
const BB_FIELD_H = 11.0;
const BB_COLS = 13;
const BB_ROWS = 10;
const BB_BRICK_W = 0.5;
const BB_BRICK_H = 0.3;
const BB_GRID_TOP_Y = 10.0;
const BB_PADDLE_Y = 1.0;
const BB_PADDLE_HW = 0.5;
const BB_PADDLE_HH = 0.1;
const BB_BALL_RADIUS = 0.12;
const BB_BALL_SPEED = 5.0;
const BB_POWERUP_RADIUS = 0.13;
const BB_POWERUP_FALL_SPEED = -2.0;
const BB_DT = 1 / 60;
const BB_DEFAULT_LIVES = 3;
const BB_POWERUP_DURATION = 600;
const BB_LASER_INTERVAL = 20;
const BB_LASER_SHOTS = 10;
const BB_LASER_SPEED = 12;
const BB_MAX_BOUNCE_ANGLE = (65 * Math.PI) / 180;
const BB_MOVE_SPEED = 0.8;
const BB_MOVE_RANGE = 0.6;
const BB_MAX_LEVEL = 30;
const BB_BRICKS = {
    ".": { hp: -1, breakable: false, score: 0 },
    " ": { hp: -1, breakable: false, score: 0 },
    N: { hp: 1, breakable: true, score: 10 },
    H: { hp: 2, breakable: true, score: 25 },
    V: { hp: 3, breakable: true, score: 60 },
    S: { hp: 0, breakable: false, score: 0 },
    E: { hp: 1, breakable: true, score: 40 },
    P: { hp: 1, breakable: true, score: 20 },
    M: { hp: 1, breakable: true, score: 30 },
};
const BB_PU_POOL = [
    "expand",
    "shrink",
    "multiball",
    "slow",
    "fast",
    "sticky",
    "laser",
    "shield",
    "extraLife",
];
const BB_PU_WEIGHTS = {
    expand: 15,
    shrink: 10,
    multiball: 8,
    slow: 12,
    fast: 10,
    sticky: 5,
    laser: 5,
    shield: 8,
    extraLife: 3,
};
// ── Seeded RNG (Mulberry32) ──────────────────────────────────────────
function bbRng(seed) {
    let s = seed | 0;
    if (s === 0)
        s = 1;
    function next() {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
        next,
        nextInt: (a, b) => a + Math.floor(next() * (b - a + 1)),
    };
}
function bbWeightedPick(rng) {
    const total = BB_PU_POOL.reduce((s, k) => s + BB_PU_WEIGHTS[k], 0);
    let roll = rng.next() * total;
    for (const item of BB_PU_POOL) {
        roll -= BB_PU_WEIGHTS[item];
        if (roll <= 0)
            return item;
    }
    return BB_PU_POOL[BB_PU_POOL.length - 1];
}
// ── Level Pack (30 levels) ───────────────────────────────────────────
const BB_LEVELS = [
    {
        id: 1,
        name: "Warm-Up",
        ballSpeed: 1,
        paddle: 1,
        powerRate: 0.16,
        rows: [
            "NNNNNNNNNNNNN",
            "NNNNNNNNNNNNN",
            ".....NNN.....",
            "....NNNNN....",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 2,
        name: "Staircase",
        ballSpeed: 1,
        paddle: 1,
        powerRate: 0.16,
        rows: [
            "N............",
            ".N...........",
            "..N..........",
            "...N.........",
            "....N........",
            ".....N.......",
            "......N......",
            ".......N.....",
            "........N....",
            ".........N...",
        ],
    },
    {
        id: 3,
        name: "Smile",
        ballSpeed: 1.02,
        paddle: 1,
        powerRate: 0.15,
        rows: [
            "..NN.....NN..",
            "..NN.....NN..",
            ".............",
            "N...N...N...N",
            "N...........N",
            "N..N.....N..N",
            "N...NNNNN...N",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 4,
        name: "Double Bars",
        ballSpeed: 1.03,
        paddle: 1,
        powerRate: 0.15,
        rows: [
            "NNNNNNNNNNNNN",
            ".............",
            "NNNNNNNNNNNNN",
            ".............",
            "NNNNNNNNNNNNN",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 5,
        name: "Pocket Gaps",
        ballSpeed: 1.05,
        paddle: 1,
        powerRate: 0.14,
        rows: [
            "NNN.NNN.NNN.N",
            "NNN.NNN.NNN.N",
            "NNN.NNN.NNN.N",
            ".............",
            "....NNNNN....",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 6,
        name: "First Armor",
        ballSpeed: 1.07,
        paddle: 0.98,
        powerRate: 0.14,
        rows: [
            "HHHHHHHHHHHHH",
            "NNNNNNNNNNNNN",
            ".............",
            "....NNNNN....",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 7,
        name: "Checker Lite",
        ballSpeed: 1.08,
        paddle: 0.98,
        powerRate: 0.14,
        rows: [
            "N.N.N.N.N.N.N",
            ".N.N.N.N.N.N.",
            "N.N.N.N.N.N.N",
            ".N.N.N.N.N.N.",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 8,
        name: "Diamond",
        ballSpeed: 1.1,
        paddle: 0.98,
        powerRate: 0.13,
        rows: [
            ".....N.N.....",
            "....NHHHN....",
            "...NHVVVHN...",
            "..NHVVVVVHN..",
            "...NHVVVHN...",
            "....NHHHN....",
            ".....N.N.....",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 9,
        name: "Thin Channel",
        ballSpeed: 1.12,
        paddle: 0.96,
        powerRate: 0.13,
        rows: [
            "SSSSS...SSSSS",
            "NNNNN...NNNNN",
            "HHHHH...HHHHH",
            "NNNNN...NNNNN",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 10,
        name: "Armor Rows",
        ballSpeed: 1.15,
        paddle: 0.96,
        powerRate: 0.13,
        rows: [
            "HHHHHHHHHHHHH",
            "HHHHHHHHHHHHH",
            "NNNNNNNNNNNNN",
            "NNNNNNNNNNNNN",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 11,
        name: "Steel Posts",
        ballSpeed: 1.18,
        paddle: 0.95,
        powerRate: 0.12,
        rows: [
            "S...NNNNN...S",
            "S...NNNNN...S",
            "S...HHHHH...S",
            "S...NNNNN...S",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 12,
        name: "Power Lane",
        ballSpeed: 1.2,
        paddle: 0.95,
        powerRate: 0.12,
        rows: [
            "NNNNPPPPNNNNN",
            "NNNN....NNNNN",
            "HHHH....HHHHH",
            "NNNNPPPPNNNNN",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 13,
        name: "Heavy Core",
        ballSpeed: 1.22,
        paddle: 0.94,
        powerRate: 0.12,
        rows: [
            "NNNNNNNNNNNNN",
            "NNNHHHHHHHNNN",
            "NNHHVVVVVHHNN",
            "NNNHHHHHHHNNN",
            "NNNNNNNNNNNNN",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 14,
        name: "Split Walls",
        ballSpeed: 1.24,
        paddle: 0.94,
        powerRate: 0.11,
        rows: [
            "SSSSS...SSSSS",
            "NNNNN...NNNNN",
            "HHHHH...HHHHH",
            "NNNNN...NNNNN",
            "SSSSS...SSSSS",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 15,
        name: "Explosive Intro",
        ballSpeed: 1.26,
        paddle: 0.92,
        powerRate: 0.11,
        rows: [
            "NNNNEEEEENNNN",
            "NNNNNHHHNNNNN",
            "NNNN.....NNNN",
            "HHHH.....HHHH",
            "NNNNPPPPNNNNN",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 16,
        name: "Blast Pockets",
        ballSpeed: 1.3,
        paddle: 0.9,
        powerRate: 0.11,
        rows: [
            "S..E..NNN..ES",
            "..NNNHHHHHNN.",
            ".NN.HVVVH.NN.",
            "..NNNHHHHHNN.",
            "S..E..NNN..ES",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 17,
        name: "Steel Maze I",
        ballSpeed: 1.32,
        paddle: 0.9,
        powerRate: 0.1,
        rows: [
            "SSSSSSSSSSSSS",
            "SNNN...NNNNS.",
            ".HH...HHHS...",
            "SNNN...NNNNS.",
            "SSSS...SSSSS.",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 18,
        name: "Ring",
        ballSpeed: 1.34,
        paddle: 0.88,
        powerRate: 0.1,
        rows: [
            "..NNNNNNNNN..",
            ".NHHHHHHHHHN.",
            "NHH.......HHN",
            "NH..VVVVV..HN",
            "NH..VVVVV..HN",
            "NHH.......HHN",
            ".NHHHHHHHHHN.",
            "..NNNNNNNNN..",
            ".............",
            ".............",
        ],
    },
    {
        id: 19,
        name: "Heavy Rain",
        ballSpeed: 1.36,
        paddle: 0.88,
        powerRate: 0.1,
        rows: [
            "V.V.V.V.V.V.V",
            ".V.V.V.V.V.V.",
            "V.V.V.V.V.V.V",
            ".V.V.V.V.V.V.",
            "HHHHHHHHHHHHH",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 20,
        name: "Steel Maze II",
        ballSpeed: 1.4,
        paddle: 0.85,
        powerRate: 0.1,
        rows: [
            "SSSSSSSSSSSSS",
            "SNNN.SSS.NNNS",
            "SHHH.SSS.HHHS",
            "SNNN.SSS.NNNS",
            "SSSS.SSS.SSSS",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 21,
        name: "Moving Intro",
        ballSpeed: 1.44,
        paddle: 0.84,
        powerRate: 0.09,
        rows: [
            "MMMMM...MMMMM",
            "NNNNN...NNNNN",
            "HHHHH...HHHHH",
            "NNNNNPPPPNNNN",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 22,
        name: "Crossfire",
        ballSpeed: 1.46,
        paddle: 0.83,
        powerRate: 0.09,
        rows: [
            "..E...MMM...E",
            ".NNN.HHHHH.NN",
            "..E...MMM...E",
            ".....VVVVV...",
            "..P.........P",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 23,
        name: "Moving Rails",
        ballSpeed: 1.48,
        paddle: 0.82,
        powerRate: 0.09,
        rows: [
            "SSSSSMMMSSSMM",
            "NNNNN...NNNNN",
            "HHHHH...HHHHH",
            "NNNNN...NNNNN",
            "SSSSSMMMSSSMM",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 24,
        name: "Tight Diamond",
        ballSpeed: 1.5,
        paddle: 0.8,
        powerRate: 0.08,
        rows: [
            ".....H.H.....",
            "....HVVVH....",
            "...HVSSSVH...",
            "..HVSSSSSVH..",
            "...HVSSSVH...",
            "....HVVVH....",
            ".....H.H.....",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 25,
        name: "Explode & Move",
        ballSpeed: 1.52,
        paddle: 0.8,
        powerRate: 0.08,
        rows: [
            "MMEEMMEEEMMEE",
            "NNNNHHHHNNNNN",
            "....P...P....",
            "HHHHVVVVHHHHH",
            "NNNNHHHHNNNNN",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 26,
        name: "Boss Plate I",
        ballSpeed: 1.56,
        paddle: 0.78,
        powerRate: 0.08,
        rows: [
            "SSSSSSSSSSSSS",
            "S...VVVVV...S",
            "S..VVVVVVV..S",
            "S...VVVVV...S",
            "SSSSSSSSSSSSS",
            ".....P.P.....",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 27,
        name: "Boss Plate II",
        ballSpeed: 1.58,
        paddle: 0.77,
        powerRate: 0.07,
        rows: [
            "SSSSSSSSSSSSS",
            "S..VVVVVVV..S",
            "S.VVVSSSVVV.S",
            "S..VVVVVVV..S",
            "SSSSSSSSSSSSS",
            "....E...E....",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 28,
        name: "Steel Funnel",
        ballSpeed: 1.6,
        paddle: 0.76,
        powerRate: 0.07,
        rows: [
            "SSSSS...SSSSS",
            "SNNNN...NNNNS",
            "S.HHHH.HHHH.S",
            "S..VVVVVVV..S",
            "S...EEEEE...S",
            "SSSSS...SSSSS",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 29,
        name: "Chaos Grid",
        ballSpeed: 1.62,
        paddle: 0.75,
        powerRate: 0.07,
        rows: [
            "MNHVESPNMHVSP",
            "H.S.E.N.P.S.E",
            "VNMHSPVNMHSPV",
            "E..P..E..P..E",
            "SSSSSSSSSSSSS",
            ".............",
            ".............",
            ".............",
            ".............",
            ".............",
        ],
    },
    {
        id: 30,
        name: "The Last Wall",
        ballSpeed: 1.65,
        paddle: 0.75,
        powerRate: 0.06,
        rows: [
            "SSSSSSSSSSSSS",
            "SVVVVVVVVVVVS",
            "SVVMMMEEEMMVS",
            "SVVHHHPPPHHVS",
            "SVVNNNNNNNVVS",
            "SVVHHHPPPHHVS",
            "SVVMMMEEEMMVS",
            "SVVVVVVVVVVVS",
            "SSSSSSSSSSSSS",
            ".....P...P...",
        ],
    },
];
// ── Planck Replay (server-side) ──────────────────────────────────────
const planck = __importStar(require("planck"));
const bbVec2 = planck.Vec2;
function bbClamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
function bbCreateSim(levelDef, seed, lives, carry) {
    const world = new planck.World(bbVec2(0, 0));
    const rng = bbRng(seed + levelDef.id * 997);
    const paddleHW = BB_PADDLE_HW * levelDef.paddle;
    const baseBallSpeed = BB_BALL_SPEED * levelDef.ballSpeed;
    // Walls
    const wb = world.createBody({ type: "static", position: bbVec2(0, 0) });
    wb.setUserData({ tag: "wall" });
    wb.createFixture({
        shape: new planck.Edge(bbVec2(0, 0), bbVec2(0, BB_FIELD_H)),
        friction: 0,
        restitution: 1,
    });
    wb.createFixture({
        shape: new planck.Edge(bbVec2(BB_FIELD_W, 0), bbVec2(BB_FIELD_W, BB_FIELD_H)),
        friction: 0,
        restitution: 1,
    });
    wb.createFixture({
        shape: new planck.Edge(bbVec2(0, BB_FIELD_H), bbVec2(BB_FIELD_W, BB_FIELD_H)),
        friction: 0,
        restitution: 1,
    });
    // Death zone
    const dz = world.createBody({
        type: "static",
        position: bbVec2(BB_FIELD_W / 2, -0.5),
    });
    dz.setUserData({ tag: "death" });
    dz.createFixture({ shape: new planck.Box(BB_FIELD_W, 0.3), isSensor: true });
    // Paddle
    const paddle = world.createBody({
        type: "kinematic",
        position: bbVec2(BB_FIELD_W / 2, BB_PADDLE_Y),
        fixedRotation: true,
    });
    paddle.setUserData({ tag: "paddle" });
    paddle.createFixture({
        shape: new planck.Box(paddleHW, BB_PADDLE_HH),
        friction: 0,
        restitution: 1,
    });
    // Bricks
    const bricks = new Map();
    let breakableRemaining = 0;
    for (let r = 0; r < BB_ROWS; r++) {
        const rowStr = (levelDef.rows[r] || "")
            .padEnd(BB_COLS, ".")
            .slice(0, BB_COLS);
        for (let c = 0; c < BB_COLS; c++) {
            let ch = rowStr[c] || ".";
            if (ch === " ")
                ch = ".";
            const def = BB_BRICKS[ch];
            if (!def || def.hp < 0)
                continue;
            const x = c * BB_BRICK_W + BB_BRICK_W / 2;
            const y = BB_GRID_TOP_Y - r * BB_BRICK_H - BB_BRICK_H / 2;
            const key = `${c}_${r}`;
            const body = world.createBody({
                type: ch === "M" ? "kinematic" : "static",
                position: bbVec2(x, y),
                fixedRotation: true,
            });
            body.setUserData({ tag: "brick", key, col: c, row: r, brickType: ch });
            body.createFixture({
                shape: new planck.Box(BB_BRICK_W / 2 - 0.01, BB_BRICK_H / 2 - 0.01),
                friction: 0,
                restitution: 1,
            });
            const hp = def.hp === 0 ? 9999 : def.hp;
            bricks.set(key, { body, hp, brickType: ch, col: c, row: r, originX: x });
            if (def.breakable)
                breakableRemaining++;
        }
    }
    // Ball
    const balls = new Map();
    const by = BB_PADDLE_Y + BB_PADDLE_HH + BB_BALL_RADIUS + 0.05;
    const ball = world.createBody({
        type: "dynamic",
        position: bbVec2(BB_FIELD_W / 2, by),
        bullet: true,
        fixedRotation: true,
    });
    ball.setUserData({ tag: "ball", id: 0 });
    ball.createFixture({
        shape: new planck.Circle(BB_BALL_RADIUS),
        friction: 0,
        restitution: 1,
        density: 1,
    });
    ball.setLinearVelocity(bbVec2(0, 0));
    balls.set(0, ball);
    const sim = {
        world,
        paddle,
        balls,
        bricks,
        powerupBodies: new Map(),
        shieldBody: null,
        laserBodies: new Map(),
        rng,
        baseBallSpeed,
        paddleHW,
        tick: 0,
        serving: true,
        lives,
        score: carry?.score ?? 0,
        combo: carry?.combo ?? 0,
        maxCombo: carry?.maxCombo ?? 0,
        bricksDestroyed: carry?.bricksDestroyed ?? 0,
        breakableRemaining,
        powerupsUsed: carry?.powerupsUsed ?? 0,
        explosionKills: carry?.explosionKills ?? 0,
        laserKills: carry?.laserKills ?? 0,
        maxBallsAtOnce: carry?.maxBallsAtOnce ?? 1,
        missedThisLevel: false,
        levelCleared: false,
        runOver: false,
        activePowerups: new Map(),
        laserShotsRemaining: 0,
        lastLaserTick: -999,
        stickyBall: false,
        stickyOffset: 0,
        nextBallId: 1,
        nextPuId: 0,
        nextLaserId: 0,
        pendBrick: [],
        pendBallLoss: [],
        pendPuCollect: [],
        pendLaser: [],
        pendShield: false,
        pendPaddle: null,
    };
    world.on("begin-contact", (contact) => {
        const bA = contact.getFixtureA().getBody();
        const bB = contact.getFixtureB().getBody();
        const uA = bA.getUserData();
        const uB = bB.getUserData();
        if (!uA || !uB)
            return;
        const p = [uA, uB];
        const _b = p.find((u) => u.tag === "ball");
        const _br = p.find((u) => u.tag === "brick");
        const _d = p.find((u) => u.tag === "death");
        const _pa = p.find((u) => u.tag === "paddle");
        const _pu = p.find((u) => u.tag === "powerup");
        const _la = p.find((u) => u.tag === "laser");
        const _sh = p.find((u) => u.tag === "shield");
        if (_b && _br)
            sim.pendBrick.push({ key: _br.key });
        if (_b && _d)
            sim.pendBallLoss.push(_b.id);
        if (_b && _pa)
            sim.pendPaddle = _b.id;
        if (_b && _sh)
            sim.pendShield = true;
        if (_pu && _pa)
            sim.pendPuCollect.push({ id: _pu.id, byPaddle: true });
        if (_pu && _d)
            sim.pendPuCollect.push({ id: _pu.id, byPaddle: false });
        if (_la && _br)
            sim.pendLaser.push({ lid: _la.id, bkey: _br.key });
    });
    return sim;
}
function bbGetPaddleHW(s) {
    let hw = s.paddleHW;
    if (s.activePowerups.has("expand"))
        hw *= 1.5;
    if (s.activePowerups.has("shrink"))
        hw *= 0.6;
    return bbClamp(hw, 0.2, BB_FIELD_W / 2 - 0.1);
}
function bbGetBallSpeed(s) {
    let sp = s.baseBallSpeed;
    if (s.activePowerups.has("slow"))
        sp *= 0.65;
    if (s.activePowerups.has("fast"))
        sp *= 1.4;
    return sp;
}
function bbAdjacentKeys(c, r) {
    const keys = [];
    for (let dc = -1; dc <= 1; dc++)
        for (let dr = -1; dr <= 1; dr++) {
            if (dc === 0 && dr === 0)
                continue;
            const nc = c + dc, nr = r + dr;
            if (nc >= 0 && nc < BB_COLS && nr >= 0 && nr < BB_ROWS)
                keys.push(`${nc}_${nr}`);
        }
    return keys;
}
function bbDestroyBrick(s, key, destroyed) {
    const br = s.bricks.get(key);
    if (!br || destroyed.has(key))
        return;
    const def = BB_BRICKS[br.brickType];
    if (!def || !def.breakable)
        return;
    destroyed.add(key);
    s.score += def.score * Math.max(1, Math.floor(s.combo / 5) + 1);
    s.combo++;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.bricksDestroyed++;
    s.breakableRemaining--;
    if (br.brickType === "E") {
        for (const ak of bbAdjacentKeys(br.col, br.row)) {
            const adj = s.bricks.get(ak);
            if (adj && !destroyed.has(ak) && BB_BRICKS[adj.brickType]?.breakable) {
                adj.hp = 0;
                s.explosionKills++;
                bbDestroyBrick(s, ak, destroyed);
            }
        }
    }
    const drop = br.brickType === "P" || s.rng.next() < 0.12; // use a fixed server rate
    if (drop) {
        const kind = bbWeightedPick(s.rng);
        const id = s.nextPuId++;
        const body = s.world.createBody({
            type: "dynamic",
            position: bbVec2(br.body.getPosition().x, br.body.getPosition().y),
            fixedRotation: true,
        });
        body.setUserData({ tag: "powerup", id, kind });
        body.createFixture({
            shape: new planck.Circle(BB_POWERUP_RADIUS),
            isSensor: true,
            density: 0.1,
        });
        body.setLinearVelocity(bbVec2(0, BB_POWERUP_FALL_SPEED));
        body.setGravityScale(0);
        s.powerupBodies.set(id, { body, kind });
    }
    s.world.destroyBody(br.body);
    s.bricks.delete(key);
}
function bbApplyPowerup(s, kind) {
    s.powerupsUsed++;
    const exp = s.tick + BB_POWERUP_DURATION;
    switch (kind) {
        case "expand":
            s.activePowerups.set("expand", exp);
            s.activePowerups.delete("shrink");
            break;
        case "shrink":
            s.activePowerups.set("shrink", exp);
            s.activePowerups.delete("expand");
            break;
        case "slow":
            s.activePowerups.set("slow", exp);
            s.activePowerups.delete("fast");
            break;
        case "fast":
            s.activePowerups.set("fast", exp);
            s.activePowerups.delete("slow");
            break;
        case "extraLife":
            s.lives++;
            break;
        case "shield":
            if (!s.shieldBody) {
                const sb = s.world.createBody({
                    type: "static",
                    position: bbVec2(BB_FIELD_W / 2, 0.05),
                });
                sb.setUserData({ tag: "shield" });
                sb.createFixture({
                    shape: new planck.Box(BB_FIELD_W / 2, 0.05),
                    friction: 0,
                    restitution: 1,
                });
                s.shieldBody = sb;
            }
            break;
        case "multiball": {
            const primary = [...s.balls.values()][0];
            if (primary) {
                const pos = primary.getPosition();
                const vel = primary.getLinearVelocity();
                const sp = vel.length() || bbGetBallSpeed(s);
                for (let i = 0; i < 2; i++) {
                    const ang = (i === 0 ? -0.4 : 0.4) + Math.atan2(vel.x, vel.y);
                    const id = s.nextBallId++;
                    const nb = s.world.createBody({
                        type: "dynamic",
                        position: bbVec2(pos.x, pos.y),
                        bullet: true,
                        fixedRotation: true,
                    });
                    nb.setUserData({ tag: "ball", id });
                    nb.createFixture({
                        shape: new planck.Circle(BB_BALL_RADIUS),
                        friction: 0,
                        restitution: 1,
                        density: 1,
                    });
                    nb.setLinearVelocity(bbVec2(Math.sin(ang) * sp, Math.cos(ang) * sp));
                    s.balls.set(id, nb);
                }
                s.maxBallsAtOnce = Math.max(s.maxBallsAtOnce, s.balls.size);
            }
            break;
        }
        case "sticky":
            s.stickyBall = true;
            break;
        case "laser":
            s.laserShotsRemaining = BB_LASER_SHOTS;
            s.lastLaserTick = s.tick - BB_LASER_INTERVAL;
            break;
    }
}
function bbResetServe(s) {
    s.serving = true;
    s.stickyBall = false;
    s.stickyOffset = 0;
    for (const [, b] of s.balls)
        s.world.destroyBody(b);
    s.balls.clear();
    for (const [, p] of s.powerupBodies)
        s.world.destroyBody(p.body);
    s.powerupBodies.clear();
    for (const [, l] of s.laserBodies)
        s.world.destroyBody(l);
    s.laserBodies.clear();
    s.activePowerups.clear();
    s.laserShotsRemaining = 0;
    if (s.shieldBody) {
        s.world.destroyBody(s.shieldBody);
        s.shieldBody = null;
    }
    // Update paddle fixture
    const ohw = bbGetPaddleHW(s);
    const of2 = s.paddle.getFixtureList();
    if (of2)
        s.paddle.destroyFixture(of2);
    s.paddle.createFixture({
        shape: new planck.Box(s.paddleHW, BB_PADDLE_HH),
        friction: 0,
        restitution: 1,
    });
    // New ball
    const by = BB_PADDLE_Y + BB_PADDLE_HH + BB_BALL_RADIUS + 0.05;
    const px = s.paddle.getPosition().x;
    const nb = s.world.createBody({
        type: "dynamic",
        position: bbVec2(px, by),
        bullet: true,
        fixedRotation: true,
    });
    const bid = s.nextBallId++;
    nb.setUserData({ tag: "ball", id: bid });
    nb.createFixture({
        shape: new planck.Circle(BB_BALL_RADIUS),
        friction: 0,
        restitution: 1,
        density: 1,
    });
    nb.setLinearVelocity(bbVec2(0, 0));
    s.balls.set(bid, nb);
}
function bbStep(s, targetXNorm, action) {
    if (s.levelCleared || s.runOver)
        return;
    // Launch
    if (s.serving && action === 1) {
        s.serving = false;
        const sp = bbGetBallSpeed(s);
        const ang = (s.rng.next() - 0.5) * 0.6;
        for (const [, ball] of s.balls) {
            if (ball.getLinearVelocity().length() < 0.1)
                ball.setLinearVelocity(bbVec2(Math.sin(ang) * sp, Math.cos(ang) * sp));
        }
    }
    // Paddle
    const hw = bbGetPaddleHW(s);
    const tx = bbClamp(targetXNorm * BB_FIELD_W, hw, BB_FIELD_W - hw);
    const pp = s.paddle.getPosition();
    const dx = tx - pp.x;
    s.paddle.setLinearVelocity(bbVec2(bbClamp(dx / BB_DT, -30, 30), 0));
    // Sticky / serve follow
    if (s.serving || s.stickyBall) {
        for (const [, ball] of s.balls) {
            if (ball.getLinearVelocity().length() < 0.1) {
                ball.setTransform(bbVec2(s.paddle.getPosition().x + s.stickyOffset, BB_PADDLE_Y + BB_PADDLE_HH + BB_BALL_RADIUS + 0.05), 0);
                ball.setLinearVelocity(bbVec2(0, 0));
            }
        }
    }
    // Moving bricks
    for (const [, br] of s.bricks) {
        if (br.brickType === "M") {
            const t = s.tick * BB_DT;
            const ox = Math.sin(t * BB_MOVE_SPEED * Math.PI * 2) * BB_MOVE_RANGE;
            br.body.setTransform(bbVec2(br.originX + ox, br.body.getPosition().y), 0);
        }
    }
    // Laser auto-fire
    if (s.laserShotsRemaining > 0 &&
        s.tick - s.lastLaserTick >= BB_LASER_INTERVAL &&
        !s.serving) {
        s.laserShotsRemaining--;
        s.lastLaserTick = s.tick;
        const lid = s.nextLaserId++;
        const lb = s.world.createBody({
            type: "dynamic",
            position: bbVec2(s.paddle.getPosition().x, BB_PADDLE_Y + 0.3),
            bullet: true,
            fixedRotation: true,
        });
        lb.setUserData({ tag: "laser", id: lid });
        lb.createFixture({
            shape: new planck.Box(0.03, 0.1),
            isSensor: true,
            density: 0.01,
        });
        lb.setGravityScale(0);
        lb.setLinearVelocity(bbVec2(0, BB_LASER_SPEED));
        s.laserBodies.set(lid, lb);
    }
    // Remove high lasers
    for (const [id, l] of s.laserBodies) {
        if (l.getPosition().y > BB_FIELD_H + 0.5) {
            s.world.destroyBody(l);
            s.laserBodies.delete(id);
        }
    }
    // Step physics
    s.world.step(BB_DT, 8, 3);
    s.tick++;
    // Paddle hit angle adjust
    if (s.pendPaddle !== null) {
        const ball = s.balls.get(s.pendPaddle);
        if (ball) {
            const vel = ball.getLinearVelocity();
            const sp = vel.length();
            if (sp > 0.5) {
                const bx = ball.getPosition().x;
                const pxl = s.paddle.getPosition().x;
                const off = bbClamp((bx - pxl) / hw, -1, 1);
                const ang = off * BB_MAX_BOUNCE_ANGLE;
                const es = bbGetBallSpeed(s);
                ball.setLinearVelocity(bbVec2(Math.sin(ang) * es, Math.abs(Math.cos(ang)) * es));
            }
        }
        s.pendPaddle = null;
    }
    // Shield
    if (s.pendShield && s.shieldBody) {
        s.world.destroyBody(s.shieldBody);
        s.shieldBody = null;
        s.pendShield = false;
    }
    // Bricks
    const destroyed = new Set();
    for (const h of s.pendBrick) {
        if (destroyed.has(h.key))
            continue;
        const br = s.bricks.get(h.key);
        if (!br)
            continue;
        br.hp--;
        if (br.hp <= 0)
            bbDestroyBrick(s, h.key, destroyed);
    }
    s.pendBrick = [];
    // Laser hits
    for (const lh of s.pendLaser) {
        const br = s.bricks.get(lh.bkey);
        if (br && !destroyed.has(lh.bkey)) {
            br.hp--;
            if (br.hp <= 0) {
                bbDestroyBrick(s, lh.bkey, destroyed);
                s.laserKills++;
            }
        }
        const la = s.laserBodies.get(lh.lid);
        if (la) {
            s.world.destroyBody(la);
            s.laserBodies.delete(lh.lid);
        }
    }
    s.pendLaser = [];
    // Ball loss
    const lost = new Set(s.pendBallLoss);
    for (const id of lost) {
        const b = s.balls.get(id);
        if (b) {
            s.world.destroyBody(b);
            s.balls.delete(id);
        }
    }
    s.pendBallLoss = [];
    if (lost.size > 0 && s.balls.size === 0) {
        s.lives--;
        s.combo = 0;
        s.missedThisLevel = true;
        if (s.lives <= 0) {
            s.runOver = true;
        }
        else
            bbResetServe(s);
    }
    // Powerup collect
    for (const pc of s.pendPuCollect) {
        const pu = s.powerupBodies.get(pc.id);
        if (pu) {
            if (pc.byPaddle)
                bbApplyPowerup(s, pu.kind);
            s.world.destroyBody(pu.body);
            s.powerupBodies.delete(pc.id);
        }
    }
    s.pendPuCollect = [];
    // Expire powerups
    for (const [k, ex] of s.activePowerups) {
        if (s.tick >= ex) {
            s.activePowerups.delete(k);
            if (k === "expand" || k === "shrink") {
                const of2 = s.paddle.getFixtureList();
                if (of2)
                    s.paddle.destroyFixture(of2);
                s.paddle.createFixture({
                    shape: new planck.Box(bbGetPaddleHW(s), BB_PADDLE_HH),
                    friction: 0,
                    restitution: 1,
                });
            }
        }
    }
    // Enforce ball speed
    const es = bbGetBallSpeed(s);
    for (const [, ball] of s.balls) {
        const vel = ball.getLinearVelocity();
        const sp = vel.length();
        if (sp > 0.5 && Math.abs(sp - es) > 0.1) {
            const sc = es / sp;
            ball.setLinearVelocity(bbVec2(vel.x * sc, vel.y * sc));
        }
        if (sp > 0.5 && Math.abs(vel.y) < es * 0.15) {
            const sg = vel.y >= 0 ? 1 : -1;
            const my = es * 0.15;
            ball.setLinearVelocity(bbVec2(Math.sign(vel.x) * Math.sqrt(es * es - my * my), sg * my));
        }
    }
    // Remove OOB powerups
    for (const [id, pu] of s.powerupBodies) {
        if (pu.body.getPosition().y < -1) {
            s.world.destroyBody(pu.body);
            s.powerupBodies.delete(id);
        }
    }
    // Level clear
    if (s.breakableRemaining <= 0 && !s.levelCleared)
        s.levelCleared = true;
}
function bbReplay(seed, startLvl, endLvl, inputHz, samples) {
    const ticksPer = Math.round(60 / inputHz);
    let lives = BB_DEFAULT_LIVES;
    let score = 0, combo = 0, maxCombo = 0, bricksDestroyed = 0, powerupsUsed = 0;
    let explosionKills = 0, laserKills = 0, maxBallsAtOnce = 1, levelsCleared = 0;
    const noMiss = [];
    let gTick = 0, sIdx = 0;
    const maxTicks = 60 * 60 * 60;
    function findInput(t) {
        while (sIdx + 1 < samples.length && samples[sIdx + 1].tick <= t)
            sIdx++;
        if (sIdx < samples.length && samples[sIdx].tick <= t)
            return samples[sIdx];
        return { x: 0.5 };
    }
    for (let lvl = startLvl; lvl <= endLvl; lvl++) {
        const ld = BB_LEVELS.find((l) => l.id === lvl);
        if (!ld)
            break;
        const s = bbCreateSim(ld, seed, lives, {
            score,
            combo,
            maxCombo,
            bricksDestroyed,
            powerupsUsed,
            explosionKills,
            laserKills,
            maxBallsAtOnce,
        });
        let ltk = 0;
        while (!s.levelCleared &&
            !s.runOver &&
            ltk < 60 * 60 * 5 &&
            gTick < maxTicks) {
            const inp = findInput(gTick);
            bbStep(s, inp.x, inp.a);
            gTick++;
            ltk++;
        }
        score = s.score;
        combo = s.combo;
        maxCombo = s.maxCombo;
        bricksDestroyed = s.bricksDestroyed;
        powerupsUsed = s.powerupsUsed;
        explosionKills = s.explosionKills;
        laserKills = s.laserKills;
        maxBallsAtOnce = s.maxBallsAtOnce;
        lives = s.lives;
        if (s.levelCleared) {
            levelsCleared++;
            const tb = Math.max(0, 3000 - ltk);
            const lb = lives * 500;
            score += 1000 * lvl + tb + lb;
            if (!s.missedThisLevel)
                noMiss.push(lvl);
        }
        if (s.runOver) {
            lives = 0;
            break;
        }
    }
    return {
        score,
        maxCombo,
        bricksDestroyed,
        powerupsUsed,
        levelsCleared,
        durationMs: Math.round((gTick / 60) * 1000),
        livesRemaining: lives,
        explosionBrickKills: explosionKills,
        laserBrickKills: laserKills,
        maxBallsAtOnce,
        noMissLevels: noMiss,
    };
}
// ── Register Adapter ─────────────────────────────────────────────────
registerAdapter({
    gameId: "brick_breaker",
    runtimeType: "solo",
    maxPlayers: 1,
    minPlayers: 1,
    defaultSettings: { aimGuide: true, haptics: true, sound: true },
    createInitialPublicState() {
        const st = {
            phase: "idle",
            campaign: {
                currentLevelId: 1,
                maxLevel: BB_MAX_LEVEL,
                seed: 0,
                lives: BB_DEFAULT_LIVES,
                score: 0,
                combo: 0,
                maxCombo: 0,
                bricksDestroyed: 0,
                powerupsUsed: 0,
                levelsCleared: 0,
                startedAtMs: 0,
                finishedAtMs: null,
                durationMs: null,
            },
        };
        return st;
    },
    validateMove(publicState, _priv, movePayload, ctx) {
        const state = publicState;
        const moveType = movePayload.type;
        if (moveType === "startRun") {
            const seed = movePayload.seed || Date.now();
            const startLevel = movePayload.startLevelId || 1;
            const ns = {
                phase: "running",
                campaign: {
                    currentLevelId: startLevel,
                    maxLevel: BB_MAX_LEVEL,
                    seed,
                    lives: BB_DEFAULT_LIVES,
                    score: 0,
                    combo: 0,
                    maxCombo: 0,
                    bricksDestroyed: 0,
                    powerupsUsed: 0,
                    levelsCleared: 0,
                    startedAtMs: Date.now(),
                    finishedAtMs: null,
                    durationMs: null,
                },
            };
            return {
                ok: true,
                nextPublicState: ns,
                turnAdvance: false,
            };
        }
        if (moveType === "finishRun") {
            const seed = movePayload.seed;
            const startLevelId = movePayload.startLevelId || 1;
            const endLevelId = movePayload.endLevelId || BB_MAX_LEVEL;
            const inputHz = movePayload.inputHz || 15;
            const inputSamples = movePayload.inputSamples || [];
            // Server-authoritative replay
            let authStats;
            try {
                authStats = bbReplay(seed, startLevelId, endLevelId, inputHz, inputSamples);
            }
            catch (err) {
                console.error("[brick_breaker] Replay failed:", err, `seed=${seed}, startLvl=${startLevelId}, endLvl=${endLevelId}, inputHz=${inputHz}, samplesLen=${inputSamples.length}`);
                return { ok: false, error: "Server replay failed." };
            }
            const now = Date.now();
            const ns = {
                phase: "finished",
                campaign: {
                    currentLevelId: startLevelId + authStats.levelsCleared,
                    maxLevel: BB_MAX_LEVEL,
                    seed,
                    lives: authStats.livesRemaining,
                    score: authStats.score,
                    combo: 0,
                    maxCombo: authStats.maxCombo,
                    bricksDestroyed: authStats.bricksDestroyed,
                    powerupsUsed: authStats.powerupsUsed,
                    levelsCleared: authStats.levelsCleared,
                    startedAtMs: state.campaign?.startedAtMs || now,
                    finishedAtMs: now,
                    durationMs: authStats.durationMs,
                },
                integrity: { replayVerified: true, verifierVersion: 1 },
            };
            return {
                ok: true,
                nextPublicState: ns,
                scoreDelta: [{ uid: ctx.uid, delta: authStats.score }],
                turnAdvance: false,
                terminal: {
                    type: authStats.levelsCleared >= endLevelId - startLevelId + 1
                        ? "win"
                        : "timeout",
                    winnerIds: [ctx.uid],
                    reason: authStats.levelsCleared >= endLevelId - startLevelId + 1
                        ? "Campaign complete!"
                        : `Reached level ${startLevelId + authStats.levelsCleared}`,
                },
            };
        }
        return { ok: false, error: `Unknown move: ${moveType}` };
    },
    computeOutcome(publicState, players) {
        const st = publicState;
        const uid = players[0]?.uid ?? "";
        const c = st.campaign;
        return {
            winnerIds: [uid],
            finalScoreboard: [
                {
                    uid,
                    score: c?.score ?? 0,
                    placement: 1,
                    stats: {
                        levelsCleared: c?.levelsCleared ?? 0,
                        durationMs: c?.durationMs ?? 0,
                        maxCombo: c?.maxCombo ?? 0,
                        bricksDestroyed: c?.bricksDestroyed ?? 0,
                        powerupsUsed: c?.powerupsUsed ?? 0,
                    },
                },
            ],
        };
    },
    extractPerformanceMetrics(publicState) {
        const st = publicState;
        const c = st.campaign;
        return {
            score: c?.score ?? 0,
            levelsCleared: c?.levelsCleared ?? 0,
            durationMs: c?.durationMs ?? 0,
            maxCombo: c?.maxCombo ?? 0,
            bricksDestroyed: c?.bricksDestroyed ?? 0,
            powerupsUsed: c?.powerupsUsed ?? 0,
            lives: c?.lives ?? 0,
        };
    },
});
const CE_ALL_COLORS = ["red", "blue", "green", "yellow"];
const CE_DEFAULT_SETTINGS = {
    stackDraw2: false,
    stackDraw4: false,
    stackingMode: "same_only",
    forcePlay: true,
    drawMode: "draw_one_then_pass",
    sevenZeroRule: false,
    jumpIn: false,
    wildDraw4Challenge: true,
    turnTimer: "off",
    roundModel: "single_hand",
    targetPoints: 500,
};
function ceCreateDeck() {
    const cards = [];
    for (const color of CE_ALL_COLORS) {
        cards.push({ id: `${color}_0_0`, color, type: "number", value: 0 });
        for (let v = 1; v <= 9; v++) {
            for (let c = 0; c < 2; c++) {
                cards.push({
                    id: `${color}_${v}_${c}`,
                    color,
                    type: "number",
                    value: v,
                });
            }
        }
        for (const at of ["skip", "reverse", "draw_two"]) {
            for (let c = 0; c < 2; c++) {
                cards.push({ id: `${color}_${at}_${c}`, color, type: at, value: null });
            }
        }
    }
    for (let i = 0; i < 4; i++)
        cards.push({ id: `wild_${i}`, color: null, type: "wild", value: null });
    for (let i = 0; i < 4; i++)
        cards.push({
            id: `wild_draw_four_${i}`,
            color: null,
            type: "wild_draw_four",
            value: null,
        });
    return cards;
}
function ceShuffle(cards) {
    const a = [...cards];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function ceBuildLookup(cards) {
    const m = {};
    for (const c of cards)
        m[c.id] = c;
    return m;
}
function ceIsPlayable(card, color, top) {
    if (card.type === "wild" || card.type === "wild_draw_four")
        return true;
    if (card.color === color)
        return true;
    if (card.type === "number" &&
        top.type === "number" &&
        card.value === top.value)
        return true;
    if (card.type !== "number" && card.type === top.type)
        return true;
    return false;
}
function ceCouldPlayOther(hand, color, top) {
    return hand.some((c) => c.type !== "wild" &&
        c.type !== "wild_draw_four" &&
        (c.color === color ||
            (c.type === "number" &&
                top.type === "number" &&
                c.value === top.value) ||
            (c.type !== "number" && c.type === top.type)));
}
function ceNextTurn(idx, dir, count, skip = 1) {
    return (((idx + dir * skip) % count) + count) % count;
}
function ceDrawCards(n, drawPile, discardPile, lookup) {
    let dp = [...drawPile];
    let disc = [...discardPile];
    const drawn = [];
    for (let i = 0; i < n; i++) {
        if (dp.length === 0 && disc.length > 1) {
            const topId = disc[disc.length - 1];
            const reshuf = disc.slice(0, -1);
            for (let j = reshuf.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [reshuf[j], reshuf[k]] = [reshuf[k], reshuf[j]];
            }
            dp = [...dp, ...reshuf];
            disc = [topId];
        }
        if (dp.length === 0)
            break;
        const cid = dp.pop();
        if (lookup[cid])
            drawn.push(lookup[cid]);
    }
    return { drawn, drawPile: dp, discardPile: disc };
}
function ceCardPoints(c) {
    if (c.type === "number")
        return c.value ?? 0;
    if (c.type === "wild" || c.type === "wild_draw_four")
        return 50;
    return 20;
}
function ceMergeSettings(p) {
    const d = CE_DEFAULT_SETTINGS;
    return {
        stackDraw2: typeof p.stackDraw2 === "boolean" ? p.stackDraw2 : d.stackDraw2,
        stackDraw4: typeof p.stackDraw4 === "boolean" ? p.stackDraw4 : d.stackDraw4,
        stackingMode: ["same_only", "draws_mix"].includes(p.stackingMode)
            ? p.stackingMode
            : d.stackingMode,
        forcePlay: typeof p.forcePlay === "boolean" ? p.forcePlay : d.forcePlay,
        drawMode: ["draw_one_then_pass", "draw_until_playable"].includes(p.drawMode)
            ? p.drawMode
            : d.drawMode,
        sevenZeroRule: typeof p.sevenZeroRule === "boolean" ? p.sevenZeroRule : d.sevenZeroRule,
        jumpIn: false,
        wildDraw4Challenge: typeof p.wildDraw4Challenge === "boolean"
            ? p.wildDraw4Challenge
            : d.wildDraw4Challenge,
        turnTimer: ["off", "20s", "30s", "45s"].includes(p.turnTimer)
            ? p.turnTimer
            : d.turnTimer,
        roundModel: ["single_hand", "match_points"].includes(p.roundModel)
            ? p.roundModel
            : d.roundModel,
        targetPoints: typeof p.targetPoints === "number" &&
            p.targetPoints >= 100 &&
            p.targetPoints <= 1000
            ? p.targetPoints
            : d.targetPoints,
    };
}
function ceCanStack(card, pending, settings) {
    if (pending.source === "D2") {
        if (card.type === "draw_two" && settings.stackDraw2)
            return true;
        if (card.type === "wild_draw_four" &&
            settings.stackingMode === "draws_mix" &&
            settings.stackDraw4)
            return true;
    }
    if (pending.source === "D4") {
        if (card.type === "wild_draw_four" && settings.stackDraw4)
            return true;
        if (card.type === "draw_two" &&
            settings.stackingMode === "draws_mix" &&
            settings.stackDraw2)
            return true;
    }
    return false;
}
// Temporary cache to share dealt hands between createInitialPublicState and
// createInitialPrivateState, which are called sequentially in the same pipeline.
let _ceLastDealCache = null;
registerAdapter({
    gameId: "crazy_eights",
    runtimeType: "turnBased",
    maxPlayers: 6,
    minPlayers: 2,
    defaultSettings: CE_DEFAULT_SETTINGS,
    createInitialPublicState(players, settings) {
        const s = ceMergeSettings(settings);
        const turnOrder = players
            .sort((a, b) => a.slotIndex - b.slotIndex)
            .map((p) => p.uid);
        const deck = ceShuffle(ceCreateDeck());
        const lookup = ceBuildLookup(deck);
        const hands = {};
        const remaining = [...deck];
        for (const uid of turnOrder)
            hands[uid] = remaining.splice(0, 7);
        let topIdx = remaining.findIndex((c) => c.type === "number");
        if (topIdx === -1)
            topIdx = remaining.findIndex((c) => c.type !== "wild" && c.type !== "wild_draw_four");
        if (topIdx === -1)
            topIdx = 0;
        const topDiscard = remaining.splice(topIdx, 1)[0];
        const hc = {};
        const sc = {};
        const cc = {};
        for (const uid of turnOrder) {
            hc[uid] = 7;
            sc[uid] = 0;
            cc[uid] = false;
        }
        // Cache dealt hands for createInitialPrivateState
        _ceLastDealCache = { hands };
        return {
            phase: "playing",
            turnOrder,
            currentTurnIndex: 0,
            currentTurnUid: turnOrder[0],
            direction: 1,
            topDiscard,
            currentColor: topDiscard.color,
            drawPileCount: remaining.length,
            discardCount: 1,
            handCounts: hc,
            pendingDraw: { count: 0, source: null },
            callEligibleUid: null,
            calledCrazy: cc,
            turnCounter: 0,
            moveCount: 0,
            lastMove: null,
            challengeWindow: null,
            scores: sc,
            roundNumber: 1,
            settings: s,
            resolved: null,
            drawPile: remaining.map((c) => c.id),
            discardPile: [topDiscard.id],
            cardLookup: lookup,
        };
    },
    createInitialPrivateState(players, _settings) {
        const turnOrder = players
            .sort((a, b) => a.slotIndex - b.slotIndex)
            .map((p) => p.uid);
        // Use the cached hands from createInitialPublicState (called first in pipeline)
        const cache = _ceLastDealCache;
        _ceLastDealCache = null; // Consume cache
        if (!cache) {
            throw new Error("CE: createInitialPrivateState called before createInitialPublicState");
        }
        const result = {};
        for (const uid of turnOrder) {
            result[uid] = { hand: cache.hands[uid] ?? [], hasDrawnThisTurn: false };
        }
        return result;
    },
    validateMove(publicState, privateStateByPlayer, movePayload, ctx) {
        const state = publicState;
        const privMap = privateStateByPlayer;
        const payload = movePayload;
        const { uid } = ctx;
        const settings = state.settings;
        const priv = privMap[uid];
        const pc = state.turnOrder.length;
        if (state.phase !== "playing")
            return { ok: false, error: "Game not playing." };
        if (state.currentTurnUid !== uid)
            return { ok: false, error: "Not your turn." };
        switch (payload.action) {
            case "CHALLENGE_WILD4": {
                if (!state.challengeWindow?.active ||
                    state.challengeWindow.targetUid !== uid)
                    return { ok: false, error: "No challenge window." };
                if (!settings.wildDraw4Challenge)
                    return { ok: false, error: "Challenges disabled." };
                const w4uid = state.challengeWindow.wild4PlayerUid;
                const couldPlay = state.challengeWindow.couldHavePlayedOtherColor;
                let ns = { ...state };
                let npm = { ...privMap };
                if (payload.challengeAction === "challenge") {
                    if (couldPlay) {
                        const w4p = { ...npm[w4uid] };
                        const dr = ceDrawCards(4, [...state.drawPile], [...state.discardPile], state.cardLookup);
                        w4p.hand = [...w4p.hand, ...dr.drawn];
                        npm[w4uid] = w4p;
                        ns = {
                            ...ns,
                            drawPile: dr.drawPile,
                            discardPile: dr.discardPile,
                            drawPileCount: dr.drawPile.length,
                            discardCount: dr.discardPile.length,
                            handCounts: { ...ns.handCounts, [w4uid]: w4p.hand.length },
                            pendingDraw: { count: 0, source: null },
                            challengeWindow: null,
                            lastMove: {
                                actor: uid,
                                action: "CHALLENGE_WILD4",
                                detail: "Succeeded! Opponent drew 4",
                            },
                            moveCount: state.moveCount + 1,
                        };
                        return {
                            ok: true,
                            nextPublicState: ns,
                            nextPrivateState: npm,
                            turnAdvance: false,
                        };
                    }
                    else {
                        const cp = { ...npm[uid] };
                        const dr = ceDrawCards(6, [...state.drawPile], [...state.discardPile], state.cardLookup);
                        cp.hand = [...cp.hand, ...dr.drawn];
                        npm[uid] = cp;
                        const ni = ceNextTurn(state.currentTurnIndex, state.direction, pc);
                        ns = {
                            ...ns,
                            drawPile: dr.drawPile,
                            discardPile: dr.discardPile,
                            drawPileCount: dr.drawPile.length,
                            discardCount: dr.discardPile.length,
                            handCounts: { ...ns.handCounts, [uid]: cp.hand.length },
                            pendingDraw: { count: 0, source: null },
                            challengeWindow: null,
                            currentTurnIndex: ni,
                            currentTurnUid: state.turnOrder[ni],
                            turnCounter: state.turnCounter + 1,
                            lastMove: {
                                actor: uid,
                                action: "CHALLENGE_WILD4",
                                detail: "Failed! Drew 6",
                            },
                            moveCount: state.moveCount + 1,
                        };
                        return {
                            ok: true,
                            nextPublicState: ns,
                            nextPrivateState: npm,
                            turnAdvance: false,
                            nextTurnPlayerId: state.turnOrder[ni],
                        };
                    }
                }
                else {
                    const ap = { ...npm[uid] };
                    const dr = ceDrawCards(state.pendingDraw.count, [...state.drawPile], [...state.discardPile], state.cardLookup);
                    ap.hand = [...ap.hand, ...dr.drawn];
                    npm[uid] = ap;
                    const ni = ceNextTurn(state.currentTurnIndex, state.direction, pc);
                    ns = {
                        ...ns,
                        drawPile: dr.drawPile,
                        discardPile: dr.discardPile,
                        drawPileCount: dr.drawPile.length,
                        discardCount: dr.discardPile.length,
                        handCounts: { ...ns.handCounts, [uid]: ap.hand.length },
                        pendingDraw: { count: 0, source: null },
                        challengeWindow: null,
                        currentTurnIndex: ni,
                        currentTurnUid: state.turnOrder[ni],
                        turnCounter: state.turnCounter + 1,
                        lastMove: {
                            actor: uid,
                            action: "CHALLENGE_WILD4",
                            detail: `Accepted, drew ${state.pendingDraw.count}`,
                        },
                        moveCount: state.moveCount + 1,
                    };
                    return {
                        ok: true,
                        nextPublicState: ns,
                        nextPrivateState: npm,
                        turnAdvance: false,
                        nextTurnPlayerId: state.turnOrder[ni],
                    };
                }
            }
            case "CATCH_NO_CRAZY": {
                const tid = payload.targetUid;
                if (!tid || !state.callEligibleUid || state.callEligibleUid !== tid)
                    return { ok: false, error: "No eligible catch." };
                if (state.calledCrazy[tid])
                    return { ok: false, error: "Already called." };
                const tp = { ...privMap[tid] };
                const dr = ceDrawCards(2, [...state.drawPile], [...state.discardPile], state.cardLookup);
                tp.hand = [...tp.hand, ...dr.drawn];
                const npm2 = { ...privMap, [tid]: tp };
                const ns2 = {
                    ...state,
                    drawPile: dr.drawPile,
                    discardPile: dr.discardPile,
                    drawPileCount: dr.drawPile.length,
                    discardCount: dr.discardPile.length,
                    handCounts: { ...state.handCounts, [tid]: tp.hand.length },
                    callEligibleUid: null,
                    lastMove: {
                        actor: uid,
                        action: "CATCH_NO_CRAZY",
                        detail: `Caught ${tid}`,
                    },
                    moveCount: state.moveCount + 1,
                };
                return {
                    ok: true,
                    nextPublicState: ns2,
                    nextPrivateState: npm2,
                    turnAdvance: false,
                };
            }
            case "CALL_CRAZY": {
                if (state.callEligibleUid !== uid)
                    return { ok: false, error: "Not eligible." };
                if (state.calledCrazy[uid])
                    return { ok: false, error: "Already called." };
                const ns3 = {
                    ...state,
                    calledCrazy: { ...state.calledCrazy, [uid]: true },
                    lastMove: { actor: uid, action: "CALL_CRAZY", detail: "CRAZY!" },
                    moveCount: state.moveCount + 1,
                };
                return {
                    ok: true,
                    nextPublicState: ns3,
                    turnAdvance: false,
                };
            }
            case "DRAW_CARD": {
                if (state.challengeWindow?.active &&
                    state.challengeWindow.targetUid === uid)
                    return { ok: false, error: "Resolve challenge first." };
                if (state.pendingDraw.count > 0) {
                    const dc = state.pendingDraw.count;
                    const dr = ceDrawCards(dc, [...state.drawPile], [...state.discardPile], state.cardLookup);
                    const mp = {
                        ...priv,
                        hand: [...priv.hand, ...dr.drawn],
                        hasDrawnThisTurn: true,
                    };
                    const ni = ceNextTurn(state.currentTurnIndex, state.direction, pc);
                    const ns = {
                        ...state,
                        drawPile: dr.drawPile,
                        discardPile: dr.discardPile,
                        drawPileCount: dr.drawPile.length,
                        discardCount: dr.discardPile.length,
                        handCounts: { ...state.handCounts, [uid]: mp.hand.length },
                        pendingDraw: { count: 0, source: null },
                        currentTurnIndex: ni,
                        currentTurnUid: state.turnOrder[ni],
                        turnCounter: state.turnCounter + 1,
                        callEligibleUid: null,
                        lastMove: {
                            actor: uid,
                            action: "DRAW_CARD",
                            detail: `Drew ${dc} from stack`,
                        },
                        moveCount: state.moveCount + 1,
                    };
                    return {
                        ok: true,
                        nextPublicState: ns,
                        nextPrivateState: { ...privMap, [uid]: mp },
                        turnAdvance: false,
                        nextTurnPlayerId: state.turnOrder[ni],
                    };
                }
                if (priv?.hasDrawnThisTurn &&
                    settings.drawMode === "draw_one_then_pass")
                    return { ok: false, error: "Already drew." };
                const dr = ceDrawCards(1, [...state.drawPile], [...state.discardPile], state.cardLookup);
                if (dr.drawn.length === 0)
                    return { ok: false, error: "No cards." };
                const mp = {
                    ...priv,
                    hand: [...(priv?.hand ?? []), ...dr.drawn],
                    hasDrawnThisTurn: true,
                };
                const ns = {
                    ...state,
                    drawPile: dr.drawPile,
                    discardPile: dr.discardPile,
                    drawPileCount: dr.drawPile.length,
                    discardCount: dr.discardPile.length,
                    handCounts: { ...state.handCounts, [uid]: mp.hand.length },
                    lastMove: { actor: uid, action: "DRAW_CARD", detail: "Drew 1" },
                    moveCount: state.moveCount + 1,
                };
                return {
                    ok: true,
                    nextPublicState: ns,
                    nextPrivateState: { ...privMap, [uid]: mp },
                    turnAdvance: false,
                };
            }
            case "PASS": {
                if (!priv?.hasDrawnThisTurn)
                    return { ok: false, error: "Must draw first." };
                const ni = ceNextTurn(state.currentTurnIndex, state.direction, pc);
                const rp = { ...priv, hasDrawnThisTurn: false };
                const ns = {
                    ...state,
                    currentTurnIndex: ni,
                    currentTurnUid: state.turnOrder[ni],
                    turnCounter: state.turnCounter + 1,
                    callEligibleUid: null,
                    lastMove: { actor: uid, action: "PASS", detail: "Passed" },
                    moveCount: state.moveCount + 1,
                };
                return {
                    ok: true,
                    nextPublicState: ns,
                    nextPrivateState: { ...privMap, [uid]: rp },
                    turnAdvance: false,
                    nextTurnPlayerId: state.turnOrder[ni],
                };
            }
            case "PLAY_CARD": {
                const { cardId, declaredColor, callCrazy, swapTargetUid } = payload;
                if (!cardId)
                    return { ok: false, error: "No cardId." };
                if (state.challengeWindow?.active &&
                    state.challengeWindow.targetUid === uid)
                    return { ok: false, error: "Resolve challenge first." };
                if (!priv)
                    return { ok: false, error: "No private state." };
                const card = priv.hand.find((c) => c.id === cardId);
                if (!card)
                    return { ok: false, error: "Card not in hand." };
                if (state.pendingDraw.count > 0 &&
                    !ceCanStack(card, state.pendingDraw, settings))
                    return { ok: false, error: "Must draw or stack." };
                if (state.pendingDraw.count === 0 &&
                    !ceIsPlayable(card, state.currentColor, state.topDiscard))
                    return { ok: false, error: "Not playable." };
                if ((card.type === "wild" || card.type === "wild_draw_four") &&
                    !declaredColor)
                    return { ok: false, error: "Declare color." };
                if (declaredColor && !CE_ALL_COLORS.includes(declaredColor))
                    return { ok: false, error: "Invalid color." };
                const newHand = priv.hand.filter((c) => c.id !== cardId);
                let npm = {
                    ...privMap,
                    [uid]: { ...priv, hand: newHand, hasDrawnThisTurn: false },
                };
                const newDiscard = [...state.discardPile, cardId];
                const nc = declaredColor ?? card.color ?? state.currentColor;
                let dir = state.direction;
                let skip = 1;
                let pd = { ...state.pendingDraw };
                let cw = null;
                if (card.type === "reverse") {
                    if (pc === 2)
                        skip = 2;
                    else
                        dir = (dir === 1 ? -1 : 1);
                }
                if (card.type === "skip")
                    skip = 2;
                if (card.type === "draw_two") {
                    pd = {
                        count: (settings.stackDraw2 ? pd.count : 0) + 2,
                        source: "D2",
                    };
                }
                if (card.type === "wild_draw_four") {
                    const cp = ceCouldPlayOther(priv.hand, state.currentColor, state.topDiscard);
                    pd = {
                        count: (settings.stackDraw4 ? pd.count : 0) + 4,
                        source: "D4",
                    };
                    if (settings.wildDraw4Challenge)
                        cw = {
                            active: true,
                            wild4PlayerUid: uid,
                            targetUid: "",
                            couldHavePlayedOtherColor: cp,
                        };
                }
                // Seven-Zero
                if (settings.sevenZeroRule && card.type === "number") {
                    if (card.value === 7 && swapTargetUid) {
                        const ah = [...(npm[uid]?.hand ?? [])];
                        const th = [...(npm[swapTargetUid]?.hand ?? [])];
                        npm[uid] = { ...npm[uid], hand: th };
                        npm[swapTargetUid] = { ...npm[swapTargetUid], hand: ah };
                    }
                    else if (card.value === 0) {
                        const handsCopy = {};
                        for (const u of state.turnOrder)
                            handsCopy[u] = [...(npm[u]?.hand ?? [])];
                        for (let i = 0; i < pc; i++) {
                            const fi = (((i - dir) % pc) + pc) % pc;
                            npm[state.turnOrder[i]] = {
                                ...npm[state.turnOrder[i]],
                                hand: handsCopy[state.turnOrder[fi]],
                            };
                        }
                    }
                }
                const nhc = {};
                for (const u of state.turnOrder)
                    nhc[u] = npm[u]?.hand?.length ?? state.handCounts[u];
                // Win check
                if (newHand.length === 0) {
                    const rs = {};
                    let total = 0;
                    for (const u of state.turnOrder) {
                        const pts = (npm[u]?.hand ?? []).reduce((s, c) => s + ceCardPoints(c), 0);
                        rs[u] = -pts;
                        if (u !== uid)
                            total += pts;
                    }
                    rs[uid] = total;
                    const nsc = { ...state.scores };
                    for (const u of state.turnOrder)
                        nsc[u] = (nsc[u] ?? 0) + (rs[u] ?? 0);
                    const isMatchEnd = settings.roundModel === "match_points" &&
                        nsc[uid] >= settings.targetPoints;
                    const phase = isMatchEnd ? "match_over" : "round_over";
                    const ns = {
                        ...state,
                        phase,
                        topDiscard: card,
                        currentColor: nc,
                        direction: dir,
                        discardPile: newDiscard,
                        discardCount: newDiscard.length,
                        handCounts: nhc,
                        pendingDraw: { count: 0, source: null },
                        callEligibleUid: null,
                        scores: nsc,
                        lastMove: { actor: uid, action: "PLAY_CARD", detail: "Wins!" },
                        moveCount: state.moveCount + 1,
                        resolved: {
                            winnerUid: uid,
                            reason: "hand_empty",
                            roundScores: rs,
                            matchWinner: isMatchEnd ? uid : undefined,
                        },
                    };
                    return {
                        ok: true,
                        nextPublicState: ns,
                        nextPrivateState: npm,
                        turnAdvance: false,
                        terminal: {
                            type: "win",
                            winnerIds: [uid],
                            reason: isMatchEnd ? "match_points_reached" : "hand_empty",
                        },
                    };
                }
                let ceUid = state.callEligibleUid;
                let cc = { ...state.calledCrazy };
                if (ceUid && ceUid !== uid)
                    ceUid = null;
                if (newHand.length === 1) {
                    ceUid = uid;
                    cc[uid] = !!callCrazy;
                }
                else if (ceUid === uid) {
                    ceUid = null;
                }
                const ni = ceNextTurn(state.currentTurnIndex, dir, pc, skip);
                if (cw)
                    cw.targetUid = state.turnOrder[ni];
                const ns = {
                    ...state,
                    topDiscard: card,
                    currentColor: nc,
                    direction: dir,
                    drawPileCount: state.drawPile.length,
                    discardPile: newDiscard,
                    discardCount: newDiscard.length,
                    handCounts: nhc,
                    pendingDraw: pd,
                    callEligibleUid: ceUid,
                    calledCrazy: cc,
                    challengeWindow: cw,
                    currentTurnIndex: ni,
                    currentTurnUid: state.turnOrder[ni],
                    turnCounter: state.turnCounter + 1,
                    lastMove: { actor: uid, action: "PLAY_CARD" },
                    moveCount: state.moveCount + 1,
                };
                return {
                    ok: true,
                    nextPublicState: ns,
                    nextPrivateState: npm,
                    turnAdvance: false,
                    nextTurnPlayerId: state.turnOrder[ni],
                };
            }
            default:
                return { ok: false, error: `Unknown action: ${payload.action}` };
        }
    },
    computeOutcome(publicState, players) {
        const state = publicState;
        const wu = state.resolved?.winnerUid;
        if (wu) {
            const rs = state.resolved?.roundScores ?? {};
            const sorted = players
                .map((p) => ({ ...p, score: rs[p.uid] ?? 0 }))
                .sort((a, b) => b.score - a.score);
            return {
                winnerIds: [wu],
                finalScoreboard: sorted.map((p, i) => ({
                    uid: p.uid,
                    score: p.score,
                    placement: p.uid === wu ? 1 : i + 1,
                    stats: {
                        handCount: state.handCounts[p.uid] ?? 0,
                        matchScore: state.scores[p.uid] ?? 0,
                    },
                })),
            };
        }
        return {
            winnerIds: [],
            finalScoreboard: players.map((p, i) => ({
                uid: p.uid,
                score: 0,
                placement: i + 1,
                stats: {},
            })),
        };
    },
    extractPerformanceMetrics(publicState) {
        const s = publicState;
        return {
            totalMoves: s.moveCount,
            turnCounter: s.turnCounter,
            roundNumber: s.roundNumber,
            scores: s.scores,
            phase: s.phase,
        };
    },
    validateSettings(patch) {
        return ceMergeSettings(patch);
    },
});
// =============================================================================
// 🏌️ MINIGOLF DUELS
// =============================================================================
// Server adapter operates on plain Record<string, unknown> to avoid type
// duplication friction. The canonical types live on the client; here we only
// need structural correctness for Firestore storage.
const courses_1 = require("./minigolf/courses");
const quantize_1 = require("./minigolf/quantize");
const sim_1 = require("./minigolf/sim");
const MG_DEFAULT_SETTINGS = {
    coursePackId: "pigeon_classic",
    holeCount: 9,
    maxStrokesPerHole: 10,
    allowPickups: true,
    assistGhostLine: false,
};
function mgMergeSettings(patch) {
    const s = { ...MG_DEFAULT_SETTINGS };
    if (patch.coursePackId === "pigeon_classic")
        s.coursePackId = "pigeon_classic";
    if (typeof patch.holeCount === "number" &&
        [3, 5, 9, 18].includes(patch.holeCount))
        s.holeCount = patch.holeCount;
    if (typeof patch.maxStrokesPerHole === "number")
        s.maxStrokesPerHole = Math.max(5, Math.min(15, Math.round(patch.maxStrokesPerHole)));
    if (typeof patch.allowPickups === "boolean")
        s.allowPickups = patch.allowPickups;
    if (typeof patch.assistGhostLine === "boolean")
        s.assistGhostLine = patch.assistGhostLine;
    return s;
}
function mgComputeOutcome(state, players) {
    const entries = players.map((p) => ({
        uid: p.uid,
        slotIndex: p.slotIndex,
        totalStrokes: (state.strokesTotalByUid?.[p.uid] ?? 0),
    }));
    entries.sort((a, b) => a.totalStrokes - b.totalStrokes);
    let placement = 1;
    const scoreboard = [];
    for (let i = 0; i < entries.length; i++) {
        if (i > 0 && entries[i].totalStrokes !== entries[i - 1].totalStrokes) {
            placement = i + 1;
        }
        scoreboard.push({
            uid: entries[i].uid,
            score: -entries[i].totalStrokes,
            placement,
            stats: {
                totalStrokes: entries[i].totalStrokes,
                holesPlayed: (state.holeIndex ?? 0) + 1,
            },
        });
    }
    const winnerIds = scoreboard
        .filter((e) => e.placement === 1)
        .map((e) => e.uid);
    return { winnerIds, finalScoreboard: scoreboard };
}
registerAdapter({
    gameId: "minigolf_duels",
    runtimeType: "turnBased",
    maxPlayers: 3,
    minPlayers: 2,
    defaultSettings: MG_DEFAULT_SETTINGS,
    createInitialPublicState(players, settingsRaw) {
        const settings = mgMergeSettings(settingsRaw);
        const pack = (0, courses_1.getCoursePack)(settings.coursePackId) ?? courses_1.PIGEON_CLASSIC;
        const holeCount = Math.min(settings.holeCount, pack.holes.length);
        const firstHole = pack.holes[0];
        const uids = players.map((p) => p.uid);
        const ballPosByUid = {};
        const strokesThisHoleByUid = {};
        const strokesTotalByUid = {};
        const ballSunkByUid = {};
        const lastSafePosByUid = {};
        const penaltiesByUid = {};
        const holeScoresByUid = {};
        const holesInOneByUid = {};
        const birdiesByUid = {};
        const lastShotMeta = {};
        for (const uid of uids) {
            ballPosByUid[uid] = { x: firstHole.tee.x, y: firstHole.tee.y };
            lastSafePosByUid[uid] = { x: firstHole.tee.x, y: firstHole.tee.y };
            strokesThisHoleByUid[uid] = 0;
            strokesTotalByUid[uid] = 0;
            ballSunkByUid[uid] = false;
            penaltiesByUid[uid] = 0;
            holeScoresByUid[uid] = {};
            holesInOneByUid[uid] = 0;
            birdiesByUid[uid] = 0;
            lastShotMeta[uid] = {
                wallContact: false,
                bumperContact: false,
                sandContact: false,
                sunk: false,
            };
        }
        return {
            coursePackId: settings.coursePackId,
            holeCount,
            holeIndex: 0,
            holeId: firstHole.id,
            holePar: firstHole.par,
            phase: "aim",
            ballPosByUid,
            strokesThisHoleByUid,
            strokesTotalByUid,
            ballSunkByUid,
            lastSafePosByUid,
            penaltiesByUid,
            holeScoresByUid,
            holesInOneByUid,
            birdiesByUid,
            lastShotMeta,
            events: [],
        };
    },
    validateMove(publicState, _privateState, movePayload, ctx) {
        const state = JSON.parse(JSON.stringify(publicState));
        const move = movePayload;
        const uid = ctx.uid;
        const maxStrokes = ctx.settings.maxStrokesPerHole ||
            state.maxStrokesPerHole ||
            10;
        const pack = (0, courses_1.getCoursePack)(state.coursePackId) ?? courses_1.PIGEON_CLASSIC;
        const currentHole = pack.holes[state.holeIndex];
        if (!currentHole)
            return { ok: false, error: "Invalid hole index" };
        if (state.phase === "finished")
            return { ok: false, error: "Game already finished" };
        if (move.type === "shot") {
            // Phase 1: start rolling — no teleport, no turn advance
            if (state.phase === "rolling")
                return { ok: false, error: "A shot is already in progress" };
            if (state.phase !== "aim")
                return { ok: false, error: "Not in aim phase" };
            if (state.ballSunkByUid[uid])
                return { ok: false, error: "Already sunk this hole" };
            if (!(0, quantize_1.isValidAngleQ)(move.angleQ))
                return { ok: false, error: "Invalid angle" };
            if (!(0, quantize_1.isValidPowerQ)(move.powerQ))
                return { ok: false, error: "Invalid power" };
            const ballPos = state.ballPosByUid[uid];
            if (!ballPos)
                return { ok: false, error: "No ball position" };
            const simResult = (0, sim_1.simulateShot)(currentHole, ballPos, move.angleQ, move.powerQ);
            state.strokesThisHoleByUid[uid] =
                (state.strokesThisHoleByUid[uid] ?? 0) + 1;
            state.strokesTotalByUid[uid] = (state.strokesTotalByUid[uid] ?? 0) + 1;
            // Update last shot meta
            state.lastShotMeta[uid] = {
                wallContact: simResult.wallContact,
                bumperContact: simResult.bumperContact,
                sandContact: simResult.sandContact,
                sunk: simResult.sunk,
            };
            // Push events
            for (const evt of simResult.events) {
                if ((state.events?.length ?? 0) < 20) {
                    state.events = state.events || [];
                    state.events.push({ ...evt, uid });
                }
            }
            // Calculate final position for rolling payload
            let finalPosQ;
            if (simResult.penalty) {
                finalPosQ = { ...state.lastSafePosByUid[uid] };
            }
            else if (simResult.sunk) {
                finalPosQ = { x: currentHole.cup.x, y: currentHole.cup.y };
            }
            else {
                finalPosQ = (0, quantize_1.quantizePos)(simResult.finalPos.x, simResult.finalPos.y);
            }
            const rollDurationMs = Math.round(simResult.totalSteps * (1000 / 60));
            // Set rolling state — ball stays at current position
            state.phase = "rolling";
            state.rolling = {
                shotId: `${uid}_${Date.now()}_${move.angleQ}_${move.powerQ}`,
                uid,
                holeId: currentHole.id,
                startPos: { ...ballPos },
                angleQ: move.angleQ,
                powerQ: move.powerQ,
                startedAtMs: Date.now(),
                rollDurationMs,
                finalPosQ,
                sunk: simResult.sunk,
                penalty: simResult.penalty,
                penaltyType: simResult.penaltyType,
                totalSteps: simResult.totalSteps,
            };
            // DO NOT advance turn — roller still owns the turn
            return {
                ok: true,
                nextPublicState: state,
                turnAdvance: false,
            };
        }
        if (move.type === "finish_roll") {
            // Phase 2: commit result + advance turn (idempotent)
            if (state.phase !== "rolling" || !state.rolling) {
                // Already committed — idempotent success
                return {
                    ok: true,
                    nextPublicState: state,
                    turnAdvance: false,
                };
            }
            const r = state.rolling;
            if (r.shotId !== move.shotId) {
                return { ok: false, error: "Shot ID mismatch" };
            }
            const rollingUid = r.uid;
            // Apply result
            if (r.sunk) {
                state.ballSunkByUid[rollingUid] = true;
                state.ballPosByUid[rollingUid] = r.finalPosQ;
                state.holeScoresByUid[rollingUid] =
                    state.holeScoresByUid[rollingUid] || {};
                state.holeScoresByUid[rollingUid][currentHole.id] =
                    state.strokesThisHoleByUid[rollingUid];
                if (state.strokesThisHoleByUid[rollingUid] === 1) {
                    state.holesInOneByUid[rollingUid] =
                        (state.holesInOneByUid[rollingUid] || 0) + 1;
                }
                if (state.strokesThisHoleByUid[rollingUid] < currentHole.par) {
                    state.birdiesByUid[rollingUid] =
                        (state.birdiesByUid[rollingUid] || 0) + 1;
                }
            }
            else if (r.penalty) {
                state.penaltiesByUid[rollingUid] =
                    (state.penaltiesByUid[rollingUid] || 0) + 1;
                state.strokesThisHoleByUid[rollingUid] += 1; // penalty stroke
                state.strokesTotalByUid[rollingUid] += 1;
                state.ballPosByUid[rollingUid] = {
                    ...state.lastSafePosByUid[rollingUid],
                };
            }
            else {
                // Normal stop — update ball position AND lastSafe to final position
                state.ballPosByUid[rollingUid] = r.finalPosQ;
                state.lastSafePosByUid[rollingUid] = { ...r.finalPosQ };
            }
            // Check max strokes
            if (!state.ballSunkByUid[rollingUid] &&
                state.strokesThisHoleByUid[rollingUid] >= maxStrokes) {
                state.ballSunkByUid[rollingUid] = true;
                state.holeScoresByUid[rollingUid] =
                    state.holeScoresByUid[rollingUid] || {};
                state.holeScoresByUid[rollingUid][currentHole.id] = maxStrokes;
            }
            // Clear rolling
            state.rolling = null;
            state.phase = "aim";
            // Check if all players done
            const allUids = ctx.turnOrder;
            const allSunk = allUids.every((u) => state.ballSunkByUid[u]);
            if (allSunk) {
                if (state.holeIndex + 1 >= state.holeCount) {
                    state.phase = "finished";
                    const outcome = mgComputeOutcome(state, allUids.map((u, i) => ({ uid: u, slotIndex: i })));
                    return {
                        ok: true,
                        nextPublicState: state,
                        turnAdvance: false,
                        terminal: {
                            type: "win",
                            winnerIds: outcome.winnerIds,
                            reason: "All holes complete",
                        },
                    };
                }
                else {
                    state.holeIndex += 1;
                    state.phase = "aim";
                    const nextHole = pack.holes[state.holeIndex];
                    state.holeId = nextHole.id;
                    state.holePar = nextHole.par;
                    for (const u of allUids) {
                        state.ballPosByUid[u] = { x: nextHole.tee.x, y: nextHole.tee.y };
                        state.lastSafePosByUid[u] = {
                            x: nextHole.tee.x,
                            y: nextHole.tee.y,
                        };
                        state.strokesThisHoleByUid[u] = 0;
                        state.ballSunkByUid[u] = false;
                    }
                }
            }
            return {
                ok: true,
                nextPublicState: state,
                turnAdvance: true,
                nextTurnPlayerId: mgNextTurn(rollingUid, ctx.turnOrder, state.ballSunkByUid),
            };
        }
        if (move.type === "pickup") {
            if (!state.ballSunkByUid[uid]) {
                const prevStrokes = state.strokesThisHoleByUid[uid] || 0;
                state.strokesTotalByUid[uid] =
                    (state.strokesTotalByUid[uid] ?? 0) + (maxStrokes - prevStrokes);
                state.strokesThisHoleByUid[uid] = maxStrokes;
                state.ballSunkByUid[uid] = true;
                state.holeScoresByUid[uid] = state.holeScoresByUid[uid] || {};
                state.holeScoresByUid[uid][currentHole.id] = maxStrokes;
            }
            // Check if all players done
            const allUids = ctx.turnOrder;
            const allSunk = allUids.every((u) => state.ballSunkByUid[u]);
            if (allSunk) {
                if (state.holeIndex + 1 >= state.holeCount) {
                    state.phase = "finished";
                    const outcome = mgComputeOutcome(state, allUids.map((u, i) => ({ uid: u, slotIndex: i })));
                    return {
                        ok: true,
                        nextPublicState: state,
                        turnAdvance: false,
                        terminal: {
                            type: "win",
                            winnerIds: outcome.winnerIds,
                            reason: "All holes complete",
                        },
                    };
                }
                else {
                    state.holeIndex += 1;
                    state.phase = "aim";
                    const nextHole = pack.holes[state.holeIndex];
                    state.holeId = nextHole.id;
                    state.holePar = nextHole.par;
                    for (const u of allUids) {
                        state.ballPosByUid[u] = { x: nextHole.tee.x, y: nextHole.tee.y };
                        state.lastSafePosByUid[u] = {
                            x: nextHole.tee.x,
                            y: nextHole.tee.y,
                        };
                        state.strokesThisHoleByUid[u] = 0;
                        state.ballSunkByUid[u] = false;
                    }
                }
            }
            return {
                ok: true,
                nextPublicState: state,
                turnAdvance: true,
                nextTurnPlayerId: mgNextTurn(uid, ctx.turnOrder, state.ballSunkByUid),
            };
        }
        return { ok: false, error: `Unknown move type: ${move?.type}` };
    },
    computeOutcome(publicState, players) {
        return mgComputeOutcome(publicState, players);
    },
    extractPerformanceMetrics(publicState) {
        const s = publicState;
        return {
            holeIndex: s.holeIndex,
            holeCount: s.holeCount,
            phase: s.phase,
            totalStrokes: s.strokesTotalByUid,
            coursePackId: s.coursePackId,
        };
    },
    validateSettings(patch) {
        return mgMergeSettings(patch);
    },
});
function mgNextTurn(currentUid, turnOrder, ballSunkByUid) {
    const idx = turnOrder.indexOf(currentUid);
    for (let i = 1; i <= turnOrder.length; i++) {
        const nextIdx = (idx + i) % turnOrder.length;
        if (!ballSunkByUid[turnOrder[nextIdx]])
            return turnOrder[nextIdx];
    }
    return turnOrder[(idx + 1) % turnOrder.length];
}
const MS_PRESETS = {
    easy: { difficulty: "easy", cols: 9, rows: 9, mineCount: 10 },
    intermediate: {
        difficulty: "intermediate",
        cols: 16,
        rows: 16,
        mineCount: 40,
    },
    expert: { difficulty: "expert", cols: 30, rows: 16, mineCount: 99 },
};
// ── Minesweeper Seeded PRNG (Mulberry32) ─────────────────────────────
function msCreateRNG(seed) {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function msShuffle(arr, rng) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
// ── Minesweeper Board Helpers ────────────────────────────────────────
function msToIndex(row, col, cols) {
    return row * cols + col;
}
function msFromIndex(idx, cols) {
    return [Math.floor(idx / cols), idx % cols];
}
function msGetNeighbors(idx, rows, cols) {
    const [row, col] = msFromIndex(idx, cols);
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0)
                continue;
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                neighbors.push(msToIndex(nr, nc, cols));
            }
        }
    }
    return neighbors;
}
// ── Minesweeper Board Generation ─────────────────────────────────────
function msGenerateBoard(rows, cols, mineCount, seed, firstClickIdx) {
    const totalCells = rows * cols;
    const board = new Array(totalCells).fill(0);
    const excluded = new Set([firstClickIdx]);
    for (const n of msGetNeighbors(firstClickIdx, rows, cols)) {
        excluded.add(n);
    }
    const candidates = [];
    for (let i = 0; i < totalCells; i++) {
        if (!excluded.has(i))
            candidates.push(i);
    }
    const rng = msCreateRNG(seed);
    const shuffled = msShuffle(candidates, rng);
    const minesToPlace = Math.min(mineCount, shuffled.length);
    for (let i = 0; i < minesToPlace; i++) {
        board[shuffled[i]] = -1;
    }
    for (let i = 0; i < totalCells; i++) {
        if (board[i] === -1)
            continue;
        let count = 0;
        for (const n of msGetNeighbors(i, rows, cols)) {
            if (board[n] === -1)
                count++;
        }
        board[i] = count;
    }
    return board;
}
// ── Minesweeper State Helpers ────────────────────────────────────────
function msCloneState(state) {
    return {
        ...state,
        board: [...state.board],
        cellStates: [...state.cellStates],
    };
}
function msCreateInitialState(difficulty = "easy", seed) {
    const preset = MS_PRESETS[difficulty];
    const totalCells = preset.rows * preset.cols;
    const gameSeed = seed ?? Math.floor(Math.random() * 2147483647);
    return {
        difficulty: preset.difficulty,
        cols: preset.cols,
        rows: preset.rows,
        mineCount: preset.mineCount,
        seed: gameSeed,
        boardGenerated: false,
        board: new Array(totalCells).fill(0),
        cellStates: new Array(totalCells).fill("hidden"),
        status: "idle",
        revealedCount: 0,
        totalSafeCells: totalCells - preset.mineCount,
        flagCount: 0,
        explodedCell: -1,
        startedAtMs: 0,
        elapsedMs: 0,
        moveCount: 0,
        chordCount: 0,
        floodCount: 0,
    };
}
function msFloodFill(state, startIdx) {
    const queue = [startIdx];
    const visited = new Set();
    let revealed = 0;
    while (queue.length > 0) {
        const idx = queue.shift();
        if (visited.has(idx))
            continue;
        visited.add(idx);
        if (state.cellStates[idx] !== "hidden")
            continue;
        state.cellStates[idx] = "revealed";
        state.revealedCount++;
        revealed++;
        if (state.board[idx] === 0) {
            for (const n of msGetNeighbors(idx, state.rows, state.cols)) {
                if (!visited.has(n) && state.cellStates[n] === "hidden")
                    queue.push(n);
            }
        }
    }
    return { state, revealed };
}
function msRevealCell(state, cellIdx, nowMs) {
    if (cellIdx < 0 || cellIdx >= state.rows * state.cols)
        return { state, hitMine: false, cellsRevealed: 0 };
    if (state.status === "won" || state.status === "lost")
        return { state, hitMine: false, cellsRevealed: 0 };
    if (state.cellStates[cellIdx] !== "hidden")
        return { state, hitMine: false, cellsRevealed: 0 };
    let ns = msCloneState(state);
    if (!ns.boardGenerated) {
        ns.board = msGenerateBoard(ns.rows, ns.cols, ns.mineCount, ns.seed, cellIdx);
        ns.boardGenerated = true;
        ns.status = "active";
        ns.startedAtMs = nowMs;
    }
    ns.moveCount++;
    if (ns.board[cellIdx] === -1) {
        ns.cellStates[cellIdx] = "revealed";
        ns.explodedCell = cellIdx;
        ns.status = "lost";
        ns.elapsedMs = nowMs - ns.startedAtMs;
        for (let i = 0; i < ns.board.length; i++) {
            if (ns.board[i] === -1 && ns.cellStates[i] === "hidden")
                ns.cellStates[i] = "revealed";
        }
        return { state: ns, hitMine: true, cellsRevealed: 1 };
    }
    let cellsRevealed = 0;
    if (ns.board[cellIdx] === 0) {
        const fr = msFloodFill(ns, cellIdx);
        ns = fr.state;
        cellsRevealed = fr.revealed;
        ns.floodCount += cellsRevealed;
    }
    else {
        ns.cellStates[cellIdx] = "revealed";
        ns.revealedCount++;
        cellsRevealed = 1;
    }
    if (ns.revealedCount >= ns.totalSafeCells) {
        ns.status = "won";
        ns.elapsedMs = nowMs - ns.startedAtMs;
        for (let i = 0; i < ns.board.length; i++) {
            if (ns.board[i] === -1 && ns.cellStates[i] !== "flagged") {
                ns.cellStates[i] = "flagged";
                ns.flagCount++;
            }
        }
    }
    return { state: ns, hitMine: false, cellsRevealed };
}
// ── Minesweeper Flag Logic ───────────────────────────────────────────
function msToggleFlag(state, cellIdx) {
    if (cellIdx < 0 || cellIdx >= state.rows * state.cols)
        return state;
    if (state.status === "won" || state.status === "lost")
        return state;
    const cs = state.cellStates[cellIdx];
    if (cs === "revealed")
        return state;
    const ns = msCloneState(state);
    ns.moveCount++;
    if (cs === "flagged") {
        ns.cellStates[cellIdx] = "hidden";
        ns.flagCount--;
    }
    else {
        ns.cellStates[cellIdx] = "flagged";
        ns.flagCount++;
    }
    return ns;
}
function msChordReveal(state, cellIdx, nowMs) {
    if (cellIdx < 0 || cellIdx >= state.rows * state.cols)
        return { state, hitMine: false, cellsRevealed: 0 };
    if (state.status !== "active")
        return { state, hitMine: false, cellsRevealed: 0 };
    if (state.cellStates[cellIdx] !== "revealed")
        return { state, hitMine: false, cellsRevealed: 0 };
    const cellValue = state.board[cellIdx];
    if (cellValue <= 0)
        return { state, hitMine: false, cellsRevealed: 0 };
    const neighbors = msGetNeighbors(cellIdx, state.rows, state.cols);
    let adjFlags = 0;
    for (const n of neighbors) {
        if (state.cellStates[n] === "flagged")
            adjFlags++;
    }
    if (adjFlags !== cellValue)
        return { state, hitMine: false, cellsRevealed: 0 };
    let ns = msCloneState(state);
    ns.moveCount++;
    ns.chordCount++;
    let totalRevealed = 0;
    for (const n of neighbors) {
        if (ns.cellStates[n] !== "hidden")
            continue;
        if (ns.board[n] === -1) {
            ns.cellStates[n] = "revealed";
            ns.explodedCell = n;
            ns.status = "lost";
            ns.elapsedMs = nowMs - ns.startedAtMs;
            for (let i = 0; i < ns.board.length; i++) {
                if (ns.board[i] === -1 && ns.cellStates[i] === "hidden")
                    ns.cellStates[i] = "revealed";
            }
            return { state: ns, hitMine: true, cellsRevealed: totalRevealed + 1 };
        }
        if (ns.board[n] === 0) {
            const fr = msFloodFill(ns, n);
            ns = fr.state;
            totalRevealed += fr.revealed;
            ns.floodCount += fr.revealed;
        }
        else {
            ns.cellStates[n] = "revealed";
            ns.revealedCount++;
            totalRevealed++;
        }
    }
    if (ns.revealedCount >= ns.totalSafeCells) {
        ns.status = "won";
        ns.elapsedMs = nowMs - ns.startedAtMs;
        for (let i = 0; i < ns.board.length; i++) {
            if (ns.board[i] === -1 && ns.cellStates[i] !== "flagged") {
                ns.cellStates[i] = "flagged";
                ns.flagCount++;
            }
        }
    }
    return { state: ns, hitMine: false, cellsRevealed: totalRevealed };
}
// ── Minesweeper PB Encoding ─────────────────────────────────────────
function msEncodeBestScore(difficulty, elapsedMs) {
    const tierBase = {
        easy: 1_000_000,
        intermediate: 2_000_000,
        expert: 3_000_000,
    };
    const clamped = Math.min(Math.max(0, Math.floor(elapsedMs)), 999_999);
    return tierBase[difficulty] + (999_999 - clamped);
}
function msFormatTimeShort(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
// ── Register Minesweeper Adapter ─────────────────────────────────────
const MS_VALID_ACTIONS = new Set(["reveal", "flag", "chord", "restart"]);
const MS_VALID_DIFFICULTIES = new Set(["easy", "intermediate", "expert"]);
registerAdapter({
    gameId: "minesweeper",
    runtimeType: "solo",
    maxPlayers: 1,
    minPlayers: 1,
    defaultSettings: { difficulty: "easy" },
    createInitialPublicState(_players, settings) {
        const difficulty = settings.difficulty || "easy";
        return msCreateInitialState(difficulty);
    },
    validateMove(publicState, _priv, movePayload, ctx) {
        const state = publicState;
        const move = movePayload;
        if (!move.action || !MS_VALID_ACTIONS.has(move.action))
            return { ok: false, error: "Invalid action." };
        const nowMs = Date.now();
        // Restart
        if (move.action === "restart") {
            const diff = move.difficulty && MS_VALID_DIFFICULTIES.has(move.difficulty)
                ? move.difficulty
                : state.difficulty;
            const ns = msCreateInitialState(diff);
            return {
                ok: true,
                nextPublicState: ns,
                scoreDelta: [],
                turnAdvance: false,
            };
        }
        // Validate cell
        if (move.cell === undefined || move.cell === null)
            return { ok: false, error: "Cell index required." };
        const cellIdx = move.cell;
        if (cellIdx < 0 || cellIdx >= state.rows * state.cols)
            return { ok: false, error: "Cell index out of bounds." };
        // Flag
        if (move.action === "flag") {
            const ns = msToggleFlag(state, cellIdx);
            if (ns === state)
                return { ok: false, error: "Cannot flag this cell." };
            return {
                ok: true,
                nextPublicState: ns,
                scoreDelta: [],
                turnAdvance: false,
            };
        }
        // Reveal
        if (move.action === "reveal") {
            if (state.status === "won" || state.status === "lost")
                return { ok: false, error: "Game is already over." };
            const result = msRevealCell(state, cellIdx, nowMs);
            if (result.cellsRevealed === 0 && !result.hitMine)
                return { ok: false, error: "Cannot reveal this cell." };
            const ns = result.state;
            const isTerminal = ns.status === "won" || ns.status === "lost";
            if (isTerminal) {
                const isWin = ns.status === "won";
                const score = isWin
                    ? msEncodeBestScore(ns.difficulty, ns.elapsedMs)
                    : 0;
                return {
                    ok: true,
                    nextPublicState: ns,
                    scoreDelta: [{ uid: ctx.uid, delta: score }],
                    turnAdvance: false,
                    terminal: {
                        type: isWin ? "win" : "timeout",
                        winnerIds: isWin ? [ctx.uid] : [],
                        reason: isWin
                            ? `Cleared ${ns.difficulty} in ${msFormatTimeShort(ns.elapsedMs)}!`
                            : "Hit a mine!",
                    },
                };
            }
            return {
                ok: true,
                nextPublicState: ns,
                scoreDelta: [],
                turnAdvance: false,
            };
        }
        // Chord
        if (move.action === "chord") {
            if (state.status !== "active")
                return { ok: false, error: "Game is not active." };
            const result = msChordReveal(state, cellIdx, nowMs);
            if (result.cellsRevealed === 0 && !result.hitMine)
                return { ok: false, error: "Cannot chord this cell." };
            const ns = result.state;
            const isTerminal = ns.status === "won" || ns.status === "lost";
            if (isTerminal) {
                const isWin = ns.status === "won";
                const score = isWin
                    ? msEncodeBestScore(ns.difficulty, ns.elapsedMs)
                    : 0;
                return {
                    ok: true,
                    nextPublicState: ns,
                    scoreDelta: [{ uid: ctx.uid, delta: score }],
                    turnAdvance: false,
                    terminal: {
                        type: isWin ? "win" : "timeout",
                        winnerIds: isWin ? [ctx.uid] : [],
                        reason: isWin
                            ? `Cleared ${ns.difficulty} in ${msFormatTimeShort(ns.elapsedMs)}!`
                            : "Hit a mine!",
                    },
                };
            }
            return {
                ok: true,
                nextPublicState: ns,
                scoreDelta: [],
                turnAdvance: false,
            };
        }
        return { ok: false, error: "Unknown action." };
    },
    computeOutcome(publicState, players) {
        const state = publicState;
        const uid = players[0]?.uid ?? "";
        const isWin = state.status === "won";
        const score = isWin
            ? msEncodeBestScore(state.difficulty, state.elapsedMs)
            : 0;
        return {
            winnerIds: isWin ? [uid] : [],
            finalScoreboard: [
                {
                    uid,
                    score,
                    placement: 1,
                    stats: {
                        difficulty: state.difficulty,
                        elapsedMs: state.elapsedMs,
                        revealedCount: state.revealedCount,
                        totalSafeCells: state.totalSafeCells,
                        flagCount: state.flagCount,
                        moveCount: state.moveCount,
                        chordCount: state.chordCount,
                        floodCount: state.floodCount,
                        won: isWin,
                    },
                },
            ],
        };
    },
    extractPerformanceMetrics(publicState) {
        const state = publicState;
        return {
            difficulty: state.difficulty,
            cols: state.cols,
            rows: state.rows,
            mineCount: state.mineCount,
            elapsedMs: state.elapsedMs,
            revealedCount: state.revealedCount,
            totalSafeCells: state.totalSafeCells,
            flagCount: state.flagCount,
            moveCount: state.moveCount,
            chordCount: state.chordCount,
            floodCount: state.floodCount,
            won: state.status === "won",
            lost: state.status === "lost",
        };
    },
});
const SOL_SUITS = ["S", "H", "D", "C"];
const SOL_RANKS = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
];
const SOL_RANK_VALUES = {
    A: 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
};
const SOL_SUIT_NAME = {
    S: "spades",
    H: "hearts",
    D: "diamonds",
    C: "clubs",
};
function solSuit(c) {
    return c.slice(-1);
}
function solSuitName(c) {
    return SOL_SUIT_NAME[solSuit(c)];
}
function solRank(c) {
    return c.slice(0, -1);
}
function solRankVal(c) {
    return SOL_RANK_VALUES[solRank(c)] ?? 0;
}
function solColor(c) {
    const s = solSuit(c);
    return s === "H" || s === "D" ? "red" : "black";
}
function solCanPlaceOnTableau(card, target) {
    if (!target)
        return solRank(card) === "K";
    return (solColor(card) !== solColor(target) &&
        solRankVal(target) === solRankVal(card) + 1);
}
function solCanPlaceOnFoundation(card, fTop) {
    if (!fTop)
        return solRank(card) === "A";
    return (solSuit(card) === solSuit(fTop) && solRankVal(card) === solRankVal(fTop) + 1);
}
function solIsValidRun(cards) {
    for (let i = 0; i < cards.length - 1; i++) {
        if (solColor(cards[i]) === solColor(cards[i + 1]) ||
            solRankVal(cards[i]) !== solRankVal(cards[i + 1]) + 1)
            return false;
    }
    return true;
}
const SOL_MAX_UNDO = 30;
// ── Deck / shuffle ───────────────────────────────────────────────────
function solBuildDeck() {
    const d = [];
    for (const s of SOL_SUITS)
        for (const r of SOL_RANKS)
            d.push(`${r}${s}`);
    return d;
}
function solShuffle(deck, seed) {
    const a = [...deck];
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        const j = (s >>> 0) % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function solDeal(seed) {
    const deck = solShuffle(solBuildDeck(), seed);
    const tableau = [];
    let idx = 0;
    for (let i = 0; i < 7; i++) {
        const down = [];
        for (let j = 0; j < i; j++)
            down.push(deck[idx++]);
        const up = [deck[idx++]];
        tableau.push({ down, up });
    }
    return {
        tableau,
        stock: deck.slice(idx),
        waste: [],
        foundations: { spades: [], hearts: [], diamonds: [], clubs: [] },
        score: 0,
        moveCount: 0,
        recycleCount: 0,
        faceDownRevealedCount: 0,
        tableauMoveCount: 0,
        wasteToTableauCount: 0,
        foundationBacktrackCount: 0,
        canAutoComplete: false,
        completed: false,
        lastMoveSummary: null,
        undoStack: [],
        seed,
        startedAt: Date.now(),
    };
}
// ── Helpers ──────────────────────────────────────────────────────────
function solFPile(f, s) {
    return f[s];
}
function solTotalF(f) {
    return f.spades.length + f.hearts.length + f.diamonds.length + f.clubs.length;
}
function solReveal(col) {
    if (col.up.length === 0 && col.down.length > 0) {
        col.up.push(col.down.pop());
        return true;
    }
    return false;
}
function solAutoEligible(st) {
    for (const c of st.tableau)
        if (c.down.length > 0)
            return false;
    return st.stock.length === 0 && st.waste.length === 0;
}
function solMakeUndo(st) {
    return {
        tableau: st.tableau.map((c) => ({ down: [...c.down], up: [...c.up] })),
        stock: [...st.stock],
        waste: [...st.waste],
        foundations: {
            spades: [...st.foundations.spades],
            hearts: [...st.foundations.hearts],
            diamonds: [...st.foundations.diamonds],
            clubs: [...st.foundations.clubs],
        },
        score: st.score,
        moveCount: st.moveCount,
        recycleCount: st.recycleCount,
        faceDownRevealedCount: st.faceDownRevealedCount,
        tableauMoveCount: st.tableauMoveCount,
        wasteToTableauCount: st.wasteToTableauCount,
        foundationBacktrackCount: st.foundationBacktrackCount,
        lastMoveSummary: st.lastMoveSummary,
    };
}
function solPushUndo(st) {
    st.undoStack = [...st.undoStack.slice(-(SOL_MAX_UNDO - 1)), solMakeUndo(st)];
}
function solClone(st) {
    return {
        tableau: st.tableau.map((c) => ({ down: [...c.down], up: [...c.up] })),
        stock: [...st.stock],
        waste: [...st.waste],
        foundations: {
            spades: [...st.foundations.spades],
            hearts: [...st.foundations.hearts],
            diamonds: [...st.foundations.diamonds],
            clubs: [...st.foundations.clubs],
        },
        score: st.score,
        moveCount: st.moveCount,
        recycleCount: st.recycleCount,
        faceDownRevealedCount: st.faceDownRevealedCount,
        tableauMoveCount: st.tableauMoveCount,
        wasteToTableauCount: st.wasteToTableauCount,
        foundationBacktrackCount: st.foundationBacktrackCount,
        canAutoComplete: st.canAutoComplete,
        completed: st.completed,
        lastMoveSummary: st.lastMoveSummary,
        undoStack: st.undoStack.map((e) => ({
            tableau: e.tableau.map((c) => ({ down: [...c.down], up: [...c.up] })),
            stock: [...e.stock],
            waste: [...e.waste],
            foundations: {
                spades: [...e.foundations.spades],
                hearts: [...e.foundations.hearts],
                diamonds: [...e.foundations.diamonds],
                clubs: [...e.foundations.clubs],
            },
            score: e.score,
            moveCount: e.moveCount,
            recycleCount: e.recycleCount,
            faceDownRevealedCount: e.faceDownRevealedCount,
            tableauMoveCount: e.tableauMoveCount,
            wasteToTableauCount: e.wasteToTableauCount,
            foundationBacktrackCount: e.foundationBacktrackCount,
            lastMoveSummary: e.lastMoveSummary,
        })),
        seed: st.seed,
        startedAt: st.startedAt,
    };
}
// ── Legal move detection ─────────────────────────────────────────────
function solFindLegalMove(st) {
    // 1. Tableau/waste → foundation
    for (let i = 0; i < 7; i++) {
        const col = st.tableau[i];
        if (col.up.length === 0)
            continue;
        const top = col.up[col.up.length - 1];
        const sn = solSuitName(top);
        const fp = solFPile(st.foundations, sn);
        const ft = fp.length > 0 ? fp[fp.length - 1] : null;
        if (solCanPlaceOnFoundation(top, ft))
            return { type: "move_tableau_to_foundation", sourceCol: i };
    }
    if (st.waste.length > 0) {
        const wt = st.waste[st.waste.length - 1];
        const sn = solSuitName(wt);
        const fp = solFPile(st.foundations, sn);
        const ft = fp.length > 0 ? fp[fp.length - 1] : null;
        if (solCanPlaceOnFoundation(wt, ft))
            return { type: "move_waste_to_foundation" };
    }
    // 2. Reveal moves
    for (let i = 0; i < 7; i++) {
        const src = st.tableau[i];
        if (src.up.length === 0 || src.down.length === 0)
            continue;
        const bottom = src.up[0];
        for (let j = 0; j < 7; j++) {
            if (i === j)
                continue;
            const dest = st.tableau[j];
            const dt = dest.up.length > 0 ? dest.up[dest.up.length - 1] : null;
            if (solCanPlaceOnTableau(bottom, dt))
                return {
                    type: "move_tableau_to_tableau",
                    sourceCol: i,
                    destCol: j,
                    startIndex: 0,
                    count: src.up.length,
                };
        }
    }
    // 3. King to empty
    for (let i = 0; i < 7; i++) {
        const src = st.tableau[i];
        if (src.up.length === 0)
            continue;
        if (solRank(src.up[0]) === "K" && src.down.length > 0) {
            for (let j = 0; j < 7; j++) {
                if (i === j)
                    continue;
                if (st.tableau[j].up.length === 0 && st.tableau[j].down.length === 0)
                    return {
                        type: "move_tableau_to_tableau",
                        sourceCol: i,
                        destCol: j,
                        startIndex: 0,
                        count: src.up.length,
                    };
            }
        }
    }
    // 4. Waste → tableau
    if (st.waste.length > 0) {
        const wt = st.waste[st.waste.length - 1];
        for (let j = 0; j < 7; j++) {
            const d = st.tableau[j];
            const dt = d.up.length > 0 ? d.up[d.up.length - 1] : null;
            if (solCanPlaceOnTableau(wt, dt))
                return { type: "move_waste_to_tableau", destCol: j };
        }
    }
    // 5. General tableau-to-tableau
    for (let i = 0; i < 7; i++) {
        const src = st.tableau[i];
        if (src.up.length === 0)
            continue;
        for (let si = 0; si < src.up.length; si++) {
            const run = src.up.slice(si);
            if (!solIsValidRun(run))
                continue;
            for (let j = 0; j < 7; j++) {
                if (i === j)
                    continue;
                const d = st.tableau[j];
                const dt = d.up.length > 0 ? d.up[d.up.length - 1] : null;
                if (solCanPlaceOnTableau(run[0], dt))
                    return {
                        type: "move_tableau_to_tableau",
                        sourceCol: i,
                        destCol: j,
                        startIndex: si,
                        count: run.length,
                    };
            }
        }
    }
    // 6. Deal / recycle
    if (st.stock.length > 0)
        return { type: "deal_stock" };
    if (st.waste.length > 0)
        return { type: "recycle_stock" };
    return null;
}
function solApplyDealStock(st) {
    if (st.stock.length === 0)
        return { ok: false, error: "Stock empty." };
    solPushUndo(st);
    const cnt = Math.min(3, st.stock.length);
    st.waste.push(...st.stock.splice(-cnt, cnt));
    st.moveCount++;
    st.lastMoveSummary = `Dealt ${cnt} from stock`;
    return { ok: true };
}
function solApplyRecycle(st) {
    if (st.stock.length > 0)
        return { ok: false, error: "Stock not empty." };
    if (st.waste.length === 0)
        return { ok: false, error: "Nothing to recycle." };
    solPushUndo(st);
    st.stock = st.waste.reverse();
    st.waste = [];
    st.recycleCount++;
    st.score -= 20;
    st.moveCount++;
    st.lastMoveSummary = "Recycled waste to stock";
    return { ok: true };
}
function solApplyWasteToFoundation(st) {
    if (st.waste.length === 0)
        return { ok: false, error: "Waste empty." };
    const card = st.waste[st.waste.length - 1];
    const sn = solSuitName(card);
    const fp = solFPile(st.foundations, sn);
    const ft = fp.length > 0 ? fp[fp.length - 1] : null;
    if (!solCanPlaceOnFoundation(card, ft))
        return { ok: false, error: `Cannot place ${card} on foundation.` };
    solPushUndo(st);
    st.waste.pop();
    fp.push(card);
    st.score += 10;
    st.moveCount++;
    st.lastMoveSummary = `${card} → ${sn} foundation`;
    return { ok: true };
}
function solApplyWasteToTableau(st, destCol) {
    if (st.waste.length === 0)
        return { ok: false, error: "Waste empty." };
    if (destCol < 0 || destCol > 6)
        return { ok: false, error: "Invalid column." };
    const card = st.waste[st.waste.length - 1];
    const col = st.tableau[destCol];
    const ct = col.up.length > 0 ? col.up[col.up.length - 1] : null;
    if (!solCanPlaceOnTableau(card, ct))
        return { ok: false, error: `Cannot place ${card} on column ${destCol}.` };
    solPushUndo(st);
    st.waste.pop();
    col.up.push(card);
    st.score += 5;
    st.wasteToTableauCount++;
    st.moveCount++;
    st.lastMoveSummary = `${card} → tableau ${destCol}`;
    return { ok: true };
}
function solApplyTableauToFoundation(st, sourceCol) {
    if (sourceCol < 0 || sourceCol > 6)
        return { ok: false, error: "Invalid column." };
    const col = st.tableau[sourceCol];
    if (col.up.length === 0)
        return { ok: false, error: "No face-up cards." };
    const card = col.up[col.up.length - 1];
    const sn = solSuitName(card);
    const fp = solFPile(st.foundations, sn);
    const ft = fp.length > 0 ? fp[fp.length - 1] : null;
    if (!solCanPlaceOnFoundation(card, ft))
        return { ok: false, error: `Cannot place ${card} on foundation.` };
    solPushUndo(st);
    col.up.pop();
    fp.push(card);
    st.score += 10;
    st.moveCount++;
    st.lastMoveSummary = `${card} → ${sn} foundation`;
    if (solReveal(col)) {
        st.faceDownRevealedCount++;
        st.score += 5;
    }
    return { ok: true };
}
function solApplyTableauToTableau(st, srcCol, destCol, startIdx, count) {
    if (srcCol < 0 || srcCol > 6 || destCol < 0 || destCol > 6)
        return { ok: false, error: "Invalid column." };
    if (srcCol === destCol)
        return { ok: false, error: "Same column." };
    const src = st.tableau[srcCol];
    if (startIdx < 0 || startIdx >= src.up.length)
        return { ok: false, error: "Invalid start index." };
    const run = src.up.slice(startIdx, startIdx + count);
    if (run.length !== count || count === 0)
        return { ok: false, error: "Invalid run count." };
    if (!solIsValidRun(run))
        return { ok: false, error: "Invalid run." };
    const dest = st.tableau[destCol];
    const dt = dest.up.length > 0 ? dest.up[dest.up.length - 1] : null;
    if (!solCanPlaceOnTableau(run[0], dt))
        return { ok: false, error: `Cannot place ${run[0]} on column ${destCol}.` };
    solPushUndo(st);
    src.up.splice(startIdx, count);
    dest.up.push(...run);
    st.tableauMoveCount++;
    st.moveCount++;
    st.lastMoveSummary = `Moved ${count} card(s) col ${srcCol} → ${destCol}`;
    if (solReveal(src)) {
        st.faceDownRevealedCount++;
        st.score += 5;
    }
    return { ok: true };
}
function solApplyFoundationToTableau(st, sourceSuit, destCol) {
    if (destCol < 0 || destCol > 6)
        return { ok: false, error: "Invalid column." };
    const fp = solFPile(st.foundations, sourceSuit);
    if (fp.length === 0)
        return { ok: false, error: `${sourceSuit} foundation empty.` };
    const card = fp[fp.length - 1];
    const dest = st.tableau[destCol];
    const dt = dest.up.length > 0 ? dest.up[dest.up.length - 1] : null;
    if (!solCanPlaceOnTableau(card, dt))
        return { ok: false, error: `Cannot place ${card} on column ${destCol}.` };
    solPushUndo(st);
    fp.pop();
    dest.up.push(card);
    st.score -= 15;
    st.foundationBacktrackCount++;
    st.moveCount++;
    st.lastMoveSummary = `${card} ← ${sourceSuit} foundation → tableau ${destCol}`;
    return { ok: true };
}
function solApplyUndo(st) {
    if (st.undoStack.length === 0)
        return { ok: false, error: "Nothing to undo." };
    const prev = st.undoStack.pop();
    st.tableau = prev.tableau.map((c) => ({ down: [...c.down], up: [...c.up] }));
    st.stock = [...prev.stock];
    st.waste = [...prev.waste];
    st.foundations = {
        spades: [...prev.foundations.spades],
        hearts: [...prev.foundations.hearts],
        diamonds: [...prev.foundations.diamonds],
        clubs: [...prev.foundations.clubs],
    };
    st.score = prev.score;
    st.moveCount = prev.moveCount;
    st.recycleCount = prev.recycleCount;
    st.faceDownRevealedCount = prev.faceDownRevealedCount;
    st.tableauMoveCount = prev.tableauMoveCount;
    st.wasteToTableauCount = prev.wasteToTableauCount;
    st.foundationBacktrackCount = prev.foundationBacktrackCount;
    st.lastMoveSummary = "Undo";
    return { ok: true };
}
function solApplyAutoStep(st) {
    if (!solAutoEligible(st))
        return { ok: false, error: "Auto-complete not available." };
    for (let i = 0; i < 7; i++) {
        const col = st.tableau[i];
        if (col.up.length === 0)
            continue;
        const top = col.up[col.up.length - 1];
        const sn = solSuitName(top);
        const fp = solFPile(st.foundations, sn);
        const ft = fp.length > 0 ? fp[fp.length - 1] : null;
        if (solCanPlaceOnFoundation(top, ft)) {
            col.up.pop();
            fp.push(top);
            st.score += 10;
            st.moveCount++;
            st.lastMoveSummary = `Auto: ${top} → ${sn} foundation`;
            return { ok: true };
        }
    }
    return { ok: false, error: "No auto-complete moves." };
}
// ── Register adapter ─────────────────────────────────────────────────
registerAdapter({
    gameId: "solitaire_klondike",
    runtimeType: "solo",
    maxPlayers: 1,
    minPlayers: 1,
    defaultSettings: {},
    createInitialPublicState(players) {
        const uid = players[0]?.uid ?? "default";
        let seed = 0;
        for (let i = 0; i < uid.length; i++)
            seed = (seed * 31 + uid.charCodeAt(i)) & 0xffffffff;
        seed = (seed ^ (Date.now() & 0xffffffff)) & 0xffffffff;
        return solDeal(seed);
    },
    validateMove(publicState, _priv, movePayload, ctx) {
        const st = solClone(publicState);
        const mv = movePayload;
        if (st.completed)
            return { ok: false, error: "Game completed." };
        let res;
        switch (mv.type) {
            case "deal_stock":
                res = solApplyDealStock(st);
                break;
            case "recycle_stock":
                res = solApplyRecycle(st);
                break;
            case "move_waste_to_foundation":
                res = solApplyWasteToFoundation(st);
                break;
            case "move_waste_to_tableau":
                res = solApplyWasteToTableau(st, mv.destCol ?? -1);
                break;
            case "move_tableau_to_foundation":
                res = solApplyTableauToFoundation(st, mv.sourceCol ?? -1);
                break;
            case "move_tableau_to_tableau":
                res = solApplyTableauToTableau(st, mv.sourceCol ?? -1, mv.destCol ?? -1, mv.startIndex ?? 0, mv.count ?? 0);
                break;
            case "move_foundation_to_tableau":
                res = solApplyFoundationToTableau(st, mv.sourceSuit ?? "spades", mv.destCol ?? -1);
                break;
            case "undo":
                res = solApplyUndo(st);
                break;
            case "auto_complete_step":
                res = solApplyAutoStep(st);
                break;
            default:
                return { ok: false, error: `Unknown move type: ${mv.type}` };
        }
        if (!res.ok)
            return { ok: false, error: res.error };
        st.canAutoComplete = solAutoEligible(st);
        const fc = solTotalF(st.foundations);
        if (fc === 52) {
            st.completed = true;
            st.score += 700;
            st.lastMoveSummary = "Game Complete!";
            return {
                ok: true,
                nextPublicState: st,
                scoreDelta: [{ uid: ctx.uid, delta: st.score }],
                turnAdvance: false,
                terminal: {
                    type: "win",
                    winnerIds: [ctx.uid],
                    reason: "All cards on foundations!",
                },
            };
        }
        if (mv.type !== "undo" && solFindLegalMove(st) === null) {
            return {
                ok: true,
                nextPublicState: st,
                scoreDelta: [{ uid: ctx.uid, delta: st.score }],
                turnAdvance: false,
                terminal: {
                    type: "timeout",
                    winnerIds: [],
                    reason: "No legal moves remaining",
                },
            };
        }
        return {
            ok: true,
            nextPublicState: st,
            scoreDelta: [{ uid: ctx.uid, delta: 0 }],
            turnAdvance: false,
        };
    },
    computeOutcome(publicState, players) {
        const st = publicState;
        const uid = players[0]?.uid ?? "";
        return {
            winnerIds: st.completed ? [uid] : [],
            finalScoreboard: [
                {
                    uid,
                    score: st.score,
                    placement: 1,
                    stats: {
                        completed: st.completed,
                        foundationCount: solTotalF(st.foundations),
                        moveCount: st.moveCount,
                        recycleCount: st.recycleCount,
                    },
                },
            ],
        };
    },
    extractPerformanceMetrics(publicState) {
        const st = publicState;
        const fc = solTotalF(st.foundations);
        return {
            completed: st.completed,
            finalScore: st.score,
            foundationCount: fc,
            moveCount: st.moveCount,
            recycleCount: st.recycleCount,
            faceDownRevealedCount: st.faceDownRevealedCount,
            durationMs: Date.now() - st.startedAt,
            cardsRemainingOutsideFoundation: 52 - fc,
            tableauMoveCount: st.tableauMoveCount,
            wasteToTableauCount: st.wasteToTableauCount,
            foundationBacktrackCount: st.foundationBacktrackCount,
        };
    },
});
//# sourceMappingURL=adapters.js.map