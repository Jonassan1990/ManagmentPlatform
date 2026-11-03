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
        body: "On Organization pages, use View to browse hierarchy, people, projects, and initiatives. Switch to Config only when you need to create or edit structure.",
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
        id: "org-config",
        title: "Use Config mode",
        body: "In Config you add sections, departments (with an optional parent), teams, and people. In View you open a department to see its resources, projects, and initiatives.",
      },
      {
        id: "org-roles",
        title: "Give people access",
        body: "Admins assign roles such as Section manager (sees all departments under the section) or Department manager (own department, and can read parent department work).",
        href: "/organization",
        hrefLabel: "Organization hub",
      },
    ],
  },
  {
    id: "work",
    title: "3. Run initiatives and projects",
    summary: "One initiative journey from idea to delivery.",
    steps: [
      {
        id: "create-initiative",
        title: "Create an initiative",
        body: "Pick the owning department, then move through demand → requirements → pre-study → PoC / pilot → project as your process requires.",
        href: "/initiatives",
        hrefLabel: "Initiatives",
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
    title: "4. Plan capacity (PI)",
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
    title: "5. Approvals and decisions",
    summary: "Governance stays separate from day-to-day delivery lists.",
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
    id: "tips",
    title: "6. Simple habits",
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
