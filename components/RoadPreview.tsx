'use client'

import React, { useMemo } from 'react'
import * as THREE from 'three'
import { createRoadGeometry } from '@/lib/roadGenerator'

export default function RoadPreview() {
  const geometry = useMemo(() => {
    const data = createRoadGeometry(8, 10);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return geo;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#333" />
    </mesh>
  )
}
