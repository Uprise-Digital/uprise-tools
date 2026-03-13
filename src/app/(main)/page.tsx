import { redirect } from "next/navigation";

export default function HomePage() {
    // If the code reaches here, the layout.tsx has already confirmed they are authenticated.
    // We just instantly bounce them to the team page for now.
    redirect("/team");
}