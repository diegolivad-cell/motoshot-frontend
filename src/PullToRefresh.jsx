import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./icons";

const REFRESH_HOLD_PX = 80;
const MIN_REFRESH_MS = 750;
const MAX_REFRESH_MS = 15000;

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function lockPageScroll(lock) {
  const root = document.documentElement;
  const body = document.body;
  if (lock) {
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
  } else {
    root.style.overflow = "";
    root.style.overscrollBehavior = "";
    body.style.overscrollBehavior = "";
  }
}

/** Pull-to-refresh estilo Facebook: todo el bloque se mantiene abajo hasta que termina el refresh. */
export function usePullToRefresh({ onRefresh, enabled = true, threshold = 76 }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [holdDistance, setHoldDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const contentOffset = refreshing ? holdDistance : pullDistance;
  const shouldTransition = refreshing || contentOffset === 0;

  useEffect(() => {
    if (!enabled && !refreshingRef.current) {
      pulling.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setHoldDistance(0);
      return undefined;
    }
    if (!enabled && refreshingRef.current) {
      return undefined;
    }

    const resetPull = () => {
      if (refreshingRef.current) return;
      pulling.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setHoldDistance(0);
    };

    const onTouchStart = (e) => {
      if (refreshingRef.current || getScrollTop() > 4) return;
      if (e.touches.length !== 1) return;
      const target = e.target;
      if (target?.closest?.(".modal-backdrop, .modal, input, textarea, select, [data-no-ptr]")) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e) => {
      if (!pulling.current || refreshingRef.current) return;
      if (getScrollTop() > 4) {
        resetPull();
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      const dist = Math.min(dy * 0.5, threshold * 1.5);
      pullDistanceRef.current = dist;
      setPullDistance(dist);
      if (dy > 6) e.preventDefault();
    };

    const finishPull = async () => {
      if (!pulling.current || refreshingRef.current) return;
      pulling.current = false;
      const dist = pullDistanceRef.current;
      if (dist < threshold || !onRefreshRef.current) {
        resetPull();
        return;
      }

      const hold = Math.max(REFRESH_HOLD_PX, Math.round(dist));
      pullDistanceRef.current = hold;
      setHoldDistance(hold);
      setPullDistance(hold);
      refreshingRef.current = true;
      setRefreshing(true);
      lockPageScroll(true);

      const startedAt = Date.now();
      try {
        await Promise.race([
          Promise.resolve(onRefreshRef.current?.()),
          wait(MAX_REFRESH_MS).then(() => {
            console.warn("pull-to-refresh: timeout after", MAX_REFRESH_MS, "ms");
          }),
        ]);
        await waitForPaint();
      } catch (err) {
        console.error("pull-to-refresh:", err);
      } finally {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_REFRESH_MS) {
          await wait(MIN_REFRESH_MS - elapsed);
        }
        await waitForPaint();
        lockPageScroll(false);
        refreshingRef.current = false;
        setRefreshing(false);
        setHoldDistance(0);
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", finishPull);
    document.addEventListener("touchcancel", finishPull);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", finishPull);
      document.removeEventListener("touchcancel", finishPull);
    };
  }, [enabled, threshold]);

  useEffect(() => () => lockPageScroll(false), []);

  return { pullDistance, refreshing, contentOffset, refreshHoldPx: REFRESH_HOLD_PX, shouldTransition };
}

export function PullToRefreshIndicator({ pullDistance, refreshing, threshold = 76, refreshHoldPx = REFRESH_HOLD_PX }) {
  const progress = Math.min(1, pullDistance / threshold);
  const visible = pullDistance > 0 || refreshing;
  if (!visible) return null;

  const y = refreshing ? Math.max(0, refreshHoldPx - 32) : Math.max(0, pullDistance - 32);

  return (
    <div
      className="ptr-indicator"
      style={{
        transform: `translateY(${y}px)`,
        opacity: refreshing ? 1 : 0.45 + progress * 0.55,
      }}
      aria-hidden="true"
    >
      <div
        className={`ptr-indicator-bubble${refreshing ? " ptr-indicator-bubble--spin" : ""}`}
        style={{
          transform: refreshing ? undefined : `scale(${0.72 + progress * 0.28}) rotate(${Math.round(progress * 160)}deg)`,
        }}
      >
        <AppIcon name="feed" size={24} color="#FF6B00" />
      </div>
    </div>
  );
}
