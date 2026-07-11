"use client";

import {
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addTeamMember,
  cancelTeamInvitationAction,
  deleteTeamMember,
  getUserActivityLogsAction,
  inviteTeamMemberAction,
  updateTeamMemberRoleAction,
} from "@/actions/team.actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  memberId: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}

interface TeamClientProps {
  initialMembers: TeamMember[];
  initialInvitations: TeamInvitation[];
  currentUserId: string;
  currentUserRole: string;
}

function getInitialsColor(name: string) {
  const colors = [
    "bg-red-50 text-red-600 border-red-100",
    "bg-amber-50 text-amber-600 border-amber-100",
    "bg-emerald-50 text-emerald-600 border-emerald-100",
    "bg-indigo-50 text-indigo-600 border-indigo-100",
    "bg-rose-50 text-rose-600 border-rose-100",
    "bg-sky-50 text-sky-600 border-sky-100",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function TeamClient({
  initialMembers,
  initialInvitations,
  currentUserId,
  currentUserRole,
}: TeamClientProps) {
  // Member States
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [invitations, setInvitations] =
    useState<TeamInvitation[]>(initialInvitations);

  // Add Member Dialog/Sheet States
  const [openAddSheet, setOpenAddSheet] = useState(false);
  const [addMode, setAddMode] = useState<"invite" | "direct">("invite");
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [directName, setDirectName] = useState("");
  const [directEmail, setDirectEmail] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [directRole, setDirectRole] = useState("member");

  // User details slide-over states
  const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Permissions check helper
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  // Sync state with props
  useEffect(() => {
    setMembers(initialMembers);
    setInvitations(initialInvitations);
  }, [initialMembers, initialInvitations]);

  // Fetch Activity Logs
  useEffect(() => {
    if (selectedUser) {
      setLoadingActivity(true);
      getUserActivityLogsAction({ targetUserId: selectedUser.id })
        .then((res) => {
          if (res.success && res.logs) {
            setActivityLogs(res.logs);
          } else {
            setActivityLogs([]);
          }
        })
        .catch(() => setActivityLogs([]))
        .finally(() => setLoadingActivity(false));
    } else {
      setActivityLogs([]);
    }
  }, [selectedUser]);

  // Handlers
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const toastId = toast.loading("Sending invitation...");
    try {
      const res = await inviteTeamMemberAction({
        email: inviteEmail,
        role: inviteRole,
      });
      if (res.success) {
        toast.success("Invitation email sent successfully!", { id: toastId });
        setInviteEmail("");
        setOpenAddSheet(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirectAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const toastId = toast.loading("Creating user account directly...");
    try {
      const formData = new FormData();
      formData.append("name", directName);
      formData.append("email", directEmail);
      formData.append("password", directPassword);
      formData.append("role", directRole);

      await addTeamMember(formData);
      toast.success("Team member account created directly!", { id: toastId });
      setDirectName("");
      setDirectEmail("");
      setDirectPassword("");
      setOpenAddSheet(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add member", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const toastId = toast.loading("Canceling pending invitation...");
    try {
      const res = await cancelTeamInvitationAction({ invitationId });
      if (res.success) {
        toast.success("Invitation cancelled successfully", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel invitation", {
        id: toastId,
      });
    }
  };

  const handleUpdateRole = async (memberUserId: string, newRole: string) => {
    const toastId = toast.loading("Updating user membership role...");
    try {
      const res = await updateTeamMemberRoleAction({
        memberUserId,
        role: newRole,
      });
      if (res.success) {
        toast.success("Role updated successfully!", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update role", { id: toastId });
    }
  };

  const handleRemoveMember = async (targetUserId: string, name: string) => {
    const toastId = toast.loading(`Removing ${name} from organization...`);
    try {
      const res = await deleteTeamMember(targetUserId, name);
      if (res.success) {
        toast.success("Member removed successfully!", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member", { id: toastId });
    }
  };

  // Helper calculations for user details dashboard
  const calculateActivityMetrics = () => {
    if (!activityLogs.length) return { counts: [0, 0, 0, 0, 0], maxVal: 5 };

    let kws = 0;
    let reports = 0;
    let thresholds = 0;
    let accounts = 0;
    let generic = 0;

    for (const log of activityLogs) {
      const action = log.action.toUpperCase();
      if (action.includes("NEGATIVE") || action.includes("KEYWORD")) kws++;
      else if (action.includes("REPORT") || action.includes("BRIEFING"))
        reports++;
      else if (action.includes("THRESHOLD") || action.includes("TRIAGE"))
        thresholds++;
      else if (
        action.includes("LINK_ACCOUNT") ||
        action.includes("SYNC_PORTFOLIO")
      )
        accounts++;
      else generic++;
    }

    const counts = [kws, reports, thresholds, accounts, generic];
    const maxVal = Math.max(5, ...counts);
    return { counts, maxVal };
  };

  const renderRadarChart = () => {
    const { counts, maxVal } = calculateActivityMetrics();
    const size = 180;
    const center = size / 2;
    const maxR = size * 0.35;
    const axes = [
      "Negative Keywords",
      "Reports Generated",
      "Thresholds Changed",
      "Accounts Managed",
      "System Logs",
    ];

    const angles = [
      -Math.PI / 2, // Up
      -Math.PI / 2 + (2 * Math.PI) / 5,
      -Math.PI / 2 + (4 * Math.PI) / 5,
      -Math.PI / 2 + (6 * Math.PI) / 5,
      -Math.PI / 2 + (8 * Math.PI) / 5,
    ];

    // Reference Concentric Circles (3 levels)
    const concentricLevels = [0.33, 0.66, 1.0];
    const referenceLines = concentricLevels.map((lvl) => {
      const r = maxR * lvl;
      const points = angles
        .map((a) => {
          const x = center + r * Math.cos(a);
          const y = center + r * Math.sin(a);
          return `${x},${y}`;
        })
        .join(" ");
      return (
        <polygon
          key={`ref-${lvl}`}
          points={points}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      );
    });

    // Outer Axis Lines
    const axisLines = angles.map((a, i) => {
      const x = center + maxR * Math.cos(a);
      const y = center + maxR * Math.sin(a);
      return (
        <line
          key={`axis-${i}`}
          x1={center}
          y1={center}
          x2={x}
          y2={y}
          stroke="#e2e8f0"
          strokeWidth="1"
        />
      );
    });

    // User Data Polygon
    const dataPoints = angles
      .map((a, i) => {
        const val = counts[i];
        const r = (val / maxVal) * maxR;
        const x = center + r * Math.cos(a);
        const y = center + r * Math.sin(a);
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-xl p-4 shadow-sm">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
          Skills Profile (Radar)
        </span>
        <svg width={size} height={size} className="overflow-visible">
          {/* Background grid */}
          {referenceLines}
          {axisLines}

          {/* User values polygon */}
          <polygon
            points={dataPoints}
            fill="rgba(99, 102, 241, 0.15)"
            stroke="#6366f1"
            strokeWidth="2"
          />

          {/* Dots on corners */}
          {angles.map((a, i) => {
            const val = counts[i];
            const r = (val / maxVal) * maxR;
            const x = center + r * Math.cos(a);
            const y = center + r * Math.sin(a);
            return (
              <circle
                key={`dot-${i}`}
                cx={x}
                cy={y}
                r="3.5"
                fill="#4f46e5"
                stroke="white"
                strokeWidth="1"
              />
            );
          })}

          {/* Labels */}
          {angles.map((a, i) => {
            const r = maxR + 15;
            const x = center + r * Math.cos(a);
            const y = center + r * Math.sin(a);
            let textAnchor: "start" | "end" | "middle" = "middle";
            if (Math.cos(a) > 0.1) textAnchor = "start";
            else if (Math.cos(a) < -0.1) textAnchor = "end";

            return (
              <text
                key={`lbl-${i}`}
                x={x}
                y={y + 3}
                fontSize="8"
                fontWeight="700"
                fill="#64748b"
                textAnchor={textAnchor}
                className="select-none tracking-tight uppercase"
              >
                {axes[i].split(" ")[0]} ({counts[i]})
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  // Render contribution calendar grid (past 24 weeks)
  const renderContributionCalendar = () => {
    // Group audit logs by YYYY-MM-DD
    const logsByDate = new Map<string, number>();
    for (const log of activityLogs) {
      const dateStr = log.createdAt.split("T")[0];
      logsByDate.set(dateStr, (logsByDate.get(dateStr) || 0) + 1);
    }

    // Build 24 columns (weeks) x 7 rows (days, Mon-Sun)
    const weeks = [];
    const today = new Date();
    // Start from the Monday 24 weeks ago
    const startDate = new Date();
    startDate.setDate(today.getDate() - 24 * 7);
    const startDay = startDate.getDay();
    // Adjust to Monday
    const diff = startDate.getDate() - startDay + (startDay === 0 ? -6 : 1);
    startDate.setDate(diff);

    for (let w = 0; w < 24; w++) {
      const weekDays = [];
      for (let d = 0; d < 7; d++) {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + w * 7 + d);

        const dateStr = current.toISOString().split("T")[0];
        const count = logsByDate.get(dateStr) || 0;

        let bg = "bg-slate-100 hover:bg-slate-200 border-slate-200/50";
        if (count > 0 && count <= 2)
          bg = "bg-indigo-100 hover:bg-indigo-200 border-indigo-200";
        else if (count > 2 && count <= 4)
          bg = "bg-indigo-400 hover:bg-indigo-500 border-indigo-500";
        else if (count > 4)
          bg = "bg-indigo-700 hover:bg-indigo-800 border-indigo-800";

        weekDays.push({ dateStr, count, bg });
      }
      weeks.push(weekDays);
    }

    return (
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 shadow-sm">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
          Activity Density (Past 6 Months)
        </span>
        <TooltipProvider>
          <div className="flex gap-[3px] overflow-x-auto pb-1 select-none">
            {weeks.map((week, wIdx) => (
              <div
                key={`wk-${wIdx}`}
                className="flex flex-col gap-[3px] shrink-0"
              >
                {week.map((day, dIdx) => (
                  <Tooltip key={`day-${wIdx}-${dIdx}`}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "w-[9px] h-[9px] rounded-[1.5px] border cursor-crosshair transition-all",
                          day.bg,
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="bg-slate-900 text-white text-[9px] px-2 py-1 border border-slate-800 shadow-xl"
                    >
                      <strong>{day.count} actions</strong> on{" "}
                      {new Date(day.dateStr).toLocaleDateString("en-AU", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>
        </TooltipProvider>
        <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 mt-2 px-0.5">
          <span>Less</span>
          <div className="flex gap-[3px] items-center">
            <div className="w-[8px] h-[8px] bg-slate-100 border border-slate-200/50 rounded-[1px]" />
            <div className="w-[8px] h-[8px] bg-indigo-100 border border-indigo-200 rounded-[1px]" />
            <div className="w-[8px] h-[8px] bg-indigo-400 border border-indigo-500 rounded-[1px]" />
            <div className="w-[8px] h-[8px] bg-indigo-700 border border-indigo-800 rounded-[1px]" />
          </div>
          <span>More</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage your agency staff, access roles, and monitor dashboard
            activity logs.
          </p>
        </div>

        {canManage && (
          <Sheet open={openAddSheet} onOpenChange={setOpenAddSheet}>
            <SheetTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm text-xs px-4 h-10 flex items-center gap-1.5 font-bold transition-all shrink-0 cursor-pointer">
                <UserPlus className="h-4 w-4" />
                Add New Member
              </Button>
            </SheetTrigger>
            <SheetContent className="px-5 rounded-l-2xl border-slate-200 gap-0 w-full max-w-md bg-white">
              <SheetHeader className="pb-5 border-b border-slate-100">
                <SheetTitle className="text-sm font-bold text-slate-900">
                  Add Team Member
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500">
                  Invite a new user or directly create their credentials.
                </SheetDescription>
              </SheetHeader>

              {/* Mode Toggles */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl my-5 text-center text-xs font-semibold select-none">
                <button
                  type="button"
                  onClick={() => setAddMode("invite")}
                  className={cn(
                    "py-2 rounded-lg cursor-pointer transition-all",
                    addMode === "invite"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  Send Email Invite
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("direct")}
                  className={cn(
                    "py-2 rounded-lg cursor-pointer transition-all",
                    addMode === "direct"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  Create Account Directly
                </button>
              </div>

              {addMode === "invite" ? (
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="invite-email"
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Email Address
                    </Label>
                    <Input
                      id="invite-email"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="jane@agency.com"
                      className="rounded-xl border-slate-200 text-xs h-10 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="invite-role"
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Access Role
                    </Label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 text-xs h-10 px-3 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <SheetFooter className="border-t border-slate-100 pt-5 mt-6 flex gap-3 justify-end">
                    <SheetClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs rounded-xl h-10 px-4 border-slate-200 font-bold text-slate-600 hover:text-slate-800"
                      >
                        Cancel
                      </Button>
                    </SheetClose>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl h-10 px-4 shadow-sm"
                    >
                      {submitting ? "Sending..." : "Send Invite"}
                    </Button>
                  </SheetFooter>
                </form>
              ) : (
                <form onSubmit={handleDirectAdd} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="direct-name"
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Full Name
                    </Label>
                    <Input
                      id="direct-name"
                      required
                      value={directName}
                      onChange={(e) => setDirectName(e.target.value)}
                      placeholder="Jane Doe"
                      className="rounded-xl border-slate-200 text-xs h-10 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="direct-email"
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Email Address
                    </Label>
                    <Input
                      id="direct-email"
                      type="email"
                      required
                      value={directEmail}
                      onChange={(e) => setDirectEmail(e.target.value)}
                      placeholder="jane@agency.com"
                      className="rounded-xl border-slate-200 text-xs h-10 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="direct-pass"
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Temporary Password
                    </Label>
                    <Input
                      id="direct-pass"
                      required
                      value={directPassword}
                      onChange={(e) => setDirectPassword(e.target.value)}
                      placeholder="Temp123!"
                      className="rounded-xl border-slate-200 text-xs h-10 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="direct-role"
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Access Role
                    </Label>
                    <select
                      id="direct-role"
                      value={directRole}
                      onChange={(e) => setDirectRole(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 text-xs h-10 px-3 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <SheetFooter className="border-t border-slate-100 pt-5 mt-6 flex gap-3 justify-end">
                    <SheetClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs rounded-xl h-10 px-4 border-slate-200 font-bold text-slate-600 hover:text-slate-800"
                      >
                        Cancel
                      </Button>
                    </SheetClose>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl h-10 px-4 shadow-sm"
                    >
                      {submitting ? "Adding..." : "Create Account"}
                    </Button>
                  </SheetFooter>
                </form>
              )}
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* 2. ACTIVE MEMBERS LIST */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden gap-0">
        <CardHeader className="p-6 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800">
            Active Users
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Personnel with active organization access. Click any user row to
            inspect history & details.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b border-slate-100 hover:bg-transparent">
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5 pl-6">
                  Name
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5">
                  Email
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5">
                  Role
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5">
                  Access Status
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5 text-right pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const initials = member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .substring(0, 2);
                const avatarClass = getInitialsColor(member.name);

                // Check RBAC limits for changing this member
                const targetIsOwner = member.role === "owner";
                const isSelf = member.id === currentUserId;
                const canChangeRole =
                  canManage &&
                  !targetIsOwner &&
                  (!isSelf || currentUserRole === "owner");
                const canRemove = canManage && !targetIsOwner && !isSelf;

                return (
                  <TableRow
                    key={member.id}
                    onClick={() => setSelectedUser(member)}
                    className="hover:bg-slate-50/50 border-b border-slate-100/50 transition-colors cursor-pointer"
                  >
                    <TableCell className="py-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 select-none",
                            avatarClass,
                          )}
                        >
                          {initials}
                        </div>
                        <span className="font-semibold text-slate-800 text-xs">
                          {member.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {member.email}
                      </div>
                    </TableCell>
                    <TableCell
                      className="py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canChangeRole ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 capitalize flex items-center gap-1 cursor-pointer bg-transparent border-0"
                            >
                              {member.role}
                              <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="bg-white border text-xs"
                          >
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateRole(member.id, "member")
                              }
                              className="cursor-pointer"
                            >
                              Member
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateRole(member.id, "admin")
                              }
                              className="cursor-pointer"
                            >
                              Admin
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="capitalize text-[10px] font-bold px-2 py-0.5 border-slate-100 border text-slate-600"
                        >
                          {member.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0 select-none">
                        <Shield className="h-3 w-3" />
                        Active Access
                      </span>
                    </TableCell>
                    <TableCell
                      className="py-4 text-right pr-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canRemove ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 rounded-xl h-8 text-xs font-bold px-3 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white border-slate-200 shadow-2xl rounded-2xl max-w-md p-6">
                            <AlertDialogHeader className="pb-3 border-b border-slate-100">
                              <AlertDialogTitle className="text-sm font-bold text-slate-900">
                                Remove Team Access?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-xs text-slate-500 mt-2 leading-relaxed">
                                This will permanently remove{" "}
                                <span className="font-bold text-slate-800">
                                  {member.name}
                                </span>{" "}
                                from this organization and revoke their access
                                to Uprise Tools dashboard.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="pt-4 flex gap-3 justify-end">
                              <AlertDialogCancel className="text-xs rounded-xl h-10 px-4 border-slate-200 font-bold text-slate-600 hover:text-slate-800 cursor-pointer">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleRemoveMember(member.id, member.name)
                                }
                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl h-10 px-4 shadow-sm cursor-pointer"
                              >
                                Revoke Access
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold uppercase select-none">
                          No Actions
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 3. PENDING INVITATIONS LIST */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden gap-0">
        <CardHeader className="p-6 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800">
            Pending Invitations
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Invitations sent by email waiting to be accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b border-slate-100 hover:bg-transparent">
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5 pl-6">
                  Invited Email
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5">
                  Invited Role
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5">
                  Status
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5">
                  Expires At
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5 text-right pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invite) => (
                <TableRow
                  key={invite.id}
                  className="hover:bg-slate-50/50 border-b border-slate-100/50 transition-colors"
                >
                  <TableCell className="py-4 pl-6">
                    <div className="flex items-center gap-1.5 text-slate-800 text-xs font-semibold">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {invite.email}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge
                      variant="secondary"
                      className="capitalize text-[10px] font-bold px-2 py-0.5 border-slate-100 border text-slate-600"
                    >
                      {invite.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0 select-none">
                      <Clock className="h-3 w-3" />
                      Pending Invite
                    </span>
                  </TableCell>
                  <TableCell className="py-4 text-xs font-medium text-slate-500">
                    {new Date(invite.expiresAt).toLocaleDateString("en-AU", {
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    {canManage ? (
                      <Button
                        variant="outline"
                        onClick={() => handleCancelInvitation(invite.id)}
                        className="border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 rounded-xl h-8 text-xs font-bold px-3 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold uppercase select-none">
                        No Actions
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invitations.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-slate-400 font-semibold text-xs py-10"
                  >
                    No pending invitations.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 4. USER DETAILS SLIDE-OVER SHEET */}
      <Sheet
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
      >
        <SheetContent className="px-5 rounded-l-2xl border-slate-200 gap-0 w-full max-w-lg bg-white overflow-y-auto">
          {selectedUser && (
            <>
              <SheetHeader className="pb-5 border-b border-slate-100 flex flex-row items-center justify-between gap-4">
                <div>
                  <SheetTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    {selectedUser.name}'s Profile
                  </SheetTitle>
                  <SheetDescription className="text-xs text-slate-500 mt-1">
                    Membership role and dashboard audit logs.
                  </SheetDescription>
                </div>
              </SheetHeader>

              <div className="py-6 space-y-6">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 border rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">
                      Email Address
                    </span>
                    <span className="font-semibold text-slate-800 truncate block mt-0.5">
                      {selectedUser.email}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">
                      Access Role
                    </span>
                    <span className="font-bold text-indigo-600 capitalize block mt-0.5">
                      {selectedUser.role}
                    </span>
                  </div>
                </div>

                {loadingActivity ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-500 mb-2" />
                    <span className="text-[10px] font-bold tracking-wide">
                      Loading activity logs...
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Radar (Spiderweb) Chart */}
                    {renderRadarChart()}

                    {/* Contribution Calendar */}
                    {renderContributionCalendar()}

                    {/* Activity Timeline List */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Recent Activity Log
                      </span>
                      <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                        {activityLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex gap-3 text-xs leading-normal"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 capitalize">
                                {log.action.toLowerCase().replace(/_/g, " ")}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                Target: {log.targetTable} ({log.targetId})
                              </p>
                              {log.metadata && (
                                <pre className="text-[9px] font-mono bg-slate-50 text-slate-600 p-1.5 rounded mt-1 border border-slate-100 max-h-24 overflow-y-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold shrink-0 self-start">
                              {new Date(log.createdAt).toLocaleDateString(
                                "en-AU",
                                { month: "short", day: "numeric" },
                              )}
                            </span>
                          </div>
                        ))}
                        {activityLogs.length === 0 && (
                          <div className="text-center text-slate-400 font-semibold py-6 border rounded-lg border-dashed text-xs">
                            No logs logged in this organization.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
