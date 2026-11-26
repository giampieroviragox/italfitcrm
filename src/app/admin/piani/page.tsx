import { redirect } from "next/navigation";
// Plans now live with their client (Coaching online) or guided program.
export default function Page() {
  redirect("/admin/coaching-online");
}
