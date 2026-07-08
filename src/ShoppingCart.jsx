import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  cartItemKey,
  cartTotal,
  readCartFromStorage,
  writeCartToStorage,
} from "./shoppingCart";
import { AppIcon, AppButton, LoaderIcon } from "./icons";

function CartSvgIcon({ size = 28, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <motion.path
        d="M10 12h6l4.2 22.5H48l5-18H18"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: filled ? 1 : 0.92 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      />
      <motion.circle
        cx="27"
        cy="50"
        r="3.5"
        fill="currentColor"
        animate={{ scale: filled ? [1, 1.25, 1] : 1 }}
        transition={{ duration: 0.35 }}
      />
      <motion.circle
        cx="44"
        cy="50"
        r="3.5"
        fill="currentColor"
        animate={{ scale: filled ? [1, 1.25, 1] : 1 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      />
      <motion.path
        d="M22 8h12l3 4H19l3-4z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
        animate={{ y: filled ? [0, -2, 0] : 0 }}
        transition={{ duration: 0.45 }}
      />
    </svg>
  );
}

export function useShoppingCart({
  isLoggedIn,
  showToast,
}) {
  const [items, setItems] = useState(() => readCartFromStorage());
  const [bump, setBump] = useState(0);

  useEffect(() => {
    writeCartToStorage(items);
  }, [items]);

  const count = items.length;
  const total = useMemo(() => cartTotal(items), [items]);

  const isInCart = useCallback(
    (type, id) => items.some((item) => item.type === type && item.id === id),
    [items]
  );

  const addItem = useCallback(
    (item) => {
      if (!item?.id || !item?.type) return false;
      if (isInCart(item.type, item.id)) {
        showToast?.("Ya está en tu carrito.");
        return false;
      }
      setItems((prev) => [...prev, item]);
      setBump((n) => n + 1);
      showToast?.("Agregado al carrito");
      return true;
    },
    [isInCart, showToast]
  );

  const removeItem = useCallback((type, id) => {
    setItems((prev) => prev.filter((item) => !(item.type === type && item.id === id)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    count,
    total,
    bump,
    isInCart,
    addItem,
    removeItem,
    clearCart,
    setItems,
  };
}

export function ShoppingCartWidget({
  cart,
  minCheckoutGtq = 5,
  checkoutLoading = false,
  onCheckout,
  onRequireLogin,
  isLoggedIn,
  hidden = false,
  fabHidden = false,
  openSignal = 0,
  panelSuppressed = false,
}) {
  const [open, setOpen] = useState(false);
  const { items, count, total, bump, removeItem, clearCart } = cart;
  const panelOpen = open && !panelSuppressed;

  useEffect(() => {
    if (panelSuppressed) setOpen(false);
  }, [panelSuppressed]);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  if (hidden) return null;

  return (
    <>
      {!fabHidden && (
        <motion.button
          type="button"
          className="shopping-cart-fab"
          aria-label={`Carrito de compras${count ? `, ${count} ítems` : ""}`}
          onClick={() => setOpen((v) => !v)}
          whileTap={{ scale: 0.94 }}
          animate={bump ? { scale: [1, 1.12, 1], rotate: [0, -6, 6, 0] } : { scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 16 }}
        >
          <span className="shopping-cart-fab-glow" aria-hidden />
          <CartSvgIcon size={30} filled={count > 0} />
          <AnimatePresence>
            {count > 0 && (
              <motion.span
                key={count}
                className="shopping-cart-fab-badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
              >
                {count}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      )}

      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.button
              type="button"
              className="shopping-cart-backdrop"
              aria-label="Cerrar carrito"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="shopping-cart-panel"
              role="dialog"
              aria-label="Carrito de compras"
              initial={{ x: "105%", opacity: 0.4 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "105%", opacity: 0.2 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="shopping-cart-panel-header">
                <div>
                  <div className="shopping-cart-panel-title">TU CARRITO</div>
                  <div className="shopping-cart-panel-sub">
                    {count ? `${count} ítem(s) · una sola transacción Recurrente` : "Agregá fotos o videos"}
                  </div>
                </div>
                <AppButton className="modal-close" onClick={() => setOpen(false)} aria-label="Cerrar">
                  <AppIcon name="x" size={18} />
                </AppButton>
              </div>

              {items.length === 0 ? (
                <div className="shopping-cart-empty">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                  >
                    <CartSvgIcon size={56} />
                  </motion.div>
                  <div>Tu carrito está vacío</div>
                  <div className="shopping-cart-empty-hint">Tocá + en las fotos o videos que quieras comprar.</div>
                </div>
              ) : (
                <div className="shopping-cart-items">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.div
                        key={cartItemKey(item)}
                        className="shopping-cart-item"
                        layout
                        initial={{ opacity: 0, x: 24, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -24, scale: 0.92, height: 0, marginBottom: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      >
                        <div className="shopping-cart-item-thumb-wrap">
                          {item.thumb_url ? (
                            <img src={item.thumb_url} alt="" className="shopping-cart-item-thumb" />
                          ) : (
                            <div className="shopping-cart-item-thumb shopping-cart-item-thumb-fallback">
                              <AppIcon name={item.type === "video" ? "video" : "image"} size={22} color="var(--orange)" />
                            </div>
                          )}
                          <span className={`shopping-cart-item-type ${item.type}`}>
                            {item.type === "video" ? "Video" : "Foto"}
                          </span>
                        </div>
                        <div className="shopping-cart-item-body">
                          <div className="shopping-cart-item-title">{item.title}</div>
                          <div className="shopping-cart-item-sub">{item.subtitle}</div>
                          <div className="shopping-cart-item-price">Q{Number(item.price).toFixed(2)}</div>
                        </div>
                        <button
                          type="button"
                          className="shopping-cart-item-remove"
                          aria-label="Quitar del carrito"
                          onClick={() => removeItem(item.type, item.id)}
                        >
                          <AppIcon name="trash" size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <div className="shopping-cart-footer">
                <div className="shopping-cart-total-row">
                  <span>Total</span>
                  <motion.span
                    key={total}
                    className="shopping-cart-total-value"
                    initial={{ scale: 1.12, color: "var(--orange-light)" }}
                    animate={{ scale: 1, color: "var(--success)" }}
                  >
                    Q{total.toFixed(2)}
                  </motion.span>
                </div>
                {total > 0 && total < minCheckoutGtq && (
                  <div className="shopping-cart-min-note">
                    Mínimo Q{minCheckoutGtq.toFixed(2)} para pagar con Recurrente.
                  </div>
                )}
                <div className="shopping-cart-footer-actions">
                  {items.length > 0 && (
                    <AppButton className="nav-btn" onClick={clearCart} disabled={checkoutLoading}>
                      Vaciar
                    </AppButton>
                  )}
                  <AppButton
                    className="pay-btn shopping-cart-checkout-btn"
                    disabled={!items.length || total < minCheckoutGtq || checkoutLoading}
                    onClick={() => onCheckout?.({ items, total, closePanel: () => setOpen(false) })}
                  >
                    {checkoutLoading ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <LoaderIcon size={16} /> Procesando...
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <AppIcon name="money" size={16} />
                        Pagar Q{total.toFixed(2)}
                      </span>
                    )}
                  </AppButton>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function AddToCartButton({ inCart, onClick, compact = false, disabled = false }) {
  return (
    <motion.button
      type="button"
      className={`add-to-cart-btn${compact ? " is-compact" : ""}${inCart ? " is-in-cart" : ""}`}
      aria-label={inCart ? "En el carrito" : "Agregar al carrito"}
      disabled={disabled || inCart}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      whileTap={{ scale: 0.9 }}
      animate={inCart ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
    >
      {inCart ? <AppIcon name="check" size={compact ? 14 : 16} /> : <AppIcon name="purchases" size={compact ? 14 : 16} />}
      {!compact && <span>{inCart ? "En carrito" : "Carrito"}</span>}
    </motion.button>
  );
}
