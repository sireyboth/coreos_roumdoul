/** Hands a file to the browser's download bar, as if the user had clicked a download link. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick so the download has already picked the file up.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
