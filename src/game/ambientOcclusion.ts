import * as THREE from 'three';

export interface VertexAOOptions {
  /** Minimum AO multiplier at the base/crease (0.0 = pitch black, 1.0 = no darkening). Default: 0.38 */
  minAO?: number;
  /** Enable height-based contact AO (darker at bottom of mesh). Default: true */
  groundAO?: boolean;
  /** Height range over which base contact AO attenuates (in local Y units). Default: auto-detected from bbox */
  heightRange?: number;
  /** Power exponent for height attenuation curve. Default: 1.2 */
  heightExponent?: number;
  /** Enable corner & edge crease darkening based on vertex distance to box edges. Default: true */
  cornerAO?: boolean;
  /** Intensity of corner/edge crease darkening. Default: 0.25 */
  creaseIntensity?: number;
}

/** Shared singleton radial gradient canvas texture for baked contact AO shadow planes */
let cachedContactAOTexture: THREE.CanvasTexture | null = null;

export function getContactAOTexture(): THREE.CanvasTexture {
  if (cachedContactAOTexture) return cachedContactAOTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0.0, 'rgba(0, 0, 0, 0.82)');
    gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(0.75, 'rgba(0, 0, 0, 0.20)');
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }

  cachedContactAOTexture = new THREE.CanvasTexture(canvas);
  cachedContactAOTexture.colorSpace = THREE.SRGBColorSpace;
  return cachedContactAOTexture;
}

/**
 * Creates a lightweight flat mesh plane with a radial dark gradient map,
 * perfect for placing under objects to cast soft, baked contact shadows without real-time shadow passes.
 */
export function createContactAOPlane(
  width: number,
  depth: number,
  opacity: number = 0.65
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshBasicMaterial({
    map: getContactAOTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = 1;
  return plane;
}

/**
 * Computes per-vertex ambient occlusion values and stores them in the geometry's 'color' attribute.
 * When applied to a material with `vertexColors: true`, vertex AO multiplies the material's color,
 * producing realistic ambient grounding and crease highlights with ZERO runtime shader/performance overhead.
 */
export function applyVertexAO(
  geometry: THREE.BufferGeometry,
  options: VertexAOOptions = {}
): THREE.BufferGeometry {
  const minAO = options.minAO ?? 0.38;
  const groundAO = options.groundAO ?? true;
  const heightExp = options.heightExponent ?? 1.2;
  const cornerAO = options.cornerAO ?? true;
  const creaseIntensity = options.creaseIntensity ?? 0.22;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;

  if (!bbox) return geometry;

  const posAttr = geometry.getAttribute('position');
  if (!posAttr) return geometry;

  const count = posAttr.count;
  const colors = new Float32Array(count * 3);

  const minY = bbox.min.y;
  const maxY = bbox.max.y;
  const totalHeight = Math.max(maxY - minY, 0.001);
  const effectiveHeightRange = options.heightRange ?? totalHeight;

  const sizeX = Math.max(bbox.max.x - bbox.min.x, 0.001);
  const sizeZ = Math.max(bbox.max.z - bbox.min.z, 0.001);

  const halfX = sizeX / 2;
  const halfZ = sizeZ / 2;

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    let aoFactor = 1.0;

    // 1. Ground Contact Height Gradient
    if (groundAO) {
      const normalizedHeight = Math.min(Math.max((y - minY) / effectiveHeightRange, 0.0), 1.0);
      const heightFactor = Math.pow(normalizedHeight, heightExp);
      const groundAOVal = minAO + (1.0 - minAO) * heightFactor;
      aoFactor *= groundAOVal;
    }

    // 2. Corner / Edge Crease Occlusion (Distance to box edges/corners)
    if (cornerAO) {
      // Local distance ratio from box center
      const distX = Math.abs(x - (bbox.min.x + halfX)) / halfX; // 0 at center, 1 at outer wall
      const distZ = Math.abs(z - (bbox.min.z + halfZ)) / halfZ; // 0 at center, 1 at outer wall

      // Vertices near bottom corners receive additional subtle crease darkening
      const cornerDistance = Math.sqrt(distX * distX + distZ * distZ);
      const normalizedHeight = Math.min(Math.max((y - minY) / totalHeight, 0.0), 1.0);

      if (normalizedHeight < 0.25) {
        const creaseFactor = 1.0 - (1.0 - normalizedHeight / 0.25) * (cornerDistance / 1.414) * creaseIntensity;
        aoFactor *= Math.max(creaseFactor, 0.5);
      }
    }

    // Clamp final vertex AO factor
    const finalAO = Math.min(Math.max(aoFactor, minAO * 0.8), 1.0);

    colors[i * 3] = finalAO;     // Red
    colors[i * 3 + 1] = finalAO; // Green
    colors[i * 3 + 2] = finalAO; // Blue
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Convenience helper to apply vertex AO directly to a Mesh and enable vertexColors on its material.
 */
export function applyVertexAOToMesh(
  mesh: THREE.Mesh,
  options: VertexAOOptions = {}
): THREE.Mesh {
  applyVertexAO(mesh.geometry, options);

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => {
      if ('vertexColors' in mat) {
        (mat as THREE.MeshStandardMaterial).vertexColors = true;
        mat.needsUpdate = true;
      }
    });
  } else if (mesh.material && 'vertexColors' in mesh.material) {
    (mesh.material as THREE.MeshStandardMaterial).vertexColors = true;
    mesh.material.needsUpdate = true;
  }

  return mesh;
}
