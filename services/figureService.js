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

    // Try to derive TOP + BOTTOM from pdfjs text anchors:
    //   BOTTOM: snap to just above the figcaption line (known to
    //           live in the same column as the figure).
    //   TOP:    snap to just below the last body-text line above
    //           the figure in the same column — i.e., the line
    //           closest to the caption from above that qualifies
    //           as body text (length ≥ 25 chars to exclude short
    //           glyph labels like "c_41" and "X_52" that pdfjs
    //           picks up from inside the figure artwork).
    //
    // Column search order:
    // (1) Try the column the model bbox claims (its LEFT%/RIGHT%).
    // (2) If caption not found, try the OTHER half of the page —
    //     the vision model occasionally gets the column wrong on
    //     dense two-column pages (see Rodina p4 FIG 2).
    // Strict-column-only caption search. We never use a wide
    // column filter — on two-column pages pdfjs fuses left+right
    // column text items at the same baseline Y into a single
    // "line", which breaks both caption matching and the top-
    // anchor search. Instead we try the two page halves in order:
    // model's claimed column first, then the other half.
    //
    // Whichever half finds a valid top+bottom anchor pair wins,
    // and its column is used to override horizontal bounds when
    // the model had it wrong.
    let vertFromAnchors = null;
    let captionLine = null;
    let locatedVia = null;
    if (textIndex && captionText) {
      const pdfW = textIndex.pdfW;
      const midX = pdfW / 2;
      const modelInLeftHalf = ((modelBbox.leftPct + modelBbox.rightPct) / 2) < 50;
      const attempts = modelInLeftHalf
        ? [
            { xMin: 0, xMax: midX, label: 'strict-left' },
            { xMin: midX, xMax: pdfW, label: 'strict-right' },
          ]
        : [
            { xMin: midX, xMax: pdfW, label: 'strict-right' },
            { xMin: 0, xMax: midX, label: 'strict-left' },
          ];
      for (const a of attempts) {
        const colLines = groupItemsIntoLines(textIndex.items, { xMin: a.xMin, xMax: a.xMax });
        const result = computeVerticalFromAnchors(
          { lines: colLines, pdfH: textIndex.pdfH, scaleY: textIndex.scaleY },
          captionText,
          { modelTopPx, modelBottomPx }
        );
        if (result) {
          vertFromAnchors = { ...result, source: `${result.source}/${a.label}` };
          captionLine = result.matchedLine;
          locatedVia = a.label;
          break;
        }
      }
    }

    // Column-based horizontal override. The caption was located in
    // a strict half (strict-left or strict-right). We use that half
    // as the authoritative column, replacing or clamping the
    // model's horizontal bounds:
    //
    //   Wrong column (model said left but caption is right, or vice
    //   versa) → REPLACE horizontal bounds with the caption's
    //   column half-page range. The model's LEFT%/RIGHT% reflect
    //   the wrong column and aren't salvageable.
    //
    //   Right column (model agrees with caption) → CLAMP the model's
    //   bounds at the gutter so a full-width model bbox doesn't
    //   bleed across the middle.
    let columnClampPx = null;
    let columnReplacePx = null;
    if (captionLine && textIndex && locatedVia) {
      const pdfW = textIndex.pdfW;
      const midX = pdfW / 2;
      const gutterPx = Math.round(midX * textIndex.scaleX);
      const modelInLeftHalf = ((modelBbox.leftPct + modelBbox.rightPct) / 2) < 50;
      const captionInLeft = locatedVia === 'strict-left';
      const wrongCol = modelInLeftHalf !== captionInLeft;
      if (wrongCol) {
        columnReplacePx = captionInLeft
          ? { leftPx: Math.round(pdfW * 0.03 * textIndex.scaleX), rightPx: gutterPx - 4 }
          : { leftPx: gutterPx + 4, rightPx: Math.round(pdfW * 0.97 * textIndex.scaleX) };
      } else {
        columnClampPx = captionInLeft
          ? { rightMax: gutterPx - 4 }
          : { leftMin: gutterPx + 4 };
      }
    }

    // Horizontal bounds. Priority:
    //   1. columnReplacePx — wrong-column self-correction, we
    //      override entirely with the caption's column half-page
    //      bounds.
    //   2. model bbox → pixels, then clamp to the caption's column
    //      (columnClampPx) so full-width model bboxes don't bleed
    //      across the gutter when the figure only occupies one
    //      column.
    const padPctX = 1;
    let left, right;
    if (columnReplacePx) {
      left = columnReplacePx.leftPx;
      right = columnReplacePx.rightPx;
    } else {
      left = Math.max(0, Math.round(((modelBbox.leftPct - padPctX) / 100) * pngW));
      right = Math.min(pngW, Math.round(((modelBbox.rightPct + padPctX) / 100) * pngW));
      if (columnClampPx) {
        if (columnClampPx.rightMax != null) right = Math.min(right, columnClampPx.rightMax);
        if (columnClampPx.leftMin != null) left = Math.max(left, columnClampPx.leftMin);
      }
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
// the first ~48 chars of a (normalized) caption. Tries progressively
// shorter prefixes to tolerate small extraction differences.
//
// CRITICAL: we require the match to appear near the START of the
// line (position ≤ 5). Real captions begin with "FIG. N:" so their
// normalized text is at position 0. Prose mentions like "as shown
// in Figure 3" have the match mid-sentence at a much later position,
// and without this constraint we get false-positive matches landing
// on body text that just happens to reference the figure number.
//
// On two-column pages where pdfjs fuses left+right column text at
// the same baseline Y, the caption's column is usually rendered
// first in the fused line, so the caption prefix still starts at
// position 0 of the normalized text even in the fused case.
const MAX_MATCH_POSITION = 5;
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
    const hit = normLines.find((nl) => {
      const idx = nl.norm.indexOf(cut);
      return idx >= 0 && idx <= MAX_MATCH_POSITION;
    });
    if (hit) return hit.line;
  }
  return null;
}

// Derive figure vertical bounds using pdfjs text anchors:
//   BOTTOM: snap to just above the figcaption line.
//   TOP:    snap to just below the last body-text line above the
//           figure in the same column.
//
// Body-text filter: only lines with at least MIN_BODYTEXT_LEN
// characters qualify as body-text anchors — this excludes short
// glyph labels like "c_41", "X_52", "51 42 51 42" that pdfjs
// picks up from inside figure artwork (Rodina p2 kinematic mesh
// is the canonical case). Without this filter the top anchor
// snaps to a label line and crops the figure in half.
//
// Returns {top, bottom, source, matchedLine} or null if no
// caption could be matched. If the top anchor is missing, falls
// back to modelTopPx for the top edge.
const MIN_BODYTEXT_LEN = 25;
function computeVerticalFromAnchors(idx, captionText, { modelTopPx, modelBottomPx }) {
  const { lines, pdfH, scaleY } = idx;
  const captionLine = findCaptionLine(lines, captionText);
  if (!captionLine) return null;

  const pdfY_to_pngY = (pdfY) => (pdfH - pdfY) * scaleY;
  const padPx = 8;

  // BOTTOM: just above the caption line.
  const captionTopPng = pdfY_to_pngY(captionLine.y + captionLine.h * 0.85);
  const bottom = captionTopPng - padPx;

  // TOP: find the closest body-text line ABOVE the caption
  // (strictly above by caption.h + safety margin so caption
  // wrap-around lines aren't accidentally picked). Walk the
  // column's lines, keep the one with smallest y that still has
  // y > captionLine.y + margin AND qualifies as body text.
  const topSearchFloor = captionLine.y + captionLine.h + 4;
  let topAnchor = null;
  for (const line of lines) {
    if (line.y <= topSearchFloor) continue;
    if (line.text.length < MIN_BODYTEXT_LEN) continue;
    // Looking for the line with SMALLEST y that still qualifies —
    // i.e., the body-text line closest to the caption from above.
    if (topAnchor == null || line.y < topAnchor.y) topAnchor = line;
  }

  let top;
  let source;
  if (topAnchor) {
    // Figure top is just below the bottom of the topAnchor line.
    // Use the FULL line height below the baseline (topAnchor.h)
    // rather than the previous 0.15 * h — the old factor didn't
    // reliably clear descenders on "g", "y", "p", so fragments of
    // body text leaked into the top of figure crops. 12px extra
    // pad on top of that, so the crop starts cleanly below the
    // last line of text.
    const anchorBottomPng = pdfY_to_pngY(topAnchor.y - topAnchor.h);
    top = anchorBottomPng + 12;
    source = 'caption+top-anchor';
  } else {
    top = modelTopPx;
    source = 'caption-only';
  }

  if (bottom - top < 30) return null;
  return { top, bottom, source, matchedLine: captionLine };
}

module.exports = { detectAndCropFigures };
