/**
 * Bibliography service — extracts arXiv IDs / DOIs from a book's
 * front matter, parses the references section into structured
 * BibEntry objects, and matches each entry against other books
 * already in the library.
 *
 * This is the "edge foundation" pass — its output is what
 * edgeResolverService consumes to turn S-tagged spans into
 * cross-book Edge documents.
 *
 * Architecture (per Vision.md §4.3 Category S):
 *   1. extractBookIdentifiers — scan the first 2 pages for arXiv ID
 *      and DOI on the book itself; store on Book.arxivId / Book.doi
 *   2. extractBibliography — find the references pages, parse "[N]"
 *      entries, normalize each into a BibEntry
 *   3. matchBibliographyToLibrary — for each BibEntry, find any
 *      other Book in the library that matches by arXiv ID exactly
 *      (or DOI exactly); store the matched _id on resolvedBookId
 *
 * Steps 1 and 3 are deterministic, free, and require no LLM calls.
 * Step 2 is regex over already-extracted text. The whole pipeline
 * costs nothing per book and runs in well under a second.
 */

const Book = require('../models/Book');
const Page = require('../models/Page');
const path = require('path');
const fs = require('fs');

// ─── Column-aware PDF text extraction ───────────────────────────
//
// pdf-parse reads multi-column PDFs left-to-right-then-top-to-bottom
// which catastrophically scrambles 2-column bibliographies — entries
// from the left and right columns get merged together and the arxiv
// IDs from one entry end up adjacent to another entry's author list.
// The result: our bib parser picks up the WRONG arxiv ID for half
// the entries on a 2-column bib page.
//
// pdfjs-dist exposes the raw text items with their (x, y) positions
// so we can sort properly: group items by line (y-coord), then
// within each line assign them to a column by x-coord, then
// concatenate left-column lines first and right-column lines second.
//
// Returns the cleaned text for the requested page range as one
// string with entries separated by newlines. Falls back gracefully
// if pdfjs-dist throws.

async function extractPagesWithColumns(pdfPath, startPage, endPage) {
  if (!pdfPath || !fs.existsSync(pdfPath)) return null;
  let pdfjs;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (e) {
    console.warn('[bibliographyService] pdfjs-dist not available: ' + e.message);
    return null;
  }
  try {
    const buf = fs.readFileSync(pdfPath);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const total = doc.numPages;
    const s = Math.max(1, startPage || 1);
    const e = Math.min(total, endPage || total);
    const outLines = [];
    for (let pn = s; pn <= e; pn++) {
      const page = await doc.getPage(pn);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const content = await page.getTextContent();
      // Group items into lines by y-coordinate. Items within 3
      // pixels of each other vertically are considered the same
      // line. Items are sorted by x within each line.
      const lines = []; // { y, items: [...] }
      for (const it of content.items) {
        if (!it.str) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        let line = lines.find(l => Math.abs(l.y - y) < 3);
        if (!line) {
          line = { y, items: [] };
          lines.push(line);
        }
        line.items.push({ x, str: it.str });
      }
      // Sort lines by y descending (top to bottom in PDF coords)
      // and sort items within each line by x.
      lines.sort((a, b) => b.y - a.y);
      for (const line of lines) {
        line.items.sort((a, b) => a.x - b.x);
      }

      // Detect whether this page is 1-column or 2-column.
      //
      // Primary signal: how many item starts cluster in the MIDDLE
      // band of the page (x between 0.4*width and 0.6*width). On a
      // 2-column page, the right column's text starts around
      // pageWidth/2 — so many items have x in that band. On a
      // 1-column page, items start either at the left margin
      // (x ~= 79 for letter-size) or at a continuation indent
      // (x ~= 100) — almost nothing starts in the middle.
      //
      // Crossing lines (G/W has [9] on left and [31] on right at
      // the same y) are COUNTED AS TWO items for detection
      // purposes — each item is in its own column, they just
      // happen to share a y coordinate.
      let itemsStartingMidBand = 0;
      let itemsStartingLeftMargin = 0;
      let totalItems = 0;
      const midBandLow = pageWidth * 0.40;
      const midBandHigh = pageWidth * 0.60;
      const leftMarginMax = pageWidth * 0.20;
      for (const line of lines) {
        for (let i = 0; i < line.items.length; i++) {
          const it = line.items[i];
          // Count only items that START a new text run, not ones
          // that continue a previous item on the same line. An
          // item starts a new run if it's the first in the line
          // OR its preceding item ends far away (significant gap).
          const isNewRun = i === 0 ||
            (it.x - (line.items[i - 1].x + (line.items[i - 1].str.length * 4))) > 20;
          if (!isNewRun) continue;
          totalItems++;
          if (it.x >= midBandLow && it.x <= midBandHigh) itemsStartingMidBand++;
          else if (it.x <= leftMarginMax) itemsStartingLeftMargin++;
        }
      }
      // 2-column if at least 15% of new-run starts are in the
      // middle band AND the middle band has at least 8 such starts
      // (avoids false positives on pages with one or two
      // centered headers).
      const isTwoColumn = itemsStartingMidBand >= 8 &&
        totalItems > 0 &&
        (itemsStartingMidBand / totalItems) >= 0.15;

      if (isTwoColumn) {
        // Split each line into its left / right portions by the
        // midpoint. Output all left pieces first, then all right
        // pieces. Lines that DO cross (rare on a 2-column page —
        // usually wide figures or headers) are output in the
        // left-column stream with their full content.
        const leftOut = [];
        const rightOut = [];
        const boundary = pageWidth / 2;
        // A line "crosses" both columns only if it has a single
        // contiguous item starting well left of the boundary and
        // extending well past it (e.g. a wide header or figure
        // caption). Use generous guards: a true 2-col entry
        // never starts past 0.30*width or ends before 0.70*width
        // on the same physical line.
        const leftGuard = pageWidth * 0.30;
        const rightGuard = pageWidth * 0.70;
        for (const line of lines) {
          if (line.items.length === 0) continue;
          const minX = Math.min(...line.items.map(it => it.x));
          const maxX = Math.max(...line.items.map(it => it.x));
          // Only treat as a crossing line if it has NO gap near
          // the column boundary — otherwise the "single line" is
          // actually two separate column entries that share a y.
          const hasGapAtBoundary = line.items.some((it, i) => {
            if (i === 0) return false;
            const prev = line.items[i - 1];
            const prevEnd = prev.x + (prev.str.length * 4);
            return prev.x < boundary && it.x >= boundary && (it.x - prevEnd) > 10;
          });
          if (minX < leftGuard && maxX > rightGuard && !hasGapAtBoundary) {
            leftOut.push(line.items.map(it => it.str).join(''));
            continue;
          }
          const left = line.items.filter(it => it.x < boundary).map(it => it.str).join('');
          const right = line.items.filter(it => it.x >= boundary).map(it => it.str).join('');
          if (left) leftOut.push(left);
          if (right) rightOut.push(right);
        }
        outLines.push(...leftOut);
        outLines.push('');
        outLines.push(...rightOut);
      } else {
        // Single column: output each line as its full concatenated
        // text in y-descending order. This is the normal "read the
        // page top to bottom" behavior.
        for (const line of lines) {
          if (line.items.length === 0) continue;
          outLines.push(line.items.map(it => it.str).join(''));
        }
      }
      outLines.push(''); // page separator
    }
    return outLines.join('\n');
  } catch (err) {
    console.warn('[bibliographyService] pdfjs-dist extraction failed: ' + err.message);
    return null;
  }
}

// Resolve the local filesystem path for a book's PDF given its
// s3Key ("pdfs/12345_filename.pdf"). Returns null if no local
// copy exists.
function resolveBookPdfPath(book) {
  if (!book || !book.s3Key) return null;
  const basename = book.s3Key.replace(/^pdfs\//, '');
  const projectDir = path.join(__dirname, '..');
  const candidates = [
    path.join(projectDir, 'uploads', 'pdfs', basename),
    path.join(projectDir, book.s3Key),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ─── arXiv / DOI normalization ──────────────────────────────────
//
// arXiv has two ID formats:
//   Old (pre-2007): "hep-th/0403047", "math.AG/0512411" — category
//                   prefix + 7-digit number
//   New (2007+):    "2312.16282", optional ".v3" version suffix
//
// We normalize to the canonical bare form (no leading "arXiv:", no
// version suffix, lowercase). Both Books and BibEntries store the
// normalized form so equality comparison is enough for matching.

function normalizeArxivId(raw) {
  if (!raw) return null;
  let id = String(raw).trim();
  // Strip leading "arXiv:" / "arxiv:" / "arXiv " / "ArXiv ePrint:"
  id = id.replace(/^arxiv\s*[:\s]+/i, '').replace(/^arxiv\s+eprint\s*[:\s]+/i, '');
  // Strip trailing version suffix (v1/v2/.../v15)
  id = id.replace(/v\d+$/i, '');
  // Strip trailing punctuation
  id = id.replace(/[.,;)\]]+$/, '');
  // Strip surrounding whitespace
  id = id.trim();
  // Validate: either old-style category/number or new-style YYMM.NNNNN
  if (/^[a-z\-]+(\.[A-Z]{2})?\/\d{7}$/i.test(id)) return id.toLowerCase();
  if (/^\d{4}\.\d{4,5}$/.test(id)) return id;
  return null;
}

function normalizeDoi(raw) {
  if (!raw) return null;
  let doi = String(raw).trim();
  doi = doi.replace(/^doi\s*[:\s]+/i, '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  doi = doi.replace(/[.,;)\]]+$/, '').trim();
  if (/^10\.\d{4,9}\//.test(doi)) return doi.toLowerCase();
  return null;
}

// ─── Identifier extraction ──────────────────────────────────────
//
// Look at a chunk of text and find the FIRST arXiv ID / DOI in it.
// Used both for the book's own identifier (front matter scan) and
// for individual bibliography entries.

// Arxiv ID with explicit "arxiv:" prefix (most reliable, first choice).
const ARXIV_REGEX = /arxiv\s*[:\s]?\s*((?:[a-z\-]+(?:\.[A-Z]{2})?\/\d{7})|(?:\d{4}\.\d{4,5}))(?:v\d+)?/gi;
// Arxiv ID without "arxiv:" prefix, wrapped in square brackets. This is
// the JHEP style (and Zhou's bibliography): [hep-th/0412308] or
// [2312.16282]. Strict format to avoid matching citation keys like
// [15] or category markers like [hep-th].
const ARXIV_BRACKET_REGEX = /\[((?:[a-z\-]+(?:\.[A-Z]{2})?\/\d{7})|(?:\d{4}\.\d{4,5}))\]/gi;
// DOI regex: match anything starting with 10.NNNN/ followed by allowed
// DOI characters. Crucially we ALLOW parens because JHEP-style DOIs are
// of the form 10.1007/JHEP03(2025)154 — physics's most-cited journal.
// Trailing punctuation (period, comma, closing brackets that don't pair
// with an opening one) is stripped in normalization.
const DOI_REGEX = /(?:doi\s*[:\s]+|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[\w./()\-]+)/gi;

function findArxivId(text) {
  if (!text) return null;
  // First try the "arxiv:ID" form
  ARXIV_REGEX.lastIndex = 0;
  let m = ARXIV_REGEX.exec(text);
  if (m) return normalizeArxivId(m[1]);
  // Then try the "[ID]" form (Zhou-style, JHEP-style)
  ARXIV_BRACKET_REGEX.lastIndex = 0;
  m = ARXIV_BRACKET_REGEX.exec(text);
  if (m) return normalizeArxivId(m[1]);
  return null;
}

function findDoi(text) {
  if (!text) return null;
  DOI_REGEX.lastIndex = 0;
  const m = DOI_REGEX.exec(text);
  return m ? normalizeDoi(m[1]) : null;
}

// CRITICAL: bibliography parsing must use pdf-parse text (rawTextLegacy),
// NOT vision-extracted text (rawText). Vision OCRs from rendered page
// images and routinely mangles digits in dense reference lists — we
// observed GPT-4o vision turning "arXiv:2312.16282" into
// "arXiv:2312.12682" on Rodina's bib page (a 6→1 OCR error). Pdf-parse
// reads the PDF's text stream directly so digit fidelity is perfect.
// This helper picks the right source per page.
function pickBibSource(page) {
  return page.rawTextLegacy || page.rawText || '';
}

/**
 * Scan the first few pages of a book for an arXiv ID and DOI on the
 * book itself. Persists arxivId / doi back onto the Book document.
 *
 * Prefers pdfjs-dist column-aware extraction when the local PDF is
 * available — the front matter often has the arXiv ID on a
 * single-line watermark that's easy to misparse if 2-column
 * layout scrambles things. Falls back to pdf-parse rawTextLegacy.
 */
async function extractBookIdentifiers(bookId) {
  const book = await Book.findById(bookId).select('s3Key').lean();
  let combined = '';

  const pdfPath = book ? resolveBookPdfPath(book) : null;
  if (pdfPath) {
    const colText = await extractPagesWithColumns(pdfPath, 1, 3);
    if (colText) combined = colText;
  }
  if (!combined) {
    const pages = await Page.find({ bookId, pageNumber: { $lte: 3 } })
      .select('rawText rawTextLegacy')
      .sort({ pageNumber: 1 })
      .lean();
    combined = pages.map(pickBibSource).join('\n\n');
  }

  const arxivId = findArxivId(combined);
  const doi = findDoi(combined);
  const update = {};
  if (arxivId) update.arxivId = arxivId;
  if (doi) update.doi = doi;
  if (Object.keys(update).length > 0) {
    await Book.findByIdAndUpdate(bookId, update);
  }
  return { arxivId: arxivId || null, doi: doi || null };
}

// ─── Bibliography parsing ───────────────────────────────────────
//
// Heuristic: walk pages from the END of the book backwards. Stop
// once we've collected ~5 pages OR we hit a page with no [N]
// entries (the references section is contiguous). Then concatenate
// the rawText and run the [N] entry parser.
//
// The entry parser splits on lines starting with "[N]" and extracts
// per-entry: key (the N), the raw line, the first arXiv ID and DOI
// found inside the line, the year (4-digit number in parens), and
// a best-effort author string (everything before the first
// occurrence of " JHEP", " Phys. Rev.", " Nucl. Phys.", "(YYYY)",
// "arXiv:", or DOI).

// Bib entries are anchored at "[N]" markers where N is one or more
// digits — the standard physics-paper numeric reference style. The
// content of an entry can include other bracketed terms like "[hep-th]"
// inside arXiv IDs, so we use [\s\S] to match across brackets and rely
// on the lookahead `(?=\[\d+\]|$)` to find the next REFERENCE marker
// (which must be \d+, never alpha). Single-line `m` not needed because
// [\s\S] already crosses newlines.
const BIB_LINE_REGEX = /\[(\d+)\]\s*([\s\S]+?)(?=\[\d+\]|$)/g;

function parseBibEntries(text) {
  if (!text) return [];
  const entries = [];
  BIB_LINE_REGEX.lastIndex = 0;
  let m;
  while ((m = BIB_LINE_REGEX.exec(text)) !== null) {
    const key = m[1];
    const rawText = m[2].replace(/\s+/g, ' ').trim();
    if (!rawText) continue;
    const arxivId = findArxivId(rawText);
    const doi = findDoi(rawText);
    const yearMatch = rawText.match(/\((\d{4})\)/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
    // Authors: everything before the first journal-ish marker.
    const authorsCut = rawText.split(/\s(JHEP|Phys\.|Nucl\.|Class\.|Eur\.|Adv\.|Rev\.|Lett\.|J\.|Math\.|Comm\.|arXiv|\(\d{4}\))/i)[0];
    const authors = authorsCut ? authorsCut.replace(/[.,]\s*$/, '').trim() : '';
    entries.push({
      key,
      rawText,
      authors,
      year,
      arxivId,
      doi,
    });
  }
  return entries;
}

/**
 * Extract the bibliography for a book and persist it on
 * Book.bibEntries. Returns the parsed entries.
 *
 * Two source paths, tried in order:
 *   1. pdfjs-dist column-aware extraction from the local PDF file
 *      (if available) — this is the ONLY correct path for 2-column
 *      bibliographies. pdf-parse reads across columns horizontally
 *      which mixes entries from different columns together and
 *      causes arxiv IDs to be assigned to the wrong reference key.
 *   2. Fallback to rawTextLegacy (pdf-parse output) joined across
 *      the tail pages. Good enough for single-column books and
 *      any edge case where the local PDF isn't on disk.
 */
async function extractBibliography(bookId) {
  const book = await Book.findById(bookId).select('pageCount s3Key').lean();
  if (!book) return [];

  // ── Path 1: column-aware extraction from local PDF ──────────
  const pdfPath = resolveBookPdfPath(book);
  if (pdfPath) {
    // Bibliography typically lives in the last 3-8 pages. Scan the
    // tail by default — cheap since pdfjs only loads requested pages.
    const total = book.pageCount || 0;
    const lookback = Math.min(total || 8, 10);
    const startPage = Math.max(1, total - lookback + 1);
    try {
      const colText = await extractPagesWithColumns(pdfPath, startPage, total || undefined);
      if (colText) {
        // Find where [1] starts and cut everything before it. This
        // avoids capturing non-bib content from the pages above the
        // references section.
        const bibStart = colText.search(/\[\s*1\s*\]\s+[A-Z]/);
        const bibText = bibStart > 0 ? colText.substring(bibStart) : colText;
        const entries = parseBibEntries(bibText);
        if (entries.length >= 3) {
          // Accept only if we got a reasonable count. Less than 3
          // suggests something went wrong and we should fall through
          // to the rawTextLegacy path.
          await Book.findByIdAndUpdate(bookId, { bibEntries: entries });
          console.log('[bibliographyService] ' + String(bookId).substring(0, 8) + ': extracted ' + entries.length + ' bib entries via pdfjs-dist column-aware');
          return entries;
        }
      }
    } catch (err) {
      console.warn('[bibliographyService] pdfjs-dist path failed for ' + bookId + ': ' + err.message);
    }
  }

  // ── Path 2: rawTextLegacy fallback ──────────────────────────
  const lookback = Math.min(book.pageCount || 5, 8);
  const startPage = Math.max(1, (book.pageCount || lookback) - lookback + 1);
  const pages = await Page.find({ bookId, pageNumber: { $gte: startPage } })
    .select('pageNumber rawText rawTextLegacy')
    .sort({ pageNumber: 1 })
    .lean();
  let bibStartIdx = -1;
  for (let i = 0; i < pages.length; i++) {
    if (/\[1\]\s/.test(pickBibSource(pages[i]))) {
      bibStartIdx = i;
      break;
    }
  }
  if (bibStartIdx < 0) {
    for (let i = 0; i < pages.length; i++) {
      if (/\[\d+\][^\[]{20,}/.test(pickBibSource(pages[i]))) {
        bibStartIdx = i;
        break;
      }
    }
  }
  if (bibStartIdx < 0) return [];
  const combined = pages.slice(bibStartIdx).map(pickBibSource).join('\n');
  const entries = parseBibEntries(combined);
  await Book.findByIdAndUpdate(bookId, { bibEntries: entries });
  console.log('[bibliographyService] ' + String(bookId).substring(0, 8) + ': extracted ' + entries.length + ' bib entries via pdf-parse fallback');
  return entries;
}

// ─── Library matching ──────────────────────────────────────────
//
// For each BibEntry, find a matching Book in the library:
//   1. arXiv ID exact match (high confidence — physics gold standard)
//   2. DOI exact match (rare in physics, common in math)
//   3. (future) author + year similarity for entries lacking
//      identifiers — not built yet because (1) and (2) cover
//      every cross-reference inside our current 4-book corpus
//
// Returns a count of how many entries got resolved + the per-key
// resolution map for diagnostics.

async function matchBibliographyToLibrary(bookId) {
  const book = await Book.findById(bookId).lean();
  if (!book || !book.bibEntries || book.bibEntries.length === 0) {
    return { matched: 0, total: 0, resolutions: [] };
  }

  // Pull every other book's identifiers in one query.
  const otherBooks = await Book.find({ _id: { $ne: bookId } })
    .select('_id title arxivId doi')
    .lean();
  const arxivToBook = {};
  const doiToBook = {};
  for (const b of otherBooks) {
    if (b.arxivId) arxivToBook[b.arxivId] = b;
    if (b.doi) doiToBook[b.doi] = b;
  }

  let matched = 0;
  const resolutions = [];
  const updatedEntries = book.bibEntries.map(entry => {
    let resolvedBookId = null;
    let matchedBy = null;
    let matchedTitle = null;
    if (entry.arxivId && arxivToBook[entry.arxivId]) {
      resolvedBookId = arxivToBook[entry.arxivId]._id;
      matchedBy = 'arxiv';
      matchedTitle = arxivToBook[entry.arxivId].title;
    } else if (entry.doi && doiToBook[entry.doi]) {
      resolvedBookId = doiToBook[entry.doi]._id;
      matchedBy = 'doi';
      matchedTitle = doiToBook[entry.doi].title;
    }
    if (resolvedBookId) {
      matched++;
      resolutions.push({
        key: entry.key,
        arxivId: entry.arxivId,
        doi: entry.doi,
        matchedBy,
        matchedTitle: (matchedTitle || '').substring(0, 60),
      });
    }
    return { ...entry, resolvedBookId };
  });

  await Book.findByIdAndUpdate(bookId, { bibEntries: updatedEntries });
  return { matched, total: book.bibEntries.length, resolutions };
}

// ─── Pending-stub reconciliation ────────────────────────────────
//
// When a real book is uploaded that matches a pending-citation stub
// (the stub was created earlier from another book's bib entry that
// referenced an arXiv/DOI we didn't yet own), this function:
//   1. Finds the stub by the new book's identifier
//   2. Walks every other Book in the library and rewrites any
//      bibEntries[*].resolvedBookId that pointed at the stub so it
//      now points at the new real book
//   3. Deletes the stub
//
// After reconciliation the caller should re-run the edge resolver
// for the affected source books — the bib entries now resolve to
// real chunks, so edges can finally be created.
//
// Idempotent: if no stub matches, returns { reconciled: 0 } and
// makes no changes.

async function reconcilePendingStubsForBook(newBookId) {
  const newBook = await Book.findById(newBookId).select('arxivId doi').lean();
  if (!newBook || (!newBook.arxivId && !newBook.doi)) {
    return { reconciled: 0, sourceBooksUpdated: 0 };
  }

  // Look for a pending stub with the same arxiv or doi.
  const stubQuery = { status: 'pending-citation' };
  if (newBook.arxivId) stubQuery.arxivId = newBook.arxivId;
  else stubQuery.doi = newBook.doi;
  const stub = await Book.findOne(stubQuery).lean();
  if (!stub) return { reconciled: 0, sourceBooksUpdated: 0 };

  // Find every book with a bib entry pointing at the stub.
  const sourceBooks = await Book.find({ 'bibEntries.resolvedBookId': stub._id })
    .select('_id title bibEntries')
    .lean();

  let sourceBooksUpdated = 0;
  for (const sb of sourceBooks) {
    let changed = false;
    const updated = (sb.bibEntries || []).map(e => {
      if (String(e.resolvedBookId) === String(stub._id)) {
        changed = true;
        return { ...e, resolvedBookId: newBookId };
      }
      return e;
    });
    if (changed) {
      await Book.findByIdAndUpdate(sb._id, { bibEntries: updated });
      sourceBooksUpdated++;
    }
  }

  // Delete the stub now that no bib entries point at it.
  await Book.findByIdAndDelete(stub._id);

  console.log(`[bibliographyService] Reconciled stub ${stub._id} → ${newBookId}; ${sourceBooksUpdated} source books updated`);
  return {
    reconciled: 1,
    sourceBooksUpdated,
    sourceBookIds: sourceBooks.map(sb => sb._id),
    deletedStubId: stub._id,
  };
}

// ─── Top-level orchestration ────────────────────────────────────

/**
 * Run the whole bibliography pipeline for one book:
 *   1. Extract its own arXiv ID / DOI from front matter
 *   2. Parse its references section
 *   3. Match each parsed entry against other books in the library
 * Returns a summary object for diagnostics.
 */
async function processBookBibliography(bookId) {
  const ids = await extractBookIdentifiers(bookId);
  const entries = await extractBibliography(bookId);
  const matchResult = await matchBibliographyToLibrary(bookId);
  return {
    bookId,
    selfIds: ids,
    bibEntries: entries.length,
    bibWithArxiv: entries.filter(e => e.arxivId).length,
    bibWithDoi: entries.filter(e => e.doi).length,
    matched: matchResult.matched,
    resolutions: matchResult.resolutions,
  };
}

module.exports = {
  normalizeArxivId,
  normalizeDoi,
  findArxivId,
  findDoi,
  parseBibEntries,
  extractBookIdentifiers,
  extractBibliography,
  matchBibliographyToLibrary,
  processBookBibliography,
  reconcilePendingStubsForBook,
};
