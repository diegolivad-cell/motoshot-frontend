"use client";

import { MotionConfig, useReducedMotion } from "framer-motion";
import { createContext, useContext, useMemo } from "react";
import { springs } from "./motionSystem";

const MotionPrefsContext = createContext({
  reducedMotion: false,
  springs,
});

export function useMotionPrefs() {
  return useContext(MotionPrefsContext);
}

export function MotionProvider({ children }) {
  const reducedMotion = useReducedMotion() ?? false;

  const value = useMemo(
    () => ({
      reducedMotion,
      springs: reducedMotion
        ? {
            snappy: { duration: 0.01 },
            soft: { duration: 0.01 },
            bouncy: { duration: 0.01 },
            layout: { duration: 0.01 },
          }
        : springs,
    }),
    [reducedMotion]
  );

  return (
    <MotionPrefsContext.Provider value={value}>
      <MotionConfig
        reducedMotion="user"
        transition={reducedMotion ? { duration: 0.01 } : springs.soft}
      >
        {children}
      </MotionConfig>
    </MotionPrefsContext.Provider>
  );
}
