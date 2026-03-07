/**
 * Games V4 — Solitaire Klondike Game Component (Polished)
 *
 * Mobile-first Klondike Solitaire with premium visual design:
 * - Full-bleed felt-gradient background behind shell overlay buttons
 * - Safe-area-aware content inset (clears shell back/options overlays)
 * - Tap-to-select + tap-to-destination with visual destination highlights
 * - Double-tap to foundation
 * - Stock/waste/foundation management
 * - Undo, Hint, Auto-complete controls
 * - Responsive card sizing, dynamic tableau overlap
 * - Polished card rendering with depth/shadow/lift
 * - Animated foundation pulse, win celebration, hint glow
 * - Accessible labels throughout
 *
 * @module gamesV4/screens/solitaireKlondike/SolitaireKlondikeGame
 */

import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  cardRank,
  cardRankValue,
  cardSuit,
  cardSuitName,
  computeAutoCompleteEligibility,
  findAnyLegalMove,
  isValidAlternatingDescendingRun,
  type CardCode,
  type SolitaireMove,
  type SolitaireState,
  type SuitName,
  type TableauColumn,
} from "@/gamesV4/adapters/solitaireKlondike";
import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Design Tokens
// =============================================================================

/** Shell overlay buttons are 40px circles at insets.top + 8. Add breathing room. */
const SHELL_OVERLAY_CLEARANCE = 52;

const FELT = {
  gradient: ["#122b20", "#1a472a", "#1e5434", "#1a472a", "#122b20"] as const,
  locations: [0, 0.2, 0.5, 0.8, 1] as const,
};

const CARD_ASPECT = 1.4;
const CARD_RADIUS = 8;
const FACE_DOWN_OVERLAP = 5;
const FACE_UP_OVERLAP_BASE = 24;
const MAX_CARD_W = 58;
const MIN_CARD_W = 36;
const COLS = 7;
const H_PAD = 6;
const COL_GAP = 3;
const TOP_GAP = 5;

const CLR = {
  cardBg: "#FAFAF8",
  cardBorder: "rgba(0,0,0,0.08)",
  cardShadow: "#000",
  rankBlack: "#1a1a2e",
  rankRed: "#c0392b",
  backPrimary: "#1e3a5f",
  backAccent: "rgba(201,169,110,0.35)",
  selectBorder: "#56CCF2",
  selectGlow: "rgba(86,204,242,0.45)",
  hintBorder: "#F2C94C",
  hintGlow: "rgba(242,201,76,0.4)",
  validDestBorder: "rgba(86,204,242,0.5)",
  validDestBg: "rgba(86,204,242,0.08)",
  foundationSymbol: "rgba(255,255,255,0.2)",
  emptyBorder: "rgba(255,255,255,0.12)",
  emptyBg: "rgba(0,0,0,0.12)",
  statusLabel: "rgba(255,255,255,0.45)",
  statusValue: "#E0E0E0",
  statusDivider: "rgba(255,255,255,0.1)",
  barBg: "rgba(0,0,0,0.35)",
  barBorder: "rgba(255,255,255,0.08)",
  pillBg: "rgba(255,255,255,0.1)",
  pillText: "#E8E8E8",
  pillDisabledText: "rgba(255,255,255,0.25)",
  autoGold: "#F2C94C",
  winBackdrop: "rgba(0,0,0,0.7)",
  winGold: "#F2C94C",
  winWhite: "#FFF",
  badgeBg: "#E63946",
  badgeText: "#FFF",
};

const SUIT_SYMBOL: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_CLR: Record<string, string> = {
  S: CLR.rankBlack,
  H: CLR.rankRed,
  D: CLR.rankRed,
  C: CLR.rankBlack,
};

const FOUNDATION_ORDER: SuitName[] = ["clubs", "diamonds", "hearts", "spades"];
const SUIT_TO_SYMBOL: Record<SuitName, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

// =============================================================================
// Selection
// =============================================================================

interface Selection {
  source: "tableau" | "waste" | "foundation";
  col?: number;
  suit?: SuitName;
  startIndex?: number;
  cards: CardCode[];
}

// =============================================================================
// Valid-destination computation
// =============================================================================

function computeValidDestinations(
  sel: Selection | null,
  state: SolitaireState,
): { tableauCols: Set<number>; foundationSuits: Set<SuitName> } {
  const out = {
    tableauCols: new Set<number>(),
    foundationSuits: new Set<SuitName>(),
  };
  if (!sel || sel.cards.length === 0) return out;

  const lead = sel.cards[0];

  for (let c = 0; c < COLS; c++) {
    if (sel.source === "tableau" && sel.col === c) continue;
    const col = state.tableau[c];
    if (col.up.length === 0 && col.down.length === 0) {
      if (cardRankValue(lead) === 13) out.tableauCols.add(c);
    } else if (col.up.length > 0) {
      if (canPlaceOnTableau(lead, col.up[col.up.length - 1]))
        out.tableauCols.add(c);
    }
  }

  if (sel.cards.length === 1) {
    const card = sel.cards[0];
    for (const suit of FOUNDATION_ORDER) {
      const pile = state.foundations[suit];
      const top = pile.length > 0 ? pile[pile.length - 1] : null;
      if (canPlaceOnFoundation(card, top)) out.foundationSuits.add(suit);
    }
  }

  return out;
}

// =============================================================================
// Component
// =============================================================================

export default function SolitaireKlondikeGame(props: GameShellProps) {
  const { publicState, submitMove, isTerminal, actionLoading } = props;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const state = publicState as unknown as SolitaireState | null;

  // Selection
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hintMove, setHintMove] = useState<SolitaireMove | null>(null);

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-complete
  const [autoCompleting, setAutoCompleting] = useState(false);
  const autoCompleteRef = useRef(false);

  // Animations
  const foundationPulse = useRef(new Animated.Value(1)).current;
  const winOpacity = useRef(new Animated.Value(0)).current;
  const winScale = useRef(new Animated.Value(0.8)).current;

  // ── Timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state || isTerminal || state.completed) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const start = state.startedAt;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state?.startedAt, isTerminal, state?.completed]);

  useEffect(() => {
    setHintMove(null);
  }, [state?.moveCount]);

  // Win animation
  useEffect(() => {
    if (state?.completed) {
      Animated.parallel([
        Animated.timing(winOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(winScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      winOpacity.setValue(0);
      winScale.setValue(0.8);
    }
  }, [state?.completed, winOpacity, winScale]);

  // ── Layout ───────────────────────────────────────────────────────
  const topContentInset = insets.top + SHELL_OVERLAY_CLEARANCE;

  const cardWidth = useMemo(() => {
    const available = screenWidth - H_PAD * 2 - COL_GAP * (COLS - 1);
    const w = Math.floor(available / COLS);
    return Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, w));
  }, [screenWidth]);

  const cardHeight = Math.round(cardWidth * CARD_ASPECT);
  const faceUpOverlap = Math.max(
    16,
    Math.min(FACE_UP_OVERLAP_BASE, cardHeight * 0.28),
  );

  const validDests = useMemo(
    () =>
      state
        ? computeValidDestinations(selection, state)
        : {
            tableauCols: new Set<number>(),
            foundationSuits: new Set<SuitName>(),
          },
    [selection, state],
  );

  // ── Submit helper ────────────────────────────────────────────────
  const doMove = useCallback(
    async (move: SolitaireMove) => {
      setSelection(null);
      setHintMove(null);
      await submitMove(move as unknown as Record<string, unknown>);
    },
    [submitMove],
  );

  // ── Foundation pulse ─────────────────────────────────────────────
  const pulseFoundation = useCallback(() => {
    Animated.sequence([
      Animated.timing(foundationPulse, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(foundationPulse, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [foundationPulse]);

  // ── Double tap ───────────────────────────────────────────────────
  const lastTapRef = useRef<{ time: number; card: string }>({
    time: 0,
    card: "",
  });

  const handleDoubleTap = useCallback(
    (card: CardCode, source: "tableau" | "waste", col?: number) => {
      if (!state) return;
      const suitName = cardSuitName(card);
      const fPile = state.foundations[suitName];
      const fTop = fPile.length > 0 ? fPile[fPile.length - 1] : null;
      if (canPlaceOnFoundation(card, fTop)) {
        if (source === "tableau" && col !== undefined) {
          doMove({ type: "move_tableau_to_foundation", sourceCol: col });
        } else if (source === "waste") {
          doMove({ type: "move_waste_to_foundation" });
        }
        pulseFoundation();
      }
    },
    [state, doMove, pulseFoundation],
  );

  // ── Card tap ─────────────────────────────────────────────────────
  const handleCardTap = useCallback(
    (
      card: CardCode,
      source: "tableau" | "waste" | "foundation",
      col?: number,
      indexInUp?: number,
      suit?: SuitName,
    ) => {
      if (!state || isTerminal || actionLoading || autoCompleting) return;

      const now = Date.now();
      if (
        source !== "foundation" &&
        lastTapRef.current.card === card &&
        now - lastTapRef.current.time < 350
      ) {
        lastTapRef.current = { time: 0, card: "" };
        handleDoubleTap(card, source as "tableau" | "waste", col);
        setSelection(null);
        return;
      }
      lastTapRef.current = { time: now, card };

      if (selection) {
        if (source === "tableau" && col !== undefined) {
          if (selection.source === "tableau" && selection.col !== undefined) {
            doMove({
              type: "move_tableau_to_tableau",
              sourceCol: selection.col,
              destCol: col,
              startIndex: selection.startIndex ?? 0,
              count: selection.cards.length,
            });
            return;
          }
          if (selection.source === "waste") {
            doMove({ type: "move_waste_to_tableau", destCol: col });
            return;
          }
          if (selection.source === "foundation" && selection.suit) {
            doMove({
              type: "move_foundation_to_tableau",
              sourceSuit: selection.suit,
              destCol: col,
            });
            return;
          }
        }

        if (source === "foundation" && suit) {
          if (
            selection.source === "tableau" &&
            selection.col !== undefined &&
            selection.cards.length === 1
          ) {
            doMove({
              type: "move_tableau_to_foundation",
              sourceCol: selection.col,
            });
            return;
          }
          if (selection.source === "waste" && selection.cards.length === 1) {
            doMove({ type: "move_waste_to_foundation" });
            return;
          }
        }

        if (
          selection.source === source &&
          selection.col === col &&
          selection.startIndex === indexInUp
        ) {
          setSelection(null);
          return;
        }
      }

      if (
        source === "tableau" &&
        col !== undefined &&
        indexInUp !== undefined
      ) {
        const tableau = state.tableau[col];
        const run = tableau.up.slice(indexInUp);
        if (isValidAlternatingDescendingRun(run)) {
          setSelection({
            source: "tableau",
            col,
            startIndex: indexInUp,
            cards: run,
          });
        }
      } else if (source === "waste") {
        setSelection({ source: "waste", cards: [card] });
      } else if (source === "foundation" && suit) {
        setSelection({ source: "foundation", suit, cards: [card] });
      }
    },
    [
      state,
      selection,
      isTerminal,
      actionLoading,
      autoCompleting,
      doMove,
      handleDoubleTap,
    ],
  );

  const handleStockTap = useCallback(() => {
    if (!state || isTerminal || actionLoading || autoCompleting) return;
    setSelection(null);
    if (state.stock.length > 0) {
      doMove({ type: "deal_stock" });
    } else if (state.waste.length > 0) {
      doMove({ type: "recycle_stock" });
    }
  }, [state, isTerminal, actionLoading, autoCompleting, doMove]);

  const handleEmptyTableauTap = useCallback(
    (col: number) => {
      if (!state || isTerminal || actionLoading || !selection) return;
      if (selection.source === "tableau" && selection.col !== undefined) {
        doMove({
          type: "move_tableau_to_tableau",
          sourceCol: selection.col,
          destCol: col,
          startIndex: selection.startIndex ?? 0,
          count: selection.cards.length,
        });
      } else if (selection.source === "waste") {
        doMove({ type: "move_waste_to_tableau", destCol: col });
      } else if (selection.source === "foundation" && selection.suit) {
        doMove({
          type: "move_foundation_to_tableau",
          sourceSuit: selection.suit,
          destCol: col,
        });
      }
    },
    [state, isTerminal, actionLoading, selection, doMove],
  );

  const handleEmptyFoundationTap = useCallback(
    (suit: SuitName) => {
      if (!state || isTerminal || actionLoading || !selection) return;
      if (selection.cards.length === 1) {
        if (selection.source === "tableau" && selection.col !== undefined) {
          doMove({
            type: "move_tableau_to_foundation",
            sourceCol: selection.col,
          });
        } else if (selection.source === "waste") {
          doMove({ type: "move_waste_to_foundation" });
        }
      }
    },
    [state, isTerminal, actionLoading, selection, doMove],
  );

  const handleUndo = useCallback(() => {
    if (!state || isTerminal || actionLoading) return;
    doMove({ type: "undo" });
  }, [state, isTerminal, actionLoading, doMove]);

  const handleHint = useCallback(() => {
    if (!state || isTerminal) return;
    const move = findAnyLegalMove(state);
    if (move) {
      setHintMove(move);
      setSelection(null);
      setTimeout(() => setHintMove(null), 2500);
    }
  }, [state, isTerminal]);

  const handleAutoComplete = useCallback(async () => {
    if (!state || isTerminal || autoCompleting) return;
    if (!computeAutoCompleteEligibility(state)) return;
    setAutoCompleting(true);
    autoCompleteRef.current = true;
    setSelection(null);

    const runStep = async () => {
      if (!autoCompleteRef.current) return;
      const ok = await submitMove({
        type: "auto_complete_step",
      } as unknown as Record<string, unknown>);
      if (ok) {
        pulseFoundation();
        setTimeout(runStep, 180);
      } else {
        setAutoCompleting(false);
        autoCompleteRef.current = false;
      }
    };
    runStep();
  }, [state, isTerminal, autoCompleting, submitMove, pulseFoundation]);

  useEffect(() => {
    if (isTerminal || state?.completed) {
      autoCompleteRef.current = false;
      setAutoCompleting(false);
    }
  }, [isTerminal, state?.completed]);

  // ── Loading ──────────────────────────────────────────────────────
  if (!state) {
    return (
      <LinearGradient
        colors={[...FELT.gradient]}
        locations={[...FELT.locations]}
        style={sty.container}
      >
        <Text style={sty.loadingText}>Dealing cards…</Text>
      </LinearGradient>
    );
  }

  // ── Derived ──────────────────────────────────────────────────────
  const foundationCount =
    state.foundations.spades.length +
    state.foundations.hearts.length +
    state.foundations.diamonds.length +
    state.foundations.clubs.length;

  const canUndo = !!(state.undoStack && state.undoStack.length > 0);
  const canAutoComp = !!state.canAutoComplete && !autoCompleting;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  // ── Render Helpers ───────────────────────────────────────────────

  const isCardSelected = (
    source: string,
    col?: number,
    idx?: number,
    suit?: SuitName,
  ): boolean => {
    if (!selection) return false;
    if (selection.source !== source) return false;
    if (source === "tableau")
      return selection.col === col && (selection.startIndex ?? 0) <= (idx ?? 0);
    if (source === "waste") return true;
    if (source === "foundation") return selection.suit === suit;
    return false;
  };

  const isHintSource = (source: string, col?: number): boolean => {
    if (!hintMove) return false;
    if (
      source === "tableau" &&
      hintMove.type === "move_tableau_to_foundation" &&
      hintMove.sourceCol === col
    )
      return true;
    if (
      source === "tableau" &&
      hintMove.type === "move_tableau_to_tableau" &&
      hintMove.sourceCol === col
    )
      return true;
    if (
      source === "waste" &&
      (hintMove.type === "move_waste_to_foundation" ||
        hintMove.type === "move_waste_to_tableau")
    )
      return true;
    if (
      source === "stock" &&
      (hintMove.type === "deal_stock" || hintMove.type === "recycle_stock")
    )
      return true;
    return false;
  };

  const isHintDest = (
    source: string,
    col?: number,
    _suit?: SuitName,
  ): boolean => {
    if (!hintMove) return false;
    if (
      source === "tableau" &&
      hintMove.type === "move_waste_to_tableau" &&
      hintMove.destCol === col
    )
      return true;
    if (
      source === "tableau" &&
      hintMove.type === "move_tableau_to_tableau" &&
      hintMove.destCol === col
    )
      return true;
    if (
      source === "foundation" &&
      (hintMove.type === "move_waste_to_foundation" ||
        hintMove.type === "move_tableau_to_foundation")
    )
      return true;
    return false;
  };

  // ── Card Face ────────────────────────────────────────────────────

  const renderCard = (
    card: CardCode,
    selected: boolean,
    hint: boolean,
    onPress: () => void,
    label: string,
    key: string,
  ) => {
    const suit = cardSuit(card);
    const rank = cardRank(card);
    const clr = SUIT_CLR[suit];
    const sym = SUIT_SYMBOL[suit];

    return (
      <Pressable
        key={key}
        onPress={onPress}
        accessibilityLabel={label}
        accessibilityRole="button"
        style={({ pressed }) => [
          sty.card,
          { width: cardWidth, height: cardHeight, borderRadius: CARD_RADIUS },
          selected && sty.cardSelected,
          hint && sty.cardHint,
          pressed && !selected && sty.cardPressed,
        ]}
      >
        <View style={sty.cardCorner}>
          <Text
            style={[
              sty.cardRank,
              { color: clr, fontSize: Math.max(10, cardWidth * 0.26) },
            ]}
            numberOfLines={1}
          >
            {rank}
          </Text>
          <Text
            style={[
              sty.cardSuitSmall,
              { color: clr, fontSize: Math.max(8, cardWidth * 0.18) },
            ]}
          >
            {sym}
          </Text>
        </View>
        <Text
          style={[
            sty.cardCenterSuit,
            { color: clr, fontSize: cardWidth * 0.5 },
          ]}
        >
          {sym}
        </Text>
        <View style={sty.cardCornerBottom}>
          <Text
            style={[
              sty.cardSuitSmall,
              { color: clr, fontSize: Math.max(8, cardWidth * 0.18) },
            ]}
          >
            {sym}
          </Text>
          <Text
            style={[
              sty.cardRank,
              { color: clr, fontSize: Math.max(10, cardWidth * 0.26) },
            ]}
            numberOfLines={1}
          >
            {rank}
          </Text>
        </View>
      </Pressable>
    );
  };

  // ── Card Back ────────────────────────────────────────────────────

  const renderCardBack = (key: string) => (
    <View
      key={key}
      style={[
        sty.cardBack,
        { width: cardWidth, height: cardHeight, borderRadius: CARD_RADIUS },
      ]}
      accessibilityLabel="Face-down card"
    >
      <View style={sty.cardBackPattern}>
        <View style={sty.cardBackDiamond} />
      </View>
    </View>
  );

  // ── Empty Slot ───────────────────────────────────────────────────

  const renderEmptySlot = (
    label: string,
    onPress?: () => void,
    isValid?: boolean,
    hint?: boolean,
    children?: React.ReactNode,
  ) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={label}
      accessibilityRole={onPress ? "button" : "none"}
      style={[
        sty.emptySlot,
        { width: cardWidth, height: cardHeight, borderRadius: CARD_RADIUS },
        isValid && sty.validDest,
        hint && sty.cardHint,
      ]}
    >
      {children}
    </Pressable>
  );

  // ── Foundation Slot ──────────────────────────────────────────────

  const renderFoundation = (suitName: SuitName) => {
    const pile = state.foundations[suitName];
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const hint = isHintDest("foundation", undefined, suitName);
    const isValid = validDests.foundationSuits.has(suitName);

    if (top) {
      const sel = isCardSelected("foundation", undefined, undefined, suitName);
      return (
        <Animated.View
          key={suitName}
          style={{ transform: [{ scale: foundationPulse }] }}
        >
          {renderCard(
            top,
            sel,
            hint,
            () =>
              handleCardTap(top, "foundation", undefined, undefined, suitName),
            `${suitName} foundation: ${cardRank(top)} of ${suitName}`,
            `f-${suitName}`,
          )}
          {pile.length > 1 && (
            <View style={sty.foundationBadge}>
              <Text style={sty.foundationBadgeText}>{pile.length}</Text>
            </View>
          )}
        </Animated.View>
      );
    }

    return (
      <Animated.View
        key={suitName}
        style={{ transform: [{ scale: foundationPulse }] }}
      >
        {renderEmptySlot(
          `Empty ${suitName} foundation`,
          selection ? () => handleEmptyFoundationTap(suitName) : undefined,
          isValid,
          hint,
          <Text style={[sty.foundationSymbol, { fontSize: cardWidth * 0.4 }]}>
            {SUIT_TO_SYMBOL[suitName]}
          </Text>,
        )}
      </Animated.View>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════

  return (
    <LinearGradient
      colors={[...FELT.gradient]}
      locations={[...FELT.locations]}
      style={sty.container}
    >
      {/* Safe-area spacer — clears shell overlay back/options buttons */}
      <View style={{ height: topContentInset }} />

      {/* ── Status Row ── */}
      <View style={sty.statusRow}>
        <View style={sty.statusChip}>
          <Text style={sty.statusLabel}>SCORE</Text>
          <Text style={sty.statusValue}>{state.score}</Text>
        </View>
        <View style={sty.statusDivider} />
        <View style={sty.statusChip}>
          <Text style={sty.statusLabel}>TIME</Text>
          <Text style={sty.statusValue}>{timeStr}</Text>
        </View>
        <View style={sty.statusDivider} />
        <View style={sty.statusChip}>
          <Text style={sty.statusLabel}>FOUNDATION</Text>
          <Text style={sty.statusValue}>
            {foundationCount}
            <Text style={sty.statusValueDim}>/52</Text>
          </Text>
        </View>
        <View style={sty.statusDivider} />
        <View style={sty.statusChip}>
          <Text style={sty.statusLabel}>MOVES</Text>
          <Text style={sty.statusValue}>{state.moveCount}</Text>
        </View>
      </View>

      {/* ── Top Play Row ── */}
      <View style={[sty.topRow, { gap: TOP_GAP }]}>
        {/* Stock */}
        <Pressable
          onPress={handleStockTap}
          accessibilityLabel={
            state.stock.length > 0
              ? `Stock pile, ${state.stock.length} cards. Tap to deal.`
              : state.waste.length > 0
                ? "Stock empty. Tap to recycle waste."
                : "Stock and waste empty."
          }
          accessibilityRole="button"
        >
          {state.stock.length > 0 ? (
            <View
              style={[
                isHintSource("stock") && sty.cardHint,
                { borderRadius: CARD_RADIUS },
              ]}
            >
              {renderCardBack("stock")}
              <View style={sty.stockBadge}>
                <Text style={sty.stockBadgeText}>{state.stock.length}</Text>
              </View>
            </View>
          ) : (
            renderEmptySlot(
              "Empty stock — tap to recycle",
              state.waste.length > 0 ? handleStockTap : undefined,
              false,
              isHintSource("stock"),
              <MaterialCommunityIcons
                name="refresh"
                size={cardWidth * 0.38}
                color="rgba(255,255,255,0.35)"
              />,
            )
          )}
        </Pressable>

        {/* Waste */}
        <View>
          {state.waste.length > 0
            ? (() => {
                const wasteTop = state.waste[state.waste.length - 1];
                return renderCard(
                  wasteTop,
                  isCardSelected("waste"),
                  isHintSource("waste"),
                  () => handleCardTap(wasteTop, "waste"),
                  `Waste top: ${cardRank(wasteTop)} of ${cardSuitName(wasteTop)}`,
                  "waste-top",
                );
              })()
            : renderEmptySlot("Empty waste pile")}
        </View>

        <View style={{ flex: 1 }} />

        {FOUNDATION_ORDER.map(renderFoundation)}
      </View>

      {/* ── Tableau ── */}
      <ScrollView
        style={sty.tableauScroll}
        contentContainerStyle={sty.tableauContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[sty.tableauRow, { gap: COL_GAP }]}>
          {state.tableau.map((col: TableauColumn, colIdx: number) => {
            const isEmpty = col.down.length === 0 && col.up.length === 0;
            const hint = isHintDest("tableau", colIdx);
            const isValid = validDests.tableauCols.has(colIdx);

            return (
              <View
                key={`col-${colIdx}`}
                style={[sty.tableauCol, { width: cardWidth }]}
              >
                {isEmpty ? (
                  <Pressable
                    onPress={() => handleEmptyTableauTap(colIdx)}
                    accessibilityLabel={`Empty tableau column ${colIdx + 1}`}
                    accessibilityRole="button"
                    style={[
                      sty.emptySlot,
                      {
                        width: cardWidth,
                        height: cardHeight,
                        borderRadius: CARD_RADIUS,
                      },
                      isValid && sty.validDest,
                      hint && sty.cardHint,
                    ]}
                  >
                    <Text
                      style={[
                        sty.emptySlotKing,
                        { fontSize: cardWidth * 0.28 },
                      ]}
                    >
                      K
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    {col.down.map((_card: CardCode, i: number) => (
                      <View
                        key={`d-${colIdx}-${i}`}
                        style={
                          i > 0
                            ? { marginTop: -cardHeight + FACE_DOWN_OVERLAP }
                            : undefined
                        }
                      >
                        {renderCardBack(`d-${colIdx}-${i}`)}
                      </View>
                    ))}
                    {col.up.map((card: CardCode, i: number) => {
                      const sel = isCardSelected("tableau", colIdx, i);
                      const isHintSrc =
                        hintMove &&
                        ((hintMove.type === "move_tableau_to_foundation" &&
                          hintMove.sourceCol === colIdx &&
                          i === col.up.length - 1) ||
                          (hintMove.type === "move_tableau_to_tableau" &&
                            hintMove.sourceCol === colIdx &&
                            i >= (hintMove.startIndex ?? 0)));
                      const needsOverlap = i > 0 || col.down.length > 0;

                      return (
                        <View
                          key={`u-${colIdx}-${i}`}
                          style={
                            needsOverlap
                              ? {
                                  marginTop: -cardHeight + faceUpOverlap,
                                }
                              : undefined
                          }
                        >
                          {renderCard(
                            card,
                            sel,
                            !!isHintSrc || (hint && i === col.up.length - 1),
                            () => handleCardTap(card, "tableau", colIdx, i),
                            `${cardRank(card)} of ${cardSuitName(card)}, column ${colIdx + 1}`,
                            `u-${colIdx}-${i}`,
                          )}
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Win Overlay ── */}
      {state.completed && (
        <Animated.View style={[sty.winOverlay, { opacity: winOpacity }]}>
          <Animated.View
            style={[sty.winCard, { transform: [{ scale: winScale }] }]}
          >
            <Text style={sty.winEmoji}>🏆</Text>
            <Text style={sty.winTitle}>You Win!</Text>
            <View style={sty.winDivider} />
            <View style={sty.winStatRow}>
              <Text style={sty.winStatLabel}>Final Score</Text>
              <Text style={sty.winStatValue}>{state.score}</Text>
            </View>
            <View style={sty.winStatRow}>
              <Text style={sty.winStatLabel}>Moves</Text>
              <Text style={sty.winStatValue}>{state.moveCount}</Text>
            </View>
            <View style={sty.winStatRow}>
              <Text style={sty.winStatLabel}>Time</Text>
              <Text style={sty.winStatValue}>{timeStr}</Text>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Bottom Action Bar ── */}
      <View
        style={[
          sty.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 12) + 4 },
        ]}
      >
        <Pressable
          onPress={handleUndo}
          disabled={!canUndo || isTerminal || autoCompleting}
          accessibilityLabel="Undo last move"
          accessibilityRole="button"
          style={({ pressed }) => [
            sty.pill,
            !canUndo && sty.pillDisabled,
            pressed && canUndo && sty.pillPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="undo"
            size={20}
            color={canUndo ? CLR.pillText : CLR.pillDisabledText}
          />
          <Text style={[sty.pillLabel, !canUndo && sty.pillLabelDisabled]}>
            Undo
          </Text>
        </Pressable>

        <Pressable
          onPress={handleHint}
          disabled={isTerminal || autoCompleting}
          accessibilityLabel="Get a hint"
          accessibilityRole="button"
          style={({ pressed }) => [sty.pill, pressed && sty.pillPressed]}
        >
          <MaterialCommunityIcons
            name="lightbulb-outline"
            size={20}
            color={CLR.pillText}
          />
          <Text style={sty.pillLabel}>Hint</Text>
        </Pressable>

        <Pressable
          onPress={handleAutoComplete}
          disabled={!canAutoComp || isTerminal}
          accessibilityLabel="Auto-complete"
          accessibilityRole="button"
          style={({ pressed }) => [
            sty.pill,
            !canAutoComp && sty.pillDisabled,
            pressed && canAutoComp && sty.pillPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="auto-fix"
            size={20}
            color={canAutoComp ? CLR.autoGold : CLR.pillDisabledText}
          />
          <Text style={[sty.pillLabel, !canAutoComp && sty.pillLabelDisabled]}>
            Auto
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

// =============================================================================
// Styles
// =============================================================================

const sty = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 160,
  },

  // ── Status Row ───────────────────────────────────────────────────
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: H_PAD + 2,
    paddingVertical: 6,
  },
  statusChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 2,
  },
  statusLabel: {
    color: CLR.statusLabel,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  statusValue: {
    color: CLR.statusValue,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 1,
  },
  statusValueDim: {
    color: CLR.statusLabel,
    fontSize: 12,
    fontWeight: "600",
  },
  statusDivider: {
    width: 1,
    height: 22,
    backgroundColor: CLR.statusDivider,
    marginHorizontal: 2,
  },

  // ── Top Row ──────────────────────────────────────────────────────
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: H_PAD,
    paddingTop: 6,
    paddingBottom: 8,
  },

  // ── Card Face ────────────────────────────────────────────────────
  card: {
    backgroundColor: CLR.cardBg,
    borderWidth: 1,
    borderColor: CLR.cardBorder,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: CLR.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 3,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  cardSelected: {
    borderColor: CLR.selectBorder,
    borderWidth: 2,
    transform: [{ translateY: -2 }],
    ...Platform.select({
      ios: {
        shadowColor: CLR.selectGlow,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  cardHint: {
    borderColor: CLR.hintBorder,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: CLR.hintGlow,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardCorner: {
    position: "absolute",
    top: 3,
    left: 4,
    alignItems: "center",
  },
  cardCornerBottom: {
    position: "absolute",
    bottom: 3,
    right: 4,
    alignItems: "center",
    transform: [{ rotate: "180deg" }],
  },
  cardRank: {
    fontWeight: "900",
    includeFontPadding: false,
  },
  cardSuitSmall: {
    marginTop: -2,
    includeFontPadding: false,
  },
  cardCenterSuit: {
    position: "absolute",
    alignSelf: "center",
    top: "32%",
    opacity: 0.08,
  },

  // ── Card Back ────────────────────────────────────────────────────
  cardBack: {
    backgroundColor: CLR.backPrimary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  cardBackPattern: {
    flex: 1,
    margin: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: CLR.backAccent,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(30,58,95,0.6)",
  },
  cardBackDiamond: {
    width: 12,
    height: 12,
    backgroundColor: CLR.backAccent,
    transform: [{ rotate: "45deg" }],
    borderRadius: 2,
  },

  // ── Empty Slot ───────────────────────────────────────────────────
  emptySlot: {
    borderWidth: 1.5,
    borderColor: CLR.emptyBorder,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: CLR.emptyBg,
  },
  emptySlotKing: {
    color: "rgba(255,255,255,0.15)",
    fontWeight: "800",
  },

  // ── Valid Destination ────────────────────────────────────────────
  validDest: {
    borderColor: CLR.validDestBorder,
    borderStyle: "solid",
    backgroundColor: CLR.validDestBg,
  },

  // ── Foundation ───────────────────────────────────────────────────
  foundationSymbol: {
    color: CLR.foundationSymbol,
    fontWeight: "700",
  },
  foundationBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  foundationBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },

  // ── Stock Badge ──────────────────────────────────────────────────
  stockBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    backgroundColor: CLR.badgeBg,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  stockBadgeText: {
    color: CLR.badgeText,
    fontSize: 9,
    fontWeight: "800",
  },

  // ── Tableau ──────────────────────────────────────────────────────
  tableauScroll: {
    flex: 1,
    marginTop: 2,
  },
  tableauContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 24,
  },
  tableauRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  tableauCol: {
    alignItems: "center",
  },

  // ── Win Overlay ──────────────────────────────────────────────────
  winOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CLR.winBackdrop,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  winCard: {
    backgroundColor: "rgba(26,71,42,0.95)",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(242,201,76,0.3)",
    minWidth: 240,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  winEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  winTitle: {
    color: CLR.winGold,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
  },
  winDivider: {
    width: 60,
    height: 2,
    backgroundColor: "rgba(242,201,76,0.3)",
    borderRadius: 1,
    marginVertical: 14,
  },
  winStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 4,
  },
  winStatLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontWeight: "600",
  },
  winStatValue: {
    color: CLR.winWhite,
    fontSize: 14,
    fontWeight: "800",
  },

  // ── Bottom Action Bar ────────────────────────────────────────────
  bottomBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: H_PAD + 4,
    paddingTop: 10,
    backgroundColor: CLR.barBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CLR.barBorder,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: CLR.pillBg,
    minWidth: 72,
    justifyContent: "center",
  },
  pillPressed: {
    backgroundColor: "rgba(255,255,255,0.18)",
    transform: [{ scale: 0.96 }],
  },
  pillDisabled: {
    opacity: 0.35,
  },
  pillLabel: {
    color: CLR.pillText,
    fontSize: 12,
    fontWeight: "700",
  },
  pillLabelDisabled: {
    color: CLR.pillDisabledText,
  },
});
