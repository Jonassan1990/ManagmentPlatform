"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssignDepartmentForm } from "@/components/organization/org-forms";
import type {
  ChartDepartment,
  ChartMember,
  ChartOrgNode,
  ChartOwner,
  ChartPerson,
  OrganizationChart,
  PeopleManagerNode,
} from "@/modules/organization/application/organization-chart";
import {
  buildPeopleHierarchy,
  flattenChartDepartments,
} from "@/modules/organization/application/organization-chart";

function initials(name: string): string {
  const parts = name
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "–";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function ownerKindLabel(kind: ChartOwner["kind"]): string {
  if (kind === "owner") return "Owner";
  if (kind === "manager") return "Manager";
  return "Lead";
}

function OrgCard({
  href,
  tone,
  eyebrow,
  name,
  owner,
  members,
  peopleCount,
  counts,
  selected,
  onShowPeople,
}: {
  href: string;
  tone: "organization" | "section" | "department" | "team";
  eyebrow: string;
  name: string;
  owner: ChartOwner | null;
  members?: ChartPerson[];
  peopleCount?: number;
  counts?: ChartDepartment["counts"];
  selected?: boolean;
  onShowPeople?: () => void;
}) {
  const others = (members ?? []).filter((member) => member.name !== owner?.name);
  const body = (
    <>
      <span className="mp-org-eyebrow">{eyebrow}</span>
      <span className="mp-org-card-name">{name}</span>
      <span className="mp-org-owner">
        <span className="mp-org-avatar" aria-hidden>
          {owner ? initials(owner.name) : "–"}
        </span>
        <span className="min-w-0">
          <span className="mp-org-owner-label">
            {owner ? ownerKindLabel(owner.kind) : "Owner"}
          </span>
          <span className="mp-org-owner-name">
            {owner ? owner.name : "Unassigned"}
          </span>
          {owner?.title ? (
            <span className="mp-org-owner-role">{owner.title}</span>
          ) : null}
        </span>
      </span>
      {others.length > 0 ? (
        <span className="mp-org-members" aria-label={`${others.length} other people`}>
          {others.slice(0, 4).map((member) => (
            <span
              key={member.id}
              className="mp-org-avatar mp-org-avatar--sm"
              title={member.role ? `${member.name} · ${member.role}` : member.name}
            >
              {initials(member.name)}
            </span>
          ))}
          {others.length > 4 ? (
            <span className="mp-org-more">+{others.length - 4}</span>
          ) : null}
        </span>
      ) : null}
      {counts ? (
        <span className="mp-org-delivery-counts">
          {counts.resources} resources · {counts.projects} projects ·{" "}
          {counts.initiatives} initiatives
        </span>
      ) : peopleCount != null ? (
        <span className="mp-org-people-count">
          {peopleCount === 1 ? "1 person" : `${peopleCount} people`}
        </span>
      ) : null}
    </>
  );

  if (onShowPeople) {
    return (
      <div className={`mp-org-card mp-org-card--${tone} ${selected ? "is-selected" : ""}`}>
        <button type="button" className="mp-org-card-hit" onClick={onShowPeople}>
          {body}
        </button>
        <Link href={href} className="mp-org-open">
          Open department
        </Link>
      </div>
    );
  }

  return (
    <Link href={href} className={`mp-org-card mp-org-card--${tone}`}>
      {body}
    </Link>
  );
}

function PersonRow({ person }: { person: ChartMember }) {
  return (
    <li>
      <Link href={person.href} className="mp-org-person">
        <span className="mp-org-avatar" aria-hidden>
          {initials(person.name)}
        </span>
        <span className="min-w-0">
          <span className="mp-org-owner-name">{person.name}</span>
          <span className="mp-org-owner-role">
            {[person.role, person.teams.length > 0 ? person.teams.join(", ") : "No team"]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </Link>
    </li>
  );
}

function DepartmentFocus({
  department,
  selected = false,
  anchor = false,
}: {
  department: ChartDepartment & { label?: string };
  selected?: boolean;
  anchor?: boolean;
}) {
  return (
    <section
      id={anchor ? `org-dept-${department.id}` : undefined}
      className={`mp-org-roster ${selected ? "is-selected" : ""}`}
      aria-label={`${department.name} overview`}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="mp-card-title">{department.label ?? department.name}</h3>
        <Link href={department.href} className="mp-org-open">
          Open department
        </Link>
      </div>
      {department.owner ? (
        <p className="mb-3 text-sm text-[var(--muted)]">
          Manager: <span className="text-[var(--fg)]">{department.owner.name}</span>
          {department.owner.title ? ` · ${department.owner.title}` : ""}
        </p>
      ) : (
        <p className="mb-3 text-sm text-[var(--muted)]">No manager assigned.</p>
      )}
      <ul className="mp-org-stat-row" aria-label="Department contents">
        <li>
          <strong>{department.counts.resources}</strong>
          <span>Resources</span>
        </li>
        <li>
          <strong>{department.counts.projects}</strong>
          <span>Projects</span>
        </li>
        <li>
          <strong>{department.counts.initiatives}</strong>
          <span>Initiatives</span>
        </li>
        <li>
          <strong>{department.teams.length}</strong>
          <span>Teams</span>
        </li>
      </ul>
      {department.people.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No people in this department yet.</p>
      ) : (
        <ul className="mp-org-person-list mt-3">
          {department.people.slice(0, 6).map((person) => (
            <PersonRow key={person.id} person={person} />
          ))}
        </ul>
      )}
      {department.people.length > 6 ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          +{department.people.length - 6} more — open the department to see everything.
        </p>
      ) : null}
    </section>
  );
}

function ManagerPeopleNode({ node }: { node: PeopleManagerNode }) {
  const managerBody = (
    <>
      <span className="mp-org-avatar" aria-hidden>
        {initials(node.managerName)}
      </span>
      <span className="min-w-0">
        <span className="mp-org-owner-label">Manager</span>
        <span className="mp-org-owner-name">{node.managerName}</span>
        <span className="mp-org-owner-role">
          {node.managerTitle} · {node.departmentName}
        </span>
      </span>
    </>
  );

  return (
    <section className="mp-org-manager-node" aria-label={`${node.managerName} reports`}>
      <div className="mp-org-manager-head">
        {node.managerHref ? (
          <Link href={node.managerHref} className="mp-org-person">
            {managerBody}
          </Link>
        ) : (
          <div className="mp-org-person">{managerBody}</div>
        )}
        <Link href={node.departmentHref} className="mp-org-open">
          Open department
        </Link>
      </div>
      {node.employees.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">No employees under this manager yet.</p>
      ) : (
        <ul className="mp-org-report-list">
          {node.employees.map((person) => (
            <PersonRow key={person.id} person={person} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OrgUnitBranch({ unit }: { unit: ChartOrgNode }) {
  return (
    <li>
      <OrgCard
        href={unit.href}
        tone="organization"
        eyebrow="Child organization"
        name={unit.name}
        owner={unit.owner}
      />
      {unit.children.length > 0 ? (
        <ul>
          {unit.children.map((child) => (
            <OrgUnitBranch key={child.id} unit={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function DepartmentBranch({
  department,
  openDepartmentId,
  onToggle,
}: {
  department: ChartDepartment;
  openDepartmentId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <li>
      <OrgCard
        href={department.href}
        tone="department"
        eyebrow="Department"
        name={department.name}
        owner={department.owner}
        counts={department.counts}
        selected={openDepartmentId === department.id}
        onShowPeople={() => onToggle(department.id)}
      />
      {department.children.length > 0 || department.teams.length > 0 ? (
        <ul>
          {department.children.map((child) => (
            <DepartmentBranch
              key={child.id}
              department={child}
              openDepartmentId={openDepartmentId}
              onToggle={onToggle}
            />
          ))}
          {department.teams.map((team) => (
            <li key={team.id}>
              <OrgCard
                href={team.href}
                tone="team"
                eyebrow="Team"
                name={team.name}
                owner={team.owner}
                members={team.members}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrganizationChart({
  chart,
  canAssign = false,
}: {
  chart: OrganizationChart;
  canAssign?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"organization" | "people">("organization");
  const [openDepartmentId, setOpenDepartmentId] = useState<string | null>(null);
  const peopleHierarchy = useMemo(() => buildPeopleHierarchy(chart), [chart]);

  const departments = chart.sections.flatMap((section) =>
    flattenChartDepartments([section]).map((department) => ({
      ...department,
      label: `${section.name} / ${department.name}`,
    })),
  );
  const open = departments.find((department) => department.id === openDepartmentId) ?? null;
  const everyone = [
    ...new Map(
      [...departments.flatMap((department) => department.people), ...chart.unassigned].map(
        (person) => [person.id, person],
      ),
    ).values(),
  ];
  const assignDepartments = departments.map((department) => ({
    id: department.id,
    name: department.label,
    teams: department.teams.map((team) => ({ id: team.id, name: team.name })),
  }));

  useEffect(() => {
    if (!openDepartmentId) return;
    if (!window.matchMedia("(min-width: 1280px)").matches) return;
    document.getElementById(`org-dept-${openDepartmentId}`)?.scrollIntoView({
      block: "nearest",
    });
  }, [openDepartmentId]);

  useEffect(() => {
    if (view !== "organization") return;
    const scroller = scrollRef.current;
    const card = scroller?.querySelector<HTMLElement>(".mp-org-card--organization");
    if (!scroller || !card) return;
    const cardBox = card.getBoundingClientRect();
    const scrollBox = scroller.getBoundingClientRect();
    scroller.scrollLeft +=
      cardBox.left - scrollBox.left - (scrollBox.width - cardBox.width) / 2;
  }, [chart.id, view]);

  return (
    <div id="org-chart">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mp-section-title">Hierarchy</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {view === "organization"
              ? "Start at the organization, open a department to see resources, projects, and initiatives. Child organizations nest underneath for deeper drill-down."
              : "People view groups employees under each manager name."}{" "}
            {chart.counts.departments} departments · {chart.counts.people} people
            {view === "organization" && chart.counts.sections > 1 ? (
              <span className="mp-org-scroll-hint"> · Scroll sideways to see every branch.</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="mp-org-views" role="group" aria-label="Hierarchy view">
            <button
              type="button"
              aria-pressed={view === "organization"}
              onClick={() => setView("organization")}
            >
              Departments
            </button>
            <button
              type="button"
              aria-pressed={view === "people"}
              onClick={() => setView("people")}
            >
              People
            </button>
          </div>
          {view === "organization" ? (
            <ul className="mp-org-legend" aria-label="Hierarchy levels">
              <li><i className="mp-org-swatch mp-org-swatch--organization" /> Organization</li>
              <li><i className="mp-org-swatch mp-org-swatch--section" /> Section</li>
              <li><i className="mp-org-swatch mp-org-swatch--department" /> Department</li>
              <li><i className="mp-org-swatch mp-org-swatch--team" /> Team</li>
            </ul>
          ) : null}
        </div>
      </div>

      {view === "organization" ? (
        <div className="mp-org-layout">
          <div className="mp-org-scroll" ref={scrollRef}>
            <ul className="mp-org-tree">
              <li>
                <OrgCard
                  href={chart.href}
                  tone="organization"
                  eyebrow="Organization"
                  name={chart.name}
                  owner={chart.owner}
                />
                {chart.sections.length === 0 && chart.children.length === 0 ? (
                  <p className="mt-4 max-w-sm text-center text-sm text-[var(--muted)]">
                    No sections yet. Add a section, then departments. Place child
                    organizations under this one for deeper structure.
                  </p>
                ) : (
                  <ul>
                    {chart.children.map((child) => (
                      <OrgUnitBranch key={child.id} unit={child} />
                    ))}
                    {chart.sections.map((section) => (
                      <li key={section.id}>
                        <OrgCard
                          href={section.href}
                          tone="section"
                          eyebrow="Section"
                          name={section.name}
                          owner={section.owner}
                        />
                        {section.departments.length > 0 ? (
                          <ul>
                            {section.departments.map((department) => (
                              <DepartmentBranch
                                key={department.id}
                                department={department}
                                openDepartmentId={openDepartmentId}
                                onToggle={(id) =>
                                  setOpenDepartmentId((current) =>
                                    current === id ? null : id,
                                  )
                                }
                              />
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          </div>
          <aside className="mp-org-side" aria-label="Department drill-down">
            <div className="mp-org-focus">
              {open ? (
                <DepartmentFocus department={open} selected />
              ) : (
                <section className="mp-org-roster">
                  <h3 className="mp-card-title">Click a department</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    See resources, projects, and initiatives for that department,
                    then open it for the full workspace.
                  </p>
                </section>
              )}
            </div>
            <div className="mp-org-directory">
              <h3 className="mp-card-title">All departments</h3>
              {chart.sections.map((section) => (
                <div key={section.id}>
                  <p className="mp-org-side-section">{section.name}</p>
                  <div className="mt-2 space-y-2">
                    {flattenChartDepartments([section]).map((department) => (
                      <DepartmentFocus
                        key={department.id}
                        department={department}
                        selected={openDepartmentId === department.id}
                        anchor
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <div className="space-y-4">
          {canAssign ? (
            <section className="mp-org-roster">
              <AssignDepartmentForm
                people={everyone}
                departments={assignDepartments}
                initialDepartmentId={open?.id}
              />
            </section>
          ) : null}
          {peopleHierarchy.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No departments yet — add a department to place managers and employees.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {peopleHierarchy.map((node) => (
                <ManagerPeopleNode key={`${node.id}-${node.departmentId}`} node={node} />
              ))}
            </div>
          )}
          <section className="mp-org-roster" aria-label="People without a department">
            <h3 className="mp-card-title">Unassigned</h3>
            {chart.unassigned.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Everyone belongs to a department.
              </p>
            ) : (
              <ul className="mp-org-person-list mt-2">
                {chart.unassigned.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
