'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useLoader, useFrame, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { useFaceTracking } from '@/contexts/FaceTrackingContext'
import { getCameraPosition, lerp } from '@/lib/faceUtils'
import * as THREE from 'three'

export default function VRMViewer() {
  const { camera } = useThree()
  const { yaw, pitch } = useFaceTracking()
  
  // Store current camera rotation for smoothing
  const currentYaw = useRef(0)
  const currentPitch = useRef(0)

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

  useFrame(() => {
    // Smoothly interpolate current rotation towards target rotation
    currentYaw.current = lerp(currentYaw.current, yaw, 0.1)
    currentPitch.current = lerp(currentPitch.current, pitch, 0.1)

    // Calculate new camera position
    const [x, y, z] = getCameraPosition(
      currentYaw.current,
      currentPitch.current,
      1.5, // Radius
      [0, 1.4, 0] // Center target
    )

    // Update camera position and look at target
    camera.position.set(x, y, z)
    camera.lookAt(0, 1.4, 0)
  })

  if (!vrm) return null

  return <primitive object={vrm.scene} />
}
