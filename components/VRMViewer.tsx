'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useLoader, useFrame, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'
import { useFaceTracking } from '@/contexts/FaceTrackingContext'
import { useAnimation, ANIMATION_REGISTRY } from '@/contexts/AnimationContext'
import { useRealtime } from '@/contexts/RealtimeContext'
import { getCameraPosition, lerp, AutoBlink, ExpressionManager } from '@/lib/faceUtils'
import * as THREE from 'three'

export default function VRMViewer() {
  const { camera } = useThree()
  const { 
    yaw, pitch, x, y, z, 
    currentExpression, expressionIntensity, expressionDuration,
    leftHand, rightHand, isRotationLocked
  } = useFaceTracking()
  const { currentAnimation, playAnimation } = useAnimation()
  const { mouthOpenAmount } = useRealtime()
  
  // Store current camera rotation and position for smoothing
  const currentYaw = useRef(0)
  const currentPitch = useRef(0)
  const currentX = useRef(0)
  const currentY = useRef(0)
  const currentZ = useRef(0)
  
  // Camera position state (Free roaming)
  const cameraPos = useRef(new THREE.Vector3(0, 1.4, 1.5))

  const gltf = useLoader(GLTFLoader, '/assets/AliciaSolid.vrm', (loader) => {
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser)
    })
  })

  const [vrm, setVrm] = useState<VRM | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const loaderRef = useRef<GLTFLoader>(new GLTFLoader())
  const autoBlinkRef = useRef<AutoBlink>(new AutoBlink())
  const expressionManagerRef = useRef<ExpressionManager>(new ExpressionManager())
  const currentMouthOpen = useRef(0)

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

  // Watch for expression changes from context
  useEffect(() => {
    if (currentExpression) {
      expressionManagerRef.current.setExpression(
        currentExpression,
        expressionIntensity,
        expressionDuration
      )
    }
  }, [currentExpression, expressionIntensity, expressionDuration])

  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }
    
    // Update VRM
    if (vrm) {
      vrm.update(delta)
      
      // Update auto blink
      autoBlinkRef.current.update(delta)
      const blinkValues = autoBlinkRef.current.getBlinkValues()
      
      // Check if emotion animation is playing
      const animDef = ANIMATION_REGISTRY[currentAnimation]
      const isEmotionAnimation = animDef?.category === 'emotions'
      
      // Update expression manager
      expressionManagerRef.current.update(delta, isEmotionAnimation)
      const expressionValues = expressionManagerRef.current.getExpressionValues()
      
      // Smooth mouth open amount for lip sync
      const smoothingFactor = 0.3 // Higher = more responsive, Lower = smoother
      currentMouthOpen.current = lerp(currentMouthOpen.current, mouthOpenAmount, smoothingFactor)

      // Apply blink and expressions to VRM
      if (vrm.expressionManager) {
        // Apply blink
        vrm.expressionManager.setValue('blinkLeft', blinkValues.left)
        vrm.expressionManager.setValue('blinkRight', blinkValues.right)
        
        // Apply expressions
        // Note: Map 'happy' to 'relaxed' to keep eyes open (AliciaSolid's 'happy' closes eyes)
        vrm.expressionManager.setValue('neutral', expressionValues.neutral)
        vrm.expressionManager.setValue('happy', 0)
        vrm.expressionManager.setValue('sad', expressionValues.sad)
        vrm.expressionManager.setValue('angry', expressionValues.angry)
        vrm.expressionManager.setValue('relaxed', Math.min(1, expressionValues.relaxed + expressionValues.happy))
        vrm.expressionManager.setValue('surprised', expressionValues.surprised)

        // Apply lip sync - try 'aa' first (VRM 1.0), fallback to other mouth shapes
        const mouthValue = currentMouthOpen.current
        vrm.expressionManager.setValue('aa', mouthValue) // Mouth open (VRM 1.0)
        
        // Also try legacy VRM 0.0 naming if 'aa' doesn't exist
        // The model might use different naming conventions
        if (vrm.expressionManager.getExpressionTrackName('a')) {
          vrm.expressionManager.setValue('a', mouthValue)
        }
      } else if ((vrm as any).expressions) {
        // Fallback for different VRM versions
        const expressions = (vrm as any).expressions
        if (expressions.setValue) {
          expressions.setValue('blinkLeft', blinkValues.left)
          expressions.setValue('blinkRight', blinkValues.right)
          
          // Apply expressions (fallback)
          // Note: Map 'happy' to 'relaxed' to keep eyes open
          expressions.setValue('neutral', expressionValues.neutral)
          expressions.setValue('happy', 0)
          expressions.setValue('sad', expressionValues.sad)
          expressions.setValue('angry', expressionValues.angry)
          expressions.setValue('relaxed', Math.min(1, expressionValues.relaxed + expressionValues.happy))
          expressions.setValue('surprised', expressionValues.surprised)

          // Apply lip sync
          const mouthValue = currentMouthOpen.current
          expressions.setValue('aa', mouthValue)
          if (expressions.getExpressionTrackName && expressions.getExpressionTrackName('a')) {
            expressions.setValue('a', mouthValue)
          }
        }
      }
    }

    // Yaw control: Rate-based rotation with threshold (Joystick-like)
    const YAW_THRESHOLD = 10 * (Math.PI / 180); // 10 degrees
    const YAW_SPEED = 2.0; // Rotation speed

    if (!isRotationLocked && Math.abs(yaw) > YAW_THRESHOLD) {
      const sign = Math.sign(yaw);
      // Rotate based on how far past threshold (analog control)
      // Looking Right (yaw > 0) -> Rotate Camera Left (Positive Y)
      // Looking Left (yaw < 0) -> Rotate Camera Right (Negative Y)
      currentYaw.current += sign * (Math.abs(yaw) - YAW_THRESHOLD) * YAW_SPEED * delta;
    }

    // Pitch remains absolute (Position-based)
    currentPitch.current = lerp(currentPitch.current, pitch, 0.1)
    
    // Apply rotation to camera
    camera.rotation.order = 'YXZ';
    camera.rotation.y = currentYaw.current;
    camera.rotation.x = currentPitch.current;
    
    // Smoothly interpolate current position offset (Parallax)
    currentX.current = lerp(currentX.current, x, 0.1)
    currentY.current = lerp(currentY.current, y, 0.1)
    currentZ.current = lerp(currentZ.current, z, 0.1)

    // Camera movement based on long pinch + hand depth
    const CAMERA_MOVE_SPEED = 3.0; 
    const DEPTH_DEADZONE = 0.005; 
    
    // Check for long pinch on either hand
    const leftLongPinch = leftHand.isLongPinch && leftHand.isDetected;
    const rightLongPinch = rightHand.isLongPinch && rightHand.isDetected;

    if (leftLongPinch || rightLongPinch) {
      // Use right hand if both are pinching, otherwise use whichever is pinching
      const activeHand = rightLongPinch ? rightHand : leftHand;
      const depthChange = activeHand.z; 
      
      if (Math.abs(depthChange) > DEPTH_DEADZONE) {
        // depthChange > 0 means hand is larger (Closer to camera) -> Move Forward
        // depthChange < 0 means hand is smaller (Farther from camera) -> Move Backward
        
        const moveAmount = depthChange * CAMERA_MOVE_SPEED * delta * 5.0;
        
        // Calculate forward vector (projected on horizontal plane)
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.quaternion);
        forward.y = 0; // Walk on plane
        forward.normalize();
        
        cameraPos.current.addScaledVector(forward, moveAmount);
      }
    }

    // Calculate parallax offset in camera local space
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    
    const parallaxOffset = new THREE.Vector3()
        .addScaledVector(rightVec, currentX.current * 0.5)
        .addScaledVector(upVec, -currentY.current * 0.5) // Invert Y for screen space
        .addScaledVector(forwardVec, currentZ.current * 0.5);

    // Update camera position
    camera.position.copy(cameraPos.current).add(parallaxOffset);
    
    // Removed camera.lookAt to allow free rotation
  })

  if (!vrm) return null

  return <primitive object={vrm.scene} />
}
