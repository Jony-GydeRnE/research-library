/**
 * Citation-as-span universal rule
 *
 * EVERY [N] citation marker in EVERY chunk's sourceText must have
 * a corresponding role=citation, searchClass=S Span document. This
 * is the user's "easy win" — guarantees 100% citation coverage so
 * the edge resolver never misses a cross-reference because the
 * span LLM happened to skip tagging it.
 *
 * Pipeline (per book):
 *   1. For each chunk with sourceText, scan for `[N]` and `[N-M]`
 *      and `[N,M,K]` reference patterns.
 *   2. For each unique citation key found in a chunk:
 *        a. Check if there's already a Span in this chunk with
 *           role=citation that mentions this key in its spanText.
 *        b. If yes, ensure searchClass='S'. Done.
 *        c. If no, create a new synthetic Span document covering
 *           the sentence containing the citation, with:
 *             role: 'citation'
 *             searchClass: 'S'
 *             contextTags: ['citation_to_ref_' + key]
 *             spanText: the sentence containing the [N]
 *             chunkId: the chunk we found it in
 *   3. Append the new span ids to the chunk's spanIds array.
 *
 * After this runs, calling edgeResolverService.resolveSEdgesForBook
 * will pick up all the synthetic spans automatically and create
 * Edge documents for any whose citation key resolves to a known
 * book in the library.
 *
 * Also: pending Book records.
 *   For each bib entry whose resolvedBookId is null AND has either
 *   an arxivId or DOI, create a stub Book document with status
 *   'pending-citation'. When a real upload comes in, the upload
 *   hook (built separately) checks pending Book records by
 *   identifier and resolves them.
 */

const Span = require('../models/Span');
const Chunk = require('../models/Chunk');
const Book = require('../models/Book');
const Page = require('../models/Page');

// Match [N], [N-M], [N,M,K] inside running prose. Returns the
// captured numeric keys. Same logic as edgeResolverService but
// inlined here so we can call it without importing the resolver.
function extractCitationKeysFromText(text) {
  if (!text) return [];
  const keys = new Set();
  for (const match of text.matchAll(/\[([\d,\s–-]+)\]/g)) {
    for (const part of match[1].split(',')) {
      const token = part.trim();
      if (/^\d+$/.test(token)) {
        keys.add(token);
        continue;
      }
      const range = token.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (!range) continue;
      const a = Number(range[1]), b = Number(range[2]);
      // Bound work for malformed references such as [1-999999999999].
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b < a || b - a > 1000) continue;
      for (let k = a; k <= b; k++) keys.add(String(k));
    }
  }
  return [...keys];
}

function findCitationSentence(sourceText, key) {
  if (!sourceText) return null;
  const sentences = sourceText.split(/(?<=\.)\s+|\n\n+/).filter(s => s.trim());
  const index = sentences.findIndex(s => extractCitationKeysFromText(s).includes(String(key)));
  return index < 0 ? null : { text: sentences[index].trim(), sentenceIndex: index + 1 };
}

/**
 * Add a citation annotation for every cited sentence. Citations overlay
 * proof/definition annotations: they must not overwrite their roles or gaps.
 * Sentence coordinates are one-based within the PAGE, not the chunk.
 */
async function ensureCitationSpansForBook(bookId) {
  const chunks = await Chunk.find({ bookId })
    .select('_id chunkIndex pageNumber sentenceStart sourceText spanIds').lean();
  let scanned = 0, existing = 0, created = 0, skippedUnanchoredChunks = 0;

  for (const chunk of chunks) {
    if (!chunk.sourceText) continue;
    scanned++;
    if (!extractCitationKeysFromText(chunk.sourceText).length) continue;
    if (!Number.isInteger(chunk.sentenceStart) || chunk.sentenceStart < 1) {
      skippedUnanchoredChunks++;
      continue; // Never invent a page position for a legacy/unanchored chunk.
    }
    const existingSpans = await Span.find({ chunkId: chunk._id, role: 'citation' })
      .select('_id spanText sentenceStart sentenceEnd searchClass resolved').lean();
    const sentences = chunk.sourceText.split(/(?<=\.)\s+|\n\n+/).filter(s => s.trim());
    const citationIds = [];
    let hasUnresolvedCitation = false;

    for (let i = 0; i < sentences.length; i++) {
      const keys = extractCitationKeysFromText(sentences[i]);
      if (!keys.length) continue;
      const position = chunk.sentenceStart + i;
      const target = existingSpans.find(s =>
        s.sentenceStart <= position && s.sentenceEnd >= position &&
        keys.every(k => extractCitationKeysFromText(s.spanText).includes(k)));
      if (target) {
        if (target.searchClass !== 'S') {
          await Span.findByIdAndUpdate(target._id, { searchClass: 'S', searchConfidence: null });
        }
        citationIds.push(target._id);
        if (!target.resolved) hasUnresolvedCitation = true;
        existing++;
        continue;
      }
      const span = await Span.create({
        bookId, pageNumber: chunk.pageNumber, chunkId: chunk._id,
        sentenceStart: position, sentenceEnd: position,
        role: 'citation', searchClass: 'S', searchConfidence: null,
        contextTags: [...keys.map(k => 'citation_to_ref_' + k), 'auto_citation_span'],
        declarativeTags: [], regexFlags: ['synthetic_citation_span'],
        spanText: sentences[i].trim(),
      });
      citationIds.push(span._id);
      hasUnresolvedCitation = true;
      created++;
    }
    if (citationIds.length) {
      await Chunk.findByIdAndUpdate(chunk._id, {
        $addToSet: { spanIds: { $each: citationIds }, searchClasses: 'S' },
        ...(hasUnresolvedCitation ? { $set: { hasUnresolvedSpans: true } } : {}),
      });
      await Page.findOneAndUpdate({ bookId, pageNumber: chunk.pageNumber }, {
        $addToSet: { spanIds: { $each: citationIds } },
      });
    }
  }
  return { chunksScanned: scanned, existingCitationSpans: existing,
    syntheticCitationSpans: created, skippedUnanchoredChunks };
}

/**
 * Run ensureCitationSpansForBook on every book in the library.
 */
async function ensureCitationSpansForLibrary() {
  const books = await Book.find({ status: { $ne: 'pending-citation' } }).select('_id title').lean();
  const summary = [];
  for (const b of books) {
    const r = await ensureCitationSpansForBook(b._id);
    summary.push({ bookId: b._id, title: (b.title || '').substring(0, 50), ...r });
  }
  return summary;
}

// ─── PENDING BOOK STUBS ─────────────────────────────────────────
//
// For each bib entry whose resolvedBookId is null AND has at
// least an arxivId or DOI, create a placeholder Book document.
// The placeholder carries the parsed bib metadata (title best-
// effort, authors, year, arxivId, doi) and status='pending-
// citation' so it doesn't show up in the user's library view.
//
// When a real PDF gets uploaded later, an upload-side hook
// (separate, see uploadController) checks pending books by
// identifier and:
//   1. If the upload's arXiv/DOI matches a pending book, the
//      pending book is "promoted" — its _id is preserved, status
//      changes to 'ready', and all real upload data (file URL,
//      page count, processing status) is written onto it.
//   2. Every bib entry with resolvedBookId pointing at the
//      pending book is now automatically resolved to the real
//      book without rerunning the matching pipeline.
//   3. The edge resolver is re-triggered to create cross-book
//      Edge documents using the new chunks.
//
// This is the foundation for the user's arXiv crawler vision —
// the crawler just performs the same upload action programmatically.

async function createPendingBookStubs() {
  const books = await Book.find({ status: { $ne: 'pending-citation' } })
    .select('_id bibEntries')
    .lean();

  // Collect every unresolved bib entry with an arxivId / DOI.
  // Dedup by identifier across books — if Rodina [9] and G/W [12]
  // both cite the same arxiv, we want ONE pending stub for that
  // arxiv, not two.
  const seenArxiv = new Set();
  const seenDoi = new Set();
  // First pass: see which arXiv IDs / DOIs are already in the
  // library (real books) so we don't create duplicate stubs.
  const realBooks = await Book.find().select('arxivId doi').lean();
  realBooks.forEach(b => {
    if (b.arxivId) seenArxiv.add(b.arxivId);
    if (b.doi) seenDoi.add(b.doi);
  });

  let created = 0;
  for (const b of books) {
    for (const e of (b.bibEntries || [])) {
      if (e.resolvedBookId) continue; // already resolved
      if (e.arxivId && !seenArxiv.has(e.arxivId)) {
        await Book.create({
          title: e.rawText.substring(0, 200),
          author: e.authors || '',
          arxivId: e.arxivId,
          status: 'pending-citation',
          uploadedAt: new Date(),
        });
        seenArxiv.add(e.arxivId);
        created++;
      } else if (e.doi && !seenDoi.has(e.doi)) {
        await Book.create({
          title: e.rawText.substring(0, 200),
          author: e.authors || '',
          doi: e.doi,
          status: 'pending-citation',
          uploadedAt: new Date(),
        });
        seenDoi.add(e.doi);
        created++;
      }
    }
  }
  return { pendingStubsCreated: created };
}

/**
 * Promote a pending book stub to a real book once a matching
 * upload arrives. Caller is uploadController. Matches by arxivId
 * or doi. Returns the matched stub or null.
 */
async function findPendingBookByIdentifier({ arxivId, doi }) {
  const query = { status: 'pending-citation' };
  if (arxivId) query.arxivId = arxivId;
  else if (doi) query.doi = doi;
  else return null;
  return await Book.findOne(query).lean();
}

module.exports = {
  ensureCitationSpansForBook,
  ensureCitationSpansForLibrary,
  createPendingBookStubs,
  findPendingBookByIdentifier,
  extractCitationKeysFromText,
  findCitationSentence,
};
