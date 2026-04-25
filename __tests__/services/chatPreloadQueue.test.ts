import { ChatPreloadQueue } from "@/services/preload/chatPreloadQueue";

jest.mock("expo-image", () => ({
  Image: {
    prefetch: jest.fn(async () => true),
  },
}));

describe("ChatPreloadQueue", () => {
  test("runs higher priority queued work first", async () => {
    const order: string[] = [];
    const queue = new ChatPreloadQueue({
      concurrency: 1,
      worker: async (url) => {
        order.push(url);
        return true;
      },
    });
    queue.setOwnerUid("alice");
    queue.pause();

    const low = queue.enqueue({
      url: "https://example.com/low.jpg",
      priority: "game-asset",
    });
    const high = queue.enqueue({
      url: "https://example.com/high.jpg",
      priority: "visible-avatar",
    });

    queue.resume();
    await Promise.all([low, high]);

    expect(order).toEqual([
      "https://example.com/high.jpg",
      "https://example.com/low.jpg",
    ]);
  });

  test("deduplicates the same owner and URL", async () => {
    let calls = 0;
    const queue = new ChatPreloadQueue({
      worker: async () => {
        calls += 1;
        return true;
      },
    });
    queue.setOwnerUid("alice");
    queue.pause();

    const first = queue.enqueue({ url: "https://example.com/avatar.jpg" });
    const second = queue.enqueue({ url: "https://example.com/avatar.jpg" });

    queue.resume();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(calls).toBe(1);
  });

  test("cancels queued scope work", async () => {
    const queue = new ChatPreloadQueue({
      worker: async () => true,
    });
    queue.setOwnerUid("alice");
    queue.pause();

    const task = queue.enqueue({
      url: "https://example.com/screen.jpg",
      scopeToken: "chat:1",
    });
    queue.cancelScope("chat:1");
    queue.resume();

    await expect(task).resolves.toBe(false);
    expect(queue.getStats().queued).toBe(0);
  });

  test("cancels queued owner work on account switch", async () => {
    const queue = new ChatPreloadQueue({
      worker: async () => true,
    });
    queue.setOwnerUid("alice");
    queue.pause();

    const task = queue.enqueue({ url: "https://example.com/alice.jpg" });
    queue.setOwnerUid("bob");
    queue.resume();

    await expect(task).resolves.toBe(false);
  });

  test("retries transient failures but not permission failures", async () => {
    let transientCalls = 0;
    const transientQueue = new ChatPreloadQueue({
      worker: async () => {
        transientCalls += 1;
        if (transientCalls === 1) throw new Error("network unavailable");
        return true;
      },
    });
    transientQueue.setOwnerUid("alice");

    await expect(
      transientQueue.enqueue({
        url: "https://example.com/retry.jpg",
        maxRetries: 1,
      }),
    ).resolves.toBe(true);
    expect(transientCalls).toBe(2);

    let deniedCalls = 0;
    const deniedQueue = new ChatPreloadQueue({
      worker: async () => {
        deniedCalls += 1;
        throw new Error("permission-denied");
      },
    });
    deniedQueue.setOwnerUid("alice");

    await expect(
      deniedQueue.enqueue({
        url: "https://example.com/denied.jpg",
        maxRetries: 3,
      }),
    ).resolves.toBe(false);
    expect(deniedCalls).toBe(1);
  });
});
