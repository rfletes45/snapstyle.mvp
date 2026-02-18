"use strict";
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
exports.authorizeAdminHttpRequest = authorizeAdminHttpRequest;
const admin = __importStar(require("firebase-admin"));
const MIN_SETUP_KEY_LENGTH = 16;
const INSECURE_SETUP_KEYS = new Set([
    "secret",
    "change-me",
    "dev-secret-change-me",
    "admin-setup-key",
]);
function toNormalizedString(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function getConfiguredSetupKey() {
    const configured = toNormalizedString(process.env.ADMIN_SETUP_KEY);
    if (!configured)
        return null;
    if (configured.length < MIN_SETUP_KEY_LENGTH)
        return null;
    if (INSECURE_SETUP_KEYS.has(configured.toLowerCase()))
        return null;
    return configured;
}
function getBearerToken(req) {
    const header = toNormalizedString(req.headers.authorization);
    if (!header || !header.startsWith("Bearer "))
        return null;
    return toNormalizedString(header.slice("Bearer ".length));
}
function getSetupKeyFromRequest(req) {
    const fromHeader = toNormalizedString(req.headers["x-admin-setup-key"]);
    if (fromHeader)
        return fromHeader;
    const querySecret = req.query?.secretKey;
    if (typeof querySecret === "string" && querySecret.trim().length > 0) {
        return querySecret.trim();
    }
    const bodySecret = req.body?.secretKey;
    return toNormalizedString(bodySecret);
}
async function authorizeAdminHttpRequest(req, options = {}) {
    const allowAdminToken = options.allowAdminToken ?? true;
    const allowSetupKey = options.allowSetupKey ?? true;
    const requireSetupKey = options.requireSetupKey ?? false;
    const providedSetupKey = allowSetupKey || requireSetupKey
        ? getSetupKeyFromRequest(req)
        : null;
    const configuredSetupKey = allowSetupKey || requireSetupKey
        ? getConfiguredSetupKey()
        : null;
    if (allowAdminToken) {
        const bearerToken = getBearerToken(req);
        if (bearerToken) {
            try {
                const decoded = await admin.auth().verifyIdToken(bearerToken);
                if (decoded.admin === true) {
                    return { ok: true, method: "admin-claim", uid: decoded.uid };
                }
                return { ok: false, status: 403, error: "Admin access required" };
            }
            catch {
                // Fall through to setup-key auth if configured and provided.
            }
        }
    }
    if (requireSetupKey) {
        if (!configuredSetupKey) {
            return {
                ok: false,
                status: 500,
                error: "ADMIN_SETUP_KEY is not configured securely",
            };
        }
        if (!providedSetupKey || providedSetupKey !== configuredSetupKey) {
            return { ok: false, status: 403, error: "Invalid setup key" };
        }
        return { ok: true, method: "setup-key", uid: null };
    }
    if (allowSetupKey && providedSetupKey) {
        if (!configuredSetupKey) {
            return {
                ok: false,
                status: 500,
                error: "ADMIN_SETUP_KEY is not configured securely",
            };
        }
        if (providedSetupKey === configuredSetupKey) {
            return { ok: true, method: "setup-key", uid: null };
        }
        return { ok: false, status: 403, error: "Invalid setup key" };
    }
    return { ok: false, status: 401, error: "Admin authentication required" };
}
//# sourceMappingURL=httpAuth.js.map