const pdfParse = require('pdf-parse');

/**
 * Extract text from a PDF buffer, page by page.
 * Handles two-column academic paper layouts by detecting column structure
 * and reading left column fully before right column.
 */
async function extractPages(pdfBuffer) {
  const pages = [];
  let currentPage = 0;

  function renderPage(pageData) {
    currentPage++;
    // pageData.view = [x1, y1, x2, y2] in PDF coords
    const pdfPageHeight = (pageData.view && pageData.view[3]) ? pageData.view[3] : 792;

    return pageData.getTextContent().then(function (textContent) {
      const items = textContent.items.map(item => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        fontSize: Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12,
        width: item.width || 0,
      }));

      // Save coordinates for figure detection (just x, y, w, h — no strings)
      const textCoords = items
        .filter(i => i.str && i.str.trim())
        .map(i => ({
          x: Math.round(i.x * 10) / 10,
          y: Math.round(i.y * 10) / 10,
          w: Math.round((i.width || i.fontSize * i.str.length * 0.6) * 10) / 10,
          h: Math.round(i.fontSize * 10) / 10,
          _str: i.str, // temporary, used for caption search — stripped before saving
        }));

      if (items.length === 0) {
        pages.push({ pageNumber: currentPage, text: '', textCoords: [], pdfPageHeight });
        return '';
      }

      // Detect column structure
      const columns = detectColumns(items);
      let text;

      if (columns) {
        const parts = [];
        if (columns.header && columns.header.length > 0) {
          parts.push(buildTextFromItems(columns.header));
        }
        parts.push(buildTextFromItems(columns.left));
        parts.push(buildTextFromItems(columns.right));
        text = parts.join('\n\n');
      } else {
        text = buildTextFromItems(items);
      }

      pages.push({ pageNumber: currentPage, text, textCoords, pdfPageHeight });
      return text;
    });
  }

  const options = { pagerender: renderPage };
  const data = await pdfParse(pdfBuffer, options);

  return {
    pages,
    totalPages: data.numpages,
    metadata: {
      title: data.info?.Title || '',
      author: data.info?.Author || '',
    },
  };
}

/**
 * Detect if items form a two-column layout.
 * Handles mixed pages where the top (title/author) is full-width
 * and the body is two-column.
 * Returns { header: [...], left: [...], right: [...] } or null for single-column.
 */
function detectColumns(items) {
  if (items.length < 20) return null;

  const nonEmpty = items.filter(i => i.str.trim());
  if (nonEmpty.length < 20) return null;

  // Find the page width
  const allX = nonEmpty.map(i => i.x);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const pageWidth = maxX - minX;

  if (pageWidth < 200) return null;

  // Find the gutter
  const gutterX = findGutter(nonEmpty, minX, maxX);
  if (gutterX === null) return null;

  // Group items by Y into lines
  const linesByY = new Map();
  for (const item of nonEmpty) {
    const yKey = Math.round(item.y);
    if (!linesByY.has(yKey)) linesByY.set(yKey, []);
    linesByY.get(yKey).push(item);
  }

  // For each line, check if it spans across the gutter (full-width)
  // or is contained in one column
  const sortedYs = [...linesByY.keys()].sort((a, b) => b - a); // top to bottom

  // Find where the two-column region starts:
  // Scan from top — lines that span across the gutter are "header" (full-width)
  let columnStartY = null;
  let consecutiveColumnLines = 0;

  for (const y of sortedYs) {
    const lineItems = linesByY.get(y);
    const xs = lineItems.map(i => i.x);
    const lineMinX = Math.min(...xs);
    const lineMaxX = Math.max(...xs);

    // Check if items exist on both sides of the gutter
    const hasLeft = lineItems.some(i => i.x < gutterX - 10);
    const hasRight = lineItems.some(i => i.x > gutterX + 10);

    // Full-width line: spans from near left edge to near right edge
    const spansFullWidth = (lineMaxX - lineMinX) > pageWidth * 0.6;

    if (spansFullWidth && !hasLeft && !hasRight) {
      // Centered line (like a title) — still full-width header
      consecutiveColumnLines = 0;
    } else if (hasLeft && hasRight && spansFullWidth) {
      // Items on both sides but one continuous line — header
      consecutiveColumnLines = 0;
    } else if ((hasLeft && !hasRight) || (!hasLeft && hasRight)) {
      // Only on one side — this is a column line
      consecutiveColumnLines++;
      if (consecutiveColumnLines >= 3 && columnStartY === null) {
        // Found the start of two-column region
        // Go back to where it started
        const idx = sortedYs.indexOf(y);
        columnStartY = sortedYs[Math.max(0, idx - consecutiveColumnLines + 1)];
      }
    } else {
      consecutiveColumnLines = 0;
    }
  }

  if (columnStartY === null) return null;

  // Split items into header (above columnStartY) and left/right columns
  const header = [];
  const left = [];
  const right = [];

  for (const item of nonEmpty) {
    if (item.y > columnStartY + 2) {
      // Above the column start = header
      header.push(item);
    } else if (item.x < gutterX) {
      left.push(item);
    } else {
      right.push(item);
    }
  }

  if (left.length < 3 || right.length < 3) return null;

  return { header, left, right };
}

/**
 * Find the X position of the column gutter (gap between columns).
 */
function findGutter(items, minX, maxX) {
  const bucketSize = 5;
  const numBuckets = Math.ceil((maxX - minX) / bucketSize);
  const buckets = new Array(numBuckets).fill(0);

  for (const item of items) {
    if (!item.str.trim()) continue;
    const idx = Math.floor((item.x - minX) / bucketSize);
    if (idx >= 0 && idx < numBuckets) buckets[idx]++;
  }

  // Find the emptiest region in the middle third of the page
  const startBucket = Math.floor(numBuckets * 0.3);
  const endBucket = Math.floor(numBuckets * 0.7);
  let minCount = Infinity;
  let gutterBucket = -1;

  for (let i = startBucket; i < endBucket; i++) {
    // Sum of 3 adjacent buckets for robustness
    const sum = (buckets[i - 1] || 0) + buckets[i] + (buckets[i + 1] || 0);
    if (sum < minCount) {
      minCount = sum;
      gutterBucket = i;
    }
  }

  if (gutterBucket < 0 || minCount > 5) return null;

  return minX + (gutterBucket + 0.5) * bucketSize;
}

/**
 * Build structured text from a set of positioned text items.
 * Groups items into lines by Y position, detects paragraph breaks
 * via vertical gaps, and tags large-font lines.
 */
function buildTextFromItems(items) {
  if (items.length === 0) return '';

  // Group into lines by Y position
  const lineMap = new Map();
  for (const item of items) {
    if (!item.str) continue;
    // Round Y to nearest integer to group items on same line
    const yKey = Math.round(item.y * 2) / 2; // 0.5 precision
    if (!lineMap.has(yKey)) lineMap.set(yKey, []);
    lineMap.get(yKey).push(item);
  }

  // Sort lines top-to-bottom, items left-to-right within each line
  const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);

  const lines = [];
  for (const y of sortedYs) {
    const lineItems = lineMap.get(y).sort((a, b) => a.x - b.x);

    // Join items with appropriate spacing
    let text = '';
    let maxFontSize = 0;
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      maxFontSize = Math.max(maxFontSize, item.fontSize);

      if (i > 0) {
        const gap = item.x - (lineItems[i - 1].x + (lineItems[i - 1].width || 0));
        // Add space if there's a gap between items
        if (gap > item.fontSize * 0.3) {
          text += ' ';
        }
      }
      text += item.str;
    }

    const trimmed = text.trim();
    if (!trimmed) continue;

    // Clean up multiple spaces
    const cleaned = trimmed.replace(/\s{2,}/g, ' ');

    lines.push({
      text: cleaned,
      y: parseFloat(y),
      fontSize: maxFontSize,
    });
  }

  // Filter out orphan fragments: single characters or very short items
  // that are likely subscripts/superscripts extracted as separate lines
  const filteredLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;

    // Keep lines that are substantial, or are clearly meaningful short lines
    if (text.length <= 2 && /^[0-9∗†‡§¶]+$/.test(text)) {
      // Orphan number or footnote marker — skip
      continue;
    }
    filteredLines.push(line);
  }

  // Build output with paragraph detection
  // Only use vertical gaps for paragraph breaks, NOT font size changes
  // (font changes between body text and sub/superscripts are too common)
  const output = [];
  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];

    if (i > 0) {
      const gap = filteredLines[i - 1].y - line.y;
      const prevFontSize = filteredLines[i - 1].fontSize;
      const currFontSize = line.fontSize;
      const bodySize = Math.min(prevFontSize, currFontSize);
      const lineSpacing = bodySize * 1.35;

      // Only break on genuine vertical gaps (> 1.8x normal spacing)
      // OR a large font size jump (heading transition, not sub/superscript)
      const isParaBreak = gap > lineSpacing * 1.8;
      const isHeadingTransition = Math.abs(prevFontSize - currFontSize) > 3;

      if (isParaBreak || isHeadingTransition) {
        output.push('');
      }
    }

    // Tag large font lines
    if (line.fontSize > 13) {
      output.push(`@@FS${Math.round(line.fontSize)}@@ ${line.text}`);
    } else {
      output.push(line.text);
    }
  }

  return output.join('\n');
}

/**
 * Extract per-line text + PDF coordinates for ONE page of a PDF. Used
 * by figureService to compute figure bbox vertical edges from anchor
 * text (the last line above the figure and the first line of the
 * figcaption), instead of relying on the vision model to estimate
 * BOTTOM% directly. That estimation was unreliable — the model
 * consistently included caption + body text in the crop.
 *
 * Returns:
 *   {
 *     pageNumber,
 *     pdfPageWidth,
 *     pdfPageHeight,
 *     lines: [{ text, y, h, xMin, xMax }]  // sorted top-to-bottom (PDF y descending)
 *   }
 *
 * Each line is the concatenation of pdfjs text items that share the
 * same baseline Y (within ±2pt). Text is returned raw — the caller
 * normalizes for matching.
 *
 * pdfjs-dist is loaded via the legacy ESM path (same pattern as
 * services/imageService.js).
 */
async function extractPageTextLines(pdfBuffer, pageNumber) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    await pdf.destroy();
    throw new Error(`pageNumber ${pageNumber} out of range (1..${pdf.numPages})`);
  }
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const pdfPageWidth = viewport.width;
  const pdfPageHeight = viewport.height;

  const textContent = await page.getTextContent();
  const items = textContent.items
    .map((it) => ({
      str: it.str || '',
      x: it.transform[4],
      y: it.transform[5],
      h: Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 12,
      w: it.width || 0,
    }))
    .filter((it) => it.str && it.str.trim());

  // Return raw items. Line grouping has to be done DOWNSTREAM with
  // knowledge of the target column's x-range, otherwise two-column
  // academic papers get their left-column and right-column text
  // items concatenated into single lines (because they share the
  // same baseline Y). figureService uses the vision-model's bbox
  // LEFT/RIGHT as the column filter before grouping.
  await pdf.destroy();
  return { pageNumber, pdfPageWidth, pdfPageHeight, items };
}

// Filter raw pdfjs text items to a given X range (in PDF coords)
// and group the survivors into lines by baseline Y (±2pt). Returns
// lines sorted top-to-bottom (PDF y descending).
function groupItemsIntoLines(items, { xMin = -Infinity, xMax = Infinity } = {}) {
  const filtered = items.filter((it) => {
    const itemMidX = it.x + it.w / 2;
    return itemMidX >= xMin && itemMidX <= xMax;
  });
  filtered.sort((a, b) => b.y - a.y);
  const lines = [];
  let cur = null;
  for (const it of filtered) {
    if (!cur || Math.abs(cur.y - it.y) > 2) {
      cur = { items: [it], y: it.y, h: it.h, xMin: it.x, xMax: it.x + it.w };
      lines.push(cur);
    } else {
      cur.items.push(it);
      cur.h = Math.max(cur.h, it.h);
      if (it.x < cur.xMin) cur.xMin = it.x;
      if (it.x + it.w > cur.xMax) cur.xMax = it.x + it.w;
    }
  }
  return lines.map((l) => {
    const sorted = [...l.items].sort((a, b) => a.x - b.x);
    const text = sorted.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
    return { text, y: l.y, h: l.h, xMin: l.xMin, xMax: l.xMax };
  }).filter((l) => l.text.length > 0);
}

module.exports = { extractPages, extractPageTextLines, groupItemsIntoLines };
