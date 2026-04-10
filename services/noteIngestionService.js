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

  for (const lookupBook of allLibraryBooks) {
    const sourceBookId = lookupBook._id;
    const sourceBook = lookupBook;
    if (!sourceBook) continue;

    let sourceChunks = await Chunk.find({ bookId: sourceBookId })
      .select('_id pageNumber chunkIndex sourceText contextTags embedding structuralType')
      .lean();
    if (sourceChunks.length === 0) {
      perSourceStats.push({ sourceBookId, title: sourceBook.title, chunks: 0, edges: 0 });
      continue;
    }
    sourceChunks = await ensureEmbeddings(sourceChunks);

    let createdHere = 0;
    for (const noteChunk of noteChunks) {
      // ── Stage 1: concept-overlap filter ────────────────────
      const noteConcepts = expandTags(noteChunk.contextTags || []);
      if (noteConcepts.size === 0) continue;

      const candidates = [];
      for (const sc of sourceChunks) {
        const sourceConcepts = expandTags(sc.contextTags || []);
        let overlap = 0;
        for (const concept of noteConcepts) {
          if (sourceConcepts.has(concept)) overlap++;
        }
        if (overlap >= pipeline.NOTE_MATCH_MIN_OVERLAP) {
          candidates.push({ chunk: sc, conceptOverlap: overlap });
        }
      }
      if (candidates.length === 0) continue;

      // ── Stage 2: cosine ranking on the survivors ──────────
      if (!noteChunk.embedding || noteChunk.embedding.length === 0) continue;
      for (const cand of candidates) {
        cand.cosine = cosineSimilarity(noteChunk.embedding, cand.chunk.embedding || []);
      }
      candidates.sort((a, b) => b.cosine - a.cosine);

      // Keep top-K above the cosine floor
      const top = candidates
        .filter(c => c.cosine >= pipeline.NOTE_MATCH_MIN_COSINE)
        .slice(0, pipeline.NOTE_MATCH_MAX_PER_CHUNK);

      for (const match of top) {
        const confidence = cosineToConfidence(match.cosine);
        await Edge.create({
          fromChunkId: noteChunk._id,
          toChunkId: match.chunk._id,
          fromBookId: notesBookId,
          toBookId: sourceBookId,
          relationshipType: 'annotates',
          confidence,
          relevance: confidence,
          method: 'note-citation',
          resolved: true,
        });
        edgesCreated++;
        createdHere++;
      }
    }

    perSourceStats.push({
      sourceBookId,
      title: sourceBook.title,
      sourceChunks: sourceChunks.length,
      edges: createdHere,
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
