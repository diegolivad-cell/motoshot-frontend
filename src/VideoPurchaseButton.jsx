import { AppButton } from "./icons";

const BTN_DISABLED = {
  background: "var(--surface)",
  color: "var(--muted)",
  border: "1px solid var(--border)",
  opacity: 0.85,
  cursor: "not-allowed",
};

export function VideoPurchaseButton({ purchaseState, onBuy, video, isOwn = false }) {
  const state = purchaseState ?? video?.buyer_purchase_status ?? null;

  if (isOwn) {
    return (
      <AppButton className="card-buy" disabled style={BTN_DISABLED}>
        Tu video
      </AppButton>
    );
  }

  if (state === "entregado") {
    return (
      <AppButton className="card-buy" disabled style={BTN_DISABLED}>
        Entregado
      </AppButton>
    );
  }
  if (state === "comprado") {
    return (
      <AppButton className="card-buy" disabled style={BTN_DISABLED}>
        Comprado
      </AppButton>
    );
  }
  return (
    <AppButton
      className="card-buy"
      onClick={(e) => {
        e.stopPropagation();
        onBuy?.(video);
      }}
    >
      Comprar
    </AppButton>
  );
}
