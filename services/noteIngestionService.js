/**
 * noteIngestionService — anchor a notes-kind Book to one or more
 * source-paper Books by creating cross-document Edges.
 *
 * Architectural premise (see Update.md 2026-04-11 design sketch):
 * a notes PDF is just a Book with `kind: 'notes'`. It runs through
 * the standard ingestion pipeline (vision → spans → chunks →
 * embeddings) UNCHANGED, so by the time this service runs the
 * notes Book already has chunks with contextTags and embeddings —
 * exactly the same shape as a paper Book's chunks.
 *
 * The only thing this service does is the LINKING pass: for each
 * chunk in the notes Book, find the source-book chunks discussing
 * the same idea and create Edge documents (method='note-citation',
 * relationshipType='annotates') anchored at those source chunks.
 *
 * Two-stage matching:
 *
 *   1. Coarse filter via concept-overlap (the synonym layer in
 *      services/taxonomyService.js). Cheap, deterministic, no API
 *      calls. Reduces a 100-page source book from ~150 chunks to
 *      ~10-20 candidates per note chunk.
 *
 *   2. Fine ranking via cosine similarity on text-embedding-3-small.
 *      Catches matches that don't share an explicit concept name
 *      but are about the same idea ("imposing zeros to fix the
 *      amplitude" ≈ "ansatz with hidden zero constraints").
 *
 * Why two stages instead of pure embeddings: cosine similarity is
 * dense and noisy when the corpus is small (~400 chunks). With
 * pure embeddings, every note chunk would match its top-K most
 * similar source chunks even if they're semantically unrelated.
 * The concept filter is the safety floor — at least one shared
 * canonical concept guarantees the match isn't a pure embedding
 * artifact.
 *
 * Generous defaults (NOTE_MATCH_MIN_OVERLAP=1, MIN_COSINE=0.72)
 * surface borderline matches with low confidence letters so the
 * user can judge quality visually. Tighten in config/pipeline.js
 * once we see what the 50-PDF Hidden Zero Personal Notes corpus
 * actually produces.
 */

const Book = require('../models/Book');
const Chunk = require('../models/Chunk');
const Edge = require('../models/Edge');
const Highlight = require('../models/Highlight');
const Note = require('../models/Note');
const pipeline = require('../config/pipeline');
const { expandTags } = require('./taxonomyService');
const { embed } = require('./embeddingService');

// ─── Cosine similarity ──────────────────────────────────────────

function cosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── Cosine → confidence letter ─────────────────────────────────
//
// Maps cosine similarity to the same a-z confidence scale that
// other Edge methods use. Gives the user a single visual axis
// for ranking matches across all edge methods.
//
//   cosine ≥ 0.85 → a (very strong)
//   cosine ≥ 0.80 → c
//   cosine ≥ 0.75 → f
//   cosine ≥ 0.72 → j (floor — only just above threshold)

function cosineToConfidence(c) {
  if (c >= 0.85) return 'a';
  if (c >= 0.80) return 'c';
  if (c >= 0.75) return 'f';
  return 'j';
}

// ─── Lazy embedding helper ──────────────────────────────────────
//
// Both note chunks and source chunks need embeddings for stage 2.
// Existing chunks in the DB don't have any (verified empirically),
// so we lazily embed any chunk that's missing one. The embedding
// uses sourceText + contextTags so the vector reflects both the
// natural language and the LLM's tagged concepts.

async function ensureEmbeddings(chunks) {
  const missing = chunks.filter(c => !c.embedding || c.embedding.length === 0);
  if (missing.length === 0) return chunks;

  console.log(`[noteIngestionService] embedding ${missing.length} chunks (lazy)`);
  // Embed one at a time to keep error handling simple — these
  // calls are cheap (< 1 cent per 100 chunks) and runs are short.
  // If this becomes a bottleneck, swap in embedBatch.
  for (const c of missing) {
    let text = c.sourceText || '';
    if (c.contextTags && c.contextTags.length) {
      text += '\nTags: ' + c.contextTags.join(', ');
    }
    if (!text.trim()) continue;
    try {
      const v = await embed(text);
      if (v && v.length) {
        await Chunk.findByIdAndUpdate(c._id, { embedding: v });
        c.embedding = v;
      }
    } catch (err) {
      console.warn(`[noteIngestionService] embed failed for chunk ${c._id}: ${err.message}`);
    }
  }
  return chunks;
}

// ─── Main matching pass ─────────────────────────────────────────

/**
 * For each chunk in the notes Book, find the best-matching chunks
 * across the entire library (not just linkedBookIds) and create
 * note-citation Edges.
 *
 * Per the user's "all-to-all" rule (2026-04-12): a notes book
 * should be matched against EVERY other library book — papers
 * AND other notes books. The `linkedBookIds` field still hints
 * at "primary" sources for the user's mental model, but matching
 * happens against the full corpus so the user discovers
 * connections they didn't anticipate.
 *
 * Idempotent: clears any existing note-citation edges from this
 * notes Book before re-matching, so callers can re-run safely
 * after a re-link or a source-book regen.
 */
async function matchNotesToSourceBooks(notesBookId) {
  const notesBook = await Book.findById(notesBookId).lean();
  if (!notesBook) {
    return { error: 'notes book not found' };
  }
  if (notesBook.kind !== 'notes') {
    return { error: 'book is not a notes book (kind=' + notesBook.kind + ')' };
  }

  // Pull every note chunk and ensure embeddings exist
  let noteChunks = await Chunk.find({ bookId: notesBookId })
    .select('_id pageNumber chunkIndex sourceText contextTags embedding structuralType')
    .lean();
  if (noteChunks.length === 0) {
    return { error: 'notes book has no chunks (pipeline not finished?)' };
  }
  noteChunks = await ensureEmbeddings(noteChunks);

  // Wipe any prior note-citation edges from this notes book so
  // re-runs are deterministic.
  await Edge.deleteMany({ fromBookId: notesBookId, method: 'note-citation' });

  // ALL-TO-ALL: target every paper book AND every OTHER notes
  // book in the library, not just the user's linkedBookIds. The
  // linkedBookIds list is preserved for the UI ("these notes
  // primarily annotate Rodina") but the matching pass uses the
  // full library so the user discovers cross-references they
  // didn't anticipate. Excludes the notes book itself and any
  // pending-citation stub books.
  const allLibraryBooks = await Book.find({
    _id: { $ne: notesBookId },
    status: { $ne: 'pending-citation' },
  }).select('_id title kind').lean();

  let edgesCreated = 0;
  const perSourceStats = [];

  // Pull the funnel's GPT-4o picker. We use the SAME pipeline that
  // the paper-to-paper resolver uses (concept overlap + embedding
  // cosine + GPT-4o pickAndClassify), so notes get the same
  // discrimination quality. The previous matcher was concept
  // overlap + raw cosine + threshold, which produced 12 edges on
  // 90 note chunks because handwritten OCR has too much vocabulary
  // drift for raw cosine to surface the right targets reliably.
  const funnel = require('./funnelService');

  for (const lookupBook of allLibraryBooks) {
    const sourceBookId = lookupBook._id;
    const sourceBook = lookupBook;
    if (!sourceBook) continue;

    // Pull source chunks (filter bib pages, ensure embeddings)
    const { isBibliographyChunk } = require('./edgeResolverService');
    const allSourceChunksRaw = await Chunk.find({ bookId: sourceBookId })
      .select('_id pageNumber chunkIndex sourceText contextTags embedding structuralType')
      .lean();
    // Reuse the funnel's bib-page detection so notes never land
    // on bibliography fragments.
    const bibPages = new Set();
    const BIB_FRAGMENT = /^\s*(?:\[\d+\]\s*[A-Z][a-z]?\.?|Bibliography|References)/;
    for (const c of allSourceChunksRaw) {
      if (isBibliographyChunk(c)) { bibPages.add(c.pageNumber); continue; }
      const txt = (c.sourceText || '').trim();
      if (BIB_FRAGMENT.test(txt) && txt.length < 50) bibPages.add(c.pageNumber);
      else if (/^Bibliography|^References\b/i.test(txt)) bibPages.add(c.pageNumber);
    }
    let sourceChunks = allSourceChunksRaw.filter(c => {
      if (bibPages.has(c.pageNumber)) return false;
      if ((c.sourceText || '').trim().length < 40) return false;
      return true;
    });
    if (sourceChunks.length === 0) {
      perSourceStats.push({ sourceBookId, title: sourceBook.title, chunks: 0, edges: 0 });
      continue;
    }
    sourceChunks = await ensureEmbeddings(sourceChunks);

    let createdHere = 0;
    // Track which source-paper chunkIds get covered by Direction 1.
    // Direction 2 (paper L-span → notes) ONLY runs for L-tagged
    // paper chunks NOT in this set — that's the locked-in
    // direction-reversal architecture: notes→paper is primary,
    // paper→notes only fills gaps the primary pass missed.
    const coveredSourceChunkIds = new Set();

    // ── DIRECTION 1: notes chunk → source chunk via funnel ──
    // For each note chunk, run the SAME funnel the paper resolver
    // uses: cosine top-25 → GPT-4o picks the best target with
    // relationship + confidence + relevance.
    for (const noteChunk of noteChunks) {
      if (!noteChunk.embedding || noteChunk.embedding.length === 0) continue;

      // Cosine top-25 across the source book's chunks
      const scored = [];
      for (const sc of sourceChunks) {
        if (!sc.embedding || sc.embedding.length === 0) continue;
        const cos = cosineSimilarity(noteChunk.embedding, sc.embedding);
        scored.push({ chunk: sc, cosine: cos });
      }
      scored.sort((a, b) => b.cosine - a.cosine);
      const top = scored.slice(0, 25);
      if (top.length === 0) continue;

      // Wrap the note chunk as a "span" the funnel can read
      const fakeSpan = {
        _id: noteChunk._id,
        spanText: noteChunk.sourceText || '',
        contextTags: noteChunk.contextTags || [],
        pageNumber: noteChunk.pageNumber,
      };
      let pickResult;
      try {
        pickResult = await funnel.pickAndClassify(fakeSpan, notesBook, sourceBook, top);
      } catch (err) {
        // Don't swallow errors silently — a broken import or API
        // failure was previously invisible and gave us a 0-edge run
        // that looked like "model rejected everything".
        console.warn('[noteIngestionService] pickAndClassify threw:', err.message);
        continue;
      }
      if (pickResult.error || !pickResult.chunk) continue;

      // Floor: drop weak matches (confidence or relevance below 'f')
      const cf = pickResult.confidence || 'a';
      const rv = pickResult.relevance || 'a';
      if (cf < 'f' || rv < 'f') continue;

      await Edge.create({
        fromChunkId: noteChunk._id,
        toChunkId: pickResult.chunk._id,
        fromBookId: notesBookId,
        toBookId: sourceBookId,
        relationshipType: 'annotates',
        confidence: cf,
        relevance: rv,
        method: 'note-citation',
        resolved: true,
      });
      coveredSourceChunkIds.add(String(pickResult.chunk._id));
      edgesCreated++;
      createdHere++;
    }

    // ── DIRECTION 2 (gap-fill only): paper L-tagged span → notes ──
    // Locked-in architecture (2026-04-10): the primary pass is
    // notes→paper because the notes target space is small and
    // clean. The reverse pass runs ONLY for L-tagged paper chunks
    // that the primary pass left UNCOVERED — i.e. L-tagged paper
    // chunks that no notes chunk landed on. This is structurally
    // why the directionality matters: an L-tagged chunk with no
    // incoming notes edge is exactly a "gap in your understanding"
    // signal, and we get one extra funnel call to try to fill it.
    //
    // BONUS OUTPUT: paper chunks (especially L-tagged) that remain
    // uncovered AFTER both passes are returned in
    // perSourceStats[i].uncoveredPaperChunkIds — these are crawler
    // targets, surface them in the UI as "you have notes on most of
    // this paper but no notes covering these specific chunks".
    const Span = require('../models/Span');
    const lSpans = await Span.find({ bookId: sourceBookId, searchClass: 'L' })
      .select('_id chunkId pageNumber spanText contextTags gapType')
      .lean();
    // Filter to L-spans whose parent chunk was NOT covered in
    // Direction 1. These are the only ones worth a Direction-2 call.
    const uncoveredLSpans = lSpans.filter(s => !coveredSourceChunkIds.has(String(s.chunkId)));
    for (const lSpan of uncoveredLSpans) {
      // Cosine top-25 across THE notes chunks (reverse direction)
      const scored = [];
      for (const nc of noteChunks) {
        if (!nc.embedding || nc.embedding.length === 0) continue;
        // Embed the L-span if needed
        let lEmbed = lSpan.embedding;
        if (!lEmbed) {
          // Use the parent chunk's embedding as a proxy — it's
          // close enough for the cosine filter
          const parent = sourceChunks.find(c => String(c._id) === String(lSpan.chunkId));
          if (parent) lEmbed = parent.embedding;
        }
        if (!lEmbed) continue;
        const cos = cosineSimilarity(lEmbed, nc.embedding);
        scored.push({ chunk: nc, cosine: cos });
      }
      scored.sort((a, b) => b.cosine - a.cosine);
      const top = scored.slice(0, 25);
      if (top.length === 0) continue;

      let pickResult;
      try {
        pickResult = await funnel.pickAndClassify(lSpan, sourceBook, notesBook, top);
      } catch (err) {
        // Don't swallow errors silently — a broken import or API
        // failure was previously invisible and gave us a 0-edge run
        // that looked like "model rejected everything".
        console.warn('[noteIngestionService] pickAndClassify threw:', err.message);
        continue;
      }
      if (pickResult.error || !pickResult.chunk) continue;
      const cf = pickResult.confidence || 'a';
      const rv = pickResult.relevance || 'a';
      if (cf < 'f' || rv < 'f') continue;

      // Edge points FROM the paper's L-span TO the notes chunk
      // that fills the gap. Relationship type defaults to
      // 'annotates' but the funnel may pick something more
      // specific (e.g. 'uses_definition' for an Ld span filled
      // by a definition note chunk).
      await Edge.create({
        fromChunkId: lSpan.chunkId,
        fromSpanId: lSpan._id,
        toChunkId: pickResult.chunk._id,
        fromBookId: sourceBookId,
        toBookId: notesBookId,
        relationshipType: pickResult.relationship || 'annotates',
        confidence: cf,
        relevance: rv,
        method: 'note-citation',
        resolved: true,
      });
      coveredSourceChunkIds.add(String(lSpan.chunkId));
      edgesCreated++;
      createdHere++;
    }

    // BONUS OUTPUT: which L-tagged paper chunks remain uncovered
    // after both passes? These are "gaps in your understanding" —
    // claims in the source paper that no notes chunk addresses,
    // even after the gap-fill pass. Crawler targets for arXiv
    // ingestion of cited sources.
    const uncoveredLChunkIds = [...new Set(
      lSpans
        .map(s => String(s.chunkId))
        .filter(id => !coveredSourceChunkIds.has(id))
    )];

    perSourceStats.push({
      sourceBookId,
      title: sourceBook.title,
      sourceChunks: sourceChunks.length,
      lSpans: lSpans.length,
      lSpansSkipped: lSpans.length - uncoveredLSpans.length,
      lSpansAttempted: uncoveredLSpans.length,
      edges: createdHere,
      uncoveredLChunkIds,                          // crawler targets
      coverageRatio: sourceChunks.length
        ? coveredSourceChunkIds.size / sourceChunks.length
        : 0,
    });
  }

  return {
    notesBookId,
    notesTitle: notesBook.title,
    noteChunks: noteChunks.length,
    edgesCreated,
    perSourceStats,
  };
}

/**
 * After a source paper Book is regenerated, all source-side chunk
 * IDs change, so any Edges from notes Books pointing at the old
 * chunks are stale. This helper finds every notes Book linking to
 * the regenerated paper and re-runs matching for each.
 *
 * Called from spanService.generateSpansForBook's post-processing
 * chain (analogous to the existing pending-stub reconciliation
 * pass for cross-paper bib edges).
 */
async function rematchNotesPointingAt(sourceBookId) {
  const notesBooks = await Book.find({
    kind: 'notes',
    linkedBookIds: sourceBookId,
  }).select('_id title').lean();

  if (notesBooks.length === 0) return { rematched: 0 };

  let totalEdges = 0;
  for (const nb of notesBooks) {
    const r = await matchNotesToSourceBooks(nb._id);
    if (r && r.edgesCreated) totalEdges += r.edgesCreated;
  }
  return { rematched: notesBooks.length, edgesCreated: totalEdges };
}

module.exports = {
  matchNotesToSourceBooks,
  rematchNotesPointingAt,
  cosineSimilarity,    // exported for tests / dry-run scripts
  cosineToConfidence,
};
