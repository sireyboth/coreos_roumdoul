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

/**
 * Opens a file in a new tab for the browser's own viewer to render (e.g. a
 * PDF opens in Chrome/Safari's built-in preview) instead of saving it —
 * same blob, no `download` attribute. The tab holds its own reference to the
 * object URL, so it's safe to revoke shortly after opening rather than
 * leaking it for the rest of the session.
 */
export function viewBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
