import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  UserCredential,
} from "firebase/auth";
import { getAuthInstance } from "./firebase";
import { Result, AppError, mapAuthError, ok, err } from "@/utils/errors";

/**
 * Sign up a new user with email and password
 * @param email User's email
 * @param password User's password
 * @returns Result with UserCredential or AppError
 */
export async function signUp(
  email: string,
  password: string,
): Promise<Result<UserCredential>> {
  try {
    const auth = getAuthInstance();
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    console.log("✅ [auth] User signed up:", credential.user.email);
    return ok(credential);
  } catch (error) {
    const appError = mapAuthError(error);
    appError.log("auth/signUp");
    return err(appError);
  }
}

/**
 * Sign in an existing user
 * @param email User's email
 * @param password User's password
 * @returns Result with UserCredential or AppError
 */
export async function login(
  email: string,
  password: string,
): Promise<Result<UserCredential>> {
  try {
    const auth = getAuthInstance();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ [auth] User logged in:", credential.user.email);
    return ok(credential);
  } catch (error) {
    const appError = mapAuthError(error);
    appError.log("auth/login");
    return err(appError);
  }
}

/**
 * Sign out the current user
 * @returns Result indicating success or failure
 */
export async function logout(): Promise<Result<void>> {
  try {
    const auth = getAuthInstance();
    await signOut(auth);
    console.log("✅ [auth] User logged out");
    return ok(undefined);
  } catch (error) {
    const appError = mapAuthError(error);
    appError.log("auth/logout");
    return err(appError);
  }
}

/**
 * Get the current authenticated user
 * @returns The current user or null if not authenticated
 */
export function getCurrentUser() {
  const auth = getAuthInstance();
  return auth.currentUser;
}

// Legacy exports for backward compatibility (throws errors)
// These can be gradually migrated
export async function signUpLegacy(
  email: string,
  password: string,
): Promise<UserCredential> {
  const result = await signUp(email, password);
  if (!result.ok) {
    throw new Error(result.error.userMessage);
  }
  return result.data;
}

export async function loginLegacy(
  email: string,
  password: string,
): Promise<UserCredential> {
  const result = await login(email, password);
  if (!result.ok) {
    throw new Error(result.error.userMessage);
  }
  return result.data;
}

export async function logoutLegacy(): Promise<void> {
  const result = await logout();
  if (!result.ok) {
    throw new Error(result.error.userMessage);
  }
}
