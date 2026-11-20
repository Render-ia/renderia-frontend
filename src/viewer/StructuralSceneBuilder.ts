import * as THREE from 'three';
import type { CatalogItem } from '../models/Catalog.ts';
import type { StructuralElement } from '../models/StructuralElement.ts';
import { nameOf } from '../services/CatalogService.ts';
import { ElementMeshFactory } from './meshes/ElementMeshFactory.ts';
import { colorFor, isFinish, MAX_STORIES, type ColorMode } from './studio.ts';

export type { ColorMode } from './studio.ts';

/** Dark studio where the model is shown, like a model on a dark table. */
const STUDIO = {
  background: '#1b2430',
  ground: '#202b38',
  gridMajor: '#3a4b61',
  gridMinor: '#2a3747',
};

export interface StructuralScene {
  scene: THREE.Scene;
  /** The building only (no ground or helpers): what gets exported. */
  model: THREE.Group;
  /** One group per element type, to show or hide them. */
  groups: Map<string, THREE.Group>;
  /** Size of the building in meters (x and z: footprint, y: total height). */
  size: THREE.Vector3;
  /** Height of one floor in meters and how many floors are stacked. */
  storyHeight: number;
  stories: number;
  /** Presentation finishes: textured surfaces lit by an environment map. */
  realistic: boolean;
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
  private storyHeight = 3;
  private stories = 1;
  private realistic = false;

  constructor() {
    this.model.name = 'Render.IA';
    this.scene.add(this.model);
  }

  withBackground(color: string = STUDIO.background): this {
    this.scene.background = new THREE.Color(color);
    this.scene.fog = new THREE.Fog(color, 30, 90);
    return this;
  }

  withElements(elements: StructuralElement[], types: CatalogItem[], materials: CatalogItem[], colorMode: ColorMode): this {
    this.measure(elements);
    this.realistic = isFinish(colorMode);
    this.addElements(elements, types, materials, colorMode);
    return this;
  }

  /**
   * A building with one analyzed plan per floor: floors[0] is floor 1, floors[1]
   * floor 2, and so on. Every floor keeps its own elements, so each one can be
   * shown alone or the whole building at once.
   */
  withFloors(floors: StructuralElement[][], types: CatalogItem[], materials: CatalogItem[], colorMode: ColorMode): this {
    const levels = floors.slice(0, MAX_STORIES);
    this.measure(levels.flat());
    this.realistic = isFinish(colorMode);
    levels.forEach((elements, index) => {
      if (index === 1) {
        const box = new THREE.Box3().setFromObject(this.model);
        if (!box.isEmpty()) this.storyHeight = Math.max(2.4, box.max.y - Math.min(0, box.min.y));
      }
      this.addElements(elements, types, materials, colorMode, index + 1, index * this.storyHeight);
    });
    this.stories = Math.max(1, levels.length);
    this.size.y = this.storyHeight * this.stories;
    this.liftFog();
    return this;
  }

  private addElements(
    elements: StructuralElement[],
    types: CatalogItem[],
    materials: CatalogItem[],
    colorMode: ColorMode,
    story?: number,
    lift = 0,
  ): void {
    const wallColor = colorFor(colorMode, 'Muro', 'Ladrillo');
    const toScene = (x: number, y: number) => new THREE.Vector2(x - this.center.x, y - this.center.y);

    for (const element of elements) {
      const typeName = nameOf(types, element.elementTypeId, 'Otro');
      const materialName = element.materialId === null ? null : nameOf(materials, element.materialId, '');
      const color = colorFor(colorMode, typeName, materialName);

      const object = this.factory.creatorFor(typeName).create({
        element,
        typeName,
        materialName,
        color,
        wallColor,
        realistic: this.realistic,
        toScene,
      });
      if (story !== undefined) {
        object.position.y += lift;
        object.userData.story = story;
      }
      this.groupFor(typeName).add(object);
    }
  }

  /**
   * Repeats the analyzed floor plan `count` times, one on top of the other,
   * to show the whole building from its typical floor. Each copy keeps the
   * element data, so layers, picking and section cuts work on every floor.
   */
  withStories(count: number): this {
    const box = new THREE.Box3().setFromObject(this.model);
    if (!box.isEmpty()) this.storyHeight = Math.max(2.4, box.max.y - Math.min(0, box.min.y));
    this.stories = Math.max(1, Math.min(MAX_STORIES, Math.round(count)));
    for (const group of this.groups.values()) {
      const floor = [...group.children];
      floor.forEach((object) => (object.userData.story = 1));
      for (let story = 2; story <= this.stories; story++) {
        for (const object of floor) {
          const copy = object.clone();
          copy.position.y += (story - 1) * this.storyHeight;
          copy.userData.story = story;
          group.add(copy);
        }
      }
    }
    this.size.y = this.storyHeight * this.stories;
    this.liftFog();
    return this;
  }

  /** Taller buildings push the fog back so the top floors stay sharp. */
  private liftFog(): void {
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near += this.size.y;
      this.scene.fog.far += this.size.y * 2;
    }
  }

  withGround(): this {
    const extent = Math.max(this.size.x, this.size.z) * 2.5 + 10;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(extent, extent),
      new THREE.MeshStandardMaterial({ color: STUDIO.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.13;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);

    const grid = new THREE.GridHelper(extent, Math.round(extent), STUDIO.gridMajor, STUDIO.gridMinor);
    grid.position.y = -0.12;
    grid.name = 'grid';
    this.scene.add(grid);
    return this;
  }

  withLights(): this {
    // With the finishes the environment map adds light, so the lamps go down.
    this.scene.add(new THREE.HemisphereLight('#dfe8f5', STUDIO.background, this.realistic ? 0.5 : 1.2));
    const sun = new THREE.DirectionalLight('#fff4e0', this.realistic ? 1.5 : 2.6);
    const reach = Math.max(this.size.x, this.size.z, this.size.y);
    sun.position.set(reach * 0.6, reach * 1.2, reach * 0.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    const camera = sun.shadow.camera;
    camera.left = -reach;
    camera.right = reach;
    camera.top = reach;
    camera.bottom = -reach;
    camera.far = reach * 4;
    this.scene.add(sun);

    // A cool light from behind outlines the edges against the dark background.
    const rim = new THREE.DirectionalLight('#8da2ff', 0.7);
    rim.position.set(-reach, reach * 0.6, -reach);
    this.scene.add(rim);
    return this;
  }

  build(): StructuralScene {
    return {
      scene: this.scene,
      model: this.model,
      groups: this.groups,
      size: this.size.clone(),
      storyHeight: this.storyHeight,
      stories: this.stories,
      realistic: this.realistic,
    };
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
