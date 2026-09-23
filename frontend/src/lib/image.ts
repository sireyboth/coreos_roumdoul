/**
 * Cuts out the rectangle the person chose in the crop dialog (in the
 * original image's own pixel coordinates — what react-easy-crop's
 * `onCropComplete` hands back as `croppedAreaPixels`) and re-draws it as a
 * small square JPEG, the same output shape as toSquareJpeg below, just from
 * a person-chosen area instead of an automatic centre-crop.
 */
export async function cropToSquareJpeg(
  imageUrl: string,
  area: { x: number; y: number; width: number; height: number },
  size = 512,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))), "image/jpeg", 0.88);
  });
}

/**
 * Turns whatever the user picked (often a 5 MB phone photo) into a small
 * square JPEG before upload: centre-cropped, rotated the right way up, and
 * far below any server upload limit. The server re-encodes it once more.
 *
 * Used as a fallback if the interactive crop dialog can't be used for some
 * reason — the normal path is PhotoCropDialog + cropToSquareJpeg above,
 * which let the person choose the crop instead of guessing the centre.
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
