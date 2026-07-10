"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { prefersReducedMotion } from "./motionSystem";

/**
 * Smooth scroll for marketing/home surfaces only.
 * Never mount this around the TikTok-style video feed (scroll-snap).
 */
export function SmoothScrollHome({ enabled = true, children }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return;
    if (typeof window === "undefined") return;

    // Only smooth the window when this home surface is active.
    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.1,
    });

    let rafId = 0;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [enabled]);

  return <div ref={rootRef}>{children}</div>;
}
