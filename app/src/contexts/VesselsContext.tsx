import React, { createContext, useContext } from 'react';
import { useVessels } from '../hooks/useVessels';

export type VesselsContextValue = ReturnType<typeof useVessels>;

const VesselsContext = createContext<VesselsContextValue | null>(null);

export function VesselsProvider({ children }: { children: React.ReactNode }) {
  const value = useVessels();
  return (
    <VesselsContext.Provider value={value}>
      {children}
    </VesselsContext.Provider>
  );
}

export function useVesselsContext(): VesselsContextValue {
  const ctx = useContext(VesselsContext);
  if (ctx == null) {
    throw new Error('useVesselsContext must be used within VesselsProvider');
  }
  return ctx;
}
