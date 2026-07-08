const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "")
  || (import.meta.env.DEV ? "" : "https://motoshot-backend.onrender.com");

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const DEFAULT_RETRIES = 4;
const DEFAULT_RETRY_MS = 1500;

let wakePromise = null;
let wakeValidUntil = 0;

export function apiUrl(path) {
  if (!path || path.startsWith("http")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // En browser/APK WebView usar same-origin (/api → proxy Vercel) para auth y CORS consistentes.
  if (typeof window !== "undefined") return normalized;
  if (!API_BASE) return normalized;
  return `${API_BASE}${normalized}`;
}

export function isRetryableStatus(status) {
  return RETRYABLE_STATUSES.has(status);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function parseApiJson(res) {
  const text = await res.text();
  if (!text.trim()) {
    if (res.status === 503 || res.status === 502 || res.status === 504) {
      return {
        error: "El servidor está iniciando. Esperá unos segundos y recargá la página.",
      };
    }
    return { error: `Error del servidor (${res.status})` };
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: res.status === 502 || res.status === 503
        ? "El servidor tardó demasiado en responder. Probá de nuevo en unos segundos."
        : "Respuesta inválida del servidor.",
    };
  }
}

export async function wakeApiServer({ maxAttempts = 6, delayMs = DEFAULT_RETRY_MS } = {}) {
  const now = Date.now();
  if (wakePromise && now < wakeValidUntil) return wakePromise;

  wakeValidUntil = now + 30000;
  wakePromise = (async () => {
    const healthPaths = ["/api/health", "/health", "/api/auth/announcements"];
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      for (const path of healthPaths) {
        try {
          const res = await fetch(apiUrl(path), { cache: "no-store" });
          if (res.ok) return true;
        } catch {
          // Render cold start — keep retrying
        }
      }
      if (attempt < maxAttempts - 1) {
        await sleep(delayMs * (attempt + 1));
      }
    }
    return false;
  })();

  try {
    return await wakePromise;
  } finally {
    if (!wakeValidUntil || Date.now() >= wakeValidUntil) {
      wakePromise = null;
    }
  }
}

export function resetWakeCache() {
  wakePromise = null;
  wakeValidUntil = 0;
}

export async function apiFetch(input, init = {}, options = {}) {
  const {
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_MS,
    wake = false,
    timeoutMs = 0,
  } = options;

  if (wake) await wakeApiServer();

  const url = typeof input === "string" ? apiUrl(input) : input;
  let lastRes = null;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    const extSignal = init.signal;
    const onExternalAbort = () => controller.abort();
    if (extSignal) {
      if (extSignal.aborted) {
        if (timer) clearTimeout(timer);
        throw new DOMException("Aborted", "AbortError");
      }
      extSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      lastRes = res;
      if (res.ok || !isRetryableStatus(res.status) || attempt === retries) {
        return res;
      }
    } catch (err) {
      lastError = err;
      if (attempt === retries) {
        if (err?.name === "AbortError") {
          throw new Error("Tiempo de espera agotado. El servidor tardó demasiado.");
        }
        throw err;
      }
    } finally {
      if (timer) clearTimeout(timer);
      if (extSignal) extSignal.removeEventListener("abort", onExternalAbort);
    }
    await sleep(retryDelayMs * (attempt + 1));
  }

  if (lastRes) return lastRes;
  throw lastError || new Error("No se pudo conectar con el servidor");
}

export async function apiJson(input, init = {}, options = {}) {
  const res = await apiFetch(input, init, options);
  const data = await parseApiJson(res);
  return { res, data };
}
