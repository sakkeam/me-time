'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { createTreeGeometry, TREE_PRESETS } from '@/lib/treeGenerator'

interface TreePreviewProps {
  type: string
  seed: number
}

function TreeModel({ type, seed }: TreePreviewProps) {
  const geometry = useMemo(() => {
    return createTreeGeometry(type, seed, 0)
  }, [type, seed])

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(TREE_PRESETS[type]?.leafColor || '#00ff00'),
      roughness: 0.8,
      side: THREE.DoubleSide
    })
  }, [type])

  return (
    <mesh geometry={geometry} material={material} />
  )
}

export default function TreePreview({ type, seed }: TreePreviewProps) {
  return (
    <div className="w-full h-48 bg-gray-800/50 rounded-lg overflow-hidden mb-3 border border-gray-700 relative">
      <div className="absolute top-2 left-2 z-10 text-[10px] text-gray-400 bg-black/50 px-2 py-1 rounded pointer-events-none">
        Preview: {type}
      </div>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2, 4], fov: 50 }}>
        <Stage environment="city" intensity={0.5} adjustCamera={true}>
          <TreeModel type={type} seed={seed} />
        </Stage>
        <OrbitControls autoRotate autoRotateSpeed={4} makeDefault />
      </Canvas>
    </div>
  )
}
