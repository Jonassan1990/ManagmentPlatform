export type VacationApproverCandidate = {
  principalId: string;
  displayName: string;
  roleName: string;
  scopeType: string;
  scopeId: string | null;
};

export type VacationApprover = {
  principalId: string;
  displayName: string;
  roleName: string;
};

/**
 * The approver is the closest manager who can review this request:
 * the department manager, then a parent department, then the section, then the organization.
 */
export function selectClosestApprovers(input: {
  departmentId: string | null;
  sectionId: string | null;
  parentDepartmentIds: string[];
  candidates: VacationApproverCandidate[];
}): VacationApprover[] {
  const ranked = input.candidates
    .map((candidate) => ({
      candidate,
      rank: approverRank(candidate, input),
    }))
    .filter((row) => row.rank < Number.POSITIVE_INFINITY);

  if (ranked.length === 0) return [];
  const best = Math.min(...ranked.map((row) => row.rank));
  const seen = new Set<string>();
  return ranked
    .filter((row) => row.rank === best)
    .map((row) => row.candidate)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .filter((candidate) => {
      if (seen.has(candidate.principalId)) return false;
      seen.add(candidate.principalId);
      return true;
    })
    .map((candidate) => ({
      principalId: candidate.principalId,
      displayName: candidate.displayName,
      roleName: candidate.roleName,
    }));
}

function approverRank(
  candidate: VacationApproverCandidate,
  input: {
    departmentId: string | null;
    sectionId: string | null;
    parentDepartmentIds: string[];
  },
): number {
  if (
    candidate.scopeType === "DEPARTMENT" &&
    input.departmentId &&
    candidate.scopeId === input.departmentId
  ) {
    return 0;
  }
  if (candidate.scopeType === "DEPARTMENT" && candidate.scopeId) {
    const parentIndex = input.parentDepartmentIds.indexOf(candidate.scopeId);
    if (parentIndex >= 0) return 1 + parentIndex;
  }
  if (
    candidate.scopeType === "SECTION" &&
    input.sectionId &&
    candidate.scopeId === input.sectionId
  ) {
    return 50;
  }
  if (candidate.scopeType === "ORGANIZATION") return 80;
  return Number.POSITIVE_INFINITY;
}
