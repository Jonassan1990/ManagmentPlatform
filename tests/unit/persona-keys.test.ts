import { describe, expect, it } from "vitest";
import {
  impersonationKeyForPrincipal,
  isImpersonationKey,
  matchesPersonQuery,
  partitionPeopleByGroup,
  principalIdFromImpersonationKey,
} from "@/modules/demo/persona-keys";

describe("persona-keys", () => {
  it("accepts principal keys and legacy sheet/demo keys", () => {
    expect(
      isImpersonationKey("principal:a1000000-0000-4000-8000-000000000104"),
    ).toBe(true);
    expect(isImpersonationKey("sheet-manager:INFB")).toBe(true);
    expect(isImpersonationKey("sheet-manager:IN MT")).toBe(true);
    expect(isImpersonationKey("demo:infb-manager")).toBe(true);
    expect(isImpersonationKey("session")).toBe(false);
    expect(isImpersonationKey("principal:not-a-uuid")).toBe(false);
  });

  it("always builds cookie-safe principal keys (no spaces)", () => {
    expect(
      impersonationKeyForPrincipal({
        id: "a1000000-0000-4000-8000-000000000104",
        externalSubject: "sheet-manager:IN MT",
      }),
    ).toBe("principal:a1000000-0000-4000-8000-000000000104");
    expect(
      impersonationKeyForPrincipal({
        id: "a1000000-0000-4000-8000-000000000199",
        externalSubject: null,
      }),
    ).toBe("principal:a1000000-0000-4000-8000-000000000199");
  });

  it("extracts principal ids from principal keys only", () => {
    expect(
      principalIdFromImpersonationKey(
        "principal:a1000000-0000-4000-8000-000000000104",
      ),
    ).toBe("a1000000-0000-4000-8000-000000000104");
    expect(principalIdFromImpersonationKey("sheet-manager:IN MT")).toBeNull();
  });

  it("matches people by name, department, or role", () => {
    const person = {
      displayName: "Conny Friborg",
      departmentCode: "INFB",
      role: "Developer",
      username: "sheet.infb.conny-friborg",
    };
    expect(matchesPersonQuery(person, "conny")).toBe(true);
    expect(matchesPersonQuery(person, "infb")).toBe(true);
    expect(matchesPersonQuery(person, "developer")).toBe(true);
    expect(matchesPersonQuery(person, "unknown")).toBe(false);
    expect(matchesPersonQuery(person, "  ")).toBe(true);
  });

  it("partitions managers from people", () => {
    const { managers, people } = partitionPeopleByGroup([
      { key: "1", group: "managers" },
      { key: "2", group: "people" },
      { key: "3", group: "sheet-managers" },
      { key: "4", group: "levels" },
    ]);
    expect(managers.map((row) => row.key)).toEqual(["1", "3"]);
    expect(people.map((row) => row.key)).toEqual(["2", "4"]);
  });
});
