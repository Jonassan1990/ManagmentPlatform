import { DEFAULT_ONBOARDING_ITEMS } from "./default-items";

export type OnboardingPlanItem = {
  title: string;
  description: string;
};

export type OnboardingRoleTemplate = {
  key: string;
  label: string;
  summary: string;
  items: OnboardingPlanItem[];
};

const START_TASKS = "Start getting tasks";

function buildTemplate(
  overrides: Partial<Record<string, string>>,
  extras: OnboardingPlanItem[],
): OnboardingPlanItem[] {
  const items = DEFAULT_ONBOARDING_ITEMS.map((item) => ({
    title: item.title,
    description: overrides[item.title] ?? item.description,
  }));
  const insertAt = items.findIndex((item) => item.title === START_TASKS);
  const at = insertAt === -1 ? items.length - 1 : insertAt;
  items.splice(at, 0, ...extras);
  return items;
}

export const ONBOARDING_ROLE_TEMPLATES: OnboardingRoleTemplate[] = [
  {
    key: "engineer",
    label: "Engineer",
    summary: "Product code, development environment, and a first code change.",
    items: buildTemplate(
      {
        "Product they will work on":
          "Walk through the product the engineer will change, who uses it, and the services this role owns. Both confirm the engineer can explain that focus.",
        "Read focus-area documents":
          "The engineer reads the architecture notes and coding standards for the focus area. Both confirm the reading is done.",
        "Start getting tasks":
          "The first engineering tasks are taken from the team backlog. Both confirm the engineer has started and knows who to ask.",
      },
      [
        {
          title: "Set up the development environment",
          description:
            "Repository access, local build, and the engineer toolchain work. Both confirm a successful build or test run.",
        },
        {
          title: "Pair on a first code change",
          description:
            "The engineer pairs with a teammate on a small change in the focus area. Both confirm the change was understood.",
        },
      ],
    ),
  },
  {
    key: "analyst",
    label: "Analyst",
    summary: "Data sources, definitions, and a first analysis.",
    items: buildTemplate(
      {
        "Product they will work on":
          "Walk through the product the analyst will measure, the decisions it supports, and the questions this role owns. Both confirm that focus.",
        "Read focus-area documents":
          "The analyst reads the metric definitions and source notes for the focus area. Both confirm open questions are written down.",
        "Start getting tasks":
          "The first analysis tasks are assigned. Both confirm the analyst has started and knows the data owner.",
      },
      [
        {
          title: "Open data sources and reports",
          description:
            "The analyst can open the data sources and current reports for the focus area. Both confirm access works.",
        },
        {
          title: "Review a recent analysis",
          description:
            "The analyst reviews a recent analysis with the team and can explain the conclusion. Both confirm the review.",
        },
      ],
    ),
  },
  {
    key: "technician",
    label: "Technician",
    summary: "Tools, site safety, and a first live job.",
    items: buildTemplate(
      {
        "Product they will work on":
          "Walk through the equipment or product the technician will work on and the failures this role handles. Both confirm that focus.",
        "Read focus-area documents":
          "The technician reads the operating procedures and safety notes for the focus area. Both confirm the reading.",
        "Start getting tasks":
          "The first technician jobs are assigned. Both confirm the technician has started and knows the escalation path.",
      },
      [
        {
          title: "Confirm tools and site safety",
          description:
            "Tools, badge, and site safety access are in place. Both confirm the technician can enter the workplace and use the tools.",
        },
        {
          title: "Shadow a live job",
          description:
            "The technician shadows a live job in the focus area. Both confirm what was done and which checks matter.",
        },
      ],
    ),
  },
  {
    key: "coordinator",
    label: "Coordinator",
    summary: "Planning board, cadence, and cross-team dependencies.",
    items: buildTemplate(
      {
        "Product they will work on":
          "Walk through the work the coordinator will schedule, the teams involved, and the handoffs this role owns. Both confirm that focus.",
        "Read focus-area documents":
          "The coordinator reads the delivery rhythm, RACI, and open dependency list. Both confirm the reading.",
        "Start getting tasks":
          "The first coordination tasks are assigned. Both confirm the coordinator has started them.",
      },
      [
        {
          title: "Open the planning board",
          description:
            "The coordinator can open the planning board and the team calendar. Both confirm access and the meeting cadence.",
        },
        {
          title: "Map cross-team dependencies",
          description:
            "The coordinator lists the current cross-team dependencies for the focus area. Both confirm the list is shared.",
        },
      ],
    ),
  },
  {
    key: "specialist",
    label: "Specialist",
    summary: "Knowledge base, standards, and a first specialist question.",
    items: buildTemplate(
      {
        "Product they will work on":
          "Walk through the product area the specialist will advise on and the decisions this role owns. Both confirm that focus.",
        "Read focus-area documents":
          "The specialist reads the standards and past decisions for the focus area. Both confirm the reading.",
        "Start getting tasks":
          "The first specialist tasks are assigned. Both confirm the specialist has started and knows the requester.",
      },
      [
        {
          title: "Open the specialist knowledge base",
          description:
            "The specialist can open the knowledge base and standards for the focus area. Both confirm access.",
        },
        {
          title: "Review an open specialist question",
          description:
            "The specialist reviews one open question with the team. Both confirm the recommendation is understood.",
        },
      ],
    ),
  },
  {
    key: "manager",
    label: "Manager",
    summary: "Team goals, 1:1s, and the first decisions to own.",
    items: buildTemplate(
      {
        "Product they will work on":
          "Walk through the products and services the manager's team owns. Both confirm the manager can name the focus and the stakeholders.",
        "Book interviews with the team":
          "1:1s and stakeholder meetings are booked. Both confirm the invites are on the calendar.",
        "Read focus-area documents":
          "The manager reads the department plan, open risks, and decision log. Both confirm the reading.",
        "Start getting tasks":
          "The first management tasks are assigned, including decisions and delegation. Both confirm the manager has started.",
      },
      [
        {
          title: "Review team goals and open work",
          description:
            "The manager reviews team goals and the open work list with the onboarder. Both confirm the picture is current.",
        },
        {
          title: "Book 1:1s with the team",
          description:
            "A first 1:1 is booked with each person the manager leads. Both confirm the invites.",
        },
      ],
    ),
  },
];

export function getOnboardingRoleTemplate(key: string | null | undefined) {
  if (!key) return null;
  return (
    ONBOARDING_ROLE_TEMPLATES.find((template) => template.key === key) ?? null
  );
}
