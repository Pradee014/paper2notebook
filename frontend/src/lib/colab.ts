/**
 * Build a Google Colab URL to open a notebook.
 *
 * Uses Colab's create-with-content approach: encodes the full notebook
 * as a base64 data URI in the URL fragment. Colab will decode and
 * open the notebook directly.
 *
 * Fallback: if the encoded URL would be too long (>32KB), falls back
 * to the simple upload page URL.
 */
export function buildColabUrl(ipynbBase64: string): string {
  // Colab's direct open URL with notebook content
  // This uses the undocumented but widely-used data parameter
  const colabBase = "https://colab.research.google.com";

  // For large notebooks, just open the upload page
  if (ipynbBase64.length > 32000) {
    return `${colabBase}/#create=true&language=python`;
  }

  // Use Colab's notebook viewer with inline data
  // The most reliable approach is to encode as a data URI
  return `${colabBase}/notebooks/data:application/x-ipynb+json;base64,${ipynbBase64}`;
}
