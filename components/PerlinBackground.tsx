'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform float uTime;
uniform int uTheme; // 0: Light, 1: Dark
varying vec2 vUv;

// Simplex 3D Noise 
// by Ian McEwan, Ashima Arts
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0.0 + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

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

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  // Noise parameters
  float scale = 2.0;
  float timeScale = 0.1;
  
  // Calculate noise
  float n = snoise(vec3(vUv * scale, uTime * timeScale));
  
  // Add second octave for detail
  n += 0.5 * snoise(vec3(vUv * scale * 2.0, uTime * timeScale * 1.5));
  
  // Normalize noise to 0.0 - 1.0 range roughly
  n = n * 0.5 + 0.5;
  
  // Define colors
  vec3 color1, color2, color3;
  
  if (uTheme == 1) {
    // Dark Mode Colors
    color1 = vec3(0.102, 0.043, 0.180); // #1a0b2e (Deep Purple)
    color2 = vec3(0.086, 0.129, 0.243); // #16213e (Dark Blue)
    color3 = vec3(0.059, 0.204, 0.376); // #0f3460 (Navy)
  } else {
    // Light Mode Colors
    color1 = vec3(0.878, 0.949, 0.996); // #e0f2fe (Light Blue)
    color2 = vec3(0.729, 0.902, 0.992); // #bae6fd (Sky Blue)
    color3 = vec3(1.0, 1.0, 1.0);       // #ffffff (White)
  }
  
  // Create gradient based on UV.y and Noise
  float mixFactor = vUv.y + n * 0.2;
  
  vec3 finalColor = mix(color1, color2, smoothstep(0.0, 0.5, mixFactor));
  finalColor = mix(finalColor, color3, smoothstep(0.5, 1.0, mixFactor));
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`

export default function PerlinBackground() {
  const mesh = useRef<THREE.Mesh>(null)
  const { viewport } = useThree()
  
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTheme: { value: 0 }, // Default to Light
    }),
    []
  )

  useEffect(() => {
    // Check initial theme
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    uniforms.uTheme.value = darkModeQuery.matches ? 1 : 0

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => {
      uniforms.uTheme.value = e.matches ? 1 : 0
    }
    
    darkModeQuery.addEventListener('change', handler)
    return () => darkModeQuery.removeEventListener('change', handler)
  }, [uniforms])

  useFrame((state) => {
    if (mesh.current) {
      // Update time
      uniforms.uTime.value = state.clock.getElapsedTime()
    }
  })

  return (
    <mesh 
      ref={mesh} 
      position={[0, 1.4, -10]} 
      scale={[100, 100, 1]}
      renderOrder={-1}
    >
      <planeGeometry args={[1, 1, 32, 32]} />
      <shaderMaterial
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  )
}
