'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useLoader, useFrame, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'
import { useFaceTracking } from '@/contexts/FaceTrackingContext'
import { useAnimation, ANIMATION_REGISTRY } from '@/contexts/AnimationContext'
import { getCameraPosition, lerp } from '@/lib/faceUtils'
import * as THREE from 'three'

export default function VRMViewer() {
  const { camera } = useThree()
  const { yaw, pitch, x, y, z } = useFaceTracking()
  const { currentAnimation, playAnimation } = useAnimation()
  
  // Store current camera rotation and position for smoothing
  const currentYaw = useRef(0)
  const currentPitch = useRef(0)
  const currentX = useRef(0)
  const currentY = useRef(0)
  const currentZ = useRef(0)

  const gltf = useLoader(GLTFLoader, '/assets/AliciaSolid.vrm', (loader) => {
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser)
    })
  })

  const [vrm, setVrm] = useState<VRM | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const loaderRef = useRef<GLTFLoader>(new GLTFLoader())

  useEffect(() => {
    loaderRef.current.register((parser) => {
      return new VRMAnimationLoaderPlugin(parser)
    })
  }, [])

  useEffect(() => {
    if (gltf && gltf.userData.vrm) {
      const vrmInstance = gltf.userData.vrm
      // VRM0.0のモデルの場合、回転を補正する
      VRMUtils.rotateVRM0(vrmInstance)
      setVrm(vrmInstance)
      
      // Initialize mixer
      const mixer = new THREE.AnimationMixer(vrmInstance.scene)
      mixerRef.current = mixer
      
      // Load initial idle animation
      loadAndPlayAnimation("idle")
    }
  }, [gltf])

  const loadAndPlayAnimation = async (animationName: string) => {
    if (!vrm || !mixerRef.current) return

    const animDef = ANIMATION_REGISTRY[animationName]
    if (!animDef) return

    try {
      const vrmaGltf = await loaderRef.current.loadAsync(`/assets/${animDef.file}`)
      const vrmAnimations = vrmaGltf.userData.vrmAnimations
      if (!vrmAnimations || vrmAnimations.length === 0) return

      const clip = createVRMAnimationClip(vrmAnimations[0], vrm)
      const action = mixerRef.current.clipAction(clip)
      
      action.setLoop(
        animDef.loop ? THREE.LoopRepeat : THREE.LoopOnce, 
        animDef.loop ? Infinity : 1
      )
      action.clampWhenFinished = !animDef.loop

      if (currentActionRef.current) {
        currentActionRef.current.crossFadeTo(action, 0.5, true)
        currentActionRef.current = action
      } else {
        currentActionRef.current = action
      }

      action.reset().play()

      // If not looping, return to idle after finish
      if (!animDef.loop) {
        const onFinished = (e: any) => {
          if (e.action === action) {
            mixerRef.current?.removeEventListener('finished', onFinished)
            // Return to idle
            playAnimation("idle")
          }
        }
        mixerRef.current.addEventListener('finished', onFinished)
      }

    } catch (error) {
      console.error("Failed to load animation:", error)
      // Fallback to idle if failed
      if (animationName !== "idle") {
        playAnimation("idle")
      }
    }
  }

  // Watch for animation changes from context
  useEffect(() => {
    if (vrm && mixerRef.current) {
      loadAndPlayAnimation(currentAnimation)
    }
  }, [currentAnimation, vrm])

  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }
    
    // Update VRM
    if (vrm) {
      vrm.update(delta)
    }

    // Smoothly interpolate current rotation towards target rotation
    currentYaw.current = lerp(currentYaw.current, yaw, 0.1)
    currentPitch.current = lerp(currentPitch.current, pitch, 0.1)
    
    // Smoothly interpolate current position offset
    currentX.current = lerp(currentX.current, x, 0.1)
    currentY.current = lerp(currentY.current, y, 0.1)
    currentZ.current = lerp(currentZ.current, z, 0.1)

    // Calculate new camera position
    const [camX, camY, camZ] = getCameraPosition(
      currentYaw.current,
      currentPitch.current,
      1.5, // Radius
      [0, 1.4, 0], // Center target
      { x: currentX.current, y: currentY.current, z: currentZ.current } // Positional offset
    )

    // Update camera position and look at target
    camera.position.set(camX, camY, camZ)
    camera.lookAt(0, 1.4, 0)
  })

  if (!vrm) return null

  return <primitive object={vrm.scene} />
}
