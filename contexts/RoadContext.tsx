import React, { createContext, useContext, useState, useCallback } from 'react';
import { RoadType } from '@/lib/roadGenerator';

interface RoadChunkData {
  id: string;
  x: number;
  z: number;
  type: RoadType;
}

interface RoadContextType {
  roadChunks: Map<string, RoadChunkData>;
  registerRoadChunk: (id: string, x: number, z: number, type: RoadType) => void;
  getRoadAt: (x: number, z: number) => RoadType;
}

const RoadContext = createContext<RoadContextType | undefined>(undefined);

export function RoadContextProvider({ children }: { children: React.ReactNode }) {
  const [roadChunks] = useState(new Map<string, RoadChunkData>());

  const registerRoadChunk = useCallback((id: string, x: number, z: number, type: RoadType) => {
    if (!roadChunks.has(id)) {
      roadChunks.set(id, { id, x, z, type });
    }
  }, [roadChunks]);

  const getRoadAt = useCallback((x: number, z: number) => {
    // Simple lookup by chunk ID logic (assuming 10m chunks)
    // This might need adjustment if x/z are world coordinates vs chunk coordinates
    // Assuming x, z are chunk coordinates here for simplicity of the map key
    const id = `${x},${z}`;
    const chunk = roadChunks.get(id);
    return chunk ? chunk.type : 'none';
  }, [roadChunks]);

  return (
    <RoadContext.Provider value={{ roadChunks, registerRoadChunk, getRoadAt }}>
      {children}
    </RoadContext.Provider>
  );
}

export function useRoadContext() {
  const context = useContext(RoadContext);
  if (context === undefined) {
    throw new Error('useRoadContext must be used within a RoadContextProvider');
  }
  return context;
}
