import { Capacitor } from "@capacitor/core";

export const PENDING_PAYMENT_KEY = "motoshot_pending_payment";

export function writePendingPayment(data) {
  const raw = JSON.stringify(data);
  try {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, raw);
    localStorage.setItem(PENDING_PAYMENT_KEY, raw);
  } catch {
    /* ignore */
  }
}

export function readPendingPayment() {
  try {
    const raw =
      sessionStorage.getItem(PENDING_PAYMENT_KEY) ||
      localStorage.getItem(PENDING_PAYMENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  try {
    sessionStorage.removeItem(PENDING_PAYMENT_KEY);
    localStorage.removeItem(PENDING_PAYMENT_KEY);
  } catch {
    /* ignore */
  }
}

export async function openRecurrenteCheckout(url) {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, presentationStyle: "fullscreen" });
      return;
    } catch (err) {
      console.warn("Capacitor Browser fallback:", err);
    }
  }
  window.location.href = url;
}

export function onNativePaymentResume(handler) {
  if (!Capacitor.isNativePlatform()) {
    const onVisible = () => {
      if (document.visibilityState === "visible") handler("visibility");
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", () => handler("pageshow"));
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  const cleanups = [];
  (async () => {
    try {
      const { App } = await import("@capacitor/app");
      const sub = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) handler("resume");
      });
      cleanups.push(() => sub.remove());
    } catch (err) {
      console.warn("Capacitor App listener:", err);
    }
    try {
      const { Browser } = await import("@capacitor/browser");
      const sub = await Browser.addListener("browserFinished", () => handler("browser"));
      cleanups.push(() => sub.remove());
    } catch (err) {
      console.warn("Capacitor Browser listener:", err);
    }
  })();

  return () => cleanups.forEach((fn) => fn());
}
