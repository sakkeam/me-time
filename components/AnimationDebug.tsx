'use client'

import React, { useState } from 'react'
import { useAnimation, ANIMATION_REGISTRY, AnimationCategory } from '@/contexts/AnimationContext'
import { ChevronDown, ChevronRight, Square } from 'lucide-react'

export default function AnimationDebug() {
  const { currentAnimation, playAnimation, stopAnimation } = useAnimation()
  const [isOpen, setIsOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  // Group animations by category
  const groupedAnimations = Object.values(ANIMATION_REGISTRY).reduce((acc, anim) => {
    if (!acc[anim.category]) {
      acc[anim.category] = []
    }
    acc[anim.category].push(anim)
    return acc
  }, {} as Record<AnimationCategory, typeof ANIMATION_REGISTRY[string][]>)

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors z-50"
      >
        🎭
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 z-50 max-h-[80vh] flex flex-col">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <h3 className="font-bold text-zinc-800 dark:text-zinc-200">Animation Debug</h3>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      </div>

      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-500">Current:</span>
          <span className="font-mono font-bold text-blue-500">{currentAnimation}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => stopAnimation()}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 py-1 px-2 rounded text-sm transition-colors"
          >
            <Square size={14} /> Stop / Idle
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {(Object.keys(groupedAnimations) as AnimationCategory[]).map(category => (
          <div key={category} className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="capitalize font-medium text-sm">{category.replace('_', ' ')}</span>
              {expandedCategories[category] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            
            {expandedCategories[category] && (
              <div className="p-2 grid grid-cols-2 gap-2 bg-white dark:bg-black">
                {groupedAnimations[category].map(anim => (
                  <button
                    key={anim.name}
                    onClick={() => playAnimation(anim.name)}
                    className={`text-xs p-2 rounded text-left transition-colors truncate ${
                      currentAnimation === anim.name 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title={anim.description}
                  >
                    {anim.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
