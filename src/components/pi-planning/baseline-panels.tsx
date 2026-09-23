"use client";

import { createBaselineAction } from "@/app/actions/pi-planning";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  permissionTitle,
  useActionForm,
} from "@/components/ui/forms";
import { Panel } from "@/components/ui/page";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";

type Caps = Partial<PrincipalCapabilities>;

type BaselineRow = {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: Date | string;
  revisionIdCaptured: string | null;
};

type ChangeRow = {
  kind: string;
  message: string;
  subjectId?: string;
};

export function BaselinePanels({
  piId,
  piStatus,
  baselines,
  changes,
  latestBaselineLabel,
  capabilities,
}: {
  piId: string;
  piStatus: string;
  baselines: BaselineRow[];
  changes: ChangeRow[];
  latestBaselineLabel: string | null;
  capabilities?: Caps;
}) {
  const canBaseline = capabilities?.canBaselinePi !== false;
  const canCreateFromReview = piStatus === "REVIEW" || baselines.length > 0;

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-medium">Create baseline</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              First baseline from Review moves the PI to Baselined. Later baselines
              capture further plan freezes.
            </p>
          </div>
          <CreateBaselineForm
            piId={piId}
            allowed={canBaseline && canCreateFromReview}
            blockedReason={
              !canBaseline
                ? undefined
                : !canCreateFromReview
                  ? "Move the PI to Review before creating the first baseline."
                  : undefined
            }
          />
        </div>
      </Panel>

      <Panel>
        <h2 className="font-medium">Baselines</h2>
        {baselines.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No baselines captured yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {baselines.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    v{b.versionNumber}
                    {b.label ? ` — ${b.label}` : ""}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(b.createdAt).toISOString().slice(0, 19).replace("T", " ")}{" "}
                    UTC
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <h2 className="font-medium">Changes since latest baseline</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {latestBaselineLabel
            ? `Compared to ${latestBaselineLabel}.`
            : "No baseline to compare against."}
        </p>
        {changes.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            {baselines.length === 0
              ? "Create a baseline to track subsequent plan changes."
              : "Current plan matches the latest baseline."}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {changes.map((c, i) => (
              <li
                key={`${c.kind}-${c.subjectId ?? i}`}
                className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              >
                <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {c.kind.replaceAll("_", " ")}
                </span>
                <p>{c.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function CreateBaselineForm({
  piId,
  allowed,
  blockedReason,
}: {
  piId: string;
  allowed: boolean;
  blockedReason?: string;
}) {
  const form = useActionForm(createBaselineAction);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        const label = String(fd.get("label") ?? "").trim();
        form.submit({
          piId,
          label: label || null,
        });
      }}
    >
      {form.ErrorAlert}
      {blockedReason ? (
        <p className="w-full text-xs text-[var(--muted)]">{blockedReason}</p>
      ) : null}
      <FormField label="Label (optional)" htmlFor="bl-label">
        <input
          id="bl-label"
          name="label"
          className={fieldClassName}
          placeholder="e.g. Management freeze"
        />
      </FormField>
      <PrimaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Creating…" : "Create baseline"}
      </PrimaryButton>
    </form>
  );
}
