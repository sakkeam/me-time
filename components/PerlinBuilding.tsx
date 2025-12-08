'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const buildingVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vColor; // R=Window, G=Phase

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const buildingFragmentShader = `
uniform vec3 uBaseColor;
uniform float uTime;
uniform float uNight; // 0.0 = Day, 1.0 = Night

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vColor;

void main() {
  float isWindow = vColor.r;
  float emissionPhase = vColor.g;
  
  vec3 color = uBaseColor;
  
  // Simple lighting
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
  float diff = max(dot(vNormal, lightDir), 0.0);
  vec3 ambient = vec3(0.4);
  
  vec3 finalColor = color * (ambient + diff * 0.6);
  
  if (isWindow > 0.5) {
    // Window logic
    // Dark blue-ish reflection by default
    vec3 windowColor = vec3(0.1, 0.2, 0.3);
    
    // Emission at night
    if (uNight > 0.0) {
      // Random flickering or steady light based on phase
      // Phase is 0..1
      // Some windows are always off (phase < 0.3)
      // Some are always on (phase > 0.7)
      // Some flicker?
      
      float lightOn = 0.0;
      if (emissionPhase > 0.3) {
        lightOn = 1.0;
      }
      
      // Mix based on night factor
      vec3 emissionColor = vec3(1.0, 0.9, 0.6); // Warm light
      windowColor = mix(windowColor, emissionColor * lightOn, uNight);
    }
    
    finalColor = windowColor;
  }
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`

interface PerlinBuildingProps {
  terrainHeightMap: THREE.DataTexture | null
  terrainSize: number
  terrainPosition: [number, number, number]
  seed?: number
}

interface ChunkData {
  id: string
  x: number
  z: number
  mesh?: THREE.Mesh
  distance: number
}

export default function PerlinBuilding({
  terrainHeightMap,
  terrainSize,
  terrainPosition,
  seed = 12345
}: PerlinBuildingProps) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  
  const [worker, setWorker] = useState<Worker | null>(null)
  const [chunks, setChunks] = useState<Map<string, ChunkData>>(new Map())
  
  // Shared uniforms object (cloned per material but sharing time/night)
  // Actually, we need unique uniforms per material for uBaseColor, but shared for uTime/uNight
  // We can update them in useFrame
  
  useEffect(() => {
    const w = new Worker('/workers/buildingWorker.js');
    setWorker(w);

    w.onmessage = (e) => {
      const { type, chunkId, hasBuilding, geometry, instance } = e.data;
      if (type === 'chunkGenerated') {
        handleChunkGenerated(chunkId, hasBuilding, geometry, instance);
      }
    };

    return () => {
      w.terminate();
    };
  }, []);

  const handleChunkGenerated = (chunkId: string, hasBuilding: boolean, geoData: any, instance: any) => {
    setChunks(prev => {
      const newChunks = new Map(prev);
      const chunk = newChunks.get(chunkId);
      
      if (chunk && hasBuilding && geoData && groupRef.current) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(geoData.positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(geoData.normals, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(geoData.uvs, 2));
        geo.setAttribute('color', new THREE.BufferAttribute(geoData.colors, 3));
        geo.setIndex(new THREE.BufferAttribute(geoData.indices, 1));
        
        const material = new THREE.ShaderMaterial({
          vertexShader: buildingVertexShader,
          fragmentShader: buildingFragmentShader,
          uniforms: {
            uBaseColor: { value: new THREE.Color(instance.color) },
            uTime: { value: 0 },
            uNight: { value: 0 }
          },
          vertexColors: true
        });
        
        const mesh = new THREE.Mesh(geo, material);
        
        // Position
        // Terrain follow: Get height at center of building
        let y = 0;
        if (terrainHeightMap) {
           const u = (instance.x + chunk.x * 10 - terrainPosition[0] + terrainSize/2) / terrainSize;
           const v = (instance.z + chunk.z * 10 - terrainPosition[2] + terrainSize/2) / terrainSize;
           if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
             const size = terrainHeightMap.image.width;
             const px = Math.floor(u * size);
             const py = Math.floor(v * size);
             const idx = (py * size + px) * 4;
             if (terrainHeightMap.image.data) {
                y = terrainHeightMap.image.data[idx] + terrainPosition[1];
             }
           }
        }
        
        // Adjust Y so building sits on terrain (pivot is usually center or bottom?)
        // createBuildingGeometry generates centered on X/Z, but Y starts at 0 and goes up.
        // So mesh.position.y = terrainHeight
        
        mesh.position.set(instance.x + chunk.x * 10, y, instance.z + chunk.z * 10);
        mesh.rotation.y = instance.rotation;
        
        chunk.mesh = mesh;
        groupRef.current?.add(mesh);
      }
      return newChunks;
    });
  };

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const camPos = camera.position;
    const chunkX = Math.floor(camPos.x / 10);
    const chunkZ = Math.floor(camPos.z / 10);
    
    // Night cycle simulation (just based on time for now, or fixed)
    // Let's say it cycles every 60 seconds
    const dayCycle = Math.sin(time * 0.1);
    const night = dayCycle < 0 ? 1.0 : 0.0; // Simple on/off
    // Or smooth transition
    const nightSmooth = THREE.MathUtils.smoothstep(dayCycle, 0.2, -0.2);
    
    // Update uniforms
    chunks.forEach(chunk => {
      if (chunk.mesh && chunk.mesh.material instanceof THREE.ShaderMaterial) {
        chunk.mesh.material.uniforms.uTime.value = time;
        chunk.mesh.material.uniforms.uNight.value = nightSmooth;
      }
    });
    
    // Load nearby chunks (5x5)
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
      
      if (dist > 60) {
        if (chunk.mesh) {
          chunk.mesh.geometry.dispose();
          // @ts-ignore
          chunk.mesh.material.dispose();
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
