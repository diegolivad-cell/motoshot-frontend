import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  apiUrl,
  isRetryableStatus,
  parseApiJson,
  resetWakeCache,
  wakeApiServer,
} from "./apiClient.js";

describe("apiUrl", () => {
  it("returns relative paths in dev without VITE_API_URL", () => {
    expect(apiUrl("/api/photos")).toBe("/api/photos");
  });

  it("keeps absolute URLs unchanged", () => {
    expect(apiUrl("https://example.com/x")).toBe("https://example.com/x");
  });
});

describe("isRetryableStatus", () => {
  it("retries gateway and rate-limit errors", () => {
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});

describe("parseApiJson", () => {
  it("handles empty 504 without throwing", async () => {
    const res = new Response("", { status: 504 });
    const data = await parseApiJson(res);
    expect(data.error).toMatch(/iniciando/i);
  });

  it("handles empty 503 without throwing", async () => {
    const res = new Response("", { status: 503 });
    const data = await parseApiJson(res);
    expect(data.error).toMatch(/iniciando/i);
  });

  it("handles empty 502 without throwing", async () => {
    const res = new Response("", { status: 502 });
    const data = await parseApiJson(res);
    expect(data.error).toMatch(/iniciando|servidor/i);
  });

  it("parses valid JSON", async () => {
    const res = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const data = await parseApiJson(res);
    expect(data).toEqual({ ok: true });
  });

  it("handles HTML error pages from proxies", async () => {
    const res = new Response("<html>Bad Gateway</html>", { status: 502 });
    const data = await parseApiJson(res);
    expect(data.error).toMatch(/tardó demasiado|inválida/i);
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetWakeCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetWakeCache();
  });

  it("retries retryable responses until success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ photos: [] }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const promise = apiFetch("/api/photos", {}, { retries: 3, retryDelayMs: 100 });
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns last response after exhausting retries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = apiFetch("/api/photos", {}, { retries: 2, retryDelayMs: 50 });
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("wakeApiServer", () => {
  beforeEach(() => {
    resetWakeCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetWakeCache();
  });

  it("returns true when health endpoint responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }))
    );

    const promise = wakeApiServer({ maxAttempts: 2, delayMs: 100 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe(true);
  });
});
