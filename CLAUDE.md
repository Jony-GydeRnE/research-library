# CLAUDE.md — Gyde Research Library, Phase 1

## Session start instructions (read first, every new session)

This file is automatically loaded at the start of every Claude Code session. Treat the rules below as standing orders — apply them without being asked.

**GitHub workflow — auto-commit and push after every edit**
- Remote: https://github.com/Jony-GydeRnE/research-library
- Branch: `main` (tracks `origin/main`)
- After any code change in this project, automatically:
  1. Stage the changed files
  2. Create a commit with a **detailed message** describing what changed and why — use the same level of detail you'd put in a chat summary, not a one-liner. Match the style of existing commits (e.g. `Swap chat split layout, collapse inner sidebar, fuzzier highlight matcher`).
  3. Push to `origin/main`
- The commit history is meant to serve as the running log of changes, so the detail that would otherwise live only in chat belongs in the commit message.
- Do NOT wait for the user to say "commit this" — do it as part of finishing the edit.
- Still follow git safety: never force-push, never skip hooks, create new commits rather than amending.
- Only skip the auto-push if the user explicitly says "don't push" or "wait to commit".

**Tone**
- Be concise in chat. Lead with what you did or what you need. The detailed explanation goes in the commit message, not a long chat recap.

---

## What we are building

A personal research library. Single user. Upload academic books and papers (PDF), read them in a beautiful HTML-based reader, and lay the data foundation for everything that comes next (highlights, notes, AI, edge graph).

Phase 1 deliverable: upload a book → it processes in the background → appears in the library → open it and read it in a clean HTML reader. That is the only thing Phase 1 must do. It must look good and feel like a real product.

---

## Tech stack

- Node.js + Express + EJS (server-rendered, no frontend framework)
- MongoDB (Atlas cloud — free tier to start)
- AWS S3 (PDF storage)
- agenda.js (background job queue)
- pdf-parse or pdfjs-dist (PDF text extraction)
- MathJax (equation rendering in reader)
- No React, no Vue, no Tailwind

---

## Folder structure

```
jony-library/
  server.js
  package.json
  .env
  .gitignore
  config/
    database.js
    s3.js
    pipeline.js        ← ALL tunable parameters live here, nowhere else
  prompts/
    metadata.txt       ← LLM prompt templates as plain text files, loaded at runtime
  models/
    Book.js
    Page.js
    Chunk.js
    Span.js
    Edge.js
    QualityScore.js
    Job.js
    ErrorLog.js
  services/
    pdfService.js      ← extract text + structure from PDF
    htmlService.js     ← convert extracted text to structured HTML per page
    openaiService.js   ← metadata generation only in Phase 1
    s3Service.js
    jobService.js
  controllers/
    uploadController.js
    libraryController.js
    readerController.js
  routes/
    upload.js
    library.js
    reader.js
  views/
    upload.ejs
    library.ejs
    reader.ejs
    partials/
      header.ejs
      nav.ejs
  public/
    css/
      main.css
      reader.css
    js/
      upload.js
      reader.js
```

---

## All schemas — define ALL of these in Phase 1 even if mostly empty

### Book.js
```js
{
  title: String,
  author: String,
  isbn: String,           // for deduplication
  fileHash: String,       // SHA-256 of PDF, for deduplication
  s3Key: String,          // original PDF location
  coverUrl: String,
  pageCount: Number,
  status: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'error'],
    default: 'uploading'
  },
  processingProgress: { type: Number, default: 0 },  // 0-100
  uploadedAt: { type: Date, default: Date.now },
  readyAt: Date,
  collections: [String],
  tags: [String]
}
```

### Page.js
```js
{
  bookId: { type: ObjectId, ref: 'Book' },
  pageNumber: Number,
  rawText: String,         // extracted text, never modified
  htmlContent: String,     // converted HTML for reader display
  chapterTitle: String,
  sectionTitle: String,
  hasEquations: Boolean,
  hasImages: Boolean,
  imageS3Keys: [String]
}
```

### Chunk.js  ← Phase 2+ populates this, but define now
```js
{
  bookId: { type: ObjectId, ref: 'Book' },
  pageId: { type: ObjectId, ref: 'Page' },
  pageNumber: Number,
  rawText: String,
  summary: String,
  chunkType: {
    type: String,
    enum: ['definition','theorem','proof','derivation','example',
           'assumption','remark','equation','exposition','unknown']
  },
  subjectTags: [String],
  conceptTags: [String],
  hasMissingProof: Boolean,   // flagged by "it is obvious", "clearly", etc.
  operatorSignature: String,  // for equation matching
  embedding: [Number],
  qualityScore: Number,       // 0-9, from judge model
  createdAt: { type: Date, default: Date.now }
}
```

### Span.js  ← Phase 2+ populates this, but define now
```js
{
  chunkId: { type: ObjectId, ref: 'Chunk' },
  bookId: { type: ObjectId, ref: 'Book' },
  pageNumber: Number,
  spanText: String,
  tags: [String],             // from @@ tagging system
  startOffset: Number,        // character offset within chunk
  endOffset: Number,
  embedding: [Number],
  createdAt: { type: Date, default: Date.now }
}
```

### Edge.js  ← Phase 2+ populates this, but define now
```js
{
  fromChunkId: { type: ObjectId, ref: 'Chunk' },
  fromSpanId: { type: ObjectId, ref: 'Span' },
  toChunkId: { type: ObjectId, ref: 'Chunk' },
  toSpanId: { type: ObjectId, ref: 'Span' },
  fromBookId: { type: ObjectId, ref: 'Book' },
  toBookId: { type: ObjectId, ref: 'Book' },
  relationshipType: {
    type: String,
    enum: ['proves','assumes','contradicts','extends',
           'prerequisite','equivalent','uses_definition','missing_proof']
  },
  confidence: Number,   // 0-9
  relevance: Number,    // 0-9
  method: {
    type: String,
    enum: ['lexical','embedding','llm','manual']
  },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}
```

### QualityScore.js  ← Phase 2+ populates this, but define now
```js
{
  chunkId: { type: ObjectId, ref: 'Chunk' },
  bookId: { type: ObjectId, ref: 'Book' },
  score: Number,          // 0-9
  judgeModel: String,
  sampledAt: { type: Date, default: Date.now },
  flaggedForReinjection: Boolean
}
```

### Job.js
```js
{
  bookId: { type: ObjectId, ref: 'Book' },
  type: {
    type: String,
    enum: ['extract-pdf','generate-html','generate-metadata',
           'resolve-edges-local','resolve-edges-cross']
  },
  status: {
    type: String,
    enum: ['pending','running','done','failed'],
    default: 'pending'
  },
  progress: { type: Number, default: 0 },
  error: String,
  startedAt: Date,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now }
}
```

### ErrorLog.js
```js
{
  bookId: { type: ObjectId, ref: 'Book' },
  jobType: String,
  message: String,
  stack: String,
  createdAt: { type: Date, default: Date.now }
}
```

---

## config/pipeline.js — ALL tunable values live here

```js
module.exports = {
  chunkTargetTokens: 400,
  chunkOverlapTokens: 50,
  qualityJudgeSampleRate: 0.1,    // judge 10% of chunks
  qualityThreshold: 6,             // below this → re-inject vision prompt
  missingProofPhrases: [
    'it is obvious', 'clearly', 'it can be shown',
    'it follows easily', 'one can verify', 'trivially'
  ],
  crossBookEdgeCandidateTopK: 20,
  crossBookEdgeLLMTopK: 5,
  metadataModel: 'gpt-4.1-nano',
  judgeModel: 'claude-opus-4-6',
  embeddingModel: 'text-embedding-3-small',
  maxPagesPerJob: 50
}
```

---

## Phase 1 build order — do this exactly in sequence

### Step 1 — Project skeleton
- package.json with all dependencies
- .env with all required keys (see below)
- server.js skeleton with all routes registered
- config/database.js + config/s3.js + config/pipeline.js
- All 8 model files (even the empty-for-now ones)

Do not move to Step 2 until all models are defined and MongoDB connects successfully.

### Step 2 — Upload + extraction pipeline
- s3Service.js — upload original PDF
- pdfService.js — extract raw text page by page using pdf-parse
- htmlService.js — convert each page's raw text to structured HTML:
  - Wrap paragraphs in `

` tags
  - Detect and wrap equations in `` or `

`
  - Detect chapter/section headings by formatting heuristics
  - Preserve image placeholders as `
`
- jobService.js — agenda.js queue with two job types: extract-pdf, generate-html
- uploadController.js — receive PDF, store to S3, create Book document, enqueue jobs
- views/upload.ejs — drag-and-drop upload form with progress indicator

Do not move to Step 3 until a real PDF uploads, extracts, and HTML is stored in MongoDB.

### Step 3 — Library + reader
- libraryController.js — list all books, filter by status/collection
- views/library.ejs — book grid with cover images, title, author, processing status bar
- readerController.js — serve pages by number, chapter nav
- views/reader.ejs — the HTML reader:
  - Left sidebar: chapter/section navigation
  - Main pane: page HTML content rendered directly
  - MathJax loaded for equation rendering
  - Left/right page navigation
  - Reading progress saved to localStorage
  - Clean typography — readable, feels like a real book

Phase 1 is complete when: upload a PDF → wait → open it → read it beautifully.

---

## Reader design principles

The reader is the most important UI in Phase 1. It must feel genuinely good.

- Clean serif typography for body text (Georgia or similar)
- Comfortable line length (65-75 characters)
- Equations render inline via MathJax, not as images
- Chapter navigation in a collapsible left sidebar
- No clutter — the text is the product
- Dark mode toggle
- Page number visible at all times
- "Continue reading" bookmark saved automatically

---

## Environment variables required

```
NODE_ENV=development
PORT=3000
MONGODB_URI=             # MongoDB Atlas connection string
JWT_SECRET=              # strong random string
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_BUCKET_NAME=
ANTHROPIC_API_KEY=       # for Phase 2+
OPENAI_API_KEY=          # for metadata generation
SITE_URL=http://localhost:3000
SITE_NAME=Gyde Research Library
```

---

## Hard rules — never break these

1. All tunable parameters live in config/pipeline.js. Never hardcode a number or model name anywhere else.
2. All prompt templates live in prompts/ as .txt files. Load them at runtime with fs.readFileSync. Never embed prompt text in code.
3. rawText on Page documents is never modified after extraction. It is the permanent source of truth.
4. The reader displays htmlContent, never rawText directly.
5. Define all 8 model files in Step 1. No schema migrations later.
6. Every background job writes its status to the Job collection. No silent failures.
7. ISBN + fileHash deduplication: check both before creating a new Book document.

---

## What Phase 1 does NOT include

Do not build any of the following in Phase 1:
- Highlight detection or storage
- Notes or annotation system
- AI chat or Claude integration
- Edge classification or relationship graph
- Cross-book matching pipeline
- Vector embeddings or semantic search
- User authentication or multi-user support

These come in later phases. The schemas for them are defined now so they never need migration. The features are not built yet.

---

## When Phase 1 is done

The founder can upload Hartshorne, open it, and read it. Equations render. Chapters are navigable. It feels like a product worth using every day. That is the success condition for Phase 1.

---

# Phase 2 — Full App UI Spec

## DATABASE — Models (Projects merged into Collections)

### Chat.js
```
title, messages: [{ role, content, timestamp }], collectionId (ref Collection), bookId (optional), pageNumber (optional), highlightText (optional), createdAt, updatedAt
```

### Collection.js (absorbs Project fields)
```
title, description, instructions (AI context), bookIds: [ref Book], chatIds: [ref Chat], color, createdAt, updatedAt
```

### Highlight.js
```
bookId (ref Book), pageNumber, startOffset: Number, endOffset: Number, text: String, noteId (optional ref Note), chatId (optional ref Chat), color (default yellow), createdAt
```

### Note.js
```
bookId (optional ref Book), pageNumber (optional), highlightId (optional ref Highlight), collectionId (optional ref Collection), title, content (rich text/LaTeX), createdAt, updatedAt
```

---

## SIDEBAR — Persistent Left Panel (All Pages)

Top section — two nav items with icons:
- **Chats** — orphan chats not in any collection
- **Collections** — nested list with chats under each collection, collapsible

Below the nav, show collections list with nested chats under each.
In Reader: show current book's notes and highlights.

At bottom of sidebar: user name "Jonathan Valenzuela" with settings gear icon.

Sidebar should be collapsible (hamburger menu toggle).

---

## PAGES

### 1. Chats Page (`/chats`)
- List of all chats, most recent first
- Each shows: title, first line preview, timestamp, collection badge if linked
- Click opens full chat view
- "New Chat" button top right

### 2. Chat View (`/chat/:chatId`)
- Full screen chat interface
- Messages displayed with user/assistant styling
- Input field at bottom with send button
- AI uses Claude via claudeService — send current chat history as context
- If chat is linked to a collection, AI also receives collection instructions and book metadata
- If chat was started from a reader highlight, show the source quote at the top

### 3. Collections Page (`/collections`)
- Grid of collections in sidebar, main area shows selected collection's books
- Book covers in a grid with title, author, progress % below each
- Click a book opens it in reader
- "New Collection" button, "Add Book" button within each collection

### 4. Collection Detail (`/collection/:collectionId`)
- Book grid view (covers, titles, progress)
- Default landing page — first collection shown on app load

### 5. Reader (`/reader/:bookId`)

**Current features (built):**
- GPT-4o vision pipeline: every page rendered to PNG then sent through vision for HTML+LaTeX
- MathJax 3 renders equations inline and display
- View Original toggle: swap between HTML+MathJax and full-page PNG
- Pages/Scroll mode toggle: single page or continuous scroll of all pages
- Sidebar swap: hamburger cycles between app sidebar (Chats/Collections), TOC sidebar, and none
- Dark mode toggle
- Keyboard navigation (left/right arrows)
- Page jump input
- Bookmark saved to localStorage

**Future (not yet built):**
- Highlighting: select text → popup → save Highlight record
- Note Panel: slide-from-right editor
- Split Screen: reader left 50%, chat/notes right 50%

---

## PERSISTENT INPUT FIELD

Fixed at bottom of every page including reader. Context-aware:
- Chats page → new chat
- Collection page → new chat in collection (inherits instructions)
- Reader → new chat anchored to book + page (bookId, pageNumber passed as context)
- Other → general new chat

---

## ROUTES

```
GET  /                    → redirect to /collections
GET  /chats               → chats list
GET  /chat/:chatId        → chat view
POST /api/chat            → create new chat
POST /api/chat/:id/message → send message + stream Claude response (SSE)
POST /api/chat/:id/respond → stream Claude response for existing messages (SSE)
GET  /collections         → collections page
GET  /collection/:id      → collection detail
POST /api/collections     → create collection
PUT  /api/collections/:id → update collection
POST /api/highlights      → save highlight
GET  /api/highlights/:bookId/:pageNum → get highlights
POST /api/notes           → save note
GET  /api/notes/:bookId   → get notes for book
```

---

## AI CHAT — claudeService.js

Built in `services/claudeService.js`. Uses `@anthropic-ai/sdk` with `claude-sonnet-4-20250514`.

Context builder sends:
- System prompt (research assistant persona)
- Collection instructions (if chat belongs to a collection)
- Current page rawText + book title/author (if chat anchored to reader)
- Highlighted text (if from selection)
- Full chat message history
- Library book list (titles, authors)

Streaming via Anthropic SDK's `.stream()` method, piped as SSE events to the client.
Chat view: real-time streaming display with "Thinking..." → live chunks → final render.
Auto-triggers AI response when navigating to a newly created chat from the input bar.

---

## PROCESSING SPEED

Current: pages processed in parallel batches of 20 via Promise.all.
Rate limit retry: 429 errors → 2s delay → retry.
A 56-page book: ~3 batches = under 1 minute.
A 1000-page book: ~50 batches = 5-8 minutes.

Future optimization (not built yet): pre-render ALL page PNGs in parallel via Swift
(no API call, instant), then send ALL vision requests through a rate limiter queue
at 60 RPM. 1000 pages in ~15-20 minutes.

## BUILD STATUS

Done:
1. Models: Chat, Collection (merged with Project), Highlight (chatIds array), Note
2. Collections page + collection detail (default landing)
3. Sidebar: Chats/Collections nav, tabs in reader (Contents/Collections)
4. Persistent input bar on all pages including reader
5. Chats page + Chat view with streaming Claude responses + MathJax
6. claudeService.js with Anthropic SDK, context builder, streaming SSE
7. Highlighting: text selection popup, right-click override, equation click,
   cross-equation selection, temporary highlights, persist on action
8. Notes panel: slide-from-right, contenteditable, LaTeX buttons, live MathJax, save
9. Split screen: chat panel + notes panel with draggable dividers
10. Highlight → chat linking: chatIds array, dropdown for multiple chats
11. Parallel batch processing (20 pages at a time) with rate limit retry

Remaining:
- Drag to reorder books in collections
- Stylus/canvas notes (future)
- Vector embeddings and semantic search (Phase 3)

---

## KNOWN BUGS

- Highlights persist visually even when user dismisses popup without choosing an action (should clear on dismiss — partial fix: hidePopup clears selection but DOM marks from previous saves remain)
- Right-click in reader may show browser context menu in some browsers despite preventDefault (needs testing across browsers)
- Highlight across MathJax equations can break paragraph layout when surroundContents fails on cross-element ranges
- Multiple overlapping highlights on the same text range are not handled (later highlights may nest inside earlier ones)
- No way to delete highlights, notes, or chats from the UI (API endpoints exist but no UI buttons)
- Figure images not isolated from page (using fallback "View figure in original page" link for most figures)
- Upload progress indicator does not live-update in the library/collection view (shows static progress, needs polling)
- Notes panel live MathJax preview div is hidden (display:none) — needs toggle or always-visible approach
- Existing highlights may fail to re-render after MathJax typesets (offsets shift when MathJax replaces DOM nodes)

---

## FUTURE PHASES

### Phase 2 (current — in progress): Ingestion Pipeline & Metadata Intelligence
Steps 1-3 DONE: vision processing, regex pre-annotation, surface metadata extraction.
Steps 4-7 REMAINING:
- Step 4: @@ Span Generation (core intelligence — LLM-generated span annotations in DSL)
- Step 5: Chunking & chunk linking (group spans into chunks, link prev/next)
- Step 6: Quality monitoring (judge model, session management, re-injection)
- Step 7: Embeddings & search (vector embeddings for chunks/spans, semantic search)

### Phase 3: Edge Graph & Cross-Reference Resolution
- N/L/I/S/B triage of span search classes
- candidateService: find candidate matches (lexical, embedding, cross-book)
- classificationService: LLM edge classification (Y/N + relevance + confidence)
- Typed edges between chunks across books (proves, assumes, contradicts, extends, etc.)

### Phase 4: AI Research Partner Enhancements
- Graph display mode in reader (visualize edges from current passage)
- contextBuilder with edge traversal (follow prerequisite chains)
- Cached responses for repeated queries
- Feedback loop: user corrections improve future edge classification

### Phase 5: Note Ingestion & Crawler
- Import external notes, annotations, bookmarks
- Web crawler for referenced papers (follow citations)
- Auto-download and process cited papers

### Phase 6+: Multi-Format Files & Advanced Features
The library accepts ANY file type, not just PDFs. Each format gets its own
extraction pipeline but feeds into the same metadata/chunk/span/edge system.

**Supported formats (future):**
- PDF (current) → vision processing → pages → chunks
- CSV/Excel/Numbers → parse rows/columns → each sheet or table = one "page" equivalent → chunks are row groups or named ranges
- Markdown/Text → split by headers → chunks are sections
- Images (PNG/JPG) → GPT-4o vision → extracted text/data becomes chunks
- Code files → AST parsing or section splitting → chunks are functions/classes
- LaTeX source (.tex) → parse directly (better than PDF extraction)
- Presentations (PPTX/Keynote) → each slide = one page → vision extraction

**Key principle:** the Chunk is the universal unit. Every format produces Chunks
with contextTags, embeddings, and sourceText. The edge system doesn't care
whether a chunk came from a PDF page, an Excel row, or a Markdown section.

**AI-generated artifacts:**
- The AI can CREATE new files: tables, spreadsheets, presentations
- It can make a copy of any uploaded Excel/Numbers file, edit it, and return a new version
- Tables can reference data from other tables or documents in the collection
- Presentations can pull from all data types (text, equations, experimental data, figures)
- The AI reasons across formats: finding patterns in experimental CSV data, citing
  theorems from PDFs, generating LaTeX equations, building summary tables

**UI adaptation:** the reader adapts to file type. PDFs get the current page reader.
Excel gets a spreadsheet viewer. Markdown gets rendered HTML. Images get a gallery.
But the chat, highlights, notes, and edge graph work identically across all formats.

**Data reasoning:** the AI should be able to reason with patterns in experimental data,
generate visualizations, cross-reference numerical results with theoretical predictions
from papers, and produce publication-ready output combining all sources.