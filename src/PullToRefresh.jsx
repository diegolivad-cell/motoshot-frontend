import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./icons";

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

/** Pull-to-refresh estilo Facebook: jalar desde arriba con icono de moto naranja. */
export function usePullToRefresh({ onRefresh, enabled = true, threshold = 76 }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) {
      pullDistanceRef.current = 0;
      setPullDistance(0);
      pulling.current = false;
      return undefined;
    }

    const resetPull = () => {
      pulling.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    };

    const onTouchStart = (e) => {
      if (refreshing || getScrollTop() > 4) return;
      if (e.touches.length !== 1) return;
      const target = e.target;
      if (target?.closest?.(".modal-backdrop, .modal, input, textarea, select, [data-no-ptr]")) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e) => {
      if (!pulling.current || refreshing) return;
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
      const dist = Math.min(dy * 0.55, threshold * 1.35);
      pullDistanceRef.current = dist;
      setPullDistance(dist);
      if (dy > 8) e.preventDefault();
    };

    const finishPull = async () => {
      if (!pulling.current) return;
      const dist = pullDistanceRef.current;
      resetPull();
      if (dist < threshold || !onRefreshRef.current) return;
      setRefreshing(true);
      try {
        await onRefreshRef.current();
      } catch (err) {
        console.error("pull-to-refresh:", err);
      } finally {
        setRefreshing(false);
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
  }, [enabled, refreshing, threshold]);

  return { pullDistance, refreshing };
}

export function PullToRefreshIndicator({ pullDistance, refreshing, threshold = 76 }) {
  const progress = Math.min(1, pullDistance / threshold);
  const visible = pullDistance > 0 || refreshing;
  if (!visible) return null;

  return (
    <div
      className="ptr-indicator"
      style={{
        transform: `translateY(${refreshing ? 10 : Math.max(0, pullDistance - 28)}px)`,
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
