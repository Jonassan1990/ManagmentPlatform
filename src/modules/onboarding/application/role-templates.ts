import {
  FUNCTION_ROLES,
  isFunctionRoleLabel,
  type FunctionRoleLabel,
} from "@/modules/organization/domain/function-roles";
import { DEFAULT_ONBOARDING_ITEMS } from "./default-items";
import { INFB_NEW_HIRE_TEMPLATE } from "./infb-new-hire-template";

export type OnboardingPlanItem = {
  title: string;
  description: string;
  phase?: "PREBOARDING" | "FIRST_WEEK" | "FIRST_30_DAYS" | "FEEDBACK";
  assigneeLabel?: string;
};

export type OnboardingRoleTemplate = {
  key: string;
  label: string;
  summary: string;
  items: OnboardingPlanItem[];
};

const START_TASKS = "Start getting tasks";

export type RoleFamily =
  | "manager"
  | "product"
  | "architect"
  | "developer"
  | "tester"
  | "analyst"
  | "infrastructure"
  | "security"
  | "lead";

const ROLE_FAMILY: Record<FunctionRoleLabel, RoleFamily> = {
  "Senior Manager": "manager",
  Manager: "manager",
  "Product Manager": "product",
  "Product Owner": "product",
  "Technical Product Owner": "product",
  "Scrum Master": "product",
  "Project Manager": "product",
  "IT Program & Project Manager": "product",
  "Enterprise Architect": "architect",
  "Business Architect": "architect",
  "Solution Architect": "architect",
  "Lead Solution Architect": "architect",
  "Infrastructure Architect": "architect",
  "Integration Architect": "architect",
  "System Architect": "architect",
  "Software Architect": "architect",
  "ERP Solution Architect": "architect",
  "SAP Architect": "architect",
  Developer: "developer",
  "Software Developer": "developer",
  "Integration Developer": "developer",
  "Front End Developer": "developer",
  DevOps: "developer",
  "IT Developer": "developer",
  "Business IT Solution Developer": "developer",
  Tester: "tester",
  "Test Engineer": "tester",
  "IT Business Analyst": "analyst",
  "System Analyst": "analyst",
  "Business IT Analyst": "analyst",
  "ERP Functional Analyst": "analyst",
  "SAP Analyst": "analyst",
  "Requirements Analyst": "analyst",
  "Data Engineer": "developer",
  "Data Scientist": "analyst",
  "Infrastructure Engineer": "infrastructure",
  "Infrastructure Specialist": "infrastructure",
  "Network Technician": "infrastructure",
  "IT Technician": "infrastructure",
  "IT Support Specialist": "infrastructure",
  "IT Service Manager": "manager",
  "Service Delivery Manager": "manager",
  "Service Manager": "manager",
  "IT Security Specialist": "security",
  "IT Security Coordinator": "security",
  "IAM Specialist": "security",
  "Information Manager": "manager",
  "Information Risk and Compliance Officer": "security",
  "Portfolio Manager": "manager",
  "Business Relationship Manager": "manager",
  "Contract Manager": "manager",
  "Software Asset Manager": "manager",
  "System Responsible": "lead",
  "Tech Lead": "lead",
  "Technical Lead": "lead",
  "IT Consultant": "lead",
};

const FAMILY_SUMMARY: Record<RoleFamily, string> = {
  manager: "Team goals, stakeholders, and the first decisions to own.",
  product: "Backlog, cadence, and the product decisions this role owns.",
  architect: "Standards, decisions, and the architecture this role steers.",
  developer: "Product code, development environment, and a first change.",
  tester: "Test environments, quality notes, and a first defect.",
  analyst: "Sources, definitions, and a first analysis.",
  infrastructure: "Tools, access, and a first live job.",
  security: "Access, controls, and a first security question.",
  lead: "Team direction, technical decisions, and the first work to own.",
};

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

function templateFor(label: FunctionRoleLabel): OnboardingPlanItem[] {
  const family = ROLE_FAMILY[label];
  const focus: Record<RoleFamily, string> = {
    manager: `the products and services the ${label}'s team owns`,
    product: `the product the ${label} will steer and the decisions this role owns`,
    architect: `the systems the ${label} will shape and the decisions this role owns`,
    developer: `the product the ${label} will change and the services this role owns`,
    tester: `the product the ${label} will verify and the quality risks this role owns`,
    analyst: `the product the ${label} will measure and the questions this role owns`,
    infrastructure: `the equipment and services the ${label} will run`,
    security: `the systems the ${label} will protect and the controls this role owns`,
    lead: `the product area the ${label} will lead and the decisions this role owns`,
  };
  const reading: Record<RoleFamily, string> = {
    manager: `The ${label} reads the department plan, open risks, and decision log.`,
    product: `The ${label} reads the delivery rhythm, backlog, and open dependency list.`,
    architect: `The ${label} reads the standards, target architecture, and past decisions.`,
    developer: `The ${label} reads the architecture notes and coding standards for the focus area.`,
    tester: `The ${label} reads the test strategy and known defects for the focus area.`,
    analyst: `The ${label} reads the metric definitions and source notes for the focus area.`,
    infrastructure: `The ${label} reads the operating procedures and safety notes for the focus area.`,
    security: `The ${label} reads the security standards and open findings for the focus area.`,
    lead: `The ${label} reads the team plan, open risks, and technical decision log.`,
  };
  const extras: Record<RoleFamily, OnboardingPlanItem[]> = {
    manager: [
      {
        title: "Review team goals and open work",
        description: `The ${label} reviews team goals and the open work list with the onboarder. Both confirm the picture is current.`,
      },
      {
        title: "Book 1:1s with the team",
        description: `A first 1:1 is booked with each person the ${label} leads. Both confirm the invites.`,
      },
    ],
    product: [
      {
        title: "Open the planning board",
        description: `The ${label} can open the planning board and the team calendar. Both confirm access and the meeting cadence.`,
      },
      {
        title: "Map cross-team dependencies",
        description: `The ${label} lists the current cross-team dependencies for the focus area. Both confirm the list is shared.`,
      },
    ],
    architect: [
      {
        title: "Open the architecture knowledge base",
        description: `The ${label} can open the standards and decision log for the focus area. Both confirm access.`,
      },
      {
        title: "Review an open architecture decision",
        description: `The ${label} reviews one open decision with the team. Both confirm the recommendation is understood.`,
      },
    ],
    developer: [
      {
        title: "Set up the development environment",
        description: `Repository access, local build, and the ${label} toolchain work. Both confirm a successful build or test run.`,
      },
      {
        title: "Pair on a first code change",
        description: `The ${label} pairs with a teammate on a small change in the focus area. Both confirm the change was understood.`,
      },
    ],
    tester: [
      {
        title: "Open the test environments",
        description: `The ${label} can open the test environments and current reports. Both confirm access.`,
      },
      {
        title: "Review an open defect",
        description: `The ${label} reviews one open defect with the team. Both confirm the expected check.`,
      },
    ],
    analyst: [
      {
        title: "Open data sources and reports",
        description: `The ${label} can open the data sources and current reports for the focus area. Both confirm access works.`,
      },
      {
        title: "Review a recent analysis",
        description: `The ${label} reviews a recent analysis with the team and can explain the conclusion. Both confirm the review.`,
      },
    ],
    infrastructure: [
      {
        title: "Confirm tools and site access",
        description: `Tools, badge, and site access are in place. Both confirm the ${label} can reach the workplace and use the tools.`,
      },
      {
        title: "Shadow a live job",
        description: `The ${label} shadows a live job in the focus area. Both confirm what was done and which checks matter.`,
      },
    ],
    security: [
      {
        title: "Confirm security tools and access",
        description: `The ${label} can open the security tools and the current findings list. Both confirm access.`,
      },
      {
        title: "Review an open security question",
        description: `The ${label} reviews one open finding with the team. Both confirm the recommended control.`,
      },
    ],
    lead: [
      {
        title: "Review team goals and open work",
        description: `The ${label} reviews team goals and the open work list with the onboarder. Both confirm the picture is current.`,
      },
      {
        title: "Agree the first technical decision",
        description: `The ${label} walks through one open technical decision with the team. Both confirm who owns the next step.`,
      },
    ],
  };

  return buildTemplate(
    {
      "Product they will work on": `Walk through ${focus[family]}. Both confirm the ${label} can explain that focus.`,
      "Read focus-area documents": `${reading[family]} Both confirm the reading is done.`,
      "Start getting tasks": `The first tasks for the ${label} are assigned. Both confirm the work has started and who to ask.`,
      "Book interviews with the team": `Meetings are booked with teammates and the people the ${label} depends on. Both confirm the invites are on the calendar.`,
    },
    extras[family],
  );
}

export const ONBOARDING_ROLE_TEMPLATES: OnboardingRoleTemplate[] =
  FUNCTION_ROLES.map((role) => ({
    key: role.key,
    label: role.label,
    summary: FAMILY_SUMMARY[ROLE_FAMILY[role.label]],
    items: templateFor(role.label),
  }));

export function functionRoleFamily(label: string): RoleFamily | null {
  if (!isFunctionRoleLabel(label)) return null;
  return ROLE_FAMILY[label];
}

export function getOnboardingRoleTemplate(key: string | null | undefined) {
  if (!key) return null;
  if (key === INFB_NEW_HIRE_TEMPLATE.key) return INFB_NEW_HIRE_TEMPLATE;
  return (
    ONBOARDING_ROLE_TEMPLATES.find((template) => template.key === key) ?? null
  );
}
