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

/**
 * Stairs: the end point gives the direction the steps go up. A wide stair
 * (two flights side by side, as in a building core) goes up one side, turns
 * on a landing and comes back on the other side.
 */
export class StairMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const { element, toScene } = context;
    const width = element.width ?? 1;
    const length = element.thickness ?? 2.5;
    const height = element.height ?? LEVEL.column;
    const center = toScene(element.startX, element.startY);
    const direction =
      element.endX != null && element.endY != null
        ? toScene(element.endX, element.endY).sub(center)
        : new THREE.Vector2(1, 0);
    const material = this.surface(context, 'concrete', context.color, length, width, { roughness: 0.75 });
    const group = new THREE.Group();
    const steps = 9;
    const twoFlights = width >= 1.6;
    const landing = twoFlights ? Math.min(1.1, length * 0.3) : 0;
    const run = length - landing;
    const flightWidth = twoFlights ? width / 2 - 0.04 : width;
    const flights = twoFlights ? 2 : 1;
    const flightRise = height / flights;
    for (let f = 0; f < flights; f++) {
      const side = twoFlights ? (f === 0 ? -1 : 1) * (width / 4) : 0;
      for (let i = 0; i < steps; i++) {
        const top = f * flightRise + ((i + 1) * flightRise) / steps;
        const block = new THREE.Mesh(new THREE.BoxGeometry(run / steps, top, flightWidth), material);
        // First flight goes up along +x, the second comes back along -x.
        const along = -length / 2 + (i + 0.5) * (run / steps);
        block.position.set(f === 0 ? along : -along - landing, top / 2, side);
        group.add(block);
      }
    }
    if (twoFlights) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(landing, flightRise, width), material);
      slab.position.set(length / 2 - landing / 2, flightRise / 2, 0);
      group.add(slab);
    }
    group.rotation.y = -Math.atan2(direction.y, direction.x);
    group.position.set(center.x, 0, center.y);
    return group;
  }
}

/** Elevator: the shaft walls up to the next floor, open at the front, with the steel cabin inside. */
export class ElevatorMeshCreator extends ElementMeshCreator {
  protected build(context: MeshContext): THREE.Object3D {
    const { element, toScene } = context;
    const width = element.width ?? 1.5;
    const depth = element.thickness ?? 1.5;
    const height = element.height ?? LEVEL.column;
    const center = toScene(element.startX, element.startY);
    const group = new THREE.Group();
    const steel = this.material('#9aa3ab', { roughness: 0.28, metalness: 0.85 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, height * 0.8, depth * 0.82), steel);
    cabin.position.y = height * 0.4 + 0.02;
    group.add(cabin);
    const door = this.material('#5d666e', { roughness: 0.3, metalness: 0.9 });
    // Doors face +y in the plan (the hall side of the Torre Galeras core).
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(width * 0.5, height * 0.72, 0.03), door);
    leaf.position.set(0, height * 0.36 + 0.02, depth * 0.41 + 0.016);
    group.add(leaf);
    const rail = this.material('#2f3439', { roughness: 0.5, metalness: 0.6 });
    for (const x of [-1, 1]) {
      const guide = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, 0.06), rail);
      guide.position.set((x * width) / 2 - x * 0.06, height / 2, 0);
      group.add(guide);
    }
    group.position.set(center.x, 0, center.y);
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
