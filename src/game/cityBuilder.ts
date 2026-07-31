import * as THREE from 'three';
import gramaImgUrl from '../Textures/Grama.png';
import troncoImgUrl from '../Textures/Tronco.png';
import { Sunlight } from './sunlight';
import { GradientSky } from './sky';
import { applyVertexAOToMesh } from './ambientOcclusion';

const textureLoader = new THREE.TextureLoader();
const gramaMap = textureLoader.load(gramaImgUrl);
gramaMap.wrapS = THREE.RepeatWrapping;
gramaMap.wrapT = THREE.RepeatWrapping;
gramaMap.repeat.set(64, 64);
gramaMap.colorSpace = THREE.SRGBColorSpace;

const troncoMap = textureLoader.load(troncoImgUrl);
troncoMap.wrapS = THREE.RepeatWrapping;
troncoMap.wrapT = THREE.RepeatWrapping;
troncoMap.repeat.set(1, 3);
troncoMap.colorSpace = THREE.SRGBColorSpace;

// --- Shared Wind Time Uniform & Vertex Shader Sway Generator ---
export const windUniforms = {
  uTime: { value: 0 },
};

export function applyWindSway(material: THREE.MeshStandardMaterial, windStrength = 1.0) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader = `
      uniform float uTime;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      // Subtle natural wind swaying with gusting harmonic modulation
      float windTime = uTime * 1.6;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);

      float gust = 1.0 + 0.35 * sin(uTime * 0.45) * cos(uTime * 0.25);
      float swayX = sin(windTime + worldPos.x * 0.28 + worldPos.z * 0.22) * cos(windTime * 0.75 + worldPos.z * 0.32);
      float swayZ = cos(windTime * 1.25 + worldPos.x * 0.18 - worldPos.z * 0.28) * sin(windTime * 0.85 + worldPos.x * 0.25);

      // Height factor: roots stay planted, tips flex in breeze
      float heightFactor = clamp(position.y * 0.35, 0.0, 2.2);
      transformed.x += swayX * 0.026 * ${windStrength.toFixed(2)} * gust * heightFactor;
      transformed.z += swayZ * 0.026 * ${windStrength.toFixed(2)} * gust * heightFactor;
      `
    );
  };
}

// --- Geometry Merger Utility for Single Draw Call Performance ---
export function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  let totalVertices = 0;
  let totalIndices = 0;
  let hasUVs = false;

  for (const geo of geometries) {
    const pos = geo.attributes.position;
    if (pos) totalVertices += pos.count;
    if (geo.index) totalIndices += geo.index.count;
    if (geo.attributes.uv) hasUVs = true;
  }

  if (totalVertices === 0) return merged;

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = hasUVs ? new Float32Array(totalVertices * 2) : null;
  const hasIndices = totalIndices > 0;
  const indices = hasIndices ? new Uint32Array(totalIndices) : null;

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const geo of geometries) {
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const idx = geo.index;

    if (!pos) continue;

    for (let i = 0; i < pos.count; i++) {
      const vIdx = (vertexOffset + i) * 3;
      positions[vIdx]     = pos.getX(i);
      positions[vIdx + 1] = pos.getY(i);
      positions[vIdx + 2] = pos.getZ(i);

      if (norm) {
        normals[vIdx]     = norm.getX(i);
        normals[vIdx + 1] = norm.getY(i);
        normals[vIdx + 2] = norm.getZ(i);
      }

      if (uvs) {
        const uIdx = (vertexOffset + i) * 2;
        if (uv) {
          uvs[uIdx]     = uv.getX(i);
          uvs[uIdx + 1] = uv.getY(i);
        }
      }
    }

    if (idx && indices) {
      for (let i = 0; i < idx.count; i++) {
        indices[indexOffset + i] = idx.getX(i) + vertexOffset;
      }
      indexOffset += idx.count;
    }

    vertexOffset += pos.count;
  }

  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (uvs) merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));

  return merged;
}

// --- Procedural Noise Utilities for Natural Organic Terrain ---
function organicHarmonicNoise(x: number, z: number): { macro: number; micro: number; slopeFactor: number } {
  // 1. Macro Rolling Hills & Swells (~120m-220m wavelength)
  const macro1 = Math.sin(x * 0.009 + 0.4) * Math.cos(z * 0.012 - 0.6) * 6.2;
  const macro2 = Math.cos((x * 0.6 + z * 0.8) * 0.018) * 3.8;
  const macro3 = Math.sin((x * -0.7 + z * 0.7) * 0.028) * 2.4;
  const macro = macro1 + macro2 + macro3;

  // 2. Meso Topography & Rolling Knolls (~20m-50m wavelength)
  const meso1 = Math.sin(x * 0.045 + z * 0.038) * 1.25;
  const meso2 = Math.cos(x * 0.065 - z * 0.055 + Math.sin(x * 0.03)) * 0.85;

  // 3. Micro Ground Undulations & Hummocks (~4m-12m wavelength) - Smooth rolling dips & mounds
  const micro1 = Math.sin(x * 0.14 + z * 0.11) * 0.28;
  const micro2 = Math.cos(x * 0.22 - z * 0.18 + Math.sin(z * 0.08)) * 0.18;
  const micro3 = Math.sin((x + z) * 0.35) * 0.10;
  const micro = meso1 + meso2 + micro1 + micro2 + micro3;

  const slopeFactor = Math.abs(Math.cos(x * 0.035) * Math.sin(z * 0.035));

  return { macro, micro, slopeFactor };
}

// Forest Glade & Clearing Noise (0.0 = Open Glade/Clearing, 1.0 = Dense Stand)
export function getForestDensity(x: number, z: number): number {
  const distFromCenter = Math.sqrt(x * x + z * z);
  if (distFromCenter < 22) return 0.02; // Open military camp clearing around spawn

  // Multiple noise harmonics to create organic forest glades and clearings
  const n1 = (Math.sin(x * 0.022 + 0.8) * Math.cos(z * 0.026 - 0.4) + 1.0) * 0.5;
  const n2 = (Math.sin((x - z) * 0.045) + 1.0) * 0.5;
  const n3 = (Math.cos(x * 0.06 + z * 0.05) + 1.0) * 0.5;

  // Glade patches where tree density drops significantly
  const gladeNoise = (Math.sin(x * 0.038 - 1.2) * Math.sin(z * 0.035 + 1.5) + 1.0) * 0.5;
  let density = THREE.MathUtils.clamp(n1 * 0.5 + n2 * 0.3 + n3 * 0.2, 0.02, 0.98);

  if (gladeNoise < 0.22) {
    density *= 0.15; // Natural glade/clearing
  }

  return density;
}

// Mathematical Procedural Terrain Height Function
export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.sqrt(x * x + z * z);

  // Outer mountain boundary enclosing the forest operational zone (> 175m)
  let perimeterRidge = 0;
  if (distFromCenter > 175) {
    const factor = (distFromCenter - 175) / 65;
    perimeterRidge = Math.pow(factor, 1.9) * 26.0;
  }

  // Calculate organic terrain elevation
  const { macro, micro } = organicHarmonicNoise(x, z);

  // Organic winding dirt trail / streambed depression
  const trailX = Math.sin(z * 0.018) * 22.0 + Math.cos(z * 0.04) * 4.0;
  const distToTrail = Math.abs(x - trailX);
  const trailDip = -1.15 * Math.exp(-Math.pow(distToTrail * 0.16, 2));

  // Central tactical clearing
  const centerClearing = Math.max(0, 1.0 - distFromCenter / 52.0);

  const rawHeight = macro + micro + trailDip;
  const height = rawHeight * (1.0 - centerClearing * 0.25) + perimeterRidge;

  return height;
}

// Procedural Seamless 512x512 Ground Grass Texture & Normal Map Generator
function createProceduralTerrainTextures(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d');

  if (!ctx || !nCtx) {
    const fallbackMap = new THREE.CanvasTexture(canvas);
    return { map: fallbackMap, normalMap: fallbackMap };
  }

  // 1. Base Organic Dark Mossy Green Ground
  ctx.fillStyle = '#264213';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Background per-pixel noise for organic dark loam & moss texture
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n1 = (Math.sin(x * 0.08) * Math.cos(y * 0.08) + 1.0) * 0.5;
      const n2 = (Math.sin(x * 0.25 + y * 0.20) + 1.0) * 0.5;
      const noiseVal = Math.random();

      const r = Math.floor(32 + n1 * 24 + noiseVal * 12);
      const g = Math.floor(58 + n1 * 42 + n2 * 20 + noiseVal * 18);
      const b = Math.floor(18 + n2 * 16 + noiseVal * 10);

      data[idx]     = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // 2. Layer of Interwoven Fine Curly Grass Blades (512x512 Tileable)
  const grassColors = [
    '#689422', '#7fa828', '#8ec02c', '#9ec834',
    '#52781b', '#416315', '#a4d23d', '#355210'
  ];

  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';

  const numBlades = 1800;
  for (let i = 0; i < numBlades; i++) {
    const startX = Math.random() * size;
    const startY = Math.random() * size;
    const length = 8 + Math.random() * 22;
    const angle = Math.random() * Math.PI * 2;
    const curve = (Math.random() - 0.5) * 18;

    const cpX = startX + Math.cos(angle) * (length * 0.5) + Math.sin(angle) * curve;
    const cpY = startY + Math.sin(angle) * (length * 0.5) - Math.cos(angle) * curve;
    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;

    ctx.strokeStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
    ctx.lineWidth = 1.0 + Math.random() * 1.5;
    ctx.globalAlpha = 0.75 + Math.random() * 0.25;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.stroke();

    // Wrap around borders for seamless tileability
    if (startX < 30 || startX > size - 30 || startY < 30 || startY > size - 30) {
      const offsetX = startX < 30 ? size : startX > size - 30 ? -size : 0;
      const offsetY = startY < 30 ? size : startY > size - 30 ? -size : 0;
      ctx.beginPath();
      ctx.moveTo(startX + offsetX, startY + offsetY);
      ctx.quadraticCurveTo(cpX + offsetX, cpY + offsetY, endX + offsetX, endY + offsetY);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1.0;

  // 3. Layer of Clover Patches (3-lobe and 4-lobe bright clovers)
  const numClovers = 35;
  for (let c = 0; c < numClovers; c++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const lobes = Math.random() < 0.25 ? 4 : 3;
    const cloverSize = 3 + Math.random() * 4;

    ctx.fillStyle = Math.random() < 0.5 ? '#589822' : '#6ebd2a';
    for (let l = 0; l < lobes; l++) {
      const lAngle = (l / lobes) * Math.PI * 2 + Math.random() * 0.2;
      const lx = cx + Math.cos(lAngle) * (cloverSize * 0.9);
      const ly = cy + Math.sin(lAngle) * (cloverSize * 0.9);

      ctx.beginPath();
      ctx.arc(lx, ly, cloverSize * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Inner light vein detail
    ctx.fillStyle = '#82cf32';
    ctx.beginPath();
    ctx.arc(cx, cy, cloverSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Layer of Small Dark Pebble Stones with Highlights
  const numPebbles = 22;
  for (let p = 0; p < numPebbles; p++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const pr = 2.5 + Math.random() * 3.5;

    // Drop shadow
    ctx.fillStyle = 'rgba(15, 20, 10, 0.6)';
    ctx.beginPath();
    ctx.ellipse(px + 1.2, py + 1.5, pr * 1.1, pr * 0.8, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Stone base
    ctx.fillStyle = '#444244';
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.8, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();

    // Specular top highlight
    ctx.fillStyle = '#6e6b6d';
    ctx.beginPath();
    ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Thin Dry Twig Bits
  const numTwigs = 14;
  ctx.strokeStyle = '#5c4830';
  ctx.lineWidth = 1.2;
  for (let t = 0; t < numTwigs; t++) {
    const tx = Math.random() * size;
    const ty = Math.random() * size;
    const tLen = 10 + Math.random() * 15;
    const tAng = Math.random() * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(tAng) * tLen, ty + Math.sin(tAng) * tLen);
    ctx.stroke();
  }

  // 6. Extract Heightmap & Generate 512x512 Normal Map for 3D Depth
  const finalCanvasData = ctx.getImageData(0, 0, size, size).data;
  const heights = new Float32Array(size * size);

  for (let i = 0; i < size * size; i++) {
    const r = finalCanvasData[i * 4];
    const g = finalCanvasData[i * 4 + 1];
    const b = finalCanvasData[i * 4 + 2];
    // Brightness as elevation
    heights[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0;
  }

  const nImgData = nCtx.createImageData(size, size);
  const nData = nImgData.data;
  const normalStrength = 3.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const xLeft = x > 0 ? idx - 1 : idx + (size - 1);
      const xRight = x < size - 1 ? idx + 1 : idx - (size - 1);
      const yUp = y > 0 ? idx - size : idx + size * (size - 1);
      const yDown = y < size - 1 ? idx + size : idx - size * (size - 1);

      const dx = (heights[xRight] - heights[xLeft]) * normalStrength;
      const dy = (heights[yDown] - heights[yUp]) * normalStrength;

      const len = Math.sqrt(dx * dx + dy * dy + 1.0);
      const nx = (dx / len) * 0.5 + 0.5;
      const ny = (-dy / len) * 0.5 + 0.5;
      const nz = (1.0 / len) * 0.5 + 0.5;

      const pIdx = idx * 4;
      nData[pIdx]     = Math.floor(nx * 255);
      nData[pIdx + 1] = Math.floor(ny * 255);
      nData[pIdx + 2] = Math.floor(nz * 255);
      nData[pIdx + 3] = 255;
    }
  }
  nCtx.putImageData(nImgData, 0, 0);

  // Create High-Quality Seamless Repeated Textures
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(64, 64);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(64, 64);

  return { map, normalMap };
}

// Procedural Seamless 512x512 Tree Bark Texture & Normal Map Generator
function createProceduralBarkTextures(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d');

  if (!ctx || !nCtx) {
    const fallbackMap = new THREE.CanvasTexture(canvas);
    return { map: fallbackMap, normalMap: fallbackMap };
  }

  // 1. Deep Dark Brown Base Bark Tone
  ctx.fillStyle = '#261810';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Synthesize Base Vertical Grain & Deep Bark Furrows
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Vertical sine harmonics with cross-grain noise for organic bark furrows
      const warp = Math.sin(y * 0.04) * 8 + Math.cos(y * 0.12) * 4 + Math.sin((x + y) * 0.03) * 6;
      const wx = (x + warp + size) % size;

      // Primary vertical ridges and deep grooves
      const ridge1 = (Math.sin(wx * 0.15) + 1.0) * 0.5;
      const ridge2 = (Math.cos(wx * 0.35 + y * 0.08) + 1.0) * 0.5;
      const ridge3 = (Math.sin(wx * 0.70 - y * 0.15) + 1.0) * 0.5;
      const microNoise = Math.random();

      // Combined bark height/elevation value (0 to 1)
      const h = ridge1 * 0.50 + ridge2 * 0.30 + ridge3 * 0.12 + microNoise * 0.08;

      let r = 38, g = 26, b = 18;

      if (h > 0.65) {
        // High raised bark plate highlights (rich warm amber/oak brown)
        r = Math.floor(78 + ridge1 * 38 + microNoise * 15);
        g = Math.floor(54 + ridge2 * 26 + microNoise * 10);
        b = Math.floor(38 + ridge3 * 18 + microNoise * 8);
      } else if (h > 0.45) {
        // Medium bark wood body
        r = Math.floor(58 + ridge2 * 28);
        g = Math.floor(40 + ridge1 * 20);
        b = Math.floor(28 + microNoise * 12);
      } else if (h < 0.28) {
        // Deep fissure / crevice shadow
        r = Math.floor(18 + microNoise * 10);
        g = Math.floor(12 + microNoise * 8);
        b = Math.floor(8 + microNoise * 6);
      } else {
        // Base dark bark
        r = Math.floor(42 + ridge1 * 16);
        g = Math.floor(30 + ridge2 * 12);
        b = Math.floor(20 + microNoise * 10);
      }

      data[idx]     = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // 2. Overlapping Vertical Bark Flakes & Deep Shadow Fissures
  const numFissures = 52;
  for (let f = 0; f < numFissures; f++) {
    const startX = Math.random() * size;
    const startY = Math.random() * size;
    const length = 40 + Math.random() * 130;
    const width = 2.5 + Math.random() * 4.5;

    // Fissure Shadow
    ctx.strokeStyle = 'rgba(10, 6, 4, 0.88)';
    ctx.lineWidth = width;
    ctx.beginPath();
    let cx = startX;
    let cy = startY;
    ctx.moveTo(cx, cy);
    const steps = Math.floor(length / 10);
    for (let s = 0; s < steps; s++) {
      cy += 10;
      cx += (Math.sin(cy * 0.08) * 3) + (Math.random() - 0.5) * 2;
      ctx.lineTo(cx % size, cy % size);
    }
    ctx.stroke();

    // Raised Ridge Highlight Edge right beside fissure
    ctx.strokeStyle = 'rgba(115, 82, 54, 0.70)';
    ctx.lineWidth = width * 0.7;
    ctx.beginPath();
    cx = startX + width * 0.9;
    cy = startY;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < steps; s++) {
      cy += 10;
      cx += (Math.sin(cy * 0.08) * 3) + (Math.random() - 0.5) * 2;
      ctx.lineTo(cx % size, cy % size);
    }
    ctx.stroke();
  }

  // 3. Extract Heights & Generate High-Detail Normal Map
  const finalCanvasData = ctx.getImageData(0, 0, size, size).data;
  const heights = new Float32Array(size * size);

  for (let i = 0; i < size * size; i++) {
    const r = finalCanvasData[i * 4];
    const g = finalCanvasData[i * 4 + 1];
    const b = finalCanvasData[i * 4 + 2];
    heights[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0;
  }

  const nImgData = nCtx.createImageData(size, size);
  const nData = nImgData.data;
  const normalStrength = 4.5; // Strong 3D relief for tree bark

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const xLeft = x > 0 ? idx - 1 : idx + (size - 1);
      const xRight = x < size - 1 ? idx + 1 : idx - (size - 1);
      const yUp = y > 0 ? idx - size : idx + size * (size - 1);
      const yDown = y < size - 1 ? idx + size : idx - size * (size - 1);

      const dx = (heights[xRight] - heights[xLeft]) * normalStrength;
      const dy = (heights[yDown] - heights[yUp]) * normalStrength;

      const len = Math.sqrt(dx * dx + dy * dy + 1.0);
      const nx = (dx / len) * 0.5 + 0.5;
      const ny = (-dy / len) * 0.5 + 0.5;
      const nz = (1.0 / len) * 0.5 + 0.5;

      const pIdx = idx * 4;
      nData[pIdx]     = Math.floor(nx * 255);
      nData[pIdx + 1] = Math.floor(ny * 255);
      nData[pIdx + 2] = Math.floor(nz * 255);
      nData[pIdx + 3] = 255;
    }
  }
  nCtx.putImageData(nImgData, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 3); // Vertical tiling along trunks

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(1, 3);

  return { map, normalMap };
}

export class CityBuilder {
  public static update(time: number) {
    windUniforms.uTime.value = time;
  }

  public static setupLighting(scene: THREE.Scene, camera: THREE.Camera): { sunlight: Sunlight; sky: GradientSky } {
    // 1. Luminous Sky Dome
    const sky = new GradientSky({
      topColor: 0x38bdf8,       // Luminous Sky Blue
      horizonColor: 0x94a3b8,   // Atmospheric Sky Mist
      bottomColor: 0x334155,    // Soft Ground Slate
      exponent: 0.58,
    });
    scene.add(sky.mesh);

    // 2. Very Gentle Background Forest Fog (Névoa leve ao fundo, mantendo visibilidade clara)
    scene.fog = new THREE.FogExp2(0x8ba2b3, 0.0030);

    // 3. Tactical Outdoor Lighting
    const sunlight = new Sunlight(
      new THREE.Vector3(0.65, 0.60, 0.40),
      0xffedd5,
      1.25,
      0x93c5fd,
      0x475569,
      1.35,
      0xbae6fd,
      0.45
    );

    sunlight.syncWithSky(sky);

    scene.add(sunlight.light);
    scene.add(sunlight.ambientLight);
    scene.add(sunlight.skyFillLight);
    scene.add(sunlight.globalAmbient);
    scene.add(sunlight.rimLight);
    scene.add(sunlight.rimLight.target);

    // Camera Fill Light exclusively for ViewModel (Layer 1) to prevent overexposing world objects on close approach
    const cameraLight = new THREE.PointLight(0xfffbeb, 1.2, 8);
    cameraLight.position.set(0.1, 0.1, -0.1);
    cameraLight.layers.disable(0);
    cameraLight.layers.enable(1);
    camera.add(cameraLight);

    return { sunlight, sky };
  }

  public static buildCityEnvironment(scene: THREE.Scene) {
    this.buildForestTerrain(scene);
    this.buildInstancedTrees(scene);
    this.buildSecondaryVegetationAndUndergrowth(scene);
    this.buildInstancedRocksAndLogs(scene);
    this.buildGroundDetails(scene);
    this.buildTacticalForestOutpost(scene);
  }

  // 1. Organic Forest Terrain with Multi-Texture Blending & Natural Undulations
  private static buildForestTerrain(scene: THREE.Scene) {
    const size = 500;
    const segments = 220; // High mesh resolution for smooth slopes
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = getTerrainHeight(vx, vz);
      pos.setY(i, vy);
    }

    geo.computeVertexNormals();
    const normals = geo.attributes.normal;

    // Base Grass Palette (white base color allows Grama.png texture to display with 100% natural color accuracy)
    const colLushGrass    = new THREE.Color(0xffffff); // Pure white base for untinted Grama.png
    const colDeepGrass    = new THREE.Color(0xebf2e4); // Very subtle shading
    const colMossGreen    = new THREE.Color(0xeef5e8); // Subtle moss highlight
    const colDryStraw     = new THREE.Color(0xf2f0dd); // Subtle dry straw tint
    const colLeafLitter   = new THREE.Color(0xbab08a); // Light forest leaf tone
    const colDecayedFloor = new THREE.Color(0x6b5842); // Soft soil accent
    const colDampLoam     = new THREE.Color(0x544331); // Damp soil
    const colWetMud       = new THREE.Color(0x38281a); // Wet trail mud
    const colClaySoil     = new THREE.Color(0x7c6246); // Exposed clay dirt
    const colGravelSlate  = new THREE.Color(0x7a8691); // Slate gravel & pebbles
    const colGraniteRock  = new THREE.Color(0x555e66); // Granite rock outcrop

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      const ny = normals.getY(i);
      const slopeSteepness = 1.0 - ny;

      // Distance to winding dirt trail
      const trailX = Math.sin(vz * 0.018) * 22.0 + Math.cos(vz * 0.04) * 4.0;
      const distToTrail = Math.abs(vx - trailX);

      const canopyDensity = getForestDensity(vx, vz);

      // Multi-scale procedural noise fields for non-repetitive transitions
      const noiseMacro  = (Math.sin(vx * 0.015 + 1.2) * Math.cos(vz * 0.018 - 0.7) + 1.0) * 0.5;
      const noiseMeso   = (Math.sin(vx * 0.07 - vz * 0.05) * Math.cos(vx * 0.06 + vz * 0.08) + 1.0) * 0.5;
      const noiseMicro  = (Math.sin(vx * 0.25 + Math.cos(vz * 0.30)) * Math.cos(vz * 0.22 - Math.sin(vx * 0.28)) + 1.0) * 0.5;
      const noiseLeaves = (Math.sin(vx * 0.12 + vz * 0.14) * Math.sin(vx * 0.18 - vz * 0.15) + 1.0) * 0.5;
      const noiseDirt   = (Math.cos(vx * 0.15 + vz * 0.13) * Math.sin(vx * 0.20 - vz * 0.18) + 1.0) * 0.5;

      let c = colLushGrass.clone();

      // 1. Base Vegetation: Blend Lush Grass, Deep Grass, Moss, and Dry Straw
      c.lerp(colDeepGrass, noiseMacro * 0.35);
      c.lerp(colMossGreen, noiseMeso * 0.25);
      c.lerp(colDryStraw, noiseMicro * 0.15);

      // 2. Canopy Cover: Light Leaf Tone Variation (Subtle)
      if (canopyDensity > 0.35) {
        const leafWeight = THREE.MathUtils.clamp((canopyDensity - 0.35) * 0.3, 0, 0.22);
        const leafColor = colLeafLitter.clone().lerp(colDecayedFloor, noiseLeaves * 0.4);
        c.lerp(leafColor, leafWeight);
      }

      // 3. Exposed Dirt Patches & Clay Soil (Only on high noise breaks)
      if (noiseDirt > 0.74) {
        const dirtWeight = (noiseDirt - 0.74) * 1.8;
        const dirtColor = colClaySoil.clone().lerp(colDampLoam, noiseMeso * 0.5);
        c.lerp(dirtColor, dirtWeight);
      }

      // 4. Trail & Low Hollows (Wet Mud & Damp Loam)
      if (distToTrail < 4.2 && Math.abs(vz) < 145) {
        const trailIntensity = Math.exp(-Math.pow(distToTrail * 0.42, 2));
        const trailColor = colClaySoil.clone().lerp(colDampLoam, 0.5).lerp(colWetMud, trailIntensity * 0.85);
        c.lerp(trailColor, trailIntensity * 0.88);
      } else if (vy < -0.3) {
        // Natural damp creek bed / hollow
        const hollowWeight = THREE.MathUtils.clamp((-0.3 - vy) * 0.6, 0, 0.8);
        c.lerp(colDampLoam, hollowWeight * 0.7).lerp(colWetMud, hollowWeight * 0.4);
      }

      // 5. Steep Slopes & High Altitude Outcrops (Scree, Slate Gravel, Granite Rock)
      if (slopeSteepness > 0.18 || vy > 14.0) {
        const rockWeight = THREE.MathUtils.clamp((slopeSteepness - 0.18) * 4.0 + (vy > 14.0 ? (vy - 14.0) * 0.08 : 0), 0, 1);
        const rockColor = colGravelSlate.clone().lerp(colGraniteRock, noiseMicro * 0.5).lerp(colClaySoil, noiseMeso * 0.2);
        c.lerp(rockColor, rockWeight);
      }

      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const { normalMap } = createProceduralTerrainTextures();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: gramaMap,
      normalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.02,
    });

    const terrainMesh = new THREE.Mesh(geo, terrainMat);
    terrainMesh.name = 'ForestTerrain';
    applyVertexAOToMesh(terrainMesh, { minAO: 0.65, groundAO: true, cornerAO: true });
    scene.add(terrainMesh);
  }

  // 2. High Quality Organic Forest with Multi-Volume Canopies, Low-Poly Branches & 10 Procedural Archetypes
  private static buildInstancedTrees(scene: THREE.Scene) {
    const dummy = new THREE.Object3D();

    // Create 512x512 Tree Bark Texture & Normal Map
    const { map: barkMap, normalMap: barkNormalMap } = createProceduralBarkTextures();

    // Shared Bark & Foliage Materials with rich natural color tones and high-relief 3D bark texture
    const barkDarkMat   = new THREE.MeshStandardMaterial({ map: troncoMap, normalMap: barkNormalMap, normalScale: new THREE.Vector2(2.2, 2.2), color: 0xffffff, roughness: 0.88 });
    const barkOakMat    = new THREE.MeshStandardMaterial({ map: troncoMap, normalMap: barkNormalMap, normalScale: new THREE.Vector2(2.4, 2.4), color: 0xefded0, roughness: 0.90 });
    const barkBirchMat  = new THREE.MeshStandardMaterial({ map: troncoMap, normalMap: barkNormalMap, normalScale: new THREE.Vector2(1.5, 1.5), color: 0xf5f8fc, roughness: 0.72 });
    const barkDeadMat   = new THREE.MeshStandardMaterial({ map: troncoMap, normalMap: barkNormalMap, normalScale: new THREE.Vector2(2.5, 2.5), color: 0xd8d8d8, roughness: 0.85 });

    const foliageDeepPineMat       = new THREE.MeshStandardMaterial({ color: 0x1d422a, roughness: 0.82 });
    const foliageForestOakMat      = new THREE.MeshStandardMaterial({ color: 0x335c20, roughness: 0.80 });
    const foliageMountainSpruceMat = new THREE.MeshStandardMaterial({ color: 0x224a36, roughness: 0.85 });
    const foliageLightBirchMat     = new THREE.MeshStandardMaterial({ color: 0x54821c, roughness: 0.78 });
    const foliageSagePineMat       = new THREE.MeshStandardMaterial({ color: 0x2c4d3a, roughness: 0.84 });
    const foliageAmberOakMat       = new THREE.MeshStandardMaterial({ color: 0x636e22, roughness: 0.82 });
    const foliageSparseMossMat     = new THREE.MeshStandardMaterial({ color: 0x304729, roughness: 0.88 });
    const foliageBrightFirMat      = new THREE.MeshStandardMaterial({ color: 0x3a6927, roughness: 0.85 });

    // Apply wind swaying shader animation to tree canopies
    applyWindSway(foliageDeepPineMat, 0.75);
    applyWindSway(foliageForestOakMat, 0.80);
    applyWindSway(foliageMountainSpruceMat, 0.70);
    applyWindSway(foliageLightBirchMat, 0.90);
    applyWindSway(foliageSagePineMat, 0.85);
    applyWindSway(foliageAmberOakMat, 0.80);
    applyWindSway(foliageSparseMossMat, 0.70);
    applyWindSway(foliageBrightFirMat, 0.80);

    // --- PROCEDURAL TREE SPECIFICATION INTERFACE ---
    interface BranchDef {
      heightPct: number;    // Trunk attachment height (0.0 to 1.0)
      angleY: number;       // Y-axis rotation (radians)
      pitchRad: number;     // Upward/outward pitch angle (radians)
      length: number;       // Branch length (meters)
      radiusBase: number;   // Base branch radius
      radiusTip: number;    // Tip branch radius
      hasFoliage?: boolean; // Whether foliage cluster sits at branch tip
    }

    interface FoliageClusterDef {
      x: number; y: number; z: number;
      rx: number; ry: number; rz: number;
      sx: number; sy: number; sz: number;
      radius: number;
      shape: 'dodeca' | 'icosa' | 'cone';
    }

    interface TreeArchetypeSpec {
      id: string;
      trunkHeight: number;
      trunkRadiusBase: number;
      trunkRadiusTop: number;
      trunkCurveX?: number;
      trunkSegments?: number;
      branches: BranchDef[];
      clusters: FoliageClusterDef[];
      barkMat: THREE.MeshStandardMaterial;
      foliageMat?: THREE.MeshStandardMaterial;
      maxCount: number;
    }

    // --- BUILDER FUNCTION FOR PROCEDURAL LOW-POLY TREE ARCHETYPES ---
    const buildArchetypeGeometries = (spec: TreeArchetypeSpec): { trunkGeo: THREE.BufferGeometry; foliageGeo?: THREE.BufferGeometry } => {
      const trunkGeos: THREE.BufferGeometry[] = [];
      const foliageGeos: THREE.BufferGeometry[] = [];

      // 1. Main Trunk Geometry
      const segs = spec.trunkSegments || 6;
      const mainTrunk = new THREE.CylinderGeometry(spec.trunkRadiusTop, spec.trunkRadiusBase, spec.trunkHeight, segs);
      mainTrunk.translate(0, spec.trunkHeight / 2, 0);

      if (spec.trunkCurveX) {
        const pos = mainTrunk.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const py = pos.getY(i);
          const curveRatio = py / spec.trunkHeight;
          pos.setX(i, pos.getX(i) + Math.sin(curveRatio * Math.PI * 0.8) * spec.trunkCurveX);
        }
        mainTrunk.computeVertexNormals();
      }
      trunkGeos.push(mainTrunk);

      // 2. Low-Poly Branch Cylinders
      spec.branches.forEach((b) => {
        const bGeo = new THREE.CylinderGeometry(b.radiusTip, b.radiusBase, b.length, 5);
        bGeo.translate(0, b.length / 2, 0); // Origin at base
        bGeo.rotateX(b.pitchRad);
        bGeo.rotateY(b.angleY);

        const attachY = spec.trunkHeight * b.heightPct;
        const curveOffset = spec.trunkCurveX ? Math.sin(b.heightPct * Math.PI * 0.8) * spec.trunkCurveX : 0;
        bGeo.translate(curveOffset, attachY, 0);

        trunkGeos.push(bGeo);
      });

      // 3. Multiple Low-Poly Canopy Cluster Volumes
      spec.clusters.forEach((c) => {
        let fGeo: THREE.BufferGeometry;
        if (c.shape === 'cone') {
          fGeo = new THREE.ConeGeometry(c.radius, c.radius * 2.2, 6);
        } else if (c.shape === 'icosa') {
          fGeo = new THREE.IcosahedronGeometry(c.radius, 1);
        } else {
          fGeo = new THREE.DodecahedronGeometry(c.radius, 1);
        }

        fGeo.scale(c.sx, c.sy, c.sz);
        fGeo.rotateX(c.rx);
        fGeo.rotateY(c.ry);
        fGeo.rotateZ(c.rz);
        fGeo.translate(c.x, c.y, c.z);

        foliageGeos.push(fGeo);
      });

      const mergedTrunk = mergeBufferGeometries(trunkGeos);
      const mergedFoliage = foliageGeos.length > 0 ? mergeBufferGeometries(foliageGeos) : undefined;

      return { trunkGeo: mergedTrunk, foliageGeo: mergedFoliage };
    };

    // --- DEFINITION OF 10 PROCEDURAL TREE ARCHETYPES ---
    const archetypeSpecs: TreeArchetypeSpec[] = [
      // 0. Ancient Tall Evergreen Pine
      {
        id: 'ancient_pine',
        trunkHeight: 10.5, trunkRadiusBase: 0.52, trunkRadiusTop: 0.28,
        barkMat: barkDarkMat, foliageMat: foliageDeepPineMat, maxCount: 160,
        branches: [
          { heightPct: 0.52, angleY: 0.2, pitchRad: 0.65, length: 2.8, radiusBase: 0.24, radiusTip: 0.12 },
          { heightPct: 0.65, angleY: 1.8, pitchRad: 0.60, length: 2.5, radiusBase: 0.22, radiusTip: 0.10 },
          { heightPct: 0.78, angleY: 3.5, pitchRad: 0.55, length: 2.1, radiusBase: 0.18, radiusTip: 0.09 },
          { heightPct: 0.88, angleY: 5.1, pitchRad: 0.45, length: 1.7, radiusBase: 0.15, radiusTip: 0.08 },
        ],
        clusters: [
          { x: 0, y: 11.2, z: 0, rx: 0, ry: 0, rz: 0, sx: 1.0, sy: 1.2, sz: 1.0, radius: 2.2, shape: 'cone' },
          { x: 1.6, y: 7.2, z: 0.8, rx: 0.2, ry: 0.5, rz: 0, sx: 1.1, sy: 0.9, sz: 1.1, radius: 1.8, shape: 'dodeca' },
          { x: -1.4, y: 8.2, z: -1.2, rx: -0.1, ry: 1.8, rz: 0, sx: 1.0, sy: 0.95, sz: 1.0, radius: 1.7, shape: 'dodeca' },
          { x: -0.8, y: 9.3, z: 1.3, rx: 0.1, ry: 3.2, rz: 0, sx: 1.1, sy: 1.0, sz: 1.1, radius: 1.6, shape: 'icosa' },
          { x: 1.2, y: 10.1, z: -0.6, rx: 0, ry: 4.8, rz: 0, sx: 0.9, sy: 0.9, sz: 0.9, radius: 1.5, shape: 'dodeca' },
        ],
      },
      // 1. Spreading Grand Oak
      {
        id: 'grand_oak',
        trunkHeight: 7.5, trunkRadiusBase: 0.75, trunkRadiusTop: 0.45,
        barkMat: barkOakMat, foliageMat: foliageForestOakMat, maxCount: 120,
        branches: [
          { heightPct: 0.45, angleY: 0.4, pitchRad: 0.90, length: 3.4, radiusBase: 0.32, radiusTip: 0.18 },
          { heightPct: 0.55, angleY: 1.7, pitchRad: 0.85, length: 3.2, radiusBase: 0.30, radiusTip: 0.16 },
          { heightPct: 0.65, angleY: 3.1, pitchRad: 0.80, length: 2.9, radiusBase: 0.26, radiusTip: 0.14 },
          { heightPct: 0.75, angleY: 4.4, pitchRad: 0.75, length: 2.6, radiusBase: 0.22, radiusTip: 0.12 },
          { heightPct: 0.85, angleY: 5.6, pitchRad: 0.65, length: 2.2, radiusBase: 0.18, radiusTip: 0.10 },
        ],
        clusters: [
          { x: 0, y: 8.5, z: 0, rx: 0.1, ry: 0, rz: 0, sx: 1.3, sy: 0.85, sz: 1.3, radius: 2.8, shape: 'icosa' },
          { x: 2.4, y: 6.2, z: 1.2, rx: 0.2, ry: 0.8, rz: 0.1, sx: 1.2, sy: 0.9, sz: 1.1, radius: 2.2, shape: 'dodeca' },
          { x: -2.2, y: 6.8, z: 1.6, rx: -0.1, ry: 2.1, rz: 0, sx: 1.1, sy: 0.95, sz: 1.2, radius: 2.1, shape: 'icosa' },
          { x: -1.8, y: 7.4, z: -2.0, rx: 0, ry: 3.5, rz: -0.1, sx: 1.2, sy: 0.85, sz: 1.1, radius: 2.3, shape: 'dodeca' },
          { x: 2.0, y: 7.8, z: -1.5, rx: 0.1, ry: 4.9, rz: 0, sx: 1.1, sy: 0.9, sz: 1.2, radius: 2.0, shape: 'icosa' },
          { x: 0, y: 9.6, z: 0.5, rx: 0, ry: 1.2, rz: 0, sx: 1.0, sy: 0.9, sz: 1.0, radius: 2.1, shape: 'dodeca' },
        ],
      },
      // 2. Layered Mountain Spruce
      {
        id: 'mountain_spruce',
        trunkHeight: 8.8, trunkRadiusBase: 0.46, trunkRadiusTop: 0.22,
        barkMat: barkDarkMat, foliageMat: foliageMountainSpruceMat, maxCount: 140,
        branches: [
          { heightPct: 0.38, angleY: 0.8, pitchRad: 0.35, length: 2.8, radiusBase: 0.20, radiusTip: 0.10 },
          { heightPct: 0.52, angleY: 2.4, pitchRad: 0.35, length: 2.4, radiusBase: 0.18, radiusTip: 0.09 },
          { heightPct: 0.66, angleY: 3.9, pitchRad: 0.30, length: 2.0, radiusBase: 0.16, radiusTip: 0.08 },
          { heightPct: 0.78, angleY: 5.5, pitchRad: 0.28, length: 1.6, radiusBase: 0.14, radiusTip: 0.07 },
        ],
        clusters: [
          { x: 0, y: 9.8, z: 0, rx: 0, ry: 0, rz: 0, sx: 1.0, sy: 1.4, sz: 1.0, radius: 1.8, shape: 'cone' },
          { x: 1.8, y: 4.5, z: 1.2, rx: 0.1, ry: 0.8, rz: 0, sx: 1.3, sy: 0.6, sz: 1.3, radius: 2.1, shape: 'cone' },
          { x: -1.6, y: 5.8, z: 1.0, rx: -0.1, ry: 2.4, rz: 0, sx: 1.2, sy: 0.65, sz: 1.2, radius: 1.9, shape: 'cone' },
          { x: -1.2, y: 7.0, z: -1.4, rx: 0, ry: 3.9, rz: 0, sx: 1.1, sy: 0.7, sz: 1.1, radius: 1.7, shape: 'cone' },
          { x: 1.1, y: 8.2, z: -0.9, rx: 0, ry: 5.2, rz: 0, sx: 1.0, sy: 0.75, sz: 1.0, radius: 1.5, shape: 'cone' },
        ],
      },
      // 3. Silver Birch / White Alder
      {
        id: 'silver_birch',
        trunkHeight: 8.6, trunkRadiusBase: 0.30, trunkRadiusTop: 0.16,
        barkMat: barkBirchMat, foliageMat: foliageLightBirchMat, maxCount: 110,
        branches: [
          { heightPct: 0.55, angleY: 0.5, pitchRad: 0.52, length: 2.4, radiusBase: 0.15, radiusTip: 0.08 },
          { heightPct: 0.68, angleY: 2.1, pitchRad: 0.48, length: 2.2, radiusBase: 0.14, radiusTip: 0.07 },
          { heightPct: 0.78, angleY: 3.7, pitchRad: 0.42, length: 1.9, radiusBase: 0.12, radiusTip: 0.06 },
          { heightPct: 0.88, angleY: 5.2, pitchRad: 0.38, length: 1.5, radiusBase: 0.10, radiusTip: 0.05 },
        ],
        clusters: [
          { x: 0, y: 9.4, z: 0, rx: 0, ry: 0, rz: 0, sx: 1.0, sy: 1.1, sz: 1.0, radius: 1.8, shape: 'dodeca' },
          { x: 1.3, y: 6.4, z: 0.7, rx: 0.2, ry: 0.5, rz: 0, sx: 1.0, sy: 0.9, sz: 1.0, radius: 1.5, shape: 'icosa' },
          { x: -1.2, y: 7.3, z: 0.9, rx: -0.1, ry: 2.1, rz: 0, sx: 1.1, sy: 1.0, sz: 1.0, radius: 1.6, shape: 'dodeca' },
          { x: -0.9, y: 8.1, z: -1.1, rx: 0, ry: 3.7, rz: 0, sx: 1.0, sy: 0.95, sz: 1.0, radius: 1.4, shape: 'icosa' },
          { x: 0.8, y: 8.8, z: -0.6, rx: 0.1, ry: 5.2, rz: 0, sx: 0.9, sy: 0.9, sz: 0.9, radius: 1.3, shape: 'dodeca' },
        ],
      },
      // 4. High-Wind Coastal Leaning Pine
      {
        id: 'wind_pine',
        trunkHeight: 8.0, trunkRadiusBase: 0.50, trunkRadiusTop: 0.26, trunkCurveX: 0.75,
        barkMat: barkDarkMat, foliageMat: foliageSagePineMat, maxCount: 90,
        branches: [
          { heightPct: 0.52, angleY: 0.2, pitchRad: 0.70, length: 2.8, radiusBase: 0.22, radiusTip: 0.11 },
          { heightPct: 0.68, angleY: 0.6, pitchRad: 0.65, length: 2.4, radiusBase: 0.20, radiusTip: 0.10 },
          { heightPct: 0.82, angleY: 0.9, pitchRad: 0.55, length: 2.0, radiusBase: 0.16, radiusTip: 0.08 },
        ],
        clusters: [
          { x: 1.2, y: 8.8, z: 0, rx: 0.1, ry: 0.2, rz: 0, sx: 1.2, sy: 0.85, sz: 1.1, radius: 2.1, shape: 'dodeca' },
          { x: 2.5, y: 6.8, z: 0.5, rx: 0.2, ry: 0.6, rz: 0, sx: 1.3, sy: 0.8, sz: 1.0, radius: 1.8, shape: 'icosa' },
          { x: 2.1, y: 7.8, z: 0.8, rx: 0.1, ry: 0.9, rz: 0, sx: 1.1, sy: 0.85, sz: 1.1, radius: 1.7, shape: 'dodeca' },
          { x: 1.8, y: 8.5, z: -0.7, rx: 0, ry: 0.1, rz: 0, sx: 1.0, sy: 0.8, sz: 1.0, radius: 1.6, shape: 'icosa' },
        ],
      },
      // 5. Autumn Golden Amber Maple / Broadleaf
      {
        id: 'autumn_maple',
        trunkHeight: 7.6, trunkRadiusBase: 0.56, trunkRadiusTop: 0.34,
        barkMat: barkOakMat, foliageMat: foliageAmberOakMat, maxCount: 80,
        branches: [
          { heightPct: 0.48, angleY: 0.6, pitchRad: 0.85, length: 3.0, radiusBase: 0.26, radiusTip: 0.14 },
          { heightPct: 0.60, angleY: 2.2, pitchRad: 0.80, length: 2.8, radiusBase: 0.24, radiusTip: 0.13 },
          { heightPct: 0.72, angleY: 3.8, pitchRad: 0.75, length: 2.5, radiusBase: 0.20, radiusTip: 0.11 },
          { heightPct: 0.84, angleY: 5.3, pitchRad: 0.65, length: 2.2, radiusBase: 0.17, radiusTip: 0.09 },
        ],
        clusters: [
          { x: 0, y: 8.4, z: 0, rx: 0, ry: 0, rz: 0, sx: 1.2, sy: 0.9, sz: 1.2, radius: 2.5, shape: 'icosa' },
          { x: 2.1, y: 6.1, z: 1.0, rx: 0.1, ry: 0.6, rz: 0, sx: 1.1, sy: 0.85, sz: 1.1, radius: 2.0, shape: 'dodeca' },
          { x: -1.9, y: 6.7, z: 1.4, rx: -0.1, ry: 2.2, rz: 0, sx: 1.1, sy: 0.9, sz: 1.1, radius: 1.9, shape: 'icosa' },
          { x: -1.5, y: 7.3, z: -1.8, rx: 0, ry: 3.8, rz: 0, sx: 1.2, sy: 0.85, sz: 1.1, radius: 2.0, shape: 'dodeca' },
          { x: 1.7, y: 7.8, z: -1.2, rx: 0.1, ry: 5.3, rz: 0, sx: 1.0, sy: 0.9, sz: 1.1, radius: 1.8, shape: 'icosa' },
        ],
      },
      // 6. Gnarled Sparse Pine (with Dry Lower Bare Branches)
      {
        id: 'sparse_pine',
        trunkHeight: 8.4, trunkRadiusBase: 0.60, trunkRadiusTop: 0.30,
        barkMat: barkDarkMat, foliageMat: foliageSparseMossMat, maxCount: 75,
        branches: [
          // Dry bare lower branches (no leaves)
          { heightPct: 0.38, angleY: 0.3, pitchRad: 0.95, length: 2.8, radiusBase: 0.22, radiusTip: 0.08 },
          { heightPct: 0.48, angleY: 2.1, pitchRad: 0.90, length: 2.5, radiusBase: 0.20, radiusTip: 0.07 },
          { heightPct: 0.58, angleY: 4.2, pitchRad: 0.85, length: 2.2, radiusBase: 0.18, radiusTip: 0.06 },
          // Upper living branches
          { heightPct: 0.75, angleY: 1.2, pitchRad: 0.55, length: 2.0, radiusBase: 0.16, radiusTip: 0.08 },
          { heightPct: 0.88, angleY: 3.4, pitchRad: 0.45, length: 1.6, radiusBase: 0.14, radiusTip: 0.07 },
        ],
        clusters: [
          { x: 0, y: 9.2, z: 0, rx: 0, ry: 0, rz: 0, sx: 1.0, sy: 1.0, sz: 1.0, radius: 1.6, shape: 'dodeca' },
          { x: 1.2, y: 7.8, z: 0.6, rx: 0.1, ry: 1.2, rz: 0, sx: 1.0, sy: 0.85, sz: 1.0, radius: 1.4, shape: 'icosa' },
          { x: -1.0, y: 8.3, z: -0.8, rx: -0.1, ry: 3.4, rz: 0, sx: 0.9, sy: 0.85, sz: 0.9, radius: 1.3, shape: 'dodeca' },
        ],
      },
      // 7. Weathered Dead Snag / Bare Tree (100% Dry Wood)
      {
        id: 'dead_snag',
        trunkHeight: 7.5, trunkRadiusBase: 0.48, trunkRadiusTop: 0.20,
        barkMat: barkDeadMat, maxCount: 50,
        branches: [
          { heightPct: 0.42, angleY: 0.4, pitchRad: 0.80, length: 2.6, radiusBase: 0.20, radiusTip: 0.06 },
          { heightPct: 0.58, angleY: 1.9, pitchRad: 0.90, length: 2.4, radiusBase: 0.18, radiusTip: 0.05 },
          { heightPct: 0.70, angleY: 3.6, pitchRad: 0.75, length: 2.0, radiusBase: 0.15, radiusTip: 0.04 },
          { heightPct: 0.82, angleY: 5.0, pitchRad: 0.60, length: 1.7, radiusBase: 0.12, radiusTip: 0.03 },
          { heightPct: 0.92, angleY: 2.5, pitchRad: 0.40, length: 1.3, radiusBase: 0.10, radiusTip: 0.02 },
        ],
        clusters: [], // Fully dry bare tree!
      },
      // 8. Young Conifer Sapling (Understory Growth)
      {
        id: 'sapling',
        trunkHeight: 4.2, trunkRadiusBase: 0.18, trunkRadiusTop: 0.08,
        barkMat: barkDarkMat, foliageMat: foliageBrightFirMat, maxCount: 130,
        branches: [
          { heightPct: 0.55, angleY: 0.5, pitchRad: 0.50, length: 1.4, radiusBase: 0.08, radiusTip: 0.04 },
          { heightPct: 0.72, angleY: 2.6, pitchRad: 0.45, length: 1.2, radiusBase: 0.07, radiusTip: 0.03 },
          { heightPct: 0.88, angleY: 4.8, pitchRad: 0.40, length: 0.9, radiusBase: 0.06, radiusTip: 0.02 },
        ],
        clusters: [
          { x: 0, y: 4.8, z: 0, rx: 0, ry: 0, rz: 0, sx: 1.0, sy: 1.3, sz: 1.0, radius: 1.1, shape: 'cone' },
          { x: 0.7, y: 3.2, z: 0.4, rx: 0.1, ry: 0.5, rz: 0, sx: 1.0, sy: 0.7, sz: 1.0, radius: 0.9, shape: 'cone' },
          { x: -0.6, y: 3.8, z: -0.5, rx: -0.1, ry: 2.6, rz: 0, sx: 0.9, sy: 0.7, sz: 0.9, radius: 0.8, shape: 'cone' },
        ],
      },
      // 9. Ancient Giant Redwood / Sequoia
      {
        id: 'ancient_giant',
        trunkHeight: 13.0, trunkRadiusBase: 0.90, trunkRadiusTop: 0.48,
        barkMat: barkOakMat, foliageMat: foliageDeepPineMat, maxCount: 65,
        branches: [
          { heightPct: 0.50, angleY: 0.3, pitchRad: 0.75, length: 3.6, radiusBase: 0.35, radiusTip: 0.18 },
          { heightPct: 0.62, angleY: 1.8, pitchRad: 0.70, length: 3.3, radiusBase: 0.32, radiusTip: 0.16 },
          { heightPct: 0.74, angleY: 3.4, pitchRad: 0.65, length: 2.9, radiusBase: 0.28, radiusTip: 0.14 },
          { heightPct: 0.85, angleY: 4.9, pitchRad: 0.55, length: 2.5, radiusBase: 0.24, radiusTip: 0.12 },
          { heightPct: 0.94, angleY: 2.1, pitchRad: 0.45, length: 2.0, radiusBase: 0.18, radiusTip: 0.09 },
        ],
        clusters: [
          { x: 0, y: 13.8, z: 0, rx: 0, ry: 0, rz: 0, sx: 1.1, sy: 1.2, sz: 1.1, radius: 2.6, shape: 'cone' },
          { x: 2.2, y: 8.2, z: 1.1, rx: 0.2, ry: 0.3, rz: 0, sx: 1.2, sy: 0.85, sz: 1.2, radius: 2.2, shape: 'dodeca' },
          { x: -2.0, y: 9.4, z: 1.5, rx: -0.1, ry: 1.8, rz: 0, sx: 1.1, sy: 0.9, sz: 1.1, radius: 2.1, shape: 'icosa' },
          { x: -1.7, y: 10.6, z: -2.1, rx: 0, ry: 3.4, rz: 0, sx: 1.2, sy: 0.85, sz: 1.1, radius: 2.0, shape: 'dodeca' },
          { x: 1.6, y: 11.8, z: -1.4, rx: 0.1, ry: 4.9, rz: 0, sx: 1.0, sy: 0.9, sz: 1.0, radius: 1.9, shape: 'icosa' },
        ],
      },
    ];

    // --- INSTANCED MESH CREATION & TRACKING PER ARCHETYPE ---
    interface ArchetypeRuntime {
      spec: TreeArchetypeSpec;
      trunkMesh: THREE.InstancedMesh;
      foliageMesh?: THREE.InstancedMesh;
      count: number;
    }

    const runtimes: ArchetypeRuntime[] = [];

    archetypeSpecs.forEach((spec) => {
      const { trunkGeo, foliageGeo } = buildArchetypeGeometries(spec);

      const trunkMesh = new THREE.InstancedMesh(trunkGeo, spec.barkMat, spec.maxCount);
      let foliageMesh: THREE.InstancedMesh | undefined;

      if (foliageGeo && spec.foliageMat) {
        foliageMesh = new THREE.InstancedMesh(foliageGeo, spec.foliageMat, spec.maxCount);
      }

      runtimes.push({
        spec,
        trunkMesh,
        foliageMesh,
        count: 0,
      });
    });

    // Helper to spawn a tree instance with natural rotation, scale & tilt
    const placeTreeInstance = (
      x: number,
      z: number,
      archIdx: number,
      scaleBase: number
    ) => {
      const rt = runtimes[archIdx];
      if (!rt || rt.count >= rt.spec.maxCount) return;

      const y = getTerrainHeight(x, z);

      // Natural random scale variations (age differences & width/height proportions)
      const scaleY = scaleBase * (0.82 + Math.random() * 0.42);
      const scaleXZ = scaleBase * (0.85 + Math.random() * 0.35);

      // Random yaw rotation + slight natural tree trunk tilt (slight inclination up to ~7 degrees)
      const rotY = Math.random() * Math.PI * 2;
      const tiltX = (Math.random() - 0.5) * 0.12;
      const tiltZ = (Math.random() - 0.5) * 0.12;

      dummy.position.set(x, y, z);
      dummy.rotation.set(tiltX, rotY, tiltZ);
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      dummy.updateMatrix();

      rt.trunkMesh.setMatrixAt(rt.count, dummy.matrix);
      if (rt.foliageMesh) {
        rt.foliageMesh.setMatrixAt(rt.count, dummy.matrix);
      }
      rt.count++;
    };

    // --- PROCEDURAL CLUSTER & GROVE GENERATION ENGINE ---
    interface GroveCenter {
      x: number;
      z: number;
      radius: number;
      primaryArch: number;
    }

    const groves: GroveCenter[] = [];
    const numGroves = 32;

    for (let g = 0; g < numGroves; g++) {
      const angle = (g / numGroves) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 22 + Math.random() * 185;
      const gx = Math.cos(angle) * dist;
      const gz = Math.sin(angle) * dist;

      const primaryArch = Math.floor(Math.random() * archetypeSpecs.length);

      groves.push({
        x: gx,
        z: gz,
        radius: 18 + Math.random() * 22,
        primaryArch,
      });
    }

    // 1. Spawn trees clustered around Groves
    groves.forEach((grove) => {
      const treesInGrove = 16 + Math.floor(Math.random() * 15);

      for (let t = 0; t < treesInGrove; t++) {
        const angle = Math.random() * Math.PI * 2;
        const offsetDist = Math.pow(Math.random(), 1.4) * grove.radius;
        const tx = grove.x + Math.cos(angle) * offsetDist;
        const tz = grove.z + Math.sin(angle) * offsetDist;

        // Keep central spawn clearing and main road clear
        if (Math.abs(tx) < 16 && Math.abs(tz) < 16) continue;

        // Respect glades/clearings
        const density = getForestDensity(tx, tz);
        if (density < 0.15) continue;

        // Choose archetype based on grove primary + random mix
        let archIdx = grove.primaryArch;
        const rand = Math.random();

        if (rand < 0.12) {
          archIdx = 8; // Understory sapling
        } else if (rand < 0.18) {
          archIdx = 7; // Dead snag
        } else if (rand > 0.60) {
          archIdx = Math.floor(Math.random() * archetypeSpecs.length);
        }

        let scale = 0.85 + Math.random() * 0.45;
        if (rand > 0.92) scale *= 1.35; // Ancient giant specimen

        placeTreeInstance(tx, tz, archIdx, scale);
      }
    });

    // 2. Secondary Poisson scatter for lone trees, glade perimeters & ridge tops
    for (let i = 0; i < 400; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 210;
      const sx = Math.cos(angle) * dist;
      const sz = Math.sin(angle) * dist;

      if (Math.abs(sx) < 16 && Math.abs(sz) < 16) continue;

      const density = getForestDensity(sx, sz);
      if (Math.random() > density * 0.75) continue;

      const archIdx = Math.floor(Math.random() * archetypeSpecs.length);
      const scale = 0.75 + Math.random() * 0.55;

      placeTreeInstance(sx, sz, archIdx, scale);
    }

    // Finalize instanced matrices and add to scene
    runtimes.forEach((rt) => {
      rt.trunkMesh.instanceMatrix.needsUpdate = true;
      scene.add(rt.trunkMesh);

      if (rt.foliageMesh) {
        rt.foliageMesh.instanceMatrix.needsUpdate = true;
        scene.add(rt.foliageMesh);
      }
    });
  }

  // 3. Secondary Vegetation & Rich Organic Undergrowth (Shrubs, Ferns, Wildflowers, Twigs)
  private static buildSecondaryVegetationAndUndergrowth(scene: THREE.Scene) {
    const dummy = new THREE.Object3D();

    // --- A. SHRUBS & BUSHES (Arbustos) ---
    const bushGeo1 = new THREE.DodecahedronGeometry(1.0, 1);
    bushGeo1.translate(0, 0.7, 0);
    const bushMat1 = new THREE.MeshStandardMaterial({ color: 0x2d4f20, roughness: 0.85 });

    const bushGeo2 = new THREE.IcosahedronGeometry(0.85, 1);
    bushGeo2.scale(1.3, 0.75, 1.3);
    bushGeo2.translate(0, 0.5, 0);
    const bushMat2 = new THREE.MeshStandardMaterial({ color: 0x3e6828, roughness: 0.82 });

    applyWindSway(bushMat1, 0.85);
    applyWindSway(bushMat2, 0.85);

    const bushCount1 = 110;
    const bushCount2 = 90;
    const bushMesh1 = new THREE.InstancedMesh(bushGeo1, bushMat1, bushCount1);
    const bushMesh2 = new THREE.InstancedMesh(bushGeo2, bushMat2, bushCount2);

    let bIdx1 = 0;
    let bIdx2 = 0;

    for (let i = 0; i < 300; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 195;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      const y = getTerrainHeight(x, z);
      const density = getForestDensity(x, z);

      // Bushes thrive near glade boundaries and tree perimeters
      if (density < 0.10 || Math.random() > density * 0.85) continue;

      const scaleY = 0.75 + Math.random() * 0.65;
      const scaleXZ = 0.80 + Math.random() * 0.55;

      dummy.position.set(x, y, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.1);
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      dummy.updateMatrix();

      if (Math.random() > 0.45 && bIdx1 < bushCount1) {
        bushMesh1.setMatrixAt(bIdx1++, dummy.matrix);
      } else if (bIdx2 < bushCount2) {
        bushMesh2.setMatrixAt(bIdx2++, dummy.matrix);
      }
    }

    bushMesh1.instanceMatrix.needsUpdate = true;
    bushMesh2.instanceMatrix.needsUpdate = true;
    scene.add(bushMesh1, bushMesh2);

    // --- B. FERNS (Samambaias) ---
    // Composite fern geometry radiating outward
    const fernFrondsGeo = new THREE.BufferGeometry();
    const fernMat = new THREE.MeshStandardMaterial({ color: 0x3a7028, roughness: 0.80, side: THREE.DoubleSide });
    applyWindSway(fernMat, 1.15);

    const frondWidth = 0.35;
    const frondHeight = 1.1;
    const fernPositions: number[] = [];
    const fernIndices: number[] = [];
    let vertOffset = 0;

    // 5 Radiating frond blades angled outwards
    for (let f = 0; f < 5; f++) {
      const frondAngle = (f / 5) * Math.PI * 2 + 0.2;
      const cosA = Math.cos(frondAngle);
      const sinA = Math.sin(frondAngle);

      // Base, mid-curve, and tip points for curved frond
      const x0 = 0, y0 = 0, z0 = 0;
      const x1 = cosA * 0.5, y1 = 0.45, z1 = sinA * 0.5;
      const x2 = cosA * 1.0, y2 = 0.25, z2 = sinA * 1.0;

      const perpX = -sinA * frondWidth * 0.5;
      const perpZ = cosA * frondWidth * 0.5;

      // Add quad vertices
      fernPositions.push(
        x0 - perpX, y0, z0 - perpZ,
        x0 + perpX, y0, z0 + perpZ,
        x1 + perpX * 0.8, y1, z1 + perpZ * 0.8,
        x1 - perpX * 0.8, y1, z1 - perpZ * 0.8,
        x2, y2, z2
      );

      // Add indices
      fernIndices.push(
        vertOffset, vertOffset + 1, vertOffset + 2,
        vertOffset, vertOffset + 2, vertOffset + 3,
        vertOffset + 3, vertOffset + 2, vertOffset + 4
      );
      vertOffset += 5;
    }

    fernFrondsGeo.setAttribute('position', new THREE.Float32BufferAttribute(fernPositions, 3));
    fernFrondsGeo.setIndex(fernIndices);
    fernFrondsGeo.computeVertexNormals();

    const fernCount = 180;
    const fernMesh = new THREE.InstancedMesh(fernFrondsGeo, fernMat, fernCount);

    let fIdx = 0;
    for (let i = 0; i < 280; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 190;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      const y = getTerrainHeight(x, z);
      const density = getForestDensity(x, z);

      // Ferns prefer moist shaded areas under canopy and near low elevations
      if (density < 0.35 && y > 3.0) continue;

      const scale = 0.70 + Math.random() * 0.60;
      dummy.position.set(x, y + 0.05, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.12);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      if (fIdx < fernCount) {
        fernMesh.setMatrixAt(fIdx++, dummy.matrix);
      }
    }

    fernMesh.instanceMatrix.needsUpdate = true;
    scene.add(fernMesh);

    // --- C. DISCRETE WILDFLOWERS (Flores Discretas) ---
    const flowerGeo = new THREE.DodecahedronGeometry(0.22, 0);
    flowerGeo.scale(1.2, 0.6, 1.2);
    flowerGeo.translate(0, 0.3, 0);

    const flowerMat1 = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }); // Discrete White Blooms
    const flowerMat2 = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 }); // Soft Golden Buttercup
    const flowerMat3 = new THREE.MeshStandardMaterial({ color: 0xeebdff, roughness: 0.6 }); // Gentle Violet Petals

    applyWindSway(flowerMat1, 0.75);
    applyWindSway(flowerMat2, 0.75);
    applyWindSway(flowerMat3, 0.75);

    const flowerCount = 130;
    const flowerMesh1 = new THREE.InstancedMesh(flowerGeo, flowerMat1, 50);
    const flowerMesh2 = new THREE.InstancedMesh(flowerGeo, flowerMat2, 45);
    const flowerMesh3 = new THREE.InstancedMesh(flowerGeo, flowerMat3, 35);

    let flIdx1 = 0, flIdx2 = 0, flIdx3 = 0;

    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 190;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      const y = getTerrainHeight(x, z);
      const density = getForestDensity(x, z);

      // Flowers prefer sunlit clearings and glades
      if (density > 0.55) continue;

      const scale = 0.65 + Math.random() * 0.60;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      const choice = Math.random();
      if (choice < 0.40 && flIdx1 < 50) {
        flowerMesh1.setMatrixAt(flIdx1++, dummy.matrix);
      } else if (choice < 0.75 && flIdx2 < 45) {
        flowerMesh2.setMatrixAt(flIdx2++, dummy.matrix);
      } else if (flIdx3 < 35) {
        flowerMesh3.setMatrixAt(flIdx3++, dummy.matrix);
      }
    }

    flowerMesh1.instanceMatrix.needsUpdate = true;
    flowerMesh2.instanceMatrix.needsUpdate = true;
    flowerMesh3.instanceMatrix.needsUpdate = true;
    scene.add(flowerMesh1, flowerMesh2, flowerMesh3);

    // --- D. PEQUENOS GALHOS (Small Twigs / Fallen Branches) ---
    const twigGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.7, 5);
    twigGeo.rotateZ(Math.PI / 2);
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x3d281a, roughness: 0.90 });

    const twigCount = 140;
    const twigMesh = new THREE.InstancedMesh(twigGeo, twigMat, twigCount);

    let twIdx = 0;
    for (let i = 0; i < 220; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 195;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;

      const y = getTerrainHeight(x, z);
      const scaleX = 0.70 + Math.random() * 0.80;
      const scaleXZ = 0.70 + Math.random() * 0.60;

      dummy.position.set(x, y + 0.04, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.1);
      dummy.scale.set(scaleX, scaleXZ, scaleXZ);
      dummy.updateMatrix();

      if (twIdx < twigCount) {
        twigMesh.setMatrixAt(twIdx++, dummy.matrix);
      }
    }

    twigMesh.instanceMatrix.needsUpdate = true;
    scene.add(twigMesh);

    // --- E. HIGH QUALITY DYNAMIC GRASS & GROUND COVER ENGINE ---
    // 1. Short Understory / Lawn Grass Geometry (+) - Tapered 2-plane cross
    const shortGrassGeo = new THREE.BufferGeometry();
    const wBaseShort = 0.38;
    const wTopShort = 0.12;
    const hGrassShort = 0.52;

    const shortVertices = new Float32Array([
      // Plane 1
      -wBaseShort, 0, 0,   wBaseShort, 0, 0,   wTopShort, hGrassShort, 0,  -wTopShort, hGrassShort, 0,
      // Plane 2
      0, 0, -wBaseShort,   0, 0, wBaseShort,   0, hGrassShort, wTopShort,   0, hGrassShort, -wTopShort
    ]);

    const grassIndices = [
      0, 1, 2,  0, 2, 3,
      2, 1, 0,  3, 2, 0,
      4, 5, 6,  4, 6, 7,
      6, 5, 4,  7, 6, 4
    ];

    shortGrassGeo.setAttribute('position', new THREE.BufferAttribute(shortVertices, 3));
    shortGrassGeo.setIndex(grassIndices);
    shortGrassGeo.computeVertexNormals();

    // 2. Star Cluster Tufted Grass Geometry (*) - 3 intersecting planes for dense bushy clumps
    const starTuftGeo = new THREE.BufferGeometry();
    const wBaseStar = 0.44;
    const wTopStar = 0.15;
    const hGrassStar = 0.82;
    const starVertices: number[] = [];
    const starIndicesList: number[] = [];
    let starOffset = 0;

    for (let p = 0; p < 3; p++) {
      const angle = (p / 3) * Math.PI;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const dxBase = cosA * wBaseStar;
      const dzBase = sinA * wBaseStar;
      const dxTop = cosA * wTopStar;
      const dzTop = sinA * wTopStar;

      starVertices.push(
        -dxBase, 0, -dzBase,
         dxBase, 0,  dzBase,
         dxTop, hGrassStar, dzTop,
        -dxTop, hGrassStar, -dzTop
      );

      starIndicesList.push(
        starOffset, starOffset + 1, starOffset + 2,
        starOffset, starOffset + 2, starOffset + 3,
        starOffset + 2, starOffset + 1, starOffset,
        starOffset + 3, starOffset + 2, starOffset
      );
      starOffset += 4;
    }

    starTuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    starTuftGeo.setIndex(starIndicesList);
    starTuftGeo.computeVertexNormals();

    // 3. Tall Wild Reed / Meadow Blade Geometry - Curved bent blades for tall grass
    const tallGrassGeo = new THREE.BufferGeometry();
    const wBaseTall = 0.36;
    const wTopTall = 0.22;
    const hGrassTall = 1.45;

    const tallVertices = new Float32Array([
      // Plane 1 - Curved forward top
      -wBaseTall, 0, 0,   wBaseTall, 0, 0,   wTopTall + 0.18, hGrassTall, 0.15,  -wTopTall + 0.18, hGrassTall, 0.15,
      // Plane 2 - Curved sideways top
      0, 0, -wBaseTall,   0, 0, wBaseTall,   -0.15, hGrassTall, wTopTall + 0.18,  -0.15, hGrassTall, -wTopTall + 0.18
    ]);

    tallGrassGeo.setAttribute('position', new THREE.BufferAttribute(tallVertices, 3));
    tallGrassGeo.setIndex(grassIndices);
    tallGrassGeo.computeVertexNormals();

    // 4. Broadleaf Cover / Clover Cluster Geometry - Ground-hugging round leaves
    const cloverGeo = new THREE.BufferGeometry();
    const cloverSize = 0.45;
    const hClover = 0.28;
    const cloverVertices = new Float32Array([
      -cloverSize, 0.05, -cloverSize,   cloverSize, 0.05, -cloverSize,   cloverSize, hClover,  cloverSize,  -cloverSize, hClover,  cloverSize,
      -cloverSize, 0.05,  cloverSize,   cloverSize, 0.05,  cloverSize,   cloverSize, hClover, -cloverSize,  -cloverSize, hClover, -cloverSize
    ]);
    cloverGeo.setAttribute('position', new THREE.BufferAttribute(cloverVertices, 3));
    cloverGeo.setIndex(grassIndices);
    cloverGeo.computeVertexNormals();

    // 5. Distinct Natural Grass Tonalities & Materials
    const matShortLush = new THREE.MeshStandardMaterial({ color: 0x345e22, roughness: 0.88, side: THREE.DoubleSide });
    const matShortMoss = new THREE.MeshStandardMaterial({ color: 0x456e29, roughness: 0.90, side: THREE.DoubleSide });
    const matMediumForest = new THREE.MeshStandardMaterial({ color: 0x2c4d1a, roughness: 0.89, side: THREE.DoubleSide });
    const matMediumMeadow = new THREE.MeshStandardMaterial({ color: 0x528528, roughness: 0.85, side: THREE.DoubleSide });
    const matTallStraw = new THREE.MeshStandardMaterial({ color: 0x7a8234, roughness: 0.92, side: THREE.DoubleSide });
    const matTallWild = new THREE.MeshStandardMaterial({ color: 0x3d6b24, roughness: 0.86, side: THREE.DoubleSide });
    const matClover = new THREE.MeshStandardMaterial({ color: 0x498c2b, roughness: 0.82, side: THREE.DoubleSide });

    applyWindSway(matShortLush, 1.10);
    applyWindSway(matShortMoss, 0.90);
    applyWindSway(matMediumForest, 1.20);
    applyWindSway(matMediumMeadow, 1.25);
    applyWindSway(matTallStraw, 1.45);
    applyWindSway(matTallWild, 1.35);
    applyWindSway(matClover, 0.75);

    // Instanced meshes for high performance & dense undergrowth cover
    const countShortLush = 1800;
    const countShortMoss = 1400;
    const countMediumForest = 1500;
    const countMediumMeadow = 1200;
    const countTallStraw = 800;
    const countTallWild = 900;
    const countClover = 700;

    const meshShortLush = new THREE.InstancedMesh(shortGrassGeo, matShortLush, countShortLush);
    const meshShortMoss = new THREE.InstancedMesh(shortGrassGeo, matShortMoss, countShortMoss);
    const meshMediumForest = new THREE.InstancedMesh(starTuftGeo, matMediumForest, countMediumForest);
    const meshMediumMeadow = new THREE.InstancedMesh(starTuftGeo, matMediumMeadow, countMediumMeadow);
    const meshTallStraw = new THREE.InstancedMesh(tallGrassGeo, matTallStraw, countTallStraw);
    const meshTallWild = new THREE.InstancedMesh(tallGrassGeo, matTallWild, countTallWild);
    const meshClover = new THREE.InstancedMesh(cloverGeo, matClover, countClover);

    let idxSL = 0, idxSM = 0, idxMF = 0, idxMM = 0, idxTS = 0, idxTW = 0, idxCL = 0;

    const totalSamples = 11000;
    for (let i = 0; i < totalSamples; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 194;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // 1. CLEAR TRAIL PATH & SPAWN CAMP CLEARING
      const trailX = Math.sin(z * 0.018) * 22.0 + Math.cos(z * 0.04) * 4.0;
      const distToTrail = Math.abs(x - trailX);
      if (distToTrail < 2.4 || (Math.abs(x) < 7.5 && Math.abs(z) < 7.5)) continue;

      const y = getTerrainHeight(x, z);
      const density = getForestDensity(x, z);

      // Procedural Noise Fields for Organic Ground Cover Patterns
      const dirtPatchNoise = (Math.sin(x * 0.18 + z * 0.16) * Math.cos(x * 0.24 - z * 0.20) + 1.0) * 0.5;
      const clusterNoise   = (Math.sin(x * 0.085) * Math.cos(z * 0.095) + 1.0) * 0.5;
      const meadowNoise    = (Math.sin(x * 0.04 + 0.5) * Math.cos(z * 0.04 - 0.5) + 1.0) * 0.5;

      // 2. EXPOSED DIRT / LEAF LITTER / CANOPY SHADOW / STEEP SLOPE FILTERS (Áreas sem grama)
      // Skip grass in dirt patches, bare leaf litter spots, very dense tree drip lines, or steep scree slopes
      if (dirtPatchNoise < 0.25 || density > 0.84 || y > 14.0) continue;

      // Cluster voids for natural open gaps between grass thickets
      if (clusterNoise < 0.18 && Math.random() > 0.12) continue;

      // Slope check to avoid grass floating on cliff faces
      const slopeX = Math.abs((getTerrainHeight(x + 0.5, z) - getTerrainHeight(x - 0.5, z)) / 1.0);
      const slopeZ = Math.abs((getTerrainHeight(x, z + 0.5) - getTerrainHeight(x, z - 0.5)) / 1.0);
      if (slopeX > 0.35 || slopeZ > 0.35) continue;

      // 3. DETERMINE GRASS TYPE, HEIGHT, AND SCALE VARIATION
      let grassCategory: 'short' | 'medium' | 'tall' | 'clover' = 'medium';

      if (meadowNoise > 0.62 && density < 0.40) {
        // Sunlit glades & open fields -> Tall wild grass & straw
        grassCategory = Math.random() < 0.65 ? 'tall' : 'medium';
      } else if (density > 0.55 || clusterNoise < 0.38) {
        // Deep forest shade & thicket edges -> Short understory grass & clover
        grassCategory = Math.random() < 0.70 ? 'short' : 'clover';
      } else {
        // General woodland floor -> Mix of medium tufts and short lawn
        const randCat = Math.random();
        if (randCat < 0.45) grassCategory = 'medium';
        else if (randCat < 0.80) grassCategory = 'short';
        else grassCategory = 'clover';
      }

      // Height and width scaling
      let scaleY = 1.0;
      let scaleXZ = 0.75 + Math.random() * 0.55;

      switch (grassCategory) {
        case 'short':
          scaleY = 0.45 + Math.random() * 0.45;
          break;
        case 'medium':
          scaleY = 0.75 + Math.random() * 0.55;
          break;
        case 'tall':
          scaleY = 1.15 + Math.random() * 0.70;
          scaleXZ = 0.85 + Math.random() * 0.50;
          break;
        case 'clover':
          scaleY = 0.50 + Math.random() * 0.40;
          scaleXZ = 0.90 + Math.random() * 0.60;
          break;
      }

      // Natural random pitch, yaw, and roll tilt
      const tiltX = (Math.random() - 0.5) * 0.20;
      const tiltZ = (Math.random() - 0.5) * 0.20;
      const rotY = Math.random() * Math.PI * 2;

      dummy.position.set(x, y, z);
      dummy.rotation.set(tiltX, rotY, tiltZ);
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      dummy.updateMatrix();

      // 4. ASSIGN TO INSTANCED MESHES ACCORDING TO BIOME
      const choice = Math.random();

      if (grassCategory === 'tall') {
        if (dirtPatchNoise > 0.68 && choice < 0.55 && idxTS < countTallStraw) {
          meshTallStraw.setMatrixAt(idxTS++, dummy.matrix);
        } else if (idxTW < countTallWild) {
          meshTallWild.setMatrixAt(idxTW++, dummy.matrix);
        } else if (idxMM < countMediumMeadow) {
          meshMediumMeadow.setMatrixAt(idxMM++, dummy.matrix);
        }
      } else if (grassCategory === 'medium') {
        if (density > 0.45 && choice < 0.60 && idxMF < countMediumForest) {
          meshMediumForest.setMatrixAt(idxMF++, dummy.matrix);
        } else if (idxMM < countMediumMeadow) {
          meshMediumMeadow.setMatrixAt(idxMM++, dummy.matrix);
        } else if (idxSL < countShortLush) {
          meshShortLush.setMatrixAt(idxSL++, dummy.matrix);
        }
      } else if (grassCategory === 'clover') {
        if (idxCL < countClover) {
          meshClover.setMatrixAt(idxCL++, dummy.matrix);
        } else if (idxSM < countShortMoss) {
          meshShortMoss.setMatrixAt(idxSM++, dummy.matrix);
        }
      } else {
        // Short grass
        if (density > 0.50 && choice < 0.55 && idxSM < countShortMoss) {
          meshShortMoss.setMatrixAt(idxSM++, dummy.matrix);
        } else if (idxSL < countShortLush) {
          meshShortLush.setMatrixAt(idxSL++, dummy.matrix);
        }
      }
    }

    meshShortLush.instanceMatrix.needsUpdate = true;
    meshShortMoss.instanceMatrix.needsUpdate = true;
    meshMediumForest.instanceMatrix.needsUpdate = true;
    meshMediumMeadow.instanceMatrix.needsUpdate = true;
    meshTallStraw.instanceMatrix.needsUpdate = true;
    meshTallWild.instanceMatrix.needsUpdate = true;
    meshClover.instanceMatrix.needsUpdate = true;

    scene.add(
      meshShortLush,
      meshShortMoss,
      meshMediumForest,
      meshMediumMeadow,
      meshTallStraw,
      meshTallWild,
      meshClover
    );
  }

  // 4. Instanced Mossy Boulders, Rock Formations & Fallen Mossy Logs
  private static buildInstancedRocksAndLogs(scene: THREE.Scene) {
    const dummy = new THREE.Object3D();

    // --- A. Weathered Boulders, Bedrock Outcrops & Rock Clusters ---
    // 3 Distinct Rock Geometries for non-repetitive organic shapes
    const rockGeoAngular = new THREE.DodecahedronGeometry(1.35, 0); // Jagged granite chunk
    const rockGeoSmooth = new THREE.IcosahedronGeometry(1.15, 1);   // Weathered rounded boulder
    const rockGeoSlab = new THREE.DodecahedronGeometry(1.4, 0);      // Flat bedrock slab
    rockGeoSlab.scale(1.4, 0.50, 1.1);

    // Moss cap layer on top of boulders
    const mossCapGeo = new THREE.DodecahedronGeometry(1.30, 0);
    mossCapGeo.scale(0.95, 0.40, 0.95);
    mossCapGeo.translate(0, 0.52, 0);

    const rockMatGranite = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.86 });
    const rockMatSlate = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.90 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x4d7c2a, roughness: 0.94 });

    const totalRockCount = 180;
    const rockMeshGranite = new THREE.InstancedMesh(rockGeoAngular, rockMatGranite, 70);
    const rockMeshSmooth = new THREE.InstancedMesh(rockGeoSmooth, rockMatGranite, 60);
    const rockMeshSlab = new THREE.InstancedMesh(rockGeoSlab, rockMatSlate, 50);
    const rockMossMesh = new THREE.InstancedMesh(mossCapGeo, mossMat, 120);

    let idxGranite = 0, idxSmooth = 0, idxSlab = 0, idxMoss = 0;

    // Generate 32 Natural Rock Cluster Centers (Agrupamentos Naturais)
    const clusterCenters: { x: number; z: number }[] = [];
    for (let c = 0; c < 32; c++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 185;
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;

      if (Math.abs(cx) < 8 && Math.abs(cz) < 8) continue;
      clusterCenters.push({ x: cx, z: cz });
    }

    // Populate clusters with Anchor Boulders, Satellites, and Partially Buried Slabs
    for (const center of clusterCenters) {
      // 1-2 Anchor Boulders + 2-4 Satellite rocks per cluster
      const clusterSize = 3 + Math.floor(Math.random() * 3);

      for (let k = 0; k < clusterSize; k++) {
        // First item in cluster is central Anchor Boulder; others offset nearby
        const isAnchor = k === 0;
        const offsetDist = isAnchor ? 0 : 1.2 + Math.random() * 3.8;
        const offsetAngle = Math.random() * Math.PI * 2;

        const x = center.x + Math.cos(offsetAngle) * offsetDist;
        const z = center.z + Math.sin(offsetAngle) * offsetDist;

        if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

        const y = getTerrainHeight(x, z);

        // Terrain slope calculation to tilt rocks naturally into hill incline
        const slopeX = (getTerrainHeight(x + 0.6, z) - getTerrainHeight(x - 0.6, z)) / 1.2;
        const slopeZ = (getTerrainHeight(x, z + 0.6) - getTerrainHeight(x, z - 0.6)) / 1.2;

        // Varied sizes ( Anchor: large, Satellites: medium/small )
        const baseScale = isAnchor ? 1.6 + Math.random() * 1.2 : 0.6 + Math.random() * 0.9;
        const sx = baseScale * (0.8 + Math.random() * 0.5);
        const sy = baseScale * (0.5 + Math.random() * 0.6);
        const sz = baseScale * (0.8 + Math.random() * 0.5);

        // Burial Depth: 25% to 60% sunk into terrain for firm natural ground integration
        const buryFactor = 0.25 + Math.random() * 0.35;
        const yPos = y + sy * 0.40 - sy * buryFactor;

        // Natural rotations aligned with slope pitch + random yaw
        const rotX = slopeZ * 0.8 + (Math.random() - 0.5) * 0.4;
        const rotY = Math.random() * Math.PI * 2;
        const rotZ = -slopeX * 0.8 + (Math.random() - 0.5) * 0.4;

        dummy.position.set(x, yPos, z);
        dummy.rotation.set(rotX, rotY, rotZ);
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();

        // Assign rock type & moss overlay
        const choice = Math.random();
        if (choice < 0.40 && idxGranite < 70) {
          rockMeshGranite.setMatrixAt(idxGranite++, dummy.matrix);
          if (sy > 0.6 && idxMoss < 120) rockMossMesh.setMatrixAt(idxMoss++, dummy.matrix);
        } else if (choice < 0.75 && idxSmooth < 60) {
          rockMeshSmooth.setMatrixAt(idxSmooth++, dummy.matrix);
          if (sy > 0.6 && idxMoss < 120) rockMossMesh.setMatrixAt(idxMoss++, dummy.matrix);
        } else if (idxSlab < 50) {
          rockMeshSlab.setMatrixAt(idxSlab++, dummy.matrix);
        }
      }
    }

    // Additional standalone ridge outcrops
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 180;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      const y = getTerrainHeight(x, z);
      const slopeX = (getTerrainHeight(x + 0.6, z) - getTerrainHeight(x - 0.6, z)) / 1.2;
      const slopeZ = (getTerrainHeight(x, z + 0.6) - getTerrainHeight(x, z - 0.6)) / 1.2;

      const sx = 0.8 + Math.random() * 1.1;
      const sy = 0.4 + Math.random() * 0.7;
      const sz = 0.8 + Math.random() * 1.1;

      const buryFactor = 0.30 + Math.random() * 0.35;
      const yPos = y + sy * 0.35 - sy * buryFactor;

      dummy.position.set(x, yPos, z);
      dummy.rotation.set(slopeZ + (Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, -slopeX + (Math.random() - 0.5) * 0.3);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();

      if (idxGranite < 70) {
        rockMeshGranite.setMatrixAt(idxGranite++, dummy.matrix);
      } else if (idxSmooth < 60) {
        rockMeshSmooth.setMatrixAt(idxSmooth++, dummy.matrix);
      }
    }

    rockMeshGranite.instanceMatrix.needsUpdate = true;
    rockMeshSmooth.instanceMatrix.needsUpdate = true;
    rockMeshSlab.instanceMatrix.needsUpdate = true;
    rockMossMesh.instanceMatrix.needsUpdate = true;
    scene.add(rockMeshGranite, rockMeshSmooth, rockMeshSlab, rockMossMesh);

    // --- B. Fallen Mossy Logs & Dead Trunks ---
    const logGeo = new THREE.CylinderGeometry(0.34, 0.42, 5.8, 7);
    logGeo.rotateZ(Math.PI / 2);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3425, roughness: 0.88 });

    // Moss strip on top of fallen log
    const logMossGeo = new THREE.CylinderGeometry(0.36, 0.44, 4.8, 7, 1, false, 0, Math.PI);
    logMossGeo.rotateZ(Math.PI / 2);
    logMossGeo.rotateX(-Math.PI / 2);
    logMossGeo.translate(0, 0.05, 0);

    const logCount = 45;
    const logMesh = new THREE.InstancedMesh(logGeo, logMat, logCount);
    const logMossMesh = new THREE.InstancedMesh(logMossGeo, mossMat, logCount);

    for (let i = 0; i < logCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 185;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      const y = getTerrainHeight(x, z);
      dummy.position.set(x, y + 0.35, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI, (Math.random() - 0.5) * 0.15);
      dummy.scale.set(1.0, 1.0, 1.0);
      dummy.updateMatrix();

      logMesh.setMatrixAt(i, dummy.matrix);
      logMossMesh.setMatrixAt(i, dummy.matrix);
    }

    logMesh.instanceMatrix.needsUpdate = true;
    logMossMesh.instanceMatrix.needsUpdate = true;
    scene.add(logMesh, logMossMesh);
  }

  // 5. Rich Ground Details (Exposed Roots, Mushrooms, Dry Leaves, Pebbles & Dirt Mounds)
  private static buildGroundDetails(scene: THREE.Scene) {
    const dummy = new THREE.Object3D();

    // --- A. EXPOSED TREE ROOTS (Raízes Aparentes) ---
    const rootGeo1 = new THREE.CylinderGeometry(0.12, 0.28, 2.6, 6);
    rootGeo1.rotateZ(Math.PI / 2);
    rootGeo1.rotateY(0.2);
    rootGeo1.translate(0, 0.08, 0);

    const rootGeo2 = new THREE.CylinderGeometry(0.08, 0.22, 2.0, 6);
    rootGeo2.rotateZ(Math.PI / 2.2);
    rootGeo2.rotateY(-0.3);
    rootGeo2.translate(0, 0.06, 0);

    const rootMat = new THREE.MeshStandardMaterial({ color: 0x3d281a, roughness: 0.92 });

    const rootCount1 = 70;
    const rootCount2 = 50;
    const rootMesh1 = new THREE.InstancedMesh(rootGeo1, rootMat, rootCount1);
    const rootMesh2 = new THREE.InstancedMesh(rootGeo2, rootMat, rootCount2);

    let rIdx1 = 0, rIdx2 = 0;
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 190;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      const y = getTerrainHeight(x, z);
      const density = getForestDensity(x, z);

      if (density < 0.40) continue;

      const scaleXZ = 0.80 + Math.random() * 0.50;
      const scaleY = 0.80 + Math.random() * 0.40;

      dummy.position.set(x, y, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.15);
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      dummy.updateMatrix();

      if (Math.random() > 0.45 && rIdx1 < rootCount1) {
        rootMesh1.setMatrixAt(rIdx1++, dummy.matrix);
      } else if (rIdx2 < rootCount2) {
        rootMesh2.setMatrixAt(rIdx2++, dummy.matrix);
      }
    }

    rootMesh1.instanceMatrix.needsUpdate = true;
    rootMesh2.instanceMatrix.needsUpdate = true;
    scene.add(rootMesh1, rootMesh2);

    // --- B. DISCRETE MUSHROOMS (Cogumelos Discretos) ---
    const shroomStemGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.28, 6);
    shroomStemGeo.translate(0, 0.14, 0);
    const shroomStemMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.70 });

    const shroomCapGeo = new THREE.ConeGeometry(0.12, 0.14, 8);
    shroomCapGeo.translate(0, 0.32, 0);

    const shroomCapMatBrown = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
    const shroomCapMatRed = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.60 });

    const shroomCount = 110;
    const shroomStemMesh = new THREE.InstancedMesh(shroomStemGeo, shroomStemMat, shroomCount);
    const shroomCapBrownMesh = new THREE.InstancedMesh(shroomCapGeo, shroomCapMatBrown, 70);
    const shroomCapRedMesh = new THREE.InstancedMesh(shroomCapGeo, shroomCapMatRed, 40);

    let shStemIdx = 0, shBrownIdx = 0, shRedIdx = 0;

    for (let i = 0; i < 180; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 185;
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;

      if (Math.abs(cx) < 7 && Math.abs(cz) < 7) continue;

      const density = getForestDensity(cx, cz);
      if (density < 0.35) continue;

      const clusterSize = 2 + Math.floor(Math.random() * 2);

      for (let c = 0; c < clusterSize; c++) {
        if (shStemIdx >= shroomCount) break;

        const offsetX = (Math.random() - 0.5) * 0.8;
        const offsetZ = (Math.random() - 0.5) * 0.8;
        const x = cx + offsetX;
        const z = cz + offsetZ;
        const y = getTerrainHeight(x, z);

        const scale = 0.70 + Math.random() * 0.60;
        dummy.position.set(x, y, z);
        dummy.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.2);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        shroomStemMesh.setMatrixAt(shStemIdx++, dummy.matrix);

        if (Math.random() < 0.65 && shBrownIdx < 70) {
          shroomCapBrownMesh.setMatrixAt(shBrownIdx++, dummy.matrix);
        } else if (shRedIdx < 40) {
          shroomCapRedMesh.setMatrixAt(shRedIdx++, dummy.matrix);
        }
      }
    }

    shroomStemMesh.instanceMatrix.needsUpdate = true;
    shroomCapBrownMesh.instanceMatrix.needsUpdate = true;
    shroomCapRedMesh.instanceMatrix.needsUpdate = true;
    scene.add(shroomStemMesh, shroomCapBrownMesh, shroomCapRedMesh);

    // --- C. SMALL DIRT/SOIL MOUNDS (Pequenos Montes de Terra) ---
    const moundGeo = new THREE.CylinderGeometry(0.3, 1.1, 0.22, 8);
    moundGeo.translate(0, 0.11, 0);
    const moundMat = new THREE.MeshStandardMaterial({ color: 0x38281a, roughness: 0.95 });

    const moundCount = 65;
    const moundMesh = new THREE.InstancedMesh(moundGeo, moundMat, moundCount);

    let mIdx = 0;
    for (let i = 0; i < 110; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 190;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      const y = getTerrainHeight(x, z);
      const scaleXZ = 0.80 + Math.random() * 0.70;
      const scaleY = 0.70 + Math.random() * 0.60;

      dummy.position.set(x, y - 0.04, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * Math.PI, (Math.random() - 0.5) * 0.1);
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      dummy.updateMatrix();

      if (mIdx < moundCount) {
        moundMesh.setMatrixAt(mIdx++, dummy.matrix);
      }
    }

    moundMesh.instanceMatrix.needsUpdate = true;
    scene.add(moundMesh);

    // --- D. DRY FALLEN LEAVES (Folhas Secas) ---
    const leafClusterGeo = new THREE.CircleGeometry(0.55, 7);
    leafClusterGeo.rotateX(-Math.PI / 2);

    const leafMatAmber = new THREE.MeshStandardMaterial({ color: 0x8c532b, roughness: 0.92, side: THREE.DoubleSide });
    const leafMatOchre = new THREE.MeshStandardMaterial({ color: 0x6b3e1d, roughness: 0.94, side: THREE.DoubleSide });

    const leafCountAmber = 110;
    const leafCountOchre = 90;
    const leafMeshAmber = new THREE.InstancedMesh(leafClusterGeo, leafMatAmber, leafCountAmber);
    const leafMeshOchre = new THREE.InstancedMesh(leafClusterGeo, leafMatOchre, leafCountOchre);

    let lIdxAmber = 0, lIdxOchre = 0;

    for (let i = 0; i < 260; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 4 + Math.random() * 195;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;

      const y = getTerrainHeight(x, z);
      const density = getForestDensity(x, z);

      if (density < 0.40) continue;

      const scaleXZ = 0.70 + Math.random() * 0.70;
      dummy.position.set(x, y + 0.02, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.1);
      dummy.scale.set(scaleXZ, 1.0, scaleXZ);
      dummy.updateMatrix();

      if (Math.random() > 0.45 && lIdxAmber < leafCountAmber) {
        leafMeshAmber.setMatrixAt(lIdxAmber++, dummy.matrix);
      } else if (lIdxOchre < leafCountOchre) {
        leafMeshOchre.setMatrixAt(lIdxOchre++, dummy.matrix);
      }
    }

    leafMeshAmber.instanceMatrix.needsUpdate = true;
    leafMeshOchre.instanceMatrix.needsUpdate = true;
    scene.add(leafMeshAmber, leafMeshOchre);

    // --- E. PEQUENAS PEDRAS & GRAVEL (Pequenas Pedras) ---
    const pebbleGeo = new THREE.DodecahedronGeometry(0.25, 0);
    const pebbleMatSlate = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
    const pebbleMatGranite = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.88 });

    const pebbleCount = 140;
    const pebbleMeshSlate = new THREE.InstancedMesh(pebbleGeo, pebbleMatSlate, 80);
    const pebbleMeshGranite = new THREE.InstancedMesh(pebbleGeo, pebbleMatGranite, 60);

    let pIdxSlate = 0, pIdxGranite = 0;

    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 195;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;

      const y = getTerrainHeight(x, z);
      const scaleXZ = 0.60 + Math.random() * 0.80;
      const scaleY = 0.40 + Math.random() * 0.60;

      dummy.position.set(x, y + scaleY * 0.10, z);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      dummy.updateMatrix();

      if (Math.random() > 0.45 && pIdxSlate < 80) {
        pebbleMeshSlate.setMatrixAt(pIdxSlate++, dummy.matrix);
      } else if (pIdxGranite < 60) {
        pebbleMeshGranite.setMatrixAt(pIdxGranite++, dummy.matrix);
      }
    }

    pebbleMeshSlate.instanceMatrix.needsUpdate = true;
    pebbleMeshGranite.instanceMatrix.needsUpdate = true;
    scene.add(pebbleMeshSlate, pebbleMeshGranite);
  }

  // 6. Tactical Military Encampment & Target Range
  private static buildTacticalForestOutpost(scene: THREE.Scene) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3425, roughness: 0.82 });
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.70 });
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.88 });

    // A. Camouflaged Command Tent at Central Clearing
    const tentGroup = new THREE.Group();
    const tx = 0;
    const tz = -28;
    const ty = getTerrainHeight(tx, tz);
    tentGroup.position.set(tx, ty, tz);

    const tentRoof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 3.2, 4), canvasMat);
    tentRoof.position.y = 3.2;
    tentRoof.rotation.y = Math.PI / 4;
    tentGroup.add(tentRoof);

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6);
    [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]].forEach(([px, pz]) => {
      const pole = new THREE.Mesh(poleGeo, woodMat);
      pole.position.set(px, 1.6, pz);
      tentGroup.add(pole);
    });

    scene.add(tentGroup);

    // B. Wooden Watchtower on Hilltop
    const towerX = -48;
    const towerZ = -58;
    const towerY = getTerrainHeight(towerX, towerZ);
    this.createWoodenWatchtower(scene, towerX, towerY, towerZ, woodMat, metalMat);

    // C. Firing Practice Target Range
    const targetsX = 0;
    const targetsZ = 35;
    const targetsY = getTerrainHeight(targetsX, targetsZ);

    [ -10, -5, 0, 5, 10 ].forEach((offsetX, idx) => {
      const targetGroup = new THREE.Group();
      targetGroup.position.set(targetsX + offsetX, targetsY, targetsZ + (idx % 2) * 5);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), woodMat);
      pole.position.y = 0.9;
      targetGroup.add(pole);

      const boardMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.06), boardMat);
      board.position.y = 1.8;

      const bullseyeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
      const bullseye = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), bullseyeMat);
      bullseye.rotation.x = Math.PI / 2;
      bullseye.position.set(0, 1.9, 0.02);

      targetGroup.add(board);
      targetGroup.add(bullseye);
      scene.add(targetGroup);
    });

    // D. Sandbag Defense Positions
    const sandbagPositions = [
      { x: -14, z: -12, rot: 0.2 },
      { x: 14, z: -12, rot: -0.2 },
      { x: -28, z: 18, rot: 0.7 },
      { x: 28, z: 18, rot: -0.7 },
      { x: 0, z: 18, rot: 0 },
      { x: -50, z: -40, rot: 1.1 },
      { x: 50, z: -40, rot: -1.1 },
    ];

    sandbagPositions.forEach((pos) => {
      const py = getTerrainHeight(pos.x, pos.z);
      this.createSandbagWall(scene, pos.x, py, pos.z, pos.rot, sandbagMat);
    });

    // E. Supply Crates
    for (let c = 0; c < 18; c++) {
      const cx = (Math.random() - 0.5) * 80;
      const cz = (Math.random() - 0.5) * 80;
      if (Math.abs(cx) < 6 && Math.abs(cz) < 6) continue;

      const cy = getTerrainHeight(cx, cz);
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), crateMat);
      crate.position.set(cx, cy + 0.45, cz);
      crate.rotation.y = Math.random() * Math.PI;
      applyVertexAOToMesh(crate, { minAO: 0.4 });
      scene.add(crate);
    }
  }

  private static createWoodenWatchtower(
    scene: THREE.Scene,
    x: number,
    y: number,
    z: number,
    woodMat: THREE.Material,
    metalMat: THREE.Material
  ) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const height = 10.0;
    const legGeo = new THREE.CylinderGeometry(0.22, 0.30, height, 6);

    [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(lx, height / 2, lz);
      group.add(leg);
    });

    const platform = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.4, 5.5), woodMat);
    platform.position.y = height;
    group.add(platform);

    const railing = new THREE.Mesh(new THREE.BoxGeometry(5.3, 1.1, 5.3), metalMat);
    railing.position.y = height + 0.75;
    group.add(railing);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.0, 4), woodMat);
    roof.position.y = height + 3.0;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    scene.add(group);
  }

  private static createSandbagWall(
    scene: THREE.Scene,
    x: number,
    y: number,
    z: number,
    rotY: number,
    mat: THREE.Material
  ) {
    const wallGroup = new THREE.Group();
    wallGroup.position.set(x, y, z);
    wallGroup.rotation.y = rotY;

    const bagGeo = new THREE.BoxGeometry(0.9, 0.32, 0.45);

    for (let layer = 0; layer < 3; layer++) {
      const bagY = layer * 0.29 + 0.16;
      const count = layer % 2 === 0 ? 4 : 3;
      const startX = layer % 2 === 0 ? -1.35 : -0.9;

      for (let i = 0; i < count; i++) {
        const bag = new THREE.Mesh(bagGeo, mat);
        bag.position.set(startX + i * 0.95, bagY, (Math.random() - 0.5) * 0.04);
        wallGroup.add(bag);
      }
    }

    scene.add(wallGroup);
  }
}
