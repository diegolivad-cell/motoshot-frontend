const API_BASE = (process.env.VITE_API_URL || "https://motoshot-backend.onrender.com").replace(/\/$/, "");

const ENDPOINTS = [
  "/health",
  "/api/photos",
  "/api/auth/photographers",
  "/api/auth/announcements",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkEndpoint(path, { retries = 4 } = {}) {
  const url = `${API_BASE}${path}`;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (res.ok) {
        console.log(`OK  ${res.status} ${path}`);
        return true;
      }
      if ([502, 503, 504].includes(res.status) && attempt < retries) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      console.error(`FAIL ${res.status} ${path}`, json?.error || text.slice(0, 120));
      return false;
    } catch (err) {
      if (attempt < retries) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      console.error(`FAIL ${path}`, err.message);
      return false;
    }
  }
  return false;
}

const results = await Promise.all(ENDPOINTS.map((path) => checkEndpoint(path)));
if (results.every(Boolean)) {
  console.log("\nSmoke test passed.");
  process.exit(0);
}
console.error("\nSmoke test failed.");
process.exit(1);
