"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { promoteSelectedScenarioAction } from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PrimaryButton, permissionTitle } from "@/components/ui/forms";
import { StatusBadge } from "@/components/ui/status-badge";
import { mapScenarioStatusBadge } from "@/components/ui/status-adapters";
import { formatHours } from "@/components/pi-planning/pi-nav";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import type { ScenarioPromotionPreview } from "@/modules/pi-planning/application/scenario-promotion-types";

type Caps = Partial<PrincipalCapabilities>;

export function ScenarioPromotionPanel({
  preview,
  capabilities,
  embedded = false,
}: {
  preview: ScenarioPromotionPreview;
  capabilities?: Caps;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const canReview = capabilities?.canReviewPi === true;
  const selected = preview.selectedRevision;
  const blockedByAuthOrReadiness =
    !canReview ||
    !preview.canPromote ||
    preview.disabledReasons.length > 0 ||
    (preview.requiresWarningAcknowledgement && !ackWarnings);

  function promote() {
    if (!selected || !preview.currentRevision) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await promoteSelectedScenarioAction({
        piId: preview.piId,
        expectedPiVersion: preview.piVersion,
        expectedSelectedRevisionId: selected.id,
        expectedSelectedRevisionVersion: selected.version,
        expectedCurrentRevisionVersion: preview.currentRevision!.version,
        acknowledgeWarnings: ackWarnings,
      });
      if (!result.ok) {
        // Keep dialog open — do not hide failed operations.
        setError(result.error?.message ?? "Promotion failed.");
        return;
      }
      setConfirmOpen(false);
      setSuccess(
        `Promoted ${selected.label ?? selected.key} into CURRENT (${result.data.allocationCount} allocation${result.data.allocationCount === 1 ? "" : "s"}). Baseline was not created.`,
      );
      router.refresh();
    });
  }

  const scenarioBadge = selected
    ? mapScenarioStatusBadge(selected.status)
    : null;

  const shellClass = embedded
    ? "space-y-4 p-3 sm:p-4"
    : "mb-6 space-y-4 rounded-[11px] border border-[#e2e8eb] bg-white p-4 shadow-[0_7px_22px_#1b33440a]";

  return (
    <section className={shellClass} aria-label="Scenario promotion">
      {embedded ? null : (
      <div>
        <h2 className="text-sm font-semibold text-[#102a43]">
          Promote selected scenario to CURRENT
        </h2>
        <p className="mt-1 text-xs text-[#74848e]">
          Replaces the authoritative CURRENT allocations with the selected
          scenario. This does not approve the PI or create an immutable
          baseline.
        </p>
      </div>
      )}

      <Alert tone="warning" title="Authoritative change">
        Changes the authoritative plan — does not create an approved baseline.
      </Alert>

      {error && !confirmOpen ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      {!selected ? (
        <p className="text-sm text-[#74848e]">
          Select a scenario for review above before promoting.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span>
              Selected scenario:{" "}
              <strong>{selected.label ?? selected.key}</strong>
            </span>
            {scenarioBadge ? (
              <StatusBadge
                status={scenarioBadge.status}
                label={scenarioBadge.label}
                size="compact"
              />
            ) : null}
          </p>
          {preview.readiness ? (
            <p>
              Current readiness:{" "}
              <strong>{preview.readiness.classification}</strong>
            </p>
          ) : null}

          {preview.readiness && preview.readiness.blockers.length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#d65d57]">
                Blocking conditions
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                {preview.readiness.blockers.map((b) => (
                  <li key={`${b.code}-${b.message}`}>{b.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.readiness && preview.readiness.warnings.length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#e3a640]">
                Warnings
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                {preview.readiness.warnings.map((w) => (
                  <li key={`${w.code}-${w.message}`}>{w.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <PreviewMetric
              label="CURRENT now"
              count={preview.currentAllocations.allocationCount}
              hours={preview.currentAllocations.totalCommittedHours}
            />
            <PreviewMetric
              label="After promote"
              count={preview.selectedAllocations.allocationCount}
              hours={preview.selectedAllocations.totalCommittedHours}
            />
          </div>

          {preview.requiresWarningAcknowledgement ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={ackWarnings}
                onChange={(e) => setAckWarnings(e.target.checked)}
                disabled={!canReview || pending}
              />
              <span>
                I acknowledge the readiness warnings and want to promote anyway.
              </span>
            </label>
          ) : null}

          {preview.disabledReasons.length > 0 ? (
            <Alert tone="warning">{preview.disabledReasons.join(" ")}</Alert>
          ) : null}

          <PrimaryButton
            type="button"
            disabled={blockedByAuthOrReadiness || pending}
            title={permissionTitle(canReview)}
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          >
            Promote selected scenario to CURRENT
          </PrimaryButton>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={(open) => {
              if (pending && !open) return;
              setConfirmOpen(open);
              if (!open) setError(null);
            }}
            title="Promote scenario to CURRENT?"
            description={`Changes: CURRENT allocations become a copy of “${selected.label ?? selected.key}”. Unchanged: the source scenario, approvals, and baselines. Reversible: only by promoting another scenario later — not undone automatically. Approval/baseline: not created.`}
            confirmLabel="Confirm promote to CURRENT"
            cancelLabel="Cancel"
            variant="destructive"
            pending={pending}
            error={error}
            onConfirm={promote}
          />

          {!canReview ? (
            <p className="text-xs text-[#74848e]">
              Promoting requires PI review permission.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function PreviewMetric({
  label,
  count,
  hours,
}: {
  label: string;
  count: number;
  hours: number;
}) {
  return (
    <div className="rounded-[11px] border border-[#e2e8eb] bg-[#f8fafb] p-3">
      <p className="text-[11px] text-[#74848e]">{label}</p>
      <p className="text-lg font-extrabold tracking-tight text-[#102a43] tabular-nums">
        {count} alloc · {formatHours(hours)}
      </p>
    </div>
  );
}
