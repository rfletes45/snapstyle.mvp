/**
 * Firebase Admin SDK initialization.
 *
 * This module MUST be imported before any other module that uses
 * `admin.firestore()`, `admin.messaging()`, etc. at module scope.
 *
 * Import it as the very first line in index.ts:
 *   import "./adminInit";
 *
 * @module functions/adminInit
 */
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

// Firestore must tolerate `undefined` values in document writes.
// Without this, any optional field set to `undefined` (e.g. profile?.avatarConfig)
// causes: "Cannot use 'undefined' as a Firestore value" — surfaced as INTERNAL.
admin.firestore().settings({ ignoreUndefinedProperties: true });
