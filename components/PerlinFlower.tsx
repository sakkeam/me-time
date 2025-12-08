'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { FLOWER_COLORS } from '@/lib/flowerGenerator'

// --- Shaders ---

const flowerVertexShader = `
attribute float aInstanceId;
attribute vec3 color;
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
  
  // Instance transform
  vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 worldPos = worldPosition.xyz;
  vWorldPos = worldPos;
  
  vec3 pos = position;
  
  // Wind Animation (Softer than grass)
  vec2 windDir = normalize(uWindDirection);
  float posOffset = dot(worldPos.xz, windDir * 0.5);
  float instanceOffset = aInstanceId * 0.01;
  
  float windPhase = uTime * 1.5 + posOffset + instanceOffset;
  
  // Sway based on height (y)
  // Stem is 0..0.15, Petals are above.
  // We want the whole flower to sway, but more at the top.
  
  float sway = pos.y * pos.y * 2.0; // Quadratic sway
  
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
  
  // If vertex color is white (petal), tint it
  // We check if it's close to white
  if (vColor.r > 0.9 && vColor.g > 0.9 && vColor.b > 0.9) {
     // Petal gradient
     // UV.y for petals is 1.0 to 2.0 (based on addQuad logic)
     float t = clamp(vUv.y - 1.0, 0.0, 1.0);
     finalColor = mix(uColorDark, uColorLight, t);
  }
  
  // Theme adjustment
  if(uTheme > 0.5) {
    finalColor *= 1.1; // Lighter in light mode
  } else {
    finalColor *= 0.9; // Darker in dark mode
  }
  
  // Simple lighting
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
  float diff = max(dot(vNormal, lightDir), 0.0);
  vec3 ambient = vec3(0.4);
  
  gl_FragColor = vec4(finalColor * (ambient + diff * 0.6), 1.0);
}
`

interface PerlinFlowerProps {
  terrainHeightMap: THREE.DataTexture | null
  terrainSize: number
  terrainPosition: [number, number, number]
  density?: number
  threshold?: number
  oceanLevel?: number
  baseWindStrength?: number
  windDirection?: [number, number]
  seedOffset?: number
  petalCount?: number
  enableShadows?: boolean
  debug?: boolean
}

interface ChunkData {
  id: string
  x: number
  z: number
  meshes: THREE.InstancedMesh[] // One per color
  distance: number
}

export default function PerlinFlower({
  terrainHeightMap,
  terrainSize,
  terrainPosition,
  density = 1.0,
  threshold = 0.2,
  oceanLevel = 0.5,
  baseWindStrength = 0.3,
  windDirection = [1, 0.5],
  seedOffset = 2000,
  petalCount = 5,
  enableShadows = false,
  debug = false
}: PerlinFlowerProps) {
  const { camera, gl, scene } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  
  const [worker, setWorker] = useState<Worker | null>(null)
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [chunks, setChunks] = useState<Map<string, ChunkData>>(new Map())
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [loadedInitialChunk, setLoadedInitialChunk] = useState(false)
  
  const materialsRef = useRef<THREE.ShaderMaterial[]>([])

  // Initialize Materials
  useEffect(() => {
    materialsRef.current = FLOWER_COLORS.map(color => {
      return new THREE.ShaderMaterial({
        vertexShader: flowerVertexShader,
        fragmentShader: flowerFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uWindStrength: { value: baseWindStrength },
          uWindDirection: { value: new THREE.Vector2(...windDirection) },
          uCameraPos: { value: new THREE.Vector3() },
          uTheme: { value: 0 },
          uColorDark: { value: new THREE.Color(color.colorDark) },
          uColorLight: { value: new THREE.Color(color.colorLight) }
        },
        side: THREE.DoubleSide,
        vertexColors: true
      })
    })
  }, [])

  // Initialize Worker & Geometry
  useEffect(() => {
    setIsRegenerating(true)
    setLoadedInitialChunk(false)
    
    // Cleanup existing chunks
    chunks.forEach(chunk => {
      chunk.meshes.forEach(mesh => {
        mesh.geometry.dispose()
        // Materials are reused, don't dispose
        groupRef.current?.remove(mesh)
      })
    })
    setChunks(new Map())
    
    if (worker) worker.terminate()
    
    const w = new Worker('/workers/flowerWorker.js')
    setWorker(w)
    
    // Request prototype
    w.postMessage({
      type: 'generatePrototype',
      id: 'init',
      params: { petalCount }
    })
    
    w.onmessage = (e) => {
      const { type, results, geometry: geoData, instances, chunkId } = e.data
      
      if (type === 'prototypeGenerated') {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(geoData.positions, 3))
        geo.setAttribute('normal', new THREE.BufferAttribute(geoData.normals, 3))
        geo.setAttribute('uv', new THREE.BufferAttribute(geoData.uvs, 2))
        geo.setAttribute('color', new THREE.BufferAttribute(geoData.colors, 3))
        geo.setIndex(new THREE.BufferAttribute(geoData.indices, 1))
        setGeometry(geo)
        setIsRegenerating(false)
        
        // Request initial chunk
        const cx = Math.floor(camera.position.x / 10)
        const cz = Math.floor(camera.position.z / 10)
        w.postMessage({
          type: 'generateChunk',
          id: 'chunk',
          params: { chunkId: `${cx},${cz}`, chunkX: cx, chunkZ: cz, density, threshold, seed: 42, seedOffset }
        })
        
      } else if (type === 'chunkGenerated') {
        handleChunkGenerated(chunkId, instances)
        if (!loadedInitialChunk) setLoadedInitialChunk(true)
      }
    }
    
    return () => {
      w.terminate()
    }
  }, [petalCount])

  // Handle Chunk Generation
  const handleChunkGenerated = (chunkId: string, instances: any[]) => {
    setChunks(prev => {
      const newChunks = new Map(prev)
      const chunk = newChunks.get(chunkId)
      
      if (chunk && geometry && groupRef.current) {
        // Filter and position instances
        const validInstances: any[] = []
        
        instances.forEach(inst => {
          let y = 0
          if (terrainHeightMap) {
            const u = (inst.x + chunk.x * 10 - terrainPosition[0] + terrainSize/2) / terrainSize
            const v = (inst.z + chunk.z * 10 - terrainPosition[2] + terrainSize/2) / terrainSize
            
            if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
              const size = terrainHeightMap.image.width
              const px = Math.floor(u * size)
              const py = Math.floor(v * size)
              const idx = (py * size + px) * 4
              y = terrainHeightMap.image.data[idx] + terrainPosition[1]
            }
          }
          
          if (y >= oceanLevel) {
            validInstances.push({ ...inst, y })
          }
        })
        
        if (validInstances.length > 0) {
          createChunkMeshes(chunk, validInstances)
        }
      }
      return newChunks
    })
  }

  const createChunkMeshes = (chunk: ChunkData, instances: any[]) => {
    if (!geometry) return

    // Group instances by colorIndex
    const instancesByColor: any[][] = Array(FLOWER_COLORS.length).fill(null).map(() => [])
    
    instances.forEach(inst => {
      const colorIdx = inst.colorIndex % FLOWER_COLORS.length
      instancesByColor[colorIdx].push(inst)
    })
    
    const meshes: THREE.InstancedMesh[] = []
    
    instancesByColor.forEach((colorInstances, colorIdx) => {
      if (colorInstances.length === 0) return
      
      const mat = materialsRef.current[colorIdx]
      const mesh = new THREE.InstancedMesh(geometry, mat, colorInstances.length)
      mesh.castShadow = enableShadows
      mesh.receiveShadow = enableShadows
      
      const dummy = new THREE.Object3D()
      const instanceIds = new Float32Array(colorInstances.length)
      
      colorInstances.forEach((inst, i) => {
        dummy.position.set(inst.x + chunk.x * 10, inst.y, inst.z + chunk.z * 10)
        dummy.rotation.y = inst.rotation
        dummy.scale.set(inst.scaleXZ, inst.scaleY, inst.scaleXZ)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        instanceIds[i] = i
      })
      
      mesh.geometry.setAttribute('aInstanceId', new THREE.InstancedBufferAttribute(instanceIds, 1))
      mesh.instanceMatrix.needsUpdate = true
      
      meshes.push(mesh)
      groupRef.current?.add(mesh)
    })
    
    chunk.meshes = meshes
  }

  // Frame Loop
  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    const camPos = camera.position
    
    // Update uniforms
    const windStrength = baseWindStrength * (Math.sin(time * 0.5) * 0.2 + 1.0)
    
    materialsRef.current.forEach(mat => {
      mat.uniforms.uTime.value = time
      mat.uniforms.uWindStrength.value = windStrength
      mat.uniforms.uWindDirection.value.set(...windDirection)
      mat.uniforms.uCameraPos.value.copy(camPos)
    })

    if (!loadedInitialChunk) return

    // Chunk Management
    const chunkX = Math.floor(camPos.x / 10)
    const chunkZ = Math.floor(camPos.z / 10)
    
    // Load nearby chunks (3x3)
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const cx = chunkX + x
        const cz = chunkZ + z
        const id = `${cx},${cz}`
        
        if (!chunks.has(id)) {
          const newChunk: ChunkData = {
            id, x: cx, z: cz,
            meshes: [],
            distance: 0
          }
          setChunks(prev => new Map(prev).set(id, newChunk))
          
          if (worker) {
            worker.postMessage({
              type: 'generateChunk',
              id: 'chunk',
              params: { chunkId: id, chunkX: cx, chunkZ: cz, density, threshold, seed: 42, seedOffset }
            })
          }
        }
      }
    }

    // Update visibility & LOD
    chunks.forEach((chunk, id) => {
      const cx = chunk.x * 10 + 5
      const cz = chunk.z * 10 + 5
      const dist = Math.sqrt((cx - camPos.x)**2 + (cz - camPos.z)**2)
      chunk.distance = dist
      
      // Unload far chunks (> 50m)
      if (dist > 50) {
        chunk.meshes.forEach(mesh => {
          mesh.geometry.dispose()
          groupRef.current?.remove(mesh)
        })
        setChunks(prev => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
        return
      }

      // LOD Visibility
      // High < 20, Mid < 35, Low < 50
      // Currently we only have one mesh type, so just toggle visibility
      // Future: Implement billboard LOD for flowers
      
      const visible = dist < 50
      chunk.meshes.forEach(mesh => {
        mesh.visible = visible
      })
    })
  })

  return (
    <>
      <group ref={groupRef} />
      {isRegenerating && loadedInitialChunk && (
        <Html center>
          <div className="text-white bg-black/50 px-2 py-1 rounded">🌸 Regenerating Flowers...</div>
        </Html>
      )}
    </>
  )
}
