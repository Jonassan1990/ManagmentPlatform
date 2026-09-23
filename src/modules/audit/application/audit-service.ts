import { Prisma, PrismaClient } from "@prisma/client";

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
        correlationId: input.correlationId ?? null,
        payload: input.payload,
        result: input.result,
      },
    });
  }
}
