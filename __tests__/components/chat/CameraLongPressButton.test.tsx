import React from "react";
import { StyleSheet, TouchableWithoutFeedback } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import renderer, { act } from "react-test-renderer";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  return {
    MaterialCommunityIcons: (props: Record<string, unknown>) =>
      React.createElement("MaterialCommunityIcons", props),
  };
});

jest.mock("react-native-paper", () => {
  const React = require("react");
  return {
    Provider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useTheme: () => ({
      colors: {
        onSurfaceDisabled: "#999999",
      },
    }),
  };
});

import {
  CAMERA_IMAGE_PICKER_ACTIVE_BACKGROUND,
  CAMERA_IMAGE_PICKER_HOLD_DURATION_MS,
  CameraLongPressButton,
} from "../../../src/components/chat/CameraLongPressButton";
import { getToolbarItemEditModeLongPressDuration } from "../../../src/components/chat/ComposerToolbar/ComposerToolbarRegistry";
import { ToolbarSlotInteractionContext } from "../../../src/components/chat/ComposerToolbar/ToolbarSlotInteractionContext";
import {
  ANIMAL_EDIT_MODE_EXTRA_DELAY_MS,
  CAMERA_EDIT_MODE_EXTRA_DELAY_MS,
  EDIT_MODE_LONG_PRESS_DURATION,
} from "../../../src/components/chat/ComposerToolbar/types";

type TestSlotInteractionValue = React.ContextType<
  typeof ToolbarSlotInteractionContext
>;

function renderCameraButton(
  props: Partial<React.ComponentProps<typeof CameraLongPressButton>> = {},
  slotInteractionValue: TestSlotInteractionValue = null,
) {
  const onShortPress = props.onShortPress ?? jest.fn();
  const onLongPress = props.onLongPress ?? jest.fn();

  let tree!: renderer.ReactTestRenderer;

  act(() => {
    tree = renderer.create(
      <PaperProvider>
        <ToolbarSlotInteractionContext.Provider value={slotInteractionValue}>
          <CameraLongPressButton
            onShortPress={onShortPress}
            onLongPress={onLongPress}
            {...props}
          />
        </ToolbarSlotInteractionContext.Provider>
      </PaperProvider>,
    );
  });

  const getTouchable = () => tree.root.findByType(TouchableWithoutFeedback);
  const getIcon = () =>
    tree.root.findByProps({ testID: "camera-long-press-icon" });
  const getContainer = () =>
    tree.root.findByProps({ testID: "camera-long-press-container" });

  return {
    tree,
    onShortPress,
    onLongPress,
    getTouchable,
    getIcon,
    getContainer,
  };
}

describe("CameraLongPressButton", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("opens the camera on a quick tap without arming the image picker", () => {
    const { getTouchable, getIcon, onShortPress, onLongPress } =
      renderCameraButton();

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(CAMERA_IMAGE_PICKER_HOLD_DURATION_MS - 25);
    });

    act(() => {
      getTouchable().props.onPressOut();
    });

    expect(onShortPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(getIcon().props.name).toBe("camera");
  });

  it("arms image-picker mode before release, flips the icon, and opens gallery on release", () => {
    const { getTouchable, getIcon, getContainer, onShortPress, onLongPress } =
      renderCameraButton();

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(CAMERA_IMAGE_PICKER_HOLD_DURATION_MS);
    });

    expect(getIcon().props.name).toBe("image-multiple");
    expect(StyleSheet.flatten(getContainer().props.style).backgroundColor).toBe(
      CAMERA_IMAGE_PICKER_ACTIVE_BACKGROUND,
    );
    expect(onShortPress).not.toHaveBeenCalled();

    act(() => {
      getTouchable().props.onPressOut();
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();
    expect(getIcon().props.name).toBe("camera");
  });

  it("clears the armed state if edit mode locks the interaction before release", () => {
    const onShortPress = jest.fn();
    const onLongPress = jest.fn();
    const { tree, getTouchable, getIcon, getContainer } = renderCameraButton({
      onShortPress,
      onLongPress,
    });

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(CAMERA_IMAGE_PICKER_HOLD_DURATION_MS);
    });

    expect(getIcon().props.name).toBe("image-multiple");

    act(() => {
      tree.update(
        <PaperProvider>
          <CameraLongPressButton
            onShortPress={onShortPress}
            onLongPress={onLongPress}
            interactionLocked
          />
        </PaperProvider>,
      );
    });

    expect(getIcon().props.name).toBe("camera");
    expect(StyleSheet.flatten(getContainer().props.style).backgroundColor).toBe(
      undefined,
    );

    act(() => {
      getTouchable().props.onPressOut();
    });

    expect(onShortPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("suppresses the camera action if the press is held past the edit-mode cutoff before release", () => {
    const { getTouchable, getIcon, getContainer, onShortPress, onLongPress } =
      renderCameraButton({
        editModeActivationDurationMs:
          EDIT_MODE_LONG_PRESS_DURATION + CAMERA_EDIT_MODE_EXTRA_DELAY_MS,
      });

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(CAMERA_IMAGE_PICKER_HOLD_DURATION_MS);
    });

    expect(getIcon().props.name).toBe("image-multiple");

    act(() => {
      jest.advanceTimersByTime(
        EDIT_MODE_LONG_PRESS_DURATION +
          CAMERA_EDIT_MODE_EXTRA_DELAY_MS -
          CAMERA_IMAGE_PICKER_HOLD_DURATION_MS,
      );
    });

    expect(getIcon().props.name).toBe("camera");
    expect(StyleSheet.flatten(getContainer().props.style).backgroundColor).toBe(
      undefined,
    );

    act(() => {
      getTouchable().props.onPressOut();
    });

    expect(onShortPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("suppresses the camera action when the parent slot claims the press before edit mode enters", () => {
    let cancelBeforeEditMode: (() => void) | null = null;
    const slotInteractionValue: NonNullable<TestSlotInteractionValue> = {
      editModeActivationSignal: { value: false } as any,
      registerPreEditModeCancel: (callback) => {
        cancelBeforeEditMode = callback;
      },
    };

    const { getTouchable, getIcon, getContainer, onShortPress, onLongPress } =
      renderCameraButton({}, slotInteractionValue);

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(CAMERA_IMAGE_PICKER_HOLD_DURATION_MS);
    });

    expect(getIcon().props.name).toBe("image-multiple");
    expect(cancelBeforeEditMode).not.toBeNull();

    act(() => {
      slotInteractionValue.editModeActivationSignal.value = true;
      cancelBeforeEditMode?.();
    });

    expect(getIcon().props.name).toBe("camera");
    expect(StyleSheet.flatten(getContainer().props.style).backgroundColor).toBe(
      undefined,
    );

    act(() => {
      getTouchable().props.onPressOut();
    });

    expect(onShortPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

describe("dual-mode toolbar edit-mode timing", () => {
  it("adds the extra edit-mode delay only to camera and animal", () => {
    expect(getToolbarItemEditModeLongPressDuration("camera")).toBe(
      EDIT_MODE_LONG_PRESS_DURATION + CAMERA_EDIT_MODE_EXTRA_DELAY_MS,
    );
    expect(getToolbarItemEditModeLongPressDuration("animal")).toBe(
      EDIT_MODE_LONG_PRESS_DURATION + ANIMAL_EDIT_MODE_EXTRA_DELAY_MS,
    );
    expect(getToolbarItemEditModeLongPressDuration("game")).toBe(
      EDIT_MODE_LONG_PRESS_DURATION,
    );
  });
});
