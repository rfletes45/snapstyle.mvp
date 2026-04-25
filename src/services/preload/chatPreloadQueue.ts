import { Image } from "expo-image";
import { AppState, type AppStateStatus } from "react-native";

import { createLogger } from "@/utils/log";
import { normalizeRemoteImageUrl } from "@/utils/remoteImageSource";

const log = createLogger("chatPreloadQueue");

export type PreloadPriority =
  | "visible-avatar"
  | "open-chat-avatar"
  | "visible-media"
  | "recent-chat-asset"
  | "sticker-gif"
  | "game-asset"
  | number;

export interface ChatPreloadTaskInput {
  url: string | null | undefined;
  priority?: PreloadPriority;
  ownerUid?: string | null;
  scopeToken?: string | null;
  maxRetries?: number;
}

interface QueueTask {
  key: string;
  url: string;
  priority: number;
  ownerUid: string | null;
  scopeToken: string | null;
  maxRetries: number;
  attempts: number;
  cancelled: boolean;
  resolve: (value: boolean) => void;
}

type PreloadWorker = (url: string) => Promise<boolean>;

const PRIORITY_SCORE: Record<Exclude<PreloadPriority, number>, number> = {
  "visible-avatar": 100,
  "open-chat-avatar": 90,
  "visible-media": 80,
  "recent-chat-asset": 60,
  "sticker-gif": 40,
  "game-asset": 30,
};

function priorityToScore(priority: PreloadPriority | undefined): number {
  if (typeof priority === "number") return priority;
  if (!priority) return PRIORITY_SCORE["recent-chat-asset"];
  return PRIORITY_SCORE[priority] ?? PRIORITY_SCORE["recent-chat-asset"];
}

function isPermanentPreloadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("permission-denied") ||
    normalized.includes("permission denied") ||
    normalized.includes("unauthorized") ||
    normalized.includes("not-found") ||
    normalized.includes("404")
  );
}

async function defaultPreloadWorker(url: string): Promise<boolean> {
  return Image.prefetch(url, "memory-disk");
}

export class ChatPreloadQueue {
  private readonly concurrency: number;
  private readonly worker: PreloadWorker;
  private readonly queued = new Map<string, QueueTask>();
  private readonly inFlight = new Map<string, QueueTask>();
  private readonly completed = new Set<string>();
  private activeCount = 0;
  private paused = false;
  private activeOwnerUid: string | null = null;

  constructor(options: { concurrency?: number; worker?: PreloadWorker } = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 4);
    this.worker = options.worker ?? defaultPreloadWorker;
  }

  setOwnerUid(uid: string | null): void {
    const normalized =
      typeof uid === "string" && uid.trim() ? uid.trim() : null;
    if (this.activeOwnerUid && this.activeOwnerUid !== normalized) {
      this.cancelOwner(this.activeOwnerUid);
    }
    this.activeOwnerUid = normalized;
  }

  enqueue(input: ChatPreloadTaskInput): Promise<boolean> {
    const url = normalizeRemoteImageUrl(input.url);
    if (!url) return Promise.resolve(true);

    const ownerUid = input.ownerUid ?? this.activeOwnerUid;
    if (!ownerUid) return Promise.resolve(false);

    const scopeToken = input.scopeToken ?? null;
    const key = `${ownerUid}:${url}`;
    if (this.completed.has(key)) return Promise.resolve(true);

    const existing = this.queued.get(key) ?? this.inFlight.get(key);
    if (existing) {
      existing.priority = Math.max(
        existing.priority,
        priorityToScore(input.priority),
      );
      if (!existing.scopeToken && scopeToken) existing.scopeToken = scopeToken;
      this.sortQueue();
      return new Promise((resolve) => {
        const previousResolve = existing.resolve;
        existing.resolve = (value) => {
          previousResolve(value);
          resolve(value);
        };
      });
    }

    return new Promise((resolve) => {
      const task: QueueTask = {
        key,
        url,
        priority: priorityToScore(input.priority),
        ownerUid,
        scopeToken,
        maxRetries: input.maxRetries ?? 1,
        attempts: 0,
        cancelled: false,
        resolve,
      };
      this.queued.set(key, task);
      this.sortQueue();
      this.drain();
    });
  }

  enqueueMany(inputs: ChatPreloadTaskInput[]): Promise<boolean> {
    if (inputs.length === 0) return Promise.resolve(true);
    return Promise.all(inputs.map((input) => this.enqueue(input))).then(
      (results) => results.every(Boolean),
    );
  }

  cancelScope(scopeToken: string): void {
    if (!scopeToken) return;
    for (const task of [...this.queued.values(), ...this.inFlight.values()]) {
      if (task.scopeToken === scopeToken) {
        task.cancelled = true;
        this.queued.delete(task.key);
        task.resolve(false);
      }
    }
  }

  cancelOwner(ownerUid: string): void {
    if (!ownerUid) return;
    for (const task of [...this.queued.values(), ...this.inFlight.values()]) {
      if (task.ownerUid === ownerUid) {
        task.cancelled = true;
        this.queued.delete(task.key);
        task.resolve(false);
      }
    }
  }

  cancelAll(): void {
    for (const task of [...this.queued.values(), ...this.inFlight.values()]) {
      task.cancelled = true;
      task.resolve(false);
    }
    this.queued.clear();
    this.inFlight.clear();
    this.activeCount = 0;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.drain();
  }

  getStats(): {
    queued: number;
    inFlight: number;
    completed: number;
    paused: boolean;
  } {
    return {
      queued: this.queued.size,
      inFlight: this.inFlight.size,
      completed: this.completed.size,
      paused: this.paused,
    };
  }

  private sortQueue(): void {
    const tasks = [...this.queued.values()].sort(
      (a, b) => b.priority - a.priority,
    );
    this.queued.clear();
    for (const task of tasks) {
      this.queued.set(task.key, task);
    }
  }

  private drain(): void {
    if (this.paused) return;

    while (this.activeCount < this.concurrency && this.queued.size > 0) {
      const task = this.queued.values().next().value as QueueTask | undefined;
      if (!task) return;
      this.queued.delete(task.key);
      if (task.cancelled) continue;
      this.run(task);
    }
  }

  private run(task: QueueTask): void {
    this.inFlight.set(task.key, task);
    this.activeCount++;

    void this.worker(task.url)
      .then((success) => {
        if (!task.cancelled && success) {
          this.completed.add(task.key);
        }
        task.resolve(!task.cancelled && success);
      })
      .catch((error) => {
        if (__DEV__) {
          log.debug("Preload failed", {
            data: {
              url: task.url,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }

        const shouldRetry =
          !task.cancelled &&
          task.attempts < task.maxRetries &&
          !isPermanentPreloadFailure(error);

        if (shouldRetry) {
          task.attempts++;
          this.queued.set(task.key, task);
          this.sortQueue();
        } else {
          task.resolve(false);
        }
      })
      .finally(() => {
        this.inFlight.delete(task.key);
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.drain();
      });
  }
}

export const chatPreloadQueue = new ChatPreloadQueue();

let appStateSubscription: { remove: () => void } | null = null;

export function startChatPreloadAppStateBinding(): void {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener(
    "change",
    (state: AppStateStatus) => {
      if (state === "active") {
        chatPreloadQueue.resume();
      } else {
        chatPreloadQueue.pause();
      }
    },
  );
}

export function stopChatPreloadAppStateBinding(): void {
  appStateSubscription?.remove();
  appStateSubscription = null;
}

export function setChatPreloadOwnerUid(uid: string | null): void {
  chatPreloadQueue.setOwnerUid(uid);
}

export function cancelChatPreloadsForScope(scopeToken: string): void {
  chatPreloadQueue.cancelScope(scopeToken);
}

export function cancelChatPreloadsForOwner(ownerUid: string): void {
  chatPreloadQueue.cancelOwner(ownerUid);
}

export function cancelAllChatPreloads(): void {
  chatPreloadQueue.cancelAll();
}
