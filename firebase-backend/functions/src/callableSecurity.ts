import * as functions from "firebase-functions";

const ENFORCE_APP_CHECK = process.env.SNAPSTYLE_ENFORCE_APP_CHECK === "true";

export function secureCallableRuntime(): ReturnType<typeof functions.runWith> {
  return ENFORCE_APP_CHECK
    ? functions.runWith({ enforceAppCheck: true })
    : functions.runWith({});
}

export function isAppCheckEnforced(): boolean {
  return ENFORCE_APP_CHECK;
}
