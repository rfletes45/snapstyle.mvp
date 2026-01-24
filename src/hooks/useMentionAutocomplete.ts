/**
 * useMentionAutocomplete Hook
 * Phase H9: Mentions + notifyLevel
 *
 * Manages the state for @mention autocomplete in the chat composer.
 *
 * @module hooks/useMentionAutocomplete
 */

import {
  detectMentionTrigger,
  filterMembersByQuery,
  insertMention,
  InsertMentionResult,
  MentionableMember,
  MentionTriggerResult,
} from "@/services/mentionParser";
import { createLogger } from "@/utils/log";
import { useCallback, useMemo, useState } from "react";

const log = createLogger("useMentionAutocomplete");

// =============================================================================
// Types
// =============================================================================

export interface UseMentionAutocompleteOptions {
  /**
   * All members that can be mentioned
   */
  members: MentionableMember[];

  /**
   * UIDs to exclude from suggestions (e.g., current user)
   */
  excludeUids?: string[];

  /**
   * Maximum number of suggestions to show
   * @default 5
   */
  maxSuggestions?: number;

  /**
   * Callback when a mention is selected
   */
  onMentionSelected?: (member: MentionableMember) => void;
}

export interface UseMentionAutocompleteReturn {
  /**
   * Whether the autocomplete dropdown should be visible
   */
  isVisible: boolean;

  /**
   * Current search query (text after @)
   */
  query: string;

  /**
   * Filtered and sorted member suggestions
   */
  suggestions: MentionableMember[];

  /**
   * Index of the @ symbol in the text
   */
  triggerStartIndex: number;

  /**
   * Current trigger state
   */
  triggerState: MentionTriggerResult;

  /**
   * Call when text or cursor changes to update autocomplete state
   */
  onTextChange: (text: string, cursorPosition: number) => void;

  /**
   * Call when a member is selected from suggestions
   * Returns new text and cursor position
   */
  onSelectMember: (
    member: MentionableMember,
    currentText: string,
    currentCursorPosition: number,
  ) => InsertMentionResult;

  /**
   * Dismiss the autocomplete dropdown
   */
  onDismiss: () => void;

  /**
   * Reset autocomplete state
   */
  reset: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_SUGGESTIONS = 5;

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook to manage mention autocomplete state in chat composer.
 *
 * @example
 * ```tsx
 * const {
 *   isVisible,
 *   suggestions,
 *   onTextChange,
 *   onSelectMember,
 *   onDismiss,
 * } = useMentionAutocomplete({
 *   members: groupMembers,
 *   excludeUids: [currentUserId],
 * });
 *
 * // In TextInput
 * onChangeText={(text) => {
 *   setText(text);
 *   onTextChange(text, selection.end);
 * }}
 *
 * // Show autocomplete when visible
 * {isVisible && (
 *   <MentionAutocomplete
 *     suggestions={suggestions}
 *     onSelect={(member) => {
 *       const result = onSelectMember(member, text, cursorPosition);
 *       setText(result.newText);
 *       setCursorPosition(result.newCursorPosition);
 *     }}
 *     onDismiss={onDismiss}
 *   />
 * )}
 * ```
 */
export function useMentionAutocomplete(
  options: UseMentionAutocompleteOptions,
): UseMentionAutocompleteReturn {
  const {
    members,
    excludeUids = [],
    maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
    onMentionSelected,
  } = options;

  // ==========================================================================
  // State
  // ==========================================================================

  const [triggerState, setTriggerState] = useState<MentionTriggerResult>({
    active: false,
    query: "",
    startIndex: -1,
  });

  const [currentCursor, setCurrentCursor] = useState(0);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  /**
   * Filter members based on current query
   */
  const suggestions = useMemo(() => {
    if (!triggerState.active) {
      return [];
    }

    const filtered = filterMembersByQuery(
      members,
      triggerState.query,
      excludeUids,
    );
    return filtered.slice(0, maxSuggestions);
  }, [
    members,
    triggerState.active,
    triggerState.query,
    excludeUids,
    maxSuggestions,
  ]);

  /**
   * Whether to show the autocomplete dropdown
   */
  const isVisible = triggerState.active && suggestions.length > 0;

  // ==========================================================================
  // Callbacks
  // ==========================================================================

  /**
   * Handle text/cursor changes to update trigger state
   */
  const onTextChange = useCallback((text: string, cursorPosition: number) => {
    setCurrentCursor(cursorPosition);

    const newTriggerState = detectMentionTrigger(text, cursorPosition);

    // Only update if state changed to avoid unnecessary re-renders
    setTriggerState((prev) => {
      if (
        prev.active === newTriggerState.active &&
        prev.query === newTriggerState.query &&
        prev.startIndex === newTriggerState.startIndex
      ) {
        return prev;
      }
      return newTriggerState;
    });
  }, []);

  /**
   * Handle member selection
   */
  const onSelectMember = useCallback(
    (
      member: MentionableMember,
      currentText: string,
      currentCursorPosition: number,
    ): InsertMentionResult => {
      if (!triggerState.active) {
        log.warn("onSelectMember called but trigger is not active");
        return {
          newText: currentText,
          newCursorPosition: currentCursorPosition,
        };
      }

      const result = insertMention(
        currentText,
        triggerState.startIndex,
        currentCursorPosition,
        member,
      );

      // Notify callback
      onMentionSelected?.(member);

      // Reset trigger state
      setTriggerState({
        active: false,
        query: "",
        startIndex: -1,
      });

      log.debug("Mention inserted", {
        data: {
          member: member.displayName,
          newTextLength: result.newText.length,
          newCursor: result.newCursorPosition,
        },
      });

      return result;
    },
    [triggerState, onMentionSelected],
  );

  /**
   * Dismiss autocomplete without selecting
   */
  const onDismiss = useCallback(() => {
    setTriggerState({
      active: false,
      query: "",
      startIndex: -1,
    });
  }, []);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setTriggerState({
      active: false,
      query: "",
      startIndex: -1,
    });
    setCurrentCursor(0);
  }, []);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    isVisible,
    query: triggerState.query,
    suggestions,
    triggerStartIndex: triggerState.startIndex,
    triggerState,
    onTextChange,
    onSelectMember,
    onDismiss,
    reset,
  };
}

export default useMentionAutocomplete;
