import { Capacitor } from "@capacitor/core";

export const NATIVE_OAUTH_REDIRECT = "com.motoshotgt.app://oauth-complete?oauth=google";
export const OAUTH_REDIRECT_STORAGE_KEY = "motoshot_oauth_redirect";
export const OAUTH_BROWSER_OPEN_KEY = "motoshot_oauth_browser_open";
export const OAUTH_PKCE_BACKUP_KEY = "motoshot_pkce_backup";

const SUPABASE_PKCE_STORAGE_KEY = "sb-ejkxoaalhrzbyudwxwei-auth-token-code-verifier";

let oauthResumeHandler = null;
let oauthReturnTriggered = false;
let oauthBridgeReady = null;

export function buildOAuthReturnUrl() {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_OAUTH_REDIRECT;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "https://motoshot.pro";
  return `${origin}/oauth-complete.html?oauth=google`;
}

export function storeOAuthRedirectUrl(url) {
  try {
    sessionStorage.setItem(OAUTH_REDIRECT_STORAGE_KEY, url);
    localStorage.setItem(OAUTH_REDIRECT_STORAGE_KEY, url);
  } catch {
    /* ignore */
  }
}

export function readOAuthRedirectUrl() {
  try {
    return (
      sessionStorage.getItem(OAUTH_REDIRECT_STORAGE_KEY) ||
      localStorage.getItem(OAUTH_REDIRECT_STORAGE_KEY) ||
      buildOAuthReturnUrl()
    );
  } catch {
    return buildOAuthReturnUrl();
  }
}

export function clearOAuthRedirectUrl() {
  try {
    sessionStorage.removeItem(OAUTH_REDIRECT_STORAGE_KEY);
    localStorage.removeItem(OAUTH_REDIRECT_STORAGE_KEY);
    localStorage.removeItem(OAUTH_PKCE_BACKUP_KEY);
  } catch {
    /* ignore */
  }
}

export function backupPkceVerifier() {
  try {
    const verifier = localStorage.getItem(SUPABASE_PKCE_STORAGE_KEY);
    if (verifier) localStorage.setItem(OAUTH_PKCE_BACKUP_KEY, verifier);
  } catch {
    /* ignore */
  }
}

export function restorePkceVerifier() {
  try {
    const backup = localStorage.getItem(OAUTH_PKCE_BACKUP_KEY);
    if (backup) {
      localStorage.setItem(SUPABASE_PKCE_STORAGE_KEY, backup);
    }
  } catch {
    /* ignore */
  }
}

function readOAuthQueryParams(rawUrl) {
  if (!rawUrl) return new URLSearchParams();
  if (rawUrl.startsWith("com.motoshotgt.app://")) {
    return new URLSearchParams(rawUrl.split("?")[1] || "");
  }
  try {
    return new URL(rawUrl).searchParams;
  } catch {
    const query = rawUrl.includes("?") ? rawUrl.split("?").slice(1).join("?") : "";
    return new URLSearchParams(query);
  }
}

/** Single canonical URL for exchangeCodeForSession — must match redirectTo from signInWithOAuth. */
export function buildOAuthExchangeUrl(rawUrl) {
  if (!rawUrl) return null;

  const incoming = readOAuthQueryParams(rawUrl);
  const code = incoming.get("code");
  const error = incoming.get("error");
  if (!code && !error) return null;

  const stored = readOAuthRedirectUrl();

  if (stored.startsWith("com.motoshotgt.app://")) {
    const params = new URLSearchParams(stored.split("?")[1] || "");
    if (code) params.set("code", code);
    if (error) params.set("error", error);
    const errorDescription = incoming.get("error_description");
    if (errorDescription) params.set("error_description", errorDescription);
    return `com.motoshotgt.app://oauth-complete?${params.toString()}`;
  }

  let base;
  try {
    base = new URL(stored);
  } catch {
    base = new URL("https://motoshot.pro/oauth-complete.html?oauth=google");
  }
  if (code) base.searchParams.set("code", code);
  if (error) base.searchParams.set("error", error);
  const errorDescription = incoming.get("error_description");
  if (errorDescription) base.searchParams.set("error_description", errorDescription);
  return base.toString();
}

export function normalizeOAuthCallbackUrl(url) {
  if (!url) return null;

  if (
    url.startsWith("com.motoshotgt.app://oauth-complete") ||
    url.includes("oauth=google") ||
    url.includes("oauth-complete")
  ) {
    return buildOAuthExchangeUrl(url);
  }

  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("code") || parsed.searchParams.has("error")) {
      return buildOAuthExchangeUrl(parsed.toString());
    }
  } catch {
    /* ignore */
  }

  return null;
}

let oauthExchangePromise = null;
let oauthExchangeDone = false;

export function resetOAuthExchangeState() {
  oauthExchangePromise = null;
  oauthExchangeDone = false;
}

export function markOAuthExchangeDone() {
  oauthExchangeDone = true;
}

export async function runOAuthExchangeOnce(fn) {
  if (oauthExchangeDone) return true;
  if (oauthExchangePromise) return oauthExchangePromise;
  oauthExchangePromise = fn()
    .then((result) => {
      if (result) markOAuthExchangeDone();
      return result;
    })
    .finally(() => {
      oauthExchangePromise = null;
    });
  return oauthExchangePromise;
}

export function setOAuthResumeHandler(handler) {
  oauthResumeHandler = handler;
}

export function markOAuthReturnComplete() {
  oauthReturnTriggered = true;
}

export function isOAuthCancelUrl(url) {
  if (!url) return false;
  return (
    url.includes("error=access_denied") ||
    url.includes("access_denied") ||
    url.includes("OAuth%20Error")
  );
}

export function markOAuthBrowserOpen() {
  try {
    sessionStorage.setItem(OAUTH_BROWSER_OPEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearOAuthBrowserOpenFlag() {
  try {
    sessionStorage.removeItem(OAUTH_BROWSER_OPEN_KEY);
  } catch {
    /* ignore */
  }
}

export function isOAuthBrowserOpen() {
  try {
    return sessionStorage.getItem(OAUTH_BROWSER_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export async function closeOAuthBrowser() {
  if (!Capacitor.isNativePlatform()) return;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
      clearOAuthBrowserOpenFlag();
      return;
    } catch {
      /* ignore */
    }
    if (attempt < 5) {
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
  clearOAuthBrowserOpenFlag();
}

export function scheduleOAuthBrowserClose() {
  if (!Capacitor.isNativePlatform()) return;
  const delays = [0, 250, 600, 1200, 2000, 3500];
  delays.forEach((delay) => {
    window.setTimeout(() => {
      closeOAuthBrowser().catch(() => {});
    }, delay);
  });
}

async function handleOAuthReturn(url, source) {
  oauthReturnTriggered = true;
  scheduleOAuthBrowserClose();
  await new Promise((r) => setTimeout(r, 150));
  const normalized = normalizeOAuthCallbackUrl(url);
  oauthResumeHandler?.(source, normalized);
}

async function handleOAuthCancel(source) {
  oauthReturnTriggered = false;
  await closeOAuthBrowser();
  oauthResumeHandler?.(source, null);
}

export async function ensureOAuthBrowserBridge() {
  if (!Capacitor.isNativePlatform()) return;
  if (oauthBridgeReady) return oauthBridgeReady;

  oauthBridgeReady = (async () => {
    const { Browser } = await import("@capacitor/browser");
    await Browser.addListener("browserFinished", async () => {
      if (oauthReturnTriggered) {
        oauthReturnTriggered = false;
        return;
      }
      await new Promise((r) => setTimeout(r, 800));
      if (oauthReturnTriggered) return;
      oauthResumeHandler?.("browserClosed", null);
    });

    try {
      const { App } = await import("@capacitor/app");
      await App.addListener("appUrlOpen", ({ url }) => {
        const normalized = normalizeOAuthCallbackUrl(url);
        if (!normalized) return;
        if (isOAuthCancelUrl(url)) {
          handleOAuthCancel("appUrlCancel").catch(() => {});
          return;
        }
        handleOAuthReturn(url, "appUrlOpen").catch(() => {});
      });
      await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && isOAuthBrowserOpen()) {
          closeOAuthBrowser().catch(() => {});
        }
      });
      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
          const normalized = normalizeOAuthCallbackUrl(launch.url);
          if (normalized) {
            if (isOAuthCancelUrl(launch.url)) {
              await handleOAuthCancel("launchUrl");
            } else {
              await handleOAuthReturn(launch.url, "launchUrl");
            }
          }
        }
      } catch {
        /* no cold-start URL */
      }
    } catch (err) {
      console.warn("OAuth App listener:", err);
    }
  })();

  return oauthBridgeReady;
}

export async function openGoogleOAuth(url) {
  if (!url) return;
  oauthReturnTriggered = false;
  resetOAuthExchangeState();
  if (Capacitor.isNativePlatform()) {
    backupPkceVerifier();
    markOAuthBrowserOpen();
    await ensureOAuthBrowserBridge();
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, presentationStyle: "fullscreen" });
    return;
  }
  window.location.href = url;
}

export function onNativeOAuthResume(handler) {
  if (!Capacitor.isNativePlatform()) return () => {};
  setOAuthResumeHandler(handler);
  ensureOAuthBrowserBridge().catch(() => {});
  return () => setOAuthResumeHandler(null);
}
