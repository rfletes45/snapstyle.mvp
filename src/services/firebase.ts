import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseApp, initializeApp } from "firebase/app";
import type { Persistence } from "firebase/auth";
import { Auth, getAuth, initializeAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";
import { Functions, getFunctions } from "firebase/functions";
import { FirebaseStorage, getStorage } from "firebase/storage";

// getReactNativePersistence is exported from the react-native conditional
// bundle of firebase/auth.  Metro resolves it correctly at runtime, but
// TypeScript (running on Node) sees the Node bundle which omits it.
// We import it via require so tsc doesn't error.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const getReactNativePersistence: (storage: any) => Persistence =
  require("firebase/auth").getReactNativePersistence;

import { createLogger } from "@/utils/log";
const logger = createLogger("services/firebase");
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

/**
 * Initialize Firebase (call this once at app startup)
 * Pass in your Firebase config object
 *
 * CRITICAL: Uses initializeAuth() with getReactNativePersistence() so that
 * the Firebase Auth session is persisted to AsyncStorage.  Without this,
 * React Native has no localStorage/indexedDB and the SDK falls back to
 * in-memory persistence — meaning the user's login is lost on every app
 * restart.
 */
export function initializeFirebase(config: any) {
  try {
    app = initializeApp(config);

    // initializeAuth sets up AsyncStorage-backed persistence.
    // If auth was already initialized (e.g. hot reload), fall back to
    // getAuth() which returns the existing instance.
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
      logger.info(
        "[firebase] Initialized with ReactNative AsyncStorage persistence",
      );
    } catch (authInitError) {
      // Auth already initialized (hot reload / duplicate call) —
      // get the existing instance which already has persistence configured.
      auth = getAuth(app);
      logger.info(
        "[firebase] Auth already initialized — reusing existing instance",
      );
    }

    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app);
  } catch (error) {
    logger.warn(
      "Firebase initialization warning (this is OK if using placeholder config):",
      error,
    );
    // Continue anyway - auth methods will fail with proper error messages
  }
}

export function getAppInstance(): FirebaseApp {
  if (!app) {
    throw new Error(
      "Firebase not initialized. Call initializeFirebase() first.",
    );
  }
  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) {
    throw new Error(
      "Firebase not initialized. Call initializeFirebase() first.",
    );
  }
  return auth;
}

export function getFirestoreInstance(): Firestore {
  if (!db) {
    throw new Error(
      "Firebase not initialized. Call initializeFirebase() first.",
    );
  }
  return db;
}

export function getStorageInstance(): FirebaseStorage {
  if (!storage) {
    throw new Error(
      "Firebase not initialized. Call initializeFirebase() first.",
    );
  }
  return storage;
}

export function getFunctionsInstance(): Functions {
  if (!functions) {
    throw new Error(
      "Firebase not initialized. Call initializeFirebase() first.",
    );
  }
  return functions;
}
