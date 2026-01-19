import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  UserCredential,
} from "firebase/auth";
import { getAuthInstance } from "./firebase";

/**
 * Sign up a new user with email and password
 * @param email User's email
 * @param password User's password
 * @returns UserCredential with the new user
 */
export async function signUp(
  email: string,
  password: string,
): Promise<UserCredential> {
  const auth = getAuthInstance();
  return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Sign in an existing user
 * @param email User's email
 * @param password User's password
 * @returns UserCredential with the authenticated user
 */
export async function login(
  email: string,
  password: string,
): Promise<UserCredential> {
  const auth = getAuthInstance();
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out the current user
 */
export async function logout(): Promise<void> {
  const auth = getAuthInstance();
  return signOut(auth);
}

/**
 * Get the current authenticated user
 * @returns The current user or null if not authenticated
 */
export function getCurrentUser() {
  const auth = getAuthInstance();
  return auth.currentUser;
}
