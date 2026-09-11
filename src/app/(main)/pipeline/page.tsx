import { redirect } from "next/navigation";

export default function PipelinePage() {
  redirect("/clients?view=contacts");
}
