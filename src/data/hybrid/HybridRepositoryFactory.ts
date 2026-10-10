import type { RepositoryFactory } from '../RepositoryFactory.ts';
import { ApiRepositoryFactory } from '../api/ApiRepositoryFactory.ts';
import { MockRepositoryFactory } from '../mock/MockRepositoryFactory.ts';
import { HybridCatalogRepository } from './HybridCatalogRepository.ts';

/**
 * Concrete factory for the migration to the real backend: the parts the
 * backend already serves (login, registration and catalogs) go to the API,
 * the rest keeps using the in-browser data until its endpoints exist.
 *
 * Pattern: Abstract Factory — the views still ask for repositories the same way.
 */
export class HybridRepositoryFactory implements RepositoryFactory {
  private readonly api = new ApiRepositoryFactory();
  private readonly mock = new MockRepositoryFactory();

  auth() {
    return this.api.auth();
  }
  users() {
    return this.mock.users();
  }
  catalogs() {
    return new HybridCatalogRepository(this.api.catalogs(), this.mock.catalogs());
  }
  projects() {
    return this.mock.projects();
  }
  floorPlans() {
    return this.mock.floorPlans();
  }
  analyses() {
    return this.mock.analyses();
  }
  models3d() {
    return this.mock.models3d();
  }
  activity() {
    return this.mock.activity();
  }
}
