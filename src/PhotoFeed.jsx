import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { apiJson } from "./apiClient.js";
import { AppIcon, LoaderIcon, EmptyIcon } from "./icons.jsx";
import { photoToCartItem } from "./shoppingCart.js";
import { sharePhoto } from "./photoShare.js";
import { ProtectedMedia } from "./contentProtection.jsx";
import { springs, triggerHaptic } from "./motionSystem.js";
import "./PhotoFeed.css";

const ORANGE = "#ff6b00";
const ORANGE_LIGHT = "#ffb347";

function formatUpCount(count) {
  const n = Number(count) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function FeedUpIcon({ active = false }) {
  const gradId = `photo-up-${active ? "on" : "off"}`;
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
  const gradId = `photo-cart-${active ? "on" : "off"}`;
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
      <circle cx="9.6" cy="19.4" r="1.5" fill={active ? ORANGE : "#f0ece4"} />
      <circle cx="16.4" cy="19.4" r="1.5" fill={active ? ORANGE : "#f0ece4"} />
    </svg>
  );
}

function PhotoFeedAction({
  label,
  count,
  active = false,
  accent,
  disabled = false,
  onClick,
  ariaLabel,
  ariaPressed,
  icon,
}) {
  return (
    <motion.button
      type="button"
      className={`photo-feed-action${active ? " is-active" : ""}${accent ? ` photo-feed-action--${accent}` : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      whileTap={{ scale: 0.88, y: 1 }}
      transition={springs.snappy}
    >
      <motion.span className="photo-feed-action__btn" whileTap={{ scale: 0.94 }} transition={springs.snappy}>
        <motion.span
          className="photo-feed-action__icon"
          whileTap={{ rotate: accent === "share" ? 12 : accent === "up" ? -8 : -4, scale: 0.94 }}
          transition={springs.snappy}
        >
          {icon}
        </motion.span>
      </motion.span>
      {count != null && count !== "" && (
        <motion.span
          className="photo-feed-action__count"
          key={String(count)}
          initial={{ scale: 0.85, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springs.snappy}
        >
          {count}
        </motion.span>
      )}
      <span className="photo-feed-action__label">{label}</span>
    </motion.button>
  );
}

function DoubleTapBurst({ x, y, keyId }) {
  return (
    <motion.div
      key={keyId}
      className="photo-feed-slide__burst"
      style={{ left: x, top: y }}
      initial={{ scale: 0.2, opacity: 0 }}
      animate={{ scale: [0.2, 1.15, 1], opacity: [0, 1, 0] }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <FeedUpIcon active />
    </motion.div>
  );
}

function PhotoSlide({
  photo,
  isActive,
  isLoggedIn,
  isOwn,
  canDownload,
  onRequireAuth,
  onUpvote,
  onOpenPhotographer,
  cart,
  onOpenCart,
  onDownload,
  renderClaimButton,
  upvoteBusy,
  onShare,
  reducedMotion,
}) {
  const [loaded, setLoaded] = useState(false);
  const [burst, setBurst] = useState(null);
  const lastTapRef = useRef(0);
  const photographerName = photo.photographer?.name || "MOTOSHOT";
  const inCart = Boolean(cart?.isInCart?.("photo", photo.id));
  const owned = Boolean(canDownload);
  const canBuy = !isOwn && !owned;

  const fireUpvote = (e) => {
    e?.stopPropagation?.();
    if (!isLoggedIn) {
      onRequireAuth?.();
      return;
    }
    onUpvote?.(photo.id);
    triggerHaptic("light");
  };

  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      const point = e.nativeEvent?.changedTouches?.[0] || e;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (point.clientX ?? 0) - rect.left;
      const y = (point.clientY ?? 0) - rect.top;
      setBurst({ x, y, id: now });
      if (!photo.upvoted_by_me) fireUpvote(e);
      window.setTimeout(() => setBurst(null), 750);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  };

  const handleCart = (e) => {
    e.stopPropagation();
    if (!canBuy) {
      if (owned) onDownload?.(photo);
      return;
    }
    if (!inCart) cart?.addItem?.(photoToCartItem(photo));
    onOpenCart?.();
    triggerHaptic("light");
  };

  const cartLabel = isOwn ? "Tuya" : owned ? "HD" : `Q${photo.price}`;

  return (
    <section
      className={`photo-feed-slide${isActive ? " is-active" : ""}`}
      data-photo-id={photo.id}
    >
      <ProtectedMedia className="photo-feed-slide__media">
        <motion.img
          src={photo.watermark_url}
          alt={photographerName}
          className="photo-feed-slide__image"
          draggable={false}
          onLoad={() => setLoaded(true)}
          initial={false}
          animate={
            reducedMotion
              ? { scale: 1, opacity: loaded ? 1 : 0.4 }
              : {
                  scale: isActive ? 1 : 1.06,
                  opacity: loaded ? 1 : 0.35,
                }
          }
          transition={springs.soft}
        />
        {!owned && loaded && (
          <div className="photo-feed-slide__watermark" aria-hidden="true">
            <div className="photo-feed-slide__watermark-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i}>{`© ${photographerName}`}</span>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          className="photo-feed-slide__tap"
          aria-label="Doble toque para UP"
          onClick={handleDoubleTap}
        />
        <AnimatePresence>
          {burst && <DoubleTapBurst keyId={burst.id} x={burst.x} y={burst.y} />}
        </AnimatePresence>
      </ProtectedMedia>

      <div className="photo-feed-slide__scrim" aria-hidden="true" />

      <motion.div
        className="photo-feed-slide__actions"
        initial={false}
        animate={
          reducedMotion
            ? { opacity: 1, x: 0 }
            : { opacity: isActive ? 1 : 0.35, x: isActive ? 0 : 12 }
        }
        transition={springs.snappy}
      >
        <PhotoFeedAction
          label="UP"
          count={formatUpCount(photo.upvote_count)}
          active={Boolean(photo.upvoted_by_me)}
          accent="up"
          disabled={upvoteBusy}
          onClick={fireUpvote}
          ariaLabel={photo.upvoted_by_me ? "Quitar UP" : "Dar UP"}
          ariaPressed={Boolean(photo.upvoted_by_me)}
          icon={<FeedUpIcon active={Boolean(photo.upvoted_by_me)} />}
        />
        <PhotoFeedAction
          label={cartLabel}
          active={inCart && canBuy}
          accent="cart"
          onClick={handleCart}
          ariaLabel={owned ? "Descargar HD" : inCart ? "Ver carrito" : "Agregar al carrito"}
          icon={<FeedCartIcon active={inCart && canBuy} owned={owned || isOwn} />}
        />
        <PhotoFeedAction
          label="Share"
          accent="share"
          onClick={(e) => {
            e.stopPropagation();
            onShare?.(photo);
          }}
          ariaLabel="Compartir foto"
          icon={<FeedShareIcon />}
        />
      </motion.div>

      <motion.div
        className="photo-feed-slide__meta"
        initial={false}
        animate={
          reducedMotion
            ? { opacity: 1, y: 0 }
            : { opacity: isActive ? 1 : 0.5, y: isActive ? 0 : 18 }
        }
        transition={springs.soft}
      >
        <button
          type="button"
          className="photo-feed-slide__photographer"
          onClick={(e) => onOpenPhotographer?.(photo, e)}
        >
          {photo.photographer?.avatar_url ? (
            <img src={photo.photographer.avatar_url} alt="" className="photo-feed-slide__avatar" />
          ) : (
            <span className="photo-feed-slide__avatar photo-feed-slide__avatar--fallback">
              {(photographerName || "M").slice(0, 1)}
            </span>
          )}
          <span>
            <span className="photo-feed-slide__name">{photographerName}</span>
            {photo.location && (
              <span className="photo-feed-slide__place">{photo.location}</span>
            )}
          </span>
        </button>

        <div className="photo-feed-slide__commerce">
          <div className="photo-feed-slide__price">Q{photo.price}</div>
          {!isOwn && !owned && (
            <div className="photo-feed-slide__commerce-actions">
              {renderClaimButton?.("photo", photo.id, photo.photographer?.id || photo.photographer_id, { compact: true })}
            </div>
          )}
          {owned && (
            <button type="button" className="photo-feed-slide__hd" onClick={() => onDownload?.(photo)}>
              Descargar HD
            </button>
          )}
        </div>

        {Array.isArray(photo.tags) && photo.tags.length > 0 && (
          <div className="photo-feed-slide__tags">
            {photo.tags.slice(0, 4).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
      </motion.div>
    </section>
  );
}

function normalizePhotoList(list) {
  const seen = new Set();
  return (list || []).filter((p) => {
    if (!p?.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  }).map((p) => ({
    ...p,
    upvote_count: Number(p.upvote_count) || 0,
    upvoted_by_me: Boolean(p.upvoted_by_me),
  }));
}

export default function PhotoFeed({
  initialPhotos = [],
  focusPhotoId,
  session,
  isLoggedIn,
  onRequireAuth,
  onBack,
  cart,
  onOpenCart,
  isOwnPhoto,
  canDownloadPhoto,
  renderClaimButton,
  onOpenPhotographer,
  onDownload,
  showToast,
  photographerId = null,
  enableLoadMore = true,
}) {
  const reducedMotion = useReducedMotion();
  const [photos, setPhotos] = useState(() => normalizePhotoList(initialPhotos));
  const [activeId, setActiveId] = useState(focusPhotoId || initialPhotos[0]?.id || null);
  const [upvoteBusyId, setUpvoteBusyId] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(Boolean(enableLoadMore));
  const containerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const offsetRef = useRef(normalizePhotoList(initialPhotos).length);
  const loadingMoreRef = useRef(false);
  const focusAppliedRef = useRef(null);

  const authHeaders = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const scrollToPhoto = useCallback((photoId) => {
    const root = containerRef.current;
    if (!root || !photoId) return false;
    const slide = root.querySelector(`[data-photo-id="${photoId}"]`);
    if (!slide) return false;
    slide.scrollIntoView({ behavior: "auto", block: "start" });
    setActiveId(photoId);
    return true;
  }, []);

  useEffect(() => {
    const next = normalizePhotoList(initialPhotos);
    setPhotos(next);
    offsetRef.current = next.length;
    setHasMore(Boolean(enableLoadMore));
    focusAppliedRef.current = null;
    const target = focusPhotoId && next.some((p) => p.id === focusPhotoId)
      ? focusPhotoId
      : next[0]?.id || null;
    setActiveId(target);
    window.requestAnimationFrame(() => {
      if (target) scrollToPhoto(target);
    });
  }, [initialPhotos, focusPhotoId, enableLoadMore, scrollToPhoto]);

  useEffect(() => {
    if (!focusPhotoId || focusAppliedRef.current === focusPhotoId) return;
    if (scrollToPhoto(focusPhotoId)) focusAppliedRef.current = focusPhotoId;
  }, [focusPhotoId, photos, scrollToPhoto]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;
    const slides = root.querySelectorAll(".photo-feed-slide");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.dataset?.photoId) {
          setActiveId(visible.target.dataset.photoId);
        }
      },
      { root, threshold: [0.55, 0.75, 0.9] },
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [photos]);

  const loadMore = useCallback(async () => {
    if (!enableLoadMore || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: "12",
        offset: String(offsetRef.current),
      });
      if (photographerId) params.set("photographer_id", photographerId);
      const { res, data } = await apiJson(`/api/photos?${params}`, { headers: authHeaders });
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar más fotos");
      const incoming = normalizePhotoList(data.photos || []);
      setPhotos((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = incoming.filter((p) => !seen.has(p.id));
        offsetRef.current += fresh.length;
        return [...prev, ...fresh];
      });
      setHasMore(Boolean(data.has_more) && incoming.length > 0);
    } catch (err) {
      console.error("PhotoFeed loadMore:", err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [authHeaders, enableLoadMore, hasMore, photographerId]);

  useEffect(() => {
    const root = containerRef.current;
    const sentinel = loadMoreRef.current;
    if (!root || !sentinel || !hasMore || loadingMore) return undefined;
    const loader = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root, rootMargin: "280px" },
    );
    loader.observe(sentinel);
    return () => loader.disconnect();
  }, [hasMore, loadingMore, loadMore, photos.length]);

  const handleUpvote = async (photoId) => {
    if (!session?.access_token || upvoteBusyId) return;
    setUpvoteBusyId(photoId);
    const previous = photos.find((p) => p.id === photoId);
    const optimisticUpvoted = !previous?.upvoted_by_me;
    const optimisticCount = Math.max(
      0,
      (Number(previous?.upvote_count) || 0) + (optimisticUpvoted ? 1 : -1),
    );
    setPhotos((prev) => prev.map((p) => (
      p.id === photoId
        ? { ...p, upvoted_by_me: optimisticUpvoted, upvote_count: optimisticCount }
        : p
    )));
    try {
      const { res, data } = await apiJson(`/api/photos/${photoId}/upvote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el UP");
      setPhotos((prev) => prev.map((p) => (
        p.id === photoId
          ? { ...p, upvoted_by_me: Boolean(data.upvoted), upvote_count: Number(data.upvote_count) || 0 }
          : p
      )));
    } catch (err) {
      console.error("PhotoFeed upvote:", err);
      showToast?.(err.message || "Error al dar UP.");
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...previous } : p)));
    } finally {
      setUpvoteBusyId(null);
    }
  };

  const handleShare = useCallback(async (photo) => {
    await sharePhoto(photo, { showToast });
  }, [showToast]);

  if (!photos.length) {
    return (
      <div className="photo-feed-shell" data-no-ptr>
        <div className="photo-feed__header">
          <button type="button" className="photo-feed__back" onClick={onBack}>
            <AppIcon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} />
            Volver
          </button>
        </div>
        <div className="photo-feed__empty">
          <EmptyIcon name="camera" />
          <div className="photo-feed__empty-title">SIN FOTOS</div>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-feed-shell" data-no-ptr>
      <div className="photo-feed__header">
        <button type="button" className="photo-feed__back" onClick={onBack}>
          <AppIcon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} />
          Volver
        </button>
        <div className="photo-feed__header-title">FOTOS</div>
        <span className="photo-feed__header-hint">Desliza</span>
      </div>

      <div className="photo-feed" ref={containerRef}>
        {photos.map((photo) => (
          <PhotoSlide
            key={photo.id}
            photo={photo}
            isActive={activeId === photo.id}
            isLoggedIn={isLoggedIn}
            isOwn={Boolean(isOwnPhoto?.(photo))}
            canDownload={Boolean(canDownloadPhoto?.(photo))}
            onRequireAuth={onRequireAuth}
            onUpvote={handleUpvote}
            onOpenPhotographer={onOpenPhotographer}
            cart={cart}
            onOpenCart={onOpenCart}
            onDownload={onDownload}
            renderClaimButton={renderClaimButton}
            upvoteBusy={upvoteBusyId === photo.id}
            onShare={handleShare}
            reducedMotion={!!reducedMotion}
          />
        ))}
        {hasMore && (
          <div className="photo-feed__load-more" ref={loadMoreRef}>
            {loadingMore ? <LoaderIcon size={28} /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
