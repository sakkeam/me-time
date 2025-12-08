'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { createGrassBladeGeometry } from '@/lib/grassGenerator'

// --- Shaders (Duplicated from PerlinGrass.tsx for preview) ---

const grassVertexShader = `
attribute float aInstanceId;
uniform float uTime;
uniform float uWindStrength;
uniform vec2 uWindDirection;
uniform bool uBillboard;
uniform vec3 uCameraPos;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  
  // Instance transform
  vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 worldPos = worldPosition.xyz;
  vWorldPos = worldPos;
  
  vec3 pos = position;
  
  // Wind Animation
  vec2 windDir = normalize(uWindDirection);
  float posOffset = dot(worldPos.xz, windDir * 0.5);
  float instanceOffset = aInstanceId * 0.01;
  
  float windPhase = uTime * 2.0 + posOffset + instanceOffset;
  
  // Primary wave
  float windWave1 = sin(windPhase) * uWindStrength * 0.3 * uv.y;
  // Secondary high-frequency wave
  float windWave2 = cos(uTime * 1.3 + worldPos.x * 0.2 + instanceOffset) * uWindStrength * 0.15 * uv.y;
  
  pos.x += windWave1 * windDir.x + windWave2;
  pos.z += windWave1 * windDir.y;
  
  vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
}
`

const grassFragmentShader = `
uniform float uTheme;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vec3 grassDark = vec3(0.176, 0.314, 0.086);
  vec3 grassLight = vec3(0.478, 0.612, 0.271);
  
  vec3 baseColor = mix(grassDark, grassLight, vUv.y);
  
  // Theme adjustment
  if(uTheme > 0.5) {
    baseColor *= 1.2; // Lighter in light mode
  } else {
    baseColor *= 0.8; // Darker in dark mode
  }
  
  // Simple lighting
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
  float diff = max(dot(vNormal, lightDir), 0.0);
  vec3 ambient = vec3(0.3);
  
  gl_FragColor = vec4(baseColor * (ambient + diff * 0.7), 1.0);
}
`

interface GrassPreviewProps {
  useCrossQuad: boolean
  windStrength: number
  windDirection: [number, number]
}

function GrassModel({ useCrossQuad, windStrength, windDirection }: GrassPreviewProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  
  const geometry = useMemo(() => {
    const data = createGrassBladeGeometry(useCrossQuad)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2))
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1))
    return geo
  }, [useCrossQuad])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: windStrength },
        uWindDirection: { value: new THREE.Vector2(...windDirection) },
        uBillboard: { value: false },
        uCameraPos: { value: new THREE.Vector3() },
        uTheme: { value: 0 }
      },
      side: THREE.DoubleSide
    })
  }, []) // Create once, update uniforms

  // Update uniforms
  useEffect(() => {
    material.uniforms.uWindStrength.value = windStrength
    material.uniforms.uWindDirection.value.set(...windDirection)
  }, [windStrength, windDirection, material])

  // Setup instances
  useEffect(() => {
    if (!meshRef.current) return

    const count = 25 // 5x5 grid
    const dummy = new THREE.Object3D()
    const instanceIds = new Float32Array(count)

    let idx = 0
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        dummy.position.set(x * 0.3, 0, z * 0.3)
        dummy.rotation.y = Math.random() * Math.PI * 2
        dummy.scale.setScalar(1.0 + Math.random() * 0.3)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(idx, dummy.matrix)
        instanceIds[idx] = idx
        idx++
      }
    }
    
    meshRef.current.geometry.setAttribute('aInstanceId', new THREE.InstancedBufferAttribute(instanceIds, 1))
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [geometry]) // Re-run when geometry changes (re-mount)

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.getElapsedTime()
    if (meshRef.current) {
      material.uniforms.uCameraPos.value.copy(state.camera.position)
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, 25]} />
  )
}

export default function GrassPreview(props: GrassPreviewProps) {
  return (
    <div className="w-full h-48 bg-gray-800/50 rounded-lg overflow-hidden mb-3 border border-gray-700 relative">
      <div className="absolute top-2 left-2 z-10 text-[10px] text-gray-400 bg-black/50 px-2 py-1 rounded pointer-events-none">
        Preview
      </div>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1, 2], fov: 50 }}>
        <Stage environment="city" intensity={0.5} adjustCamera={false}>
          <GrassModel {...props} />
        </Stage>
        <OrbitControls autoRotate autoRotateSpeed={2} makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
      </Canvas>
    </div>
  )
}
