# Phase 20: Group Chat - COMPLETE ✅

## Overview

Phase 20 implements full group chat functionality with group creation, invites, roles, and messaging.

## Definition of Done (DoD)

✅ Create group, invite, message - Groups (3-20 members), invites, roles (owner/admin/member), text+image messages with pagination, blocked user restrictions

## Implementation Summary

### New Types Added (`src/types/models.ts`)

- `GroupRole` - "owner" | "admin" | "member"
- `Group` - Group document with name, owner, memberCount, lastMessage
- `GroupMember` - Member with uid, role, joinedAt, displayName, avatarConfig
- `GroupInvite` - Invite with groupId, fromUid, toUid, status, expiry
- `GroupMessage` - Message with sender, type, content, system metadata
- `ChatListItem` - Unified type for chat list display
- `GROUP_LIMITS` - Constants (MIN=3, MAX=20 members, 50 char name, 7 day invite expiry)

### New Service (`src/services/groups.ts`)

Full CRUD and real-time operations:

- `createGroup()` - Create group with initial member
- `sendGroupInvite()` / `acceptGroupInvite()` / `declineGroupInvite()` - Invite flow
- `getPendingInvites()` / `subscribeToPendingInvites()` - Query invites
- `getUserGroups()` / `subscribeToUserGroups()` - Get user's groups
- `getGroupMembers()` / `subscribeToGroupMembers()` - Member queries
- `leaveGroup()` / `removeMember()` - Membership management
- `changeMemberRole()` / `transferOwnership()` - Role management
- `sendGroupMessage()` / `subscribeToGroupMessages()` / `getGroupMessages()` - Messaging
- `updateLastRead()` - Read receipts
- `updateGroupName()` / `deleteGroup()` - Group management

### New Screens (`src/screens/groups/`)

#### GroupChatCreateScreen

- Group name input with character limit
- Multi-select friend list for initial members
- Validation (3-20 members required)
- Search/filter friends
- Create button sends invites

#### GroupChatScreen

- Real-time message subscription
- Text and image messaging
- System messages (member joined/left/removed)
- Sender display names with avatars
- Header tap navigates to info screen
- Image upload via camera or gallery

#### GroupChatInfoScreen

- View all members with role badges
- Owner can: change roles, remove members, edit name, delete group
- Admin can: remove members
- Member can: leave group
- Invite friends modal
- Edit group name modal

#### GroupInvitesScreen

- List pending invites with group info
- Accept/decline actions
- Expiry countdown display
- Real-time subscription
- Pull-to-refresh

### Updated Screens

#### ChatListScreen

- Now shows both DMs and group chats
- Group chats display with group icon
- Member count badge
- Sorted by last message time
- FAB button to create new group
- Header badge for pending invites

### Navigation Updates (`src/navigation/RootNavigator.tsx`)

New routes added to ChatStack:

- `GroupChatCreate` - New group creation
- `GroupChat` - Group messaging (params: groupId, groupName)
- `GroupChatInfo` - Group management (params: groupId)
- `GroupInvites` - Pending invites list

### Storage Updates (`src/services/storage.ts`)

- Added `uploadGroupImage()` for group chat images
- Storage path: `groups/{groupId}/messages/{messageId}.jpg`

### Firestore Rules (`firebase/firestore.rules`)

New rules for Groups collection:

- Members-only read access
- Owner/admin can add members
- Owner can change roles
- Members can leave (remove self)
- Messages: members can read/create, immutable

New rules for GroupInvites:

- Sender/recipient can read
- Sender creates with proper validation
- Recipient can accept/decline
- Either party can delete

### Firestore Indexes (`firebase/firestore.indexes.json`)

Added indexes for:

- Groups: memberIds + lastMessageAt
- Members (collection group): uid + joinedAt
- Messages: createdAt DESC
- GroupInvites: toUid + status + createdAt
- GroupInvites: groupId + toUid + status

## Data Model

### Collections

```
Groups/
  {groupId}/
    - name: string
    - ownerId: string
    - memberIds: string[] (for queries)
    - memberCount: number
    - lastMessageText?: string
    - lastMessageAt?: Timestamp
    - createdAt: Timestamp

    Members/
      {uid}/
        - uid: string
        - role: "owner" | "admin" | "member"
        - joinedAt: Timestamp
        - lastReadAt?: Timestamp
        - displayName: string
        - username: string
        - avatarConfig: AvatarConfig

    Messages/
      {messageId}/
        - id: string
        - groupId: string
        - senderUid: string
        - senderDisplayName: string
        - type: "text" | "image" | "system"
        - content: string
        - createdAt: Timestamp
        - systemType?: string
        - systemMeta?: object

GroupInvites/
  {inviteId}/
    - id: string
    - groupId: string
    - groupName: string
    - fromUid: string
    - fromDisplayName: string
    - toUid: string
    - status: "pending" | "accepted" | "declined"
    - createdAt: Timestamp
    - expiresAt: Timestamp
```

## Testing Checklist

- [ ] Create a new group with valid name
- [ ] Add 2+ friends when creating group
- [ ] Group appears in chat list
- [ ] Send text message in group
- [ ] Send image message in group
- [ ] See other member messages with names
- [ ] View group info screen
- [ ] Owner can change member roles
- [ ] Admin can remove members
- [ ] Member can leave group
- [ ] Invite friend from info screen
- [ ] Friend receives and accepts invite
- [ ] Friend sees group in their list
- [ ] Decline invite works
- [ ] Delete group (owner only)
- [ ] System messages for join/leave
- [ ] FAB creates new group from chat list
- [ ] Pending invites badge shows count

## Files Changed/Created

- `src/types/models.ts` - Extended with group types
- `src/services/groups.ts` - NEW (1200+ lines)
- `src/services/storage.ts` - Added uploadGroupImage
- `src/screens/groups/GroupChatCreateScreen.tsx` - NEW
- `src/screens/groups/GroupChatScreen.tsx` - NEW
- `src/screens/groups/GroupChatInfoScreen.tsx` - NEW
- `src/screens/groups/GroupInvitesScreen.tsx` - NEW
- `src/screens/chat/ChatListScreen.tsx` - Updated for groups
- `src/navigation/RootNavigator.tsx` - Added group routes
- `firebase/firestore.rules` - Added group rules
- `firebase/firestore.indexes.json` - Added group indexes

## Next Phase

Phase 21 can continue with additional features like:

- Group avatars/photos
- Message reactions in groups
- @mentions
- Group media gallery
- Pin messages
