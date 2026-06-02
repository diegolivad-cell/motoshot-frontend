import { motion } from "framer-motion";

const ICONS = {
  feed: (
    <>
      <circle cx="7" cy="16" r="2.75" strokeWidth="1.8" />
      <circle cx="17" cy="16" r="2.75" strokeWidth="1.8" />
      <path d="M9.75 16h1.5l1.5-4.5h2l1.5 4.5h1.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5.5V7.5M10.5 7.5h3" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  upload: (
    <>
      <path d="M9 8h6l1.5 3H20v9H4V11h3.5L9 8z" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="2.5" strokeWidth="1.8" />
      <path d="M12 10.5v5M10.5 12h3" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  dash: (
    <path d="M5 18V10M10 18V6M15 18v-5M20 18V8" strokeWidth="2" strokeLinecap="round" />
  ),
  purchases: (
    <>
      <path d="M7 7h10l1 4H6l1-4z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 11v7h10v-7" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 14h4" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  gallery: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" strokeWidth="1.8" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" strokeWidth="1.8" />
      <path d="M5 19c0-3.5 3.1-6 7-6s7 2.5 7 6" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" strokeWidth="1.8" />
      <path d="M5 19c0-3.5 3.1-6 7-6s7 2.5 7 6" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" strokeWidth="1.8" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  payroll: (
    <>
      <path d="M9 5h6a2 2 0 0 1 2 2v13H7V7a2 2 0 0 1 2-2z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" strokeWidth="1.8" />
      <path d="M9 11h6M9 14h4" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="17" r="2.75" strokeWidth="1.6" />
      <path d="M16.5 16.2v1.6M15.4 17h2.2" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  control: (
    <>
      <path d="M12 3l7 3v6c0 5-3 8.5-7 9-4-.5-7-4-7-9V6l7-3z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2.5 2.5L15 9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  camera: (
    <>
      <path d="M9 8h6l1.5 3H20v9H4V11h3.5L9 8z" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="14" r="2.5" strokeWidth="1.8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" strokeWidth="1.8" />
      <path d="M16 16l4 4" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  lock: (
    <>
      <rect x="6" y="11" width="12" height="9" rx="2" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  receipt: (
    <>
      <path d="M7 7h10l1 4H6l1-4z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 11v7h10v-7" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 14h4" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 5h6a2 2 0 0 1 2 2v13H7V7a2 2 0 0 1 2-2z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" strokeWidth="1.8" />
    </>
  ),
  bell: (
    <>
      <path d="M12 4a5 5 0 0 0-5 5v3l-1.5 2.5h13L17 12V9a5 5 0 0 0-5-5z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  bellOff: (
    <>
      <path d="M12 4a5 5 0 0 0-5 5v3l-1.5 2.5h13L17 12V9a5 5 0 0 0-5-5z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 4l16 16" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  star: (
    <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.3L12 15.8 7.2 18.3l.9-5.3-3.9-3.8 5.4-.8L12 3.5z" strokeWidth="1.8" strokeLinejoin="round" />
  ),
  megaphone: (
    <>
      <path d="M5 10v4l10 5V5L5 10z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M15 8v8" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 14v3a2 2 0 0 0 2 2h1" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  folder: (
    <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" strokeWidth="1.8" strokeLinejoin="round" />
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V5h6v2M10 11v5M14 11v5M6 7l1 12h10l1-12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  money: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" strokeWidth="1.8" />
      <path d="M7 9h.01M17 15h.01" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  scissors: (
    <>
      <circle cx="7" cy="7" r="2" strokeWidth="1.8" />
      <circle cx="7" cy="17" r="2" strokeWidth="1.8" />
      <path d="M20 4L9 15M9 9l11 11" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  check: (
    <path d="M5 12l4 4L19 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <path d="M8 12l2.5 2.5L16 9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  x: (
    <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
  ),
  alert: (
    <>
      <path d="M12 4l8 14H4L12 4z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10v3M12 16h.01" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  edit: (
    <>
      <path d="M4 18h4l9-9-4-4-9 9v4z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 5l4 4" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  creditCard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="1.8" />
      <path d="M3 10h18M7 15h3" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2" strokeWidth="1.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" strokeWidth="1.8" />
      <path d="M8 4v4M16 4v4M4 10h16" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 4v5h-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  document: (
    <>
      <path d="M8 4h8l4 4v12H8V4z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 4v4h4M10 12h8M10 16h6" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  mail: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" strokeWidth="1.8" />
      <path d="M4 8l8 6 8-6" strokeWidth="1.8" strokeLinejoin="round" />
    </>
  ),
  arrowRight: (
    <path d="M5 12h14M13 6l6 6-6 6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.5" strokeWidth="1.8" />
      <path d="M4 16l4-4 3 3 3-4 6 7" strokeWidth="1.8" strokeLinejoin="round" />
    </>
  ),
  fileText: (
    <>
      <path d="M8 4h8l4 4v12H8V4z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 12h4M12 16h4M12 8h2" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" strokeWidth="1.8" />
      <path d="M12 8v4l3 2" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  circle: (
    <circle cx="12" cy="12" r="8" strokeWidth="1.8" />
  ),
  eye: (
    <>
      <path d="M3 12c2.8-4.2 6.2-6.5 9-6.5s6.2 2.3 9 6.5c-2.8 4.2-6.2 6.5-9 6.5S5.8 16.2 3 12z" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.75" strokeWidth="1.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 12c2.8-4.2 6.2-6.5 9-6.5s6.2 2.3 9 6.5c-2.8 4.2-6.2 6.5-9 6.5S5.8 16.2 3 12z" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.75" strokeWidth="1.8" />
      <path d="M5 5l14 14" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <path d="M8 12l3 3 5-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <path d="M9 9l6 6M15 9l-6 6" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
};

export function AppIcon({ name, size = 20, color = "currentColor", style, className }) {
  if (!ICONS[name]) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block", ...style }}
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}

export function LoaderIcon({ size = 40, color = "var(--orange)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "spin 0.9s linear infinite" }}>
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyIcon({ name = "image", size = 48, color = "var(--muted)" }) {
  return (
    <div className="empty-icon" style={{ display: "grid", placeItems: "center" }}>
      <AppIcon name={name} size={size} color={color} />
    </div>
  );
}

export function AvatarPlaceholder({ size = 24, color = "var(--muted)" }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color }}>
      <AppIcon name="user" size={size} color={color} />
    </div>
  );
}

export function IconText({ icon, children, size = 14, gap = 6, color = "currentColor", style }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap, color, ...style }}>
      <AppIcon name={icon} size={size} color={color} />
      {children}
    </span>
  );
}

export function SectionTitleIcon({ icon, children }) {
  return (
    <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <AppIcon name={icon} size={22} color="var(--orange)" />
      {children}
    </div>
  );
}

export function VerifiedBadge({ size = 16 }) {
  return (
    <span style={{ display: "inline-flex", width: size, height: size, borderRadius: "50%", background: "#0095f6", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <AppIcon name="check" size={size * 0.55} color="#fff" />
    </span>
  );
}

export function PasswordVisibilityToggle({ visible, onToggle, className = "" }) {
  return (
    <button
      type="button"
      className={`password-toggle-btn${className ? ` ${className}` : ""}`}
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={visible}
      onClick={onToggle}
    >
      <AppIcon name={visible ? "eyeOff" : "eye"} size={18} color="currentColor" />
    </button>
  );
}

export function AppButton({ className = "", style, disabled, children, onClick, type = "button", ...rest }) {
  const handleClick = (e) => {
    onClick?.(e);
    if (className?.includes("bnav-item")) {
      e.currentTarget.blur();
    }
  };

  return (
    <motion.button
      type={type}
      className={className || undefined}
      style={{
        WebkitTapHighlightColor: "transparent",
        tapHighlightColor: "transparent",
        ...style,
      }}
      disabled={disabled}
      onClick={handleClick}
      whileHover={disabled ? undefined : { scale: 1.05, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ type: "spring", stiffness: 520, damping: 26 }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/** Logotipo tipográfico estilo racing (sin imagen de banner). */
export function MotoShotBrandMark({ variant = "hero", className = "", style, as: Tag = "div" }) {
  return (
    <Tag
      className={`brand-mark brand-mark--${variant}${className ? ` ${className}` : ""}`}
      style={style}
      aria-label="MotoShot GT"
    >
      <span className="brand-mark-word">
        <span className="brand-mark-moto">MOTO</span>
        <span className="brand-mark-shot">SHOT</span>
      </span>
      <span className="brand-mark-gt">.GT</span>
    </Tag>
  );
}

export { ICONS };
