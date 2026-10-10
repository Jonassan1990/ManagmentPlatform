"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveCurrentPlanAction,
  createBaselineAction,
} from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  permissionTitle,
} from "@/components/ui/forms";
import { StatusBadge } from "@/components/ui/status-badge";
import { mapApprovalStateBadge } from "@/components/ui/status-adapters";
import { formatHours } from "@/components/pi-planning/pi-nav";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import type { PlanApprovalPreview } from "@/modules/pi-planning/application/plan-approval-types";

type Caps = Partial<PrincipalCapabilities>;

export function PlanApprovalPanel({
  preview,
  capabilities,
  embedded = false,
  focus = "full",
}: {
  preview: PlanApprovalPreview;
  capabilities?: Caps;
  embedded?: boolean;
  /** Presentation filter — same actions, optional focus for progressive disclosure. */
  focus?: "full" | "approve" | "baseline";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmBaseline, setConfirmBaseline] = useState(false);
  const [baselineLabel, setBaselineLabel] = useState("");
  const [activeDialog, setActiveDialog] = useState<"approve" | "baseline" | null>(
    null,
  );

  const canReview = capabilities?.canReviewPi === true;
  const canBaselinePerm = capabilities?.canBaselinePi === true;

  const approveBlocked =
    !canReview ||
    !preview.canApprove ||
    preview.approveDisabledReasons.length > 0 ||
    (preview.requiresWarningAcknowledgement && !ackWarnings);

  const baselineBlocked =
    !canBaselinePerm ||
    !preview.canBaseline ||
    preview.baselineDisabledReasons.length > 0 ||
    !preview.activeApproval ||
    !preview.currentRevision;

  const approvalBadge = mapApprovalStateBadge({
    hasValidApproval: Boolean(preview.activeApproval),
    invalidated: preview.latestApproval?.status === "INVALIDATED",
  });

  function approve() {
    if (!preview.currentRevision) return;
    setError(null);
    setSuccess(null);
    setActiveDialog("approve");
    startTransition(async () => {
      const result = await approveCurrentPlanAction({
        piId: preview.piId,
        expectedPiVersion: preview.piVersion,
        expectedCurrentRevisionVersion: preview.currentRevision!.version,
        acknowledgeWarnings: ackWarnings,
      });
      if (!result.ok) {
        setError(result.error?.message ?? "Approval failed.");
        return;
      }
      setConfirmApprove(false);
      setActiveDialog(null);
      setSuccess(
        `Approved CURRENT version ${result.data.currentRevisionVersion}. Baseline was not created.`,
      );
      router.refresh();
    });
  }

  function baseline() {
    if (!preview.activeApproval || !preview.currentRevision) return;
    setError(null);
    setSuccess(null);
    setActiveDialog("baseline");
    startTransition(async () => {
      const result = await createBaselineAction({
        piId: preview.piId,
        label: baselineLabel.trim() || null,
        expectedApprovalId: preview.activeApproval!.id,
        expectedPiVersion: preview.piVersion,
        expectedCurrentRevisionVersion: preview.currentRevision!.version,
      });
      if (!result.ok) {
        setError(result.error?.message ?? "Baseline creation failed.");
        return;
      }
      setConfirmBaseline(false);
      setActiveDialog(null);
      setSuccess(
        `Created immutable baseline v${result.data.versionNumber}. Historical snapshots remain unchanged.`,
      );
      router.refresh();
    });
  }

  const dialogError =
    (confirmApprove && activeDialog === "approve") ||
    (confirmBaseline && activeDialog === "baseline")
      ? error
      : null;

  const shellClass = embedded
    ? "space-y-4 p-3 sm:p-4"
    : "mb-6 space-y-4 rounded-[11px] border border-[#e2e8eb] bg-white p-4 shadow-[0_7px_22px_#1b33440a]";
  const showApprove = focus === "full" || focus === "approve";
  const showBaseline = focus === "full" || focus === "baseline";

  return (
    <section className={shellClass} aria-label="Plan approval and baseline">
      {embedded ? null : (
      <div>
        <h2 className="text-sm font-semibold text-[#102a43]">
          Approve CURRENT plan & create baseline
        </h2>
        <p className="mt-1 text-xs text-[#74848e]">
          Approval binds to an exact CURRENT version and allocation fingerprint.
          Baseline creation is a separate action and does not rewrite history.
        </p>
      </div>
      )}

      <div
        className="rounded-md border border-[#e3a640]/40 bg-[#e3a640]/10 px-3 py-2 text-sm text-[#102a43]"
        role="status"
      >
        <div className="flex flex-wrap items-center gap-2">
          <strong>{preview.stateMessage}</strong>
          <StatusBadge
            status={approvalBadge.status}
            label={approvalBadge.label}
            size="compact"
          />
        </div>
        <span className="mt-1 block text-xs text-[#74848e]">
          Lifecycle: Selected for review → Promoted to CURRENT — not approved →
          Approved CURRENT version → Baselined — immutable commitment
        </span>
      </div>

      {error && !confirmApprove && !confirmBaseline ? (
        <Alert tone="error">{error}</Alert>
      ) : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <p>
          CURRENT version:{" "}
          <strong>
            {preview.currentRevision
              ? `v${preview.currentRevision.version}`
              : "—"}
          </strong>
        </p>
        <p>
          Allocations:{" "}
          <strong>
            {preview.allocationCount} · {formatHours(preview.committedHours)}h
          </strong>
        </p>
        <p>
          Promoted from:{" "}
          <strong>
            {preview.promotedFromRevisionId
              ? preview.promotedFromRevisionId.slice(0, 8)
              : "none"}
          </strong>
        </p>
        <p>
          Readiness:{" "}
          <strong>{preview.readiness?.classification ?? "—"}</strong>
        </p>
      </div>

      {preview.activeApproval ? (
        <div className="rounded-md border border-[#e2e8eb] px-3 py-2 text-sm">
          <p>
            Approver:{" "}
            <strong>
              {preview.activeApproval.approvedByPrincipalId.slice(0, 8)}…
            </strong>
          </p>
          <p className="text-xs text-[#74848e]">
            Approved at{" "}
            {preview.activeApproval.approvedAt
              .replace("T", " ")
              .replace("Z", " UTC")}
            {" · "}fingerprint{" "}
            {preview.activeApproval.allocationFingerprint.slice(0, 12)}…
          </p>
        </div>
      ) : preview.latestApproval?.status === "INVALIDATED" ? (
        <Alert tone="warning" title="Approval invalidated">
          Previous approval invalidated
          {preview.latestApproval.invalidatedReason
            ? ` (${preview.latestApproval.invalidatedReason})`
            : ""}
          . Re-approve the current CURRENT plan before baselining.
        </Alert>
      ) : null}

      {preview.readiness && preview.readiness.blockers.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#d65d57]">
            Blocking conditions
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
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
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {preview.readiness.warnings.map((w) => (
              <li key={`${w.code}-${w.message}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {showApprove ? (
        <>
          {preview.requiresWarningAcknowledgement ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={ackWarnings}
                onChange={(e) => setAckWarnings(e.target.checked)}
              />
              <span>
                I acknowledge the readiness warnings and still want to approve
                this CURRENT plan.
              </span>
            </label>
          ) : null}

          {preview.approveDisabledReasons.length > 0 ? (
            <Alert tone="warning">
              {preview.approveDisabledReasons.join(" ")}
            </Alert>
          ) : null}

          {!canReview ? (
            <Alert tone="info" title="Permission">
              Approving requires PI review permission. You can still inspect
              readiness and CURRENT version details.
            </Alert>
          ) : null}

          <PrimaryButton
            disabled={pending || approveBlocked}
            title={permissionTitle(canReview && preview.canApprove)}
            onClick={() => {
              setError(null);
              setActiveDialog("approve");
              setConfirmApprove(true);
            }}
          >
            Approve CURRENT plan
          </PrimaryButton>

          <ConfirmDialog
            open={confirmApprove}
            onOpenChange={(open) => {
              if (pending && !open) return;
              setConfirmApprove(open);
              if (!open) {
                setError(null);
                setActiveDialog(null);
              }
            }}
            title="Approve CURRENT plan?"
            description={`Changes: records approval for CURRENT version ${preview.currentRevision?.version ?? "—"} at the current allocation fingerprint. Unchanged: allocations, scenarios, and existing baselines. Reversible: approval can be invalidated by a later promotion; it is not a baseline. Approval/baseline: approval only — no immutable baseline is created.`}
            confirmLabel="Confirm approval"
            cancelLabel="Cancel"
            pending={pending && activeDialog === "approve"}
            error={confirmApprove ? dialogError : null}
            onConfirm={approve}
          />
        </>
      ) : null}

      {showApprove && showBaseline ? (
        <hr className="border-[#e2e8eb]" />
      ) : null}

      {showBaseline ? (
        <>
          <div>
            <h3 className="text-sm font-semibold text-[#102a43]">
              Create immutable baseline
            </h3>
            <p className="mt-1 text-xs text-[#74848e]">
              {preview.disclaimerBaseline}
            </p>
          </div>

          {!canBaselinePerm ? (
            <Alert tone="warning" title="Baseline unavailable">
              Creating a baseline requires PI baseline permission (PI_BASELINE).
              Approval alone does not grant baseline creation.
            </Alert>
          ) : null}

          {preview.baselineDisabledReasons.length > 0 ? (
            <Alert tone="info">
              {preview.baselineDisabledReasons.join(" ")}
            </Alert>
          ) : null}

          <FormField
            label="Label (optional)"
            htmlFor="baseline-label"
            hint="Appears on the immutable baseline record."
          >
            <input
              id="baseline-label"
              className={fieldClassName}
              value={baselineLabel}
              onChange={(e) => setBaselineLabel(e.target.value)}
              placeholder="e.g. Management freeze"
            />
          </FormField>

          <PrimaryButton
            disabled={pending || baselineBlocked}
            title={permissionTitle(canBaselinePerm && preview.canBaseline)}
            onClick={() => {
              setError(null);
              setActiveDialog("baseline");
              setConfirmBaseline(true);
            }}
          >
            Create immutable baseline
          </PrimaryButton>

          <ConfirmDialog
            open={confirmBaseline}
            onOpenChange={(open) => {
              if (pending && !open) return;
              setConfirmBaseline(open);
              if (!open) {
                setError(null);
                setActiveDialog(null);
              }
            }}
            title="Create immutable baseline?"
            description={`Changes: creates a new immutable baseline snapshot from approved CURRENT version ${preview.currentRevision?.version ?? "—"}. Unchanged: live allocations and prior baselines (history is append-only). Reversible: no — baselines are not rewritten. Approval/baseline: baseline is created from the exact approved CURRENT state.`}
            confirmLabel="Confirm baseline"
            cancelLabel="Cancel"
            variant="destructive"
            pending={pending && activeDialog === "baseline"}
            error={confirmBaseline ? dialogError : null}
            onConfirm={baseline}
          />
        </>
      ) : null}
    </section>
  );
}
