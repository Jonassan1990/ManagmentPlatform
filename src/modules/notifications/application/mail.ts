export type OutboundMail = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
};

export type MailSendResult =
  | { ok: true; mode: "resend" | "log"; id?: string }
  | { ok: false; error: string };

/**
 * Send mail when Resend is configured. Otherwise log and return ok so
 * request flows never fail because mail is missing.
 */
export async function sendMail(message: OutboundMail): Promise<MailSendResult> {
  const recipients = [...new Set(message.to.map((row) => row.trim()).filter(Boolean))];
  if (recipients.length === 0) {
    return { ok: false, error: "No recipients" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim() || "Management Platform <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("[mail] skipped (RESEND_API_KEY missing)", {
      to: recipients,
      subject: message.subject,
    });
    return { ok: true, mode: "log" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: message.subject,
        text: message.text,
        html: message.html ?? undefined,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("[mail] resend failed", response.status, detail.slice(0, 300));
      return { ok: false, error: `Resend ${response.status}` };
    }
    const payload = (await response.json()) as { id?: string };
    return { ok: true, mode: "resend", id: payload.id };
  } catch (error) {
    console.error(
      "[mail] send failed",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, error: "Send failed" };
  }
}

export function appBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_URL?.replace(/\/$/, "")?.replace(/^(?!https?:)/, "https://") ||
    "http://localhost:3000"
  );
}
