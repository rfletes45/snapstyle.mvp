/**
 * FriendInviteConfirmModal
 *
 * Single shared confirmation UI for both entry points of the friend-invite
 * acceptance flow:
 *
 *   1. QR scan     \u2014 user scans another user's QR code.
 *   2. Deep link   \u2014 user taps a `vibe://invite/{code}` link.
 *
 * Both resolve to a `ParsedInvite` payload. This modal takes that payload,
 * fetches the sender profile, and shows the recipient a single canonical
 * confirmation screen:
 *
 *      [avatar]
 *      Display Name
 *      @username
 *      "Would you like to add this person?"
 *      [  Add Friend  ]   [  Cancel  ]
 *
 * It gracefully handles:
 *   - loading while resolving the invite
 *   - user not found / invalid code
 *   - self-add (user scanned / opened their own invite)
 *   - already-friends, pending-request duplicates
 *   - network errors
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { sendFriendRequestByUid } from "@/services/friends";
import { resolveInviteCode, type ParsedInvite } from "@/services/invites";
import { getUserByUsername, getUserProfile } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import type { User } from "@/types/models";
import * as haptics from "@/utils/haptics";
import { createLogger } from "@/utils/log";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

const logger = createLogger("components/FriendInviteConfirmModal");

type Status =
  | "resolving"
  | "ready"
  | "sending"
  | "sent"
  | "error"
  | "self"
  | "invalid";

interface Props {
  visible: boolean;
  invite: ParsedInvite;
  onDismiss: () => void;
  /**
   * Optional side-effect after a request is successfully sent \u2014 e.g. the
   * parent screen can refresh its friend list.
   */
  onSent?: (target: User) => void;
}

export default function FriendInviteConfirmModal({
  visible,
  invite,
  onDismiss,
  onSent,
}: Props) {
  const { colors } = useTheme();
  const { currentFirebaseUser } = useAuth();
  const currentUid = currentFirebaseUser?.uid ?? null;

  const [status, setStatus] = useState<Status>("resolving");
  const [target, setTarget] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Resolve the invite payload to a User whenever the payload changes.
  useEffect(() => {
    if (!visible || !invite) return;

    let cancelled = false;

    const resolve = async () => {
      setStatus("resolving");
      setTarget(null);
      setErrorMsg(null);

      try {
        let uid: string | null = null;
        let profile: User | null = null;

        if (invite.kind === "invite") {
          uid = await resolveInviteCode(invite.code);
          if (uid) {
            profile = await getUserProfile(uid);
          }
        } else if (invite.kind === "profile") {
          profile = await getUserByUsername(invite.username);
          uid = profile?.uid ?? null;
        }

        if (cancelled || !mountedRef.current) return;

        if (!uid || !profile) {
          setStatus("invalid");
          setErrorMsg(
            "We couldn\u2019t find the person this invite points to. The link may be invalid or expired.",
          );
          return;
        }

        // Ensure the populated profile carries the resolved uid.
        const resolvedProfile: User = { ...profile, uid };

        if (currentUid && currentUid === uid) {
          setTarget(resolvedProfile);
          setStatus("self");
          return;
        }

        setTarget(resolvedProfile);
        setStatus("ready");
      } catch (err) {
        logger.error("Failed to resolve invite:", err);
        if (cancelled || !mountedRef.current) return;
        setStatus("error");
        setErrorMsg("Something went wrong resolving this invite.");
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [visible, invite, currentUid]);

  const handleConfirm = useCallback(async () => {
    if (!target || !currentUid) return;
    setStatus("sending");
    setErrorMsg(null);
    try {
      await sendFriendRequestByUid(currentUid, target.uid);
      haptics.buttonPress();
      if (!mountedRef.current) return;
      setStatus("sent");
      onSent?.(target);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setStatus("error");
      setErrorMsg(err?.message || "Failed to send friend request.");
    }
  }, [target, currentUid, onSent]);

  const handleDismiss = useCallback(() => {
    // Reset local state so re-opening with a new payload starts fresh.
    setStatus("resolving");
    setTarget(null);
    setErrorMsg(null);
    onDismiss();
  }, [onDismiss]);

  const avatarUrl = target?.profilePicture?.url ?? null;
  const displayName = target?.displayName || target?.username || "Unknown user";
  const handle = target?.username ? `@${target.username}` : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View
          style={[styles.card, { backgroundColor: colors.surface }]}
          accessibilityRole="alert"
          accessibilityLabel="Friend invite confirmation"
        >
          {/* Header / avatar area */}
          <View style={styles.avatarWrap}>
            {status === "resolving" ? (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <MaterialCommunityIcons
                  name="account"
                  size={48}
                  color={colors.onSurfaceVariant}
                />
              </View>
            )}
          </View>

          {/* Body */}
          {status === "resolving" && (
            <Text
              variant="bodyMedium"
              style={[styles.bodyText, { color: colors.onSurfaceVariant }]}
            >
              Looking up invite…
            </Text>
          )}

          {(status === "ready" ||
            status === "sending" ||
            status === "sent" ||
            (status === "error" && target)) && (
            <>
              <Text
                variant="titleLarge"
                style={[styles.name, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {handle ? (
                <Text
                  variant="bodyMedium"
                  style={[styles.handle, { color: colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {handle}
                </Text>
              ) : null}

              {status === "ready" && (
                <Text
                  variant="bodyMedium"
                  style={[styles.prompt, { color: colors.onSurface }]}
                >
                  Would you like to add this person as a friend?
                </Text>
              )}
              {status === "sending" && (
                <View style={styles.inlineLoading}>
                  <ActivityIndicator color={colors.primary} />
                  <Text
                    variant="bodyMedium"
                    style={{ color: colors.onSurfaceVariant, marginTop: 8 }}
                  >
                    Sending request…
                  </Text>
                </View>
              )}
              {status === "sent" && (
                <Text
                  variant="bodyMedium"
                  style={[styles.prompt, { color: colors.primary }]}
                >
                  Friend request sent!
                </Text>
              )}
              {status === "error" && errorMsg && (
                <Text
                  variant="bodyMedium"
                  style={[styles.prompt, { color: colors.error }]}
                >
                  {errorMsg}
                </Text>
              )}
            </>
          )}

          {status === "self" && (
            <>
              <Text
                variant="titleLarge"
                style={[styles.name, { color: colors.onSurface }]}
              >
                {"That’s you!"}
              </Text>
              <Text
                variant="bodyMedium"
                style={[styles.prompt, { color: colors.onSurfaceVariant }]}
              >
                {"You can’t send a friend request to yourself."}
              </Text>
            </>
          )}

          {status === "invalid" && (
            <>
              <Text
                variant="titleLarge"
                style={[styles.name, { color: colors.onSurface }]}
              >
                Invalid invite
              </Text>
              {errorMsg && (
                <Text
                  variant="bodyMedium"
                  style={[styles.prompt, { color: colors.onSurfaceVariant }]}
                >
                  {errorMsg}
                </Text>
              )}
            </>
          )}

          {status === "error" && !target && errorMsg && (
            <>
              <Text
                variant="titleLarge"
                style={[styles.name, { color: colors.onSurface }]}
              >
                Something went wrong
              </Text>
              <Text
                variant="bodyMedium"
                style={[styles.prompt, { color: colors.onSurfaceVariant }]}
              >
                {errorMsg}
              </Text>
            </>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {status === "ready" || status === "sending" ? (
              <>
                <Button
                  mode="outlined"
                  onPress={handleDismiss}
                  style={styles.actionBtn}
                  disabled={status === "sending"}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleConfirm}
                  style={styles.actionBtn}
                  loading={status === "sending"}
                  disabled={status === "sending"}
                >
                  Add Friend
                </Button>
              </>
            ) : status === "error" && target ? (
              <>
                <Button
                  mode="outlined"
                  onPress={handleDismiss}
                  style={styles.actionBtn}
                >
                  Close
                </Button>
                <Button
                  mode="contained"
                  onPress={handleConfirm}
                  style={styles.actionBtn}
                >
                  Try again
                </Button>
              </>
            ) : (
              <Button
                mode="contained"
                onPress={handleDismiss}
                style={[styles.actionBtn, styles.singleActionBtn]}
              >
                {status === "sent" ? "Done" : "Close"}
              </Button>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 8,
  },
  avatarWrap: {
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#ccc",
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontWeight: "700",
    textAlign: "center",
  },
  handle: {
    marginTop: 2,
    textAlign: "center",
  },
  prompt: {
    marginTop: 16,
    textAlign: "center",
    lineHeight: 20,
  },
  bodyText: {
    marginTop: 8,
    textAlign: "center",
  },
  inlineLoading: {
    marginTop: 16,
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    marginTop: 24,
    gap: 12,
    alignSelf: "stretch",
  },
  actionBtn: {
    flex: 1,
  },
  singleActionBtn: {
    flex: 1,
    alignSelf: "stretch",
  },
});
