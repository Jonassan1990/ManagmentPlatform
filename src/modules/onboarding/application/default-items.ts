/** Default dual-ack onboarding steps for a new employee. */
export const DEFAULT_ONBOARDING_ITEMS: Array<{
  title: string;
  description: string;
}> = [
  {
    title: "Workplace & equipment ready",
    description:
      "Desk/laptop/badge ready. Employee confirms received; onboarder confirms provided.",
  },
  {
    title: "Accounts & system access",
    description:
      "Email, SSO, and required apps work. Both confirm access is correct and usable.",
  },
  {
    title: "Security & compliance briefing",
    description:
      "Policies explained and acknowledged. Employee attended; onboarder confirms completion.",
  },
  {
    title: "Team introduction",
    description:
      "Met manager, team, and key contacts. Both confirm introductions happened.",
  },
  {
    title: "Role & expectations reviewed",
    description:
      "Job responsibilities and first goals discussed. Both agree expectations are clear.",
  },
  {
    title: "First-week plan agreed",
    description:
      "Concrete first-week tasks and check-in times set. Both confirm the plan.",
  },
];
