/**
 * Games Components Index
 *
 * Central export for all games-related UI components.
 */

// =============================================================================
// Game Cards
// =============================================================================

export {
  CompactGameCard,
  GameCard,
  type CompactGameCardProps,
  type GameCardProps,
} from "./GameCard";

// =============================================================================
// Player Components
// =============================================================================

export {
  CompactPlayerBar,
  PlayerBar,
  type CompactPlayerBarProps,
  type PlayerBarProps,
  type PlayerInfo,
} from "./PlayerBar";

// =============================================================================
// Modals
// =============================================================================

export {
  GameOverModal,
  type GameOverModalProps,
  type GameOverStats,
  type GameResult,
} from "./GameOverModal";

export {
  MatchmakingModal,
  type MatchmakingModalProps,
  type MatchmakingStatus,
  type OpponentInfo,
} from "./MatchmakingModal";

// =============================================================================
// Feature Cards
// =============================================================================

export {
  DailyChallengeCard,
  DailyChallengeEmpty,
  type DailyChallengeCardProps,
  type DailyChallengeData,
} from "./DailyChallengeCard";

// =============================================================================
// Navigation Components
// =============================================================================

export {
  CategoryTabs,
  SegmentedTabs,
  type CategoryTabsProps,
  type GameCategoryTab,
  type SegmentedTabsProps,
  type TabConfig,
} from "./CategoryTabs";

// =============================================================================
// Error Handling & Performance
// =============================================================================

export {
  GameErrorBoundary,
  withGameErrorBoundary,
  type GameErrorBoundaryProps,
} from "./GameErrorBoundary";

export {
  GamePerformanceMonitor,
  type GamePerformanceMonitorProps,
} from "./GamePerformanceMonitor";

export {
  ConnectionBadge,
  GameOfflineOverlay,
  OfflineIndicator,
  useNetworkStatus,
  type ConnectionBadgeProps,
  type ConnectionStatus,
  type GameOfflineOverlayProps,
  type OfflineIndicatorProps,
} from "./OfflineIndicator";
