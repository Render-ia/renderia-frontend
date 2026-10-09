import type { RepositoryFactory } from '../RepositoryFactory.ts';
import { MockActivityRepository } from './MockActivityRepository.ts';
import { MockAnalysisRepository } from './MockAnalysisRepository.ts';
import { MockAuthRepository } from './MockAuthRepository.ts';
import { MockCatalogRepository } from './MockCatalogRepository.ts';
import { MockFloorPlanRepository } from './MockFloorPlanRepository.ts';
import { MockModel3DRepository } from './MockModel3DRepository.ts';
import { MockProjectRepository } from './MockProjectRepository.ts';
import { MockUserRepository } from './MockUserRepository.ts';

/** Concrete factory: repositories backed by the in-browser database. */
export class MockRepositoryFactory implements RepositoryFactory {
  auth() {
    return new MockAuthRepository();
  }
  users() {
    return new MockUserRepository();
  }
  catalogs() {
    return new MockCatalogRepository();
  }
  projects() {
    return new MockProjectRepository();
  }
  floorPlans() {
    return new MockFloorPlanRepository();
  }
  analyses() {
    return new MockAnalysisRepository();
  }
  models3d() {
    return new MockModel3DRepository();
  }
  activity() {
    return new MockActivityRepository();
  }
}
