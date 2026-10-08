/**
 * Shared helpers for governance application services (Phase 1B extraction).
 * Pure utilities — no business orchestration.
 */

import {
  GateType,
  InitiativeStage,
  Prisma,
  type DecisionOutcome,
} from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "@/modules/shared/errors";

export function fromZod(error: ZodError): AppError {
  return new AppError("VALIDATION", "Validation failed", {
    details: error.flatten(),
  });
}

export function parse<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) throw fromZod(error);
    throw error;
  }
}

export function toDecimal(
  value: string | null | undefined,
): Prisma.Decimal | null {
  if (value == null || value === "") return null;
  return new Prisma.Decimal(value);
}

export function gateStageForType(gateType: GateType): InitiativeStage {
  switch (gateType) {
    case "PRE_STUDY_GATE":
      return InitiativeStage.PRE_STUDY;
    case "POC_GATE":
      return InitiativeStage.POC;
    case "PILOT_GATE":
      return InitiativeStage.PILOT;
    default:
      return InitiativeStage.PRE_STUDY;
  }
}

export function defaultDecisionQuestion(gateType: GateType): {
  question: string;
  whyNeeded: string;
} {
  if (gateType === "PRE_STUDY_GATE") {
    return {
      question: "Should this initiative proceed to a Proof of Concept?",
      whyNeeded:
        "Pre-study evidence and required authorities have been assembled for a governance decision.",
    };
  }
  if (gateType === "POC_GATE") {
    return {
      question: "What is the governance outcome of this Proof of Concept?",
      whyNeeded:
        "PoC results and evaluations are ready for an authorized decision.",
    };
  }
  return {
    question: "What is the scale / next-step outcome of this Pilot?",
    whyNeeded:
      "Pilot operational evidence and evaluations are ready for an authorized scale decision.",
  };
}

const PRE_STUDY_AND_POC_OUTCOMES: DecisionOutcome[] = [
  "GO",
  "CONDITIONAL_GO",
  "NO_GO",
  "HOLD",
];

const PILOT_GATE_OUTCOMES: DecisionOutcome[] = [
  "SCALE",
  "EXTEND_PILOT",
  "CONDITIONAL_SCALE",
  "STOP",
  "HOLD",
];

export function allowedOutcomesForGate(gateType: GateType): DecisionOutcome[] {
  return gateType === "PILOT_GATE"
    ? PILOT_GATE_OUTCOMES
    : PRE_STUDY_AND_POC_OUTCOMES;
}

export function optionsConsideredForGate(
  gateType: GateType,
): Prisma.InputJsonValue {
  if (gateType === "PILOT_GATE") {
    return [
      { key: "SCALE", label: "Scale to project" },
      { key: "CONDITIONAL_SCALE", label: "Conditional scale" },
      { key: "EXTEND_PILOT", label: "Extend pilot" },
      { key: "STOP", label: "Stop" },
      { key: "HOLD", label: "Hold" },
    ];
  }
  return [
    { key: "GO", label: "Go" },
    { key: "CONDITIONAL_GO", label: "Conditional go" },
    { key: "NO_GO", label: "No-go" },
    { key: "HOLD", label: "Hold" },
  ];
}

export function assertVersion(
  current: number,
  expected: number,
  entity: string,
): void {
  if (current !== expected) {
    throw new AppError(
      "STALE_VERSION",
      `This ${entity} was changed by someone else. Refresh and try again.`,
      { details: { currentVersion: current } },
    );
  }
}

export function rethrowStale(error: unknown, entity: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw new AppError(
      "STALE_VERSION",
      `This ${entity} was changed by someone else. Refresh and try again.`,
    );
  }
  throw error;
}
