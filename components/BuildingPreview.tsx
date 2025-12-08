'use client'

import React, { useMemo } from 'react'
import * as THREE from 'three'
import { createBuildingGeometry, BUILDING_PRESETS } from '@/lib/buildingGenerator'

export default function BuildingPreview({ type = 'residential' }: { type?: string }) {
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
