import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../models/Catalog.ts';
import type { StructuralElement } from '../models/StructuralElement.ts';
import { StructuralSceneBuilder } from './StructuralSceneBuilder.ts';

const wall: StructuralElement = {
  id: 1,
  aiAnalysisId: 1,
  elementTypeId: 1,
  materialId: null,
  startX: 0,
  startY: 0,
  endX: 6,
  endY: 0,
  width: null,
  height: 2.5,
  thickness: 0.2,
  confidence: 0.9,
};
const types: CatalogItem[] = [{ id: 1, name: 'Muro', description: '' }];

describe('StructuralSceneBuilder stories', () => {
  it('stacks the typical floor and makes the building that tall', () => {
    const one = new StructuralSceneBuilder().withElements([wall], types, [], 'model').withStories(1).build();
    const twelve = new StructuralSceneBuilder().withElements([wall], types, [], 'model').withStories(12).build();

    expect(twelve.groups.get('Muro')!.children).toHaveLength(12);
    expect(twelve.stories).toBe(12);
    expect(twelve.size.y).toBeCloseTo(one.storyHeight * 12);
    const levels = twelve.groups.get('Muro')!.children.map((c) => c.userData.story);
    expect(levels).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('never stacks fewer than one floor or more than the limit', () => {
    expect(new StructuralSceneBuilder().withElements([wall], types, [], 'model').withStories(0).build().stories).toBe(1);
    expect(new StructuralSceneBuilder().withElements([wall], types, [], 'model').withStories(500).build().stories).toBe(30);
  });
});
