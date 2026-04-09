/**
 * Messages (Chat Inbox) Components Index
 *
 * Components for the Snapchat-inspired Messages screen:
 * - InboxHeader: Top bar with avatar, title ("Messages"), games, search, actions
 * - InboxTabs: Filter tabs (All/Unread/Groups/DMs/Requests)
 * - ConversationItem: Single conversation row
 * - SwipeableConversation: Swipe gesture wrapper (pin, mute, delete)
 * - PinnedSection: Sticky pinned conversations header
 * - EmptyState: Empty state illustrations
 * - InboxFAB: Multi-action floating button
 * - ConversationContextMenu: Long-press context menu
 * - MuteOptionsSheet: Mute duration picker bottom sheet
 * - DeleteConfirmDialog: Conversation delete confirmation
 * - FriendRequestItem: Friend request row with accept/decline
 */

export { InboxHeader } from "./InboxHeader";
export type { InboxHeaderProps } from "./InboxHeader";

export { InboxTabs } from "./InboxTabs";
export type { InboxTabsProps } from "./InboxTabs";

export { ConversationItem } from "./ConversationItem";
export type { ConversationItemProps } from "./ConversationItem";

export { SwipeableConversation } from "./SwipeableConversation";
export type { SwipeableConversationProps } from "./SwipeableConversation";

export { PinnedSection } from "./PinnedSection";
export type { PinnedSectionProps } from "./PinnedSection";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { InboxFAB } from "./InboxFAB";
export type { InboxFABProps } from "./InboxFAB";

// Conversation Item Components
export { ConversationContextMenu } from "./ConversationContextMenu";
export type { ConversationContextMenuProps } from "./ConversationContextMenu";

export { MuteOptionsSheet } from "./MuteOptionsSheet";
export type { MuteOptionsSheetProps } from "./MuteOptionsSheet";

export { DeleteConfirmDialog } from "./DeleteConfirmDialog";
export type { DeleteConfirmDialogProps } from "./DeleteConfirmDialog";

// Friends Components
export { FriendRequestItem } from "./FriendRequestItem";
export type { FriendRequestItemProps } from "./FriendRequestItem";

export { GroupInviteItem } from "./GroupInviteItem";
export type { GroupInviteItemProps } from "./GroupInviteItem";

export { ContactsOnboardingCard } from "./ContactsOnboardingCard";
export type { ContactsOnboardingCardProps } from "./ContactsOnboardingCard";

export { MessageStatusIcon } from "./MessageStatusIcon";
export type { MessageStatusIconProps } from "./MessageStatusIcon";
