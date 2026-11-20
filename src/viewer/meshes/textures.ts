import * as THREE from 'three';

/**
 * Surfaces drawn on a canvas for the presentation finishes, so the model
 * looks built instead of plastic. They are generated once (no image files to
 * download) and tinted by each finish color. Without a DOM (tests) there are
 * no textures and the plain colors are used.
 */
export type Surface = 'plaster' | 'concrete' | 'wood' | 'floor';

/** Real size in meters that one copy of each texture covers. */
const TILE_METERS: Record<Surface, number> = { plaster: 2, concrete: 1.5, wood: 1, floor: 2.4 };

const SIZE = 256;
const cache = new Map<Surface, THREE.CanvasTexture>();

/** A copy of the surface texture repeated to cover `width` × `height` meters. */
export function surfaceTexture(surface: Surface, width: number, height: number): THREE.Texture | null {
  const base = baseTexture(surface);
  if (!base) return null;
  const texture = base.clone();
  const tile = TILE_METERS[surface];
  texture.repeat.set(Math.max(0.25, width / tile), Math.max(0.25, height / tile));
  texture.needsUpdate = true;
  return texture;
}

function baseTexture(surface: Surface): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  let texture = cache.get(surface);
  if (texture) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (!context) return null;
  PAINTERS[surface](context);
  texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(surface, texture);
  return texture;
}

/** Deterministic noise, so every load looks the same. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Light speckles around a light gray base; the finish color tints it. */
function speckle(context: CanvasRenderingContext2D, base: number, spread: number, count: number, seed: number): void {
  context.fillStyle = `rgb(${base},${base},${base})`;
  context.fillRect(0, 0, SIZE, SIZE);
  const next = random(seed);
  for (let i = 0; i < count; i++) {
    const shade = Math.round(base + (next() - 0.5) * spread);
    context.fillStyle = `rgba(${shade},${shade},${shade},0.55)`;
    const size = 1 + next() * 2.5;
    context.fillRect(next() * SIZE, next() * SIZE, size, size);
  }
}

const PAINTERS: Record<Surface, (context: CanvasRenderingContext2D) => void> = {
  // Fine, soft grain of painted plaster.
  plaster(context) {
    speckle(context, 238, 26, 9000, 7);
  },
  // Coarser concrete with a few air holes.
  concrete(context) {
    speckle(context, 214, 60, 12000, 11);
    const next = random(3);
    for (let i = 0; i < 70; i++) {
      context.fillStyle = 'rgba(90,90,90,0.35)';
      context.beginPath();
      context.arc(next() * SIZE, next() * SIZE, 0.6 + next() * 1.6, 0, Math.PI * 2);
      context.fill();
    }
  },
  // Vertical wood grain for doors.
  wood(context) {
    context.fillStyle = 'rgb(225,225,225)';
    context.fillRect(0, 0, SIZE, SIZE);
    const next = random(5);
    for (let x = 0; x < SIZE; x += 1) {
      const shade = Math.round(200 + Math.sin(x * 0.35 + next() * 0.8) * 22 + (next() - 0.5) * 18);
      context.fillStyle = `rgba(${shade},${shade},${shade},0.5)`;
      context.fillRect(x, 0, 1, SIZE);
    }
  },
  // Wooden floor planks with staggered joints.
  floor(context) {
    const next = random(9);
    const planks = 8;
    const plankHeight = SIZE / planks;
    for (let row = 0; row < planks; row++) {
      const offset = next() * SIZE;
      for (let piece = -1; piece < 2; piece++) {
        const shade = Math.round(205 + (next() - 0.5) * 40);
        context.fillStyle = `rgb(${shade},${shade},${shade})`;
        context.fillRect(offset + piece * (SIZE / 1.5), row * plankHeight, SIZE / 1.5, plankHeight);
      }
      for (let i = 0; i < 40; i++) {
        const shade = Math.round(170 + next() * 40);
        context.fillStyle = `rgba(${shade},${shade},${shade},0.35)`;
        context.fillRect(next() * SIZE, row * plankHeight + next() * plankHeight, 20 + next() * 60, 1);
      }
      context.fillStyle = 'rgba(80,80,80,0.35)';
      context.fillRect(0, row * plankHeight, SIZE, 1);
    }
  },
};
