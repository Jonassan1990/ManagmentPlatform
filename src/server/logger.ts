import { getRequestId } from "@/server/request-context";

export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const REDACT_KEY =
  /(password|secret|token|authorization|cookie|connectionstring|database_url|direct_url|postgres_url|prisma_database_url|api[_-]?key|private[_-]?key)/i;

const SENSITIVE_VALUE =
  /^(postgres(ql)?:\/\/|prisma\+postgres:\/\/|eyJ[A-Za-z0-9_-]{10,}|\$2[aby]\$)/i;

function redactValue(key: string, value: unknown): unknown {
  if (REDACT_KEY.test(key)) {
    return "[REDACTED]";
  }
  if (typeof value === "string") {
    if (SENSITIVE_VALUE.test(value) || value.length > 500) {
      return value.length > 500 ? `[TRUNCATED len=${value.length}]` : "[REDACTED]";
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => redactValue(String(i), v));
  }
  if (value && typeof value === "object") {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
}

export function redactObject(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = redactValue(k, v);
  }
  return out;
}

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    requestId: getRequestId() ?? null,
    ...redactObject(fields ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info(event: string, fields?: LogFields): void {
    emit("info", event, fields);
  },
  warn(event: string, fields?: LogFields): void {
    emit("warn", event, fields);
  },
  error(event: string, fields?: LogFields): void {
    emit("error", event, fields);
  },
};
