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

// --- Road Logic ---
const CHUNK_SIZE = 10;

function getRoadType(x, z, seed) {
  // Grid based road system
  // Main roads every 100m (10 chunks)
  // Streets every 50m (5 chunks)
  
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

function getRoadOrientation(x, z, seed) {
  // Determine if road is horizontal (along X) or vertical (along Z) or intersection
  // We check neighbors
  const current = getRoadType(x, z, seed);
  if (current === 'none') return 'none';
  
  const left = getRoadType(x - CHUNK_SIZE, z, seed) !== 'none';
  const right = getRoadType(x + CHUNK_SIZE, z, seed) !== 'none';
  const top = getRoadType(x, z - CHUNK_SIZE, seed) !== 'none';
  const bottom = getRoadType(x, z + CHUNK_SIZE, seed) !== 'none';
  
  if ((left || right) && (top || bottom)) return 'intersection';
  if (left || right) return 'horizontal';
  if (top || bottom) return 'vertical';
  
  // Default if isolated (shouldn't happen much in grid)
  return 'horizontal';
}

// --- Message Handler ---
self.onmessage = function(e) {
  const { type, id, params } = e.data;
  
  if (type === 'generateChunk') {
    const { chunkX, chunkZ, seed } = params;
    
    initNoise(seed);
    
    const x = chunkX * CHUNK_SIZE;
    const z = chunkZ * CHUNK_SIZE;
    
    const roadType = getRoadType(x, z, seed);
    const orientation = getRoadOrientation(x, z, seed);
    
    const instances = [];
    
    if (roadType !== 'none') {
      let rotation = 0;
      if (orientation === 'vertical') rotation = Math.PI / 2;
      
      instances.push({
        x: 0, // Relative to chunk center
        z: 0,
        rotation,
        type: roadType,
        isIntersection: orientation === 'intersection'
      });
    }
    
    self.postMessage({ 
      type: 'chunkGenerated', 
      id, 
      chunkId: params.chunkId, 
      instances,
      roadType // Pass back the type for the Context
    });
  }
};
