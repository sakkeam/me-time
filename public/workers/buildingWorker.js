// --- Simplex Noise (Simplified) ---
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;
const p = new Uint8Array(512);
const perm = new Uint8Array(512);
const grad3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
]);

function initNoise(seed) {
  let s = seed;
  const random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (let i = 0; i < 256; i++) p[i] = Math.floor(random() * 256);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}

function dot(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }

function noise3D(xin, yin, zin) {
  let n0, n1, n2, n3;
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const X0 = i - t; const Y0 = j - t; const Z0 = k - t;
  const x0 = xin - X0; const y0 = yin - Y0; const z0 = zin - Z0;
  
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
    else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
    else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
  } else {
    if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
    else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
    else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
  }
  
  const x1 = x0 - i1 + G3; const y1 = y0 - j1 + G3; const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0*G3; const y2 = y0 - j2 + 2.0*G3; const z2 = z0 - k2 + 2.0*G3;
  const x3 = x0 - 1.0 + 3.0*G3; const y3 = y0 - 1.0 + 3.0*G3; const z3 = z0 - 1.0 + 3.0*G3;
  
  const ii = i & 255; const jj = j & 255; const kk = k & 255;
  const gi0 = perm[ii+perm[jj+perm[kk]]] % 12;
  const gi1 = perm[ii+i1+perm[jj+j1+perm[kk+k1]]] % 12;
  const gi2 = perm[ii+i2+perm[jj+j2+perm[kk+k2]]] % 12;
  const gi3 = perm[ii+1+perm[jj+1+perm[kk+1]]] % 12;
  
  let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
  if (t0 < 0) n0 = 0.0; else { t0 *= t0; n0 = t0 * t0 * dot(grad3.subarray(gi0*3, gi0*3+3), x0, y0, z0); }
  let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
  if (t1 < 0) n1 = 0.0; else { t1 *= t1; n1 = t1 * t1 * dot(grad3.subarray(gi1*3, gi1*3+3), x1, y1, z1); }
  let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
  if (t2 < 0) n2 = 0.0; else { t2 *= t2; n2 = t2 * t2 * dot(grad3.subarray(gi2*3, gi2*3+3), x2, y2, z2); }
  let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
  if (t3 < 0) n3 = 0.0; else { t3 *= t3; n3 = t3 * t3 * dot(grad3.subarray(gi3*3, gi3*3+3), x3, y3, z3); }
  
  return 32.0 * (n0 + n1 + n2 + n3);
}

// --- Road Logic (Duplicated) ---
const CHUNK_SIZE = 10;

function getRoadType(x, z, seed) {
  const n = noise3D(x * 0.01, z * 0.01, seed);
  const gridX = Math.abs(Math.round(x / CHUNK_SIZE));
  const gridZ = Math.abs(Math.round(z / CHUNK_SIZE));
  const isMainX = gridX % 8 === 0;
  const isMainZ = gridZ % 8 === 0;
  const isStreetX = gridX % 4 === 0;
  const isStreetZ = gridZ % 4 === 0;
  
  if (isMainX || isMainZ) {
    if (n > -0.5) return 'main';
  }
  if (isStreetX || isStreetZ) {
    if (n > 0.0) return 'street';
  }
  return 'none';
}

// --- Building Generation Logic ---

const BUILDING_PRESETS = {
  residential: {
    shapes: ['box', 'L-shape'],
    widthRange: [6, 8],
    heightRange: [6, 15],
    depthRange: [6, 8],
    windowDensity: 0.4,
    floorHeight: 3.0,
    colors: ['#D2B48C', '#F5DEB3', '#DEB887', '#BC8F8F']
  },
  commercial: {
    shapes: ['box', 'L-shape', 'stepped'],
    widthRange: [7, 9],
    heightRange: [10, 25],
    depthRange: [7, 9],
    windowDensity: 0.6,
    floorHeight: 3.5,
    colors: ['#A9A9A9', '#808080', '#708090', '#778899']
  },
  office: {
    shapes: ['box', 'stepped', 'tower'],
    widthRange: [8, 9.5],
    heightRange: [20, 40],
    depthRange: [8, 9.5],
    windowDensity: 0.8,
    floorHeight: 3.5,
    colors: ['#B0C4DE', '#ADD8E6', '#87CEEB', '#4682B4']
  },
  industrial: {
    shapes: ['box', 'L-shape'],
    widthRange: [8, 9.5],
    heightRange: [6, 12],
    depthRange: [8, 9.5],
    windowDensity: 0.2,
    floorHeight: 4.0,
    colors: ['#8B4513', '#A0522D', '#CD853F', '#556B2F']
  },
  skyscraper: {
    shapes: ['tower', 'stepped'],
    widthRange: [8, 9.5],
    heightRange: [50, 100],
    depthRange: [8, 9.5],
    windowDensity: 0.9,
    floorHeight: 3.5,
    colors: ['#191970', '#000080', '#483D8B', '#2F4F4F']
  }
};

function createBuildingGeometry(width, height, depth, shape, windowDensity, floorHeight) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  let indexOffset = 0;

  const addQuad = (p1, p2, p3, p4, normal, uv1, uv2, uv3, uv4, isWindow, emissionPhase) => {
    positions.push(...p1, ...p2, ...p3, ...p4);
    normals.push(...normal, ...normal, ...normal, ...normal);
    uvs.push(...uv1, ...uv2, ...uv3, ...uv4);
    const r = isWindow ? 1.0 : 0.0;
    const g = emissionPhase;
    const b = 0.0;
    colors.push(r, g, b, r, g, b, r, g, b, r, g, b);
    indices.push(indexOffset, indexOffset + 1, indexOffset + 2, indexOffset + 2, indexOffset + 1, indexOffset + 3);
    indexOffset += 4;
  };

  const addWall = (start, end, height, normal, uStart, uEnd) => {
    const floors = Math.floor(height / floorHeight);
    const wallLength = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2));
    const columns = Math.floor(wallLength / 2.0) || 1;
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

        const hash = Math.sin(x1 * 12.9898 + y1 * 78.233 + z1 * 43.123) * 43758.5453;
        const isWindow = (hash - Math.floor(hash)) < windowDensity;
        const emissionPhase = (hash - Math.floor(hash));

        const u1 = uStart + (c / columns) * (uEnd - uStart);
        const u2 = uStart + ((c + 1) / columns) * (uEnd - uStart);
        const v1 = f / floors;
        const v2 = (f + 1) / floors;

        addQuad([x1, y2, z1], [x2, y2, z2], [x1, y1, z1], [x2, y1, z2], normal, [u1, v2], [u2, v2], [u1, v1], [u2, v1], isWindow, emissionPhase);
      }
    }
  };

  const addRoof = (minX, maxX, minZ, maxZ, y) => {
    addQuad([minX, y, minZ], [maxX, y, minZ], [minX, y, maxZ], [maxX, y, maxZ], [0, 1, 0], [0, 0], [1, 0], [0, 1], [1, 1], false, 0);
  };

  const generateBox = (bx, by, bz, bw, bh, bd) => {
    const hw = bw / 2;
    const hd = bd / 2;
    addWall([bx - hw, by, bz + hd], [bx + hw, by, bz + hd], bh, [0, 0, 1], 0, 1);
    addWall([bx + hw, by, bz - hd], [bx - hw, by, bz - hd], bh, [0, 0, -1], 0, 1);
    addWall([bx - hw, by, bz - hd], [bx - hw, by, bz + hd], bh, [-1, 0, 0], 0, 1);
    addWall([bx + hw, by, bz + hd], [bx + hw, by, bz - hd], bh, [1, 0, 0], 0, 1);
    addRoof(bx - hw, bx + hw, bz - hd, bz + hd, by + bh);
  };

  if (shape === 'box') {
    generateBox(0, 0, 0, width, height, depth);
  } else if (shape === 'L-shape') {
    const w1 = width;
    const d1 = depth * 0.4;
    generateBox(0, 0, -depth * 0.3, w1, height, d1);
    const w2 = width * 0.4;
    const d2 = depth * 0.6;
    generateBox(-width * 0.3, 0, depth * 0.2, w2, height, d2);
  } else if (shape === 'stepped') {
    generateBox(0, 0, 0, width, height * 0.4, depth);
    generateBox(0, height * 0.4, 0, width * 0.7, height * 0.3, depth * 0.7);
    generateBox(0, height * 0.7, 0, width * 0.4, height * 0.3, depth * 0.4);
  } else if (shape === 'tower') {
    generateBox(0, 0, 0, width, height * 0.1, depth);
    generateBox(0, height * 0.1, 0, width * 0.6, height * 0.8, depth * 0.6);
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

// --- Message Handler ---
self.onmessage = function(e) {
  const { type, id, params } = e.data;
  
  if (type === 'generateChunk') {
    const { chunkX, chunkZ, seed } = params;
    
    initNoise(seed);
    
    const x = chunkX * CHUNK_SIZE;
    const z = chunkZ * CHUNK_SIZE;
    
    // 1. Check if road
    const roadType = getRoadType(x, z, seed);
    if (roadType !== 'none') {
      self.postMessage({ type: 'chunkGenerated', id, chunkId: params.chunkId, hasBuilding: false });
      return;
    }
    
    // 2. Check density
    const density = noise3D(x * 0.005, z * 0.005, seed + 100);
    if (density < -0.2) { // Threshold for building placement
      self.postMessage({ type: 'chunkGenerated', id, chunkId: params.chunkId, hasBuilding: false });
      return;
    }
    
    // 3. Determine Building Type
    let buildingType = 'residential';
    if (density > 0.6) buildingType = 'skyscraper';
    else if (density > 0.4) buildingType = 'office';
    else if (density > 0.2) buildingType = 'commercial';
    else if (density > 0.0) buildingType = 'industrial';
    
    const preset = BUILDING_PRESETS[buildingType];
    
    // 4. Randomize Parameters
    const rand = (offset) => {
      const n = noise3D(x * 0.1 + offset, z * 0.1 + offset, seed + 200);
      return (n + 1) / 2; // 0..1
    };
    
    const width = preset.widthRange[0] + rand(0) * (preset.widthRange[1] - preset.widthRange[0]);
    const height = preset.heightRange[0] + rand(10) * (preset.heightRange[1] - preset.heightRange[0]);
    const depth = preset.depthRange[0] + rand(20) * (preset.depthRange[1] - preset.depthRange[0]);
    const shape = preset.shapes[Math.floor(rand(30) * preset.shapes.length)];
    const color = preset.colors[Math.floor(rand(40) * preset.colors.length)];
    
    // 5. Determine Rotation (Face nearest road)
    // Check neighbors
    const left = getRoadType(x - CHUNK_SIZE, z, seed) !== 'none';
    const right = getRoadType(x + CHUNK_SIZE, z, seed) !== 'none';
    const top = getRoadType(x, z - CHUNK_SIZE, seed) !== 'none';
    const bottom = getRoadType(x, z + CHUNK_SIZE, seed) !== 'none';
    
    let rotation = 0;
    if (bottom) rotation = 0;
    else if (left) rotation = -Math.PI / 2;
    else if (top) rotation = Math.PI;
    else if (right) rotation = Math.PI / 2;
    else rotation = rand(50) * Math.PI * 2; // Random if no road nearby
    
    // 6. Generate Geometry
    const geometry = createBuildingGeometry(width, height, depth, shape, preset.windowDensity, preset.floorHeight);
    
    self.postMessage({
      type: 'chunkGenerated',
      id,
      chunkId: params.chunkId,
      hasBuilding: true,
      geometry,
      instance: {
        x: 0, z: 0, // Relative to chunk center
        rotation,
        color,
        height // For vertical positioning if needed
      }
    });
  }
};
