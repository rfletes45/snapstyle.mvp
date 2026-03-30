import { createHash } from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { isDmChatMuted, isGroupChatMuted } from "./utils";

const db = admin.firestore();

const NOTIFICATION_SESSION_STALE_MS = 90_000;

export type NotificationCategory =
  | "message"
  | "social"
  | "games"
  | "progression"
  | "commerce"
  | "system";

export type NotificationEventType =
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
  | "gift_opened"
  | "streak_milestone"
  | "streak_at_risk"
  | "cosmetic_unlock"
  | "story_viewed";

export interface NotificationRoute {
  screen: string;
  params?: Record<string, unknown>;
}

export interface NotificationRequest {
  recipientUid: string;
  type: NotificationEventType;
  category: NotificationCategory;
  dedupeKey: string;
  collapseKey?: string;
  title: string;
  subtitle?: string;
  body: string;
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
  friendshipId?: string | null;
  route: NotificationRoute;
  data?: Record<string, unknown>;
  badgeEligible?: boolean;
  respectConversationMute?: boolean;
  /** Android notification channel override (defaults based on category). */
  androidChannelId?: string;
  /** iOS thread identifier for notification grouping. */
  iosThreadId?: string;
  /** iOS category identifier for actionable notifications. */
  iosCategoryId?: string;
  /**
   * Push tokens to exclude from delivery — typically the actor/sender's
   * device tokens.  This prevents the sender from receiving their own
   * notification even if a stale device entry exists under the recipient.
   */
  excludeTokens?: string[];
}

interface NotificationPreferenceSnapshot {
  notificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  messageNotificationsEnabled: boolean;
  socialNotificationsEnabled: boolean;
  gameNotificationsEnabled: boolean;
  achievementNotificationsEnabled: boolean;
  giftNotificationsEnabled: boolean;
  storyNotificationsEnabled: boolean;
  streakNotificationsEnabled: boolean;
  badgeCountEnabled: boolean;
}

interface NotificationSessionSnapshot {
  deviceId: string;
  appState: string;
  currentScreen: string | null;
  currentChatId: string | null;
  currentConversationScope: string | null;
  currentGameSessionId: string | null;
  currentGameInviteId: string | null;
  currentGameRuntimeType: string | null;
  inAppEnabled: boolean;
  updatedAtMs: number;
}

interface NotificationDeviceSnapshot {
  deviceId: string;
  expoPushToken: string;
  platform: string | null;
}

interface NotificationDecision {
  channel: "in_app" | "push" | "none";
  reason: string;
  targetDeviceId?: string;
  pushDevices?: NotificationDeviceSnapshot[];
}

export interface NotificationDispatchResult {
  channel: "in_app" | "push" | "none";
  notificationId?: string;
  reason: string;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceSnapshot = {
  notificationsEnabled: true,
  inAppNotificationsEnabled: true,
  messageNotificationsEnabled: true,
  socialNotificationsEnabled: true,
  gameNotificationsEnabled: true,
  achievementNotificationsEnabled: true,
  giftNotificationsEnabled: true,
  storyNotificationsEnabled: true,
  streakNotificationsEnabled: true,
  badgeCountEnabled: true,
};

function timestampToMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((entry) => removeUndefined(entry))
      .filter((entry) => entry !== undefined) as T;
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (entry === undefined) continue;
      next[key] = removeUndefined(entry);
    }
    return next as T;
  }

  return value;
}

function buildNotificationId(dedupeKey: string): string {
  return createHash("sha256").update(dedupeKey).digest("hex").slice(0, 40);
}

function isRecipientViewingConversation(
  session: NotificationSessionSnapshot,
  request: NotificationRequest,
): boolean {
  if (!request.conversationId || !session.currentChatId) return false;
  if (session.currentChatId !== request.conversationId) return false;
  if (!request.conversationScope) return true;
  if (request.conversationScope === "group") {
    return (
      session.currentConversationScope === "group" ||
      session.currentScreen === "GroupChat"
    );
  }
  return (
    session.currentConversationScope === "dm" ||
    session.currentScreen === "ChatDetail"
  );
}

function isRecipientViewingGame(
  session: NotificationSessionSnapshot,
  request: NotificationRequest,
): boolean {
  if (!request.sessionId || !session.currentGameSessionId) return false;
  return request.sessionId === session.currentGameSessionId;
}

function isRecipientViewingGameInvite(
  session: NotificationSessionSnapshot,
  request: NotificationRequest,
): boolean {
  if (!request.inviteId || !session.currentGameInviteId) return false;
  return request.inviteId === session.currentGameInviteId;
}

function isRecipientViewingEquivalentSurface(
  session: NotificationSessionSnapshot,
  request: NotificationRequest,
): boolean {
  if (isRecipientViewingConversation(session, request)) return true;
  if (isRecipientViewingGame(session, request)) return true;
  if (isRecipientViewingGameInvite(session, request)) return true;

  if (
    request.type === "friend_request" ||
    request.type === "friend_request_accepted"
  ) {
    return session.currentScreen === "Friends";
  }

  if (request.type === "achievement_unlocked") {
    return (
      session.currentScreen === "AchievementsHub" ||
      session.currentScreen === "AchievementSection"
    );
  }

  if (request.type === "gift_received" || request.type === "gift_opened") {
    return (
      session.currentScreen === "Wallet" ||
      session.currentScreen === "PurchaseHistory"
    );
  }

  if (
    request.type === "message_request" &&
    (session.currentScreen === "ChatList" ||
      session.currentScreen === "Friends")
  ) {
    return true;
  }

  return false;
}

async function getNotificationPreferences(
  uid: string,
): Promise<NotificationPreferenceSnapshot> {
  try {
    const inboxDoc = await db
      .collection("Users")
      .doc(uid)
      .collection("settings")
      .doc("inbox")
      .get();

    if (!inboxDoc.exists) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(inboxDoc.data() as Partial<NotificationPreferenceSnapshot>),
    };
  } catch (error) {
    functions.logger.warn("[notificationCenter] Failed to read preferences", {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

function categoryEnabledForEvent(
  prefs: NotificationPreferenceSnapshot,
  type: NotificationEventType,
): boolean {
  switch (type) {
    case "dm_message":
    case "group_message":
    case "message_request":
      return prefs.messageNotificationsEnabled;
    case "friend_request":
    case "friend_request_accepted":
      return prefs.socialNotificationsEnabled;
    case "game_invite":
    case "game_lobby_ready":
    case "game_turn":
    case "game_resolved":
      return prefs.gameNotificationsEnabled;
    case "achievement_unlocked":
    case "cosmetic_unlock":
      return prefs.achievementNotificationsEnabled;
    case "gift_received":
    case "gift_opened":
      return prefs.giftNotificationsEnabled;
    case "streak_milestone":
    case "streak_at_risk":
      return prefs.streakNotificationsEnabled;
    case "story_viewed":
      return prefs.storyNotificationsEnabled;
    default:
      return true;
  }
}

async function isConversationMuted(
  uid: string,
  conversationId: string,
  scope: "dm" | "group",
): Promise<boolean> {
  if (scope === "dm") {
    return isDmChatMuted(conversationId, uid);
  }
  return isGroupChatMuted(conversationId, uid);
}

async function getFreshNotificationSessions(
  uid: string,
): Promise<NotificationSessionSnapshot[]> {
  const now = Date.now();
  const snapshot = await db
    .collection("Users")
    .doc(uid)
    .collection("NotificationSessions")
    .get();

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        deviceId: docSnap.id,
        appState: String(data.appState ?? "unknown"),
        currentScreen:
          typeof data.currentScreen === "string" ? data.currentScreen : null,
        currentChatId:
          typeof data.currentChatId === "string" ? data.currentChatId : null,
        currentConversationScope:
          typeof data.currentConversationScope === "string"
            ? data.currentConversationScope
            : null,
        currentGameSessionId:
          typeof data.currentGameSessionId === "string"
            ? data.currentGameSessionId
            : null,
        currentGameInviteId:
          typeof data.currentGameInviteId === "string"
            ? data.currentGameInviteId
            : null,
        currentGameRuntimeType:
          typeof data.currentGameRuntimeType === "string"
            ? data.currentGameRuntimeType
            : null,
        inAppEnabled: data.inAppEnabled !== false,
        updatedAtMs: timestampToMillis(data.updatedAt ?? data.lastHeartbeatAt),
      };
    })
    .filter(
      (session) =>
        session.updatedAtMs > 0 &&
        now - session.updatedAtMs <= NOTIFICATION_SESSION_STALE_MS,
    )
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

async function getPushDevices(
  uid: string,
): Promise<NotificationDeviceSnapshot[]> {
  const devicesSnap = await db
    .collection("Users")
    .doc(uid)
    .collection("NotificationDevices")
    .get();

  const tokenSeen = new Set<string>();
  const devices: NotificationDeviceSnapshot[] = [];

  for (const docSnap of devicesSnap.docs) {
    const data = docSnap.data();
    if (data.pushEnabled === false) continue;
    const token =
      typeof data.expoPushToken === "string" ? data.expoPushToken : null;
    if (!token || tokenSeen.has(token)) continue;
    tokenSeen.add(token);
    devices.push({
      deviceId: docSnap.id,
      expoPushToken: token,
      platform: typeof data.platform === "string" ? data.platform : null,
    });
  }

  return devices;
}

async function chooseNotificationDecision(
  request: NotificationRequest,
  prefs: NotificationPreferenceSnapshot,
): Promise<NotificationDecision> {
  if (!prefs.notificationsEnabled) {
    return { channel: "none", reason: "global_notifications_disabled" };
  }

  if (!categoryEnabledForEvent(prefs, request.type)) {
    return { channel: "none", reason: "category_notifications_disabled" };
  }

  if (
    request.respectConversationMute &&
    request.conversationId &&
    request.conversationScope
  ) {
    const muted = await isConversationMuted(
      request.recipientUid,
      request.conversationId,
      request.conversationScope,
    );
    if (muted) {
      return { channel: "none", reason: "conversation_muted" };
    }
  }

  const sessions = await getFreshNotificationSessions(request.recipientUid);
  const activeSessions = sessions.filter(
    (session) => session.appState === "active",
  );

  if (
    activeSessions.some((session) =>
      isRecipientViewingEquivalentSurface(session, request),
    )
  ) {
    return { channel: "none", reason: "already_viewing_target" };
  }

  if (activeSessions.length > 0) {
    if (!prefs.inAppNotificationsEnabled) {
      return {
        channel: "none",
        reason: "active_session_but_in_app_disabled",
      };
    }

    const targetSession = activeSessions.find(
      (session) => session.inAppEnabled,
    );
    if (!targetSession) {
      return {
        channel: "none",
        reason: "active_session_local_banners_disabled",
      };
    }

    return {
      channel: "in_app",
      reason: "active_session_available",
      targetDeviceId: targetSession.deviceId,
    };
  }

  const pushDevices = await getPushDevices(request.recipientUid);

  // Filter out the sender's device tokens to prevent self-notifications.
  // This handles the case where a device was previously logged into the
  // recipient's account and the push token wasn't fully cleaned up on logout.
  const excludeSet = new Set(request.excludeTokens ?? []);
  const filteredDevices =
    excludeSet.size > 0
      ? pushDevices.filter((d) => !excludeSet.has(d.expoPushToken))
      : pushDevices;

  if (filteredDevices.length === 0) {
    return { channel: "none", reason: "no_push_devices" };
  }

  return {
    channel: "push",
    reason: "no_active_session",
    pushDevices: filteredDevices,
  };
}

function buildNotificationDoc(
  request: NotificationRequest,
  decision: NotificationDecision,
  prefs: NotificationPreferenceSnapshot,
) {
  const payloadData = removeUndefined({
    notificationId: buildNotificationId(request.dedupeKey),
    dedupeKey: request.dedupeKey,
    collapseKey: request.collapseKey ?? request.dedupeKey,
    type: request.type,
    actorUid: request.actorUid ?? null,
    actorName: request.actorName ?? null,
    conversationId: request.conversationId ?? null,
    conversationScope: request.conversationScope ?? null,
    requestId: request.requestId ?? null,
    sessionId: request.sessionId ?? null,
    inviteId: request.inviteId ?? null,
    gameId: request.gameId ?? null,
    sectionId: request.sectionId ?? null,
    giftId: request.giftId ?? null,
    friendshipId: request.friendshipId ?? null,
    route: removeUndefined(request.route),
    ...request.data,
  });

  return removeUndefined({
    recipientUid: request.recipientUid,
    type: request.type,
    category: request.category,
    dedupeKey: request.dedupeKey,
    collapseKey: request.collapseKey ?? request.dedupeKey,
    title: request.title,
    subtitle: request.subtitle ?? null,
    body: request.body,
    actorUid: request.actorUid ?? null,
    actorName: request.actorName ?? null,
    conversationId: request.conversationId ?? null,
    conversationScope: request.conversationScope ?? null,
    requestId: request.requestId ?? null,
    sessionId: request.sessionId ?? null,
    inviteId: request.inviteId ?? null,
    gameId: request.gameId ?? null,
    sectionId: request.sectionId ?? null,
    giftId: request.giftId ?? null,
    friendshipId: request.friendshipId ?? null,
    route: removeUndefined(request.route),
    data: payloadData,
    channel: decision.channel,
    deliveryReason: decision.reason,
    targetDeviceId: decision.targetDeviceId ?? null,
    pushTargetDeviceIds:
      decision.pushDevices?.map((device) => device.deviceId) ?? [],
    pushSentAt: null,
    presentedAt: null,
    readAt: null,
    archivedAt: null,
    badgeEligible:
      prefs.badgeCountEnabled && (request.badgeEligible ?? true) === true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function createNotificationRecordIfNeeded(
  request: NotificationRequest,
  decision: NotificationDecision,
  prefs: NotificationPreferenceSnapshot,
): Promise<{ notificationId: string; created: boolean }> {
  const notificationId = buildNotificationId(request.dedupeKey);
  const ref = db
    .collection("Users")
    .doc(request.recipientUid)
    .collection("Notifications")
    .doc(notificationId);

  try {
    await ref.create(buildNotificationDoc(request, decision, prefs));
    return { notificationId, created: true };
  } catch (error: any) {
    if (error?.code === 6 || error?.code === "already-exists") {
      return { notificationId, created: false };
    }
    throw error;
  }
}

async function cleanupInvalidPushTarget(
  uid: string,
  deviceId: string,
): Promise<void> {
  if (deviceId === "legacy") {
    await db.collection("Users").doc(uid).set(
      {
        expoPushToken: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );
    return;
  }

  await db
    .collection("Users")
    .doc(uid)
    .collection("NotificationDevices")
    .doc(deviceId)
    .set(
      {
        expoPushToken: null,
        pushEnabled: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

async function getUnreadBadgeCount(uid: string): Promise<number> {
  const unreadSnap = await db
    .collection("Users")
    .doc(uid)
    .collection("Notifications")
    .where("badgeEligible", "==", true)
    .where("readAt", "==", null)
    .get();

  return unreadSnap.size;
}

function resolveAndroidChannelId(request: NotificationRequest): string {
  if (request.androidChannelId) return request.androidChannelId;
  switch (request.type) {
    case "dm_message":
    case "group_message":
    case "message_request":
      return "messages";
    case "friend_request":
    case "friend_request_accepted":
    case "story_viewed":
      return "social";
    case "game_invite":
    case "game_lobby_ready":
    case "game_turn":
    case "game_resolved":
      return "game-invites";
    case "achievement_unlocked":
    case "cosmetic_unlock":
    case "streak_milestone":
    case "streak_at_risk":
      return "achievements";
    case "gift_received":
    case "gift_opened":
      return "social";
    default:
      return "default";
  }
}

function resolveIosThreadId(request: NotificationRequest): string | null {
  if (request.iosThreadId) return request.iosThreadId;
  if (request.conversationId) {
    return `${request.conversationScope ?? "chat"}-${request.conversationId}`;
  }
  if (request.sessionId) return `game-${request.sessionId}`;
  if (request.inviteId) return `invite-${request.inviteId}`;
  switch (request.type) {
    case "friend_request":
    case "friend_request_accepted":
      return "social";
    case "achievement_unlocked":
    case "cosmetic_unlock":
    case "streak_milestone":
    case "streak_at_risk":
      return "achievements";
    case "gift_received":
    case "gift_opened":
      return "gifts";
    default:
      return null;
  }
}

async function sendPushNotifications(
  request: NotificationRequest,
  notificationId: string,
  pushDevices: NotificationDeviceSnapshot[],
  prefs: NotificationPreferenceSnapshot,
): Promise<void> {
  const badgeCount = prefs.badgeCountEnabled
    ? await getUnreadBadgeCount(request.recipientUid)
    : undefined;

  const channelId = resolveAndroidChannelId(request);
  const threadId = resolveIosThreadId(request);

  const messages = pushDevices.map((device) =>
    removeUndefined({
      to: device.expoPushToken,
      title: request.title,
      subtitle: request.subtitle ?? undefined,
      body: request.body,
      sound: "default",
      badge: badgeCount,
      data: removeUndefined({
        notificationId,
        dedupeKey: request.dedupeKey,
        collapseKey: request.collapseKey ?? request.dedupeKey,
        type: request.type,
        actorUid: request.actorUid ?? null,
        actorName: request.actorName ?? null,
        conversationId: request.conversationId ?? null,
        conversationScope: request.conversationScope ?? null,
        requestId: request.requestId ?? null,
        sessionId: request.sessionId ?? null,
        inviteId: request.inviteId ?? null,
        gameId: request.gameId ?? null,
        sectionId: request.sectionId ?? null,
        giftId: request.giftId ?? null,
        friendshipId: request.friendshipId ?? null,
        route: removeUndefined(request.route),
        ...request.data,
      }),
      channelId,
      categoryId: request.iosCategoryId ?? undefined,
      _contentAvailable: true,
      collapseId: request.collapseKey ?? request.dedupeKey,
      ...(threadId ? { threadId } : {}),
    }),
  );

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Expo push request failed (${response.status}): ${body}`);
  }

  const result = (await response.json()) as { data?: any[] };
  const results: any[] = Array.isArray(result?.data) ? result.data : [];

  await Promise.all(
    results.map(async (entry: any, index: number) => {
      const errorCode = entry?.details?.error;
      if (errorCode !== "DeviceNotRegistered") return;
      const device = pushDevices[index];
      if (!device) return;
      await cleanupInvalidPushTarget(request.recipientUid, device.deviceId);
    }),
  );

  await db
    .collection("Users")
    .doc(request.recipientUid)
    .collection("Notifications")
    .doc(notificationId)
    .set(
      {
        pushSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function notifyUser(
  request: NotificationRequest,
): Promise<NotificationDispatchResult> {
  const prefs = await getNotificationPreferences(request.recipientUid);
  const decision = await chooseNotificationDecision(request, prefs);

  functions.logger.info("[notificationCenter] Decision", {
    recipientUid: request.recipientUid,
    type: request.type,
    channel: decision.channel,
    reason: decision.reason,
  });

  if (decision.channel === "none") {
    return {
      channel: "none",
      reason: decision.reason,
    };
  }

  const record = await createNotificationRecordIfNeeded(
    request,
    decision,
    prefs,
  );
  if (!record.created) {
    functions.logger.info("[notificationCenter] Duplicate suppressed", {
      recipientUid: request.recipientUid,
      type: request.type,
      notificationId: record.notificationId,
    });
    return {
      channel: decision.channel,
      notificationId: record.notificationId,
      reason: "duplicate_suppressed",
    };
  }

  if (decision.channel === "push" && decision.pushDevices?.length) {
    try {
      await sendPushNotifications(
        request,
        record.notificationId,
        decision.pushDevices,
        prefs,
      );
      functions.logger.info("[notificationCenter] Push sent", {
        recipientUid: request.recipientUid,
        type: request.type,
        deviceCount: decision.pushDevices.length,
      });
    } catch (error) {
      functions.logger.error("[notificationCenter] Failed to send push", {
        recipientUid: request.recipientUid,
        notificationId: record.notificationId,
        type: request.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    channel: decision.channel,
    notificationId: record.notificationId,
    reason: decision.reason,
  };
}
