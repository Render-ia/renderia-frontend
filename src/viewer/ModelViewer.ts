import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { StructuralScene } from './StructuralSceneBuilder.ts';

export interface PickedElement {
  elementId: number;
  typeName: string;
  materialName: string | null;
}

/**
 * Renders a structural scene in a canvas with orbit controls (drag to rotate,
 * scroll to zoom, right-drag to pan), element picking and exports.
 */
export class ModelViewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private content: StructuralScene | null = null;
  private highlighted: THREE.Mesh[] = [];
  private frame = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly onPick: (picked: PickedElement | null) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'viewer__canvas';
    this.host.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.renderer.domElement.addEventListener('click', (event) => this.pick(event));
    this.resize();
    this.loop();
  }

  show(content: StructuralScene): void {
    this.clearHighlight();
    this.onPick(null);
    if (this.content) this.disposeScene(this.content.scene);
    this.content = content;
    this.resetCamera();
  }

  setVisible(typeName: string, visible: boolean): void {
    const group = this.content?.groups.get(typeName);
    if (group) group.visible = visible;
  }

  resetCamera(): void {
    if (!this.content) return;
    const reach = Math.max(this.content.size.x, this.content.size.z);
    this.camera.position.set(reach * 0.85, reach * 0.9, reach * 1.05);
    this.controls.target.set(0, 1, 0);
    this.controls.update();
  }

  /** Looks at the building from above, like the original plan. */
  topView(): void {
    if (!this.content) return;
    const reach = Math.max(this.content.size.x, this.content.size.z);
    this.camera.position.set(0, reach * 1.6, 0.01);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  async exportGlb(): Promise<Blob> {
    if (!this.content) throw new Error('No hay un modelo para exportar.');
    this.clearHighlight();
    this.onPick(null);
    const result = await new GLTFExporter().parseAsync(this.content.model, { binary: true, onlyVisible: true });
    return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
  }

  screenshot(): Promise<Blob> {
    this.renderer.render(this.content!.scene, this.camera);
    return new Promise((resolve, reject) =>
      this.renderer.domElement.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo capturar la imagen.'))), 'image/png'),
    );
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    if (this.content) this.disposeScene(this.content.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private disposeScene(scene: THREE.Scene): void {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((m) => m.dispose());
      }
    });
  }

  private loop(): void {
    this.frame = requestAnimationFrame(() => this.loop());
    this.controls.update();
    if (this.content) this.renderer.render(this.content.scene, this.camera);
  }

  private resize(): void {
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private pick(event: MouseEvent): void {
    if (!this.content) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster
      .intersectObject(this.content.model, true)
      .find((intersection) => intersection.object.visible && intersection.object.parent?.visible !== false);

    this.clearHighlight();
    if (!hit) {
      this.onPick(null);
      return;
    }
    const data = hit.object.userData as PickedElement;
    this.content.model.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.elementId === data.elementId) {
        const material = (object.material as THREE.MeshStandardMaterial).clone();
        material.emissive = new THREE.Color('#e04f2a');
        material.emissiveIntensity = 0.45;
        object.userData.original = object.material;
        object.material = material;
        this.highlighted.push(object);
      }
    });
    this.onPick(data);
  }

  private clearHighlight(): void {
    for (const mesh of this.highlighted) {
      (mesh.material as THREE.Material).dispose();
      mesh.material = mesh.userData.original as THREE.Material;
      delete mesh.userData.original;
    }
    this.highlighted = [];
  }
}
