import { Capacitor } from "@capacitor/core";

/** Shared spring tokens — keep Motion language consistent across the app. */
export const springs = {
  snappy: { type: "spring", stiffness: 520, damping: 28 },
  soft: { type: "spring", stiffness: 320, damping: 30 },
  bouncy: { type: "spring", stiffness: 480, damping: 18 },
  layout: { type: "spring", stiffness: 380, damping: 32 },
};

export const easings = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.4, 0, 0.2, 1],
};

export const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

export const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: easings.out },
  },
};

/** Tab / view order for directional page transitions. */
export const VIEW_ORDER = [
  "photographers",
  "video_search",
  "my_purchases",
  "gallery",
  "my_gallery",
  "dashboard",
  "vendor_request",
  "auth",
  "photographer_profile",
  "detail",
  "upload",
  "upload_video",
  "pending_deliveries",
  "admin",
  "ceo_payroll",
  "success",
  "guest_success",
  "reset_password",
  "privacy_policy",
  "terms_conditions",
];

export function getViewDirection(fromView, toView) {
  const a = VIEW_ORDER.indexOf(fromView);
  const b = VIEW_ORDER.indexOf(toView);
  if (a < 0 || b < 0) return 1;
  return b >= a ? 1 : -1;
}

/** Views that should use a lighter / no-exit transition (video feed / photo feed). */
export const HEAVY_VIEWS = new Set(["video_search", "detail"]);

export function pageTransition(direction = 1, reduced = false, isHeavy = false) {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.12 },
    };
  }
  if (isHeavy) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.15, ease: easings.out },
    };
  }
  return {
    initial: { opacity: 0, x: direction * 28, y: 8 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: direction * -18, y: -6 },
    transition: { duration: 0.28, ease: easings.out },
  };
}

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isCoarsePointer() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(pointer: coarse)").matches;
}

export async function triggerHaptic(style = "light") {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] || ImpactStyle.Light });
  } catch {
    /* plugin unavailable */
  }
}

export function infiniteOrOnce(reduced, transition) {
  if (reduced) return { ...transition, repeat: 0 };
  return transition;
}
