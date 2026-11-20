import type { QuantityId, QuantityLine } from './quantities.ts';

/**
 * Editable budget over the quantity take-off, with Colombian AIU
 * (administración, imprevistos, utilidad) and VAT charged on the utility.
 */

/** Reference unit prices in COP. They are placeholders the user replaces with real quotes. */
export const REFERENCE_PRICES: Record<QuantityId, number> = {
  masonry: 68_000,
  masonryUnits: 0,
  plaster: 28_000,
  paint: 14_000,
  concreteColumns: 1_250_000,
  concreteBeams: 1_200_000,
  concreteSlab: 1_100_000,
  steel: 7_500,
  formwork: 38_000,
  doors: 650_000,
  windows: 380_000,
};

export interface Aiu {
  administration: number;
  contingencies: number;
  profit: number;
  /** VAT rate applied to the profit only. */
  vatOnProfit: number;
}

export const DEFAULT_AIU: Aiu = { administration: 0.1, contingencies: 0.05, profit: 0.05, vatOnProfit: 0.19 };

export interface BudgetLine extends QuantityLine {
  unitPrice: number;
  total: number;
}

export interface Budget {
  lines: BudgetLine[];
  direct: number;
  administration: number;
  contingencies: number;
  profit: number;
  vat: number;
  total: number;
}

/** Lines priced at zero are kept: masonry units are already included in the m² price by default. */
export function computeBudget(lines: QuantityLine[], prices: Partial<Record<QuantityId, number>>, aiu: Aiu = DEFAULT_AIU): Budget {
  const priced = lines.map((line) => {
    const unitPrice = Math.max(0, prices[line.id] ?? REFERENCE_PRICES[line.id] ?? 0);
    return { ...line, unitPrice, total: Math.round(line.quantity * unitPrice) };
  });
  const direct = priced.reduce((sum, line) => sum + line.total, 0);
  const administration = Math.round(direct * aiu.administration);
  const contingencies = Math.round(direct * aiu.contingencies);
  const profit = Math.round(direct * aiu.profit);
  const vat = Math.round(profit * aiu.vatOnProfit);
  return {
    lines: priced,
    direct,
    administration,
    contingencies,
    profit,
    vat,
    total: direct + administration + contingencies + profit + vat,
  };
}

const csvCell = (value: string | number) => {
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value;
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV for Excel in Spanish locales: semicolons, decimal comma and a BOM so accents survive. */
export function budgetCsv(budget: Budget, title: string): string {
  const rows: (string | number)[][] = [
    [title],
    [],
    ['Capítulo', 'Ítem', 'Unidad', 'Cantidad', 'Valor unitario (COP)', 'Valor total (COP)', 'Método'],
    ...budget.lines.map((l) => [l.chapter, l.item, l.unit, l.quantity, l.unitPrice, l.total, l.method]),
    [],
    ['', 'Costo directo', '', '', '', budget.direct],
    ['', 'Administración', '', '', '', budget.administration],
    ['', 'Imprevistos', '', '', '', budget.contingencies],
    ['', 'Utilidad', '', '', '', budget.profit],
    ['', 'IVA sobre la utilidad', '', '', '', budget.vat],
    ['', 'Total', '', '', '', budget.total],
  ];
  return '﻿' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}
