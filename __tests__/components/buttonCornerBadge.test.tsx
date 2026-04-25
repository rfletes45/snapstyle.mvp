import React from "react";
import { StyleSheet } from "react-native";

import { ButtonCornerBadge } from "../../src/components/ui/ButtonCornerBadge";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require("react-test-renderer");
const { act } = renderer;

describe("ButtonCornerBadge", () => {
  it("renders nothing when hidden", () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <ButtonCornerBadge visible={false} borderColor="#fff" />,
      );
    });
    const tree = component.toJSON();
    expect(tree).toBeNull();
  });

  it("renders an absolute non-interactive dot with themed colors", () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <ButtonCornerBadge
          visible
          size={12}
          borderWidth={2}
          badgeColor="#ff0000"
          borderColor="#ffffff"
        />,
      );
    });
    const tree = component.toJSON() as any;

    const style = StyleSheet.flatten(tree.props.style);
    expect(tree.props.pointerEvents).toBe("none");
    expect(style.position).toBe("absolute");
    expect(style.width).toBe(12);
    expect(style.height).toBe(12);
    expect(style.borderRadius).toBe(6);
    expect(style.borderWidth).toBe(2);
    expect(style.top).toBe(-5);
    expect(style.right).toBe(-5);
    expect(style.backgroundColor).toBe("#ff0000");
    expect(style.borderColor).toBe("#ffffff");
  });
});
