import type { CatalogItem } from '../../models/Catalog.ts';
import type { Project, ProjectInput } from '../../models/Project.ts';
import { escapeHtml } from '../../utils/html.ts';

/** Fields of the create/edit project dialog. */
export function projectFields(buildingTypes: CatalogItem[], project?: Project): string {
  const options = buildingTypes
    .map(
      (type) =>
        `<option value="${type.id}" ${project?.buildingTypeId === type.id ? 'selected' : ''}>${escapeHtml(type.name)}</option>`,
    )
    .join('');

  return `
    <label class="field">
      <span class="field__label">Nombre</span>
      <input class="input" name="name" required maxlength="150" value="${escapeHtml(project?.name ?? '')}" />
    </label>
    <div class="form-row">
      <label class="field">
        <span class="field__label">Tipo de edificación</span>
        <select class="select" name="buildingTypeId">
          <option value="">Sin definir</option>
          ${options}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Ubicación</span>
        <input class="input" name="location" maxlength="150" placeholder="Pasto, Nariño" value="${escapeHtml(project?.location ?? '')}" />
      </label>
    </div>
    <label class="field">
      <span class="field__label">Descripción</span>
      <textarea class="textarea" name="description" maxlength="2000">${escapeHtml(project?.description ?? '')}</textarea>
    </label>`;
}

export function readProjectForm(data: FormData): ProjectInput {
  const buildingType = String(data.get('buildingTypeId') ?? '');
  return {
    name: String(data.get('name') ?? ''),
    location: String(data.get('location') ?? ''),
    description: String(data.get('description') ?? ''),
    buildingTypeId: buildingType ? Number(buildingType) : null,
  };
}
