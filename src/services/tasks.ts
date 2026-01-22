/**
 * Tasks Service
 * Phase 18: Daily tasks and challenges
 *
 * Handles:
 * - Fetching available tasks
 * - Reading task progress
 * - Claiming rewards (via callable)
 * - Real-time progress updates
 *
 * Note: Task progress updates and reward claims are handled server-side
 * via Cloud Functions for security and atomicity.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestoreInstance, getAppInstance } from "./firebase";
import {
  Task,
  TaskProgress,
  TaskWithProgress,
  TaskCadence,
  getCurrentDayKey,
} from "@/types/models";

// =============================================================================
// Constants
// =============================================================================

/** Default timezone for day calculations */
const DEFAULT_TIMEZONE = "America/Indiana/Indianapolis";

// =============================================================================
// Task Fetching
// =============================================================================

/**
 * Get all active tasks
 * @param cadence Optional filter by cadence (daily, weekly, one_time)
 */
export async function getActiveTasks(cadence?: TaskCadence): Promise<Task[]> {
  const db = getFirestoreInstance();

  try {
    const tasksRef = collection(db, "Tasks");
    let q;

    if (cadence) {
      q = query(
        tasksRef,
        where("active", "==", true),
        where("cadence", "==", cadence),
        orderBy("sortOrder", "asc"),
      );
    } else {
      q = query(
        tasksRef,
        where("active", "==", true),
        orderBy("sortOrder", "asc"),
      );
    }

    const snapshot = await getDocs(q);

    const now = Date.now();
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          icon: data.icon || "checkbox-marked-circle",
          cadence: data.cadence,
          type: data.type,
          target: data.target,
          rewardTokens: data.rewardTokens,
          rewardItemId: data.rewardItemId,
          active: data.active,
          sortOrder: data.sortOrder || 0,
          availableFrom: data.availableFrom?.toMillis?.() || data.availableFrom,
          availableTo: data.availableTo?.toMillis?.() || data.availableTo,
        } as Task;
      })
      .filter((task) => {
        // Filter by availability window
        if (task.availableFrom && now < task.availableFrom) return false;
        if (task.availableTo && now > task.availableTo) return false;
        return true;
      });
  } catch (error) {
    console.error("[tasks] Error fetching active tasks:", error);
    throw error;
  }
}

/**
 * Get a single task by ID
 */
export async function getTask(taskId: string): Promise<Task | null> {
  const db = getFirestoreInstance();

  try {
    const taskRef = doc(db, "Tasks", taskId);
    const taskDoc = await getDoc(taskRef);

    if (!taskDoc.exists()) {
      return null;
    }

    const data = taskDoc.data();
    return {
      id: taskDoc.id,
      title: data.title,
      description: data.description,
      icon: data.icon || "checkbox-marked-circle",
      cadence: data.cadence,
      type: data.type,
      target: data.target,
      rewardTokens: data.rewardTokens,
      rewardItemId: data.rewardItemId,
      active: data.active,
      sortOrder: data.sortOrder || 0,
      availableFrom: data.availableFrom?.toMillis?.() || data.availableFrom,
      availableTo: data.availableTo?.toMillis?.() || data.availableTo,
    };
  } catch (error) {
    console.error("[tasks] Error fetching task:", error);
    throw error;
  }
}

// =============================================================================
// Task Progress
// =============================================================================

/**
 * Get user's progress for all tasks
 * @param uid User ID
 * @param dayKey Optional day key (defaults to current day)
 */
export async function getTaskProgress(
  uid: string,
  dayKey?: string,
): Promise<Map<string, TaskProgress>> {
  const db = getFirestoreInstance();
  const currentDayKey = dayKey || getCurrentDayKey(DEFAULT_TIMEZONE);

  try {
    const progressRef = collection(db, "Users", uid, "TaskProgress");
    const q = query(progressRef, where("dayKey", "==", currentDayKey));

    const snapshot = await getDocs(q);

    const progressMap = new Map<string, TaskProgress>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      progressMap.set(doc.id, {
        taskId: doc.id,
        progress: data.progress || 0,
        claimed: data.claimed || false,
        dayKey: data.dayKey,
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
        claimedAt: data.claimedAt?.toMillis?.() || data.claimedAt,
      });
    });

    return progressMap;
  } catch (error) {
    console.error("[tasks] Error fetching task progress:", error);
    throw error;
  }
}

/**
 * Get user's progress for a specific task
 */
export async function getTaskProgressById(
  uid: string,
  taskId: string,
  dayKey?: string,
): Promise<TaskProgress | null> {
  const db = getFirestoreInstance();
  const currentDayKey = dayKey || getCurrentDayKey(DEFAULT_TIMEZONE);

  try {
    const progressRef = doc(db, "Users", uid, "TaskProgress", taskId);
    const progressDoc = await getDoc(progressRef);

    if (!progressDoc.exists()) {
      return null;
    }

    const data = progressDoc.data();

    // Check if progress is for current day (for daily tasks)
    if (data.dayKey !== currentDayKey) {
      // Progress is stale, return default
      return {
        taskId,
        progress: 0,
        claimed: false,
        dayKey: currentDayKey,
        updatedAt: Date.now(),
      };
    }

    return {
      taskId: progressDoc.id,
      progress: data.progress || 0,
      claimed: data.claimed || false,
      dayKey: data.dayKey,
      updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
      claimedAt: data.claimedAt?.toMillis?.() || data.claimedAt,
    };
  } catch (error) {
    console.error("[tasks] Error fetching task progress:", error);
    throw error;
  }
}

// =============================================================================
// Tasks with Progress (Combined)
// =============================================================================

/**
 * Get all active tasks with user's progress
 * This is the main function for displaying tasks in the UI
 */
export async function getTasksWithProgress(
  uid: string,
  cadence?: TaskCadence,
): Promise<TaskWithProgress[]> {
  try {
    // Fetch tasks and progress in parallel
    const [tasks, progressMap] = await Promise.all([
      getActiveTasks(cadence),
      getTaskProgress(uid),
    ]);

    return tasks.map((task) => {
      const progress = progressMap.get(task.id);
      const currentProgress = progress?.progress || 0;
      const claimed = progress?.claimed || false;
      const isCompleted = currentProgress >= task.target;
      const canClaim = isCompleted && !claimed;

      return {
        ...task,
        progress: currentProgress,
        claimed,
        isCompleted,
        canClaim,
      };
    });
  } catch (error) {
    console.error("[tasks] Error fetching tasks with progress:", error);
    throw error;
  }
}

/**
 * Subscribe to tasks with progress updates
 * @returns Unsubscribe function
 */
export function subscribeToTasksWithProgress(
  uid: string,
  onUpdate: (tasks: TaskWithProgress[]) => void,
  cadence?: TaskCadence,
): () => void {
  const db = getFirestoreInstance();
  const currentDayKey = getCurrentDayKey(DEFAULT_TIMEZONE);

  // Track current state
  let currentTasks: Task[] = [];
  let currentProgress: Map<string, TaskProgress> = new Map();

  // Helper to emit combined update
  const emitUpdate = () => {
    const tasksWithProgress = currentTasks.map((task) => {
      const progress = currentProgress.get(task.id);
      const currentProgressValue = progress?.progress || 0;
      const claimed = progress?.claimed || false;
      const isCompleted = currentProgressValue >= task.target;
      const canClaim = isCompleted && !claimed;

      return {
        ...task,
        progress: currentProgressValue,
        claimed,
        isCompleted,
        canClaim,
      };
    });

    onUpdate(tasksWithProgress);
  };

  // Subscribe to tasks
  const tasksRef = collection(db, "Tasks");
  let tasksQuery;
  if (cadence) {
    tasksQuery = query(
      tasksRef,
      where("active", "==", true),
      where("cadence", "==", cadence),
      orderBy("sortOrder", "asc"),
    );
  } else {
    tasksQuery = query(
      tasksRef,
      where("active", "==", true),
      orderBy("sortOrder", "asc"),
    );
  }

  const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
    const now = Date.now();
    currentTasks = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          icon: data.icon || "checkbox-marked-circle",
          cadence: data.cadence,
          type: data.type,
          target: data.target,
          rewardTokens: data.rewardTokens,
          rewardItemId: data.rewardItemId,
          active: data.active,
          sortOrder: data.sortOrder || 0,
          availableFrom: data.availableFrom?.toMillis?.() || data.availableFrom,
          availableTo: data.availableTo?.toMillis?.() || data.availableTo,
        } as Task;
      })
      .filter((task) => {
        if (task.availableFrom && now < task.availableFrom) return false;
        if (task.availableTo && now > task.availableTo) return false;
        return true;
      });
    emitUpdate();
  });

  // Subscribe to progress
  const progressRef = collection(db, "Users", uid, "TaskProgress");
  const progressQuery = query(
    progressRef,
    where("dayKey", "==", currentDayKey),
  );

  const unsubProgress = onSnapshot(progressQuery, (snapshot) => {
    currentProgress = new Map();
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      currentProgress.set(doc.id, {
        taskId: doc.id,
        progress: data.progress || 0,
        claimed: data.claimed || false,
        dayKey: data.dayKey,
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
        claimedAt: data.claimedAt?.toMillis?.() || data.claimedAt,
      });
    });
    emitUpdate();
  });

  // Return combined unsubscribe
  return () => {
    unsubTasks();
    unsubProgress();
  };
}

// =============================================================================
// Claim Reward (via Callable)
// =============================================================================

/**
 * Claim reward for a completed task
 * This calls a Cloud Function for atomic, secure reward distribution
 */
export async function claimTaskReward(
  taskId: string,
  dayKey?: string,
): Promise<{
  success: boolean;
  tokensAwarded?: number;
  itemAwarded?: string;
  error?: string;
}> {
  try {
    const app = getAppInstance();
    const functions = getFunctions(app);
    const claimReward = httpsCallable<
      { taskId: string; dayKey: string },
      {
        success: boolean;
        tokensAwarded?: number;
        itemAwarded?: string;
        error?: string;
      }
    >(functions, "claimTaskReward");

    const currentDayKey = dayKey || getCurrentDayKey(DEFAULT_TIMEZONE);

    console.log(
      "[tasks] Claiming reward for task:",
      taskId,
      "dayKey:",
      currentDayKey,
    );

    const result = await claimReward({ taskId, dayKey: currentDayKey });

    if (result.data.success) {
      console.log("[tasks] Reward claimed successfully:", result.data);
    } else {
      console.warn("[tasks] Reward claim failed:", result.data.error);
    }

    return result.data;
  } catch (error: any) {
    console.error("[tasks] Error claiming task reward:", error);

    // Handle Firebase function errors
    if (error.code === "functions/already-exists") {
      return { success: false, error: "Reward already claimed" };
    }
    if (error.code === "functions/failed-precondition") {
      return { success: false, error: "Task not completed" };
    }
    if (error.code === "functions/not-found") {
      return { success: false, error: "Task not found" };
    }

    return { success: false, error: error.message || "Failed to claim reward" };
  }
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Get display text for task type
 */
export function getTaskTypeDisplay(type: string): string {
  const typeMap: Record<string, string> = {
    send_message: "Send Messages",
    send_snap: "Send Snaps",
    view_story: "View Stories",
    post_story: "Post Stories",
    play_game: "Play Games",
    win_game: "Win Games",
    maintain_streak: "Maintain Streak",
    add_friend: "Add Friends",
    login: "Daily Login",
  };

  return typeMap[type] || type;
}

/**
 * Get icon for task type
 */
export function getTaskTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    send_message: "message-text",
    send_snap: "camera",
    view_story: "eye",
    post_story: "image-plus",
    play_game: "gamepad-variant",
    win_game: "trophy",
    maintain_streak: "fire",
    add_friend: "account-plus",
    login: "login",
  };

  return iconMap[type] || "checkbox-marked-circle";
}

/**
 * Get progress text for display
 */
export function getProgressText(progress: number, target: number): string {
  return `${Math.min(progress, target)} / ${target}`;
}

/**
 * Get progress percentage
 */
export function getProgressPercentage(
  progress: number,
  target: number,
): number {
  return Math.min((progress / target) * 100, 100);
}

/**
 * Get time remaining until daily reset (midnight in timezone)
 */
export function getTimeUntilReset(timezone = DEFAULT_TIMEZONE): string {
  const now = new Date();

  // Get current time in target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hours = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const minutes = parseInt(
    parts.find((p) => p.type === "minute")?.value || "0",
  );

  // Calculate time until midnight
  const hoursLeft = 23 - hours;
  const minutesLeft = 59 - minutes;

  if (hoursLeft === 0) {
    return `${minutesLeft}m`;
  }

  return `${hoursLeft}h ${minutesLeft}m`;
}
