/**
 * Governance facade — Phase 1B compatibility entry point.
 *
 * Composes Governance Core, PoC, Pilot, and Project conversion services.
 * Preserves existing public method signatures for Server Actions, UI, and tests.
 * Prefer this entry point from container / callers.
 */

import { PrismaClient } from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { GovernanceCoreService } from "./governance-core-service";
import { PilotService } from "./pilot-service";
import { PoCService } from "./poc-service";
import { ProjectConversionService } from "./project-conversion-service";

export class GovernanceService {
  readonly core: GovernanceCoreService;
  readonly poc: PoCService;
  readonly pilot: PilotService;
  readonly conversion: ProjectConversionService;

  constructor(
    db: PrismaClient,
    authz: AuthorizationService,
    audit: AuditService,
  ) {
    this.core = new GovernanceCoreService(db, authz, audit);
    this.poc = new PoCService(db, authz, audit);
    this.pilot = new PilotService(db, authz, audit);
    this.conversion = new ProjectConversionService(db, authz, audit);
  }

  // ---- Governance Core ----

  ensureTemplates = (...args: Parameters<GovernanceCoreService["ensureTemplates"]>) =>
    this.core.ensureTemplates(...args);

  submitPreStudyForGovernance = (
    ...args: Parameters<GovernanceCoreService["submitPreStudyForGovernance"]>
  ) => this.core.submitPreStudyForGovernance(...args);

  submitPoCForGovernance = (
    ...args: Parameters<GovernanceCoreService["submitPoCForGovernance"]>
  ) => this.core.submitPoCForGovernance(...args);

  submitPilotForGovernance = (
    ...args: Parameters<GovernanceCoreService["submitPilotForGovernance"]>
  ) => this.core.submitPilotForGovernance(...args);

  reviseGovernanceSubmission = (
    ...args: Parameters<GovernanceCoreService["reviseGovernanceSubmission"]>
  ) => this.core.reviseGovernanceSubmission(...args);

  recordApproval = (
    ...args: Parameters<GovernanceCoreService["recordApproval"]>
  ) => this.core.recordApproval(...args);

  getDecisionPackageView = (
    ...args: Parameters<GovernanceCoreService["getDecisionPackageView"]>
  ) => this.core.getDecisionPackageView(...args);

  recordDecision = (
    ...args: Parameters<GovernanceCoreService["recordDecision"]>
  ) => this.core.recordDecision(...args);

  resolveDecisionCondition = (
    ...args: Parameters<GovernanceCoreService["resolveDecisionCondition"]>
  ) => this.core.resolveDecisionCondition(...args);

  listApprovalTemplates = (
    ...args: Parameters<GovernanceCoreService["listApprovalTemplates"]>
  ) => this.core.listApprovalTemplates(...args);

  updateApprovalTemplate = (
    ...args: Parameters<GovernanceCoreService["updateApprovalTemplate"]>
  ) => this.core.updateApprovalTemplate(...args);

  getPrincipalCapabilities = (
    ...args: Parameters<GovernanceCoreService["getPrincipalCapabilities"]>
  ) => this.core.getPrincipalCapabilities(...args);

  listMyApprovals = (
    ...args: Parameters<GovernanceCoreService["listMyApprovals"]>
  ) => this.core.listMyApprovals(...args);

  listMyDecisions = (
    ...args: Parameters<GovernanceCoreService["listMyDecisions"]>
  ) => this.core.listMyDecisions(...args);

  getGateWorkspace = (
    ...args: Parameters<GovernanceCoreService["getGateWorkspace"]>
  ) => this.core.getGateWorkspace(...args);

  computeOverviewGovernanceMetrics = (
    ...args: Parameters<GovernanceCoreService["computeOverviewGovernanceMetrics"]>
  ) => this.core.computeOverviewGovernanceMetrics(...args);

  // ---- PoC (Experimentation) ----

  createPoC = (...args: Parameters<PoCService["createPoC"]>) =>
    this.poc.createPoC(...args);
  updatePoC = (...args: Parameters<PoCService["updatePoC"]>) =>
    this.poc.updatePoC(...args);
  transitionPoC = (...args: Parameters<PoCService["transitionPoC"]>) =>
    this.poc.transitionPoC(...args);
  upsertPoCCriterion = (...args: Parameters<PoCService["upsertPoCCriterion"]>) =>
    this.poc.upsertPoCCriterion(...args);
  updateCriterionEvaluation = (
    ...args: Parameters<PoCService["updateCriterionEvaluation"]>
  ) => this.poc.updateCriterionEvaluation(...args);
  updatePoCResults = (...args: Parameters<PoCService["updatePoCResults"]>) =>
    this.poc.updatePoCResults(...args);

  // ---- Pilot (Experimentation) ----

  createPilot = (...args: Parameters<PilotService["createPilot"]>) =>
    this.pilot.createPilot(...args);
  updatePilot = (...args: Parameters<PilotService["updatePilot"]>) =>
    this.pilot.updatePilot(...args);
  transitionPilot = (...args: Parameters<PilotService["transitionPilot"]>) =>
    this.pilot.transitionPilot(...args);
  upsertPilotCriterion = (
    ...args: Parameters<PilotService["upsertPilotCriterion"]>
  ) => this.pilot.upsertPilotCriterion(...args);
  evaluatePilotCriterion = (
    ...args: Parameters<PilotService["evaluatePilotCriterion"]>
  ) => this.pilot.evaluatePilotCriterion(...args);
  updatePilotResults = (
    ...args: Parameters<PilotService["updatePilotResults"]>
  ) => this.pilot.updatePilotResults(...args);
  addPilotFeedback = (...args: Parameters<PilotService["addPilotFeedback"]>) =>
    this.pilot.addPilotFeedback(...args);

  // ---- Project conversion ----

  convertToProject = (
    ...args: Parameters<ProjectConversionService["convertToProject"]>
  ) => this.conversion.convertToProject(...args);
}
