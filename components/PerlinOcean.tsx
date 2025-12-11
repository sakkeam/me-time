'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTheme } from '@/contexts/ThemeContext'

export interface WaveParams {
  amplitude: number
  wavelength: number
  direction: [number, number] // x, z
  speed: number
  steepness: number
}

interface PerlinOceanProps {
  waves: WaveParams[]
  terrainHeightMap: THREE.DataTexture | null
  terrainSize: number
  terrainPosition: [number, number, number]
  opacity?: number
  foamThreshold?: number
  position?: [number, number, number]
  debug?: boolean
}

// Simplex 3D Noise for details
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
varying vec3 vWorldPos;
varying float vWaveHeight;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

uniform float uTime;
uniform sampler2D uTerrainHeightMap;
uniform float uTerrainSize;
uniform vec3 uTerrainPosition;

struct WaveData {
  float amplitude;
  float wavelength;
  vec2 direction;
  float speed;
  float steepness;
};

uniform WaveData uWaves[4];

${noiseFunctions}

// Gerstner Wave Calculation
// Returns displacement vector
vec3 gerstnerWave(vec2 pos, float A, float wavelength, vec2 D, float steepness, float speed, float time, inout vec3 tangent, inout vec3 binormal) {
  float k = 2.0 * 3.14159 / wavelength;
  float c = sqrt(9.8 / k) * speed; // Phase speed
  vec2 d = normalize(D);
  
  float f = k * (dot(d, pos) - c * time);
  float a = steepness / k; // Amplitude factor based on steepness
  
  // To avoid looping over itself, steepness should be controlled. 
  // We use the passed A as the target amplitude, but modulate it with steepness
  // Actually, standard Gerstner uses A directly. Let's stick to standard but use steepness to control Q.
  // Q = steepness / (k * A * numWaves) usually.
  // Here we simplify: Q * A = steepness / k
  
  float cosf = cos(f);
  float sinf = sin(f);
  
  // Displacement
  float wa = A; // Use amplitude directly
  float qi = steepness; // Steepness factor (0-1)
  
  // We want sharp peaks.
  // x = x + sum(Qi * A * D.x * cos(...))
  // y = sum(A * sin(...))
  // z = z + sum(Qi * A * D.z * cos(...))
  
  vec3 displacement = vec3(
    qi * wa * d.x * cosf,
    wa * sinf,
    qi * wa * d.y * cosf
  );
  
  // Derivatives for normal calculation
  // d(x)/dx = 1 - sum(Qi * A * k * D.x^2 * sinf)
  // d(y)/dx = sum(A * k * D.x * cosf)
  // ...
  
  float wa_k = wa * k;
  float wa_k_cos = wa_k * cosf;
  float wa_k_sin = wa_k * sinf;
  float qi_wa_k_sin = qi * wa_k_sin;
  
  tangent += vec3(
    -d.x * d.x * qi_wa_k_sin,
    d.x * wa_k_cos,
    -d.x * d.y * qi_wa_k_sin
  );
  
  binormal += vec3(
    -d.x * d.y * qi_wa_k_sin,
    d.y * wa_k_cos,
    -d.y * d.y * qi_wa_k_sin
  );
  
  return displacement;
}

void main() {
  vUv = uv;
  vec3 gridPos = position;
  
  // Base position (flat plane)
  vec3 finalPos = gridPos;
  
  // Accumulate waves
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 waveDisplacement = vec3(0.0);
  
  // Apply 4 Gerstner waves
  for(int i = 0; i < 4; i++) {
    waveDisplacement += gerstnerWave(
      gridPos.xy, // Using xy because plane is rotated -90 on X, so local xy is world xz
      uWaves[i].amplitude,
      uWaves[i].wavelength,
      uWaves[i].direction,
      uWaves[i].steepness,
      uWaves[i].speed,
      uTime,
      tangent,
      binormal
    );
  }
  
  // Add some Perlin noise for small details
  float noiseDetail = snoise(vec3(gridPos.xy * 0.5 + uTime * 0.2, uTime * 0.1)) * 0.1;
  waveDisplacement.y += noiseDetail;
  
  // Apply displacement
  // Note: In plane geometry (rotated -90 X), local Z is world Y (up)
  // But here we are working in local space where Z is up relative to the plane
  // Wait, standard PlaneGeometry is in XY plane.
  // If we rotate it -90 X, then local Z becomes World Y.
  // Local X -> World X
  // Local Y -> World -Z
  
  // Let's assume we don't rotate the container group, but rotate the mesh or just handle coordinates.
  // The standard way for terrain/ocean is PlaneGeometry on XZ plane.
  // If we use PlaneGeometry(w, h), it creates vertices in XY.
  // We usually rotate -PI/2 on X.
  // So:
  // Local X -> World X
  // Local Y -> World -Z
  // Local Z -> World Y (Height)
  
  // Our gerstnerWave function treats input pos as 2D (World X, World Z).
  // So we pass gridPos.xy (which corresponds to World X, World -Z).
  // The output displacement:
  // x -> displacement in World X
  // y -> displacement in World Y (Height)
  // z -> displacement in World Z
  
  // We need to map this back to local space.
  // Local X += displacement.x
  // Local Y -= displacement.z (because Local Y is World -Z)
  // Local Z += displacement.y (Height)
  
  finalPos.x += waveDisplacement.x;
  finalPos.y -= waveDisplacement.z; // Flip Z for local Y
  finalPos.z += waveDisplacement.y;
  
  vWaveHeight = finalPos.z; // Height in local Z (World Y)
  
  // Normal calculation
  // Normal = normalize(cross(binormal, tangent))
  // But we need to adjust tangent/binormal to local space too?
  // Actually, let's compute normal in "World-like" space (where Y is up) and then transform.
  vec3 normal = normalize(cross(binormal, tangent));
  
  // Transform normal to View Space
  // Since we manually calculated normal based on "World Up Y", and the mesh is rotated,
  // we need to be careful.
  // If mesh is rotated -90 X:
  // Normal (0, 1, 0) [Up] becomes (0, 0, 1) in Local.
  // Our calculated normal is (nx, ny, nz) where ny is Up.
  // To convert to Local: (nx, -nz, ny)
  
  vec3 localNormal = vec3(normal.x, -normal.z, normal.y);
  vNormal = normalMatrix * localNormal;
  
  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  vViewPosition = -mvPosition.xyz;
  
  // Calculate World Position for Fragment Shader (for terrain mapping)
  vec4 worldPosition = modelMatrix * vec4(finalPos, 1.0);
  vWorldPos = worldPosition.xyz;
  
  gl_Position = projectionMatrix * mvPosition;
}
`

const fragmentShader = `
varying vec3 vWorldPos;
varying float vWaveHeight;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

uniform float uTime;
uniform sampler2D uTerrainHeightMap;
uniform float uTerrainSize;
uniform vec3 uTerrainPosition;
uniform int uTheme; // 0: Light, 1: Dark
uniform float uOpacity;
uniform float uFoamThreshold;

${noiseFunctions}

void main() {
  // 1. Calculate Terrain UV
  // Map world position to terrain texture UV
  // Terrain is centered at uTerrainPosition
  vec2 terrainUV = (vWorldPos.xz - uTerrainPosition.xz) / uTerrainSize + 0.5;
  
  // 2. Sample Terrain Height
  float terrainHeight = -100.0; // Default deep
  bool hasTerrain = false;
  
  if(terrainUV.x >= 0.0 && terrainUV.x <= 1.0 && terrainUV.y >= 0.0 && terrainUV.y <= 1.0) {
    vec4 terrainData = texture2D(uTerrainHeightMap, terrainUV);
    // Assuming terrain height is stored in R channel or calculated
    // The terrain shader calculates height in vertex. We need to ensure texture has it.
    // If we use a DataTexture passed from CPU, it should be correct.
    terrainHeight = terrainData.r; 
    hasTerrain = true;
  }
  
  // 3. Calculate Depth / Transparency
  // Ocean surface Y is roughly vWorldPos.y (which includes wave height)
  // But for depth, we might want the base water level vs terrain.
  // Let's use current wave height.
  
  float waterHeight = vWorldPos.y;
  float depth = waterHeight - terrainHeight;
  
  // If no terrain or terrain is above water, handle gracefully
  if (!hasTerrain) {
    depth = 10.0; // Assume deep water outside terrain bounds
  }
  
  // Transparency based on depth
  // Shallow (depth near 0) -> Transparent
  // Deep -> Opaque
  float alpha = mix(0.2, uOpacity, smoothstep(0.0, 3.0, depth));
  
  // If terrain is ABOVE water, water should be invisible?
  // Or we rely on Z-buffer? 
  // Since we use transparent=true and depthWrite=false, we need to manually hide water if it's below terrain?
  // But standard Z-testing handles "terrain in front of water".
  // The issue is "water behind terrain" but rendered on top because of transparency sorting?
  // With depthWrite=false, water won't occlude things behind it.
  // Terrain writes depth. So if terrain is closer, it will occlude water.
  // So we don't need to manually hide it, unless we want "shoreline" fading.
  
  // Shoreline fade
  alpha *= smoothstep(-0.5, 0.0, depth); // Fade out when terrain gets very close to surface
  
  // 4. Water Color
  vec3 deepColor, midColor, shallowColor;
  
  if (uTheme == 1) { // Dark Mode
    deepColor = vec3(0.0, 0.1, 0.2);
    midColor = vec3(0.0, 0.24, 0.36);
    shallowColor = vec3(0.05, 0.3, 0.4);
  } else { // Light Mode
    deepColor = vec3(0.0, 0.25, 0.5);
    midColor = vec3(0.06, 0.44, 0.63);
    shallowColor = vec3(0.13, 0.63, 0.75);
  }
  
  vec3 waterColor = mix(shallowColor, midColor, smoothstep(0.0, 2.0, depth));
  waterColor = mix(waterColor, deepColor, smoothstep(2.0, 8.0, depth));
  
  // 5. Lighting (Fresnel & Specular)
  vec3 viewDir = normalize(vViewPosition);
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0)); // Sun direction
  
  // Fresnel
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 5.0);
  fresnel = clamp(fresnel, 0.0, 1.0);
  
  // Mix sky color into water based on fresnel
  vec3 skyColor = (uTheme == 1) ? vec3(0.05, 0.05, 0.15) : vec3(0.6, 0.8, 1.0);
  waterColor = mix(waterColor, skyColor, fresnel * 0.5);
  
  // Specular
  vec3 halfVector = normalize(lightDir + viewDir);
  float NdotH = max(0.0, dot(normal, halfVector));
  float specular = pow(NdotH, 100.0) * 0.5; // Shininess
  
  // 6. Foam
  // Foam at peaks
  float foamNoise = snoise(vec3(vWorldPos.xz * 5.0, uTime * 2.0)) * 0.5 + 0.5;
  float foamLevel = smoothstep(uFoamThreshold - 0.1, uFoamThreshold + 0.2, vWaveHeight);
  
  // Add sparkle to foam
  float sparkle = step(0.9, snoise(vec3(vWorldPos.xz * 10.0, uTime * 5.0))) * foamLevel;
  
  vec3 foamColor = vec3(1.0);
  float foamMix = foamLevel * foamNoise + sparkle;
  
  vec3 finalColor = mix(waterColor, foamColor, clamp(foamMix, 0.0, 1.0));
  finalColor += vec3(specular);
  
  gl_FragColor = vec4(finalColor, alpha);
}
`

export default function PerlinOcean({
  waves,
  terrainHeightMap,
  terrainSize,
  terrainPosition,
  opacity = 0.85,
  foamThreshold = 0.7,
  position = [0, -0.8, -4],
  debug = false
}: PerlinOceanProps) {
  const { camera } = useThree()
  const { resolvedTheme } = useTheme()
  const [lodLevel, setLodLevel] = useState<number>(0) // 0: High, 1: Mid, 2: Low
  
  const highResRef = useRef<THREE.Mesh>(null)
  const midResRef = useRef<THREE.Mesh>(null)
  const lowResRef = useRef<THREE.Mesh>(null)
  
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTheme: { value: 0 },
      uTerrainHeightMap: { value: null },
      uTerrainSize: { value: terrainSize },
      uTerrainPosition: { value: new THREE.Vector3(...terrainPosition) },
      uOpacity: { value: opacity },
      uFoamThreshold: { value: foamThreshold },
      uWaves: { value: waves }
    }),
    [] // Initial creation
  )

  // Update uniforms
  useEffect(() => {
    uniforms.uTerrainHeightMap.value = terrainHeightMap
    uniforms.uTerrainSize.value = terrainSize
    uniforms.uTerrainPosition.value.set(...terrainPosition)
    uniforms.uOpacity.value = opacity
    uniforms.uFoamThreshold.value = foamThreshold
    uniforms.uWaves.value = waves
  }, [waves, terrainHeightMap, terrainSize, terrainPosition, opacity, foamThreshold, uniforms])

  // Theme handling
  useEffect(() => {
    uniforms.uTheme.value = resolvedTheme === 'dark' ? 1 : 0
  }, [resolvedTheme, uniforms])

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime()
    
    // LOD Logic
    const dist = camera.position.distanceTo(new THREE.Vector3(...position))
    
    let currentLevel = 0
    if (dist < 40) {
      currentLevel = 0
    } else if (dist < 80) {
      currentLevel = 1
    } else {
      currentLevel = 2
    }
    
    if (currentLevel !== lodLevel) {
      setLodLevel(currentLevel)
    }
    
    // Visibility
    if (highResRef.current) highResRef.current.visible = currentLevel === 0
    if (midResRef.current) midResRef.current.visible = currentLevel === 1
    if (lowResRef.current) lowResRef.current.visible = currentLevel === 2
  })

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false, // Don't write to depth buffer to avoid occlusion issues with transparency
    side: THREE.DoubleSide,
    wireframe: false
  }), [uniforms])

  const debugMaterial = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    wireframe: true,
    transparent: true,
    opacity: 0.3
  }), [])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={position}>
      {/* High Res: 60x60 size, 200 segments */}
      <mesh ref={highResRef} material={debug ? debugMaterial : material}>
        <planeGeometry args={[60, 60, 200, 200]} />
      </mesh>

      {/* Mid Res: 100x100 size, 100 segments */}
      <mesh ref={midResRef} material={debug ? debugMaterial : material} visible={false}>
        <planeGeometry args={[100, 100, 100, 100]} />
      </mesh>

      {/* Low Res: 150x150 size, 50 segments */}
      <mesh ref={lowResRef} material={debug ? debugMaterial : material} visible={false}>
        <planeGeometry args={[150, 150, 50, 50]} />
      </mesh>
    </group>
  )
}
