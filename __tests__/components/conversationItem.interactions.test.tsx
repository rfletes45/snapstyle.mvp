/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import React from "react";
import { Text as RNText, TouchableOpacity, View } from "react-native";

import type { InboxConversation } from "../../src/types/messaging";

const renderer = require("react-test-renderer");
const { act } = renderer;

jest.mock("@/constants/theme", () => ({
  Spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
  },
}));

jest.mock("@/components/AppImage", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement(View, props),
  };
});

jest.mock("@/components/chat/TypingIndicator", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    TypingPreview: () => React.createElement(Text, null, "typing"),
  };
});

jest.mock("@/components/profile/ProfilePicture", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    ProfilePictureWithDecoration: (props: Record<string, unknown>) =>
      React.createElement(View, { ...props, testID: "profile-picture" }),
  };
});

jest.mock("@/store/ThemeContext", () => ({
  useAppTheme: () => ({
    colors: {
      background: "#ffffff",
      border: "#e5e7eb",
      primary: "#2563eb",
      success: "#16a34a",
      surfaceVariant: "#f3f4f6",
      text: "#111827",
      textMuted: "#9ca3af",
      textSecondary: "#6b7280",
    },
  }),
}));

jest.mock("@/utils/log", () => ({
  createLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
  isDebugEnabled: () => false,
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  return {
    MaterialCommunityIcons: (props: Record<string, unknown>) =>
      React.createElement("MaterialCommunityIcons", props),
  };
});

jest.mock("react-native-paper", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return {
    Badge: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(View, props, children),
    Text: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(Text, props, children),
  };
});

jest.mock("react-native-gesture-handler", () => ({
  TouchableOpacity: "RNGHTouchableOpacity",
}));

import { ConversationItem } from "../../src/components/chat/inbox/ConversationItem";

function makeConversation(
  overrides: Partial<InboxConversation> = {},
): InboxConversation {
  return {
    id: "chat-1",
    type: "dm",
    name: "Taylor",
    avatarUrl: null,
    profilePictureUrl: null,
    decorationId: null,
    otherUserId: "user-2",
    lastMessage: {
      text: "Hello",
      senderName: "Taylor",
      timestamp: Date.now(),
      type: "text",
    },
    memberState: {
      uid: "user-1",
      lastSeenAtPrivate: 0,
    },
    unreadCount: 1,
    hasMentions: false,
    isOnline: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("ConversationItem interactions", () => {
  it("wires tap, press-in, long-press, and avatar press through core RN touchables", () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    const onAvatarPress = jest.fn();
    const onLongPress = jest.fn();

    let tree: any;
    act(() => {
      tree = renderer.create(
        <ConversationItem
          conversation={makeConversation()}
          onPress={onPress}
          onPressIn={onPressIn}
          onAvatarPress={onAvatarPress}
          onLongPress={onLongPress}
        />,
      );
    });

    const touchables = tree.root.findAllByType(TouchableOpacity);
    expect(touchables).toHaveLength(2);

    const rowTouchable = touchables[0];
    const avatarTouchable = touchables[1];

    act(() => {
      rowTouchable.props.onPressIn({
        nativeEvent: { pageX: 12, pageY: 34 },
      });
    });
    expect(onPressIn).toHaveBeenCalledTimes(1);

    act(() => {
      rowTouchable.props.onLongPress({
        nativeEvent: { pageX: 56, pageY: 78 },
      });
    });
    expect(onLongPress).toHaveBeenCalledWith({ pageX: 56, pageY: 78 });

    act(() => {
      rowTouchable.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(0);

    act(() => {
      rowTouchable.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    act(() => {
      avatarTouchable.props.onPress();
    });
    expect(onAvatarPress).toHaveBeenCalledTimes(1);

    act(() => {
      avatarTouchable.props.onPressIn({
        nativeEvent: { pageX: 90, pageY: 120 },
      });
    });
    expect(onPressIn).toHaveBeenCalledTimes(2);

    act(() => {
      avatarTouchable.props.onLongPress({
        nativeEvent: { pageX: 91, pageY: 121 },
      });
    });
    expect(onLongPress).toHaveBeenLastCalledWith({ pageX: 91, pageY: 121 });

    act(() => {
      avatarTouchable.props.onPress();
    });
    expect(onAvatarPress).toHaveBeenCalledTimes(1);

    act(() => {
      avatarTouchable.props.onPress();
    });
    expect(onAvatarPress).toHaveBeenCalledTimes(2);

    expect(tree.root.findAllByType("RNGHTouchableOpacity")).toHaveLength(0);
    expect(tree.root.findAllByType(RNText).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(View).length).toBeGreaterThan(0);

    act(() => {
      tree.unmount();
    });
  });
});
