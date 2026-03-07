export function formatUnreadBadge(unreadCount: number): string {
  if (unreadCount <= 0) return "";
  return unreadCount > 99 ? "99+" : String(unreadCount);
}
