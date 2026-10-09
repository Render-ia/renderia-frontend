import * as THREE from 'three';
import { ElementMeshCreator, type MeshContext } from './ElementMeshCreator.ts';

/** Heights used when the analysis did not store them. */
export const LEVEL = {
  wall: 2.5,
  column: 2.8,
  door: 2.1,
  windowSill: 0.9,
  windowTop: 2.1,
  beamDepth: 0.35,
};

export class WallMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const [a, b] = this.endpoints(context);
    const height = context.element.height ?? LEVEL.wall;
    return this.boxAlong(a, b, context.element.thickness ?? 0.15, 0, height, this.material(context.color));
  }
}

export class ColumnMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const { element, toScene } = context;
    const width = element.width ?? 0.3;
    const depth = element.thickness ?? width;
    const height = element.height ?? LEVEL.column;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.material(context.color, { roughness: 0.7 }));
    const center = toScene(element.startX, element.startY);
    mesh.position.set(center.x, height / 2, center.y);
    return mesh;
  }
}

/** Beams rest on the columns: their top matches the column top. */
export class BeamMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const [a, b] = this.endpoints(context);
    const depth = context.element.height ?? LEVEL.beamDepth;
    const width = context.element.width ?? 0.25;
    return this.boxAlong(a, b, width, LEVEL.column - depth, LEVEL.column, this.material(context.color, { roughness: 0.6 }));
  }
}

/** Ground slab under the whole building. */
export class SlabMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const { element, toScene } = context;
    const a = toScene(element.startX, element.startY);
    const b = toScene(element.endX ?? element.startX, element.endY ?? element.startY);
    const thickness = element.thickness ?? 0.12;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.abs(b.x - a.x), thickness, Math.abs(b.y - a.y)),
      this.material(context.color, { roughness: 0.95 }),
    );
    mesh.position.set((a.x + b.x) / 2, -thickness / 2, (a.y + b.y) / 2);
    return mesh;
  }
}

/** A door leaf in the wall gap, with the lintel that closes the wall above it. */
export class DoorMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const [a, b] = this.endpoints(context);
    const thickness = context.element.thickness ?? 0.15;
    const top = context.element.height ?? LEVEL.door;
    const group = new THREE.Group();
    group.add(this.boxAlong(a, b, thickness * 0.35, 0, top, this.material(context.color, { roughness: 0.6 })));
    group.add(this.boxAlong(a, b, thickness, top, LEVEL.wall, this.material('#c9ccc8')));
    return group;
  }
}

/** Glass between a sill and a lintel. */
export class WindowMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const [a, b] = this.endpoints(context);
    const thickness = context.element.thickness ?? 0.15;
    const glassHeight = context.element.height ?? LEVEL.windowTop - LEVEL.windowSill;
    const glassTop = Math.min(LEVEL.wall, LEVEL.windowSill + glassHeight);
    const wall = this.material('#c9ccc8');
    const glass = this.material(context.color, { transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1 });

    const group = new THREE.Group();
    group.add(this.boxAlong(a, b, thickness, 0, LEVEL.windowSill, wall));
    group.add(this.boxAlong(a, b, thickness * 0.2, LEVEL.windowSill, glassTop, glass));
    group.add(this.boxAlong(a, b, thickness, glassTop, LEVEL.wall, wall));
    return group;
  }
}

/** Stairs as a block of steps going up along x. */
export class StairMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const { element, toScene } = context;
    const width = element.width ?? 1;
    const length = element.thickness ?? 2.5;
    const steps = 12;
    const group = new THREE.Group();
    const center = toScene(element.startX, element.startY);
    const material = this.material(context.color);
    for (let i = 0; i < steps; i++) {
      const rise = ((i + 1) * LEVEL.column) / steps;
      const step = new THREE.Mesh(new THREE.BoxGeometry(length / steps, rise, width), material);
      step.position.set(center.x - length / 2 + (i + 0.5) * (length / steps), rise / 2, center.y);
      group.add(step);
    }
    return group;
  }
}

/** Unknown types are shown as a small marker so they are not lost. */
export class MarkerMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const { element, toScene } = context;
    const point = toScene(element.startX, element.startY);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), this.material(context.color));
    mesh.position.set(point.x, 0.15, point.y);
    return mesh;
  }
}
