import { useEffect, useState, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { supabase } from "./supabaseClient";
import { uploadToSupabaseStorage, removeFromSupabaseStorage, videoExtForFile, imageExtForFile, imageMimeForFile } from "./storageUpload";
import { motion, AnimatePresence } from "framer-motion";
import { AppIcon, LoaderIcon, EmptyIcon, AvatarPlaceholder, IconText, SectionTitleIcon, VerifiedBadge, AppButton, PasswordVisibilityToggle, MotoShotBrandMark } from "./icons";
import { isCeo, isAdmin as isAdminEmail } from "./roles";
import { dismissAppSplash, SPLASH_MIN_MS } from "./splash.js";
import { usePullToRefresh, PullToRefreshIndicator } from "./PullToRefresh";
import { Capacitor } from "@capacitor/core";
import { signInWithGoogleNative } from "./googleNativeAuth.js";
import {
  writePendingPayment,
  readPendingPayment,
  clearPendingPayment,
  openRecurrenteCheckout,
  closePaymentBrowser,
  stopPaymentPolling,
  buildPaymentReturnUrl,
  buildPaymentCancelUrl,
  onNativePaymentResume,
} from "./paymentFlow.js";
import {
  buildOAuthExchangeUrl,
  runOAuthExchangeOnce,
  resetOAuthExchangeState,
  restorePkceVerifier,
  onNativeOAuthResume,
  closeOAuthBrowser,
  scheduleOAuthBrowserClose,
  markOAuthReturnComplete,
  storeOAuthRedirectUrl,
  clearOAuthRedirectUrl,
  isOAuthBrowserOpen,
} from "./authFlow.js";
import { apiFetch, apiJson, apiUrl, parseApiJson, wakeApiServer } from "./apiClient.js";

const VIEWS = {
  PHOTOGRAPHERS: "photographers",
  PHOTOGRAPHER_PROFILE: "photographer_profile",
  GALLERY: "gallery",
  DETAIL: "detail",
  UPLOAD: "upload",
  SUCCESS: "success",
  AUTH: "auth",
  VENDOR_REQUEST: "vendor_request",
  MY_PURCHASES: "my_purchases",
  NOTIFICATIONS: "notifications",
  ADMIN: "admin",
  CEO_PAYROLL: "ceo_payroll",
  DASHBOARD: "dashboard",
  MY_GALLERY: "my_gallery",
  RESET_PASSWORD: "reset_password",
  CHANGE_PASSWORD: "change_password",
  UPLOAD_VIDEO: "upload_video",
  VIDEO_SEARCH: "video_search",
  PENDING_DELIVERIES: "pending_deliveries",
};

const VIDEO_PREVIEW_MAX_SEC = 7;
const VIDEO_PREVIEW_SHORT_SEC = 3;

const getVideoPreviewLimitSec = (knownDuration, videoEl) => {
  const fromMeta = videoEl?.duration;
  const metaDur = Number.isFinite(fromMeta) && fromMeta > 0 ? Math.round(fromMeta) : null;
  const dur = knownDuration ?? metaDur;
  if (dur != null && dur < VIDEO_PREVIEW_MAX_SEC) {
    return Math.min(VIDEO_PREVIEW_SHORT_SEC, dur);
  }
  return VIDEO_PREVIEW_MAX_SEC;
};

const formatVideoDuration = (seconds) => {
  const total = Math.floor(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) return null;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const readVideoDuration = (file) => new Promise((resolve) => {
  const el = document.createElement("video");
  el.preload = "metadata";
  const url = URL.createObjectURL(file);
  el.onloadedmetadata = () => {
    const dur = Math.round(el.duration);
    URL.revokeObjectURL(url);
    resolve(Number.isFinite(dur) && dur > 0 ? dur : null);
  };
  el.onerror = () => {
    URL.revokeObjectURL(url);
    resolve(null);
  };
  el.src = url;
});

const MAX_VIDEO_BATCH = 100;

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
};

const extractVideoFrameBase64 = async (file) => {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error("No se pudo leer el video"));
  });
  video.currentTime = Math.min(5, video.duration || 5);
  await new Promise((resolve) => { video.onseeked = resolve; });
  const maxDim = 1280;
  let w = video.videoWidth;
  let h = video.videoHeight;
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(video, 0, 0, w, h);
  const imageBase64 = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
  URL.revokeObjectURL(video.src);
  return imageBase64;
};

const PENDING_EMAIL_CONFIRM_KEY = "motoshot_pending_email_confirm";

const getEmailConfirmRedirectUrl = () => {
  if (typeof window === "undefined") return "https://motoshot.pro/?email_confirmed=1";
  const url = new URL(window.location.origin + "/");
  url.searchParams.set("email_confirmed", "1");
  return url.toString();
};

const setPendingEmailConfirmation = () => {
  try {
    sessionStorage.setItem(PENDING_EMAIL_CONFIRM_KEY, "1");
  } catch {
    /* ignore */
  }
};

const clearPendingEmailConfirmation = () => {
  try {
    sessionStorage.removeItem(PENDING_EMAIL_CONFIRM_KEY);
  } catch {
    /* ignore */
  }
};

const hasPendingEmailConfirmation = () =>
  typeof sessionStorage !== "undefined" &&
  sessionStorage.getItem(PENDING_EMAIL_CONFIRM_KEY) === "1";

const shouldShowEmailConfirmedSuccess = () => {
  const { search, hash } = getAuthCallbackParams();
  return (
    search.get("email_confirmed") === "1" ||
    search.get("type") === "signup" ||
    hash.get("type") === "signup" ||
    hash.get("type") === "email" ||
    hasPendingEmailConfirmation()
  );
};

const getAuthCallbackParams = () => {
  if (typeof window === "undefined") {
    return { search: new URLSearchParams(), hash: new URLSearchParams() };
  }
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return { search, hash };
};

const isEmailConfirmationRedirect = () => {
  const { search, hash } = getAuthCallbackParams();
  return (
    search.get("type") === "signup" ||
    hash.get("type") === "signup" ||
    hash.get("type") === "email" ||
    search.get("email_confirmed") === "1" ||
    hasPendingEmailConfirmation()
  );
};

const PENDING_GOOGLE_OAUTH_KEY = "motoshot_oauth_google";

const hasPendingGoogleOAuth = () =>
  typeof sessionStorage !== "undefined" &&
  sessionStorage.getItem(PENDING_GOOGLE_OAUTH_KEY) === "1";

const setPendingGoogleOAuth = () => {
  try {
    sessionStorage.setItem(PENDING_GOOGLE_OAUTH_KEY, "1");
  } catch {
    /* ignore */
  }
};

const clearPendingGoogleOAuth = () => {
  try {
    sessionStorage.removeItem(PENDING_GOOGLE_OAUTH_KEY);
  } catch {
    /* ignore */
  }
};

const isOAuthCallback = () => {
  if (typeof window !== "undefined" && window.location.pathname.includes("oauth-complete")) {
    return true;
  }
  if (typeof window !== "undefined" && window.location.pathname.includes("oauth-web")) {
    return true;
  }
  const { search } = getAuthCallbackParams();
  if (search.get("oauth") === "google" || hasPendingGoogleOAuth()) return true;
  if (search.has("code") && !isEmailConfirmationRedirect()) return true;
  return false;
};

const cleanAuthParamsFromUrl = () => {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, document.title, window.location.pathname);
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "wshu.net", "guerrillamail.com", "guerrillamail.net", "mailinator.com",
  "tempmail.com", "temp-mail.org", "yopmail.com", "10minutemail.com",
  "discard.email", "getnada.com", "maildrop.cc", "sharklasers.com",
]);

const isLikelyDisposableEmail = (email) => {
  const domain = (email || "").split("@")[1]?.toLowerCase().trim();
  return !!domain && DISPOSABLE_EMAIL_DOMAINS.has(domain);
};

/** Traduce mensajes de Supabase / Auth al español */
const translateAuthError = (message) => {
  if (!message) return "Ocurrió un error. Intentá de nuevo.";
  const m = String(message);
  const lower = m.toLowerCase();
  const secondsMatch = m.match(/after (\d+) second/i);
  if (
    lower.includes("security purposes") ||
    lower.includes("only request") ||
    lower.includes("rate limit")
  ) {
    const secs = secondsMatch?.[1];
    return secs
      ? `Por seguridad, podés volver a intentar en ${secs} segundos.`
      : "Por seguridad, esperá un momento antes de volver a intentar.";
  }
  if (lower.includes("already") && (lower.includes("registered") || lower.includes("exists"))) {
    return "Este correo ya está registrado.";
  }
  if (lower.includes("email not confirmed")) {
    return "Tu cuenta aún no está confirmada. Revisá tu correo.";
  }
  if (lower.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }
  if (lower.includes("user not found")) {
    return "El email ingresado no existe.";
  }
  if (lower.includes("invalid email")) {
    return "El correo no es válido.";
  }
  if (lower.includes("password") && lower.includes("least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (lower.includes("access_denied") || lower.includes("denied access")) {
    return "Inicio con Google cancelado.";
  }
  return m;
};

const MIN_AUTH_LOADING_MS = 700;

const waitForNextPaint = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

const requestConfirmationEmail = async (email, name) => {
  const res = await fetch("/api/auth/send-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      name: name || "",
      redirectTo: getEmailConfirmRedirectUrl(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(translateAuthError(data.error) || "Error al enviar correo de confirmación");
  return data;
};

const PHONE_COUNTRIES = [
  { flag: "🇬🇹", name: "Guatemala", code: "+502" },
  { flag: "🇲🇽", name: "México", code: "+52" },
  { flag: "🇺🇸", name: "EE.UU.", code: "+1" },
  { flag: "🇸🇻", name: "El Salvador", code: "+503" },
  { flag: "🇭🇳", name: "Honduras", code: "+504" },
  { flag: "🇨🇷", name: "Costa Rica", code: "+506" },
  { flag: "🇵🇦", name: "Panamá", code: "+507" },
  { flag: "🇨🇴", name: "Colombia", code: "+57" },
  { flag: "🇪🇸", name: "España", code: "+34" },
];

const stripLeadingCountryCodes = (value) => {
  let local = (value ?? "").trim();
  if (!local) return "";
  const byLength = [...PHONE_COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of byLength) {
      if (local.startsWith(c.code)) {
        local = local.slice(c.code.length).trim();
        changed = true;
        break;
      }
    }
  }
  return local.replace(/^\+/, "").trim();
};

const isCountryCodeOnly = (value) => {
  const local = (value ?? "").trim();
  if (!local) return true;
  return PHONE_COUNTRIES.some(c => local === c.code || local === c.code.slice(1));
};

const normalizePhoneLocal = (value, countryCode = "+502") => {
  if (isCountryCodeOnly(value)) return "";
  let local = stripLeadingCountryCodes(value);
  if (!local || isCountryCodeOnly(local)) return "";

  const countryDigits = countryCode.slice(1);
  if (/^\d+$/.test(local) && local.startsWith(countryDigits) && local.length > countryDigits.length) {
    local = local.slice(countryDigits.length);
  }

  return isCountryCodeOnly(local) ? "" : local;
};

const parsePhoneNumber = (fullPhone) => {
  const phone = (fullPhone ?? "").trim();
  if (!phone || isCountryCodeOnly(phone)) return { countryCode: "+502", localNumber: "" };

  let countryCode = "+502";
  let remainder = phone;
  const byLength = [...PHONE_COUNTRIES].sort((a, b) => b.code.length - a.code.length);

  for (const c of byLength) {
    if (phone.startsWith(c.code)) {
      countryCode = c.code;
      remainder = phone.slice(c.code.length);
      break;
    }
  }

  const localNumber = normalizePhoneLocal(remainder, countryCode);
  return { countryCode, localNumber };
};

const formatPhoneForSave = (countryCode, localNumber) => {
  const local = normalizePhoneLocal(localNumber, countryCode);
  const digits = local.replace(/\D/g, "");
  if (!digits) return "";
  return `${countryCode}${digits}`;
};

const formatPhoneDisplay = (fullPhone) => {
  const { localNumber } = parsePhoneNumber(fullPhone);
  const digits = localNumber.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return localNumber;
};

const HERO_POSTER_URL =
  "https://ejkxoaalhrzbyudwxwei.supabase.co/storage/v1/object/public/Video-Hero/STATICBANNER.png";
const VIDEO_CARD_PLACEHOLDER_URL = HERO_POSTER_URL;
const HERO_VIDEO_URL =
  "https://ejkxoaalhrzbyudwxwei.supabase.co/storage/v1/object/public/Video-Hero/14022738_720_1280_60fps.mp4";

function buildNavCurvePath(activeIndex, total, w = 400) {
  if (total <= 0) return `M0 0 H${w} V72 H0 Z`;
  const tabW = w / total;
  const cx = tabW * activeIndex + tabW / 2;
  const r = 34;
  const shoulder = 14;
  return [
    `M 0 20`,
    `L ${Math.max(0, cx - r - shoulder)} 20`,
    `C ${cx - r} 20 ${cx - r * 0.55} 6 ${cx} 2`,
    `C ${cx + r * 0.55} 6 ${cx + r} 20 ${Math.min(w, cx + r + shoulder)} 20`,
    `L ${w} 20`,
    `L ${w} 72`,
    `L 0 72`,
    `Z`,
  ].join(" ");
}

const formatNavBadge = (count) => {
  if (!count || count <= 0) return null;
  return count > 9 ? "9+" : String(count);
};

const CAN_HOVER_VIDEO_PREVIEW =
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function BottomNav({ items, activeTab, onSelect, variant = "default" }) {
  const activeIndex = Math.max(0, items.findIndex(i => i.id === activeTab));
  const activeItem = items[activeIndex] || items[0];
  const tabPercent = items.length > 0 ? 100 / items.length : 100;
  const isCeoNav = variant === "ceo";
  const iconName = (item) => item.icon || item.id;
  const activeBadge = formatNavBadge(activeItem?.badge);

  return (
    <nav className={`bottom-nav${isCeoNav ? " bottom-nav-ceo" : ""}`} aria-label="Navegación principal">
      <svg className="bnav-curve" viewBox="0 0 400 72" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="bnavGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isCeoNav ? "rgba(255,194,102,0)" : "rgba(255,107,0,0)"} />
            <stop offset="50%" stopColor={isCeoNav ? "rgba(255,194,102,0.4)" : "rgba(255,107,0,0.35)"} />
            <stop offset="100%" stopColor={isCeoNav ? "rgba(255,194,102,0)" : "rgba(255,107,0,0)"} />
          </linearGradient>
        </defs>
        <path d={buildNavCurvePath(activeIndex, items.length)} fill="#0e0e0e" />
        <path d={buildNavCurvePath(activeIndex, items.length)} fill="none" stroke="url(#bnavGrad)" strokeWidth="1" />
      </svg>

      <motion.div
        className="bnav-bubble"
        animate={{ left: `${(activeIndex + 0.5) * tabPercent}%` }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <div className="bnav-bubble-inner">
          <AppIcon name={iconName(activeItem)} size={18} />
          {activeBadge && (
            <span className="bnav-badge bnav-badge-bubble" aria-label={`${activeBadge} pendientes`}>
              {activeBadge}
            </span>
          )}
        </div>
      </motion.div>

      <div className="bnav-items">
        {items.map(item => {
          const isActive = activeTab === item.id;
          return (
            <AppButton
              key={item.id}
              type="button"
              className={`bnav-item${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(item)}
            >
              <span className={`bnav-icon-slot${isActive ? " active" : ""}`}>
                {!isActive && <AppIcon name={iconName(item)} size={18} />}
                {!isActive && formatNavBadge(item.badge) && (
                  <span className="bnav-badge" aria-label={`${formatNavBadge(item.badge)} pendientes`}>
                    {formatNavBadge(item.badge)}
                  </span>
                )}
              </span>
              <span className="bnav-label">{item.label}</span>
            </AppButton>
          );
        })}
      </div>
    </nav>
  );
}

const profileSearchTokens = (q) =>
  String(q ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => {
      if (t.length >= 4 && /[oa]$/.test(t)) return t.slice(0, -1);
      return t;
    })
    .filter((t) => t.length >= 2);

const buildProfileSearchHaystack = (values) =>
  values
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const matchesProfileSearch = (haystack, q) => {
  const tokens = profileSearchTokens(q);
  if (tokens.length === 0) return true;
  return tokens.every((token) => haystack.includes(token));
};

const photoMatchesProfileSearch = (photo, q) =>
  matchesProfileSearch(
    buildProfileSearchHaystack([
      photo.location,
      photo.ride_date,
      photo.time_start,
      photo.time_end,
      photo.tags,
    ]),
    q
  );

const videoMatchesProfileSearch = (video, q) =>
  matchesProfileSearch(
    buildProfileSearchHaystack([
      video.moto_brand,
      video.moto_model,
      video.moto_color,
      video.helmet_color,
      video.suit_color,
      video.dorsal,
      video.sector,
      video.additional_tags,
      video.event_time_start,
      video.event_time_end,
    ]),
    q
  );

function ProfileSearchBar({ value, onChange, onSearch, placeholder }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "stretch" }}>
      <input
        className="search-input"
        style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
      />
      <button
        type="button"
        aria-label="Buscar"
        onClick={onSearch}
        style={{
          flexShrink: 0,
          width: 42,
          height: 42,
          borderRadius: 10,
          border: "1px solid rgba(255,107,0,0.45)",
          background: "linear-gradient(145deg, rgba(255,140,50,0.95), var(--orange))",
          color: "#1a1008",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 2px 10px rgba(255,107,0,0.22)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.04)";
          e.currentTarget.style.boxShadow = "0 4px 14px rgba(255,107,0,0.32)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 2px 10px rgba(255,107,0,0.22)";
        }}
      >
        <AppIcon name="search" size={17} />
      </button>
    </div>
  );
}

function WatermarkedVideoOverlay({ photographer }) {
  const label = photographer || "MOTOSHOT";
  return (
    <>
      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 6,
        pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
      }}
      />
      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 6,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        userSelect: "none",
      }}
      >
        <div style={{
          color: "rgba(255,255,255,0.16)",
          fontSize: "clamp(12px, 3.5vw, 28px)",
          fontWeight: 900,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: 2,
          padding: "0 8px",
        }}
        >
          {`© ${label} • MOTOSHOT GT`}
        </div>
      </div>
    </>
  );
}

function WatermarkedImage({ src, photographer, purchased }) {
  const [loaded, setLoaded] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { setImageUrl(src); setLoaded(true); };
    img.src = src;
  }, [src]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      {imageUrl && (
        <img src={imageUrl} alt={photographer}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: loaded ? "block" : "none" }} />
      )}
      {!purchased && loaded && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.72) 100%)" }} />
      )}
      {!purchased && loaded && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ color: "rgba(255,255,255,0.18)", fontSize: 48, fontWeight: 900, textAlign: "center", textTransform: "uppercase", letterSpacing: 3 }}>
            {`© ${photographer} • MOTOSHOT GT`}
          </div>
        </div>
      )}
    </div>
  );
}
//USE STATES
  export default function App() {
  const [view, setView] = useState(VIEWS.PHOTOGRAPHERS);
  const [selected, setSelected] = useState(null);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [purchased, setPurchased] = useState([]);
  const [payStep, setPayStep] = useState(0);
  const [activeTab, setActiveTab] = useState("feed");
  const [searchTerm, setSearchTerm] = useState("");
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });
  const [vendorForm, setVendorForm] = useState({ name: "", handle: "", verification_id: "", bio: "", doc_type: "dpi", doc_front: null, doc_back: null });
  const [purchases, setPurchases] = useState([]);
  const [videoPurchases, setVideoPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [vendorStats, setVendorStats] = useState(null);
  const [vendorStatsLoading, setVendorStatsLoading] = useState(false);
  const [vendorStatsError, setVendorStatsError] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "", handle: "", phone: "", instagram: "", tiktok: "", facebook: "", telegram: "", whatsapp: "" });
  const [editMode, setEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState("+502");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [photographers, setPhotographers] = useState([]);
  const [photographersLoading, setPhotographersLoading] = useState(false);
  const [selectedPhotographer, setSelectedPhotographer] = useState(null);
  const [photographerPhotos, setPhotographerPhotos] = useState([]);
  const [detailReturnView, setDetailReturnView] = useState(VIEWS.PHOTOGRAPHERS);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "", image_url: "" });
  const [userRole, setUserRole] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [payrollData, setPayrollData] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [ceoAdmins, setCeoAdmins] = useState([]);
  const [ceoAdminsLoading, setCeoAdminsLoading] = useState(false);
  const [grantAdminEmail, setGrantAdminEmail] = useState("");
  const isCEO = userRole === "ceo" || isCeo(user?.email);
  const isStaff = userRole === "ceo" || userRole === "admin" || isAdminEmail(user?.email);
  const canDownloadPhoto = useCallback(
    (photo) => {
      if (!photo) return false;
      if (isCEO) return true;
      if (!user) return false;
      if (purchased.includes(photo.id)) return true;
      if (photo.photographer?.user_id === user.id) return true;
      return false;
    },
    [isCEO, user, purchased]
  );
  const isLoggedIn = authReady && Boolean(user && session?.access_token);
  const [showPassword, setShowPassword] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showManageSubscriptions, setShowManageSubscriptions] = useState(false);
  const [subPayLoading, setSubPayLoading] = useState(false);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [profileMediaTab, setProfileMediaTab] = useState("photos");
  const [myProfileMediaTab, setMyProfileMediaTab] = useState("photos");
  const [myGalleryMediaTab, setMyGalleryMediaTab] = useState("photos");
  const [uploadMediaTab, setUploadMediaTab] = useState("video");
  const [profileSearchInput, setProfileSearchInput] = useState("");
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [profileSearchRan, setProfileSearchRan] = useState(false);
  const [albumForm, setAlbumForm] = useState({ name: "", event_date: "" });
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [profileTab, setProfileTab] = useState("medios");
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postForm, setPostForm] = useState({ body: "", image_url: "" });
  const [postLoading, setPostLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState({ active: false, message: "" });
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const authSubmittingRef = useRef(false);
  const toastTimerRef = useRef(null);
  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setMessage("");
      toastTimerRef.current = null;
    }, 3000);
  };

  const clearGoogleOAuthUi = useCallback(() => {
    authSubmittingRef.current = false;
    setAuthSubmitting(false);
    setGlobalLoading({ active: false, message: "" });
    clearPendingGoogleOAuth();
  }, []);

  const completeOAuthSignIn = useCallback(
    async (oauthSession) => {
      const oauthUser = oauthSession?.user;
      if (!oauthSession?.access_token || !oauthUser) return;

      markOAuthReturnComplete();
      scheduleOAuthBrowserClose();

      setSession(oauthSession);
      setUser(oauthUser);
      cleanAuthParamsFromUrl();
      clearGoogleOAuthUi();
      clearOAuthRedirectUrl();

      const displayName =
        oauthUser.user_metadata?.full_name ||
        oauthUser.user_metadata?.name ||
        oauthUser.email?.split("@")[0] ||
        "rider";
      const createdMs = oauthUser.created_at ? new Date(oauthUser.created_at).getTime() : 0;
      const isNewUser = createdMs > 0 && Date.now() - createdMs < 3 * 60 * 1000;

      if (isNewUser) {
        setSuccessMode("oauth");
        setView(VIEWS.SUCCESS);
        fetch("/api/auth/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: oauthUser.email, name: displayName }),
        }).catch(() => {});
      } else {
        setActiveTab("feed");
        setView(VIEWS.PHOTOGRAPHERS);
        showToast(`¡Hola de nuevo, ${displayName}!`);
      }

    },
    [clearGoogleOAuthUi]
  );

  const handleGoogleAuth = useCallback(async () => {
    if (authSubmittingRef.current || authSubmitting || globalLoading.active) return;
    const isNative = Capacitor.isNativePlatform();
    try {
      authSubmittingRef.current = true;
      setAuthSubmitting(true);
      setGlobalLoading({ active: true, message: "Conectando con Google..." });

      if (isNative) {
        const session = await signInWithGoogleNative();
        await completeOAuthSignIn(session);
        return;
      }

      setPendingGoogleOAuth();
      const redirectTo = `${window.location.origin}/oauth-web.html?oauth=google`;
      storeOAuthRedirectUrl(redirectTo);
      resetOAuthExchangeState();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      clearGoogleOAuthUi();
      const msg = translateAuthError(err?.message) || "No se pudo continuar con Google.";
      showToast(msg);
    }
  }, [authSubmitting, globalLoading.active, clearGoogleOAuthUi, completeOAuthSignIn]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [heroScrollY, setHeroScrollY] = useState(0);
  const [heroVideoReady, setHeroVideoReady] = useState(false);
  const heroVideoRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [unifiedSearch, setUnifiedSearch] = useState({ photographers: [], photos: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState(null);
  const [photoViewMode, setPhotoViewMode] = useState("grid");
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [bankAccountInput, setBankAccountInput] = useState("");
  const [bankAccountSaving, setBankAccountSaving] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [adminWithdrawals, setAdminWithdrawals] = useState([]);
  const [vendorRequests, setVendorRequests] = useState([]);
  const [vendorRequestsLoading, setVendorRequestsLoading] = useState(false);
  const [adminDocPreview, setAdminDocPreview] = useState(null);
  const [adminPhotographers, setAdminPhotographers] = useState([]);
  const [adminPhotographersLoading, setAdminPhotographersLoading] = useState(false);
  const [showUnconfirmedBanner, setShowUnconfirmedBanner] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false);
  const [successMode, setSuccessMode] = useState("purchase");
  
  // ── Upload states ──────────────────────────────────────────
  const [uploadForm, setUploadForm] = useState({ location: "", ride_date: "", price: "", tags: "", time_start: "", time_end: "", album_id: "" });
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [videos, setVideos] = useState([]);
  const [videoSearchQuery, setVideoSearchQuery] = useState("");
  const [videoSearchRan, setVideoSearchRan] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [photographerVideos, setPhotographerVideos] = useState([]);
  const [videoPreviewActive, setVideoPreviewActive] = useState({});
  const [videoPreviewProgress, setVideoPreviewProgress] = useState({});
  const [videoPreviewMuted, setVideoPreviewMuted] = useState(true);
  const [videoDurationCache, setVideoDurationCache] = useState({});
  const [analyzingMedia, setAnalyzingMedia] = useState(false);
  const [autoTags, setAutoTags] = useState(null);
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [pendingDeliveriesLoading, setPendingDeliveriesLoading] = useState(false);
  const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0);
  const [hqUploads, setHqUploads] = useState({});
  const [videoMediaReady, setVideoMediaReady] = useState({});
  const [videoQueue, setVideoQueue] = useState([]);
  const [videoThumbnailFile, setVideoThumbnailFile] = useState(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(null);
  const [videoForm, setVideoForm] = useState({
    price: "", sector: "", event_time_start: "", event_time_end: "", album_id: "",
  });
  const [videoUploadLoading, setVideoUploadLoading] = useState(false);
  const [myVideos, setMyVideos] = useState([]);
  const [myVideosLoading, setMyVideosLoading] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [videoEditForm, setVideoEditForm] = useState({});
  const [videoEditSaving, setVideoEditSaving] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [purchasedVideos, setPurchasedVideos] = useState([]);
  const videoRefs = useRef({});
  const playingVideos = useRef([]);
  const videoPreviewHandlers = useRef({});

  const showEmailConfirmedPage = useCallback((s) => {
    if (!s?.user?.email_confirmed_at) return;
    setSession(s);
    setUser(s.user);
    setSuccessMode("email");
    setView(VIEWS.SUCCESS);
    setShowEmailConfirm(false);
    setShowUnconfirmedBanner(false);
    setGlobalLoading({ active: false, message: "" });
    clearPendingEmailConfirmation();
    cleanAuthParamsFromUrl();
  }, []);

  const processAuthCallbackFromUrl = useCallback(async () => {
    const { search, hash } = getAuthCallbackParams();
    const authError = search.get("error") || hash.get("error");
    const errorCode = search.get("error_code") || hash.get("error_code");
    const confirmContext = isEmailConfirmationRedirect();
    const fromConfirmEmail =
      confirmContext ||
      search.get("email_confirmed") === "1" ||
      hasPendingEmailConfirmation();

    if (!fromConfirmEmail && !authError) return false;

    if (search.has("code")) {
      try {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch (err) {
        console.error("exchangeCodeForSession:", err);
      }
    } else if (hash.has("access_token") || hash.has("refresh_token")) {
      const accessToken = hash.get("access_token") || "";
      const refreshToken = hash.get("refresh_token") || "";
      if (accessToken && refreshToken) {
        try {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } catch (err) {
          console.error("setSession(from hash):", err);
        }
      }
    }

    let session = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { data } = await supabase.auth.getSession();
      session = data.session;
      if (session?.access_token) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    if (authError && fromConfirmEmail) {
      cleanAuthParamsFromUrl();
      clearPendingEmailConfirmation();
      const msg =
        errorCode === "otp_expired"
          ? "Este enlace ya expiró o ya se usó. Iniciá sesión y pedí reenviar el correo de confirmación."
          : decodeURIComponent(
              (search.get("error_description") ||
                hash.get("error_description") ||
                "No se pudo confirmar el correo.")
                .replace(/\+/g, " ")
            );
      setMessage(msg);
      setAuthMode("login");
      setShowUnconfirmedBanner(true);
      setShowEmailConfirm(false);
      setView(VIEWS.AUTH);
      return true;
    }

    if (!session?.access_token) return false;

    let user = session.user;
    if (!user?.email_confirmed_at) {
      for (let attempt = 0; attempt < 8 && !user?.email_confirmed_at; attempt += 1) {
        const { data: { user: refreshed } } = await supabase.auth.getUser();
        if (refreshed) user = refreshed;
        if (!user?.email_confirmed_at && attempt < 7) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }

    if (user?.email_confirmed_at && shouldShowEmailConfirmedSuccess()) {
      showEmailConfirmedPage({ ...session, user });
      return true;
    }

    return false;
  }, [showEmailConfirmedPage]);

  const processOAuthFromCallbackUrl = useCallback(
    async (callbackUrl) => {
      if (!callbackUrl) return false;

      return runOAuthExchangeOnce(async () => {
        restorePkceVerifier();

        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession.session?.access_token) {
          scheduleOAuthBrowserClose();
          await completeOAuthSignIn(existingSession.session);
          return true;
        }

        const exchangeUrl = buildOAuthExchangeUrl(callbackUrl);
        if (!exchangeUrl) return false;

        const incoming = (() => {
          if (callbackUrl.startsWith("com.motoshotgt.app://")) {
            return new URLSearchParams(callbackUrl.split("?")[1] || "");
          }
          try {
            return new URL(callbackUrl).searchParams;
          } catch {
            return new URLSearchParams(callbackUrl.split("?")[1] || "");
          }
        })();

        const authError = incoming.get("error");
        if (authError) {
          clearGoogleOAuthUi();
          cleanAuthParamsFromUrl();
          const errorDescription = (
            incoming.get("error_description") || authError
          ).replace(/\+/g, " ");
          showToast(translateAuthError(errorDescription));
          setView(VIEWS.AUTH);
          return true;
        }

        if (!incoming.get("code")) return false;

        try {
          await supabase.auth.exchangeCodeForSession(exchangeUrl);
        } catch (err) {
          const { data: retrySession } = await supabase.auth.getSession();
          if (!retrySession.session?.access_token) {
            console.error("exchangeCodeForSession:", err?.message || err);
            throw err;
          }
        }

        let oauthSession = null;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { data } = await supabase.auth.getSession();
          oauthSession = data.session;
          if (oauthSession?.access_token) break;
          await new Promise((r) => setTimeout(r, 200));
        }

        if (oauthSession?.access_token) {
          scheduleOAuthBrowserClose();
          await completeOAuthSignIn(oauthSession);
          return true;
        }

        throw new Error("No se pudo completar el inicio con Google.");
      });
    },
    [clearGoogleOAuthUi, completeOAuthSignIn]
  );

  const processOAuthCallbackFromUrl = useCallback(async () => {
    const { search } = getAuthCallbackParams();
    if (search.get("oauth") === "google" && search.get("completed") === "1") {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        await completeOAuthSignIn(data.session);
        return true;
      }
    }
    if (search.get("oauth") === "google" && search.get("error")) {
      clearGoogleOAuthUi();
      cleanAuthParamsFromUrl();
      showToast(translateAuthError(search.get("error")));
      setView(VIEWS.AUTH);
      return true;
    }
    if (!isOAuthCallback()) return false;
    try {
      return await processOAuthFromCallbackUrl(window.location.href);
    } catch (err) {
      clearGoogleOAuthUi();
      cleanAuthParamsFromUrl();
      showToast(translateAuthError(err?.message) || "No se pudo ingresar con Google.");
      setView(VIEWS.AUTH);
      return true;
    }
  }, [clearGoogleOAuthUi, completeOAuthSignIn, processOAuthFromCallbackUrl]);

  const clearAuthState = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) {
      /* ignore */
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    setMySubscriptions([]);
  }, []);

  const refreshMySubscriptions = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const { res, data } = await apiJson("/api/auth/my-subscriptions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setMySubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error(err);
    }
  }, [session]);

  const paymentSyncInFlight = useRef(false);
  const vendorDashboardInFlight = useRef(false);
  const reconcileAtRef = useRef(0);
  const RECONCILE_COOLDOWN_MS = 5 * 60 * 1000;

  const finalizePhotoPurchase = useCallback(async (photoId) => {
    let photo = photos.find((p) => p.id === photoId);
    if (!photo) {
      const photoRes = await fetch(`/api/photos/${photoId}`);
      if (photoRes.ok) photo = await photoRes.json();
    }
    clearPendingPayment();
    if (photo) setSelected(photo);
    setSelectedVideo(null);
    setPurchased((prev) => [...new Set([...prev, photoId])]);
    setSuccessMode("purchase");
    setView(VIEWS.SUCCESS);
    setPayStep(0);
  }, [photos]);

  const finalizeVideoPurchase = useCallback(async (videoId) => {
    const video = videos.find((v) => v.id === videoId) || { id: videoId };
    clearPendingPayment();
    setSelectedVideo(video);
    setSelected(null);
    setPurchasedVideos((prev) => [...new Set([...prev, videoId])]);
    setSuccessMode("video");
    setView(VIEWS.SUCCESS);
    setPayStep(0);
    try {
      await fetchPurchases();
    } catch (err) {
      console.error("fetchPurchases after video buy:", err);
    }
    showToast("Compra registrada. Tu video estará disponible en Compras en las próximas 24 horas.");
  }, [videos]);

  const handlePaymentCancelled = useCallback(() => {
    stopPaymentPolling();
    clearPendingPayment();
    paymentSyncInFlight.current = false;
    setGlobalLoading({ active: false, message: "" });
    setPayStep(1);
    setSubPayLoading(false);
    showToast("Pago cancelado.");
  }, []);

  const syncPendingPayments = useCallback(async ({ silent = false } = {}) => {
    if (!session?.access_token || paymentSyncInFlight.current) return false;
    if (isOAuthCallback() || successMode === "oauth" || successMode === "email") return false;

    const pending = readPendingPayment();
    const params = new URLSearchParams(window.location.search);
    const paymentReturn =
      params.get("payment_return") === "true" ||
      params.get("paypal_return") === "true";
    const paypalToken = params.get("token");
    const videoIdFromUrl = params.get("video_id");
    if (!pending && !paymentReturn && !(paypalToken && videoIdFromUrl)) return false;

    paymentSyncInFlight.current = true;
    if (!silent) {
      setGlobalLoading({ active: true, message: "Confirmando tu pago..." });
    }
    const hintVideoId = pending?.videoId || videoIdFromUrl || undefined;
    const hintPhotoId = pending?.photoId || params.get("photo_id") || undefined;
    const shouldRetry = paymentReturn || Boolean(paypalToken && hintVideoId);
    const maxAttempts = shouldRetry ? 12 : 1;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const syncRes = await fetch("/api/payments/sync-pending", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            video_id: hintVideoId || undefined,
            photo_id: hintPhotoId || undefined,
          }),
        });
        const syncData = await syncRes.json().catch(() => ({}));
        if (!syncRes.ok) throw new Error(syncData.error || "No se pudo confirmar el pago");

        if (syncData.subscriptions?.length) {
          stopPaymentPolling();
          await closePaymentBrowser();
          clearPendingPayment();
          await refreshMySubscriptions();
          await fetchAllSubscriptions();
          showToast("¡Suscripción activa!");
          setShowSubscribeModal(false);
          window.history.replaceState({}, document.title, window.location.pathname);
          return true;
        }

        const purchase = syncData.purchases?.[0];
        if (purchase?.photo_id) {
          stopPaymentPolling();
          await closePaymentBrowser();
          await finalizePhotoPurchase(purchase.photo_id);
          window.history.replaceState({}, document.title, window.location.pathname);
          return true;
        }

        const videoPurchase = syncData.video_purchases?.[0];
        if (videoPurchase?.video_id) {
          stopPaymentPolling();
          await closePaymentBrowser();
          await finalizeVideoPurchase(videoPurchase.video_id);
          window.history.replaceState({}, document.title, window.location.pathname);
          return true;
        }

        const resolvedVideoId = hintVideoId;
        if (paypalToken && resolvedVideoId) {
          const res = await fetch("/api/payments/capture-video-paypal-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              order_id: paypalToken,
              paypal_order_id: paypalToken,
              video_id: resolvedVideoId,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            stopPaymentPolling();
            await closePaymentBrowser();
            await finalizeVideoPurchase(resolvedVideoId);
            window.history.replaceState({}, document.title, window.location.pathname);
            return true;
          }
        }

        if (pending?.kind === "video" && pending.videoId) {
          if (pending.provider === "paypal" && (pending.orderId || paypalToken)) {
            const res = await fetch("/api/payments/capture-video-paypal-order", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                order_id: pending.orderId || paypalToken,
                paypal_order_id: pending.orderId || paypalToken,
                video_id: pending.videoId,
              }),
            });
            if (res.ok) {
              stopPaymentPolling();
              await closePaymentBrowser();
              await finalizeVideoPurchase(pending.videoId);
              window.history.replaceState({}, document.title, window.location.pathname);
              return true;
            }
          } else {
            const res = await fetch("/api/payments/capture-video-order", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                checkout_id: pending.checkoutId || undefined,
                order_id: pending.checkoutId || undefined,
                video_id: pending.videoId,
              }),
            });
            if (res.ok) {
              stopPaymentPolling();
              await closePaymentBrowser();
              await finalizeVideoPurchase(pending.videoId);
              window.history.replaceState({}, document.title, window.location.pathname);
              return true;
            }
          }
        } else if (hintVideoId && (paymentReturn || paypalToken)) {
          const res = await fetch("/api/payments/capture-video-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ video_id: hintVideoId }),
          });
          if (res.ok) {
            stopPaymentPolling();
            await closePaymentBrowser();
            await finalizeVideoPurchase(hintVideoId);
            window.history.replaceState({}, document.title, window.location.pathname);
            return true;
          }
        }

        if (pending?.kind === "photo" && pending.photoId) {
          const res = await fetch("/api/payments/capture-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              checkout_id: pending.checkoutId || undefined,
              order_id: pending.checkoutId || undefined,
              photo_id: pending.photoId,
            }),
          });
          if (res.ok) {
            stopPaymentPolling();
            await closePaymentBrowser();
            await finalizePhotoPurchase(pending.photoId);
            window.history.replaceState({}, document.title, window.location.pathname);
            return true;
          }
        }

        if (pending?.kind === "subscription" && pending.photographerId) {
          const res = await fetch("/api/payments/capture-subscription-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              checkout_id: pending.checkoutId || undefined,
              order_id: pending.checkoutId || undefined,
              photographer_id: pending.photographerId,
            }),
          });
          if (res.ok) {
            stopPaymentPolling();
            await closePaymentBrowser();
            clearPendingPayment();
            await refreshMySubscriptions();
            await fetchAllSubscriptions();
            showToast("¡Suscripción activa!");
            setShowSubscribeModal(false);
            window.history.replaceState({}, document.title, window.location.pathname);
            return true;
          }
        }

        if (attempt < maxAttempts - 1) await sleep(2000);
      }

      if (shouldRetry && !silent) {
        showToast("Estamos confirmando tu pago. Reabrí la app en unos segundos si no ves la compra.");
      }
      return false;
    } catch (err) {
      if (!silent) {
        showToast(err.message || "No se pudo completar el pago. Volvé a la app e intentá de nuevo.");
      }
      return false;
    } finally {
      paymentSyncInFlight.current = false;
      if (!silent) {
        setGlobalLoading({ active: false, message: "" });
      }
    }
  }, [session, successMode, finalizePhotoPurchase, finalizeVideoPurchase, refreshMySubscriptions]);

  const isSubscribedToPhotographer = useCallback(
    (photographerId) =>
      !!photographerId &&
      mySubscriptions.some((sub) => sub.photographer?.id === photographerId),
    [mySubscriptions]
  );

  const syncAuthFromSupabase = useCallback(async () => {
    const { search, hash } = getAuthCallbackParams();
    const pendingCallback =
      isOAuthCallback() ||
      search.has("code") ||
      hash.has("access_token") ||
      isEmailConfirmationRedirect();

    if (search.has("code") && isOAuthCallback()) {
      if (!(Capacitor.isNativePlatform() && hasPendingGoogleOAuth())) {
        try {
          const exchangeUrl = buildOAuthExchangeUrl(window.location.href) || window.location.href;
          await supabase.auth.exchangeCodeForSession(exchangeUrl);
        } catch (err) {
          console.error("exchangeCodeForSession(oauth):", err);
        }
      }
    }

    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing?.user) {
      setSession(existing);
      setUser(existing.user);
      return;
    }

    const { data: { user: validatedUser }, error } = await supabase.auth.getUser();
    if (error || !validatedUser) {
      if (!pendingCallback) await clearAuthState();
      return;
    }
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    setUser(validatedUser);
  }, [clearAuthState]);

  // ── Auth ───────────────────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      try {
        const handledOAuth = await processOAuthCallbackFromUrl();
        if (!handledOAuth) {
          const handledCallback = await processAuthCallbackFromUrl();
          if (!handledCallback) {
            await syncAuthFromSupabase();
          }
        }
      } finally {
        if (!Capacitor.isNativePlatform() && hasPendingGoogleOAuth()) {
          clearGoogleOAuthUi();
        }
        setAuthReady(true);
      }
    };
    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setAuthReady(true);
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setProfile(null);
        setUserRole(null);
        setMySubscriptions([]);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSession(s);
        setUser(s?.user ?? null);
        if (
          Capacitor.isNativePlatform() &&
          hasPendingGoogleOAuth() &&
          s?.access_token &&
          event === "SIGNED_IN"
        ) {
          completeOAuthSignIn(s).catch(() => {});
        }
      }
      if (event === "PASSWORD_RECOVERY") {
        setShowPasswordReset(true);
      }
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        s?.access_token &&
        s?.user?.email_confirmed_at &&
        shouldShowEmailConfirmedSuccess()
      ) {
        showEmailConfirmedPage(s);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [
    showEmailConfirmedPage,
    syncAuthFromSupabase,
    processAuthCallbackFromUrl,
    processOAuthCallbackFromUrl,
    clearGoogleOAuthUi,
    completeOAuthSignIn,
  ]);

  const resumeNativeGoogleOAuth = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !hasPendingGoogleOAuth()) return false;
    await new Promise((r) => setTimeout(r, 400));

    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      await completeOAuthSignIn(data.session);
      return true;
    }
    return false;
  }, [completeOAuthSignIn]);

  useEffect(() => {
    return onNativeOAuthResume(async (source, callbackUrl) => {
      if (source === "appUrlCancel") {
        clearGoogleOAuthUi();
        showToast("Inicio con Google cancelado.");
        setView(VIEWS.AUTH);
        return;
      }

      if (source === "browserClosed") {
        scheduleOAuthBrowserClose();
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token && hasPendingGoogleOAuth()) {
          await completeOAuthSignIn(data.session);
          return;
        }
        const resumed = await resumeNativeGoogleOAuth();
        if (resumed) return;
        if (!hasPendingGoogleOAuth()) return;
        clearGoogleOAuthUi();
        showToast("Inicio con Google cancelado.");
        setView(VIEWS.AUTH);
        return;
      }

      if (!callbackUrl) return;
      setGlobalLoading({ active: true, message: "Completando inicio con Google..." });
      try {
        await processOAuthFromCallbackUrl(callbackUrl);
      } catch (err) {
        clearGoogleOAuthUi();
        showToast(translateAuthError(err?.message) || "No se pudo ingresar con Google.");
        setView(VIEWS.AUTH);
      }
    });
  }, [clearGoogleOAuthUi, processOAuthFromCallbackUrl, resumeNativeGoogleOAuth]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removed = false;
    let listener = null;

    (async () => {
      const { App } = await import("@capacitor/app");
      if (removed) return;
      listener = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive || !hasPendingGoogleOAuth()) return;
        resumeNativeGoogleOAuth().catch(() => {});
        if (isOAuthBrowserOpen()) scheduleOAuthBrowserClose();
      });
    })();

    return () => {
      removed = true;
      listener?.remove?.();
    };
  }, [resumeNativeGoogleOAuth]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !authReady || !isLoggedIn) return;
    if (!isOAuthBrowserOpen() && !hasPendingGoogleOAuth()) return;
    scheduleOAuthBrowserClose();
  }, [authReady, isLoggedIn]);

  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted || !hasPendingGoogleOAuth()) return;
      clearGoogleOAuthUi();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [clearGoogleOAuthUi]);

  useEffect(() => {
    if (!authReady || !session?.user?.email_confirmed_at) return;
    if (!shouldShowEmailConfirmedSuccess()) return;
    if (view === VIEWS.SUCCESS && successMode === "email") return;
    showEmailConfirmedPage(session);
  }, [authReady, session, view, successMode, showEmailConfirmedPage]);

  useEffect(() => {
    const visibleSince = window.__MOTOSHOT_SPLASH_VISIBLE_SINCE__ || Date.now();
    const minTimer = authReady
      ? window.setTimeout(
          dismissAppSplash,
          Math.max(0, SPLASH_MIN_MS - (Date.now() - visibleSince))
        )
      : null;
    const maxTimer = window.setTimeout(dismissAppSplash, 7000);
    return () => {
      if (minTimer) window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, [authReady]);

// ── Fetch photos ───────────────────────────────────────────
const fetchPhotos = async () => {
  try {
    setLoading(true);
    const { res, data } = await apiJson("/api/photos");
    if (!res.ok) throw new Error(data.error || "Error cargando fotos");
    setPhotos(data.photos || []);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

const fetchAllSubscriptions = async () => {
  if (!session) return;
  try {
    setSubsLoading(true);
    const { res, data } = await apiJson("/api/auth/my-subscriptions/all", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setAllSubscriptions(data.subscriptions || []);
  } catch (err) {
    console.error(err);
  } finally {
    setSubsLoading(false);
  }
};

const openConfirmDialog = useCallback(
  ({
    title = "CONFIRMAR",
    message,
    confirmLabel = "CONFIRMAR",
    cancelLabel = "CANCELAR",
    destructive = false,
    onConfirm,
  }) => {
    setConfirmDialog({
      title,
      message,
      confirmLabel,
      cancelLabel,
      destructive,
      onConfirm: () => {
        setConfirmDialog(null);
        onConfirm?.();
      },
    });
  },
  []
);

const openCancelSubscriptionConfirm = (subId) => {
  openConfirmDialog({
    title: "CANCELAR SUSCRIPCIÓN",
    message: "¿Cancelar esta suscripción? Seguirás con acceso hasta la fecha de vencimiento.",
    confirmLabel: "SÍ, CANCELAR",
    cancelLabel: "NO",
    destructive: true,
    onConfirm: () => handleCancelSubscription(subId),
  });
};

const handleCancelSubscription = async (subId) => {
  if (!session?.access_token) return;
  const res = await fetch(`/api/auth/subscriptions/${subId}/cancel`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    showToast("Suscripción cancelada.");
    await fetchAllSubscriptions();
    await refreshMySubscriptions();
  } else {
    showToast(data.error || "No se pudo cancelar la suscripción.");
  }
};

const handleSubscriptionPayment = async (photographerId, subscriptionId = null) => {
  if (!session?.access_token || !photographerId) return;
  setSubPayLoading(true);
  try {
    const res = await fetch("/api/payments/create-subscription-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        photographer_id: photographerId,
        subscription_id: subscriptionId || undefined,
        return_url: buildPaymentReturnUrl({
          subscription: "1",
          photographer_id: photographerId,
          ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
        }),
        cancel_url: buildPaymentCancelUrl({ subscription: "1" }),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo iniciar el pago");
    writePendingPayment({
      kind: "subscription",
      photographerId,
      subscriptionId: subscriptionId || null,
      checkoutId: data.checkout_id || data.order_id || null,
    });
    await openRecurrenteCheckout(data.approve_url || data.checkout_url, () =>
      syncPendingPayments({ silent: true })
    );
    setSubPayLoading(false);
  } catch (err) {
    setSubPayLoading(false);
    showToast(err.message || "No se pudo iniciar el pago.");
  }
};

const handleReactivateSubscription = (sub) => {
  if (!sub?.photographer?.id) return;
  handleSubscriptionPayment(sub.photographer.id, sub.id);
};

const fetchAnnouncements = async () => {
  try {
    const { res, data } = await apiJson("/api/auth/announcements");
    if (res.ok) setAnnouncements(data.announcements || []);
  } catch (err) {
    console.error(err);
  }
};

// ── Fetch purchases ────────────────────────────────────────
const fetchPurchases = async ({ silent = false } = {}) => {
  if (!session) return;
  try {
    if (!silent) setPurchasesLoading(true);
    const res = await fetch("/api/payments/my-purchases", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) throw new Error("Error cargando compras");
    const data = await res.json();
    setPurchases(data.purchases || []);
    setVideoPurchases(data.video_purchases || []);
  } catch (err) {
    console.error(err);
    if (!silent) showToast("No se pudieron cargar tus compras.");
  } finally {
    if (!silent) setPurchasesLoading(false);
  }
};

const downloadFromSignedUrl = async (url, filename) => {
  const fileRes = await fetch(url);
  if (!fileRes.ok) {
    throw new Error("El archivo ya no está disponible. Pedile al fotógrafo que lo vuelva a subir.");
  }
  const blob = await fileRes.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename || "MotoShot_descarga";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};

// Compras listas para descargar y aún no reclamadas (badge estilo Facebook)
const unclaimedPurchasesCount =
  purchases.filter((p) => p.photo?.hq_status === "ready" && !p.hq_downloaded_at).length +
  videoPurchases.filter((v) => v.video?.hq_status === "ready" && !v.hq_downloaded_at).length;
const fetchNotifications = async () => {
  if (!session) return;
  try {
    setNotifLoading(true);
    const res = await fetch("/api/auth/notifications", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    setNotifications(data.notifications || []);
  } catch (err) {
    console.error(err);
  } finally {
    setNotifLoading(false);
  }
};
const fetchVendorDashboard = async ({ reconcile = false, silent = false } = {}) => {
  if (!session?.access_token || !user) return;
  if (vendorDashboardInFlight.current) return;
  vendorDashboardInFlight.current = true;
  try {
    if (!silent) {
      setVendorStatsLoading(true);
      setVendorStatsError(false);
    }
    await wakeApiServer();
    const { res, data } = await apiJson("/api/auth/vendor-dashboard", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) throw new Error(data.error || "Error cargando dashboard");
    setVendorStats(data);
    setVendorStatsError(false);

    const shouldReconcile =
      reconcile
      && profile?.verification_status === "approved"
      && Date.now() - reconcileAtRef.current > RECONCILE_COOLDOWN_MS;
    if (shouldReconcile) {
      reconcileAtRef.current = Date.now();
      apiJson(
        "/api/payments/reconcile-photographer-sales",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
        { retries: 2 }
      )
        .then(async ({ res: reconcileRes, data: reconcileData }) => {
          if (!reconcileRes.ok || !reconcileData?.reconciled) return null;
          return apiJson("/api/auth/vendor-dashboard", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        })
        .then((refresh) => {
          if (refresh?.res.ok) setVendorStats(refresh.data);
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error(err);
    if (!silent) {
      setVendorStatsError(true);
      showToast("No se pudo cargar el dashboard. Tocá reintentar.");
    }
  } finally {
    vendorDashboardInFlight.current = false;
    if (!silent) setVendorStatsLoading(false);
  }
};
  const fetchPosts = async (photographerId) => {
  try {
    setPostsLoading(true);
    const res = await fetch(`/api/auth/posts/${photographerId}`);
    const data = await res.json();
    setPosts(data.posts || []);
  } catch (err) {
    console.error(err);
  } finally {
    setPostsLoading(false);
  }
};
const fetchPhotographers = async () => {
  try {
    setPhotographersLoading(true);
    const { res, data } = await apiJson("/api/auth/photographers");
    if (res.ok) setPhotographers(data.photographers || []);
  } catch (err) {
    console.error(err);
  } finally {
    setPhotographersLoading(false);
  }
};

const fetchAlbums = async (photographerId) => {
  try {
    const res = await fetch(`/api/auth/albums/${photographerId}`);
    const data = await res.json();
    setAlbums(data.albums || []);
  } catch (err) {
    console.error(err);
  }
};

const fetchPhotographerProfile = async (id) => {
  try {
    const [profileRes, albumsRes, videosRes] = await Promise.all([
      fetch(`/api/auth/photographers/${id}`),
      fetch(`/api/auth/albums/${id}`),
      fetch(`/api/videos/photographer/${id}`),
    ]);
    const [profileData, albumsData, videosData] = await Promise.all([
      profileRes.json(),
      albumsRes.json(),
      videosRes.ok ? videosRes.json() : Promise.resolve([]),
    ]);

    if (!profileRes.ok) throw new Error(profileData.error || "No se pudo cargar el perfil");
    if (!videosRes.ok) console.error("fetchPhotographerProfile videos:", videosRes.status);

    setSelectedPhotographer(profileData.photographer);
    setPhotographerPhotos(profileData.photos || []);
    setAlbums(albumsData.albums || []);
    setPhotographerVideos(Array.isArray(videosData) ? videosData : []);
    setProfileMediaTab("photos");
    setProfileSearchInput("");
    setProfileSearchQuery("");
    setProfileSearchRan(false);
    setSelectedAlbum(null);
    setSelectedTag(null);
  } catch (err) {
    console.error("fetchPhotographerProfile:", err);
    setPhotographerVideos([]);
  }
};

const fetchMyVideos = async (photographerId) => {
  if (!photographerId) return;
  try {
    setMyVideosLoading(true);
    const res = await fetch(`/api/videos/photographer/${photographerId}`);
    if (res.ok) {
      const data = await res.json();
      setMyVideos(Array.isArray(data) ? data : []);
    }
  } catch (err) {
    console.error("fetchMyVideos:", err);
  } finally {
    setMyVideosLoading(false);
  }
};
const renderNotifications = () => (
  <div className="upload-view">
    <SectionTitleIcon icon="bell">NOTIFICACIONES</SectionTitleIcon>
    <div className="section-sub">Tus ventas y actividad reciente.</div>

    {notifLoading ? (
      <div className="empty"><LoaderIcon size={44} /><div>Cargando...</div></div>
    ) : notifications.length === 0 ? (
      <div className="empty"><EmptyIcon name="bellOff" /><div>No tenés notificaciones aún.</div></div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            padding: 14, borderRadius: 10,
            background: n.read ? "var(--surface)" : "rgba(255,107,0,0.08)",
            border: `1px solid ${n.read ? "var(--border)" : "var(--orange)"}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              <IconText icon="money" size={14}>Nueva venta — Q{n.amount}</IconText>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              <IconText icon="pin" size={12}>{n.photo_location}</IconText>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              <IconText icon="user" size={12}>{n.buyer_email}</IconText>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              {new Date(n.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
const handleEditProfile = async () => {
  setEditLoading(true);
  setGlobalLoading({ active: true, message: "Guardando perfil..." });
  try {
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        ...editForm,
        phone: formatPhoneForSave(phoneCountry, phoneLocal),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setProfile(data.photographer);
    setEditMode(false);
    showToast("Perfil actualizado.")
  } catch (err) {
    setMessage(err.message);
  } finally {
    setEditLoading(false);
    setGlobalLoading({ active: false, message: "" });
  }
};

const handleAvatarUpload = async () => {
  if (!avatarFile) return;
  setAvatarLoading(true);
  setGlobalLoading({ active: true, message: "Subiendo avatar..." });
  try {
    const formData = new FormData();
    formData.append("avatar", avatarFile);
    const res = await fetch("/api/auth/avatar", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setProfile(prev => ({ ...prev, avatar_url: `${data.avatar_url}?t=${Date.now()}` }));
    setAvatarFile(null);
    showToast("Avatar actualizado.")
  } catch (err) {
    setMessage(err.message);
  } finally {
    setAvatarLoading(false);
    setGlobalLoading({ active: false, message: "" });
  }
};
const fetchMyWithdrawals = async () => {
  if (!session?.access_token) return;
  try {
    setWithdrawalsLoading(true);
    const { res, data } = await apiJson("/api/auth/withdrawals/my", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setWithdrawals(data.withdrawals || []);
  } catch (err) {
    console.error(err);
  } finally {
    setWithdrawalsLoading(false);
  }
};

const handleSaveBankAccount = async () => {
  const cleaned = bankAccountInput.trim();
  if (cleaned.length < 10) {
    showToast("Ingresá banco, tipo de cuenta y número (mín. 10 caracteres).");
    return;
  }
  setBankAccountSaving(true);
  try {
    const res = await fetch("/api/auth/bank-account", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ bank_account: cleaned }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setProfile(data.photographer);
    setBankAccountInput(data.photographer?.bank_account || cleaned);
    showToast("Cuenta bancaria guardada.");
  } catch (err) {
    showToast(err.message || "No se pudo guardar la cuenta.");
  } finally {
    setBankAccountSaving(false);
  }
};

const fetchAdminWithdrawals = async () => {
  if (!session) return;
  try {
    const res = await fetch("/api/auth/withdrawals/admin", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    setAdminWithdrawals(data.withdrawals || []);
  } catch (err) {
    console.error(err);
  }
};

const openAdminVerificationDoc = (url, label) => {
  if (!url) {
    showToast("Documento no disponible.");
    return;
  }
  if (/\.pdf(\?|$)/i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  setAdminDocPreview({ url, label });
};

const renderAdminDocPreviewModal = () => (
  <AnimatePresence>
    {adminDocPreview && (
      <motion.div
        className="modal-backdrop"
        style={{ zIndex: 260 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setAdminDocPreview(null)}
      >
        <motion.div
          className="modal"
          style={{ maxWidth: 520 }}
          initial={{ opacity: 0, scale: 0.92, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 40 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-title">{adminDocPreview.label}</div>
            <AppButton className="modal-close" onClick={() => setAdminDocPreview(null)} aria-label="Cerrar">
              <AppIcon name="x" size={18} />
            </AppButton>
          </div>
          <div className="modal-body" style={{ paddingTop: 8 }}>
            <img
              src={adminDocPreview.url}
              alt={adminDocPreview.label}
              style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 10, background: "#0a0a0a" }}
            />
            <AppButton
              className="nav-btn"
              style={{ marginTop: 14, width: "100%" }}
              onClick={() => window.open(adminDocPreview.url, "_blank", "noopener,noreferrer")}
            >
              Abrir en pestaña nueva
            </AppButton>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const fetchVendorRequests = async () => {
  if (!session || !isStaff) return;
  try {
    setVendorRequestsLoading(true);
    const res = await fetch("/api/auth/admin/vendor-requests", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (res.ok) setVendorRequests(data.requests || []);
    else showToast(data.error || "No se pudieron cargar solicitudes.");
  } catch (err) {
    console.error(err);
  } finally {
    setVendorRequestsLoading(false);
  }
};

const fetchAdminPhotographers = async () => {
  if (!session || !isCEO) return;
  try {
    setAdminPhotographersLoading(true);
    const res = await fetch("/api/auth/admin/photographers", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (res.ok) setAdminPhotographers(data.photographers || []);
    else showToast(data.error || "No se pudieron cargar perfiles.");
  } catch (err) {
    console.error(err);
  } finally {
    setAdminPhotographersLoading(false);
  }
};

const handleVendorVerification = (id, status) => {
  if (!session) return;
  const label = status === "approved" ? "aprobar" : "rechazar";
  openConfirmDialog({
    title: status === "approved" ? "APROBAR FOTÓGRAFO" : "RECHAZAR SOLICITUD",
    message: `¿Confirmás ${label} esta solicitud de fotógrafo?`,
    confirmLabel: status === "approved" ? "SÍ, APROBAR" : "SÍ, RECHAZAR",
    cancelLabel: "NO",
    destructive: status !== "approved",
    onConfirm: async () => {
  const res = await fetch(`/api/auth/admin/photographers/${id}/verification`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (res.ok) {
    showToast(status === "approved" ? "Listo: Fotógrafo verificado." : "Solicitud rechazada.");
    fetchVendorRequests();
    fetchPhotographers();
    if (isCEO) fetchAdminPhotographers();
  } else {
    showToast(data.error || "No se pudo actualizar la solicitud.");
  }
    },
  });
};

const handlePhotographerActive = (id, active) => {
  if (!session || !isCEO) return;
  const action = active ? "reactivar" : "suspender";
  openConfirmDialog({
    title: active ? "REACTIVAR FOTÓGRAFO" : "SUSPENDER FOTÓGRAFO",
    message: `¿Confirmás ${action} este perfil de fotógrafo?`,
    confirmLabel: active ? "SÍ, REACTIVAR" : "SÍ, SUSPENDER",
    cancelLabel: "NO",
    destructive: !active,
    onConfirm: async () => {
  const res = await fetch(`/api/auth/admin/photographers/${id}/active`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ active }),
  });
  const data = await res.json();
  if (res.ok) {
    showToast(active ? "Listo: Perfil reactivado." : "Perfil suspendido.");
    fetchAdminPhotographers();
    fetchPhotographers();
  } else {
    showToast(data.error || "No se pudo actualizar el perfil.");
  }
    },
  });
};

const fetchCeoPayroll = async () => {
  if (!session || !isCEO) return;
  setPayrollLoading(true);
  try {
    const res = await fetch("/api/auth/ceo/payroll", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (res.ok) setPayrollData(data);
    else showToast(data.error || "No se pudo cargar la planilla.");
  } catch (err) {
    console.error(err);
  } finally {
    setPayrollLoading(false);
  }
};

const fetchCeoAdmins = async () => {
  if (!session || !isCEO) return;
  setCeoAdminsLoading(true);
  try {
    const res = await fetch("/api/auth/ceo/admins", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (res.ok) setCeoAdmins(data.admins || []);
    else showToast(data.error || "No se pudieron cargar administradores.");
  } catch (err) {
    console.error(err);
  } finally {
    setCeoAdminsLoading(false);
  }
};

const handleGrantAdmin = async () => {
  const email = grantAdminEmail.trim().toLowerCase();
  if (!email || !session) return;
  const res = await fetch("/api/auth/ceo/admins", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (res.ok) {
    showToast("Listo: Administrador asignado.");
    setGrantAdminEmail("");
    fetchCeoAdmins();
  } else {
    showToast(data.error || "No se pudo asignar administrador.");
  }
};

const handleRevokeAdmin = (email) => {
  if (!session) return;
  openConfirmDialog({
    title: "REVOCAR ADMIN",
    message: `¿Revocar permisos de administrador a ${email}?`,
    confirmLabel: "SÍ, REVOCAR",
    cancelLabel: "NO",
    destructive: true,
    onConfirm: async () => {
  const res = await fetch(`/api/auth/ceo/admins/${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const data = await res.json();
  if (res.ok) {
    showToast("Permisos de administrador revocados.");
    fetchCeoAdmins();
  } else {
    showToast(data.error || "No se pudo revocar.");
  }
    },
  });
};

const exportPayrollCsv = () => {
  if (!payrollData?.rows?.length) {
    showToast("No hay filas para exportar.");
    return;
  }
  const headers = ["Nombre", "Handle", "Email", "Cuenta bancaria", "Ventas semana (Q)", "Saldo disponible (Q)", "A pagar (Q)", "Retiro pendiente (Q)"];
  const lines = payrollData.rows.map((r) =>
    [
      r.name,
      r.handle,
      r.email,
      r.bank_account,
      Number(r.weekly_sales).toFixed(2),
      Number(r.available_balance).toFixed(2),
      Number(r.amount_to_pay).toFixed(2),
      r.pending_withdrawal ? Number(r.pending_withdrawal.amount).toFixed(2) : "0.00",
    ]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planilla-motoshot-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await wakeApiServer();
      if (cancelled) return;
      await Promise.all([fetchPhotos(), fetchPhotographers(), fetchAnnouncements()]);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!authReady || !isLoggedIn) return;
    refreshMySubscriptions();
  }, [authReady, isLoggedIn, refreshMySubscriptions]);

  useEffect(() => {
    if (view !== VIEWS.PHOTOGRAPHER_PROFILE || !isLoggedIn || !session) return;
    refreshMySubscriptions();
  }, [view, isLoggedIn, session, selectedPhotographer?.id, refreshMySubscriptions]);

  useEffect(() => {
    if (!authReady) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("manage_subscriptions") === "1") {
      if (isLoggedIn) {
        setActiveTab("profile");
        setView(VIEWS.VENDOR_REQUEST);
        setShowManageSubscriptions(true);
        fetchAllSubscriptions();
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [authReady, isLoggedIn]);

  useEffect(() => {
    if (view !== VIEWS.VENDOR_REQUEST || !isLoggedIn || !session) return;
    fetchAllSubscriptions();
  }, [view, isLoggedIn, session]);

  // Deep link desde emails: motoshot.pro/abrir?goto=compras → sección Compras
  useEffect(() => {
    if (!authReady) return;
    const params = new URLSearchParams(window.location.search);
    const isAbrirPath = window.location.pathname === "/abrir";
    if (params.get("goto") === "compras" || isAbrirPath) {
      if (isLoggedIn) {
        setActiveTab("purchases");
        setView(VIEWS.MY_PURCHASES);
      }
      window.history.replaceState({}, document.title, "/");
    }
  }, [authReady, isLoggedIn]);

  // APK: si el link del email abre la app nativa, navegar a Compras
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener = null;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("appUrlOpen", ({ url }) => {
          if (String(url || "").includes("goto=compras")) {
            setActiveTab("purchases");
            setView(VIEWS.MY_PURCHASES);
          }
        });
        removeListener = () => listener.remove();
      } catch { /* plugin no disponible */ }
    })();
    return () => { if (removeListener) removeListener(); };
  }, []);

useEffect(() => {
  const onScroll = () => setHeroScrollY(window.scrollY);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}, []);

  useEffect(() => {
    if (view !== VIEWS.PHOTOGRAPHERS) return;
    setHeroVideoReady(false);

    let el = null;
    let rafId = 0;
    let retryPlay = null;
    let stopRetry = null;
    const markReady = () => setHeroVideoReady(true);

    const bind = () => {
      el = heroVideoRef.current;
      if (!el) {
        rafId = requestAnimationFrame(bind);
        return;
      }
      el.addEventListener("loadeddata", markReady);
      el.addEventListener("canplay", markReady);
      el.addEventListener("playing", markReady);
      const tryPlay = () => el.play().catch(() => {});
      tryPlay();
      retryPlay = setInterval(tryPlay, 400);
      stopRetry = setTimeout(() => {
        if (retryPlay) clearInterval(retryPlay);
      }, 5000);
    };

    bind();

    return () => {
      cancelAnimationFrame(rafId);
      if (retryPlay) clearInterval(retryPlay);
      if (stopRetry) clearTimeout(stopRetry);
      if (el) {
        el.removeEventListener("loadeddata", markReady);
        el.removeEventListener("canplay", markReady);
        el.removeEventListener("playing", markReady);
      }
    };
  }, [view]);

  // ── Fetch profile ──────────────────────────────────────────
  useEffect(() => {
    if (!authReady) return;
    if (!isLoggedIn) {
      setProfile(null);
      setUserRole(null);
      return;
    }
    apiJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async ({ res, data: d }) => {
        if (res.status === 401) {
          await clearAuthState();
          return;
        }
        if (!res.ok) return;
        setProfile(d.photographer || null);
        if (d.user?.role) setUserRole(d.user.role);
      })
      .catch(console.error);
  }, [authReady, isLoggedIn, session, clearAuthState]);

  useEffect(() => {
    if (view !== VIEWS.CEO_PAYROLL || !isCEO || !session) return;
    fetchCeoPayroll();
  }, [view, isCEO, session]);

  useEffect(() => {
    if (view !== VIEWS.ADMIN || !isCEO || !session) return;
    fetchCeoAdmins();
  }, [view, isCEO, session]);

  useEffect(() => {
    if (view !== VIEWS.VENDOR_REQUEST || !isCEO || !session) return;
    fetchVendorRequests();
    fetchAdminWithdrawals();
    fetchCeoPayroll();
    fetchCeoAdmins();
  }, [view, isCEO, session]);

  // Mantener bottom nav alineada con la vista principal
  useEffect(() => {
    const tabByView = {
      [VIEWS.PHOTOGRAPHERS]: "feed",
      [VIEWS.UPLOAD]: "upload",
      [VIEWS.UPLOAD_VIDEO]: "upload",
      [VIEWS.VIDEO_SEARCH]: "videos",
      [VIEWS.PENDING_DELIVERIES]: "deliveries",
      [VIEWS.DASHBOARD]: "dash",
      [VIEWS.MY_PURCHASES]: "purchases",
      [VIEWS.MY_GALLERY]: "gallery",
      [VIEWS.VENDOR_REQUEST]: "profile",
      [VIEWS.CEO_PAYROLL]: "payroll",
    };
    const nextTab = tabByView[view];
    if (nextTab) setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [view]);
  
  useEffect(() => {
  if (view === VIEWS.MY_PURCHASES && user && session) {
    fetchPurchases();
  }
  }, [view, user, session]);

  // Cargar compras al iniciar para el badge de "compras sin reclamar"
  useEffect(() => {
    if (user && session?.access_token) fetchPurchases({ silent: true });
  }, [user, session?.access_token]);

  useEffect(() => {
    if (view !== VIEWS.ADMIN || !isStaff || !session) return;
    fetchVendorRequests();
    fetchAdminWithdrawals();
    if (isCEO) fetchAdminPhotographers();
  }, [view, isStaff, isCEO, session]);

  useEffect(() => {
    setBankAccountInput(profile?.bank_account || "");
  }, [profile?.bank_account]);

  useEffect(() => {
    const isApproved = profile?.verification_status === "approved";
    const needsVendorPanel = view === VIEWS.VENDOR_REQUEST && isApproved && session?.access_token && user;
    if (needsVendorPanel) {
      fetchVendorDashboard({ reconcile: false, silent: true });
      fetchMyWithdrawals();
    }
    // Perfil propio del fotógrafo — cargar sus fotos y álbumes
    if (view === VIEWS.VENDOR_REQUEST && isApproved && profile?.id) {
      fetchPhotographerProfile(profile.id);
      fetchPosts(profile.id);
      fetchMyVideos(profile.id);
    }

    // Mi Galería — fotógrafo: cargar videos; comprador: cargar compras
    if (view === VIEWS.MY_GALLERY && isApproved && profile?.id) {
      fetchMyVideos(profile.id);
    }
    if (view === VIEWS.MY_GALLERY && !isApproved && user && session?.access_token) {
      fetchPurchases();
    }
  }, [view, profile, session, user]);

  const fetchPendingDeliveryCount = useCallback(async () => {
    if (!profile?.id || profile.verification_status !== "approved" || !session?.access_token) return;
    try {
      const { res, data } = await apiJson(`/api/videos/pending-delivery-count/${profile.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setPendingDeliveryCount(Number(data.count) || 0);
    } catch (err) {
      console.error("fetchPendingDeliveryCount:", err);
    }
  }, [profile?.id, profile?.verification_status, session?.access_token]);

  const fetchPendingDeliveries = useCallback(async () => {
    if (!profile?.id || profile.verification_status !== "approved" || !session?.access_token) return;
    setPendingDeliveriesLoading(true);
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [photosResult, videosResult] = await Promise.all([
        apiJson(`/api/photos/pending-delivery/${profile.id}`, { headers }),
        apiJson(`/api/videos/pending-delivery/${profile.id}`, { headers }),
      ]);
      const photoItems = photosResult.res.ok && Array.isArray(photosResult.data) ? photosResult.data : [];
      const videoItems = videosResult.res.ok && Array.isArray(videosResult.data) ? videosResult.data : [];
      const merged = [
        ...(Array.isArray(photoItems) ? photoItems.map((p) => ({ ...p, media_type: p.media_type || "photo" })) : []),
        ...(Array.isArray(videoItems) ? videoItems.map((v) => ({ ...v, media_type: v.media_type || "video" })) : []),
      ].sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
      setPendingDeliveries(merged);
      setPendingDeliveryCount(merged.length);
    } catch (err) {
      console.error("fetchPendingDeliveries:", err);
    } finally {
      setPendingDeliveriesLoading(false);
    }
  }, [profile?.id, profile?.verification_status, session?.access_token]);

  useEffect(() => {
    if (view === VIEWS.PENDING_DELIVERIES) {
      fetchPendingDeliveries();
    }
  }, [fetchPendingDeliveries, view]);

  useEffect(() => {
    if (profile?.verification_status !== "approved" || !session?.access_token) return undefined;
    fetchPendingDeliveryCount();
    const countTimer = window.setInterval(fetchPendingDeliveryCount, 45000);
    return () => window.clearInterval(countTimer);
  }, [profile?.verification_status, profile?.id, session?.access_token, fetchPendingDeliveryCount]);

  useEffect(() => {
    if (view !== VIEWS.DASHBOARD || profile?.verification_status !== "approved" || !session?.access_token) {
      return undefined;
    }
    fetchVendorDashboard({ reconcile: true });
    const dashTimer = window.setInterval(() => fetchVendorDashboard({ silent: true }), 45000);
    return () => window.clearInterval(dashTimer);
  }, [view, profile?.verification_status, profile?.id, session?.access_token]);

  const analyzeMediaWithAI = async (file) => {
    if (!session?.access_token) return;
    setAnalyzingMedia(true);
    setAutoTags(null);
    try {
      let imageBase64;
      let mimeType;
      if (file.type.startsWith("video/")) {
        imageBase64 = await extractVideoFrameBase64(file);
        mimeType = "image/jpeg";
      } else {
        const reader = new FileReader();
        await new Promise((resolve) => {
          reader.onload = resolve;
          reader.readAsDataURL(file);
        });
        imageBase64 = reader.result.split(",")[1];
        mimeType = file.type;
      }
      const endpoint = file.type.startsWith("video/") ? "/api/videos/analyze-frame" : "/api/photos/analyze";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      const data = await res.json();
      if (res.ok) setAutoTags(data);
      else showToast(data.error || "No se pudo analizar el archivo.");
    } catch (err) {
      console.error("Error analizando media:", err);
      showToast("Error al analizar con IA.");
    } finally {
      setAnalyzingMedia(false);
    }
  };

  const analyzeVideoFrameTags = async (file) => {
    if (!session?.access_token) return null;
    try {
      const imageBase64 = await extractVideoFrameBase64(file);
      const res = await fetch("/api/videos/analyze-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64, mimeType: "image/jpeg" }),
      });
      const data = await res.json().catch(() => null);
      return res.ok ? data : null;
    } catch {
      return null;
    }
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || null);
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(file);
    });

  // El video se sube directo a Supabase Storage desde el navegador (el backend
  // en Render no aguanta archivos grandes en memoria). Luego solo se registran
  // los metadatos en el backend.
  const uploadQueuedVideo = async (item, { thumbnailFile, tags, form, onProgress }) => {
    const file = item.file;
    const ext = videoExtForFile(file);
    const videoId = crypto.randomUUID();
    const storagePath = `${profile.id}/${videoId}/preview_${Date.now()}.${ext}`;
    let thumbnail_path = null;
    let thumbnail_base64 = null;
    const uploadedPaths = [];

    const cleanupUploaded = () => {
      uploadedPaths.forEach((p) => removeFromSupabaseStorage("videos-preview", p));
    };

    try {
      if (thumbnailFile) {
        const thumbExt = imageExtForFile(thumbnailFile);
        thumbnail_path = `${profile.id}/${videoId}/thumbnail_${Date.now()}.${thumbExt}`;
        try {
          await uploadToSupabaseStorage({
            bucket: "videos-preview",
            path: thumbnail_path,
            file: thumbnailFile,
            contentType: imageMimeForFile(thumbnailFile),
            accessToken: session.access_token,
          });
          uploadedPaths.push(thumbnail_path);
        } catch (thumbErr) {
          const msg = String(thumbErr?.message || "");
          if (/mime type|not supported/i.test(msg)) {
            thumbnail_path = null;
            thumbnail_base64 = await fileToBase64(thumbnailFile).catch(() => null);
            if (!thumbnail_base64) throw thumbErr;
          } else {
            throw thumbErr;
          }
        }
      }

      await uploadToSupabaseStorage({
        bucket: "videos-preview",
        path: storagePath,
        file,
        accessToken: session.access_token,
        onProgress,
      });
      uploadedPaths.push(storagePath);

      const dur = await readVideoDuration(file).catch(() => null);
      const videoTags = tags || (await analyzeVideoFrameTags(file));

      const body = {
        video_id: videoId,
        storage_path: storagePath,
        ext,
        duration_seconds: dur || null,
        price: form.price,
        sector: form.sector,
        event_time_start: form.event_time_start,
        event_time_end: form.event_time_end,
        album_id: form.album_id,
        moto_brand: videoTags?.moto_brand || "",
        moto_model: videoTags?.moto_model || "",
        moto_color: videoTags?.moto_color || "",
        helmet_color: videoTags?.helmet_color || "",
        suit_color: videoTags?.suit_color || "",
        dorsal: videoTags?.dorsal || "",
        thumbnail_path,
        thumbnail_base64,
      };

      const { res, data } = await apiJson("/api/videos/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      }, { wake: true });
      if (!res.ok) {
        cleanupUploaded();
        throw new Error(data?.error || "No se pudo registrar el video.");
      }
      return data;
    } catch (err) {
      cleanupUploaded();
      throw err;
    }
  };

  const startVideoQueueUpload = async () => {
    if (!session?.access_token || !profile?.id || videoUploadLoading) return;
    const items = videoQueue.filter((i) => i.status === "pending" || i.status === "error");
    if (!items.length) return;

    const isSingle = videoQueue.length === 1;
    const form = { ...videoForm };
    const singleTags = isSingle ? autoTags : null;
    const queueThumb = videoThumbnailFile;

    setVideoUploadLoading(true);
    if (isSingle) {
      setGlobalLoading({ active: true, message: "Subiendo video… no cierres la app" });
    }

    let done = 0;
    let failed = 0;
    for (const item of items) {
      setVideoQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", error: null, progress: 0 } : q)));
      try {
        const onProgress = (pct) => {
          setVideoQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, progress: pct } : q)));
        };
        await uploadQueuedVideo(item, { thumbnailFile: queueThumb, tags: singleTags, form, onProgress });
        done += 1;
        setVideoQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "done", progress: 100 } : q)));
      } catch (err) {
        failed += 1;
        const message = err?.message || "No se pudo subir el video.";
        setVideoQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "error", error: message } : q)));
      }
    }

    setVideoUploadLoading(false);
    setGlobalLoading({ active: false, message: "" });

    if (failed === 0) {
      showToast(done === 1 ? "Listo: video subido exitosamente." : `Listo: ${done} videos subidos exitosamente.`);
      setVideoQueue([]);
      setVideoThumbnailFile(null);
      setVideoDurationSeconds(null);
      setAutoTags(null);
      setVideoForm({ price: "", sector: "", event_time_start: "", event_time_end: "", album_id: "" });
    } else {
      showToast(`${done} video(s) subido(s), ${failed} con error. Tocá SUBIR para reintentar los fallidos.`);
    }
    if (profile?.id) fetchMyVideos(profile.id);
  };

  const handleVideoSearch = async (query = videoSearchQuery) => {
    const q = String(query ?? "").trim();
    setVideoSearchRan(q.length > 0);
    setVideosLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const url = params.toString() ? `/api/videos/search?${params}` : "/api/videos/search";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al buscar videos");
      const list = Array.isArray(data) ? data : [];
      setVideos(list);
      if (list.some((v) => !v.thumbnail_url)) {
        const refreshSearchThumbnails = async () => {
          try {
            const retryRes = await fetch(url);
            const retryData = await retryRes.json();
            if (retryRes.ok && Array.isArray(retryData)) setVideos(retryData);
          } catch (_) {}
        };
        window.setTimeout(refreshSearchThumbnails, 8000);
        window.setTimeout(refreshSearchThumbnails, 20000);
      }
    } catch (err) {
      console.error("handleVideoSearch:", err);
      showToast(err.message || "Error al buscar videos.");
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  };

  const refreshCurrentView = useCallback(async () => {
    await wakeApiServer();
    const isApproved = profile?.verification_status === "approved";
    switch (view) {
      case VIEWS.PHOTOGRAPHERS:
        await Promise.all([fetchPhotos(), fetchPhotographers(), fetchAnnouncements()]);
        break;
      case VIEWS.VIDEO_SEARCH:
        await handleVideoSearch(videoSearchQuery);
        break;
      case VIEWS.MY_PURCHASES:
        if (user && session) await fetchPurchases();
        break;
      case VIEWS.MY_GALLERY:
        if (isApproved && profile?.id) await fetchMyVideos(profile.id);
        else if (user && session?.access_token) await fetchPurchases();
        break;
      case VIEWS.PENDING_DELIVERIES:
        await fetchPendingDeliveries();
        break;
      case VIEWS.DASHBOARD:
        if (session?.access_token && user) await fetchVendorDashboard({ reconcile: true, silent: false });
        break;
      case VIEWS.VENDOR_REQUEST:
        if (isApproved && session?.access_token && user) {
          await Promise.all([
            fetchVendorDashboard({ reconcile: false, silent: true }),
            fetchMyWithdrawals(),
          ]);
          if (profile?.id) {
            await Promise.all([
              fetchPhotographerProfile(profile.id),
              fetchPosts(profile.id),
              fetchMyVideos(profile.id),
            ]);
          }
        }
        if (isLoggedIn && session) await fetchAllSubscriptions();
        break;
      case VIEWS.NOTIFICATIONS:
        await fetchNotifications();
        break;
      case VIEWS.PHOTOGRAPHER_PROFILE:
        if (selectedPhotographer?.id) await fetchPhotographerProfile(selectedPhotographer.id);
        break;
      case VIEWS.ADMIN:
        if (isStaff && session) {
          await fetchVendorRequests();
          await fetchAdminWithdrawals();
          if (isCEO) await fetchAdminPhotographers();
        }
        break;
      case VIEWS.CEO_PAYROLL:
        if (isCEO && session) {
          await fetchCeoPayroll();
          await fetchCeoAdmins();
        }
        break;
      case VIEWS.UPLOAD:
      case VIEWS.UPLOAD_VIDEO:
        if (profile?.id) await fetchMyVideos(profile.id);
        await fetchPendingDeliveryCount();
        break;
      case VIEWS.GALLERY:
      case VIEWS.DETAIL:
        await fetchPhotos();
        break;
      default:
        await Promise.all([fetchPhotos(), fetchPhotographers()]);
        break;
    }
  }, [
    view,
    videoSearchQuery,
    user,
    session,
    profile,
    isLoggedIn,
    isStaff,
    isCEO,
    selectedPhotographer?.id,
    fetchPendingDeliveries,
    fetchPendingDeliveryCount,
  ]);

  const pullToRefreshEnabled =
    !showPasswordReset &&
    payStep === 0 &&
    !confirmDialog &&
    !globalLoading.active &&
    ![VIEWS.AUTH, VIEWS.SUCCESS, VIEWS.RESET_PASSWORD].includes(view);

  const { pullDistance, refreshing: pullRefreshing } = usePullToRefresh({
    onRefresh: refreshCurrentView,
    enabled: pullToRefreshEnabled,
  });

  useEffect(() => {
    if (view === VIEWS.UPLOAD || view === VIEWS.UPLOAD_VIDEO) setUploadMediaTab("video");
  }, [view]);

  useEffect(() => {
    if (view === VIEWS.VIDEO_SEARCH) {
      setVideoSearchRan(false);
      setVideoSearchQuery("");
      handleVideoSearch("");
    }
  }, [view]);

  useEffect(() => {
    Object.values(videoRefs.current).forEach((el) => {
      if (el) el.muted = videoPreviewMuted;
    });
  }, [videoPreviewMuted]);

  const stopVideoPreview = (videoId) => {
    const videoEl = videoRefs.current[videoId];
    const handler = videoPreviewHandlers.current[videoId];
    if (videoEl && handler) {
      videoEl.removeEventListener("timeupdate", handler);
      delete videoPreviewHandlers.current[videoId];
    }
    if (videoEl) {
      videoEl.classList.remove("is-playing");
      videoEl.pause();
      videoEl.currentTime = 0;
    }
    playingVideos.current = playingVideos.current.filter((id) => id !== videoId);
    setVideoPreviewActive((prev) => ({ ...prev, [videoId]: false }));
    setVideoPreviewProgress((prev) => ({ ...prev, [videoId]: 0 }));
  };

  const startVideoPreview = (videoId, durationSeconds) => {
    const videoEl = videoRefs.current[videoId];
    if (!videoEl) return;
    if (playingVideos.current.length >= 3 && !playingVideos.current.includes(videoId)) {
      stopVideoPreview(playingVideos.current[0]);
    }
    if (!playingVideos.current.includes(videoId)) {
      playingVideos.current.push(videoId);
    }

    const onTimeUpdate = () => {
      const previewLimit = getVideoPreviewLimitSec(durationSeconds, videoEl);
      const progress = Math.min(videoEl.currentTime / previewLimit, 1);
      setVideoPreviewProgress((prev) => ({ ...prev, [videoId]: progress }));
      if (videoEl.currentTime >= previewLimit || videoEl.ended) {
        videoEl.pause();
        videoEl.currentTime = 0;
        setVideoPreviewProgress((prev) => ({ ...prev, [videoId]: 0 }));
      }
    };

    if (videoPreviewHandlers.current[videoId]) {
      videoEl.removeEventListener("timeupdate", videoPreviewHandlers.current[videoId]);
    }
    videoPreviewHandlers.current[videoId] = onTimeUpdate;
    videoEl.addEventListener("timeupdate", onTimeUpdate);
    videoEl.muted = videoPreviewMuted;
    videoEl.classList.add("is-playing");
    setVideoPreviewActive((prev) => ({ ...prev, [videoId]: true }));

    const beginPlay = () => {
      const el = videoRefs.current[videoId];
      if (!el) return;
      el.currentTime = 0;
      el.play().catch(() => {});
    };

    if (videoEl.readyState >= 2) {
      beginPlay();
    } else {
      const onReady = () => {
        videoEl.removeEventListener("loadeddata", onReady);
        beginPlay();
      };
      videoEl.addEventListener("loadeddata", onReady);
      if (videoEl.networkState === HTMLMediaElement.NETWORK_EMPTY) {
        videoEl.load();
      }
    }
  };

  const toggleVideoPreview = (videoId, durationSeconds) => {
    if (videoPreviewActive[videoId]) stopVideoPreview(videoId);
    else startVideoPreview(videoId, durationSeconds);
  };

  const toggleVideoPreviewMute = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setVideoPreviewMuted((prev) => !prev);
  };

  const markVideoMediaReady = useCallback((videoId) => {
    setVideoMediaReady((prev) => (prev[videoId] ? prev : { ...prev, [videoId]: true }));
  }, []);

  const pauseVideoOnFirstFrame = useCallback((videoEl) => {
    if (!videoEl || videoEl.classList.contains("is-playing")) return;
    const seekTo = Math.min(0.5, Math.max(0.05, (videoEl.duration || 1) * 0.05));
    const onSeeked = () => {
      videoEl.removeEventListener("seeked", onSeeked);
      if (!videoEl.classList.contains("is-playing")) videoEl.pause();
    };
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.currentTime = seekTo;
  }, []);

  const renderVideoCards = (videoList) => videoList.map((video) => {
    const durationLabel = formatVideoDuration(video.duration_seconds || videoDurationCache[video.id]);
    const isPreviewing = Boolean(videoPreviewActive[video.id]);
    const previewProgress = videoPreviewProgress[video.id] || 0;
    const posterSrc = video.thumbnail_url || null;
    const mediaReady = Boolean(videoMediaReady[video.id]);
    const showPlaceholder = !isPreviewing && !mediaReady;
    const previewLimit = video.duration_seconds || videoDurationCache[video.id];

    return (
      <div
        key={video.id}
        style={{ background: "var(--surface)", borderRadius: 12, overflow: "hidden", cursor: "pointer", border: "1px solid var(--border)" }}
      >
        <div
          className="video-card-media"
          style={{ position: "relative", paddingBottom: "56.25%", background: "#0a0a0a" }}
          onContextMenu={(e) => e.preventDefault()}
          {...(CAN_HOVER_VIDEO_PREVIEW ? {
            onMouseEnter: () => startVideoPreview(video.id, previewLimit),
            onMouseLeave: () => stopVideoPreview(video.id),
          } : {
            onTouchEnd: (e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleVideoPreview(video.id, previewLimit);
            },
          })}
        >
          <img
            src={VIDEO_CARD_PLACEHOLDER_URL}
            alt=""
            decoding="async"
            aria-hidden
            className={`video-card-static-banner${showPlaceholder ? "" : " is-hidden"}`}
          />
          <video
            ref={(el) => { videoRefs.current[video.id] = el; }}
            className={`video-card-preview${isPreviewing ? " is-playing" : ""}${mediaReady ? " is-ready" : ""}`}
            src={video.preview_url}
            muted={videoPreviewMuted}
            playsInline
            preload="auto"
            controls={false}
            controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              const dur = Math.round(el.duration);
              if (dur > 0) {
                setVideoDurationCache((prev) => (prev[video.id] === dur ? prev : { ...prev, [video.id]: dur }));
              }
            }}
            onLoadedData={(e) => {
              const el = e.currentTarget;
              if (!posterSrc) {
                pauseVideoOnFirstFrame(el);
                markVideoMediaReady(video.id);
              }
            }}
            onCanPlay={() => {
              if (!posterSrc) markVideoMediaReady(video.id);
            }}
          />
          {posterSrc && !isPreviewing && (
            <img
              src={posterSrc}
              alt=""
              decoding="async"
              className={`video-card-poster-cover${mediaReady ? " is-visible" : ""}`}
              onLoad={() => markVideoMediaReady(video.id)}
            />
          )}
          {!isPreviewing && mediaReady && (
            <div className="video-card-watermark">
              <WatermarkedVideoOverlay photographer={video.photographer?.name} />
            </div>
          )}
          <button
            type="button"
            aria-label={videoPreviewMuted ? "Activar sonido del preview" : "Silenciar preview"}
            aria-pressed={!videoPreviewMuted}
            onClick={toggleVideoPreviewMute}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              zIndex: 7,
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: videoPreviewMuted ? "none" : "1px solid rgba(255,107,0,0.55)",
              background: videoPreviewMuted ? "rgba(0,0,0,0.78)" : "rgba(255,107,0,0.92)",
              color: videoPreviewMuted ? "rgba(255,255,255,0.9)" : "#1a1008",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              padding: 0,
            }}
          >
            <AppIcon name={videoPreviewMuted ? "volumeOff" : "volume"} size={15} />
          </button>
          {durationLabel && (
            <div style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              zIndex: 4,
              background: "rgba(0,0,0,0.82)",
              color: "#fff",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
            >
              {durationLabel}
            </div>
          )}
          {isPreviewing && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, zIndex: 5, background: "rgba(255,255,255,0.2)" }}>
              <div style={{ width: `${previewProgress * 100}%`, height: "100%", background: "var(--orange)", transition: "width 0.08s linear" }} />
            </div>
          )}
        </div>
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {video.moto_brand && (
              <span className="tag active" style={{ fontSize: 11 }}>
                {video.moto_brand} {video.moto_model}
              </span>
            )}
            {video.moto_color && <span className="tag" style={{ fontSize: 11 }}>{video.moto_color}</span>}
            {video.sector && <span className="tag" style={{ fontSize: 11 }}><IconText icon="pin" size={10}>{video.sector}</IconText></span>}
            {video.event_time_start && <span className="tag" style={{ fontSize: 11 }}>{video.event_time_start}</span>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--orange)", fontWeight: 700, fontSize: 18 }}>Q{video.price}</span>
            <AppButton className="card-buy" onClick={() => handleBuyVideo(video)}>Comprar</AppButton>
          </div>
        </div>
      </div>
    );
  });

  useEffect(() => {
    if (view !== VIEWS.VENDOR_REQUEST && editMode) {
      setEditMode(false);
      showToast("Saliste sin guardar los cambios.");
    }
  }, [view]);

  useEffect(() => {
    if (!editMode || !profile) return;
    const { countryCode, localNumber } = parsePhoneNumber(profile.phone);
    setPhoneCountry(countryCode);
    setPhoneLocal(localNumber);
    setEditForm(prev => ({ ...prev, phone: localNumber }));
  }, [editMode, profile?.phone]);

  // ── Pending purchase after login ───────────────────────────
  useEffect(() => {
    if (user && pendingPurchase) {
      setSelected(pendingPurchase);
      setPayStep(1);
      setPendingPurchase(null);
      setView(VIEWS.GALLERY);
    }
  }, [user, pendingPurchase]);

  // ── Recurrente return (web + APK) ──────────────────────────
  useEffect(() => {
    if (!authReady || !session) return;

    const params = new URLSearchParams(window.location.search);
    const paymentCancel =
      params.get("payment_cancel") === "true" || params.get("paypal_cancel") === "true";

    if (paymentCancel) {
      handlePaymentCancelled();
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    syncPendingPayments();
  }, [authReady, session, syncPendingPayments, handlePaymentCancelled]);

  useEffect(() => {
    if (!authReady || !session) return;
    return onNativePaymentResume((source) => {
      if (source === "browserCancelled" || source === "appUrlCancel") {
        handlePaymentCancelled();
        return;
      }

      const syncSources = new Set([
        "pageLoaded",
        "browserAfterReturn",
        "appUrlOpen",
        "launchUrl",
        "resume",
      ]);
      if (!readPendingPayment() && !syncSources.has(source)) return;
      const showLoading =
        source === "appUrlOpen" ||
        source === "launchUrl" ||
        source === "browserAfterReturn";
      syncPendingPayments({ silent: !showLoading });
    });
  }, [authReady, session, syncPendingPayments, handlePaymentCancelled]);

  const filteredPhotos = photos.filter(p => {
  if (searchTerm === "") return true;
  const term = searchTerm.toLowerCase();
  return (
    (p.photographer?.name || "").toLowerCase().includes(term) ||
    (p.location || "").toLowerCase().includes(term) ||
    (p.tags && p.tags.some(t => t.toLowerCase().includes(term)))
  );
  });

  // ── Handlers ───────────────────────────────────────────────
  const handleBuy = (photo) => {
    if (!user) { setPendingPurchase(photo); setMessage(""); setView(VIEWS.AUTH); return; }
    setSelectedVideo(null);
    setSelected(photo); setPayStep(1);
  };

  const handleBuyVideo = (video) => {
    if (!user) { setMessage(""); setView(VIEWS.AUTH); return; }
    setSelected(null);
    setSelectedVideo(video);
    setPayStep(1);
  };

  const handlePayment = async () => {
    if (!selected) return;
    setPayStep(2);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          photo_id: selected.id,
          return_url: buildPaymentReturnUrl({ photo_id: selected.id }),
          cancel_url: buildPaymentCancelUrl({ photo_id: selected.id }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando orden");
      writePendingPayment({
        kind: "photo",
        photoId: selected.id,
        checkoutId: data.checkout_id || data.order_id || null,
      });
      await openRecurrenteCheckout(data.approve_url || data.checkout_url, () =>
        syncPendingPayments({ silent: true })
      );
      setPayStep(1);
    } catch (err) {
      console.error(err); setPayStep(1);       showToast(err.message || "No se pudo iniciar el pago.");
    }
  };

  const handleVideoPayment = async () => {
    if (!selectedVideo) return;
    setPayStep(2);
    try {
      const res = await fetch("/api/payments/create-video-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          video_id: selectedVideo.id,
          return_url: buildPaymentReturnUrl({ video_id: selectedVideo.id }),
          cancel_url: buildPaymentCancelUrl({ video_id: selectedVideo.id }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando orden");
      writePendingPayment({
        kind: "video",
        videoId: selectedVideo.id,
        checkoutId: data.checkout_id || data.order_id || null,
        provider: "recurrente",
      });
      await openRecurrenteCheckout(data.approve_url || data.checkout_url, () =>
        syncPendingPayments({ silent: true })
      );
      setPayStep(1);
    } catch (err) {
      console.error(err);
      setPayStep(1);
      showToast(err.message || "No se pudo iniciar el pago.");
    }
  };

  const handleVideoPayPalPayment = async () => {
    if (!selectedVideo) return;
    setPayStep(2);
    try {
      const res = await fetch("/api/payments/create-video-paypal-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          video_id: selectedVideo.id,
          return_url: buildPaymentReturnUrl({ video_id: selectedVideo.id, paypal_return: "true" }),
          cancel_url: buildPaymentCancelUrl({ video_id: selectedVideo.id, paypal_cancel: "true" }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando orden PayPal");
      writePendingPayment({
        kind: "video",
        videoId: selectedVideo.id,
        orderId: data.order_id || data.paypal_order_id || null,
        provider: "paypal",
      });
      await openRecurrenteCheckout(data.approve_url, () =>
        syncPendingPayments({ silent: true })
      );
      setPayStep(1);
    } catch (err) {
      console.error(err);
      setPayStep(1);
      showToast(err.message || "No se pudo iniciar PayPal.");
    }
  };

  const handleVideoDownload = async () => {
    if (!selectedVideo?.id || !session?.access_token) return;
    try {
      const res = await fetch(`/api/videos/${selectedVideo.id}/download`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al descargar");
      if (data.status === "pending") {
        showToast(data.message || "El fotógrafo está preparando tu video.");
        return;
      }
      if (data.download_url) window.open(data.download_url, "_blank");
    } catch (err) {
      console.error(err);
      showToast("Error al descargar el video.");
    }
  };

  const handleDownload = async () => {
    if (!selected) return;
    if (!user || !session) {
      setPendingPurchase(selected);
      setMessage("");
      setView(VIEWS.AUTH);
      return;
    }
    try {
      const res = await fetch(`/api/downloads/${selected.id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Error descargando");
      const data = await res.json();
      window.open(data.download_url, "_blank");
    } catch (err) {
      console.error(err); setMessage("Error al descargar.");
    }
    setSuccessMode("purchase");
    setView(VIEWS.SUCCESS); setPayStep(0);
  };

  const handleLogin = async () => {
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
      if (error) throw error;
      setActiveTab("feed");
      setView(VIEWS.PHOTOGRAPHERS);
    } catch (err) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("email not confirmed")) {
        setShowUnconfirmedBanner(true);
      } else if (msg.toLowerCase().includes("invalid login credentials")) {
        showToast("Email o contraseña incorrectos.");
      } else if (msg.toLowerCase().includes("email")) {
        showToast("El email ingresado no existe.");
      } else {
        showToast("Error al iniciar sesión. Intentá de nuevo.");
      }
    }
  };

  const handleSignUp = async () => {
    if (authSubmittingRef.current || authSubmitting) return;
    setMessage("");
    const name = (authForm.name ?? "").trim();
    if (!name) {
      showToast("Ingresá tu nombre para continuar.");
      return;
    }
    if (isLikelyDisposableEmail(authForm.email)) {
      showToast("Los correos temporales (como @wshu.net) no reciben nuestros emails. Usá Gmail u Outlook.");
      return;
    }

    authSubmittingRef.current = true;
    const startedAt = Date.now();
    flushSync(() => {
      setAuthSubmitting(true);
      setGlobalLoading({ active: true, message: "Creando tu cuenta y enviando correo..." });
    });
    await waitForNextPaint();

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password,
          name,
          redirectTo: getEmailConfirmRedirectUrl(),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 || data.code === "EMAIL_EXISTS") {
        setShowUnconfirmedBanner(false);
        setEmailAlreadyExists(true);
        return;
      }

      const registrationOk =
        res.ok &&
        data.success !== false &&
        (data.confirmationSent === true || data.alreadySent === true || data.success === true);

      if (!registrationOk) {
        throw new Error(translateAuthError(data.error) || "Error al registrar.");
      }

      const remaining = MIN_AUTH_LOADING_MS - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

      setPendingEmailConfirmation();
      setMessage("");
      setShowEmailConfirm(true);
    } catch (err) {
      showToast(translateAuthError(err.message) || "Error al registrar.");
    } finally {
      authSubmittingRef.current = false;
      setAuthSubmitting(false);
      setGlobalLoading({ active: false, message: "" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setSession(null);
    setActiveTab("feed");
    setView(VIEWS.PHOTOGRAPHERS);
  };

  const handleRequestVendor = async () => {
    if (!user) { setView(VIEWS.AUTH); return; }
    try {
      setGlobalLoading({ active: true, message: "Enviando solicitud..." });
  
      // Subir fotos del documento a Supabase Storage
      let doc_front_url = null;
      let doc_back_url = null;
  
      if (vendorForm.doc_front) {
        const frontPath = `verification/${user.id}/doc_front.${vendorForm.doc_front.name.split(".").pop()}`;
        const { error: frontError } = await supabase.storage
          .from("avatars")
          .upload(frontPath, vendorForm.doc_front, { upsert: true });
        if (frontError) throw new Error("Error subiendo foto frontal: " + frontError.message);
        const { data: frontUrl } = supabase.storage.from("avatars").getPublicUrl(frontPath);
        doc_front_url = frontUrl.publicUrl;
      }
  
      if (vendorForm.doc_back) {
        const backPath = `verification/${user.id}/doc_back.${vendorForm.doc_back.name.split(".").pop()}`;
        const { error: backError } = await supabase.storage
          .from("avatars")
          .upload(backPath, vendorForm.doc_back, { upsert: true });
        if (backError) throw new Error("Error subiendo foto posterior: " + backError.message);
        const { data: backUrl } = supabase.storage.from("avatars").getPublicUrl(backPath);
        doc_back_url = backUrl.publicUrl;
      }
  
      const res = await fetch("/api/auth/request-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          name: vendorForm.name,
          handle: vendorForm.handle,
          verification_id: `[${vendorForm.doc_type.toUpperCase()}] ${vendorForm.verification_id}`,
          bio: vendorForm.bio,
          doc_front_url,
          doc_back_url,
        }),
      });
  
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setProfile(data.photographer);
      showToast("Listo: Solicitud enviada. Esperá la aprobación.");
      setView(VIEWS.PHOTOGRAPHERS);
    } catch (err) {
      showToast(err.message);
    } finally {
      setGlobalLoading({ active: false, message: "" });
    }
  };

  const revokeUploadPreview = (item) => {
    if (item?.url) URL.revokeObjectURL(item.url);
  };

  const addUploadFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    if (picked.length === 0) return;
    setUploadFiles((prev) => {
      const existing = new Set(prev.map((item) => `${item.file.name}|${item.file.size}|${item.file.lastModified}`));
      const next = [...prev];
      picked.forEach((file) => {
        const key = `${file.name}|${file.size}|${file.lastModified}`;
        if (existing.has(key)) return;
        existing.add(key);
        next.push({
          id: `${key}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          url: URL.createObjectURL(file),
          tags: "",
        });
      });
      return next;
    });
    setUploadProgress({});
  };

  const removeUploadFile = (id) => {
    if (uploadLoading) return;
    setUploadFiles((prev) => {
      const item = prev.find((entry) => entry.id === id);
      revokeUploadPreview(item);
      return prev.filter((entry) => entry.id !== id);
    });
  };

  const clearUploadFiles = () => {
    if (uploadLoading) return;
    uploadFiles.forEach(revokeUploadPreview);
    setUploadFiles([]);
    setUploadProgress({});
    const input = document.getElementById("photo-input");
    if (input) input.value = "";
  };

  const handleUploadPhoto = async () => {
    if (uploadFiles.length === 0) return setMessage("Seleccioná al menos una foto.");
    if (!uploadForm.location || !uploadForm.ride_date || !uploadForm.price)
      return setMessage("Ubicación, fecha y precio son obligatorios.");
  
    setUploadLoading(true);
    setGlobalLoading({ active: true, message: `Subiendo ${uploadFiles.length} foto(s)...` });
    setMessage("");
  
    const initialProgress = {};
    uploadFiles.forEach(f => { initialProgress[f.file.name] = "pending"; });
  
    const results = await Promise.allSettled(
      uploadFiles.map(async ({ file, tags }) => {
        setUploadProgress(prev => ({ ...prev, [file.name]: "uploading" }));
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("location", uploadForm.location);
        formData.append("ride_date", uploadForm.ride_date);
        formData.append("price", uploadForm.price);
        formData.append("tags", tags || uploadForm.tags || "");
        formData.append("time_start", uploadForm.time_start || "");
        formData.append("time_end", uploadForm.time_end || "");
        formData.append("album_id", uploadForm.album_id || "");
  
        const res = await fetch(apiUrl("/api/photos/upload"), {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || "Error");
        setUploadProgress(prev => ({ ...prev, [file.name]: "done" }));
      })
    );
  
    const failed = results.filter(r => r.status === "rejected").length;
    const succeeded = results.filter(r => r.status === "fulfilled").length;
  
    if (succeeded > 0) {
      showToast("Listo: Fotos publicadas exitosamente.");
      fetchPhotos();
      setTimeout(() => {
        uploadFiles.forEach(revokeUploadPreview);
        setUploadFiles([]);
        setUploadProgress({});
        setUploadForm({ location: "", ride_date: "", price: "", tags: "", time_start: "", time_end: "", album_id: "" });
        const input = document.getElementById("photo-input");
        if (input) input.value = "";
      }, 3000);
    }
    if (failed > 0) setMessage(`${failed} foto(s) no se pudieron subir.`);
    setUploadLoading(false);
    setGlobalLoading({ active: false, message: "" });
  };

  const getUserDisplayName = () => {
    if (!user) return "";
    return profile?.name || user.user_metadata?.name || user.email;
  };

  // ── Renders ────────────────────────────────────────────────
  const renderHero = () => (
    <div className="hero">
      <MotoShotBrandMark variant="hero" className="hero-title" />
      <div className="hero-sub">Comprá fotos de rodada con Recurrente · Alta resolución garantizada</div>
      {isLoggedIn ? (
        <div style={{ marginTop: 12, color: "var(--text)", display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", fontSize: 14 }}>
          <span>Bienvenido, {getUserDisplayName()}</span>
        </div>
      ) : (
        <div style={{ marginTop: 12, color: "var(--muted)" }}>Iniciá sesión para comprar fotos.</div>
      )}
    </div>
  );

  const renderGallery = () => (
    <div>
      {renderHero()}
        <div className="search-bar">
         <input
      className="search-input"
      placeholder="Buscar por fotógrafo, ubicación o marca (ej: Kawasaki)..."
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
         />
      </div>
      {loading ? (
        <div className="empty"><LoaderIcon size={44} /><div>Cargando fotos...</div></div>
      ) : filteredPhotos.length === 0 ? (
        <div className="empty"><EmptyIcon name="camera" /><div>No hay fotos disponibles</div></div>
      ) : (
        <div className="grid">
          {filteredPhotos.map(photo => (
            <div key={photo.id} className="card" onClick={() => openPhotoDetail(photo, VIEWS.GALLERY)}>
              {purchased.includes(photo.id) && <div className="card-bought-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="check" size={12} color="#000" /> Comprada</div>}
              {isCEO && !purchased.includes(photo.id) && <div className="card-ceo-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="check" size={12} color="#000" /> CEO · HD</div>}
              {user && photo.photographer?.user_id === user?.id && (
            <AppButton
            style={{
              position: "absolute", top: 10, right: 10, zIndex: 6,
              background: "rgba(220,50,50,0.85)", border: "none",
              color: "#fff", borderRadius: 6, padding: "4px 10px",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
    }}
              onClick={e => {
              e.stopPropagation();
      openConfirmDialog({
        title: "ELIMINAR FOTO",
        message: "¿Eliminar esta foto? Esta acción no se puede deshacer.",
        confirmLabel: "SÍ, ELIMINAR",
        cancelLabel: "NO",
        destructive: true,
        onConfirm: async () => {
          const res = await fetch(`/api/photos/${photo.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          if (res.ok) fetchPhotos();
        },
      });
          }}
         >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="trash" size={14} /> Eliminar</span>
            </AppButton>
              )}
              <div className="card-photo-badge">{photo.photographer?.name || "MOTOSHOT"}</div>
              <WatermarkedImage src={photo.watermark_url} photographer={photo.photographer?.name || "MOTOSHOT"} purchased={canDownloadPhoto(photo)} />
              <div className="card-overlay">
                <div className="card-photographer">{photo.photographer?.name || "MOTOSHOT"}</div>
                <div className="card-location"><IconText icon="pin" size={12}>{photo.location}</IconText></div>
            <div className="card-footer">
            <div className="card-price">Q{photo.price}</div>
            { !canDownloadPhoto(photo) ? (
            <AppButton
            className="card-buy"
            onClick={e => { e.stopPropagation(); handleBuy(photo); }}
          >
            Comprar
          </AppButton>
  ) : (
    <AppButton
      className="card-buy card-buy-download"
      onClick={e => {
        e.stopPropagation();
        setSelected(photo);
        setSuccessMode("purchase");
        setView(VIEWS.SUCCESS);
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="arrowRight" size={12} style={{ transform: "rotate(90deg)" }} /> Descargar</span>
    </AppButton>
  )}
              </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  const renderAdmin = () => {
    if (!isStaff) {
      return (
        <div className="upload-view">
          <div className="empty"><EmptyIcon size={44} /><div>Acceso restringido.</div></div>
        </div>
      );
    }
    return (
  <div className={`upload-view admin-panel${isCEO ? " admin-panel-ceo" : " admin-panel-staff"}`}>
    <div className={`admin-panel-badge${isCEO ? " admin-panel-badge-ceo" : " admin-panel-badge-admin"}`}>
      {isCEO ? "CEO" : "ADMIN"}
    </div>
    <SectionTitleIcon icon="admin">{isCEO ? "PANEL CEO" : "PANEL ADMIN"}</SectionTitleIcon>
    <div className="section-sub">
      {isCEO
        ? "Control total de MotoShot GT — verificación, perfiles y operaciones."
        : "Gestión de solicitudes, anuncios y retiros."}
    </div>

    {isCEO && (
      <>
        <div className="admin-section-title admin-section-title-ceo">EQUIPO ADMINISTRATIVO</div>
        <div className="section-sub" style={{ marginTop: -16, marginBottom: 16 }}>
          Asigná o revocá permisos de administrador a cuentas registradas en la app.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 200 }}
            type="email"
            placeholder="correo@ejemplo.com"
            value={grantAdminEmail}
            onChange={(e) => setGrantAdminEmail(e.target.value)}
          />
          <AppButton className="nav-btn primary" style={{ fontSize: 12, whiteSpace: "nowrap" }} onClick={handleGrantAdmin}>
            Asignar admin
          </AppButton>
        </div>
        <AppButton className="nav-btn" style={{ marginBottom: 12, fontSize: 12 }} onClick={fetchCeoAdmins}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <AppIcon name="refresh" size={14} />
            {ceoAdminsLoading ? "Cargando..." : "Actualizar lista"}
          </span>
        </AppButton>
        {ceoAdminsLoading && ceoAdmins.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 28 }}><LoaderIcon size={18} /> Cargando...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {ceoAdmins.map((adm) => (
              <div key={adm.email} className="admin-request-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{adm.email}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{adm.label || adm.source}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`admin-status-pill${adm.active ? " admin-status-approved" : " admin-status-suspended"}`}>
                      {adm.active ? "Activo" : "Revocado"}
                    </span>
                    {adm.canRevoke && adm.active && (
                      <AppButton
                        className="nav-btn"
                        style={{ fontSize: 11, color: "#ff6b6b", borderColor: "rgba(255,107,107,0.4)" }}
                        onClick={() => handleRevokeAdmin(adm.email)}
                      >
                        Revocar
                      </AppButton>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}

    <div className="admin-section-title">SOLICITUDES DE FOTÓGRAFO</div>
    <AppButton className="nav-btn" style={{ marginBottom: 12, fontSize: 12 }} onClick={fetchVendorRequests}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <AppIcon name="refresh" size={14} />
        {vendorRequestsLoading ? "Cargando..." : "Actualizar solicitudes"}
      </span>
    </AppButton>
    {vendorRequestsLoading && vendorRequests.length === 0 ? (
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 28 }}><LoaderIcon size={18} /> Cargando...</div>
    ) : vendorRequests.length === 0 ? (
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 28 }}>No hay solicitudes pendientes.</div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {vendorRequests.map((req) => (
          <div key={req.id} className="admin-request-card">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
                {req.avatar_url
                  ? <img src={req.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ display: "grid", placeItems: "center", height: "100%" }}><AvatarPlaceholder size={22} /></div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{req.name}</div>
                <div style={{ fontSize: 12, color: "var(--orange)", marginBottom: 4 }}>{req.handle}</div>
                {req.bio && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{req.bio}</div>}
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  ID verificación: <span style={{ color: "var(--text)" }}>{req.verification_id || "—"}</span>
                  {" · "}{new Date(req.created_at).toLocaleString("es-GT")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <AppButton
                    className="nav-btn"
                    style={{ fontSize: 11, padding: "6px 12px", opacity: req.doc_front_url ? 1 : 0.45 }}
                    disabled={!req.doc_front_url}
                    onClick={() => openAdminVerificationDoc(req.doc_front_url, "Documento frontal")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <AppIcon name="image" size={12} /> Ver frontal
                    </span>
                  </AppButton>
                  <AppButton
                    className="nav-btn"
                    style={{ fontSize: 11, padding: "6px 12px", opacity: req.doc_back_url ? 1 : 0.45 }}
                    disabled={!req.doc_back_url}
                    onClick={() => openAdminVerificationDoc(req.doc_back_url, "Documento posterior")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <AppIcon name="image" size={12} /> Ver posterior
                    </span>
                  </AppButton>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <AppButton
                className="nav-btn"
                style={{ fontSize: 12, color: "var(--muted)", borderColor: "var(--border)" }}
                onClick={() => handleVendorVerification(req.id, "rejected")}
              >
                Rechazar
              </AppButton>
              <AppButton
                className="nav-btn primary"
                style={{ fontSize: 12 }}
                onClick={() => handleVendorVerification(req.id, "approved")}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <AppIcon name="check" size={12} color="#fff" /> Aprobar
                </span>
              </AppButton>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Anuncios */}
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, marginBottom: 12 }}>ANUNCIOS GLOBALES</div>

    <div className="form-group">
      <label className="form-label">Título</label>
      <input className="form-input" value={announcementForm.title}
        onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
        placeholder="Ej: ¡Nuevo fotógrafo verificado!" />
    </div>
    <div className="form-group">
      <label className="form-label">Mensaje</label>
      <textarea
        className="form-input"
        rows={4}
        value={announcementForm.body}
        onChange={e => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
        placeholder="Descripción del anuncio..."
        style={{ resize: "vertical", lineHeight: 1.6, minHeight: 96 }}
      />
    </div>
    <div className="form-group">
      <label className="form-label">URL de imagen (opcional)</label>
      <input className="form-input" value={announcementForm.image_url}
        onChange={e => setAnnouncementForm({ ...announcementForm, image_url: e.target.value })}
        placeholder="https://..." />
    </div>
    <AppButton className="upload-btn" style={{ marginBottom: 24 }} onClick={async () => {
      const res = await fetch("/api/auth/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(announcementForm),
      });
      if (res.ok) {
        setAnnouncementForm({ title: "", body: "", image_url: "" });
        fetchAnnouncements();
      }
    }}>
      PUBLICAR ANUNCIO
    </AppButton>

    {/* Lista de anuncios activos */}
    {announcements.length > 0 && (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {announcements.map(a => (
          <div key={a.id} style={{ padding: 14, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{a.title}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{a.body}</div>
            <AppButton className="nav-btn" style={{ fontSize: 11, color: "red", borderColor: "red" }}
              onClick={async () => {
                await fetch(`/api/auth/announcements/${a.id}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${session?.access_token}` },
                });
                fetchAnnouncements();
              }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="trash" size={14} /> Eliminar</span>
            </AppButton>
          </div>
        ))}
      </div>
    )}
  {/* Retiros pendientes */}
<div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, marginBottom: 12 }}>
  SOLICITUDES DE RETIRO
</div>
<AppButton className="nav-btn" style={{ marginBottom: 16, fontSize: 12 }} onClick={fetchAdminWithdrawals}>
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="refresh" size={14} /> Cargar solicitudes</span>
</AppButton>
{adminWithdrawals.length === 0 ? (
  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 32 }}>No hay solicitudes aún.</div>
) : (
  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
    {adminWithdrawals.map(w => (
      <div key={w.id} style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: `1px solid ${w.status === "pending" ? "var(--orange)" : "var(--border)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "var(--card)" }}>
              {w.photographer?.avatar_url
                ? <img src={w.photographer.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ display: "grid", placeItems: "center", height: "100%" }}><AvatarPlaceholder size={20} /></div>}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{w.photographer?.name}</div>
              <div style={{ fontSize: 12, color: "var(--orange)" }}>{w.photographer?.handle}</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "var(--success)" }}>
            Q{Number(w.amount).toFixed(2)}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {new Date(w.created_at).toLocaleString("es-GT")}
            {w.processed_at && ` · Pagado: ${new Date(w.processed_at).toLocaleDateString("es-GT")}`}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              background: w.status === "paid" ? "rgba(255,107,0,0.12)" : w.status === "pending" ? "rgba(255,107,0,0.12)" : "rgba(100,100,100,0.12)",
              color: w.status === "paid" ? "var(--success)" : w.status === "pending" ? "var(--orange)" : "var(--muted)",
            }}>
              {w.status === "paid" ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="check" size={12} color="var(--success)" /> Pagado</span>) : w.status === "pending" ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><LoaderIcon size={14} /> Pendiente</span>) : "Cancelado"}
            </span>
            {w.status === "pending" && (
              <AppButton
                onClick={() => {
                  openConfirmDialog({
                    title: "MARCAR COMO PAGADO",
                    message: `¿Marcar como pagado Q${Number(w.amount).toFixed(2)} a ${w.photographer?.name}?`,
                    confirmLabel: "SÍ, CONFIRMAR",
                    cancelLabel: "NO",
                    onConfirm: async () => {
                      const res = await fetch(`/api/auth/withdrawals/${w.id}/pay`, {
                        method: "PUT",
                        headers: { Authorization: `Bearer ${session?.access_token}` }
                      });
                      if (res.ok) { showToast("Listo: Marcado como pagado."); fetchAdminWithdrawals(); }
                    },
                  });
                }}
                style={{ background: "rgba(255,107,0,0.1)", border: "1px solid var(--success)", color: "var(--success)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="check" size={12} color="var(--success)" /> Marcar pagado</span>
              </AppButton>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
)}
    {isCEO && (
      <>
        <div className="admin-section-title admin-section-title-ceo">GESTIÓN DE PERFILES</div>
        <AppButton className="nav-btn" style={{ marginBottom: 12, fontSize: 12 }} onClick={fetchAdminPhotographers}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <AppIcon name="refresh" size={14} />
            {adminPhotographersLoading ? "Cargando..." : "Actualizar perfiles"}
          </span>
        </AppButton>
        {adminPhotographersLoading && adminPhotographers.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 28 }}><LoaderIcon size={18} /> Cargando...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
            {adminPhotographers.map((ph) => (
              <div key={ph.id} className={`admin-profile-card${ph.active ? "" : " admin-profile-card-suspended"}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
                      {ph.avatar_url
                        ? <img src={ph.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ display: "grid", placeItems: "center", height: "100%" }}><AvatarPlaceholder size={20} /></div>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{ph.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{ph.handle}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span className={`admin-status-pill admin-status-${ph.verification_status || "pending"}`}>
                      {ph.verification_status || "pending"}
                    </span>
                    {!ph.active && <span className="admin-status-pill admin-status-suspended">suspendido</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {ph.verification_status === "pending" && (
                    <>
                      <AppButton className="nav-btn" style={{ fontSize: 11 }} onClick={() => handleVendorVerification(ph.id, "rejected")}>Rechazar</AppButton>
                      <AppButton className="nav-btn primary" style={{ fontSize: 11 }} onClick={() => handleVendorVerification(ph.id, "approved")}>Aprobar</AppButton>
                    </>
                  )}
                  {ph.verification_status === "approved" && (
                    <AppButton
                      className="nav-btn"
                      style={{ fontSize: 11, color: ph.active ? "#ff6b6b" : "var(--success)", borderColor: ph.active ? "rgba(255,107,107,0.4)" : "var(--success)" }}
                      onClick={() => handlePhotographerActive(ph.id, !ph.active)}
                    >
                      {ph.active ? "Suspender" : "Reactivar"}
                    </AppButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}

    {/* Fotógrafos — destacar */}
    <div className="admin-section-title">FOTÓGRAFOS DESTACADOS</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {photographers.map(ph => (
        <div key={ph.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, background: "var(--surface)", border: `1px solid ${ph.featured ? "var(--orange)" : "var(--border)"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "var(--card)" }}>
              {ph.avatar_url ? <img src={ph.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "grid", placeItems: "center", height: "100%" }}><AvatarPlaceholder size={20} /></div>}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{ph.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{ph.handle}</div>
            </div>
          </div>
          <AppButton className={`nav-btn${ph.featured ? " primary" : ""}`}
            onClick={async () => {
              const res = await fetch(`/api/auth/photographers/${ph.id}/feature`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
                body: JSON.stringify({ featured: !ph.featured }),
              });
              if (res.ok) fetchPhotographers();
            }}>
            {ph.featured ? (<IconText icon="star" size={12}>Destacado</IconText>) : "Destacar"}
          </AppButton>
        </div>
      ))}
    </div>
  </div>
    );
  };

  const renderCeoPayroll = () => {
    if (!isCEO) {
      return (
        <div className="upload-view">
          <div className="empty"><EmptyIcon size={44} /><div>Acceso restringido.</div></div>
        </div>
      );
    }
    const totals = payrollData?.totals;
    return (
      <div className="upload-view admin-panel admin-panel-ceo ceo-payroll-view">
        <div className="admin-panel-badge admin-panel-badge-ceo">CEO</div>
        <SectionTitleIcon icon="payroll">PLANILLA SEMANAL</SectionTitleIcon>
        <div className="section-sub">
          Pagos semanales a fotógrafos: ventas de la semana, retiros pendientes y cuentas bancarias.
        </div>
        {payrollData?.week_label && (
          <div className="ceo-payroll-week">{payrollData.week_label}</div>
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <AppButton className="nav-btn" style={{ fontSize: 12 }} onClick={fetchCeoPayroll}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <AppIcon name="refresh" size={14} />
              {payrollLoading ? "Cargando..." : "Actualizar"}
            </span>
          </AppButton>
          <AppButton className="nav-btn primary" style={{ fontSize: 12 }} onClick={exportPayrollCsv} disabled={!payrollData?.rows?.length}>
            Exportar CSV
          </AppButton>
        </div>
        {totals && (
          <div className="ceo-payroll-totals">
            <div className="ceo-payroll-stat">
              <span className="ceo-payroll-stat-label">Fotógrafos</span>
              <span className="ceo-payroll-stat-value">{totals.photographers}</span>
            </div>
            <div className="ceo-payroll-stat">
              <span className="ceo-payroll-stat-label">Ventas semana</span>
              <span className="ceo-payroll-stat-value">Q{Number(totals.weekly_sales).toFixed(2)}</span>
            </div>
            <div className="ceo-payroll-stat">
              <span className="ceo-payroll-stat-label">A pagar (retiros)</span>
              <span className="ceo-payroll-stat-value ceo-payroll-stat-highlight">Q{Number(totals.pending_payouts).toFixed(2)}</span>
            </div>
          </div>
        )}
        {payrollLoading && !payrollData ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}><LoaderIcon size={18} /> Cargando planilla...</div>
        ) : !payrollData?.rows?.length ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>No hay pagos pendientes ni actividad relevante esta semana.</div>
        ) : (
          <div className="ceo-payroll-table-wrap">
            <table className="ceo-payroll-table">
              <thead>
                <tr>
                  <th>Fotógrafo</th>
                  <th>Ventas</th>
                  <th>A pagar</th>
                  <th>Banco</th>
                </tr>
              </thead>
              <tbody>
                {payrollData.rows.map((row) => (
                  <tr key={row.photographer_id}>
                    <td>
                      <div className="ceo-payroll-name">{row.name}</div>
                      <div className="ceo-payroll-meta">{row.handle}</div>
                      {row.email && <div className="ceo-payroll-meta">{row.email}</div>}
                    </td>
                    <td>Q{Number(row.weekly_sales).toFixed(2)}</td>
                    <td className={row.amount_to_pay > 0 ? "ceo-payroll-pay" : ""}>
                      Q{Number(row.amount_to_pay).toFixed(2)}
                      {row.pending_withdrawal && (
                        <div className="ceo-payroll-meta">Solicitado {new Date(row.pending_withdrawal.created_at).toLocaleDateString("es-GT")}</div>
                      )}
                    </td>
                    <td className="ceo-payroll-bank">{row.bank_account || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

const discoveryTerm = searchQuery.trim().toLowerCase();
const filteredPhotographers = discoveryTerm
  ? photographers.filter(ph =>
      (ph.name || "").toLowerCase().includes(discoveryTerm) ||
      (ph.handle || "").toLowerCase().includes(discoveryTerm)
    )
  : photographers;
const hasDiscoveryQuery = discoveryTerm.length > 0;

const MATCH_REASON_LABELS = {
  location: "Lugar",
  tag: "Modelo / tag",
  photographer: "Fotógrafo",
};

const clearDiscoverySearch = () => {
  setSearchQuery("");
  setSearchMode(false);
  setUnifiedSearch({ photographers: [], photos: [] });
};

const runDiscoverySearch = async () => {
  const term = searchQuery.trim();
  if (!term) return;
  setSearchMode(true);
  setSearchLoading(true);
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error en búsqueda");
    setUnifiedSearch({
      photographers: data.photographers || [],
      photos: data.photos || [],
    });
  } catch (err) {
    console.error(err);
    showToast("No se pudo completar la búsqueda.");
    setUnifiedSearch({ photographers: [], photos: [] });
  } finally {
    setSearchLoading(false);
  }
};

const openPhotographerResult = (ph) => {
  if (user && ph.user_id === user.id) {
    setView(VIEWS.VENDOR_REQUEST);
    setActiveTab("profile");
    return;
  }
  fetchPhotographerProfile(ph.id);
  setView(VIEWS.PHOTOGRAPHER_PROFILE);
};

const openPhotoDetail = (photo, returnView) => {
  setSelected(photo);
  setDetailReturnView(returnView ?? view);
  setView(VIEWS.DETAIL);
};

const openPhotoSearchResult = (photo) => {
  openPhotoDetail(photo, VIEWS.PHOTOGRAPHERS);
};

const openPhotographerFromPhoto = (photo, e) => {
  e?.stopPropagation();
  if (!photo?.photographer?.id) return;
  fetchPhotographerProfile(photo.photographer.id);
  setView(VIEWS.PHOTOGRAPHER_PROFILE);
};

const renderPhotographers = () => (
  <div style={{ paddingBottom: 100 }}>
    {/* Hero */}
{/* Hero: STATICBANNER tapa el play nativo hasta que el video reproduce (web + APK) */}
<div style={{ position: "relative", width: "100%", height: 320, overflow: "hidden", background: "#0a0a0a" }}>
  <video
    ref={heroVideoRef}
    className="hero-video-bg"
    autoPlay
    muted
    loop
    playsInline
    preload="auto"
    disablePictureInPicture
    controls={false}
    onLoadedData={() => setHeroVideoReady(true)}
    onCanPlay={() => setHeroVideoReady(true)}
    onPlaying={() => setHeroVideoReady(true)}
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "130%",
      objectFit: "cover",
      top: "-15%",
      transform: `translateY(${heroScrollY * 0.5}px)`,
      willChange: "transform",
      zIndex: 0,
      opacity: heroVideoReady ? 1 : 0,
      transition: "opacity 0.45s ease",
      pointerEvents: "none",
    }}
    src={HERO_VIDEO_URL}
  />
  <img
    src={HERO_POSTER_URL}
    alt=""
    decoding="async"
    fetchPriority="high"
    aria-hidden
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      zIndex: 1,
      opacity: heroVideoReady ? 0 : 1,
      transition: "opacity 0.45s ease",
      pointerEvents: "none",
    }}
  />
<div style={{ position: "absolute", inset: 0, zIndex: 2, background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.65) 100%)" }} />
<div style={{ position: "relative", zIndex: 3, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", textAlign: "center" }}>
    
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <MotoShotBrandMark variant="hero-video" className="hero-title" />
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, marginTop: 10, fontWeight: 300 }}
    >
      Encontrá al fotógrafo de tu rodada · Comprá tus fotos y videos acá
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
    >
      {isLoggedIn ? (
        <div style={{ marginTop: 12, color: "#fff", fontSize: 14 }}>
          Bienvenido, {getUserDisplayName()}
        </div>
      ) : (
        <AppButton
          className="nav-btn primary"
          style={{ marginTop: 16 }}
          onClick={() => setView(VIEWS.AUTH)}
        >
          Iniciá sesión para comprar fotos y videos
        </AppButton>
      )}
    </motion.div>

  </div>
</div>

    {/* Anuncios */}
    {announcements.length > 0 && (
      <div style={{ padding: "16px 20px 0" }}>
        {announcements.map(a => (
          <div key={a.id} style={{
            background: "linear-gradient(135deg, rgba(255,107,0,0.12), rgba(255,107,0,0.04))",
            border: "1px solid var(--orange)", borderRadius: 12,
            padding: "14px 16px", marginBottom: 10,
            display: "flex", gap: 12, alignItems: "flex-start"
          }}>
            <AppIcon name="megaphone" size={20} color="var(--orange)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--orange)", marginBottom: 4 }}>{a.title}</div>
              {a.body && <div style={{ fontSize: 13, color: "var(--muted)" }}>{a.body}</div>}
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Suscripciones activas */}
    {user && mySubscriptions.length > 0 && (
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><AppIcon name="star" size={18} color="var(--orange)" /> TUS SUSCRIPCIONES</span>
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 8 }}>
          {mySubscriptions.map(sub => (
            <div key={sub.id}
            onClick={() => {
              if (user && sub.photographer.user_id === user.id) {
                setView(VIEWS.VENDOR_REQUEST);
                setActiveTab("profile");
              } else {
                fetchPhotographerProfile(sub.photographer.id);
                setView(VIEWS.PHOTOGRAPHER_PROFILE);
              }
            }}
              style={{ flexShrink: 0, width: 120, cursor: "pointer", textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid var(--orange)", background: "var(--card)", margin: "0 auto 8px" }}>
                {sub.photographer.avatar_url
                  ? <img src={sub.photographer.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={24} /></div>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{sub.photographer.name}</div>
              <div style={{ fontSize: 11, color: "var(--orange)" }}>{sub.photographer.handle}</div>
              <div style={{ fontSize: 10, color: "var(--orange)", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontWeight: 700, letterSpacing: 0.4 }}><AppIcon name="star" size={10} color="var(--orange)" /> Suscrito</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Fotógrafos destacados */}
{photographers.filter(p => p.featured).length > 0 && (
  <div style={{ padding: "24px 20px 0" }}>
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 4 }}>
      DESTACADOS DE LA SEMANA
    </div>
    <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>Seleccionados por MotoShot GT</div>
    <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 8 }}>
      {photographers.filter(p => p.featured).map(ph => (
        <div key={ph.id}
        onClick={() => {
          if (user && ph.user_id === user.id) {
            setView(VIEWS.VENDOR_REQUEST);
            setActiveTab("profile");
          } else {
            fetchPhotographerProfile(ph.id);
            setView(VIEWS.PHOTOGRAPHER_PROFILE);
          }
        }}
          style={{ flexShrink: 0, width: 160, borderRadius: 12, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--orange)", cursor: "pointer" }}>
          <div style={{ height: 80, background: ph.banner_url ? "none" : "linear-gradient(135deg, #1a1a1a, #2a2a2a)", overflow: "hidden", position: "relative" }}>
            {ph.banner_url
              ? <img src={ph.banner_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--orange)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, opacity: 0.4 }}>MOTOSHOT</div>}
            <div style={{ position: "absolute", top: 6, right: 6, background: "var(--orange)", borderRadius: 10, padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#fff" }}><IconText icon="star" size={10} style={{ color: "#fff" }}>DESTACADO</IconText></div>
          </div>
          <div style={{ padding: "0 10px 10px", position: "relative" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--orange)", background: "var(--card)", marginTop: -20, marginBottom: 6 }}>
              {ph.avatar_url
                ? <img src={ph.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={16} /></div>}
            </div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{ph.name}</div>
            <div style={{ color: "var(--orange)", fontSize: 11 }}>{ph.handle}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="camera" size={12} /> {(ph.photos_count || 0) > 99 ? "+99" : (ph.photos_count || 0)} foto{ph.photos_count !== 1 ? "s" : ""}</span>
              {(ph.albums_count || 0) > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="folder" size={12} /> {ph.albums_count} álbum{ph.albums_count !== 1 ? "es" : ""}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

    {/* Búsqueda */}
    <div style={{ padding: "24px 20px 0" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 4 }}>
        BUSCAR
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>
        Un solo buscador: fotógrafo, modelo de moto (tags) o lugar de la rodada
      </div>

      <div style={{ position: "relative", marginBottom: 16, display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            className="search-input"
            placeholder="Ej: Juan, Honda CBR, Curva del Caminero…"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) clearDiscoverySearch();
            }}
            onKeyDown={e => { if (e.key === "Enter") runDiscoverySearch(); }}
          />
          {searchQuery && (
            <AppButton
              onClick={clearDiscoverySearch}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}
            >
              <AppIcon name="x" size={18} />
            </AppButton>
          )}
        </div>
        <AppButton
          className="nav-btn primary"
          style={{ flexShrink: 0, padding: "0 20px" }}
          onClick={runDiscoverySearch}
        >
          Buscar
        </AppButton>
      </div>

      {searchMode && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Resultados para <strong style={{ color: "var(--text)" }}>"{searchQuery}"</strong>
            </div>
            <AppButton
              onClick={clearDiscoverySearch}
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="x" size={14} /> Limpiar</span>
            </AppButton>
          </div>

          {searchLoading ? (
            <div className="empty"><LoaderIcon size={44} /><div>Buscando...</div></div>
          ) : unifiedSearch.photographers.length === 0 && unifiedSearch.photos.length === 0 ? (
            <div className="empty">
              <EmptyIcon name="search" />
              <div>No hay fotógrafos ni fotos que coincidan. Probá otro nombre, modelo o lugar.</div>
            </div>
          ) : (
            <>
              {unifiedSearch.photographers.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="search-results-heading">FOTÓGRAFOS</div>
                  {unifiedSearch.photographers.map(ph => (
                    <div
                      key={ph.id}
                      onClick={() => openPhotographerResult(ph)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 10, cursor: "pointer" }}
                    >
                      <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--orange)", background: "var(--card)", flexShrink: 0 }}>
                        {ph.avatar_url
                          ? <img src={ph.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={20} /></div>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{ph.name}</div>
                        <div style={{ color: "var(--orange)", fontSize: 13 }}>{ph.handle}</div>
                        {ph.bio && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{ph.bio}</div>}
                      </div>
                      <AppIcon name="arrowRight" size={20} color="var(--muted)" />
                    </div>
                  ))}
                </div>
              )}

              {unifiedSearch.photos.length > 0 && (
                <div>
                  <div className="search-results-heading">FOTOS</div>
                  <div className="photo-search-grid">
                    {unifiedSearch.photos.map(photo => (
                      <div
                        key={photo.id}
                        className="photo-search-card"
                        onClick={() => openPhotoSearchResult(photo)}
                      >
                        <div className="photo-search-thumb">
                          {photo.watermark_url
                            ? <img src={photo.watermark_url} alt="" />
                            : <div style={{ display: "grid", placeItems: "center", height: "100%" }}><AppIcon name="camera" size={28} color="var(--muted)" /></div>}
                        </div>
                        <div className="photo-search-body">
                          {photo.matchReasons?.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                              {photo.matchReasons.map((r) => (
                                <span key={r} className="photo-search-match">{MATCH_REASON_LABELS[r] || r}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: "var(--orange)", fontWeight: 700, marginBottom: 4 }}>
                            <IconText icon="pin" size={11}>{photo.location}</IconText>
                          </div>
                          {photo.tags?.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                              {photo.tags.slice(0, 4).map(t => (
                                <span key={t} className="photo-search-tag">{t}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {photo.photographer?.name || "Fotógrafo"}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--muted)" }}>{photo.photographer?.handle}</div>
                            </div>
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--success)", flexShrink: 0 }}>
                              Q{photo.price}
                            </div>
                          </div>
                          <AppButton
                            className="nav-btn"
                            style={{ width: "100%", marginTop: 10, fontSize: 11, padding: "8px 10px" }}
                            onClick={(e) => openPhotographerFromPhoto(photo, e)}
                          >
                            Ver fotógrafo
                          </AppButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!searchMode && (
        <>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 4, marginTop: 8 }}>
        FOTÓGRAFOS VERIFICADOS
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>Seleccioná un fotógrafo para ver su galería</div>
      {photographersLoading ? (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
    {[1,2,3,4,5,6].map(i => (
      <motion.div
        key={i}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
        style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div style={{ width: "100%", height: 110, background: "var(--card)" }} />
        <div style={{ padding: "0 14px 14px", position: "relative" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--card)", marginTop: -26, marginBottom: 8, border: "3px solid var(--border)" }} />
          <div style={{ height: 14, width: "60%", background: "var(--card)", borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 11, width: "40%", background: "var(--card)", borderRadius: 6, marginBottom: 12 }} />
          <div style={{ height: 10, width: "80%", background: "var(--card)", borderRadius: 6 }} />
        </div>
      </motion.div>
    ))}
  </div>
) : photographers.length === 0 ? (
        <div className="empty"><EmptyIcon name="camera" /><div>No hay fotógrafos verificados aún.</div></div>
      ) : hasDiscoveryQuery && !searchMode && filteredPhotographers.length === 0 ? (
        <div className="empty">
          <EmptyIcon name="search" />
          <div>No se encontró ningún fotógrafo con ese nombre</div>
        </div>
      ) : !searchMode ? (
        <motion.div
  style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}
  variants={{
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } }
  }}
  initial="hidden"
  animate="show"
>
{filteredPhotographers.map(ph => (
    <motion.div
      key={ph.id}
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
      }}
      whileHover={{ y: -4, borderColor: "var(--orange)" }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        if (user && ph.user_id === user.id) {
          setView(VIEWS.VENDOR_REQUEST);
          setActiveTab("profile");
        } else {
          fetchPhotographerProfile(ph.id);
          setView(VIEWS.PHOTOGRAPHER_PROFILE);
        }
      }}
      style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: `1px solid ${ph.featured ? "var(--orange)" : "var(--border)"}`, cursor: "pointer" }}
    >
      <div style={{ width: "100%", height: 110, background: ph.banner_url ? "none" : "linear-gradient(135deg, #1a1a1a, #2a2a2a)", overflow: "hidden", position: "relative" }}>
        {ph.banner_url
          ? <img src={ph.banner_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--orange)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, opacity: 0.3 }}>MOTOSHOT</div>}
        {ph.featured && <div style={{ position: "absolute", top: 8, right: 8, background: "var(--orange)", borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "#fff" }}><IconText icon="star" size={10} style={{ color: "#fff" }}>DESTACADO</IconText></div>}
      </div>
      <div style={{ padding: "0 14px 14px", position: "relative" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", border: "3px solid var(--orange)", background: "var(--card)", marginTop: -26, marginBottom: 8 }}>
          {ph.avatar_url
            ? <img src={ph.avatar_url} alt={ph.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={20} /></div>}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{ph.name}</div>
        <div style={{ color: "var(--orange)", fontSize: 12, marginBottom: 6 }}>{ph.handle || ""}</div>
        {ph.bio && <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8, lineHeight: 1.4 }}>{ph.bio}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="camera" size={12} /> {(ph.photos_count || 0) > 99 ? "+99" : (ph.photos_count || 0)} foto{ph.photos_count !== 1 ? "s" : ""}</span>
            {(ph.albums_count || 0) > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="folder" size={12} /> {ph.albums_count} álbum{ph.albums_count !== 1 ? "es" : ""}</span>
            )}
          </div>
          {ph.subscription_price ? (
            <div style={{ background: "var(--orange)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>
              Sub Q{ph.subscription_price}/mes
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  ))}
</motion.div>
      ) : null}
        </>
      )}
    </div>
  </div>
);
const renderPhotographerSocialLinks = (person) => {
  if (!person) return null;
  const hasSocial = person.instagram || person.tiktok || person.facebook || person.telegram || person.whatsapp;
  if (!hasSocial) return null;

  const linkStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 20,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    fontSize: 13,
    color: "var(--text)",
    textDecoration: "none",
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, justifyContent: "center" }}>
      {person.instagram && (
        <a href={`https://instagram.com/${person.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" style={linkStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
          {person.instagram}
        </a>
      )}
      {person.tiktok && (
        <a href={`https://tiktok.com/${person.tiktok.replace("@", "")}`} target="_blank" rel="noreferrer" style={linkStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.79a4.85 4.85 0 01-1.01-.1z" /></svg>
          {person.tiktok}
        </a>
      )}
      {person.facebook && (
        <a href={`https://facebook.com/${person.facebook}`} target="_blank" rel="noreferrer" style={linkStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
          Facebook
        </a>
      )}
      {person.telegram && (
        <a href={`https://t.me/${person.telegram.replace("@", "")}`} target="_blank" rel="noreferrer" style={linkStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
          {person.telegram}
        </a>
      )}
      {person.whatsapp && (
        <a href={`https://wa.me/${person.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={linkStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
          WhatsApp
        </a>
      )}
    </div>
  );
};

const renderPhotographerProfile = () => {
  const subscribed = isSubscribedToPhotographer(selectedPhotographer?.id);
  const profilePhotoCount = photographerPhotos.length;
  const runProfileSearch = () => {
    const q = profileSearchInput.trim();
    setProfileSearchQuery(q);
    setProfileSearchRan(q.length > 0);
  };
  const filteredProfileVideos = profileSearchQuery
    ? photographerVideos.filter((v) => videoMatchesProfileSearch(v, profileSearchQuery))
    : photographerVideos;

  const profileTabBtn = (tab, label, count) => (
    <button
      type="button"
      onClick={() => {
        setProfileMediaTab(tab);
        setProfileSearchInput("");
        setProfileSearchQuery("");
        setProfileSearchRan(false);
        setSelectedTag(null);
      }}
      style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 18,
        letterSpacing: 1,
        padding: "14px 8px",
        background: "none",
        border: "none",
        borderBottom: profileMediaTab === tab ? "2px solid var(--orange)" : "2px solid transparent",
        color: profileMediaTab === tab ? "var(--orange)" : "var(--muted)",
        cursor: "pointer",
        transition: "color 0.2s, border-color 0.2s",
        width: "100%",
      }}
    >
      {label} · {count}
    </button>
  );

  return (
  <div style={{ paddingBottom: 100 }}>
    {/* Banner */}
    <div style={{ width: "100%", height: 200, background: selectedPhotographer?.banner_url ? "none" : "linear-gradient(135deg, #1a1a1a, #ff6b0022)", overflow: "hidden", position: "relative" }}>
      {selectedPhotographer?.banner_url
        ? <img src={selectedPhotographer.banner_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--orange)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, letterSpacing: 4, opacity: 0.2 }}>MOTOSHOT GT</div>
      }
      <AppButton className="nav-btn" style={{ position: "absolute", top: 12, left: 12 }}
        onClick={() => setView(VIEWS.PHOTOGRAPHERS)}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Volver</span></AppButton>
    </div>

    {/* Perfil info */}
    <div style={{ padding: "0 20px", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: -36, marginBottom: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid var(--orange)", background: "var(--card)" }}>
          {selectedPhotographer?.avatar_url
            ? <img src={selectedPhotographer.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={28} /></div>
          }
        </div>
{selectedPhotographer?.subscription_price && user?.id !== selectedPhotographer?.user_id && (
  subscribed ? (
    <span
      className="subscription-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,107,0,0.35)",
        background: "linear-gradient(135deg, rgba(255,107,0,0.14) 0%, rgba(255,107,0,0.04) 100%)",
        color: "var(--orange)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        boxShadow: "0 0 0 1px rgba(255,107,0,0.06)",
      }}
    >
      <AppIcon name="star" size={11} color="var(--orange)" /> Suscrito
    </span>
  ) : (
    <AppButton
      className="nav-btn primary"
      onClick={() => {
        if (!user) { setView(VIEWS.AUTH); return; }
        setShowSubscribeModal(true);
      }}
    >
      Suscribirse · Q{selectedPhotographer.subscription_price}/mes
    </AppButton>
  )
)}
</div>

      <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: "easeOut" }}
  style={{ fontWeight: 700, fontSize: 20, marginBottom: 2, textAlign: "center" }}
>
  {selectedPhotographer?.name}
</motion.div>

<motion.div
  initial={{ opacity: 0, y: 15 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
  style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, justifyContent: "center" }}
>
  <div style={{ color: "var(--orange)", fontSize: 13 }}>{selectedPhotographer?.handle}</div>
  <VerifiedBadge size={16} />
</motion.div>

{selectedPhotographer?.bio && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
    style={{ color: "var(--muted)", fontSize: 13, marginBottom: formatPhoneDisplay(selectedPhotographer.phone) ? 8 : 16, lineHeight: 1.6, textAlign: "center" }}
  >
    {selectedPhotographer.bio}
  </motion.div>
)}

{formatPhoneDisplay(selectedPhotographer?.phone) && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
    style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.6, textAlign: "center" }}
  >
    Tel: {formatPhoneDisplay(selectedPhotographer.phone)}
  </motion.div>
)}

      {renderPhotographerSocialLinks(selectedPhotographer)}

      {selectedPhotographer?.subscription_benefits?.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Beneficios de suscripción</div>
          {selectedPhotographer.subscription_benefits.map((b, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--text)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name="check" size={12} color="var(--success)" /> {b}</div>
          ))}
        </div>
      )}

{/* Videos | Fotos — pestañas divididas */}
<div style={{ marginBottom: 20 }}>
  <div style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    borderBottom: "1px solid var(--border)",
    marginBottom: 4,
  }}>
    {profileTabBtn("videos", "VIDEOS", photographerVideos.length)}
    <div style={{ borderLeft: "1px solid var(--border)" }}>
      {profileTabBtn("photos", "FOTOS", profilePhotoCount)}
    </div>
  </div>
</div>

<ProfileSearchBar
  value={profileSearchInput}
  onChange={setProfileSearchInput}
  onSearch={runProfileSearch}
  placeholder={
    profileMediaTab === "videos"
      ? "Marca, modelo, color, sector, dorsal…"
      : "Ubicación, marca, tags de IA…"
  }
/>

{profileMediaTab === "videos" && (
  <div style={{ marginBottom: 28 }}>
    {photographerVideos.length === 0 ? (
      <div className="empty" style={{ padding: "32px 16px" }}>
        <EmptyIcon name="video" />
        <div>Este fotógrafo aún no tiene videos publicados.</div>
      </div>
    ) : filteredProfileVideos.length === 0 ? (
      <div className="empty" style={{ padding: "32px 16px" }}>
        <EmptyIcon name="search" />
        <div>No hay videos que coincidan con tu búsqueda.</div>
      </div>
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {renderVideoCards(filteredProfileVideos)}
      </div>
    )}
    <div style={{ textAlign: "center", marginTop: 16 }}>
      <AppButton
        className="nav-btn"
        onClick={() => {
          setVideoSearchQuery("");
          setActiveTab("videos");
          setView(VIEWS.VIDEO_SEARCH);
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <AppIcon name="search" size={14} /> Buscar más videos
        </span>
      </AppButton>
    </div>
  </div>
)}

{profileMediaTab === "photos" && (
  <>
      {/* Álbumes */}
      {albums.length > 0 && (
  <div style={{ marginBottom: 24 }}>
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 12 }}>
      ÁLBUMES
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
    {albums.map(album => {
  const albumPhotos = photographerPhotos.filter(p => p.album_id === album.id);
  const isSelected = selectedAlbum?.id === album.id;
  const coverUrl = album.cover_url 
  ? album.cover_url.trim().split("?")[0] + `?t=${album.id}` 
  : albumPhotos[0]?.watermark_url;


  return (
    <motion.div
      key={album.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
      }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { setSelectedAlbum(isSelected ? null : album); setSelectedTag(null); }}
      style={{ borderRadius: 12, overflow: "hidden", background: "var(--surface)", border: `1px solid ${isSelected ? "var(--orange)" : "var(--border)"}`, cursor: "pointer" }}
    >
      {/* Collage */}
<div style={{ height: 160, display: "grid", gap: 2, gridTemplateColumns: (!coverUrl && albumPhotos.length >= 3) ? "2fr 1fr" : "1fr", gridTemplateRows: (!coverUrl && albumPhotos.length >= 3) ? "1fr 1fr" : "1fr", background: "var(--card)" }}>
  {coverUrl ? (
    <img src={coverUrl} style={{ width: "100%", height: "100%", objectFit: "cover", gridColumn: "1 / -1", gridRow: "1 / -1" }} />
  ) : albumPhotos.length === 0 ? (
    <div style={{ display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13, gridColumn: "1 / -1" }}><IconText icon="image" size={14}>Sin fotos</IconText></div>
  ) : albumPhotos.length === 1 ? (
    <img src={albumPhotos[0].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  ) : albumPhotos.length === 2 ? (
    <>
      <img src={albumPhotos[0].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <img src={albumPhotos[1].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </>
  ) : (
    <>
      <img src={albumPhotos[0].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover", gridRow: "1 / 3" }} />
      <img src={albumPhotos[1].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "relative", overflow: "hidden" }}>
        <img src={albumPhotos[2].watermark_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {albumPhotos.length > 3 && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff", fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>
            +{albumPhotos.length - 3}
          </div>
        )}
      </div>
    </>
  )}
</div>

      {/* Info */}
      <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
<IconText icon="folder" size={14}>{album.name}</IconText>
            {isSelected && <span style={{ fontSize: 10, background: "var(--orange)", color: "#fff", padding: "1px 6px", borderRadius: 10 }}>Activo</span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {album.event_date ? (<><IconText icon="calendar" size={12}>{album.event_date}</IconText> · </>) : ""}{albumPhotos.length} foto{albumPhotos.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ fontSize: 18, color: isSelected ? "var(--orange)" : "var(--muted)", transition: "color 0.2s" }}>
          {isSelected ? <AppIcon name="arrowRight" size={12} style={{ transform: "rotate(-90deg)" }} /> : <AppIcon name="arrowRight" size={12} style={{ transform: "rotate(90deg)" }} />}
        </div>
      </div>
    </motion.div>
  );
})}
    </div>
  </div>
)}

{/* Fotos — filtradas por álbum si hay uno seleccionado */}
{/* Tags filtrables — solo cuando hay álbum seleccionado */}
{selectedAlbum && (() => {
  const albumPhotos = photographerPhotos.filter(p => p.album_id === selectedAlbum.id);
  const allTags = [...new Set(albumPhotos.flatMap(p => p.tags || []))].filter(Boolean);
  
  if (allTags.length === 0) return null;
  
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 8, marginBottom: 16 }}>
      <AppButton
        className={`tag${!selectedTag ? " active" : ""}`}
        onClick={() => setSelectedTag(null)}
      >
        Todas
      </AppButton>
      {allTags.map(tag => (
        <AppButton
          key={tag}
          className={`tag${selectedTag === tag ? " active" : ""}`}
          onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
        >
          {tag}
        </AppButton>
      ))}
    </div>
  );
})()}

{/* Fotos — filtradas por álbum y/o tag */}
{(() => {
  let displayPhotos = selectedAlbum
    ? photographerPhotos.filter(p => p.album_id === selectedAlbum.id)
    : photographerPhotos;

  if (profileSearchQuery) {
    displayPhotos = displayPhotos.filter((p) => photoMatchesProfileSearch(p, profileSearchQuery));
  }

  if (selectedTag) {
    displayPhotos = displayPhotos.filter(p => p.tags?.includes(selectedTag));
  }

  if (displayPhotos.length === 0 && profileSearchRan) {
    return (
      <div className="empty" style={{ padding: "32px 16px" }}>
        <EmptyIcon name="search" />
        <div>No hay fotos que coincidan con tu búsqueda.</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>
    {selectedAlbum
      ? `${selectedAlbum.name.toUpperCase()}${selectedTag ? ` · ${selectedTag}` : ""}`
      : `${displayPhotos.length} foto${displayPhotos.length !== 1 ? "s" : ""}`}
  </div>
  <div style={{ display: "flex", gap: 4 }}>
    {[
      { mode: "grid", iconName: "gallery" },
      { mode: "feed", iconName: "feed" },
    ].map(({ mode, iconName }) => (
      <AppButton
        key={mode}
        onClick={() => setPhotoViewMode(mode)}
        style={{
          background: photoViewMode === mode ? "var(--orange)" : "var(--surface)",
          border: `1px solid ${photoViewMode === mode ? "var(--orange)" : "var(--border)"}`,
          color: photoViewMode === mode ? "#fff" : "var(--muted)",
          borderRadius: 8, padding: "6px 10px", cursor: "pointer",
          fontSize: 16, transition: "all 0.2s",
        }}
      >
        <AppIcon name={iconName} size={16} />
      </AppButton>
    ))}
  </div>
</div>

<AnimatePresence mode="wait">
  {photoViewMode === "grid" ? (
    <motion.div
      key="grid"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}
    >
      {displayPhotos.map(photo => (
        <motion.div
          key={photo.id}
          whileTap={{ scale: 0.97 }}
          onClick={() => openPhotoDetail(photo, VIEWS.PHOTOGRAPHER_PROFILE)}
          style={{ aspectRatio: "1", overflow: "hidden", cursor: "pointer", position: "relative", background: "var(--card)" }}
        >
          <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </motion.div>
      ))}
    </motion.div>
  ) : (
    <motion.div
      key="feed"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {displayPhotos.map(photo => (
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.99 }}
          style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", cursor: "pointer" }}
            onClick={() => openPhotoDetail(photo, VIEWS.PHOTOGRAPHER_PROFILE)}
          >
            <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)" }}>
<IconText icon="pin" size={12}>{photo.location}</IconText>
                </div>
                {photo.ride_date && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
<IconText icon="calendar" size={12}>{photo.ride_date}</IconText>
                    {photo.time_start ? ` · ${photo.time_start}${photo.time_end ? `–${photo.time_end}` : ""}` : ""}
                  </div>
                )}
                {photo.tags?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                    {photo.tags.map(t => (
                      <span key={t} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 11, padding: "2px 8px", borderRadius: 20 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text)" }}>
                  Q{photo.price}
                </div>
                <AppButton
                  className="card-buy"
                  onClick={() => handleBuy(photo)}
                >
                  Comprar
                </AppButton>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )}
</AnimatePresence>
    </>
  );
})()}

  </>
)}

    </div>
  </div>
  );
};
  const renderDetail = () => (
    <div style={{ padding: "16px 20px 100px", maxWidth: 540, margin: "0 auto" }}>
      <AppButton className="nav-btn" style={{ marginBottom: 16 }} onClick={() => setView(detailReturnView)}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Volver</span></AppButton>
      {selected && (
        <>
          <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "4/3", background: "var(--card)", marginBottom: 16 }}>
            <WatermarkedImage src={selected.watermark_url} photographer={selected.photographer?.name || "MOTOSHOT"} purchased={canDownloadPhoto(selected)} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ color: "var(--orange)", fontWeight: 700, fontSize: 15 }}>{selected.photographer?.name}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}><IconText icon="pin" size={12}>{selected.location}</IconText></div>
              {selected.ride_date && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}><IconText icon="calendar" size={12}>{selected.ride_date}</IconText></div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38 }}>Q{selected.price}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Alta resolución</div>
            </div>
          </div>
          {selected.tags && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {selected.tags.map(t => (
                <span key={t} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, padding: "3px 10px", borderRadius: 20 }}>{t}</span>
              ))}
            </div>
          )}
        {!canDownloadPhoto(selected) ? (
  <AppButton className="pay-btn" onClick={() => handleBuy(selected)}>
    Comprar — Q{selected.price}
  </AppButton>
) : (
  <AppButton className="download-btn" onClick={handleDownload}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="arrowRight" size={12} style={{ transform: "rotate(90deg)" }} /> {isCEO && !purchased.includes(selected.id) ? "Descargar HD gratis (CEO)" : "Descarga en HD"}</span>
  </AppButton>
)}

        </>
      )}
    </div>
  );


  const renderUpload = () => {
    const handleVideoFilesSelect = (e) => {
      const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("video/"));
      e.target.value = "";
      if (!files.length) return;

      const existing = new Set(videoQueue.map((i) => `${i.file.name}|${i.file.size}`));
      const fresh = files.filter((f) => !existing.has(`${f.name}|${f.size}`));
      const room = MAX_VIDEO_BATCH - videoQueue.length;
      if (fresh.length > room) {
        showToast(`Máximo ${MAX_VIDEO_BATCH} videos por carga. Se agregaron los primeros ${Math.max(0, room)}.`);
      }
      const accepted = fresh.slice(0, Math.max(0, room)).map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        status: "pending",
        error: null,
      }));
      if (!accepted.length) return;

      const merged = [...videoQueue, ...accepted];
      setVideoQueue(merged);

      if (merged.length === 1) {
        setVideoDurationSeconds(null);
        readVideoDuration(merged[0].file).then((dur) => setVideoDurationSeconds(dur));
        analyzeMediaWithAI(merged[0].file);
      } else {
        setAutoTags(null);
        setVideoDurationSeconds(null);
      }
    };

    const removeQueuedVideo = (id) => {
      if (videoUploadLoading) return;
      setVideoQueue((prev) => {
        const next = prev.filter((i) => i.id !== id);
        if (next.length === 0) {
          setAutoTags(null);
          setVideoDurationSeconds(null);
        }
        return next;
      });
    };

    const clearVideoQueue = () => {
      if (videoUploadLoading) return;
      setVideoQueue([]);
      setVideoThumbnailFile(null);
      setVideoDurationSeconds(null);
      setAutoTags(null);
    };

    if (!user) {
      return (
        <div className="upload-view">
          <div className="empty"><EmptyIcon name="lock" /><div>Iniciá sesión para subir fotos y videos.</div></div>
        </div>
      );
    }
    if (!profile) {
      return (
        <div className="upload-view">
          <div className="empty">
            <EmptyIcon name="clipboard" />
            <div>
              Necesitás un perfil de fotógrafo aprobado.{" "}
              <AppButton className="nav-btn primary" style={{ marginTop: 12 }} onClick={() => setView(VIEWS.VENDOR_REQUEST)}>
                Solicitar perfil
              </AppButton>
            </div>
          </div>
        </div>
      );
    }
    if (profile.verification_status !== "approved") {
      return (
        <div className="upload-view">
          <div className="empty">
            <LoaderIcon size={44} />
            <div>Tu perfil está <strong style={{ color: "var(--orange)" }}>{profile.verification_status}</strong>. Esperá la aprobación del administrador.</div>
          </div>
        </div>
      );
    }

    const uploadTabBtn = (tab, label) => (
      <button
        type="button"
        onClick={() => setUploadMediaTab(tab)}
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 18,
          letterSpacing: 1,
          padding: "14px 8px",
          background: "none",
          border: "none",
          borderBottom: uploadMediaTab === tab ? "2px solid var(--orange)" : "2px solid transparent",
          color: uploadMediaTab === tab ? "var(--orange)" : "var(--muted)",
          cursor: "pointer",
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <AppIcon name={tab === "video" ? "video" : "camera"} size={18} color={uploadMediaTab === tab ? "var(--orange)" : "var(--muted)"} />
        {label}
      </button>
    );

    return (
      <div className="upload-view">
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderBottom: "1px solid var(--border)",
          marginBottom: 20,
        }}
        >
          {uploadTabBtn("video", "VIDEO")}
          <div style={{ borderLeft: "1px solid var(--border)" }}>
            {uploadTabBtn("photo", "FOTO")}
          </div>
        </div>

        {uploadMediaTab === "video" && (() => {
          const queueTotal = videoQueue.length;
          const queueDone = videoQueue.filter((i) => i.status === "done").length;
          const queueFailed = videoQueue.filter((i) => i.status === "error").length;
          const queuePendingCount = videoQueue.filter((i) => i.status === "pending" || i.status === "error").length;
          const isSingle = queueTotal === 1;
          const uploadingIndex = videoQueue.findIndex((i) => i.status === "uploading");

          return (
          <div>
            <SectionTitleIcon icon="video">SUBIR VIDEO</SectionTitleIcon>
            <div className="section-sub" style={{ marginBottom: 20 }}>
              MP4, MOV o AVI — máx 500MB c/u. Hasta {MAX_VIDEO_BATCH} videos por carga; se suben uno por uno.
            </div>

            <div
              className={`dropzone${queueTotal > 0 ? " active" : ""}`}
              style={{ marginBottom: 20, ...(videoUploadLoading ? { pointerEvents: "none", opacity: 0.6 } : {}) }}
              onClick={() => document.getElementById("videoInput").click()}
            >
              <input
                id="videoInput"
                type="file"
                accept="video/mp4,video/quicktime,video/avi"
                multiple
                style={{ display: "none" }}
                disabled={videoUploadLoading}
                onChange={handleVideoFilesSelect}
              />
              <div className="dropzone-icon" style={{ display: "grid", placeItems: "center" }}>
                <AppIcon name="video" size={36} color="var(--muted)" />
              </div>
              <div className="dropzone-text">
                {queueTotal > 0 ? (
                  <span style={{ color: "var(--orange)", fontWeight: 700 }}>
                    {queueTotal} video{queueTotal !== 1 ? "s" : ""} en cola — tocá para agregar más
                  </span>
                ) : (
                  <><span style={{ color: "var(--orange)" }}>Tocá para seleccionar</span> uno o varios videos</>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Portada del video (opcional)</label>
              <div className="section-sub" style={{ marginBottom: 10 }}>
                Imagen que ven los compradores antes de reproducir el preview.
                {queueTotal > 1 ? " Se aplica a todos los videos de esta carga." : ""}
              </div>
              <div
                className={`dropzone${videoThumbnailFile ? " active" : ""}`}
                style={{ padding: "20px 16px", borderColor: videoThumbnailFile ? undefined : "rgba(255,107,0,0.45)" }}
                onClick={() => document.getElementById("videoThumbInput").click()}
              >
                <input
                  id="videoThumbInput"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => setVideoThumbnailFile(e.target.files?.[0] || null)}
                />
                {videoThumbnailFile ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <img
                      src={URL.createObjectURL(videoThumbnailFile)}
                      alt=""
                      style={{ width: 96, height: 54, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                    <div>
                      <div style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>{videoThumbnailFile.name}</div>
                      <AppButton
                        className="nav-btn"
                        style={{ marginTop: 8, fontSize: 11 }}
                        onClick={(ev) => { ev.stopPropagation(); setVideoThumbnailFile(null); }}
                      >
                        Quitar portada
                      </AppButton>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                    <IconText icon="image" size={14}>Tocá para elegir imagen de portada</IconText>
                  </div>
                )}
              </div>
            </div>

            {queueTotal > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {videoUploadLoading
                      ? `Subiendo ${Math.min(queueDone + 1, queueTotal)} de ${queueTotal}…`
                      : `${queueTotal} en cola${queueDone ? ` · ${queueDone} subido(s)` : ""}${queueFailed ? ` · ${queueFailed} con error` : ""}`}
                  </span>
                  {!videoUploadLoading && (
                    <AppButton className="nav-btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={clearVideoQueue}>
                      Quitar todos
                    </AppButton>
                  )}
                </div>
                {videoUploadLoading && (
                  <div className="video-queue-progress">
                    <div
                      className="video-queue-progress-bar"
                      style={{ width: `${Math.round((queueDone / Math.max(queueTotal, 1)) * 100)}%` }}
                    />
                  </div>
                )}
                <div className="video-queue">
                  {videoQueue.map((item, idx) => (
                    <div key={item.id} className={`video-queue-item video-queue-item--${item.status}`}>
                      <span className="video-queue-status">
                        {item.status === "uploading" ? (
                          <LoaderIcon size={16} />
                        ) : item.status === "done" ? (
                          <AppIcon name="check" size={16} color="var(--success)" />
                        ) : item.status === "error" ? (
                          <AppIcon name="alert" size={16} color="#ff4444" />
                        ) : (
                          <span className="video-queue-dot" />
                        )}
                      </span>
                      <div className="video-queue-info">
                        <div className="video-queue-name">{item.file.name}</div>
                        <div className="video-queue-meta">
                          {formatFileSize(item.file.size)}
                          {item.status === "uploading"
                            ? (typeof item.progress === "number" && item.progress < 100
                              ? ` · Subiendo… ${item.progress}%`
                              : " · Procesando…")
                            : ""}
                          {item.status === "done" ? " · Subido" : ""}
                          {item.status === "error" ? ` · ${item.error || "Error"}` : ""}
                        </div>
                      </div>
                      {!videoUploadLoading && item.status !== "done" && (
                        <button
                          type="button"
                          className="video-queue-remove"
                          aria-label="Quitar video"
                          onClick={() => removeQueuedVideo(item.id)}
                        >
                          <AppIcon name="x" size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {queueTotal > 1 && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
                    Los datos de abajo (sector, hora, precio, álbum) se aplican a todos los videos.
                    La IA detecta marca y colores de cada video al subirlo. No cierres la app durante la carga.
                  </div>
                )}
              </div>
            )}

            {isSingle && videoDurationSeconds ? (
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                Duración detectada: <strong style={{ color: "var(--text)" }}>{formatVideoDuration(videoDurationSeconds)}</strong>
              </div>
            ) : null}

            {analyzingMedia && (
              <div className="empty" style={{ padding: "24px 0" }}>
                <LoaderIcon size={36} />
                <div>Analizando video con IA...</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Detectando marca, modelo y colores</div>
              </div>
            )}

            {autoTags && !analyzingMedia && (
              <div style={{ background: "var(--card)", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                <div style={{ color: "var(--orange)", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <AppIcon name="search" size={16} color="var(--orange)" />
                  Tags detectados (podés editar)
                </div>
                {[
                  { label: "Marca", key: "moto_brand" },
                  { label: "Modelo", key: "moto_model" },
                  { label: "Color moto", key: "moto_color" },
                  { label: "Color casco", key: "helmet_color" },
                  { label: "Color traje", key: "suit_color" },
                  { label: "Dorsal", key: "dorsal" },
                ].map(({ label, key }) => (
                  <div key={key} className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">{label}</label>
                    <input
                      className="form-input"
                      value={autoTags[key] || ""}
                      onChange={(e) => setAutoTags({ ...autoTags, [key]: e.target.value })}
                    />
                  </div>
                ))}
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Confianza: {autoTags.confidence ?? 0}%</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Sector / Curva</label>
              <input
                className="form-input"
                placeholder="Ej: Curva del Rodeo"
                value={videoForm.sector}
                onChange={(e) => setVideoForm({ ...videoForm, sector: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hora (rango)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="form-input"
                  type="time"
                  value={videoForm.event_time_start}
                  onChange={(e) => setVideoForm({ ...videoForm, event_time_start: e.target.value })}
                />
                <input
                  className="form-input"
                  type="time"
                  value={videoForm.event_time_end}
                  onChange={(e) => setVideoForm({ ...videoForm, event_time_end: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Precio (Q)</label>
              <input
                className="form-input"
                type="number"
                placeholder="Ej: 150"
                value={videoForm.price}
                onChange={(e) => setVideoForm({ ...videoForm, price: e.target.value })}
              />
            </div>
            <AppButton
              className="pay-btn"
              disabled={queuePendingCount === 0 || analyzingMedia || videoUploadLoading}
              onClick={startVideoQueueUpload}
            >
              {analyzingMedia
                ? "ANALIZANDO..."
                : videoUploadLoading
                  ? `SUBIENDO ${Math.min(queueDone + 1, queueTotal)}/${queueTotal}...`
                  : queueFailed > 0 && queueDone > 0
                    ? `REINTENTAR ${queueFailed} FALLIDO${queueFailed !== 1 ? "S" : ""}`
                    : queueTotal > 1
                      ? `SUBIR ${queuePendingCount} VIDEOS`
                      : "SUBIR VIDEO"}
            </AppButton>
          </div>
          );
        })()}

        {uploadMediaTab === "photo" && (
          <div>
            <SectionTitleIcon icon="camera">SUBIR FOTO</SectionTitleIcon>
            <div className="section-sub">JPG, PNG o WebP — máx 30MB c/u. La IA detecta marca y modelo de la moto; la marca de agua se aplica al publicar.</div>

            <div className="form-group">
              <label className="form-label">Fotos</label>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                Revisá o completá los tags en cada foto si la IA no los detectó bien — así los compradores te encuentran al buscar.
              </div>
              <div className={`dropzone${uploadFiles.length > 0 ? " active" : ""}`}
                onClick={() => document.getElementById("photo-input").click()}>
                <div className="dropzone-icon" style={{ display: "grid", placeItems: "center" }}><AppIcon name="camera" size={36} color="var(--muted)" /></div>
                <div className="dropzone-text">
                  {uploadFiles.length > 0
                    ? <span style={{ color: "var(--orange)", fontWeight: 700 }}>{uploadFiles.length} foto(s) seleccionada(s)</span>
                    : <><span style={{ color: "var(--orange)" }}>Toca para seleccionar</span> una o varias fotos</>}
                </div>
              </div>
              <input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp"
                multiple style={{ display: "none" }}
                disabled={uploadLoading}
                onChange={e => {
                  addUploadFiles(e.target.files);
                  e.target.value = "";
                }} />

              {uploadFiles.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{uploadFiles.length} seleccionada(s)</span>
                  {!uploadLoading && (
                    <AppButton
                      type="button"
                      className="nav-btn"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={clearUploadFiles}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <AppIcon name="x" size={12} /> Quitar todas
                      </span>
                    </AppButton>
                  )}
                </div>
              )}

              {uploadFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4, maxHeight: 400, overflowY: "auto" }}>
                  {uploadFiles.map(({ id, file, url, tags }) => {
                    const status = uploadProgress[file.name];
                    return (
                      <div key={id} style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 8 }}>
                        <div style={{ position: "relative", width: 64, height: 64, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                          <img src={url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          {status === "uploading" && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center" }}><LoaderIcon size={24} /></div>}
                          {status === "done" && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center" }}><AppIcon name="success" size={24} color="var(--success)" /></div>}
                          {status === "error" && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center" }}><AppIcon name="error" size={24} color="#ff4444" /></div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                          <input
                            className="form-input"
                            placeholder="Tags (IA o manual): Honda CBR, ZX6R, Yamaha…"
                            value={tags}
                            style={{ fontSize: 12, padding: "6px 10px" }}
                            disabled={uploadLoading}
                            onChange={e => {
                              const val = e.target.value;
                              setUploadFiles(prev => prev.map(item =>
                                item.id === id ? { ...item, tags: val } : item
                              ));
                            }}
                          />
                        </div>
                        {!uploadLoading && (
                          <AppButton
                            type="button"
                            className="nav-btn"
                            aria-label={`Quitar ${file.name}`}
                            style={{ flexShrink: 0, padding: "8px 10px" }}
                            onClick={() => removeUploadFile(id)}
                          >
                            <AppIcon name="x" size={16} />
                          </AppButton>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Ubicación / Punto de fotografía</label>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                Los compradores podrán buscar fotos por este lugar.
              </div>
              <input className="form-input" placeholder="Ej: Curva del Caminero KM 14"
                value={uploadForm.location} onChange={e => setUploadForm({ ...uploadForm, location: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Hora (rango)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input className="form-input" type="time"
                  value={uploadForm.time_start || ""}
                  onChange={e => setUploadForm({ ...uploadForm, time_start: e.target.value })}
                  style={{ flex: 1 }} />
                <span style={{ color: "var(--muted)", fontSize: 13 }}>a</span>
                <input className="form-input" type="time"
                  value={uploadForm.time_end || ""}
                  onChange={e => setUploadForm({ ...uploadForm, time_end: e.target.value })}
                  style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Álbum (opcional)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="form-input"
                  value={uploadForm.album_id || ""}
                  onChange={e => setUploadForm({ ...uploadForm, album_id: e.target.value })}>
                  <option value="">Sin álbum</option>
                  {albums.map(a => (
                    <option key={a.id} value={a.id}>{a.name} {a.event_date ? `· ${a.event_date}` : ""}</option>
                  ))}
                </select>
                <AppButton className="nav-btn" style={{ flexShrink: 0 }} onClick={() => setShowAlbumModal(true)}>
                  + Nuevo
                </AppButton>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de rodada</label>
              <input className="form-input" type="date"
                value={uploadForm.ride_date} onChange={e => setUploadForm({ ...uploadForm, ride_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio (Q)</label>
              <input className="form-input" type="number" placeholder="50"
                value={uploadForm.price} onChange={e => setUploadForm({ ...uploadForm, price: e.target.value })} />
            </div>
            <AppButton className="upload-btn" onClick={handleUploadPhoto} disabled={uploadLoading}
              style={{ opacity: uploadLoading ? 0.6 : 1 }}>
              {uploadLoading ? "SUBIENDO..." : `↑ PUBLICAR ${uploadFiles.length > 1 ? uploadFiles.length + " FOTOS" : "FOTO"}`}
            </AppButton>
          </div>
        )}
      </div>
    );
  };

  const renderVideoSearch = () => {
    const getPreviewLimit = (duration) => {
      if (!duration || !Number.isFinite(duration)) return 7;
      return duration <= 7 ? 3 : 7;
    };

    const SearchVideoCard = ({ video }) => {
      const [playing, setPlaying] = useState(false);
      const [progress, setProgress] = useState(0);
      const videoRef = useRef(null);
      const previewLimitRef = useRef(7);

      const stopAtPreviewLimit = (el) => {
        if (!el) return;
        const limit = getPreviewLimit(el.duration);
        previewLimitRef.current = limit;
        if (el.currentTime >= limit) {
          el.pause();
          el.currentTime = 0;
          setPlaying(false);
          setProgress(0);
        }
      };

      const togglePlay = () => {
        const el = videoRef.current;
        if (!el) return;
        if (!playing) {
          el.currentTime = 0;
          previewLimitRef.current = getPreviewLimit(el.duration);
          el.play().catch(() => {});
          setPlaying(true);
          setProgress(0);
        } else {
          el.pause();
          el.currentTime = 0;
          setPlaying(false);
          setProgress(0);
        }
      };

      const hasThumb = Boolean(video.thumbnail_url);
      const photographerHandle = video.photographer?.handle || video.photographer?.name || "MOTOSHOT";
      const watermarkText = `@${String(photographerHandle).replace(/^@/, "")} • MotoShot GT`;

      return (
        <div style={{ position: "relative", background: "var(--surface)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
          <div style={{ position: "relative", height: 180, background: "#0a0a0a" }}>
            {hasThumb && (
              <img
                src={video.thumbnail_url}
                alt=""
                style={{
                  width: "100%",
                  height: 180,
                  objectFit: "cover",
                  display: "block",
                  opacity: playing ? 0 : 1,
                }}
              />
            )}
            <video
              ref={videoRef}
              src={video.preview_url}
              muted
              playsInline
              preload="metadata"
              style={{
                width: "100%",
                height: 180,
                objectFit: "cover",
                display: "block",
                ...(hasThumb
                  ? { position: "absolute", top: 0, left: 0, opacity: playing ? 1 : 0 }
                  : {}),
              }}
              onLoadedMetadata={(e) => {
                previewLimitRef.current = getPreviewLimit(e.currentTarget.duration);
              }}
              onTimeUpdate={(e) => {
                const el = e.currentTarget;
                const limit = getPreviewLimit(el.duration);
                previewLimitRef.current = limit;
                if (!limit) return;
                setProgress(Math.min(1, el.currentTime / limit));
                stopAtPreviewLimit(el);
              }}
            />
            {playing && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 1,
                  pointerEvents: "none",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "-40%",
                    left: "-40%",
                    width: "180%",
                    height: "180%",
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "28px 20px",
                    transform: "rotate(-30deg)",
                    alignContent: "center",
                    justifyItems: "center",
                  }}
                >
                  {Array.from({ length: 18 }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 14,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        userSelect: "none",
                      }}
                    >
                      {watermarkText}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              aria-label={playing ? "Pausar video" : "Reproducir video"}
              onClick={togglePlay}
              style={{
                position: "absolute",
                zIndex: 2,
                border: "none",
                cursor: "pointer",
                color: "#fff",
                background: "rgba(0,0,0,0.55)",
                display: "grid",
                placeItems: "center",
                padding: 0,
                ...(playing
                  ? { top: 8, right: 8, width: 32, height: 32, borderRadius: 6, fontSize: 14 }
                  : { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 56, height: 56, borderRadius: "50%", fontSize: 24 }),
              }}
            >
              {playing ? "■" : "▶"}
            </button>
          </div>
          {playing && (
            <div style={{ height: 3, background: "#333", width: "100%" }}>
              <div style={{ height: 3, background: "#FF6B00", width: `${progress * 100}%` }} />
            </div>
          )}
          <div style={{ padding: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {video.moto_brand && (
                <span className="tag active" style={{ fontSize: 11 }}>
                  {video.moto_brand} {video.moto_model}
                </span>
              )}
              {video.moto_color && <span className="tag" style={{ fontSize: 11 }}>{video.moto_color}</span>}
              {video.sector && <span className="tag" style={{ fontSize: 11 }}><IconText icon="pin" size={10}>{video.sector}</IconText></span>}
              {video.event_time_start && <span className="tag" style={{ fontSize: 11 }}>{video.event_time_start}</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--orange)", fontWeight: 700, fontSize: 18 }}>Q{video.price}</span>
              <AppButton className="card-buy" onClick={() => handleBuyVideo(video)}>Comprar</AppButton>
            </div>
          </div>
        </div>
      );
    };

    return (
    <div style={{ padding: "20px", paddingBottom: 100 }}>
      <SectionTitleIcon icon="video">BUSCAR VIDEOS</SectionTitleIcon>
      <div className="section-sub" style={{ marginBottom: 20 }}>
        Escribí lo que buscás — marca, color, casco, sector, dorsal… Los tags los detecta la IA al subir el video.
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid var(--border)" }}>
        <input
          className="search-input"
          placeholder="Ej: Ducati roja casco negro curva 3"
          value={videoSearchQuery}
          onChange={(e) => setVideoSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleVideoSearch(); }}
          style={{ marginBottom: 12 }}
        />
        <AppButton className="pay-btn" onClick={() => handleVideoSearch()}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <AppIcon name="search" size={16} /> BUSCAR VIDEOS
          </span>
        </AppButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
        {videosLoading ? (
          <div className="empty" style={{ gridColumn: "1 / -1" }}>
            <LoaderIcon size={44} />
            <div>Cargando videos...</div>
          </div>
        ) : videos.length > 0 ? (
          videos.map((video) => <SearchVideoCard key={video.id} video={video} />)
        ) : (
          <div className="empty" style={{ gridColumn: "1 / -1" }}>
            <EmptyIcon name="video" />
            <div>{videoSearchRan ? "No hay videos que coincidan con tu búsqueda." : "Todavía no hay videos publicados."}</div>
          </div>
        )}
      </div>
    </div>
    );
  };

  const renderPendingDeliveries = () => {
    const finishHqDelivery = (mediaType, itemId) => {
      showToast(mediaType === "video"
        ? "Listo: video HQ entregado. El comprador recibirá un email."
        : "Listo: foto HQ entregada. El comprador recibirá un email.");
      setPendingDeliveries((prev) => prev.filter((p) => !(p.media_type === mediaType && p.id === itemId)));
      setPendingDeliveryCount((prev) => Math.max(0, prev - 1));
    };

    const setHqProgress = (key, progress, phase) => {
      setHqUploads((prev) => ({ ...prev, [key]: { progress, phase } }));
    };

    const clearHqUpload = (key) => {
      setHqUploads((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

    // Videos HQ: directo a Supabase Storage (el backend en Render no aguanta
    // archivos grandes en memoria), luego solo se confirma con metadatos.
    const uploadVideoHq = async (itemId, file) => {
      const key = `video-${itemId}`;
      const ext = videoExtForFile(file);
      const storagePath = `${profile.id}/${itemId}/hq_${Date.now()}.${ext}`;
      setHqProgress(key, 0, "uploading");
      try {
        await uploadToSupabaseStorage({
          bucket: "videos-hq",
          path: storagePath,
          file,
          accessToken: session.access_token,
          onProgress: (pct) => setHqProgress(key, pct, pct >= 100 ? "processing" : "uploading"),
        });

        setHqProgress(key, 100, "processing");
        const { res, data } = await apiJson(`/api/videos/${itemId}/confirm-hq`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ storage_path: storagePath }),
        }, { wake: true });

        clearHqUpload(key);
        if (res.ok) {
          finishHqDelivery("video", itemId);
        } else {
          removeFromSupabaseStorage("videos-hq", storagePath);
          showToast(data?.error || "No se pudo entregar el video.");
        }
      } catch (err) {
        clearHqUpload(key);
        showToast(err?.message || "Error al subir el video HQ. Intentá de nuevo.");
      }
    };

    // Fotos HQ (≤30MB): siguen pasando por el backend, que aplica su flujo actual.
    const uploadPhotoHq = (itemId, file) => {
      const key = `photo-${itemId}`;
      const formData = new FormData();
      formData.append("photo_hq", file);
      setHqProgress(key, 0, "uploading");

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", apiUrl(`/api/photos/${itemId}/upload-hq`));
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      xhr.timeout = 30 * 60 * 1000;

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
        setHqProgress(key, pct, pct >= 100 ? "processing" : "uploading");
      };
      xhr.onload = () => {
        clearHqUpload(key);
        if (xhr.status >= 200 && xhr.status < 300) {
          finishHqDelivery("photo", itemId);
        } else {
          let msg = "No se pudo entregar la foto.";
          try {
            const data = JSON.parse(xhr.responseText);
            if (data?.error) msg = data.error;
          } catch { /* respuesta no JSON (ej. HTML de error del proxy) */ }
          showToast(msg);
        }
      };
      xhr.onerror = () => {
        clearHqUpload(key);
        showToast("Error de conexión al subir el archivo HQ. Intentá de nuevo.");
      };
      xhr.ontimeout = () => {
        clearHqUpload(key);
        showToast("La subida tardó demasiado y se canceló. Intentá de nuevo.");
      };

      xhr.send(formData);
    };

    const uploadHqFile = (mediaType, itemId, file) => {
      if (mediaType === "video") uploadVideoHq(itemId, file);
      else uploadPhotoHq(itemId, file);
    };

    const handleDeliverHQ = (mediaType, itemId) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = mediaType === "video" ? "video/mp4,video/quicktime,video/avi" : "image/*";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file || !session?.access_token) return;
        uploadHqFile(mediaType, itemId, file);
      };
      input.click();
    };

    const getTimeSince = (dateString) => {
      const diff = Date.now() - new Date(dateString).getTime();
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(hours / 24);
      if (days > 0) return `hace ${days} día${days > 1 ? "s" : ""}`;
      if (hours > 0) return `hace ${hours} hora${hours > 1 ? "s" : ""}`;
      return "hace menos de 1 hora";
    };

    const photoCount = pendingDeliveries.filter((i) => i.media_type === "photo").length;
    const videoCount = pendingDeliveries.filter((i) => i.media_type === "video").length;

    return (
      <div className="upload-view">
        <SectionTitleIcon icon="package">ENTREGAS PENDIENTES</SectionTitleIcon>
        <div className="section-sub">
          {pendingDeliveriesLoading
            ? "Revisando tus ventas..."
            : pendingDeliveries.length === 0
              ? "Sin entregas pendientes"
              : [
                photoCount > 0 ? `${photoCount} foto${photoCount !== 1 ? "s" : ""}` : null,
                videoCount > 0 ? `${videoCount} video${videoCount !== 1 ? "s" : ""}` : null,
              ].filter(Boolean).join(" · ") + " pendiente(s) de entrega HQ"}
        </div>

        {pendingDeliveriesLoading ? (
          <div className="empty">
            <LoaderIcon size={44} />
            <div>Cargando entregas...</div>
          </div>
        ) : pendingDeliveries.length === 0 ? (
          <div className="empty">
            <EmptyIcon name="checkCircle" color="var(--success)" />
            <div>No tenés entregas pendientes</div>
          </div>
        ) : (
          <div className="pending-delivery-list">
            {pendingDeliveries.map((item) => {
              const isVideo = item.media_type === "video";
              const title = isVideo
                ? (item.label || [item.moto_brand, item.moto_model].filter(Boolean).join(" ") || item.sector || "Video")
                : (item.location || "Sin ubicación");
              const upload = hqUploads[`${item.media_type}-${item.id}`];
              return (
                <div key={`${item.media_type}-${item.id}`} className="pending-delivery-card">
                  <div className="pending-delivery-top">
                    {isVideo ? (
                      <div className="pending-delivery-thumb">
                        <video src={item.preview_url} muted playsInline />
                      </div>
                    ) : (
                      <img src={item.watermark_url} alt="" className="pending-delivery-thumb" />
                    )}
                    <div className="pending-delivery-info">
                      <div className="pending-delivery-title-row">
                        <span className="tag pending-delivery-type">{isVideo ? "Video" : "Foto"}</span>
                        <span className="pending-delivery-title">{title}</span>
                      </div>
                      <div className="pending-delivery-meta">Comprador: {item.buyer_email || "—"}</div>
                      <div className="pending-delivery-time">Vendido {getTimeSince(item.completed_at)}</div>
                    </div>
                  </div>
                  {upload ? (
                    <div className="pending-delivery-progress">
                      <div className="pending-delivery-progress-track">
                        <div
                          className={`pending-delivery-progress-fill${upload.phase === "processing" ? " is-processing" : ""}`}
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                      <div className="pending-delivery-progress-label">
                        {upload.phase === "processing"
                          ? "Procesando en el servidor..."
                          : `Subiendo HQ... ${upload.progress}%`}
                      </div>
                    </div>
                  ) : (
                    <AppButton
                      type="button"
                      className="pending-delivery-btn"
                      onClick={() => handleDeliverHQ(item.media_type, item.id)}
                    >
                      <AppIcon name="upload" size={14} /> Entregar HQ
                    </AppButton>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderDashboard = () => {
    if (!profile || profile.verification_status !== "approved") {
      return (
        <div className="upload-view">
          <SectionTitleIcon icon="dash">DASHBOARD</SectionTitleIcon>
          <div className="empty">
            <EmptyIcon name="lock" />
            <div>Solo disponible para fotógrafos verificados.</div>
          </div>
        </div>
      );
    }
  
    return (
      <div className="upload-view">
        <SectionTitleIcon icon="dash">DASHBOARD</SectionTitleIcon>
        <div className="section-sub">Resumen de tu actividad y ventas.</div>
  
        {vendorStatsLoading ? (
          <div className="empty"><LoaderIcon size={44} /><div>Cargando estadísticas...</div></div>
        ) : vendorStatsError && !vendorStats ? (
          <div className="empty">
            <EmptyIcon name="alert" />
            <div>No se pudieron cargar las estadísticas.</div>
            <AppButton
              onClick={() => fetchVendorDashboard({ reconcile: true })}
              style={{ marginTop: 12 }}
            >
              REINTENTAR
            </AppButton>
          </div>
        ) : !vendorStats ? (
          <div className="empty"><LoaderIcon size={44} /><div>Cargando estadísticas...</div></div>
        ) : (
          <>
            {/* Tarjeta perfil compacta */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={20} /></div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{profile.name}</div>
                <div style={{ color: "var(--orange)", fontSize: 12 }}>{profile.handle}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "rgba(0,149,246,0.12)", border: "1px solid #0095f6", color: "#0095f6", fontSize: 11, fontWeight: 700 }}>
                <VerifiedBadge size={14} />
                Verificado
              </span>
            </div>
  
            {/* Stats cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
              {[
                { label: "Fotos", value: vendorStats.stats.photos_count, icon: "camera" },
                { label: "Ventas", value: vendorStats.stats.total_sales, icon: "purchases" },
                { label: "Ingresos", value: `Q${vendorStats.stats.total_amount}`, icon: "money" },
              ].map(s => (
                <div key={s.label} style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
                  <div style={{ marginBottom: 6, display: "grid", placeItems: "center" }}><AppIcon name={s.icon} size={28} color="var(--orange)" /></div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--orange)", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)", letterSpacing: 0.5, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
  
            {/* Ventas por día */}
<div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, marginBottom: 12 }}>VENTAS POR DÍA</div>
{vendorStats.stats.daily_sales.length === 0 ? (
  <div className="empty"><EmptyIcon name="receipt" /><div>Todavía no tenés ventas registradas.</div></div>
) : (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {vendorStats.stats.daily_sales.map(d => (
      <div key={d.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{d.date}</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{d.sales} venta(s)</div>
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--success)" }}>Q{d.amount}</div>
      </div>
    ))}
  </div>
)}

{/* Retiros */}
<div style={{ marginTop: 28 }}>
  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, marginBottom: 12 }}>RETIROS</div>
  {(() => {
    const totalEarned = vendorStats?.stats?.total_amount || 0;
    const totalWithdrawn = withdrawals.filter(w => ["pending","paid"].includes(w.status)).reduce((sum, w) => sum + Number(w.amount || 0), 0);
    const available = totalEarned - totalWithdrawn;
    const hasPending = withdrawals.some(w => w.status === "pending");
    const hasBankAccount = Boolean(profile?.bank_account?.trim());
    const bankDirty = bankAccountInput.trim() !== (profile?.bank_account || "").trim();
    return (
      <>
        <div style={{ padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid rgba(255,107,0,0.25)", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--orange-light)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <AppIcon name="money" size={14} color="var(--orange)" />
            Cuenta bancaria para depósito
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: "0 0 12px" }}>
            Ingresá el banco, tipo de cuenta y número donde recibirás el depósito de tus retiros.
          </p>
          <textarea
            className="form-input"
            rows={3}
            value={bankAccountInput}
            onChange={(e) => setBankAccountInput(e.target.value)}
            placeholder="Ej: Banco Industrial — Monetaria — 1234567890"
            style={{ resize: "vertical", lineHeight: 1.5, marginBottom: 10 }}
          />
          <AppButton
            className="pay-btn"
            disabled={bankAccountSaving || !bankAccountInput.trim() || (!bankDirty && hasBankAccount)}
            onClick={handleSaveBankAccount}
            style={{ marginBottom: 12, opacity: bankAccountSaving || !bankAccountInput.trim() || (!bankDirty && hasBankAccount) ? 0.55 : 1 }}
          >
            {bankAccountSaving ? "GUARDANDO..." : hasBankAccount && !bankDirty ? "CUENTA GUARDADA" : "GUARDAR CUENTA"}
          </AppButton>
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.22)", fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
            <strong style={{ color: "var(--orange-light)" }}>Tiempo de depósito:</strong> una vez aprobado tu retiro, el depósito puede demorar <strong style={{ color: "var(--text)" }}>hasta 24 horas</strong> en reflejarse en tu cuenta bancaria.
          </div>
        </div>
        {!hasBankAccount && (
          <div style={{ fontSize: 12, color: "var(--orange)", marginBottom: 12, lineHeight: 1.5 }}>
            Guardá tu cuenta bancaria para poder solicitar un retiro.
          </div>
        )}
        <div style={{ padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Balance disponible</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: available >= 50 ? "var(--success)" : "var(--muted)", lineHeight: 1, marginTop: 4 }}>
              Q{available.toFixed(2)}
            </div>
            {available < 50 && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Mínimo Q50 para retirar</div>}
          </div>
          {hasPending ? (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--orange)", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><LoaderIcon size={14} /> Retiro pendiente</div>
              <AppButton
                onClick={() => {
                  const pending = withdrawals.find(w => w.status === "pending");
                  if (!pending) return;
                  openConfirmDialog({
                    title: "CANCELAR RETIRO",
                    message: "¿Cancelar la solicitud de retiro pendiente?",
                    confirmLabel: "SÍ, CANCELAR",
                    cancelLabel: "NO",
                    destructive: true,
                    onConfirm: async () => {
                      const res = await fetch(`/api/auth/withdrawals/${pending.id}/cancel`, {
                        method: "PUT",
                        headers: { Authorization: `Bearer ${session?.access_token}` }
                      });
                      if (res.ok) { showToast("Retiro cancelado."); fetchMyWithdrawals(); }
                    },
                  });
                }}
                style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.4)", color: "#ff4444", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar retiro
              </AppButton>
            </div>
          ) : (
            <AppButton
              disabled={available < 50 || !hasBankAccount}
              onClick={() => {
                openConfirmDialog({
                  title: "SOLICITAR RETIRO",
                  message: `¿Solicitar retiro de Q${available.toFixed(2)} a ${profile.bank_account}? El depósito puede demorar hasta 24 horas.`,
                  confirmLabel: "SÍ, SOLICITAR",
                  cancelLabel: "NO",
                  onConfirm: async () => {
                    const res = await fetch("/api/auth/withdrawals", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${session?.access_token}` }
                    });
                    const data = await res.json();
                    if (res.ok) { showToast("Retiro solicitado. El depósito puede demorar hasta 24 horas."); fetchMyWithdrawals(); }
                    else showToast(data.error);
                  },
                });
              }}
              style={{ background: available >= 50 && hasBankAccount ? "var(--orange)" : "var(--surface)", border: `1px solid ${available >= 50 && hasBankAccount ? "var(--orange)" : "var(--border)"}`, color: available >= 50 && hasBankAccount ? "#fff" : "var(--muted)", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: available >= 50 && hasBankAccount ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif" }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="money" size={14} /> Solicitar retiro</span>
            </AppButton>
          )}
        </div>
        {withdrawals.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Historial</div>
            {withdrawals.map(w => (
              <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Q{Number(w.amount).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{new Date(w.created_at).toLocaleDateString("es-GT")}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: w.status === "paid" ? "rgba(255,107,0,0.12)" : w.status === "pending" ? "rgba(255,107,0,0.12)" : "rgba(100,100,100,0.12)", color: w.status === "paid" ? "var(--success)" : w.status === "pending" ? "var(--orange)" : "var(--muted)", border: `1px solid ${w.status === "paid" ? "var(--success)" : w.status === "pending" ? "var(--orange)" : "var(--border)"}` }}>
                  {w.status === "paid" ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="check" size={12} color="var(--success)" /> Pagado</span>) : w.status === "pending" ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><LoaderIcon size={14} /> Pendiente</span>) : "Cancelado"}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  })()}
</div>

          </>
        )}
      </div>
    );
  };
  
  const openVideoEdit = (video) => {
    setEditingVideoId(video.id);
    setVideoEditForm({
      price: String(video.price ?? ""),
      moto_brand: video.moto_brand || "",
      moto_model: video.moto_model || "",
      moto_color: video.moto_color || "",
      helmet_color: video.helmet_color || "",
      suit_color: video.suit_color || "",
      dorsal: video.dorsal || "",
      sector: video.sector || "",
      event_time_start: video.event_time_start || "",
      event_time_end: video.event_time_end || "",
    });
  };

  const cancelVideoEdit = () => {
    setEditingVideoId(null);
    setVideoEditForm({});
  };

  const saveVideoEdit = async (videoId) => {
    if (!session?.access_token) return;
    setVideoEditSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/videos/${videoId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(videoEditForm),
      });
      const data = await parseApiJson(res);
      if (res.ok) {
        const updated = data.video || {};
        setMyVideos((prev) => prev.map((v) => (
          v.id === videoId ? { ...v, ...updated, purchases_count: v.purchases_count } : v
        )));
        setPhotographerVideos((prev) => prev.map((v) => (
          v.id === videoId ? { ...v, ...updated } : v
        )));
        cancelVideoEdit();
        showToast(data.message || "Video actualizado.");
      } else {
        showToast(data.error || "No se pudo guardar el video.");
      }
    } catch (err) {
      console.error("saveVideoEdit:", err);
      showToast("Error al guardar los cambios.");
    } finally {
      setVideoEditSaving(false);
    }
  };

  const handleDeleteVideo = (video) => {
    openConfirmDialog({
      title: "ELIMINAR VIDEO",
      message: "¿Eliminar este video? Esta acción no se puede deshacer.",
      confirmLabel: "SÍ, ELIMINAR",
      cancelLabel: "NO",
      destructive: true,
      onConfirm: async () => {
        const res = await fetch(apiUrl(`/api/videos/${video.id}`), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const data = await parseApiJson(res);
        if (res.ok) {
          setMyVideos((prev) => prev.filter((v) => v.id !== video.id));
          setPhotographerVideos((prev) => prev.filter((v) => v.id !== video.id));
          if (editingVideoId === video.id) cancelVideoEdit();
          showToast("Video eliminado.");
        } else {
          showToast(data.error || "No se pudo eliminar el video.");
        }
      },
    });
  };

  const renderMyVideoCard = (video, { editable = false } = {}) => {
    const label =
      [video.moto_brand, video.moto_model].filter(Boolean).join(" ") ||
      video.sector ||
      "Video";
    const hqReady = video.hq_status === "ready";
    const isEditing = editable && editingVideoId === video.id;

    return (
      <div
        key={video.id}
        style={{
          borderRadius: 14,
          overflow: "hidden",
          background: "var(--surface)",
          border: `1px solid ${isEditing ? "var(--orange)" : "var(--border)"}`,
        }}
      >
        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#0a0a0a", overflow: "hidden" }}>
          <img
            src={VIDEO_CARD_PLACEHOLDER_URL}
            alt=""
            decoding="async"
            aria-hidden
            className={`video-card-static-banner gallery-video-banner${videoMediaReady[video.id] ? " is-hidden" : ""}`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          {video.thumbnail_url && (
            <img
              src={video.thumbnail_url}
              alt=""
              decoding="async"
              className={`video-card-poster-cover gallery-video-poster${videoMediaReady[video.id] ? " is-visible" : ""}`}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              onLoad={() => markVideoMediaReady(video.id)}
            />
          )}
          <video
            src={video.preview_url}
            muted
            playsInline
            preload="metadata"
            className={`gallery-video-preview${videoMediaReady[video.id] ? " is-ready" : ""}`}
            onLoadedData={(e) => {
              if (!video.thumbnail_url) {
                const el = e.currentTarget;
                el.currentTime = Math.min(0.5, (el.duration || 1) * 0.05);
                el.pause();
                markVideoMediaReady(video.id);
              }
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: videoMediaReady[video.id] && !video.thumbnail_url ? 1 : 0,
              transition: "opacity 0.35s ease",
            }}
          />
          {video.duration_seconds ? (
            <div style={{
              position: "absolute", bottom: 8, right: 8,
              background: "rgba(0,0,0,0.8)", color: "#fff",
              padding: "2px 6px", borderRadius: 4, fontSize: 11,
            }}>
              {`${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, "0")}`}
            </div>
          ) : null}
          <div style={{
            position: "absolute", top: 8, left: 8,
            background: hqReady ? "rgba(0,200,100,0.85)" : "rgba(255,107,0,0.85)",
            color: "#fff", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
          }}>
            {hqReady ? "HQ listo" : "Preview"}
          </div>
          {editable && !isEditing && (
            <AppButton
              style={{
                position: "absolute", top: 8, right: 8, zIndex: 6,
                background: "rgba(220,50,50,0.85)", border: "none",
                color: "#fff", borderRadius: 6, padding: "4px 10px",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
              onClick={() => handleDeleteVideo(video)}
            >
              <AppIcon name="trash" size={14} />
            </AppButton>
          )}
        </div>
        <div style={{ padding: "12px 14px" }}>
          {isEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--orange)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <AppIcon name="edit" size={14} color="var(--orange)" />
                Editar detalles
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Marca", key: "moto_brand" },
                  { label: "Modelo", key: "moto_model" },
                  { label: "Color moto", key: "moto_color" },
                  { label: "Color casco", key: "helmet_color" },
                  { label: "Color traje", key: "suit_color" },
                  { label: "Dorsal", key: "dorsal" },
                ].map(({ label: fieldLabel, key }) => (
                  <div key={key}>
                    <label className="form-label" style={{ fontSize: 10 }}>{fieldLabel}</label>
                    <input
                      className="form-input"
                      style={{ fontSize: 12, padding: "8px 10px" }}
                      value={videoEditForm[key] || ""}
                      disabled={videoEditSaving}
                      onChange={(e) => setVideoEditForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>Sector / Curva</label>
                <input
                  className="form-input"
                  style={{ fontSize: 12, padding: "8px 10px" }}
                  value={videoEditForm.sector || ""}
                  disabled={videoEditSaving}
                  onChange={(e) => setVideoEditForm((prev) => ({ ...prev, sector: e.target.value }))}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Hora inicio</label>
                  <input
                    className="form-input"
                    type="time"
                    style={{ fontSize: 12, padding: "8px 10px" }}
                    value={videoEditForm.event_time_start || ""}
                    disabled={videoEditSaving}
                    onChange={(e) => setVideoEditForm((prev) => ({ ...prev, event_time_start: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Hora fin</label>
                  <input
                    className="form-input"
                    type="time"
                    style={{ fontSize: 12, padding: "8px 10px" }}
                    value={videoEditForm.event_time_end || ""}
                    disabled={videoEditSaving}
                    onChange={(e) => setVideoEditForm((prev) => ({ ...prev, event_time_end: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>Precio (Q)</label>
                <input
                  className="form-input"
                  type="number"
                  style={{ fontSize: 12, padding: "8px 10px" }}
                  value={videoEditForm.price || ""}
                  disabled={videoEditSaving}
                  onChange={(e) => setVideoEditForm((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <AppButton
                  className="nav-btn primary"
                  style={{ flex: 1, fontSize: 12 }}
                  disabled={videoEditSaving}
                  onClick={() => saveVideoEdit(video.id)}
                >
                  {videoEditSaving ? "GUARDANDO..." : "GUARDAR"}
                </AppButton>
                <AppButton
                  className="nav-btn"
                  style={{ flex: 1, fontSize: 12 }}
                  disabled={videoEditSaving}
                  onClick={cancelVideoEdit}
                >
                  CANCELAR
                </AppButton>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {video.moto_brand && (
                  <span className="tag active" style={{ fontSize: 11 }}>{video.moto_brand} {video.moto_model}</span>
                )}
                {video.moto_color && (
                  <span className="tag" style={{ fontSize: 11 }}>{video.moto_color}</span>
                )}
                {video.sector && (
                  <span className="tag" style={{ fontSize: 11 }}><IconText icon="pin" size={10}>{video.sector}</IconText></span>
                )}
                {video.dorsal && (
                  <span className="tag" style={{ fontSize: 11, color: "var(--orange)" }}>#{video.dorsal}</span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {video.event_time_start ? `${video.event_time_start}${video.event_time_end ? `–${video.event_time_end}` : ""}` : ""}
                  {video.purchases_count > 0 && (
                    <span style={{ marginLeft: video.event_time_start ? 8 : 0 }}>
                      · {video.purchases_count} venta{video.purchases_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "var(--orange)" }}>
                  Q{video.price}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                {editable && (
                  <AppButton
                    className="nav-btn"
                    style={{ fontSize: 11, padding: "6px 12px", flexShrink: 0 }}
                    onClick={() => openVideoEdit(video)}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <AppIcon name="edit" size={12} /> Editar
                    </span>
                  </AppButton>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderMyGallery = () => {
    const isPhotographer = profile?.verification_status === "approved";
  
    if (isPhotographer) {
      const myPhotos = photos.filter(p => p.photographer?.user_id === user?.id);
      const displayPhotos = selectedAlbum
        ? myPhotos.filter(p => p.album_id === selectedAlbum.id)
        : myPhotos;
  
      const toggleSelect = (id) => {
        setSelectedPhotos(prev => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
      };
  
      const handleDeleteSelected = () => {
        if (selectedPhotos.size === 0) return;
        openConfirmDialog({
          title: "ELIMINAR FOTOS",
          message: `¿Eliminar ${selectedPhotos.size} foto(s) seleccionada(s)?`,
          confirmLabel: "SÍ, ELIMINAR",
          cancelLabel: "NO",
          destructive: true,
          onConfirm: async () => {
            await Promise.all([...selectedPhotos].map(id =>
              fetch(`/api/photos/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session?.access_token}` },
              })
            ));
            setSelectedPhotos(new Set());
            setSelectMode(false);
            fetchPhotos();
          },
        });
      };
  
      const handleDeleteAlbum = (album) => {
        openConfirmDialog({
          title: "ELIMINAR ÁLBUM",
          message: `¿Eliminar el álbum "${album.name}"? Las fotos no se borran, solo se desvinculan.`,
          confirmLabel: "SÍ, ELIMINAR",
          cancelLabel: "NO",
          destructive: true,
          onConfirm: async () => {
            const res = await fetch(`/api/auth/albums/${album.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (res.ok) {
              setAlbums(prev => prev.filter(a => a.id !== album.id));
              if (selectedAlbum?.id === album.id) setSelectedAlbum(null);
            } else {
              setMessage("No se pudo eliminar el álbum.");
            }
          },
        });
      };
  
      const galleryTabBtn = (tab, label, count) => (
        <button
          type="button"
          onClick={() => {
            setMyGalleryMediaTab(tab);
            if (tab === "videos") {
              setSelectMode(false);
              setSelectedPhotos(new Set());
            }
          }}
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 16,
            letterSpacing: 1,
            padding: "12px 8px",
            background: "none",
            border: "none",
            borderBottom: myGalleryMediaTab === tab ? "2px solid var(--orange)" : "2px solid transparent",
            color: myGalleryMediaTab === tab ? "var(--orange)" : "var(--muted)",
            cursor: "pointer",
            width: "100%",
          }}
        >
          {label} · {count}
        </button>
      );

      return (
        <div style={{ paddingBottom: 100 }}>
          {/* Header */}
          <div style={{ padding: "24px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ marginBottom: 4 }}><SectionTitleIcon icon="gallery">MI GALERÍA</SectionTitleIcon></div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {myPhotos.length} foto(s) · {myVideos.length} video(s) publicados
              </div>
            </div>
            {myGalleryMediaTab === "photos" && (
              <AppButton
                className={`nav-btn${selectMode ? " primary" : ""}`}
                onClick={() => { setSelectMode(!selectMode); setSelectedPhotos(new Set()); }}
              >
                {selectMode ? "Cancelar" : (<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="scissors" size={14} /> Seleccionar</span>)}
              </AppButton>
            )}
          </div>

          <div style={{ padding: "0 20px", marginTop: 16 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderBottom: "1px solid var(--border)",
            }}
            >
              {galleryTabBtn("videos", "VIDEOS", myVideos.length)}
              <div style={{ borderLeft: "1px solid var(--border)" }}>
                {galleryTabBtn("photos", "FOTOS", myPhotos.length)}
              </div>
            </div>
          </div>
  
          {/* Barra de acciones al seleccionar */}
          {myGalleryMediaTab === "photos" && selectMode && (
            <div style={{ margin: "12px 20px 0", padding: "12px 16px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {selectedPhotos.size > 0
                  ? <><span style={{ color: "var(--text)", fontWeight: 700 }}>{selectedPhotos.size}</span> seleccionada(s)</>
                  : "Tocá las fotos para seleccionar"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <AppButton className="nav-btn" style={{ fontSize: 12 }}
                  onClick={() => {
                    if (selectedPhotos.size === displayPhotos.length) {
                      setSelectedPhotos(new Set());
                    } else {
                      setSelectedPhotos(new Set(displayPhotos.map(p => p.id)));
                    }
                  }}>
                  {selectedPhotos.size === displayPhotos.length ? "Deseleccionar todo" : "Seleccionar todo"}
                </AppButton>
                <AppButton
                  className="nav-btn"
                  style={{ fontSize: 12, background: selectedPhotos.size > 0 ? "rgba(220,50,50,0.15)" : "none", borderColor: selectedPhotos.size > 0 ? "rgba(220,50,50,0.6)" : "var(--border)", color: selectedPhotos.size > 0 ? "#ff4444" : "var(--muted)" }}
                  disabled={selectedPhotos.size === 0}
                  onClick={handleDeleteSelected}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="trash" size={14} /> Eliminar ({selectedPhotos.size})</span>
                </AppButton>
              </div>
            </div>
          )}
  
          {/* Filtro por álbum + fotos */}
          {myGalleryMediaTab === "photos" && (
          <>
          {albums.length > 0 && (
            <div style={{ padding: "16px 20px 0", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", flexWrap: "nowrap" }}>
              <AppButton
                className={`tag${!selectedAlbum ? " active" : ""}`}
                onClick={() => setSelectedAlbum(null)}
              >
                Todas ({myPhotos.length})
              </AppButton>
              {albums.map(album => {
                const count = myPhotos.filter(p => p.album_id === album.id).length;
                const isActive = selectedAlbum?.id === album.id;
                return (
                  <div key={album.id} style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
                    <AppButton
                      className={`tag${isActive ? " active" : ""}`}
                      style={{ borderRadius: "20px 0 0 20px", borderRight: "none" }}
                      onClick={() => setSelectedAlbum(isActive ? null : album)}
                    >
                      {album.name} ({count})
                    </AppButton>
                    <AppButton
                      onClick={() => handleDeleteAlbum(album)}
                      style={{ padding: "6px 10px", borderRadius: "0 20px 20px 0", border: `1px solid ${isActive ? "var(--orange)" : "var(--border)"}`, background: isActive ? "var(--orange)" : "var(--surface)", color: isActive ? "#fff" : "var(--muted)", cursor: "pointer", fontSize: 12, transition: "all 0.2s" }}
                      title="Eliminar álbum"
                    >
<AppIcon name="x" size={14} />
                    </AppButton>
                  </div>
                );
              })}
            </div>
          )}
  
          {/* Grid */}
{displayPhotos.length === 0 ? (
  <div className="empty">
    <EmptyIcon name="image" />
    <div>{myPhotos.length === 0 ? "Todavía no subiste fotos." : "No hay fotos en este álbum."}</div>
    {myPhotos.length === 0 && (
      <AppButton className="nav-btn primary" style={{ marginTop: 16 }}
        onClick={() => { setUploadMediaTab("photo"); setActiveTab("upload"); setView(VIEWS.UPLOAD); }}>
        Subir primera foto
      </AppButton>
    )}
  </div>
) : (
  <>
    {/* Toggle de vista */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", marginTop: 16, marginBottom: 8 }}>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>{displayPhotos.length} foto(s)</div>
      <div style={{ display: "flex", gap: 4 }}>
        {[{ mode: "grid", iconName: "gallery" }, { mode: "feed", iconName: "feed" }].map(({ mode, iconName }) => (
          <AppButton
            key={mode}
            onClick={() => setPhotoViewMode(mode)}
            style={{
              background: photoViewMode === mode ? "var(--orange)" : "var(--surface)",
              border: `1px solid ${photoViewMode === mode ? "var(--orange)" : "var(--border)"}`,
              color: photoViewMode === mode ? "#fff" : "var(--muted)",
              borderRadius: 8, padding: "6px 10px", cursor: "pointer",
              fontSize: 16, transition: "all 0.2s",
            }}
          ><AppIcon name={iconName} size={16} /></AppButton>
        ))}
      </div>
    </div>

    {photoViewMode === "grid" ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
        {displayPhotos.map(photo => {
          const isSelected = selectedPhotos.has(photo.id);
          const albumName = photo.album_id ? albums.find(a => a.id === photo.album_id)?.name : null;
          return (
            <div
              key={photo.id}
              onClick={() => selectMode ? toggleSelect(photo.id) : null}
              style={{ aspectRatio: "1", overflow: "hidden", position: "relative", background: "var(--card)", outline: isSelected ? "3px solid var(--orange)" : "none", outlineOffset: -3, cursor: selectMode ? "pointer" : "default" }}
            >
              {selectMode && (
                <div style={{ position: "absolute", top: 6, left: 6, zIndex: 10, width: 20, height: 20, borderRadius: 5, border: `2px solid ${isSelected ? "var(--orange)" : "rgba(255,255,255,0.7)"}`, background: isSelected ? "var(--orange)" : "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", fontSize: 12, color: "#fff", transition: "all 0.15s" }}>
                  {isSelected ? <AppIcon name="check" size={14} color="#fff" /> : null}
                </div>
              )}
              {!selectMode && (
                <AppButton
                  style={{ position: "absolute", top: 6, right: 6, zIndex: 6, background: "rgba(220,50,50,0.85)", border: "none", color: "#fff", borderRadius: 6, padding: "3px 7px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                  onClick={e => {
                    e.stopPropagation();
                    openConfirmDialog({
                      title: "ELIMINAR FOTO",
                      message: "¿Eliminar esta foto? Esta acción no se puede deshacer.",
                      confirmLabel: "SÍ, ELIMINAR",
                      cancelLabel: "NO",
                      destructive: true,
                      onConfirm: async () => {
                        const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session?.access_token}` } });
                        if (res.ok) fetchPhotos();
                      },
                    });
                  }}
                ><AppIcon name="trash" size={14} /></AppButton>
              )}
              <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 20px" }}>
        {displayPhotos.map(photo => {
          const isSelected = selectedPhotos.has(photo.id);
          const albumName = photo.album_id ? albums.find(a => a.id === photo.album_id)?.name : null;
          return (
            <div
              key={photo.id}
              style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: `1px solid ${isSelected ? "var(--orange)" : "var(--border)"}`, cursor: selectMode ? "pointer" : "default" }}
              onClick={() => selectMode ? toggleSelect(photo.id) : null}
            >
              <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden", position: "relative" }}>
                {selectMode && (
                  <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, width: 24, height: 24, borderRadius: 6, border: `2px solid ${isSelected ? "var(--orange)" : "rgba(255,255,255,0.7)"}`, background: isSelected ? "var(--orange)" : "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", fontSize: 14, color: "#fff" }}>
                    {isSelected ? <AppIcon name="check" size={14} color="#fff" /> : null}
                  </div>
                )}
                {!selectMode && (
                  <AppButton
                    style={{ position: "absolute", top: 10, right: 10, zIndex: 6, background: "rgba(220,50,50,0.85)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    onClick={e => {
                      e.stopPropagation();
                      openConfirmDialog({
                        title: "ELIMINAR FOTO",
                        message: "¿Eliminar esta foto? Esta acción no se puede deshacer.",
                        confirmLabel: "SÍ, ELIMINAR",
                        cancelLabel: "NO",
                        destructive: true,
                        onConfirm: async () => {
                          const res = await fetch(`/api/photos/${photo.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session?.access_token}` } });
                          if (res.ok) fetchPhotos();
                        },
                      });
                    }}
                  ><AppIcon name="trash" size={14} /></AppButton>
                )}
                <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {albumName && <div style={{ fontSize: 11, color: "var(--orange)", marginBottom: 2 }}><IconText icon="folder" size={12}>{albumName}</IconText></div>}
                    <div style={{ fontSize: 13, fontWeight: 700 }}><IconText icon="pin" size={12}>{photo.location}</IconText></div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {photo.ride_date || ""}
                      {photo.time_start ? ` · ${photo.time_start}${photo.time_end ? `–${photo.time_end}` : ""}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "var(--text)" }}>Q{photo.price}</div>
                    <div style={{ fontSize: 10, background: "var(--success)", color: "#000", padding: "3px 8px", borderRadius: 6, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="check" size={10} color="#000" /> Publicada</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>
)}
          </>
          )}

          {myGalleryMediaTab === "videos" && (
            <div style={{ padding: "16px 20px 0" }}>
              {myVideosLoading ? (
                <div className="empty" style={{ padding: "24px 0" }}>
                  <LoaderIcon size={36} />
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>Cargando videos...</div>
                </div>
              ) : myVideos.length === 0 ? (
                <div className="empty">
                  <EmptyIcon name="video" />
                  <div>Todavía no subiste videos.</div>
                  <AppButton
                    className="nav-btn primary"
                    style={{ marginTop: 16 }}
                    onClick={() => { setUploadMediaTab("video"); setActiveTab("upload"); setView(VIEWS.UPLOAD); }}
                  >
                    Subir primer video
                  </AppButton>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {myVideos.map((video) => renderMyVideoCard(video, { editable: true }))}
                </div>
              )}
            </div>
          )}
      </div>
    );
  }
  
    // ── COMPRADOR ──────────────────────────────────────────────────
    return (
      <div style={{ paddingBottom: 100 }}>
        <div className="upload-view" style={{ paddingBottom: 0 }}>
          <SectionTitleIcon icon="gallery">MIS FOTOS</SectionTitleIcon>
          <div className="section-sub">Fotos que compraste — tocá para descargar.</div>
        </div>
        {!user ? (
          <div className="empty"><EmptyIcon name="lock" /><div>Iniciá sesión para ver tus fotos.</div></div>
        ) : purchasesLoading ? (
          <div className="empty"><LoaderIcon size={44} /><div>Cargando...</div></div>
        ) : purchases.length === 0 ? (
          <div className="empty">
            <EmptyIcon name="receipt" />
            <div>Todavía no compraste fotos.</div>
            <AppButton className="nav-btn primary" style={{ marginTop: 16 }} onClick={() => { setActiveTab("feed"); setView(VIEWS.PHOTOGRAPHERS); }}>
              Explorar fotógrafos
            </AppButton>
          </div>
        ) : (
          <div className="grid">
            {purchases.map(p => (
              <div key={p.id} className="card"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/downloads/${p.photo.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
                    if (!res.ok) throw new Error();
                    const data = await res.json();
                    window.open(data.download_url, "_blank");
                  } catch { setMessage("Error al descargar."); }
                }}>
                <div className="card-bought-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="check" size={12} color="#000" /> Comprada</div>
                <WatermarkedImage src={p.photo?.watermark_url} photographer={p.photo?.photographer?.name || "MOTOSHOT"} purchased={true} />
                <div className="card-overlay">
                  <div className="card-photographer">{p.photo?.photographer?.name}</div>
                  <div className="card-location"><IconText icon="pin" size={12}>{p.photo?.location}</IconText></div>
                  <div className="card-footer">
                    <div className="card-price">Q{p.amount}</div>
                    <div style={{ fontSize: 11, background: "var(--success)", color: "#000", padding: "3px 8px", borderRadius: 6, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="arrowRight" size={10} color="#000" style={{ transform: "rotate(90deg)" }} /> Descargar</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMyPurchases = () => {
    const purchaseBtnDisabled = {
      background: "var(--surface)",
      color: "var(--muted)",
      border: "1px solid var(--border)",
      opacity: 0.6,
      cursor: "not-allowed",
    };
    const purchaseBtnActive = {
      background: "linear-gradient(135deg, var(--orange-light), var(--orange))",
      color: "#000",
    };

    const purchaseItems = [
      ...purchases.map((p) => ({ type: "photo", data: p, completed_at: p.completed_at })),
      ...videoPurchases.map((v) => ({ type: "video", data: v, completed_at: v.completed_at })),
    ].sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));

    return (
  <div className="upload-view">
    <SectionTitleIcon icon="purchases">MIS COMPRAS</SectionTitleIcon>
    <div className="section-sub">Volvé a descargar tus fotos y videos comprados.</div>

    {!user ? (
      <div className="empty">
        <EmptyIcon name="lock" />
        <div>Iniciá sesión para ver tu historial de compras.</div>
      </div>
    ) : purchasesLoading ? (
      <div className="empty">
        <LoaderIcon size={44} />
        <div>Cargando compras...</div>
      </div>
    ) : purchaseItems.length === 0 ? (
      <div className="empty">
        <EmptyIcon name="receipt" />
        <div>Todavía no compraste fotos ni videos.</div>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {purchaseItems.map((item) => {
          if (item.type === "photo") {
            const p = item.data;
            const photoDownloaded = Boolean(p.hq_downloaded_at) || p.photo?.hq_status === "downloaded";
            const photoPending = !photoDownloaded && (p.photo?.hq_status === "pending" || !p.photo?.hq_path);
            const photoClaimable = !photoDownloaded && !photoPending;

            return (
              <div
                key={`photo-${p.id}`}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  alignItems: "center",
                  opacity: photoDownloaded ? 0.85 : 1,
                }}
              >
                <div style={{ width: 80, height: 60, borderRadius: 8, overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
                  <img src={p.photo?.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span className="tag" style={{ fontSize: 10, padding: "2px 8px" }}>Foto</span>
                    <span style={{ fontWeight: 600 }}>{p.photo?.photographer?.name || "Fotógrafo"}</span>
                    {photoClaimable && (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "var(--orange)", color: "#000", fontWeight: 700 }}>
                        NUEVO
                      </span>
                    )}
                  </div>
                  <div style={{ color: "var(--muted)", marginTop: 2 }}>
                    <IconText icon="pin" size={12}>{p.photo?.location}</IconText>
                  </div>
                  <div style={{ color: "var(--muted)", marginTop: 2 }}>
                    <IconText icon="money" size={12}>Q{p.amount}</IconText> ·{" "}
                    {p.completed_at ? new Date(p.completed_at).toLocaleString() : "Completado"}
                    {photoPending && (
                      <span style={{ color: "var(--orange)", marginLeft: 6 }}>· Preparando HQ</span>
                    )}
                    {photoDownloaded && (
                      <span style={{ color: "var(--success)", marginLeft: 6 }}>· Descargado</span>
                    )}
                  </div>
                </div>
                <AppButton
                  className="card-buy"
                  disabled={photoDownloaded || photoPending}
                  style={photoDownloaded || photoPending ? purchaseBtnDisabled : purchaseBtnActive}
                  onClick={async () => {
                    if (photoDownloaded || photoPending) return;
                    try {
                      const res = await fetch(`/api/downloads/${p.photo.id}`, {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Error al descargar");
                      if (data.status === "pending") {
                        showToast(data.message || "El fotógrafo está preparando tu foto.");
                        fetchPurchases({ silent: true });
                        return;
                      }
                      if (data.status === "downloaded") {
                        showToast(data.message || "Ya descargaste esta foto.");
                        fetchPurchases({ silent: true });
                        return;
                      }
                      await downloadFromSignedUrl(data.download_url, data.filename);
                      fetchPurchases({ silent: true });
                    } catch (err) {
                      console.error(err);
                      showToast("Error al descargar.");
                    }
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <AppIcon name="arrowRight" size={12} style={{ transform: "rotate(90deg)" }} />
                    {photoDownloaded ? "Descargado" : photoPending ? "Esperando HQ" : "Descargar"}
                  </span>
                </AppButton>
              </div>
            );
          }

          const v = item.data;
          const label =
            [v.video?.moto_brand, v.video?.moto_model].filter(Boolean).join(" ") ||
            v.video?.sector ||
            "Video";
          const hqPending = v.video?.hq_status === "pending";
          const hqDownloaded = Boolean(v.hq_downloaded_at) || v.video?.hq_status === "downloaded";
          const hqClaimable = v.video?.hq_status === "ready" && !v.hq_downloaded_at;

          return (
            <div
              key={`video-${v.id}`}
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                alignItems: "center",
                opacity: hqDownloaded ? 0.85 : 1,
              }}
            >
              <div style={{ width: 80, height: 60, borderRadius: 8, overflow: "hidden", background: "#000", flexShrink: 0 }}>
                <video src={v.video?.preview_url} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1, fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span className="tag" style={{ fontSize: 10, padding: "2px 8px" }}>Video</span>
                  <span style={{ fontWeight: 600 }}>{v.video?.photographer?.name || "Fotógrafo"}</span>
                  {hqClaimable && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "var(--orange)", color: "#000", fontWeight: 700 }}>
                      NUEVO
                    </span>
                  )}
                </div>
                <div style={{ color: "var(--muted)", marginTop: 2 }}>
                  <IconText icon="pin" size={12}>{label}</IconText>
                </div>
                <div style={{ color: "var(--muted)", marginTop: 2 }}>
                  <IconText icon="money" size={12}>Q{v.amount}</IconText> ·{" "}
                  {v.completed_at ? new Date(v.completed_at).toLocaleString() : "Completado"}
                  {hqPending && (
                    <span style={{ color: "var(--orange)", marginLeft: 6 }}>· Disponible en ~24 h</span>
                  )}
                  {hqDownloaded && (
                    <span style={{ color: "var(--success)", marginLeft: 6 }}>· Descargado</span>
                  )}
                </div>
              </div>
              <AppButton
                className="card-buy"
                disabled={hqDownloaded || hqPending}
                style={hqDownloaded || hqPending ? purchaseBtnDisabled : purchaseBtnActive}
                onClick={async () => {
                  if (hqDownloaded || hqPending) return;
                  try {
                    const res = await fetch(`/api/videos/${v.video.id}/download`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Error al descargar");
                    if (data.status === "pending") {
                      showToast(data.message || "El fotógrafo está preparando tu video.");
                      fetchPurchases({ silent: true });
                      return;
                    }
                    if (data.status === "downloaded") {
                      showToast(data.message || "Ya descargaste este video.");
                      fetchPurchases({ silent: true });
                      return;
                    }
                    await downloadFromSignedUrl(data.download_url, data.filename);
                    fetchPurchases({ silent: true });
                  } catch (err) {
                    console.error(err);
                    showToast("Error al descargar el video.");
                  }
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <AppIcon name="arrowRight" size={12} style={{ transform: "rotate(90deg)" }} />
                  {hqDownloaded ? "Descargado" : hqPending ? "Esperando HQ" : "Descargar"}
                </span>
              </AppButton>
            </div>
          );
        })}
      </div>
    )}
  </div>
    );
  };

const renderCeoAccount = () => {
  const pendingWithdrawals = adminWithdrawals.filter((w) => w.status === "pending");
  const activeAdmins = ceoAdmins.filter((a) => a.active).length;
  const summaryLoading = payrollLoading || ceoAdminsLoading || vendorRequestsLoading;
  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "CEO";

  const refreshCeoAccount = () => {
    fetchVendorRequests();
    fetchAdminWithdrawals();
    fetchCeoPayroll();
    fetchCeoAdmins();
  };

  return (
    <div className="upload-view ceo-account-view">
      <SectionTitleIcon icon="profile">CUENTA CEO</SectionTitleIcon>
      <div className="section-sub">Resumen operativo y accesos de alto mando.</div>

      <div className="ceo-account-identity">
        <div className="ceo-account-badge">CEO · Alto mando</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(255,194,102,0.12)",
            border: "2px solid rgba(255,194,102,0.45)",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <AppIcon name="control" size={26} color="#ffc266" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="ceo-account-name">{displayName}</div>
            <div className="ceo-account-email">{user?.email}</div>
            <div className="ceo-account-sub">Cuenta principal · MotoShot GT</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="ceo-account-section-title" style={{ marginBottom: 0 }}>RESUMEN OPERATIVO</div>
        <AppButton className="nav-btn" style={{ fontSize: 11, padding: "5px 10px" }} onClick={refreshCeoAccount}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <AppIcon name="refresh" size={12} />
            {summaryLoading ? "..." : "Actualizar"}
          </span>
        </AppButton>
      </div>

      <div className="ceo-account-stats">
        <div className="ceo-account-stat">
          <div className="ceo-account-stat-value">{summaryLoading ? "—" : vendorRequests.length}</div>
          <div className="ceo-account-stat-label">Solicitudes fotógrafo</div>
        </div>
        <div className="ceo-account-stat">
          <div className="ceo-account-stat-value">{summaryLoading ? "—" : pendingWithdrawals.length}</div>
          <div className="ceo-account-stat-label">Retiros pendientes</div>
        </div>
        <div className="ceo-account-stat highlight">
          <div className="ceo-account-stat-value gold">
            {summaryLoading || payrollData == null ? "—" : `Q${Number(payrollData.totals?.pending_payouts || 0).toFixed(0)}`}
          </div>
          <div className="ceo-account-stat-label">A pagar (planilla)</div>
        </div>
        <div className="ceo-account-stat">
          <div className="ceo-account-stat-value">{summaryLoading ? "—" : activeAdmins}</div>
          <div className="ceo-account-stat-label">Equipo activo</div>
        </div>
      </div>

      {payrollData?.week_label && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -16, marginBottom: 24 }}>
          {payrollData.week_label}
          {payrollData.totals?.weekly_sales != null && (
            <> · Ventas semana: <span style={{ color: "#ffc266" }}>Q{Number(payrollData.totals.weekly_sales).toFixed(2)}</span></>
          )}
        </div>
      )}

      <div className="ceo-account-section-title">ACCESOS RÁPIDOS</div>
      <div className="ceo-account-actions">
        <AppButton
          type="button"
          className="ceo-account-action-btn"
          onClick={() => { setActiveTab("payroll"); setView(VIEWS.CEO_PAYROLL); }}
        >
          <AppIcon name="payroll" size={22} color="#ffc266" />
          Planilla
        </AppButton>
        <AppButton
          type="button"
          className="ceo-account-action-btn"
          onClick={() => { setView(VIEWS.ADMIN); }}
        >
          <AppIcon name="control" size={22} color="#ffc266" />
          Control
        </AppButton>
      </div>

      <div className="ceo-account-section-title">SESIÓN</div>
      <div className="ceo-account-session">
        <div className="ceo-account-session-row">
          <div>
            <div className="ceo-account-session-label">Contraseña</div>
            <div className="ceo-account-session-desc">Actualizá tu acceso a la plataforma</div>
          </div>
          <AppButton
            className="nav-btn"
            style={{ fontSize: 11, whiteSpace: "nowrap" }}
            onClick={() => {
              setNewPassword("");
              setNewPasswordConfirm("");
              setShowPasswordReset(true);
            }}
          >
            Cambiar
          </AppButton>
        </div>
        <div className="ceo-account-session-row">
          <div>
            <div className="ceo-account-session-label">Cerrar sesión</div>
            <div className="ceo-account-session-desc">Salir de la cuenta CEO</div>
          </div>
          <AppButton
            className="nav-btn"
            style={{ fontSize: 11, color: "#ff6b6b", borderColor: "rgba(255,107,107,0.4)", whiteSpace: "nowrap" }}
            onClick={handleLogout}
          >
            Salir
          </AppButton>
        </div>
      </div>
    </div>
  );
};

const subscriptionsListScrollStyle = {
  maxHeight: 300,
  overflowY: "auto",
  overflowX: "hidden",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  paddingRight: 4,
};

const renderMySubscriptionsSection = () => (
  <div style={{ marginBottom: 28, padding: 20, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8 }}>
        <AppIcon name="star" size={18} color="var(--orange)" /> MIS SUSCRIPCIONES
      </div>
      <AppButton className="nav-btn" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => fetchAllSubscriptions()}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="refresh" size={12} /> Actualizar</span>
      </AppButton>
    </div>

    {subsLoading ? (
      <div className="empty" style={{ padding: "24px 0" }}><LoaderIcon size={36} /><div style={{ fontSize: 13, color: "var(--muted)" }}>Cargando...</div></div>
    ) : allSubscriptions.length === 0 ? (
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        No tenés suscripciones activas. Suscribite a un fotógrafo desde su perfil para acceder a contenido exclusivo.
      </p>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {allSubscriptions.filter((s) => s.status === "active").length > 0 && (
          <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
            Activas
          </div>
          <div style={subscriptionsListScrollStyle}>
        {allSubscriptions.filter((s) => s.status === "active").map((sub) => (
          <div
            key={sub.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(255,107,0,0.1) 0%, rgba(255,107,0,0.03) 100%)",
              border: "1px solid rgba(255,107,0,0.35)",
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0, border: "2px solid var(--orange)" }}>
              {sub.photographer?.avatar_url
                ? <img src={sub.photographer.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={20} /></div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{sub.photographer?.name}</div>
              <div style={{ fontSize: 12, color: "var(--orange)" }}>{sub.photographer?.handle}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Q{sub.price}/mes · Vence: {new Date(sub.expires_at).toLocaleDateString("es-GT")}
              </div>
            </div>
            <AppButton
              onClick={() => openCancelSubscriptionConfirm(sub.id)}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,68,68,0.45)",
                color: "#ff6b6b",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              Cancelar
            </AppButton>
          </div>
        ))}
          </div>
          </>
        )}

        {allSubscriptions.filter((s) => s.status !== "active").length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 8, marginBottom: 2 }}>
              Inactivas
            </div>
            <div style={subscriptionsListScrollStyle}>
            {allSubscriptions.filter((s) => s.status !== "active").map((sub) => (
              <div
                key={sub.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 12,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  opacity: 0.92,
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "var(--surface)", flexShrink: 0 }}>
                  {sub.photographer?.avatar_url
                    ? <img src={sub.photographer.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={20} /></div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{sub.photographer?.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{sub.photographer?.handle}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {sub.status === "cancelled" ? "Cancelada" : "Vencida"} · {new Date(sub.expires_at).toLocaleDateString("es-GT")}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <AppButton
                    onClick={() => handleReactivateSubscription(sub)}
                    disabled={subPayLoading}
                    style={{
                      background: "rgba(255,107,0,0.12)",
                      border: "1px solid rgba(255,107,0,0.45)",
                      color: "var(--orange)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Reactivar
                  </AppButton>
                  <AppButton
                    onClick={() => {
                      if (sub.photographer?.id) {
                        fetchPhotographerProfile(sub.photographer.id);
                        setView(VIEWS.PHOTOGRAPHER_PROFILE);
                      }
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Ver perfil
                  </AppButton>
                </div>
              </div>
            ))}
            </div>
          </>
        )}
      </div>
    )}
  </div>
);

const renderVendorRequest = () => {
  // ── No logueado ────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="upload-view">
        <SectionTitleIcon icon="profile">PERFIL</SectionTitleIcon>
        <div className="empty">
          <EmptyIcon name="lock" />
          <div>Iniciá sesión para ver tu perfil.</div>
          <AppButton className="nav-btn primary" style={{ marginTop: 16 }} onClick={() => setView(VIEWS.AUTH)}>
            Iniciar sesión
          </AppButton>
        </div>
      </div>
    );
  }

  // ── CEO: hub de cuenta y resumen operativo ─────────────────────
  if (isCEO) {
    return renderCeoAccount();
  }

  // ── FOTÓGRAFO APROBADO: su propio perfil público + edición ─────
  if (profile?.verification_status === "approved") {
    // Usa selectedPhotographer (cargado por el useEffect al entrar a esta vista)
    const ph = selectedPhotographer?.user_id === user.id ? selectedPhotographer : null;

    return (
      <div style={{ paddingBottom: 100 }}>
        {/* Banner */}
        <div style={{ width: "100%", height: 180, background: (ph?.banner_url || profile.banner_url) ? "none" : "linear-gradient(135deg, #1a1a1a, #ff6b0022)", overflow: "hidden", position: "relative" }}>
          {(ph?.banner_url || profile.banner_url)
            ? <img src={ph?.banner_url || profile.banner_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--orange)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, opacity: 0.2 }}>MOTOSHOT GT</div>}
        </div>

        {/* Info */}
        <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: -36, marginBottom: 16, position: "relative", zIndex: 2 }}>
  <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid var(--orange)", background: "var(--card)", flexShrink: 0 }}>
    {(ph?.avatar_url || profile.avatar_url)
      ? <img src={ph?.avatar_url || profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={24} /></div>}
  </div>
  <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
  <AppButton
      onClick={() => {
        setShowManageSubscriptions((prev) => !prev);
        setEditMode(false);
        fetchAllSubscriptions();
        setTimeout(() => {
          document.getElementById("manage-subscriptions-panel")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }}
      style={{
        background: "linear-gradient(135deg, rgba(255,107,0,0.15), rgba(255,107,0,0.05))",
        border: "1px solid var(--orange)",
        color: "var(--orange)",
        padding: "8px 16px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="creditCard" size={14} /> Manejar Suscripciónes</span>
    </AppButton>
  <AppButton
    onClick={() => {
      const { countryCode, localNumber } = parsePhoneNumber(profile.phone);
      setPhoneCountry(countryCode);
      setPhoneLocal(localNumber);
      setEditMode(!editMode);
      setEditForm({
        name: profile.name || "",
        bio: profile.bio || "",
        handle: profile.handle || "",
        phone: localNumber,
        instagram: profile.instagram || "",
        tiktok: profile.tiktok || "",
        facebook: profile.facebook || "",
        telegram: profile.telegram || "",
        whatsapp: profile.whatsapp || "",
      });
    }}
    style={{
      background: editMode ? "rgba(255,68,68,0.1)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${editMode ? "rgba(255,68,68,0.5)" : "rgba(255,255,255,0.15)"}`,
      color: editMode ? "#ff4444" : "var(--text)",
      padding: "8px 16px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "'DM Sans', sans-serif",
    }}
  >
    {editMode ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="x" size={14} /> Cancelar</span>) : (<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="edit" size={14} /> Editar Perfil</span>)}
  </AppButton>
</div>
</div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 2, textAlign: "center" }}>{profile.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, justifyContent: "center" }}>
                <div style={{ color: "var(--orange)", fontSize: 13 }}>{profile.handle}</div>
                <VerifiedBadge size={16} />
              </div>
              {profile.bio && (
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: formatPhoneDisplay(profile.phone) ? 8 : 20, lineHeight: 1.6, textAlign: "center" }}>
                  {profile.bio}
                </div>
              )}
              {formatPhoneDisplay(profile.phone) && (
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20, lineHeight: 1.6, textAlign: "center" }}>
                  Tel: {formatPhoneDisplay(profile.phone)}
                </div>
              )}
            {renderPhotographerSocialLinks(ph || profile)}

          {/* ── Formulario edición ── */}
          {editMode && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, marginBottom: 16 }}>EDITAR PERFIL</div>

              {/* Avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", background: "var(--card)", border: "2px solid var(--border)", flexShrink: 0 }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={20} /></div>}
                </div>
                <div>
                  <input type="file" id="avatar-input" accept="image/*" style={{ display: "none" }} onChange={e => setAvatarFile(e.target.files[0] || null)} />
                  <AppButton className="nav-btn" onClick={() => document.getElementById("avatar-input").click()}>
                    {avatarFile ? avatarFile.name : "Cambiar avatar"}
                  </AppButton>
                  {avatarFile && (
                    <AppButton className="nav-btn primary" style={{ marginLeft: 8 }} onClick={handleAvatarUpload} disabled={avatarLoading}>
                      {avatarLoading ? "Subiendo..." : "Guardar"}
                    </AppButton>
                  )}
                </div>
              </div>

              {/* Banner */}
              <div className="form-group">
                <label className="form-label">Banner</label>
                <div style={{ width: "100%", height: 80, borderRadius: 10, overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", marginBottom: 8 }}>
                  {profile.banner_url
                    ? <img src={profile.banner_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12 }}>Sin banner</div>}
                </div>
                <input type="file" id="banner-input" accept="image/*" style={{ display: "none" }}
                  onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    setGlobalLoading({ active: true, message: "Subiendo banner..." });
                    try {
                      const formData = new FormData();
                      formData.append("banner", file);
                      const res = await fetch("/api/auth/banner", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${session?.access_token}` },
                        body: formData,
                      });
                      const data = await res.json();
                      if (res.ok) setProfile(prev => ({ ...prev, banner_url: data.banner_url }));
                      else setMessage(data.error);
                    } finally {
                      setGlobalLoading({ active: false, message: "" });
                    }
                  }}/>
                <AppButton className="nav-btn" onClick={() => document.getElementById("banner-input").click()}>
                  {profile.banner_url ? "Cambiar banner" : "Subir banner"}
                </AppButton>
              </div>

              {/* Watermark logo */}
              <div className="form-group">
                <label className="form-label">Logo de marca de agua</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", background: "var(--card)", border: "1px solid var(--border)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {profile.watermark_logo_url
                      ? <img src={profile.watermark_logo_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : <AppIcon name="lock" size={20} color="var(--muted)" />}
                  </div>
                  <div>
                    <input type="file" id="wm-logo-input" accept="image/*" style={{ display: "none" }}
                      onChange={async e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setGlobalLoading({ active: true, message: "Subiendo logo de marca de agua..." });
                        try {
                          const formData = new FormData();
                          formData.append("logo", file);
                          const res = await fetch("/api/auth/watermark-logo", {
                            method: "POST",
                            headers: { Authorization: `Bearer ${session?.access_token}` },
                            body: formData,
                          });
                          const data = await res.json();
                          if (res.ok) setProfile(prev => ({ ...prev, watermark_logo_url: data.watermark_logo_url }));
                          else setMessage(data.error);
                        } finally {
                          setGlobalLoading({ active: false, message: "" });
                        }
                      }} />
                    <AppButton className="nav-btn" onClick={() => document.getElementById("wm-logo-input").click()}>
                      {profile.watermark_logo_url ? "Cambiar logo" : "Subir logo"}
                    </AppButton>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      PNG transparente recomendado. Se aplica en fotos y videos de preview.
                    </div>
                  </div>
                </div>
              </div>

              {/* Campos texto */}
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="form-group">
    <label className="form-label">Handle</label>
  <div style={{ position: "relative" }}>
    <input 
      className="form-input" 
      value={editForm.handle} 
      onChange={async e => {
        const val = e.target.value;
        setEditForm({ ...editForm, handle: val });
        
        if (val.length < 3) return;
        
        // Verificar disponibilidad
        const res = await fetch(`/api/auth/check-handle?handle=${encodeURIComponent(val)}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        setHandleAvailable(data.available);
      }}
      style={{ paddingRight: 40 }}
    />
    {editForm.handle.length >= 3 && handleAvailable !== null && (
      <span style={{ 
        position: "absolute", right: 12, top: "50%", 
        transform: "translateY(-50%)",
        color: handleAvailable ? "var(--success)" : "#ff4444",
        fontSize: 16
      }}>
        {handleAvailable ? <AppIcon name="check" size={12} color="var(--success)" /> : <AppIcon name="x" size={12} color="#ff4444" />}
      </span>
    )}
  </div>
  {editForm.handle.length >= 3 && handleAvailable === false && (
    <div style={{ fontSize: 12, color: "#ff4444", marginTop: 4 }}>
      Ese usuario no está disponible.
    </div>
  )}
  {editForm.handle.length >= 3 && handleAvailable === true && (
    <div style={{ fontSize: 12, color: "var(--success)", marginTop: 4 }}>
      ¡Disponible!
    </div>
  )}
</div>
              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={editForm.bio}
                  onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Contá sobre tu trabajo, eventos, estilo..."
                  style={{ resize: "vertical", lineHeight: 1.6, minHeight: 96 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    className="form-input"
                    style={{ width: "auto", flexShrink: 0 }}
                    value={phoneCountry}
                    onChange={e => {
                      const code = e.target.value;
                      setPhoneCountry(code);
                      setPhoneLocal(prev => normalizePhoneLocal(prev, code));
                    }}
                  >
                    {PHONE_COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    type="tel"
                    autoComplete="tel-national"
                    placeholder="4444-4444"
                    value={phoneLocal}
                    onChange={e => setPhoneLocal(normalizePhoneLocal(e.target.value, phoneCountry))}
                  />
                </div>
              </div>
              {/* Redes sociales */}
<div style={{ marginTop: 8, marginBottom: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, marginBottom: 14, color: "var(--muted)" }}>
    REDES SOCIALES
  </div>

  {[
    {
      key: "instagram", label: "Instagram", placeholder: "@tuusuario",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
        </svg>
      ),
    },
    {
      key: "tiktok", label: "TikTok", placeholder: "@tuusuario",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.79a4.85 4.85 0 01-1.01-.1z"/>
        </svg>
      ),
    },
    {
      key: "facebook", label: "Facebook", placeholder: "nombre.de.pagina",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
    },
    {
      key: "telegram", label: "Telegram", placeholder: "@tuusuario",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
    },
    {
      key: "whatsapp", label: "WhatsApp", placeholder: "50212345678 (con código de país)",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
    },
  ].map(({ key, label, placeholder, icon }) => (
    <div className="form-group" key={key}>
      <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--orange)" }}>{icon}</span>
        {label}
      </label>
      <input
        className="form-input"
        placeholder={placeholder}
        value={editForm[key]}
        onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
      />
    </div>
  ))}
</div>
              <AppButton className="upload-btn" onClick={handleEditProfile} disabled={editLoading}>
                {editLoading ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
              </AppButton>

             {/* Suscripción */}
<div id="subscription-section" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 14 }}>SUSCRIPCIÓN</div>
  <div className="form-group">
    <label className="form-label">Precio mensual (Q) — 0 = sin suscripción</label>
    <input className="form-input" type="number" placeholder="0" defaultValue={profile.subscription_price || ""} id="sub-price-input" />
  </div>
  <div className="form-group">
    <label className="form-label">Beneficios (uno por línea)</label>
    <textarea className="form-input" rows={3} defaultValue={(profile.subscription_benefits || []).join("\n")} id="sub-benefits-input" style={{ resize: "vertical", lineHeight: 1.6 }} />
  </div>
  <AppButton className="nav-btn primary" onClick={async () => {
    const price = document.getElementById("sub-price-input").value;
    const benefits = document.getElementById("sub-benefits-input").value.split("\n").map(b => b.trim()).filter(Boolean);
    const res = await fetch("/api/auth/subscription-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ subscription_price: price ? parseFloat(price) : null, subscription_benefits: benefits }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(prev => ({ ...prev, subscription_price: data.photographer.subscription_price, subscription_benefits: data.photographer.subscription_benefits }));
      showToast("Listo: Configuración de suscripción guardada.");
    } else showToast(data.error || "No se pudo guardar.");
  }}>
    Guardar configuración
  </AppButton>
</div>
</div>
)}

          {showManageSubscriptions && !editMode && (
            <div id="manage-subscriptions-panel" style={{ marginBottom: 24 }}>
              {renderMySubscriptionsSection()}
            </div>
          )}

          {/* Sus fotos */}
          {!editMode && (
  <>
    {/* Tabs */}
    <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20, marginLeft: -20, marginRight: -20, justifyContent: "center" }}>
      {[
        { id: "publicaciones", label: "PUBLICACIONES" },
        { id: "medios", label: "MEDIOS" },
      ].map(tab => (
        <AppButton key={tab.id} onClick={() => setProfileTab(tab.id)}
          style={{ background: "none", border: "none", color: profileTab === tab.id ? "var(--orange)" : "var(--muted)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, padding: "10px 20px", cursor: "pointer", borderBottom: `2px solid ${profileTab === tab.id ? "var(--orange)" : "transparent"}`, transition: "all 0.2s" }}>
          {tab.label}
        </AppButton>
      ))}
    </div>

    {/* ── TAB: PUBLICACIONES ── */}
    {profileTab === "publicaciones" && (
      <div>
        {/* Formulario nueva publicación */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Compartí una actualización con tus seguidores..."
            value={postForm.body}
            onChange={e => setPostForm({ ...postForm, body: e.target.value })}
            style={{ resize: "none", lineHeight: 1.6, marginBottom: 10 }}
          />
          <input
            className="form-input"
            placeholder="URL de imagen (opcional)"
            value={postForm.image_url}
            onChange={e => setPostForm({ ...postForm, image_url: e.target.value })}
            style={{ marginBottom: 10 }}
          />
          <AppButton className="nav-btn primary" style={{ width: "100%" }}
            disabled={postLoading || !postForm.body.trim()}
            onClick={async () => {
              setPostLoading(true);
              try {
                const res = await fetch("/api/auth/posts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
                  body: JSON.stringify(postForm),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                setPosts(prev => [data.post, ...prev]);
                setPostForm({ body: "", image_url: "" });
              } catch (err) {
                setMessage(err.message);
              } finally {
                setPostLoading(false);
              }
            }}>
            {postLoading ? "Publicando..." : (<span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}><AppIcon name="megaphone" size={16} /> PUBLICAR</span>)}
          </AppButton>
        </div>

        {/* Lista de publicaciones */}
        {postsLoading ? (
          <div className="empty"><LoaderIcon size={44} /><div>Cargando...</div></div>
        ) : posts.length === 0 ? (
          <div className="empty"><EmptyIcon name="fileText" /><div>Todavía no publicaste nada.</div></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.map(post => (
              <div key={post.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                {post.image_url && (
                  <img src={post.image_url} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "cover" }} />
                )}
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
                      {profile.avatar_url
                        ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={20} /></div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{profile.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(post.created_at).toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <AppButton
                      onClick={() => {
                        openConfirmDialog({
                          title: "ELIMINAR PUBLICACIÓN",
                          message: "¿Eliminar esta publicación?",
                          confirmLabel: "SÍ, ELIMINAR",
                          cancelLabel: "NO",
                          destructive: true,
                          onConfirm: async () => {
                            const res = await fetch(`/api/auth/posts/${post.id}`, {
                              method: "DELETE",
                              headers: { Authorization: `Bearer ${session?.access_token}` },
                            });
                            if (res.ok) setPosts(prev => prev.filter(p => p.id !== post.id));
                          },
                        });
                      }}
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, padding: 4 }}
                    >
                      Eliminar
                    </AppButton>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}>{post.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* ── TAB: MEDIOS ── */}
    {profileTab === "medios" && (
      <div>
        {(() => {
          const myPhotoCount = photos.filter((p) => p.photographer?.user_id === user?.id).length;
          const myMediaTabBtn = (tab, label, count) => (
            <button
              type="button"
              onClick={() => setMyProfileMediaTab(tab)}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 16,
                letterSpacing: 1,
                padding: "12px 8px",
                background: "none",
                border: "none",
                borderBottom: myProfileMediaTab === tab ? "2px solid var(--orange)" : "2px solid transparent",
                color: myProfileMediaTab === tab ? "var(--orange)" : "var(--muted)",
                cursor: "pointer",
                width: "100%",
              }}
            >
              {label} · {count}
            </button>
          );

          return (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  borderBottom: "1px solid var(--border)",
                }}
                >
                  {myMediaTabBtn("videos", "VIDEOS", myVideos.length)}
                  <div style={{ borderLeft: "1px solid var(--border)" }}>
                    {myMediaTabBtn("photos", "FOTOS", myPhotoCount)}
                  </div>
                </div>
              </div>

              {myProfileMediaTab === "photos" && (
                <>
        {/* Álbumes */}
        {albums.filter(a => photos.filter(p => p.photographer?.user_id === user?.id && p.album_id === a.id).length > 0).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><AppIcon name="folder" size={18} color="var(--orange)" /> ÁLBUMES</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {albums.map(album => {
  const albumPhotos = photos.filter(p => p.photographer?.user_id === user?.id && p.album_id === album.id);
  if (albumPhotos.length === 0) return null;
  const cover = album.cover_url 
  ? album.cover_url.split("?")[0] + `?t=${album.id}`
  : albumPhotos[0]?.watermark_url;

  return (
    <div key={album.id} 
  onClick={() => { setSelectedAlbum(album); setActiveTab("gallery"); setView(VIEWS.MY_GALLERY); }}
  style={{ borderRadius: 10, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}>
      {/* Thumbnail */}
      <div style={{ height: 90, background: "var(--card)", overflow: "hidden", position: "relative" }}>
        {cover && <img src={cover} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}

        {/* Botón cambiar portada */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 6, opacity: 0, transition: "opacity 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0}>
          <AppButton
            onClick={e => { e.stopPropagation(); document.getElementById(`cover-${album.id}`).click(); }}
            style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="image" size={14} /> Portada</span>
          </AppButton>
        </div>

        {/* Input oculto — seleccionar foto del álbum */}
        <input type="file" id={`cover-${album.id}`} accept="image/*" style={{ display: "none" }}
          onChange={async e => {
            const file = e.target.files[0];
            if (!file) return;
            setGlobalLoading({ active: true, message: "Actualizando portada..." });
            try {
              const formData = new FormData();
              formData.append("cover", file);
              const res = await fetch(`/api/auth/album-cover/${album.id}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session?.access_token}` },
                body: formData,
              });
              const data = await res.json();
              if (res.ok) {
                await fetchAlbums(profile.id);
                showToast("Listo: Portada actualizada.")
              } else {
                setMessage(data.error);
              }
            } finally {
              setGlobalLoading({ active: false, message: "" });
            }
          }} />
      </div>

      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontWeight: 700, fontSize: 12 }}>{album.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{albumPhotos.length} foto{albumPhotos.length !== 1 ? "s" : ""}</div>
      </div>
    </div>
  );
})}
            </div>
          </div>
        )}

        {/* Fotos sueltas */}
<div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 12 }}>
  <div style={{ display: "flex", gap: 4 }}>
    {[{ mode: "grid", iconName: "gallery" }, { mode: "feed", iconName: "feed" }].map(({ mode, iconName }) => (
      <AppButton
        key={mode}
        onClick={() => setPhotoViewMode(mode)}
        style={{
          background: photoViewMode === mode ? "var(--orange)" : "var(--surface)",
          border: `1px solid ${photoViewMode === mode ? "var(--orange)" : "var(--border)"}`,
          color: photoViewMode === mode ? "#fff" : "var(--muted)",
          borderRadius: 8, padding: "6px 10px", cursor: "pointer",
          fontSize: 16, transition: "all 0.2s",
        }}
      ><AppIcon name={iconName} size={16} /></AppButton>
    ))}
  </div>
</div>

{photos.filter(p => p.photographer?.user_id === user?.id).length === 0 ? (
  <div className="empty">
    <EmptyIcon name="image" />
    <div>Todavía no subiste fotos.</div>
    <AppButton className="nav-btn primary" style={{ marginTop: 16 }} onClick={() => { setActiveTab("upload"); setView(VIEWS.UPLOAD); }}>
      Subir primera foto
    </AppButton>
  </div>
) : photoViewMode === "grid" ? (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginLeft: -20, marginRight: -20 }}>
    {photos.filter(p => p.photographer?.user_id === user?.id).map(photo => (
      <div
        key={photo.id}
        onClick={() => openPhotoDetail(photo, VIEWS.VENDOR_REQUEST)}
        style={{ aspectRatio: "1", overflow: "hidden", position: "relative", background: "var(--card)", cursor: "pointer" }}
      >
        <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    ))}
  </div>
) : (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {photos.filter(p => p.photographer?.user_id === user?.id).map(photo => (
      <div
        key={photo.id}
        onClick={() => openPhotoDetail(photo, VIEWS.VENDOR_REQUEST)}
        style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}
      >
        <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden" }}>
          <img src={photo.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}><IconText icon="pin" size={12}>{photo.location}</IconText></div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {photo.ride_date || ""}
              {photo.time_start ? ` · ${photo.time_start}${photo.time_end ? `–${photo.time_end}` : ""}` : ""}
            </div>
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "var(--text)" }}>
            Q{photo.price}
          </div>
        </div>
      </div>
    ))}
  </div>
)}

                </>
              )}

              {myProfileMediaTab === "videos" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 12 }}>
            <AppButton
              className="nav-btn primary"
              style={{ fontSize: 11, padding: "6px 12px" }}
              onClick={() => { setUploadMediaTab("video"); setActiveTab("upload"); setView(VIEWS.UPLOAD); }}
            >
              Subir video
            </AppButton>
          </div>

          {myVideosLoading ? (
            <div className="empty" style={{ padding: "24px 0" }}>
              <LoaderIcon size={36} />
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Cargando videos...</div>
            </div>
          ) : myVideos.length === 0 ? (
            <div className="empty">
              <EmptyIcon name="video" />
              <div>Todavía no subiste videos.</div>
              <AppButton
                className="nav-btn primary"
                style={{ marginTop: 16 }}
                onClick={() => { setUploadMediaTab("video"); setActiveTab("upload"); setView(VIEWS.UPLOAD); }}
              >
                Subir primer video
              </AppButton>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myVideos.map((video) => {
                const label =
                  [video.moto_brand, video.moto_model].filter(Boolean).join(" ") ||
                  video.sector ||
                  "Video";
                const hqReady = video.hq_status === "ready";
                return (
                  <div
                    key={video.id}
                    style={{
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000" }}>
                      <video
                        src={video.preview_url}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      {video.duration_seconds ? (
                        <div style={{
                          position: "absolute", bottom: 8, right: 8,
                          background: "rgba(0,0,0,0.8)", color: "#fff",
                          padding: "2px 6px", borderRadius: 4, fontSize: 11,
                        }}>
                          {`${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, "0")}`}
                        </div>
                      ) : null}
                      <div style={{
                        position: "absolute", top: 8, left: 8,
                        background: hqReady ? "rgba(0,200,100,0.85)" : "rgba(255,107,0,0.85)",
                        color: "#fff", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                      }}>
                        {hqReady ? "HQ listo" : "Preview"}
                      </div>
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {video.moto_brand && (
                          <span className="tag active" style={{ fontSize: 11 }}>{video.moto_brand} {video.moto_model}</span>
                        )}
                        {video.sector && (
                          <span className="tag" style={{ fontSize: 11 }}><IconText icon="pin" size={10}>{video.sector}</IconText></span>
                        )}
                        {video.dorsal && (
                          <span className="tag" style={{ fontSize: 11, color: "var(--orange)" }}>#{video.dorsal}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {video.event_time_start ? `${video.event_time_start}${video.event_time_end ? `–${video.event_time_end}` : ""}` : ""}
                          {video.purchases_count > 0 && (
                            <span style={{ marginLeft: video.event_time_start ? 8 : 0 }}>
                              · {video.purchases_count} venta{video.purchases_count !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "var(--orange)" }}>
                          Q{video.price}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
              )}
            </>
          );
        })()}
      </div>
    )}

          </>
          )}
        </div>
      </div>
    );
  }

  // ── SIN PERFIL: formulario de solicitud + buyer profile ────────
  if (!profile) {
    return (
      <div className="upload-view">
        <SectionTitleIcon icon="profile">PERFIL</SectionTitleIcon>

        {/* Info básica del comprador */}
        <div style={{ padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--card)", border: "2px solid var(--border)", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden" }}><AvatarPlaceholder size={24} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{getUserDisplayName()}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, wordBreak: "break-word" }}>{user.email}</div>
              <div style={{ fontSize: 11, color: "var(--orange)", marginTop: 6, fontWeight: 600, letterSpacing: "0.04em" }}>Comprador</div>
            </div>
          </div>
        </div>

        {renderMySubscriptionsSection()}

        {/* CTA fotógrafo */}
        <div style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.1), rgba(255,107,0,0.04))", border: "1px solid var(--orange)", borderRadius: 14, padding: 20, marginBottom: 28 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, marginBottom: 8 }}>¿SOS FOTÓGRAFO?</div>
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Creá tu perfil verificado, subí tus fotos de rodada y empezá a vender. El proceso es rápido y gratuito.
          </div>
          <AppButton className="upload-btn" onClick={() => setProfile({ _requestMode: true })}>
            QUIERO SER FOTÓGRAFO
          </AppButton>
        </div>

        <AppButton className="close-btn-secondary" onClick={handleLogout}>Cerrar sesión</AppButton>
      </div>
    );
  }

  // ── PERFIL PENDIENTE / RECHAZADO ───────────────────────────────
  if (profile._requestMode) {
    return (
      <div className="upload-view">
        <div className="section-title">SOLICITAR PERFIL</div>
        <div className="section-sub">Completá el formulario para verificar tu cuenta.</div>

        <div className="form-group">
          <label className="form-label">Nombre completo</label>
          <input className="form-input" value={vendorForm.name} onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} placeholder="Juan Pérez" />
        </div>
        <div className="form-group">
          <label className="form-label">Handle público</label>
          <input className="form-input" value={vendorForm.handle} onChange={e => setVendorForm({ ...vendorForm, handle: e.target.value })} placeholder="@juanmotos" />
        </div>
        <div className="form-group">
  <label className="form-label">Tipo de documento</label>
  <select className="form-input"
    value={vendorForm.doc_type || "dpi"}
    onChange={e => setVendorForm({ ...vendorForm, doc_type: e.target.value, verification_id: "" })}>
    <option value="dpi">DPI — Documento Personal de Identificación</option>
    <option value="licencia">Licencia de Conducir</option>
    <option value="pasaporte">Pasaporte</option>
  </select>
</div>

<div className="form-group">
  <label className="form-label">
    {vendorForm.doc_type === "licencia" ? "Número de Licencia" : vendorForm.doc_type === "pasaporte" ? "Número de Pasaporte" : "Número de DPI"}
  </label>
  <input
    className="form-input"
    value={vendorForm.verification_id}
    placeholder={
      vendorForm.doc_type === "licencia" ? "A123456" :
      vendorForm.doc_type === "pasaporte" ? "A1234567" :
      "2530-35070-0101"
    }
    maxLength={vendorForm.doc_type === "dpi" ? 15 : vendorForm.doc_type === "licencia" ? 7 : 8}
    style={{
      borderColor: vendorForm.verification_id ? ((() => {
        if (vendorForm.doc_type === "dpi") return /^\d{4}-\d{5}-\d{4}$/.test(vendorForm.verification_id);
        if (vendorForm.doc_type === "licencia") return /^[A-Za-z]\d{6}$/.test(vendorForm.verification_id);
        if (vendorForm.doc_type === "pasaporte") return /^[A-Za-z]\d{7}$/.test(vendorForm.verification_id);
      })() ? "var(--success)" : "#ff4444") : "var(--border)"
    }}
    onChange={e => {
      let val = e.target.value;
      if (vendorForm.doc_type === "dpi") {
        let digits = val.replace(/[^0-9]/g, "").slice(0, 13);
        if (digits.length > 9) val = digits.slice(0,4) + "-" + digits.slice(4,9) + "-" + digits.slice(9);
        else if (digits.length > 4) val = digits.slice(0,4) + "-" + digits.slice(4);
        else val = digits;
      } else if (vendorForm.doc_type === "licencia") {
        val = val.slice(0,1).toUpperCase().replace(/[^A-Z]/g,"") + val.slice(1).replace(/[^0-9]/g,"").slice(0,6);
      } else if (vendorForm.doc_type === "pasaporte") {
        val = val.slice(0,1).toUpperCase().replace(/[^A-Z]/g,"") + val.slice(1).replace(/[^0-9]/g,"").slice(0,7);
      }
      setVendorForm({ ...vendorForm, verification_id: val });
    }}
  />
  {vendorForm.verification_id && !((() => {
    if (vendorForm.doc_type === "dpi") return /^\d{4}-\d{5}-\d{4}$/.test(vendorForm.verification_id);
    if (vendorForm.doc_type === "licencia") return /^[A-Za-z]\d{6}$/.test(vendorForm.verification_id);
    if (vendorForm.doc_type === "pasaporte") return /^[A-Za-z]\d{7}$/.test(vendorForm.verification_id);
  })()) && (
    <div style={{ fontSize: 12, color: "#ff4444", marginTop: 4 }}>
      {vendorForm.doc_type === "dpi" ? "Formato inválido. Ejemplo: 2530-35070-0101" :
       vendorForm.doc_type === "licencia" ? "Formato inválido. Ejemplo: A123456 (letra + 6 números)" :
       "Formato inválido. Ejemplo: A1234567 (letra + 7 números)"}
    </div>
  )}
</div>

{/* Fotos del documento */}
<div className="form-group">
  <label className="form-label">Foto frontal del documento</label>
  <div style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: 16, textAlign: "center", cursor: "pointer", background: "var(--surface)", borderColor: vendorForm.doc_front ? "var(--success)" : "var(--border)" }}
    onClick={() => document.getElementById("doc-front-input").click()}>
    {vendorForm.doc_front ? (
      <img src={URL.createObjectURL(vendorForm.doc_front)} alt="Frontal" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8 }} />
    ) : (
      <>
        <EmptyIcon name="document" size={28} />
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Toca para subir <strong style={{ color: "var(--orange)" }}>parte frontal</strong></div>
      </>
    )}
  </div>
  <input id="doc-front-input" type="file" accept="image/*" style={{ display: "none" }}
    onChange={e => setVendorForm({ ...vendorForm, doc_front: e.target.files[0] || null })} />
</div>

<div className="form-group">
  <label className="form-label">Foto posterior del documento</label>
  <div style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: 16, textAlign: "center", cursor: "pointer", background: "var(--surface)", borderColor: vendorForm.doc_back ? "var(--success)" : "var(--border)" }}
    onClick={() => document.getElementById("doc-back-input").click()}>
    {vendorForm.doc_back ? (
      <img src={URL.createObjectURL(vendorForm.doc_back)} alt="Posterior" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8 }} />
    ) : (
      <>
        <EmptyIcon name="document" size={28} />
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Toca para subir <strong style={{ color: "var(--orange)" }}>parte posterior</strong></div>
      </>
    )}
  </div>
  <input id="doc-back-input" type="file" accept="image/*" style={{ display: "none" }}
    onChange={e => setVendorForm({ ...vendorForm, doc_back: e.target.files[0] || null })} />
</div>
        <div className="form-group">
          <label className="form-label">Bio corta (opcional)</label>
          <input className="form-input" value={vendorForm.bio} onChange={e => setVendorForm({ ...vendorForm, bio: e.target.value })} placeholder="Fotógrafo de rodadas en Guatemala" />
        </div>
        <AppButton className="upload-btn"
  disabled={!vendorForm.name || !vendorForm.handle || !((() => {
    if (vendorForm.doc_type === "dpi") return /^\d{4}-\d{5}-\d{4}$/.test(vendorForm.verification_id);
    if (vendorForm.doc_type === "licencia") return /^[A-Za-z]\d{6}$/.test(vendorForm.verification_id);
    if (vendorForm.doc_type === "pasaporte") return /^[A-Za-z]\d{7}$/.test(vendorForm.verification_id);
  })()) || !vendorForm.doc_front || !vendorForm.doc_back}
  style={{ opacity: (!vendorForm.name || !vendorForm.handle || !vendorForm.doc_front || !vendorForm.doc_back) ? 0.5 : 1 }}
  onClick={handleRequestVendor}>
  ENVIAR SOLICITUD
</AppButton>
        <AppButton className="close-btn-secondary" style={{ marginTop: 12 }} onClick={() => setProfile(null)}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Volver</span></AppButton>
      </div>
    );
  }

  // Pendiente de aprobación
  return (
    <div className="upload-view">
      <SectionTitleIcon icon="profile">PERFIL</SectionTitleIcon>
      <div style={{ padding: 16, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{getUserDisplayName()}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>{user.email}</div>
        {profile.handle && <div style={{ fontSize: 12, color: "var(--orange)" }}>{profile.handle}</div>}
      </div>
      {renderMySubscriptionsSection()}
      <div className="empty">
        <LoaderIcon size={44} />
        <div>Tu solicitud está <strong style={{ color: "var(--orange)" }}>{profile.verification_status}</strong>.<br />Esperá la aprobación del administrador.</div>
      </div>
      <AppButton className="close-btn-secondary" style={{ marginTop: 12 }} onClick={handleLogout}>Cerrar sesión</AppButton>
    </div>
  );
};

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700&family=Fugaz+One&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --bg: #0c0c0c; --surface: #161616; --card: #1c1c1c; --border: #2a2a2a;
      --orange: #ff6b00; --orange-light: #ffb347; --orange-glow: rgba(255,107,0,0.18);
      --text: #f0ece4; --muted: #6a6a6a; --success: #ff9a3c; --success-glow: rgba(255,107,0,0.22); }
    body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
    button, a { -webkit-tap-highlight-color: transparent; tap-highlight-color: transparent; }
    .app { min-height: 100vh; display: flex; flex-direction: column; }
    .ptr-indicator {
      position: fixed; top: 58px; left: 0; right: 0; z-index: 99;
      display: flex; justify-content: center; pointer-events: none;
      transition: opacity 0.2s ease, transform 0.15s ease;
    }
    .ptr-indicator-bubble {
      width: 46px; height: 46px; border-radius: 50%;
      background: rgba(16,16,16,0.94);
      border: 1px solid rgba(255,107,0,0.42);
      box-shadow: 0 6px 24px rgba(0,0,0,0.45), 0 0 18px rgba(255,107,0,0.12);
      display: grid; place-items: center;
      transition: transform 0.12s ease;
    }
    .ptr-indicator-bubble--spin { animation: ptrSpin 0.85s linear infinite; }
    @keyframes ptrSpin { to { transform: rotate(360deg); } }
    .app-content-shift {
      will-change: transform;
      transition: transform 0.18s ease;
    }
    .nav { position: sticky; top: 0; z-index: 100; background: rgba(12,12,12,0.94); backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: sp
      ace-between; padding: 0 20px; height: 58px; }
    .nav-logo { display: flex; align-items: center; cursor: pointer; flex-shrink: 0; }
    .hero-title { display: flex; justify-content: center; }
    .brand-mark {
      display: inline-flex; align-items: flex-end; line-height: 0.88;
      font-family: 'Fugaz One', 'Bebas Neue', sans-serif;
      font-weight: 400; font-style: italic; text-transform: uppercase;
      letter-spacing: 0.03em; transform: skewX(-8deg);
      filter: drop-shadow(0 2px 10px rgba(0,0,0,0.35));
    }
    .brand-mark-word { position: relative; display: inline-block; }
    .brand-mark-word::after {
      content: ''; position: absolute; left: 4%; right: -2%; bottom: 0.05em; height: 0.14em; min-height: 3px;
      background: linear-gradient(90deg, transparent 12%, var(--orange) 20%, var(--orange) 100%);
      transform: skewX(-20deg); border-radius: 1px; opacity: 0.95;
    }
    .brand-mark-moto {
      color: var(--text);
      text-shadow: 1px 1px 0 rgba(0,0,0,0.35);
    }
    .brand-mark-shot {
      color: var(--orange);
      text-shadow: 0 0 12px rgba(255,107,0,0.35);
    }
    .brand-mark-gt {
      color: var(--orange); font-size: 0.55em; margin-left: 0.05em; margin-bottom: 0.14em;
      letter-spacing: 0.06em; text-shadow: 0 0 12px rgba(255,107,0,0.35);
    }
    .brand-mark--nav { font-size: 1.28rem; transform: skewX(-7deg); }
    .brand-mark--nav .brand-mark-word::after { min-height: 2px; height: 0.12em; }
    .brand-mark--hero, .brand-mark--hero-video { font-size: clamp(2.65rem, 9.5vw, 4.6rem); transform: skewX(-9deg); }
    .brand-mark--hero-video { opacity: 0.78; }
    .brand-mark--hero-video .brand-mark-moto { color: #fff; }
    .brand-mark--hero-video .brand-mark-shot, .brand-mark--hero-video .brand-mark-gt { color: var(--orange); }
    .brand-mark--hero-video .brand-mark-word::after { min-height: 4px; }
    .nav-actions { display: flex; gap: 8px; align-items: center; margin-left: auto; flex-shrink: 0; }
    .nav-btn { background: none; border: 1px solid var(--border); color: var(--muted); padding: 8px 14px; border-radius: 8px;
      font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer; transition: border-color 0.2s, color 0.2s, background 0.2s; }
    .nav-btn-sm { padding: 5px 10px; font-size: 11px; border-radius: 7px; white-space: nowrap; line-height: 1.15; letter-spacing: 0.2px; }
    .nav-btn:hover { border-color: var(--orange); color: var(--text); }
    .nav-btn.primary { background: var(--orange); border-color: var(--orange); color: #fff; font-weight: 700; }
    .nav-btn.primary:hover { background: #e55e00; }
    .nav-role-btn { font-size: 11px !important; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 5px 12px !important; border-radius: 999px !important; line-height: 1.2; }
    .nav-role-admin { color: #d4c4a8 !important; border-color: rgba(212, 196, 168, 0.35) !important; background: rgba(212, 196, 168, 0.06) !important; }
    .nav-role-admin:hover { border-color: rgba(212, 196, 168, 0.55) !important; color: #f0e6d4 !important; }
    .nav-role-ceo { color: #ffc266 !important; border-color: rgba(255, 194, 102, 0.45) !important; background: linear-gradient(135deg, rgba(255,107,0,0.14), rgba(255,194,102,0.08)) !important; box-shadow: 0 0 14px rgba(255,107,0,0.12); }
    .nav-role-ceo:hover { border-color: rgba(255, 194, 102, 0.7) !important; color: #ffe0a8 !important; }
    .admin-panel { position: relative; }
    .admin-panel-badge { position: absolute; top: 0; right: 0; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); }
    .admin-panel-badge-admin { color: #d4c4a8; border-color: rgba(212, 196, 168, 0.35); background: rgba(212, 196, 168, 0.06); }
    .admin-panel-badge-ceo { color: #ffc266; border-color: rgba(255, 194, 102, 0.45); background: linear-gradient(135deg, rgba(255,107,0,0.12), rgba(255,194,102,0.06)); }
    .admin-panel-ceo { border-top: 1px solid rgba(255, 194, 102, 0.12); padding-top: 8px; }
    .bottom-nav-ceo .bnav-bubble-inner {
      border-color: #ffc266;
      color: #ffc266;
      box-shadow: 0 0 0 4px rgba(255, 194, 102, 0.12), 0 8px 28px rgba(255, 194, 102, 0.3);
    }
    .bottom-nav-ceo .bnav-item.active { color: #ffc266; }
    .bottom-nav-ceo .bnav-item.active .bnav-icon-slot { color: #ffc266; }
    .ceo-payroll-view { max-width: 720px; }
    .ceo-payroll-week {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 20px;
      letter-spacing: 1px;
      color: #ffc266;
      margin-bottom: 16px;
    }
    .ceo-payroll-totals {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }
    @media (max-width: 520px) {
      .ceo-payroll-totals { grid-template-columns: 1fr; }
    }
    .pending-delivery-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
    }
    .pending-delivery-card {
      background: var(--surface);
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(255, 107, 0, 0.35);
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }
    .pending-delivery-top {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      gap: 14px;
      align-items: start;
      width: 100%;
      min-width: 0;
    }
    .pending-delivery-thumb {
      width: 88px;
      height: 66px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      background: #000;
      object-fit: cover;
    }
    .pending-delivery-thumb video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .pending-delivery-info {
      min-width: 0;
      overflow: hidden;
    }
    .pending-delivery-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }
    .pending-delivery-type {
      font-size: 10px;
      padding: 2px 8px;
      flex-shrink: 0;
    }
    .pending-delivery-title {
      font-weight: 700;
      font-size: 15px;
      line-height: 1.3;
      word-break: break-word;
    }
    .pending-delivery-meta {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .pending-delivery-time {
      color: var(--orange);
      font-size: 13px;
      margin-top: 4px;
      line-height: 1.4;
      white-space: normal;
    }
    .pending-delivery-btn {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--orange);
      border: none;
      border-radius: 10px;
      color: #fff;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 17px;
      letter-spacing: 1px;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .pending-delivery-btn:hover:not(:disabled) { background: #e55e00; }
    .pending-delivery-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pending-delivery-progress {
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pending-delivery-progress-track {
      width: 100%;
      height: 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 106, 0, 0.25);
      overflow: hidden;
    }
    .pending-delivery-progress-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--orange), #ff8c33);
      transition: width 0.25s ease;
    }
    .pending-delivery-progress-fill.is-processing {
      animation: hq-progress-pulse 1.2s ease-in-out infinite;
    }
    @keyframes hq-progress-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }
    .pending-delivery-progress-label {
      text-align: center;
      font-size: 13px;
      color: var(--orange);
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 1px;
    }
    .video-queue {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 320px;
      overflow-y: auto;
    }
    .video-queue-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
    }
    .video-queue-item--uploading { border-color: var(--orange); }
    .video-queue-item--done { border-color: rgba(76, 217, 100, 0.4); }
    .video-queue-item--error { border-color: rgba(255, 68, 68, 0.5); }
    .video-queue-status {
      flex-shrink: 0;
      width: 18px;
      display: grid;
      place-items: center;
    }
    .video-queue-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--muted);
      display: block;
    }
    .video-queue-info { flex: 1; min-width: 0; }
    .video-queue-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .video-queue-meta {
      font-size: 11px;
      color: var(--muted);
      margin-top: 2px;
      overflow-wrap: anywhere;
    }
    .video-queue-item--error .video-queue-meta { color: #ff6b6b; }
    .video-queue-remove {
      flex-shrink: 0;
      background: none;
      border: 1px solid var(--border);
      color: var(--muted);
      width: 26px;
      height: 26px;
      border-radius: 7px;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
    }
    .video-queue-remove:hover { border-color: #ff4444; color: #ff4444; }
    .video-queue-progress {
      height: 6px;
      border-radius: 999px;
      background: var(--card);
      border: 1px solid var(--border);
      overflow: hidden;
      margin-bottom: 10px;
    }
    .video-queue-progress-bar {
      height: 100%;
      background: var(--orange);
      border-radius: 999px;
      transition: width 0.4s ease;
    }
    .ceo-payroll-stat {
      background: var(--surface);
      border: 1px solid rgba(255, 194, 102, 0.2);
      border-radius: 12px;
      padding: 14px;
      text-align: center;
    }
    .ceo-payroll-stat-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .ceo-payroll-stat-value {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      letter-spacing: 1px;
      color: var(--text);
    }
    .ceo-payroll-stat-highlight { color: #ffc266; }
    .ceo-payroll-table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); }
    .ceo-payroll-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .ceo-payroll-table th {
      text-align: left;
      padding: 10px 12px;
      background: rgba(255, 194, 102, 0.08);
      color: #ffc266;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ceo-payroll-table td {
      padding: 12px;
      border-top: 1px solid var(--border);
      vertical-align: top;
    }
    .ceo-payroll-name { font-weight: 700; font-size: 14px; }
    .ceo-payroll-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .ceo-payroll-pay { color: var(--success); font-weight: 700; }
    .ceo-payroll-bank { font-size: 12px; color: var(--text); max-width: 140px; word-break: break-word; }
    .ceo-account-view { max-width: 540px; }
    .ceo-account-identity {
      padding: 18px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(255,107,0,0.08), rgba(255,194,102,0.04));
      border: 1px solid rgba(255, 194, 102, 0.28);
      margin-bottom: 24px;
    }
    .ceo-account-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #ffc266;
      border: 1px solid rgba(255, 194, 102, 0.45);
      background: rgba(255, 194, 102, 0.08);
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 14px;
    }
    .ceo-account-name { font-weight: 700; font-size: 18px; margin-bottom: 4px; }
    .ceo-account-email { font-size: 13px; color: var(--muted); word-break: break-word; }
    .ceo-account-sub { font-size: 12px; color: rgba(255, 194, 102, 0.85); margin-top: 10px; }
    .ceo-account-section-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 20px;
      letter-spacing: 1px;
      color: #ffc266;
      margin-bottom: 12px;
    }
    .ceo-account-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 28px;
    }
    .ceo-account-stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
    }
    .ceo-account-stat.highlight {
      border-color: rgba(255, 194, 102, 0.35);
      background: rgba(255, 194, 102, 0.04);
    }
    .ceo-account-stat-value {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      letter-spacing: 1px;
      color: var(--text);
      line-height: 1;
    }
    .ceo-account-stat-value.gold { color: #ffc266; }
    .ceo-account-stat-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      margin-top: 6px;
    }
    .ceo-account-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 28px;
    }
    .ceo-account-action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 194, 102, 0.3);
      background: rgba(255, 194, 102, 0.06);
      color: #ffc266;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    }
    .ceo-account-action-btn:hover {
      border-color: rgba(255, 194, 102, 0.55);
      background: rgba(255, 194, 102, 0.1);
    }
    .ceo-account-session {
      padding: 16px;
      border-radius: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .ceo-account-session-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .ceo-account-session-row:last-child { border-bottom: none; padding-bottom: 0; }
    .ceo-account-session-row:first-child { padding-top: 0; }
    .ceo-account-session-label { font-size: 13px; color: var(--text); font-weight: 600; }
    .ceo-account-session-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .admin-section-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px; margin-bottom: 12px; }
    .admin-section-title-ceo { color: #ffc266; }
    .admin-request-card, .admin-profile-card { padding: 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); }
    .admin-request-card { border-color: rgba(255,107,0,0.25); }
    .admin-profile-card-suspended { opacity: 0.72; border-color: rgba(255, 107, 107, 0.35); }
    .admin-status-pill { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
    .admin-status-approved { color: var(--success); border-color: rgba(255,140,51,0.35); background: rgba(255,107,0,0.08); }
    .admin-status-pending { color: var(--orange); border-color: rgba(255,107,0,0.35); background: rgba(255,107,0,0.08); }
    .admin-status-rejected, .admin-status-suspended { color: #ff8a8a; border-color: rgba(255,138,138,0.35); background: rgba(255,138,138,0.08); }
    .hero { padding: 44px 20px 28px; text-align: center; background: radial-gradient(circle at top, rgba(255,107,0,0.12), transparent 70%); border-bottom: 1px solid var(--border); }
    .hero-sub { color: var(--muted); font-size: 15px; margin-top: 10px; font-weight: 300; }
    .hero-video-bg { background: transparent; }
    .hero-video-bg::-webkit-media-controls { display: none !important; }
    .hero-video-bg::-webkit-media-controls-start-playback-button { display: none !important; -webkit-appearance: none; }
    .hero-video-bg::-webkit-media-controls-overlay-play-button { display: none !important; }
    .video-card-media { overflow: hidden; }
    .video-card-static-banner {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; z-index: 3; pointer-events: none;
      opacity: 1; transition: opacity 0.4s ease;
    }
    .video-card-static-banner.is-hidden { opacity: 0; visibility: hidden; }
    .video-card-preview {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; background: #0a0a0a; z-index: 2;
      opacity: 0; pointer-events: none;
      transition: opacity 0.35s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .video-card-preview.is-ready { opacity: 1; }
    .video-card-preview.is-playing { opacity: 1; z-index: 8; pointer-events: auto; }
    .video-card-preview::-webkit-media-controls { display: none !important; }
    .video-card-preview::-webkit-media-controls-start-playback-button { display: none !important; -webkit-appearance: none; }
    .video-card-preview::-webkit-media-controls-overlay-play-button { display: none !important; }
    .video-card-preview::-webkit-media-controls-panel { display: none !important; }
    .video-card-poster-cover {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; z-index: 4; pointer-events: none;
      opacity: 0; transition: opacity 0.35s ease;
    }
    .video-card-poster-cover.is-visible { opacity: 1; }
    .video-card-watermark {
      position: absolute; inset: 0; z-index: 5; pointer-events: none;
    }
    .gallery-video-poster { opacity: 0; transition: opacity 0.35s ease; }
    .gallery-video-preview.is-ready { opacity: 1 !important; }
    .gallery-video-poster.is-visible { opacity: 1; }
    .search-bar { display: flex; gap: 10px; margin: 20px; }
    .search-input { flex: 1; background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 12px 16px;
      border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; }
    .search-input:focus { border-color: var(--orange); }
    .search-input::placeholder { color: var(--muted); }
    .search-results-heading {
      font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 1.5px;
      color: var(--muted); margin-bottom: 10px;
    }
    .photo-search-match {
      font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
      padding: 3px 7px; border-radius: 20px;
      background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--muted);
    }
    .photo-search-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;
    }
    .photo-search-card {
      border-radius: 12px; overflow: hidden; background: var(--surface);
      border: 1px solid var(--border); cursor: pointer; transition: border-color 0.2s, transform 0.2s;
    }
    .photo-search-card:hover { border-color: var(--orange); transform: translateY(-2px); }
    .photo-search-thumb { aspect-ratio: 4/3; background: var(--card); overflow: hidden; }
    .photo-search-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .photo-search-body { padding: 12px 14px 14px; }
    .photo-search-tag {
      font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px;
      background: rgba(255,107,0,0.12); border: 1px solid rgba(255,107,0,0.35); color: var(--orange);
    }
    .tag-row { display: flex; gap: 8px; padding: 0 20px 20px; overflow-x: auto; scrollbar-width: none; }
    .tag { white-space: nowrap; padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 13px; cursor: pointer; transition: all 0.2s; }
    .tag.active { background: var(--orange); border-color: var(--orange); color: #fff; font-weight: 700; }
    .tag:hover:not(.active) { border-color: var(--orange); color: var(--text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2px; padding: 0 2px 80px; }
    .card { position: relative; overflow: hidden; background: var(--card); aspect-ratio: 4/3; cursor: pointer; transition: transform 0.3s; }
    .card:hover { z-index: 2; transform: scale(1.02); }
    .card-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%);
      opacity: 0; transition: opacity 0.25s; display: flex; flex-direction: column; justify-content: flex-end; padding: 16px; }
    .card:hover .card-overlay { opacity: 1; }
    .card-photographer { font-size: 12px; color: var(--orange); font-weight: 700; letter-spacing: 0.5px; }
    .card-location { font-size: 11px; color: rgba(240,236,228,0.7); margin-top: 2px; }
    .card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .card-price { font-family: 'Bebas Neue', sans-serif; font-size: 22px; color: #fff; letter-spacing: 1px; }
    .card-buy { background: var(--orange); color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.2s; font-family: 'DM Sans', sans-serif; }
    .card-buy:hover { background: #e55e00; }
    .card-bought-badge, .card-ceo-badge { position: absolute; top: 10px; right: 10px; background: linear-gradient(135deg, var(--orange-light), var(--orange)); color: #000; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 20px; z-index: 5; box-shadow: 0 0 12px var(--success-glow); }
    .card-buy-download { background: linear-gradient(135deg, var(--orange-light), var(--orange)) !important; color: #000 !important; }
    .card-photo-badge { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.65); color: var(--orange); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; z-index: 5; border: 1px solid rgba(255,107,0,0.3); }
    .modal-backdrop { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.88); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.3s ease-out; }
    .confirm-dialog-modal { border-color: rgba(255,107,0,0.35); box-shadow: 0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,107,0,0.08); }
    .confirm-dialog-modal .modal-title { color: var(--orange-light); letter-spacing: 1.5px; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .modal-header { padding: 20px 20px 0; display: flex; justify-content: space-between; align-items: center; }
    .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px; color: var(--text); }
    .modal-close { background: var(--card); border: 1px solid var(--border); color: var(--muted); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .modal-close:hover { color: var(--text); border-color: var(--orange); }
    .modal-photo { width: 100%; aspect-ratio: 4/3; margin: 16px 0 0; overflow: hidden; }
    .modal-body { padding: 16px 20px 24px; }
    .modal-meta { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .modal-meta-photographer { color: var(--orange); font-weight: 700; font-size: 14px; }
    .modal-meta-location { color: var(--muted); font-size: 12px; margin-top: 2px; }
    .modal-price { font-family: 'Bebas Neue', sans-serif; font-size: 36px; color: var(--text); letter-spacing: 1px; }
    .modal-price-unit { font-size: 14px; color: var(--muted); }
    .pay-label { font-size: 12px; color: var(--muted); letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 700; text-transform: uppercase; }
    .pay-methods { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .pay-method { display: flex; align-items: center; gap: 10px; background: var(--card); border: 1.5px solid var(--orange); background: var(--orange-glow);
      border-radius: 10px; padding: 12px 14px; color: var(--text); font-size: 14px; }
    .pay-method-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--orange); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .pay-method-dot::after { content: ''; display: block; width: 8px; height: 8px; border-radius: 50%; background: var(--orange); }
    .pay-btn, .upload-btn { width: 100%; padding: 14px; background: var(--orange); border: none; border-radius: 10px; color: #fff;
      font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; }
    .pay-btn:hover:not(:disabled), .upload-btn:hover:not(:disabled) { background: #e55e00; }
    .pay-btn:disabled, .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .download-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, var(--orange-light), var(--orange)); border: 1px solid rgba(255,140,51,0.45); border-radius: 10px; color: #0c0c0c;
      font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 18px var(--success-glow); }
    .download-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(255,107,0,0.35); }
    .processing { text-align: center; padding: 32px 0; }
    .processing-spinner { width: 48px; height: 48px; border: 3px solid var(--border); border-top-color: var(--orange); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .processing-text { color: var(--muted); font-size: 14px; }
    .close-btn-secondary { width: 100%; padding: 12px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; color: var(--muted); font-family: 'DM Sans', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s; }
    .close-btn-secondary:hover { color: var(--text); border-color: var(--orange); }
    .upload-view { padding: 24px 20px 80px; max-width: 540px; margin: 0 auto; }
    .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 2px; color: var(--text); margin-bottom: 6px; }
    .section-sub { color: var(--muted); font-size: 14px; margin-bottom: 28px; }
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .form-input { width: 100%; background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 12px 14px; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; }
    .form-input:focus { border-color: var(--orange); }
    .form-input::placeholder { color: var(--muted); }
    .password-toggle-btn {
      position: absolute;
      right: 6px;
      top: 0;
      bottom: 0;
      width: 36px;
      height: 36px;
      margin: auto 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      color: var(--muted);
      border-radius: 8px;
      flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
      transition: color 0.2s, background 0.2s;
    }
    .password-toggle-btn:hover { color: var(--orange); background: rgba(255,107,0,0.1); }
    .password-toggle-btn:active { background: rgba(255,107,0,0.16); }
    .password-toggle-btn:focus-visible { outline: 2px solid rgba(255,107,0,0.45); outline-offset: 1px; }
    .dropzone { border: 2px dashed var(--border); border-radius: 12px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--surface); }
    .dropzone:hover, .dropzone.active { border-color: var(--orange); background: var(--orange-glow); }
    .dropzone-icon { font-size: 36px; margin-bottom: 10px; }
    .dropzone-text { color: var(--muted); font-size: 14px; }
    .upload-success-banner { background: rgba(255,107,0,0.1); border: 1px solid rgba(255,107,0,0.35); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; color: var(--orange-light); font-weight: 600; font-size: 14px; }
    .bottom-nav {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
      height: 78px; padding-bottom: env(safe-area-inset-bottom, 0);
      pointer-events: none;
    }
    .bnav-curve {
      position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 78px;
      filter: drop-shadow(0 -8px 24px rgba(0,0,0,0.55));
    }
    .bnav-bubble {
      position: absolute; top: 6px; width: 46px; height: 46px;
      transform: translateX(-50%); pointer-events: none; z-index: 3;
    }
    .bnav-bubble-inner {
      width: 46px; height: 46px; border-radius: 50%;
      background: linear-gradient(145deg, #1a1a1a, #0a0a0a);
      border: 2px solid var(--orange);
      display: grid; place-items: center;
      color: var(--orange);
      box-shadow: 0 0 0 4px rgba(255,107,0,0.12), 0 8px 28px rgba(255,107,0,0.35);
      position: relative;
    }
    .bnav-items {
      position: absolute; left: 0; right: 0; bottom: 0;
      height: 58px; display: flex; align-items: flex-end;
      padding: 0 4px 10px; pointer-events: auto;
    }
    .bnav-item {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
      gap: 4px; border: none; background: none; cursor: pointer;
      color: #5a5a5a; font-family: 'DM Sans', sans-serif;
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.6px; padding: 0 2px 2px; min-width: 0;
      transition: color 0.25s;
      -webkit-tap-highlight-color: transparent;
      tap-highlight-color: transparent;
      -webkit-appearance: none;
      appearance: none;
      outline: none;
      touch-action: manipulation;
      user-select: none;
    }
    .bnav-item:focus, .bnav-item:focus-visible, .bnav-item:active { outline: none; box-shadow: none; }
    .bnav-item.active { color: var(--orange); }
    .bnav-item.active .bnav-label { opacity: 1; }
    .bnav-icon-slot {
      width: 24px; height: 24px; display: grid; place-items: center;
      color: #5a5a5a; transition: color 0.25s, opacity 0.25s;
      position: relative;
    }
    .bnav-badge {
      position: absolute; top: -5px; right: -9px;
      min-width: 17px; height: 17px; padding: 0 4px;
      border-radius: 999px; background: #ff3b30; color: #fff;
      font-size: 10px; font-weight: 800; line-height: 17px; text-align: center;
      box-shadow: 0 0 0 2px #0e0e0e, 0 2px 8px rgba(255,59,48,0.55);
      z-index: 12;
      pointer-events: none;
    }
    .bnav-badge-bubble {
      top: -2px; right: -4px;
      min-width: 18px; height: 18px; line-height: 18px;
      font-size: 11px;
    }
    .bnav-item:not(.active):hover .bnav-icon-slot { color: #999; }
    .bnav-icon-slot.active {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .bnav-label {
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      opacity: 0.85;
    }
    .empty { text-align: center; padding: 60px 20px; color: var(--muted); }
    .empty-icon { margin-bottom: 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; background: radial-gradient(circle at center, rgba(255,107,0,0.08), transparent 70%); }
    .payment-success-page {
      background:
        radial-gradient(ellipse 90% 55% at 50% -5%, rgba(255,107,0,0.28), transparent 58%),
        radial-gradient(circle at 50% 85%, rgba(255,140,51,0.06), transparent 45%),
        var(--bg);
    }
    .success-page-icon { font-size: 72px; margin-bottom: 16px; }
    .success-page-icon-ring {
      width: 96px; height: 96px; border-radius: 50%;
      background: linear-gradient(145deg, rgba(255,154,60,0.22), rgba(255,107,0,0.06));
      border: 2px solid rgba(255,107,0,0.55);
      box-shadow: 0 0 36px rgba(255,107,0,0.38), inset 0 0 24px rgba(255,140,51,0.12);
      display: grid; place-items: center; margin-bottom: 18px;
      animation: success-glow 2.4s ease-in-out infinite;
    }
    @keyframes success-glow {
      0%, 100% { box-shadow: 0 0 36px rgba(255,107,0,0.38), inset 0 0 24px rgba(255,140,51,0.12); }
      50% { box-shadow: 0 0 52px rgba(255,107,0,0.52), inset 0 0 28px rgba(255,140,51,0.2); }
    }
    .success-confirmed-pill {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255,107,0,0.12); border: 1px solid rgba(255,140,51,0.45);
      color: var(--orange-light); padding: 7px 16px; border-radius: 999px;
      font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
      margin-bottom: 12px; box-shadow: 0 0 18px rgba(255,107,0,0.15);
    }
    .success-page-title { font-family: 'Bebas Neue', sans-serif; font-size: 52px; letter-spacing: 4px; color: var(--orange); }
    .payment-success-page .success-page-title {
      background: linear-gradient(135deg, #ffe0a8 0%, #ffb347 38%, #ff6b00 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      filter: drop-shadow(0 3px 14px rgba(255,107,0,0.35));
      letter-spacing: 3px;
    }
    .success-page-sub { color: var(--muted); font-size: 16px; margin: 10px 0 32px; line-height: 1.6; }
    .payment-success-page .success-page-sub strong { color: var(--orange-light); font-weight: 700; }
    .success-page-card { background: var(--surface); border: 1px solid rgba(255,107,0,0.28); border-radius: 16px; padding: 20px; width: 100%; max-width: 320px; margin-bottom: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,140,51,0.08); }
    .success-page-photo { width: 100%; aspect-ratio: 4/3; border-radius: 10px; overflow: hidden; margin-bottom: 12px; background: var(--card); }
    .success-page-info { text-align: left; font-size: 13px; color: var(--muted); line-height: 1.8; }
    .success-page-info strong { color: var(--text); }
    .email-confirmed-page { background: radial-gradient(circle at center, rgba(255,107,0,0.1), transparent 72%); }
    .email-confirmed-page .success-page-title { color: var(--orange); letter-spacing: 2px; }
    .email-confirmed-page .success-page-sub strong { color: var(--orange); }
    .email-confirmed-steps { width: 100%; max-width: 360px; text-align: left; margin-bottom: 28px; }
    .email-confirmed-step { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14px; color: var(--muted); line-height: 1.5; }
    .email-confirmed-step:last-child { border-bottom: none; }
    .email-confirmed-step-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: rgba(255,107,0,0.12); border: 1px solid rgba(255,107,0,0.35); color: var(--orange); font-size: 12px; font-weight: 800; display: grid; place-items: center; }
    .card-buy { transition: background 0.2s; }
    .nav-btn { transition: border-color 0.2s, color 0.2s, background 0.2s; }
  `;

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);

  const renderSuccessPage = () => {
    if (successMode === "email" || successMode === "oauth") {
      const displayName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email?.split("@")[0] ||
        "rider";
      const title =
        successMode === "oauth" ? "¡BIENVENIDO A MOTOSHOT GT!" : "¡CORREO CONFIRMADO!";
      const subtitle =
        successMode === "oauth"
          ? (
            <>
              Hola <strong>{displayName}</strong>, tu cuenta con Google ya está activa.
              <br />
              Ya podés disfrutar de <strong>MotoShot GT</strong> y solicitar ser{" "}
              <strong>fotógrafo verificado</strong>.
            </>
          )
          : (
            <>
              Hola <strong>{displayName}</strong>, tu cuenta ya está activa.
              <br />
              Ya podés disfrutar de <strong>MotoShot GT</strong> y solicitar ser{" "}
              <strong>fotógrafo verificado</strong>.
            </>
          );
      return (
        <motion.div
          className="success-page email-confirmed-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="success-page-icon">
            <AppIcon name="check" size={64} color="var(--orange)" />
          </div>
          <h1 className="success-page-title">{title}</h1>
          <p className="success-page-sub">{subtitle}</p>
          <div className="email-confirmed-steps">
            <div className="email-confirmed-step">
              <span className="email-confirmed-step-num">1</span>
              <span>Explorá fotógrafos y comprá fotos de tus rodadas.</span>
            </div>
            <div className="email-confirmed-step">
              <span className="email-confirmed-step-num">2</span>
              <span>Desde tu perfil, enviá tu solicitud para vender como fotógrafo verificado.</span>
            </div>
          </div>
          <AppButton
            className="upload-btn"
            style={{ width: "100%", maxWidth: 320, marginBottom: 12 }}
            onClick={() => {
              setActiveTab("feed");
              setView(VIEWS.PHOTOGRAPHERS);
            }}
          >
            EXPLORAR MOTOSHOT
          </AppButton>
          <AppButton
            className="nav-btn primary"
            style={{ width: "100%", maxWidth: 320 }}
            onClick={() => {
              setActiveTab("profile");
              setView(VIEWS.VENDOR_REQUEST);
            }}
          >
            SOLICITAR SER FOTÓGRAFO
          </AppButton>
        </motion.div>
      );
    }

    if (successMode === "video") {
      const label =
        [selectedVideo?.moto_brand, selectedVideo?.moto_model].filter(Boolean).join(" ") ||
        selectedVideo?.sector ||
        "tu video";
      return (
        <motion.div
          className="success-page payment-success-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="success-confirmed-pill">
            <AppIcon name="check" size={14} color="var(--orange-light)" />
            Pago confirmado
          </div>
          <div className="success-page-icon-ring">
            <AppIcon name="video" size={52} color="var(--orange)" />
          </div>
          <h1 className="success-page-title">¡VIDEO COMPRADO!</h1>
          <p className="success-page-sub">
            Tu compra de <strong>{label}</strong> fue confirmada. El fotógrafo tiene hasta <strong>24 horas</strong> para subir la versión final editada. Aparecerá en <strong>Mis Compras</strong> cuando esté lista para descargar.
          </p>
          {selectedVideo?.preview_url && (
            <div className="success-page-card">
              <div className="success-page-photo" style={{ position: "relative" }}>
                <video src={selectedVideo.preview_url} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <WatermarkedVideoOverlay photographer={selectedVideo.photographer?.name} />
              </div>
              <div className="success-page-info">
                <div><strong>Video:</strong> {label}</div>
                <div><strong>Precio:</strong> Q{selectedVideo.price}</div>
              </div>
            </div>
          )}
          <AppButton
            className="upload-btn"
            style={{ width: "100%", maxWidth: 320, marginBottom: 12 }}
            onClick={() => {
              setSelectedVideo(null);
              setActiveTab("purchases");
              setView(VIEWS.MY_PURCHASES);
            }}
          >
            IR A MIS COMPRAS
          </AppButton>
          <AppButton
            className="close-btn-secondary"
            style={{ width: "100%", maxWidth: 320 }}
            onClick={() => {
              setSelectedVideo(null);
              setActiveTab("videos");
              setView(VIEWS.VIDEO_SEARCH);
            }}
          >
            Volver a videos
          </AppButton>
        </motion.div>
      );
    }

    return (
      <motion.div
        className="success-page payment-success-page"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="success-confirmed-pill">
          <AppIcon name="check" size={14} color="var(--orange-light)" />
          Pago confirmado
        </div>
        <div className="success-page-icon-ring">
          <AppIcon name="success" size={52} color="var(--orange)" />
        </div>
        <h1 className="success-page-title">¡PAGO EXITOSO!</h1>
        <p className="success-page-sub">
          Tu compra fue <strong>confirmada con éxito</strong>. Ya podés descargar tu foto en alta resolución.
        </p>
        {selected && (
          <div className="success-page-card">
            <div className="success-page-photo">
              <WatermarkedImage
                src={selected.watermark_url || selected.preview_url || selected.image_url}
                photographer={selected.photographer?.name || "MOTOSHOT"}
                purchased
              />
            </div>
            <div className="success-page-info">
              <div><strong>Ubicación:</strong> {selected.location || "—"}</div>
              <div><strong>Precio:</strong> Q{selected.price}</div>
            </div>
          </div>
        )}
        <AppButton className="download-btn" style={{ width: "100%", maxWidth: 320, marginBottom: 12 }} onClick={handleDownload}>
          DESCARGAR FOTO EN HD
        </AppButton>
        <AppButton
          className="close-btn-secondary"
          style={{ width: "100%", maxWidth: 320 }}
          onClick={() => {
            setSelected(null);
            setActiveTab("feed");
            setView(VIEWS.PHOTOGRAPHERS);
          }}
        >
          Volver al inicio
        </AppButton>
      </motion.div>
    );
  };

  const renderResetPassword = () => {
    return (
      <div className="upload-view">
        <div className="section-title">RECUPERAR ACCESO</div>
        <div className="section-sub">
          Ingresá tu email y te enviaremos un enlace para reiniciar tu contraseña.
        </div>
  
        {resetSent ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <EmptyIcon name="mail" size={56} />
            <h3 style={{ color: "var(--text)", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              ¡Correo enviado!
            </h3>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
              Revisá tu bandeja de entrada en <strong style={{ color: "var(--orange)" }}>{authForm.email}</strong> y seguí las instrucciones para reiniciar tu contraseña.
            </p>
            <AppButton className="nav-btn primary" style={{ width: "100%" }}
              onClick={() => { setView(VIEWS.AUTH); setResetSent(false); }}>
              Volver al inicio de sesión
            </AppButton>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input"
                value={authForm.email}
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                placeholder="email@example.com"
                style={{ borderColor: authForm.email ? (emailValid ? "var(--success)" : "#ff4444") : "var(--border)" }} />
              {authForm.email && !emailValid && (
                <div style={{ fontSize: 12, color: "#ff4444", marginTop: 4 }}>
                  Ingresá un email válido.
                </div>
              )}
            </div>
  
            <AppButton className="upload-btn"
              disabled={!emailValid}
              style={{ opacity: !emailValid ? 0.5 : 1 }}
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(authForm.email, {
                    redirectTo: "https://motoshot.pro"
                  });
                  if (error) throw error;
                  setResetSent(true);
                } catch (err) {
                  showToast("Error al enviar. Verificá el email.");
                }
              }}>
              ENVIAR ENLACE
            </AppButton>
  
            <AppButton className="close-btn-secondary" style={{ marginTop: 12 }}
              onClick={() => setView(VIEWS.AUTH)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Volver al inicio de sesión</span>
            </AppButton>
          </>
        )}
      </div>
    );
  };
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authForm.email);

  const renderChangePassword = () => {
    const pw = newPassword;
    const rules = [
      { label: "Mínimo 8 caracteres", ok: pw.length >= 8 },
      { label: "Una letra mayúscula", ok: /[A-Z]/.test(pw) },
      { label: "Una letra minúscula", ok: /[a-z]/.test(pw) },
      { label: "Un número", ok: /[0-9]/.test(pw) },
      { label: "Un símbolo (!@#$...)", ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw) },
    ];
    const pwStrength = rules.filter(r => r.ok).length;
    const strengthColor = pwStrength <= 2 ? "#ff4444" : pwStrength <= 3 ? "var(--orange)" : "var(--success)";
    const strengthLabel = pwStrength <= 2 ? "Débil" : pwStrength <= 3 ? "Regular" : pwStrength === 4 ? "Buena" : "Fuerte";
    const passwordsMatch = newPassword === newPasswordConfirm;
    const canSave = rules.every(r => r.ok) && passwordsMatch && newPasswordConfirm;
  
    return (
      <div className="upload-view">
        <div className="section-title">NUEVA CONTRASEÑA</div>
        <div className="section-sub">Ingresá tu nueva contraseña para MotoShot GT.</div>
  
        <div className="form-group">
          <label className="form-label">Nueva contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              className="form-input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="********"
              style={{ paddingRight: 48 }}
            />
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          </div>
          {pw.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= pwStrength ? strengthColor : "var(--border)", transition: "background 0.3s" }} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: strengthColor, fontWeight: 700, marginBottom: 8 }}>{strengthLabel}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {rules.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: r.ok ? "var(--success)" : "var(--muted)" }}>
                    <span style={{ fontSize: 10, display: "inline-flex", alignItems: "center" }}>{r.ok ? <AppIcon name="check" size={10} color="var(--success)" /> : <AppIcon name="circle" size={10} color="var(--muted)" />}</span>
                    {r.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
  
        <div className="form-group">
          <label className="form-label">Confirmar contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              className="form-input"
              value={newPasswordConfirm}
              onChange={e => setNewPasswordConfirm(e.target.value)}
              placeholder="Repetí tu contraseña"
              style={{ paddingRight: 44, borderColor: newPasswordConfirm ? (passwordsMatch ? "var(--success)" : "#ff4444") : "var(--border)" }}
            />
            {newPasswordConfirm && (
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: passwordsMatch ? "var(--success)" : "#ff4444" }}>
                {passwordsMatch ? <AppIcon name="check" size={12} color="var(--success)" /> : <AppIcon name="x" size={12} color="#ff4444" />}
              </span>
            )}
          </div>
          {newPasswordConfirm && !passwordsMatch && (
            <div style={{ fontSize: 12, color: "#ff4444", marginTop: 4 }}>Las contraseñas no coinciden.</div>
          )}
        </div>
  
        <AppButton className="upload-btn"
          disabled={!canSave}
          style={{ opacity: !canSave ? 0.5 : 1 }}
          onClick={async () => {
            try {
              setGlobalLoading({ active: true, message: "Actualizando contraseña..." });
              const { error } = await supabase.auth.updateUser({ password: newPassword });
              if (error) throw error;
              setShowPasswordReset(false);
              setNewPassword("");
              setNewPasswordConfirm("");
              window.history.replaceState({}, document.title, window.location.pathname);
              showToast("Listo: Contraseña actualizada exitosamente.");
              setView(VIEWS.PHOTOGRAPHERS);
            } catch (err) {
              const msg = err.message || "";
              if (msg.includes("different from the old password")) {
                showToast("La nueva contraseña debe ser diferente a la anterior.");
              } else if (msg.includes("Password should be at least")) {
                showToast("La contraseña debe tener al menos 8 caracteres.");
              } else {
                showToast("Error al actualizar la contraseña. Intentá de nuevo.");
              }
            } finally {
              setGlobalLoading({ active: false, message: "" });
            }
          }}>
          GUARDAR NUEVA CONTRASEÑA
        </AppButton>
      </div>
    );
  };
  const renderAuth = () => {
    const handleResend = async () => {
      if (resendCooldown > 0 || resendCount >= 3) return;
      try {
        await requestConfirmationEmail(authForm.email, authForm.name);
        setResendCount(prev => prev + 1);
        setResendCooldown(60);
        const interval = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) { clearInterval(interval); return 0; }
            return prev - 1;
          });
        }, 1000);
        showToast("Listo: Correo reenviado.");
      } catch (err) {
        showToast(translateAuthError(err.message) || "Error al reenviar. Intentá más tarde.");
      }
    };
  
    if (showEmailConfirm) return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: "var(--bg)" }}>
        <EmptyIcon name="mail" size={64} />
        <h2 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 12 }}>
          Revisá tu correo
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 15, textAlign: "center", maxWidth: 320, lineHeight: 1.6, marginBottom: 16 }}>
          Te enviamos un enlace de confirmación a:
        </p>
        <p style={{ color: "var(--orange)", fontSize: 16, fontWeight: 800, textAlign: "center", maxWidth: 320, lineHeight: 1.4, marginBottom: 24, wordBreak: "break-all" }}>
          {authForm.email}
        </p>
        <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", maxWidth: 320, lineHeight: 1.6, marginBottom: 32 }}>
          Confirmá tu cuenta para poder ingresar.
        </p>
        <AppButton
          onClick={() => {
            setShowEmailConfirm(false);
            setAuthMode("login");
            setAuthForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
          }}
          style={{ width: "100%", maxWidth: 300, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 20 }}>
          Ir al inicio de sesión
        </AppButton>
        <div style={{ textAlign: "center", maxWidth: 300 }}>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
            ¿No lo recibiste? Revisá tu carpeta de <strong style={{ color: "var(--text)" }}>spam o junk</strong>.
          </p>
          {resendCount >= 3 ? (
            <p style={{ fontSize: 12, color: "#ff4444" }}>Límite de reenvíos alcanzado.</p>
          ) : resendCooldown > 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Podés reenviar en <strong style={{ color: "var(--orange)" }}>{resendCooldown}s</strong>
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Si no llegó,{" "}
              <span onClick={handleResend}
                style={{ color: "var(--orange)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
                reenviar correo
              </span>
              {resendCount > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>
                  ({3 - resendCount} intento{3 - resendCount !== 1 ? "s" : ""} restante{3 - resendCount !== 1 ? "s" : ""})
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    );
    const pw = authForm.password;
    const rules = [
      { label: "Mínimo 8 caracteres", ok: pw.length >= 8 },
      { label: "Una letra mayúscula", ok: /[A-Z]/.test(pw) },
      { label: "Una letra minúscula", ok: /[a-z]/.test(pw) },
      { label: "Un número", ok: /[0-9]/.test(pw) },
      { label: "Un símbolo (!@#$...)", ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw) },
    ];
    const pwStrength = rules.filter(r => r.ok).length;
    const strengthColor = pwStrength <= 2 ? "#ff4444" : pwStrength <= 3 ? "var(--orange)" : "var(--success)";
    const strengthLabel = pwStrength <= 2 ? "Débil" : pwStrength <= 3 ? "Regular" : pwStrength === 4 ? "Buena" : "Fuerte";
    const passwordsMatch = authForm.password === authForm.confirmPassword;
    const nameValid = (authForm.name ?? "").trim().length > 0;
    const emailBorderColor = !authForm.email
      ? "var(--border)"
      : emailValid
        ? "var(--success)"
        : "#ff4444";
    const canRegister =
      rules.every(r => r.ok) &&
      passwordsMatch &&
      authForm.confirmPassword &&
      emailValid &&
      nameValid;
  
    const formBusy = authSubmitting || globalLoading.active;

    return (
      <div className="upload-view" style={{ position: "relative" }}>
        {formBusy && authMode === "register" && (
          <div
            aria-busy="true"
            aria-live="polite"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(4px)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              minHeight: 200,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                border: "3px solid var(--border)",
                borderTop: "3px solid var(--orange)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600, textAlign: "center", padding: "0 24px" }}>
              {globalLoading.message || "Creando tu cuenta y enviando correo..."}
            </p>
          </div>
        )}
        <div className="section-title">{authMode === "login" ? "INICIAR SESIÓN" : "REGISTRARSE"}</div>
        <div className="section-sub">{authMode === "login" ? "Ingresá a tu cuenta para comprar fotos." : "Creá tu cuenta en MotoShot GT."}</div>
  
        {authMode === "register" && (
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input
              type="text"
              className="form-input"
              value={authForm.name ?? ""}
              onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
              placeholder="Tu nombre"
              style={{ borderColor: authForm.name ? (nameValid ? "var(--success)" : "#ff4444") : "var(--border)" }}
            />
            {authForm.name && !nameValid && (
              <div style={{ fontSize: 12, color: "#ff4444", marginTop: 4 }}>
                Ingresá tu nombre para continuar.
              </div>
            )}
          </div>
        )}

        <div className="form-group">
  <label className="form-label">Email</label>
  <input
    type="email"
    className="form-input"
    value={authForm.email}
    onChange={(e) => {
      setAuthForm({ ...authForm, email: e.target.value });
      setEmailAlreadyExists(false);
    }}
    placeholder="email@example.com"
    style={{ borderColor: emailBorderColor }}
  />
  {authForm.email && !emailValid && (
    <div style={{ fontSize: 12, color: "#ff4444", marginTop: 4 }}>
      Ingresá un email válido. Ejemplo: nombre@correo.com
    </div>
  )}
</div>
  
        <div className="form-group">
          <label className="form-label">Contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              className="form-input"
              value={authForm.password}
              onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
              placeholder="********"
              style={{ paddingRight: 48 }}
            />
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          </div>
          {authMode === "register" && pw.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= pwStrength ? strengthColor : "var(--border)", transition: "background 0.3s" }} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: strengthColor, fontWeight: 700, marginBottom: 8 }}>{strengthLabel}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {rules.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: r.ok ? "var(--success)" : "var(--muted)", transition: "color 0.2s" }}>
                    <span style={{ fontSize: 10, display: "inline-flex", alignItems: "center" }}>{r.ok ? <AppIcon name="check" size={10} color="var(--success)" /> : <AppIcon name="circle" size={10} color="var(--muted)" />}</span>
                    {r.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
  
        {authMode === "register" && (
          <div className="form-group">
            <label className="form-label">Confirmar contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                value={authForm.confirmPassword || ""}
                onChange={e => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                placeholder="Repetí tu contraseña"
                style={{ paddingRight: 44, borderColor: authForm.confirmPassword ? (passwordsMatch ? "var(--success)" : "#ff4444") : "var(--border)" }}
              />
              {authForm.confirmPassword && (
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: passwordsMatch ? "var(--success)" : "#ff4444" }}>
                  {passwordsMatch ? <AppIcon name="check" size={12} color="var(--success)" /> : <AppIcon name="x" size={12} color="#ff4444" />}
                </span>
              )}
            </div>
            {authForm.confirmPassword && !passwordsMatch && (
              <div style={{ fontSize: 12, color: "#ff4444", marginTop: 4 }}>Las contraseñas no coinciden.</div>
            )}
          </div>
        )}

        {showUnconfirmedBanner && (
  <div style={{ background: "rgba(255,107,0,0.08)", border: "1px solid var(--orange)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "var(--orange)", lineHeight: 1.6 }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <AppIcon name="alert" size={16} color="var(--orange)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        Tu cuenta aún no ha sido confirmada. Revisá tu carpeta de <strong>spam o junk</strong>.{" "}
        {resendCooldown > 0 ? (
          <span style={{ color: "var(--muted)" }}>Podés reenviar en <strong style={{ color: "var(--orange)" }}>{resendCooldown}s</strong></span>
        ) : resendCount >= 3 ? (
          <span style={{ color: "#ff4444" }}>Límite de reenvíos alcanzado.</span>
        ) : (
          <span
          onClick={async () => {
            try {
              await requestConfirmationEmail(authForm.email, authForm.name);
              setResendCount(prev => prev + 1);
              setResendCooldown(60);
              const interval = setInterval(() => {
                setResendCooldown(prev => {
                  if (prev <= 1) { clearInterval(interval); return 0; }
                  return prev - 1;
                });
              }, 1000);
              showToast("Listo: Correo reenviado.");
            } catch (err) {
              console.error("Resend error:", err);
              showToast(translateAuthError(err.message) || "Error al reenviar.");
            }
          }}
          style={{ color: "var(--text)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
            Reenviar correo
          </span>
        )}
      </div>
    </div>
  </div>
)}
        {authMode === "register" && emailAlreadyExists && (
  <div style={{
    background: "rgba(255,68,68,0.08)",
    border: "1px solid #ff4444",
    borderRadius: 10,
    padding: "14px 16px",
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#ff4444"
  }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <AppIcon name="alert" size={16} color="#ff4444" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        Este correo ya está registrado.{" "}
        <span
          onClick={() => {
            setEmailAlreadyExists(false);
            setAuthMode("login");
            setAuthForm(prev => ({ ...prev, password: "", confirmPassword: "" }));
          }}
          style={{ color: "var(--text)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
        >
          Iniciá sesión
        </span>
        {" "}o{" "}
        <span
          onClick={async () => {
            if (resendCooldown > 0 || resendCount >= 3) return;
            try {
              await requestConfirmationEmail(authForm.email, authForm.name);
              setResendCount(prev => prev + 1);
              setResendCooldown(60);
              const interval = setInterval(() => {
                setResendCooldown(prev => {
                  if (prev <= 1) { clearInterval(interval); return 0; }
                  return prev - 1;
                });
              }, 1000);
              showToast("Listo: Correo de activación reenviado.");
            } catch (err) {
              showToast(translateAuthError(err.message) || "Error al reenviar.");
            }
          }}
          style={{
            color: resendCooldown > 0 || resendCount >= 3 ? "var(--muted)" : "var(--orange)",
            fontWeight: 700,
            cursor: resendCooldown > 0 || resendCount >= 3 ? "default" : "pointer",
            textDecoration: resendCooldown > 0 || resendCount >= 3 ? "none" : "underline"
          }}
        >
          {resendCount >= 3
            ? "límite de reenvíos alcanzado"
            : resendCooldown > 0
            ? `reenviar en ${resendCooldown}s`
            : "reenviar correo de activación"}
        </span>
      </div>
    </div>
  </div>
)}
        <AppButton className="upload-btn"
          disabled={formBusy || (authMode === "register" && !canRegister)}
          style={{
            opacity: formBusy || (authMode === "register" && !canRegister) ? 0.5 : 1,
            cursor: formBusy || (authMode === "register" && !canRegister) ? "not-allowed" : "pointer",
          }}
          onClick={authMode === "login" ? handleLogin : handleSignUp}>
          {formBusy && authMode === "register"
            ? "ENVIANDO..."
            : authMode === "login"
            ? "INICIAR SESIÓN"
            : "CREAR CUENTA"}
        </AppButton>
        {authMode === "login" && (
  <div style={{ textAlign: "center", marginTop: 8 }}>
    <span onClick={() => { setResetSent(false); setView(VIEWS.RESET_PASSWORD); }}
      style={{ fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
      ¿Olvidaste tu contraseña?{" "}
      <strong style={{ color: "var(--orange)", textDecoration: "underline" }}>Recuperar acceso</strong>
    </span>
  </div>
)}
        <AppButton className="close-btn-secondary" style={{ marginTop: 12 }}
  onClick={() => { 
    setAuthMode(authMode === "login" ? "register" : "login"); 
    setAuthForm({ email: "", password: "", confirmPassword: "", name: "" });
    setShowUnconfirmedBanner(false);
    setResendCount(0);
    setResendCooldown(0);
  }}>
  {authMode === "login" ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Iniciá sesión"}
</AppButton>

        <AppButton
          onClick={handleGoogleAuth}
          disabled={formBusy}
          style={{
            marginTop: 12,
            width: "100%",
            background: "#fff",
            border: "1px solid #dadce0",
            color: "#3c4043",
            borderRadius: 12,
            padding: "12px 14px",
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: formBusy ? "not-allowed" : "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.31 1.53 7.76 2.81l5.66-5.66C34.01 3.53 29.47 1.5 24 1.5 14.61 1.5 6.56 6.88 2.61 14.72l6.72 5.22C11.3 13.02 17.15 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.57-.14-3.08-.41-4.53H24v8.58h12.67c-.55 2.93-2.18 5.41-4.64 7.09l7.11 5.51C43.56 37.06 46.5 31.27 46.5 24.5z"/>
            <path fill="#FBBC05" d="M9.33 28.06c-.5-1.5-.78-3.09-.78-4.74s.28-3.24.78-4.74l-6.72-5.22C1.57 16.29 1 19.12 1 22.32c0 3.2.57 6.03 1.61 8.96l6.72-5.22z"/>
            <path fill="#34A853" d="M24 46.5c5.47 0 10.06-1.81 13.41-4.91l-7.11-5.51c-1.97 1.33-4.48 2.12-6.3 2.12-6.85 0-12.7-3.52-14.67-8.44l-6.72 5.22C6.56 42.12 14.61 46.5 24 46.5z"/>
            <path fill="none" d="M1 1.5h46v46H1z"/>
          </svg>
          {authMode === "login" ? "Ingresá con Google" : "Registrate con Google"}
        </AppButton>
        <AppButton className="close-btn-secondary" style={{ marginTop: 12 }} onClick={() => {
  setView(VIEWS.PHOTOGRAPHERS);
  setAuthForm({ email: "", password: "", confirmPassword: "", name: "" });
  setShowUnconfirmedBanner(false);
  setEmailAlreadyExists(false);
  setResendCount(0);
  setResendCooldown(0);
}}>Volver</AppButton>
      </div>
    );
  };
  //ULTIMO RETURN
  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Modal suscripción */}
<AnimatePresence>
  {showSubscribeModal && selectedPhotographer && (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setShowSubscribeModal(false)}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 40 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">SUSCRIBIRSE</div>
          <AppButton className="modal-close" onClick={() => setShowSubscribeModal(false)} aria-label="Cerrar"><AppIcon name="x" size={18} /></AppButton>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "var(--card)", flexShrink: 0 }}>
              {selectedPhotographer?.avatar_url
                ? <img src={selectedPhotographer.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><AvatarPlaceholder size={20} /></div>}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{selectedPhotographer?.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{selectedPhotographer?.handle}</div>
            </div>
          </div>
          {selectedPhotographer?.subscription_benefits?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                Suscribite y obtené estas ventajas:
              </div>
              {selectedPhotographer?.subscription_benefits?.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, marginBottom: 10 }}
                >
                  <AppIcon name="check" size={12} color="var(--success)" style={{ marginTop: 1 }} />
                  <span>{b}</span>
                </motion.div>
              ))}
            </div>
          )}
          <AppButton
            className="pay-btn"
            disabled={subPayLoading || isSubscribedToPhotographer(selectedPhotographer?.id)}
            onClick={() => {
              if (!user) { setShowSubscribeModal(false); setView(VIEWS.AUTH); return; }
              if (isSubscribedToPhotographer(selectedPhotographer?.id)) {
                setShowSubscribeModal(false);
                showToast("Ya estás suscrito a este fotógrafo.");
                return;
              }
              handleSubscriptionPayment(selectedPhotographer.id);
            }}
          >
            {subPayLoading
              ? "REDIRIGIENDO A PAYPAL..."
              : isSubscribedToPhotographer(selectedPhotographer?.id)
                ? "SUSCRITO"
                : `SUSCRIBIRME · Q${selectedPhotographer?.subscription_price}/MES`}
          </AppButton>
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
            <div>· Tu suscripción se renovará mensualmente hasta que la canceles.</div>
            <div>· Al cancelar, seguirás teniendo acceso hasta que caduque.</div>
          </div>
          <AppButton className="close-btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowSubscribeModal(false)}>
            Cerrar
          </AppButton>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

       {/* Modal álbum */}
<AnimatePresence>
  {showAlbumModal && (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setShowAlbumModal(false)}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 40 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">NUEVO ÁLBUM</div>
          <AppButton className="modal-close" onClick={() => setShowAlbumModal(false)} aria-label="Cerrar"><AppIcon name="x" size={18} /></AppButton>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre del álbum / Evento</label>
            <input className="form-input"
              placeholder="Ej: Copa Yamaha 2025"
              value={albumForm.name}
              onChange={e => setAlbumForm({ ...albumForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha del evento</label>
            <input className="form-input" type="date"
              value={albumForm.event_date}
              onChange={e => setAlbumForm({ ...albumForm, event_date: e.target.value })} />
          </div>
          <AppButton
            className="pay-btn"
            onClick={async () => {
              if (!albumForm.name) return;
              const res = await fetch("/api/auth/albums", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
                body: JSON.stringify(albumForm),
              });
              const data = await res.json();
              if (res.ok) {
                setAlbums(prev => [data.album, ...prev]);
                setUploadForm(prev => ({ ...prev, album_id: data.album.id }));
                setAlbumForm({ name: "", event_date: "" });
                setShowAlbumModal(false);
              }
            }}
          >
            CREAR ÁLBUM
          </AppButton>
          <AppButton className="close-btn-secondary" style={{ marginTop: 10 }} onClick={() => setShowAlbumModal(false)}>
            Cancelar
          </AppButton>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

<AnimatePresence>
  {confirmDialog && (
    <motion.div
      className="modal-backdrop"
      style={{ zIndex: 250 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setConfirmDialog(null)}
    >
      <motion.div
        className="modal confirm-dialog-modal"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 40 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{confirmDialog.title}</div>
          <AppButton className="modal-close" onClick={() => setConfirmDialog(null)} aria-label="Cerrar">
            <AppIcon name="x" size={18} />
          </AppButton>
        </div>
        <div className="modal-body">
          <p style={{ color: "var(--text)", fontSize: 15, lineHeight: 1.5, margin: "0 0 20px" }}>
            {confirmDialog.message}
          </p>
          <AppButton
            className={confirmDialog.destructive ? undefined : "pay-btn"}
            onClick={confirmDialog.onConfirm}
            style={confirmDialog.destructive ? {
              width: "100%",
              padding: 14,
              background: "transparent",
              border: "1.5px solid rgba(255,68,68,0.55)",
              borderRadius: 10,
              color: "#ff6b6b",
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 18,
              letterSpacing: 1,
              cursor: "pointer",
            } : undefined}
          >
            {confirmDialog.confirmLabel}
          </AppButton>
          <AppButton className="close-btn-secondary" style={{ marginTop: 10 }} onClick={() => setConfirmDialog(null)}>
            {confirmDialog.cancelLabel}
          </AppButton>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

{renderAdminDocPreviewModal()}

<nav className="nav">
<div className="nav-logo" onClick={() => { 
  setView(VIEWS.PHOTOGRAPHERS); 
  setActiveTab("feed");
  setShowEmailConfirm(false);
  setAuthMode("login");
  setAuthForm({ email: "", password: "", confirmPassword: "", name: "" });
  setEmailAlreadyExists(false);
  setResendCount(0);
  setResendCooldown(0);
}}>
  <MotoShotBrandMark variant="nav" />
</div>
  <div className="nav-actions">
    {isLoggedIn ? (
      <>
        {isCEO ? (
          <AppButton
            className="nav-btn nav-btn-sm nav-role-btn nav-role-ceo"
            onClick={() => { setView(VIEWS.ADMIN); }}
          >
            CEO
          </AppButton>
        ) : isStaff ? (
          <AppButton
            className="nav-btn nav-btn-sm nav-role-btn nav-role-admin"
            onClick={() => { setView(VIEWS.ADMIN); }}
          >
            Admin
          </AppButton>
        ) : profile?.verification_status === "approved" ? (
          <motion.span
          onClick={() => setView(VIEWS.VENDOR_REQUEST)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 520, damping: 26 }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            cursor: "pointer", color: "var(--text)", fontSize: 12, fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {profile?.name || "Fotógrafo"}
          <VerifiedBadge size={14} />
        </motion.span>
        ) : null}
        <AppButton className="nav-btn nav-btn-sm primary" onClick={handleLogout}>Cerrar sesión</AppButton>
      </>
    ) : (
      <AppButton className="nav-btn nav-btn-sm primary" onClick={() => {
        setAuthForm({ email: "", password: "", confirmPassword: "", name: "" });
        setShowUnconfirmedBanner(false);
        setShowEmailConfirm(false);
        setResendCount(0);
        setResendCooldown(0);
        setAuthMode("login");
        setView(VIEWS.AUTH);
      }}>Ingresar</AppButton>
    )}
  </div>
</nav>

<PullToRefreshIndicator pullDistance={pullDistance} refreshing={pullRefreshing} />

<div
  className="app-content-shift"
  style={{
    flex: 1,
    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
    transition: pullRefreshing || pullDistance === 0 ? "transform 0.22s ease" : "none",
  }}
>
  <AnimatePresence mode="wait">
    <motion.div
      key={showPasswordReset ? "reset" : view}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {showPasswordReset ? renderChangePassword() : (
        <>
          {view === VIEWS.GALLERY && renderGallery()}
          {view === VIEWS.DETAIL && renderDetail()}
          {(view === VIEWS.UPLOAD || view === VIEWS.UPLOAD_VIDEO) && renderUpload()}
          {view === VIEWS.VIDEO_SEARCH && renderVideoSearch()}
          {view === VIEWS.PENDING_DELIVERIES && renderPendingDeliveries()}
          {view === VIEWS.AUTH && renderAuth()}
          {view === VIEWS.VENDOR_REQUEST && renderVendorRequest()}
          {view === VIEWS.SUCCESS && renderSuccessPage()}
          {view === VIEWS.MY_PURCHASES && renderMyPurchases()}
          {view === VIEWS.NOTIFICATIONS && renderNotifications()}
          {view === VIEWS.PHOTOGRAPHERS && renderPhotographers()}
          {view === VIEWS.PHOTOGRAPHER_PROFILE && renderPhotographerProfile()}
          {view === VIEWS.ADMIN && isStaff && renderAdmin()}
          {view === VIEWS.CEO_PAYROLL && renderCeoPayroll()}
          {view === VIEWS.DASHBOARD && renderDashboard()}
          {view === VIEWS.MY_GALLERY && renderMyGallery()}
          {view === VIEWS.RESET_PASSWORD && renderResetPassword()}
        </>
      )}
    </motion.div>
  </AnimatePresence>
</div>

<AnimatePresence>
  {payStep > 0 && (selected || selectedVideo) && (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => { if (payStep === 1) { setPayStep(0); setSelectedVideo(null); } }}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 40 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{selectedVideo ? "PAGAR VIDEO" : "PAGAR CON RECURRENTE"}</div>
          <AppButton className="modal-close" onClick={() => { setPayStep(0); setSelectedVideo(null); }} aria-label="Cerrar"><AppIcon name="x" size={18} /></AppButton>
        </div>
        {selected && (
          <div className="modal-photo">
            <img src={selected.watermark_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        {selectedVideo && (
          <div className="modal-photo" style={{ position: "relative" }}>
            <video src={selectedVideo.preview_url} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <WatermarkedVideoOverlay photographer={selectedVideo.photographer?.name} />
          </div>
        )}
        <div className="modal-body">
          {selected && (
            <div className="modal-meta">
              <div>
                <div className="modal-meta-photographer">{selected.photographer?.name}</div>
                <div className="modal-meta-location"><IconText icon="pin" size={12}>{selected.location}</IconText></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="modal-price">Q{selected.price}</div>
                <div className="modal-price-unit">Alta resolución</div>
              </div>
            </div>
          )}
          {selectedVideo && (
            <div className="modal-meta">
              <div>
                <div className="modal-meta-photographer">
                  {selectedVideo.photographer?.name || "Fotógrafo"}
                </div>
                <div className="modal-meta-location">
                  <IconText icon="pin" size={12}>
                    {selectedVideo.sector || [selectedVideo.moto_brand, selectedVideo.moto_model].filter(Boolean).join(" ") || "Video"}
                  </IconText>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="modal-price">Q{selectedVideo.price}</div>
                <div className="modal-price-unit">Video HD</div>
              </div>
            </div>
          )}
          {payStep === 1 && (
            <>
              <div className="pay-label">Método de pago</div>
              {selectedVideo ? (
                <>
                  <AppButton className="pay-btn" onClick={handleVideoPayment} style={{ marginBottom: 10 }}>
                    PAGAR Q{selectedVideo.price} CON RECURRENTE
                  </AppButton>
                  <AppButton
                    className="close-btn-secondary"
                    onClick={handleVideoPayPalPayment}
                    style={{ width: "100%" }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <AppIcon name="creditCard" size={14} /> Pagar con PayPal
                    </span>
                  </AppButton>
                </>
              ) : (
                <>
                  <div className="pay-methods">
                    <div className="pay-method">
                      <div className="pay-method-dot"></div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name="creditCard" size={14} /> Recurrente</span>
                    </div>
                  </div>
                  <AppButton className="pay-btn" onClick={handlePayment}>
                    PAGAR Q{selected?.price} CON RECURRENTE
                  </AppButton>
                </>
              )}
            </>
          )}
          {payStep === 2 && (
            <div className="processing">
              <div className="processing-spinner"></div>
              <div className="processing-text">
                {selectedVideo ? "Redirigiendo al pago..." : "Redirigiendo a Recurrente..."}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

{view !== VIEWS.SUCCESS &&
  view !== VIEWS.AUTH && (
    isCEO && isLoggedIn ? (
      <BottomNav
        variant="ceo"
        items={[
          { id: "feed", label: "Inicio", v: VIEWS.PHOTOGRAPHERS },
          { id: "payroll", icon: "payroll", label: "Planilla", v: VIEWS.CEO_PAYROLL },
          { id: "profile", label: "Cuenta", v: VIEWS.VENDOR_REQUEST },
        ]}
        activeTab={activeTab}
        onSelect={(item) => {
          setActiveTab(item.id);
          setView(item.v);
        }}
      />
    ) : (
      <BottomNav
        items={[
          { id: "feed", label: "Inicio", v: VIEWS.PHOTOGRAPHERS },
          { id: "videos", icon: "video", label: "Videos", v: VIEWS.VIDEO_SEARCH },
          ...(profile?.verification_status === "approved"
            ? [
              { id: "upload", label: "Subir", v: VIEWS.UPLOAD },
              { id: "deliveries", icon: "package", label: "Entregas", badge: pendingDeliveryCount, v: VIEWS.PENDING_DELIVERIES },
              { id: "dash", label: "Dashboard", v: VIEWS.DASHBOARD },
            ]
            : [{ id: "purchases", label: "Compras", badge: unclaimedPurchasesCount, v: VIEWS.MY_PURCHASES }]),
          { id: "gallery", label: "Galería", v: VIEWS.MY_GALLERY },
          { id: "profile", label: "Perfil", v: VIEWS.VENDOR_REQUEST },
        ]}
        activeTab={activeTab}
        onSelect={(item) => {
          setActiveTab(item.id);
          if (item.id === "upload") setUploadMediaTab("video");
          setView(item.v);
        }}
      />
    )
  )}
  {/* Toast global */}
<AnimatePresence>
{message && (
  <motion.div
    initial={{ opacity: 0, y: -60, scale: 0.95, x: "-50%" }}
    animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
    exit={{ opacity: 0, y: -60, scale: 0.95, x: "-50%" }}
    transition={{ type: "spring", stiffness: 400, damping: 30 }}
    style={(() => {
      const isSuccess = message.startsWith("Listo:") || message.includes("actualiz") || message.includes("activa") || message.includes("guardad") || message.includes("exitosa");
      const isError =
        message.toLowerCase().includes("invalid") ||
        message.toLowerCase().includes("error") ||
        message.toLowerCase().includes("incorrect") ||
        message.toLowerCase().includes("fallid") ||
        message.toLowerCase().includes("no se pudo") ||
        message.toLowerCase().includes("no se pudieron");
      const toastColor = isSuccess ? "var(--success)" : isError ? "#ff4444" : "var(--orange)";
      const toastBg = isSuccess ? "rgba(255,107,0,0.12)" : isError ? "rgba(255,68,68,0.12)" : "rgba(255,107,0,0.12)";
      return {
        position: "fixed", top: 70, left: "50%",
        zIndex: 999, maxWidth: 340, width: "90%",
        background: toastBg,
        border: `1px solid ${toastColor}`,
        borderRadius: 12, padding: "12px 20px",
        color: toastColor,
        fontSize: 14, fontWeight: 600, textAlign: "center",
        backdropFilter: "blur(12px)",
      };
    })()}
  >
    {message}
  </motion.div>
)}
</AnimatePresence>
  {globalLoading.active && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
          }}>
            <div style={{ width: 48, height: 48, border: "3px solid var(--border)", borderTop: "3px solid var(--orange)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>
              {globalLoading.message || "Cargando..."}
            </div>
          </div>
        )}
      </div>
    </>
  );
}