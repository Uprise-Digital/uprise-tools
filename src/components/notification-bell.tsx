"use client";

import {
  Activity,
  AlertTriangle,
  Ban,
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  FileCheck,
  FileText,
  Gauge,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useTransition } from "react";
import {
  deleteNotificationAction,
  getNotificationsAction,
  getUnreadNotificationCountAction,
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/actions/notification.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  userId: string;
  organizationId: string | null;
  adAccountId: number | null;
  type: string;
  severity: string;
  title: string;
  message: string;
  link: string | null;
  metadata: any;
  isRead: boolean;
  createdAt: string | Date;
}

function formatRelativeTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getNotificationIcon(type: string, severity: string) {
  if (type === "lp_speed_degraded") {
    return (
      <div className="h-8 w-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
        <Gauge className="h-4 w-4" />
      </div>
    );
  }
  if (type.startsWith("negative_keywords")) {
    return (
      <div className="h-8 w-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
        <Ban className="h-4 w-4" />
      </div>
    );
  }
  if (type === "report_generated") {
    return (
      <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
        <FileCheck className="h-4 w-4" />
      </div>
    );
  }
  if (type === "report_failed") {
    return (
      <div className="h-8 w-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
        <AlertTriangle className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
      <Bell className="h-4 w-4" />
    </div>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Load unread count on mount and periodic poll
  const refreshUnreadCount = async () => {
    const res = await getUnreadNotificationCountAction();
    if (res.success && typeof res.count === "number") {
      setUnreadCount(res.count);
    }
  };

  const loadNotifications = async (targetFilter = filter) => {
    setLoading(true);
    try {
      const res = await getNotificationsAction(targetFilter);
      if (res.success && res.notifications) {
        setNotifications(res.notifications as any);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 45000); // 45s poll
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      loadNotifications(filter);
      refreshUnreadCount();
    }
  }, [open, filter]);

  const handleMarkAsRead = async (item: NotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (item.isRead) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    await markNotificationAsReadAction(item.id);
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await markAllNotificationsAsReadAction();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    await deleteNotificationAction(id);
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      await handleMarkAsRead(item);
    }
    if (item.link) {
      setOpen(false);
      router.push(item.link);
    }
  };

  const hasCriticalUnread = notifications.some(
    (n) => !n.isRead && n.severity === "critical",
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Open notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center text-white border-2 border-white shadow-xs",
                hasCriticalUnread
                  ? "bg-rose-600 animate-pulse"
                  : "bg-indigo-600",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] sm:w-[410px] p-0 rounded-2xl border border-slate-200 shadow-2xl bg-white overflow-hidden z-50 flex flex-col"
      >
        {/* HEADER */}
        <div className="p-3.5 px-4 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">Notifications</span>
            {unreadCount > 0 && (
              <Badge
                variant="outline"
                className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold px-1.5 py-0"
              >
                {unreadCount} new
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-7 px-2 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/70 rounded-lg flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </Button>
            )}
          </div>
        </div>

        {/* FILTER TABS */}
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 bg-white">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
              filter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              filter === "unread"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
            )}
          >
            Unread
            {unreadCount > 0 && (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  filter === "unread" ? "bg-indigo-400" : "bg-indigo-600",
                )}
              />
            )}
          </button>
          <button
            onClick={() => setFilter("critical")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
              filter === "critical"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-500 hover:text-rose-600 hover:bg-rose-50",
            )}
          >
            Critical
          </button>
        </div>

        {/* NOTIFICATION LIST */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100/90">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span className="text-xs font-medium">Loading alerts...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                <CheckCheck className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">All caught up!</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {filter === "unread"
                  ? "No unread alerts at the moment."
                  : filter === "critical"
                    ? "No critical alerts found."
                    : "You have no new alerts right now."}
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={cn(
                  "p-3 px-3.5 flex items-start gap-3 transition-colors cursor-pointer group relative",
                  item.isRead
                    ? "bg-white hover:bg-slate-50/80"
                    : "bg-indigo-50/30 hover:bg-indigo-50/60",
                )}
              >
                {/* Icon */}
                {getNotificationIcon(item.type, item.severity)}

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5">
                    <h4
                      className={cn(
                        "text-xs truncate",
                        item.isRead
                          ? "font-semibold text-slate-700"
                          : "font-bold text-slate-900",
                      )}
                    >
                      {item.title}
                    </h4>
                    {!item.isRead && (
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                    {item.message}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-medium text-slate-400">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                    {item.link && (
                      <span className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                        View <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Dismiss Button */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 flex items-center gap-1">
                  {!item.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(item, e)}
                      title="Mark as read"
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    title="Dismiss"
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
