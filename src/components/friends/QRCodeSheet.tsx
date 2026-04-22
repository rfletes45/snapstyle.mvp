/**
 * QRCodeSheet — "My Code" display + "Scan Code" camera
 *
 * Uses expo-camera for barcode scanning and react-native-qrcode-svg for
 * actual QR rendering. Each user's QR encodes their unique invite URL
 * (vibe://invite/{code}) so every user gets a distinct, scannable code.
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { buildInviteUrl, getOrCreateInviteCode } from "@/services/invites";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, IconButton, Text, useTheme } from "react-native-paper";
import QRCode from "react-native-qrcode-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const QR_SIZE = Math.min(SCREEN_WIDTH - 80, 240);

// ---------------------------------------------------------------------------
// QR Code display (real SVG via react-native-qrcode-svg)
// ---------------------------------------------------------------------------

interface QRDisplayProps {
  value: string;
  size: number;
}

/**
 * Renders a real, scannable QR code encoding the invite URL.
 *
 * High error-correction ("H") leaves room for a small logo overlay and
 * tolerates glare / camera noise during scanning. The card background is
 * always white regardless of theme so the code contrast remains readable by
 * camera scanners.
 */
function QRDisplay({ value, size }: QRDisplayProps) {
  return (
    <View
      style={[
        styles.qrPlaceholder,
        {
          width: size,
          height: size,
          backgroundColor: "#fff",
          borderRadius: BorderRadius.md,
        },
      ]}
    >
      <QRCode
        value={value}
        size={size - 32}
        color="#000"
        backgroundColor="#fff"
        ecl="H"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// My Code View
// ---------------------------------------------------------------------------

interface MyCodeViewProps {
  uid: string;
  username: string;
  displayName: string;
  onShare: () => void;
  onClose: () => void;
}

export function MyCodeView({
  uid,
  username,
  displayName,
  onShare,
  onClose,
}: MyCodeViewProps) {
  const { colors } = useTheme();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!uid) return;
    setError(false);
    setInviteUrl(null);
    (async () => {
      try {
        const code = await getOrCreateInviteCode(uid);
        if (cancelled || !mountedRef.current) return;
        setInviteUrl(buildInviteUrl(code));
      } catch {
        if (cancelled || !mountedRef.current) return;
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return (
    <View style={styles.myCodeContainer}>
      <View style={styles.myCodeHeader}>
        <Text
          variant="titleLarge"
          style={[styles.myCodeTitle, { color: colors.onSurface }]}
        >
          My QR Code
        </Text>
        <IconButton icon="close" size={22} onPress={onClose} />
      </View>

      <View style={styles.qrCenter}>
        {inviteUrl ? (
          <QRDisplay value={inviteUrl} size={QR_SIZE} />
        ) : (
          <View
            style={[
              styles.qrPlaceholder,
              {
                width: QR_SIZE,
                height: QR_SIZE,
                backgroundColor: "#fff",
                borderRadius: BorderRadius.md,
              },
            ]}
          >
            {error ? (
              <>
                <MaterialCommunityIcons
                  name="qrcode-remove"
                  size={QR_SIZE * 0.35}
                  color="#999"
                />
                <Text style={styles.qrUrlText}>
                  Couldn’t load your code. Pull to retry.
                </Text>
              </>
            ) : (
              <ActivityIndicator size="large" color="#333" />
            )}
          </View>
        )}
      </View>

      <Text
        variant="bodyLarge"
        style={[styles.displayNameText, { color: colors.onSurface }]}
      >
        {displayName}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.onSurfaceVariant, textAlign: "center" }}
      >
        @{username}
      </Text>

      <Text
        variant="bodySmall"
        style={[styles.ctaText, { color: colors.onSurfaceVariant }]}
      >
        Friends can scan this code to add you
      </Text>

      <Button
        mode="contained"
        onPress={onShare}
        style={styles.shareBtn}
        icon="share-variant-outline"
        disabled={!inviteUrl}
      >
        Share My Code
      </Button>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Scan Code View
// ---------------------------------------------------------------------------

interface ScanCodeViewProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function ScanCodeView({ onScan, onClose }: ScanCodeViewProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return; // Prevent duplicate scans
      setScanned(true);
      onScan(data);
      // Reset after short delay to allow re-scanning
      setTimeout(() => setScanned(false), 2000);
    },
    [scanned, onScan],
  );

  if (!permission) {
    return (
      <View
        style={[styles.scanContainer, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[styles.scanContainer, { backgroundColor: colors.background }]}
      >
        <View style={styles.permissionCard}>
          <MaterialCommunityIcons
            name="camera-outline"
            size={48}
            color={colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={{ color: colors.onSurface, marginTop: 12 }}
          >
            Camera Access Needed
          </Text>
          <Text
            variant="bodySmall"
            style={{
              color: colors.onSurfaceVariant,
              textAlign: "center",
              marginTop: 6,
              marginBottom: 16,
            }}
          >
            Allow camera access to scan QR codes
          </Text>
          <Button mode="contained" onPress={requestPermission}>
            Allow Camera
          </Button>
          <Button
            mode="text"
            onPress={onClose}
            textColor={colors.onSurfaceVariant}
            style={{ marginTop: 8 }}
          >
            Cancel
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.scanContainer, { backgroundColor: "#000" }]}>
      {/* Header overlay */}
      <View style={styles.scanHeader}>
        <IconButton icon="close" iconColor="#fff" size={24} onPress={onClose} />
        <Text
          variant="titleMedium"
          style={{ color: "#fff", fontWeight: "600" }}
        >
          Scan QR Code
        </Text>
        <IconButton
          icon={torch ? "flashlight-off" : "flashlight"}
          iconColor="#fff"
          size={24}
          onPress={() => setTorch((t) => !t)}
        />
      </View>

      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay frame */}
      <View style={styles.scanOverlay}>
        <View style={styles.scanFrame} />
        <Text variant="bodySmall" style={styles.scanHintText}>
          Point your camera at a friend&apos;s QR code
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Combined Modal
// ---------------------------------------------------------------------------

interface QRCodeSheetProps {
  visible: boolean;
  mode: "myCode" | "scan";
  uid: string;
  username: string;
  displayName: string;
  onShare: () => void;
  onScan: (data: string) => void;
  onClose: () => void;
  onSwitchMode: (mode: "myCode" | "scan") => void;
}

export default function QRCodeSheet({
  visible,
  mode,
  uid,
  username,
  displayName,
  onShare,
  onScan,
  onClose,
  onSwitchMode,
}: QRCodeSheetProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        {/* Tab switcher */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              mode === "myCode" && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => onSwitchMode("myCode")}
          >
            <Text
              style={{
                color:
                  mode === "myCode" ? colors.primary : colors.onSurfaceVariant,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              My Code
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              mode === "scan" && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => onSwitchMode("scan")}
          >
            <Text
              style={{
                color:
                  mode === "scan" ? colors.primary : colors.onSurfaceVariant,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Scan Code
            </Text>
          </TouchableOpacity>
        </View>

        {mode === "myCode" ? (
          <MyCodeView
            uid={uid}
            username={username}
            displayName={displayName}
            onShare={onShare}
            onClose={onClose}
          />
        ) : (
          <ScanCodeView onScan={onScan} onClose={onClose} />
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  // My Code
  myCodeContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 32,
    paddingHorizontal: Spacing.lg,
  },
  myCodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
  },
  myCodeTitle: {
    fontWeight: "700",
  },
  qrCenter: {
    alignItems: "center",
    marginVertical: 16,
  },
  qrPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  qrUrlText: {
    fontSize: 10,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  displayNameText: {
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  ctaText: {
    marginTop: 12,
    textAlign: "center",
  },
  shareBtn: {
    marginTop: 20,
    minWidth: 180,
  },

  // Scan
  scanContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scanHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    zIndex: 10,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: BorderRadius.md,
  },
  scanHintText: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 16,
    textAlign: "center",
  },
  permissionCard: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
});
