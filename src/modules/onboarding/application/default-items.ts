/** Dual-ack onboarding journey: equipment, product, team, documents, tasks, confirmation. */
export const DEFAULT_ONBOARDING_ITEMS: Array<{
  title: string;
  description: string;
}> = [
  {
    title: "Laptop setup",
    description:
      "The new employee has a working laptop. The employee confirms it is usable, and the onboarder confirms it was handed over.",
  },
  {
    title: "Network access",
    description:
      "The employee can join company Wi-Fi and VPN. Both confirm a successful connection.",
  },
  {
    title: "Email account",
    description:
      "The company email account exists and the employee can send and receive mail. Both confirm it works.",
  },
  {
    title: "Software installation",
    description:
      "The tools for the role are installed. The employee confirms they open, and the onboarder confirms the list is complete.",
  },
  {
    title: "Access to internal systems",
    description:
      "Required internal systems and platforms are granted. Both confirm the employee can sign in.",
  },
  {
    title: "Product they will work on",
    description:
      "Walk through the product, who uses it, and the part this role owns. Both confirm the employee can explain that focus.",
  },
  {
    title: "Book interviews with the team",
    description:
      "Meetings are booked with teammates and the people this role depends on. Both confirm the invites are on the calendar.",
  },
  {
    title: "Read focus-area documents",
    description:
      "The employee reads the documents for their focus area. Both confirm the reading is done and open questions are noted.",
  },
  {
    title: "Introduction to the team",
    description:
      "The booked conversations happen and the employee meets the team and key stakeholders. Both confirm the introductions.",
  },
  {
    title: "Agree role and first goals",
    description:
      "Responsibilities and the first goals are agreed with the manager. Both confirm the goals are written down.",
  },
  {
    title: "Review the onboarding schedule",
    description:
      "Walk through the remaining onboarding days and check-ins. Both confirm the schedule is understood.",
  },
  {
    title: "Initial training",
    description:
      "The first training for the role is scheduled and attended. Both confirm attendance.",
  },
  {
    title: "Shadow the team at work",
    description:
      "The employee sits with the team on real work in the focus area. Both confirm what was observed.",
  },
  {
    title: "Start getting tasks",
    description:
      "The first tasks are assigned from the team's backlog. Both confirm the employee has started them and knows who to ask.",
  },
  {
    title: "Onboarding confirmation",
    description:
      "Employee and onboarder both confirm onboarding is complete and the employee can continue with normal work.",
  },
];

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titlesAlign(left: string, right: string): boolean {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const words = (value: string) =>
    new Set(value.split(" ").filter((word) => word.length > 3));
  const leftWords = words(a);
  const overlap = [...words(b)].filter((word) => leftWords.has(word)).length;
  return overlap >= 2;
}

/**
 * Keep the full journey even when the model returns only the early setup steps.
 * Matching steps keep the model's description. Missing steps stay in order.
 */
export function alignOnboardingPlan(
  generated: Array<{ title: string; description: string }>,
  required: Array<{ title: string; description: string }> = DEFAULT_ONBOARDING_ITEMS,
): Array<{ title: string; description: string }> {
  const used = new Set<number>();
  const aligned = required.map((requiredItem) => {
    const index = generated.findIndex(
      (item, itemIndex) =>
        !used.has(itemIndex) && titlesAlign(item.title, requiredItem.title),
    );
    if (index === -1) return requiredItem;
    used.add(index);
    const description = generated[index]?.description.trim();
    return {
      title: requiredItem.title,
      description: description || requiredItem.description,
    };
  });
  const extras = generated.filter((_, index) => !used.has(index));
  const confirmAt = aligned.findIndex((item) =>
    /confirm/i.test(item.title),
  );
  if (confirmAt === -1 || extras.length === 0) {
    return [...aligned, ...extras];
  }
  return [
    ...aligned.slice(0, confirmAt),
    ...extras,
    ...aligned.slice(confirmAt),
  ];
}
