/** Largest side of a stored avatar, in pixels: avatars are shown at 96px or less, 2x for sharp screens. */
const AVATAR_SIDE = 256;

/**
 * The picked photo as a small square data URL (center crop, 256px, WebP or JPEG).
 * Avatars are stored in the user row and read with it on every request, so a raw camera photo
 * (hundreds of KB as base64) slowed the whole app down; this keeps one to around 10–30 KB.
 */
export async function shrinkAvatar(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const crop = Math.min(bitmap.width, bitmap.height);
    const side = Math.min(AVATAR_SIDE, crop);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, side, side);
    const webp = canvas.toDataURL("image/webp", 0.85);
    // browsers without a WebP encoder fall back to PNG, which is far larger than JPEG for photos
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}
