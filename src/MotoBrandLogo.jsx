import { brandLogoBg, brandLogoSrc, getBrandColor, normalizeMotoBrandKey } from "./motoBrands";

export function MotoBrandLogo({ brand, size = 16 }) {
  const label = String(brand || "").trim();
  const brandKey = normalizeMotoBrandKey(label);
  const src = brandLogoSrc(label);
  const bg = brandLogoBg(label);
  const color = getBrandColor(label);

  if (!brandKey) return null;

  if (!src) {
    return (
      <span
        aria-hidden
        title={label}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: 4,
          background: `${color}22`,
          border: `1px solid ${color}55`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          fontSize: Math.max(8, size * 0.38),
          fontWeight: 800,
          color,
          lineHeight: 1,
        }}
      >
        {label.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      aria-hidden
      title={label}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 4,
        overflow: "hidden",
        background: bg,
        border: bg === "#ffffff" ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.08)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        padding: 1,
      }}
    >
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </span>
  );
}

const marcaLabelStyle = {
  fontSize: 10,
  color: "var(--muted)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  marginRight: 5,
  flexShrink: 0,
};

/** Fila «Marca:» con logo SVG + nombre (cards de video públicas). */
export function VideoMarcaLabel({ brand }) {
  const label = String(brand || "").trim();
  if (!label) return null;

  return (
    <div
      style={{
        fontSize: 12,
        color: getBrandColor(label),
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        textAlign: "left",
      }}
    >
      <span style={marcaLabelStyle}>Marca:</span>
      <MotoBrandLogo brand={label} size={16} />
      <span>{label}</span>
    </div>
  );
}

const videoTagRowStyle = {
  fontSize: 12,
  color: "var(--text)",
};

const videoTagLabelStyle = {
  fontSize: 10,
  color: "var(--muted)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  marginRight: 5,
};

function VideoTagRow({ label, value }) {
  const text = String(value || "").trim();
  if (!text) return null;
  return (
    <div style={videoTagRowStyle}>
      <span style={videoTagLabelStyle}>{label}</span>
      {text}
    </div>
  );
}

/** Tags completos de un video (marca con logo, modelo, colores, placa, etc.). */
export function VideoCardTags({ video, style }) {
  if (!video) return null;

  const extraTags = Array.isArray(video.additional_tags)
    ? video.additional_tags.map((t) => String(t || "").trim()).filter(Boolean)
    : [];

  const hasContent = Boolean(
    video.moto_brand
    || video.moto_model
    || video.moto_color
    || video.helmet_color
    || video.suit_color
    || video.dorsal
    || video.sector
    || video.event_time_start
    || extraTags.length,
  );

  if (!hasContent) return null;

  const timeLabel = video.event_time_start
    ? (video.event_time_end ? `${video.event_time_start} a ${video.event_time_end}` : video.event_time_start)
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 3,
        marginBottom: 10,
        textAlign: "left",
        ...style,
      }}
    >
      <VideoMarcaLabel brand={video.moto_brand} />
      <VideoTagRow label="Modelo:" value={video.moto_model} />
      <VideoTagRow label="Color:" value={video.moto_color} />
      <VideoTagRow label="Casco:" value={video.helmet_color} />
      <VideoTagRow label="Traje:" value={video.suit_color} />
      <VideoTagRow label="Placa:" value={video.dorsal} />
      <VideoTagRow label="Ubicación:" value={video.sector} />
      <VideoTagRow label="Horario:" value={timeLabel} />
      {extraTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {extraTags.map((tag) => (
            <span key={tag} className="tag" style={{ fontSize: 11 }}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pill de marca + modelo con logo (compatibilidad). */
export function VideoBrandTag({ brand, model }) {
  const brandLabel = String(brand || "").trim();
  if (!brandLabel) return null;
  const modelLabel = String(model || "").trim();

  return (
    <span
      className="tag active"
      style={{
        fontSize: 11,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: getBrandColor(brandLabel),
      }}
    >
      <MotoBrandLogo brand={brandLabel} size={14} />
      <span>
        {brandLabel}
        {modelLabel ? ` ${modelLabel}` : ""}
      </span>
    </span>
  );
}
