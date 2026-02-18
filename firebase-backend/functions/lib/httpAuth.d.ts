import * as functions from "firebase-functions";
export type AdminHttpAuthResult = {
    ok: true;
    method: "admin-claim" | "setup-key";
    uid: string | null;
} | {
    ok: false;
    status: number;
    error: string;
};
interface AdminHttpAuthOptions {
    allowAdminToken?: boolean;
    allowSetupKey?: boolean;
    requireSetupKey?: boolean;
}
export declare function authorizeAdminHttpRequest(req: functions.https.Request, options?: AdminHttpAuthOptions): Promise<AdminHttpAuthResult>;
export {};
