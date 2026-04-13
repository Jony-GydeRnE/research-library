const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { groupItemsIntoLines } = require('./pdfService');

const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images');

/**
 * Crop figure regions by combining vision-model bboxes (horizontal
 * edges) with deterministic pdfjs-extracted text-line coordinates
 * (vertical edges).
 *
 * HORIZONTAL: the vision model is reliable at left/right column
 * localization, so we keep LEFT% and RIGHT% from its data-bbox.
 *
 * VERTICAL: the vision model is NOT reliable at BOTTOM% — it kept
 * swallowing captions, body paragraphs, and equation blocks below
 * the figure. Instead, we use the actual text-line coordinates from
 * pdfjs:
 *
 *   1. Find the last <p> tag before the figure in the HTML. Its
 *      trailing text is the "above" anchor — the line of body text
 *      immediately above the figure on the PDF page.
 *   2. The figcaption's leading text is the "below" anchor — the
 *      "FIG. N: ..." line directly below the figure.
 *   3. Locate both anchors in the pdfjs text lines by substring
 *      match, get their PDF y coordinates, convert to PNG pixels.
 *   4. The figure lives BETWEEN those two lines, with a small pad.
 *
 * The vision model's TOP% and BOTTOM% are used as a fallback for
 * cases where anchor matching fails (no preceding <p>, no
 * pageLines provided, or the anchor text couldn't be located in
 * pdfjs output — e.g. for figures rendered as vector graphics on
 * pages with unusual text extraction).
 *
 * pageText (optional): { pdfPageHeight, pdfPageWidth, items: [...] }
 * from pdfService.extractPageTextLines() for THIS page — the RAW
 * per-item list (not yet grouped into lines). figureService groups
 * items into lines per-figure, filtered to the figure's column
 * x-range, so two-column layouts don't mix left and right column
 * text into the same "line". If omitted, anchor matching is
 * skipped and the model bbox is used as-is.
 */
async function detectAndCropFigures(html, bookId, pageNumber, pageText = null) {
  if (!html.includes('<figure')) return html;

  const pagePngPath = path.join(IMAGE_DIR, bookId, `page-${pageNumber}.png`);
  if (!fs.existsSync(pagePngPath)) return html;

  const meta = await sharp(pagePngPath).metadata();
  const pngW = meta.width;
  const pngH = meta.height;

  const fallbackLink = `<a class="view-figure-link" onclick="document.querySelector('#viewOriginalToggle')?.click()">View figure in original page</a>`;

  // Anchor-text index. We keep the raw items plus the page
  // dimensions so we can build a column-filtered line set per
  // figure using the figure's own bbox.
  let textIndex = null;
  if (pageText && pageText.items && pageText.pdfPageHeight > 0) {
    textIndex = {
      items: pageText.items,
      pdfH: pageText.pdfPageHeight,
      pdfW: pageText.pdfPageWidth,
      scaleY: pngH / pageText.pdfPageHeight,
      scaleX: pngW / pageText.pdfPageWidth,
    };
  }

  // Full figure regex that captures the entire <figure>...</figure>
  // block so we can see the preceding HTML context and the
  // figcaption contents.
  const figBlockRegex = /<figure\s+class=["']page-figure["']([^>]*)>([\s\S]*?)<\/figure>/g;
  const replacements = [];
  let match;
  let figIdx = 0;

  while ((match = figBlockRegex.exec(html)) !== null) {
    const fullBlock = match[0];
    const openTag = match[0].slice(0, match[0].indexOf('>') + 1);
    const attrs = match[1];
    const inner = match[2];
    const blockStart = match.index;
    figIdx++;

    const bboxMatch = /data-bbox=["']([^"']+)["']/.exec(attrs);
    const captionMatch = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(inner);
    const captionText = captionMatch ? stripHtml(captionMatch[1]) : '';

    // Parse model bbox (always used for LEFT/RIGHT; used for
    // TOP/BOTTOM as fallback).
    let modelBbox = null;
    if (bboxMatch) {
      const parts = bboxMatch[1].split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 4 && parts.every(n => isFinite(n))) {
        let [l, t, r, b] = parts;
        if (r < l) [l, r] = [r, l];
        if (b < t) [t, b] = [b, t];
        modelBbox = { leftPct: l, topPct: t, rightPct: r, bottomPct: b };
      }
    }

    if (!modelBbox) {
      replacements.push({ original: openTag, replacement: `<figure class="page-figure">${fallbackLink}` });
      continue;
    }

    // Model bbox → raw pixel fallback values for TOP/BOTTOM.
    const padPctY = 1;
    const modelTopPx = Math.max(0, Math.round(((modelBbox.topPct - padPctY) / 100) * pngH));
    const modelBottomPx = Math.min(pngH, Math.round(((modelBbox.bottomPct + padPctY) / 100) * pngH));

    // Try to derive BOTTOM from the caption anchor. We no longer
    // use the "above" anchor because the vision model flattens
    // two-column reading order in its HTML output — the <p> right
    // before a <figure> in the HTML is often NOT the paragraph
    // physically above the figure on the PDF page. The caption
    // is reliable because it's ALWAYS physically adjacent to the
    // figure in the same column.
    //
    // Column-aware matching strategy:
    // (1) Try the column the model bbox claims (model's LEFT%/RIGHT%).
    // (2) If that fails, try the OTHER half of the page — the vision
    //     model occasionally gets the column wrong on dense two-
    //     column pages. When (2) finds the caption, we override the
    //     horizontal bounds from the matched column too.
    let vertFromAnchors = null;
    let horizOverride = null;
    if (textIndex && captionText) {
      const attempts = [];
      const modelXMin = (modelBbox.leftPct / 100) * textIndex.pdfW;
      const modelXMax = (modelBbox.rightPct / 100) * textIndex.pdfW;
      attempts.push({ xMin: modelXMin, xMax: modelXMax, label: 'model-col' });
      // Second attempt — the opposite half of the page.
      const midX = textIndex.pdfW / 2;
      const modelInLeftHalf = (modelXMin + modelXMax) / 2 < midX;
      if (modelInLeftHalf) {
        attempts.push({ xMin: midX, xMax: textIndex.pdfW, label: 'other-col-right' });
      } else {
        attempts.push({ xMin: 0, xMax: midX, label: 'other-col-left' });
      }

      for (const a of attempts) {
        const colLines = groupItemsIntoLines(textIndex.items, { xMin: a.xMin, xMax: a.xMax });
        const result = computeVerticalFromCaption(
          { lines: colLines, pdfH: textIndex.pdfH, scaleY: textIndex.scaleY },
          captionText,
          { modelTopPx, modelBottomPx }
        );
        if (result) {
          vertFromAnchors = { ...result, source: `caption-anchor(${a.label})` };
          // If the caption was found in the OPPOSITE column from
          // where the model placed the bbox, override the
          // horizontal bounds using the matched line's column.
          if (a.label !== 'model-col') {
            const captionLineForHoriz = result.matchedLine;
            if (captionLineForHoriz) {
              horizOverride = {
                leftPx: Math.max(0, Math.round(captionLineForHoriz.xMin * textIndex.scaleX) - 12),
                rightPx: Math.min(pngW, Math.round(captionLineForHoriz.xMax * textIndex.scaleX) + 12),
              };
            }
          }
          break;
        }
      }
    }

    // Horizontal bounds: from model bbox by default, overridden by
    // the caption's own column when the caption was matched in the
    // other half of the page (self-correcting against a
    // wrong-column model bbox).
    const padPctX = 1;
    let left, right;
    if (horizOverride) {
      left = horizOverride.leftPx;
      right = horizOverride.rightPx;
    } else {
      left = Math.max(0, Math.round(((modelBbox.leftPct - padPctX) / 100) * pngW));
      right = Math.min(pngW, Math.round(((modelBbox.rightPct + padPctX) / 100) * pngW));
    }

    const vert = vertFromAnchors || { top: modelTopPx, bottom: modelBottomPx, source: 'model-bbox' };
    let top = Math.max(0, Math.round(vert.top));
    let bottom = Math.min(pngH, Math.round(vert.bottom));
    const vertSource = vert.source;

    const width = right - left;
    const height = bottom - top;

    if (width < 30 || height < 30) {
      console.warn(`[figureService] p${pageNumber} fig ${figIdx} bbox too small (${width}x${height}), falling back`);
      replacements.push({ original: openTag, replacement: `<figure class="page-figure">${fallbackLink}` });
      continue;
    }

    try {
      const figFilename = `page-${pageNumber}-fig-${figIdx}.png`;
      const figPath = path.join(IMAGE_DIR, bookId, figFilename);

      await sharp(pagePngPath)
        .extract({ left, top, width, height })
        .toFile(figPath);

      console.log(`[figureService] p${pageNumber} fig ${figIdx}: ${width}x${height} vert=${vertSource}`);

      const imgTag = `<img src="/images/${bookId}/${figFilename}" alt="Figure ${figIdx} from page ${pageNumber}" loading="lazy">`;
      replacements.push({ original: openTag, replacement: `<figure class="page-figure">${imgTag}` });
    } catch (err) {
      console.warn(`[figureService] p${pageNumber} fig ${figIdx} crop failed: ${err.message}`);
      replacements.push({ original: openTag, replacement: `<figure class="page-figure">${fallbackLink}` });
    }
  }

  let result = html;
  for (const r of replacements) {
    result = result.replace(r.original, r.replacement);
  }
  return result;
}

// ─── Anchor-text matching ────────────────────────────────────────

// Normalize a string for fuzzy substring matching against pdfjs
// output. Strip LaTeX delimiters, inline math, punctuation, and
// collapse whitespace. Lowercase.
function normalizeForMatch(s) {
  return (s || '')
    .replace(/\\\(|\\\)/g, '')
    .replace(/\\\[|\\\]/g, '')
    .replace(/\\[a-zA-Z]+\b/g, '')  // \sum, \int, \frac, etc.
    .replace(/[{}$^_]/g, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Strip inline HTML tags and decode a handful of common entities.
function stripHtml(s) {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find the column-filtered pdfjs text line whose beginning matches
// the first ~40 chars of a (normalized) caption. Tries progressively
// shorter prefixes to tolerate small extraction differences. Returns
// the matched line or null.
function findCaptionLine(lines, captionText) {
  const needleFull = normalizeForMatch(captionText);
  if (needleFull.length < 8) return null;
  const cuts = [
    needleFull.slice(0, 48),
    needleFull.slice(0, 36),
    needleFull.slice(0, 24),
    needleFull.slice(0, 16),
    needleFull.slice(0, 10),
  ].filter((c) => c.length >= 8);
  const normLines = lines.map((l) => ({ line: l, norm: normalizeForMatch(l.text) }));
  for (const cut of cuts) {
    const hit = normLines.find((nl) => nl.norm.includes(cut));
    if (hit) return hit.line;
  }
  return null;
}

// Derive figure vertical bounds using the figcaption as the BOTTOM
// anchor. The top edge comes from the model bbox. Returns
// {top, bottom, source} or null if no caption line was matched.
//
// Why caption-only? In two-column academic PDFs the vision model
// flattens reading order when emitting HTML, so the paragraph
// immediately preceding a <figure> tag in the HTML is often in the
// OTHER column physically. The caption, by contrast, is always in
// the same column as the figure and always directly below it — so
// it gives us a reliable bottom anchor while the model's TOP% is
// already working well.
function computeVerticalFromCaption(idx, captionText, { modelTopPx, modelBottomPx }) {
  const { lines, pdfH, scaleY } = idx;
  const captionLine = findCaptionLine(lines, captionText);
  if (!captionLine) return null;

  const pdfY_to_pngY = (pdfY) => (pdfH - pdfY) * scaleY;
  // Top edge of the caption line in PNG coords.
  const captionTopPng = pdfY_to_pngY(captionLine.y + captionLine.h * 0.85);

  const padPx = 8;
  const top = modelTopPx;
  const bottom = captionTopPng - padPx;
  if (bottom - top < 30) return null;
  return { top, bottom, source: 'caption-anchor', matchedLine: captionLine };
}

module.exports = { detectAndCropFigures };
