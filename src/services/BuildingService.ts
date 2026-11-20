import { AnalysisService, type AnalysisDetail, type AnalysisRow } from './AnalysisService.ts';

/**
 * A building is a project seen in 3D: the newest finished analysis of each of
 * its floor plans, from floor 1 up.
 */
export interface Building {
  projectId: number;
  floors: AnalysisRow[];
}

/** Groups finished analyses into buildings, newest analysis per plan, floors in order. */
export function buildingsOf(rows: AnalysisRow[]): Building[] {
  const newest = new Map<number, AnalysisRow>();
  for (const row of rows) {
    if (row.analysis.status !== 'COMPLETED') continue;
    const kept = newest.get(row.plan.id);
    if (!kept || row.analysis.createdAt > kept.analysis.createdAt) newest.set(row.plan.id, row);
  }
  const byProject = new Map<number, AnalysisRow[]>();
  for (const row of newest.values()) {
    byProject.set(row.project.id, [...(byProject.get(row.project.id) ?? []), row]);
  }
  return [...byProject.entries()]
    .map(([projectId, floors]) => ({
      projectId,
      floors: floors.sort((a, b) => a.plan.floorLevel - b.plan.floorLevel || a.plan.id - b.plan.id),
    }))
    .sort((a, b) => latest(b).localeCompare(latest(a)));
}

function latest(building: Building): string {
  return building.floors.reduce((max, row) => (row.analysis.createdAt > max ? row.analysis.createdAt : max), '');
}

export class BuildingService {
  private readonly analyses = new AnalysisService();

  /** Every floor of a project with its elements, floor 1 first. */
  async floors(projectId: number): Promise<AnalysisDetail[]> {
    const building = buildingsOf(await this.analyses.listVisible()).find((b) => b.projectId === projectId);
    if (!building) throw new Error('Este proyecto todavía no tiene planos analizados para ver en 3D.');
    return Promise.all(building.floors.map((row) => this.analyses.get(row.analysis.id)));
  }
}
