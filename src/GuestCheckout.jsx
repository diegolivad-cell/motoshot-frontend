import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppIcon, AppButton, LoaderIcon } from "./icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GuestMailSvg() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
      <motion.rect
        x="10"
        y="18"
        width="52"
        height="36"
        rx="8"
        stroke="currentColor"
        strokeWidth="2.8"
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.path
        d="M12 22l24 18 24-18"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, delay: 0.15 }}
      />
      <motion.circle
        cx="56"
        cy="20"
        r="8"
        fill="var(--orange)"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.15, 1] }}
        transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.45 }}
      />
      <motion.path
        d="M53 20l2 2 4-4"
        stroke="#111"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.25, delay: 0.7 }}
      />
    </svg>
  );
}

export function GuestCheckoutModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  title = "Datos para tu compra",
  subtitle = "Sin crear cuenta. Te enviamos la confirmación y el comprobante por correo.",
  submitLabel = "Continuar al pago",
  initialName = "",
  initialEmail = "",
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setEmail(initialEmail);
    setError("");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, initialName, initialEmail]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      setError("Ingresá tu nombre.");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Ingresá un correo válido.");
      return;
    }
    setError("");
    onSubmit?.({ guest_name: trimmedName, guest_email: trimmedEmail });
  };

  const modal = (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="guest-checkout-backdrop"
            aria-label="Cerrar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="guest-checkout-shell" role="presentation">
            <motion.div
              className="guest-checkout-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Datos de compra invitado"
              initial={{ opacity: 0, y: 28, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <AppButton
                type="button"
                className="modal-close guest-checkout-close"
                onClick={onClose}
                aria-label="Cerrar"
                disabled={loading}
              >
                <AppIcon name="x" size={18} />
              </AppButton>
              <div className="guest-checkout-icon-wrap">
                <GuestMailSvg />
              </div>
              <div className="guest-checkout-title">{title}</div>
              <div className="guest-checkout-sub">{subtitle}</div>

              <form className="guest-checkout-form" onSubmit={handleSubmit}>
                <label className="guest-checkout-label">
                  Nombre completo
                  <input
                    className="search-input guest-checkout-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    autoComplete="name"
                    disabled={loading}
                  />
                </label>
                <label className="guest-checkout-label">
                  Correo electrónico
                  <input
                    className="search-input guest-checkout-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    disabled={loading}
                  />
                </label>

                {error && (
                  <motion.div
                    className="guest-checkout-error"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.div>
                )}

                <div className="guest-checkout-actions">
                  <AppButton type="button" className="nav-btn" onClick={onClose} disabled={loading}>
                    Cancelar
                  </AppButton>
                  <AppButton type="submit" className="pay-btn" disabled={loading}>
                    {loading ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <LoaderIcon size={16} /> Procesando...
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <AppIcon name="money" size={16} />
                        {submitLabel}
                      </span>
                    )}
                  </AppButton>
                </div>
              </form>

              <div className="guest-checkout-footnote">
                Recibirás comprobante de MotoShot y Recurrente. Contactá al fotógrafo por WhatsApp para reclamar tu contenido en alta calidad.
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

export function readGuestCheckoutDraft() {
  try {
    const raw = localStorage.getItem("motoshot_guest_checkout");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeGuestCheckoutDraft(data) {
  try {
    localStorage.setItem("motoshot_guest_checkout", JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearGuestCheckoutDraft() {
  try {
    localStorage.removeItem("motoshot_guest_checkout");
  } catch {
    /* ignore */
  }
}
