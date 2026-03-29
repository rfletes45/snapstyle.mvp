/**
 * SearchResultItem Component
 *
 * Renders a single search result in the search sheet.
 * Supports two result types:
 *   - Message result: shows sender, conversation context, snippet with highlight, timestamp
 *   - Conversation result: shows conversation name, last message preview
 *
 * @module components/chat/search/SearchResultItem
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { Spacing } from "@/constants/theme";
import type {
  ConversationSearchResult,
  MessageSearchResult,
  SearchResult,
} from "@/hooks/useMessageSearch";
import { useAppTheme } from "@/store/ThemeContext";
import { formatRelativeTime } from "@/utils/dates";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  onPress: (result: SearchResult) => void;
}

// =============================================================================
// Text Highlighting
// =============================================================================

function HighlightedText({
  text,
  query,
  style,
  numberOfLines,
}: {
  text: string;
  query: string;
  style?: any;
  numberOfLines?: number;
}) {
  const { colors } = useAppTheme();

  if (!query.trim()) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const normalizedQuery = query.toLowerCase();
  const normalizedText = text.toLowerCase();
  const matchIndex = normalizedText.indexOf(normalizedQuery);

  if (matchIndex === -1) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + query.length);
  const after = text.slice(matchIndex + query.length);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {before}
      <Text
        style={{
          backgroundColor: colors.primary + "30",
          color: colors.primary,
          fontWeight: "700",
        }}
      >
        {match}
      </Text>
      {after}
    </Text>
  );
}

// =============================================================================
// Content Type Icon
// =============================================================================

function ContentTypeIcon({ kind }: { kind: string }) {
  const { colors } = useAppTheme();

  const iconMap: Record<string, string> = {
    media: "image-outline",
    voice: "microphone-outline",
    file: "file-outline",
    animal: "paw",
  };

  const icon = iconMap[kind];
  if (!icon) return null;

  return (
    <MaterialCommunityIcons
      name={icon as any}
      size={14}
      color={colors.textSecondary}
      style={styles.contentIcon}
    />
  );
}

// =============================================================================
// Message Result
// =============================================================================

function MessageResult({
  result,
  query,
  onPress,
}: {
  result: MessageSearchResult;
  query: string;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();

  const timestamp = formatRelativeTime(result.timestamp);
  const snippetText =
    result.text.length > 150 ? result.text.slice(0, 150) + "…" : result.text;

  return (
    <TouchableOpacity
      style={[styles.resultRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`Message from ${result.senderName || "Unknown"} in ${result.conversationName}`}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <ProfilePictureWithDecoration
          pictureUrl={result.conversationAvatar}
          name={result.conversationName}
          decorationId={null}
          size={44}
        />
        {result.conversationScope === "group" && (
          <View
            style={[
              styles.scopeBadge,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="account-group"
              size={10}
              color={colors.primary}
            />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Top row: conversation name + timestamp */}
        <View style={styles.topRow}>
          <Text
            style={[styles.conversationName, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {result.conversationScope === "group" ? "#" : ""}{" "}
            {result.conversationName}
          </Text>
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {timestamp}
          </Text>
        </View>

        {/* Sender name */}
        {result.senderName && (
          <Text
            style={[styles.senderName, { color: colors.text }]}
            numberOfLines={1}
          >
            {result.senderName}
          </Text>
        )}

        {/* Image thumbnail for media messages */}
        {result.imageUrl && (
          <Image
            source={{ uri: result.thumbnailUrl || result.imageUrl }}
            style={styles.mediaThumbnail}
            resizeMode="cover"
          />
        )}

        {/* Message snippet with highlight */}
        <View style={styles.snippetRow}>
          <ContentTypeIcon kind={result.kind} />
          <HighlightedText
            text={snippetText || (result.kind === "media" ? "Photo" : "")}
            query={query}
            style={[styles.snippet, { color: colors.textSecondary }]}
            numberOfLines={2}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// Conversation Result
// =============================================================================

function ConversationResult({
  result,
  query,
  onPress,
}: {
  result: ConversationSearchResult;
  query: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const { conversation: c } = result;

  const lastMessageText = c.lastMessage?.text
    ? c.lastMessage.text.length > 100
      ? c.lastMessage.text.slice(0, 100) + "…"
      : c.lastMessage.text
    : c.type === "group"
      ? `${c.participantCount || 0} members`
      : "No messages yet";

  return (
    <TouchableOpacity
      style={[styles.resultRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`Conversation: ${c.name}`}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <ProfilePictureWithDecoration
          pictureUrl={c.profilePictureUrl || c.avatarUrl || null}
          name={c.name}
          decorationId={c.decorationId || null}
          size={44}
        />
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <View style={styles.topRow}>
          <HighlightedText
            text={c.name}
            query={query}
            style={[styles.conversationTitle, { color: colors.text }]}
            numberOfLines={1}
          />
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor:
                  c.type === "group"
                    ? colors.primaryContainer
                    : colors.surfaceVariant,
              },
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                {
                  color:
                    c.type === "group" ? colors.primary : colors.textSecondary,
                },
              ]}
            >
              {c.type === "group" ? "Group" : "DM"}
            </Text>
          </View>
        </View>
        <Text
          style={[styles.lastMessage, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {lastMessageText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function SearchResultItemInner({
  result,
  query,
  onPress,
}: SearchResultItemProps) {
  if (result.type === "message") {
    return (
      <MessageResult
        result={result}
        query={query}
        onPress={() => onPress(result)}
      />
    );
  }

  return (
    <ConversationResult
      result={result}
      query={query}
      onPress={() => onPress(result)}
    />
  );
}

export const SearchResultItem = memo(SearchResultItemInner);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  resultRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarContainer: {
    marginRight: 12,
    position: "relative",
  },
  scopeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  conversationName: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  senderName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: "400",
  },
  snippetRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  contentIcon: {
    marginRight: 4,
    marginTop: 2,
  },
  mediaThumbnail: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  snippet: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  conversationTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  lastMessage: {
    fontSize: 13,
    marginTop: 2,
  },
});
