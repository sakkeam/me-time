'use client'

import { useFrame } from '@react-three/fiber'
import { useFaceTracking } from '@/contexts/FaceTrackingContext'
import { useRef } from 'react'

export default function PerformanceMonitor() {
  const { setFpsStats } = useFaceTracking()
  const frames = useRef(0)
  const prevTime = useRef(0)
  const fpsHistory = useRef<number[]>([])
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime() * 1000 // ms
    
    if (prevTime.current === 0) {
      prevTime.current = time
      return
    }
    
    frames.current++
    
    if (time >= prevTime.current + 1000) {
      const fps = Math.round((frames.current * 1000) / (time - prevTime.current))
      
      fpsHistory.current.push(fps)
      if (fpsHistory.current.length > 60) fpsHistory.current.shift()
      
      const avg = Math.round(fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length)
      const min = Math.min(...fpsHistory.current)
      const max = Math.max(...fpsHistory.current)
      
      setFpsStats(fps, avg, min, max)
      
      prevTime.current = time
      frames.current = 0
    }
  })
  
  return null
}
