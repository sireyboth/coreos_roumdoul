/**
 * Turns whatever the user picked (often a 5 MB phone photo) into a small
 * square JPEG before upload: centre-cropped, rotated the right way up, and
 * far below any server upload limit. The server re-encodes it once more.
 */
export async function toSquareJpeg(file: File, size = 512): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the camera's rotation so portraits aren't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that image. Try a JPG or PNG.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");

  // Transparent PNGs get a white background instead of black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))), "image/jpeg", 0.88);
  });
}
