# Authorization matrix (Phase 0C)

Roles are **permission packs**. Scope comes from `RoleBinding`, not from the role name.

| Role | Typical binding scope | Representative capabilities |
|---|---|---|
| Platform Admin | PLATFORM | `platform.bootstrap`, org create (PLATFORM), `role.manage`, `audit.read`, `governance.policy.manage` |
| Organization Admin | ORGANIZATION | Full org structure + initiatives + governance + project + PI |
| Portfolio Manager | ORGANIZATION / SECTION / DEPARTMENT | Initiatives/projects/PoC/Pilot delivery; **no** decision/approval/role admin |
| Section Manager | SECTION | Structure + delivery inside section descendants; PI plan (not baseline) |
| Department Manager | DEPARTMENT | Structure + delivery inside department/teams |
| Team Manager | TEAM | Team structure read/manage, PI allocate/capacity, view initiatives/projects |
| Project Manager | DEPARTMENT (typical) | Project edit / milestones / work items |
| Viewer | any scoped | Read-only (`*.view`, org read, audit read) |

## Scope hierarchy

```text
PLATFORM → PLATFORM requests only
ORGANIZATION → org + descendant SECTION/DEPARTMENT/TEAM (verified)
SECTION → that section + descendant departments/teams (DB)
DEPARTMENT → that department + descendant teams (DB)
TEAM → that team only
```

Child scopes **do not** satisfy ancestor requests.

## Relationship grants (narrow)

| Relationship | Requires | Grants |
|---|---|---|
| Initiative business owner | Resource.linkedPrincipalId = actor | `initiative.view`, `initiative.edit` only |
| Project owner | Resource.linkedPrincipalId = actor | `project.view`, `project.edit` only |

Resource ownership without a Principal link is business accountability only — **no login authority**.

## Explicit non-grants

Business ownership does **not** grant: `approval.*`, `decision.*`, `role.manage`, `pi.baseline`, `platform.bootstrap`, org administration.
