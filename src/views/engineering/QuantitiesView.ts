import { budgetCsv, computeBudget, DEFAULT_AIU, type Aiu, type Budget } from '../../engineering/budget.ts';
import {
  computeTakeoff,
  DEFAULT_PARAMS,
  PARAM_FIELDS,
  type QuantityId,
  type Takeoff,
  type TakeoffElement,
  type TakeoffParams,
} from '../../engineering/quantities.ts';
import { repositories } from '../../data/dataSource.ts';
import type { BudgetInputs } from '../../data/repositories.ts';
import { logActivity } from '../../services/ActivityLogger.ts';
import { AnalysisService, type AnalysisDetail } from '../../services/AnalysisService.ts';
import { CatalogService, nameOf } from '../../services/CatalogService.ts';
import { errorMessage, errorState, loadingState } from '../../ui/states.ts';
import { Toast } from '../../ui/Toast.ts';
import { formatMeters } from '../../utils/format.ts';
import { escapeHtml } from '../../utils/html.ts';
import { View } from '../View.ts';

/** What the user changed on this screen, saved per analysis (see BudgetRepository). */
interface SavedInputs {
  params: Partial<TakeoffParams>;
  prices: Partial<Record<QuantityId, number>>;
  aiu: Partial<Aiu>;
}

const AIU_FIELDS: { key: keyof Aiu; label: string }[] = [
  { key: 'administration', label: 'Administración' },
  { key: 'contingencies', label: 'Imprevistos' },
  { key: 'profit', label: 'Utilidad' },
  { key: 'vatOnProfit', label: 'IVA sobre la utilidad' },
];

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });

/**
 * Quantity take-off and editable budget of one analysis. Quantities are
 * deterministic (src/engineering); prices and parameters are the user's.
 */
export class QuantitiesView extends View {
  title = 'Cantidades y presupuesto';

  private detail: AnalysisDetail | null = null;
  private elements: TakeoffElement[] = [];
  private inputs: SavedInputs = { params: {}, prices: {}, aiu: {} };
  private takeoff: Takeoff | null = null;
  private budget: Budget | null = null;
  private readonly budgets = repositories().budgets();
  /** Only who can edit the analysis saves the budget; others can try values without saving. */
  private canSave = false;

  constructor(private readonly analysisId: number) {
    super();
  }

  protected render(): string {
    return `<div data-page>${loadingState('Calculando cantidades…')}</div>`;
  }

  protected afterRender(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const page = this.root?.querySelector<HTMLElement>('[data-page]');
    if (!page) return;
    try {
      const service = new AnalysisService();
      const [detail, catalogs, saved] = await Promise.all([
        service.get(this.analysisId),
        CatalogService.getInstance().load(),
        this.budgets.find(this.analysisId).catch(() => null),
      ]);
      this.canSave = service.canEdit(detail.project);
      if (detail.analysis.status !== 'COMPLETED') {
        throw new Error('Este análisis no terminó bien, así que no tiene cantidades. Vuelve a analizar el plano.');
      }
      this.detail = detail;
      this.elements = detail.elements.map((e) => ({
        id: e.id,
        type: nameOf(catalogs.elementTypes, e.elementTypeId, 'Otro'),
        material: e.materialId === null ? null : nameOf(catalogs.materials, e.materialId, ''),
        startX: e.startX,
        startY: e.startY,
        endX: e.endX,
        endY: e.endY,
        width: e.width,
        height: e.height,
        thickness: e.thickness,
      }));
      this.inputs = this.readInputs(saved);
      if (!this.root) return;
      document.title = `Presupuesto · ${detail.project.name} · Render.IA`;
      this.renderPage(page);
    } catch (error) {
      page.innerHTML = `<p class="breadcrumb"><a href="#/analyses">Análisis IA</a></p>${errorState(errorMessage(error), false)}`;
    }
  }

  private readInputs(saved: SavedInputs | null): SavedInputs {
    if (saved && typeof saved === 'object') return { params: saved.params ?? {}, prices: saved.prices ?? {}, aiu: saved.aiu ?? {} };
    return { params: {}, prices: {}, aiu: {} };
  }

  /** Saves the inputs in the database (or the browser in the demo). */
  private saveInputs(): void {
    if (!this.canSave) return;
    this.budgets.save(this.analysisId, this.inputs as BudgetInputs).catch((error) => {
      Toast.error(`No se pudo guardar el presupuesto: ${errorMessage(error)}`);
    });
  }

  private compute(): void {
    const params = { ...DEFAULT_PARAMS, ...this.inputs.params };
    this.takeoff = computeTakeoff(this.elements, params);
    this.budget = computeBudget(this.takeoff.lines, this.inputs.prices, { ...DEFAULT_AIU, ...this.inputs.aiu });
  }

  private renderPage(page: HTMLElement): void {
    const { analysis, plan, project } = this.detail!;
    this.compute();
    const facts = this.takeoff!.facts;
    const params = { ...DEFAULT_PARAMS, ...this.inputs.params };
    const aiu = { ...DEFAULT_AIU, ...this.inputs.aiu };

    page.innerHTML = `
      <p class="breadcrumb no-print"><a href="#/analyses">Análisis IA</a> / <a href="#/analyses/${analysis.id}">Análisis #${analysis.id}</a> / Presupuesto</p>
      <header class="page-header page-header--row">
        <div>
          <h1>Cantidades y presupuesto</h1>
          <p class="page-header__lead">${escapeHtml(project.name)}, piso ${plan.floorLevel}. Cantidades calculadas con fórmulas sobre la geometría validada.</p>
          ${this.canSave ? '' : '<p class="page-header__note">Puedes probar otros valores, pero solo quien edita el proyecto guarda el presupuesto.</p>'}
        </div>
        <div class="page-header__actions no-print">
          <button class="button button--ghost" type="button" data-reset>Restablecer valores</button>
          <button class="button button--ghost" type="button" data-csv>Descargar CSV (Excel)</button>
          <button class="button" type="button" data-print>Imprimir o guardar PDF</button>
        </div>
      </header>

      <dl class="facts">
        <div><dt>Largo de muros</dt><dd>${formatMeters(facts.wallLength)}</dd></div>
        <div><dt>Área bruta de muros</dt><dd>${number.format(facts.grossWallArea)} m²</dd></div>
        <div><dt>Área de vanos</dt><dd>${number.format(facts.openingArea)} m²</dd></div>
        <div><dt>Área de losa</dt><dd>${number.format(facts.footprint)} m²</dd></div>
        <div><dt>Elementos usados</dt><dd>${facts.elementsUsed}</dd></div>
      </dl>

      <div class="budget-layout">
        <section class="section budget" aria-labelledby="budget-title">
          <div class="section__header"><h2 id="budget-title">Presupuesto de obra</h2></div>
          <div class="table-wrap">
            <table class="table budget__table">
              <thead>
                <tr><th scope="col">Ítem</th><th scope="col">Und</th><th scope="col" class="num">Cantidad</th><th scope="col" class="num">Valor unitario</th><th scope="col" class="num">Valor total</th></tr>
              </thead>
              <tbody data-lines></tbody>
              <tfoot data-totals></tfoot>
            </table>
          </div>
          <div class="budget__notes" data-notes></div>
        </section>

        <aside class="budget__side no-print" aria-label="Parámetros">
          <section class="budget__card">
            <h2>Parámetros de cálculo</h2>
            <p class="field__hint">Los valores que el plano no dice. Cámbialos según tu proyecto.</p>
            <div class="budget__fields">
              ${PARAM_FIELDS.map(
                (f) => `
                <label class="field field--inline">
                  <span class="field__label">${f.label}</span>
                  <span class="budget__input">
                    <input class="input input--compact" type="text" inputmode="decimal" maxlength="12" data-param="${f.key}"
                      value="${number.format(f.percent ? params[f.key] * 100 : params[f.key])}" />
                    <span>${f.unit}</span>
                  </span>
                </label>`,
              ).join('')}
            </div>
          </section>
          <section class="budget__card">
            <h2>AIU</h2>
            <div class="budget__fields">
              ${AIU_FIELDS.map(
                (f) => `
                <label class="field field--inline">
                  <span class="field__label">${f.label}</span>
                  <span class="budget__input">
                    <input class="input input--compact" type="text" inputmode="decimal" maxlength="12" data-aiu="${f.key}" value="${number.format(aiu[f.key] * 100)}" />
                    <span>%</span>
                  </span>
                </label>`,
              ).join('')}
            </div>
          </section>
        </aside>
      </div>`;

    this.renderTable(page);
    page.querySelectorAll<HTMLInputElement>('[data-param]').forEach((input) =>
      input.addEventListener('change', () => {
        const field = PARAM_FIELDS.find((f) => f.key === input.dataset.param)!;
        const value = this.readNumber(input, field.percent ? 0 : 0.01, field.percent ? 100 : 100_000);
        if (value === null) return;
        this.inputs.params[field.key] = field.percent ? value / 100 : value;
        this.changed(page);
      }),
    );
    page.querySelectorAll<HTMLInputElement>('[data-aiu]').forEach((input) =>
      input.addEventListener('change', () => {
        const value = this.readNumber(input, 0, 100);
        if (value === null) return;
        this.inputs.aiu[input.dataset.aiu as keyof Aiu] = value / 100;
        this.changed(page);
      }),
    );
    page.querySelector('[data-reset]')!.addEventListener('click', () => {
      this.inputs = { params: {}, prices: {}, aiu: {} };
      this.saveInputs();
      this.renderPage(page);
      Toast.success('Se restablecieron los parámetros y los precios de referencia.');
    });
    page.querySelector('[data-csv]')!.addEventListener('click', () => this.downloadCsv());
    page.querySelector('[data-print]')!.addEventListener('click', () => window.print());
  }

  private renderTable(page: HTMLElement): void {
    const budget = this.budget!;
    let chapter = '';
    page.querySelector<HTMLElement>('[data-lines]')!.innerHTML = budget.lines
      .map((line) => {
        const header =
          line.chapter !== chapter
            ? `<tr class="budget__chapter"><th scope="rowgroup" colspan="5">${escapeHtml((chapter = line.chapter))}</th></tr>`
            : '';
        const included = line.id === 'masonryUnits' && line.unitPrice === 0;
        return `${header}
          <tr>
            <td>
              <span class="budget__item">${escapeHtml(line.item)}</span>
              <span class="budget__method">${escapeHtml(line.method)}</span>
            </td>
            <td>${line.unit}</td>
            <td class="num">${number.format(line.quantity)}</td>
            <td class="num">
              <input class="input input--compact budget__price no-print" type="text" inputmode="numeric" maxlength="16" data-price="${line.id}"
                value="${number.format(line.unitPrice)}" aria-label="Valor unitario de ${escapeHtml(line.item)}" />
              <span class="print-only">${money.format(line.unitPrice)}</span>
            </td>
            <td class="num">${included ? '<span class="field__hint">Incluido en el m²</span>' : money.format(line.total)}</td>
          </tr>`;
      })
      .join('');

    const row = (label: string, value: number, strong = false) =>
      `<tr class="${strong ? 'budget__total' : ''}"><th scope="row" colspan="4">${label}</th><td class="num">${money.format(value)}</td></tr>`;
    const aiu = { ...DEFAULT_AIU, ...this.inputs.aiu };
    const pct = (v: number) => `${number.format(v * 100)} %`;
    page.querySelector<HTMLElement>('[data-totals]')!.innerHTML = [
      row('Costo directo', budget.direct),
      row(`Administración (${pct(aiu.administration)})`, budget.administration),
      row(`Imprevistos (${pct(aiu.contingencies)})`, budget.contingencies),
      row(`Utilidad (${pct(aiu.profit)})`, budget.profit),
      row(`IVA sobre la utilidad (${pct(aiu.vatOnProfit)})`, budget.vat),
      row('Valor total', budget.total, true),
    ].join('');

    const notes = [
      ...this.takeoff!.notes,
      'Los precios unitarios iniciales son de referencia: reemplázalos por los de tu cotización local.',
      'El acero es una estimación por cuantía; el valor final sale del despiece del diseño estructural.',
      'Estas cantidades son un apoyo para el profesional y no reemplazan el diseño ni la revisión según la NSR-10.',
    ];
    page.querySelector<HTMLElement>('[data-notes]')!.innerHTML = `<ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`;

    page.querySelectorAll<HTMLInputElement>('[data-price]').forEach((input) =>
      input.addEventListener('change', () => {
        const value = this.readNumber(input, 0, 1_000_000_000);
        if (value === null) return;
        this.inputs.prices[input.dataset.price as QuantityId] = Math.round(value);
        this.changed(page);
      }),
    );
  }

  /** Reads "1.250.000", "12,5" or "12.5"; shows an error and returns null when it is not valid. */
  private readNumber(input: HTMLInputElement, min: number, max: number): number | null {
    const raw = input.value.trim().replace(/\s|\$/g, '');
    // A dot followed by exactly three digits is a thousands separator in es-CO.
    const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.');
    const value = Number(normalized);
    if (!Number.isFinite(value) || value < min || value > max) {
      Toast.error(`Escribe un número entre ${number.format(min)} y ${number.format(max)}.`);
      input.focus();
      return null;
    }
    return value;
  }

  private changed(page: HTMLElement): void {
    this.saveInputs();
    this.compute();
    this.renderTable(page);
  }

  private downloadCsv(): void {
    const { project, plan, analysis } = this.detail!;
    const csv = budgetCsv(this.budget!, `Presupuesto · ${project.name}, piso ${plan.floorLevel} · análisis #${analysis.id}`);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `presupuesto-analisis-${analysis.id}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    logActivity('Presupuesto exportado', `Se exportó el presupuesto del análisis #${analysis.id} en CSV.`);
  }
}

