import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppIcon, AppButton, LoaderIcon } from "./icons";
import { apiJson } from "./apiClient";

function SuccessBurstSvg() {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden>
      <motion.circle
        cx="44"
        cy="44"
        r="34"
        stroke="var(--orange)"
        strokeWidth="2.5"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.35 }}
        transition={{ duration: 0.6 }}
      />
      <motion.circle
        cx="44"
        cy="44"
        r="24"
        fill="rgba(255,107,0,0.12)"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.08, 1] }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      />
      <motion.path
        d="M30 45l10 10 18-22"
        stroke="var(--success)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, delay: 0.15 }}
      />
    </svg>
  );
}

function SocialButton({ href, label, variant = "default" }) {
  if (!href) return null;
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`guest-social-btn guest-social-btn-${variant}`}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
    >
      {label}
    </motion.a>
  );
}

export function GuestSuccessPage({ claimToken, onContinue }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!claimToken) {
      setError("No encontramos tu compra.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { res, data: payload } = await apiJson(`/api/payments/guest-confirmation/${claimToken}`);
        if (!res.ok) throw new Error(payload?.error || "No se pudo cargar tu compra.");
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err.message || "Error cargando confirmación.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claimToken]);

  const photographers = useMemo(() => data?.photographers || [], [data]);

  if (loading) {
    return (
      <div className="guest-success-page guest-success-loading">
        <LoaderIcon size={28} />
        <div>Confirmando tu compra...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="guest-success-page">
        <div className="guest-success-error">{error || "Compra no encontrada"}</div>
        <AppButton className="upload-btn" onClick={onContinue}>Volver al inicio</AppButton>
      </div>
    );
  }

  return (
    <motion.div
      className="guest-success-page"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <motion.div
        className="guest-success-hero"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <SuccessBurstSvg />
        <h1>¡PAGO CONFIRMADO!</h1>
        <p>
          Gracias <strong>{data.buyer_name}</strong>. Enviamos la confirmación a{" "}
          <strong>{data.buyer_email}</strong> y Recurrente te enviará tu comprobante de pago.
        </p>
      </motion.div>

      <motion.div
        className="guest-success-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <div className="guest-success-card-title">
          <AppIcon name="purchases" size={18} color="var(--orange)" />
          Tu compra · Q{Number(data.total_gtq || 0).toFixed(2)}
        </div>
        <div className="guest-success-items">
          {(data.items || []).map((item, index) => (
            <motion.div
              key={`${item.type}-${item.label}-${index}`}
              className="guest-success-item"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * index }}
            >
              {item.thumb_url ? (
                <img src={item.thumb_url} alt="" className="guest-success-item-thumb" />
              ) : (
                <div className="guest-success-item-thumb guest-success-item-thumb-fallback">
                  <AppIcon name={item.type === "video" ? "video" : "image"} size={20} color="var(--orange)" />
                </div>
              )}
              <div>
                <div className="guest-success-item-label">{item.label}</div>
                <div className="guest-success-item-meta">{item.type === "video" ? "Video" : "Foto"} · Q{Number(item.amount || 0).toFixed(2)}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="guest-success-steps"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="guest-success-steps-title">¿Cómo reclamás tu contenido en alta calidad?</div>
        <div className="guest-success-step">
          <span>1</span>
          <p>Revisá tu correo: llegará la confirmación de MotoShot y el comprobante de Recurrente.</p>
        </div>
        <div className="guest-success-step">
          <span>2</span>
          <p>Contactá al fotógrafo por WhatsApp (botón abajo) y enviale ese comprobante.</p>
        </div>
        <div className="guest-success-step">
          <span>3</span>
          <p>El fotógrafo te entregará tu foto o video en máxima calidad.</p>
        </div>
      </motion.div>

      <div className="guest-success-photographers">
        {photographers.map((photographer, index) => (
          <motion.div
            key={photographer.id}
            className="guest-photographer-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.08 }}
          >
            <div className="guest-photographer-head">
              {photographer.avatar_url ? (
                <img src={photographer.avatar_url} alt="" className="guest-photographer-avatar" />
              ) : (
                <div className="guest-photographer-avatar guest-photographer-avatar-fallback">
                  <AppIcon name="profile" size={22} color="var(--orange)" />
                </div>
              )}
              <div>
                <div className="guest-photographer-name">{photographer.name}</div>
                <div className="guest-photographer-handle">@{String(photographer.handle || "").replace(/^@/, "")}</div>
              </div>
            </div>
            <div className="guest-photographer-note">
              Tocá WhatsApp para escribirle directo con tu comprobante de pago.
            </div>
            <div className="guest-photographer-actions">
              <SocialButton
                href={photographer.whatsapp_href}
                label="WhatsApp"
                variant="whatsapp"
              />
              {(photographer.social_links || []).map((link) => (
                <SocialButton key={link.href} href={link.href} label={link.label} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <AppButton className="upload-btn guest-success-continue" onClick={onContinue}>
        Seguir explorando MotoShot
      </AppButton>
    </motion.div>
  );
}
