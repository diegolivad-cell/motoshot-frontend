function base64ToFile(base64, mimeType, fileName) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

/** Abre la galería en la app nativa (Capacitor). */
export async function pickVisualSearchPhotoFromGallery() {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality: 88,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: CameraSource.Photos,
    correctOrientation: true,
  });

  const fmt = String(photo.format || "jpeg").toLowerCase();
  const mimeType = fmt === "png" ? "image/png" : "image/jpeg";
  const ext = fmt === "png" ? "png" : "jpg";
  return base64ToFile(photo.base64String, mimeType, `moto-busqueda.${ext}`);
}
