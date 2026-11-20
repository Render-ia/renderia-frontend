import { describe, expect, it } from 'vitest';
import { MockBudgetRepository } from './MockBudgetRepository.ts';

describe('budget inputs in the demo', () => {
  it('saves and reads back the inputs of each analysis separately', async () => {
    const repo = new MockBudgetRepository();
    expect(await repo.find(901)).toBeNull();
    await repo.save(901, { params: { wallHeight: 2.6 }, prices: { masonry: 85000 }, aiu: { profit: 0.05 } });
    expect(await repo.find(901)).toEqual({ params: { wallHeight: 2.6 }, prices: { masonry: 85000 }, aiu: { profit: 0.05 } });
    expect(await repo.find(902)).toBeNull();
  });
});
