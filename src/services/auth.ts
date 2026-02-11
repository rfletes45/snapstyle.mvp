import { err, mapAuthError, ok, Result } from "@/utils/errors";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  UserCredential,
} from "firebase/auth";
import { getAuthInstance } from "./firebase";
import { removePushToken } from "./notifications";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/auth");
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
    logger.info("✅ [auth] User signed up:", credential.user.email);
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
    logger.info("✅ [auth] User logged in:", credential.user.email);
    return ok(credential);
  } catch (error) {
    const appError = mapAuthError(error);
    appError.log("auth/login");
    return err(appError);
  }
}

/**
 * Sign out the current user
 * Removes push token BEFORE signing out (while Firestore permissions are still valid)
 * @returns Result indicating success or failure
 */
export async function logout(): Promise<Result<void>> {
  try {
    const auth = getAuthInstance();

    // Remove push token while we still have Firestore auth permissions
    const user = auth.currentUser;
    if (user) {
      try {
        await removePushToken(user.uid);
      } catch (tokenError) {
        // Non-fatal — proceed with sign-out regardless
        logger.warn("[auth/logout] Failed to remove push token:", tokenError);
      }
    }

    await signOut(auth);
    logger.info("✅ [auth] User logged out");
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

/**
 * Send a password reset email
 * @param email The user's email address
 * @returns Result indicating success or failure
 */
export async function resetPassword(email: string): Promise<Result<void>> {
  try {
    const auth = getAuthInstance();
    await sendPasswordResetEmail(auth, email);
    logger.info("✅ [auth] Password reset email sent to:", email);
    return ok(undefined);
  } catch (error) {
    const appError = mapAuthError(error);
    appError.log("auth/resetPassword");
    return err(appError);
  }
}
