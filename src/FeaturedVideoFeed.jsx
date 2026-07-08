import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { apiJson, apiUrl } from "./apiClient.js";
import { AppIcon, LoaderIcon, EmptyIcon } from "./icons.jsx";
import { videoToCartItem } from "./shoppingCart.js";
import { mergePurchaseStatusIntoVideos, resolveVideoPurchaseState } from "./videoPurchaseState.js";
import { shareVideo } from "./videoShare.js";
import { ProtectedMedia, protectedVideoProps } from "./contentProtection.jsx";
import "./FeaturedVideoFeed.css";

const PREVIEW_MAX_SEC = 7;
const PREVIEW_SHORT_SEC = 3;

function getPreviewLimitSec(duration) {
  const dur = Number(duration);
  if (Number.isFinite(dur) && dur > 0 && dur < PREVIEW_MAX_SEC) {
    return Math.min(PREVIEW_SHORT_SEC, dur);
  }
  return PREVIEW_MAX_SEC;
}

function formatUpCount(count) {
  const n = Number(count) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

const SPRING_SNAP = { type: "spring", stiffness: 520, damping: 28 };
const ORANGE = "#ff6b00";
const ORANGE_LIGHT = "#ffb347";

function FeedUpIcon({ active = false }) {
  const gradId = `feed-up-${active ? "on" : "off"}`;
  const stroke = active ? `url(#${gradId})` : "#f0ece4";
  const fill = active ? `url(#${gradId})` : "none";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={ORANGE_LIGHT} />
          <stop offset="100%" stopColor={ORANGE} />
        </linearGradient>
      </defs>
      <path d="M3 15h2.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />
      <path d="M18.5 15H21" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />
      <path d="M5.5 12h1.8" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <path d="M16.7 12h1.8" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <path
        d="M12 4.5L6.5 11.5H10v7h4v-7h3.5L12 4.5z"
        fill={fill}
        stroke={active ? "none" : stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeedShareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="18" cy="5" r="2.4" fill={ORANGE} />
      <circle cx="6" cy="12" r="2.4" fill={ORANGE_LIGHT} />
      <circle cx="18" cy="19" r="2.4" fill={ORANGE} />
      <path d="M8.4 10.8L15.6 6.6" stroke="#f0ece4" strokeWidth="1.7" strokeLinecap="round" opacity="0.9" />
      <path d="M8.4 13.2L15.6 17.4" stroke="#f0ece4" strokeWidth="1.7" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function FeedCartIcon({ active = false, owned = false }) {
  const gradId = `feed-cart-${active ? "on" : "off"}`;
  const line = active ? `url(#${gradId})` : "#f0ece4";
  if (owned) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12.5l4 4 10-10.5" stroke={ORANGE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={ORANGE_LIGHT} />
          <stop offset="100%" stopColor={ORANGE} />
        </linearGradient>
      </defs>
      <path
        d="M3.2 4.3h2.1l1.5 9.7a1.7 1.7 0 0 0 1.68 1.44h7.6a1.7 1.7 0 0 0 1.66-1.32L20.6 7.2H6.1"
        stroke={line}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "rgba(255,107,0,0.22)" : "none"}
      />
      <motion.circle
        cx="9.6" cy="19.4" r="1.5"
        fill={active ? ORANGE : "#f0ece4"}
        animate={active ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: 0.35 }}
      />
      <motion.circle
        cx="16.4" cy="19.4" r="1.5"
        fill={active ? ORANGE : "#f0ece4"}
        animate={active ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      />
    </svg>
  );
}

function FeedSoundIcon({ muted = true }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 5.5L7 9H3.5v6H7l4 3.5V5.5z"
        fill={muted ? "rgba(240,236,228,0.18)" : `url(#feed-sound-body)`}
        stroke={muted ? "#f0ece4" : ORANGE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="feed-sound-body" x1="3" y1="5" x2="12" y2="19" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={ORANGE_LIGHT} />
          <stop offset="100%" stopColor={ORANGE} />
        </linearGradient>
      </defs>
      {muted ? (
        <>
          <path d="M16.5 9.5l4 4" stroke="#f0ece4" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M20.5 9.5l-4 4" stroke="#f0ece4" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <motion.path
            d="M15.2 9.2a4.2 4.2 0 0 1 0 5.6"
            stroke={ORANGE_LIGHT}
            strokeWidth="1.7"
            strokeLinecap="round"
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M17.8 6.8a7.5 7.5 0 0 1 0 10.4"
            stroke={ORANGE}
            strokeWidth="1.7"
            strokeLinecap="round"
            animate={{ opacity: [0.25, 0.9, 0.25] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: 0.18 }}
          />
        </>
      )}
    </svg>
  );
}

function VideoFeedAction({
  label,
  count,
  active = false,
  accent,
  disabled = false,
  onClick,
  ariaLabel,
  ariaPressed,
  icon,
  tapRotate = 0,
}) {
  return (
    <motion.button
      type="button"
      className={`featured-video-action${active ? " is-active" : ""}${accent ? ` featured-video-action--${accent}` : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      whileTap={{ scale: 0.88, y: 1 }}
      transition={SPRING_SNAP}
    >
      <motion.span
        className="featured-video-action__btn"
        whileTap={{ scale: 0.94 }}
        transition={SPRING_SNAP}
      >
        <motion.span
          className="featured-video-action__icon"
          animate={{ rotate: tapRotate }}
          whileTap={{ rotate: tapRotate + (accent === "share" ? 12 : accent === "sound" ? -8 : -6), scale: 0.94 }}
          transition={SPRING_SNAP}
        >
          {icon}
        </motion.span>
      </motion.span>
      {count != null && count !== "" && (
        <motion.span
          className="featured-video-action__count"
          key={count}
          initial={{ scale: 0.85, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING_SNAP}
        >
          {count}
        </motion.span>
      )}
      <span className="featured-video-action__label">{label}</span>
    </motion.button>
  );
}

function buildCompactTags(video) {
  const tags = [];
  if (video.moto_brand) tags.push(video.moto_brand);
  if (video.moto_color) tags.push(video.moto_color);
  if (video.dorsal) tags.push(`Placa ${video.dorsal}`);
  if (video.sector) tags.push(video.sector);
  return tags.slice(0, 4);
}

function FeedSlide({
  video,
  index,
  activeIndex,
  isActive,
  purchaseState,
  isLoggedIn,
  isOwn,
  onRequireAuth,
  onUpvote,
  onOpenPhotographer,
  cart,
  onOpenCart,
  renderClaimButton,
  upvoteBusy,
  onShare,
  resolvedSrc,
}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  // frameRendering = el video está pintando frames en pantalla ahora mismo.
  // Mientras sea false, el thumbnail (HTML) cubre el <video> para que Android
  // NO alcance a dibujar su botón de play nativo (recién montado o buffering).
  const [frameRendering, setFrameRendering] = useState(false);
  const [viewTracked, setViewTracked] = useState(false);
  const [effectiveSrc, setEffectiveSrc] = useState(resolvedSrc || video.preview_url);
  const previewLimitRef = useRef(PREVIEW_MAX_SEC);

  const dist = Number.isFinite(activeIndex) && activeIndex >= 0 ? Math.abs(index - activeIndex) : 99;
  // El slide activo y sus vecinos inmediatos montan el <video> y se mantienen
  // reproduciendo (los vecinos en silencio). Nunca se pausan mientras están en
  // rango: un <video> pausado es lo que dispara el botón de play nativo de
  // Android. Así el scroll es instantáneo (estilo TikTok), sin thumbnail pegado
  // ni botón nativo.
  const shouldRenderVideo = dist <= 1;

  // Sólo aplicar el blob precargado antes de que el video haya decodificado su
  // primer frame; cambiar el src en caliente reiniciaría la reproducción.
  useEffect(() => {
    if (!ready) setEffectiveSrc(resolvedSrc || video.preview_url);
  }, [resolvedSrc, video.preview_url, ready]);

  const posterUrl = video.thumbnail_url?.trim() || null;
  const photographer = video.photographer || {};
  const handle = photographer.handle ? String(photographer.handle).replace(/^@/, "") : "";
  const watermarkText = `@${handle || photographer.name || "MOTOSHOT"} • MotoShot GT`;

  const inCart = Boolean(cart?.isInCart?.("video", video.id));
  const owned = purchaseState === "comprado" || purchaseState === "entregado";
  const canBuy = !isOwn && !owned;

  const trackView = useCallback(() => {
    if (viewTracked) return;
    setViewTracked(true);
    fetch(apiUrl(`/api/videos/${video.id}/track-view`), { method: "POST" }).catch(() => {});
  }, [video.id, viewTracked]);

  const ensurePlaying = useCallback((withSound) => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !withSound;
    setMuted(!withSound);
    if (withSound) el.volume = 1;
    const p = el.play();
    if (p?.catch) p.catch(() => {});
    setPlaying(true);
  }, []);

  // Mantener el video reproduciendo tanto si es activo como vecino.
  useEffect(() => {
    if (!shouldRenderVideo) {
      setPlaying(false);
      setFrameRendering(false);
      setReady(false);
      return;
    }
    if (isActive) {
      trackView();
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = "none";
          ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"].forEach((action) => {
            try { navigator.mediaSession.setActionHandler(action, null); } catch (_) { /* ignore */ }
          });
        } catch (_) { /* ignore */ }
      }
      ensurePlaying(false);
    } else {
      // Vecino: seguir reproduciendo en silencio para que al llegar esté listo
      // (sin thumbnail ni botón nativo). Nunca pausar.
      ensurePlaying(false);
      const el = videoRef.current;
      if (el) el.muted = true;
      setMuted(true);
    }
  }, [isActive, shouldRenderVideo, ensurePlaying, trackView]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      setPlaying(false);
    } else {
      ensurePlaying(!muted);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    const nextMuted = !muted;
    el.muted = nextMuted;
    if (!nextMuted) el.volume = 1;
    setMuted(nextMuted);
  };

  const handleUpvote = (e) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      onRequireAuth?.();
      return;
    }
    onUpvote?.(video.id);
  };

  const handleShare = (e) => {
    e.stopPropagation();
    onShare?.(video);
  };

  const handleCart = (e) => {
    e.stopPropagation();
    if (!canBuy) return;
    if (!inCart) {
      cart?.addItem?.(videoToCartItem(video));
    }
    onOpenCart?.();
  };

  const cartLabel = isOwn
    ? "Tuyo"
    : owned
      ? "Comprado"
      : `Q${video.price}`;

  const compactTags = buildCompactTags(video);

  return (
    <section
      className={`featured-video-slide${isActive ? " is-active" : ""}`}
      data-video-id={video.id}
    >
      <ProtectedMedia className="featured-video-slide__media">
        {posterUrl && (
          <img
            src={posterUrl}
            alt=""
            className="featured-video-slide__poster"
            draggable={false}
            aria-hidden="true"
            style={{ opacity: frameRendering ? 0 : 1 }}
          />
        )}
        {shouldRenderVideo && (
          <video
            ref={videoRef}
            className={`featured-video-slide__video${frameRendering ? " is-playing" : ""}`}
            src={effectiveSrc}
            playsInline
            muted={muted}
            preload="auto"
            loop={false}
            controls={false}
            {...protectedVideoProps}
            onLoadedMetadata={(e) => {
              previewLimitRef.current = getPreviewLimitSec(e.currentTarget.duration);
            }}
            onLoadedData={() => setReady(true)}
            onCanPlay={() => setReady(true)}
            onPlaying={() => { setReady(true); setFrameRendering(true); }}
            onWaiting={() => setFrameRendering(false)}
            onStalled={() => setFrameRendering(false)}
            onPause={() => setFrameRendering(false)}
            onEmptied={() => { setFrameRendering(false); setReady(false); }}
            onEnded={() => setFrameRendering(false)}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              const limit = previewLimitRef.current || PREVIEW_MAX_SEC;
              if (el.currentTime >= limit) {
                el.currentTime = 0;
                el.play().catch(() => {});
              }
            }}
          />
        )}
        {isActive && (
          <div className="featured-video-slide__watermark">
            <div className="featured-video-slide__watermark-grid">
              {Array.from({ length: 15 }).map((_, i) => (
                <span key={i}>{watermarkText}</span>
              ))}
            </div>
          </div>
        )}
        <button type="button" className="featured-video-slide__tap" aria-label={playing ? "Pausar" : "Reproducir"} onClick={togglePlay} />
      </ProtectedMedia>

      <div className="featured-video-slide__scrim" aria-hidden="true" />

      <div className="featured-video-slide__actions">
        <VideoFeedAction
          label={cartLabel}
          active={inCart && canBuy}
          accent="cart"
          disabled={!canBuy}
          onClick={handleCart}
          ariaLabel={inCart ? "Ver carrito" : "Agregar al carrito"}
          icon={<FeedCartIcon active={inCart && canBuy} owned={owned || isOwn} />}
        />

        <VideoFeedAction
          label="UP"
          count={formatUpCount(video.upvote_count)}
          active={Boolean(video.upvoted_by_me)}
          accent="up"
          disabled={upvoteBusy}
          onClick={handleUpvote}
          ariaLabel="Dar UP"
          ariaPressed={Boolean(video.upvoted_by_me)}
          icon={<FeedUpIcon active={Boolean(video.upvoted_by_me)} />}
        />

        <VideoFeedAction
          label={muted ? "Sonido" : "Mudo"}
          active={!muted}
          accent="sound"
          onClick={toggleMute}
          ariaLabel={muted ? "Activar sonido" : "Silenciar"}
          icon={<FeedSoundIcon muted={muted} />}
        />

        <VideoFeedAction
          label="Compartir"
          accent="share"
          onClick={handleShare}
          ariaLabel="Compartir video"
          icon={<FeedShareIcon />}
        />
      </div>

      <div className="featured-video-slide__bottom">
        <button type="button" className="featured-video-slide__photographer" onClick={(e) => onOpenPhotographer?.(video, e)}>
          {photographer.avatar_url ? (
            <img src={photographer.avatar_url} alt="" className="featured-video-slide__avatar" />
          ) : (
            <span className="featured-video-slide__avatar-fallback">
              {(photographer.name || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span>
            <div className="featured-video-slide__name">{photographer.name || "Fotógrafo"}</div>
            {handle && <div className="featured-video-slide__handle">@{handle}</div>}
          </span>
        </button>

        {compactTags.length > 0 && (
          <div className="featured-video-slide__tags">
            {compactTags.map((tag) => (
              <span key={tag} className="featured-video-slide__tag">{tag}</span>
            ))}
          </div>
        )}

        {!isOwn && renderClaimButton?.("video", video.id, photographer.id, { compact: true })}
      </div>
    </section>
  );
}

export function FeaturedVideoFeed({
  session,
  isLoggedIn,
  onRequireAuth,
  purchaseRows = [],
  purchaseStatusById,
  cart,
  onOpenCart,
  isOwnVideo,
  renderClaimButton,
  onOpenPhotographer,
  showToast,
  refreshToken = 0,
  focusVideoId = null,
}) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [upvoteBusyId, setUpvoteBusyId] = useState(null);
  const [readySrc, setReadySrc] = useState({});
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const focusAppliedRef = useRef(null);
  const blobCacheRef = useRef(new Map());
  const prefetchingRef = useRef(new Set());

  const authHeaders = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const mergePurchases = useCallback((list) => (
    mergePurchaseStatusIntoVideos(list, purchaseRows)
  ), [purchaseRows]);

  const scrollToVideo = useCallback((videoId) => {
    const root = containerRef.current;
    if (!root || !videoId) return false;
    const slide = root.querySelector(`[data-video-id="${videoId}"]`);
    if (!slide) return false;
    slide.scrollIntoView({ behavior: "auto", block: "start" });
    setActiveId(videoId);
    return true;
  }, []);

  const ensureFocusVideo = useCallback(async (list, videoId) => {
    const id = String(videoId || "").trim();
    if (!id) return list;
    if (list.some((row) => row.id === id)) return list;

    try {
      const { res, data } = await apiJson(`/api/videos/${id}`, { headers: authHeaders });
      if (!res.ok || !data?.id) return list;
      return [mergePurchases([data])[0], ...list.filter((row) => row.id !== id)];
    } catch (err) {
      console.error("ensureFocusVideo:", err);
      return list;
    }
  }, [authHeaders, mergePurchases]);

  const loadFeed = useCallback(async ({ reset = false, pinVideoId = null } = {}) => {
    if (!reset && loadingMoreRef.current) return;
    const nextOffset = reset ? 0 : offsetRef.current;
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    try {
      const { res, data } = await apiJson(`/api/videos/feed?limit=12&offset=${nextOffset}`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el feed de videos");
      let incoming = mergePurchases(Array.isArray(data.videos) ? data.videos : []);
      if (reset && pinVideoId) {
        incoming = await ensureFocusVideo(incoming, pinVideoId);
      }
      setVideos((prev) => (reset ? incoming : [...prev, ...incoming]));
      setHasMore(Boolean(data.has_more));
      offsetRef.current = nextOffset + incoming.length;
      if (reset && incoming[0]?.id) {
        const targetId = pinVideoId && incoming.some((row) => row.id === pinVideoId)
          ? pinVideoId
          : incoming[0].id;
        setActiveId(targetId);
        window.requestAnimationFrame(() => scrollToVideo(targetId));
      }
    } catch (err) {
      console.error("FeaturedVideoFeed:", err);
      showToast?.(err.message || "Error al cargar videos destacados.");
      if (reset) setVideos([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [authHeaders, mergePurchases, showToast, ensureFocusVideo, scrollToVideo]);

  useEffect(() => {
    focusAppliedRef.current = null;
    loadFeed({ reset: true, pinVideoId: focusVideoId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, session?.access_token, focusVideoId]);

  useEffect(() => {
    if (!focusVideoId || loading || focusAppliedRef.current === focusVideoId) return;
    if (scrollToVideo(focusVideoId)) {
      focusAppliedRef.current = focusVideoId;
    }
  }, [focusVideoId, loading, videos, scrollToVideo]);

  const handleShareVideo = useCallback(async (video) => {
    await shareVideo(video, { showToast });
  }, [showToast]);

  const prefetchVideo = useCallback(async (url) => {
    if (!url || blobCacheRef.current.has(url) || prefetchingRef.current.has(url)) return;
    prefetchingRef.current.add(url);
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      blobCacheRef.current.set(url, objectUrl);
      setReadySrc((prev) => ({ ...prev, [url]: objectUrl }));
    } catch (_) {
      /* red lenta u offline: se usa el streaming normal */
    } finally {
      prefetchingRef.current.delete(url);
    }
  }, []);

  // Precarga en memoria (blob) del video activo y sus vecinos, para que al
  // hacer scroll la reproducción sea instantánea y no aparezca la UI nativa.
  useEffect(() => {
    if (!videos.length) return;
    const activeIdx = videos.findIndex((v) => v.id === activeId);
    const center = activeIdx >= 0 ? activeIdx : 0;
    const from = Math.max(0, center - 1);
    const to = Math.min(videos.length - 1, center + 3);
    for (let i = from; i <= to; i += 1) {
      prefetchVideo(videos[i]?.preview_url);
    }
  }, [activeId, videos, prefetchVideo]);

  useEffect(() => () => {
    blobCacheRef.current.forEach((objectUrl) => {
      try { URL.revokeObjectURL(objectUrl); } catch (_) { /* ignore */ }
    });
    blobCacheRef.current.clear();
  }, []);

  useEffect(() => {
    setVideos((prev) => mergePurchases(prev));
  }, [mergePurchases]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    observerRef.current?.disconnect();
    const slides = root.querySelectorAll(".featured-video-slide");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.dataset?.videoId) {
          setActiveId(visible.target.dataset.videoId);
        }
      },
      { root, threshold: [0.55, 0.75, 0.9] },
    );

    slides.forEach((slide) => observer.observe(slide));
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [videos]);

  useEffect(() => {
    const root = containerRef.current;
    const sentinel = loadMoreRef.current;
    if (!root || !sentinel || !hasMore || loadingMore) return undefined;

    const loader = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadFeed({ reset: false });
        }
      },
      { root, rootMargin: "240px" },
    );
    loader.observe(sentinel);
    return () => loader.disconnect();
  }, [hasMore, loadingMore, loadFeed]);

  const handleUpvote = async (videoId) => {
    if (!session?.access_token || upvoteBusyId) return;
    setUpvoteBusyId(videoId);

    const previous = videos.find((v) => v.id === videoId);
    const optimisticUpvoted = !previous?.upvoted_by_me;
    const optimisticCount = Math.max(0, (Number(previous?.upvote_count) || 0) + (optimisticUpvoted ? 1 : -1));

    setVideos((prev) => prev.map((v) => (
      v.id === videoId
        ? { ...v, upvoted_by_me: optimisticUpvoted, upvote_count: optimisticCount }
        : v
    )));

    try {
      const { res, data } = await apiJson(`/api/videos/${videoId}/upvote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el UP");
      setVideos((prev) => prev.map((v) => (
        v.id === videoId
          ? { ...v, upvoted_by_me: Boolean(data.upvoted), upvote_count: Number(data.upvote_count) || 0 }
          : v
      )));
    } catch (err) {
      console.error("handleUpvote:", err);
      showToast?.(err.message || "Error al dar UP.");
      setVideos((prev) => prev.map((v) => (v.id === videoId ? { ...previous } : v)));
    } finally {
      setUpvoteBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="featured-video-feed-shell" data-no-ptr>
        <div className="featured-video-feed__loading">
          <LoaderIcon size={44} />
          <div>Cargando videos destacados...</div>
        </div>
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="featured-video-feed-shell" data-no-ptr>
        <div className="featured-video-feed__empty">
        <EmptyIcon name="video" />
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1, color: "var(--text)" }}>
          SIN VIDEOS DESTACADOS
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 320 }}>
          Acá aparecen los videos de fotógrafos destacados. Cuando un admin marque fotógrafos como destacados y suban videos, los vas a ver en formato vertical.
        </div>
        </div>
      </div>
    );
  }

  const activeIndex = videos.findIndex((v) => v.id === activeId);

  return (
    <div className="featured-video-feed-shell">
      <div className="featured-video-feed__header">
        <div className="featured-video-feed__header-title">VIDEOS</div>
        <span className="featured-video-feed__header-badge">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <AppIcon name="star" size={10} color="#fff" />
            Destacados
          </span>
        </span>
      </div>

      <div className="featured-video-feed" ref={containerRef}>
        {videos.map((video, index) => (
          <FeedSlide
            key={video.id}
            video={video}
            index={index}
            activeIndex={activeIndex}
            isActive={activeId === video.id}
            isLoggedIn={isLoggedIn}
            isOwn={isOwnVideo?.(video)}
            purchaseState={resolveVideoPurchaseState(video, purchaseStatusById)}
            onRequireAuth={onRequireAuth}
            onUpvote={handleUpvote}
            onOpenPhotographer={onOpenPhotographer}
            cart={cart}
            onOpenCart={onOpenCart}
            renderClaimButton={renderClaimButton}
            upvoteBusy={upvoteBusyId === video.id}
            onShare={handleShareVideo}
            resolvedSrc={readySrc[video.preview_url] || video.preview_url}
          />
        ))}
        {hasMore && (
          <div ref={loadMoreRef} className="featured-video-feed__load-more">
            {loadingMore ? <LoaderIcon size={22} /> : "Deslizá para más"}
          </div>
        )}
      </div>
    </div>
  );
}
