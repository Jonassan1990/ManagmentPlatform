/**
 * Department nesting helpers (same section): parent → children, e.g. INF → INFB.
 */

export type DepartmentTreeRow = {
  id: string;
  sectionId: string;
  parentDepartmentId: string | null;
};

/** Walk parents of `departmentId` until root. Does not include `departmentId` itself. */
export function ancestorDepartmentIds(
  departmentId: string,
  rows: DepartmentTreeRow[],
): string[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ancestors: string[] = [];
  const seen = new Set<string>();
  let cursor = byId.get(departmentId)?.parentDepartmentId ?? null;
  while (cursor) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    ancestors.push(cursor);
    cursor = byId.get(cursor)?.parentDepartmentId ?? null;
  }
  return ancestors;
}

/** All departments under `departmentId` (not including itself). */
export function descendantDepartmentIds(
  departmentId: string,
  rows: DepartmentTreeRow[],
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentDepartmentId) continue;
    const list = childrenOf.get(row.parentDepartmentId) ?? [];
    list.push(row.id);
    childrenOf.set(row.parentDepartmentId, list);
  }
  const out: string[] = [];
  const stack = [...(childrenOf.get(departmentId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of childrenOf.get(id) ?? []) stack.push(child);
  }
  return out;
}

/** True when `maybeAncestorId` appears on the parent chain of `departmentId`. */
export function isAncestorDepartment(
  departmentId: string,
  maybeAncestorId: string,
  rows: DepartmentTreeRow[],
): boolean {
  return ancestorDepartmentIds(departmentId, rows).includes(maybeAncestorId);
}
