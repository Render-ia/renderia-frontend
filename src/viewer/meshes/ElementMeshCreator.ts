import * as THREE from 'three';
import type { StructuralElement } from '../../models/StructuralElement.ts';

/** Everything a creator needs to build the 3D piece of one element. */
export interface MeshContext {
  element: StructuralElement;
  typeName: string;
  materialName: string | null;
  color: string;
  /** Converts plan coordinates (meters, y downwards) into the scene (x, z). */
  toScene: (x: number, y: number) => THREE.Vector2;
}

/**
 * Pattern: Factory Method — each element type has its own creator that knows
 * how to turn a row of structural_elements into geometry. The scene builder
 * only calls `create()` and never needs to know the shapes.
 */
export abstract class ElementMeshCreator {
  /** Template step: subclasses build the object, the base class tags it. */
  create(context: MeshContext): THREE.Object3D {
    const object = this.build(context);
    object.name = `${context.typeName} #${context.element.id}`;
    object.traverse((child) => {
      child.userData = {
        elementId: context.element.id,
        typeName: context.typeName,
        materialName: context.materialName,
      };
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return object;
  }

  protected abstract build(context: MeshContext): THREE.Object3D;

  protected material(color: string, options: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...options });
  }

  /**
   * Box that goes from point a to point b on the plan, with the given
   * thickness, standing between heights `bottom` and `top`.
   */
  protected boxAlong(
    a: THREE.Vector2,
    b: THREE.Vector2,
    thickness: number,
    bottom: number,
    top: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const length = Math.max(0.01, a.distanceTo(b));
    const height = Math.max(0.01, top - bottom);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, Math.max(0.01, thickness)), material);
    mesh.position.set((a.x + b.x) / 2, bottom + height / 2, (a.y + b.y) / 2);
    mesh.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
    return mesh;
  }

  protected endpoints(context: MeshContext): [THREE.Vector2, THREE.Vector2] {
    const { element, toScene } = context;
    return [
      toScene(element.startX, element.startY),
      toScene(element.endX ?? element.startX, element.endY ?? element.startY),
    ];
  }
}
