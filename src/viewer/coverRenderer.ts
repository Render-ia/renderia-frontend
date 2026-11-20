import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CatalogItem } from '../models/Catalog.ts';
import type { StructuralElement } from '../models/StructuralElement.ts';
import { StructuralSceneBuilder } from './StructuralSceneBuilder.ts';
import { cameraPose, type FinishStyle } from './studio.ts';

/**
 * Presentation picture of a building for the 3D gallery: the whole building
 * with finishes, seen from the usual three-quarter view. One offscreen
 * renderer is shared by every cover, so the gallery opens a single WebGL
 * context however many projects it shows.
 */
let renderer: THREE.WebGLRenderer | null = null;
let environment: THREE.Texture | null = null;

function shared(): { renderer: THREE.WebGLRenderer; environment: THREE.Texture } {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  if (!environment) {
    const generator = new THREE.PMREMGenerator(renderer);
    environment = generator.fromScene(new RoomEnvironment(), 0.04).texture;
    generator.dispose();
  }
  return { renderer, environment };
}

export function renderCover(
  floors: StructuralElement[][],
  types: CatalogItem[],
  materials: CatalogItem[],
  style: FinishStyle = 'modern',
  width = 480,
  height = 300,
): string {
  const { renderer, environment } = shared();
  const content = new StructuralSceneBuilder()
    .withBackground()
    .withFloors(floors, types, materials, style)
    .withGround()
    .withLights()
    .build();
  content.scene.environment = environment;
  content.scene.environmentIntensity = 0.45;

  // A finished building has a roof: the top floor slab, in concrete, one floor up.
  const slabs = content.groups.get('Losa');
  if (slabs) {
    const concrete = new THREE.MeshStandardMaterial({ color: '#b8bcc2', roughness: 0.85 });
    for (const slab of [...slabs.children].filter((s) => s.userData.story === content.stories)) {
      const roof = slab.clone();
      roof.position.y += content.storyHeight;
      roof.traverse((part) => {
        if (part instanceof THREE.Mesh) part.material = concrete;
      });
      slabs.add(roof);
    }
  }

  // The viewer's three-quarter view, a little closer so the building fills the picture.
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
  const pose = cameraPose('iso', content.size.x, content.size.z, width / height, content.size.y);
  const target = new THREE.Vector3(...pose.target);
  const tall = content.size.y > Math.max(content.size.x, content.size.z) * 0.6;
  const offset = new THREE.Vector3(...pose.position).sub(target).multiplyScalar(tall ? 1.1 : 0.85);
  // A lower eye shows more of the facades than of the roof.
  offset.y *= 0.65;
  camera.position.copy(offset.add(target));
  camera.lookAt(target);

  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.render(content.scene, camera);
  const picture = renderer.domElement.toDataURL('image/jpeg', 0.82);

  content.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => m.dispose());
    }
  });
  return picture;
}
