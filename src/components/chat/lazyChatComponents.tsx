/**
 * Lazy-loaded chat components
 *
 * Heavy components that are NOT required for the initial chat frame:
 * - FullEmojiPicker (large emoji database + SectionList)
 * - ScheduleMessageModal
 * - MediaViewerModal
 * - BlockUserModal / ReportUserModal (DM only)
 *
 * These are loaded on-demand when the user first interacts with the
 * feature that needs them, removing ~200KB+ of JS from the initial
 * chat entry parse/eval path.
 *
 * @module components/chat/lazyChatComponents
 */

import React, { Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { ActivityIndicator, View } from "react-native";

/** Minimal fallback — invisible, zero-height */
function EmptyFallback() {
  return null;
}

/** Wrapper that renders a lazy component with Suspense */
export function withSuspense<P extends object>(
  LazyComponent: LazyExoticComponent<ComponentType<P>>,
  Fallback: ComponentType = EmptyFallback,
) {
  const Wrapped = (props: P) => (
    <Suspense fallback={<Fallback />}>
      <LazyComponent {...props} />
    </Suspense>
  );
  Wrapped.displayName = `Suspense(${LazyComponent.displayName || "Lazy"})`;
  return Wrapped;
}

// ---------------------------------------------------------------------------
// Lazy component definitions
// ---------------------------------------------------------------------------

export const LazyFullEmojiPicker = React.lazy(
  () => import("@/components/chat/FullEmojiPicker"),
);

export const LazyScheduleMessageModal = React.lazy(
  () => import("@/components/ScheduleMessageModal"),
);

export const LazyMediaViewerModal = React.lazy(
  () => import("@/components/chat/MediaViewerModal"),
);

export const LazyBlockUserModal = React.lazy(
  () => import("@/components/BlockUserModal"),
);

export const LazyReportUserModal = React.lazy(
  () => import("@/components/ReportUserModal"),
);

// Wrapped versions with Suspense built in
export const SuspenseFullEmojiPicker = withSuspense(LazyFullEmojiPicker);
export const SuspenseScheduleMessageModal = withSuspense(LazyScheduleMessageModal);
export const SuspenseMediaViewerModal = withSuspense(LazyMediaViewerModal);
export const SuspenseBlockUserModal = withSuspense(LazyBlockUserModal);
export const SuspenseReportUserModal = withSuspense(LazyReportUserModal);
