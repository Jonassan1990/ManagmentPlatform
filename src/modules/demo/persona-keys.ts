/**
 * Cookie keys for the admin "view as person" drawer.
 * Always prefer principal:<uuid> so values never contain spaces
 * (department codes like "IN MT" break raw cookie values).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isImpersonationKey(key: string | null | undefined): key is string {
  if (!key) return false;
  if (key.startsWith("principal:")) {
    return UUID_RE.test(key.slice("principal:".length));
  }
  // Legacy cookie values (may fail in browsers when they contain spaces).
  if (key.startsWith("sheet-manager:") || key.startsWith("sheet-user:")) {
    return key.length > "sheet-manager:".length;
  }
  if (key.startsWith("demo:")) {
    return key.length > "demo:".length;
  }
  return false;
}

export function principalIdFromImpersonationKey(
  key: string,
): string | null {
  if (!isImpersonationKey(key)) return null;
  if (key.startsWith("principal:")) return key.slice("principal:".length);
  return null;
}

/** Stable cookie-safe key — never embed department codes with spaces. */
export function impersonationKeyForPrincipal(input: {
  id: string;
  externalSubject?: string | null;
}): string {
  return `principal:${input.id}`;
}

export type PersonSearchFields = {
  displayName: string;
  levelLabel?: string | null;
  optionLabel?: string | null;
  username?: string | null;
  departmentCode?: string | null;
  role?: string | null;
};

/** Client- and server-safe search used by the admin person drawer. */
export function matchesPersonQuery(
  person: PersonSearchFields,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    person.displayName,
    person.levelLabel,
    person.optionLabel,
    person.username,
    person.departmentCode,
    person.role,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

export function partitionPeopleByGroup<
  T extends { group?: string | null },
>(rows: T[]): { managers: T[]; people: T[] } {
  const managers = rows.filter(
    (row) => row.group === "managers" || row.group === "sheet-managers",
  );
  const people = rows.filter(
    (row) => row.group !== "managers" && row.group !== "sheet-managers",
  );
  return { managers, people };
}
