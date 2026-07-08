import { AppIcon } from "./icons";

export function getVideoThumbnail(video) {
  if (!video) return null;
  return video.thumbnail_url || null;
}

function withThumbnailCacheBust(src) {
  if (!src) return src;
  const match = String(src).match(/thumbnail_(\d+)\./);
  if (!match) return src;
  const sep = src.includes("?") ? "&" : "?";
  return `${src}${sep}v=${match[1]}`;
}

/** Siempre muestra thumbnail_url como imagen. Nunca usa <video> para la vista estática (Android-safe). */
export function VideoThumbnail({
  video,
  src,
  alt = "",
  className = "",
  style,
  objectFit = "cover",
  loading = "lazy",
  showFallback = true,
  fallbackIconSize = 28,
  onLoad,
}) {
  const thumbSrc = withThumbnailCacheBust(src || getVideoThumbnail(video));
  const mergedStyle = {
    width: "100%",
    height: "100%",
    objectFit,
    display: "block",
    ...style,
  };

  if (thumbSrc) {
    return (
      <img
        src={thumbSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        draggable={false}
        className={className}
        style={mergedStyle}
        onLoad={onLoad}
      />
    );
  }

  if (!showFallback) return null;

  return (
    <div
      className={`video-thumbnail-fallback${className ? ` ${className}` : ""}`}
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #141414 0%, #0a0a0a 100%)",
        ...style,
      }}
    >
      <AppIcon name="video" size={fallbackIconSize} color="var(--muted)" />
    </div>
  );
}
