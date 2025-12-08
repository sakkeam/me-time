// Minimal Vector3 implementation for Worker
class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  normalize() {
    const l = Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
    if (l > 0) this.multiplyScalar(1/l);
    return this;
  }
  cross(v) {
    const x = this.x, y = this.y, z = this.z;
    this.x = y * v.z - z * v.y;
    this.z = x * v.y - y * v.x;
    return this;
  }
  applyAxisAngle(axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const k = axis;
    const dot = this.x*k.x + this.y*k.y + this.z*k.z;
    const crossX = k.y*this.z - k.z*this.y;
    const crossY = k.z*this.x - k.x*this.z;
    const crossZ = k.x*this.y - k.y*this.x;
    
    const x = this.x*c + crossX*s + k.x*dot*(1-c);
    const y = this.y*c + crossY*s + k.y*dot*(1-c);
    const z = this.z*c + crossZ*s + k.z*dot*(1-c);
    this.x = x; this.y = y; this.z = z;
    return this;
  }
}

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
initNoise(42);

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

// --- Flower Geometry Generation ---
function createFlowerGeometry(petalCount) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  // Helper to add a quad
  const addQuad = (p1, p2, p3, p4, normal, uvOffset = [0, 0], color) => {
    const base = positions.length / 3;
    
    positions.push(...p1); normals.push(...normal); uvs.push(0 + uvOffset[0], 0 + uvOffset[1]); colors.push(...color);
    positions.push(...p2); normals.push(...normal); uvs.push(1 + uvOffset[0], 0 + uvOffset[1]); colors.push(...color);
    positions.push(...p3); normals.push(...normal); uvs.push(0 + uvOffset[0], 1 + uvOffset[1]); colors.push(...color);
    positions.push(...p4); normals.push(...normal); uvs.push(1 + uvOffset[0], 1 + uvOffset[1]); colors.push(...color);

    indices.push(base, base + 1, base + 2);
    indices.push(base + 2, base + 1, base + 3);
    
    // Double sided
    indices.push(base, base + 2, base + 1);
    indices.push(base + 2, base + 3, base + 1);
  };

  const stemHeight = 0.15;
  const stemWidth = 0.01;
  const petalLength = 0.1;
  const petalWidth = 0.08;
  const centerRadius = 0.03;
  
  const stemColor = [0.3, 0.5, 0.2];
  const centerColor = [1.0, 0.8, 0.2];
  const petalColor = [1.0, 1.0, 1.0]; // White, to be tinted

  // 1. Stem (Vertical Quad)
  addQuad(
    [-stemWidth/2, 0, 0], [stemWidth/2, 0, 0],
    [-stemWidth/2, stemHeight, 0], [stemWidth/2, stemHeight, 0],
    [0, 0, 1],
    [0, 0],
    stemColor
  );
  // Cross quad for stem volume
  addQuad(
    [0, 0, -stemWidth/2], [0, 0, stemWidth/2],
    [0, stemHeight, -stemWidth/2], [0, stemHeight, stemWidth/2],
    [1, 0, 0],
    [0, 0],
    stemColor
  );

  // 2. Center (Small horizontal quad at top of stem)
  addQuad(
    [-centerRadius, stemHeight, -centerRadius], [centerRadius, stemHeight, -centerRadius],
    [-centerRadius, stemHeight, centerRadius], [centerRadius, stemHeight, centerRadius],
    [0, 1, 0],
    [0.5, 0.5],
    centerColor
  );

  // 3. Petals
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    
    // Petal direction
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    
    const halfPetalWidth = petalWidth / 2;
    const perpX = -dirZ;
    const perpZ = dirX;

    const baseX = dirX * centerRadius * 0.8;
    const baseZ = dirZ * centerRadius * 0.8;
    const baseY = stemHeight;

    const tipCenterX = dirX * (centerRadius + petalLength);
    const tipCenterZ = dirZ * (centerRadius + petalLength);
    const tipCenterY = stemHeight + 0.02; // Slight lift

    // Quad points
    const p1 = [baseX - perpX * halfPetalWidth * 0.3, baseY, baseZ - perpZ * halfPetalWidth * 0.3];
    const p2 = [baseX + perpX * halfPetalWidth * 0.3, baseY, baseZ + perpZ * halfPetalWidth * 0.3];
    const p3 = [tipCenterX - perpX * halfPetalWidth, tipCenterY, tipCenterZ - perpZ * halfPetalWidth];
    const p4 = [tipCenterX + perpX * halfPetalWidth, tipCenterY, tipCenterZ + perpZ * halfPetalWidth];

    // Normal (approximate up)
    const normal = [0, 1, 0];

    addQuad(p1, p2, p3, p4, normal, [0, 1], petalColor);
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
  
  if (type === 'generatePrototype') {
    const { petalCount } = params;
    const geometry = createFlowerGeometry(petalCount);
    self.postMessage({ type: 'prototypeGenerated', id, geometry });
    
  } else if (type === 'generateChunk') {
    const { chunkX, chunkZ, density, threshold, seed, seedOffset = 2000 } = params;
    
    // Initialize noise with chunk-specific seed for independent distribution
    initNoise(seed + seedOffset + chunkX * 73 + chunkZ * 37);
    
    const instances = [];
    const size = 10; // Chunk size
    const gridStep = 0.3; // 0.3m grid (sparser than grass)
    const gridSize = Math.floor(size / gridStep);
    
    // Max instances per chunk based on density (approx 1/8 of grass)
    const maxInstances = Math.min(Math.floor(density * 30), 100);
    let count = 0;

    // Grid sampling with jitter
    for (let ix = 0; ix < gridSize; ix++) {
      for (let iz = 0; iz < gridSize; iz++) {
        if (count >= maxInstances) break;

        const x = (ix * gridStep) - (size / 2) + (Math.random() * 0.2);
        const z = (iz * gridStep) - (size / 2) + (Math.random() * 0.2);
        
        // Noise check
        const n = noise3D(chunkX * 0.1 + x * 0.05, chunkZ * 0.1 + z * 0.05, seed);
        
        if (n > threshold) {
          const rotation = Math.random() * Math.PI * 2;
          const scaleXZ = 0.8 + Math.random() * 0.4;
          const scaleY = 0.8 + Math.random() * 0.4;
          
          // Determine color index based on noise
          // We have 4 colors (0-3)
          const colorNoise = noise3D(chunkX * 0.5 + x * 0.2, chunkZ * 0.5 + z * 0.2, seed + 123);
          const colorIndex = Math.floor((colorNoise + 1) * 2) % 4; // Map -1..1 to 0..3 approx
          
          instances.push({
            x, z,
            rotation,
            scaleXZ,
            scaleY,
            colorIndex: Math.abs(colorIndex)
          });
          count++;
        }
      }
      if (count >= maxInstances) break;
    }
    
    self.postMessage({ type: 'chunkGenerated', id, chunkId: params.chunkId, instances });
  }
};
