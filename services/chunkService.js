/**
 * Chunk derivation service — groups spans into logical chunks.
 * Chunks are the universal unit for search, edges, and context.
 */

const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const Page = require('../models/Page');
const pipeline = require('../config/pipeline');

// Structural types that START a new chunk when they appear
const BOUNDARY_TYPES = new Set(['theorem', 'definition', 'lemma', 'proposition', 'corollary', 'proof', 'example', 'remark']);

// Demonstrative / anaphoric starters. If the next span's text
// begins with one of these, it refers to something in the
// preceding sentences and must NOT be split off into its own
// chunk — the antecedent would be orphaned and the reader would
// see "these novel perspectives" with no referent. The merge
// overrides every break rule except a same-book page change,
// since a chunk that bridges pages isn't representable in the
// current schema.
const PRONOUN_STARTS = new Set([
  'these', 'this', 'that', 'those', 'it', 'they', 'them',
  'such', 'these.', 'this.', 'that.', 'those.', 'it.',
  'hence', 'thus', 'therefore', 'so',
  'consequently', 'accordingly', 'moreover', 'furthermore',
]);

function firstWordOf(text) {
  if (!text || typeof text !== 'string') return '';
  const m = text.trim().match(/^[\p{L}]+/u);
  return m ? m[0].toLowerCase() : '';
}

function startsWithAnaphor(span) {
  const w = firstWordOf(span && span.spanText);
  return w && PRONOUN_STARTS.has(w);
}

/**
 * Determine structural type for a chunk from its spans and page annotations.
 */
function inferStructuralType(spans, pageAnnotations) {
  // Check if any span context tag matches a known type
  for (const s of spans) {
    for (const tag of s.contextTags || []) {
      if (tag === 'theorem' || tag.endsWith('_theorem')) return 'theorem';
      if (tag === 'definition' || tag.endsWith('_definition')) return 'definition';
      if (tag === 'proof') return 'proof';
      if (tag === 'example' || tag.endsWith('_example')) return 'example';
      if (tag === 'remark') return 'remark';
      if (tag === 'lemma') return 'theorem'; // treat lemma as theorem
      if (tag === 'notation') return 'notation';
      if (tag === 'equation' || tag.endsWith('_equation')) return 'equation';
    }
  }

  // Check page regex annotations for this sentence range
  if (pageAnnotations) {
    const sentRange = [spans[0]?.sentenceStart, spans[spans.length - 1]?.sentenceEnd];
    for (const ann of pageAnnotations) {
      if (ann.sentenceRange?.[0] >= sentRange[0] && ann.sentenceRange?.[0] <= sentRange[1]) {
        if (BOUNDARY_TYPES.has(ann.kind)) return ann.kind;
      }
    }
  }

  return 'narrative';
}

/**
 * Check if a span should start a new chunk based on structural signals.
 */
function shouldBreakChunk(currentSpans, nextSpan, pageAnnotations) {
  if (currentSpans.length === 0) return false;

  const lastSpan = currentSpans[currentSpans.length - 1];

  // Different page = new chunk (unavoidable — chunks can't
  // bridge pages in the current schema).
  if (nextSpan.pageNumber !== lastSpan.pageNumber) return true;

  // Overlapping spans from multi-concept decomposition —
  // multiple concept-specific spans share the same sentence
  // range. These MUST stay in the same chunk; they're
  // annotations of one sentence, not separate sentences.
  if (nextSpan.sentenceStart <= lastSpan.sentenceEnd) return false;

  // Anaphor merge: if the next sentence begins with a pronoun
  // or demonstrative ("these", "this", "it", "such", "hence",
  // etc), its antecedent is in the current chunk. Do NOT break,
  // regardless of any downstream rule. This overrides the span
  // count cap and the structural-boundary check within the same
  // page. Orphaned pronouns are worse than oversized chunks.
  if (startsWithAnaphor(nextSpan)) return false;

  // Check if nextSpan starts at a structural boundary
  // (theorem/definition/lemma/proof/example from the page
  // regex annotations produced during vision processing).
  if (pageAnnotations) {
    for (const ann of pageAnnotations) {
      if (ann.sentenceRange?.[0] === nextSpan.sentenceStart && BOUNDARY_TYPES.has(ann.kind)) {
        // Exception: proof follows theorem = same chunk
        const currentType = inferStructuralType(currentSpans, pageAnnotations);
        if (ann.kind === 'proof' && (currentType === 'theorem' || currentType === 'definition')) {
          return false; // keep theorem + proof together
        }
        return true;
      }
    }
  }

  // Gap of more than 3 sentences = likely new section
  if (nextSpan.sentenceStart - lastSpan.sentenceEnd > 3) return true;

  // Max spans per chunk. Bumped to 8 (from the original 3) so
  // narrative paragraphs stay intact. The prior limit of 3 was
  // the primary cause of 1-span chunks dominating dense text.
  if (currentSpans.length >= (pipeline.CHUNK_MAX_SPANS || 8)) return true;

  // Declarative tags (p14.3, r7.2 etc.) are strong semantic
  // markers the LLM emitted as "this sentence proves / assumes
  // / extends specific other content". They're rare (precision
  // over recall) so when they fire we respect the split.
  if (pipeline.CHUNK_SPLIT_ON_DECLARATIVE && nextSpan.declarativeTags?.length > 0) return true;

  // CHUNK_SPLIT_ON_SEARCH_CLASS is DELIBERATELY NOT CHECKED
  // HERE anymore. Gap search classes (L/I/S/B) are triage
  // signals the resolver uses to look up fill content —
  // they are NOT semantic chunk boundaries. The previous
  // behavior combined with "every chunk should have an L-tag"
  // in the span prompt produced 1-span chunks for every
  // gap-tagged sentence. See reports/2026-04-12/meta-data-logic.md.
  // The config flag is still read elsewhere if anything needs
  // it, but the chunker is now agnostic to search class.

  return false;
}

/**
 * Get the source text for a chunk from page rawText.
 */
async function getSourceText(bookId, pageNumber, sentenceStart, sentenceEnd) {
  const page = await Page.findOne({ bookId, pageNumber }).select('rawText').lean();
  if (!page?.rawText) return '';

  // Split into sentences and extract the range
  const sentences = page.rawText.split(/(?<=\.)\s+|\n\n+/).filter(s => s.trim());
  const start = Math.max(0, sentenceStart - 1);
  const end = Math.min(sentences.length, sentenceEnd);
  return sentences.slice(start, end).join(' ').trim();
}

/**
 * Generate chunks for all pages of a book from existing spans.
 */
async function generateChunksForBook(bookId) {
  // Clear existing chunks
  await Chunk.deleteMany({ bookId });
  await Page.updateMany({ bookId }, { $set: { chunkIds: [] } });
  await Span.updateMany({ bookId }, { $set: { chunkId: null } });

  // Load all spans sorted
  const spans = await Span.find({ bookId }).sort({ pageNumber: 1, sentenceStart: 1 }).lean();
  if (spans.length === 0) return { chunksCreated: 0 };

  // Load page annotations for boundary detection
  const pages = await Page.find({ bookId }).select('pageNumber structuralAnnotations').lean();
  const pageAnns = {};
  pages.forEach(p => { pageAnns[p.pageNumber] = p.structuralAnnotations || []; });

  // Group spans into chunks
  const chunkGroups = [];
  let currentGroup = [];

  for (const span of spans) {
    if (shouldBreakChunk(currentGroup, span, pageAnns[span.pageNumber])) {
      if (currentGroup.length > 0) chunkGroups.push(currentGroup);
      currentGroup = [span];
    } else {
      currentGroup.push(span);
    }
  }
  if (currentGroup.length > 0) chunkGroups.push(currentGroup);

  // Create Chunk documents
  const createdChunks = [];
  let chunkIndex = 0;

  for (const group of chunkGroups) {
    const firstSpan = group[0];
    const lastSpan = group[group.length - 1];

    // Aggregate tags
    const contextTags = [...new Set(group.flatMap(s => s.contextTags || []))];
    const searchClasses = [...new Set(group.map(s => s.searchClass).filter(sc => sc !== 'N'))];
    const hasUnresolved = group.some(s => !s.resolved && s.searchClass !== 'N');

    // Get source text
    const sourceText = await getSourceText(bookId, firstSpan.pageNumber, firstSpan.sentenceStart, lastSpan.sentenceEnd);

    const chunk = await Chunk.create({
      bookId,
      pageNumber: firstSpan.pageNumber,
      chunkIndex,
      sentenceStart: firstSpan.sentenceStart,
      sentenceEnd: lastSpan.sentenceEnd,
      spanIds: group.map(s => s._id),
      structuralType: inferStructuralType(group, pageAnns[firstSpan.pageNumber]),
      contextTags,
      searchClasses,
      hasUnresolvedSpans: hasUnresolved,
      sourceText,
      wordCount: sourceText.split(/\s+/).length,
      createdAt: new Date(),
    });

    createdChunks.push(chunk);
    chunkIndex++;
  }

  // Link prev/next pointers
  for (let i = 0; i < createdChunks.length; i++) {
    const update = {};
    if (i > 0) update.prevChunkId = createdChunks[i - 1]._id;
    if (i < createdChunks.length - 1) update.nextChunkId = createdChunks[i + 1]._id;
    if (Object.keys(update).length > 0) {
      await Chunk.findByIdAndUpdate(createdChunks[i]._id, update);
    }
  }

  // Update spans with chunkId
  for (const chunk of createdChunks) {
    await Span.updateMany(
      { _id: { $in: chunk.spanIds } },
      { $set: { chunkId: chunk._id } }
    );
  }

  // Update pages with chunkIds
  const pageChunks = {};
  for (const chunk of createdChunks) {
    if (!pageChunks[chunk.pageNumber]) pageChunks[chunk.pageNumber] = [];
    pageChunks[chunk.pageNumber].push(chunk._id);
  }
  for (const [pn, cids] of Object.entries(pageChunks)) {
    await Page.findOneAndUpdate({ bookId, pageNumber: parseInt(pn) }, { $set: { chunkIds: cids } });
  }

  console.log(`[chunkService] Created ${createdChunks.length} chunks from ${spans.length} spans`);
  return { chunksCreated: createdChunks.length };
}

module.exports = { generateChunksForBook };
