// Firebase configuration and initialization
// Import your actual config from firebaseConfig or firebaseConfig.local
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

/**
 * Initialize Firebase (call this once at app startup)
 * Pass in your Firebase config object
 */
export function initializeFirebase(config: any) {
  try {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app);
  } catch (error) {
    console.warn(
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
