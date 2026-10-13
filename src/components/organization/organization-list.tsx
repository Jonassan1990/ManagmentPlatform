"use client";

import Link from "next/link";
import { useState } from "react";
import { EditOrganizationForm } from "@/components/organization/org-forms";
import { buttonClassName } from "@/components/ui/button";

export type OrganizationListItem = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  canEdit: boolean;
  parentOrganizationId: string | null;
  depth: number;
};

export function OrganizationList({
  orgs,
  selectedId,
}: {
  orgs: OrganizationListItem[];
  selectedId?: string | null;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-[var(--line)]">
      {orgs.map((org) => {
        const editing = editingId === org.id;
        return (
          <li
            key={org.id}
            className={`rounded-md py-3 ${selectedId === org.id ? "bg-[var(--accent-soft)] px-2" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3" style={{ paddingLeft: org.depth * 16 }}>
              <Link
                href={`/organization/${org.id}`}
                className="block min-h-11 min-w-0 flex-1 rounded-sm py-1 hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <p className="font-medium">{org.name}</p>
                {org.parentOrganizationId ? (
                  <p className="text-xs text-[var(--muted)]">
                    Inside {orgs.find((parent) => parent.id === org.parentOrganizationId)?.name}
                  </p>
                ) : null}
                {org.description ? (
                  <p className="text-sm text-[var(--muted)]">{org.description}</p>
                ) : null}
              </Link>
              <Link
                href={`/organization?org=${org.id}#org-chart`}
                className={buttonClassName({ variant: "secondary", size: "sm" })}
                aria-current={selectedId === org.id ? "true" : undefined}
              >
                Hierarchy
              </Link>
              {org.canEdit ? (
                <button
                  type="button"
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                  aria-expanded={editing}
                  aria-label={editing ? `Close edit for ${org.name}` : `Edit ${org.name}`}
                  onClick={() => setEditingId(editing ? null : org.id)}
                >
                  {editing ? "Close" : "Edit"}
                </button>
              ) : null}
            </div>
            {editing && org.canEdit ? (
              <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--scania-grey-50)] p-3">
                <EditOrganizationForm
                  id={org.id}
                  name={org.name}
                  description={org.description}
                  version={org.version}
                  parentOrganizationId={org.parentOrganizationId}
                  parents={orgs.map((item) => ({ id: item.id, name: item.name }))}
                  onSaved={() => setEditingId(null)}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
