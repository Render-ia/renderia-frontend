import * as THREE from 'three';
import { styleFor } from '../analysis/elementStyle.ts';
import type { CatalogItem } from '../models/Catalog.ts';
import type { StructuralElement } from '../models/StructuralElement.ts';
import { nameOf } from '../services/CatalogService.ts';
import { ElementMeshFactory } from './meshes/ElementMeshFactory.ts';

export type ColorMode = 'type' | 'material';

/** Colors used when the model is colored by construction material. */
export const MATERIAL_COLORS: Record<string, string> = {
  'Concreto reforzado': '#a9afad',
  Ladrillo: '#b0613e',
  Acero: '#6d7b86',
  Madera: '#9a6b3e',
  Drywall: '#e6e3dc',
};
const NO_MATERIAL = '#8fc6dd';

export interface StructuralScene {
  scene: THREE.Scene;
  /** The building only (no ground or helpers): what gets exported. */
  model: THREE.Group;
  /** One group per element type, to show or hide them. */
  groups: Map<string, THREE.Group>;
  /** Size of the building footprint in meters. */
  size: THREE.Vector3;
}

/**
 * Pattern: Builder — assembles the 3D scene step by step. Each `with…` call
 * adds one part and returns the builder, and `build()` hands back the result.
 */
export class StructuralSceneBuilder {
  private readonly scene = new THREE.Scene();
  private readonly model = new THREE.Group();
  private readonly groups = new Map<string, THREE.Group>();
  private readonly factory = new ElementMeshFactory();
  private center = new THREE.Vector2();
  private size = new THREE.Vector3(10, 3, 10);

  constructor() {
    this.model.name = 'Render.IA';
    this.scene.add(this.model);
  }

  withBackground(color: string): this {
    this.scene.background = new THREE.Color(color);
    return this;
  }

  withElements(elements: StructuralElement[], types: CatalogItem[], materials: CatalogItem[], colorMode: ColorMode): this {
    this.measure(elements);
    const toScene = (x: number, y: number) => new THREE.Vector2(x - this.center.x, y - this.center.y);

    for (const element of elements) {
      const typeName = nameOf(types, element.elementTypeId, 'Otro');
      const materialName = element.materialId === null ? null : nameOf(materials, element.materialId, '');
      const color =
        colorMode === 'type'
          ? styleFor(typeName).color
          : ((materialName && MATERIAL_COLORS[materialName]) ?? NO_MATERIAL);

      const object = this.factory.creatorFor(typeName).create({ element, typeName, materialName, color, toScene });
      this.groupFor(typeName).add(object);
    }
    return this;
  }

  withGround(): this {
    const extent = Math.max(this.size.x, this.size.z) * 2.5 + 10;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(extent, extent),
      new THREE.MeshStandardMaterial({ color: '#dfe3e0', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.13;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);

    const grid = new THREE.GridHelper(extent, Math.round(extent), '#9fb4c1', '#c9d3d8');
    grid.position.y = -0.12;
    grid.name = 'grid';
    this.scene.add(grid);
    return this;
  }

  withLights(): this {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b7bfbc', 1.1));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    const reach = Math.max(this.size.x, this.size.z);
    sun.position.set(reach * 0.6, reach * 1.2, reach * 0.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const camera = sun.shadow.camera;
    camera.left = -reach;
    camera.right = reach;
    camera.top = reach;
    camera.bottom = -reach;
    camera.far = reach * 4;
    this.scene.add(sun);
    return this;
  }

  build(): StructuralScene {
    return { scene: this.scene, model: this.model, groups: this.groups, size: this.size.clone() };
  }

  private groupFor(typeName: string): THREE.Group {
    let group = this.groups.get(typeName);
    if (!group) {
      group = new THREE.Group();
      group.name = typeName;
      this.groups.set(typeName, group);
      this.model.add(group);
    }
    return group;
  }

  /** Centers the building on the origin. */
  private measure(elements: StructuralElement[]): void {
    if (elements.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const e of elements) {
      for (const [x, y] of [
        [e.startX, e.startY],
        [e.endX ?? e.startX, e.endY ?? e.startY],
      ]) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    this.center.set((minX + maxX) / 2, (minY + maxY) / 2);
    this.size.set(Math.max(1, maxX - minX), 3, Math.max(1, maxY - minY));
  }
}
