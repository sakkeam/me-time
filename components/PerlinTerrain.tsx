'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Simplex 3D Noise by Ian McEwan, Ashima Arts
const noiseFunctions = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}
`

const vertexShader = `
varying vec2 vUv;
varying float vHeight;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float uScale;
uniform float uAmplitude;
uniform int uOctaves;

${noiseFunctions}

float getNoiseHeight(vec2 pos) {
  float height = 0.0;
  float frequency = uScale;
  float amplitude = uAmplitude;
  float maxVal = 0.0;

  for(int i = 0; i < 4; i++) {
    if(i >= uOctaves) break;
    height += snoise(vec3(pos * frequency, 0.0)) * amplitude;
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return height;
}

void main() {
  vUv = uv;
  
  // Calculate height at current position
  vec3 pos = position;
  float height = getNoiseHeight(pos.xy); // Plane is rotated, so xy corresponds to world xz before rotation
  
  // Calculate normal using finite difference
  float eps = 0.1;
  float h_x1 = getNoiseHeight(pos.xy + vec2(eps, 0.0));
  float h_x2 = getNoiseHeight(pos.xy - vec2(eps, 0.0));
  float h_y1 = getNoiseHeight(pos.xy + vec2(0.0, eps));
  float h_y2 = getNoiseHeight(pos.xy - vec2(0.0, eps));
  
  // Calculate tangent vectors
  vec3 tangentX = normalize(vec3(2.0 * eps, 0.0, h_x1 - h_x2));
  vec3 tangentY = normalize(vec3(0.0, 2.0 * eps, h_y1 - h_y2));
  
  // Normal is cross product of tangents
  // Note: Since we displace Z in local space (which becomes Y in world space after rotation),
  // we need to be careful with coordinates.
  // Local Z is height. Local X, Y are plane coordinates.
  
  // Let's simplify:
  // We displace along Z (normal of the plane).
  // New position P' = P + N * height
  
  pos.z += height;
  vHeight = height;
  
  // Re-calculate normal
  // We want the normal in view space for lighting
  // Tangent along X: (1, 0, dh/dx)
  // Tangent along Y: (0, 1, dh/dy)
  // Normal = Cross(Tx, Ty) = (-dh/dx, -dh/dy, 1)
  
  float dhdx = (h_x1 - h_x2) / (2.0 * eps);
  float dhdy = (h_y1 - h_y2) / (2.0 * eps);
  
  vec3 objectNormal = normalize(vec3(-dhdx, -dhdy, 1.0));
  vNormal = normalMatrix * objectNormal;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`

const fragmentShader = `
varying float vHeight;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform vec3 uColorLow;
uniform vec3 uColorMid;
uniform vec3 uColorHigh;

void main() {
  // Height-based color mixing
  // Normalize height roughly between -amplitude and +amplitude
  // Let's assume range -10 to 10 for mixing
  float h = smoothstep(-5.0, 10.0, vHeight);
  
  vec3 color = mix(uColorLow, uColorMid, smoothstep(0.0, 0.4, h));
  color = mix(color, uColorHigh, smoothstep(0.4, 0.8, h));
  
  // Simple lighting
  vec3 normal = normalize(vNormal);
  
  // Directional light (sun)
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float diff = max(dot(normal, lightDir), 0.0);
  
  // Ambient light
  vec3 ambient = vec3(0.3);
  
  // Final color
  vec3 finalColor = color * (ambient + vec3(diff));
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`

// --- JS Simplex Noise Implementation ---
// Based on https://github.com/jwagner/simplex-noise.js (MIT)
// Simplified for 2D/3D usage here

const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

const p = new Uint8Array(512);
const perm = new Uint8Array(512);
const grad3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
]);

// Initialize permutation table
for (let i = 0; i < 256; i++) {
  p[i] = Math.floor(Math.random() * 256);
}
for (let i = 0; i < 512; i++) {
  perm[i] = p[i & 255];
}

function dot(g: Float32Array, x: number, y: number, z: number) {
  return g[0] * x + g[1] * y + g[2] * z;
}

function noise3D(xin: number, yin: number, zin: number) {
  let n0, n1, n2, n3; // Noise contributions from the four corners

  // Skew the input space to determine which simplex cell we're in
  const s = (xin + yin + zin) * F3; // Very nice and simple skew factor for 3D
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const X0 = i - t; // Unskew the cell origin back to (x,y,z) space
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = xin - X0; // The x,y,z distances from the cell origin
  const y0 = yin - Y0;
  const z0 = zin - Z0;

  // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
  // Determine which simplex we are in.
  let i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
  let i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } // X Y Z order
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } // X Z Y order
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } // Z X Y order
  } else { // x0 < y0
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } // Z Y X order
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } // Y Z X order
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } // Y X Z order
  }

  // A step of (1,0,0) in (i,j,k) means a step of (1-c, -c, -c) in (x,y,z),
  // a step of (0,1,0) in (i,j,k) means a step of (-c, 1-c, -c) in (x,y,z), and
  // a step of (0,0,1) in (i,j,k) means a step of (-c, -c, 1-c) in (x,y,z), where
  // c = 1/6.
  const x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3; // Offsets for third corner in (x,y,z) coords
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3; // Offsets for last corner in (x,y,z) coords
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  // Work out the hashed gradient indices of the four simplex corners
  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;
  const gi0 = perm[ii + perm[jj + perm[kk]]] % 12;
  const gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12;
  const gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12;
  const gi3 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12;

  // Calculate the contribution from the four corners
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

  // Add contributions from each corner to get the final noise value.
  // The result is scaled to stay just inside [-1,1]
  return 32.0 * (n0 + n1 + n2 + n3);
}

// --- End JS Simplex Noise ---

interface PerlinTerrainProps {
  scale?: number
  amplitude?: number
  octaves?: number
  debug?: boolean
  onHeightTextureReady?: (texture: THREE.DataTexture, size: number) => void
}

export default function PerlinTerrain({
  scale = 0.03,
  amplitude = 8.0,
  octaves = 4,
  debug = false,
  onHeightTextureReady
}: PerlinTerrainProps) {
  const { camera } = useThree()
  const [lodLevel, setLodLevel] = useState<number>(0) // 0: High, 1: Mid, 2: Low

  // Refs for meshes
  const highResRef = useRef<THREE.Mesh>(null)
  const midResRef = useRef<THREE.Mesh>(null)
  const lowResRef = useRef<THREE.Mesh>(null)

  const uniforms = useMemo(
    () => ({
      uScale: { value: scale },
      uAmplitude: { value: amplitude },
      uOctaves: { value: octaves },
      uColorLow: { value: new THREE.Color('#2d5016') },
      uColorMid: { value: new THREE.Color('#8b7355') },
      uColorHigh: { value: new THREE.Color('#e8e8e8') },
    }),
    [scale, amplitude, octaves]
  )

  // Update uniforms when props change
  useMemo(() => {
    uniforms.uScale.value = scale
    uniforms.uAmplitude.value = amplitude
    uniforms.uOctaves.value = octaves
  }, [scale, amplitude, octaves, uniforms])

  // Texture Generation Logic
  useEffect(() => {
    if (!onHeightTextureReady) return

    const timer = setTimeout(() => {
      const size = 512
      const data = new Float32Array(size * size * 4)
      
      // Determine physical size based on LOD
      // 0: 30, 1: 60, 2: 100
      const physicalSize = lodLevel === 0 ? 30 : (lodLevel === 1 ? 60 : 100)
      
      // Generate height map
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          // Map texture coord (0-1) to physical coord (-size/2 to size/2)
          const u = x / size
          const v = y / size
          
          const worldX = (u - 0.5) * physicalSize
          const worldZ = (v - 0.5) * physicalSize // In terrain shader, we use pos.xy which is world xz
          
          // Calculate height using same logic as shader
          let height = 0.0
          let freq = scale
          let amp = amplitude
          
          for(let i = 0; i < 4; i++) {
            if(i >= octaves) break
            // snoise(vec3(pos * frequency, 0.0))
            height += noise3D(worldX * freq, worldZ * freq, 0.0) * amp
            amp *= 0.5
            freq *= 2.0
          }
          
          const index = (y * size + x) * 4
          data[index] = height // R channel = height
          data[index + 1] = 0
          data[index + 2] = 0
          data[index + 3] = 1
        }
      }
      
      const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType)
      texture.needsUpdate = true
      
      onHeightTextureReady(texture, physicalSize)
      
    }, 500) // Debounce 500ms
    
    return () => clearTimeout(timer)
  }, [scale, amplitude, octaves, lodLevel, onHeightTextureReady])

  useFrame(() => {
    if (!highResRef.current || !midResRef.current || !lowResRef.current) return

    const dist = camera.position.length()

    // LOD Logic
    // < 30: High Res
    // 30 - 60: Mid Res
    // > 60: Low Res
    
    let currentLevel = 0
    if (dist < 30) {
      currentLevel = 0
      highResRef.current.visible = true
      midResRef.current.visible = false
      lowResRef.current.visible = false
    } else if (dist < 60) {
      currentLevel = 1
      highResRef.current.visible = false
      midResRef.current.visible = true
      lowResRef.current.visible = false
    } else {
      currentLevel = 2
      highResRef.current.visible = false
      midResRef.current.visible = false
      lowResRef.current.visible = true
    }
    
    if (currentLevel !== lodLevel) {
      setLodLevel(currentLevel)
    }
  })

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
    wireframe: false
  }), [uniforms])

  // Debug materials
  const debugMaterials = useMemo(() => [
    new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }), // High - Green
    new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true }), // Mid - Yellow
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })  // Low - Red
  ], [])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      {/* High Res: 30x30 size, 256 segments */}
      <mesh ref={highResRef} material={debug ? debugMaterials[0] : material}>
        <planeGeometry args={[30, 30, 256, 256]} />
      </mesh>

      {/* Mid Res: 60x60 size, 128 segments */}
      <mesh ref={midResRef} material={debug ? debugMaterials[1] : material} visible={false}>
        <planeGeometry args={[60, 60, 128, 128]} />
      </mesh>

      {/* Low Res: 100x100 size, 64 segments */}
      <mesh ref={lowResRef} material={debug ? debugMaterials[2] : material} visible={false}>
        <planeGeometry args={[100, 100, 64, 64]} />
      </mesh>
    </group>
  )
}
