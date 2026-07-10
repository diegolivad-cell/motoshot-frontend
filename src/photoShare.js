export function buildPhotoShareUrl(photoId) {
  const id = String(photoId || "").trim();
  if (!id) return "https://motoshot.pro";
  return `https://motoshot.pro/?photo=${encodeURIComponent(id)}`;
}

export function buildPhotoShareText(photo) {
  const photographer = photo?.photographer?.name || "un fotógrafo";
  const place = photo?.location ? ` en ${photo.location}` : "";
  return `Checa esta foto de ${photographer}${place} en MotoShot`;
}

export async function sharePhoto(photo, { showToast } = {}) {
  if (!photo?.id) return false;
  const url = buildPhotoShareUrl(photo.id);
  const text = buildPhotoShareText(photo);
  const title = "Foto en MotoShot GT";

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      if (err?.name === "AbortError") return false;
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    showToast?.("Link copiado al portapapeles");
    return true;
  } catch {
    showToast?.("No se pudo compartir la foto");
    return false;
  }
}
