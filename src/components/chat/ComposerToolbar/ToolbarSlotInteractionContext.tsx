import React from "react";
import type { SharedValue } from "react-native-reanimated";

export interface ToolbarSlotInteractionContextValue {
  editModeActivationSignal: SharedValue<boolean>;
  registerPreEditModeCancel: (callback: (() => void) | null) => void;
}

export const ToolbarSlotInteractionContext =
  React.createContext<ToolbarSlotInteractionContextValue | null>(null);

export function useToolbarSlotInteraction() {
  return React.useContext(ToolbarSlotInteractionContext);
}
