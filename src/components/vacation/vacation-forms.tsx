"use client";

import { useRouter } from "next/navigation";
import {
  cancelVacationRequestAction,
  createVacationRequestAction,
  reviewVacationRequestAction,
  updateVacationRequestAction,
} from "@/app/actions/vacation";
import { Button } from "@/components/ui/button";
import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
  useActionForm,
} from "@/components/ui/forms";

export function CreateVacationForm({
  organizations,
  defaultOrganizationId,
}: {
  organizations: Array<{ id: string; name: string }>;
  defaultOrganizationId: string | null;
}) {
  const router = useRouter();
  const { pending, ErrorAlert, submit } = useActionForm(
    createVacationRequestAction,
    (data) => {
      const id = (data as { id?: string } | null)?.id;
      if (id) router.push(`/vacation/${id}`);
    },
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        submit({
          organizationId: String(fd.get("organizationId") ?? ""),
          startDate: String(fd.get("startDate") ?? ""),
          endDate: String(fd.get("endDate") ?? ""),
          reason: String(fd.get("reason") ?? "") || null,
        });
      }}
    >
      {ErrorAlert}
      <FormField label="Organization" htmlFor="organizationId" required>
        <select
          id="organizationId"
          name="organizationId"
          className={fieldClassName}
          defaultValue={defaultOrganizationId ?? organizations[0]?.id}
          required
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Start date" htmlFor="startDate" required>
          <input
            id="startDate"
            name="startDate"
            type="date"
            className={fieldClassName}
            required
          />
        </FormField>
        <FormField label="End date" htmlFor="endDate" required>
          <input
            id="endDate"
            name="endDate"
            type="date"
            className={fieldClassName}
            required
          />
        </FormField>
      </div>
      <FormField label="Reason (optional)" htmlFor="reason">
        <textarea
          id="reason"
          name="reason"
          rows={3}
          className={fieldClassName}
          maxLength={2000}
          placeholder="Short note for your manager"
        />
      </FormField>
      <PrimaryButton disabled={pending || organizations.length === 0}>
        {pending ? "Submitting…" : "Submit vacation request"}
      </PrimaryButton>
    </form>
  );
}

export function ResubmitVacationForm({
  requestId,
  expectedVersion,
  startDate,
  endDate,
  reason,
}: {
  requestId: string;
  expectedVersion: number;
  startDate: string;
  endDate: string;
  reason: string | null;
}) {
  const { pending, ErrorAlert, submit } = useActionForm(
    updateVacationRequestAction,
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        submit({
          requestId,
          expectedVersion,
          startDate: String(fd.get("startDate") ?? ""),
          endDate: String(fd.get("endDate") ?? ""),
          reason: String(fd.get("reason") ?? "") || null,
        });
      }}
    >
      {ErrorAlert}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Start date" htmlFor="resubmit-start" required>
          <input
            id="resubmit-start"
            name="startDate"
            type="date"
            className={fieldClassName}
            defaultValue={startDate}
            required
          />
        </FormField>
        <FormField label="End date" htmlFor="resubmit-end" required>
          <input
            id="resubmit-end"
            name="endDate"
            type="date"
            className={fieldClassName}
            defaultValue={endDate}
            required
          />
        </FormField>
      </div>
      <FormField label="Reason" htmlFor="resubmit-reason">
        <textarea
          id="resubmit-reason"
          name="reason"
          rows={3}
          className={fieldClassName}
          defaultValue={reason ?? ""}
          maxLength={2000}
        />
      </FormField>
      <PrimaryButton disabled={pending}>
        {pending ? "Resubmitting…" : "Update and resubmit"}
      </PrimaryButton>
    </form>
  );
}

export function CancelVacationButton({
  requestId,
  expectedVersion,
}: {
  requestId: string;
  expectedVersion: number;
}) {
  const { pending, ErrorAlert, submit } = useActionForm(
    cancelVacationRequestAction,
  );

  return (
    <div className="space-y-2">
      {ErrorAlert}
      <SecondaryButton
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Cancel this vacation request?")) return;
          submit({ requestId, expectedVersion, comment: null });
        }}
      >
        {pending ? "Cancelling…" : "Cancel request"}
      </SecondaryButton>
    </div>
  );
}

export function ReviewVacationForm({
  requestId,
  expectedVersion,
}: {
  requestId: string;
  expectedVersion: number;
}) {
  const { pending, ErrorAlert, submit } = useActionForm(
    reviewVacationRequestAction,
  );

  function decide(decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES") {
    const commentEl = document.getElementById(
      "manager-comment",
    ) as HTMLTextAreaElement | null;
    submit({
      requestId,
      expectedVersion,
      decision,
      comment: commentEl?.value?.trim() || null,
    });
  }

  return (
    <div className="space-y-3">
      {ErrorAlert}
      <FormField
        label="Manager comment"
        htmlFor="manager-comment"
        hint="Required when rejecting or asking for changes"
      >
        <textarea
          id="manager-comment"
          name="comment"
          rows={3}
          className={fieldClassName}
          maxLength={4000}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => decide("APPROVE")}
        >
          Accept
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => decide("REQUEST_CHANGES")}
        >
          Ask for changes
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => decide("REJECT")}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
