import { AppConfig } from '../core/config/AppConfig.ts';
import { ApiRepositoryFactory } from './api/ApiRepositoryFactory.ts';
import { MockRepositoryFactory } from './mock/MockRepositoryFactory.ts';
import type { RepositoryFactory } from './RepositoryFactory.ts';

let factory: RepositoryFactory | null = null;

/** Returns the repository family selected by VITE_DATA_SOURCE ("mock" or "api"). */
export function repositories(): RepositoryFactory {
  if (!factory) {
    factory =
      AppConfig.getInstance().dataSource === 'api'
        ? new ApiRepositoryFactory()
        : new MockRepositoryFactory();
  }
  return factory;
}
