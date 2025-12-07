import * as THREE from 'three';

// --- Simplex Noise Implementation ---
// Based on https://github.com/jwagner/simplex-noise.js (MIT)
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

const p = new Uint8Array(512);
const perm = new Uint8Array(512);
const grad3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
]);

// Initialize permutation table with a seed
function initNoise(seed: number) {
  // Simple LCG for seeding
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
initNoise(42);

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

// --- L-System Logic ---

export interface LSystemRule {
  predecessor: string;
  successor: string;
  probability?: number;
}

export interface TreePreset {
  axiom: string;
  rules: LSystemRule[];
  angle: number;
  iterations: number;
  length: number;
  width: number;
  lengthDecay: number;
  widthDecay: number;
  leafType: 'sphere' | 'diamond' | 'none';
  leafSize: number;
  color: string;
  leafColor: string;
}

export const TREE_PRESETS: Record<string, TreePreset> = {
  conifer: {
    axiom: 'X',
    rules: [
      { predecessor: 'X', successor: 'F[@[-X]+X]' }
    ],
    angle: 25,
    iterations: 5,
    length: 1.5,
    width: 0.4,
    lengthDecay: 0.8,
    widthDecay: 0.7,
    leafType: 'diamond',
    leafSize: 0.4,
    color: '#5c4033',
    leafColor: '#2d5016'
  },
  deciduous: {
    axiom: 'F',
    rules: [
      { predecessor: 'F', successor: 'FF+[+F-F-F]-[-F+F+F]' }
    ],
    angle: 22,
    iterations: 3,
    length: 1.2,
    width: 0.5,
    lengthDecay: 0.7,
    widthDecay: 0.6,
    leafType: 'sphere',
    leafSize: 0.6,
    color: '#8b7355',
    leafColor: '#4a6741'
  },
  bush: {
    axiom: 'X',
    rules: [
      { predecessor: 'X', successor: 'F[+X]F[-X]+X' },
      { predecessor: 'F', successor: 'FF' }
    ],
    angle: 20,
    iterations: 4,
    length: 0.5,
    width: 0.2,
    lengthDecay: 0.9,
    widthDecay: 0.8,
    leafType: 'sphere',
    leafSize: 0.3,
    color: '#6b5b45',
    leafColor: '#6a8c45'
  },
  willow: {
    axiom: 'X',
    rules: [
      { predecessor: 'X', successor: 'F[+X][-X]FX' },
      { predecessor: 'F', successor: 'FF' }
    ],
    angle: 15,
    iterations: 4,
    length: 1.0,
    width: 0.3,
    lengthDecay: 0.85,
    widthDecay: 0.7,
    leafType: 'diamond',
    leafSize: 0.3,
    color: '#5c4033',
    leafColor: '#7a8c45'
  },
  palm: {
    axiom: 'F',
    rules: [
      { predecessor: 'F', successor: 'F[+F]F[-F]F' }
    ],
    angle: 10,
    iterations: 4,
    length: 1.5,
    width: 0.6,
    lengthDecay: 0.9,
    widthDecay: 0.8,
    leafType: 'diamond',
    leafSize: 0.8,
    color: '#8b7355',
    leafColor: '#4a6741'
  }
};

export function generateLSystem(axiom: string, rules: LSystemRule[], iterations: number): string {
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
      if (!matched) {
        next += char;
      }
    }
    current = next;
  }
  return current;
}

// Helper to create geometry from L-System string
// This version returns THREE.BufferGeometry for main thread usage
export function createTreeGeometry(
  type: string, 
  seed: number, 
  lodLevel: number = 0 // 0: High, 1: Mid
): THREE.BufferGeometry {
  const preset = TREE_PRESETS[type] || TREE_PRESETS.conifer;
  initNoise(seed);
  
  // Adjust iterations based on LOD
  const iterations = lodLevel === 0 ? preset.iterations : Math.max(1, preset.iterations - 1);
  const lString = generateLSystem(preset.axiom, preset.rules, iterations);
  
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  
  // Turtle state
  const stack: { pos: THREE.Vector3, dir: THREE.Vector3, width: number }[] = [];
  let pos = new THREE.Vector3(0, 0, 0);
  let dir = new THREE.Vector3(0, 1, 0);
  let width = preset.width;
  let length = preset.length;
  
  // Temp vectors
  const axisZ = new THREE.Vector3(0, 0, 1);
  const axisX = new THREE.Vector3(1, 0, 0);
  const tempVec = new THREE.Vector3();
  const tempQuat = new THREE.Quaternion();
  
  // Helper to add cylinder segment
  const addSegment = (start: THREE.Vector3, end: THREE.Vector3, radiusBottom: number, radiusTop: number) => {
    // Simplified cylinder generation (just a few faces)
    const segments = lodLevel === 0 ? 6 : 4;
    const startIdx = positions.length / 3;
    
    // Calculate basis vectors for the segment
    const segmentDir = new THREE.Vector3().subVectors(end, start).normalize();
    
    // Find a perpendicular vector
    let tangent = new THREE.Vector3(0, 1, 0);
    if (Math.abs(segmentDir.y) > 0.9) tangent.set(1, 0, 0);
    const binormal = new THREE.Vector3().crossVectors(segmentDir, tangent).normalize();
    tangent.crossVectors(binormal, segmentDir).normalize();
    
    // Generate vertices
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      
      // Bottom vertex
      tempVec.copy(tangent).multiplyScalar(cos * radiusBottom)
        .addScaledVector(binormal, sin * radiusBottom)
        .add(start);
      positions.push(tempVec.x, tempVec.y, tempVec.z);
      
      // Normal (approximate)
      tempVec.sub(start).normalize();
      normals.push(tempVec.x, tempVec.y, tempVec.z);
      
      uvs.push(i / segments, 0);
      
      // Top vertex
      tempVec.copy(tangent).multiplyScalar(cos * radiusTop)
        .addScaledVector(binormal, sin * radiusTop)
        .add(end);
      positions.push(tempVec.x, tempVec.y, tempVec.z);
      
      // Normal
      tempVec.sub(end).normalize();
      normals.push(tempVec.x, tempVec.y, tempVec.z);
      
      uvs.push(i / segments, 1);
    }
    
    // Indices
    for (let i = 0; i < segments; i++) {
      const base = startIdx + i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  };
  
  // Helper to add leaf
  const addLeaf = (position: THREE.Vector3) => {
    if (preset.leafType === 'none') return;
    
    // Simple diamond/quad leaf
    const size = preset.leafSize;
    const startIdx = positions.length / 3;
    
    // Random orientation
    const rx = (Math.random() - 0.5) * 2;
    const ry = (Math.random() - 0.5) * 2;
    const rz = (Math.random() - 0.5) * 2;
    
    // 4 vertices for a quad (or 2 triangles)
    // Center at position
    
    // V0
    positions.push(position.x - size/2, position.y, position.z);
    normals.push(0, 1, 0);
    uvs.push(0, 0);
    
    // V1
    positions.push(position.x + size/2, position.y, position.z);
    normals.push(0, 1, 0);
    uvs.push(1, 0);
    
    // V2
    positions.push(position.x, position.y + size, position.z);
    normals.push(0, 1, 0);
    uvs.push(0.5, 1);
    
    indices.push(startIdx, startIdx + 1, startIdx + 2);
    
    // Double sided
    indices.push(startIdx, startIdx + 2, startIdx + 1);
  };

  for (const char of lString) {
    if (char === 'F') {
      // Move forward and draw
      const endPos = new THREE.Vector3().copy(pos).addScaledVector(dir, length);
      
      // Add noise to direction
      const n = noise3D(pos.x * 0.5, pos.y * 0.5, pos.z * 0.5 + seed);
      dir.applyAxisAngle(axisZ, n * 0.2);
      
      const nextWidth = width * preset.widthDecay;
      addSegment(pos, endPos, width, nextWidth);
      
      pos.copy(endPos);
      width = nextWidth;
      
    } else if (char === 'X') {
      // Leaf at end
      addLeaf(pos);
    } else if (char === '+') {
      // Rotate +
      const angle = THREE.MathUtils.degToRad(preset.angle + (Math.random() - 0.5) * 10);
      dir.applyAxisAngle(axisZ, angle);
    } else if (char === '-') {
      // Rotate -
      const angle = THREE.MathUtils.degToRad(preset.angle + (Math.random() - 0.5) * 10);
      dir.applyAxisAngle(axisZ, -angle);
    } else if (char === '[') {
      // Push
      stack.push({
        pos: pos.clone(),
        dir: dir.clone(),
        width: width
      });
      length *= preset.lengthDecay;
      
      // Rotate randomly around Y to give 3D volume
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
      
    } else if (char === ']') {
      // Pop
      const state = stack.pop();
      if (state) {
        pos.copy(state.pos);
        dir.copy(state.dir);
        width = state.width;
        length /= preset.lengthDecay;
      }
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  
  return geometry;
}
