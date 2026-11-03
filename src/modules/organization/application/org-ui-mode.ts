export type OrgUiMode = "view" | "config";

/** Default is View — Config is explicit via ?mode=config. */
export function parseOrgUiMode(
  raw: string | string[] | undefined,
): OrgUiMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "config" ? "config" : "view";
}

/** Append mode=config when staying in Config while navigating the hierarchy. */
export function withOrgMode(path: string, mode: OrgUiMode): string {
  if (mode !== "config") return path;
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const join = withoutHash.includes("?") ? "&" : "?";
  return `${withoutHash}${join}mode=config${hash}`;
}
