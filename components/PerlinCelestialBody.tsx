'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Sparkles } from '@react-three/drei'
import { useTheme } from '@/contexts/ThemeContext'

interface PerlinCelestialBodyProps {
  size?: number
  position?: [number, number, number]
  sunIntensity?: number
  moonIntensity?: number
}

const vertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform float uTime;
uniform int uTheme; // 0: Light (Sun), 1: Dark (Moon)
uniform float uSunIntensity;
uniform float uMoonIntensity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

// Simplex 3D Noise 
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

void main() {
  // Sphere surface texture using noise
  vec3 noisePos = vPosition * 2.0 + vec3(uTime * 0.05);
  float noise = snoise(noisePos) * 0.5 + 0.5;
  
  // Add multiple octaves for detail
  noisePos = vPosition * 4.0 + vec3(uTime * 0.03);
  noise += (snoise(noisePos) * 0.5 + 0.5) * 0.3;
  
  if (uTheme == 0) {
    // Sun - Bright and emissive
    vec3 sunColor = vec3(1.0, 0.9, 0.6);
    vec3 sunCore = vec3(1.0, 1.0, 0.95);
    
    // Surface turbulence
    vec3 color = mix(sunColor, sunCore, noise);
    
    // Edge glow
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    color += vec3(1.0, 0.8, 0.3) * fresnel * 0.5;
    
    // Apply intensity
    color *= uSunIntensity;
    
    gl_FragColor = vec4(color, 1.0);
  } else {
    // Moon - Subtle grey with crater-like noise
    vec3 moonBase = vec3(0.8, 0.8, 0.85);
    vec3 moonDark = vec3(0.4, 0.4, 0.45);
    
    // Crater-like texture (static noise for moon)
    vec3 staticNoisePos = vPosition * 5.0;
    float craterNoise = snoise(staticNoisePos) * 0.5 + 0.5;
    staticNoisePos = vPosition * 10.0;
    craterNoise += (snoise(staticNoisePos) * 0.5 + 0.5) * 0.2;
    
    vec3 color = mix(moonDark, moonBase, craterNoise);
    
    // Subtle edge glow
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
    color += vec3(0.6, 0.6, 0.7) * fresnel * 0.2;
    
    // Apply intensity
    color *= uMoonIntensity;
    
    gl_FragColor = vec4(color, 1.0);
  }
}
`

export default function PerlinCelestialBody({
  size = 2,
  position = [0, 5, -15],
  sunIntensity = 1.5,
  moonIntensity = 0.8
}: PerlinCelestialBodyProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { resolvedTheme } = useTheme()
  
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTheme: { value: 0 },
      uSunIntensity: { value: sunIntensity },
      uMoonIntensity: { value: moonIntensity }
    }),
    []
  )

  // Update uniforms when props change
  useEffect(() => {
    uniforms.uSunIntensity.value = sunIntensity
    uniforms.uMoonIntensity.value = moonIntensity
  }, [sunIntensity, moonIntensity, uniforms])

  useEffect(() => {
    uniforms.uTheme.value = resolvedTheme === 'dark' ? 1 : 0
  }, [resolvedTheme, uniforms])

  useFrame((state) => {
    if (meshRef.current) {
      uniforms.uTime.value = state.clock.getElapsedTime()
      // Subtle rotation for visual interest
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.05
    }
  })

  // Determine if sun or moon based on theme
  const [isSun, setIsSun] = useState(true)
  
  useEffect(() => {
    setIsSun(resolvedTheme === 'light')
  }, [resolvedTheme])

  return (
    <group>
      <mesh 
        ref={meshRef} 
        position={position}
        renderOrder={-1}
      >
        <sphereGeometry args={[size, 64, 64]} />
        <shaderMaterial
          fragmentShader={fragmentShader}
          vertexShader={vertexShader}
          uniforms={uniforms}
          depthWrite={false}
        />
      </mesh>
      
      {/* Sparkles for lens flare effect (Sun only) */}
      {isSun && (
        <Sparkles
          count={30}
          scale={size * 3}
          size={2}
          speed={0.3}
          opacity={0.4}
          color="#ffeb99"
          position={position}
        />
      )}
      
      {/* Halo effect using transparent sphere */}
      <mesh position={position} renderOrder={-1}>
        <sphereGeometry args={[size * 1.3, 32, 32]} />
        <meshBasicMaterial
          color={isSun ? '#ffcc66' : '#9999aa'}
          transparent
          opacity={isSun ? 0.15 : 0.08}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
