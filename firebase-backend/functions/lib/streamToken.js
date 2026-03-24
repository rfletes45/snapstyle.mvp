"use strict";
/**
 * Stream Video Token Issuance
 *
 * Mints short-lived Stream Video user tokens from the secure backend.
 * The client calls this callable function to obtain a token for
 * initializing the Stream Video SDK.
 *
 * Environment config required:
 *   firebase functions:config:set stream.api_key="YOUR_KEY" stream.api_secret="YOUR_SECRET"
 *
 * @module functions/streamToken
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
exports.getStreamVideoToken = void 0;
const node_sdk_1 = require("@stream-io/node-sdk");
const functions = __importStar(require("firebase-functions"));
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function getStreamConfig() {
    const cfg = functions.config().stream;
    if (!cfg?.api_key || !cfg?.api_secret) {
        throw new functions.https.HttpsError("failed-precondition", "Stream Video API key/secret not configured. Run: firebase functions:config:set stream.api_key=... stream.api_secret=...");
    }
    return { apiKey: cfg.api_key, apiSecret: cfg.api_secret };
}
// ---------------------------------------------------------------------------
// Callable: getStreamVideoToken
// ---------------------------------------------------------------------------
/**
 * Authenticated callable that returns a Stream Video user token.
 *
 * Request: (no data required)
 * Response: { token: string; apiKey: string }
 */
exports.getStreamVideoToken = functions.https.onCall(async (_data, context) => {
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in to obtain a Stream Video token.");
    }
    const userId = context.auth.uid;
    const { apiKey, apiSecret } = getStreamConfig();
    const client = new node_sdk_1.StreamClient(apiKey, apiSecret);
    // Token valid for 24 hours (Stream default expiry is fine for most cases)
    const validity = 60 * 60 * 24; // seconds
    const token = client.generateUserToken({
        user_id: userId,
        validity_in_seconds: validity,
    });
    return { token, apiKey };
});
//# sourceMappingURL=streamToken.js.map