/**
 * Audio Route Picker
 *
 * Provides real audio output switching during calls.
 *
 * Platform behavior:
 * - iOS: opens the native AVRoutePickerView popover via Stream callManager
 * - Android: lists actual available endpoints from callManager.android APIs
 *
 * The quick speaker toggle in call controls still uses `applyAudioRoute()`
 * for speakerphone on/off. This component is the user-facing "choose device"
 * surface when multiple outputs are available.
 */

import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Lazy-load callManager
let callManager: any = null;
try {
  callManager = require("@stream-io/video-react-native-sdk").callManager;
} catch {
  // Not available
}

export type AudioRoute =
  | "speaker"
  | "earpiece"
  | "bluetooth"
  | "wired"
  | "unknown";

type NativeAudioDeviceStatus = {
  devices: string[];
  selectedDevice: string;
  currentEndpointType?: string;
};

interface AudioRouteOption {
  deviceName: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: AudioRoute;
}

interface AudioRoutePickerProps {
  visible: boolean;
  onClose: () => void;
  currentRoute: AudioRoute;
  onRouteSelected: (route: AudioRoute) => void;
}

function normalizeDeviceName(deviceName: string | undefined): string {
  return (deviceName ?? "").trim().toLowerCase();
}

export function getAudioRouteFromDeviceName(
  deviceName: string | undefined,
): AudioRoute {
  const normalized = normalizeDeviceName(deviceName);
  if (!normalized) return "unknown";
  if (normalized === "speaker") return "speaker";
  if (normalized === "earpiece") return "earpiece";
  if (normalized.includes("wired")) return "wired";
  if (normalized.includes("headset") && !normalized.includes("wired")) {
    return "bluetooth";
  }
  if (normalized.includes("airpods")) return "bluetooth";
  if (normalized.includes("buds")) return "bluetooth";
  if (normalized.includes("bluetooth")) return "bluetooth";
  if (normalized.includes("car")) return "bluetooth";
  return "bluetooth";
}

export function getAudioRouteFromStatus(
  status: NativeAudioDeviceStatus | null | undefined,
): AudioRoute {
  if (!status) return "unknown";
  const fromSelected = getAudioRouteFromDeviceName(status.selectedDevice);
  if (fromSelected !== "unknown") return fromSelected;

  const endpoint = normalizeDeviceName(status.currentEndpointType);
  if (endpoint.includes("speaker")) return "speaker";
  if (endpoint.includes("earpiece")) return "earpiece";
  if (endpoint.includes("wired")) return "wired";
  if (endpoint.includes("bluetooth")) return "bluetooth";
  return "unknown";
}

function getIconForRoute(
  route: AudioRoute,
): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (route) {
    case "speaker":
      return "volume-high";
    case "earpiece":
      return "phone";
    case "wired":
      return "headphones";
    case "bluetooth":
      return "bluetooth-audio";
    default:
      return "speaker-wireless";
  }
}

function buildAndroidRouteOptions(
  status: NativeAudioDeviceStatus | null,
): AudioRouteOption[] {
  const deviceNames =
    status?.devices?.filter((device) => device.trim().length > 0) ?? [];
  if (deviceNames.length === 0) {
    return [
      {
        deviceName: "Speaker",
        label: "Speaker",
        icon: "volume-high",
        route: "speaker",
      },
      {
        deviceName: "Earpiece",
        label: "Earpiece",
        icon: "phone",
        route: "earpiece",
      },
    ];
  }

  return deviceNames.map((deviceName) => {
    const route = getAudioRouteFromDeviceName(deviceName);
    return {
      deviceName,
      label: deviceName,
      icon: getIconForRoute(route),
      route,
    };
  });
}

export function AudioRoutePicker({
  visible,
  onClose,
  currentRoute,
  onRouteSelected,
}: AudioRoutePickerProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [audioStatus, setAudioStatus] = useState<NativeAudioDeviceStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const iosPickerRequestedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      iosPickerRequestedRef.current = false;
      return;
    }

    if (Platform.OS === "ios") {
      if (iosPickerRequestedRef.current) return;
      iosPickerRequestedRef.current = true;
      requestAnimationFrame(() => {
        try {
          callManager?.ios?.showDeviceSelector?.();
        } catch (err) {
          console.warn("[AudioRoutePicker] iOS route picker failed:", err);
        } finally {
          onClose();
        }
      });
      return;
    }

    if (!callManager?.android?.getAudioDeviceStatus) return;

    let cancelled = false;
    const syncAudioStatus = async () => {
      try {
        setLoading(true);
        const status = await callManager.android.getAudioDeviceStatus();
        if (!cancelled) setAudioStatus(status);
      } catch (err) {
        if (!cancelled) {
          console.warn("[AudioRoutePicker] Failed to load audio devices:", err);
          setAudioStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    syncAudioStatus();
    const unsubscribe =
      callManager.android.addAudioDeviceChangeListener?.((status: any) => {
        if (!cancelled) setAudioStatus(status);
      }) ?? null;

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [visible, onClose]);

  const routes = useMemo(
    () => buildAndroidRouteOptions(audioStatus),
    [audioStatus],
  );
  const selectedDeviceName = audioStatus?.selectedDevice ?? "";

  const handleSelect = useCallback(
    (routeOption: AudioRouteOption) => {
      try {
        if (
          Platform.OS === "android" &&
          callManager?.android?.selectAudioDevice &&
          routeOption.deviceName
        ) {
          callManager.android.selectAudioDevice(routeOption.deviceName);
        } else {
          applyAudioRoute(routeOption.route);
        }
        onRouteSelected(routeOption.route);
      } catch (err) {
        console.warn("[AudioRoutePicker] Failed to switch audio route:", err);
      } finally {
        onClose();
      }
    },
    [onClose, onRouteSelected],
  );

  if (Platform.OS === "ios") return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
          onPress={() => {}}
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.text }]}>
            Audio Output
          </Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={[styles.loadingText, { color: colors.textSecondary }]}
              >
                Detecting available outputs...
              </Text>
            </View>
          ) : (
            routes.map((route) => {
              const isSelected =
                selectedDeviceName.length > 0
                  ? route.deviceName === selectedDeviceName
                  : route.route === currentRoute;
              return (
                <Pressable
                  key={route.deviceName}
                  style={({ pressed }) => [
                    styles.routeRow,
                    {
                      backgroundColor: isSelected
                        ? `${colors.primary}15`
                        : "transparent",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleSelect(route)}
                >
                  <MaterialCommunityIcons
                    name={route.icon}
                    size={24}
                    color={isSelected ? colors.primary : colors.text}
                    style={styles.routeIcon}
                  />
                  <Text
                    style={[
                      styles.routeLabel,
                      {
                        color: isSelected ? colors.primary : colors.text,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {route.label}
                  </Text>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })
          )}

          <Pressable
            style={[styles.cancelButton, { borderTopColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Quick loudspeaker toggle helper.
 *
 * This is intentionally limited to speakerphone on/off. Exact Bluetooth /
 * wired device selection requires the Android picker or iOS system route UI.
 */
export function applyAudioRoute(route: AudioRoute): void {
  if (!callManager?.speaker?.setForceSpeakerphoneOn) {
    console.warn("[AudioRoutePicker] callManager not available");
    return;
  }

  switch (route) {
    case "speaker":
      callManager.speaker.setForceSpeakerphoneOn(true);
      break;
    case "earpiece":
    case "bluetooth":
    case "wired":
    case "unknown":
      callManager.speaker.setForceSpeakerphoneOn(false);
      break;
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#999",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 10,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  routeIcon: {
    marginRight: 16,
  },
  routeLabel: {
    fontSize: 16,
    flex: 1,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
