const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { groupItemsIntoLines } = require('./pdfService');
const { judgeCrop } = require('./figureJudge');

const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images');

// Judge loop is env-gated so we can A/B against the heuristic-only
// pipeline. Default OFF during initial rollout; flip to default ON
// once Rodina validation confirms score≥95 on all figures.
const JUDGE_ENABLED = process.env.FIGURE_JUDGE === '1';
const JUDGE_MAX_ATTEMPTS = 3;
const JUDGE_GOOD_SCORE = 95;
const JUDGE_FALLBACK_SCORE = 50;
const JUDGE_DEFAULT_LINE_H_PX = 25;

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

      // Derive the line-height used by the judge's delta math
      // from the caption line's pdfjs font size when available —
      // more accurate than a hardcoded constant for papers with
      // unusual body text sizes.
      const lineHPx = captionLine && textIndex
        ? Math.max(12, Math.round(captionLine.h * textIndex.scaleY * 1.2))
        : JUDGE_DEFAULT_LINE_H_PX;

      const initRect = { left, top, right, bottom };
      const loopResult = await cropWithJudgeLoop({
        pagePngPath,
        pngW,
        pngH,
        initRect,
        captionText,
        lineHPx,
        tag: `p${pageNumber} fig ${figIdx}`,
        vertSource,
      });

      if (loopResult.abandon) {
        // Final score below the fallback floor — show the view-link
        // rather than serving a bad crop.
        console.warn(`[figureService] p${pageNumber} fig ${figIdx} abandoned (best score ${loopResult.bestScore})`);
        replacements.push({ original: openTag, replacement: `<figure class="page-figure">${fallbackLink}` });
        continue;
      }

      await fs.promises.writeFile(figPath, loopResult.buffer);

      const scoreTag = loopResult.bestScore != null ? ` score=${loopResult.bestScore}` : '';
      console.log(`[figureService] p${pageNumber} fig ${figIdx}: ${loopResult.finalW}x${loopResult.finalH} vert=${vertSource} attempts=${loopResult.attempts}${scoreTag}`);

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
// Body-text filter has TWO criteria, both required:
//   (a) length ≥ MIN_BODYTEXT_LEN — bumped to 45 chars. Real body
//       text in academic papers wraps at 60-120 chars per line;
//       the worst-case pdfjs label concatenations on figure-
//       internal vertex labels ("3 1 6 3 6 3 2 6 3 6 3 6", "P L
//       P A P R P L P B P R") top out around 30-40 chars. 45
//       cleanly excludes the labels while keeping real body text.
//   (b) physically ABOVE the model's TOP% estimate (with a small
//       slack). Without this constraint, the top-anchor search
//       could match a label line that happens to pass the length
//       filter and is BELOW the model's claimed top — i.e.,
//       inside the figure. The model's TOP% is rough but it's
//       reliably above the figure's midpoint, so it makes a sound
//       ceiling for the search. This is the FIG. 4 / S₁S₂ fix:
//       previously the top anchor was matching label lines inside
//       those figures and cropping them in half.
//
// Returns {top, bottom, source, matchedLine} or null if no
// caption could be matched. If the top anchor is missing, falls
// back to modelTopPx for the top edge.
const MIN_BODYTEXT_LEN = 45;
function computeVerticalFromAnchors(idx, captionText, { modelTopPx, modelBottomPx }) {
  const { lines, pdfH, scaleY } = idx;
  const captionLine = findCaptionLine(lines, captionText);
  if (!captionLine) return null;

  const pdfY_to_pngY = (pdfY) => (pdfH - pdfY) * scaleY;
  const pngY_to_pdfY = (pngY) => pdfH - (pngY / scaleY);
  const padPx = 8;

  // BOTTOM: just above the caption line.
  const captionTopPng = pdfY_to_pngY(captionLine.y + captionLine.h * 0.85);
  const bottom = captionTopPng - padPx;

  // TOP: find the closest body-text line ABOVE the figure region
  // (above the model's TOP%) in the same column.
  //
  // PDF y is bottom-up, so "physically above" = larger y. The
  // search bounds are:
  //   - Strictly above the caption (y > captionLine.y + margin)
  //   - At or above the model's top estimate, with 10pt slack
  //     to account for the model under-estimating. Lines INSIDE
  //     the figure are typically below modelTopPdfY and get
  //     filtered out here.
  //   - Body-text length (≥ MIN_BODYTEXT_LEN chars).
  // Among survivors we pick the line with the SMALLEST y — the
  // body line CLOSEST to the figure from above.
  const topSearchFloor = captionLine.y + captionLine.h + 4;
  const modelTopPdfY = pngY_to_pdfY(modelTopPx);
  const topCeilingSlack = 10; // pt — allow lines slightly below model top
  let topAnchor = null;
  for (const line of lines) {
    if (line.y <= topSearchFloor) continue;
    if (line.y < modelTopPdfY - topCeilingSlack) continue;
    if (line.text.length < MIN_BODYTEXT_LEN) continue;
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

// ─── Judge loop ───────────────────────────────────────────────────
//
// Extract the initial crop, then (if FIGURE_JUDGE=1) iteratively
// refine the rectangle using structured critique from Sonnet vision.
// Each iteration:
//   1. sharp.extract() → buffer
//   2. judgeCrop(buffer, caption) → {score, extra/clipped deltas}
//   3. Apply deltas mechanically, clamped to ≤25% of current
//      crop dimensions per iteration to prevent overshoot from a
//      judge miscounting "3 extra lines above".
//   4. Clamp to page bounds.
//   5. Stop on score ≥ JUDGE_GOOD_SCORE, after JUDGE_MAX_ATTEMPTS,
//      or when the judge returns null (parse failure).
//
// Returns the BEST crop across all attempts (highest score), plus
// an `abandon` flag when the best score is still below
// JUDGE_FALLBACK_SCORE — in that case the caller shows the
// "view original page" link rather than shipping a broken crop.
async function cropWithJudgeLoop({ pagePngPath, pngW, pngH, initRect, captionText, lineHPx, tag }) {
  // Start with the initial rect from the heuristic pipeline.
  let rect = clampRectToPage(initRect, pngW, pngH);
  let best = null; // { buffer, score, rect }
  const attemptsLog = [];

  const maxAttempts = JUDGE_ENABLED ? JUDGE_MAX_ATTEMPTS : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    if (width < 30 || height < 30) break;

    const buffer = await sharp(pagePngPath)
      .extract({ left: rect.left, top: rect.top, width, height })
      .toBuffer();

    if (!JUDGE_ENABLED) {
      // Short-circuit: the legacy heuristic-only path. Ship the
      // single crop we extracted.
      return {
        buffer,
        bestScore: null,
        attempts: 1,
        finalW: width,
        finalH: height,
        abandon: false,
      };
    }

    const verdict = await judgeCrop(buffer, captionText);
    const score = verdict?.score ?? null;
    attemptsLog.push({ attempt, score, verdict });

    if (best == null || (score != null && score > (best.score ?? -1))) {
      best = { buffer, score, rect: { ...rect } };
    }

    // Stop on good enough or parse failure.
    if (verdict == null) break;
    if (score >= JUDGE_GOOD_SCORE) break;

    // Apply deltas for the next attempt.
    rect = applyVerdictDeltas(rect, verdict, lineHPx, pngW, pngH);
    console.log(`[figureJudge] ${tag} attempt ${attempt} score=${score} → adjusting (${verdict.notes || ''})`);
  }

  if (best == null) {
    // Should only happen if the very first extract call failed.
    throw new Error('judge loop produced no crop');
  }

  const abandon = best.score != null && best.score < JUDGE_FALLBACK_SCORE;
  return {
    buffer: best.buffer,
    bestScore: best.score,
    attempts: attemptsLog.length,
    finalW: best.rect.right - best.rect.left,
    finalH: best.rect.bottom - best.rect.top,
    abandon,
  };
}

// Clamp a rectangle to the page bounds and integer-round all fields.
function clampRectToPage(rect, pngW, pngH) {
  const left = Math.max(0, Math.round(rect.left));
  const top = Math.max(0, Math.round(rect.top));
  const right = Math.min(pngW, Math.round(rect.right));
  const bottom = Math.min(pngH, Math.round(rect.bottom));
  return { left, top, right, bottom };
}

// Apply structured verdict deltas to a rectangle, with an
// ASYMMETRIC per-iteration clamp:
//   - Shrink moves (rectangle gets smaller):  ≤ 25% of current dim.
//     Protects against judge miscounting "3 extra lines above"
//     collapsing the crop into nothing.
//   - Grow moves (rectangle gets bigger):     ≤ 50% of current dim.
//     Grows can only hit page bounds (clamped separately), so
//     there's no collapse risk — we can afford to move farther
//     per iteration. This is the v2 fix for p4/p7 plateaus where
//     the loop correctly diagnosed "8 lines above" but the old
//     symmetric 25% clamp only allowed 1-2 lines of correction
//     per attempt, so the judge ran out of iterations before
//     converging.
//
// Sign convention (matches the raw delta expressions below):
//   dTop   > 0 → top edge moves DOWN   → shrink
//   dTop   < 0 → top edge moves UP     → grow
//   dBot   > 0 → bottom edge moves UP  → shrink
//   dBot   < 0 → bottom edge moves DOWN→ grow
//   dLeft  > 0 → left edge moves RIGHT → shrink
//   dLeft  < 0 → left edge moves LEFT  → grow
//   dRight > 0 → right edge moves LEFT → shrink
//   dRight < 0 → right edge moves RIGHT→ grow
function applyVerdictDeltas(rect, verdict, lineHPx, pngW, pngH) {
  const currentH = rect.bottom - rect.top;
  const currentW = rect.right - rect.left;
  const shrinkMaxY = currentH * 0.25;
  const growMaxY = currentH * 0.50;
  const shrinkMaxX = currentW * 0.25;
  const growMaxX = currentW * 0.50;

  // Top edge: extra lines → move DOWN (shrink), clipped → move UP (grow)
  const rawDeltaTop =
    (verdict.extra_lines_above || 0) * lineHPx -
    (verdict.clipped_above || 0) * lineHPx;
  // Bottom edge: extra lines → move UP (shrink), clipped → move DOWN (grow)
  const rawDeltaBottom =
    (verdict.extra_lines_below || 0) * lineHPx -
    (verdict.clipped_below || 0) * lineHPx;
  const rawDeltaLeft = verdict.extra_px_left || 0;
  const rawDeltaRight = verdict.extra_px_right || 0;

  // Positive = shrink, negative = grow.
  const clampAsym = (v, shrink, grow) => {
    if (v > shrink) return shrink;
    if (v < -grow) return -grow;
    return v;
  };
  const dTop = clampAsym(rawDeltaTop, shrinkMaxY, growMaxY);
  const dBot = clampAsym(rawDeltaBottom, shrinkMaxY, growMaxY);
  const dLeft = clampAsym(rawDeltaLeft, shrinkMaxX, growMaxX);
  const dRight = clampAsym(rawDeltaRight, shrinkMaxX, growMaxX);

  const next = {
    left: rect.left + dLeft,
    right: rect.right - dRight,
    top: rect.top + dTop,
    bottom: rect.bottom - dBot,
  };
  return clampRectToPage(next, pngW, pngH);
}

module.exports = { detectAndCropFigures };
