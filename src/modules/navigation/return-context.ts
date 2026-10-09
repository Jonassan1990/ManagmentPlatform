/**
 * M4C-B — Validated return / workflow context for shareable URLs.
 * Never accepts arbitrary external URLs (open-redirect safe).
 */

export const RETURN_FROM_TOKENS = [
  "explorer",
  "capacity",
  "health",
  "approvals",
  "decisions",
  "portfolio",
  "pi-list",
] as const;

export type ReturnFromToken = (typeof RETURN_FROM_TOKENS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXPLORER_FILTER_KEYS = [
  "organizationId",
  "departmentId",
  "sectionId",
  "q",
  "kind",
  "initiativeStage",
  "projectStatus",
  "ownerResourceId",
  "delivery",
  "deliveryHealth",
  "sortBy",
  "sortDir",
  "page",
] as const;

const CAPACITY_FILTER_KEYS = [
  "organizationId",
  "departmentId",
  "piId",
] as const;

/** PI workspace query keys preserved across Board / Compare / Review tabs. */
export const PI_CONTEXT_QUERY_KEYS = [
  "revisionId",
  "revs",
  "ref",
  "from",
  "fromOrg",
  "fromDept",
  "fromPi",
  "fx_q",
  "fx_kind",
  "fx_initiativeStage",
  "fx_projectStatus",
  "fx_ownerResourceId",
  "fx_delivery",
  "fx_deliveryHealth",
  "fx_sortBy",
  "fx_sortDir",
  "fx_page",
  "fx_sectionId",
] as const;

export type ReturnContextInput = {
  from: ReturnFromToken;
  organizationId?: string | null;
  departmentId?: string | null;
  piId?: string | null;
  /** Explorer filter bag — only allowlisted keys are kept. */
  explorer?: Partial<Record<(typeof EXPLORER_FILTER_KEYS)[number], string>>;
};

export type ParsedReturnContext = {
  from: ReturnFromToken;
  organizationId: string | null;
  departmentId: string | null;
  piId: string | null;
  explorer: Record<string, string>;
};

export function isReturnFromToken(value: string | null | undefined): value is ReturnFromToken {
  return Boolean(value && (RETURN_FROM_TOKENS as readonly string[]).includes(value));
}

export function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}

/**
 * Serialize return context onto a destination path (relative only).
 */
export function appendReturnContext(
  destinationPath: string,
  input: ReturnContextInput,
): string {
  if (!isSafeInternalPath(destinationPath)) return destinationPath;

  const params = new URLSearchParams();
  params.set("from", input.from);

  if (input.organizationId && isUuid(input.organizationId)) {
    params.set("fromOrg", input.organizationId);
  }
  if (input.departmentId && isUuid(input.departmentId)) {
    params.set("fromDept", input.departmentId);
  }
  if (input.piId && isUuid(input.piId)) {
    params.set("fromPi", input.piId);
  }

  if (input.explorer) {
    for (const key of EXPLORER_FILTER_KEYS) {
      if (key === "organizationId" || key === "departmentId") continue;
      const raw = input.explorer[key];
      if (raw == null || raw === "") continue;
      if (
        (key === "sectionId" || key === "ownerResourceId") &&
        !isUuid(raw)
      ) {
        continue;
      }
      if (key === "page" && !/^\d+$/.test(raw)) continue;
      if (String(raw).length > 120) continue;
      params.set(`fx_${key}`, String(raw));
    }
  }

  const qs = params.toString();
  if (!qs) return destinationPath;
  const sep = destinationPath.includes("?") ? "&" : "?";
  const joined = `${destinationPath}${sep}${qs}`;
  return joined.length > 1800 ? destinationPath : joined;
}

/**
 * Parse return context from a query-param record (e.g. searchParams).
 */
export function parseReturnContext(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): ParsedReturnContext | null {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const v = params[key];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };

  const from = get("from");
  if (!isReturnFromToken(from)) return null;

  const organizationId = get("fromOrg");
  const departmentId = get("fromDept");
  const piId = get("fromPi");

  const explorer: Record<string, string> = {};
  for (const key of EXPLORER_FILTER_KEYS) {
    if (key === "organizationId" || key === "departmentId") continue;
    const raw = get(`fx_${key}`);
    if (raw == null || raw === "") continue;
    if (
      (key === "sectionId" || key === "ownerResourceId") &&
      !isUuid(raw)
    ) {
      continue;
    }
    if (key === "page" && !/^\d+$/.test(raw)) continue;
    if (raw.length > 120) continue;
    explorer[key] = raw;
  }

  return {
    from,
    organizationId: organizationId && isUuid(organizationId) ? organizationId : null,
    departmentId: departmentId && isUuid(departmentId) ? departmentId : null,
    piId: piId && isUuid(piId) ? piId : null,
    explorer,
  };
}

/**
 * Resolve a validated internal return href — never external.
 */
export function resolveReturnHref(ctx: ParsedReturnContext): string | null {
  switch (ctx.from) {
    case "explorer": {
      const params = new URLSearchParams();
      if (ctx.organizationId) params.set("organizationId", ctx.organizationId);
      if (ctx.departmentId) params.set("departmentId", ctx.departmentId);
      for (const [k, v] of Object.entries(ctx.explorer)) {
        params.set(k, v);
      }
      const qs = params.toString();
      return qs ? `/portfolio/explorer?${qs}` : "/portfolio/explorer";
    }
    case "capacity": {
      const params = new URLSearchParams();
      if (ctx.organizationId) params.set("organizationId", ctx.organizationId);
      if (ctx.departmentId) params.set("departmentId", ctx.departmentId);
      if (ctx.piId) params.set("piId", ctx.piId);
      const qs = params.toString();
      return qs ? `/portfolio/capacity?${qs}` : "/portfolio/capacity";
    }
    case "health": {
      const params = new URLSearchParams();
      if (ctx.organizationId) params.set("organizationId", ctx.organizationId);
      if (ctx.departmentId) params.set("departmentId", ctx.departmentId);
      const qs = params.toString();
      return qs ? `/portfolio/health?${qs}` : "/portfolio/health";
    }
    case "approvals":
      return "/approvals";
    case "decisions":
      return "/decisions";
    case "portfolio": {
      const params = new URLSearchParams();
      if (ctx.organizationId) params.set("organizationId", ctx.organizationId);
      if (ctx.departmentId) params.set("departmentId", ctx.departmentId);
      const qs = params.toString();
      return qs ? `/portfolio?${qs}` : "/portfolio";
    }
    case "pi-list":
      return "/pi";
    default:
      return null;
  }
}

export function returnCrumbLabel(from: ReturnFromToken): string {
  switch (from) {
    case "explorer":
      return "Explorer";
    case "capacity":
      return "PI & capacity";
    case "health":
      return "Delivery health";
    case "approvals":
      return "Approvals";
    case "decisions":
      return "Decisions";
    case "portfolio":
      return "Portfolio";
    case "pi-list":
      return "PI Planning";
    default:
      return "Back";
  }
}

/** Relative internal path only — blocks //evil.com and schemes. */
export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  if (path.includes("\\")) return false;
  return true;
}

/**
 * Append allowlisted query keys from the current URL onto a PI tab href.
 */
export function appendPreservedQuery(
  href: string,
  current: URLSearchParams | Record<string, string | string[] | undefined>,
  keys: readonly string[] = PI_CONTEXT_QUERY_KEYS,
): string {
  if (!isSafeInternalPath(href)) return href;
  const params = new URLSearchParams();
  const get = (key: string): string | null => {
    if (current instanceof URLSearchParams) return current.get(key);
    const v = current[key];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };
  for (const key of keys) {
    const value = get(key);
    if (value == null || value === "") continue;
    if (value.length > 200) continue;
    if (
      (key === "revisionId" ||
        key === "ref" ||
        key === "fromOrg" ||
        key === "fromDept" ||
        key === "fromPi") &&
      !isUuid(value) &&
      key !== "revs"
    ) {
      continue;
    }
    if (key === "revs") {
      const parts = value.split(",").filter(Boolean);
      if (parts.length === 0 || parts.some((p) => !isUuid(p))) continue;
    }
    params.set(key, value);
  }
  // Merge with existing href query
  const [path, existingQs] = href.split("?");
  const merged = new URLSearchParams(existingQs ?? "");
  for (const [k, v] of params.entries()) {
    if (!merged.has(k)) merged.set(k, v);
  }
  const qs = merged.toString();
  return qs ? `${path}?${qs}` : path!;
}

export function capacityReturnInput(opts: {
  organizationId?: string | null;
  departmentId?: string | null;
  piId?: string | null;
}): ReturnContextInput {
  return {
    from: "capacity",
    organizationId: opts.organizationId,
    departmentId: opts.departmentId,
    piId: opts.piId,
  };
}

export function explorerReturnInput(
  filters: Partial<Record<(typeof EXPLORER_FILTER_KEYS)[number], string | undefined>>,
): ReturnContextInput {
  const explorer: ReturnContextInput["explorer"] = {};
  for (const key of EXPLORER_FILTER_KEYS) {
    const v = filters[key];
    if (v) explorer[key] = v;
  }
  return {
    from: "explorer",
    organizationId: filters.organizationId,
    departmentId: filters.departmentId,
    explorer,
  };
}

// Silence unused — CAPACITY_FILTER_KEYS documents the contract for capacity.
void CAPACITY_FILTER_KEYS;
