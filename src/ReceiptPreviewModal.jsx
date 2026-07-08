import { AnimatePresence, motion } from "framer-motion";
import { AppButton, AppIcon, LoaderIcon } from "./icons";

export function ReceiptPreviewModal({
  preview,
  onClose,
  onConfirm,
  onSaveToDevice,
  saving,
}) {
  if (!preview) return null;

  const {
    type,
    label,
    previewUrl,
    loading,
    confirming,
    purchase,
  } = preview;

  const confirmed = Boolean(purchase?.buyer_confirmed_at);
  const isVideo = type === "video";

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        style={{ zIndex: 280 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal"
          style={{ maxWidth: 560, width: "min(560px, 94vw)" }}
          initial={{ opacity: 0, scale: 0.92, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 40 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-title">Vista previa HD</div>
            <AppButton className="modal-close" onClick={onClose} aria-label="Cerrar">
              <AppIcon name="x" size={18} />
            </AppButton>
          </div>
          <div className="modal-body" style={{ paddingTop: 8 }}>
            {label && (
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>{label}</div>
            )}
            <div
              style={{
                borderRadius: 10,
                overflow: "hidden",
                background: "#0a0a0a",
                minHeight: 180,
                display: "grid",
                placeItems: "center",
              }}
            >
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  <LoaderIcon size={36} />
                  <div style={{ marginTop: 12, fontSize: 13 }}>Cargando archivo...</div>
                </div>
              ) : isVideo ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  style={{ width: "100%", maxHeight: "55vh", display: "block" }}
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={label || "Vista previa"}
                  style={{ width: "100%", maxHeight: "55vh", objectFit: "contain", display: "block" }}
                />
              )}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>
              El archivo permanece en la nube por 24 horas. Revisalo en HD y marcá Recibido para
              confirmar que estás conforme; así se acredita al fotógrafo y podés guardarlo en tu dispositivo.
            </p>
            {!loading && !confirmed && (
              <AppButton
                className="card-buy"
                style={{ width: "100%", marginTop: 14 }}
                disabled={confirming}
                onClick={onConfirm}
              >
                {confirming ? "Confirmando..." : "Recibido y conforme"}
              </AppButton>
            )}
            {!loading && confirmed && (
              <AppButton
                className="card-buy card-buy-download"
                style={{ width: "100%", marginTop: 14 }}
                disabled={saving}
                onClick={onSaveToDevice}
              >
                {saving ? "Guardando..." : "Guardar en dispositivo"}
              </AppButton>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
