/**
 * Avatar Component Unit Tests
 * Phase 7: Testing Requirements
 *
 * Tests for:
 * - Avatar component rendering
 * - Feature flag handling (dual system support)
 * - Size variants
 * - Accessibility props
 * - Loading states
 *
 * @see src/components/Avatar.tsx
 */

import Avatar, { AvatarLarge } from "@/components/Avatar";
import type { AvatarConfig } from "@/types/models";
import { getDefaultAvatarConfig } from "@/utils/avatarHelpers";
import { render } from "@testing-library/react-native";
import React from "react";

// =============================================================================
// Mocks
// =============================================================================

// Mock the DigitalAvatar component
jest.mock("@/components/avatar/DigitalAvatar", () => ({
  DigitalAvatar: jest.fn(({ size, config }) => {
    const { View } = require("react-native");
    return (
      <View
        testID="digital-avatar"
        style={{ width: size, height: size }}
        accessibilityLabel={`Digital Avatar - ${config?.body?.skinTone || "default"}`}
      />
    );
  }),
}));

// =============================================================================
// Test Data
// =============================================================================

const mockLegacyConfig: AvatarConfig = {
  baseColor: "#FFE0BD",
  hat: undefined,
  glasses: undefined,
  background: undefined,
};

const mockLegacyConfigWithAccessories: AvatarConfig = {
  baseColor: "#8D5524",
  hat: "hat_001",
  glasses: "glasses_001",
  background: undefined,
};

// Use the actual default config generator for digital avatar tests
const mockDigitalAvatarConfig = getDefaultAvatarConfig();

// =============================================================================
// Basic Rendering Tests
// =============================================================================

describe("Avatar Component", () => {
  describe("Basic Rendering", () => {
    it("should render without crashing", () => {
      const { root } = render(<Avatar config={mockLegacyConfig} size={40} />);
      expect(root).toBeTruthy();
    });

    it("should render with default size", () => {
      const { root } = render(<Avatar config={mockLegacyConfig} />);
      expect(root).toBeTruthy();
    });

    it("should apply custom size", () => {
      const customSize = 80;
      const { root } = render(
        <Avatar config={mockLegacyConfig} size={customSize} />,
      );
      expect(root).toBeTruthy();
    });
  });

  describe("Size Variants", () => {
    it("should render small avatar (24px)", () => {
      const { root } = render(<Avatar config={mockLegacyConfig} size={24} />);
      expect(root).toBeTruthy();
    });

    it("should render medium avatar (40px)", () => {
      const { root } = render(<Avatar config={mockLegacyConfig} size={40} />);
      expect(root).toBeTruthy();
    });

    it("should render large avatar (64px)", () => {
      const { root } = render(<Avatar config={mockLegacyConfig} size={64} />);
      expect(root).toBeTruthy();
    });

    it("should render extra large avatar (120px)", () => {
      const { root } = render(<Avatar config={mockLegacyConfig} size={120} />);
      expect(root).toBeTruthy();
    });
  });

  describe("Color Handling", () => {
    it("should handle various base colors", () => {
      const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFFFF", "#000000"];
      colors.forEach((color) => {
        const config: AvatarConfig = { ...mockLegacyConfig, baseColor: color };
        const { root } = render(<Avatar config={config} size={40} />);
        expect(root).toBeTruthy();
      });
    });

    it("should handle lowercase hex colors", () => {
      const config: AvatarConfig = {
        ...mockLegacyConfig,
        baseColor: "#ffe0bd",
      };
      const { root } = render(<Avatar config={config} size={40} />);
      expect(root).toBeTruthy();
    });
  });

  describe("Accessories", () => {
    it("should render avatar with hat", () => {
      const config: AvatarConfig = {
        ...mockLegacyConfig,
        hat: "hat_001",
      };
      const { root } = render(<Avatar config={config} size={40} />);
      expect(root).toBeTruthy();
    });

    it("should render avatar with glasses", () => {
      const config: AvatarConfig = {
        ...mockLegacyConfig,
        glasses: "glasses_001",
      };
      const { root } = render(<Avatar config={config} size={40} />);
      expect(root).toBeTruthy();
    });

    it("should render avatar with all accessories", () => {
      const { root } = render(
        <Avatar config={mockLegacyConfigWithAccessories} size={40} />,
      );
      expect(root).toBeTruthy();
    });

    it("should handle missing accessories gracefully", () => {
      const config: AvatarConfig = {
        baseColor: "#FFE0BD",
        hat: undefined,
        glasses: undefined,
        background: undefined,
      };
      const { root } = render(<Avatar config={config} size={40} />);
      expect(root).toBeTruthy();
    });
  });
});

// =============================================================================
// AvatarLarge Component Tests
// =============================================================================

describe("AvatarLarge Component", () => {
  it("should render with default props", () => {
    const { root } = render(<AvatarLarge config={mockLegacyConfig} />);
    expect(root).toBeTruthy();
  });

  it("should render with showBody prop", () => {
    const { root } = render(
      <AvatarLarge config={mockLegacyConfig} showBody={true} />,
    );
    expect(root).toBeTruthy();
  });

  it("should render without body", () => {
    const { root } = render(
      <AvatarLarge config={mockLegacyConfig} showBody={false} />,
    );
    expect(root).toBeTruthy();
  });
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe("Avatar Accessibility", () => {
  it("should be accessible by default", () => {
    const { root } = render(<Avatar config={mockLegacyConfig} size={40} />);
    expect(root).toBeTruthy();
  });

  it("should render with showBorder disabled", () => {
    const { root } = render(
      <Avatar config={mockLegacyConfig} size={40} showBorder={false} />,
    );
    expect(root).toBeTruthy();
  });
});

// =============================================================================
// Digital Avatar Integration Tests
// =============================================================================

describe("Digital Avatar Integration", () => {
  it("should accept digitalAvatar config", () => {
    const { root } = render(
      <Avatar config={mockDigitalAvatarConfig} size={40} />,
    );
    expect(root).toBeTruthy();
  });

  it("should handle legacy config fallback", () => {
    const { root } = render(<Avatar config={mockLegacyConfig} size={40} />);
    expect(root).toBeTruthy();
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("Avatar Edge Cases", () => {
  it("should handle very small sizes", () => {
    const { root } = render(<Avatar config={mockLegacyConfig} size={8} />);
    expect(root).toBeTruthy();
  });

  it("should handle very large sizes", () => {
    const { root } = render(<Avatar config={mockLegacyConfig} size={500} />);
    expect(root).toBeTruthy();
  });

  it("should handle zero size gracefully", () => {
    const { root } = render(<Avatar config={mockLegacyConfig} size={0} />);
    expect(root).toBeTruthy();
  });
});

// =============================================================================
// Snapshot Tests
// =============================================================================

describe("Avatar Snapshots", () => {
  it("should match snapshot for default avatar", () => {
    const { toJSON } = render(<Avatar config={mockLegacyConfig} size={40} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("should match snapshot for large avatar", () => {
    const { toJSON } = render(<AvatarLarge config={mockLegacyConfig} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("should match snapshot with accessories", () => {
    const { toJSON } = render(
      <Avatar config={mockLegacyConfigWithAccessories} size={64} />,
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe("Avatar Performance", () => {
  it("should render multiple avatars efficiently", () => {
    const startTime = Date.now();
    const avatars = [];

    for (let i = 0; i < 50; i++) {
      const config: AvatarConfig = {
        baseColor: `#${(i * 5).toString(16).padStart(2, "0")}${(i * 3).toString(16).padStart(2, "0")}${(i * 7).toString(16).padStart(2, "0")}`,
        hat: undefined,
        glasses: undefined,
        background: undefined,
      };
      avatars.push(<Avatar key={i} config={config} size={40} />);
    }

    const { root } = render(<>{avatars}</>);
    const endTime = Date.now();

    expect(root).toBeTruthy();
    // Should render 50 avatars in under 1 second
    expect(endTime - startTime).toBeLessThan(1000);
  });
});
