import type { RoleFamily } from "@/modules/onboarding/application/role-templates";
import { functionRoleFamily } from "@/modules/onboarding/application/role-templates";
import type { VacationVisibilityFilter } from "./vacation-visibility";
import { formatDateOnly, toUtcDateOnly } from "./working-days";

const FAMILY_LABEL: Record<RoleFamily, string> = {
  developer: "Developers",
  tester: "Testers",
  analyst: "Analysts",
  architect: "Architects",
  infrastructure: "Infrastructure",
  security: "Security",
  manager: "Managers",
  product: "Product roles",
  lead: "Leads",
};

export type CoveragePerson = {
  principalId: string;
  displayName: string;
  departmentId: string;
  departmentName: string;
  role: string;
};

export type CoverageAbsence = {
  principalId: string;
  departmentId: string | null;
  startDate: string;
  endDate: string;
  durationKind: "FULL_DAYS" | "HALF_DAY" | "HOURS";
  status: "APPROVED" | "SUBMITTED" | "CHANGES_REQUESTED";
};

export type RoleCoverageGap = {
  departmentId: string;
  departmentName: string;
  role: string;
  kind: "role" | "family";
  people: number;
  names: string[];
  startDate: string;
  endDate: string;
  /** True when someone in the gap is still waiting for approval. */
  waiting: boolean;
};

/**
 * A department role is fully away on a weekday when every person with that
 * role has an approved or waiting full-day vacation. Half days and hours
 * leave part of the day covered, so they do not count.
 * Developer, Software Developer, and the other developer titles also roll
 * up as Developers when more than one title is present.
 */
export function departmentRoleCoverage(input: {
  people: CoveragePerson[];
  absences: CoverageAbsence[];
  rangeStart: string;
  rangeEnd: string;
}): RoleCoverageGap[] {
  const weekdays = eachWeekday(input.rangeStart, input.rangeEnd);
  const groups = groupPeople(input.people);
  const exact = groups.map((group) => ({
    ...group,
    role: group.role,
    kind: "role" as const,
  }));
  const families = familyGroups(groups);
  return [...exact, ...families].flatMap((group) =>
    gapsForGroup(group, input.absences, weekdays),
  );
}

export function formatRoleCoverage(gap: RoleCoverageGap): string {
  const who =
    gap.people === 1 ? "only person away" : `all ${gap.people} away`;
  const dates =
    gap.startDate === gap.endDate
      ? gap.startDate
      : `${gap.startDate} → ${gap.endDate}`;
  return `${gap.departmentName} · ${gap.role} · ${who} · ${dates}`;
}

export function visibleDepartmentIds(
  filter: VacationVisibilityFilter,
  departments: Array<{ id: string; sectionId: string }>,
): Set<string> | null {
  if (!filter.OR) return null;
  const ids = new Set<string>();
  for (const clause of filter.OR) {
    if ("departmentId" in clause) {
      for (const id of clause.departmentId.in) ids.add(id);
    }
    if ("sectionId" in clause) {
      const sections = new Set(clause.sectionId.in);
      for (const department of departments) {
        if (sections.has(department.sectionId)) ids.add(department.id);
      }
    }
  }
  return ids;
}

function familyGroups(
  groups: Array<{
    departmentId: string;
    departmentName: string;
    role: string;
    people: CoveragePerson[];
  }>,
) {
  const byFamily = new Map<
    string,
    {
      departmentId: string;
      departmentName: string;
      role: string;
      kind: "family";
      titles: Set<string>;
      people: CoveragePerson[];
    }
  >();
  for (const group of groups) {
    const family = functionRoleFamily(group.role);
    if (!family) continue;
    const key = `${group.departmentId}:${family}`;
    const existing = byFamily.get(key) ?? {
      departmentId: group.departmentId,
      departmentName: group.departmentName,
      role: FAMILY_LABEL[family],
      kind: "family" as const,
      titles: new Set<string>(),
      people: [],
    };
    existing.titles.add(group.role);
    existing.people.push(...group.people);
    byFamily.set(key, existing);
  }
  return [...byFamily.values()].filter(
    (group) => group.titles.size > 1 && group.people.length > 1,
  );
}

function groupPeople(people: CoveragePerson[]) {
  const groups = new Map<
    string,
    {
      departmentId: string;
      departmentName: string;
      role: string;
      people: CoveragePerson[];
    }
  >();
  for (const person of people) {
    const role = person.role.trim();
    if (!role) continue;
    const key = `${person.departmentId}:${role}`;
    const existing = groups.get(key) ?? {
      departmentId: person.departmentId,
      departmentName: person.departmentName,
      role,
      people: [],
    };
    if (!existing.people.some((row) => row.principalId === person.principalId)) {
      existing.people.push(person);
    }
    groups.set(key, existing);
  }
  return [...groups.values()];
}

function gapsForGroup(
  group: {
    departmentId: string;
    departmentName: string;
    role: string;
    kind: "role" | "family";
    people: CoveragePerson[];
  },
  absences: CoverageAbsence[],
  weekdays: string[],
): RoleCoverageGap[] {
  if (group.people.length === 0) return [];
  const gaps: RoleCoverageGap[] = [];
  let open: RoleCoverageGap | null = null;
  for (const date of weekdays) {
    const states = group.people.map((person) =>
      awayState(person.principalId, group.departmentId, date, absences),
    );
    const fullyAway = states.every((state) => state !== "in");
    if (!fullyAway) {
      if (open) gaps.push(open);
      open = null;
      continue;
    }
    const waiting = states.some((state) => state === "waiting");
    if (open && open.waiting === waiting) {
      open.endDate = date;
      continue;
    }
    if (open) gaps.push(open);
    open = {
      departmentId: group.departmentId,
      departmentName: group.departmentName,
      role: group.role,
      kind: group.kind,
      people: group.people.length,
      names: group.people
        .map((person) => person.displayName)
        .sort((a, b) => a.localeCompare(b)),
      startDate: date,
      endDate: date,
      waiting,
    };
  }
  if (open) gaps.push(open);
  return gaps.sort((a, b) => {
    const byDate = a.startDate.localeCompare(b.startDate);
    if (byDate !== 0) return byDate;
    const byDept = a.departmentName.localeCompare(b.departmentName);
    if (byDept !== 0) return byDept;
    if (a.kind !== b.kind) return a.kind === "family" ? 1 : -1;
    return a.role.localeCompare(b.role);
  });
}

function awayState(
  principalId: string,
  departmentId: string,
  date: string,
  absences: CoverageAbsence[],
): "in" | "approved" | "waiting" {
  let waiting = false;
  for (const absence of absences) {
    if (absence.principalId !== principalId) continue;
    if (absence.durationKind !== "FULL_DAYS") continue;
    if (absence.departmentId && absence.departmentId !== departmentId) continue;
    if (date < absence.startDate || date > absence.endDate) continue;
    if (absence.status === "APPROVED") return "approved";
    waiting = true;
  }
  return waiting ? "waiting" : "in";
}

function eachWeekday(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = toUtcDateOnly(start);
  const last = toUtcDateOnly(end).getTime();
  while (cursor.getTime() <= last) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days.push(formatDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
