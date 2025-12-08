import * as THREE from 'three';

// --- Simplex Noise Implementation ---
// Duplicated to ensure independent seeding
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

const p = new Uint8Array(512);
const perm = new Uint8Array(512);
const grad3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
]);

export function initNoise(seed: number) {
  let s = seed;
  const random = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  for (let i = 0; i < 256; i++) {
    p[i] = Math.floor(random() * 256);
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
  }
}

// Initialize with default seed
initNoise(12345);

function dot(g: Float32Array, x: number, y: number, z: number) {
  return g[0] * x + g[1] * y + g[2] * z;
}

export function noise3D(xin: number, yin: number, zin: number) {
  let n0, n1, n2, n3;

  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;
  const z0 = zin - Z0;

  let i1, j1, k1;
  let i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;
  const gi0 = perm[ii + perm[jj + perm[kk]]] % 12;
  const gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12;
  const gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12;
  const gi3 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12;

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 < 0) n0 = 0.0;
  else {
    t0 *= t0;
    n0 = t0 * t0 * dot(grad3.subarray(gi0 * 3, gi0 * 3 + 3), x0, y0, z0);
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 < 0) n1 = 0.0;
  else {
    t1 *= t1;
    n1 = t1 * t1 * dot(grad3.subarray(gi1 * 3, gi1 * 3 + 3), x1, y1, z1);
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 < 0) n2 = 0.0;
  else {
    t2 *= t2;
    n2 = t2 * t2 * dot(grad3.subarray(gi2 * 3, gi2 * 3 + 3), x2, y2, z2);
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 < 0) n3 = 0.0;
  else {
    t3 *= t3;
    n3 = t3 * t3 * dot(grad3.subarray(gi3 * 3, gi3 * 3 + 3), x3, y3, z3);
  }

  return 32.0 * (n0 + n1 + n2 + n3);
}

// --- Building Generation ---

export type BuildingType = 'residential' | 'commercial' | 'office' | 'industrial' | 'skyscraper';
export type BuildingShape = 'box' | 'L-shape' | 'stepped' | 'tower';

export interface BuildingPreset {
  type: BuildingType;
  shapes: BuildingShape[];
  widthRange: [number, number];
  heightRange: [number, number];
  depthRange: [number, number];
  windowDensity: number; // 0-1
  floorHeight: number;
  colors: string[]; // Hex colors
}

export const BUILDING_PRESETS: Record<BuildingType, BuildingPreset> = {
  residential: {
    type: 'residential',
    shapes: ['box', 'L-shape'],
    widthRange: [6, 12],
    heightRange: [6, 15],
    depthRange: [6, 12],
    windowDensity: 0.4,
    floorHeight: 3.0,
    colors: ['#D2B48C', '#F5DEB3', '#DEB887', '#BC8F8F'] // Earthy tones
  },
  commercial: {
    type: 'commercial',
    shapes: ['box', 'L-shape', 'stepped'],
    widthRange: [10, 20],
    heightRange: [10, 25],
    depthRange: [10, 20],
    windowDensity: 0.6,
    floorHeight: 3.5,
    colors: ['#A9A9A9', '#808080', '#708090', '#778899'] // Greys
  },
  office: {
    type: 'office',
    shapes: ['box', 'stepped', 'tower'],
    widthRange: [15, 25],
    heightRange: [20, 40],
    depthRange: [15, 25],
    windowDensity: 0.8,
    floorHeight: 3.5,
    colors: ['#B0C4DE', '#ADD8E6', '#87CEEB', '#4682B4'] // Blues/Glassy
  },
  industrial: {
    type: 'industrial',
    shapes: ['box', 'L-shape'],
    widthRange: [15, 30],
    heightRange: [6, 12],
    depthRange: [15, 30],
    windowDensity: 0.2,
    floorHeight: 4.0,
    colors: ['#8B4513', '#A0522D', '#CD853F', '#556B2F'] // Browns/Greens
  },
  skyscraper: {
    type: 'skyscraper',
    shapes: ['tower', 'stepped'],
    widthRange: [20, 30],
    heightRange: [50, 100],
    depthRange: [20, 30],
    windowDensity: 0.9,
    floorHeight: 3.5,
    colors: ['#191970', '#000080', '#483D8B', '#2F4F4F'] // Dark blues/greys
  }
};

export const BUILDING_SEED_OFFSET = 5000;

export interface BuildingGeometryData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array; // R: Window(1)/Wall(0), G: Emission Phase, B: Unused
  indices: Uint16Array;
}

export function createBuildingGeometry(
  width: number,
  height: number,
  depth: number,
  shape: BuildingShape,
  windowDensity: number,
  floorHeight: number
): BuildingGeometryData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let indexOffset = 0;

  const addQuad = (
    p1: number[], p2: number[], p3: number[], p4: number[],
    normal: number[],
    uv1: number[], uv2: number[], uv3: number[], uv4: number[],
    isWindow: boolean,
    emissionPhase: number
  ) => {
    positions.push(...p1, ...p2, ...p3, ...p4);
    normals.push(...normal, ...normal, ...normal, ...normal);
    uvs.push(...uv1, ...uv2, ...uv3, ...uv4);
    
    const r = isWindow ? 1.0 : 0.0;
    const g = emissionPhase;
    const b = 0.0;
    
    colors.push(r, g, b, r, g, b, r, g, b, r, g, b);

    indices.push(
      indexOffset, indexOffset + 1, indexOffset + 2,
      indexOffset + 2, indexOffset + 1, indexOffset + 3
    );
    indexOffset += 4;
  };

  const addWall = (
    start: number[], end: number[], height: number,
    normal: number[],
    uStart: number, uEnd: number
  ) => {
    // Divide wall into floors and columns for window placement
    const floors = Math.floor(height / floorHeight);
    const wallLength = Math.sqrt(
      Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2)
    );
    const columns = Math.floor(wallLength / 2.0); // Assume ~2m window spacing

    const dx = (end[0] - start[0]) / columns;
    const dz = (end[2] - start[2]) / columns;
    const dy = height / floors;

    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < columns; c++) {
        const x1 = start[0] + dx * c;
        const z1 = start[2] + dz * c;
        const y1 = start[1] + dy * f;

        const x2 = start[0] + dx * (c + 1);
        const z2 = start[2] + dz * (c + 1);
        const y2 = start[1] + dy * (f + 1);

        // Determine if this segment has a window
        // Use simple hash for determinism based on position
        const hash = Math.sin(x1 * 12.9898 + y1 * 78.233 + z1 * 43.123) * 43758.5453;
        const isWindow = (hash - Math.floor(hash)) < windowDensity;
        const emissionPhase = (hash - Math.floor(hash)); // Random phase 0-1

        // Wall segment quad
        // If window, we might want to inset it or just color it
        // For simplicity, we just color it
        
        // UVs
        const u1 = uStart + (c / columns) * (uEnd - uStart);
        const u2 = uStart + ((c + 1) / columns) * (uEnd - uStart);
        const v1 = f / floors;
        const v2 = (f + 1) / floors;

        addQuad(
          [x1, y2, z1], [x2, y2, z2],
          [x1, y1, z1], [x2, y1, z2],
          normal,
          [u1, v2], [u2, v2], [u1, v1], [u2, v1],
          isWindow,
          emissionPhase
        );
      }
    }
  };

  const addRoof = (
    minX: number, maxX: number, minZ: number, maxZ: number, y: number
  ) => {
    addQuad(
      [minX, y, minZ], [maxX, y, minZ],
      [minX, y, maxZ], [maxX, y, maxZ],
      [0, 1, 0],
      [0, 0], [1, 0], [0, 1], [1, 1],
      false, 0
    );
  };

  // --- Shape Generation Logic ---

  const generateBox = (bx: number, by: number, bz: number, bw: number, bh: number, bd: number) => {
    const hw = bw / 2;
    const hd = bd / 2;
    
    // Front
    addWall(
      [bx - hw, by, bz + hd], [bx + hw, by, bz + hd], bh,
      [0, 0, 1], 0, 1
    );
    // Back
    addWall(
      [bx + hw, by, bz - hd], [bx - hw, by, bz - hd], bh,
      [0, 0, -1], 0, 1
    );
    // Left
    addWall(
      [bx - hw, by, bz - hd], [bx - hw, by, bz + hd], bh,
      [-1, 0, 0], 0, 1
    );
    // Right
    addWall(
      [bx + hw, by, bz + hd], [bx + hw, by, bz - hd], bh,
      [1, 0, 0], 0, 1
    );
    // Roof
    addRoof(bx - hw, bx + hw, bz - hd, bz + hd, by + bh);
  };

  if (shape === 'box') {
    generateBox(0, 0, 0, width, height, depth);
  } else if (shape === 'L-shape') {
    // Main block
    const w1 = width;
    const d1 = depth * 0.4;
    generateBox(0, 0, -depth * 0.3, w1, height, d1);
    
    // Side block
    const w2 = width * 0.4;
    const d2 = depth * 0.6;
    generateBox(-width * 0.3, 0, depth * 0.2, w2, height, d2);
  } else if (shape === 'stepped') {
    // Bottom tier
    generateBox(0, 0, 0, width, height * 0.4, depth);
    // Middle tier
    generateBox(0, height * 0.4, 0, width * 0.7, height * 0.3, depth * 0.7);
    // Top tier
    generateBox(0, height * 0.7, 0, width * 0.4, height * 0.3, depth * 0.4);
  } else if (shape === 'tower') {
    // Base
    generateBox(0, 0, 0, width, height * 0.1, depth);
    // Shaft
    generateBox(0, height * 0.1, 0, width * 0.6, height * 0.8, depth * 0.6);
    // Spire/Top
    generateBox(0, height * 0.9, 0, width * 0.4, height * 0.1, depth * 0.4);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices)
  };
}
