'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { createFlowerGeometry, FLOWER_COLORS } from '@/lib/flowerGenerator'

// --- Shaders (Duplicated from PerlinFlower.tsx) ---
const flowerVertexShader = `
attribute float aInstanceId;
// attribute vec3 color; // Built-in
varying vec3 vColor;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

uniform float uTime;
uniform float uWindStrength;
uniform vec2 uWindDirection;
uniform vec3 uCameraPos;

void main() {
  vUv = uv;
  vColor = color;
  
  vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 worldPos = worldPosition.xyz;
  vWorldPos = worldPos;
  
  vec3 pos = position;
  
  vec2 windDir = normalize(uWindDirection);
  float posOffset = dot(worldPos.xz, windDir * 0.5);
  float instanceOffset = aInstanceId * 0.01;
  
  float windPhase = uTime * 1.5 + posOffset + instanceOffset;
  float sway = pos.y * pos.y * 2.0;
  
  float windWave1 = sin(windPhase) * uWindStrength * 0.1 * sway;
  float windWave2 = cos(uTime * 1.0 + worldPos.x * 0.3 + instanceOffset) * uWindStrength * 0.05 * sway;
  
  pos.x += windWave1 * windDir.x + windWave2;
  pos.z += windWave1 * windDir.y;
  
  vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
}
`

const flowerFragmentShader = `
uniform vec3 uColorDark;
uniform vec3 uColorLight;
uniform float uTheme;

varying vec3 vColor;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec3 finalColor = vColor;
  
  if (vColor.r > 0.9 && vColor.g > 0.9 && vColor.b > 0.9) {
     float t = clamp(vUv.y - 1.0, 0.0, 1.0);
     finalColor = mix(uColorDark, uColorLight, t);
  }
  
  if(uTheme > 0.5) {
    finalColor *= 1.1;
  } else {
    finalColor *= 0.9;
  }
  
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
  float diff = max(dot(vNormal, lightDir), 0.0);
  vec3 ambient = vec3(0.4);
  
  gl_FragColor = vec4(finalColor * (ambient + diff * 0.6), 1.0);
}
`

interface FlowerPreviewProps {
  petalCount: number
  windStrength: number
  windDirection: [number, number]
}

function FlowerModel({ petalCount, windStrength, windDirection }: FlowerPreviewProps) {
  const groupRef = useRef<THREE.Group>(null)
  
  const geometry = useMemo(() => {
    const data = createFlowerGeometry(petalCount)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2))
    geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1))
    return geo
  }, [petalCount])

  const materials = useMemo(() => {
    return FLOWER_COLORS.map(color => new THREE.ShaderMaterial({
      vertexShader: flowerVertexShader,
      fragmentShader: flowerFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: windStrength },
        uWindDirection: { value: new THREE.Vector2(...windDirection) },
        uCameraPos: { value: new THREE.Vector3() },
        uTheme: { value: 0 },
        uColorDark: { value: new THREE.Color(color.colorDark) },
        uColorLight: { value: new THREE.Color(color.colorLight) }
      },
      side: THREE.DoubleSide,
      vertexColors: true
    }))
  }, [])

  // Update uniforms
  useEffect(() => {
    materials.forEach(mat => {
      mat.uniforms.uWindStrength.value = windStrength
      mat.uniforms.uWindDirection.value.set(...windDirection)
    })
  }, [windStrength, windDirection, materials])

  // Setup instances
  useEffect(() => {
    if (!groupRef.current) return
    
    // Clear previous
    while(groupRef.current.children.length > 0){ 
        groupRef.current.remove(groupRef.current.children[0]); 
    }

    // 3x3 grid
    const instancesByColor: any[][] = Array(FLOWER_COLORS.length).fill(null).map(() => [])
    
    let idx = 0
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const colorIdx = idx % FLOWER_COLORS.length
        instancesByColor[colorIdx].push({
          x: x * 0.3,
          z: z * 0.3,
          rotation: Math.random() * Math.PI * 2,
          scale: 0.8 + Math.random() * 0.4,
          id: idx
        })
        idx++
      }
    }
    
    instancesByColor.forEach((insts, colorIdx) => {
      if (insts.length === 0) return
      
      const mesh = new THREE.InstancedMesh(geometry, materials[colorIdx], insts.length)
      const dummy = new THREE.Object3D()
      const instanceIds = new Float32Array(insts.length)
      
      insts.forEach((inst: any, i: number) => {
        dummy.position.set(inst.x, 0, inst.z)
        dummy.rotation.y = inst.rotation
        dummy.scale.setScalar(inst.scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        instanceIds[i] = inst.id
      })
      
      mesh.geometry.setAttribute('aInstanceId', new THREE.InstancedBufferAttribute(instanceIds, 1))
      mesh.instanceMatrix.needsUpdate = true
      groupRef.current?.add(mesh)
    })
    
  }, [geometry, materials])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    materials.forEach(mat => {
      mat.uniforms.uTime.value = time
      mat.uniforms.uCameraPos.value.copy(state.camera.position)
    })
  })

  return <group ref={groupRef} />
}

export default function FlowerPreview(props: FlowerPreviewProps) {
  return (
    <div className="w-full h-48 bg-gray-800/50 rounded-lg overflow-hidden mb-3 border border-gray-700 relative">
      <div className="absolute top-2 left-2 z-10 text-[10px] text-gray-400 bg-black/50 px-2 py-1 rounded pointer-events-none">
        Preview
      </div>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.5, 1.5], fov: 50 }}>
        <Stage environment="city" intensity={0.5} adjustCamera={false}>
          <FlowerModel {...props} />
        </Stage>
        <OrbitControls autoRotate autoRotateSpeed={2} makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
      </Canvas>
    </div>
  )
}
