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

  // Different page = new chunk
  if (nextSpan.pageNumber !== lastSpan.pageNumber) return true;

  // Check if nextSpan starts at a structural boundary
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

  // Max spans per chunk (from pipeline config)
  if (currentSpans.length >= (pipeline.CHUNK_MAX_SPANS || 3)) return true;

  // Spans with declarative tags start new chunks (if configured)
  if (pipeline.CHUNK_SPLIT_ON_DECLARATIVE && nextSpan.declarativeTags?.length > 0) return true;

  // Spans with L/S/B search class start new chunks (if configured)
  if (pipeline.CHUNK_SPLIT_ON_SEARCH_CLASS && nextSpan.searchClass && nextSpan.searchClass !== 'N') return true;

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
