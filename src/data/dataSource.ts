import { AppConfig } from '../core/config/AppConfig.ts';
import { ApiRepositoryFactory } from './api/ApiRepositoryFactory.ts';
import { HybridRepositoryFactory } from './hybrid/HybridRepositoryFactory.ts';
import { MockRepositoryFactory } from './mock/MockRepositoryFactory.ts';
import type { RepositoryFactory } from './RepositoryFactory.ts';

let factory: RepositoryFactory | null = null;

/** Returns the repository family selected by VITE_DATA_SOURCE ("mock", "hybrid" or "api"). */
export function repositories(): RepositoryFactory {
  if (!factory) {
    switch (AppConfig.getInstance().dataSource) {
      case 'api':
        factory = new ApiRepositoryFactory();
        break;
      case 'hybrid':
        factory = new HybridRepositoryFactory();
        break;
      default:
        factory = new MockRepositoryFactory();
    }
  }
  return factory;
}
