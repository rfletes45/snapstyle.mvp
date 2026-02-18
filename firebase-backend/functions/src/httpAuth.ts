import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const MIN_SETUP_KEY_LENGTH = 16;
const INSECURE_SETUP_KEYS = new Set([
  "secret",
  "change-me",
  "dev-secret-change-me",
  "admin-setup-key",
]);

export type AdminHttpAuthResult =
  | { ok: true; method: "admin-claim" | "setup-key"; uid: string | null }
  | { ok: false; status: number; error: string };

interface AdminHttpAuthOptions {
  allowAdminToken?: boolean;
  allowSetupKey?: boolean;
  requireSetupKey?: boolean;
}

function toNormalizedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getConfiguredSetupKey(): string | null {
  const configured = toNormalizedString(process.env.ADMIN_SETUP_KEY);
  if (!configured) return null;
  if (configured.length < MIN_SETUP_KEY_LENGTH) return null;
  if (INSECURE_SETUP_KEYS.has(configured.toLowerCase())) return null;
  return configured;
}

function getBearerToken(req: functions.https.Request): string | null {
  const header = toNormalizedString(req.headers.authorization);
  if (!header || !header.startsWith("Bearer ")) return null;
  return toNormalizedString(header.slice("Bearer ".length));
}

function getSetupKeyFromRequest(req: functions.https.Request): string | null {
  const fromHeader = toNormalizedString(req.headers["x-admin-setup-key"]);
  if (fromHeader) return fromHeader;

  const querySecret = req.query?.secretKey;
  if (typeof querySecret === "string" && querySecret.trim().length > 0) {
    return querySecret.trim();
  }

  const bodySecret = req.body?.secretKey;
  return toNormalizedString(bodySecret);
}

export async function authorizeAdminHttpRequest(
  req: functions.https.Request,
  options: AdminHttpAuthOptions = {},
): Promise<AdminHttpAuthResult> {
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
      } catch {
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
