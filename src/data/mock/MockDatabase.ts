import { LocalStore } from '../../core/storage/LocalStore.ts';
import type { AiAnalysis } from '../../models/AiAnalysis.ts';
import type { ActivityLog } from '../../models/ActivityLog.ts';
import type { AiModel, CatalogItem } from '../../models/Catalog.ts';
import type { FloorPlan } from '../../models/FloorPlan.ts';
import type { Model3D } from '../../models/Model3D.ts';
import type { Project } from '../../models/Project.ts';
import type { Role } from '../../models/Role.ts';
import type { StructuralElement } from '../../models/StructuralElement.ts';
import type { User } from '../../models/User.ts';
import { createSeed } from './seed.ts';

/** Stored user row, including the password hash (never leaves the mock layer). */
export interface UserRow extends User {
  passwordHash: string;
}

export interface SessionRow {
  token: string;
  userId: number;
}

/** The 12 tables of schema.sql plus the demo sessions. */
export interface Tables {
  roles: Role[];
  users: UserRow[];
  buildingTypes: CatalogItem[];
  elementTypes: CatalogItem[];
  materials: CatalogItem[];
  aiModels: AiModel[];
  projects: Project[];
  floorPlans: FloorPlan[];
  analyses: AiAnalysis[];
  elements: StructuralElement[];
  models3d: Model3D[];
  activity: ActivityLog[];
  sessions: SessionRow[];
}

type TableName = keyof Tables;

const STORAGE_KEY = 'renderia.db.v1';

/**
 * In-browser copy of the PostgreSQL database, saved in localStorage. Lets the
 * whole frontend work and be demoed before the backend endpoints exist.
 *
 * Pattern: Singleton — every mock repository reads and writes the same data.
 */
export class MockDatabase {
  private static instance: MockDatabase | null = null;

  private tables: Tables;

  private constructor() {
    this.tables = LocalStore.read<Tables | null>(STORAGE_KEY, null) ?? createSeed();
    this.save();
  }

  static getInstance(): MockDatabase {
    if (!MockDatabase.instance) {
      MockDatabase.instance = new MockDatabase();
    }
    return MockDatabase.instance;
  }

  table<K extends TableName>(name: K): Tables[K] {
    return this.tables[name];
  }

  nextId(name: Exclude<TableName, 'sessions'>): number {
    const rows = this.tables[name] as { id: number }[];
    return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  }

  insert<K extends Exclude<TableName, 'sessions'>>(name: K, row: Tables[K][number]): Tables[K][number] {
    (this.tables[name] as Tables[K][number][]).push(row);
    this.save();
    return row;
  }

  /** Persists the tables. Throws when the browser storage is full. */
  save(): void {
    if (!LocalStore.write(STORAGE_KEY, this.tables)) {
      throw new Error('El almacenamiento del navegador está lleno. Elimina planos que ya no uses.');
    }
  }

  /** Deletes everything and loads the initial data again. */
  reset(): void {
    this.tables = createSeed();
    this.save();
  }
}

export function now(): string {
  return new Date().toISOString();
}

/** Small pause so the mock feels like a network call (loading states are visible). */
export function latency(ms = 120): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
