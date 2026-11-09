"use client";

import { useRouter } from "next/navigation";
import {
  cancelVacationRequestAction,
  createVacationRequestAction,
  reviewVacationRequestAction,
  updateVacationRequestAction,
} from "@/app/actions/vacation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
  useActionForm,
} from "@/components/ui/forms";

type DurationKind = "FULL_DAYS" | "HALF_DAY" | "HOURS";
type DayPart = "MORNING" | "AFTERNOON";

const LENGTH_HINT: Record<DurationKind, string> = {
  FULL_DAYS: "Weekdays from the start date through the end date. One day is 8 hours.",
  HALF_DAY: "Four hours on one weekday, morning or afternoon.",
  HOURS: "1–8 hours on one weekday. A full day is 8 hours.",
};

function readVacationLength(fd: FormData, durationKind: DurationKind) {
  const startDate = String(fd.get("startDate") ?? "");
  if (durationKind === "FULL_DAYS") {
    return {
      durationKind,
      startDate,
      endDate: String(fd.get("endDate") ?? ""),
      dayPart: null,
      hours: null,
    };
  }
  if (durationKind === "HALF_DAY") {
    return {
      durationKind,
      startDate,
      endDate: startDate,
      dayPart: String(fd.get("dayPart") ?? ""),
      hours: null,
    };
  }
  return {
    durationKind,
    startDate,
    endDate: startDate,
    dayPart: null,
    hours: Number(fd.get("hours")),
  };
}

function VacationLengthFields({
  idPrefix,
  durationKind,
  onDurationKind,
  startDate,
  endDate,
  dayPart,
  hours,
}: {
  idPrefix: string;
  durationKind: DurationKind;
  onDurationKind: (kind: DurationKind) => void;
  startDate?: string;
  endDate?: string;
  dayPart?: DayPart | null;
  hours?: number | null;
}) {
  return (
    <>
      <FormField
        label="Length"
        htmlFor={`${idPrefix}-length`}
        hint={LENGTH_HINT[durationKind]}
        required
      >
        <select
          id={`${idPrefix}-length`}
          className={fieldClassName}
          value={durationKind}
          onChange={(event) => onDurationKind(event.target.value as DurationKind)}
        >
          <option value="FULL_DAYS">Full days</option>
          <option value="HALF_DAY">Half day</option>
          <option value="HOURS">Hours</option>
        </select>
      </FormField>
      {durationKind === "FULL_DAYS" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Start date" htmlFor={`${idPrefix}-start`} required>
            <input
              id={`${idPrefix}-start`}
              name="startDate"
              type="date"
              className={fieldClassName}
              defaultValue={startDate}
              required
            />
          </FormField>
          <FormField label="End date" htmlFor={`${idPrefix}-end`} required>
            <input
              id={`${idPrefix}-end`}
              name="endDate"
              type="date"
              className={fieldClassName}
              defaultValue={endDate}
              required
            />
          </FormField>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Date" htmlFor={`${idPrefix}-start`} required>
            <input
              id={`${idPrefix}-start`}
              name="startDate"
              type="date"
              className={fieldClassName}
              defaultValue={startDate}
              required
            />
          </FormField>
          {durationKind === "HALF_DAY" ? (
            <FormField label="Part of day" htmlFor={`${idPrefix}-part`} required>
              <select
                id={`${idPrefix}-part`}
                name="dayPart"
                className={fieldClassName}
                defaultValue={dayPart ?? "MORNING"}
                required
              >
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
              </select>
            </FormField>
          ) : (
            <FormField label="Hours" htmlFor={`${idPrefix}-hours`} required>
              <select
                id={`${idPrefix}-hours`}
                name="hours"
                className={fieldClassName}
                defaultValue={String(hours && hours > 0 ? hours : 1)}
                required
              >
                {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value} hour{value === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>
      )}
    </>
  );
}

export function CreateVacationForm({
  organizations,
  defaultOrganizationId,
}: {
  organizations: Array<{ id: string; name: string }>;
  defaultOrganizationId: string | null;
}) {
  const router = useRouter();
  const [durationKind, setDurationKind] = useState<DurationKind>("FULL_DAYS");
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
          ...readVacationLength(fd, durationKind),
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
      <VacationLengthFields
        idPrefix="create"
        durationKind={durationKind}
        onDurationKind={setDurationKind}
      />
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
  durationKind: initialKind,
  startDate,
  endDate,
  dayPart,
  hours,
  reason,
}: {
  requestId: string;
  expectedVersion: number;
  durationKind: DurationKind;
  startDate: string;
  endDate: string;
  dayPart: DayPart | null;
  hours: number | null;
  reason: string | null;
}) {
  const [durationKind, setDurationKind] = useState<DurationKind>(initialKind);
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
          ...readVacationLength(fd, durationKind),
          reason: String(fd.get("reason") ?? "") || null,
        });
      }}
    >
      {ErrorAlert}
      <VacationLengthFields
        idPrefix="resubmit"
        durationKind={durationKind}
        onDurationKind={setDurationKind}
        startDate={startDate}
        endDate={endDate}
        dayPart={dayPart}
        hours={hours}
      />
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
