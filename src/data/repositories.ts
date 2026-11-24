import type { ElementChanges } from '../analysis/commands/ElementCommand.ts';
import type { AiAnalysis } from '../models/AiAnalysis.ts';
import type { ActivityLog } from '../models/ActivityLog.ts';
import type { AiModel, CatalogItem, CatalogName } from '../models/Catalog.ts';
import type { FloorPlan, FloorPlanInput } from '../models/FloorPlan.ts';
import type { Model3D } from '../models/Model3D.ts';
import type { Project, ProjectInput } from '../models/Project.ts';
import type { ProjectMember } from '../models/ProjectMember.ts';
import type { Role } from '../models/Role.ts';
import type { StructuralElement, StructuralElementInput } from '../models/StructuralElement.ts';
import type { RegisterData, UserWithRole } from '../models/User.ts';

/*
 * Repository contracts. Views and services only depend on these interfaces;
 * the concrete classes (in-browser mock or Java backend) are chosen by the
 * RepositoryFactory.
 */

export interface AuthResult {
  token: string;
  user: UserWithRole;
}

export interface AuthRepository {
  login(email: string, password: string): Promise<AuthResult>;
  register(data: RegisterData): Promise<AuthResult>;
  /** Opens a session with the demo account of a role, without sending its password. */
  demoLogin(role: string): Promise<AuthResult>;
  /** Returns the user that owns the token, or null if it expired. */
  me(token: string): Promise<UserWithRole | null>;
}

export interface UserRepository {
  findAll(): Promise<UserWithRole[]>;
  update(id: number, changes: { roleId?: number; isActive?: boolean }): Promise<UserWithRole>;
  listRoles(): Promise<Role[]>;
}

export interface CatalogRepository {
  list(catalog: CatalogName): Promise<CatalogItem[]>;
  create(catalog: CatalogName, input: Omit<CatalogItem, 'id'>): Promise<CatalogItem>;
  update(catalog: CatalogName, id: number, input: Omit<CatalogItem, 'id'>): Promise<CatalogItem>;
  remove(catalog: CatalogName, id: number): Promise<void>;
  listAiModels(): Promise<AiModel[]>;
  updateAiModel(id: number, changes: { isActive?: boolean; isDefault?: boolean }): Promise<AiModel>;
}

export interface ProjectRepository {
  /** All projects, or only the ones owned by `ownerId`. */
  findAll(ownerId?: number): Promise<Project[]>;
  /** Projects the user owns plus the ones shared with them. */
  findAccessible(userId: number): Promise<Project[]>;
  members(projectId: number): Promise<ProjectMember[]>;
  share(projectId: number, email: string): Promise<ProjectMember>;
  unshare(projectId: number, userId: number): Promise<void>;
  findById(id: number): Promise<Project | null>;
  create(ownerId: number, input: ProjectInput): Promise<Project>;
  update(id: number, input: ProjectInput): Promise<Project>;
  remove(id: number): Promise<void>;
}

/** Image ready to be stored: a data URL for the browser and a Blob for uploads. */
export interface PreparedImage {
  dataUrl: string;
  blob: Blob;
}

export interface FloorPlanRepository {
  findAll(): Promise<FloorPlan[]>;
  findByProject(projectId: number): Promise<FloorPlan[]>;
  findById(id: number): Promise<FloorPlan | null>;
  create(input: Omit<FloorPlanInput, 'fileUrl'>, image: PreparedImage): Promise<FloorPlan>;
  remove(id: number): Promise<void>;
}

export interface AnalysisRepository {
  findAll(): Promise<AiAnalysis[]>;
  findById(id: number): Promise<AiAnalysis | null>;
  create(floorPlanId: number, aiModelId: number): Promise<AiAnalysis>;
  /**
   * Runs the whole cycle on the server (create → AI → elements → 3D model) and
   * returns the finished analysis, COMPLETED or FAILED. Only the real backend has it.
   */
  runOnServer?(floorPlanId: number, aiModelId: number, scale: string): Promise<AiAnalysis>;
  update(id: number, changes: Partial<Omit<AiAnalysis, 'id'>>): Promise<AiAnalysis>;
  /** Signs the analysis off; the backend stamps who and when in raw_response. */
  review(id: number, reviewerName: string): Promise<AiAnalysis>;
  remove(id: number): Promise<void>;
  findElements(analysisId: number): Promise<StructuralElement[]>;
  saveElements(analysisId: number, elements: StructuralElementInput[]): Promise<StructuralElement[]>;
  updateElement(
    id: number,
    changes: ElementChanges,
  ): Promise<StructuralElement>;
  removeElement(id: number): Promise<void>;
}

export interface Model3DRepository {
  findAll(): Promise<Model3D[]>;
  findByAnalysis(analysisId: number): Promise<Model3D | null>;
  create(input: Omit<Model3D, 'id' | 'createdAt'>): Promise<Model3D>;
}

export interface ActivityRepository {
  findRecent(limit: number, userId?: number): Promise<ActivityLog[]>;
  create(userId: number | null, action: string, details: string): Promise<ActivityLog>;
}

/** What the user changed on the budget screen of one analysis: parameters, unit prices and AIU. */
export interface BudgetInputs {
  params: Record<string, number>;
  prices: Record<string, number>;
  aiu: Record<string, number>;
}

export interface BudgetRepository {
  /** Saved inputs of the analysis, or null when nothing was saved yet. */
  find(analysisId: number): Promise<BudgetInputs | null>;
  save(analysisId: number, inputs: BudgetInputs): Promise<void>;
}
