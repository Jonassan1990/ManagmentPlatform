import type { OnboardingPlanItem } from "./role-templates";

export const INFB_NEW_HIRE_TEMPLATE_KEY = "infb-new-hire";

export const ONBOARDING_PHASES = [
  "PREBOARDING",
  "FIRST_WEEK",
  "FIRST_30_DAYS",
  "FEEDBACK",
] as const;

export type OnboardingPhase = (typeof ONBOARDING_PHASES)[number];

export const PHASE_LABEL: Record<OnboardingPhase, string> = {
  PREBOARDING: "Preboarding",
  FIRST_WEEK: "First week",
  FIRST_30_DAYS: "First 30 days",
  FEEDBACK: "Feedback",
};

export const PHASE_HINT: Record<OnboardingPhase, string> = {
  PREBOARDING: "Finish these before the start date.",
  FIRST_WEEK: "The first days with the team.",
  FIRST_30_DAYS: "Meet the people and set up the work.",
  FEEDBACK: "The new hire answers these at the end.",
};

type SheetItem = OnboardingPlanItem & {
  phase: OnboardingPhase;
  assigneeLabel: string;
};

function task(
  phase: OnboardingPhase,
  title: string,
  assigneeLabel: string,
  description: string,
): SheetItem {
  return { phase, title, assigneeLabel, description };
}

export const INFB_NEW_HIRE_ITEMS: SheetItem[] = [
  task(
    "PREBOARDING",
    "Send welcome email",
    "Group Manager",
    "Include the first-day agenda.",
  ),
  task(
    "PREBOARDING",
    "Set up Outlook and account access",
    "Group Manager / HR",
    "Mailbox, permissions, and passwords.",
  ),
  task(
    "PREBOARDING",
    "Assign a buddy or mentor",
    "Group Manager / HR",
    "Write the buddy's name in the note.",
  ),
  task(
    "PREBOARDING",
    "Prepare hardware and software",
    "Group Manager / Team Leader",
    "Laptop, mail, and the software this role needs.",
  ),
  task(
    "FIRST_WEEK",
    "Add the new hire to team channels",
    "Group Manager / Team Leader",
    "Team chats and the channels they should follow.",
  ),
  task(
    "FIRST_WEEK",
    "Fill in the onboarding record",
    "Employee",
    "Department, product team, and the systems they will use.",
  ),
  task(
    "FIRST_WEEK",
    "Complete the office tour",
    "Group Manager",
    "Note the room or site.",
  ),
  task(
    "FIRST_WEEK",
    "Meet the group manager",
    "Group Manager",
    "Role expectations and how the team works.",
  ),
  task(
    "FIRST_WEEK",
    "Introduction to the team",
    "Group Manager",
    "During the first team meeting.",
  ),
  task(
    "FIRST_WEEK",
    "Scania Way introduction",
    "Employee",
    "Complete the Scania Way course.",
  ),
  task(
    "FIRST_WEEK",
    "Go through department culture and strategy",
    "Group Manager",
    "How this department works and what it owns.",
  ),
  task(
    "FIRST_WEEK",
    "VPN access",
    "Software Architect",
    "Mark the note if this does not apply.",
  ),
  task(
    "FIRST_WEEK",
    "Set the team mode in the VPN",
    "Software Architect",
    "The mode this team uses.",
  ),
  task(
    "FIRST_WEEK",
    "Give access to Git and TFS",
    "Software Architect",
    "Repositories this person will use.",
  ),
  task(
    "FIRST_30_DAYS",
    "Book a 1:1 with each software architect",
    "Employee",
    "Get to know the product scope.",
  ),
  task(
    "FIRST_30_DAYS",
    "Book a 1:1 with the product owner",
    "Employee",
    "Get to know the product scope.",
  ),
  task(
    "FIRST_30_DAYS",
    "Book a 1:1 with the release manager",
    "Employee",
    "How the team delivers work.",
  ),
  task(
    "FIRST_30_DAYS",
    "Book the second Do & See",
    "Employee",
    "If the person is in Sweden.",
  ),
  task(
    "FIRST_30_DAYS",
    "Book the third Do & See",
    "Employee",
    "If the person is in Sweden.",
  ),
  task(
    "FIRST_30_DAYS",
    "Book the fourth Do & See",
    "Employee",
    "If the person is in Sweden.",
  ),
  task(
    "FIRST_30_DAYS",
    "Go through the product documentation",
    "Employee",
    "The documents for the product they will join.",
  ),
  task(
    "FIRST_30_DAYS",
    "Product team onboarding workshop",
    "Software Architect / Product Owner",
    "The product this person will be assigned to.",
  ),
  task(
    "FIRST_30_DAYS",
    "Set up the portal",
    "Employee",
    "Explain the KPIs.",
  ),
  task(
    "FIRST_30_DAYS",
    "Set up Ignition",
    "Employee",
    "Local setup for the product tools.",
  ),
  task(
    "FIRST_30_DAYS",
    "Set up the local Git environment",
    "Employee",
    "Clone the repositories and make a first commit.",
  ),
  task(
    "FIRST_30_DAYS",
    "30-day check-in",
    "Group Manager / Team Leader",
    "Onboarding, training, and performance.",
  ),
  task(
    "FEEDBACK",
    "What was the most helpful part of onboarding?",
    "Employee",
    "A short answer from the new hire.",
  ),
  task(
    "FEEDBACK",
    "What could be improved?",
    "Employee",
    "A short answer from the new hire.",
  ),
  task(
    "FEEDBACK",
    "Do you feel confident in your role?",
    "Employee",
    "A short answer from the new hire.",
  ),
  task(
    "FEEDBACK",
    "Additional comments",
    "Employee",
    "Anything else worth keeping.",
  ),
];

export const INFB_NEW_HIRE_TEMPLATE = {
  key: INFB_NEW_HIRE_TEMPLATE_KEY,
  label: "INFB new hire",
  summary:
    "The INFB checklist: preboarding, the first week, the first 30 days, and feedback.",
  items: INFB_NEW_HIRE_ITEMS,
};
