# CAMERA SYSTEM - INFRASTRUCTURE INTEGRATION GUIDE

## Overview

This document outlines how to integrate the new camera system with existing project infrastructure (chat, story, profile, notifications).

---

## 1. CHAT SYSTEM INTEGRATION

### 1.1 Send Snap in Direct Message

#### Step 1: Extend Chat Types

**File**: `src/types/chat.ts` (or create if missing)

```typescript
export type MessageType = "text" | "image" | "snap" | "voice" | "video";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderDisplayName: string;
  senderAvatar?: string;

  type: MessageType;
  content: string; // For text messages

  // Snap-specific fields
  snapId?: string; // Reference to snap document
  snapThumbnail?: string; // Thumbnail URL for preview
  snapStatus?: "delivered" | "viewed" | "failed";
  snapViewedAt?: number;

  // Base fields
  createdAt: number;
  updatedAt: number;
  editedAt?: number;
  reactions: MessageReaction[];
  replies: number; // Count of replies
}

export interface SnapMessage extends ChatMessage {
  type: "snap";
  snapId: string;
  snapThumbnail: string;
}
```

#### Step 2: Create Snap Message Service

**File**: `src/services/chat/snapMessageService.ts` (new)

```typescript
import { ChatMessage, SnapMessage } from "../../types/chat";
import { Snap } from "../../types/camera";
import { firestore } from "../../config/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

/**
 * Send a snap as a chat message
 */
export async function sendSnapToChat(
  snap: Snap,
  conversationId: string,
  senderId: string,
): Promise<string> {
  try {
    const snapMessage: SnapMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      conversationId,
      senderId,
      senderDisplayName: snap.senderDisplayName,
      senderAvatar: snap.senderAvatar,
      type: "snap",
      content: snap.caption || "",
      snapId: snap.id,
      snapThumbnail: snap.mediaUrl, // Use first frame for video
      snapStatus: "delivered",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reactions: [],
      replies: 0,
    };

    const messageRef = await addDoc(
      collection(firestore, "conversations", conversationId, "messages"),
      snapMessage,
    );

    // Update conversation with latest message
    await updateDoc(doc(firestore, "conversations", conversationId), {
      lastMessage: snapMessage.content || "[Snap]",
      lastMessageType: "snap",
      lastMessageTime: Date.now(),
      lastMessageSenderId: senderId,
    });

    return messageRef.id;
  } catch (error) {
    console.error("[Snap Message Service] Failed to send snap to chat:", error);
    throw error;
  }
}

/**
 * Record snap view in chat context
 */
export async function recordSnapViewInChat(
  conversationId: string,
  messageId: string,
  userId: string,
): Promise<void> {
  try {
    const messageRef = doc(
      firestore,
      "conversations",
      conversationId,
      "messages",
      messageId,
    );

    await updateDoc(messageRef, {
      snapStatus: "viewed",
      snapViewedAt: Date.now(),
    });
  } catch (error) {
    console.error("[Snap Message Service] Failed to record snap view:", error);
    throw error;
  }
}
```

#### Step 3: Update Chat Screen

**File**: `src/screens/chat/ChatScreen.tsx` (modify)

```typescript
import { sendSnapToChat, recordSnapViewInChat } from '../../services/chat/snapMessageService';

// In message rendering:
const renderMessage = (message: ChatMessage) => {
  if (message.type === 'snap') {
    return (
      <TouchableOpacity
        onPress={() => {
          // Record view
          recordSnapViewInChat(conversationId, message.id, userId);
          // Navigate to snap viewer
          navigation.navigate('SnapViewer', { snap: message });
        }}
      >
        <Image source={{ uri: message.snapThumbnail }} style={styles.snapPreview} />
        <Text style={styles.snapIndicator}>📸 Snap</Text>
      </TouchableOpacity>
    );
  }
  // ... other message types
};

// In send action:
const handleSendSnap = async (snap: Snap) => {
  try {
    const messageId = await sendSnapToChat(snap, conversationId, userId);
    // Update UI with new message
  } catch (error) {
    console.error('Failed to send snap:', error);
  }
};
```

---

## 2. STORY SYSTEM INTEGRATION

### 2.1 Story Snaps Display

#### Step 1: Extend Story Types

**File**: `src/types/story.ts` (or create if missing)

```typescript
export interface StoryItem {
  id: string; // Snap ID
  snapId: string;
  userId: string;
  displayName: string;
  avatar?: string;
  mediaUrl: string;
  duration?: number;
  caption?: string;
  createdAt: number;
  expiresAt: number; // 24 hours from creation
  viewedBy: number; // Count
  isViewed: boolean;
}

export interface StoryUser {
  userId: string;
  displayName: string;
  avatar?: string;
  stories: StoryItem[];
  latestStoryTime: number;
  progressPercentage: number; // For ring animation
}
```

#### Step 2: Create Story Query Service

**File**: `src/services/story/storyService.ts` (new or extend)

```typescript
import { Snap } from "../../types/camera";
import { StoryItem, StoryUser } from "../../types/story";
import { firestore } from "../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
} from "firebase/firestore";

/**
 * Get visible stories for user
 * Stories from friends, sorted by most recent first
 */
export async function getVisibleStories(
  userId: string,
  friendIds: string[],
): Promise<StoryUser[]> {
  try {
    const now = Date.now();
    const storyUsers: Map<string, StoryUser> = new Map();

    // Query snaps from friends that are marked as story
    const q = query(
      collection(firestore, "Snaps"),
      where("senderId", "in", friendIds),
      where("storyVisible", "==", true),
      where("storyExpiresAt", ">", now), // Not expired
      orderBy("createdAt", "desc"),
    );

    const querySnapshot = await getDocs(q);

    for (const doc of querySnapshot.docs) {
      const snap = doc.data() as Snap;
      const senderId = snap.senderId;

      if (!storyUsers.has(senderId)) {
        storyUsers.set(senderId, {
          userId: senderId,
          displayName: snap.senderDisplayName,
          avatar: snap.senderAvatar,
          stories: [],
          latestStoryTime: snap.createdAt,
          progressPercentage: calculateProgressPercentage(
            snap.createdAt,
            snap.storyExpiresAt!,
          ),
        });
      }

      const storyUser = storyUsers.get(senderId)!;
      const viewedCount = snap.viewedBy?.length || 0;
      const isViewed = snap.viewedBy?.some((v) => v.userId === userId) || false;

      storyUser.stories.push({
        id: doc.id,
        snapId: snap.id,
        userId: senderId,
        displayName: snap.senderDisplayName,
        avatar: snap.senderAvatar,
        mediaUrl: snap.mediaUrl,
        duration: snap.duration,
        caption: snap.caption,
        createdAt: snap.createdAt,
        expiresAt: snap.storyExpiresAt!,
        viewedBy: viewedCount,
        isViewed,
      });
    }

    return Array.from(storyUsers.values()).sort(
      (a, b) => b.latestStoryTime - a.latestStoryTime,
    );
  } catch (error) {
    console.error("[Story Service] Failed to get visible stories:", error);
    throw error;
  }
}

/**
 * Calculate progress percentage for story ring
 * 0% = just posted, 100% = about to expire
 */
function calculateProgressPercentage(
  createdAt: number,
  expiresAt: number,
): number {
  const total = expiresAt - createdAt;
  const elapsed = Date.now() - createdAt;
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}
```

#### Step 3: Create Story Screen Component

**File**: `src/screens/story/StoryScreen.tsx` (new or extend)

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Image,
  Dimensions,
} from 'react-native';
import { getVisibleStories } from '../../services/story/storyService';
import { StoryUser } from '../../types/story';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const StoryScreen: React.FC<{ userId: string; friendIds: string[] }> = ({
  userId,
  friendIds,
}) => {
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStories();
    const interval = setInterval(loadStories, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const loadStories = async () => {
    try {
      const stories = await getVisibleStories(userId, friendIds);
      setStoryUsers(stories);
    } catch (error) {
      console.error('Failed to load stories:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {storyUsers.map((storyUser) => (
          <StoryRing
            key={storyUser.userId}
            user={storyUser}
            onPress={() => {
              // Navigate to story viewer
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const StoryRing: React.FC<{
  user: StoryUser;
  onPress: () => void;
}> = ({ user, onPress }) => (
  <TouchableOpacity style={styles.ringContainer} onPress={onPress}>
    {/* Ring progress indicator */}
    <View
      style={[
        styles.ring,
        {
          borderColor: user.progressPercentage < 100 ? '#FF6B9D' : '#ccc',
          borderWidth: 3,
        },
      ]}
    >
      <Image
        source={{ uri: user.avatar || 'https://via.placeholder.com/60' }}
        style={styles.avatar}
      />
    </View>
    <Text style={styles.name}>{user.displayName}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    backgroundColor: '#000',
  },
  ringContainer: {
    marginHorizontal: 8,
    alignItems: 'center',
  },
  ring: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  name: {
    color: '#fff',
    fontSize: 12,
    width: 70,
    textAlign: 'center',
  },
});
```

---

## 3. PROFILE SYSTEM INTEGRATION

### 3.1 User Snap Gallery

#### Step 1: Extend Profile Types

**File**: `src/types/profile.ts` (modify)

```typescript
export interface UserProfile {
  // ... existing fields

  // Snap stats
  totalSnaps: number;
  favoriteSnaps: string[]; // Array of snap IDs
  snapPrivacy: "public" | "friends" | "private";
}
```

#### Step 2: Add Snap Gallery to Profile Screen

**File**: `src/screens/profile/ProfileScreen.tsx` (modify)

```typescript
import { getUserSnaps, getSnapStatistics } from '../../services/camera/snapService';
import { Snap } from '../../types/camera';

// In ProfileScreen component:
const [userSnaps, setUserSnaps] = useState<Snap[]>([]);

useEffect(() => {
  const loadUserSnaps = async () => {
    try {
      const snaps = await getUserSnaps(userId, 12); // Get 12 most recent
      setUserSnaps(snaps);
    } catch (error) {
      console.error('Failed to load user snaps:', error);
    }
  };

  loadUserSnaps();
}, [userId]);

// In render:
<View style={styles.snapGallery}>
  <Text style={styles.sectionTitle}>Snap Gallery</Text>
  <FlatList
    data={userSnaps}
    numColumns={3}
    keyExtractor={(snap) => snap.id}
    renderItem={({ item: snap }) => (
      <TouchableOpacity
        style={styles.snapThumbnail}
        onPress={() => navigation.navigate('SnapDetail', { snap })}
      >
        <Image source={{ uri: snap.mediaUrl }} style={styles.snapImage} />
        <View style={styles.snapOverlay}>
          <Text style={styles.viewCount}>👁 {snap.viewedBy?.length || 0}</Text>
        </View>
      </TouchableOpacity>
    )}
  />
</View>
```

---

## 4. NOTIFICATION SYSTEM INTEGRATION

### 4.1 Snap Event Notifications

#### Step 1: Create Snap Notification Service

**File**: `src/services/notifications/snapNotificationService.ts` (new)

```typescript
import * as Notifications from "expo-notifications";
import { Snap } from "../../types/camera";

export enum SnapNotificationType {
  SNAP_RECEIVED = "snap_received",
  SNAP_VIEWED = "snap_viewed",
  SNAP_SCREENSHOTTED = "snap_screenshotted",
  SNAP_REPLIED = "snap_replied",
  SNAP_REACTED = "snap_reacted",
}

/**
 * Send notification when snap is received
 */
export async function notifySnapReceived(snap: Snap): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `📸 Snap from ${snap.senderDisplayName}`,
      body: snap.caption || "Tap to view",
      sound: "default",
      badge: 1,
      data: {
        type: SnapNotificationType.SNAP_RECEIVED,
        snapId: snap.id,
      },
    },
    trigger: { seconds: 1 },
  });
}

/**
 * Send notification when snap is viewed
 */
export async function notifySnapViewed(
  snap: Snap,
  viewerDisplayName: string,
): Promise<void> {
  if (!snap.screenshotNotification) return; // Respect notification settings

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `👀 ${viewerDisplayName} viewed your snap`,
      sound: "default",
      data: {
        type: SnapNotificationType.SNAP_VIEWED,
        snapId: snap.id,
      },
    },
    trigger: { seconds: 1 },
  });
}

/**
 * Send notification when snap is screenshotted
 */
export async function notifySnapScreenshotted(
  snap: Snap,
  screenshotterName: string,
): Promise<void> {
  if (!snap.screenshotNotification) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚠️ ${screenshotterName} took a screenshot!`,
      sound: "alert",
      data: {
        type: SnapNotificationType.SNAP_SCREENSHOTTED,
        snapId: snap.id,
      },
    },
    trigger: { seconds: 1 },
  });
}
```

#### Step 2: Hook Notifications into Snap Service

**File**: `src/services/camera/snapService.ts` (modify)

```typescript
import * as SnapNotifications from "../notifications/snapNotificationService";

// In viewSnap function:
export async function viewSnap(
  snapId: string,
  userId: string,
  screenshotTaken: boolean,
): Promise<void> {
  // ... existing code ...

  // Send notification to snap owner
  const snap = await getSnap(snapId);
  if (snap && snap.senderId !== userId) {
    const viewer = await getUser(userId);
    await SnapNotifications.notifySnapViewed(snap, viewer.displayName);

    if (screenshotTaken) {
      await SnapNotifications.notifySnapScreenshotted(snap, viewer.displayName);
    }
  }
}
```

---

## 5. NAVIGATION SETUP

### 5.1 Add Camera Screens to Main Navigation

**File**: `src/navigation/RootNavigator.tsx` (modify)

```typescript
import CameraScreen from '../screens/camera/CameraScreen';
import EditorScreen from '../screens/camera/EditorScreen';
import ShareScreen from '../screens/camera/ShareScreen';
import SnapViewerScreen from '../screens/camera/SnapViewerScreen';

export const RootNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
        }}
      >
        {/* Existing screens */}

        {/* Camera Stack */}
        <Stack.Screen
          name="Camera"
          component={CameraScreen}
          options={{
            animationEnabled: false, // Smooth camera preview
          }}
        />
        <Stack.Screen
          name="CameraEditor"
          component={EditorScreen}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
        <Stack.Screen
          name="CameraShare"
          component={ShareScreen}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
        <Stack.Screen
          name="SnapViewer"
          component={SnapViewerScreen}
          options={{
            animationEnabled: true,
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

---

## 6. FIRESTORE SCHEMA UPDATES

### 6.1 Collection Structure

```
/Snaps
  /{snapId}
    - id: string
    - senderId: string
    - mediaUrl: string
    - storyVisible: boolean
    - storyExpiresAt?: number
    - viewedBy[]: SnapView
    - reactions[]: SnapReaction
    - replies[]: SnapReply
    - createdAt: number
    - updatedAt: number

/conversations
  /{conversationId}
    /messages
      /{messageId}
        - type: 'snap'
        - snapId: string
        - snapThumbnail: string
        - snapStatus: 'delivered'|'viewed'|'failed'
        - createdAt: number

/Stories
  /{storyItemId}
    - snapId: string
    - userId: string
    - expiresAt: number
    - viewedBy: number
    - createdAt: number
```

### 6.2 Firestore Index for Stories

```
Collection: Snaps
Fields (Ascending): senderId, storyVisible, storyExpiresAt
Query: WHERE senderId IN [...], storyVisible == true, storyExpiresAt > now
```

---

## 7. SECURITY RULES

### 7.1 Snap Document Rules

**File**: `firestore.rules`

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Snaps - Creator can modify, recipients can read
    match /Snaps/{snapId} {
      allow read: if
        resource.data.senderId == request.auth.uid ||
        resource.data.recipients[user.userId].recipientType exists;
      allow create: if request.auth.uid != null;
      allow update, delete: if resource.data.senderId == request.auth.uid;
    }

    // Messages with snap type
    match /conversations/{conversationId}/messages/{messageId} {
      allow read: if
        get(/databases/$(database)/documents/conversations/$(conversationId))
          .data.participants[request.auth.uid] exists;
      allow create: if request.auth.uid != null;
      allow update, delete: if resource.data.senderId == request.auth.uid;
    }
  }
}
```

---

## 8. TESTING INTEGRATION

### 8.1 Test Camera Flow

```typescript
// __tests__/integration/cameraIntegration.test.ts
describe("Camera System Integration", () => {
  describe("Send snap to chat", () => {
    test("Should send snap as chat message", async () => {
      const snap = {
        /* snap object */
      };
      const messageId = await sendSnapToChat(snap, conversationId, userId);
      expect(messageId).toBeDefined();
    });
  });

  describe("Story visibility", () => {
    test("Should get visible stories for user", async () => {
      const stories = await getVisibleStories(userId, friendIds);
      expect(stories.length).toBeGreaterThan(0);
    });
  });

  describe("Notifications", () => {
    test("Should send snap received notification", async () => {
      await notifySnapReceived(snap);
      // Verify notification was scheduled
    });
  });
});
```

---

## 9. DEPLOYMENT CHECKLIST

- [ ] All import paths corrected
- [ ] Firebase rules deployed
- [ ] Firestore indexes created
- [ ] Navigation routes configured
- [ ] Services integrated
- [ ] Type definitions extended
- [ ] Permissions configured (Android/iOS)
- [ ] Dependencies installed
- [ ] Integration tests passing
- [ ] Manual testing completed

---

## 10. ROLLBACK PLAN

If integration fails:

1. **Remove Camera Routes**: Comment out in RootNavigator
2. **Disable Notifications**: Set SnapNotificationService to no-op
3. **Revert Firebase Rules**: Keep existing rules intact
4. **Database Cleanup**: Archive test snaps/messages

---

**Integration Guide Complete**  
All components ready for production integration.
