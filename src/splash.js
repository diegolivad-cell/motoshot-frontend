export const SPLASH_MIN_MS = 1400;
export const SPLASH_FADE_MS = 650;

const SPLASH_STYLE_ID = "motoshot-splash-style";

function injectSplashStyles() {
  if (document.getElementById(SPLASH_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SPLASH_STYLE_ID;
  style.textContent = `
    #app-splash {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0c0c0c;
      opacity: 1;
      transition: opacity ${SPLASH_FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    #app-splash.app-splash--out {
      opacity: 0;
      pointer-events: none;
    }
    #app-splash .app-splash-center {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
    #app-splash .app-splash-inner {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: app-splash-in 0.9s cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    #app-splash .app-splash-glow {
      position: absolute;
      width: 160px;
      height: 160px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 107, 0, 0.42) 0%, transparent 72%);
      animation: app-splash-glow 2.4s ease-in-out infinite;
    }
    #app-splash .app-splash-inner img {
      position: relative;
      z-index: 1;
      width: 96px;
      height: 96px;
      object-fit: contain;
    }
    #app-splash .app-splash-footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-bottom: max(28px, env(safe-area-inset-bottom, 0px));
      gap: 2px;
    }
    #app-splash .app-splash-rdl-logo {
      width: 40px;
      height: 40px;
      object-fit: contain;
      margin-bottom: 4px;
    }
    #app-splash .app-splash-from {
      font-size: 11px;
      color: #888;
      font-family: system-ui, -apple-system, sans-serif;
      letter-spacing: 0.02em;
    }
    #app-splash .app-splash-rdl-name {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
    }
    @keyframes app-splash-in {
      from { opacity: 0; transform: scale(0.88); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes app-splash-glow {
      0%, 100% { opacity: 0.35; transform: scale(1); }
      50% { opacity: 0.65; transform: scale(1.12); }
    }
  `;
  document.head.appendChild(style);
}

export function mountAppSplash() {
  injectSplashStyles();
  let el = document.getElementById("app-splash");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-splash";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="app-splash-center">
        <div class="app-splash-inner">
          <div class="app-splash-glow"></div>
          <img src="/favicon.png" alt="" width="96" height="96" />
        </div>
      </div>
      <div class="app-splash-footer">
        <img class="app-splash-rdl-logo" src="/rogue-dev-labs-logo.png" alt="" width="40" height="40" />
        <div class="app-splash-from">from</div>
        <div class="app-splash-rdl-name">Rogue Dev Labs</div>
      </div>
    `;
    document.body.prepend(el);
  } else {
    el.classList.remove("app-splash--out");
    el.style.opacity = "1";
    el.style.pointerEvents = "auto";
    delete el.dataset.dismissing;
  }
  window.__MOTOSHOT_SPLASH_VISIBLE_SINCE__ = Date.now();
}

export function dismissAppSplash() {
  const el = document.getElementById("app-splash");
  if (!el || el.dataset.dismissing === "1") return;
  el.dataset.dismissing = "1";
  el.classList.add("app-splash--out");
  window.setTimeout(() => el.remove(), SPLASH_FADE_MS + 80);
}

function queueMount() {
  if (typeof document === "undefined") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAppSplash, { once: true });
  } else {
    mountAppSplash();
  }
}

queueMount();
