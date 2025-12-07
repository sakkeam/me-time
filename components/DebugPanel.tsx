'use client'

import React from 'react';
import { useFaceTracking } from '@/contexts/FaceTrackingContext';

interface DebugPanelProps {
  terrainSettings?: {
    scale: number
    setScale: (v: number) => void
    amplitude: number
    setAmplitude: (v: number) => void
    octaves: number
    setOctaves: (v: number) => void
    debug: boolean
    setDebug: (v: boolean) => void
  }
  skySettings?: {
    cloudDensity: number
    setCloudDensity: (v: number) => void
    cloudCoverage: number
    setCloudCoverage: (v: number) => void
    cloudSpeed: number
    setCloudSpeed: (v: number) => void
    noiseOctaves: number
    setNoiseOctaves: (v: number) => void
    setPreset: (preset: 'clear' | 'sunny' | 'cloudy') => void
  }
}

export default function DebugPanel({ terrainSettings, skySettings }: DebugPanelProps) {
  const { 
    yaw, 
    pitch, 
    x, y, z,
    isDetecting, 
    isLoading, 
    error, 
    permissionDenied,
    showDebug,
    setShowDebug
  } = useFaceTracking();

  return (
    <>
      {/* Toggle Button - Top Right */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="fixed top-4 right-4 z-50 px-4 py-2 bg-gray-800/80 text-white text-sm rounded-full backdrop-blur-sm hover:bg-gray-700 transition-colors border border-gray-600"
      >
        {showDebug ? 'Hide Debug' : 'Show Debug'}
      </button>

      {/* Stats Panel - Bottom Right (above video) */}
      {showDebug && (
        <div className="fixed bottom-[270px] right-4 z-50 w-[320px] p-4 bg-gray-900/90 text-white rounded-lg backdrop-blur-md border border-gray-700 shadow-xl font-mono text-xs max-h-[60vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
            <span className="font-bold text-blue-400">Face Tracking Stats</span>
            <span className={`px-2 py-0.5 rounded-full ${isDetecting ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              {isDetecting ? 'DETECTED' : 'NO FACE'}
            </span>
          </div>

          <div className="space-y-1 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Yaw:</span>
              <span>{(yaw * 180 / Math.PI).toFixed(1)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pitch:</span>
              <span>{(pitch * 180 / Math.PI).toFixed(1)}°</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
              <span className="text-gray-400">Pos X:</span>
              <span>{x.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pos Y:</span>
              <span>{y.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pos Z:</span>
              <span>{z.toFixed(2)}</span>
            </div>
            
            {isLoading && (
              <div className="mt-2 text-yellow-400 animate-pulse">
                Loading model...
              </div>
            )}

            {error && (
              <div className="mt-2 text-red-400 break-words">
                Error: {error}
              </div>
            )}

            {permissionDenied && (
              <div className="mt-2 text-red-400 font-bold">
                Camera permission denied. Please allow camera access.
              </div>
            )}
          </div>

          {skySettings && (
            <>
              <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 pt-2">
                <span className="font-bold text-sky-400">Sky Settings</span>
                <div className="flex space-x-1">
                  <button onClick={() => skySettings.setPreset('clear')} className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px]">Clear</button>
                  <button onClick={() => skySettings.setPreset('sunny')} className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px]">Sunny</button>
                  <button onClick={() => skySettings.setPreset('cloudy')} className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px]">Cloudy</button>
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Coverage:</span>
                    <span>{skySettings.cloudCoverage.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={skySettings.cloudCoverage}
                    onChange={(e) => skySettings.setCloudCoverage(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Density:</span>
                    <span>{skySettings.cloudDensity.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={skySettings.cloudDensity}
                    onChange={(e) => skySettings.setCloudDensity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Speed:</span>
                    <span>{skySettings.cloudSpeed.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="0.1"
                    value={skySettings.cloudSpeed}
                    onChange={(e) => skySettings.setCloudSpeed(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Octaves:</span>
                    <span>{skySettings.noiseOctaves}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="6" 
                    step="1"
                    value={skySettings.noiseOctaves}
                    onChange={(e) => skySettings.setNoiseOctaves(parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}

          {terrainSettings && (
            <>
              <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 pt-2">
                <span className="font-bold text-green-400">Terrain Settings</span>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <span className="text-gray-400 text-[10px]">Wireframe</span>
                  <input 
                    type="checkbox" 
                    checked={terrainSettings.debug} 
                    onChange={(e) => terrainSettings.setDebug(e.target.checked)}
                    className="form-checkbox h-3 w-3 text-green-500 rounded focus:ring-0 bg-gray-700 border-gray-600"
                  />
                </label>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Scale:</span>
                    <span>{terrainSettings.scale.toFixed(3)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.01" 
                    max="0.1" 
                    step="0.001"
                    value={terrainSettings.scale}
                    onChange={(e) => terrainSettings.setScale(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Amplitude:</span>
                    <span>{terrainSettings.amplitude.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    step="0.5"
                    value={terrainSettings.amplitude}
                    onChange={(e) => terrainSettings.setAmplitude(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Octaves:</span>
                    <span>{terrainSettings.octaves}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="4" 
                    step="1"
                    value={terrainSettings.octaves}
                    onChange={(e) => terrainSettings.setOctaves(parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
