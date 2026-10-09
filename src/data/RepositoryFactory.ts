import type {
  ActivityRepository,
  AnalysisRepository,
  AuthRepository,
  CatalogRepository,
  FloorPlanRepository,
  Model3DRepository,
  ProjectRepository,
  UserRepository,
} from './repositories.ts';

/**
 * Pattern: Abstract Factory — creates a whole family of repositories that work
 * together. The mock family keeps everything in the browser; the API family
 * talks to the Spring Boot backend. Swapping families needs no view changes.
 */
export interface RepositoryFactory {
  auth(): AuthRepository;
  users(): UserRepository;
  catalogs(): CatalogRepository;
  projects(): ProjectRepository;
  floorPlans(): FloorPlanRepository;
  analyses(): AnalysisRepository;
  models3d(): Model3DRepository;
  activity(): ActivityRepository;
}
