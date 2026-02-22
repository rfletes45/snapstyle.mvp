/**
 * Social Game Stats — Counter increment helpers
 *
 * Server-side helpers for incrementing social game stats counters
 * used by the Achievements V2 evaluator.
 *
 * Firestore path: /users/{uid}/socialGameStats/counters
 *
 * @module socialGameStatsHelpers
 */
/**
 * Increment the invitesSent counter for a user.
 */
export declare function incrementInvitesSent(userId: string): Promise<void>;
/**
 * Increment the invitesAcceptedByOthers counter for the invite sender.
 */
export declare function incrementInvitesAccepted(senderUserId: string): Promise<void>;
/**
 * Increment the gamesWatched counter for a user.
 */
export declare function incrementGamesWatched(userId: string): Promise<void>;
/**
 * Increment the turnBasedRematchesCompleted counter for a user.
 */
export declare function incrementRematchesCompleted(userId: string): Promise<void>;
