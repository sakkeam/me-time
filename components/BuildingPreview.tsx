'use client'

import React, { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import * as THREE from 'three'
import { createBuildingGeometry, BUILDING_PRESETS } from '@/lib/buildingGenerator'

function BuildingModel({ type }: { type: string }) {
  const geometry = useMemo(() => {
    // @ts-ignore
    const preset = BUILDING_PRESETS[type] || BUILDING_PRESETS.residential;
    const width = (preset.widthRange[0] + preset.widthRange[1]) / 2;
    const height = (preset.heightRange[0] + preset.heightRange[1]) / 2;
    const depth = (preset.depthRange[0] + preset.depthRange[1]) / 2;
    const shape = preset.shapes[0];
    
    const data = createBuildingGeometry(width, height, depth, shape, preset.windowDensity, preset.floorHeight);
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return geo;
  }, [type]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors />
    </mesh>
  )
}

export default function BuildingPreview({ type = 'residential' }: { type?: string }) {
  return (
    <div className="w-full h-full relative">
      <div className="absolute top-2 left-2 z-10 text-[10px] text-gray-400 bg-black/50 px-2 py-1 rounded pointer-events-none">
        Preview: {type}
      </div>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 10, 20], fov: 50 }}>
        <Stage environment="city" intensity={0.5} adjustCamera={true}>
          <BuildingModel type={type} />
        </Stage>
        <OrbitControls autoRotate autoRotateSpeed={2} makeDefault />
      </Canvas>
    </div>
  )
}
