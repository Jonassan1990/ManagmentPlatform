"use client";

import { useState } from "react";
import {
  assignRoleBindingAction,
  createLocalTestUserAction,
  expireRoleBindingAction,
} from "@/app/actions/access";
import { buttonClassName } from "@/components/ui/button";
import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
  useActionForm,
} from "@/components/ui/forms";

type RoleOption = { id: string; key: string; name: string; description: string | null };
type PrincipalOption = { id: string; displayName: string | null; email: string | null };
type ScopeTarget = { id: string; label: string };
type BindingRow = {
  id: string;
  scopeType: string;
  organizationId: string | null;
  scopeId: string | null;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
  roleDefinition: { key: string; name: string };
  principal: { id: string; displayName: string | null; email: string | null };
};

export function AssignRoleBindingForm({
  organizationId,
  roles,
  principals,
  sections,
  departments,
  teams,
}: {
  organizationId: string;
  roles: RoleOption[];
  principals: PrincipalOption[];
  sections: ScopeTarget[];
  departments: ScopeTarget[];
  teams: ScopeTarget[];
}) {
  const form = useActionForm(assignRoleBindingAction);
  const assignableRoles = roles.filter((r) => r.key !== "platform.bootstrap_admin");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const scopeType = String(fd.get("scopeType") ?? "ORGANIZATION");
        form.submit({
          principalId: String(fd.get("principalId") ?? ""),
          roleDefinitionId: String(fd.get("roleDefinitionId") ?? ""),
          scopeType,
          organizationId,
          scopeId:
            scopeType === "ORGANIZATION"
              ? organizationId
              : String(fd.get("scopeId") ?? "") || null,
          effectiveTo: String(fd.get("effectiveTo") ?? "") || null,
        });
      }}
    >
      <h3 className="font-medium">Assign role binding</h3>
      {form.ErrorAlert}
      <FormField label="Principal" htmlFor="principalId" hint="Authenticated identity — not a Resource.">
        <select id="principalId" name="principalId" required className={fieldClassName} defaultValue="">
          <option value="" disabled>
            Select principal
          </option>
          {principals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName ?? p.email ?? p.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Role pack" htmlFor="roleDefinitionId">
        <select
          id="roleDefinitionId"
          name="roleDefinitionId"
          required
          className={fieldClassName}
          defaultValue=""
        >
          <option value="" disabled>
            Select role
          </option>
          {assignableRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Scope type" htmlFor="scopeType">
        <select id="scopeType" name="scopeType" className={fieldClassName} defaultValue="ORGANIZATION">
          <option value="ORGANIZATION">Organization</option>
          <option value="SECTION">Section</option>
          <option value="DEPARTMENT">Department</option>
          <option value="TEAM">Team</option>
        </select>
      </FormField>
      <FormField
        label="Scope target"
        htmlFor="scopeId"
        hint="Required for Section/Department/Team. Organization scope uses this organization."
      >
        <select id="scopeId" name="scopeId" className={fieldClassName} defaultValue="">
          <option value="">Organization (or select target)</option>
          <optgroup label="Sections">
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Departments">
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Teams">
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </optgroup>
        </select>
      </FormField>
      <FormField label="Effective to (optional)" htmlFor="effectiveTo">
        <input id="effectiveTo" name="effectiveTo" type="date" className={fieldClassName} />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Assigning…" : "Assign role"}
      </PrimaryButton>
    </form>
  );
}

export function CreateLocalTestUserForm({
  organizationId,
  roles,
  sections,
  departments,
  teams,
}: {
  organizationId: string;
  roles: RoleOption[];
  sections: ScopeTarget[];
  departments: ScopeTarget[];
  teams: ScopeTarget[];
}) {
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);
  const form = useActionForm(createLocalTestUserAction, (data) => {
    const username =
      data && typeof data === "object" && "username" in data
        ? String((data as { username: string }).username)
        : null;
    setCreatedUsername(username);
  });
  const assignableRoles = roles.filter((r) => r.key !== "platform.bootstrap_admin");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setCreatedUsername(null);
        const fd = new FormData(e.currentTarget);
        const scopeType = String(fd.get("scopeType") ?? "ORGANIZATION");
        form.submit({
          organizationId,
          username: String(fd.get("username") ?? ""),
          password: String(fd.get("password") ?? ""),
          displayName: String(fd.get("displayName") ?? "") || null,
          roleDefinitionId: String(fd.get("roleDefinitionId") ?? "") || null,
          scopeType,
          scopeId:
            scopeType === "ORGANIZATION"
              ? organizationId
              : String(fd.get("scopeId") ?? "") || null,
        });
        e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">Create local test user</h3>
      <p className="text-xs text-[var(--muted)]">
        Creates a Principal with username/password so you can sign in and test
        edit rights. Assign a role pack below so they can work immediately.
      </p>
      {form.ErrorAlert}
      {createdUsername ? (
        <p
          className="rounded-[4px] border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--scania-blue-900,#001533)]"
          role="status"
        >
          Created <span className="font-bold">{createdUsername}</span>. Sign
          out and sign in with that username/password.
        </p>
      ) : null}
      <FormField label="Username" htmlFor="localUsername" required>
        <input
          id="localUsername"
          name="username"
          required
          autoComplete="off"
          className={fieldClassName}
          placeholder="planner1"
        />
      </FormField>
      <FormField label="Display name" htmlFor="localDisplayName">
        <input
          id="localDisplayName"
          name="displayName"
          className={fieldClassName}
          placeholder="Test Planner"
        />
      </FormField>
      <FormField
        label="Password"
        htmlFor="localPassword"
        required
        hint="At least 8 characters. Share only with people who should test."
      >
        <input
          id="localPassword"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Role pack" htmlFor="localRoleDefinitionId">
        <select
          id="localRoleDefinitionId"
          name="roleDefinitionId"
          className={fieldClassName}
          defaultValue=""
        >
          <option value="">No role yet (Access not configured)</option>
          {assignableRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Scope type" htmlFor="localScopeType">
        <select
          id="localScopeType"
          name="scopeType"
          className={fieldClassName}
          defaultValue="ORGANIZATION"
        >
          <option value="ORGANIZATION">Organization</option>
          <option value="SECTION">Section</option>
          <option value="DEPARTMENT">Department</option>
          <option value="TEAM">Team</option>
        </select>
      </FormField>
      <FormField label="Scope target" htmlFor="localScopeId">
        <select
          id="localScopeId"
          name="scopeId"
          className={fieldClassName}
          defaultValue=""
        >
          <option value="">Organization (or select target)</option>
          <optgroup label="Sections">
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Departments">
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Teams">
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </optgroup>
        </select>
      </FormField>
      <button
        type="submit"
        disabled={form.pending}
        className={buttonClassName({ variant: "primary" })}
      >
        {form.pending ? "Creating…" : "Create local user"}
      </button>
    </form>
  );
}

export function LocalLoginsList({
  logins,
}: {
  logins: {
    id: string;
    username: string;
    displayName: string | null;
    principalId: string;
    disabledAt: Date | string | null;
    createdAt: Date | string;
  }[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-medium">Local test logins</h3>
      {logins.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No local test users yet. Create one to sign in as a second account.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {logins.map((u) => (
            <li key={u.id} className="py-2 text-sm">
              <p className="font-medium">
                {u.username}
                {u.displayName ? (
                  <span className="font-normal text-[var(--muted)]">
                    {" "}
                    · {u.displayName}
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {u.disabledAt ? "Disabled" : "Active"} · principal{" "}
                {u.principalId.slice(0, 8)}…
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RoleBindingsTable({
  bindings,
  organizationId,
}: {
  bindings: BindingRow[];
  organizationId: string;
}) {
  const form = useActionForm(expireRoleBindingAction);
  const active = bindings.filter(
    (b) => !b.effectiveTo || new Date(b.effectiveTo) > new Date(),
  );

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Active role bindings</h3>
      {form.ErrorAlert}
      {active.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No active bindings in this organization.</p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {active.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {b.principal.displayName ?? b.principal.email ?? "Principal"} ·{" "}
                  {b.roleDefinition.name}
                </p>
                <p className="text-[var(--muted)]">
                  {b.scopeType}
                  {b.scopeId ? ` · ${b.scopeId.slice(0, 8)}…` : ""}
                  {b.effectiveTo
                    ? ` · until ${new Date(b.effectiveTo).toISOString().slice(0, 10)}`
                    : " · open-ended"}
                </p>
              </div>
              <SecondaryButton
                type="button"
                disabled={form.pending}
                onClick={() =>
                  form.submit({ bindingId: b.id, effectiveTo: new Date().toISOString() })
                }
              >
                Expire
              </SecondaryButton>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--muted)]">
        Organization {organizationId.slice(0, 8)}… · Binding changes are audited.
      </p>
    </div>
  );
}
