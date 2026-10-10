import { Prisma, PrismaClient } from "@prisma/client";
import { getRequestId } from "@/server/request-context";

export type AuditWriteInput = {
  actorPrincipalId?: string | null;
  actionType: string;
  subjectType: string;
  subjectId?: string | null;
  organizationId?: string | null;
  correlationId?: string | null;
  payload: Prisma.InputJsonValue;
  result: "success" | "denied" | "failure";
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** correlationId column is UUID — ignore opaque request ids like `req_…`. */
function uuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_RE.test(value) ? value : null;
}

export class AuditService {
  constructor(private readonly db: PrismaClient) {}

  async record(input: AuditWriteInput): Promise<void> {
    await this.db.auditEvent.create({
      data: {
        actorPrincipalId: input.actorPrincipalId ?? null,
        actionType: input.actionType,
        subjectType: input.subjectType,
        subjectId: input.subjectId ?? null,
        organizationId: input.organizationId ?? null,
        correlationId: uuidOrNull(
          input.correlationId ?? getRequestId() ?? null,
        ),
        payload: input.payload,
        result: input.result,
      },
    });
  }
}
