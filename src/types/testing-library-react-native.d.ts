/**
 * Type declarations for @testing-library/react-native
 *
 * This is a stub type declaration to satisfy TypeScript compilation
 * until the actual package can be installed with compatible versions.
 */

declare module "@testing-library/react-native" {
  import { ReactElement } from "react";

  interface RenderResult {
    root: unknown;
    toJSON: () => unknown;
    getByTestId: (testId: string) => unknown;
    getByText: (text: string | RegExp) => unknown;
    queryByTestId: (testId: string) => unknown | null;
    queryByText: (text: string | RegExp) => unknown | null;
    getAllByTestId: (testId: string) => unknown[];
    getAllByText: (text: string | RegExp) => unknown[];
    findByTestId: (testId: string) => Promise<unknown>;
    findByText: (text: string | RegExp) => Promise<unknown>;
    debug: () => void;
    unmount: () => void;
    rerender: (element: ReactElement) => void;
  }

  interface RenderOptions {
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
    createNodeMock?: (element: ReactElement) => unknown;
  }

  export function render(
    component: ReactElement,
    options?: RenderOptions,
  ): RenderResult;

  export const screen: {
    getByTestId: (testId: string) => unknown;
    getByText: (text: string | RegExp) => unknown;
    queryByTestId: (testId: string) => unknown | null;
    queryByText: (text: string | RegExp) => unknown | null;
    getAllByTestId: (testId: string) => unknown[];
    getAllByText: (text: string | RegExp) => unknown[];
    findByTestId: (testId: string) => Promise<unknown>;
    findByText: (text: string | RegExp) => Promise<unknown>;
    debug: () => void;
  };

  export function cleanup(): void;
  export function waitFor<T>(callback: () => T | Promise<T>): Promise<T>;
  export function act(callback: () => void | Promise<void>): Promise<void>;
  export const fireEvent: {
    press: (element: unknown) => void;
    changeText: (element: unknown, text: string) => void;
    scroll: (element: unknown, options?: { x?: number; y?: number }) => void;
    [key: string]: (element: unknown, ...args: unknown[]) => void;
  };
}
