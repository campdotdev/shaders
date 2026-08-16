// Blob-anchor download — the no-permission save path (the anchor's `download`
// attribute needs no prompt, unlike the async clipboard/file APIs). Shared by
// the preset export and the generated-code panel so the two stay one behavior.
export function downloadTextFile(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  // Revoked on a later tick, not synchronously: click() only STARTS the
  // browser's fetch of the blob URL, and revoking in the same task can cancel
  // the download it just triggered.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
