import { redirect } from "next/navigation";

/** Legacy User guide URL — Help MDX lives under /help. */
export default function UserGuideRedirectPage() {
  redirect("/help/user-guide");
}
