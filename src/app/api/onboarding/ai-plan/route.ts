import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServices } from "@/server/container";

export const runtime = "nodejs";

const bodySchema = z.object({
  roleTitle: z.string().trim().min(1).max(200).optional(),
  departmentName: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * Generates a dual-ack onboarding plan via Vercel AI Gateway (AI SDK).
 * Requires AI_GATEWAY_API_KEY (or Vercel OIDC on deployed projects).
 */
export async function POST(request: Request) {
  const { authz } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const role = parsed.data.roleTitle?.trim() || "new team member";
  const department = parsed.data.departmentName?.trim() || "their department";
  const notes = parsed.data.notes?.trim();

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      temperature: 0.4,
      prompt: `You help managers create dual-acknowledgment onboarding checklists.
Each item must be checkable by BOTH the new employee and the onboarder ("onboard guy").
Return ONLY a JSON array of 5 to 8 objects with keys "title" (short) and "description" (one sentence).
No markdown fences. Role: ${role}. Department: ${department}.${
        notes ? ` Extra context: ${notes}` : ""
      }`,
    });

    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");
    const items = z
      .array(
        z.object({
          title: z.string().trim().min(1).max(300),
          description: z.string().trim().min(1).max(2000),
        }),
      )
      .min(3)
      .max(12)
      .parse(JSON.parse(cleaned));

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI plan generation failed";
    const missingKey =
      /AI_GATEWAY_API_KEY|api key|unauthorized|401/i.test(message) ||
      (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN);
    return NextResponse.json(
      {
        error: missingKey
          ? "AI Gateway is not configured. Set AI_GATEWAY_API_KEY on the host (same Vercel AI Gateway used by Workmesh-style apps)."
          : "Could not generate an onboarding plan right now.",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: missingKey ? 503 : 502 },
    );
  }
}
