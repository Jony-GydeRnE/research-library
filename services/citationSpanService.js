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

// Match [N], [N-M], [N,M,K] inside running prose. Returns the
// captured numeric keys. Same logic as edgeResolverService but
// inlined here so we can call it without importing the resolver.
function extractCitationKeysFromText(text) {
  if (!text) return [];
  const keys = new Set();
  const re = /\[(\d+(?:[,\-\s\d]*\d)?)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const inner = m[1];
    if (/^\d+\-\d+$/.test(inner)) {
      const [a, b] = inner.split('-').map(Number);
      for (let k = a; k <= b; k++) keys.add(String(k));
    } else if (/[,]/.test(inner)) {
      inner.split(/[,\s]+/).forEach(k => {
        if (/^\d+$/.test(k)) keys.add(k);
      });
    } else if (/^\d+$/.test(inner)) {
      keys.add(inner);
    }
  }
  return Array.from(keys);
}

// Find the sentence containing a given citation key inside a chunk's
// source text. Returns { text, sentenceIndex } or null. We split on
// sentence boundaries (period followed by space, or double newline)
// to keep this consistent with how spanService numbers sentences.
function findCitationSentence(sourceText, key) {
  if (!sourceText) return null;
  const sentences = sourceText.split(/(?<=\.)\s+|\n\n+/).filter(s => s.trim());
  const marker = '[' + key + ']';
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].includes(marker)) {
      return { text: sentences[i].trim(), sentenceIndex: i + 1 };
    }
    // Also handle ranges/lists that contain this key
    const re = /\[(\d+(?:[,\-\s\d]*\d)?)\]/g;
    let m;
    while ((m = re.exec(sentences[i])) !== null) {
      const inner = m[1];
      if (/^\d+\-\d+$/.test(inner)) {
        const [a, b] = inner.split('-').map(Number);
        const k = parseInt(key, 10);
        if (k >= a && k <= b) {
          return { text: sentences[i].trim(), sentenceIndex: i + 1 };
        }
      }
      if (/[,]/.test(inner)) {
        const parts = inner.split(/[,\s]+/);
        if (parts.includes(key)) {
          return { text: sentences[i].trim(), sentenceIndex: i + 1 };
        }
      }
    }
  }
  return null;
}

/**
 * Ensure every [N] citation in every chunk of a book has a
 * dedicated role=citation, searchClass=S span. Idempotent: existing
 * citation spans are preserved. Returns a summary { chunksScanned,
 * existingCitationSpans, syntheticCitationSpans }.
 */
async function ensureCitationSpansForBook(bookId) {
  const chunks = await Chunk.find({ bookId })
    .select('_id chunkIndex pageNumber sourceText spanIds')
    .lean();
  let scanned = 0;
  let existing = 0;
  let created = 0;

  for (const chunk of chunks) {
    if (!chunk.sourceText) continue;
    scanned++;
    const keys = extractCitationKeysFromText(chunk.sourceText);
    if (keys.length === 0) continue;

    // Pull every existing span in this chunk so we can detect which
    // citation keys are already covered by a span (any span, not
    // just role=citation — what we care about is "does the span
    // text already contain this [N] marker").
    const existingSpans = await Span.find({ chunkId: chunk._id })
      .select('_id spanText role searchClass searchConfidence')
      .lean();

    const newSpanIds = [];

    // Group keys by the sentence they appear in. ONE synthetic span
    // per sentence — not one per citation key. If a sentence cites
    // [15], [22], and [23], we want a single span tagged with all
    // three references, not three duplicate spans with the same
    // text. Otherwise the edge resolver iterates each duplicate
    // and creates multiple identical edges to the same target.
    const sentenceToKeys = new Map();
    for (const key of keys) {
      // Skip if any existing span already covers this key — handle
      // promotion below.
      const marker = '[' + key + ']';
      const matching = existingSpans.filter(s => s.spanText && s.spanText.includes(marker));
      if (matching.length > 0) {
        const target = matching.find(s => s.role !== 'citation') || matching[0];
        const update = {};
        if (target.role !== 'citation') update.role = 'citation';
        if (target.searchClass !== 'S') {
          update.searchClass = 'S';
          update.searchConfidence = null;
        }
        if (Object.keys(update).length > 0) {
          await Span.findByIdAndUpdate(target._id, update);
        }
        existing++;
        continue;
      }
      // Find the sentence in the chunk text that contains this key.
      const sentence = findCitationSentence(chunk.sourceText, key);
      if (!sentence) continue;
      // Group by sentenceIndex so we create one span per unique
      // sentence regardless of how many keys it contains.
      const k = sentence.sentenceIndex;
      if (!sentenceToKeys.has(k)) {
        sentenceToKeys.set(k, { sentence, keys: [] });
      }
      sentenceToKeys.get(k).keys.push(key);
    }

    // Create one synthetic span per grouped sentence.
    for (const [, { sentence, keys: sKeys }] of sentenceToKeys) {
      const tags = sKeys.map(k => 'citation_to_ref_' + k);
      tags.push('auto_citation_span');
      const newSpan = await Span.create({
        bookId,
        pageNumber: chunk.pageNumber,
        chunkId: chunk._id,
        sentenceStart: sentence.sentenceIndex,
        sentenceEnd: sentence.sentenceIndex,
        role: 'citation',
        searchClass: 'S',
        searchConfidence: null,
        contextTags: tags,
        declarativeTags: [],
        regexFlags: ['synthetic_citation_span'],
        spanText: sentence.text,
        createdAt: new Date(),
      });
      newSpanIds.push(newSpan._id);
      created++;
    }

    if (newSpanIds.length > 0) {
      // Append to chunk.spanIds without disturbing existing order.
      await Chunk.findByIdAndUpdate(chunk._id, {
        $push: { spanIds: { $each: newSpanIds } },
      });
    }
  }

  return { chunksScanned: scanned, existingCitationSpans: existing, syntheticCitationSpans: created };
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
