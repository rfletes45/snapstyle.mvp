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
exports.isGroupMuted = void 0;
exports.isValidString = isValidString;
exports.isValidUid = isValidUid;
exports.sanitizeForLog = sanitizeForLog;
exports.sendExpoPushNotification = sendExpoPushNotification;
exports.getUserPushToken = getUserPushToken;
exports.isDmChatMuted = isDmChatMuted;
exports.isGroupChatMuted = isGroupChatMuted;
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Validate that a string is safe (non-empty, reasonable length, no control chars)
 */
function isValidString(value, minLen = 1, maxLen = 1000) {
    if (typeof value !== "string")
        return false;
    if (value.length < minLen || value.length > maxLen)
        return false;
    // Reject control characters (except newlines/tabs for content)
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value))
        return false;
    return true;
}
/**
 * Validate that a value is a valid Firebase UID
 */
function isValidUid(value) {
    if (typeof value !== "string")
        return false;
    // Firebase UIDs are typically 20-128 chars, alphanumeric
    return (value.length >= 20 && value.length <= 128 && /^[a-zA-Z0-9]+$/.test(value));
}
/**
 * Sanitize string for logging (truncate, remove newlines)
 */
function sanitizeForLog(value, maxLen = 100) {
    const truncated = value.length > maxLen ? value.slice(0, maxLen) + "..." : value;
    return truncated.replace(/[\r\n]+/g, " ");
}
/**
 * Send push notification via Expo's push service
 */
async function sendExpoPushNotification(message) {
    try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
        });
        const result = await response.json();
        console.log("Push notification result:", result);
    }
    catch (error) {
        console.error("Error sending push notification:", error);
    }
}
/**
 * Get user's Expo Push Token from Firestore
 */
async function getUserPushToken(userId) {
    try {
        const userDoc = await db.collection("Users").doc(userId).get();
        if (!userDoc.exists)
            return null;
        return userDoc.data()?.expoPushToken || null;
    }
    catch (error) {
        console.error("Error getting push token:", error);
        return null;
    }
}
/**
 * Check if user has muted a DM chat
 * Uses the MembersPrivate subcollection of Chats
 */
async function isDmChatMuted(chatId, userId) {
    try {
        const memberPrivateDoc = await db
            .collection("Chats")
            .doc(chatId)
            .collection("MembersPrivate")
            .doc(userId)
            .get();
        if (!memberPrivateDoc.exists) {
            return false;
        }
        const data = memberPrivateDoc.data();
        const mutedUntil = data?.mutedUntil;
        if (!mutedUntil) {
            return false;
        }
        if (mutedUntil === -1) {
            return true;
        }
        return mutedUntil > Date.now();
    }
    catch (error) {
        console.error("Error checking DM mute status:", error);
        return false;
    }
}
/**
 * Check if user has muted a Group chat
 * Uses GroupMembers collection with mute settings
 */
async function isGroupChatMuted(groupId, userId) {
    try {
        const memberPrivateDoc = await db
            .collection("Groups")
            .doc(groupId)
            .collection("MembersPrivate")
            .doc(userId)
            .get();
        if (!memberPrivateDoc.exists) {
            return false;
        }
        const data = memberPrivateDoc.data();
        const mutedUntil = data?.mutedUntil;
        if (!mutedUntil) {
            return false;
        }
        if (mutedUntil === -1) {
            return true;
        }
        return mutedUntil > Date.now();
    }
    catch (error) {
        console.error("Error checking group mute status:", error);
        return false;
    }
}
exports.isGroupMuted = isGroupChatMuted;
//# sourceMappingURL=utils.js.map