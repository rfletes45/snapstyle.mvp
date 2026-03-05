/**
 * Games V4 — Lobby Settings Panel
 *
 * Generic settings renderer that reads a game adapter's settingsSchema
 * and renders appropriate controls (Switch, Stepper, SegmentedControl).
 * Only shown to the host when the adapter has a non-empty schema.
 *
 * @module gamesV4/components/LobbySettingsPanel
 */

import { getAdapter } from "@/gamesV4/adapters/registry";
import type { SettingsFieldDef } from "@/gamesV4/types/adapter";
import type { GameId } from "@/gamesV4/types/common";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Props
// =============================================================================

interface LobbySettingsPanelProps {
  gameId: GameId;
  /** Called when settings change. */
  onSettingsChange: (settings: Record<string, unknown>) => void;
}

// =============================================================================
// Component
// =============================================================================

export default function LobbySettingsPanel({
  gameId,
  onSettingsChange,
}: LobbySettingsPanelProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const adapter = getAdapter(gameId);

  const schema: SettingsFieldDef[] = adapter?.settingsSchema ?? [];
  const defaults = adapter?.defaultSettings ?? {};

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [expanded, setExpanded] = useState(false);

  // Initialize with defaults
  useEffect(() => {
    const init: Record<string, unknown> = {};
    for (const field of schema) {
      init[field.key] =
        (defaults as Record<string, unknown>)[field.key] ?? field.default;
    }
    setValues(init);
    onSettingsChange(init);
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        onSettingsChange(next);
        return next;
      });
    },
    [onSettingsChange],
  );

  if (schema.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#1A1A2E" : "#F5F5F5",
          borderColor: isDark ? "#333" : "#E0E0E0",
        },
      ]}
    >
      {/* Header — collapsible */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((p) => !p)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="cog-outline"
          size={18}
          color={theme.colors.primary}
        />
        <Text style={[styles.headerText, { color: theme.colors.primary }]}>
          Game Settings
        </Text>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={isDark ? "#888" : "#999"}
        />
      </TouchableOpacity>

      {expanded && (
        <ScrollView
          style={styles.fieldsContainer}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {schema.map((field) => (
            <SettingsField
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(v) => handleChange(field.key, v)}
              isDark={isDark}
              primaryColor={theme.colors.primary}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// =============================================================================
// Individual Field Renderer
// =============================================================================

interface SettingsFieldProps {
  field: SettingsFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  isDark: boolean;
  primaryColor: string;
}

function SettingsField({
  field,
  value,
  onChange,
  isDark,
  primaryColor,
}: SettingsFieldProps) {
  switch (field.type) {
    case "boolean":
      return (
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: isDark ? "#CCC" : "#333" }]}>
            {field.label}
          </Text>
          <Switch
            value={value as boolean}
            onValueChange={onChange}
            trackColor={{ false: "#767577", true: primaryColor + "80" }}
            thumbColor={(value as boolean) ? primaryColor : "#f4f3f4"}
          />
        </View>
      );

    case "number":
      return (
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: isDark ? "#CCC" : "#333" }]}>
            {field.label}
          </Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[
                styles.stepperBtn,
                { backgroundColor: isDark ? "#333" : "#E0E0E0" },
              ]}
              onPress={() => {
                const cur = (value as number) ?? (field.default as number);
                const next = Math.max(field.min ?? 0, cur - (field.step ?? 1));
                onChange(next);
              }}
            >
              <Text style={{ color: isDark ? "#FFF" : "#333", fontSize: 16 }}>
                −
              </Text>
            </TouchableOpacity>
            <Text
              style={[
                styles.stepperValue,
                { color: isDark ? "#FFF" : "#333" },
              ]}
            >
              {String(value ?? field.default)}
            </Text>
            <TouchableOpacity
              style={[
                styles.stepperBtn,
                { backgroundColor: isDark ? "#333" : "#E0E0E0" },
              ]}
              onPress={() => {
                const cur = (value as number) ?? (field.default as number);
                const next = Math.min(
                  field.max ?? 9999,
                  cur + (field.step ?? 1),
                );
                onChange(next);
              }}
            >
              <Text style={{ color: isDark ? "#FFF" : "#333", fontSize: 16 }}>
                +
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );

    case "select":
      return (
        <View style={styles.fieldColumn}>
          <Text style={[styles.fieldLabel, { color: isDark ? "#CCC" : "#333" }]}>
            {field.label}
          </Text>
          <View style={styles.selectRow}>
            {(field.options ?? []).map((opt) => {
              const isSelected =
                JSON.stringify(value) === JSON.stringify(opt.value);
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[
                    styles.selectBtn,
                    {
                      backgroundColor: isSelected
                        ? primaryColor
                        : isDark
                          ? "#333"
                          : "#E0E0E0",
                    },
                  ]}
                  onPress={() => onChange(opt.value)}
                >
                  <Text
                    style={[
                      styles.selectBtnText,
                      {
                        color: isSelected ? "#FFF" : isDark ? "#CCC" : "#333",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );

    default:
      return null;
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  fieldsContainer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    maxHeight: 300,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  fieldColumn: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperValue: {
    fontSize: 14,
    fontWeight: "700",
    minWidth: 40,
    textAlign: "center",
  },
  selectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  selectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  selectBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
