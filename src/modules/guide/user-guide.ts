/**
 * Single product user guide — content for /guide.
 * Keep steps short and manager-friendly (docs/UX-PRINCIPLES.md).
 */

export type GuideStep = {
  id: string;
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
};

export type GuideSection = {
  id: string;
  title: string;
  summary: string;
  steps: GuideStep[];
};

export const USER_GUIDE_INTRO = {
  title: "User guide",
  tagline: "How to use the Management Platform in a few clear steps.",
  audience:
    "Built for managers and teams: set up the organization, run initiatives and projects, plan capacity, and govern decisions — without mixing browse and setup.",
};

export const USER_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "start",
    title: "1. Start here",
    summary: "Sign in, then use Home for what needs attention.",
    steps: [
      {
        id: "sign-in",
        title: "Sign in",
        body: "Open the app and sign in with your account. Home shows only what your role is allowed to see.",
        href: "/",
        hrefLabel: "Go to Home",
      },
      {
        id: "view-vs-config",
        title: "View vs Config",
        body: "On Organization pages, use View to browse hierarchy, people, projects, and initiatives. Switch to Config only when you need to create or edit structure. Organization admins can also use Admin config for the full setup in one place.",
        href: "/organization",
        hrefLabel: "Open Organization",
      },
    ],
  },
  {
    id: "organization",
    title: "2. Build the organization",
    summary: "Same hierarchy for everyone: Organization → Section → Department → Team.",
    steps: [
      {
        id: "org-tree",
        title: "Create the tree",
        body: "Example: Organization I, Section IN, Departments INF / ING / INA, then child departments such as INFB under INF. Put working groups as Teams under a department.",
        href: "/organization",
        hrefLabel: "Organization structure",
      },
      {
        id: "org-admin-config",
        title: "Use Admin config",
        body: "Open Admin → Admin config to confirm each person has a department, role, and login; build the hierarchy; place people; and assign role packs without jumping between pages.",
        href: "/admin",
        hrefLabel: "Admin config",
      },
      {
        id: "org-config",
        title: "Use Config mode",
        body: "In Config you add sections, departments (with an optional parent), teams, and people. In View you open a department to see its resources, projects, and initiatives.",
      },
      {
        id: "org-roles",
        title: "Give people access",
        body: "Admins assign roles such as Section manager (sees all departments under the section) or Department manager (own department, and can read parent department work).",
        href: "/admin",
        hrefLabel: "Admin config · Roles",
      },
    ],
  },
  {
    id: "people",
    title: "3. People",
    summary: "Vacation and onboarding live in one People section.",
    steps: [
      {
        id: "vacation",
        title: "Vacation management",
        body: "Request time off, review as a manager, and check calendar/year views.",
        href: "/vacation",
        hrefLabel: "Vacation",
      },
      {
        id: "onboarding-ai",
        title: "Onboarding with AI help",
        body: "Managers pick a role from the role catalog, let AI draft the steps, edit the draft, then create the checklist. Employee and onboarder both confirm.",
        href: "/onboarding",
        hrefLabel: "Onboarding",
      },
    ],
  },
  {
    id: "work",
    title: "4. Delivery — idea to product",
    summary: "One road map with Go / No go at every step, plus capacity and dependencies.",
    steps: [
      {
        id: "delivery-roadmap",
        title: "Open the Delivery road map",
        body: "Idea → Requirements → Pre-study → Governance → PoC → Pilot → Project → Roles & governance → Product. Each step states what Go and No go mean.",
        href: "/delivery",
        hrefLabel: "Delivery",
      },
      {
        id: "create-initiative",
        title: "Create an initiative",
        body: "Pick the owning department, then move through the road map. Formal gates record Go, Conditional go, No go, Hold, Scale, or Stop.",
        href: "/initiatives",
        hrefLabel: "Initiatives",
      },
      {
        id: "capacity-deps",
        title: "Check load and dependencies",
        body: "Use Planning → Capacity & workload for allocations, and Dependencies & health for cross-functional blockers.",
        href: "/portfolio/capacity",
        hrefLabel: "Capacity & workload",
      },
      {
        id: "department-hub",
        title: "Work from a department",
        body: "Open a department in View to see its people, projects, and initiatives in one place, then drill into details.",
      },
      {
        id: "portfolio",
        title: "See the big picture",
        body: "Portfolio Overview shows attention and status. Find work searches across initiatives and projects. Health and Capacity show delivery and load.",
        href: "/portfolio",
        hrefLabel: "Portfolio",
      },
    ],
  },
  {
    id: "planning",
    title: "5. Plan capacity (PI)",
    summary: "Program Increments help teams allocate work without overloading people.",
    steps: [
      {
        id: "open-pi",
        title: "Open PI Planning",
        body: "Create or open a Program Increment, then use the board, capacity, and review screens for that PI.",
        href: "/pi",
        hrefLabel: "PI Planning",
      },
      {
        id: "capacity",
        title: "Check load",
        body: "Use Capacity (under Portfolio) for a cross-team view of who is overloaded and where work depends on others.",
        href: "/portfolio/capacity",
        hrefLabel: "Capacity",
      },
    ],
  },
  {
    id: "governance",
    title: "6. Approvals and decisions",
    summary: "Governance decisions also appear under Delivery; use these inboxes for review work.",
    steps: [
      {
        id: "approvals",
        title: "Approvals",
        body: "If your role can review, open Approvals for items waiting on you.",
        href: "/approvals",
        hrefLabel: "Approvals",
      },
      {
        id: "decisions",
        title: "Decisions",
        body: "Record and track decisions that unlock the next stage of an initiative.",
        href: "/decisions",
        hrefLabel: "Decisions",
      },
    ],
  },
  {
    id: "demo",
    title: "6. Manager demo (Industrial IT)",
    summary:
      "A structured walkthrough for showing managers the real org codes (I → IN → INF/INFB/INFF/ING/INA) with a clearer industrial-IT portfolio.",
    steps: [
      {
        id: "seed",
        title: "Seed Organization I",
        body: "Run npm run demo:seed-it (or set DEMO_SEED_IT=1 on Vercel once). Creates I — Industrial IT with section IN, departments INF→INFB/INFF, ING, INA, people, and a five-stage portfolio.",
      },
      {
        id: "walkthrough",
        title: "Suggested manager path",
        body: "1) Simulate Section (IN) for the overview. 2) Open INFB — Business apps. 3) Open project PROJ-IT-01 Maintenance work-order mobile app — show milestones, budget, issues, and work. 4) Switch to INF to show the identity pre-study. 5) Switch to INA/ING to show demand vs PoC scopes.",
        href: "/organization",
        hrefLabel: "Open Organization",
      },
      {
        id: "portfolio",
        title: "What is in the portfolio",
        body: "INA Demand: digital work instructions. INF Pre-study: identity & access upgrade (assessments + alternatives). ING PoC: zero-trust remote admin. INFF Requirements: plant master-data sync hub. INFB Project: maintenance work-order mobile app (flagship).",
        href: "/portfolio",
        hrefLabel: "Open Portfolio",
      },
      {
        id: "switcher",
        title: "Use the level dropdown",
        body: "With ALLOW_DEMO_PERSONA_SWITCH=1 (or local DEV auth), sign in then pick Organization, Section IN, INF, INFB, ING, INA, or Viewer to show what each manager can see.",
      },
      {
        id: "logins",
        title: "Or sign in as a demo user",
        body: "Local usernames demo.orgadmin, demo.inmanager, demo.infmanager, demo.infbmanager, demo.ingmanager, demo.inamanager, demo.viewer — password DemoLevel2026!",
      },
    ],
  },
  {
    id: "onboarding",
    title: "7. Onboarding checklist",
    summary:
      "New employee and onboarder must both check every item. Official pass only when both sides are complete.",
    steps: [
      {
        id: "start",
        title: "Start a checklist",
        body: "Managers open Onboarding, pick a role from the role catalog, draft with AI, edit the steps, then assign the employee and onboarder.",
        href: "/onboarding",
        hrefLabel: "Onboarding",
      },
      {
        id: "dual",
        title: "Both must check",
        body: "Each item has an Employee check and an Onboarder check. An item is complete only when both are ticked. When every item is dual-checked, status becomes Officially passed.",
      },
    ],
  },
  {
    id: "vacation",
    title: "8. Vacation requests",
    summary:
      "Employees request time off; managers accept, reject, or ask for changes. Approved days show on the calendar and yearly totals, with a full audit table.",
    steps: [
      {
        id: "request",
        title: "Submit a request",
        body: "Open Vacation → My requests, pick dates and optional reason, then submit. Working days (Mon–Fri) are counted automatically.",
        href: "/vacation",
        hrefLabel: "My vacation",
      },
      {
        id: "manager",
        title: "Manager review",
        body: "Section and department managers use Vacation → Manager inbox to Accept, Reject, or Ask for changes (comment required for reject/changes).",
        href: "/vacation/inbox",
        hrefLabel: "Manager inbox",
      },
      {
        id: "calendar-year",
        title: "Calendar and year view",
        body: "Approved vacations appear on the month calendar. By year shows each person’s approved working-day total. Open a request to see the audit history table.",
        href: "/vacation/calendar",
        hrefLabel: "Calendar",
      },
    ],
  },
  {
    id: "tips",
    title: "9. Simple habits",
    summary: "Keep the product calm and clear.",
    steps: [
      {
        id: "level",
        title: "Stay at your level",
        body: "Section managers start at the section overview and deep-dive. Department managers live in their department View, and can open parent department initiatives when needed.",
      },
      {
        id: "empty",
        title: "Empty means not set up yet",
        body: "The platform never invents fake departments or projects. If a list is empty, use Config (if you can) or ask an admin to finish setup.",
      },
      {
        id: "help-again",
        title: "Come back to this guide",
        body: "Help → User guide is always in the sidebar when you need a refresher.",
        href: "/guide",
        hrefLabel: "This guide",
      },
    ],
  },
];
