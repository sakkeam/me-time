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
    this.y = z * v.x - x * v.z;
    this.z = x * v.y - y * v.x;
    return this;
  }
  applyAxisAngle(axis, angle) {
    // Rodrigues' rotation formula
    // v_rot = v * cos(a) + (k x v) * sin(a) + k * (k . v) * (1 - cos(a))
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

// --- L-System Presets ---
const TREE_PRESETS = {
  conifer: {
    axiom: 'X',
    rules: [{ predecessor: 'X', successor: 'F[@[-X]+X]' }],
    angle: 25, iterations: 5, length: 1.5, width: 0.4, lengthDecay: 0.8, widthDecay: 0.7,
    leafType: 'diamond', leafSize: 0.4
  },
  deciduous: {
    axiom: 'F',
    rules: [{ predecessor: 'F', successor: 'FF+[+F-F-F]-[-F+F+F]' }],
    angle: 22, iterations: 3, length: 1.2, width: 0.5, lengthDecay: 0.7, widthDecay: 0.6,
    leafType: 'sphere', leafSize: 0.6
  },
  bush: {
    axiom: 'X',
    rules: [{ predecessor: 'X', successor: 'F[+X]F[-X]+X' }, { predecessor: 'F', successor: 'FF' }],
    angle: 20, iterations: 4, length: 0.5, width: 0.2, lengthDecay: 0.9, widthDecay: 0.8,
    leafType: 'sphere', leafSize: 0.3
  },
  willow: {
    axiom: 'X',
    rules: [{ predecessor: 'X', successor: 'F[+X][-X]FX' }, { predecessor: 'F', successor: 'FF' }],
    angle: 15, iterations: 4, length: 1.0, width: 0.3, lengthDecay: 0.85, widthDecay: 0.7,
    leafType: 'diamond', leafSize: 0.3
  },
  palm: {
    axiom: 'F',
    rules: [{ predecessor: 'F', successor: 'F[+F]F[-F]F' }],
    angle: 10, iterations: 4, length: 1.5, width: 0.6, lengthDecay: 0.9, widthDecay: 0.8,
    leafType: 'diamond', leafSize: 0.8
  }
};

function generateLSystem(axiom, rules, iterations) {
  let current = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const char of current) {
      let matched = false;
      for (const rule of rules) {
        if (char === rule.predecessor) {
          if (rule.probability === undefined || Math.random() < rule.probability) {
            next += rule.successor;
            matched = true;
            break;
          }
        }
      }
      if (!matched) next += char;
    }
    current = next;
  }
  return current;
}

function createTreeGeometry(type, seed, lodLevel) {
  const preset = TREE_PRESETS[type] || TREE_PRESETS.conifer;
  initNoise(seed);
  
  const iterations = lodLevel === 0 ? preset.iterations : Math.max(1, preset.iterations - 1);
  const lString = generateLSystem(preset.axiom, preset.rules, iterations);
  
  const positions = [];
  const normals = [];
  const indices = [];
  const uvs = [];
  
  const stack = [];
  let pos = new Vec3(0, 0, 0);
  let dir = new Vec3(0, 1, 0);
  let width = preset.width;
  let length = preset.length;
  
  const axisZ = new Vec3(0, 0, 1);
  
  const addSegment = (start, end, rBottom, rTop) => {
    const segments = lodLevel === 0 ? 6 : 4;
    const startIdx = positions.length / 3;
    
    const segmentDir = end.clone().sub(start).normalize();
    let tangent = new Vec3(0, 1, 0);
    if (Math.abs(segmentDir.y) > 0.9) tangent.set(1, 0, 0);
    const binormal = segmentDir.clone().cross(tangent).normalize();
    tangent = binormal.clone().cross(segmentDir).normalize();
    
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      
      // Bottom
      const vBot = tangent.clone().multiplyScalar(cos * rBottom)
        .add(binormal.clone().multiplyScalar(sin * rBottom))
        .add(start);
      positions.push(vBot.x, vBot.y, vBot.z);
      
      const nBot = vBot.clone().sub(start).normalize();
      normals.push(nBot.x, nBot.y, nBot.z);
      uvs.push(i/segments, 0);
      
      // Top
      const vTop = tangent.clone().multiplyScalar(cos * rTop)
        .add(binormal.clone().multiplyScalar(sin * rTop))
        .add(end);
      positions.push(vTop.x, vTop.y, vTop.z);
      
      const nTop = vTop.clone().sub(end).normalize();
      normals.push(nTop.x, nTop.y, nTop.z);
      uvs.push(i/segments, 1);
    }
    
    for (let i = 0; i < segments; i++) {
      const base = startIdx + i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  };
  
  const addLeaf = (p) => {
    if (preset.leafType === 'none') return;
    const size = preset.leafSize;
    const startIdx = positions.length / 3;
    
    // Quad
    positions.push(p.x - size/2, p.y, p.z); normals.push(0, 1, 0); uvs.push(0, 0);
    positions.push(p.x + size/2, p.y, p.z); normals.push(0, 1, 0); uvs.push(1, 0);
    positions.push(p.x, p.y + size, p.z);   normals.push(0, 1, 0); uvs.push(0.5, 1);
    
    indices.push(startIdx, startIdx + 1, startIdx + 2);
    indices.push(startIdx, startIdx + 2, startIdx + 1);
  };

  for (const char of lString) {
    if (char === 'F') {
      const endPos = pos.clone().add(dir.clone().multiplyScalar(length));
      const n = noise3D(pos.x * 0.5, pos.y * 0.5, pos.z * 0.5 + seed);
      
      // Apply noise rotation
      const noiseAxis = new Vec3(0, 0, 1); // Simplified noise axis
      dir.applyAxisAngle(noiseAxis, n * 0.2);
      
      const nextWidth = width * preset.widthDecay;
      addSegment(pos, endPos, width, nextWidth);
      
      pos.copy(endPos);
      width = nextWidth;
    } else if (char === 'X') {
      addLeaf(pos);
    } else if (char === '+') {
      const angle = (preset.angle + (Math.random() - 0.5) * 10) * Math.PI / 180;
      dir.applyAxisAngle(axisZ, angle);
    } else if (char === '-') {
      const angle = (preset.angle + (Math.random() - 0.5) * 10) * Math.PI / 180;
      dir.applyAxisAngle(axisZ, -angle);
    } else if (char === '[') {
      stack.push({ pos: pos.clone(), dir: dir.clone(), width: width });
      length *= preset.lengthDecay;
      dir.applyAxisAngle(new Vec3(0, 1, 0), Math.random() * Math.PI * 2);
    } else if (char === ']') {
      const state = stack.pop();
      if (state) {
        pos.copy(state.pos);
        dir.copy(state.dir);
        width = state.width;
        length /= preset.lengthDecay;
      }
    }
  }
  
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

// --- Message Handler ---
self.onmessage = function(e) {
  const { type, id, params } = e.data;
  
  if (type === 'generatePrototypes') {
    const { varieties, seed } = params;
    const results = {};
    
    varieties.forEach(v => {
      results[v] = {
        high: createTreeGeometry(v, seed, 0),
        mid: createTreeGeometry(v, seed, 1)
      };
    });
    
    self.postMessage({ type: 'prototypesGenerated', id, results });
    
  } else if (type === 'generateChunk') {
    const { chunkX, chunkZ, density, seed, varieties } = params;
    initNoise(seed + chunkX * 100 + chunkZ);
    
    const instances = [];
    const size = 10; // Chunk size
    const count = Math.floor(density * 100); // Max trees per chunk
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * size;
      const z = (Math.random() - 0.5) * size;
      
      // Noise check for density map
      const n = noise3D(chunkX * 0.1 + x * 0.05, chunkZ * 0.1 + z * 0.05, seed);
      if (n > 0) { // Threshold
        const typeIdx = Math.floor(Math.random() * varieties.length);
        const scale = 0.8 + Math.random() * 0.7;
        const rotation = Math.random() * Math.PI * 2;
        
        instances.push({
          x, z,
          type: varieties[typeIdx],
          scale,
          rotation
        });
      }
    }
    
    self.postMessage({ type: 'chunkGenerated', id, chunkId: params.chunkId, instances });
  }
};
