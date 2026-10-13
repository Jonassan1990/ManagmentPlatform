"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type {
  ChartOwner,
  ChartPerson,
  OrganizationChart,
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
}: {
  href: string;
  tone: "organization" | "section" | "department" | "team";
  eyebrow: string;
  name: string;
  owner: ChartOwner | null;
  members?: ChartPerson[];
}) {
  const others = (members ?? []).filter((member) => member.name !== owner?.name);
  return (
    <Link href={href} className={`mp-org-card mp-org-card--${tone}`}>
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
    </Link>
  );
}

export function OrganizationChart({ chart }: { chart: OrganizationChart }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    const card = scroller?.querySelector<HTMLElement>(".mp-org-card--organization");
    if (!scroller || !card) return;
    const cardBox = card.getBoundingClientRect();
    const scrollBox = scroller.getBoundingClientRect();
    scroller.scrollLeft +=
      cardBox.left - scrollBox.left - (scrollBox.width - cardBox.width) / 2;
  }, [chart.id]);

  return (
    <div id="org-chart">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mp-section-title">Hierarchy</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {chart.counts.sections} sections · {chart.counts.departments} departments ·{" "}
            {chart.counts.teams} teams · {chart.counts.people} people
            {chart.counts.sections > 1 ? " · Scroll sideways to see every branch." : ""}
          </p>
        </div>
        <ul className="mp-org-legend" aria-label="Hierarchy levels">
          <li><i className="mp-org-swatch mp-org-swatch--organization" /> Organization</li>
          <li><i className="mp-org-swatch mp-org-swatch--section" /> Section</li>
          <li><i className="mp-org-swatch mp-org-swatch--department" /> Department</li>
          <li><i className="mp-org-swatch mp-org-swatch--team" /> Team</li>
        </ul>
      </div>
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
            {chart.sections.length === 0 ? (
              <p className="mt-4 max-w-sm text-center text-sm text-[var(--muted)]">
                No sections yet. Add a section to grow this hierarchy.
              </p>
            ) : (
              <ul>
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
                          <li key={department.id}>
                            <OrgCard
                              href={department.href}
                              tone="department"
                              eyebrow="Department"
                              name={department.name}
                              owner={department.owner}
                            />
                            {department.teams.length > 0 ? (
                              <ul>
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
    </div>
  );
}
