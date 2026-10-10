import { describe, expect, it } from "vitest";
import {
  buildInitiativeTrail,
  buildOrganizationTrail,
  buildPiTrail,
  buildPortfolioTrail,
  entityLabel,
  truncateLabel,
} from "@/modules/navigation/breadcrumbs";
import {
  appendPreservedQuery,
  appendReturnContext,
  capacityReturnInput,
  explorerReturnInput,
  isSafeInternalPath,
  parseReturnContext,
  resolveReturnHref,
} from "@/modules/navigation/return-context";

const ORG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const DEPT = "11111111-2222-4333-8444-555555555555";
const PI = "99999999-8888-4777-8666-555555555555";
const REV_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REV_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SECTION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("M4C-B entity labels", () => {
  it("prefers human-readable labels and truncates long names", () => {
    expect(entityLabel("INIT-001", "Initiative")).toBe("INIT-001");
    expect(entityLabel("  PI-2026-04  ", "Program Increment")).toBe(
      "PI-2026-04",
    );
    const long = "A".repeat(50);
    expect(truncateLabel(long, 40).endsWith("…")).toBe(true);
    expect(truncateLabel(long, 40).length).toBe(40);
  });

  it("suppresses UUID-looking labels (unauthorized / missing safe title)", () => {
    expect(entityLabel(ORG, "Initiative")).toBe("Initiative");
    expect(entityLabel(null, "Project")).toBe("Project");
    expect(entityLabel("", "Department")).toBe("Department");
  });
});

describe("M4C-B static and dynamic breadcrumb generation", () => {
  it("builds portfolio explorer trail", () => {
    const crumbs = buildPortfolioTrail({
      leaf: "Explorer",
      organizationId: ORG,
    });
    expect(crumbs.map((c) => c.label)).toEqual([
      "Home",
      "Portfolio",
      "Explorer",
    ]);
    expect(crumbs[0]?.href).toBe("/");
    expect(crumbs[1]?.href).toContain(`organizationId=${ORG}`);
    expect(crumbs[2]?.href).toBeUndefined();
  });

  it("builds initiative → project trail with explorer return crumb", () => {
    const ctx = parseReturnContext({
      from: "explorer",
      fromOrg: ORG,
      fx_q: "alpha",
      fx_kind: "PROJECT",
      fx_page: "2",
    });
    const crumbs = buildInitiativeTrail({
      initiativeId: "init-1",
      referenceKey: "INIT-001",
      leaf: "Project",
      returnContext: ctx,
    });
    expect(crumbs.map((c) => c.label)).toEqual([
      "Home",
      "Explorer",
      "Initiatives",
      "INIT-001",
      "Project",
    ]);
    expect(crumbs[1]?.href).toContain("/portfolio/explorer?");
    expect(crumbs[1]?.href).toContain("q=alpha");
    expect(crumbs[1]?.href).toContain("page=2");
    expect(crumbs.at(-1)?.href).toBeUndefined();
  });

  it("builds PI Board/Compare/Review trails", () => {
    const board = buildPiTrail({
      piId: PI,
      referenceKey: "PI-2026-04",
      name: "Q4 Planning",
      leaf: "Board",
    });
    expect(board.map((c) => c.label)).toEqual([
      "Home",
      "PI Planning",
      "PI-2026-04",
      "Board",
    ]);
    const compare = buildPiTrail({
      piId: PI,
      referenceKey: "PI-2026-04",
      leaf: "Compare",
      returnContext: parseReturnContext({
        from: "capacity",
        fromOrg: ORG,
        fromPi: PI,
      }),
    });
    expect(compare.map((c) => c.label)).toContain("Resource Planning");
    expect(compare.find((c) => c.label === "Resource Planning")?.href).toContain(
      `piId=${PI}`,
    );
  });

  it("builds organization → department → resource style trails", () => {
    const dept = buildOrganizationTrail({
      organizationId: ORG,
      organizationName: "Acme",
      section: { id: SECTION, name: "Delivery" },
      department: { id: DEPT, name: "Platform" },
    });
    expect(dept.map((c) => c.label)).toEqual([
      "Home",
      "Organization",
      "Acme",
      "Delivery",
      "Platform",
    ]);
    const resource = buildOrganizationTrail({
      organizationId: ORG,
      organizationName: "Acme",
      resourcesHub: true,
      leaf: "Ada Lovelace",
    });
    expect(resource.map((c) => c.label)).toEqual([
      "Home",
      "Organization",
      "Acme",
      "Resources",
      "Ada Lovelace",
    ]);
  });
});

describe("M4C-B return context + open-redirect safety", () => {
  it("preserves explorer filters on outbound and return hrefs", () => {
    const href = appendReturnContext(
      `/initiatives/${ORG}/project`,
      explorerReturnInput({
        organizationId: ORG,
        departmentId: DEPT,
        q: "search term",
        kind: "PROJECT",
        sortBy: "name",
        sortDir: "asc",
        page: "3",
        sectionId: SECTION,
      }),
    );
    expect(href).toContain("from=explorer");
    expect(href).toContain(`fromOrg=${ORG}`);
    expect(href).toContain("fx_q=search+term");
    expect(href).toContain("fx_page=3");

    const parsed = parseReturnContext(new URL(href, "http://local").searchParams);
    expect(parsed?.from).toBe("explorer");
    const back = resolveReturnHref(parsed!);
    expect(back).toContain("/portfolio/explorer?");
    expect(back).toContain("q=search+term");
    expect(back).toContain("page=3");
    expect(back).toContain(`departmentId=${DEPT}`);
  });

  it("preserves capacity → PI return params", () => {
    const href = appendReturnContext(
      `/pi/${PI}/board`,
      capacityReturnInput({
        organizationId: ORG,
        departmentId: DEPT,
        piId: PI,
      }),
    );
    const parsed = parseReturnContext(new URL(href, "http://local").searchParams);
    expect(resolveReturnHref(parsed!)).toBe(
      `/portfolio/capacity?organizationId=${ORG}&departmentId=${DEPT}&piId=${PI}`,
    );
  });

  it("rejects unsafe paths and external return targets", () => {
    expect(isSafeInternalPath("/portfolio/explorer")).toBe(true);
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
    expect(isSafeInternalPath("/\\evil")).toBe(false);
    expect(
      appendReturnContext("//evil.com", { from: "explorer" }),
    ).toBe("//evil.com");
    expect(parseReturnContext({ from: "https://evil.com" })).toBeNull();
    expect(parseReturnContext({ from: "explorer", fromOrg: "not-a-uuid" })).toEqual(
      expect.objectContaining({ organizationId: null }),
    );
  });

  it("drops oversized or invalid explorer filter values", () => {
    const href = appendReturnContext("/initiatives/x", {
      from: "explorer",
      explorer: {
        q: "x".repeat(200),
        page: "abc",
        ownerResourceId: "not-uuid",
      },
    });
    expect(href).not.toContain("fx_q=");
    expect(href).not.toContain("fx_page=");
    expect(href).not.toContain("fx_ownerResourceId=");
  });
});

describe("M4C-B PI Board/Compare/Review query preservation", () => {
  it("keeps revisionId, revs, ref and return tokens across tabs", () => {
    const current = {
      revisionId: REV_B,
      revs: `${REV_A},${REV_B}`,
      ref: REV_A,
      from: "capacity",
      fromOrg: ORG,
      fromPi: PI,
      fx_q: "should-stay",
    };
    const board = appendPreservedQuery(`/pi/${PI}/board`, current);
    expect(board).toContain(`revisionId=${REV_B}`);
    expect(board).toContain(`from=capacity`);
    expect(board).toContain(`fx_q=should-stay`);

    const compare = appendPreservedQuery(`/pi/${PI}/compare`, current);
    expect(compare).toContain(`revs=${REV_A}%2C${REV_B}`);
    expect(compare).toContain(`ref=${REV_A}`);

    const review = appendPreservedQuery(`/pi/${PI}/review`, current);
    expect(review).toContain(`revisionId=${REV_B}`);
    expect(review).toContain(`fromPi=${PI}`);
  });

  it("rejects non-UUID revision ids and malformed revs lists", () => {
    const bad = appendPreservedQuery(`/pi/${PI}/board`, {
      revisionId: "not-a-uuid",
      revs: "a,b",
      ref: "nope",
    });
    expect(bad).toBe(`/pi/${PI}/board`);
  });
});

describe("M4C-B deep-link and isolation edges", () => {
  it("supports direct deep links without return context", () => {
    expect(parseReturnContext({})).toBeNull();
    const crumbs = buildPiTrail({
      piId: PI,
      referenceKey: "PI-2026-04",
      leaf: "Compare",
      returnContext: null,
    });
    expect(crumbs.map((c) => c.label)).toEqual([
      "Home",
      "PI Planning",
      "PI-2026-04",
      "Compare",
    ]);
  });

  it("does not invent cross-org return destinations from garbage tokens", () => {
    const parsed = parseReturnContext({
      from: "explorer",
      fromOrg: "org-from-other-tenant",
      fromDept: DEPT,
    });
    expect(parsed?.organizationId).toBeNull();
    expect(parsed?.departmentId).toBe(DEPT);
    const href = resolveReturnHref(parsed!);
    expect(href).not.toContain("organizationId=org-from-other-tenant");
  });

  it("M4D-D: home return token resolves and appears on initiative trails", () => {
    const href = appendReturnContext(`/initiatives/${ORG}/project`, {
      from: "home",
      organizationId: ORG,
    });
    expect(href).toContain("from=home");
    const parsed = parseReturnContext(
      Object.fromEntries(new URL(href, "http://x").searchParams),
    );
    expect(parsed?.from).toBe("home");
    expect(resolveReturnHref(parsed!)).toBe("/");

    const crumbs = buildInitiativeTrail({
      initiativeId: ORG,
      referenceKey: "INIT-1",
      leaf: "Project",
      returnContext: parsed,
    });
    // Home is the trail root; from=home must not duplicate a second Home crumb.
    expect(crumbs.filter((c) => c.label === "Home")).toHaveLength(1);
    expect(crumbs.map((c) => c.label)).toEqual([
      "Home",
      "Initiatives",
      "INIT-1",
      "Project",
    ]);
  });
});
