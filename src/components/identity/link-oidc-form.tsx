"use client";

import { useState } from "react";
import { linkOidcIdentityAction } from "@/app/actions/access";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  useActionForm,
} from "@/components/ui/forms";

type PrincipalOption = {
  id: string;
  label: string;
};

export function LinkOidcForm({ principals }: { principals: PrincipalOption[] }) {
  const [success, setSuccess] = useState<string | null>(null);
  const form = useActionForm(linkOidcIdentityAction, (data) => {
    const created = (data as { created?: boolean } | undefined)?.created;
    setSuccess(
      created
        ? "OIDC identity linked (ExternalIdentity created)."
        : "OIDC identity already linked to this Principal.",
    );
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSuccess(null);
        const data = new FormData(event.currentTarget);
        const confirm = data.get("confirmExplicitLink") === "on";
        if (!confirm) {
          form.setError(
            "Explicit confirmation is required to link an OIDC identity.",
          );
          return;
        }
        form.submit({
          targetPrincipalId: String(data.get("targetPrincipalId") ?? ""),
          issuer: String(data.get("issuer") ?? "").trim(),
          subject: String(data.get("subject") ?? "").trim(),
          emailSnapshot: String(data.get("emailSnapshot") ?? "").trim() || null,
          displayNameSnapshot:
            String(data.get("displayNameSnapshot") ?? "").trim() || null,
          confirmExplicitLink: true as const,
        });
      }}
    >
      <FormField
        label="Target Principal"
        htmlFor="targetPrincipalId"
        hint="Typical cutover: temporary owner Principal — RoleBindings stay on the same id."
      >
        <select
          id="targetPrincipalId"
          name="targetPrincipalId"
          required
          className={fieldClassName}
          defaultValue=""
        >
          <option value="" disabled>
            Select Principal…
          </option>
          {principals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="OIDC issuer" htmlFor="issuer">
        <input
          id="issuer"
          name="issuer"
          type="url"
          required
          placeholder="https://login.example.com/…"
          className={fieldClassName}
        />
      </FormField>

      <FormField
        label="OIDC subject (sub)"
        htmlFor="subject"
        hint="Stable IdP subject claim. Never use email as the identity key."
      >
        <input
          id="subject"
          name="subject"
          type="text"
          required
          autoComplete="off"
          className={fieldClassName}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Display name snapshot (optional)" htmlFor="displayNameSnapshot">
          <input
            id="displayNameSnapshot"
            name="displayNameSnapshot"
            type="text"
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Email snapshot (optional)" htmlFor="emailSnapshot">
          <input
            id="emailSnapshot"
            name="emailSnapshot"
            type="email"
            className={fieldClassName}
          />
        </FormField>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="confirmExplicitLink"
          className="mt-1"
          required
        />
        <span>
          I confirm this is an explicit identity link. The platform will not
          auto-merge by email or display name.
        </span>
      </label>

      {form.ErrorAlert}
      {success ? (
        <p className="text-sm text-green-800" role="status">
          {success}
        </p>
      ) : null}

      <PrimaryButton type="submit" disabled={form.pending}>
        {form.pending ? "Linking…" : "Link OIDC identity"}
      </PrimaryButton>
    </form>
  );
}
