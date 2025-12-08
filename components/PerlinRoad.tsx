'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useRoadContext } from '@/contexts/RoadContext'
import { createRoadGeometry } from '@/lib/roadGenerator'

const roadVertexShader = `
attribute float aIsIntersection;
varying vec2 vUv;
varying float vIsIntersection;

void main() {
  vUv = uv;
  vIsIntersection = aIsIntersection;
  vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`

const roadFragmentShader = `
varying vec2 vUv;
varying float vIsIntersection;

void main() {
  vec3 asphaltColor = vec3(0.2, 0.2, 0.2);
  vec3 lineColor = vec3(0.9, 0.9, 0.9);
  
  vec3 color = asphaltColor;
  
  // Road markings
  if (vIsIntersection < 0.5) {
    // Straight road
    // Center line (dashed)
    float distToCenter = abs(vUv.x - 0.5);
    if (distToCenter < 0.02) {
      // Dash pattern
      if (sin(vUv.y * 30.0) > 0.0) {
        color = lineColor;
      }
    }
    
    // Side lines (solid)
    if (vUv.x < 0.05 || vUv.x > 0.95) {
      color = lineColor;
    }
  } else {
    // Intersection
    // Maybe some crosswalks?
    // For now just plain asphalt
  }
  
  gl_FragColor = vec4(color, 1.0);
}
`

interface PerlinRoadProps {
  terrainHeightMap: THREE.DataTexture | null
  terrainSize: number
  terrainPosition: [number, number, number]
  seed?: number
}

interface ChunkData {
  id: string
  x: number
  z: number
  mesh?: THREE.InstancedMesh
  distance: number
}

export default function PerlinRoad({
  terrainHeightMap,
  terrainSize,
  terrainPosition,
  seed = 12345
}: PerlinRoadProps) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const { registerRoadChunk } = useRoadContext()
  
  const [worker, setWorker] = useState<Worker | null>(null)
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [chunks, setChunks] = useState<Map<string, ChunkData>>(new Map())
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)

  useEffect(() => {
    // Initialize geometry
    const geoData = createRoadGeometry(8, 10); // 8m width, 10m length
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(geoData.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(geoData.normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(geoData.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(geoData.indices, 1));
    setGeometry(geo);

    // Initialize material
    materialRef.current = new THREE.ShaderMaterial({
      vertexShader: roadVertexShader,
      fragmentShader: roadFragmentShader,
      side: THREE.DoubleSide
    });

    // Initialize worker
    const w = new Worker('/workers/roadWorker.js');
    setWorker(w);

    w.onmessage = (e) => {
      const { type, chunkId, instances, roadType } = e.data;
      if (type === 'chunkGenerated') {
        handleChunkGenerated(chunkId, instances, roadType);
      }
    };

    return () => {
      w.terminate();
    };
  }, []);

  const handleChunkGenerated = (chunkId: string, instances: any[], roadType: any) => {
    setChunks(prev => {
      const newChunks = new Map(prev);
      const chunk = newChunks.get(chunkId);
      
      if (chunk) {
        // Register to context
        registerRoadChunk(chunkId, chunk.x, chunk.z, roadType);

        if (instances.length > 0 && geometry && materialRef.current && groupRef.current) {
          const mesh = new THREE.InstancedMesh(geometry, materialRef.current, instances.length);
          
          const dummy = new THREE.Object3D();
          const isIntersectionAttr = new Float32Array(instances.length);
          
          instances.forEach((inst: any, i: number) => {
            // Position logic
            let y = 0.05; // Default slightly above 0
            
            // Terrain follow
            if (terrainHeightMap) {
               const u = (inst.x + chunk.x * 10 - terrainPosition[0] + terrainSize/2) / terrainSize;
               const v = (inst.z + chunk.z * 10 - terrainPosition[2] + terrainSize/2) / terrainSize;
               if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
                 const size = terrainHeightMap.image.width;
                 const px = Math.floor(u * size);
                 const py = Math.floor(v * size);
                 const idx = (py * size + px) * 4;
                 if (terrainHeightMap.image.data) {
                   y = terrainHeightMap.image.data[idx] + terrainPosition[1] + 0.05;
                 }
               }
            }

            dummy.position.set(inst.x + chunk.x * 10, y, inst.z + chunk.z * 10);
            dummy.rotation.y = inst.rotation;
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            
            isIntersectionAttr[i] = inst.isIntersection ? 1.0 : 0.0;
          });
          
          mesh.geometry.setAttribute('aIsIntersection', new THREE.InstancedBufferAttribute(isIntersectionAttr, 1));
          mesh.instanceMatrix.needsUpdate = true;
          
          chunk.mesh = mesh;
          groupRef.current?.add(mesh);
        }
      }
      return newChunks;
    });
  };

  useFrame(() => {
    const camPos = camera.position;
    const chunkX = Math.floor(camPos.x / 10);
    const chunkZ = Math.floor(camPos.z / 10);
    
    // Load nearby chunks (5x5 for roads to ensure connectivity visibility)
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const cx = chunkX + x;
        const cz = chunkZ + z;
        const id = `${cx},${cz}`;
        
        if (!chunks.has(id)) {
          const newChunk: ChunkData = { id, x: cx, z: cz, distance: 0 };
          setChunks(prev => new Map(prev).set(id, newChunk));
          
          if (worker) {
            worker.postMessage({
              type: 'generateChunk',
              id: 'chunk',
              params: { chunkId: id, chunkX: cx, chunkZ: cz, seed }
            });
          }
        }
      }
    }
    
    // Unload far chunks
    chunks.forEach((chunk, id) => {
      const cx = chunk.x * 10 + 5;
      const cz = chunk.z * 10 + 5;
      const dist = Math.sqrt((cx - camPos.x)**2 + (cz - camPos.z)**2);
      
      if (dist > 60) { // Keep roads visible slightly longer
        if (chunk.mesh) {
          chunk.mesh.geometry.dispose();
          groupRef.current?.remove(chunk.mesh);
        }
        setChunks(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    });
  });

  return <group ref={groupRef} />;
}
