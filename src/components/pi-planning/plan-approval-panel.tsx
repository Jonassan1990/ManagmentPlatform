"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveCurrentPlanAction,
  createBaselineAction,
} from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/page";
import {
  PrimaryButton,
  SecondaryButton,
  permissionTitle,
} from "@/components/ui/forms";
import { formatHours } from "@/components/pi-planning/pi-nav";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import type { PlanApprovalPreview } from "@/modules/pi-planning/application/plan-approval-types";

type Caps = Partial<PrincipalCapabilities>;

export function PlanApprovalPanel({
  preview,
  capabilities,
}: {
  preview: PlanApprovalPreview;
  capabilities?: Caps;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmBaseline, setConfirmBaseline] = useState(false);
  const [baselineLabel, setBaselineLabel] = useState("");

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

  function approve() {
    if (!preview.currentRevision) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await approveCurrentPlanAction({
        piId: preview.piId,
        expectedPiVersion: preview.piVersion,
        expectedCurrentRevisionVersion: preview.currentRevision!.version,
        acknowledgeWarnings: ackWarnings,
      });
      if (!result.ok) {
        setError(result.error?.message ?? "Approval failed.");
        setConfirmApprove(false);
        return;
      }
      setConfirmApprove(false);
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
        setConfirmBaseline(false);
        return;
      }
      setConfirmBaseline(false);
      setSuccess(
        `Created immutable baseline v${result.data.versionNumber}. Historical snapshots remain unchanged.`,
      );
      router.refresh();
    });
  }

  return (
    <section className="mb-6 space-y-4 rounded-[11px] border border-[#e2e8eb] bg-white p-4 shadow-[0_7px_22px_#1b33440a]">
      <div>
        <h2 className="text-sm font-semibold text-[#102a43]">
          Approve CURRENT plan & create baseline
        </h2>
        <p className="mt-1 text-xs text-[#74848e]">
          Approval binds to an exact CURRENT version and allocation fingerprint.
          Baseline creation is a separate action and does not rewrite history.
        </p>
      </div>

      <div
        className="rounded-md border border-[#e3a640]/40 bg-[#e3a640]/10 px-3 py-2 text-sm text-[#102a43]"
        role="status"
      >
        <strong>{preview.stateMessage}</strong>
        <span className="mt-1 block text-xs text-[#74848e]">
          Lifecycle: Selected for review → Promoted to CURRENT — not approved →
          Approved CURRENT version → Baselined — immutable commitment
        </span>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="ok">{success}</Alert> : null}

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
            <strong>{preview.activeApproval.approvedByPrincipalId.slice(0, 8)}…</strong>
          </p>
          <p className="text-xs text-[#74848e]">
            Approved at {preview.activeApproval.approvedAt.replace("T", " ").replace("Z", " UTC")}
            {" · "}fingerprint {preview.activeApproval.allocationFingerprint.slice(0, 12)}…
          </p>
        </div>
      ) : preview.latestApproval?.status === "INVALIDATED" ? (
        <p className="text-sm text-[#d65d57]">
          Previous approval invalidated
          {preview.latestApproval.invalidatedReason
            ? ` (${preview.latestApproval.invalidatedReason})`
            : ""}
          . Re-approve the current CURRENT plan before baselining.
        </p>
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

      {preview.requiresWarningAcknowledgement ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={ackWarnings}
            onChange={(e) => setAckWarnings(e.target.checked)}
          />
          <span>
            I acknowledge the readiness warnings and still want to approve this
            CURRENT plan.
          </span>
        </label>
      ) : null}

      {preview.approveDisabledReasons.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-[#74848e]">
          {preview.approveDisabledReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      {!confirmApprove ? (
        <PrimaryButton
          disabled={pending || approveBlocked}
          title={permissionTitle(canReview && preview.canApprove)}
          onClick={() => setConfirmApprove(true)}
        >
          Approve CURRENT plan
        </PrimaryButton>
      ) : (
        <div className="space-y-2 rounded-md border border-[#102a43]/20 bg-[#f7fafc] p-3">
          <p className="text-sm">
            Confirm approval of CURRENT version{" "}
            <strong>{preview.currentRevision?.version}</strong>. This does not
            create an immutable baseline.
          </p>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton disabled={pending} onClick={approve}>
              {pending ? "Approving…" : "Confirm approval"}
            </PrimaryButton>
            <SecondaryButton
              disabled={pending}
              onClick={() => setConfirmApprove(false)}
            >
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}

      <hr className="border-[#e2e8eb]" />

      <div>
        <h3 className="text-sm font-semibold text-[#102a43]">
          Create immutable baseline
        </h3>
        <p className="mt-1 text-xs text-[#74848e]">
          {preview.disclaimerBaseline}
        </p>
      </div>

      {preview.baselineDisabledReasons.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-[#74848e]">
          {preview.baselineDisabledReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      <label className="block text-sm">
        <span className="text-xs text-[#74848e]">Label (optional)</span>
        <input
          className="mt-1 w-full rounded-md border border-[#e2e8eb] px-3 py-2"
          value={baselineLabel}
          onChange={(e) => setBaselineLabel(e.target.value)}
          placeholder="e.g. Management freeze"
        />
      </label>

      {!confirmBaseline ? (
        <PrimaryButton
          disabled={pending || baselineBlocked}
          title={permissionTitle(canBaselinePerm && preview.canBaseline)}
          onClick={() => setConfirmBaseline(true)}
        >
          Create immutable baseline
        </PrimaryButton>
      ) : (
        <div className="space-y-2 rounded-md border border-[#102a43]/20 bg-[#f7fafc] p-3">
          <p className="text-sm">
            Confirm immutable baseline from approved CURRENT version{" "}
            <strong>{preview.currentRevision?.version}</strong>. Historical
            baselines will not be modified.
          </p>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton disabled={pending} onClick={baseline}>
              {pending ? "Creating…" : "Confirm baseline"}
            </PrimaryButton>
            <SecondaryButton
              disabled={pending}
              onClick={() => setConfirmBaseline(false)}
            >
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}
    </section>
  );
}
