# ADR-011: Governance Policy Versioning

- Status: Accepted (Phase 4)
- Date: 2026-09-23

## Context

Organizations need to evolve approval requirement templates (authorities, labels, required flags) without rewriting historical submissions. In-flight or completed ApprovalRequests must retain the authority snapshot used at submit time.

## Decision

Version `ApprovalRequirementTemplate` by `(gateType, authorityKey, policyVersion)`. Admin updates supersede the prior row (`active=false`, `supersededAt`) and insert `policyVersion + 1`. Each `GovernanceSubmission` stores `policyVersion`. Each `ApprovalRequest` copies `authorityKey`, `requiredPermission`, and `label` from the active template at create time — historical binding is the request row, not live templates. Unauthorized principals are rejected via `governance.policy.manage`.

## Consequences

Policy changes affect only future submissions. Auditors can explain who was asked to approve a past revision without reconstructing template history. Seeds remain data-driven defaults at policyVersion 1.
