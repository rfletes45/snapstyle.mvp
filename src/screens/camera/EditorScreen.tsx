/**
 * EDITOR SCREEN  Full photo editor
 *
 * Features:
 *  1. Text overlay  add styled text, draggable, colours, fonts, sizes
 *  2. Drawing / doodle  finger-draw with colour & brush size pickers
 *  3. Post-capture filters  browse & apply from the filter library
 *  4. Stickers  emoji picker, draggable
 *  5. Polls  yes/no, multiple-choice, slider, question
 *  6. Crop & rotate (basic 90-degree rotation)
 *  7. Undo / redo
 *
 * After editing the user can:
 *   - "Send"  (chat mode)   returns the edited URI to the chat
 *   - "Next"  (full mode)   navigates to CameraShare screen
 *
 * Uses CameraContext for state (no Redux).
 */

import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";
import DrawingCanvas, {
  type DrawnPath,
} from "@/components/camera/DrawingCanvas";
import PollCreator from "@/components/camera/PollCreator";
import { FILTER_LIBRARY } from "@/services/camera/filterService";
import { useEditorState, useSnapState } from "@/store/CameraContext";
import type {
  CapturedMedia,
  FilterConfig,
  OverlayElement,
  PollElement,
  Snap,
  StickerElement,
  TextElement,
} from "@/types/camera";
import { generateUUID } from "@/utils/uuid";
import type { CameraMode } from "./CameraScreen";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/camera/EditorScreen");
// --- Constants ---------------------------------------------------------------
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const TOOLBAR_H = 52;
const BOTTOM_BAR_H = 70;

type EditTool = "none" | "text" | "draw" | "filter" | "sticker" | "poll";

// --- Colour palette ----------------------------------------------------------
const PALETTE = [
  "#FFFFFF",
  "#000000",
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#00C7BE",
  "#A2845E",
];

// --- Brush sizes -------------------------------------------------------------
const BRUSH_SIZES = [3, 6, 10, 16, 24];

// --- Emoji stickers ----------------------------------------------------------
const EMOJI_STICKERS = [
  "\u{1F600}",
  "\u{1F602}",
  "\u{1F970}",
  "\u{1F60D}",
  "\u{1F914}",
  "\u{1F60E}",
  "\u{1F973}",
  "\u{1F622}",
  "\u{1F621}",
  "\u{1F92F}",
  "\u{1F389}",
  "\u{1F38A}",
  "\u2764\uFE0F",
  "\u{1F525}",
  "\u2B50",
  "\u{1F4AF}",
  "\u{1F44D}",
  "\u{1F44E}",
  "\u{1F64C}",
  "\u{1F4AA}",
  "\u2728",
  "\u{1F308}",
  "\u2600\uFE0F",
  "\u{1F319}",
  "\u{1F98B}",
  "\u{1F338}",
  "\u{1F355}",
  "\u{1F3B5}",
  "\u{1F4F8}",
  "\u{1F4AC}",
  "\u{1F3C6}",
  "\u{1F3AF}",
  "\u{1F48E}",
  "\u{1F680}",
  "\u{1F440}",
  "\u{1F91D}",
  "\u{1F480}",
  "\u{1FAE1}",
  "\u{1F917}",
  "\u{1F608}",
];

// --- "None" filter -----------------------------------------------------------
const NONE_FILTER: FilterConfig = {
  id: "none",
  name: "Normal",
  category: "vintage",
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
};
const ALL_FILTERS: FilterConfig[] = [NONE_FILTER, ...FILTER_LIBRARY];

// --- Route params ------------------------------------------------------------
interface EditorParams {
  snap: CapturedMedia;
  mode?: CameraMode;
  returnRoute?: string;
  returnData?: Record<string, any>;
  chatId?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

const EditorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    snap,
    mode = "full",
    returnRoute,
    returnData,
  } = route.params as EditorParams;

  const { setShareSnap } = useSnapState();
  const {
    overlayElements,
    appliedFilters,
    canUndo,
    canRedo,
    addElement,
    removeElement,
    undo: undoAction,
    redo: redoAction,
    applyFilter: applyEditorFilter,
    clearAllFilters,
    setCurrentSnap,
    setEditMode: setEditorEditMode,
  } = useEditorState();

  // -- Local state ------------------------------------------------------------
  const [activeTool, setActiveTool] = useState<EditTool>("none");

  // Text tool
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textFont, setTextFont] = useState<
    "Roboto" | "Playfair" | "Caveat" | "Pacifico"
  >("Roboto");
  const [textSize, setTextSize] = useState(32);
  const [showTextDialog, setShowTextDialog] = useState(false);

  // Drawing tool
  const [drawColor, setDrawColor] = useState("#FF3B30");
  const [drawBrush, setDrawBrush] = useState(6);
  const [drawPaths, setDrawPaths] = useState<DrawnPath[]>([]);

  // Filter
  const [selectedFilterId, setSelectedFilterId] = useState<string>("none");
  const [filterIntensity, setFilterIntensity] = useState(1.0);

  // Sticker
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // Poll
  const [showPollCreator, setShowPollCreator] = useState(false);

  // Rotation (multiples of 90)
  const [rotation, setRotation] = useState(0);

  // Draggable overlay element positions (local overrides for positioning)
  const [elementPositions, setElementPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // ViewShot ref for compositing the editor view into a flat image
  const editorViewShotRef = useRef<ViewShot>(null);
  const [isExporting, setIsExporting] = useState(false);

  // -- Haptics ----------------------------------------------------------------
  const haptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // -- Tool selection ---------------------------------------------------------
  const selectTool = useCallback(
    (tool: EditTool) => {
      haptic();
      setActiveTool((prev) => (prev === tool ? "none" : tool));

      if (tool === "text") setShowTextDialog(true);
      if (tool === "sticker") setShowStickerPicker(true);
      if (tool === "poll") setShowPollCreator(true);
    },
    [haptic],
  );

  // -- Text -------------------------------------------------------------------
  const handleAddText = useCallback(() => {
    if (!textInput.trim()) return;

    const el: TextElement = {
      id: generateUUID(),
      type: "text",
      content: textInput.trim(),
      position: { x: SCREEN_W / 2 - 60, y: SCREEN_H * 0.35 },
      size: textSize,
      rotation: 0,
      font: textFont,
      color: textColor,
      opacity: 1,
    };

    addElement(el);
    setTextInput("");
    setShowTextDialog(false);
    setActiveTool("none");
    haptic();
  }, [textInput, textSize, textFont, textColor, addElement, haptic]);

  // -- Stickers ---------------------------------------------------------------
  const handleAddSticker = useCallback(
    (emoji: string) => {
      const el: StickerElement = {
        id: generateUUID(),
        type: "sticker",
        stickerId: emoji,
        position: { x: SCREEN_W / 2 - 30, y: SCREEN_H * 0.35 },
        size: 60,
        rotation: 0,
        opacity: 1,
        scale: 1,
      };
      addElement(el);
      setShowStickerPicker(false);
      setActiveTool("none");
      haptic();
    },
    [addElement, haptic],
  );

  // -- Poll -------------------------------------------------------------------
  const handleCreatePoll = useCallback(
    (poll: PollElement) => {
      const el: PollElement = {
        ...poll,
        position: { x: SCREEN_W * 0.1, y: SCREEN_H * 0.3 },
      };
      addElement(el);
      haptic();
    },
    [addElement, haptic],
  );

  // -- Filter -----------------------------------------------------------------
  const handleSelectFilter = useCallback(
    (filter: FilterConfig) => {
      setSelectedFilterId(filter.id);
      if (filter.id === "none") {
        clearAllFilters();
      } else {
        applyEditorFilter({
          filterId: filter.id,
          intensity: filterIntensity,
          timestamp: Date.now(),
        });
      }
      haptic();
    },
    [filterIntensity, applyEditorFilter, clearAllFilters, haptic],
  );

  // -- Rotation ---------------------------------------------------------------
  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
    haptic();
  }, [haptic]);

  // -- Undo drawing -----------------------------------------------------------
  const handleUndoDrawing = useCallback(() => {
    if (drawPaths.length > 0) {
      setDrawPaths((prev) => prev.slice(0, -1));
      haptic();
    } else {
      undoAction();
    }
  }, [drawPaths.length, undoAction, haptic]);

  // -- Delete element (long press) --------------------------------------------
  const handleDeleteElement = useCallback(
    (id: string) => {
      removeElement(id);
      haptic();
    },
    [removeElement, haptic],
  );

  // -- Done / Send / Next -----------------------------------------------------
  const handleDone = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      // Flatten the editor view (image + filter + drawings + overlays)
      let finalUri = snap.uri;
      if (editorViewShotRef.current) {
        try {
          const composited = await captureRef(editorViewShotRef, {
            format: "jpg",
            quality: 0.9,
            result: "tmpfile",
          });
          if (composited) {
            finalUri = composited;
            logger.info("[Editor] View composited successfully");
          }
        } catch (flattenError) {
          logger.warn(
            "[Editor] ViewShot capture failed, using raw image:",
            flattenError,
          );
        }
      }

      if (mode === "chat") {
        // Return to chat with the composited image URI
        if (returnRoute) {
          navigation.navigate(returnRoute, {
            ...returnData,
            capturedImageUri: finalUri,
          });
        } else {
          navigation.goBack();
          navigation.goBack(); // back past camera
        }
      } else {
        // Build Snap for share screen
        const createdSnap: Snap = {
          id: generateUUID(),
          senderId: "",
          senderDisplayName: "",
          mediaType: snap.type,
          mediaUrl: finalUri,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recipients: [],
          storyVisible: false,
          caption: "",
          filters: appliedFilters,
          overlayElements,
          viewedBy: [],
          reactions: [],
          replies: [],
          allowReplies: true,
          allowReactions: true,
          viewOnceOnly: false,
          screenshotNotification: true,
          uploadStatus: "pending",
          uploadProgress: 0,
        };
        setShareSnap(createdSnap);
        navigation.navigate("CameraShare");
      }
    } finally {
      setIsExporting(false);
    }
  }, [
    isExporting,
    mode,
    returnRoute,
    returnData,
    snap,
    appliedFilters,
    overlayElements,
    setShareSnap,
    navigation,
  ]);

  // -- Discard ----------------------------------------------------------------
  const handleDiscard = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // -- Computed filter overlay colour -----------------------------------------
  const filterOverlayColor = useMemo(() => {
    if (selectedFilterId === "none") return null;
    const f = ALL_FILTERS.find((ff) => ff.id === selectedFilterId);
    if (!f) return null;

    const { brightness, contrast, saturation, hue, sepia = 0, invert = 0 } = f;
    const isIdentity =
      brightness === 0 &&
      contrast === 1 &&
      saturation === 1 &&
      hue === 0 &&
      sepia === 0 &&
      invert === 0;
    if (isIdentity) return null;

    let r = 0,
      g = 0,
      b = 0,
      a = 0;

    if (hue > 0) {
      const h = (hue % 360) / 60;
      const x = 1 - Math.abs((h % 2) - 1);
      if (h < 1) {
        r = 1;
        g = x;
      } else if (h < 2) {
        r = x;
        g = 1;
      } else if (h < 3) {
        g = 1;
        b = x;
      } else if (h < 4) {
        g = x;
        b = 1;
      } else if (h < 5) {
        r = x;
        b = 1;
      } else {
        r = 1;
        b = x;
      }
      a += 0.12;
    }
    if (sepia > 0) {
      const sw = sepia * 0.6;
      r = r * (1 - sw) + 0.76 * sw;
      g = g * (1 - sw) + 0.58 * sw;
      b = b * (1 - sw) + 0.36 * sw;
      a += sepia * 0.18;
    }
    if (saturation < 1) {
      const d = 1 - saturation;
      r = r * saturation + 0.5 * d;
      g = g * saturation + 0.5 * d;
      b = b * saturation + 0.5 * d;
      a += d * 0.25;
    }
    if (brightness > 0) {
      r += (1 - r) * brightness * 0.5;
      g += (1 - g) * brightness * 0.5;
      b += (1 - b) * brightness * 0.5;
      a += brightness * 0.08;
    } else if (brightness < 0) {
      const dk = -brightness;
      r *= 1 - dk * 0.6;
      g *= 1 - dk * 0.6;
      b *= 1 - dk * 0.6;
      a += dk * 0.15;
    }
    if (contrast > 1) a += (contrast - 1) * 0.04;
    if (invert === 1) {
      r = 0.3;
      g = 0.6;
      b = 0.8;
      a += 0.2;
    }

    a = Math.min(0.4, Math.max(0, a)) * filterIntensity;
    if (a < 0.01) return null;
    const ri = Math.round(Math.min(1, Math.max(0, r)) * 255);
    const gi = Math.round(Math.min(1, Math.max(0, g)) * 255);
    const bi = Math.round(Math.min(1, Math.max(0, b)) * 255);
    return "rgba(" + ri + ", " + gi + ", " + bi + ", " + a.toFixed(2) + ")";
  }, [selectedFilterId, filterIntensity]);

  // -- Render overlay elements ------------------------------------------------
  const renderOverlayElement = useCallback(
    (el: OverlayElement) => {
      // DrawingElement doesn't have a position — skip it (drawings are on the canvas)
      if (el.type === "drawing") return null;

      const pos = elementPositions[el.id] ?? el.position;

      if (el.type === "text") {
        return (
          <DraggableItem
            key={el.id}
            id={el.id}
            initialX={pos.x}
            initialY={pos.y}
            onPositionChange={(x: number, y: number) =>
              setElementPositions((prev) => ({ ...prev, [el.id]: { x, y } }))
            }
            onLongPress={() => handleDeleteElement(el.id)}
          >
            <Text
              style={{
                fontSize: el.size,
                color: el.color,
                fontFamily: el.font === "Roboto" ? undefined : el.font,
                fontWeight: el.font === "Roboto" ? "700" : "400",
                textShadowColor: "rgba(0,0,0,0.6)",
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 3,
              }}
            >
              {el.content}
            </Text>
          </DraggableItem>
        );
      }

      if (el.type === "sticker") {
        return (
          <DraggableItem
            key={el.id}
            id={el.id}
            initialX={pos.x}
            initialY={pos.y}
            onPositionChange={(x: number, y: number) =>
              setElementPositions((prev) => ({ ...prev, [el.id]: { x, y } }))
            }
            onLongPress={() => handleDeleteElement(el.id)}
          >
            <Text style={{ fontSize: el.size }}>{el.stickerId}</Text>
          </DraggableItem>
        );
      }

      if (el.type === "poll") {
        return (
          <DraggableItem
            key={el.id}
            id={el.id}
            initialX={pos.x}
            initialY={pos.y}
            onPositionChange={(x: number, y: number) =>
              setElementPositions((prev) => ({ ...prev, [el.id]: { x, y } }))
            }
            onLongPress={() => handleDeleteElement(el.id)}
          >
            <View style={styles.pollBubble}>
              <Text style={styles.pollQuestion}>{el.question}</Text>
              {el.pollType === "yes_no" && (
                <View style={styles.pollOptionsRow}>
                  <View
                    style={[styles.pollOption, { backgroundColor: "#34C759" }]}
                  >
                    <Text style={styles.pollOptionText}>Yes</Text>
                  </View>
                  <View
                    style={[styles.pollOption, { backgroundColor: "#FF3B30" }]}
                  >
                    <Text style={styles.pollOptionText}>No</Text>
                  </View>
                </View>
              )}
              {el.pollType === "multiple_choice" && el.options && (
                <View style={styles.pollMCContainer}>
                  {el.options.map((opt) => (
                    <View key={opt.id} style={styles.pollMCOption}>
                      <Text style={styles.pollMCText}>{opt.text}</Text>
                    </View>
                  ))}
                </View>
              )}
              {el.pollType === "slider" && (
                <View style={styles.pollSliderRow}>
                  <Text style={styles.pollSliderLabel}>{el.minLabel}</Text>
                  <View style={styles.pollSliderTrack} />
                  <Text style={styles.pollSliderLabel}>{el.maxLabel}</Text>
                </View>
              )}
              {el.pollType === "question" && (
                <View style={styles.pollAnswerBox}>
                  <Text style={styles.pollAnswerPlaceholder}>
                    Tap to answer...
                  </Text>
                </View>
              )}
            </View>
          </DraggableItem>
        );
      }

      return null;
    },
    [elementPositions, handleDeleteElement],
  );

  // -- Filter thumbnail item --------------------------------------------------
  const renderFilterThumb = useCallback(
    ({ item }: { item: FilterConfig }) => {
      const isActive = selectedFilterId === item.id;
      return (
        <TouchableOpacity
          style={[styles.filterThumb, isActive && styles.filterThumbActive]}
          onPress={() => handleSelectFilter(item)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: snap.uri }}
            style={styles.filterThumbImage}
            resizeMode="cover"
          />
          <View
            style={[
              styles.filterThumbOverlay,
              isActive && { borderColor: "#007AFF" },
            ]}
          />
          <Text
            style={[
              styles.filterThumbText,
              isActive && styles.filterThumbTextActive,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedFilterId, snap.uri, handleSelectFilter],
  );

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <View style={styles.container}>
      {/* -- Image Preview -------------------------------------------------- */}
      <ViewShot
        ref={editorViewShotRef}
        options={{ format: "jpg", quality: 0.9 }}
        style={styles.previewContainer}
      >
        <Image
          source={{ uri: snap.uri }}
          style={[
            styles.preview,
            { transform: [{ rotate: rotation + "deg" }] },
          ]}
          resizeMode="contain"
        />

        {/* Filter colour overlay */}
        {filterOverlayColor && (
          <View
            style={[
              styles.filterOverlay,
              { backgroundColor: filterOverlayColor },
            ]}
            pointerEvents="none"
          />
        )}

        {/* Drawing canvas */}
        <DrawingCanvas
          color={drawColor}
          strokeWidth={drawBrush}
          enabled={activeTool === "draw"}
          paths={drawPaths}
          onPathsChange={setDrawPaths}
        />

        {/* Overlay elements (text, stickers, polls) */}
        {overlayElements.map(renderOverlayElement)}
      </ViewShot>

      {/* -- Top bar -------------------------------------------------------- */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleDiscard} style={styles.topBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.topRight}>
          {/* Undo */}
          <TouchableOpacity
            onPress={handleUndoDrawing}
            disabled={!canUndo && drawPaths.length === 0}
            style={[
              styles.topBtn,
              !canUndo && drawPaths.length === 0 && styles.topBtnDisabled,
            ]}
          >
            <Ionicons name="arrow-undo" size={22} color="#fff" />
          </TouchableOpacity>
          {/* Redo */}
          <TouchableOpacity
            onPress={redoAction}
            disabled={!canRedo}
            style={[styles.topBtn, !canRedo && styles.topBtnDisabled]}
          >
            <Ionicons name="arrow-redo" size={22} color="#fff" />
          </TouchableOpacity>
          {/* Rotate */}
          <TouchableOpacity onPress={handleRotate} style={styles.topBtn}>
            <Ionicons name="refresh-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* -- Tool-specific options bar -------------------------------------- */}
      {activeTool === "draw" && (
        <View style={styles.drawOptionsBar}>
          {/* Colour palette */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.paletteScroll}
          >
            {PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.paletteColor,
                  { backgroundColor: c },
                  drawColor === c && styles.paletteColorActive,
                ]}
                onPress={() => {
                  setDrawColor(c);
                  haptic();
                }}
              />
            ))}
          </ScrollView>
          {/* Brush sizes */}
          <View style={styles.brushRow}>
            {BRUSH_SIZES.map((sz) => (
              <TouchableOpacity
                key={sz}
                onPress={() => {
                  setDrawBrush(sz);
                  haptic();
                }}
                style={[
                  styles.brushBtn,
                  drawBrush === sz && styles.brushBtnActive,
                ]}
              >
                <View
                  style={[
                    styles.brushDot,
                    {
                      width: Math.max(8, sz),
                      height: Math.max(8, sz),
                      borderRadius: Math.max(4, sz / 2),
                      backgroundColor: drawColor,
                    },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {activeTool === "filter" && (
        <View style={styles.filterOptionsBar}>
          <FlatList
            data={ALL_FILTERS}
            renderItem={renderFilterThumb}
            keyExtractor={(f) => f.id}
            ListEmptyComponent={
              <Text style={styles.listEmptyText}>No filters available.</Text>
            }
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
          />
          {/* Intensity slider */}
          {selectedFilterId !== "none" && (
            <View style={styles.intensityRow}>
              <Text style={styles.intensityLabel}>Intensity</Text>
              <Slider
                style={styles.intensitySlider}
                minimumValue={0}
                maximumValue={1}
                value={filterIntensity}
                onValueChange={setFilterIntensity}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#fff"
                step={0.05}
              />
              <Text style={styles.intensityValue}>
                {Math.round(filterIntensity * 100)}%
              </Text>
            </View>
          )}
        </View>
      )}

      {/* -- Main toolbar --------------------------------------------------- */}
      <View style={styles.toolbar}>
        <ToolButton
          icon="text"
          label="Text"
          active={activeTool === "text"}
          onPress={() => selectTool("text")}
        />
        <ToolButton
          icon="brush"
          label="Draw"
          active={activeTool === "draw"}
          onPress={() => selectTool("draw")}
        />
        <ToolButton
          icon="color-palette-outline"
          label="Filter"
          active={activeTool === "filter"}
          onPress={() => selectTool("filter")}
        />
        <ToolButton
          icon="happy-outline"
          label="Sticker"
          active={activeTool === "sticker"}
          onPress={() => selectTool("sticker")}
        />
        <ToolButton
          icon="stats-chart-outline"
          label="Poll"
          active={activeTool === "poll"}
          onPress={() => selectTool("poll")}
        />
      </View>

      {/* -- Bottom action bar ---------------------------------------------- */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.discardBtn}
          onPress={handleDiscard}
          disabled={isExporting}
        >
          <Text style={styles.discardBtnText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.doneBtn, isExporting && { opacity: 0.7 }]}
          onPress={handleDone}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.doneBtnText}>
                {mode === "chat" ? "Send" : "Next"}
              </Text>
              <Ionicons
                name={mode === "chat" ? "send" : "arrow-forward"}
                size={18}
                color="#fff"
                style={{ marginLeft: 6 }}
              />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* -- Text Dialog Modal ---------------------------------------------- */}
      <Modal visible={showTextDialog} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.textDialog}>
            <Text style={styles.dialogTitle}>Add Text</Text>

            <TextInput
              style={styles.textDialogInput}
              placeholder="Type here..."
              placeholderTextColor="#666"
              value={textInput}
              onChangeText={setTextInput}
              maxLength={200}
              multiline
              autoFocus
            />

            {/* Colour row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.colorScrollRow}
            >
              {PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.paletteColor,
                    { backgroundColor: c },
                    textColor === c && styles.paletteColorActive,
                  ]}
                  onPress={() => setTextColor(c)}
                />
              ))}
            </ScrollView>

            {/* Font row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.fontScrollRow}
            >
              {(["Roboto", "Playfair", "Caveat", "Pacifico"] as const).map(
                (f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.fontBtn,
                      textFont === f && styles.fontBtnActive,
                    ]}
                    onPress={() => setTextFont(f)}
                  >
                    <Text style={styles.fontBtnText}>{f}</Text>
                  </TouchableOpacity>
                ),
              )}
            </ScrollView>

            {/* Size */}
            <View style={styles.sizeRow}>
              <Text style={styles.sizeLabel}>Size: {textSize}</Text>
              <Slider
                style={styles.sizeSlider}
                minimumValue={16}
                maximumValue={72}
                value={textSize}
                onValueChange={(v: number) => setTextSize(Math.round(v))}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#fff"
                step={1}
              />
            </View>

            {/* Buttons */}
            <View style={styles.dialogBtnRow}>
              <TouchableOpacity
                style={styles.dialogCancel}
                onPress={() => {
                  setShowTextDialog(false);
                  setActiveTool("none");
                }}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dialogAdd,
                  !textInput.trim() && { opacity: 0.4 },
                ]}
                onPress={handleAddText}
                disabled={!textInput.trim()}
              >
                <Text style={styles.dialogAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* -- Sticker Picker Modal ------------------------------------------- */}
      <Modal visible={showStickerPicker} transparent animationType="slide">
        <View style={styles.stickerModal}>
          <View style={styles.stickerHeader}>
            <Text style={styles.stickerTitle}>Stickers</Text>
            <TouchableOpacity
              onPress={() => {
                setShowStickerPicker(false);
                setActiveTool("none");
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={EMOJI_STICKERS}
            numColumns={5}
            keyExtractor={(item) => item}
            ListEmptyComponent={
              <Text style={styles.listEmptyText}>No stickers available.</Text>
            }
            contentContainerStyle={styles.stickerGrid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.stickerCell}
                onPress={() => handleAddSticker(item)}
              >
                <Text style={styles.stickerEmoji}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* -- Poll Creator --------------------------------------------------- */}
      <PollCreator
        visible={showPollCreator}
        onClose={() => {
          setShowPollCreator(false);
          setActiveTool("none");
        }}
        onCreatePoll={handleCreatePoll}
      />
    </View>
  );
};

// =============================================================================
// DRAGGABLE ITEM WRAPPER
// =============================================================================

interface DraggableItemProps {
  id: string;
  initialX: number;
  initialY: number;
  onPositionChange: (x: number, y: number) => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}

const DraggableItem: React.FC<DraggableItemProps> = React.memo(
  ({ initialX, initialY, onPositionChange, onLongPress, children }) => {
    const position = useRef({ x: initialX, y: initialY });
    const startPos = useRef({ x: 0, y: 0 });
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewRef = useRef<View>(null);

    // Keep callbacks fresh via refs so PanResponder never goes stale
    const onPositionChangeRef = useRef(onPositionChange);
    onPositionChangeRef.current = onPositionChange;
    const onLongPressRef = useRef(onLongPress);
    onLongPressRef.current = onLongPress;

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            startPos.current = { ...position.current };
            if (onLongPressRef.current) {
              longPressTimer.current = setTimeout(() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
                  () => {},
                );
                onLongPressRef.current?.();
              }, 600);
            }
          },
          onPanResponderMove: (_, gs) => {
            position.current = {
              x: startPos.current.x + gs.dx,
              y: startPos.current.y + gs.dy,
            };
            if (
              longPressTimer.current &&
              (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5)
            ) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
            // Move the view directly via setNativeProps for 60 fps
            viewRef.current?.setNativeProps({
              style: {
                left: position.current.x,
                top: position.current.y,
              },
            });
          },
          onPanResponderRelease: () => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
            onPositionChangeRef.current(position.current.x, position.current.y);
          },
        }),
      [], // stable — callbacks accessed via refs
    );

    return (
      <View
        ref={viewRef}
        {...panResponder.panHandlers}
        style={{
          position: "absolute",
          left: initialX,
          top: initialY,
          zIndex: 10,
        }}
      >
        {children}
      </View>
    );
  },
);

// =============================================================================
// TOOL BUTTON
// =============================================================================

interface ToolButtonProps {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = React.memo(
  ({ icon, label, active, onPress }) => (
    <TouchableOpacity
      style={[styles.toolBtn, active && styles.toolBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={22}
        color={active ? "#007AFF" : "#fff"}
      />
      <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  ),
);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  // Preview
  previewContainer: {
    flex: 1,
    backgroundColor: "#111",
    overflow: "hidden",
  },
  preview: { flex: 1, width: "100%" },

  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  // Top bar
  topBar: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 30,
  },
  topRight: { flexDirection: "row", gap: 8 },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  topBtnDisabled: { opacity: 0.35 },

  // Draw options bar
  drawOptionsBar: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 25,
  },
  paletteScroll: {
    paddingVertical: 6,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  paletteColor: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "transparent",
    marginHorizontal: 2,
  },
  paletteColorActive: {
    borderColor: "#fff",
    transform: [{ scale: 1.2 }],
  },
  brushRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
  },
  brushBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  brushBtnActive: {
    backgroundColor: "rgba(0,122,255,0.35)",
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  brushDot: {
    backgroundColor: "#fff",
  },

  // Filter options bar
  filterOptionsBar: {
    position: "absolute",
    bottom: TOOLBAR_H + BOTTOM_BAR_H + 6,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  filterList: { paddingHorizontal: 10 },
  listEmptyText: {
    color: "#9A9A9A",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center",
  },
  filterThumb: {
    width: 72,
    height: 96,
    marginRight: 8,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  filterThumbActive: {
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  filterThumbImage: {
    width: "100%",
    height: 64,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  filterThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  filterThumbText: {
    color: "#ccc",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 4,
  },
  filterThumbTextActive: { color: "#007AFF" },
  intensityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  intensityLabel: { color: "#aaa", fontSize: 12, fontWeight: "600" },
  intensitySlider: { flex: 1, marginHorizontal: 10 },
  intensityValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    width: 38,
    textAlign: "right",
  },

  // Toolbar
  toolbar: {
    flexDirection: "row",
    height: TOOLBAR_H,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  toolBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  toolBtnActive: {
    backgroundColor: "rgba(0,122,255,0.18)",
  },
  toolLabel: {
    color: "#aaa",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  toolLabelActive: { color: "#007AFF" },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    height: BOTTOM_BAR_H,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 20 : 0,
    gap: 12,
  },
  discardBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  discardBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  doneBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Text dialog
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  textDialog: {
    width: "88%",
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 20,
  },
  dialogTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },
  textDialogInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    minHeight: 56,
    marginBottom: 12,
  },
  colorScrollRow: { marginBottom: 10 },
  fontScrollRow: { marginBottom: 12 },
  fontBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginRight: 8,
  },
  fontBtnActive: { backgroundColor: "#007AFF" },
  fontBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  sizeRow: { marginBottom: 14 },
  sizeLabel: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  sizeSlider: { width: "100%", height: 36 },
  dialogBtnRow: { flexDirection: "row", gap: 10 },
  dialogCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  dialogCancelText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  dialogAdd: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#007AFF",
    alignItems: "center",
  },
  dialogAddText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Sticker modal
  stickerModal: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 50,
  },
  stickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  stickerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  stickerGrid: { padding: 10 },
  stickerCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerEmoji: { fontSize: 36 },

  // Poll bubble
  pollBubble: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 16,
    padding: 14,
    width: SCREEN_W * 0.75,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  pollQuestion: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  pollOptionsRow: { flexDirection: "row", gap: 10 },
  pollOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  pollOptionText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pollMCContainer: { gap: 6 },
  pollMCOption: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  pollMCText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  pollSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pollSliderLabel: { color: "#fff", fontSize: 18 },
  pollSliderTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  pollAnswerBox: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pollAnswerPlaceholder: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontStyle: "italic",
  },
});

export default EditorScreen;
