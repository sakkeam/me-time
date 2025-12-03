'use client'

import React, { useEffect, useState } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

export default function VRMViewer() {
  const gltf = useLoader(GLTFLoader, '/assets/AliciaSolid.vrm', (loader) => {
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser)
    })
  })

  const [vrm, setVrm] = useState<any>(null)

  useEffect(() => {
    if (gltf && gltf.userData.vrm) {
      const vrmInstance = gltf.userData.vrm
      // VRM0.0のモデルの場合、回転を補正する
      VRMUtils.rotateVRM0(vrmInstance)
      setVrm(vrmInstance)
    }
  }, [gltf])

  if (!vrm) return null

  return <primitive object={vrm.scene} />
}
