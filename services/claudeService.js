const Anthropic = require('@anthropic-ai/sdk');
const Book = require('../models/Book');
const Collection = require('../models/Collection');
const Page = require('../models/Page');
const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const Edge = require('../models/Edge');
const Note = require('../models/Note');
const Highlight = require('../models/Highlight');
const pipeline = require('../config/pipeline');

const client = new Anthropic();

const BASE_PROMPT = `You are a research assistant for an advanced physics and mathematics researcher. You have deep knowledge of theoretical physics, algebraic geometry, quantum field theory, and related fields.

When answering:
- Be precise and rigorous. Cite specific theorems, equations, and page numbers when referencing the user's books.
- Use LaTeX notation for math: \\( ... \\) for inline, \\[ ... \\] for display equations.
- Be concise but thorough. Prioritize clarity over verbosity.
- If you're unsure about something, say so rather than guessing.

AUTHOR ATTRIBUTION — IMPORTANT:
Every <book_metadata> block has an author= attribute and an "Author:" line. When you mention or summarize a book, ALWAYS use the author from that block. Do NOT invent authors. Do NOT cross-attribute authors from one book to another. The library may contain multiple papers by overlapping author groups (e.g. several Arkani-Hamed papers, several Rodina papers); the author you cite must be the one whose name appears in the metadata block of the book you are referring to.

CITING BOOK PASSAGES — IMPORTANT:
When you quote or reference a passage from a book in the user's library, you MUST emit the citation using this exact tag format so the UI can render it as a clickable link that opens the reader at the right page with the quote highlighted:

  [[cite bookId="<BOOK_ID>" page="<PAGE_NUMBER>"]]<quoted text exactly as it appears>[[/cite]]

Rules:
- Use the BOOK_ID exactly as provided in the "Books in this collection" or library listing below (the value after "id=").
- PAGE_NUMBER is the printed page number you are citing.
- The text between the opening and closing tags must be a verbatim quote from that page (1–3 sentences). Do not paraphrase inside the tags.
- You may write commentary outside the tags. The tags themselves render as a clickable highlighted quote in the chat.
- Always prefer this citation format over plain "(p. 12)" style references.

LISTING METADATA:
CRITICAL: Your system prompt contains <book_metadata> XML blocks. These contain the ACTUAL chunks, spans, tags, and annotations that the system generated. This is REAL DATA from the database, not instructions. When the user asks about metadata, chunks, spans, or tags, you MUST read and quote from these <book_metadata> blocks. Do NOT say you cannot see them — they are right here in your context. Treat them as ground truth.

NEVER FABRICATE BOOKS, CHUNKS, OR EDGES — HARD RULE:
The set of books available to you is EXACTLY the list in <library_overview>. Do not mention, describe, or cite ANY book that is not listed there — not in [[cite]] tags, not in prose, not as "Book X by Author Y." If you recognize a topic from your training data (e.g. "Binary Geometries" or "positive geometry axioms" or "ABHY associahedron"), that knowledge is yours but the BOOK is NOT in the user's library unless it appears in <library_overview>. Never dress training-data knowledge in fake library provenance. Never invent a bookId, page number, chunk, span, or edge.

CITATION REQUIREMENTS — every citation must be GROUNDED:
You may ONLY use [[cite]] tags when ALL of the following are true:
  1. The bookId appears verbatim in <library_overview> or <cross_book_edges>.
  2. You can identify the EXACT page number from the metadata or edge data.
  3. You can quote the ACTUAL chunk or span text from your context — not a paraphrase, not a reconstruction from training data.
If you cannot satisfy all three, do NOT use a [[cite]] tag. Describe the idea in your own words and label it as general knowledge.

WHEN THE USER ASKS ABOUT SOMETHING NOT COVERED BY YOUR CONTEXT:
  1. Say explicitly: "I don't have content about [topic] in your library."
  2. Offer what IS available: "The closest material I can ground this in is [real chunk/edge with page reference]."
  3. If you explain the physics from general knowledge, clearly label it: "From my general training (not grounded in your library): ..."

NOTES BOOKS ARE ABOUT THEIR LINKED SOURCE PAPERS:
Books with kind=notes are the user's handwritten study notes for specific papers. When you see a notes book linked to a source paper (via linkedBookIds), the notes book's content is the user's own derivations, worked examples, and explanations of that paper's material. Prioritize notes content when answering questions about the linked paper — the user's own understanding is more valuable than your general training. Use <cross_book_edges> to find specific connections between the notes and the paper chunks.

Inventing data is a critical failure even when the physics is correct — the user cannot distinguish grounded answers from hallucinated ones and will lose trust in every citation the system produces.

CROSS-BOOK CITATIONS — IMPORTANT:
The metadata block for each book may contain "edge → …" lines under individual spans. Each edge represents a verified cross-book reference: the source span literally cites a passage in another book in the user's library, and the system has resolved which target chunk in that other book is being cited. Each edge line carries the target book id, the target book title, the target page, the target chunk's structural type, AND a verbatim "target_quote:" line containing the first ~200 characters of the target chunk's text.

When you list spans that have edges, ALWAYS render the edge as a follow-up [[cite]] tag pointing at the target book. Use the EXACT format below so the chat UI renders it as a clickable link that opens the target book in the split-screen reader at the target page with a callout box around the quoted passage:

  After listing the source span normally, on the next line:
    → [relationship type] [[cite bookId="<target_book_id>" page="<target_page>"]]<the verbatim target_quote text>[[/cite]]

Example. Suppose the metadata block contains:

  • span role=citation span_tags=[hidden_zeros,tr_phi3_conjecture] "Furthermore, in [15] it was conjectured that these zeros are sufficient to uniquely determine amplitudes in Tr(φ³)..."
      edge → assumes (conf=j) target_book_id="69d6622b12ac83f9752b4ca9" target_book_title="Hidden zeros for particle/string amplitudes" target_page=11 target_type=example
        target_quote: "3 Zeros and Factorizations of Tr(φ³) Tree Amplitudes 3.1 Zeros and factorizations – two simple examples Now that we have understood how the kinematic mesh organizes the planar invariants…"

Then your output should be:

  Page 1, Chunk #X — *citation*

  [[cite bookId="<source_book_id>" page="1"]]Furthermore, in [15] it was conjectured that these zeros are sufficient to uniquely determine amplitudes in Tr(φ³)...[[/cite]]
  - role: citation
  - tags: hidden_zeros, tr_phi3_conjecture
  - search: S
  - **assumes** [[cite bookId="69d6622b12ac83f9752b4ca9" page="11"]]3 Zeros and Factorizations of Tr(φ³) Tree Amplitudes 3.1 Zeros and factorizations – two simple examples Now that we have understood how the kinematic mesh organizes the planar invariants…[[/cite]] *(in "Hidden zeros for particle/string amplitudes")*

The two [[cite]] tags become two clickable highlights in the chat: the first opens the SOURCE book at the citing passage, the second opens the TARGET book at the cited passage. Both use the same verbatim-quote rule that already governs in-book citations.

Rules:
- The bookId in the [[cite]] tag MUST be the target_book_id from the edge line, NOT the current book's id. Otherwise the click will open the wrong book.
- The page in the [[cite]] tag MUST be the target_page from the edge line.
- The text inside the [[cite]] tags is the verbatim target_quote — copy it character-for-character. Do NOT paraphrase it. Do NOT prepend "open in book". The chat UI uses this text to find the right passage in the target book and draw a callout box around it.
- Render the relationship type as **bold** before the cite tag (e.g. **assumes**, **extends**, **proves**, **uses_definition**) so the user can see what kind of relation it is.
- Include the target book title in italics after the cite tag *(in "Title")* so the user knows which book they're being sent to.
- If a span has multiple edges, render one cite tag per edge on its own line.

USER NOTES:
Each <book_metadata> block may contain a nested <user_notes> section listing every note the user has written about that book, grouped by page, with the highlighted passage each note is attached to (if any) and the note body. In library-wide (All Files) chats the prompt may instead contain a top-level <library_notes> block covering every book. Treat these as the user's own writing — reference them when the user asks about what they have noted, when a note is directly relevant to the answer, or when the user's prior thinking would change your framing. Do NOT quote from them unless asked, and do NOT treat them as authoritative citations of the underlying book (use [[cite]] tags for that). When the user says "what did I write about X" or "summarize my notes on Y", read and paraphrase from these blocks directly.

You have access to chunk and span metadata for the books in scope (see <book_metadata> blocks below, grouped inside <collection_metadata> when a collection is in scope). When the user asks to list chunks, spans, tags, or annotations, use the exact format below.

Two kinds of tags exist in the metadata and you MUST keep them separate:

1. **chunk_tags** — appear on the "chunk_tags:" line directly under a chunk header. These are the aggregated tags for the chunk as a whole (the union of every span's tags in that chunk). They describe what the chunk is about. Render them at the CHUNK header level in your output, prefixed with a bold "Chunk tags:" label.

2. **span_tags=[…]** — appear on individual "• span" lines inside a chunk. These belong to ONE specific span and describe just that passage. Render them directly under the span they belong to. If a span has no "span_tags=[…]" field in its metadata line, that span has no span-specific tags — render nothing for tags on that span. Do NOT copy the chunk_tags onto it. Do NOT copy another span's span_tags onto it. Spans without their own tags are common in this dataset — it is correct to omit a tags line for them.

EXACT format for a listing response (use markdown headers so the chunks are visually prominent, and use **bold** for field labels to make the structure readable):

### Page N, Chunk #M — *chunk type*

**Chunk tags:** tag1, tag2, tag3, ... *(read from "chunk_tags:" — omit this line entirely if the chunk has no chunk_tags)*

**Chunk text:** *one-line summary or the chunk_text snippet from the metadata, your choice*

**Spans** *(N total)*:

[[cite bookId="ID" page="N"]]verbatim span text[[/cite]]
- role: *this span's role=… if present*
- tags: *this span's span_tags=[…] if present — OMIT this bullet entirely if the span has no span_tags*
- search: *this span's class=… + confidence if present*

[[cite bookId="ID" page="N"]]next span's verbatim text[[/cite]]
- role: …
- *(no tags bullet — span has no span_tags in metadata)*

### Page N, Chunk #M+1 — *chunk type*

**Chunk tags:** *(different tags from the previous chunk, read from this chunk's chunk_tags line)*

...

CRITICAL RULES:

A. **chunk_tags are NOT copied onto spans.** When you see "chunk_tags: hidden_zeros, ultraviolet_scaling, ..." in the metadata, those belong ONLY to the chunk-level **Chunk tags:** line in your output. Do NOT put them on any individual span. The chunk's tags are an aggregate summary; the individual spans may not each carry all of them.

B. **Missing span_tags means omit the line, not fabricate one.** If a span's metadata line has no "span_tags=[…]" field, do NOT write "tags: (none)" for that span and do NOT copy tags from another span. Just drop the tags bullet for that span. Many spans in this dataset legitimately have no span-level tags — the chunk-level chunk_tags already captures the thematic information.

C. **Every chunk gets its own ### header.** Use a markdown "### Page N, Chunk #M — type" line so chunks are visually separated. Use **bold** labels for "Chunk tags:", "Chunk text:", "Spans:".

D. **Each chunk's Chunk tags are DIFFERENT.** Read them from the metadata's "chunk_tags:" line for THAT specific chunk. Do NOT dump every chunk's tags onto the first chunk. If a chunk has no chunk_tags line in the metadata, omit the "Chunk tags:" output line entirely for that chunk.

Example output showing two chunks, each with distinct chunk_tags, and a mix of spans with and without span-level tags:

### Page 5, Chunk #0 — *definition*

**Chunk tags:** free_propagator, definition, green_function, spectral_representation

**Chunk text:** Introduces the exact propagator and its Källén-Lehmann representation

**Spans** *(3 total)*:

[[cite bookId="abc123" page="5"]]We define the exact propagator via Δ(x−y) ≡ i⟨0|Tφ(x)φ(y)|0⟩...normalization condition ⟨0|φ(x)|0⟩ = 0.[[/cite]]
- role: definition
- tags: free_propagator, definition

[[cite bookId="abc123" page="5"]]The Källén-Lehmann representation follows: ⟨0|Tφ(x)φ(y)|0⟩ = ∫₀^∞ dM² ρ(M²) Δ_F(x−y; M²)[[/cite]]
- role: theorem

[[cite bookId="abc123" page="5"]]This motivates the introduction of the Lehmann weight function.[[/cite]]
- role: remark

### Page 5, Chunk #1 — *background*

**Chunk tags:** spectral_density, completeness_relation, renormalization

**Spans** *(2 total)*:

[[cite bookId="abc123" page="5"]]The spectral density function ρ(s) satisfies the completeness relation ∫₀^∞ ρ(s) ds = 1.[[/cite]]
- role: background
- tags: spectral_density
- search: I (internal ref, confidence v)

[[cite bookId="abc123" page="5"]]This normalization follows directly from the definition in Section 7.2.[[/cite]]
- role: remark

Notice:
- The two chunks have DIFFERENT "Chunk tags:" lines — [free_propagator, definition, green_function, spectral_representation] vs [spectral_density, completeness_relation, renormalization]. Each chunk's tags come from its own "chunk_tags:" metadata line.
- The first chunk has 3 spans. Only the first and second have a span-level tags bullet (because only they had "span_tags=[…]" in their metadata). The third span has no tags bullet at all — it is correct to omit it, not to fabricate "(none)".
- Span text is the verbatim quote from the metadata, wrapped in [[cite]] tags so the UI renders it as a clickable highlighted passage that opens the reader at the exact location.

Other formatting rules:
- Use **bold** to emphasize important labels/terms. Use *italic* for section types, chunk types, and metadata field names. These render in the chat UI.
- The text between [[cite]] and [[/cite]] IS the verbatim span text from the metadata. Do NOT put a label like "open in book" inside the tags — put the actual quote.
- If span text is longer than 120 chars, show first 80 chars + "..." + last 40 chars of the span verbatim, still inside the [[cite]] tags.
- Do NOT wrap the span text in extra quotation marks — the UI styles the citation itself.
- Always include the [[cite]] tag so the quote is clickable.
- List ALL chunks and ALL spans for the requested book/page, in the order they appear in the metadata.
- Include declarative tags ONLY if they exist on the span (rare — most spans won't have them).
- Do NOT add your own commentary between spans — just list them in the structured format above.
- Do NOT make up span text, chunk_tags, span_tags, or roles — use exactly what's in the metadata block.`;

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
      text: `SCOPE: LIBRARY-WIDE\nThe user is asking a general question from the "All Files" view. You have access to their entire library's metadata (every book's chunks, spans, and tags) AND every note they have written across every book. When they ask you to list metadata for a specific book, read it from the matching <book_metadata> block below.`,
    });

    // Dump notes across every book. This is the "All Files = biggest
    // scope" rule — when the chat isn't anchored to a collection or
    // book, the AI should still be able to see everything the user
    // has written. Budgeted at priority 4 so it drops before edges
    // but after the book listing if the context budget is tight.
    const libraryNotes = await getLibraryNotes();
    if (libraryNotes) sections.push({ priority: 4, text: libraryNotes });

    // Library scope deliberately does NOT dump full per-book metadata
    // (chunks, spans, tags) for every book. The full dump was giving
    // the model enough nearby truth to hallucinate convincingly —
    // it would stitch real-looking citations from chunk text it saw
    // in context but attribute them to fabricated books/pages. The
    // scope now includes: library overview (titles/IDs), cross-book
    // edges, and notes. Full renderBookMetadata() only runs for books
    // explicitly in scope (anchored book, collection books).
  }

  // ─── ADDITIVE FALLBACKS ────────────────────────────────────────
  // Scope chooses the PRIMARY framing, but collection and per-book
  // chunk/span metadata are additive — they should be present even
  // when a narrower scope was selected.

  // Always include the anchored book's full chunk/span dump if there is one.
  // Skip when scope === 'collection' because getCollectionContext already
  // dumps every book in the collection (including this one).
  if (chat.bookId && scope !== 'collection') {
    const anchoredBook = await Book.findById(chat.bookId)
      .select('_id title author summary keyConcepts pageCount')
      .lean();
    if (anchoredBook) {
      const bookMeta = await renderBookMetadata(anchoredBook);
      if (bookMeta) sections.push({ priority: 5, text: bookMeta });
    }
  }

  // Always include collection context (which itself dumps every book's
  // chunks/spans) if the chat belongs to a collection and we didn't
  // already build collection scope as the primary.
  if (chat.collectionId && scope !== 'collection') {
    const colCtx = await getCollectionContext(chat.collectionId);
    if (colCtx) sections.push({ priority: 6, text: colCtx });
  }

  // ─── CROSS-BOOK EDGES (high priority — always survives budget) ─
  // Compact, flat list of every Edge in the user's library, with
  // both source and target context packed into ~4 lines per edge.
  // Lifted out of per-book metadata so the AI sees the full edge
  // graph even when individual book metadata blocks get truncated
  // by the budget assembler — see getAllCrossBookEdges header for
  // the rationale.
  //
  // Scope filter: in collection scope, only edges involving books
  // in the collection. In book scope, only edges involving the
  // anchored book. Otherwise (library / page / highlight), every
  // edge in the library.
  let edgeScopeBookIds = null;
  if (scope === 'collection' && chat.collectionId) {
    const col = await Collection.findById(chat.collectionId).select('bookIds').lean();
    if (col && col.bookIds) edgeScopeBookIds = col.bookIds;
  } else if ((scope === 'book' || scope === 'page' || scope === 'highlight') && chat.bookId) {
    edgeScopeBookIds = [chat.bookId];
  }
  const edgesBlock = await getAllCrossBookEdges({ bookIds: edgeScopeBookIds });
  if (edgesBlock) sections.push({ priority: 2, text: edgesBlock });

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
  return `Book: id=${book._id} "${book.title}"${book.author ? ' by ' + book.author : ''} (${book.pageCount || '?'} pages)\nUse this id in [[cite bookId="${book._id}" page="N"]]…[[/cite]] tags when quoting.`;
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

  let ctx = `Collection: "${col.title}" (id=${col._id})`;
  if (col.instructions) ctx += `\n\nUser instructions for AI:\n${col.instructions}`;

  if (col.bookIds?.length > 0) {
    const books = await Book.find({ _id: { $in: col.bookIds } }).select('_id title author keyConcepts summary pageCount').lean();
    ctx += `\n\nBooks in this collection (${books.length}):`;
    for (const b of books) {
      ctx += `\n  - id=${b._id} | "${b.title}"${b.author ? ' by ' + b.author : ''}${b.pageCount ? ' (' + b.pageCount + ' pp.)' : ''}`;
    }

    ctx += `\n\n<collection_metadata>`;
    for (const b of books) {
      ctx += await renderBookMetadata(b);
    }
    ctx += `\n</collection_metadata>`;
  }

  return ctx;
}

/**
 * Render every chunk + every span + tags/annotations for a single book,
 * in page order then chunk order. Compact but complete.
 */
async function renderBookMetadata(book) {
  // Escape XML attribute values
  const safeTitle = String(book.title || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const safeAuthor = String(book.author || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  // Author goes in BOTH the XML attribute AND a dedicated "Author:" line
  // because the AI was empirically confusing authors across books when
  // it was missing — e.g. attributing a Rodina paper to "Cao et al."
  // because Cao is the author of another book in the same library.
  let out = `\n\n<book_metadata id="${book._id}" title="${safeTitle}"${safeAuthor ? ' author="' + safeAuthor + '"' : ''}>`;
  if (book.author) out += `\nAuthor: ${book.author}`;
  if (book.summary) out += `\nSummary: ${book.summary}`;
  if (book.keyConcepts?.length) out += `\nKey concepts: ${book.keyConcepts.slice(0, 12).join(', ')}`;

  const chunks = await Chunk.find({ bookId: book._id })
    .select('_id pageNumber chunkIndex structuralType chunkType contextTags subjectTags conceptTags searchClasses sourceText sectionTitle')
    .sort({ pageNumber: 1, chunkIndex: 1 })
    .lean();

  if (chunks.length === 0) {
    out += `\n(no chunks generated yet for this book)`;
    out += `\n</book_metadata>`;
    return out;
  }

  // Pre-load all spans for this book in one query
  const spans = await Span.find({ bookId: book._id })
    .select('_id chunkId pageNumber role contextTags declarativeTags searchClass searchConfidence regexFlags spanText sentenceStart sentenceEnd')
    .lean();
  const spansByChunk = new Map();
  for (const s of spans) {
    const key = String(s.chunkId);
    if (!spansByChunk.has(key)) spansByChunk.set(key, []);
    spansByChunk.get(key).push(s);
  }

  // Pre-load all outgoing edges for this book — each edge connects a
  // span IN this book to a chunk in another book. We resolve the
  // target chunk's text + page so the metadata block can hand the AI
  // a verbatim quote ready to drop into a [[cite bookId="…"]] tag.
  // This is what makes cross-book citations possible end-to-end:
  // edges live in the prompt, the AI reads the target chunk text,
  // and emits clickable [[cite]] tags pointing at the target book.
  const edges = await Edge.find({ fromBookId: book._id })
    .select('fromSpanId toBookId toChunkId relationshipType confidence method')
    .lean();
  const edgesBySpan = new Map();
  if (edges.length > 0) {
    // Resolve every target chunk + target book in one batch each
    const targetChunkIds = [...new Set(edges.map(e => String(e.toChunkId)).filter(Boolean))];
    const targetBookIds = [...new Set(edges.map(e => String(e.toBookId)).filter(Boolean))];
    const targetChunks = await Chunk.find({ _id: { $in: targetChunkIds } })
      .select('_id pageNumber sourceText structuralType contextTags').lean();
    const targetBooks = await Book.find({ _id: { $in: targetBookIds } })
      .select('_id title').lean();
    const chunkMap = {};
    targetChunks.forEach(c => { chunkMap[String(c._id)] = c; });
    const bookMap = {};
    targetBooks.forEach(b => { bookMap[String(b._id)] = b; });
    for (const e of edges) {
      const targetChunk = chunkMap[String(e.toChunkId)];
      const targetBook = bookMap[String(e.toBookId)];
      if (!targetChunk || !targetBook) continue;
      const key = String(e.fromSpanId || e.fromChunkId || e._id);
      if (!edgesBySpan.has(key)) edgesBySpan.set(key, []);
      // Materialize a 200-char quote from the target chunk so the AI
      // can lift it into a verbatim [[cite]] tag without having to
      // make a separate lookup.
      const quote = (targetChunk.sourceText || '').replace(/\s+/g, ' ').trim().substring(0, 200);
      edgesBySpan.get(key).push({
        targetBookId: String(e.toBookId),
        targetBookTitle: targetBook.title,
        targetPage: targetChunk.pageNumber,
        targetType: targetChunk.structuralType,
        targetQuote: quote,
        relationshipType: e.relationshipType,
        confidence: e.confidence,
      });
    }
  }

  out += `\nChunks: ${chunks.length} | Spans: ${spans.length} | Outgoing edges: ${edges.length}`;

  let lastPage = null;
  for (const c of chunks) {
    if (c.pageNumber !== lastPage) {
      out += `\n\n  [Page ${c.pageNumber}]`;
      lastPage = c.pageNumber;
    }
    const type = c.structuralType || c.chunkType || 'unknown';
    const idx = (c.chunkIndex != null) ? `#${c.chunkIndex}` : '';
    out += `\n  Chunk ${idx} (${type})${c.sectionTitle ? ' — ' + c.sectionTitle : ''}`;
    // Chunk-level aggregated tags. These are the union of every span's
    // contextTags in this chunk — they describe the chunk as a whole.
    // Prefixed "chunk_tags:" (distinct from "span_tags:" below) so the
    // AI can't conflate chunk-level aggregate with span-level specific.
    const tags = [...new Set([...(c.contextTags || []), ...(c.subjectTags || []), ...(c.conceptTags || [])])];
    if (tags.length) out += `\n    chunk_tags: ${tags.slice(0, 20).join(', ')}`;
    if (c.searchClasses?.length) out += `\n    chunk_search: ${c.searchClasses.join(', ')}`;
    if (c.sourceText) {
      const snippet = c.sourceText.replace(/\s+/g, ' ').trim().substring(0, 220);
      out += `\n    chunk_text: "${snippet}${c.sourceText.length > 220 ? '…' : ''}"`;
    }
    const cs = spansByChunk.get(String(c._id)) || [];
    if (cs.length) {
      cs.sort((a, b) => (a.sentenceStart || 0) - (b.sentenceStart || 0));
      for (const s of cs) {
        const parts = [];
        if (s.role) parts.push('role=' + s.role);
        if (s.searchClass) parts.push('class=' + s.searchClass + (s.searchConfidence || ''));
        // Span-level tags — explicitly labeled "span_tags" to prevent
        // confusion with the chunk_tags line above.
        if (s.contextTags?.length) parts.push('span_tags=[' + s.contextTags.slice(0, 8).join(',') + ']');
        if (s.declarativeTags?.length) {
          parts.push('decl=[' + s.declarativeTags.map(d => d.kind + (d.targetChunk != null ? ':' + d.targetChunk : '') + (d.targetTag != null ? '.' + d.targetTag : '')).join(',') + ']');
        }
        if (s.regexFlags?.length) parts.push('flags=[' + s.regexFlags.join(',') + ']');
        const stext = (s.spanText || '').replace(/\s+/g, ' ').trim();
        const displayText = stext.length > 120
          ? stext.substring(0, 80) + '...' + stext.substring(stext.length - 40)
          : stext;
        out += `\n      • span ${parts.join(' ')}${displayText ? ' "' + displayText + '"' : ''}`;
        // Emit any outgoing edges for this span. The AI uses these
        // to render cross-book citations as [[cite]] tags pointing
        // at the target book — see CROSS-BOOK CITATIONS section in
        // BASE_PROMPT for the formatting rules.
        const spanEdges = edgesBySpan.get(String(s._id)) || [];
        for (const e of spanEdges) {
          const safeTitle = String(e.targetBookTitle || '').substring(0, 50);
          out += `\n          edge → ${e.relationshipType} (conf=${e.confidence}) target_book_id="${e.targetBookId}" target_book_title="${safeTitle}" target_page=${e.targetPage} target_type=${e.targetType || '?'}`;
          out += `\n            target_quote: "${e.targetQuote}"`;
        }
      }
    }
  }
  // User notes for this book — read-through context so the AI can
  // reference what the user has written. Rendered as a compact list
  // grouped by page. Included inside <book_metadata> so it travels
  // with the book through every scope that dumps book metadata
  // (book/collection/highlight), without having to be added at each
  // caller separately.
  const notesBlock = await renderBookNotes(book._id);
  if (notesBlock) out += notesBlock;

  out += `\n</book_metadata>`;
  return out;
}

/**
 * Render every Note for a book as a compact, read-optimized list.
 * Grouped by page, oldest-first per page. Each note shows the page
 * number, the highlighted passage it was attached to (if any), the
 * note title, and the note body with HTML tags stripped. The AI is
 * expected to reference these when the user asks "what did I note
 * about X" or when the user's notes would inform the answer.
 */
async function renderBookNotes(bookId) {
  if (!bookId) return '';
  const notes = await Note.find({ bookId })
    .select('pageNumber highlightId title content createdAt')
    .sort({ pageNumber: 1, createdAt: 1 })
    .lean();
  if (!notes.length) return '';

  // Pull highlight texts in one round-trip so we can show the passage
  // each note was attached to without N+1 queries.
  const hlIds = notes.map(n => n.highlightId).filter(Boolean);
  const hlMap = {};
  if (hlIds.length) {
    const hls = await Highlight.find({ _id: { $in: hlIds } }).select('text').lean();
    for (const h of hls) hlMap[String(h._id)] = h.text || '';
  }

  // Strip HTML from note content so the LLM sees plain text (notes
  // are stored as rich HTML from the reader's notes panel). Preserve
  // LaTeX delimiters since they're plain text, not tags.
  function stripHtml(s) {
    return String(s || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  let out = `\n\n  <user_notes count="${notes.length}">`;
  let lastPage = null;
  for (const n of notes) {
    if (n.pageNumber !== lastPage) {
      out += `\n    [Page ${n.pageNumber || '?'}]`;
      lastPage = n.pageNumber;
    }
    const quote = (n.highlightId && hlMap[String(n.highlightId)]) || '';
    const body = stripHtml(n.content).substring(0, 800);
    out += `\n    • Note`;
    if (n.title) out += ` "${n.title}"`;
    if (quote) {
      const q = quote.replace(/\s+/g, ' ').trim().substring(0, 180);
      out += `\n        on highlight: "${q}"`;
    }
    if (body) out += `\n        ${body.replace(/\n/g, '\n        ')}`;
  }
  out += `\n  </user_notes>`;
  return out;
}

/**
 * Dump every Note across every Book as a single block, grouped by
 * book and then by page. Used in library scope ("All Files" orphan
 * chats) so the AI has full read access to the user's notes when
 * the chat isn't anchored to anything narrower.
 */
async function getLibraryNotes() {
  const books = await Book.find({ status: { $ne: 'pending-citation' } }).select('_id title author').lean();
  if (!books.length) return null;
  const bookMap = {};
  books.forEach(b => { bookMap[String(b._id)] = b; });

  const notes = await Note.find()
    .select('bookId pageNumber highlightId title content createdAt')
    .sort({ bookId: 1, pageNumber: 1, createdAt: 1 })
    .lean();
  if (!notes.length) return null;

  // Resolve highlight texts in one round-trip.
  const hlIds = notes.map(n => n.highlightId).filter(Boolean);
  const hlMap = {};
  if (hlIds.length) {
    const hls = await Highlight.find({ _id: { $in: hlIds } }).select('text').lean();
    for (const h of hls) hlMap[String(h._id)] = h.text || '';
  }

  function stripHtml(s) {
    return String(s || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  let out = `<library_notes count="${notes.length}">`;
  let lastBook = null;
  let lastPage = null;
  for (const n of notes) {
    const bkey = String(n.bookId);
    if (bkey !== lastBook) {
      if (lastBook) out += `\n  </book>`; // close previous
      const bk = bookMap[bkey];
      out += `\n\n  <book id="${bkey}" title="${String(bk ? bk.title : 'Unknown').replace(/"/g, '&quot;')}">`;
      lastBook = bkey;
      lastPage = null;
    }
    if (n.pageNumber !== lastPage) {
      out += `\n    [Page ${n.pageNumber || '?'}]`;
      lastPage = n.pageNumber;
    }
    const quote = (n.highlightId && hlMap[String(n.highlightId)]) || '';
    const body = stripHtml(n.content).substring(0, 600);
    out += `\n    • Note`;
    if (n.title) out += ` "${n.title}"`;
    if (quote) {
      const q = quote.replace(/\s+/g, ' ').trim().substring(0, 160);
      out += `\n        on highlight: "${q}"`;
    }
    if (body) out += `\n        ${body.replace(/\n/g, '\n        ')}`;
  }
  // Close any hanging <book> tag.
  if (lastBook) out += `\n  </book>`;
  out += `\n</library_notes>`;
  return out;
}

async function getLibraryOverview() {
  const books = await Book.find({ status: { $ne: 'pending-citation' } }).select('title author pageCount keyConcepts').lean();
  if (books.length === 0) return null;
  const list = books.map(b => {
    let line = `- id=${b._id} "${b.title}"${b.author ? ' (' + b.author + ')' : ''}`;
    if (b.keyConcepts?.length) line += ` [${b.keyConcepts.slice(0, 3).join(', ')}]`;
    return line;
  }).join('\n');
  return `Library (${books.length} books) — use the id values in [[cite bookId="…"]] tags:\n${list}`;
}

/**
 * Render every cross-book Edge in the library as a flat, compact
 * block that lives at high priority in the chat context.
 *
 * Why this is its own section: per-book metadata is added at
 * priority 5 and can blow the context budget on a 4-book corpus,
 * causing whole books — and therefore their outgoing edges — to
 * silently drop. The user reported the AI saw only 3 edges (out
 * of 16) because the metadata for the other source books was
 * truncated. The fix is to lift the EDGE GRAPH out of the
 * per-book metadata blocks into its own dedicated, much smaller
 * section that's added at priority 2 and always survives the
 * budget cut.
 *
 * Each entry packs both source and target context (book titles,
 * pages, span text, target quote) so the AI doesn't need the
 * full per-book metadata to render a [[cite]] tag — it can lift
 * everything from this block alone.
 *
 * Filter: when scope is collection or book, restrict to edges
 * whose source OR target is in scope so we don't waste budget on
 * irrelevant edges. Library/All Files scope dumps all edges.
 */
async function getAllCrossBookEdges(opts = {}) {
  const filter = {};
  const edges = await Edge.find(filter)
    .select('fromChunkId fromSpanId toChunkId toBookId fromBookId relationshipType confidence relevance method')
    .lean();
  if (edges.length === 0) return null;

  // ── Method preference: LLM > lexical > others ─────────────
  //
  // The funnel resolver writes edges with method='llm'. The
  // legacy resolver writes method='lexical'. For source spans
  // where both methods produced an edge, prefer the LLM one
  // (higher precision, real relationship type, real confidence
  // and relevance scores). Lexical edges only survive when no
  // LLM edge exists for the same source span — that happens for
  // spans the funnel hasn't processed yet, or for cases where
  // GPT-4o couldn't produce a parseable verdict.
  //
  // Note-citation edges (notes ingestion) have their own method
  // and are kept independently.
  const bySourceSpan = new Map();
  for (const e of edges) {
    const k = String(e.fromSpanId || '') + ':' + String(e.toBookId || '');
    if (!k.startsWith(':') && k !== ':') {
      const existing = bySourceSpan.get(k);
      if (!existing) {
        bySourceSpan.set(k, e);
        continue;
      }
      // Method priority: llm > lexical > note-citation
      const priority = (m) => m === 'llm' ? 3 : m === 'lexical' ? 2 : m === 'note-citation' ? 1 : 0;
      if (priority(e.method) > priority(existing.method)) {
        bySourceSpan.set(k, e);
      }
    }
  }
  // Edges with no fromSpanId go through unfiltered (notes,
  // manual edges, etc.)
  const filteredEdges = [
    ...bySourceSpan.values(),
    ...edges.filter(e => !e.fromSpanId),
  ];

  // If scope is restricted, filter edges by whether either side
  // is in scope. opts.bookIds is the set of in-scope book ids.
  let inScope = filteredEdges;
  if (opts.bookIds && opts.bookIds.length > 0) {
    const setIds = new Set(opts.bookIds.map(String));
    inScope = filteredEdges.filter(e =>
      setIds.has(String(e.fromBookId)) || setIds.has(String(e.toBookId))
    );
  }
  if (inScope.length === 0) return null;

  // Batch-load every referenced span, chunk, and book in one round-trip
  const spanIds = [...new Set(inScope.map(e => e.fromSpanId).filter(id => id).map(String))];
  const chunkIds = [...new Set(inScope.flatMap(e => [String(e.fromChunkId), String(e.toChunkId)]).filter(Boolean))];
  const bookIds = [...new Set(inScope.flatMap(e => [String(e.fromBookId), String(e.toBookId)]).filter(Boolean))];

  const [spans, chunks, books] = await Promise.all([
    Span.find({ _id: { $in: spanIds } }).select('_id pageNumber spanText contextTags').lean(),
    Chunk.find({ _id: { $in: chunkIds } }).select('_id pageNumber sourceText structuralType contextTags chunkIndex').lean(),
    Book.find({ _id: { $in: bookIds } }).select('_id title author').lean(),
  ]);
  const spanMap = new Map(spans.map(s => [String(s._id), s]));
  const chunkMap = new Map(chunks.map(c => [String(c._id), c]));
  const bookMap = new Map(books.map(b => [String(b._id), b]));

  // Render compact, fixed format the AI can read line-by-line
  const lines = [];
  lines.push(`<cross_book_edges count="${inScope.length}">`);
  lines.push(`This block lists every verified cross-document edge in the user's library. Each edge connects a span in a source book to a chunk in another book. When the user asks about cross-references / citations / connections between books, render edges as [[cite bookId="…" page="…"]]quoted text[[/cite]] tags using the EXACT format described in the BASE_PROMPT. Prefer this block as your source of truth for which edges exist; do not invent edges that are not listed here.`);
  lines.push('');

  let i = 0;
  for (const e of inScope) {
    i++;
    const fromBook = bookMap.get(String(e.fromBookId));
    const toBook = bookMap.get(String(e.toBookId));
    const fromSpan = spanMap.get(String(e.fromSpanId));
    const fromChunk = chunkMap.get(String(e.fromChunkId));
    const toChunk = chunkMap.get(String(e.toChunkId));
    if (!fromBook || !toBook || !toChunk) continue;

    const fromTitle = (fromBook.title || '?').substring(0, 60);
    const toTitle = (toBook.title || '?').substring(0, 60);
    const fromPage = fromSpan?.pageNumber ?? fromChunk?.pageNumber ?? '?';
    const toPage = toChunk.pageNumber ?? '?';
    const fromText = (fromSpan?.spanText || fromChunk?.sourceText || '').replace(/\s+/g, ' ').trim().substring(0, 220);
    const toText = (toChunk.sourceText || '').replace(/\s+/g, ' ').trim().substring(0, 220);
    const fromTags = (fromSpan?.contextTags || []).slice(0, 4).join(',');
    const toTags = (toChunk.contextTags || []).slice(0, 4).join(',');

    lines.push(`edge #${i}: ${e.relationshipType || 'assumes'} (conf=${e.confidence || '?'}, method=${e.method || '?'})`);
    lines.push(`  from_book_id="${e.fromBookId}" from_book_title="${fromTitle}" from_page=${fromPage}${fromTags ? ' from_tags=[' + fromTags + ']' : ''}`);
    lines.push(`  source_text: "${fromText}"`);
    lines.push(`  to_book_id="${e.toBookId}" to_book_title="${toTitle}" to_page=${toPage} to_type=${toChunk.structuralType || '?'}${toTags ? ' to_tags=[' + toTags + ']' : ''}`);
    lines.push(`  target_quote: "${toText}"`);
    lines.push('');
  }
  lines.push(`</cross_book_edges>`);
  return lines.join('\n');
}

// ─── STREAM RESPONSE ─────────────────────────────────────────────

async function detectFakeCitations(text) {
  const books = await Book.find({})
    .select('_id title author').lean();
  const realIds = new Set(books.map(b => String(b._id)));
  const realAuthorLastNames = new Set(
    books.flatMap(b => {
      if (!b.author) return [];
      return b.author.split(/,|and|&/i)
        .map(a => a.trim().split(/\s+/).pop().toLowerCase())
        .filter(a => a.length > 2);
    })
  );

  const fakes = [];
  let m;

  // Tier A-1: [[cite bookId="FAKEID"]] structured tag
  const citeTagRx = /\[\[cite bookId="([^"]+)"/g;
  while ((m = citeTagRx.exec(text)) !== null) {
    if (!realIds.has(m[1]))
      fakes.push({ type: 'cite_tag', value: m[1] });
  }

  // Tier A-2: prose id= or id: <mongo hex>
  const proseIdRx = /\bid[=:]\s*([0-9a-f]{24})\b/gi;
  while ((m = proseIdRx.exec(text)) !== null) {
    if (!realIds.has(m[1]))
      fakes.push({ type: 'prose_id', value: m[1] });
  }

  // Tier A-3: AUTHOR's TITLE (possessive ref to unknown author)
  const possessiveRx = /([A-Z][a-z]{2,})'s\s+[A-Z]/g;
  while ((m = possessiveRx.exec(text)) !== null) {
    if (!realAuthorLastNames.has(m[1].toLowerCase()))
      fakes.push({ type: 'possessive_author', value: m[0] });
  }

  // Tier A-4: AUTHOR Ch. / AUTHOR § / AUTHOR Sec.
  const chapterRx = /([A-Z][a-z]{2,})\s+(?:Ch\.|Chapter|§|Sec\.)\s*[\dIVXivx]/g;
  while ((m = chapterRx.exec(text)) !== null) {
    if (!realAuthorLastNames.has(m[1].toLowerCase()))
      fakes.push({ type: 'author_chapter_ref', value: m[0] });
  }

  // Tier A-5: "TITLE" by AUTHOR — both unrecognized
  const titleByRx = /"([^"]{10,120})"\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/g;
  while ((m = titleByRx.exec(text)) !== null) {
    const authorLastName = m[2].trim().split(/\s+/).pop().toLowerCase();
    if (!realAuthorLastNames.has(authorLastName))
      fakes.push({ type: 'title_by_unknown_author', value: `"${m[1]}" by ${m[2]}` });
  }

  return { fakes, hasIssues: fakes.length > 0 };
}

// ─── Graph-tool preamble injected into system prompt when tools
// are active. Tells the model what the tools are for and how to
// use them without bloating the base context. Kept in code rather
// than a prompt file because the tool names/shapes are owned by
// graphToolService and they should stay in sync.
const TOOL_SYSTEM_PREAMBLE = `

GRAPH TRAVERSAL TOOLS ARE AVAILABLE.

You have access to five tools that let you navigate the research
library's verified edge graph directly: search_chunks, follow_edges,
read_chunk, get_path, and verify_quote.

Guidelines:
- For any non-trivial research question, PREFER to call tools
  rather than answer from the context dump. The tools return real
  chunk IDs from MongoDB — citations produced this way are
  structurally grounded and cannot be hallucinated.
- Seed with search_chunks (one natural-language query), then
  follow_edges from the best hits to expand the neighborhood,
  then read_chunk to confirm a node actually says what you think.
- Pass exclude_chunk_ids to follow_edges with the list of nodes
  you have already visited in this turn so you don't loop.
- Use get_path when the user asks "how does A relate to B" or
  "trace the chain from X to Y" — it returns the confidence-
  weighted shortest path, or found=false if no path exists
  (found=false is itself an answer: "your library does not yet
  connect these two ideas").
- Use verify_quote before attributing an exact phrase to a chunk.
- When you cite a chunk in your final reply, refer to it by its
  real chunk_id, book title, and page — all of which are returned
  by the tools.

The graph is the ground truth. Your job is to navigate it, not
to generate physics from training data.`;

/**
 * Stream a response from Claude.
 *
 * opts.generalKnowledge — bypass grounding and let the model use
 *   training data (no tools, no citation validation).
 * opts.useTools — enable Phase A graph-tool traversal. When true,
 *   the call runs as a tool-use state machine: stream → detect
 *   tool_use → execute via graphToolService → append result →
 *   re-stream, looping until the model emits end_turn. When false
 *   (default), behavior is identical to the pre-tool implementation
 *   so regular chat is unaffected. This is the toggle Jony asked
 *   for: tool-use is isolated from the main chat path so bugs in
 *   the state machine can't break plain chat.
 * opts.onToolCall — optional callback fired when the model starts
 *   executing a tool, signature (name, input) — used by the SSE
 *   handler to push UI indicators.
 * opts.onToolResult — optional callback fired after a tool returns,
 *   signature (name, result).
 */
async function streamResponse(chat, onChunk, onDone, opts = {}) {
  const generalKnowledgePrefix = opts.generalKnowledge
    ? `GENERAL KNOWLEDGE MODE: The user has explicitly requested an answer from your general training data. Answer freely, but begin your response with: "⚠️ General knowledge answer (not grounded in your library):" and do NOT use any [[cite]] tags.\n\n`
    : '';

  let system = generalKnowledgePrefix + await buildContext(chat);
  if (opts.useTools && !opts.generalKnowledge) {
    system += TOOL_SYSTEM_PREAMBLE;
  }

  const messages = chat.messages
    .slice(-pipeline.CHAT_MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content }));

  // ── Tool-use path ──────────────────────────────────────────
  // Isolated from the plain streaming path so a bug in the state
  // machine cannot break regular chat.
  if (opts.useTools && !opts.generalKnowledge) {
    try {
      const fullText = await streamWithTools({
        system,
        messages,
        onChunk,
        onToolCall: opts.onToolCall,
        onToolResult: opts.onToolResult,
      });
      // Tools ARE the grounding — skip detectFakeCitations when
      // tool calls were used. The chunk IDs returned from the
      // tools are structurally real, not model-generated strings.
      onDone(fullText);
      return;
    } catch (err) {
      console.error('[claudeService] tool-use stream failed, no fallback:', err.message);
      // Surface the error via onDone so the user sees it instead of
      // a silent hang. Do NOT fall back to plain streaming — that
      // would hide bugs. The gate in server.js controls whether
      // this path runs at all.
      onDone(`⚠️ Tool-use traversal failed: ${err.message}`);
      return;
    }
  }

  // ── Plain streaming path — unchanged from pre-Phase-A ──────
  let fullText = '';

  const stream = await client.messages.stream({
    model: pipeline.CHAT_MODEL || 'claude-sonnet-4-20250514',
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

  if (!opts.generalKnowledge) {
    const validation = await detectFakeCitations(fullText);
    if (validation.hasIssues) {
      console.log('[claudeService] Fake citations caught:',
        validation.fakes.map(f => f.value).join(', '));

      const fakeList = validation.fakes
        .map(f => `• ${f.value}`)
        .join('\n');

      const gatekeeperMsg =
`⚠️ **Gyde stopped this response.**

The model referenced material that could not be verified against your library:
${fakeList}

This usually means the topic isn't covered by the books currently in your library.

**Would you like a general-knowledge answer instead?**
*It won't be grounded in your specific books or notes, but may still be useful.*

[[GYDE_ASK_GENERAL_KNOWLEDGE]]`;

      onDone(gatekeeperMsg);
      return;
    }
  }

  onDone(fullText);
}

// ─── Tool-use state machine ────────────────────────────────────
// Loop:
//   1. client.messages.stream(...tools)
//   2. stream events: text_delta → onChunk; tool_use blocks
//      accumulate via finalMessage()
//   3. if stop_reason === 'tool_use':
//        for each tool_use block: execute via graphToolService
//        append assistant message with full content (text + tool_use)
//        append user message with tool_result blocks
//        loop again
//   4. if stop_reason === 'end_turn': break, return accumulated text
//
// Safety caps: AGENT_MAX_TOOL_CALLS iterations, AGENT_MAX_TURNS
// total API round-trips. Both fail-closed — a runaway loop exits
// with the accumulated text rather than looping forever.
async function streamWithTools({ system, messages, onChunk, onToolCall, onToolResult }) {
  const graphToolService = require('./graphToolService');
  const maxTurns = pipeline.AGENT_MAX_TURNS || 12;
  const maxToolCalls = pipeline.AGENT_MAX_TOOL_CALLS || 20;

  // Per-invocation session object — holds the query-embedding
  // cache and (Phase B) visited-node state. Lives and dies with
  // this call.
  const session = {};

  // Working message history. We mutate this across iterations by
  // appending the assistant's full response and the user's
  // tool_result follow-ups.
  const workingMessages = messages.map(m => ({ role: m.role, content: m.content }));

  let turn = 0;
  let totalToolCalls = 0;
  let accumulatedText = '';

  while (turn < maxTurns) {
    turn++;
    let turnText = '';

    const stream = await client.messages.stream({
      model: pipeline.CHAT_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      messages: workingMessages,
      tools: graphToolService.TOOL_DEFINITIONS,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
        turnText += event.delta.text;
        onChunk(event.delta.text);
      }
    }

    const finalMessage = await stream.finalMessage();
    accumulatedText += turnText;

    if (finalMessage.stop_reason !== 'tool_use') {
      // end_turn / max_tokens / stop_sequence — done.
      return accumulatedText;
    }

    // Extract tool_use blocks from the assistant's response and
    // append the whole content array (text + tool_use) as the
    // assistant message. Anthropic requires the assistant turn to
    // be echoed back verbatim before the tool_result messages.
    const assistantContent = finalMessage.content;
    workingMessages.push({ role: 'assistant', content: assistantContent });

    const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const block of toolUseBlocks) {
      if (totalToolCalls >= maxToolCalls) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ error: 'tool-call budget exhausted' }),
          is_error: true,
        });
        continue;
      }
      totalToolCalls++;

      try { onToolCall && onToolCall(block.name, block.input); } catch (_) {}

      const result = await graphToolService.executeTool(block.name, block.input, session);

      try { onToolResult && onToolResult(block.name, result); } catch (_) {}

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: !!result?.error,
      });
    }

    workingMessages.push({ role: 'user', content: toolResults });
    // Loop — the next iteration will stream the model's follow-up
    // response, which may be either a final text turn or another
    // round of tool calls.
  }

  // Hit maxTurns without a natural stop. Return whatever text
  // accumulated and log — this is the fail-closed exit.
  console.warn(`[claudeService] streamWithTools hit maxTurns=${maxTurns}, tool_calls=${totalToolCalls}`);
  return accumulatedText || '⚠️ Traversal hit the turn limit without reaching a final answer.';
}

module.exports = { streamResponse, buildContext, determineScope, detectFakeCitations };
