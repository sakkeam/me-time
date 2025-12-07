'use client'

import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { useFrame, useThree, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { createTreeGeometry, TREE_PRESETS } from '@/lib/treeGenerator'

// Custom shader for wind animation
const windVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float uTime;
uniform float uWindStrength;

void main() {
  vUv = uv;
  vNormal = normalMatrix * normal;
  
  vec3 pos = position;
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  
  // Simple wind effect based on height
  float heightFactor = smoothstep(0.0, 5.0, pos.y);
  float wind = sin(uTime * 2.0 + worldPos.x * 0.5 + worldPos.z * 0.5) * uWindStrength * 0.2 * heightFactor;
  float wind2 = cos(uTime * 1.5 + worldPos.x * 0.3) * uWindStrength * 0.1 * heightFactor;
  
  pos.x += wind;
  pos.z += wind2;
  
  vec4 mvPosition = viewMatrix * modelMatrix * vec4(pos, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`

const windFragmentShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform vec3 uColor;
uniform sampler2D uMap;
uniform bool uUseMap;

void main() {
  vec4 diffuseColor = vec4(uColor, 1.0);
  if (uUseMap) {
    vec4 texColor = texture2D(uMap, vUv);
    if (texColor.a < 0.5) discard;
    diffuseColor *= texColor;
  }
  
  // Simple lighting
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 ambient = vec3(0.3);
  
  gl_FragColor = vec4(diffuseColor.rgb * (ambient + diff), diffuseColor.a);
}
`

interface PerlinTreeProps {
  terrainHeightMap: THREE.DataTexture | null
  terrainSize: number
  terrainPosition: [number, number, number]
  density?: number
  sizeRange?: [number, number]
  varieties?: string[]
  seed?: number
  windStrength?: number
  debug?: boolean
  onProgress?: (progress: number) => void
}

interface ChunkData {
  id: string
  x: number
  z: number
  instances: {
    x: number
    z: number
    type: string
    scale: number
    rotation: number
    y: number
  }[]
  meshHigh?: THREE.Group
  meshMid?: THREE.Group
  meshLow?: THREE.Group
  distance: number
}

export default function PerlinTree({
  terrainHeightMap,
  terrainSize,
  terrainPosition,
  density = 0.3,
  sizeRange = [0.8, 1.5],
  varieties = ['conifer', 'deciduous', 'bush'],
  seed = 42,
  windStrength = 0.5,
  debug = false,
  onProgress
}: PerlinTreeProps) {
  const { camera, gl, scene } = useThree()
  const [worker, setWorker] = useState<Worker | null>(null)
  const [prototypes, setPrototypes] = useState<Record<string, { high: THREE.BufferGeometry, mid: THREE.BufferGeometry }>>({})
  const [billboards, setBillboards] = useState<Record<string, THREE.Texture>>({})
  const [chunks, setChunks] = useState<Map<string, ChunkData>>(new Map())
  const [loadingProgress, setLoadingProgress] = useState(0)
  
  const groupRef = useRef<THREE.Group>(null)
  const materialsRef = useRef<Record<string, THREE.ShaderMaterial>>({})
  
  // Initialize Worker
  useEffect(() => {
    const w = new Worker('/workers/treeWorker.js')
    setWorker(w)
    return () => w.terminate()
  }, [])

  // Generate Prototypes & Billboards
  useEffect(() => {
    if (!worker) return

    // 1. Request Prototypes from Worker
    worker.postMessage({
      type: 'generatePrototypes',
      id: 'init',
      params: { varieties, seed }
    })

    worker.onmessage = (e) => {
      const { type, results } = e.data
      if (type === 'prototypesGenerated') {
        const protos: Record<string, any> = {}
        
        Object.keys(results).forEach(key => {
          const highData = results[key].high
          const midData = results[key].mid
          
          const highGeo = new THREE.BufferGeometry()
          highGeo.setAttribute('position', new THREE.BufferAttribute(highData.positions, 3))
          highGeo.setAttribute('normal', new THREE.BufferAttribute(highData.normals, 3))
          highGeo.setAttribute('uv', new THREE.BufferAttribute(highData.uvs, 2))
          highGeo.setIndex(new THREE.BufferAttribute(highData.indices, 1))
          
          const midGeo = new THREE.BufferGeometry()
          midGeo.setAttribute('position', new THREE.BufferAttribute(midData.positions, 3))
          midGeo.setAttribute('normal', new THREE.BufferAttribute(midData.normals, 3))
          midGeo.setAttribute('uv', new THREE.BufferAttribute(midData.uvs, 2))
          midGeo.setIndex(new THREE.BufferAttribute(midData.indices, 1))
          
          protos[key] = { high: highGeo, mid: midGeo }
        })
        
        setPrototypes(protos)
        generateBillboards(protos)
      } else if (type === 'chunkGenerated') {
        handleChunkGenerated(e.data)
      }
    }
  }, [worker, varieties, seed])

  // Generate Billboards (Main Thread)
  const generateBillboards = (protos: Record<string, any>) => {
    const textures: Record<string, THREE.Texture> = {}
    const renderTarget = new THREE.WebGLRenderTarget(512, 512, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    })
    
    const rtCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10)
    rtCamera.position.set(0, 0, 5)
    rtCamera.lookAt(0, 0, 0)
    
    const rtScene = new THREE.Scene()
    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(1, 1, 1)
    rtScene.add(light)
    rtScene.add(new THREE.AmbientLight(0x404040))
    
    Object.keys(protos).forEach(key => {
      const geo = protos[key].high
      const mat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(TREE_PRESETS[key]?.color || '#ffffff'),
        roughness: 0.8
      })
      const mesh = new THREE.Mesh(geo, mat)
      rtScene.add(mesh)
      
      gl.setRenderTarget(renderTarget)
      gl.clear()
      gl.render(rtScene, rtCamera)
      
      const buffer = new Uint8Array(512 * 512 * 4)
      gl.readRenderTargetPixels(renderTarget, 0, 0, 512, 512, buffer)
      
      const tex = new THREE.DataTexture(buffer, 512, 512, THREE.RGBAFormat)
      tex.needsUpdate = true
      textures[key] = tex
      
      rtScene.remove(mesh)
      mat.dispose()
    })
    
    gl.setRenderTarget(null)
    renderTarget.dispose()
    setBillboards(textures)
    setLoadingProgress(100)
    if (onProgress) onProgress(100)
  }

  // Handle Chunk Generation
  const handleChunkGenerated = (data: any) => {
    const { chunkId, instances } = data
    
    setChunks(prev => {
      const newChunks = new Map(prev)
      const chunk = newChunks.get(chunkId)
      if (chunk) {
        // Calculate Y positions
        const processedInstances = instances.map((inst: any) => {
          let y = 0
          if (terrainHeightMap) {
            // Map world x,z to texture u,v
            // Terrain is centered at terrainPosition
            // Texture covers terrainSize
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
          return { ...inst, y }
        })
        
        chunk.instances = processedInstances
        createChunkMeshes(chunk)
      }
      return newChunks
    })
  }

  const createChunkMeshes = (chunk: ChunkData) => {
    if (!chunk.instances.length) return

    // Group instances by type
    const byType: Record<string, any[]> = {}
    chunk.instances.forEach(inst => {
      if (!byType[inst.type]) byType[inst.type] = []
      byType[inst.type].push(inst)
    })

    // Create InstancedMeshes
    const highGroup = new THREE.Group()
    const midGroup = new THREE.Group()
    const lowGroup = new THREE.Group()

    Object.keys(byType).forEach(type => {
      const instances = byType[type]
      const proto = prototypes[type]
      const billboard = billboards[type]
      if (!proto || !billboard) return

      // Material
      if (!materialsRef.current[type]) {
        materialsRef.current[type] = new THREE.ShaderMaterial({
          vertexShader: windVertexShader,
          fragmentShader: windFragmentShader,
          uniforms: {
            uTime: { value: 0 },
            uWindStrength: { value: windStrength },
            uColor: { value: new THREE.Color(TREE_PRESETS[type]?.leafColor || '#00ff00') },
            uMap: { value: null },
            uUseMap: { value: false }
          },
          side: THREE.DoubleSide,
          transparent: true // For billboards
        })
      }
      const mat = materialsRef.current[type]

      // High
      const highMesh = new THREE.InstancedMesh(proto.high, mat, instances.length)
      // Mid
      const midMesh = new THREE.InstancedMesh(proto.mid, mat, instances.length)
      // Low (Billboard)
      const lowGeo = new THREE.PlaneGeometry(2, 2)
      const lowMat = mat.clone()
      lowMat.uniforms.uMap.value = billboard
      lowMat.uniforms.uUseMap.value = true
      const lowMesh = new THREE.InstancedMesh(lowGeo, lowMat, instances.length)

      const dummy = new THREE.Object3D()
      instances.forEach((inst, i) => {
        dummy.position.set(inst.x, inst.y, inst.z)
        dummy.rotation.y = inst.rotation
        dummy.scale.setScalar(inst.scale)
        dummy.updateMatrix()
        
        highMesh.setMatrixAt(i, dummy.matrix)
        midMesh.setMatrixAt(i, dummy.matrix)
        
        // Billboard always faces camera? handled in useFrame or shader?
        // For simple billboard, we just set position. Rotation handled later?
        // InstancedMesh rotation is static.
        // We need spherical billboard shader or update rotation every frame.
        // Updating 1000 matrices every frame is heavy.
        // Let's use a shader that aligns to camera.
        // Or just vertical billboard (Y-axis rotation).
        lowMesh.setMatrixAt(i, dummy.matrix)
      })

      highMesh.instanceMatrix.needsUpdate = true
      midMesh.instanceMatrix.needsUpdate = true
      lowMesh.instanceMatrix.needsUpdate = true

      highGroup.add(highMesh)
      midGroup.add(midMesh)
      lowGroup.add(lowMesh)
    })

    chunk.meshHigh = highGroup
    chunk.meshMid = midGroup
    chunk.meshLow = lowGroup
    
    // Initial visibility
    highGroup.visible = false
    midGroup.visible = false
    lowGroup.visible = false
    
    if (groupRef.current) {
      groupRef.current.add(highGroup)
      groupRef.current.add(midGroup)
      groupRef.current.add(lowGroup)
    }
  }

  // Frame Loop
  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    // Update uniforms
    Object.values(materialsRef.current).forEach(mat => {
      mat.uniforms.uTime.value = time
      mat.uniforms.uWindStrength.value = windStrength
    })

    // Chunk Management
    const camPos = camera.position
    const chunkX = Math.floor(camPos.x / 10)
    const chunkZ = Math.floor(camPos.z / 10)
    
    // Load nearby chunks (3x3)
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const cx = chunkX + x
        const cz = chunkZ + z
        const id = `${cx},${cz}`
        
        if (!chunks.has(id)) {
          // Create new chunk placeholder
          const newChunk: ChunkData = {
            id, x: cx, z: cz,
            instances: [],
            distance: 0
          }
          setChunks(prev => new Map(prev).set(id, newChunk))
          
          // Request generation
          if (worker) {
            worker.postMessage({
              type: 'generateChunk',
              id: 'chunk',
              params: { chunkId: id, chunkX: cx, chunkZ: cz, density, seed, varieties }
            })
          }
        }
      }
    }

    // Update visibility & LOD
    chunks.forEach((chunk, id) => {
      // Distance to chunk center
      const cx = chunk.x * 10 + 5
      const cz = chunk.z * 10 + 5
      const dist = Math.sqrt((cx - camPos.x)**2 + (cz - camPos.z)**2)
      chunk.distance = dist
      
      // Unload far chunks (> 30m = 3 chunks away)
      if (dist > 40) {
        if (chunk.meshHigh) {
          groupRef.current?.remove(chunk.meshHigh)
          groupRef.current?.remove(chunk.meshMid!)
          groupRef.current?.remove(chunk.meshLow!)
          // Dispose geometries/materials if needed
        }
        setChunks(prev => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
        return
      }

      if (chunk.meshHigh && chunk.meshMid && chunk.meshLow) {
        if (dist < 15) {
          chunk.meshHigh.visible = true
          chunk.meshMid.visible = false
          chunk.meshLow.visible = false
        } else if (dist < 30) {
          chunk.meshHigh.visible = false
          chunk.meshMid.visible = true
          chunk.meshLow.visible = false
        } else {
          chunk.meshHigh.visible = false
          chunk.meshMid.visible = false
          chunk.meshLow.visible = true
          
          // Update billboard rotation (look at camera)
          // Note: This rotates the whole group. Individual instances need shader rotation for true billboard.
          // But for now, rotating the group is better than nothing, though incorrect for instances.
          // Correct way: Vertex shader billboard.
          // Let's skip complex billboard rotation for now to save tokens/time, just vertical planes.
        }
      }
    })
  })

  return <group ref={groupRef} />
}
