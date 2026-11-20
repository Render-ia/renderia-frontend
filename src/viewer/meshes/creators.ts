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
    const material = this.surface(context, 'plaster', context.color, a.distanceTo(b), height);
    return this.boxAlong(a, b, context.element.thickness ?? 0.15, 0, height, material);
  }
}

export class ColumnMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const { element, toScene } = context;
    const width = element.width ?? 0.3;
    const depth = element.thickness ?? width;
    const height = element.height ?? LEVEL.column;
    const material = this.surface(context, 'concrete', context.color, width, height, { roughness: 0.7 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
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
    const material = this.surface(context, 'concrete', context.color, a.distanceTo(b), depth, { roughness: 0.6 });
    return this.boxAlong(a, b, width, LEVEL.column - depth, LEVEL.column, material);
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
      this.surface(context, 'floor', context.color, Math.abs(b.x - a.x), Math.abs(b.y - a.y), { roughness: 0.95 }),
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
    const width = a.distanceTo(b);
    group.add(this.boxAlong(a, b, thickness * 0.35, 0, top, this.surface(context, 'wood', context.color, width, top, { roughness: 0.6 })));
    const lintel = context.realistic ? this.surface(context, 'plaster', context.wallColor, width, LEVEL.wall - top) : this.material('#c9ccc8');
    group.add(this.boxAlong(a, b, thickness, top, LEVEL.wall, lintel));
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
    const width = a.distanceTo(b);
    const wall = context.realistic ? this.surface(context, 'plaster', context.wallColor, width, 1) : this.material('#c9ccc8');
    const glass = context.realistic
      ? this.material(context.color, { transparent: true, opacity: 0.32, roughness: 0.04, metalness: 0.7, envMapIntensity: 1.6 })
      : this.material(context.color, { transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1 });

    const group = new THREE.Group();
    group.add(this.boxAlong(a, b, thickness, 0, LEVEL.windowSill, wall));
    group.add(this.boxAlong(a, b, thickness * 0.2, LEVEL.windowSill, glassTop, glass));
    group.add(this.boxAlong(a, b, thickness, glassTop, LEVEL.wall, wall));
    if (context.realistic) this.addFrame(group, a, b, thickness, LEVEL.windowSill, glassTop);
    return group;
  }

  /** Aluminum frame around the glass, with a mullion every ~1.2 m. */
  private addFrame(group: THREE.Group, a: THREE.Vector2, b: THREE.Vector2, thickness: number, bottom: number, top: number): void {
    const frame = this.material('#3b4146', { roughness: 0.35, metalness: 0.75 });
    const bar = 0.05;
    const depth = thickness * 0.35;
    group.add(this.boxAlong(a, b, depth, bottom, bottom + bar, frame));
    group.add(this.boxAlong(a, b, depth, top - bar, top, frame));
    const length = a.distanceTo(b);
    const panes = Math.max(1, Math.round(length / 1.2));
    for (let i = 0; i <= panes; i++) {
      const t = i / panes;
      const center = a.clone().lerp(b, t);
      const half = b.clone().sub(a).normalize().multiplyScalar(bar / 2);
      group.add(this.boxAlong(center.clone().sub(half), center.clone().add(half), depth, bottom, top, frame));
    }
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
