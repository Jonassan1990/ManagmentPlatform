import { ROLE_KEYS } from "@/modules/shared/permissions";

export type ChartPerson = {
  id: string;
  name: string;
  role: string | null;
};

export type ChartMember = ChartPerson & {
  href: string;
  teams: string[];
};

export type ChartOwner = {
  name: string;
  title: string;
  kind: "owner" | "manager" | "lead";
};

export type ChartTeam = {
  id: string;
  name: string;
  href: string;
  owner: ChartOwner | null;
  members: ChartPerson[];
};

export type ChartDepartment = {
  id: string;
  name: string;
  href: string;
  owner: ChartOwner | null;
  teams: ChartTeam[];
  people: ChartMember[];
};

export type ChartSection = {
  id: string;
  name: string;
  href: string;
  owner: ChartOwner | null;
  departments: ChartDepartment[];
};

export type OrganizationChart = {
  id: string;
  name: string;
  description: string | null;
  href: string;
  owner: ChartOwner | null;
  sections: ChartSection[];
  unassigned: ChartMember[];
  counts: {
    sections: number;
    departments: number;
    teams: number;
    people: number;
  };
};

export type ChartBinding = {
  scopeType: "ORGANIZATION" | "SECTION" | "DEPARTMENT" | "TEAM";
  scopeId: string;
  name: string;
  roleKey: string;
};

type ChartPersonInput = ChartPerson & {
  memberships: { teamId: string; isPrimary: boolean }[];
};

const ROLE_TITLE: Record<string, { title: string; kind: ChartOwner["kind"] }> = {
  [ROLE_KEYS.ORGANIZATION_ADMIN]: { title: "Organization owner", kind: "owner" },
  [ROLE_KEYS.SECTION_MANAGER]: { title: "Section manager", kind: "manager" },
  [ROLE_KEYS.DEPARTMENT_MANAGER]: { title: "Department manager", kind: "manager" },
  [ROLE_KEYS.TEAM_MANAGER]: { title: "Team manager", kind: "manager" },
};

function leadershipRank(role: string | null): number {
  const text = (role ?? "").toLowerCase();
  if (/\bowner\b/.test(text)) return 0;
  if (/\b(manager|director|head)\b/.test(text)) return 1;
  if (/\blead\b/.test(text)) return 2;
  return 3;
}

function inferOwner(people: ChartPersonInput[]): ChartOwner | null {
  if (people.length === 0) return null;
  const ranked = [...people].sort((a, b) => {
    const byRole = leadershipRank(a.role) - leadershipRank(b.role);
    if (byRole !== 0) return byRole;
    const aPrimary = a.memberships.some((membership) => membership.isPrimary) ? 0 : 1;
    const bPrimary = b.memberships.some((membership) => membership.isPrimary) ? 0 : 1;
    return aPrimary - bPrimary || a.name.localeCompare(b.name);
  });
  const best = ranked[0]!;
  const rank = leadershipRank(best.role);
  const primary = best.memberships.some((membership) => membership.isPrimary);
  if (rank > 2 && !primary) return null;
  const kind: ChartOwner["kind"] = rank === 1 ? "manager" : "lead";
  return {
    name: best.name,
    title: best.role?.trim() || "Lead",
    kind,
  };
}

function bindingOwner(
  bindings: ChartBinding[],
  scopeType: ChartBinding["scopeType"],
  scopeId: string,
): ChartOwner | null {
  const matches = bindings
    .filter((binding) => binding.scopeType === scopeType && binding.scopeId === scopeId)
    .filter((binding) => binding.name.trim().length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const match = matches[0];
  if (!match) return null;
  const meta = ROLE_TITLE[match.roleKey] ?? { title: "Owner", kind: "owner" as const };
  const extra = matches.length - 1;
  return {
    name: match.name,
    title: extra > 0 ? `${meta.title} · +${extra}` : meta.title,
    kind: meta.kind,
  };
}

function peopleOnTeams(people: ChartPersonInput[], teamIds: Set<string>): ChartPersonInput[] {
  return people.filter((person) =>
    person.memberships.some((membership) => teamIds.has(membership.teamId)),
  );
}

function departmentMembers(
  orgId: string,
  people: ChartPersonInput[],
  teams: { id: string; name: string }[],
): ChartMember[] {
  const teamName = new Map(teams.map((team) => [team.id, team.name]));
  return people
    .map((person) => {
      const names = [
        ...new Set(
          person.memberships
            .map((membership) => teamName.get(membership.teamId))
            .filter((name): name is string => Boolean(name)),
        ),
      ];
      if (names.length === 0) return null;
      return {
        id: person.id,
        name: person.name,
        role: person.role,
        href: `/organization/${orgId}/resources/${person.id}`,
        teams: names,
      };
    })
    .filter((member): member is ChartMember => member != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildOrganizationChart(input: {
  organization: { id: string; name: string; description: string | null };
  sections: {
    id: string;
    name: string;
    departments: {
      id: string;
      name: string;
      teams: { id: string; name: string }[];
    }[];
  }[];
  people: ChartPersonInput[];
  bindings: ChartBinding[];
}): OrganizationChart {
  const orgId = input.organization.id;
  const sections = input.sections.map((section) => {
    const departments = section.departments.map((department) => {
      const teams = department.teams.map((team) => {
        const members = peopleOnTeams(input.people, new Set([team.id]));
        const owner =
          bindingOwner(input.bindings, "TEAM", team.id) ?? inferOwner(members);
        return {
          id: team.id,
          name: team.name,
          href: `/organization/${orgId}/teams/${team.id}`,
          owner,
          members: members.map(({ id, name, role }) => ({ id, name, role })),
        };
      });
      const departmentPeople = peopleOnTeams(
        input.people,
        new Set(department.teams.map((team) => team.id)),
      );
      return {
        id: department.id,
        name: department.name,
        href: `/organization/${orgId}/departments/${department.id}`,
        owner:
          bindingOwner(input.bindings, "DEPARTMENT", department.id) ??
          inferOwner(departmentPeople),
        teams,
        people: departmentMembers(orgId, input.people, department.teams),
      };
    });
    const sectionTeamIds = new Set(
      section.departments.flatMap((department) => department.teams.map((team) => team.id)),
    );
    return {
      id: section.id,
      name: section.name,
      href: `/organization/${orgId}/sections/${section.id}`,
      owner:
        bindingOwner(input.bindings, "SECTION", section.id) ??
        inferOwner(peopleOnTeams(input.people, sectionTeamIds)),
      departments,
    };
  });

  const placedIds = new Set(
    sections.flatMap((section) =>
      section.departments.flatMap((department) => department.people.map((person) => person.id)),
    ),
  );
  const unassigned = input.people
    .filter((person) => !placedIds.has(person.id))
    .map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      href: `/organization/${orgId}/resources/${person.id}`,
      teams: [] as string[],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: orgId,
    name: input.organization.name,
    description: input.organization.description,
    href: `/organization/${orgId}`,
    owner: bindingOwner(input.bindings, "ORGANIZATION", orgId),
    sections,
    unassigned,
    counts: {
      sections: sections.length,
      departments: sections.reduce((sum, section) => sum + section.departments.length, 0),
      teams: sections.reduce(
        (sum, section) =>
          sum + section.departments.reduce((inner, department) => inner + department.teams.length, 0),
        0,
      ),
      people: input.people.length,
    },
  };
}
