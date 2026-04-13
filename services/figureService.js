const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images');

/**
 * Crop figure regions using bounding boxes emitted by the vision model.
 *
 * The page-to-html prompt instructs the model to tag each <figure> with
 * data-bbox="X,Y,W,H" in percent-of-page units. We parse those, crop the
 * rendered page PNG with sharp, and replace the <figure> open tag with
 * one containing an <img> pointing at the crop.
 *
 * Figures with no data-bbox (model couldn't localize) fall back to a
 * "view in original page" link.
 */
async function detectAndCropFigures(html, bookId, pageNumber) {
  if (!html.includes('<figure')) return html;

  const pagePngPath = path.join(IMAGE_DIR, bookId, `page-${pageNumber}.png`);
  if (!fs.existsSync(pagePngPath)) return html;

  const meta = await sharp(pagePngPath).metadata();
  const pngW = meta.width;
  const pngH = meta.height;

  const fallbackLink = `<a class="view-figure-link" onclick="document.querySelector('#viewOriginalToggle')?.click()">View figure in original page</a>`;

  const figureRegex = /<figure\s+class=["']page-figure["']([^>]*)>/g;
  const replacements = [];
  let match;
  let figIdx = 0;

  while ((match = figureRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const attrs = match[1];
    figIdx++;

    const bboxMatch = /data-bbox=["']([^"']+)["']/.exec(attrs);
    if (!bboxMatch) {
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${fallbackLink}` });
      continue;
    }

    const parts = bboxMatch[1].split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 4 || parts.some(n => !isFinite(n))) {
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${fallbackLink}` });
      continue;
    }

    // Format: LEFT,TOP,RIGHT,BOTTOM as percentages of full page image
    // (0–100). See prompts/page-to-html.txt rule 7. Swap to this
    // format aligns with how the vision model is instructed to think
    // about the crop region (four edges rather than top-left + size).
    let [leftPct, topPct, rightPct, bottomPct] = parts;

    // Sanity: the model occasionally emits left>right or top>bottom
    // under cognitive pressure — fix silently instead of rejecting.
    if (rightPct < leftPct) [leftPct, rightPct] = [rightPct, leftPct];
    if (bottomPct < topPct) [topPct, bottomPct] = [bottomPct, topPct];

    // Small safety pad (1% each side) to avoid clipping thin borders.
    const padPct = 1;
    const left = Math.max(0, Math.round(((leftPct - padPct) / 100) * pngW));
    const top = Math.max(0, Math.round(((topPct - padPct) / 100) * pngH));
    const right = Math.min(pngW, Math.round(((rightPct + padPct) / 100) * pngW));
    const bottom = Math.min(pngH, Math.round(((bottomPct + padPct) / 100) * pngH));
    const width = right - left;
    const height = bottom - top;

    if (width < 30 || height < 30) {
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${fallbackLink}` });
      continue;
    }

    try {
      const figFilename = `page-${pageNumber}-fig-${figIdx}.png`;
      const figPath = path.join(IMAGE_DIR, bookId, figFilename);

      // No trim() — the bbox is already tight by prompt contract,
      // and sharp's trim could accidentally discard thin axis lines
      // or light-color figure elements. Prefer honoring the bbox
      // exactly; if the model pads too much, we tighten the prompt
      // rather than post-process.
      await sharp(pagePngPath)
        .extract({ left, top, width, height })
        .toFile(figPath);

      const imgTag = `<img src="/images/${bookId}/${figFilename}" alt="Figure ${figIdx} from page ${pageNumber}" loading="lazy">`;
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${imgTag}` });
    } catch (err) {
      console.warn(`[figureService] p${pageNumber} fig ${figIdx} crop failed: ${err.message} (bbox=${leftPct},${topPct},${rightPct},${bottomPct} → extract=${left},${top},${width}x${height}, png=${pngW}x${pngH})`);
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${fallbackLink}` });
    }
  }

  let result = html;
  for (const r of replacements) {
    result = result.replace(r.original, r.replacement);
  }
  return result;
}

module.exports = { detectAndCropFigures };
