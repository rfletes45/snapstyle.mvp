/**
 * useTasksSummary — Lightweight hook for task progress counts.
 *
 * Subscribes to daily & monthly tasks and returns completed / total counts.
 * Intended for use by the tasks-overview profile widget.
 *
 * @module hooks/useTasksSummary
 */

import { useEffect, useState } from "react";

import { subscribeToTasksWithProgress } from "@/services/tasks";
import type { TaskWithProgress } from "@/types/models";

export interface TasksSummary {
  dailyCompleted: number;
  dailyTotal: number;
  monthlyCompleted: number;
  monthlyTotal: number;
  loading: boolean;
}

export function useTasksSummary(uid: string | undefined): TasksSummary {
  const [dailyTasks, setDailyTasks] = useState<TaskWithProgress[]>([]);
  const [monthlyTasks, setMonthlyTasks] = useState<TaskWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let dailyReady = false;
    let monthlyReady = false;

    const unsubDaily = subscribeToTasksWithProgress(
      uid,
      (tasks) => {
        setDailyTasks(tasks);
        dailyReady = true;
        if (monthlyReady) setLoading(false);
      },
      "daily",
    );

    const unsubMonthly = subscribeToTasksWithProgress(
      uid,
      (tasks) => {
        setMonthlyTasks(tasks);
        monthlyReady = true;
        if (dailyReady) setLoading(false);
      },
      "monthly",
    );

    return () => {
      unsubDaily();
      unsubMonthly();
    };
  }, [uid]);

  return {
    dailyCompleted: dailyTasks.filter((t) => t.isCompleted).length,
    dailyTotal: dailyTasks.length,
    monthlyCompleted: monthlyTasks.filter((t) => t.isCompleted).length,
    monthlyTotal: monthlyTasks.length,
    loading,
  };
}
