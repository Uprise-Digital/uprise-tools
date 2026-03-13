import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {addTeamMember, deleteTeamMember, getTeamMembers} from "@/actions/team.actions";

export default async function TeamManagementPage() {
    const team = await getTeamMembers();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
                    <p className="text-muted-foreground">Manage your agency staff and their access to alerts.</p>
                </div>

                {/* ADD USER SIDE SHEET */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button>Add New Member</Button>
                    </SheetTrigger>
                    <SheetContent className={"px-4"}>
                        <SheetHeader>
                            <SheetTitle>Add Team Member</SheetTitle>
                            <SheetDescription>
                                Create a new account for a staff member. They can change this temporary password later.
                            </SheetDescription>
                        </SheetHeader>
                        <form action={addTeamMember} className="space-y-6 mt-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" name="name" required placeholder="Jane Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input id="email" name="email" type="email" required placeholder="jane@agency.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Temporary Password</Label>
                                <Input id="password" name="password" type="text" required placeholder="Temp123!" />
                            </div>
                            <SheetFooter>
                                <SheetClose asChild>
                                    <Button type="button" variant="outline">Cancel</Button>
                                </SheetClose>
                                <Button type="submit">Create Account</Button>
                            </SheetFooter>
                        </form>
                    </SheetContent>
                </Sheet>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Users</CardTitle>
                    <CardDescription>A list of all personnel with access to the dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {team.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell className="font-medium">{member.name}</TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell className="text-right">

                                        {/* DELETE USER CONFIRMATION MODAL */}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm">Remove Access</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete {member.name}'s account and remove their access to all alert dashboards. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <form action={async () => {
                                                        "use server";
                                                        await deleteTeamMember(member.id, member.name);
                                                    }}>
                                                        <AlertDialogAction type="submit" className="bg-red-600 hover:bg-red-700">
                                                            Yes, delete account
                                                        </AlertDialogAction>
                                                    </form>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                    </TableCell>
                                </TableRow>
                            ))}
                            {team.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                                        No team members found.
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