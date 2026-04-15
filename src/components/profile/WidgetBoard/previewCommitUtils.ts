import { resolveResize, settleBoardAfterDrop } from "./BoardLayoutEngine";
import type {
  CollisionDisplacementHint,
  WidgetInstance,
  WidgetSizeKey,
} from "./types";

export interface DragHoverTarget {
  id: string;
  x: number;
  y: number;
  collisionHint?: CollisionDisplacementHint | null;
}

export type PreviewDescriptor =
  | {
      kind: "drag";
      target: DragHoverTarget;
    }
  | {
      kind: "resize";
      instanceId: string;
      size: WidgetSizeKey;
    };

function isSameCollisionDisplacementHint(
  left: CollisionDisplacementHint | null | undefined,
  right: CollisionDisplacementHint | null | undefined,
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.obstructedId === right.obstructedId &&
    left.direction === right.direction
  );
}

export function isSameDragHoverTarget(
  left: DragHoverTarget | null,
  right: DragHoverTarget | null,
): boolean {
  return !!left && !!right
    ? left.id === right.id &&
        left.x === right.x &&
        left.y === right.y &&
        isSameCollisionDisplacementHint(left.collisionHint, right.collisionHint)
    : left === right;
}

export function resolveCommittedPreviewLayout(
  sourceWidgets: WidgetInstance[] | null,
  previewDescriptor: PreviewDescriptor | null,
  previewWidgets: WidgetInstance[] | null,
  latestHoverTarget: DragHoverTarget | null,
): WidgetInstance[] | null {
  if (!sourceWidgets) {
    return previewWidgets;
  }

  if (latestHoverTarget) {
    return settleBoardAfterDrop(
      sourceWidgets,
      latestHoverTarget.id,
      latestHoverTarget.x,
      latestHoverTarget.y,
      undefined,
      latestHoverTarget.collisionHint,
    );
  }

  if (previewDescriptor?.kind === "resize") {
    return resolveResize(
      sourceWidgets,
      previewDescriptor.instanceId,
      previewDescriptor.size,
    );
  }

  return previewWidgets;
}
