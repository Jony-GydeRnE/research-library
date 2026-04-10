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

const ARXIV_REGEX = /arxiv\s*[:\s]?\s*((?:[a-z\-]+(?:\.[A-Z]{2})?\/\d{7})|(?:\d{4}\.\d{4,5}))(?:v\d+)?/gi;
// DOI regex: match anything starting with 10.NNNN/ followed by allowed
// DOI characters. Crucially we ALLOW parens because JHEP-style DOIs are
// of the form 10.1007/JHEP03(2025)154 — physics's most-cited journal.
// Trailing punctuation (period, comma, closing brackets that don't pair
// with an opening one) is stripped in normalization.
const DOI_REGEX = /(?:doi\s*[:\s]+|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[\w./()\-]+)/gi;

function findArxivId(text) {
  if (!text) return null;
  ARXIV_REGEX.lastIndex = 0;
  const m = ARXIV_REGEX.exec(text);
  return m ? normalizeArxivId(m[1]) : null;
}

function findDoi(text) {
  if (!text) return null;
  DOI_REGEX.lastIndex = 0;
  const m = DOI_REGEX.exec(text);
  return m ? normalizeDoi(m[1]) : null;
}

/**
 * Scan the first few pages of a book for an arXiv ID and DOI on the
 * book itself. Persists arxivId / doi back onto the Book document.
 *
 * The arXiv ID can live in the front-matter (page 1), in a
 * page-margin watermark on every page (Rodina-style), or — for
 * older preprints — only on the cover. We scan the first 3 pages
 * and stop at the first hit. The first hit wins because the
 * front-matter ID is canonical; later page-margin watermarks would
 * just duplicate it.
 */
async function extractBookIdentifiers(bookId) {
  const pages = await Page.find({ bookId, pageNumber: { $lte: 3 } })
    .select('rawText')
    .sort({ pageNumber: 1 })
    .lean();
  const combined = pages.map(p => p.rawText || '').join('\n\n');
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
 */
async function extractBibliography(bookId) {
  const book = await Book.findById(bookId).select('pageCount').lean();
  if (!book) return [];
  // Walk pages from the END backwards collecting any with [N] entries.
  const lookback = Math.min(book.pageCount || 5, 8);
  const startPage = Math.max(1, (book.pageCount || lookback) - lookback + 1);
  const pages = await Page.find({ bookId, pageNumber: { $gte: startPage } })
    .select('pageNumber rawText')
    .sort({ pageNumber: 1 })
    .lean();
  // Find the FIRST page in this window that has a [1] entry — that's
  // the start of the references section. Concatenate from there to
  // the end of the book.
  let bibStartIdx = -1;
  for (let i = 0; i < pages.length; i++) {
    if (/\[1\]\s/.test(pages[i].rawText || '')) {
      bibStartIdx = i;
      break;
    }
  }
  // Fallback: if no [1] anchor, take pages whose text starts with [N]
  // entries. This handles cases where the bib starts mid-page.
  if (bibStartIdx < 0) {
    for (let i = 0; i < pages.length; i++) {
      if (/\[\d+\][^\[]{20,}/.test(pages[i].rawText || '')) {
        bibStartIdx = i;
        break;
      }
    }
  }
  if (bibStartIdx < 0) return [];
  const combined = pages.slice(bibStartIdx).map(p => p.rawText || '').join('\n');
  const entries = parseBibEntries(combined);
  await Book.findByIdAndUpdate(bookId, { bibEntries: entries });
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
};
