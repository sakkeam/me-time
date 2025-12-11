'use client'

import React, { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useFaceTracking } from '@/contexts/FaceTrackingContext';
import { WaveParams } from '@/components/PerlinOcean';
import TreePreview from './TreePreview';
import GrassPreview from './GrassPreview';
import FlowerPreview from './FlowerPreview';
import BuildingPreview from './BuildingPreview';

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
  celestialSettings?: {
    size: number
    setSize: (v: number) => void
    position: [number, number, number]
    setPosition: (v: [number, number, number]) => void
    sunIntensity: number
    setSunIntensity: (v: number) => void
    moonIntensity: number
    setMoonIntensity: (v: number) => void
  }
  oceanSettings?: {
    waves: WaveParams[]
    setWaves: (waves: WaveParams[]) => void
    opacity: number
    setOpacity: (v: number) => void
    foamThreshold: number
    setFoamThreshold: (v: number) => void
    setPreset: (preset: 'calm' | 'normal' | 'rough' | 'storm') => void
    debug: boolean
    setDebug: (v: boolean) => void
  }
  treeSettings?: {
    density: number
    setDensity: (v: number) => void
    sizeRange: [number, number]
    setSizeRange: (v: [number, number]) => void
    varieties: string[]
    setVarieties: (v: string[]) => void
    seed: number
    setSeed: (v: number) => void
    windStrength: number
    setWindStrength: (v: number) => void
    debug: boolean
    setDebug: (v: boolean) => void
    loadingProgress: number
  }
  grassSettings?: {
    density: number
    setDensity: (v: number) => void
    threshold: number
    setThreshold: (v: number) => void
    windStrength: number
    setWindStrength: (v: number) => void
    windDirection: [number, number]
    setWindDirection: (v: [number, number]) => void
    seedOffset: number
    setSeedOffset: (v: number) => void
    useCrossQuad: boolean
    setUseCrossQuad: (v: boolean) => void
    enableShadows: boolean
    setEnableShadows: (v: boolean) => void
  }
  flowerSettings?: {
    density: number
    setDensity: (v: number) => void
    threshold: number
    setThreshold: (v: number) => void
    windStrength: number
    setWindStrength: (v: number) => void
    windDirection: [number, number]
    setWindDirection: (v: [number, number]) => void
    petalCount: number
    setPetalCount: (v: number) => void
    seedOffset: number
    setSeedOffset: (v: number) => void
    enableShadows: boolean
    setEnableShadows: (v: boolean) => void
  }
  buildingSettings?: {
    seed: number
    setSeed: (v: number) => void
  }
}

export default function DebugPanel({ terrainSettings, skySettings, celestialSettings, oceanSettings, treeSettings, grassSettings, flowerSettings, buildingSettings }: DebugPanelProps) {
  const { theme, setTheme } = useTheme();
  const { 
    yaw, 
    pitch, 
    x, y, z,
    isDetecting, 
    isLoading, 
    error, 
    permissionDenied,
    showDebug,
    setShowDebug,
    isRotationLocked,
    setRotationLocked,
    fps, avgFps, minFps, maxFps
  } = useFaceTracking();

  const [expandedWave, setExpandedWave] = useState<number | null>(null);
  const [previewType, setPreviewType] = useState<string>('conifer');
  const [buildingPreviewType, setBuildingPreviewType] = useState<string>('residential');

  const updateWave = (index: number, field: keyof WaveParams, value: number | number[]) => {
    if (!oceanSettings) return;
    const newWaves = [...oceanSettings.waves];
    newWaves[index] = { ...newWaves[index], [field]: value };
    oceanSettings.setWaves(newWaves);
  };

  const toggleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const ThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun size={16} />;
      case 'dark': return <Moon size={16} />;
      case 'system': return <Monitor size={16} />;
    }
  };

  return (
    <>
      {/* Top Right Controls */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 bg-gray-800/80 text-white rounded-full backdrop-blur-sm hover:bg-gray-700 transition-colors border border-gray-600"
          aria-label="Toggle theme"
          title={`Current theme: ${theme}`}
        >
          <ThemeIcon />
        </button>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="px-4 py-2 bg-gray-800/80 text-white text-sm rounded-full backdrop-blur-sm hover:bg-gray-700 transition-colors border border-gray-600"
        >
          {showDebug ? 'Hide Debug' : 'Show Debug'}
        </button>
      </div>

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
              <span className="text-gray-400">FPS:</span>
              <span className={fps < 30 ? 'text-red-400' : 'text-green-400'}>{fps} (Avg: {avgFps})</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-2">
              <span>Min: {minFps}</span>
              <span>Max: {maxFps}</span>
            </div>

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

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
              <span className="text-gray-400">Rotation Lock:</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isRotationLocked} 
                  onChange={(e) => setRotationLocked(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
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

          {celestialSettings && (
            <>
              <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 pt-2">
                <span className="font-bold text-yellow-400">Sun/Moon Settings</span>
              </div>
              
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Size:</span>
                    <span>{celestialSettings.size.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="5" 
                    step="0.1"
                    value={celestialSettings.size}
                    onChange={(e) => celestialSettings.setSize(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Position X:</span>
                    <span>{celestialSettings.position[0].toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="-20" 
                    max="20" 
                    step="0.5"
                    value={celestialSettings.position[0]}
                    onChange={(e) => celestialSettings.setPosition([parseFloat(e.target.value), celestialSettings.position[1], celestialSettings.position[2]])}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Position Y:</span>
                    <span>{celestialSettings.position[1].toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="-5" 
                    max="15" 
                    step="0.5"
                    value={celestialSettings.position[1]}
                    onChange={(e) => celestialSettings.setPosition([celestialSettings.position[0], parseFloat(e.target.value), celestialSettings.position[2]])}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Position Z:</span>
                    <span>{celestialSettings.position[2].toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="-30" 
                    max="-5" 
                    step="0.5"
                    value={celestialSettings.position[2]}
                    onChange={(e) => celestialSettings.setPosition([celestialSettings.position[0], celestialSettings.position[1], parseFloat(e.target.value)])}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Sun Intensity:</span>
                    <span>{celestialSettings.sunIntensity.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="3" 
                    step="0.1"
                    value={celestialSettings.sunIntensity}
                    onChange={(e) => celestialSettings.setSunIntensity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Moon Intensity:</span>
                    <span>{celestialSettings.moonIntensity.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="2" 
                    step="0.1"
                    value={celestialSettings.moonIntensity}
                    onChange={(e) => celestialSettings.setMoonIntensity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}

          {oceanSettings && (
            <>
              <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 pt-2">
                <span className="font-bold text-cyan-400">Ocean Settings</span>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <span className="text-gray-400 text-[10px]">LOD Debug</span>
                  <input 
                    type="checkbox" 
                    checked={oceanSettings.debug} 
                    onChange={(e) => oceanSettings.setDebug(e.target.checked)}
                    className="form-checkbox h-3 w-3 text-cyan-500 rounded focus:ring-0 bg-gray-700 border-gray-600"
                  />
                </label>
              </div>

              <div className="flex space-x-1 mb-3 overflow-x-auto pb-1">
                <button onClick={() => oceanSettings.setPreset('calm')} className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px] whitespace-nowrap">Calm</button>
                <button onClick={() => oceanSettings.setPreset('normal')} className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px] whitespace-nowrap">Normal</button>
                <button onClick={() => oceanSettings.setPreset('rough')} className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px] whitespace-nowrap">Rough</button>
                <button onClick={() => oceanSettings.setPreset('storm')} className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px] whitespace-nowrap">Storm</button>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Opacity:</span>
                    <span>{oceanSettings.opacity.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={oceanSettings.opacity}
                    onChange={(e) => oceanSettings.setOpacity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Foam Threshold:</span>
                    <span>{oceanSettings.foamThreshold.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={oceanSettings.foamThreshold}
                    onChange={(e) => oceanSettings.setFoamThreshold(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Waves */}
                <div className="space-y-1">
                  {oceanSettings.waves.map((wave, index) => (
                    <div key={index} className="border border-gray-700 rounded p-2">
                      <div 
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => setExpandedWave(expandedWave === index ? null : index)}
                      >
                        <span className="text-xs font-bold text-gray-300">Wave {index + 1}</span>
                        <span className="text-[10px] text-gray-500">{expandedWave === index ? '▼' : '▶'}</span>
                      </div>
                      
                      {expandedWave === index && (
                        <div className="mt-2 space-y-2">
                          <div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-400">Amp:</span>
                              <span>{wave.amplitude.toFixed(2)}</span>
                            </div>
                            <input 
                              type="range" min="0" max="1" step="0.01"
                              value={wave.amplitude}
                              onChange={(e) => updateWave(index, 'amplitude', parseFloat(e.target.value))}
                              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-400">Len:</span>
                              <span>{wave.wavelength.toFixed(1)}</span>
                            </div>
                            <input 
                              type="range" min="0.5" max="20" step="0.5"
                              value={wave.wavelength}
                              onChange={(e) => updateWave(index, 'wavelength', parseFloat(e.target.value))}
                              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-400">Speed:</span>
                              <span>{wave.speed.toFixed(1)}</span>
                            </div>
                            <input 
                              type="range" min="0" max="3" step="0.1"
                              value={wave.speed}
                              onChange={(e) => updateWave(index, 'speed', parseFloat(e.target.value))}
                              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-400">Steep:</span>
                              <span>{wave.steepness.toFixed(2)}</span>
                            </div>
                            <input 
                              type="range" min="0" max="1" step="0.05"
                              value={wave.steepness}
                              onChange={(e) => updateWave(index, 'steepness', parseFloat(e.target.value))}
                              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-400">Dir X:</span>
                              <span>{wave.direction[0].toFixed(1)}</span>
                            </div>
                            <input 
                              type="range" min="-1" max="1" step="0.1"
                              value={wave.direction[0]}
                              onChange={(e) => updateWave(index, 'direction', [parseFloat(e.target.value), wave.direction[1]])}
                              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-400">Dir Z:</span>
                              <span>{wave.direction[1].toFixed(1)}</span>
                            </div>
                            <input 
                              type="range" min="-1" max="1" step="0.1"
                              value={wave.direction[1]}
                              onChange={(e) => updateWave(index, 'direction', [wave.direction[0], parseFloat(e.target.value)])}
                              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {treeSettings && (
            <>
              <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 pt-2">
                <span className="font-bold text-emerald-400">Tree Settings</span>
                <div className="flex items-center space-x-2">
                  {treeSettings.loadingProgress < 100 && (
                    <span className="text-[10px] text-yellow-400">{Math.round(treeSettings.loadingProgress)}%</span>
                  )}
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <span className="text-gray-400 text-[10px]">Debug</span>
                    <input 
                      type="checkbox" 
                      checked={treeSettings.debug} 
                      onChange={(e) => treeSettings.setDebug(e.target.checked)}
                      className="form-checkbox h-3 w-3 text-emerald-500 rounded focus:ring-0 bg-gray-700 border-gray-600"
                    />
                  </label>
                </div>
              </div>

              <TreePreview type={previewType} seed={treeSettings.seed} />
              
              <div className="flex justify-between items-center mb-3">
                 <span className="text-gray-400 text-xs">Preview Type:</span>
                 <select 
                   value={previewType} 
                   onChange={(e) => setPreviewType(e.target.value)}
                   className="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 outline-none capitalize"
                 >
                   {['conifer', 'deciduous', 'bush', 'willow', 'palm'].map(t => (
                     <option key={t} value={t}>{t}</option>
                   ))}
                 </select>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Density:</span>
                    <span>{treeSettings.density.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={treeSettings.density}
                    onChange={(e) => treeSettings.setDensity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Wind:</span>
                    <span>{treeSettings.windStrength.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1"
                    value={treeSettings.windStrength}
                    onChange={(e) => treeSettings.setWindStrength(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Seed:</span>
                    <span>{treeSettings.seed}</span>
                  </div>
                  <input 
                    type="number"
                    value={treeSettings.seed}
                    onChange={(e) => treeSettings.setSeed(parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
                  />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {['conifer', 'deciduous', 'bush', 'willow', 'palm'].map(type => (
                    <label key={type} className="flex items-center space-x-1 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={treeSettings.varieties.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            treeSettings.setVarieties([...treeSettings.varieties, type])
                          } else {
                            treeSettings.setVarieties(treeSettings.varieties.filter(v => v !== type))
                          }
                        }}
                        className="form-checkbox h-3 w-3 text-emerald-500 rounded focus:ring-0 bg-gray-700 border-gray-600"
                      />
                      <span className="text-[10px] text-gray-300 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {grassSettings && (
            <>
              <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 pt-2">
                <span className="font-bold text-lime-400">Grass Settings</span>
              </div>

              <GrassPreview 
                useCrossQuad={grassSettings.useCrossQuad}
                windStrength={grassSettings.windStrength}
                windDirection={grassSettings.windDirection}
              />
              
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Density:</span>
                    <span>{grassSettings.density.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="2.0" step="0.1"
                    value={grassSettings.density}
                    onChange={(e) => grassSettings.setDensity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Threshold:</span>
                    <span>{grassSettings.threshold.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="-0.3" max="0.3" step="0.05"
                    value={grassSettings.threshold}
                    onChange={(e) => grassSettings.setThreshold(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Wind Strength:</span>
                    <span>{grassSettings.windStrength.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1.0" step="0.1"
                    value={grassSettings.windStrength}
                    onChange={(e) => grassSettings.setWindStrength(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Wind Dir X:</span>
                    <span>{grassSettings.windDirection[0].toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="-1" max="1" step="0.1"
                    value={grassSettings.windDirection[0]}
                    onChange={(e) => grassSettings.setWindDirection([parseFloat(e.target.value), grassSettings.windDirection[1]])}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Wind Dir Y:</span>
                    <span>{grassSettings.windDirection[1].toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="-1" max="1" step="0.1"
                    value={grassSettings.windDirection[1]}
                    onChange={(e) => grassSettings.setWindDirection([grassSettings.windDirection[0], parseFloat(e.target.value)])}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Seed Offset:</span>
                    <span>{grassSettings.seedOffset}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2000" step="100"
                    value={grassSettings.seedOffset}
                    onChange={(e) => grassSettings.setSeedOffset(parseInt(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={grassSettings.useCrossQuad} 
                      onChange={(e) => grassSettings.setUseCrossQuad(e.target.checked)}
                      className="form-checkbox h-3 w-3 text-lime-500 rounded focus:ring-0 bg-gray-700 border-gray-600"
                    />
                    <span className="text-gray-300 text-xs">Cross Quad Geometry</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={grassSettings.enableShadows} 
                      onChange={(e) => grassSettings.setEnableShadows(e.target.checked)}
                      className="form-checkbox h-3 w-3 text-lime-500 rounded focus:ring-0 bg-gray-700 border-gray-600"
                    />
                    <span className="text-gray-300 text-xs">Enable Shadows</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {flowerSettings && (
            <>
              <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 pt-2">
                <span className="font-bold text-pink-400">Flowers 🌸</span>
              </div>

              <FlowerPreview 
                petalCount={flowerSettings.petalCount}
                windStrength={flowerSettings.windStrength}
                windDirection={flowerSettings.windDirection}
              />
              
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Density:</span>
                    <span>{flowerSettings.density.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="2.0" step="0.1"
                    value={flowerSettings.density}
                    onChange={(e) => flowerSettings.setDensity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Threshold:</span>
                    <span>{flowerSettings.threshold.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="-0.3" max="0.5" step="0.05"
                    value={flowerSettings.threshold}
                    onChange={(e) => flowerSettings.setThreshold(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Wind Strength:</span>
                    <span>{flowerSettings.windStrength.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1.0" step="0.1"
                    value={flowerSettings.windStrength}
                    onChange={(e) => flowerSettings.setWindStrength(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Petal Count:</span>
                    <span>{flowerSettings.petalCount}</span>
                  </div>
                  <select 
                    value={flowerSettings.petalCount}
                    onChange={(e) => flowerSettings.setPetalCount(parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 outline-none"
                  >
                    {[4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n} Petals</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center space-x-2 cursor-pointer mt-2">
                  <input 
                    type="checkbox" 
                    checked={flowerSettings.enableShadows} 
                    onChange={(e) => flowerSettings.setEnableShadows(e.target.checked)}
                    className="form-checkbox h-3 w-3 text-pink-500 rounded focus:ring-0 bg-gray-700 border-gray-600"
                  />
                  <span className="text-gray-300 text-xs">Enable Shadows</span>
                </label>
              </div>
            </>
          )}

          {buildingSettings && (
            <>
              <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 pt-2">
                <span className="font-bold text-orange-400">Buildings 🏢</span>
              </div>

              <div className="h-48 w-full bg-gray-800 rounded mb-3 overflow-hidden relative border border-gray-700">
                 {/* BuildingPreview component handles its own Canvas */}
                 <BuildingPreview type={buildingPreviewType} />
              </div>
              
              <div className="flex justify-between items-center mb-3">
                 <span className="text-gray-400 text-xs">Type:</span>
                 <select 
                   value={buildingPreviewType} 
                   onChange={(e) => setBuildingPreviewType(e.target.value)}
                   className="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 outline-none capitalize"
                 >
                   {['residential', 'commercial', 'office', 'industrial', 'skyscraper'].map(t => (
                     <option key={t} value={t}>{t}</option>
                   ))}
                 </select>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Seed:</span>
                    <span>{buildingSettings.seed}</span>
                  </div>
                  <input 
                    type="number"
                    value={buildingSettings.seed}
                    onChange={(e) => buildingSettings.setSeed(parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
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
