/**
 * Minesweeper — Help / Instructions Modal
 *
 * Classic Minesweeper help adapted for mobile.
 * Explains gameplay, controls, difficulty modes.
 *
 * @module gamesV4/screens/minesweeper/MinesweeperHelpModal
 */

import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MinesweeperHelpModal({ visible, onClose }: HelpModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Title bar */}
          <View style={styles.titleBar}>
            <Text style={styles.titleText}>Minesweeper Help</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={true}
          >
            {/* Goal */}
            <Text style={styles.sectionTitle}>🎯 Goal</Text>
            <Text style={styles.body}>
              Reveal all safe cells on the board without clicking on a mine. Use
              the numbered clues to deduce where mines are hidden, then flag
              them for safety.
            </Text>

            {/* How to Play */}
            <Text style={styles.sectionTitle}>🕹️ How to Play</Text>

            <Text style={styles.subTitle}>Reveal a Cell</Text>
            <Text style={styles.body}>
              Tap any hidden cell to reveal it. If it contains a number, that&apos;s
              how many mines are adjacent to it. If it&apos;s empty (0 mines nearby),
              all connected empty cells are revealed automatically.
            </Text>

            <Text style={styles.subTitle}>Flag a Mine</Text>
            <Text style={styles.body}>
              Long-press a hidden cell to place a flag where you think a mine
              is. Long-press again to remove the flag.{"\n\n"}
              You can also toggle <Text style={styles.bold}>
                Flag Mode
              </Text>{" "}
              using the 🚩 button — when active, tapping will place/remove flags
              instead of revealing cells.
            </Text>

            <Text style={styles.subTitle}>Chord Reveal</Text>
            <Text style={styles.body}>
              Tap an already-revealed numbered cell where the number of adjacent
              flags matches the number. This automatically reveals all
              non-flagged neighbors. Be careful — if any flag is wrong, you&apos;ll
              hit a mine!
            </Text>

            {/* Numbers */}
            <Text style={styles.sectionTitle}>🔢 Number Colors</Text>
            <View style={styles.colorRow}>
              {[
                { n: 1, color: "#0000FF", label: "1 = Blue" },
                { n: 2, color: "#008000", label: "2 = Green" },
                { n: 3, color: "#FF0000", label: "3 = Red" },
                { n: 4, color: "#000080", label: "4 = Navy" },
                { n: 5, color: "#800000", label: "5 = Maroon" },
                { n: 6, color: "#008080", label: "6 = Teal" },
                { n: 7, color: "#000000", label: "7 = Black" },
                { n: 8, color: "#808080", label: "8 = Gray" },
              ].map(({ n, color, label }) => (
                <View key={n} style={styles.colorItem}>
                  <Text style={[styles.colorNum, { color }]}>{n}</Text>
                  <Text style={styles.colorLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Difficulty */}
            <Text style={styles.sectionTitle}>📊 Difficulty Modes</Text>
            <View style={styles.diffRow}>
              <View style={styles.diffItem}>
                <Text style={styles.diffName}>Easy</Text>
                <Text style={styles.diffDesc}>9×9 board{"\n"}10 mines</Text>
              </View>
              <View style={styles.diffItem}>
                <Text style={styles.diffName}>Intermediate</Text>
                <Text style={styles.diffDesc}>16×16 board{"\n"}40 mines</Text>
              </View>
              <View style={styles.diffItem}>
                <Text style={styles.diffName}>Expert</Text>
                <Text style={styles.diffDesc}>30×16 board{"\n"}99 mines</Text>
              </View>
            </View>

            {/* Controls */}
            <Text style={styles.sectionTitle}>📱 Mobile Controls</Text>
            <Text style={styles.body}>
              • <Text style={styles.bold}>Tap</Text> — Reveal cell{"\n"}•{" "}
              <Text style={styles.bold}>Long press</Text> — Flag/unflag{"\n"}•{" "}
              <Text style={styles.bold}>Tap revealed number</Text> — Chord
              reveal{"\n"}• <Text style={styles.bold}>🚩 button</Text> — Toggle
              flag mode{"\n"}• <Text style={styles.bold}>😊 Smiley</Text> — New
              game{"\n"}• <Text style={styles.bold}>Scroll</Text> — Pan on
              Expert boards
            </Text>

            {/* Win / Lose */}
            <Text style={styles.sectionTitle}>🏆 Win / Lose</Text>
            <Text style={styles.body}>
              <Text style={styles.bold}>Win:</Text> Reveal every safe cell.
              Remaining mines are auto-flagged.{"\n\n"}
              <Text style={styles.bold}>Lose:</Text> Click on a mine. All mines
              are revealed and incorrectly placed flags are marked with ✕.
            </Text>

            {/* Tips */}
            <Text style={styles.sectionTitle}>💡 Tips</Text>
            <Text style={styles.body}>
              • Your first click is always safe.{"\n"}• Start by clicking near
              the center for bigger openings.{"\n"}• Use chord reveal to clear
              cells faster once you&apos;ve flagged correctly.{"\n"}• The mine
              counter shows mines minus flags — keep it balanced.{"\n"}• Expert
              boards may need scrolling to see the full board.
            </Text>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: "#C0C0C0",
    borderWidth: 3,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomColor: "#808080",
    borderRightColor: "#808080",
    overflow: "hidden",
  },
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#000080",
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 28,
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  closeBtn: {
    width: 22,
    height: 22,
    backgroundColor: "#C0C0C0",
    borderWidth: 2,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomColor: "#808080",
    borderRightColor: "#808080",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
    marginTop: -1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginTop: 16,
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginTop: 10,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: "#222",
    lineHeight: 20,
  },
  bold: {
    fontWeight: "700",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  colorItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 90,
  },
  colorNum: {
    fontWeight: "900",
    fontSize: 16,
  },
  colorLabel: {
    fontSize: 12,
    color: "#444",
  },
  diffRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  diffItem: {
    flex: 1,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    padding: 8,
    alignItems: "center",
  },
  diffName: {
    fontWeight: "700",
    fontSize: 13,
    color: "#000",
  },
  diffDesc: {
    fontSize: 11,
    color: "#555",
    textAlign: "center",
    marginTop: 2,
  },
});
