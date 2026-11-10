import { describe, expect, it } from "vitest";
import { buildVacationApprovalMail } from "@/modules/notifications/application/vacation-approval-mail";

describe("vacation approval mail", () => {
  it("names the requester and links Approvals", () => {
    const message = buildVacationApprovalMail({
      requesterName: "Conny Friborg",
      approverEmails: ["sheet.infb@example.com"],
      requestId: "11111111-1111-4111-8111-111111111111",
      startDate: "2026-12-22",
      endDate: "2026-12-22",
      durationKind: "FULL_DAYS",
      workingDays: 1,
      reason: "Family",
      departmentLabel: "IN / INFB",
    });
    expect(message.to).toEqual(["sheet.infb@example.com"]);
    expect(message.subject).toContain("Conny Friborg");
    expect(message.text).toContain("Open Approvals:");
    expect(message.text).toContain("/approvals");
    expect(message.text).toContain("Family");
    expect(message.html).toContain("Conny Friborg");
  });
});
