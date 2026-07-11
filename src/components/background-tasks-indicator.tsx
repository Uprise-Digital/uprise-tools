"use client";

import {
  CheckCircle2,
  ChevronDown,
  Database,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getActiveBackgroundTasksAction } from "@/actions/background-tasks.actions";
import { cn } from "@/lib/utils";

interface BackgroundTask {
  id: number;
  name: string;
  status: "running" | "completed" | "failed";
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export function BackgroundTasksIndicator() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [hasNewCompleted, setHasNewCompleted] = useState<boolean>(false);

  // Load collapse state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("uprise_tasks_indicator_collapsed");
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("uprise_tasks_indicator_collapsed", String(nextState));
  };

  const fetchTasks = useCallback(async () => {
    try {
      const res = await getActiveBackgroundTasksAction();
      if (res.success && res.tasks) {
        setTasks(res.tasks);

        // Check if any task transitioned to completed/failed
        const hasCompleted = res.tasks.some(
          (t) => t.status === "completed" || t.status === "failed",
        );
        if (hasCompleted) {
          setHasNewCompleted(true);
        } else {
          setHasNewCompleted(false);
        }
      }
    } catch (e) {
      console.error("Failed to poll background tasks:", e);
    }
  }, []);

  const hasRunningTasks = tasks.some((t) => t.status === "running");

  // Initial fetch on mount
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Dynamic Polling Strategy
  useEffect(() => {
    const intervalTime = hasRunningTasks ? 2500 : 6000;
    const interval = setInterval(fetchTasks, intervalTime);
    return () => clearInterval(interval);
  }, [fetchTasks, hasRunningTasks]);

  if (tasks.length === 0) return null;

  const runningTasks = tasks.filter((t) => t.status === "running");

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 transition-all duration-300 transform shadow-2xl",
        "bg-slate-950/90 backdrop-blur-md border border-slate-800 text-white rounded-2xl",
        isCollapsed
          ? "w-14 h-14 flex items-center justify-center cursor-pointer hover:bg-slate-900"
          : "w-80 p-4",
      )}
      onClick={isCollapsed ? toggleCollapse : undefined}
    >
      {isCollapsed ? (
        // --- COLLAPSED VIEW ---
        <div className="relative flex items-center justify-center w-full h-full group">
          {runningTasks.length > 0 ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shadow-lg border border-slate-900">
                {runningTasks.length}
              </span>
            </>
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-400 animate-pulse" />
          )}
          {/* Hover Tooltip */}
          <div className="absolute right-16 bg-slate-950 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-850 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none">
            {runningTasks.length > 0
              ? `${runningTasks.length} task${runningTasks.length > 1 ? "s" : ""} running`
              : "Tasks completed"}
          </div>
        </div>
      ) : (
        // --- EXPANDED VIEW ---
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Database className="h-4.5 w-4.5 text-indigo-400" />
              <span className="text-[11px] font-bold tracking-wide uppercase text-slate-350">
                Background Tasks
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse();
              }}
              className="text-slate-500 hover:text-slate-200 transition-colors p-0.5 rounded cursor-pointer"
            >
              <ChevronDown className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Task List */}
          <div className="flex flex-col gap-3.5 max-h-48 overflow-y-auto pr-1">
            {tasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-200 truncate pr-2">
                    {task.name}
                  </span>
                  <div className="flex items-center flex-shrink-0">
                    {task.status === "running" && (
                      <span className="text-indigo-400 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Running
                      </span>
                    )}
                    {task.status === "completed" && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Done
                      </span>
                    )}
                    {task.status === "failed" && (
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Failed
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {task.status === "running" ? (
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden relative">
                    <div className="h-full bg-indigo-500 rounded-full w-1/3 absolute animate-indeterminate-slide" />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "h-1.5 w-full rounded-full",
                      task.status === "completed"
                        ? "bg-emerald-500/20"
                        : "bg-rose-500/20",
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full w-full",
                        task.status === "completed"
                          ? "bg-emerald-500"
                          : "bg-rose-500",
                      )}
                    />
                  </div>
                )}

                {task.error && (
                  <span className="text-[10px] text-rose-400/90 leading-normal block max-w-full break-words pl-1 border-l border-rose-500/30">
                    {task.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
