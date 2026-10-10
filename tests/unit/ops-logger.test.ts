import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { redactObject, logger } from "@/server/logger";
import {
  resolveRequestId,
  runWithRequestContext,
  getRequestId,
} from "@/server/request-context";

describe("logger redaction", () => {
  it("redacts secret-like keys and connection strings", () => {
    const out = redactObject({
      password: "hunter2",
      DATABASE_URL: "postgres://user:pass@db.prisma.io:5432/postgres",
      safe: "ok",
      nested: { token: "abc", count: 1 },
    });
    expect(out.password).toBe("[REDACTED]");
    expect(out.DATABASE_URL).toBe("[REDACTED]");
    expect(out.safe).toBe("ok");
    expect((out.nested as { token: string }).token).toBe("[REDACTED]");
    expect((out.nested as { count: number }).count).toBe(1);
  });

  it("emits JSON with requestId from context", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    runWithRequestContext("req_test_12345678", () => {
      logger.info("ops.test_event", { foo: "bar" });
    });
    expect(spy).toHaveBeenCalled();
    const line = String(spy.mock.calls[0][0]);
    const parsed = JSON.parse(line) as {
      event: string;
      requestId: string;
      foo: string;
    };
    expect(parsed.event).toBe("ops.test_event");
    expect(parsed.requestId).toBe("req_test_12345678");
    expect(parsed.foo).toBe("bar");
    expect(getRequestId()).toBeUndefined();
    spy.mockRestore();
  });
});

describe("request id resolution", () => {
  it("accepts valid inbound ids and rejects short junk", () => {
    expect(resolveRequestId("req_abcdefg1")).toBe("req_abcdefg1");
    expect(resolveRequestId("bad")).not.toBe("bad");
    expect(resolveRequestId(null)).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });
});

describe("health response contract", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("documents public health payload shape (no secrets)", async () => {
    const shape = {
      status: "ok",
      ready: true,
      checks: {
        app: "ok",
        database: "ok",
        databaseLatencyMs: 12,
        auth: {
          oidcConfigured: false,
          tempAuthConfigured: true,
          devAuthEnabled: false,
        },
      },
      requestId: "req_x",
      durationMs: 15,
    };
    expect(JSON.stringify(shape)).not.toMatch(/postgres:\/\//i);
    expect(shape.checks.auth).not.toHaveProperty("clientSecret");
    expect(shape.checks.auth).not.toHaveProperty("password");
  });
});
