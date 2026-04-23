/**
 * CallInfoScreen
 *
 * Detail view for a single StreamCallHistory entry. Replaces the old
 * behavior of tapping a call row and opening the DM directly.
 *
 * Behavior matrix:
 *   - direct_audio: may show transcript section (policy + availability gated)
 *   - direct_video: informational "transcripts not available for video"
 *   - voice_room:   informational + "Open Group" / "Join Voice Channel"
 *
 * Actions:
 *   - Audio Call / Video Call (direct entries)
 *   - Open Chat / Open Group
 *   - Join Voice Channel (voice room entries that still map cleanly)
 *   - Save transcript to this device / Delete local transcript
 */

import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { CALL_FEATURES } from "@/constants/featureFlags";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { callSettingsService } from "@/services/calls";
import {
  deleteTranscriptLocal,
  getLatestTranscriptMetaForCall,
  getTranscriptMeta,
  getTranscriptSegments,
  upsertTranscriptMeta,
} from "@/services/calls/callTranscriptDb";
import { fetchAndPersistTranscript } from "@/services/calls/callTranscriptService";
import { prepareGroupChatNavigation } from "@/services/chat/threadIdentityWarmup";
import { getAuthInstance } from "@/services/firebase";
import { getStreamCallHistoryEntryById } from "@/services/stream";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  CallTranscriptMeta,
  CallTranscriptSegment,
  CallTranscriptStatus,
} from "@/types/callTranscript";
import type { MainStackParamList } from "@/types/navigation/root";
import type { StreamCallHistoryEntry } from "@/types/streamCallHistory";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = NativeStackScreenProps<MainStackParamList, "CallInfo">;

export default function CallInfoScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const { entryId, callId, sessionId } = route.params;
  const { startCall } = useStreamCall();

  const [entry, setEntry] = useState<StreamCallHistoryEntry | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(true);

  const [meta, setMeta] = useState<CallTranscriptMeta | null>(null);
  const [segments, setSegments] = useState<CallTranscriptSegment[]>([]);
  const [transcriptBusy, setTranscriptBusy] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const ownerUid = getAuthInstance().currentUser?.uid ?? null;

  const isAudioDirect = entry?.entryType === "direct_audio";
  const isVideoDirect = entry?.entryType === "direct_video";
  const isRoom = entry?.entryType === "voice_room";

  // -------------------------------------------------------------------------
  // Load entry
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEntry(true);
      const loaded = await getStreamCallHistoryEntryById(entryId);
      if (!cancelled) {
        setEntry(loaded);
        setLoadingEntry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  // -------------------------------------------------------------------------
  // Load transcript meta (only for audio direct)
  // -------------------------------------------------------------------------
  const refreshLocalTranscript = useCallback(async () => {
    if (!ownerUid || !callId) return;
    try {
      const m = sessionId
        ? await getTranscriptMeta(callId, sessionId, ownerUid)
        : await getLatestTranscriptMetaForCall(callId, ownerUid);
      setMeta(m);
      if (m && m.transcriptStatus === "saved_local") {
        const segs = await getTranscriptSegments(m.callId, m.sessionId);
        setSegments(segs);
      } else {
        setSegments([]);
      }
    } catch (err) {
      console.warn("[CallInfoScreen] refreshLocalTranscript failed", err);
    }
  }, [callId, sessionId, ownerUid]);

  useEffect(() => {
    if (!isAudioDirect) return;
    void refreshLocalTranscript();
  }, [isAudioDirect, refreshLocalTranscript]);

  // Seed a meta row if none exists yet — so the UI can reflect
  // "disabled_by_setting" without a download attempt.
  useEffect(() => {
    (async () => {
      if (!isAudioDirect || !ownerUid || meta || !sessionId) return;
      const settings = callSettingsService.getSettingsSync();
      const status: CallTranscriptStatus =
        settings.audioCallTranscriptionsEnabled
          ? "processing"
          : "disabled_by_setting";
      await upsertTranscriptMeta({
        callId,
        sessionId,
        ownerUid,
        entryId,
        transcriptStatus: status,
        serverExpiresAt: null,
        localSavedAt: null,
        deletedFromServerAt: null,
        lastError: null,
      });
      void refreshLocalTranscript();
    })();
  }, [
    isAudioDirect,
    ownerUid,
    meta,
    callId,
    sessionId,
    entryId,
    refreshLocalTranscript,
  ]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleAudioCall = useCallback(async () => {
    if (!entry?.otherUserId || !CALL_FEATURES.CALLS_ENABLED) return;
    try {
      await startCall(
        entry.otherUserId,
        "audio",
        entry.otherUserName ?? undefined,
      );
      navigation.navigate("DirectCall", {
        callId: entry.callId,
        recipientName: entry.otherUserName ?? "Unknown",
        mode: "audio",
        isOutgoing: true,
      });
    } catch (err: any) {
      Alert.alert("Could not start call", err?.message ?? "Please try again.");
    }
  }, [entry, navigation, startCall]);

  const handleVideoCall = useCallback(async () => {
    if (!entry?.otherUserId || !CALL_FEATURES.CALLS_ENABLED) return;
    try {
      await startCall(
        entry.otherUserId,
        "video",
        entry.otherUserName ?? undefined,
      );
      navigation.navigate("DirectCall", {
        callId: entry.callId,
        recipientName: entry.otherUserName ?? "Unknown",
        mode: "video",
        isOutgoing: true,
      });
    } catch (err: any) {
      Alert.alert("Could not start call", err?.message ?? "Please try again.");
    }
  }, [entry, navigation, startCall]);

  const handleOpenChat = useCallback(() => {
    if (!entry?.otherUserId) return;
    navigation.navigate("ChatDetail", {
      friendUid: entry.otherUserId,
      friendName: entry.otherUserName ?? undefined,
    });
  }, [entry, navigation]);

  const handleOpenGroup = useCallback(async () => {
    if (!entry?.groupId) return;
    const navParams = await prepareGroupChatNavigation({
      groupId: entry.groupId,
      groupName: entry.groupName ?? undefined,
      groupAvatarUrl: entry.groupAvatar ?? null,
    });
    navigation.navigate("GroupChat", navParams);
  }, [entry, navigation]);

  const handleJoinVoiceChannel = useCallback(() => {
    if (!entry?.groupId) return;
    navigation.navigate("VoiceChannel", {
      channelId: `voice_channel_${entry.groupId}`,
      channelName: `${entry.groupName ?? "Voice Room"}`,
      groupId: entry.groupId,
    });
  }, [entry, navigation]);

  const handleDownloadTranscript = useCallback(async () => {
    if (!sessionId) return;
    setTranscriptBusy(true);
    setTranscriptError(null);
    try {
      const res = await fetchAndPersistTranscript({
        callId,
        sessionId,
        entryId,
      });
      if (res.error) setTranscriptError(res.error);
      await refreshLocalTranscript();
    } finally {
      setTranscriptBusy(false);
    }
  }, [callId, sessionId, entryId, refreshLocalTranscript]);

  const handleDeleteLocalTranscript = useCallback(() => {
    if (!ownerUid || !meta) return;
    Alert.alert(
      "Delete transcript?",
      "This removes the transcript from this device permanently.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTranscriptLocal(meta.callId, meta.sessionId, ownerUid);
            await refreshLocalTranscript();
          },
        },
      ],
    );
  }, [meta, ownerUid, refreshLocalTranscript]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderTranscriptSection = () => {
    // This function is only invoked for direct audio calls — the parent
    // render gates video calls and voice rooms by omitting the entire
    // transcript section (no header, no body). Keep a defensive early
    // return for safety against future refactors.
    if (!isAudioDirect) return null;

    const status = meta?.transcriptStatus ?? "processing";

    if (status === "disabled_by_setting") {
      return (
        <InfoBlock
          colors={colors}
          icon="microphone-off"
          title="Transcription is disabled"
          subtitle="Enable audio call transcriptions in Call Settings."
        />
      );
    }
    if (status === "disabled_by_policy" || status === "policy_unresolved") {
      return (
        <InfoBlock
          colors={colors}
          icon="shield-alert-outline"
          title="Transcripts unavailable for this call"
          subtitle="The other participant has transcriptions disabled or the policy could not be confirmed."
        />
      );
    }
    if (status === "expired") {
      return (
        <InfoBlock
          colors={colors}
          icon="clock-alert-outline"
          title="Transcript expired"
          subtitle="The server copy was deleted before this device could save it."
        />
      );
    }
    if (status === "processing") {
      return (
        <InfoBlock
          colors={colors}
          icon="progress-clock"
          title="Transcript still processing"
          subtitle="Come back in a bit — we'll let you save it to this device when it's ready."
          action={
            <SmallButton
              colors={colors}
              label="Check again"
              onPress={handleDownloadTranscript}
              busy={transcriptBusy}
            />
          }
        />
      );
    }
    if (status === "ready_remote" || status === "downloading") {
      const expiresLabel = meta?.serverExpiresAt
        ? `Available until ${new Date(meta.serverExpiresAt).toLocaleString()}`
        : "Available for up to 2 days";
      return (
        <InfoBlock
          colors={colors}
          icon="cloud-download-outline"
          title="Transcript ready"
          subtitle={expiresLabel}
          action={
            <SmallButton
              colors={colors}
              label="Save transcript to this device"
              onPress={handleDownloadTranscript}
              busy={transcriptBusy || status === "downloading"}
            />
          }
        />
      );
    }
    if (status === "failed") {
      return (
        <InfoBlock
          colors={colors}
          icon="alert-circle-outline"
          title="Couldn't save transcript"
          subtitle={meta?.lastError ?? transcriptError ?? "Please try again."}
          action={
            <SmallButton
              colors={colors}
              label="Retry"
              onPress={handleDownloadTranscript}
              busy={transcriptBusy}
            />
          }
        />
      );
    }
    if (status === "deleted_local") {
      return (
        <InfoBlock
          colors={colors}
          icon="delete-outline"
          title="Transcript deleted"
          subtitle="You deleted this transcript from this device."
        />
      );
    }
    // saved_local
    return (
      <View
        style={[
          styles.transcriptCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.transcriptHeader}>
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={18}
            color={colors.success}
          />
          <Text style={[styles.transcriptHeaderText, { color: colors.text }]}>
            Saved on this device
          </Text>
          <TouchableOpacity
            onPress={handleDeleteLocalTranscript}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.deleteText, { color: colors.error }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
        {segments.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>
            Transcript saved but no segments were captured.
          </Text>
        ) : (
          <View>
            {groupSegmentsBySpeaker(segments).map((group, i) => (
              <View key={i} style={styles.speakerGroup}>
                <Text style={[styles.speakerName, { color: colors.primary }]}>
                  {group.speakerName ?? "Speaker"}
                </Text>
                {group.items.map((seg) => (
                  <View
                    key={`${seg.callId}-${seg.segmentIndex}`}
                    style={styles.segmentRow}
                  >
                    <Text
                      style={[styles.segmentTime, { color: colors.textMuted }]}
                    >
                      {formatMs(seg.startTimeMs)}
                    </Text>
                    <Text style={[styles.segmentText, { color: colors.text }]}>
                      {seg.text}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loadingEntry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Call Info" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Call Info" />
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={40}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: colors.text }]}>
            This call entry couldn't be loaded.
          </Text>
        </View>
      </View>
    );
  }

  const title = isRoom
    ? (entry.groupName ?? "Voice Room")
    : (entry.otherUserName ?? "Unknown");
  const avatarUrl = isRoom ? entry.groupAvatar : entry.otherUserAvatar;
  const typeLabel = isRoom
    ? "Voice room"
    : isVideoDirect
      ? "Video call"
      : "Audio call";
  const resultLabel = resultLabelFor(entry);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Call Info" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Identity block */}
        <View style={styles.identity}>
          <View
            style={[
              styles.avatarWrapper,
              { borderColor: colors.primary + "40" },
            ]}
          >
            <ProfilePicture
              url={avatarUrl ?? null}
              name={title}
              size={72}
              showLoading={false}
            />
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {typeLabel} · {resultLabel}
          </Text>
        </View>

        {/* Actions — rendered BELOW the call status/title block and ABOVE
            the metadata (started / ended / duration) for a cleaner,
            intentional hierarchy: identity → actions → details. */}
        <View style={styles.actionRow}>
          {!isRoom && entry.otherUserId ? (
            <>
              <ActionPill
                colors={colors}
                icon="phone-outline"
                label="Audio"
                onPress={handleAudioCall}
              />
              <ActionPill
                colors={colors}
                icon="video-outline"
                label="Video"
                onPress={handleVideoCall}
              />
              <ActionPill
                colors={colors}
                icon="chat-outline"
                label="Chat"
                onPress={handleOpenChat}
              />
            </>
          ) : null}
          {isRoom && entry.groupId ? (
            <>
              <ActionPill
                colors={colors}
                icon="account-group-outline"
                label="Open Group"
                onPress={handleOpenGroup}
              />
              <ActionPill
                colors={colors}
                icon="phone-plus-outline"
                label="Join Voice"
                onPress={handleJoinVoiceChannel}
              />
            </>
          ) : null}
        </View>

        {/* Metadata */}
        <View
          style={[
            styles.metaCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MetaRow
            colors={colors}
            label="Started"
            value={formatDateTime(entry.startedAt)}
          />
          {entry.endedAt ? (
            <MetaRow
              colors={colors}
              label="Ended"
              value={formatDateTime(entry.endedAt)}
            />
          ) : null}
          {typeof entry.durationSeconds === "number" ? (
            <MetaRow
              colors={colors}
              label="Duration"
              value={formatDuration(entry.durationSeconds)}
            />
          ) : null}
          <MetaRow colors={colors} label="Direction" value={entry.direction} />
          <MetaRow colors={colors} label="Call ID" value={entry.callId} mono />
        </View>

        {/* Transcript — ONLY rendered for direct audio calls. Video calls
            and voice rooms are never transcript-eligible, so we omit the
            entire section (including header) rather than showing a
            placeholder. */}
        {isAudioDirect ? (
          <View style={styles.transcriptSection}>
            <Text
              style={[styles.sectionHeader, { color: colors.textSecondary }]}
            >
              Transcript
            </Text>
            {renderTranscriptSection()}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function MetaRow({
  colors,
  label,
  value,
  mono,
}: {
  colors: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.metaValue,
          { color: colors.text },
          mono ? styles.mono : null,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function ActionPill({
  colors,
  icon,
  label,
  onPress,
}: {
  colors: any;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionPill,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoBlock({
  colors,
  icon,
  title,
  subtitle,
  action,
}: {
  colors: any;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.infoBlock,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      <View style={styles.infoBlockBody}>
        <Text style={[styles.infoBlockTitle, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.infoBlockSubtitle, { color: colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : null}
        {action ? <View style={{ marginTop: 10 }}>{action}</View> : null}
      </View>
    </View>
  );
}

function SmallButton({
  colors,
  label,
  onPress,
  busy,
}: {
  colors: any;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      style={[
        styles.smallButton,
        { backgroundColor: busy ? colors.border : colors.primary },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.smallButtonLabel}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function resultLabelFor(entry: StreamCallHistoryEntry): string {
  switch (entry.result) {
    case "completed":
      return "Completed";
    case "missed":
      return "Missed";
    case "declined":
      return "Declined";
    case "canceled":
      return "Canceled";
    case "left":
      return "Left";
    case "ongoing":
      return "Ongoing";
    default:
      return entry.result;
  }
}

function groupSegmentsBySpeaker(segments: CallTranscriptSegment[]): {
  speakerId: string | null;
  speakerName: string | null;
  items: CallTranscriptSegment[];
}[] {
  const groups: {
    speakerId: string | null;
    speakerName: string | null;
    items: CallTranscriptSegment[];
  }[] = [];
  for (const seg of segments) {
    const last = groups[groups.length - 1];
    if (last && last.speakerId === seg.speakerId) {
      last.items.push(seg);
    } else {
      groups.push({
        speakerId: seg.speakerId,
        speakerName: seg.speakerName,
        items: [seg],
      });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: { marginTop: 12, fontSize: 15 },
  identity: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
    marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14 },
  metaCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaLabel: { fontSize: 13 },
  metaValue: { fontSize: 14, fontWeight: "500", maxWidth: "60%" },
  mono: { fontFamily: undefined, fontVariant: ["tabular-nums"] },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 10,
    gap: 10,
    flexWrap: "wrap",
    paddingHorizontal: 16,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  actionLabel: { fontSize: 14, fontWeight: "600" },
  transcriptSection: { marginTop: 14, paddingHorizontal: 16 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  infoBlock: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  infoBlockBody: { flex: 1 },
  infoBlockTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  infoBlockSubtitle: { fontSize: 13, lineHeight: 18 },
  smallButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  smallButtonLabel: { color: "#fff", fontWeight: "600", fontSize: 14 },
  transcriptCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  transcriptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  transcriptHeaderText: { flex: 1, fontSize: 14, fontWeight: "600" },
  deleteText: { fontSize: 13, fontWeight: "600" },
  speakerGroup: { marginBottom: 14 },
  speakerName: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  segmentRow: { flexDirection: "row", marginBottom: 4, gap: 8 },
  segmentTime: { fontSize: 12, width: 44, fontVariant: ["tabular-nums"] },
  segmentText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
