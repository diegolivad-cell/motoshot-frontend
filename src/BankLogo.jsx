import { bankLogoBg, bankLogoSrc, normalizeBankName } from "./gtBanks";

export function BankLogo({ bank, size = 32, alt }) {
  const normalized = normalizeBankName(bank);
  const src = bankLogoSrc(normalized);
  const bg = bankLogoBg(normalized);
  const label = alt || normalized || "Banco";

  if (!src) {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: "50%",
          background: "rgba(255,107,0,0.12)",
          border: "1px solid rgba(255,107,0,0.35)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          fontSize: Math.max(10, size * 0.34),
          fontWeight: 800,
          color: "var(--orange)",
        }}
      >
        {(normalized || "?").slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: bg,
        border: bg === "#000000" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.12)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <img
        src={src}
        alt={label}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        draggable={false}
        style={{ width: "88%", height: "88%", objectFit: "contain", display: "block" }}
      />
    </span>
  );
}
