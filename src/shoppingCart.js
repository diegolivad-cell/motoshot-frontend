const CART_STORAGE_KEY = "motoshot_shopping_cart";

export function cartItemKey(item) {
  return `${item.type}:${item.id}`;
}

export function readCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCartToStorage(items) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function cartTotal(items) {
  return (items || []).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
}

export function photoToCartItem(photo) {
  return {
    type: "photo",
    id: photo.id,
    price: Number(photo.price) || 0,
    title: photo.location || "Foto de rodada",
    subtitle: photo.photographer?.name || "MotoShot",
    thumb_url: photo.watermark_url || photo.preview_url || photo.image_url || "",
    photographer_id: photo.photographer?.id || photo.photographer_id || null,
  };
}

export function videoToCartItem(video) {
  const title =
    [video.moto_brand, video.moto_model].filter(Boolean).join(" ") ||
    video.sector ||
    "Video de rodada";
  return {
    type: "video",
    id: video.id,
    price: Number(video.price) || 0,
    title,
    subtitle: video.photographer?.name || "MotoShot",
    thumb_url: video.thumbnail_url || video.preview_url || "",
    photographer_id: video.photographer?.id || video.photographer_id || null,
  };
}
