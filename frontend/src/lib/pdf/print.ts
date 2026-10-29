/**
 * Prints an HTML document through the browser, where "Save as PDF" makes the file.
 *
 * A PDF library can't shape Khmer (names and notes are often Khmer), so reports
 * are laid out as print-ready pages and handed to the browser's own print
 * engine — that gives selectable text with correct Khmer.
 */

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The fonts every report uses: Inter for Latin, Noto Sans Khmer for Khmer. */
export const REPORT_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Khmer:wght@400;600;700&display=swap" rel="stylesheet">`;

/**
 * Lays the document out in a hidden frame and opens the print dialog on it.
 * The frame goes away afterwards. The document's <title> becomes the suggested file name.
 */
export async function printHtmlDocument(html: string): Promise<void> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);

  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  // Fonts (Khmer especially) must be in before printing, or the PDF falls back to whatever is installed.
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    if (doc.readyState === "complete") done();
    else frame.addEventListener("load", done, { once: true });
    setTimeout(done, 4000);
  });
  await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 3000))]);

  // Browsers suggest the page title as the file name.
  const previousTitle = document.title;
  document.title = doc.title;
  const cleanup = () => {
    document.title = previousTitle;
    frame.remove();
  };
  frame.contentWindow!.addEventListener("afterprint", () => setTimeout(cleanup, 100), { once: true });
  // Some browsers don't fire afterprint; never leave the frame behind for long.
  setTimeout(() => frame.isConnected && cleanup(), 120_000);

  frame.contentWindow!.focus();
  frame.contentWindow!.print();
}
