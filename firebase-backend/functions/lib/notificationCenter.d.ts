export type NotificationCategory = "message" | "social" | "games" | "progression" | "commerce" | "system";
export type NotificationEventType = "dm_message" | "group_message" | "message_request" | "friend_request" | "friend_request_accepted" | "game_invite" | "game_lobby_ready" | "game_turn" | "game_resolved" | "achievement_unlocked" | "gift_received" | "gift_opened" | "streak_milestone" | "streak_at_risk" | "cosmetic_unlock" | "story_viewed";
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
export interface NotificationDispatchResult {
    channel: "in_app" | "push" | "none";
    notificationId?: string;
    reason: string;
}
export declare function notifyUser(request: NotificationRequest): Promise<NotificationDispatchResult>;
