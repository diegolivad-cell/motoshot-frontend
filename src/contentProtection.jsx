import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/** Temporary kill switch — set true to re-enable screenshot / media protection. */
export const CONTENT_PROTECTION_ENABLED = false;

let protectionDepth = 0;
let webListenersBound = false;

const NATIVE_PRIVACY_CONFIG = {
  android: {
    dimBackground: true,
    privacyModeOnActivityHidden: "splash",
  },
  ios: {
    blurEffect: "dark",
  },
};

function isProtectedTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".motoshot-protected-media, [data-content-protected]"));
}

function onProtectedContextMenu(event) {
  if (isProtectedTarget(event.target)) event.preventDefault();
}

function onProtectedDragStart(event) {
  if (isProtectedTarget(event.target)) event.preventDefault();
}

function onProtectedCopy(event) {
  if (isProtectedTarget(event.target)) event.preventDefault();
}

function onProtectedKeyUp(event) {
  if (protectionDepth <= 0) return;
  if (event.key === "PrintScreen") {
    navigator.clipboard?.writeText?.("").catch(() => {});
  }
}

function bindWebGuards() {
  if (webListenersBound) return;
  document.addEventListener("contextmenu", onProtectedContextMenu, true);
  document.addEventListener("dragstart", onProtectedDragStart, true);
  document.addEventListener("copy", onProtectedCopy, true);
  document.addEventListener("keyup", onProtectedKeyUp, true);
  webListenersBound = true;
}

function unbindWebGuards() {
  if (!webListenersBound) return;
  document.removeEventListener("contextmenu", onProtectedContextMenu, true);
  document.removeEventListener("dragstart", onProtectedDragStart, true);
  document.removeEventListener("copy", onProtectedCopy, true);
  document.removeEventListener("keyup", onProtectedKeyUp, true);
  webListenersBound = false;
}

function onVisibilityChange() {
  document.body.classList.toggle("motoshot-obscured", protectionDepth > 0 && document.hidden);
}

async function enableNativeProtection() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PrivacyScreen } = await import("@capacitor/privacy-screen");
    await PrivacyScreen.enable(NATIVE_PRIVACY_CONFIG);
  } catch {
    // Plugin unavailable or failed — web guards still apply.
  }
}

async function disableNativeProtection() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PrivacyScreen } = await import("@capacitor/privacy-screen");
    await PrivacyScreen.disable();
  } catch {
    // ignore
  }
}

export function enableContentProtection() {
  if (!CONTENT_PROTECTION_ENABLED) return;
  protectionDepth += 1;
  if (protectionDepth === 1) {
    document.body.classList.add("motoshot-content-protected");
    bindWebGuards();
    document.addEventListener("visibilitychange", onVisibilityChange);
    enableNativeProtection();
  }
}

export function disableContentProtection() {
  if (!CONTENT_PROTECTION_ENABLED) {
    protectionDepth = 0;
    document.body.classList.remove("motoshot-content-protected", "motoshot-obscured");
    unbindWebGuards();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    disableNativeProtection();
    return;
  }
  protectionDepth = Math.max(0, protectionDepth - 1);
  if (protectionDepth === 0) {
    document.body.classList.remove("motoshot-content-protected", "motoshot-obscured");
    unbindWebGuards();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    disableNativeProtection();
  }
}

export function useContentProtection(active) {
  useEffect(() => {
    if (!CONTENT_PROTECTION_ENABLED || !active) {
      disableNativeProtection();
      document.body.classList.remove("motoshot-content-protected", "motoshot-obscured");
      unbindWebGuards();
      return undefined;
    }
    enableContentProtection();
    return () => disableContentProtection();
  }, [active]);
}

export function ProtectedMedia({ as: Tag = "div", className = "", children, style, ...rest }) {
  if (!CONTENT_PROTECTION_ENABLED) {
    return (
      <Tag className={className || undefined} style={style} {...rest}>
        {children}
      </Tag>
    );
  }
  return (
    <Tag
      className={`motoshot-protected-media${className ? ` ${className}` : ""}`}
      data-content-protected=""
      onContextMenu={(event) => event.preventDefault()}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export const protectedVideoProps = CONTENT_PROTECTION_ENABLED
  ? {
      controlsList: "nodownload noremoteplayback nofullscreen",
      disablePictureInPicture: true,
      disableRemotePlayback: true,
      onContextMenu: (event) => event.preventDefault(),
    }
  : {};
