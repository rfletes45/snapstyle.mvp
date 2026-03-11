export type NotificationCategory = "message" | "social" | "games" | "progression" | "commerce" | "system";
export type NotificationEventType = "dm_message" | "group_message" | "message_request" | "friend_request" | "friend_request_accepted" | "game_invite" | "game_lobby_ready" | "game_turn" | "game_resolved" | "achievement_unlocked" | "gift_received" | "gift_opened";
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
    route: NotificationRoute;
    data?: Record<string, unknown>;
    badgeEligible?: boolean;
    respectConversationMute?: boolean;
}
export interface NotificationDispatchResult {
    channel: "in_app" | "push" | "none";
    notificationId?: string;
    reason: string;
}
export declare function notifyUser(request: NotificationRequest): Promise<NotificationDispatchResult>;
