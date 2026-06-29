import { Mail, Shield, Trash2, UserPlus } from "lucide-react";
import {
  addTeamMember,
  deleteTeamMember,
  getTeamMembers,
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default async function TeamManagementPage() {
  const team = await getTeamMembers();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage your agency staff and their access permissions to alert
            dashboards.
          </p>
        </div>

        {/* ADD USER SIDE SHEET */}
        <Sheet>
          <SheetTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm text-xs px-4 h-10 flex items-center gap-1.5 font-bold transition-all">
              <UserPlus className="h-4 w-4" />
              Add New Member
            </Button>
          </SheetTrigger>
          <SheetContent className="px-5 rounded-l-2xl border-slate-200 gap-0">
            <SheetHeader className="pb-5 border-b border-slate-100">
              <SheetTitle className="text-sm font-bold text-slate-900">
                Add Team Member
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                Create a new account for a staff member. They can change this
                temporary password later.
              </SheetDescription>
            </SheetHeader>

            <form action={addTeamMember} className="space-y-5 mt-6">
              <div className="space-y-1.5">
                <Label
                  htmlFor="name"
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  Full Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="Jane Doe"
                  className="rounded-xl border-slate-200 text-xs h-10 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="jane@agency.com"
                  className="rounded-xl border-slate-200 text-xs h-10 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  Temporary Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="text"
                  required
                  placeholder="Temp123!"
                  className="rounded-xl border-slate-200 text-xs h-10 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                />
              </div>

              <SheetFooter className="border-t border-slate-100 pt-5 mt-8 flex gap-3 justify-end">
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl h-10 px-4 shadow-sm"
                >
                  Create Account
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* 2. TEAM MEMBERS LIST */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden gap-0">
        <CardHeader className="p-6 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800">
            Active Users
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            A list of all personnel with access to the dashboard.
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
                  Access Status
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3.5 text-right pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((member) => {
                const initials = member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .substring(0, 2);
                const avatarClass = getInitialsColor(member.name);

                return (
                  <TableRow
                    key={member.id}
                    className="hover:bg-slate-50/50 border-b border-slate-100/50 transition-colors"
                  >
                    <TableCell className="py-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs ${avatarClass}`}
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
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {member.email}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0">
                        <Shield className="h-3 w-3" />
                        Active Access
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6">
                      {/* DELETE USER CONFIRMATION MODAL */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 rounded-xl h-8 text-xs font-bold px-3 transition-all inline-flex items-center gap-1.5"
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
                              This will permanently delete{" "}
                              <span className="font-bold text-slate-800">
                                {member.name}'s
                              </span>{" "}
                              account and revoke their access to all alert
                              dashboards. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="pt-4 flex gap-3 justify-end">
                            <AlertDialogCancel className="text-xs rounded-xl h-10 px-4 border-slate-200 font-bold text-slate-600 hover:text-slate-800">
                              Cancel
                            </AlertDialogCancel>
                            <form
                              action={async () => {
                                "use server";
                                await deleteTeamMember(member.id, member.name);
                              }}
                            >
                              <AlertDialogAction
                                type="submit"
                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl h-10 px-4 shadow-sm"
                              >
                                Revoke Access
                              </AlertDialogAction>
                            </form>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
              {team.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-slate-400 font-medium text-xs py-10"
                  >
                    No team members registered yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
