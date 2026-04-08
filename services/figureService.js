const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images');

/**
 * Detect figure regions from text coordinate gaps (column-aware), crop from page PNG.
 * For two-column layouts, gaps are detected per-column so the other column's text
 * doesn't mask the figure gap.
 */
async function detectAndCropFigures(html, bookId, pageNumber, textCoords, pdfPageHeight) {
  if (!html.includes('<figure') || !textCoords || textCoords.length === 0) return html;

  const pagePngPath = path.join(IMAGE_DIR, bookId, `page-${pageNumber}.png`);
  if (!fs.existsSync(pagePngPath)) return html;

  const fallbackLink = `<a class="view-figure-link" onclick="document.querySelector('#viewOriginalToggle')?.click()">View figure in original page</a>`;

  // Detect page width and column gutter
  const allX = textCoords.map(i => i.x);
  const pageWidth = Math.max(...allX) - Math.min(...allX);
  const midX = Math.min(...allX) + pageWidth / 2;
  const isMultiColumn = detectMultiColumn(textCoords, midX);

  // Find caption items
  const captionItems = textCoords.filter(i => i._str && /FIG\.\s*\d|Figure\s*\d/i.test(i._str));

  // For each <figure> tag in HTML
  const figureRegex = /<figure\s+class=["']page-figure["'][^>]*>/g;
  let match;
  let figIdx = 0;
  const replacements = [];

  while ((match = figureRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const captionItem = captionItems[figIdx] ?? null;
    figIdx++;

    if (!captionItem) {
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${fallbackLink}` });
      continue;
    }

    // Determine which column the caption is in
    let columnItems;
    let columnLeftPx = 0;
    let columnRightPx = pageWidth;

    if (isMultiColumn) {
      const captionInLeft = captionItem.x < midX;
      if (captionInLeft) {
        columnItems = textCoords.filter(i => i.x < midX);
        columnRightPx = midX;
      } else {
        columnItems = textCoords.filter(i => i.x >= midX);
        columnLeftPx = midX;
      }
    } else {
      columnItems = textCoords;
    }

    // Group this column's items into lines
    const lines = groupIntoLines(columnItems);

    // Find the caption line in this column
    let captionLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (Math.abs(lines[i].y - captionItem.y) < 5) {
        captionLineIdx = i;
        break;
      }
    }

    if (captionLineIdx < 0) {
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${fallbackLink}` });
      continue;
    }

    // Find largest gap within 15 lines of caption (in this column only)
    const region = findLargestGap(lines, captionLineIdx, pdfPageHeight);

    if (!region || region.gapPct < 3) {
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${fallbackLink}` });
      continue;
    }

    try {
      const figFilename = `page-${pageNumber}-fig-${figIdx}.png`;
      const figPath = path.join(IMAGE_DIR, bookId, figFilename);

      await cropFromPng(pagePngPath, figPath, region, pdfPageHeight, columnLeftPx, columnRightPx, pageWidth);

      const imgTag = `<img src="/images/${bookId}/${figFilename}" alt="Figure ${figIdx} from page ${pageNumber}" loading="lazy">`;
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${imgTag}` });
    } catch {
      replacements.push({ original: fullTag, replacement: `<figure class="page-figure">${fallbackLink}` });
    }
  }

  let result = html;
  for (const r of replacements) {
    result = result.replace(r.original, r.replacement);
  }
  return result;
}

/** Detect if layout is multi-column by checking line start positions. */
function detectMultiColumn(textCoords, midX) {
  const lineStarts = new Map();
  for (const item of textCoords) {
    if (!item._str || !item._str.trim()) continue;
    const yKey = Math.round(item.y);
    if (!lineStarts.has(yKey) || item.x < lineStarts.get(yKey)) {
      lineStarts.set(yKey, item.x);
    }
  }
  let leftStarts = 0, rightStarts = 0;
  for (const x of lineStarts.values()) {
    if (x < midX - 20) leftStarts++;
    else if (x > midX + 20) rightStarts++;
  }
  const total = leftStarts + rightStarts;
  return total > 10 && Math.min(leftStarts, rightStarts) / total > 0.25;
}

/** Group items into lines (within 3px Y). Sorted top-to-bottom (descending PDF Y). */
function groupIntoLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines = [];
  let cur = null;
  for (const item of sorted) {
    if (!cur || Math.abs(cur.y - item.y) > 3) {
      cur = { y: item.y, items: [item] };
      lines.push(cur);
    } else {
      cur.items.push(item);
    }
  }
  return lines;
}

/** Find largest vertical gap within ±15 lines of captionIdx. */
function findLargestGap(lines, captionIdx, pdfPageHeight) {
  const radius = 15;
  const start = Math.max(0, captionIdx - radius);
  const end = Math.min(lines.length - 1, captionIdx + radius);

  let bestGap = 0;
  let bestTopY = 0;
  let bestBottomY = 0;

  for (let i = start; i < end; i++) {
    const gap = lines[i].y - lines[i + 1].y;
    if (gap > bestGap) {
      bestGap = gap;
      bestTopY = lines[i].y;
      bestBottomY = lines[i + 1].y;
    }
  }

  return {
    topY: bestTopY,
    bottomY: bestBottomY,
    gap: bestGap,
    gapPct: (bestGap / pdfPageHeight) * 100,
  };
}

/** Crop from page PNG. Handles PDF→PNG coordinate conversion. */
async function cropFromPng(pagePngPath, outputPath, region, pdfPageHeight, colLeftPdf, colRightPdf, pageWidthPdf) {
  const meta = await sharp(pagePngPath).metadata();
  const scaleY = meta.height / pdfPageHeight;
  const scaleX = meta.width / (pageWidthPdf || 612);
  const minPdfX = 0; // approximate

  // PDF Y → PNG Y (PDF Y=0 is bottom, PNG Y=0 is top)
  const pngTop = Math.max(0, Math.round((pdfPageHeight - region.topY) * scaleY) - 15);
  const pngBottom = Math.min(meta.height, Math.round((pdfPageHeight - region.bottomY) * scaleY) + 15);
  const pngLeft = Math.max(0, Math.round(colLeftPdf * scaleX) - 10);
  const pngRight = Math.min(meta.width, Math.round(colRightPdf * scaleX) + 10);

  const width = pngRight - pngLeft;
  const height = pngBottom - pngTop;
  if (width < 30 || height < 30) throw new Error('Region too small');

  await sharp(pagePngPath)
    .extract({ left: pngLeft, top: pngTop, width, height })
    .trim({ threshold: 20 })
    .toFile(outputPath);
}

module.exports = { detectAndCropFigures };
