/**
 * Tests for structured logger utility.
 */
import { createServerLogger } from "../../src/utils/logger";

describe("createServerLogger", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a logger with info/warn/error/debug methods", () => {
    const logger = createServerLogger("test");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("info writes to console.log", () => {
    const logger = createServerLogger("myModule");
    logger.info("hello world");
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("myModule");
    expect(output).toContain("hello world");
  });

  it("warn writes to console.warn", () => {
    const warnSpy = jest.spyOn(console, "warn");
    const logger = createServerLogger("test");
    logger.warn("caution");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("caution");
  });

  it("error writes to console.error", () => {
    const errorSpy = jest.spyOn(console, "error");
    const logger = createServerLogger("test");
    logger.error("failure");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("failure");
  });

  it("child logger inherits parent context", () => {
    const logger = createServerLogger("test");
    const child = logger.child({ traceId: "t1", gameType: "chess" });
    child.info("move made");

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("t1");
    expect(output).toContain("chess");
    expect(output).toContain("move made");
  });

  it("child logger can be further chained", () => {
    const logger = createServerLogger("test");
    const child = logger.child({ traceId: "t1" });
    const grandchild = child.child({ uid: "user123" });
    grandchild.info("action");

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("t1");
    expect(output).toContain("user123");
  });

  it("info with context includes context fields", () => {
    const logger = createServerLogger("test");
    logger.info("joined", { uid: "abc", sessionId: "s1" });

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain("abc");
    expect(output).toContain("s1");
  });

  it("error accepts Error objects as second arg (backward compat)", () => {
    const errorSpy = jest.spyOn(console, "error");
    const logger = createServerLogger("test");
    logger.error("oops", new Error("boom"));

    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain("boom");
  });

  it("error accepts string as second arg (backward compat)", () => {
    const errorSpy = jest.spyOn(console, "error");
    const logger = createServerLogger("test");
    logger.error("oops", "some detail");

    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain("some detail");
  });
});
