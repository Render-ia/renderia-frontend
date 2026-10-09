import type { ElementMeshCreator } from './ElementMeshCreator.ts';
import {
  BeamMeshCreator,
  ColumnMeshCreator,
  DoorMeshCreator,
  MarkerMeshCreator,
  SlabMeshCreator,
  StairMeshCreator,
  WallMeshCreator,
  WindowMeshCreator,
} from './creators.ts';

/** Returns the creator for an element type name from element_types. */
export class ElementMeshFactory {
  private readonly creators = new Map<string, ElementMeshCreator>([
    ['Muro', new WallMeshCreator()],
    ['Columna', new ColumnMeshCreator()],
    ['Viga', new BeamMeshCreator()],
    ['Losa', new SlabMeshCreator()],
    ['Puerta', new DoorMeshCreator()],
    ['Ventana', new WindowMeshCreator()],
    ['Escalera', new StairMeshCreator()],
  ]);
  private readonly fallback = new MarkerMeshCreator();

  creatorFor(typeName: string): ElementMeshCreator {
    return this.creators.get(typeName) ?? this.fallback;
  }
}
