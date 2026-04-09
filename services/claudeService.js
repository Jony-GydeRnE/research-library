const Anthropic = require('@anthropic-ai/sdk');
const Book = require('../models/Book');
const Collection = require('../models/Collection');
const Page = require('../models/Page');
const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const Edge = require('../models/Edge');
const Note = require('../models/Note');
const pipeline = require('../config/pipeline');

const client = new Anthropic();

const BASE_PROMPT = `You are a research assistant for an advanced physics and mathematics researcher. You have deep knowledge of theoretical physics, algebraic geometry, quantum field theory, and related fields.

When answering:
- Be precise and rigorous. Cite specific theorems, equations, and page numbers when referencing the user's books.
- Use LaTeX notation for math: \\( ... \\) for inline, \\[ ... \\] for display equations.
- If you reference a passage from a book in the library, mention the book title and page number.
- Be concise but thorough. Prioritize clarity over verbosity.
- If you're unsure about something, say so rather than guessing.`;

/**
 * Rough token estimate (~4 chars per token).
 */
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

/**
 * Determine the context scope from chat metadata.
 * Returns: 'highlight' | 'page' | 'book' | 'collection' | 'library'
 */
function determineScope(chat) {
  if (chat.highlightText && chat.bookId && chat.pageNumber) return 'highlight';
  if (chat.bookId && chat.pageNumber) return 'page';
  if (chat.bookId) return 'book';
  if (chat.collectionId) return 'collection';
  return 'library';
}

/**
 * Build the full system prompt with scoped context.
 * Each scope includes everything from narrower scopes when available.
 * Respects CHAT_CONTEXT_BUDGET — drops wider-scope metadata first.
 */
async function buildContext(chat) {
  const scope = determineScope(chat);
  const budget = pipeline.CHAT_CONTEXT_BUDGET;
  const sections = [];
  let totalTokens = estimateTokens(BASE_PROMPT);

  console.log(`[claudeService] Scope: ${scope} | book: ${chat.bookId || '-'} | page: ${chat.pageNumber || '-'} | highlight: ${chat.highlightText ? 'yes' : 'no'} | collection: ${chat.collectionId || '-'}`);

  // ─── SCOPE 1: HIGHLIGHT ────────────────────────────────────────
  if (scope === 'highlight') {
    sections.push({
      priority: 1,
      text: `SCOPE: HIGHLIGHTED PASSAGE\nThe user is asking about a specific highlighted passage. Focus your answer on this passage and its immediate context.\n\nHighlighted text:\n"${chat.highlightText}"`,
    });

    // Current page for context
    const pageCtx = await getPageContext(chat.bookId, chat.pageNumber);
    if (pageCtx) sections.push({ priority: 2, text: pageCtx });

    // Book info
    const bookCtx = await getBookHeader(chat.bookId);
    if (bookCtx) sections.push({ priority: 3, text: bookCtx });

    // Phase 2: chunk + tags + edges + notes for this highlight
    const metaCtx = await getHighlightMetadata(chat.bookId, chat.pageNumber, chat.highlightText);
    if (metaCtx) sections.push({ priority: 4, text: metaCtx });
  }

  // ─── SCOPE 2: PAGE ─────────────────────────────────────────────
  else if (scope === 'page') {
    sections.push({
      priority: 1,
      text: `SCOPE: READING A SPECIFIC PAGE\nThe user is reading a specific page. Help them understand what's on this page.`,
    });

    const pageCtx = await getPageContext(chat.bookId, chat.pageNumber);
    if (pageCtx) sections.push({ priority: 2, text: pageCtx });

    // Adjacent pages for continuity
    const prevCtx = await getPageContext(chat.bookId, chat.pageNumber - 1, 'Previous page');
    if (prevCtx) sections.push({ priority: 5, text: prevCtx });
    const nextCtx = await getPageContext(chat.bookId, chat.pageNumber + 1, 'Next page');
    if (nextCtx) sections.push({ priority: 5, text: nextCtx });

    const bookCtx = await getBookHeader(chat.bookId);
    if (bookCtx) sections.push({ priority: 3, text: bookCtx });

    // Phase 2: chunks on this page
    const chunksCtx = await getPageChunks(chat.bookId, chat.pageNumber);
    if (chunksCtx) sections.push({ priority: 4, text: chunksCtx });
  }

  // ─── SCOPE 3: BOOK ─────────────────────────────────────────────
  else if (scope === 'book') {
    sections.push({
      priority: 1,
      text: `SCOPE: BOOK-LEVEL QUESTION\nThe user is asking about this book broadly. Use the book's metadata and chapter summaries.`,
    });

    const bookCtx = await getBookHeader(chat.bookId);
    if (bookCtx) sections.push({ priority: 2, text: bookCtx });

    // Chapter summaries from page chapterTitles
    const chapterCtx = await getBookChapters(chat.bookId);
    if (chapterCtx) sections.push({ priority: 3, text: chapterCtx });

    // Phase 2: book-level tags
    const tagsCtx = await getBookTags(chat.bookId);
    if (tagsCtx) sections.push({ priority: 4, text: tagsCtx });
  }

  // ─── SCOPE 4: COLLECTION ───────────────────────────────────────
  else if (scope === 'collection') {
    sections.push({
      priority: 1,
      text: `SCOPE: RESEARCH COLLECTION\nThe user is working within a research collection of multiple books. You can reference and cross-reference any book in this collection.`,
    });

    const colCtx = await getCollectionContext(chat.collectionId);
    if (colCtx) sections.push({ priority: 2, text: colCtx });
  }

  // ─── SCOPE 5: LIBRARY ─────────────────────────────────────────
  else {
    sections.push({
      priority: 1,
      text: `SCOPE: LIBRARY-WIDE\nThe user is asking a general question. You have access to their entire library's metadata.`,
    });
  }

  // ─── LIBRARY OVERVIEW (always included at lowest priority) ─────
  const libraryCtx = await getLibraryOverview();
  if (libraryCtx) sections.push({ priority: 10, text: libraryCtx });

  // ─── ASSEMBLE within budget ────────────────────────────────────
  sections.sort((a, b) => a.priority - b.priority);

  let system = BASE_PROMPT;
  for (const s of sections) {
    const tokens = estimateTokens(s.text);
    if (totalTokens + tokens > budget) {
      console.log(`[claudeService] Budget exceeded at priority ${s.priority}, dropping remaining sections`);
      break;
    }
    system += '\n\n' + s.text;
    totalTokens += tokens;
  }

  console.log(`[claudeService] Final context: ~${totalTokens} tokens, ${sections.length} sections`);
  return system;
}

// ─── CONTEXT HELPERS ─────────────────────────────────────────────

async function getPageContext(bookId, pageNumber, label) {
  if (!bookId || !pageNumber || pageNumber < 1) return null;
  const page = await Page.findOne({ bookId, pageNumber }).select('rawText chapterTitle sectionTitle').lean();
  if (!page || !page.rawText) return null;
  const prefix = label || `Page ${pageNumber}`;
  let ctx = `${prefix}`;
  if (page.chapterTitle) ctx += ` — ${page.chapterTitle}`;
  if (page.sectionTitle) ctx += ` > ${page.sectionTitle}`;
  ctx += `:\n${page.rawText.substring(0, 3000)}`;
  return ctx;
}

async function getBookHeader(bookId) {
  if (!bookId) return null;
  const book = await Book.findById(bookId).select('title author pageCount').lean();
  if (!book) return null;
  return `Book: "${book.title}"${book.author ? ' by ' + book.author : ''} (${book.pageCount || '?'} pages)`;
}

async function getBookChapters(bookId) {
  if (!bookId) return null;
  const pages = await Page.find({ bookId, chapterTitle: { $ne: null } })
    .select('pageNumber chapterTitle sectionTitle')
    .sort({ pageNumber: 1 }).lean();
  if (pages.length === 0) return null;
  const chapters = pages.map(p => `  p.${p.pageNumber}: ${p.chapterTitle}${p.sectionTitle ? ' > ' + p.sectionTitle : ''}`);
  return `Chapter structure:\n${chapters.join('\n')}`;
}

async function getBookTags(bookId) {
  // Phase 2: aggregate context tags from chunks
  const chunks = await Chunk.find({ bookId }).select('contextTags structuralType').lean();
  if (chunks.length === 0) return null;
  const allTags = new Set();
  chunks.forEach(c => (c.contextTags || []).forEach(t => allTags.add(t)));
  if (allTags.size === 0) return null;
  return `Book concept tags: ${[...allTags].slice(0, 50).join(', ')}`;
}

async function getHighlightMetadata(bookId, pageNumber, highlightText) {
  // Phase 2: find chunk containing this highlight, get its edges and notes
  const chunks = await Chunk.find({ bookId, pageNumber }).select('sourceText contextTags searchClasses').lean();
  if (chunks.length === 0) return null;

  // Find the chunk whose sourceText contains the highlight
  const matchingChunk = chunks.find(c => c.sourceText && c.sourceText.includes(highlightText.substring(0, 50)));
  if (!matchingChunk) return null;

  let ctx = `Chunk metadata for highlighted passage:`;
  if (matchingChunk.contextTags?.length) ctx += `\n  Tags: ${matchingChunk.contextTags.join(', ')}`;
  if (matchingChunk.searchClasses?.length) ctx += `\n  Search classes: ${matchingChunk.searchClasses.join(', ')}`;

  // Edges from/to this chunk
  const edges = await Edge.find({
    $or: [{ fromChunkId: matchingChunk._id }, { toChunkId: matchingChunk._id }]
  }).select('relationshipType confidence fromBookId toBookId').lean();
  if (edges.length > 0) {
    ctx += `\n  Related edges: ${edges.map(e => e.relationshipType).join(', ')}`;
  }

  // Notes on this page
  const notes = await Note.find({ bookId, pageNumber }).select('title content').lean();
  if (notes.length > 0) {
    ctx += `\n  User notes on this page:`;
    notes.forEach(n => {
      ctx += `\n    - ${n.title || 'Untitled'}: ${(n.content || '').substring(0, 200)}`;
    });
  }

  return ctx;
}

async function getPageChunks(bookId, pageNumber) {
  const chunks = await Chunk.find({ bookId, pageNumber }).select('contextTags structuralType sourceText').lean();
  if (chunks.length === 0) return null;
  const parts = chunks.map(c => {
    let s = `[${c.structuralType || 'unknown'}]`;
    if (c.contextTags?.length) s += ` tags: ${c.contextTags.join(', ')}`;
    return s;
  });
  return `Page ${pageNumber} chunks:\n${parts.join('\n')}`;
}

async function getCollectionContext(collectionId) {
  if (!collectionId) return null;
  const col = await Collection.findById(collectionId).lean();
  if (!col) return null;

  let ctx = `Collection: "${col.title}"`;
  if (col.instructions) ctx += `\n\nUser instructions for AI:\n${col.instructions}`;

  if (col.bookIds?.length > 0) {
    const books = await Book.find({ _id: { $in: col.bookIds } }).select('_id title author keyConcepts summary').lean();
    ctx += `\n\nBooks in this collection (${books.length}):`;

    // Adaptive depth: <=6 books → 3 pages × 1500 chars; >6 books → page 1 × 800 chars
    const deepMode = books.length <= 6;
    const maxPages = deepMode ? 3 : 1;
    const charLimit = deepMode ? 1500 : 800;

    for (const b of books.slice(0, 15)) {
      ctx += `\n\n--- Book: "${b.title}" ${b.author ? 'by ' + b.author : ''} ---`;
      if (b.summary) ctx += `\nSummary: ${b.summary}`;
      if (b.keyConcepts?.length) ctx += `\nKey concepts: ${b.keyConcepts.slice(0, 8).join(', ')}`;

      const pages = await Page.find({ bookId: b._id, pageNumber: { $lte: maxPages } })
        .select('pageNumber rawText').sort({ pageNumber: 1 }).lean();

      for (const p of pages) {
        const text = (p.rawText || '').substring(0, charLimit);
        if (text) ctx += `\n[Page ${p.pageNumber}]: ${text}`;
      }
    }
  }

  return ctx;
}

async function getLibraryOverview() {
  const books = await Book.find().select('title author pageCount keyConcepts').lean();
  if (books.length === 0) return null;
  const list = books.map(b => {
    let line = `- "${b.title}"${b.author ? ' (' + b.author + ')' : ''}`;
    if (b.keyConcepts?.length) line += ` [${b.keyConcepts.slice(0, 3).join(', ')}]`;
    return line;
  }).join('\n');
  return `Library (${books.length} books):\n${list}`;
}

// ─── STREAM RESPONSE ─────────────────────────────────────────────

async function streamResponse(chat, onChunk, onDone) {
  const system = await buildContext(chat);

  const messages = chat.messages
    .slice(-pipeline.CHAT_MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content }));

  let fullText = '';

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      fullText += event.delta.text;
      onChunk(event.delta.text);
    }
  }

  onDone(fullText);
}

module.exports = { streamResponse, buildContext, determineScope };
