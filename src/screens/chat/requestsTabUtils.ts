export function getUnifiedRequestsCount(input: {
  friendRequestsCount: number;
  groupInvitesCount: number;
  messageRequestsCount: number;
}): number {
  return (
    input.friendRequestsCount +
    input.groupInvitesCount +
    input.messageRequestsCount
  );
}

export function isRequestsTabEmpty(requestItemsCount: number): boolean {
  return requestItemsCount === 0;
}
