import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { StructuralScene } from './StructuralSceneBuilder.ts';
import { cameraPose, captureSize, type ViewName } from './studio.ts';

/** Section cuts in scene meters; null leaves that cut off. */
export interface SectionCut {
  /** Keeps what is below this height. */
  height: number | null;
  /** Keeps what is in front of this depth (z), like a vertical section. */
  depth: number | null;
}

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
  private readonly heightPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private readonly depthPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  private section: SectionCut = { height: null, depth: null };
  private flight: { from: CameraPoseVectors; to: CameraPoseVectors; start: number } | null = null;

  constructor(
    private host: HTMLElement,
    private readonly onPick: (picked: PickedElement | null) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.className = 'viewer__canvas';
    this.host.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.autoRotateSpeed = 1.2;
    // A drag stops the tour so the user takes control at once.
    this.controls.addEventListener('start', () => {
      this.flight = null;
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.renderer.domElement.addEventListener('click', (event) => this.pick(event));
    this.resize();
    this.loop();
  }

  show(content: StructuralScene, resetCamera = true): void {
    this.clearHighlight();
    this.onPick(null);
    if (this.content) this.disposeScene(this.content.scene);
    this.content = content;
    this.applySection();
    if (resetCamera) this.resetCamera();
  }

  /** Moves the canvas to a new container (the page re-rendered its controls). */
  attachTo(host: HTMLElement): void {
    if (host === this.host) return;
    this.resizeObserver.unobserve(this.host);
    this.host = host;
    host.prepend(this.renderer.domElement);
    this.resizeObserver.observe(host);
    this.resize();
  }

  /** Footprint of the building in meters. */
  get size(): { width: number; depth: number; height: number } {
    const size = this.content?.size;
    return { width: size?.x ?? 10, depth: size?.z ?? 10, height: 3 };
  }

  /** Flies the camera to one of the standard views. */
  setView(view: ViewName, animate = true): void {
    if (!this.content) return;
    const pose = cameraPose(view, this.content.size.x, this.content.size.z, this.camera.aspect);
    const to = { position: new THREE.Vector3(...pose.position), target: new THREE.Vector3(...pose.target) };
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera.position.copy(to.position);
      this.controls.target.copy(to.target);
      this.controls.update();
      return;
    }
    this.flight = {
      from: { position: this.camera.position.clone(), target: this.controls.target.clone() },
      to,
      start: performance.now(),
    };
  }

  /** Cuts the model with a horizontal and/or vertical plane. Geometry is not changed. */
  setSection(section: SectionCut): void {
    this.section = section;
    this.applySection();
  }

  /** Slow turn around the building, for presentations. */
  setTour(on: boolean): void {
    this.controls.autoRotate = on;
    if (on) this.flight = null;
  }

  get touring(): boolean {
    return this.controls.autoRotate;
  }

  /**
   * Renders the current view at high resolution (4K long side by default) and
   * returns it as PNG. The canvas on screen is restored afterwards.
   */
  async captureHighRes(longSide = 3840): Promise<Blob> {
    if (!this.content) throw new Error('No hay un modelo para capturar.');
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    const target = captureSize(width, height, longSide);
    const ratio = this.renderer.getPixelRatio();
    this.clearHighlight();
    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(target.width, target.height, false);
      this.renderer.render(this.content.scene, this.camera);
      return await new Promise<Blob>((resolve, reject) =>
        this.renderer.domElement.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))),
          'image/png',
        ),
      );
    } finally {
      this.renderer.setPixelRatio(ratio);
      this.resize();
    }
  }

  setVisible(typeName: string, visible: boolean): void {
    const group = this.content?.groups.get(typeName);
    if (group) group.visible = visible;
  }

  resetCamera(): void {
    this.setView('iso', false);
  }

  /** Looks at the building from above, like the original plan. */
  topView(): void {
    this.setView('top');
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

  private applySection(): void {
    if (!this.content) return;
    const planes: THREE.Plane[] = [];
    if (this.section.height !== null) {
      this.heightPlane.constant = this.section.height;
      planes.push(this.heightPlane);
    }
    if (this.section.depth !== null) {
      this.depthPlane.constant = this.section.depth;
      planes.push(this.depthPlane);
    }
    this.content.model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.clippingPlanes = planes;
        // Cut walls show their inside instead of disappearing.
        material.side = planes.length ? THREE.DoubleSide : THREE.FrontSide;
        // Back faces must not cast shadows, or a double-sided material shades itself (acne).
        material.shadowSide = THREE.BackSide;
        material.needsUpdate = true;
      }
    });
  }

  private fly(now: number): void {
    if (!this.flight) return;
    const t = Math.min(1, (now - this.flight.start) / 700);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    this.camera.position.lerpVectors(this.flight.from.position, this.flight.to.position, ease);
    this.controls.target.lerpVectors(this.flight.from.target, this.flight.to.target, ease);
    if (t >= 1) this.flight = null;
  }

  private loop(): void {
    this.frame = requestAnimationFrame((now) => {
      this.fly(now);
      this.loop();
    });
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
        material.clippingPlanes = (object.material as THREE.Material).clippingPlanes;
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

interface CameraPoseVectors {
  position: THREE.Vector3;
  target: THREE.Vector3;
}
