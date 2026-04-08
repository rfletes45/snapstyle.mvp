/**
 * QRCodeSheet — "My Code" display + "Scan Code" camera
 *
 * Uses expo-camera for barcode scanning.
 * Generates QR via a lightweight SVG approach.
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { buildProfileUrl } from "@/services/invites";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useState } from "react";
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const QR_SIZE = Math.min(SCREEN_WIDTH - 80, 240);

// ---------------------------------------------------------------------------
// Simple QR Code display (text-based fallback until dedicated lib added)
// ---------------------------------------------------------------------------

interface QRDisplayProps {
  value: string;
  size: number;
  colors: any;
}

/**
 * Minimal QR display placeholder.
 * Shows the URL in a styled card with an icon.
 * Replace with react-native-qrcode-svg when available.
 */
function QRDisplay({ value, size, colors }: QRDisplayProps) {
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
      <MaterialCommunityIcons name="qrcode" size={size * 0.6} color="#222" />
      <Text style={styles.qrUrlText} numberOfLines={2} selectable>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// My Code View
// ---------------------------------------------------------------------------

interface MyCodeViewProps {
  username: string;
  displayName: string;
  onShare: () => void;
  onClose: () => void;
}

export function MyCodeView({
  username,
  displayName,
  onShare,
  onClose,
}: MyCodeViewProps) {
  const { colors } = useTheme();
  const profileUrl = buildProfileUrl(username);

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
        <QRDisplay value={profileUrl} size={QR_SIZE} colors={colors} />
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
