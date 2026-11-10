import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Vacation reviews now live with the other manager approvals. */
export default function VacationInboxPage() {
  redirect("/approvals");
}
