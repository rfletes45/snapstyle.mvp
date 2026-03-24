import { createLogger } from "@/utils/log";
import {
  QueryConstraint,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

const logger = createLogger("services/userNotifications");

export type UserNotificationType =
  | "dm_message"
  | "group_message"
  | "message_request"
  | "friend_request"
  | "friend_request_accepted"
  | "game_invite"
  | "game_lobby_ready"
  | "game_turn"
  | "game_resolved"
  | "achievement_unlocked"
  | "gift_received"
  | "gift_opened";

export interface UserNotificationRoute {
  screen: string;
  params?: Record<string, unknown>;
}

export interface UserNotificationRecord {
  id: string;
  type: UserNotificationType;
  category: string;
  title: string;
  body: string;
  channel: "in_app" | "push";
  dedupeKey: string;
  collapseKey?: string;
  actorUid?: string | null;
  actorName?: string | null;
  conversationId?: string | null;
  conversationScope?: "dm" | "group" | null;
  requestId?: string | null;
  sessionId?: string | null;
  inviteId?: string | null;
  gameId?: string | null;
  sectionId?: string | null;
  giftId?: string | null;
  route?: UserNotificationRoute;
  data: Record<string, unknown>;
  targetDeviceId?: string | null;
  badgeEligible: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  readAtMs: number | null;
  presentedAtMs: number | null;
  archivedAtMs: number | null;
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

function asRoute(value: unknown): UserNotificationRoute | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.screen !== "string" || raw.screen.length === 0) {
    return undefined;
  }
  return {
    screen: raw.screen,
    params:
      raw.params && typeof raw.params === "object"
        ? (raw.params as Record<string, unknown>)
        : undefined,
  };
}

function mapNotification(
  id: string,
  raw: Record<string, unknown>,
): UserNotificationRecord | null {
  const type = raw.type;
  const channel = raw.channel;
  if (typeof type !== "string" || typeof channel !== "string") {
    return null;
  }

  return {
    id,
    type: type as UserNotificationType,
    category: typeof raw.category === "string" ? raw.category : "system",
    title: typeof raw.title === "string" ? raw.title : "",
    body: typeof raw.body === "string" ? raw.body : "",
    channel: channel as "in_app" | "push",
    dedupeKey:
      typeof raw.dedupeKey === "string" && raw.dedupeKey.length > 0
        ? raw.dedupeKey
        : id,
    collapseKey:
      typeof raw.collapseKey === "string" ? raw.collapseKey : undefined,
    actorUid: typeof raw.actorUid === "string" ? raw.actorUid : null,
    actorName: typeof raw.actorName === "string" ? raw.actorName : null,
    conversationId:
      typeof raw.conversationId === "string" ? raw.conversationId : null,
    conversationScope:
      raw.conversationScope === "dm" || raw.conversationScope === "group"
        ? raw.conversationScope
        : null,
    requestId: typeof raw.requestId === "string" ? raw.requestId : null,
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : null,
    inviteId: typeof raw.inviteId === "string" ? raw.inviteId : null,
    gameId: typeof raw.gameId === "string" ? raw.gameId : null,
    sectionId: typeof raw.sectionId === "string" ? raw.sectionId : null,
    giftId: typeof raw.giftId === "string" ? raw.giftId : null,
    route: asRoute(raw.route),
    data:
      raw.data && typeof raw.data === "object"
        ? (raw.data as Record<string, unknown>)
        : {},
    targetDeviceId:
      typeof raw.targetDeviceId === "string" ? raw.targetDeviceId : null,
    badgeEligible: raw.badgeEligible !== false,
    createdAtMs: toMillis(raw.createdAt) ?? 0,
    updatedAtMs: toMillis(raw.updatedAt) ?? 0,
    readAtMs: toMillis(raw.readAt),
    presentedAtMs: toMillis(raw.presentedAt),
    archivedAtMs: toMillis(raw.archivedAt),
  };
}

function notificationCollection(uid: string) {
  return collection(getFirestoreInstance(), "Users", uid, "Notifications");
}

export function subscribeToUserNotifications(
  uid: string,
  callback: (notifications: UserNotificationRecord[]) => void,
  maxItems: number = 50,
): () => void {
  let cancelled = false;
  let currentUnsub: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000];

  function attach() {
    if (cancelled) return;

    const notificationsQuery = query(
      notificationCollection(uid),
      orderBy("createdAt", "desc"),
      limit(maxItems),
    );

    currentUnsub = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        attempt = 0;
        const notifications = snapshot.docs
          .map((docSnap) =>
            mapNotification(
              docSnap.id,
              docSnap.data() as Record<string, unknown>,
            ),
          )
          .filter((item): item is UserNotificationRecord => item !== null);
        callback(notifications);
      },
      (error) => {
        const code = (error as any)?.code ?? "";
        const isPermission =
          code === "permission-denied" ||
          String(error).includes("Missing or insufficient permissions");

        if (isPermission && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt] ?? 8000;
          logger.warn(
            `Notification subscription failed (attempt ${attempt + 1}/${MAX_RETRIES}), ` +
              `retrying in ${delay}ms`,
            { uid, code },
          );
          attempt++;
          currentUnsub = null;
          retryTimer = setTimeout(attach, delay);
        } else {
          logger.error("Notification subscription failed", {
            uid,
            code,
            error,
          });
          callback([]);
        }
      },
    );
  }

  attach();

  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (currentUnsub) currentUnsub();
  };
}

export function subscribeToUnreadBadgeCount(
  uid: string,
  callback: (count: number) => void,
): () => void {
  let cancelled = false;
  let currentUnsub: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000];

  function attach() {
    if (cancelled) return;

    const unreadQuery = query(
      notificationCollection(uid),
      where("badgeEligible", "==", true),
      where("readAt", "==", null),
    );

    currentUnsub = onSnapshot(
      unreadQuery,
      (snapshot) => {
        attempt = 0; // reset on success
        callback(snapshot.size);
      },
      (error) => {
        const code = (error as any)?.code ?? "";
        const isPermission =
          code === "permission-denied" ||
          String(error).includes("Missing or insufficient permissions");

        if (isPermission && attempt < MAX_RETRIES) {
          // Auth token may not have propagated to Firestore yet — retry
          const delay = RETRY_DELAYS[attempt] ?? 8000;
          logger.warn(
            `Badge count subscription failed (attempt ${attempt + 1}/${MAX_RETRIES}), ` +
              `retrying in ${delay}ms`,
            { uid, code },
          );
          attempt++;
          currentUnsub = null;
          retryTimer = setTimeout(attach, delay);
        } else {
          logger.error("Badge count subscription failed", { uid, code, error });
          callback(0);
        }
      },
    );
  }

  attach();

  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (currentUnsub) currentUnsub();
  };
}

export async function markUserNotificationRead(
  uid: string,
  notificationId: string,
): Promise<void> {
  await updateDoc(
    doc(getFirestoreInstance(), "Users", uid, "Notifications", notificationId),
    {
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );
}

export async function markUserNotificationPresented(
  uid: string,
  notificationId: string,
): Promise<void> {
  await updateDoc(
    doc(getFirestoreInstance(), "Users", uid, "Notifications", notificationId),
    {
      presentedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );
}

async function markNotificationsReadByConstraints(
  uid: string,
  constraints: QueryConstraint[],
): Promise<void> {
  const snapshot = await getDocs(
    query(notificationCollection(uid), ...constraints),
  );

  if (snapshot.empty) {
    return;
  }

  const batch = writeBatch(getFirestoreInstance());
  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function markConversationNotificationsRead(
  uid: string,
  conversationId: string,
  conversationScope?: "dm" | "group",
): Promise<void> {
  const constraints: QueryConstraint[] = [
    where("conversationId", "==", conversationId),
    where("readAt", "==", null),
  ];
  if (conversationScope) {
    constraints.splice(
      1,
      0,
      where("conversationScope", "==", conversationScope),
    );
  }
  await markNotificationsReadByConstraints(uid, constraints);
}

export async function markNotificationsReadByTypes(
  uid: string,
  types: UserNotificationType[],
): Promise<void> {
  if (types.length === 0) return;
  await markNotificationsReadByConstraints(uid, [
    where("type", "in", types),
    where("readAt", "==", null),
  ]);
}

export async function markGameNotificationsRead(
  uid: string,
  params: {
    sessionId?: string;
    inviteId?: string;
    types?: UserNotificationType[];
  },
): Promise<void> {
  const constraints: QueryConstraint[] = [where("readAt", "==", null)];
  if (params.types?.length) {
    constraints.push(where("type", "in", params.types));
  }
  if (params.sessionId) {
    constraints.push(where("sessionId", "==", params.sessionId));
  }
  if (params.inviteId) {
    constraints.push(where("inviteId", "==", params.inviteId));
  }
  await markNotificationsReadByConstraints(uid, constraints);
}

export async function markAchievementNotificationsRead(
  uid: string,
  sectionId?: string,
): Promise<void> {
  const constraints: QueryConstraint[] = [
    where("type", "==", "achievement_unlocked"),
    where("readAt", "==", null),
  ];
  if (sectionId) {
    constraints.push(where("sectionId", "==", sectionId));
  }
  await markNotificationsReadByConstraints(uid, constraints);
}
