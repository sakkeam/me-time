'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { GRASS_PRESET } from '@/lib/grassGenerator'

// --- Shaders ---

const grassVertexShader = `
attribute float aInstanceId;
uniform float uTime;
uniform float uWindStrength;
uniform vec2 uWindDirection;
uniform bool uBillboard;
uniform vec3 uCameraPos;
// uniform vec3 uPlayerPos; // Future: for trampling effect

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
  
  // Billboard rotation (Y-axis only)
  if(uBillboard) {
    float angle = atan(uCameraPos.z - worldPos.z, uCameraPos.x - worldPos.x);
    float c = cos(angle);
    float s = sin(angle);
    mat2 rot = mat2(c, -s, s, c);
    pos.xz = rot * pos.xz;
  }
  
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
  
  // Future: player trampling effect
  // float distToPlayer = length(worldPos.xz - uPlayerPos.xz);
  // if(distToPlayer < 1.0) pos.y *= 1.0 - (1.0 - distToPlayer) * 0.5;
  
  vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
}
`

const grassFragmentShader = `
uniform float uTheme;
// uniform float uSeason; // Future: 0=spring, 0.25=summer, 0.5=autumn, 0.75=winter

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vec3 grassDark = vec3(0.176, 0.314, 0.086);
  vec3 grassLight = vec3(0.478, 0.612, 0.271);
  
  // Future: seasonal color variation
  // if(uSeason > 0.4 && uSeason < 0.6) { ... }
  
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
  
  // Future: alpha fade
  // gl_FragColor.a *= fadeAlpha;
}
`

interface PerlinGrassProps {
  terrainHeightMap: THREE.DataTexture | null
  terrainSize: number
  terrainPosition: [number, number, number]
  density?: number
  threshold?: number
  oceanLevel?: number
  baseWindStrength?: number
  windDirection?: [number, number]
  seedOffset?: number
  useCrossQuad?: boolean
  enableShadows?: boolean
  debug?: boolean
}

interface ChunkData {
  id: string
  x: number
  z: number
  meshHigh?: THREE.InstancedMesh
  meshMid?: THREE.InstancedMesh
  meshLow?: THREE.InstancedMesh
  distance: number
}

export default function PerlinGrass({
  terrainHeightMap,
  terrainSize,
  terrainPosition,
  density = 1.0,
  threshold = 0.0,
  oceanLevel = 0.5,
  baseWindStrength = 0.5,
  windDirection = [1, 0.5],
  seedOffset = 1000,
  useCrossQuad = true,
  enableShadows = false,
  debug = false
}: PerlinGrassProps) {
  const { camera, gl, scene } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  
  const [worker, setWorker] = useState<Worker | null>(null)
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [chunks, setChunks] = useState<Map<string, ChunkData>>(new Map())
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [loadedInitialChunk, setLoadedInitialChunk] = useState(false)
  
  const materialsRef = useRef<Record<string, THREE.ShaderMaterial>>({})

  // Initialize Worker & Geometry
  useEffect(() => {
    setIsRegenerating(true)
    setLoadedInitialChunk(false)
    
    // Cleanup existing chunks
    chunks.forEach(chunk => {
      if (chunk.meshHigh) {
        chunk.meshHigh.geometry.dispose()
        // @ts-ignore
        chunk.meshHigh.material.dispose()
        groupRef.current?.remove(chunk.meshHigh)
      }
      if (chunk.meshMid) {
        chunk.meshMid.geometry.dispose()
        // @ts-ignore
        chunk.meshMid.material.dispose()
        groupRef.current?.remove(chunk.meshMid)
      }
      if (chunk.meshLow) {
        chunk.meshLow.geometry.dispose()
        // @ts-ignore
        chunk.meshLow.material.dispose()
        groupRef.current?.remove(chunk.meshLow)
      }
    })
    setChunks(new Map())
    
    if (worker) worker.terminate()
    
    const w = new Worker('/workers/grassWorker.js')
    setWorker(w)
    
    // Request prototype
    w.postMessage({
      type: 'generatePrototype',
      id: 'init',
      params: { useCrossQuad }
    })
    
    w.onmessage = (e) => {
      const { type, results, geometry: geoData, instances, chunkId } = e.data
      
      if (type === 'prototypeGenerated') {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(geoData.positions, 3))
        geo.setAttribute('normal', new THREE.BufferAttribute(geoData.normals, 3))
        geo.setAttribute('uv', new THREE.BufferAttribute(geoData.uvs, 2))
        geo.setIndex(new THREE.BufferAttribute(geoData.indices, 1))
        setGeometry(geo)
        setIsRegenerating(false)
        
        // Request initial chunk at camera position
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
  }, [useCrossQuad]) // Re-run when geometry type changes

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
          
          // Ocean level filter
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

    // Create material if needed
    const matKey = 'grass'
    if (!materialsRef.current[matKey]) {
      materialsRef.current[matKey] = new THREE.ShaderMaterial({
        vertexShader: grassVertexShader,
        fragmentShader: grassFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uWindStrength: { value: baseWindStrength },
          uWindDirection: { value: new THREE.Vector2(...windDirection) },
          uBillboard: { value: false },
          uCameraPos: { value: new THREE.Vector3() },
          uTheme: { value: 0 } // 0: dark, 1: light
        },
        side: THREE.DoubleSide,
        transparent: false, // Future: true for alpha
        depthWrite: true // Future: false for alpha
      })
    }
    const mat = materialsRef.current[matKey]

    // Create InstancedMesh
    const mesh = new THREE.InstancedMesh(geometry, mat, instances.length)
    mesh.castShadow = enableShadows
    mesh.receiveShadow = enableShadows
    
    // Instance Attributes
    const dummy = new THREE.Object3D()
    const instanceIds = new Float32Array(instances.length)
    
    instances.forEach((inst, i) => {
      dummy.position.set(inst.x + chunk.x * 10, inst.y, inst.z + chunk.z * 10)
      dummy.rotation.y = inst.rotation
      dummy.scale.set(inst.scaleXZ, inst.scaleY, inst.scaleXZ)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      instanceIds[i] = i
    })
    
    mesh.geometry.setAttribute('aInstanceId', new THREE.InstancedBufferAttribute(instanceIds, 1))
    mesh.instanceMatrix.needsUpdate = true
    
    // For now, we use the same mesh for High/Mid/Low but could use simplified geometry for Low
    // To save memory, we just clone the mesh for now or reuse logic
    // Actually, let's just use one mesh and toggle visibility/billboard uniform
    // But wait, billboard needs different uniform value.
    // So we need separate meshes or update uniform per draw call (not possible with one mesh easily)
    // Or use a uniform array? No.
    // Simplest: 2 meshes. One normal, one billboard (Low).
    
    chunk.meshHigh = mesh
    chunk.meshMid = mesh.clone() // Clone shares geometry/material? No, we want shared geometry/material
    // Actually clone() on InstancedMesh copies instanceMatrix? Yes.
    
    // Billboard mesh
    const billboardMat = mat.clone()
    billboardMat.uniforms.uBillboard.value = true
    const meshLow = new THREE.InstancedMesh(geometry, billboardMat, instances.length)
    instances.forEach((inst, i) => {
      dummy.position.set(inst.x + chunk.x * 10, inst.y, inst.z + chunk.z * 10)
      dummy.rotation.y = inst.rotation
      dummy.scale.set(inst.scaleXZ, inst.scaleY, inst.scaleXZ)
      dummy.updateMatrix()
      meshLow.setMatrixAt(i, dummy.matrix)
    })
    meshLow.geometry.setAttribute('aInstanceId', new THREE.InstancedBufferAttribute(instanceIds, 1))
    
    chunk.meshLow = meshLow
    
    // Initial visibility
    mesh.visible = false
    meshLow.visible = false
    
    if (groupRef.current) {
      groupRef.current.add(mesh)
      groupRef.current.add(meshLow)
    }
  }

  // Frame Loop
  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    const camPos = camera.position
    
    // Update uniforms
    const windStrength = baseWindStrength * (Math.sin(time * 0.2) * 0.3 + 1.0)
    
    Object.values(materialsRef.current).forEach(mat => {
      mat.uniforms.uTime.value = time
      mat.uniforms.uWindStrength.value = windStrength
      mat.uniforms.uWindDirection.value.set(...windDirection)
      mat.uniforms.uCameraPos.value.copy(camPos)
      // Theme update if needed (passed via props or context? For now assume dark mode default)
    })
    
    // Update billboard uniforms too (they are cloned materials)
    chunks.forEach(chunk => {
      if (chunk.meshLow && chunk.meshLow.material instanceof THREE.ShaderMaterial) {
        chunk.meshLow.material.uniforms.uTime.value = time
        chunk.meshLow.material.uniforms.uWindStrength.value = windStrength
        chunk.meshLow.material.uniforms.uWindDirection.value.set(...windDirection)
        chunk.meshLow.material.uniforms.uCameraPos.value.copy(camPos)
      }
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
      
      // Unload far chunks (> 40m)
      if (dist > 40) {
        if (chunk.meshHigh) {
          chunk.meshHigh.geometry.dispose()
          // @ts-ignore
          chunk.meshHigh.material.dispose()
          groupRef.current?.remove(chunk.meshHigh)
        }
        if (chunk.meshLow) {
          chunk.meshLow.geometry.dispose()
          // @ts-ignore
          chunk.meshLow.material.dispose()
          groupRef.current?.remove(chunk.meshLow)
        }
        setChunks(prev => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
        return
      }

      if (chunk.meshHigh && chunk.meshLow) {
        if (dist < 30) {
          chunk.meshHigh.visible = true
          chunk.meshLow.visible = false
        } else {
          chunk.meshHigh.visible = false
          chunk.meshLow.visible = true
        }
      }
    })
  })

  return (
    <>
      <group ref={groupRef} />
      {!loadedInitialChunk && (
        <Html center>
          <div className="grass-loading">🌿 Loading Grass...</div>
        </Html>
      )}
      {isRegenerating && loadedInitialChunk && (
        <Html center>
          <div className="grass-loading">🌿 Regenerating...</div>
        </Html>
      )}
    </>
  )
}
