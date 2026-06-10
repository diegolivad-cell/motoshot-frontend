// Subida directa a Supabase Storage desde el navegador.
// Usa XHR contra la REST API de Storage (lo mismo que hace supabase-js)
// para poder reportar progreso de subida, que supabase-js no expone.
import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function videoExtForFile(file) {
  const type = String(file?.type || "");
  if (type === "video/quicktime") return "mov";
  if (type.includes("avi")) return "avi";
  return "mp4";
}

export function imageExtForFile(file) {
  const type = String(file?.type || "");
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export function imageMimeForFile(file) {
  const type = String(file?.type || "");
  if (type.startsWith("image/")) return type;
  const ext = imageExtForFile(file);
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export function uploadToSupabaseStorage({
  bucket,
  path,
  file,
  accessToken,
  contentType,
  onProgress,
  timeoutMs = 30 * 60 * 1000,
}) {
  return new Promise((resolve, reject) => {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodedPath}`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", contentType || file.type || "application/octet-stream");
    xhr.timeout = timeoutMs;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Error de Storage (HTTP ${xhr.status})`;
      try {
        const data = JSON.parse(xhr.responseText);
        msg = data.message || data.error || msg;
      } catch { /* respuesta no JSON */ }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Error de conexión subiendo el archivo."));
    xhr.ontimeout = () => reject(new Error("La subida tardó demasiado y se canceló."));

    xhr.send(file);
  });
}

// Limpieza best-effort si el registro en el backend falla.
export async function removeFromSupabaseStorage(bucket, path) {
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch { /* ignore */ }
}
