import React from "react";
import { StyleSheet, TouchableWithoutFeedback } from "react-native";
import renderer, { act } from "react-test-renderer";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  return {
    MaterialCommunityIcons: (props: Record<string, unknown>) =>
      React.createElement("MaterialCommunityIcons", props),
  };
});

jest.mock("../../../src/components/chat/AnimalIcon", () => {
  const React = require("react");
  const MockAnimalIcon = (props: Record<string, unknown>) =>
    React.createElement("AnimalIcon", props);

  return {
    __esModule: true,
    AnimalIcon: MockAnimalIcon,
    default: MockAnimalIcon,
  };
});

jest.mock("../../../src/utils/haptics", () => ({
  light: jest.fn(() => Promise.resolve()),
}));

import {
  ANIMAL_ALTERNATE_PICKER_ACTIVE_BACKGROUND,
  ANIMAL_ALTERNATE_PICKER_HOLD_DURATION_MS,
  AnimalLongPressButton,
} from "../../../src/components/chat/AnimalLongPressButton";
import { ToolbarSlotInteractionContext } from "../../../src/components/chat/ComposerToolbar/ToolbarSlotInteractionContext";
import {
  ANIMAL_EDIT_MODE_EXTRA_DELAY_MS,
  EDIT_MODE_LONG_PRESS_DURATION,
} from "../../../src/components/chat/ComposerToolbar/types";
import { light as triggerLightHaptic } from "../../../src/utils/haptics";

const mockedLightHaptic = jest.mocked(triggerLightHaptic);

type TestSlotInteractionValue = React.ContextType<
  typeof ToolbarSlotInteractionContext
>;

function renderAnimalButton(
  props: Partial<React.ComponentProps<typeof AnimalLongPressButton>> = {},
  slotInteractionValue: TestSlotInteractionValue = null,
) {
  const onShortPress = props.onShortPress ?? jest.fn();
  const onLongPress = props.onLongPress ?? jest.fn();

  let tree!: renderer.ReactTestRenderer;

  act(() => {
    tree = renderer.create(
      <ToolbarSlotInteractionContext.Provider value={slotInteractionValue}>
        <AnimalLongPressButton
          animalId="animal_duck"
          onShortPress={onShortPress}
          onLongPress={onLongPress}
          {...props}
        />
      </ToolbarSlotInteractionContext.Provider>,
    );
  });

  const getTouchable = () => tree.root.findByType(TouchableWithoutFeedback);
  const getContainer = () =>
    tree.root.findByProps({ testID: "animal-long-press-container" });
  const getAlternateIcons = () =>
    tree.root.findAll(
      (node) =>
        node.type === "MaterialCommunityIcons" &&
        node.props.testID === "animal-long-press-alternate-icon",
    );

  return {
    tree,
    onShortPress,
    onLongPress,
    getTouchable,
    getContainer,
    getAlternateIcons,
  };
}

describe("AnimalLongPressButton", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("opens the normal animal picker on a quick tap", () => {
    const { getTouchable, getAlternateIcons, onShortPress, onLongPress } =
      renderAnimalButton();

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(ANIMAL_ALTERNATE_PICKER_HOLD_DURATION_MS - 25);
    });

    act(() => {
      getTouchable().props.onPressOut();
    });

    expect(onShortPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(getAlternateIcons()).toHaveLength(0);
    expect(mockedLightHaptic).not.toHaveBeenCalled();
  });

  it("arms alternate animal-picker mode before release, flips the icon, turns purple, and opens the alternate picker on release", () => {
    const {
      getTouchable,
      getContainer,
      getAlternateIcons,
      onShortPress,
      onLongPress,
    } = renderAnimalButton();

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(ANIMAL_ALTERNATE_PICKER_HOLD_DURATION_MS);
    });

    expect(getAlternateIcons()).toHaveLength(1);
    expect(StyleSheet.flatten(getContainer().props.style).backgroundColor).toBe(
      ANIMAL_ALTERNATE_PICKER_ACTIVE_BACKGROUND,
    );
    expect(mockedLightHaptic).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();

    act(() => {
      getTouchable().props.onPressOut();
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onShortPress).not.toHaveBeenCalled();
    expect(getAlternateIcons()).toHaveLength(0);
  });

  it("clears the armed state if edit mode locks the interaction before release", () => {
    const onShortPress = jest.fn();
    const onLongPress = jest.fn();
    const { tree, getTouchable, getContainer, getAlternateIcons } =
      renderAnimalButton({
        onShortPress,
        onLongPress,
      });

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(ANIMAL_ALTERNATE_PICKER_HOLD_DURATION_MS);
    });

    expect(getAlternateIcons()).toHaveLength(1);

    act(() => {
      tree.update(
        <AnimalLongPressButton
          animalId="animal_duck"
          onShortPress={onShortPress}
          onLongPress={onLongPress}
          interactionLocked
        />,
      );
    });

    expect(getAlternateIcons()).toHaveLength(0);
    expect(StyleSheet.flatten(getContainer().props.style).backgroundColor).toBe(
      undefined,
    );

    act(() => {
      getTouchable().props.onPressOut();
    });

    expect(onShortPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
    expect(mockedLightHaptic).toHaveBeenCalledTimes(1);
  });

  it("suppresses the animal action if the press is held past the edit-mode cutoff before release", () => {
    const {
      getTouchable,
      getContainer,
      getAlternateIcons,
      onShortPress,
      onLongPress,
    } = renderAnimalButton({
      editModeActivationDurationMs:
        EDIT_MODE_LONG_PRESS_DURATION + ANIMAL_EDIT_MODE_EXTRA_DELAY_MS,
    });

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(ANIMAL_ALTERNATE_PICKER_HOLD_DURATION_MS);
    });

    expect(getAlternateIcons()).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(
        EDIT_MODE_LONG_PRESS_DURATION +
          ANIMAL_EDIT_MODE_EXTRA_DELAY_MS -
          ANIMAL_ALTERNATE_PICKER_HOLD_DURATION_MS,
      );
    });

    expect(getAlternateIcons()).toHaveLength(0);
    expect(StyleSheet.flatten(getContainer().props.style).backgroundColor).toBe(
      undefined,
    );

    act(() => {
      getTouchable().props.onPressOut();
    });

    expect(onShortPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("suppresses the animal action when the parent slot claims the press before edit mode enters", () => {
    let cancelBeforeEditMode: (() => void) | null = null;
    const slotInteractionValue: NonNullable<TestSlotInteractionValue> = {
      editModeActivationSignal: { value: false } as any,
      registerPreEditModeCancel: (callback) => {
        cancelBeforeEditMode = callback;
      },
    };

    const {
      getTouchable,
      getContainer,
      getAlternateIcons,
      onShortPress,
      onLongPress,
    } = renderAnimalButton({}, slotInteractionValue);

    act(() => {
      getTouchable().props.onPressIn();
    });

    act(() => {
      jest.advanceTimersByTime(ANIMAL_ALTERNATE_PICKER_HOLD_DURATION_MS);
    });

    expect(getAlternateIcons()).toHaveLength(1);
    expect(cancelBeforeEditMode).not.toBeNull();

    act(() => {
      slotInteractionValue.editModeActivationSignal.value = true;
      cancelBeforeEditMode?.();
    });

    expect(getAlternateIcons()).toHaveLength(0);
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
