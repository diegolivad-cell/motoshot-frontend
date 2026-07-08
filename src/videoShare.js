export function buildVideoShareUrl(videoId) {
  const id = String(videoId || "").trim();
  if (!id) return "https://motoshot.pro";
  return `https://motoshot.pro/v/${id}`;
}

export function buildVideoShareText(video) {
  const photographer = video?.photographer?.name || "un fotógrafo";
  return `Checa este video de ${photographer} en MotoShot`;
}

export async function shareVideo(video, { showToast } = {}) {
  if (!video?.id) return false;
  const url = buildVideoShareUrl(video.id);
  const text = buildVideoShareText(video);
  const title = "Video en MotoShot GT";

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
    showToast?.("No se pudo compartir el video");
    return false;
  }
}

export function parseVideoIdFromPath(pathname = "") {
  const path = String(pathname || "").replace(/\/$/, "") || "/";
  const match = path.match(/^\/v\/([0-9a-fA-F-]{36})$/);
  return match?.[1] || null;
}
