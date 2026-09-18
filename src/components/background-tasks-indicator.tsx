"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  Loader2,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelBackgroundTaskAction,
  getActiveBackgroundTasksAction,
} from "@/actions/background-tasks.actions";
import { cn } from "@/lib/utils";

interface BackgroundTask {
  id: number;
  name: string;
  status: "running" | "completed" | "failed";
  error: string | null;
  totalItems?: number | null;
  completedItems?: number;
  currentItem?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function BackgroundTasksIndicator() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());
  const prevTaskStatuses = useRef<Map<number, string>>(new Map());

  // Load collapse state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("uprise_tasks_indicator_collapsed");
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
  }, []);

  // Live timer for second-by-second heartbeat updates
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
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
        // Detect newly completed or failed tasks to notify pages across the app
        for (const task of res.tasks) {
          const prevStatus = prevTaskStatuses.current.get(task.id);
          if (prevStatus === "running" && task.status === "completed") {
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("uprise:background_task_completed", {
                  detail: task,
                }),
              );
            }
          }
          prevTaskStatuses.current.set(task.id, task.status);
        }

        setTasks(res.tasks);
      }
    } catch (e) {
      console.error("Failed to poll background tasks:", e);
    }
  }, []);

  const handleManualRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    await fetchTasks();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const [cancellingTaskId, setCancellingTaskId] = useState<number | null>(null);

  const handleCancelTask = async (taskId: number) => {
    setCancellingTaskId(taskId);
    try {
      // Optimistically update UI so task immediately shows as cancelled
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "failed",
                error: "Cancelled by user",
                currentItem: "Cancelled by user",
              }
            : t,
        ),
      );
      await cancelBackgroundTaskAction(taskId);
      await fetchTasks();
    } catch (err) {
      console.error("Failed to cancel task:", err);
    } finally {
      setCancellingTaskId(null);
    }
  };

  const hasRunningTasks = tasks.some((t) => t.status === "running");

  // Initial fetch on mount
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Dynamic Polling Strategy (poll every 2.5s while running)
  useEffect(() => {
    const intervalTime = hasRunningTasks ? 2500 : 6000;
    const interval = setInterval(fetchTasks, intervalTime);
    return () => clearInterval(interval);
  }, [fetchTasks, hasRunningTasks]);

  if (tasks.length === 0) return null;

  const runningTasks = tasks.filter((t) => t.status === "running");
  const primaryRunningTask = runningTasks[0];

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 transition-all duration-300 transform shadow-2xl",
        "bg-slate-950/95 backdrop-blur-md border border-slate-800 text-white rounded-2xl",
        isCollapsed
          ? "w-14 h-14 flex items-center justify-center cursor-pointer hover:bg-slate-900"
          : "w-96 p-4",
      )}
      onClick={isCollapsed ? toggleCollapse : undefined}
    >
      {isCollapsed ? (
        // --- COLLAPSED VIEW ---
        <div className="relative flex items-center justify-center w-full h-full group">
          {runningTasks.length > 0 ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-[10px] font-bold px-1.5 h-5 min-w-[20px] rounded-full flex items-center justify-center shadow-lg border border-slate-900">
                {primaryRunningTask?.totalItems && primaryRunningTask.totalItems > 0
                  ? `${Math.round(
                      ((primaryRunningTask.completedItems || 0) /
                        primaryRunningTask.totalItems) *
                        100,
                    )}%`
                  : runningTasks.length}
              </span>
            </>
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-400 animate-pulse" />
          )}
          {/* Hover Tooltip */}
          <div className="absolute right-16 bg-slate-950 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none">
            {runningTasks.length > 0
              ? primaryRunningTask?.totalItems && primaryRunningTask.totalItems > 0
                ? `${primaryRunningTask.completedItems || 0} / ${primaryRunningTask.totalItems} pages (${Math.max(0, primaryRunningTask.totalItems - (primaryRunningTask.completedItems || 0))} remaining)`
                : `${runningTasks.length} task${runningTasks.length > 1 ? "s" : ""} running`
              : "Tasks completed"}
          </div>
        </div>
      ) : (
        // --- EXPANDED VIEW ---
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-400" />
              <span className="text-[11px] font-bold tracking-wide uppercase text-slate-300">
                Background Tasks
              </span>
              {runningTasks.length > 0 && (
                <span className="bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {runningTasks.length} Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleManualRefresh}
                title="Refresh tasks status"
                className="text-slate-400 hover:text-indigo-300 transition-colors p-1 rounded hover:bg-slate-900 cursor-pointer"
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5",
                    isRefreshing && "animate-spin text-indigo-400",
                  )}
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse();
                }}
                title="Collapse"
                className="text-slate-500 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-900 cursor-pointer"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="flex flex-col gap-4 max-h-64 overflow-y-auto pr-1">
            {tasks.map((task) => {
              const hasItemProgress =
                typeof task.totalItems === "number" && task.totalItems > 0;
              const completed = task.completedItems ?? 0;
              const total = task.totalItems ?? 0;
              const remaining = Math.max(0, total - completed);
              const percent = hasItemProgress
                ? Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
                : 0;

              const updatedTime = new Date(task.updatedAt).getTime();
              const secondsAgo = Math.max(0, Math.floor((now - updatedTime) / 1000));
              // A task is flagged as potentially stalled if no heartbeat was recorded for > 75s
              const isStalled = task.status === "running" && secondsAgo > 75;

              return (
                <div
                  key={task.id}
                  className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-900/40 border border-slate-850"
                >
                  {/* Task Header & Status Badge */}
                  <div className="flex items-center justify-between text-xs font-semibold gap-2">
                    <span className="text-slate-200 truncate font-medium">
                      {task.name}
                    </span>
                    <div className="flex items-center flex-shrink-0 gap-1.5">
                      {task.status === "running" && (
                        <>
                          <span className="text-indigo-400 flex items-center gap-1.5 text-[11px] bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/50">
                            <Loader2 className="h-3 w-3 animate-spin" /> Running
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelTask(task.id);
                            }}
                            disabled={cancellingTaskId === task.id}
                            title="Cancel / Stop this task"
                            className="text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 text-[10px] font-medium px-2 py-0.5 rounded-md border border-rose-800/50 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {cancellingTaskId === task.id ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <X className="h-2.5 w-2.5" />
                            )}
                            <span>Cancel</span>
                          </button>
                        </>
                      )}
                      {task.status === "completed" && (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px] bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/50">
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </span>
                      )}
                      {task.status === "failed" && (
                        <span className="text-rose-400 flex items-center gap-1 text-[11px] bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/50">
                          <XCircle className="h-3 w-3" /> Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Counter & Percentage */}
                  {hasItemProgress && (
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                      <span>
                        <strong className="text-slate-100 font-semibold">
                          {completed}
                        </strong>{" "}
                        of {total} done{" "}
                        <span className="text-slate-400 font-normal">
                          ({remaining} remaining)
                        </span>
                      </span>
                      <span className="text-indigo-300 font-bold tabular-nums">
                        {percent}%
                      </span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {task.status === "running" ? (
                    hasItemProgress ? (
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-violet-500 rounded-full transition-all duration-500 ease-out relative"
                          style={{ width: `${Math.max(4, percent)}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden relative">
                        <div className="h-full bg-indigo-500 rounded-full w-1/3 absolute animate-indeterminate-slide" />
                      </div>
                    )
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

                  {/* Current Active Item Detail */}
                  {task.currentItem && task.status === "running" && (
                    <div className="text-[10px] text-slate-300 bg-slate-950/70 rounded-md px-2 py-1 border border-slate-800/80 truncate">
                      <span className="text-indigo-400 font-medium mr-1.5">
                        Current:
                      </span>
                      <span className="text-slate-300 font-mono text-[10px]" title={task.currentItem}>
                        {task.currentItem}
                      </span>
                    </div>
                  )}

                  {/* Heartbeat & Liveness Stall Detector */}
                  {task.status === "running" && (
                    <div className="flex items-center justify-between text-[10px] pt-0.5">
                      {isStalled ? (
                        <span className="text-amber-400 flex items-center gap-1 font-medium bg-amber-950/40 px-2 py-0.5 rounded border border-amber-700/50">
                          <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                          Slow / May be stalled ({secondsAgo}s since last heartbeat)
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                          <span>
                            Active · heartbeat{" "}
                            {secondsAgo < 3 ? "just now" : `${secondsAgo}s ago`}
                          </span>
                        </span>
                      )}
                      <span className="text-slate-400 text-[9px]">
                        Auto-refreshing
                      </span>
                    </div>
                  )}

                  {/* Error Message if Failed */}
                  {task.error && (
                    <span className="text-[10px] text-rose-400/90 leading-normal block max-w-full break-words pl-2 border-l-2 border-rose-500/40 bg-rose-950/20 py-1 rounded-r">
                      {task.error}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

