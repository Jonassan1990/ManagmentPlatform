"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveScenarioAction,
  cloneScenarioAction,
  createScenarioFromCurrentAction,
  markScenarioReadyAction,
  renameScenarioAction,
  reopenScenarioAction,
} from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/page";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  permissionTitle,
} from "@/components/ui/forms";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";

type Caps = Partial<PrincipalCapabilities>;

export type ScenarioListItem = {
  id: string;
  key: string;
  label: string | null;
  isCurrent: boolean;
  status: string;
  version: number;
  kind: "CURRENT" | "SCENARIO";
  archivedAt?: string | Date | null;
};

export function ScenarioModeBanner({
  revision,
}: {
  revision: {
    id: string;
    key: string;
    label: string | null;
    isCurrent: boolean;
    status: string;
  };
}) {
  if (revision.isCurrent) {
    return (
      <div
        className="mb-4 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
        role="status"
      >
        Viewing <strong>CURRENT</strong> plan
        {revision.label ? ` — ${revision.label}` : ""}. Scenario drafts do not
        change this plan until promoted (M3D).
      </div>
    );
  }
  return (
    <div
      className="mb-4 rounded-md border border-[var(--warning)] bg-[var(--warning-soft,transparent)] px-3 py-2 text-sm"
      role="status"
    >
      Viewing <strong>SCENARIO</strong>: {revision.label ?? revision.key} (
      {revision.status}). Edits apply only to this scenario — CURRENT is
      unchanged.
    </div>
  );
}

export function ScenarioPanel({
  piId,
  activeRevisionId,
  scenarios,
  capabilities,
  boardHrefBase,
}: {
  piId: string;
  activeRevisionId: string;
  scenarios: ScenarioListItem[];
  capabilities?: Caps;
  boardHrefBase?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createLabel, setCreateLabel] = useState("");
  const [cloneFromId, setCloneFromId] = useState("");
  const [cloneLabel, setCloneLabel] = useState("");
  const [renameId, setRenameId] = useState("");
  const [renameLabel, setRenameLabel] = useState("");

  const canAllocate = capabilities?.canAllocatePi !== false;
  const draftScenarios = scenarios.filter(
    (s) => !s.isCurrent && s.status === "DRAFT",
  );
  const base = boardHrefBase ?? `/pi/${piId}/board`;

  function hrefFor(revisionId: string, isCurrent: boolean) {
    if (isCurrent) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}revisionId=${revisionId}`;
  }

  function run(action: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error?.message ?? "Scenario action failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mb-6 space-y-4 rounded-lg border border-[var(--line)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
          Planning scenarios
        </h2>
        {pending ? (
          <span className="text-xs text-[var(--muted)]">Working…</span>
        ) : null}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2" role="list" aria-label="Scenario list">
        {scenarios.map((s) => {
          const active = s.id === activeRevisionId;
          return (
            <Link
              key={s.id}
              href={hrefFor(s.id, s.isCurrent)}
              role="listitem"
              className={`rounded-md px-3 py-1.5 text-sm ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)]"
              }`}
            >
              {s.isCurrent ? "CURRENT" : s.label ?? s.key}
              {!s.isCurrent ? (
                <span className="ml-1 text-xs text-[var(--muted)]">
                  · {s.status}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canAllocate || !createLabel.trim()) return;
            run(async () => {
              const result = await createScenarioFromCurrentAction({
                piId,
                label: createLabel.trim(),
              });
              if (result.ok) {
                setCreateLabel("");
                router.push(hrefFor(result.data.id, false));
              }
              return result;
            });
          }}
        >
          <p className="text-xs font-medium">Create from CURRENT</p>
          <FormField label="Scenario name" htmlFor="scenario-create-label">
            <input
              id="scenario-create-label"
              className={fieldClassName}
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              maxLength={200}
              required
              disabled={!canAllocate}
              title={permissionTitle(canAllocate)}
            />
          </FormField>
          <PrimaryButton
            type="submit"
            disabled={!canAllocate || pending}
            title={permissionTitle(canAllocate)}
          >
            Create scenario
          </PrimaryButton>
        </form>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canAllocate || !cloneFromId || !cloneLabel.trim()) return;
            const source = draftScenarios.find((s) => s.id === cloneFromId);
            if (!source) return;
            run(async () => {
              const result = await cloneScenarioAction({
                revisionId: cloneFromId,
                label: cloneLabel.trim(),
                expectedVersion: source.version,
              });
              if (result.ok) {
                setCloneLabel("");
                router.push(hrefFor(result.data.id, false));
              }
              return result;
            });
          }}
        >
          <p className="text-xs font-medium">Clone DRAFT scenario</p>
          <FormField label="Source" htmlFor="scenario-clone-from">
            <select
              id="scenario-clone-from"
              className={fieldClassName}
              value={cloneFromId}
              onChange={(e) => setCloneFromId(e.target.value)}
              disabled={!canAllocate || draftScenarios.length === 0}
            >
              <option value="">Select…</option>
              {draftScenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label ?? s.key}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="New name" htmlFor="scenario-clone-label">
            <input
              id="scenario-clone-label"
              className={fieldClassName}
              value={cloneLabel}
              onChange={(e) => setCloneLabel(e.target.value)}
              maxLength={200}
              required
              disabled={!canAllocate}
            />
          </FormField>
          <PrimaryButton
            type="submit"
            disabled={!canAllocate || pending || draftScenarios.length === 0}
          >
            Clone scenario
          </PrimaryButton>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canAllocate || !renameId || !renameLabel.trim()) return;
            const source = scenarios.find(
              (s) => s.id === renameId && !s.isCurrent,
            );
            if (!source) return;
            run(async () => {
              const result = await renameScenarioAction({
                revisionId: renameId,
                label: renameLabel.trim(),
                expectedVersion: source.version,
              });
              if (result.ok) setRenameLabel("");
              return result;
            });
          }}
        >
          <p className="text-xs font-medium">Rename scenario</p>
          <FormField label="Scenario" htmlFor="scenario-rename-id">
            <select
              id="scenario-rename-id"
              className={fieldClassName}
              value={renameId}
              onChange={(e) => {
                setRenameId(e.target.value);
                const s = scenarios.find((x) => x.id === e.target.value);
                setRenameLabel(s?.label ?? "");
              }}
              disabled={!canAllocate}
            >
              <option value="">Select…</option>
              {scenarios
                .filter((s) => !s.isCurrent && s.status !== "ARCHIVED")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label ?? s.key}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="New label" htmlFor="scenario-rename-label">
            <input
              id="scenario-rename-label"
              className={fieldClassName}
              value={renameLabel}
              onChange={(e) => setRenameLabel(e.target.value)}
              maxLength={200}
              required
              disabled={!canAllocate}
            />
          </FormField>
          <PrimaryButton type="submit" disabled={!canAllocate || pending}>
            Rename
          </PrimaryButton>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-medium">Lifecycle</p>
          <ul className="space-y-2 text-sm">
            {scenarios
              .filter((s) => !s.isCurrent && s.status !== "ARCHIVED")
              .map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 rounded border border-[var(--line)] px-2 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {s.label ?? s.key}{" "}
                    <span className="text-[var(--muted)]">({s.status})</span>
                  </span>
                  {s.status === "DRAFT" ? (
                    <button
                      type="button"
                      className="text-xs text-[var(--accent)] underline"
                      disabled={!canAllocate || pending}
                      onClick={() =>
                        run(() =>
                          markScenarioReadyAction({
                            revisionId: s.id,
                            expectedVersion: s.version,
                          }),
                        )
                      }
                    >
                      Mark ready
                    </button>
                  ) : null}
                  {s.status === "READY_FOR_REVIEW" ? (
                    <button
                      type="button"
                      className="text-xs text-[var(--accent)] underline"
                      disabled={!canAllocate || pending}
                      onClick={() =>
                        run(() =>
                          reopenScenarioAction({
                            revisionId: s.id,
                            expectedVersion: s.version,
                          }),
                        )
                      }
                    >
                      Reopen
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-[var(--danger)] underline"
                    disabled={!canAllocate || pending}
                    onClick={() =>
                      run(() =>
                        archiveScenarioAction({
                          revisionId: s.id,
                          expectedVersion: s.version,
                        }),
                      )
                    }
                  >
                    Archive
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
