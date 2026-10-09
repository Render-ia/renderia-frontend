import type { RepositoryFactory } from '../RepositoryFactory.ts';
import { ApiActivityRepository } from './ApiActivityRepository.ts';
import { ApiAnalysisRepository } from './ApiAnalysisRepository.ts';
import { ApiAuthRepository } from './ApiAuthRepository.ts';
import { ApiCatalogRepository } from './ApiCatalogRepository.ts';
import { ApiFloorPlanRepository } from './ApiFloorPlanRepository.ts';
import { ApiModel3DRepository } from './ApiModel3DRepository.ts';
import { ApiProjectRepository } from './ApiProjectRepository.ts';
import { ApiUserRepository } from './ApiUserRepository.ts';

/** Concrete factory: repositories that call the Spring Boot backend. */
export class ApiRepositoryFactory implements RepositoryFactory {
  auth() {
    return new ApiAuthRepository();
  }
  users() {
    return new ApiUserRepository();
  }
  catalogs() {
    return new ApiCatalogRepository();
  }
  projects() {
    return new ApiProjectRepository();
  }
  floorPlans() {
    return new ApiFloorPlanRepository();
  }
  analyses() {
    return new ApiAnalysisRepository();
  }
  models3d() {
    return new ApiModel3DRepository();
  }
  activity() {
    return new ApiActivityRepository();
  }
}
