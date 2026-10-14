const MAX_PHOTO_DIMENSION = 1600;
const JPEG_QUALITY = 0.72;
const MAX_UPLOAD_SIZE = 8 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function compressPhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Impossible de lire cette image pour la compresser. Essayez un fichier JPEG ou PNG.");
  }

  try {
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Impossible de préparer la compression de cette photo.");

    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const compressed = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Impossible de compresser cette photo.")),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
    if (scale === 1
      && compressed.size >= file.size
      && file.size <= MAX_UPLOAD_SIZE
      && SUPPORTED_IMAGE_TYPES.has(file.type)) return file;
    if (compressed.size > MAX_UPLOAD_SIZE) {
      throw new Error("La photo reste trop volumineuse après compression (8 Mo maximum).");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([compressed], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
