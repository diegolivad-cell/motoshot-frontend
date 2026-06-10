import { Capacitor } from "@capacitor/core";

export const PENDING_PAYMENT_KEY = "motoshot_pending_payment";

let pollTimer = null;
let browserBridgeReady = null;
let paymentResumeHandler = null;
let paymentReturnTriggered = false;

export function setPaymentResumeHandler(handler) {
  paymentResumeHandler = handler;
}

export function buildPaymentReturnUrl(params = {}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://motoshot.pro";
  const url = new URL(`${origin}/payment-complete.html`);
  url.searchParams.set("payment_return", "true");
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export function buildPaymentCancelUrl(params = {}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://motoshot.pro";
  const url = new URL(`${origin}/payment-complete.html`);
  url.searchParams.set("payment_cancel", "true");
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export function writePendingPayment(data) {
  const raw = JSON.stringify({ ...data, startedAt: Date.now() });
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

export async function closePaymentBrowser() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    /* ignore */
  }
}

export function stopPaymentPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function isPaymentCancelUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get("payment_cancel") === "true" ||
      parsed.searchParams.get("paypal_cancel") === "true"
    );
  } catch {
    return url.includes("payment_cancel=true") || url.includes("paypal_cancel=true");
  }
}

function isPaymentReturnUrl(url) {
  if (!url) return false;
  if (isPaymentCancelUrl(url)) return false;
  try {
    const parsed = new URL(url);
    if (
      parsed.searchParams.get("payment_return") === "true" ||
      parsed.searchParams.get("paypal_return") === "true"
    ) {
      return true;
    }
    return parsed.pathname.includes("payment-complete");
  } catch {
    return (
      (url.includes("payment-complete") && !url.includes("payment_cancel=true")) ||
      url.includes("payment_return=true") ||
      url.includes("paypal_return=true")
    );
  }
}

async function handlePaymentReturn(source) {
  paymentReturnTriggered = true;
  await closePaymentBrowser();
  stopPaymentPolling();
  paymentResumeHandler?.(source);
}

async function handlePaymentCancel(source) {
  paymentReturnTriggered = false;
  await closePaymentBrowser();
  stopPaymentPolling();
  paymentResumeHandler?.(source);
}

export function startPaymentPolling(syncFn, intervalMs = 800) {
  stopPaymentPolling();
  pollTimer = window.setInterval(() => {
    syncFn().catch(() => {});
  }, intervalMs);
}

export async function ensurePaymentBrowserBridge() {
  if (!Capacitor.isNativePlatform()) return;
  if (browserBridgeReady) return browserBridgeReady;

  browserBridgeReady = (async () => {
    const { Browser } = await import("@capacitor/browser");
    // Capacitor only fires browserPageLoaded on the first navigation (checkout),
    // not when Recurrente redirects to payment-complete.html.
    await Browser.addListener("browserPageLoaded", () => {
      paymentResumeHandler?.("pageLoaded");
    });
    await Browser.addListener("browserFinished", () => {
      stopPaymentPolling();
      if (paymentReturnTriggered) {
        paymentResumeHandler?.("browserAfterReturn");
        return;
      }
      if (readPendingPayment()) {
        paymentResumeHandler?.("browserClosedPending");
        return;
      }
      paymentResumeHandler?.("browser");
    });

    try {
      const { App } = await import("@capacitor/app");
      await App.addListener("appUrlOpen", ({ url }) => {
        if (isPaymentCancelUrl(url)) {
          handlePaymentCancel("appUrlCancel").catch(() => {});
          return;
        }
        if (!isPaymentReturnUrl(url)) return;
        handlePaymentReturn("appUrlOpen").catch(() => {});
      });
      await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && readPendingPayment()) paymentResumeHandler?.("resume");
      });
      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url && isPaymentCancelUrl(launch.url)) {
          await handlePaymentCancel("appUrlCancel");
        } else if (launch?.url && isPaymentReturnUrl(launch.url)) {
          await handlePaymentReturn("launchUrl");
        }
      } catch {
        /* no cold-start URL */
      }
    } catch (err) {
      console.warn("Capacitor App listener:", err);
    }
  })();

  return browserBridgeReady;
}

export async function openRecurrenteCheckout(url, pollSyncFn) {
  if (!url) return;
  paymentReturnTriggered = false;
  stopPaymentPolling();

  // Misma WebView = misma sesión + pending payment. El return de Recurrente
  // pasa por payment-complete.html y redirige a /?payment_return=...
  window.location.assign(url);
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
  setPaymentResumeHandler(handler);
  ensurePaymentBrowserBridge().catch(() => {});
  return () => setPaymentResumeHandler(null);
}
