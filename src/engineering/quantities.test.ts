import { describe, expect, it } from 'vitest';
import { budgetCsv, computeBudget, DEFAULT_AIU } from './budget.ts';
import { computeTakeoff, DEFAULT_PARAMS, isInsideWall, type TakeoffElement } from './quantities.ts';

let nextId = 1;
const el = (type: string, x1: number, y1: number, x2: number | null, y2: number | null, extra: Partial<TakeoffElement> = {}): TakeoffElement => ({
  id: nextId++, type, material: null, startX: x1, startY: y1, endX: x2, endY: y2, width: null, height: null, thickness: null, ...extra,
});

const line = (takeoff: ReturnType<typeof computeTakeoff>, id: string) => takeoff.lines.find((l) => l.id === id)!;
const noWaste = { ...DEFAULT_PARAMS, masonryWaste: 0, concreteWaste: 0 };

describe('quantity take-off', () => {
  it('computes masonry as length × height of the walls', () => {
    const takeoff = computeTakeoff([el('Muro', 0, 0, 4, 0, { height: 2.5 }), el('Muro', 0, 0, 0, 3, { height: 2.5 })], noWaste);
    expect(line(takeoff, 'masonry').quantity).toBe(17.5);
    expect(line(takeoff, 'masonryUnits').quantity).toBe(Math.ceil(17.5 * 13));
    expect(line(takeoff, 'plaster').quantity).toBe(35);
  });

  it('subtracts an opening drawn inside a wall', () => {
    const wall = el('Muro', 0, 0, 5, 0, { height: 2.5, thickness: 0.15 });
    const door = el('Puerta', 2, 0, 2.9, 0, { width: 0.9, height: 2.1 });
    expect(isInsideWall(door, [wall])).toBe(true);
    expect(line(computeTakeoff([wall, door], noWaste), 'masonry').quantity).toBe(12.5 - 1.89);
  });

  it('adds the lintel above an opening that sits in a gap between walls', () => {
    const left = el('Muro', 0, 0, 2, 0, { height: 2.5 });
    const right = el('Muro', 2.9, 0, 5, 0, { height: 2.5 });
    const door = el('Puerta', 2, 0, 2.9, 0, { width: 0.9, height: 2.1 });
    expect(isInsideWall(door, [left, right])).toBe(false);
    // 4.1 m of wall × 2.5 m + 0.9 m × 0.4 m of lintel
    expect(line(computeTakeoff([left, right, door], noWaste), 'masonry').quantity).toBe(10.61);
  });

  it('computes concrete volumes and estimates steel by ratio', () => {
    const takeoff = computeTakeoff(
      [
        el('Columna', 0, 0, null, null, { width: 0.3, thickness: 0.3, height: 2.8 }),
        el('Viga', 0, 0, 4, 0, { width: 0.25, height: 0.35 }),
        el('Losa', 0, 0, 10, 8, { thickness: 0.12 }),
      ],
      noWaste,
    );
    expect(line(takeoff, 'concreteColumns').quantity).toBe(0.252);
    expect(line(takeoff, 'concreteBeams').quantity).toBe(0.35);
    expect(line(takeoff, 'concreteSlab').quantity).toBe(9.6);
    expect(line(takeoff, 'steel').quantity).toBe(Math.round(0.252 * 160 + 0.35 * 130 + 9.6 * 90));
    expect(takeoff.facts.footprint).toBe(80);
  });

  it('applies waste and explains the method', () => {
    const takeoff = computeTakeoff([el('Muro', 0, 0, 4, 0, { height: 2.5 })]);
    expect(line(takeoff, 'masonry').quantity).toBe(10.5);
    expect(line(takeoff, 'masonry').method).toContain('5 %');
  });

  it('warns when the analysis has no walls or slab', () => {
    expect(computeTakeoff([]).notes).toHaveLength(2);
  });
});

describe('budget', () => {
  it('adds AIU and VAT on the profit to the direct cost', () => {
    const takeoff = computeTakeoff([el('Muro', 0, 0, 4, 0, { height: 2.5 })], noWaste);
    const budget = computeBudget(takeoff.lines, { masonry: 100_000, plaster: 0, paint: 0 }, DEFAULT_AIU);
    expect(budget.direct).toBe(1_000_000);
    expect(budget.administration).toBe(100_000);
    expect(budget.contingencies).toBe(50_000);
    expect(budget.profit).toBe(50_000);
    expect(budget.vat).toBe(9_500);
    expect(budget.total).toBe(1_209_500);
  });

  it('exports CSV for Spanish Excel', () => {
    const takeoff = computeTakeoff([el('Muro', 0, 0, 4, 0, { height: 2.5 })], noWaste);
    const csv = budgetCsv(computeBudget(takeoff.lines, {}), 'Casa; piso 1');
    expect(csv.startsWith('﻿"Casa; piso 1"')).toBe(true);
    expect(csv).toContain('Muro en mampostería;m²;10;68000;680000');
  });
});
