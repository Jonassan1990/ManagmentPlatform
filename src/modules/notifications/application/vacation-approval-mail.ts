import { formatDateOnly } from "@/modules/vacation/application/working-days";
import {
  formatVacationAmount,
  formatVacationSpan,
  type VacationDurationKind,
  type VacationDayPart,
} from "@/modules/vacation/application/vacation-duration";
import { appBaseUrl, sendMail } from "./mail";

export function buildVacationApprovalMail(input: {
  requesterName: string;
  approverEmails: string[];
  requestId: string;
  startDate: Date | string;
  endDate: Date | string;
  durationKind: VacationDurationKind;
  dayPart?: VacationDayPart | null;
  hours?: number | null;
  workingDays: number;
  reason: string | null;
  departmentLabel?: string | null;
}) {
  const when = formatVacationSpan(
    input.startDate,
    input.endDate,
    input.durationKind,
  );
  const amount = formatVacationAmount({
    durationKind: input.durationKind,
    workingDays: input.workingDays,
    hours: input.hours,
    dayPart: input.dayPart,
  });
  const link = `${appBaseUrl()}/approvals`;
  const planLink = `${appBaseUrl()}/vacation/${input.requestId}`;
  const subject = `Vacation to approve: ${input.requesterName} · ${when}`;
  const lines = [
    `${input.requesterName} asked for vacation.`,
    "",
    `When: ${when}`,
    `Length: ${amount}`,
    input.departmentLabel ? `Where: ${input.departmentLabel}` : null,
    input.reason ? `Reason: ${input.reason}` : null,
    "",
    `Open Approvals: ${link}`,
    `Open the request: ${planLink}`,
  ].filter((line): line is string => line !== null);

  return {
    to: input.approverEmails,
    subject,
    text: lines.join("\n"),
    html: `<p><strong>${escapeHtml(input.requesterName)}</strong> asked for vacation.</p>
<p>When: ${escapeHtml(when)}<br/>Length: ${escapeHtml(amount)}
${input.departmentLabel ? `<br/>Where: ${escapeHtml(input.departmentLabel)}` : ""}
${input.reason ? `<br/>Reason: ${escapeHtml(input.reason)}` : ""}</p>
<p><a href="${escapeHtml(link)}">Open Approvals</a> · <a href="${escapeHtml(planLink)}">Open the request</a></p>`,
  };
}

export async function notifyVacationApprovers(input: {
  requesterName: string;
  approvers: Array<{ email: string | null | undefined; displayName: string }>;
  requestId: string;
  startDate: Date | string;
  endDate: Date | string;
  durationKind: VacationDurationKind;
  dayPart?: VacationDayPart | null;
  hours?: number | null;
  workingDays: number;
  reason: string | null;
  departmentLabel?: string | null;
}) {
  const emails = input.approvers
    .map((approver) => approver.email?.trim())
    .filter((email): email is string => Boolean(email));
  if (emails.length === 0) {
    console.info("[mail] vacation approval has no manager email", {
      requestId: input.requestId,
      approvers: input.approvers.map((row) => row.displayName),
    });
    return { ok: false as const, error: "No manager email" };
  }
  const message = buildVacationApprovalMail({
    ...input,
    approverEmails: emails,
  });
  return sendMail(message);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Stable helper for tests that prefer ISO dates. */
export function mailDateLabel(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return formatDateOnly(value);
}
