Gyde-research-libarary-specs.md


GYDE MVP
Developer Specification
Phase 1: Library, Reader, Highlights & Notes (1A / 1B / 1C)


Jonathan Valenzuela  •  April 2026  •  CONFIDENTIAL

1. What You Are Building
A personal AI-powered research library for one user—a physicist working through advanced STEM textbooks. Phase 1 delivers the reading and annotation shell: upload a PDF, read it page by page, highlight passages, and create rich notes attached to those highlights.
Phase 1 has zero AI. No LLM calls, no embeddings, no metadata extraction. Those come in Phase 2. Phase 1 is pure infrastructure: file storage, rendering, user interaction, and data persistence. Everything in Phase 1 must work perfectly before any intelligence layer is added.
⚠ This is a single-user app. No authentication system, no user accounts. One user, one library. A setup wizard captures the user’s name, profession, and institution on first launch, then never appears again.
1.1 The User Experience in One Sentence
I upload a PDF, it appears in my library, I open it, I read it page by page, I highlight text, and I write notes (text, LaTeX, or stylus drawings) attached to those highlights.
1.2 Tech Stack
Runtime: Node.js + Express
Templating: EJS (server-rendered, no frontend framework)
Database: MongoDB (Mongoose ODM)
File Storage: AWS S3
Background Jobs: agenda.js (MongoDB-backed queue)
Deployment: Heroku
PDF Extraction: pdf-parse (text extraction from uploaded PDFs)
LaTeX Rendering: MathJax (client-side, in browser)
⚠ No frontend framework. EJS templates, vanilla JS, CSS. Keep it simple. This app will get complex later—don’t add framework overhead now.

2. Data Model
Six MongoDB collections for Phase 1. Every field listed below is the complete spec—do not add fields, do not skip fields.
2.1 Config
Single document. Created by setup wizard. Checked on every app launch.
Field
Type
Description
firstName
String
From setup wizard
lastName
String
From setup wizard
profession
String
From setup wizard
institution
String
From setup wizard
isConfigured
Boolean
True after wizard completes. App checks this on launch.
createdAt
Date
Timestamp

2.2 Book
One document per uploaded PDF. Metadata fields are initially empty strings or null—they will be populated by AI in Phase 2. Include them now so the schema doesn’t change later.
Field
Type
Description
fileUrl
String
AWS S3 public URL to original PDF
s3Key
String
S3 object key (for deletion)
fileType
String
"pdf" or "txt"
fileSize
Number
File size in bytes
totalPages
Number
Page count after pdf-parse extraction
title
String
User-provided at upload (AI fills automatically in Phase 2)
subtitle
String
Optional. Null if not provided.
authors
[String]
User-provided or empty array
publisher
String
Optional
publishYear
Number
Optional
edition
String
Optional
isbn
String
Optional. Used for deduplication in Phase 2.
coverImageUrl
String
User-uploaded cover image S3 URL, or null
primaryCategory
String
Empty string. Phase 2 populates.
subCategories
[String]
Empty array. Phase 2 populates.
tags
[String]
Empty array. Phase 2: 100+ tags per book.
keyConcepts
[String]
Empty array. Phase 2: 50+ concepts.
keyTopics
[String]
Empty array. Phase 2 populates.
theorems
[String]
Empty array. Phase 2 populates.
equations
[String]
Empty array. Phase 2: LaTeX strings.
relatedSubjects
[String]
Empty array. Phase 2 populates.
academicLevel
String
Empty. Phase 2: Undergrad/Graduate/Research/Unknown.
documentType
String
Empty. Phase 2: Textbook/Paper/Notes/Manual/Other.
summary
String
Empty. Phase 2: 3–5 paragraph AI overview.
chapterSummaries
[Object]
Empty. Phase 2: {chapterNumber, title, summary, topics[], concepts[], pageStart, pageEnd}
relatedBooks
[ObjectId]
Empty array. Phase 3: references to other Books.
processingStatus
String
"pending" | "extracting" | "complete" | "error". Phase 1 uses: pending → extracting → complete.
processingError
String
Error message if extraction failed. Null otherwise.
hasEquations
Boolean
False. Phase 2 sets true if equations found.
sourceType
String
"upload" (Phase 1 only). Later: "crawl".
sourceUrl
String
Null for uploads. Used by crawler in Phase 5.
uploadedAt
Date
Upload timestamp
updatedAt
Date
Last updated

⚠ Include ALL metadata fields now even though Phase 1 leaves them empty. This prevents schema migrations when Phase 2 activates AI metadata extraction. The developer should not be surprised by new fields appearing later.
2.3 Page
One document per page of a book. Created during PDF extraction.
Field
Type
Description
bookId
ObjectId
Reference to parent Book. Required. Indexed.
pageNumber
Number
1-indexed page number. Required. Compound index with bookId.
rawText
String
Full extracted text for this page from pdf-parse.
wordCount
Number
Word count of rawText.
chapterNumber
Number
Null in Phase 1. Phase 2 detects chapter boundaries.
chapterTitle
String
Null in Phase 1. Phase 2 extracts.
sectionTitle
String
Null in Phase 1. Phase 2 extracts.
topics
[String]
Empty array. Phase 2 populates.
concepts
[String]
Empty array. Phase 2 populates.
equations
[String]
Empty array. Phase 2 populates.
hasEquations
Boolean
False. Phase 2 sets.
embedding
[Number]
Empty array. Phase 2: vector embedding for semantic search.

2.4 Highlight
One document per highlighted text selection. A highlight is the junction point—the anchor that connects a passage to notes and (later) to AI chats and system-generated citations.
Field
Type
Description
bookId
ObjectId
Reference to Book. Required.
pageNumber
Number
Page where highlight lives. Required.
selectedText
String
Exact text the user highlighted.
startOffset
Number
Character offset start within the page’s rawText.
endOffset
Number
Character offset end within rawText.
noteIds
[ObjectId]
Array of Note references. Multiple notes CAN attach to one highlight.
color
String
Default: "yellow". User can change.
sourceType
String
"manual" (Phase 1 only). Later: "auto-matched".
createdAt
Date
Timestamp

⚠ noteIds is an ARRAY, not a single ObjectId. This is critical. Multiple notes and note chunks can attach to one highlight. Do not make it a single reference. This is a many-to-many architecture.
2.5 Note
Rich text notes attached to highlights, to specific pages, or standalone.
Field
Type
Description
bookId
ObjectId
Reference to Book. Null if standalone note.
pageNumber
Number
Page number. Null if standalone.
highlightId
ObjectId
Reference to Highlight if created from selection. Null if standalone or page-level.
highlightedText
String
Exact text that was highlighted when note was created. Null if standalone.
chapterTitle
String
Chapter context. Null in Phase 1.
sectionTitle
String
Section context. Null in Phase 1.
title
String
Note title—auto-generated from first line or user-set.
content
String
Full rich text content. No length limit.
latexBlocks
[Object]
Array: { raw: String (LaTeX source), renderedUrl: String (null in Phase 1), position: Number }
conversationLog
[Object]
Empty array. Phase 4: { role, content, timestamp } from AI chats.
tags
[String]
User-applied tags. Searchable.
topics
[String]
Empty. Phase 2 populates.
concepts
[String]
Empty. Phase 2 populates.
equations
[String]
LaTeX equations in this note.
relatedBooks
[ObjectId]
Empty. Phase 3 populates.
relatedNotes
[ObjectId]
Empty. Phase 3 populates.
isStandalone
Boolean
True if not attached to any book or page.
aiGenerated
Boolean
False in Phase 1. Phase 4: true if content came from AI.
wordCount
Number
Auto-calculated on save.
hasLatex
Boolean
True if LaTeX content present.
embedding
[Number]
Empty. Phase 2: vector embedding.
sourceType
String
"manual" (Phase 1). Later: "ingestion", "ai-generated".
createdAt
Date
Created timestamp
updatedAt
Date
Last updated timestamp

2.6 Job
Background job tracking. Managed by agenda.js with MongoDB as queue.
Field
Type
Description
name
String
Job type: "process-book" in Phase 1. Later: "crawl-url", "ingest-notes".
data.bookId
ObjectId
Book being processed.
data.s3Key
String
S3 key of file.
nextRunAt
Date
Managed by agenda.js.
lastFinishedAt
Date
When job last completed.
failedAt
Date
Null unless failed.
failReason
String
Error message if failed.
lockedAt
Date
Agenda.js lock for concurrency.

2.7 ErrorLog
Server error logging. Every caught error writes here.
Field
Type
Description
message
String
Error message
stack
String
Stack trace
route
String
Which route triggered it
method
String
HTTP method
statusCode
Number
Response status code
createdAt
Date
Timestamp


3. File & Folder Structure
Every file that needs to exist for Phase 1. Nothing more, nothing less.
gyde-mvp/
  server.js                    Main Express server
  package.json                 Dependencies and scripts
  .env                         Environment variables
  .gitignore                   node_modules, .env, logs/
  config/
    database.js                Mongoose connection
    s3.js                      AWS S3 client + multer-s3 config
  models/
    Config.js                  Setup wizard data
    Book.js                    Book metadata
    Page.js                    Per-page content
    Highlight.js               Text selections
    Note.js                    Rich notes
    Job.js                     Background job queue
    ErrorLog.js                Server error logging
  services/
    pdfService.js              pdf-parse extraction, page splitting
    s3Service.js               S3 upload/download/delete
    jobService.js              agenda.js job definitions
    notificationService.js     In-app notifications (bell icon)
  controllers/
    setupController.js         Setup wizard
    uploadController.js        File upload + job queuing
    libraryController.js       Library grid, book listing, delete
    readerController.js        Book reader, page retrieval
    highlightController.js     Save/retrieve highlights per page
    notesController.js         Full CRUD for notes
    notificationController.js  Notification retrieval
  routes/
    setup.js                   POST /api/setup
    upload.js                  POST /api/upload
    library.js                 GET /api/library, DELETE /api/library/:id
    reader.js                  GET /api/reader/:bookId/page/:pageNum
    highlights.js              Full CRUD /api/highlights
    notes.js                   Full CRUD /api/notes
    notifications.js           GET /api/notifications
  views/
    setup.ejs                  First-launch wizard
    library.ejs               Book grid with covers
    upload.ejs                Drag-and-drop upload
    reader.ejs                Page reader with highlights
    notes.ejs                 Standalone notes page
    error.ejs                 Error page
    partials/
      highlight-popup.ejs     Selection popup (3 buttons)
      note-panel.ejs          Sliding note editor panel
      notification-bell.ejs   Bell icon + dropdown
  public/
    css/                       All stylesheets
    js/                        All client-side JS
    images/                    Favicon, logo

4. Build Order
Build in this exact sequence. Each step depends on the previous step working. Do not skip ahead. Phase 1 is split into three sub-phases so the founder can start using the system as early as possible.
PHASE 1A — Core Reading Loop
Goal: “I can upload a book and read it.” This is the minimum viable product within the MVP. Deliver 1A first, get confirmation it works, then proceed to 1B.
Step 1: Project Skeleton + Setup Wizard
Initialize the project: package.json, server.js, .env, database.js, s3.js. Create Config model. Build setup wizard page. On first launch, app checks Config.isConfigured. If false, show wizard. User enters name, profession, institution. On submit, create Config document, set isConfigured = true. Redirect to library. On all subsequent launches, skip wizard, go straight to library.
✅  DONE WHEN:
• First launch shows wizard
• Submitting wizard creates Config document in MongoDB
• Second launch skips wizard, shows empty library
Step 2: Upload System
Build upload page with drag-and-drop zone. Accept PDF files only. On upload: file goes directly to S3 via multer-s3. Create Book document with processingStatus = "pending", fileUrl, s3Key, fileSize. User provides title and optionally authors. Return success response immediately—client does not wait for processing.
Queue a "process-book" agenda.js job. The job: download PDF from S3 temporarily, run pdf-parse to extract text, split into pages, create one Page document per page with rawText and wordCount. Update Book.processingStatus through: pending → extracting → complete. If error, set processingStatus = "error" and save processingError message. Create notification when complete.
Client polls GET /api/library/:bookId/status every 3 seconds while processingStatus is not "complete". Show progress indicator.
⚠ All heavy processing goes through agenda.js background jobs. No exceptions. Heroku has a 30-second request timeout. Upload returns immediately. Processing happens asynchronously. The user can navigate away and come back.
⚠ PDF quality rule: Some PDFs will produce poor rawText—broken spacing, missing symbols, weird line breaks. This is expected. Store the rawText as-is. Do NOT attempt to fix, clean, or post-process bad extraction output in Phase 1. Log the issue. Phase 2’s vision-model pipeline replaces pdf-parse entirely and solves this. Any time spent “fixing PDFs” in Phase 1 is wasted.
✅  DONE WHEN:
• Upload a PDF, it goes to S3
• Book document created with pending status
• Background job extracts text page by page
• Page documents created with rawText for every page
• Book status updates to complete
• Error handling: corrupted PDF shows error status, not crash
Step 3: Library View
Library page shows a grid of book cards. Each card: cover image (or placeholder), title, authors, page count, processing status badge. "Continue Reading" button if book is complete. "Processing..." indicator if still extracting. "Add Book" button opens upload page. Search bar filters books by title. Delete button with confirmation modal.
✅  DONE WHEN:
• Library shows all uploaded books as cards
• Processing status visible on each card
• Search filters by title
• Delete removes book, all pages, all highlights, all notes, and S3 file
• Empty state shows "Upload your first book" prompt
Step 4: Reader
Open a book: full-page reader showing rawText for the current page. Left/right arrow navigation (keyboard + on-screen buttons). Page number in URL query string for bookmarking: /reader/:bookId?page=5. Chapter title and section title displayed if available (they won’t be in Phase 1, but the UI slot should exist). Tablet-optimized layout.
⚠ The reader displays rawText (extracted by pdf-parse). This means formatting, images, and equations from the original PDF are lost. This is known and acceptable for Phase 1. Phase 2 upgrades to vision-model processing that preserves structure. Don’t try to render the original PDF in-browser—it adds enormous complexity for no gain, since Phase 2 replaces the rendering pipeline anyway.
✅  DONE WHEN:
• Open book from library, see page 1 text
• Navigate forward/backward with arrows
• Page number persists in URL
• Reader works well on tablet-sized screens
• Chapter/section title area exists (empty for now)


✅  PHASE 1A DELIVERABLE: Upload a book, it processes in background, appears in library, readable page by page. Confirm this works before proceeding to 1B.


PHASE 1B — Annotation Layer
Goal: “I can highlight text and write notes attached to those highlights.” This is where the reading experience becomes a research tool.
Step 5: Highlight System
User selects text in the reader. On mouseup/touchend/stylus-lift, a popup appears with three buttons: (1) Add Note, (2) Ask AI (disabled in Phase 1, grayed out), (3) Draw (disabled in Phase 1, grayed out). Selecting "Add Note" creates a Highlight document with the selected text, startOffset, and endOffset calculated from the page’s rawText. Then opens the note panel.
On page load, all existing highlights for that page are retrieved and re-rendered as colored spans using stored startOffset/endOffset positions. Clicking an existing highlight opens its attached notes in the note panel. Hovering shows a preview tooltip of attached note titles.
⚠ Offset-based highlighting: startOffset and endOffset are character positions within the Page.rawText string. selectedText is the ground truth—offsets are positioning helpers for rendering. If rawText changes in Phase 2 (when vision-model processing replaces pdf-parse), highlights can be re-mapped by matching selectedText against the new content. Design the offset storage so it’s clearly tied to rawText, making the migration path obvious.
✅  DONE WHEN:
• Select text in reader, popup appears
• "Add Note" creates Highlight document, opens note panel
• "Ask AI" and "Draw" buttons visible but disabled (grayed out, tooltip says "Coming in Phase 2")
• Page reload re-renders all highlights as colored spans
• Click existing highlight opens its notes
• Multiple highlights on same page work correctly
• Highlights do not break across page boundaries (one highlight = one page)
Step 6: Note System
Sliding panel from the right side of the reader. Rich text editor with: plain text, basic formatting (bold, italic, headers), LaTeX blocks rendered by MathJax on the client, and user-applied tags. Notes save automatically on a debounce (2-second delay after last keystroke). Manual save button also available.
⚠ Editor constraint: Keep the note editor simple and reliable. Use a lightweight editor library if it reduces implementation risk and improves stability for formatting, paste handling, selection state, and LaTeX insertion. Do not build a custom rich text editor from raw contenteditable unless there is a very strong reason. Do not introduce a heavy collaborative or word-processor-grade framework. The Phase 1 goal is a stable note editor with basic formatting, LaTeX block support, and autosave—not a full document suite.
Creating a note from a highlight: the highlighted text appears as a blockquote at the top of the note. The note’s highlightId, bookId, pageNumber, and highlightedText are set automatically.
Standalone notes: accessible from the notes page (separate from reader). Not attached to any book or highlight. isStandalone = true.
Notes page: list of all notes across all books, filterable by book, by tag, sortable by date. Each note shows title, snippet, which book/page it’s from.
✅  DONE WHEN:
• Create note from highlight—panel opens with blockquote of highlighted text
• Rich text editing works: bold, italic, headers
• LaTeX blocks render via MathJax in the note panel
• Auto-save on debounce (2s delay)
• Notes page shows all notes, filterable by book
• Standalone notes can be created from notes page
• Edit and delete notes
• Multiple notes can attach to one highlight (noteIds array on Highlight)
• Opening a highlight’s notes shows all attached notes in order


✅  PHASE 1B DELIVERABLE: Highlight text in the reader, create notes attached to highlights, view and manage all notes. Confirm this works before proceeding to 1C.


PHASE 1C — Polish & Notifications
Goal: Quality-of-life features that improve the experience but are not required for the core research loop.
Step 7: Notification System
Bell icon in the top navigation bar. Shows count of unread notifications. Clicking opens a dropdown with recent notifications. Each notification: message, timestamp, read/unread status. In Phase 1, the only notification type is "Book processing complete." Clicking a notification marks it as read and navigates to the book in the library.
Notifications are stored in MongoDB (not a separate collection—use a simple array on Config or a lightweight Notification model). Polling: client checks for new notifications every 30 seconds.
✅  DONE WHEN:
• Bell icon shows unread count
• Dropdown lists notifications
• Click marks as read + navigates
• Upload a book → processing completes → notification appears without page refresh

5. Environment Variables
Field
Type
Description
NODE_ENV
String
"development" or "production"
PORT
Number
3000 locally
MONGODB_URI
String
MongoDB Atlas connection string
AWS_ACCESS_KEY_ID
String
AWS IAM user access key
AWS_SECRET_ACCESS_KEY
String
AWS IAM user secret
AWS_REGION
String
e.g. us-east-1
AWS_BUCKET_NAME
String
S3 bucket name
SITE_URL
String
Production URL for links
SITE_NAME
String
"Gyde MVP"

⚠ No API keys for Claude, OpenAI, or any AI service in Phase 1. Those are added in Phase 2.

6. What Phase 1 Does NOT Include
Explicitly listing what is out of scope prevents scope creep and wasted effort.
No AI of any kind. No LLM calls, no embeddings, no metadata extraction, no chat. The AI research partner, @@ span generation, edge classification, and all intelligence features are Phase 2+.
No search beyond title filtering. Semantic search, full-text search across page content, vector search—all Phase 2.
No crawler. ArXiv crawling, URL ingestion, reference card creation—Phase 5.
No note ingestion pipeline. Bulk upload of old notebooks, GPT-4o vision parsing, auto-matching—Phase 5.
No cross-book connections. Typed edges, relationship classification, the graph—Phase 3.
No draw canvas. Stylus/Apple Pencil support, GPT-4o vision conversion—Phase 2. The button exists but is disabled.
No dark mode. CSS variable infrastructure can be set up, but toggle is not required in Phase 1.
No authentication. Single user. No login, no JWT, no sessions. Setup wizard is the only gate.

7. Architectural Rules
These rules apply to ALL phases. Violating them creates technical debt that compounds.
Rule 1: Background Jobs for All Heavy Work
Every operation that takes more than 2 seconds goes through agenda.js. PDF extraction, future AI calls, future note ingestion—all queued as jobs. The user never waits. The server never times out. Heroku’s 30-second limit is a hard constraint.
Rule 2: Note Is Not Always Derived From Highlight
A highlight can create a note. But a note can also exist before any highlight—standalone notes, notes from bulk ingestion (Phase 5), notes created by AI (Phase 4). The Note model’s bookId, pageNumber, and highlightId are all optional. Do not build the note system assuming every note starts from a highlight.
Rule 3: Highlight.noteIds Is an Array
Multiple notes attach to one highlight. Multiple note chunks (from Phase 5 bulk ingestion) will also attach via noteChunkIds. The highlight is a junction, not a one-to-one pointer.
Rule 4: Schema Fields Are Complete From Day One
Every field listed in Section 2 must exist in the Mongoose schema definition, even if Phase 1 leaves it as null/empty. This prevents schema migrations and ensures Phase 2 code can start writing to these fields immediately without model changes.
Rule 5: No Direct AI Calls From Controllers
Not relevant in Phase 1, but establish the pattern: all future AI calls go through service files (claudeService.js, openaiService.js). Controllers call services. Services call APIs. This isolation makes it possible to swap AI providers, add retry logic, and track costs in one place.
Rule 6: The Three-Tier Data Separation (Chat / Note / Graph)
This rule doesn’t activate until Phase 4, but the developer should understand it now: conversations with the AI are ephemeral by default and never automatically stored as notes or graph nodes. Only explicit user action promotes content from chat → note → graph. Phase 1 builds the note tier. Phase 4 builds the chat tier. Phase 3 builds the graph tier. They are architecturally separate.

8. What Comes Next (Context Only)
This section is for context. Do not build any of this in Phase 1. Understanding the future helps you make better decisions about the foundation.
Phase 2 — Ingestion Pipeline: Each page processed by GPT-4o vision. LLM generates @@ span annotations with semantic role tags (definition, assumption, derivation, etc.) in a compressed DSL format. Chunks derived from spans. Metadata extraction: topics, concepts, equations, chapter/section detection. Missing-proof detection via regex ("it is obvious," "the reader may verify"). Vector embeddings per chunk. This is where the library becomes intelligent.
Phase 3 — Edge Graph: Within-book typed edges generated during ingestion (proves, assumes, contradicts, extends, prerequisite). Cross-book edges via a four-layer candidate filtering funnel: lexical tag matching (free) → embedding similarity (cheap) → micro-LLM binary Y/N classification (precise). The N/L/I/S/B triage system routes each span to the right resolution pipeline. Reciprocal edges auto-generated. Transitive closure computed as background job. This is the core intelligence product.
Phase 4 — AI Research Partner: Floating chat available on every page. Context builder assembles: current page, current note, book metadata, matched chunks, typed edge graph, conversation history. The AI cites exact sources, surfaces cross-book connections, flags unjustified claims. Chat/Note/Graph three-tier separation enforced. Draw canvas with GPT-4o vision for stylus input.
Phase 5 — Note Ingestion + Crawler: Bulk upload of handwritten notebooks. GPT-4o vision parses handwriting. Content chunked, embedded, matched to library passages via vector search. Auto-generated highlights where matches exceed confidence threshold. ArXiv crawler follows unresolved references. Referenced books get schema IDs before they’re uploaded.


Phase 1 is the foundation. If the library, reader, highlights, and notes work flawlessly, everything else layers on top cleanly.
If they don’t, nothing else matters.

GYDE MVP
Developer Specification
Phase 2: Ingestion Pipeline & Metadata Intelligence


Jonathan Valenzuela  •  April 2026  •  CONFIDENTIAL

1. What Phase 2 Is
Phase 2 transforms the Phase 1 reading shell into an intelligent research library. Every page of every book gets processed by AI to produce structured metadata: what the passage is about, what it assumes, what it proves, where it has gaps, and what it references. This metadata is the foundation for everything that follows—the edge graph (Phase 3), the AI research partner (Phase 4), and note ingestion (Phase 5).
Phase 1 stored raw extracted text. Phase 2 replaces that with vision-model output (preserving equations and structure), generates @@ span annotations with semantic role tags, derives chunks from spans, detects missing proofs, extracts surface metadata, and creates vector embeddings for every chunk. When Phase 2 is complete, every passage in every book has been categorized, tagged, and made searchable.
1.1 The User Experience After Phase 2
The user uploads a book. In the background, the system processes every page through a vision model, generates structured metadata, and creates searchable chunks. The user sees: chapter titles and section titles now appear in the reader. Equations render correctly. A search bar can find passages by concept across the entire library. Highlights from Phase 1 are preserved and re-mapped to the new chunk structure. The book’s processing status now shows metadata generation progress, not just extraction progress.
⚠ Phase 2 has zero user-facing AI chat. The AI research partner (floating chat, context builder, grounded responses) is Phase 4. Phase 2 is entirely about background processing—transforming raw PDFs into structured, searchable, metadata-rich content. The user’s experience changes because the data is better, not because there’s a chatbot.
1.2 New Services Added in Phase 2
openaiService.js (upgraded): GPT-4o vision for page image processing. GPT-5.4 Nano for surface metadata extraction.
spanService.js (new): Mid-tier model (GPT-4o or equivalent) for @@ span annotation generation. Manages the compressed DSL output format, gold-standard prompts, and session cycling.
chunkService.js (new): Groups spans into coherent logical chunks after span generation. Computes chunk boundaries, assigns sequential IDs, stores chunk documents.
embeddingService.js (new): Generates vector embeddings for every chunk and every concept-tagged span. Stores in MongoDB for Atlas Vector Search.
judgeService.js (new): Quality monitoring. Separate model from a different AI company samples span outputs, rates 0–9, triggers prompt resets when quality degrades.
taxonomyService.js (upgraded): Normalizes all tags and concepts to canonical terms. Synonym matching. Unknown terms flagged for review.
1.3 New Environment Variables
Field
Type
Description
OPENAI_API_KEY
String
GPT-4o vision + GPT-5.4 Nano
ANTHROPIC_API_KEY
String
Claude Opus for judge model
SPAN_MODEL
String
Model ID for @@ span generation (e.g. gpt-4o)
JUDGE_MODEL
String
Model ID for quality judge (e.g. claude-opus-4-6)
NANO_MODEL
String
Model ID for surface metadata (e.g. gpt-5.4-nano)
VISION_MODEL
String
Model ID for page processing (e.g. gpt-4o)

⚠ Model IDs are environment variables, not hardcoded. Models change every few months. The best math model today may not be the best in 6 months. Swapping a model should require changing one env var, not editing code.

2. The Ingestion Pipeline
When a book is uploaded, Phase 1 runs pdf-parse and creates Page documents with rawText. Phase 2 replaces this with a multi-stage pipeline. The pipeline runs as an agenda.js background job—same pattern as Phase 1, just more stages.
2.1 Stage 1: Vision-Model Page Processing
Each page of the PDF is sent as an image to GPT-4o vision. The vision model reads the actual page—equations, formatting, diagrams, everything—and returns semantically structured text. This replaces pdf-parse’s raw text extraction. The vision model preserves: LaTeX equations, section/chapter boundaries, theorem/definition/proof environments, figure references, and bibliography entries.
Output is stored on the Page document, replacing rawText. The old rawText field is preserved as rawTextLegacy for highlight re-mapping (Phase 1 highlights used offsets into rawText).
⚠ Vision-model processing is the most expensive per-page cost in the entire system, but it runs exactly once per page. Every downstream stage (spans, chunks, metadata, edges) depends on the quality of this extraction. Do not try to skip this stage or substitute pdf-parse output for mathematical content—the quality difference is enormous.
✅  DONE WHEN:
• Every page processed through vision model
• Equations extracted as LaTeX strings
• Chapter/section boundaries detected
• Theorem/definition/proof environments identified
• Page.rawText updated with vision-model output
• Page.rawTextLegacy preserves original pdf-parse text
• Processing status shows per-page progress
2.2 Stage 2: Structural Type Detection (Pre-LLM, Free)
Before any LLM call, the system scans each page’s text with regex and formatting heuristics to detect structural signals. These signals are free—no AI cost—and feed directly into later stages.
What regex detects:
Named environments: "Theorem 3.4", "Definition 1.1", "Lemma", "Proposition", "Corollary", "Proof", "Example", "Remark". Detected from text patterns and formatting.
Missing-proof phrases: "it is obvious that", "the reader may verify", "it follows immediately", "it is trivial", "it can be shown", "one easily checks". These are automatically flagged as L-tagged spans (logical gaps awaiting notes) before the LLM ever sees them.
Bibliography citations: "[AM, Ch. 3]", "[Hart77]", "see Theorem 5.2 of [EGA]". These are automatically flagged as S-tagged spans (specific external source) with the cited reference extracted.
Equation markers: Numbered equations, display equations, inline LaTeX. Flagged for equation-as-node treatment.
These regex-generated tags are passed to the span generation model as pre-annotations. The LLM sees them, can override them if wrong, and adds its own tags on top. But the regex catches the easy cases for free.
✅  DONE WHEN:
• Regex scans every page for all four pattern types
• Results stored as pre-annotations on the Page document
• Missing-proof phrases produce L tags with page/sentence location
• Citation patterns produce S tags with extracted reference string
• Named environments produce structural type labels
2.3 Stage 3: Surface Metadata Extraction (Nano, Cheap)
GPT-5.4 Nano processes each page to extract lightweight metadata: topics, concepts, key terms, chapter/section assignment, academic level. This is separate from span generation because it’s cheap, fast, and fills in the Book-level and Page-level fields that Phase 1 left empty.
Input per page: ~200 tokens (page text, truncated if long). Output per page: ~20 tokens (JSON with field values). For 350 pages: ~0.07 MTok input × $0.20 + ~0.007 MTok output × $1.25 = ~$0.02. Essentially free.
All extracted tags and concepts pass through taxonomyService for normalization before storage. Synonyms map to canonical terms. New terms appearing across multiple books are flagged for taxonomy addition.
✅  DONE WHEN:
• Page.topics, Page.concepts, Page.equations populated for every page
• Book.tags, Book.keyConcepts, Book.keyTopics aggregated from all pages
• Book.chapterSummaries populated with chapter boundaries
• Book.academicLevel, Book.documentType set
• Book.summary generated (one final Nano call for the whole book)
• All terms normalized through taxonomyService

3. The @@ Span Annotation System
This is the core intelligence step. A mid-tier LLM reads each section of text and produces span annotations: tagged sub-regions identifying the semantic role of every meaningful unit. The output uses a compressed domain-specific language (DSL)—not prose summaries, not echoed source text. The source text already exists in the system; the LLM outputs only pointers, codes, and labels.
3.1 What the LLM Receives (Input)
For each processing window (a section or group of paragraphs, sized to fit context limits), the LLM receives: the section text with sentences numbered, the pre-annotations from Stage 2 (regex-detected environments, missing-proof flags, citation flags), and a compact prompt specifying the DSL format. During a fresh session, the prompt includes 3–5 gold-standard examples. During subsequent calls in the same session, the prompt is shorter—referencing the format by name without repeating examples.
3.2 What the LLM Outputs (The DSL)
One line per span. Sentence range first, then all tags for that span separated by spaces. Three types of tags can appear on any line:
Context Tags (lowercase, open-ended)
Concept labels that describe what the span is about. Lowercase words with underscores: free_propagator, spectral_density, completeness_relation, flat_module. These grow with the corpus and are searchable. The LLM generates them; taxonomyService normalizes them.
Declarative Tags (single lowercase letter + target reference)
Typed relationships between spans. A single letter from the codebook followed by a chunk.tag target:
p = proves       a = assumes      c = contradicts
e = extends      r = prerequisite  q = equivalent
s = supports     k = special case  x = example of
d = data for     v = figure ref
Example: p14.3 means “this span proves the claim at chunk 14, tag 3.” Within the same book, only chunk and tag numbers are needed. Cross-book references use the full ID path (added in Phase 3).
Search-Class Tags (single uppercase letter + confidence suffix)
What kind of cross-reference resolution the span needs. Uppercase letter, optionally followed by a–z confidence (each letter ≈ 3.84% increment, a ≈ 4%, z ≈ 100%):
N = no search needed (IMPLICIT — never output, absence = N)
L = logical gap awaiting notes
I = internal same-book reference
S = specific external source cited
B = broad external search needed
L and B always carry a confidence suffix. I carries a confidence suffix. S has no suffix—the system resolves when the source is available. Examples: Bz = broad search, 100% confident. Ls = logical gap, ~73% confident notes would help. Iv = internal ref, ~85% confident.
3.3 Example Output
For a chunk from Srednicki’s QFT textbook:
1-3 free_propagator definition
4-5 spectral_density r7.2 Iv
6-8 completeness_relation a3.1 Bt
9 Ls
10-12 lehmann_kallen_form p7.2 s3.1
Reading line 2: sentences 4–5 are about spectral_density (context tag), have a prerequisite relationship to chunk 7 tag 2 (declarative tag r7.2), and need internal same-book resolution at ~85% confidence (search-class tag Iv).
Each line is roughly 4–8 tokens. A typical chunk produces 3–5 annotation lines. Total output per chunk: ~15–30 tokens in compressed DSL. This is 5–10x cheaper than natural-language annotation.
3.4 Session Management and Prompt Cycling
The span generation model operates in sessions. A new session starts with the full vision prompt: the project’s goals, the complete @@ DSL specification, and 3–5 gold-standard annotated examples. This is expensive (~2,000–3,000 input tokens) but sets the quality baseline.
Subsequent chunks in the same session receive a short prompt (~200–500 tokens): the section text with numbered sentences, the regex pre-annotations, and a one-line instruction like “Annotate using the @@ DSL format.” The model relies on in-context memory of the standard from the session’s opening.
Each session typically covers 50–200 chunks before quality drifts. When the judge model (Section 5) detects degradation, the system creates a new session with the full vision prompt. Cycle: full prompt → short prompts (cheap) → drift detected → new session with full prompt.
⚠ Do NOT try to fix drift by appending corrections mid-session. Create a fresh session. The LLM’s context gets noisy over long runs. A clean reset is cheaper than debugging accumulated drift.
✅  DONE WHEN:
• spanService.js processes every section through the span generation model
• Output parsed into structured Span documents (see schema below)
• Each span has: sentence range, context tags, declarative tags, search-class tag
• Gold-standard prompt stored as a template, loaded at session start
• Short prompt used for subsequent chunks in same session
• Session cycling triggered by judge model (Section 5)

4. Chunks, New Schemas & Embeddings
4.1 Chunks Derived from Spans
Chunks are NOT imposed before the LLM sees the text. They are derived AFTER @@ span generation. A grouping algorithm clusters spans into coherent logical units: a theorem statement and its proof stay together, a definition and its first use stay together, consecutive construction steps in the same argument stay together.
Pre-LLM splitting exists only for context window management—creating processing windows small enough for the model. These windows are NOT chunks. Chunks emerge from the spans.
Each chunk carries sequential pointers (nextChunkId, prevChunkId) to reconstruct reading order. Chunks also carry a reference back to their source Page and sentence range for highlight anchoring.
⚠ This is a critical architectural point. Edgar’s original build assumed chunks are created during PDF extraction. In our architecture, PDF extraction creates Pages. The LLM creates Spans. The grouping algorithm creates Chunks from Spans. Three separate steps.
4.2 New Schema: Span
Field
Type
Description
bookId
ObjectId
Reference to Book. Required.
pageNumber
Number
Source page. Required.
chunkId
ObjectId
Reference to parent Chunk (set after grouping). Null initially.
sentenceStart
Number
First sentence number in this span.
sentenceEnd
Number
Last sentence number in this span.
contextTags
[String]
Open-ended concept labels: ["free_propagator", "definition"]
declarativeTags
[Object]
Typed relations: [{type: "p", targetChunk: 14, targetTag: 3}]
searchClass
String
One of: N, L, I, S, B
searchConfidence
String
Single letter a–z, or null for N and S
resolved
Boolean
True if this span’s search-class need has been satisfied. Default false.
resolvedBy
ObjectId
Reference to the Edge that resolved this span. Null until resolved.
regexFlags
[String]
Pre-LLM flags: ["missing_proof", "citation:AM_Ch3"]
embedding
[Number]
Vector embedding for semantic search.
createdAt
Date
Timestamp

4.3 New Schema: Chunk
Field
Type
Description
bookId
ObjectId
Reference to Book. Required.
chapterNumber
Number
Chapter this chunk belongs to.
sectionTitle
String
Section title.
chunkIndex
Number
Sequential index within the book (0, 1, 2...).
pageNumber
Number
Primary page this chunk lives on.
sentenceStart
Number
First sentence of first span in this chunk.
sentenceEnd
Number
Last sentence of last span in this chunk.
spanIds
[ObjectId]
Ordered array of Span references composing this chunk.
structuralType
String
theorem / definition / proof / example / remark / narrative / notation / equation
contextTags
[String]
Union of all context tags from contained spans.
searchClasses
[String]
Union of search-class tags from contained spans.
hasUnresolvedSpans
Boolean
True if any contained span has resolved=false and searchClass != N.
nextChunkId
ObjectId
Next chunk in reading order.
prevChunkId
ObjectId
Previous chunk in reading order.
embedding
[Number]
Vector embedding (average or dedicated).
wordCount
Number
Total word count of source text covered by this chunk.
createdAt
Date
Timestamp

4.4 Updated Schema: Page (Phase 2 additions)
These fields are ADDED to the existing Page schema from Phase 1. Do not remove any Phase 1 fields.
Field
Type
Description
rawTextLegacy
String
Original pdf-parse text from Phase 1. Preserved for highlight re-mapping.
visionProcessed
Boolean
True after vision model has processed this page.
structuralAnnotations
[Object]
Regex-detected signals: [{type, sentenceRange, value}]
chunkIds
[ObjectId]
Chunks that include content from this page.
spanIds
[ObjectId]
Spans on this page.

4.5 Embedding Generation
After chunks are created, embeddingService generates a vector embedding for: every Chunk (from combined span text), and every Span that carries a concept tag (for fine-grained semantic search). Embeddings use OpenAI’s embedding API and are stored as arrays on the document for MongoDB Atlas Vector Search.
4.6 ISBN/Hash Deduplication
Before processing a new upload, the system checks: does a Book with this ISBN already exist? If no ISBN, hash the first 5 pages of extracted text and compare. If duplicate found, link to existing Book rather than reprocessing. Alert the user.
✅  DONE WHEN:
• Chunks derived from spans, not from PDF extraction
• Span and Chunk documents created and stored in MongoDB
• Page schema updated with new fields, legacy rawText preserved
• Embeddings generated for all chunks and concept-tagged spans
• Deduplication catches ISBN and text-hash matches
• Phase 1 highlights re-mapped from rawText offsets to chunk/span references

5. Quality Monitoring & Model Routing
5.1 Multi-Model Routing
Different models for different tasks. The system routes by task type, not by brand loyalty. Update models every few months based on benchmark performance.
Vision model (GPT-4o vision): Page image processing. One call per page during ingestion.
Mid-tier model (GPT-4o or equivalent): @@ span generation on dense mathematical text. One pass per section.
Cheapest model (GPT-5.4 Nano): Surface metadata extraction. High volume, low cost.
Strongest math model (Claude Opus 4.6): Judge model for quality auditing. Also used for strict edge classification in Phase 3. Cheap output (single digit or letter per judgment).
⚠ Model IDs are env vars. Different AI companies handle different stages. This optimizes cost (best model per task) and protects privacy (no single company sees the complete data flow—one generates metadata, another judges it, a third will handle the user-facing chat in Phase 4).
5.2 The Judge Model
A model from a different AI company than the span generation model. It samples a fraction of @@ span outputs—every 10th to 100th chunk depending on quality consistency—and rates them 0–9 against gold-standard examples. The question it answers: “Does this span annotation accurately capture the semantic structure of the source text?”
The judge sees: the source text, the span annotation output, and 2–3 gold-standard examples of correct annotations. It outputs a single digit (0–9). This is a very cheap call—strong model, minimal output.
When the rolling average quality score drops below threshold (configurable, start at 6/9), the system triggers a session reset in spanService: close current session, open new session with full vision prompt and examples.
5.3 Quality Convergence Cycle
Full vision prompt (expensive, ~3K tokens) → short prompts per chunk (cheap, ~200–500 tokens) → judge samples periodically → quality drops → new session with full prompt → repeat. Each cycle covers 50–200 chunks. Over an 800-page book (~3,500 chunks), expect 15–70 session resets. The cost of resets is small relative to the total span generation cost because the full prompt is only the input—output stays compressed.
5.4 Quality Monitoring Schema
Field
Type
Description
bookId
ObjectId
Book being monitored.
chunkId
ObjectId
Chunk that was judged.
score
Number
0–9 quality rating from judge model.
sessionId
String
Which ingestion session produced this chunk.
modelUsed
String
Which model generated the spans.
judgeModelUsed
String
Which model judged.
triggered_reset
Boolean
True if this judgment triggered a session reset.
createdAt
Date
Timestamp

✅  DONE WHEN:
• judgeService samples span outputs at configurable frequency
• Quality scores stored per chunk
• Rolling average computed per session
• Below-threshold triggers new session in spanService
• Dashboard or log shows quality scores over time per book

6. Search
Phase 2 enables real search across the library. Phase 1 had title-only filtering. Phase 2 adds:
Full-text search: MongoDB text index on Page.rawText, Chunk.contextTags, Span.contextTags. Simple keyword matching.
Semantic search: User query is embedded via embeddingService. MongoDB Atlas Vector Search finds the most similar chunks and spans. Results ranked by cosine similarity.
Combined search: Full-text results and semantic results merged. Semantic results that also match keywords are boosted. Results link to the exact page and highlight the matching passage.
Search controller returns results as: book title, chapter, page number, matched text snippet, relevance score. Clicking a result navigates to the reader at that exact page.
✅  DONE WHEN:
• Search bar on library page accepts natural-language queries
• Results show matching passages from across all books
• Clicking a result opens the reader at the correct page
• Results ranked by relevance (semantic similarity + keyword match)
• Search works across all books in the library simultaneously

7. Phase 2 Build Order
Step 1: Vision-Model Page Processing
Upgrade the Phase 1 process-book job to include GPT-4o vision processing. Each page sent as image, structured text returned. Store in Page.rawText (replacing pdf-parse output). Preserve original in Page.rawTextLegacy. Re-map Phase 1 highlights by matching selectedText against new rawText.
Step 2: Regex Pre-Annotation
Add structural type detection to the ingestion pipeline after vision processing. Regex scans for named environments, missing-proof phrases, citations, equations. Results stored as Page.structuralAnnotations.
Step 3: Surface Metadata (Nano)
Add openaiService.extractPageMetadata using Nano. Populates all empty Phase 1 schema fields: topics, concepts, equations, chapter/section titles, book-level summaries. All terms normalized through taxonomyService.
Step 4: Span Generation
Build spanService.js. Implement the full @@ DSL prompt with gold-standard examples. Process every section. Parse output into Span documents. Implement session management (full prompt → short prompts → reset cycle).
Step 5: Chunk Derivation
Build chunkService.js. Group spans into coherent logical units. Create Chunk documents with sequential pointers. Link Spans to their parent Chunks.
Step 6: Quality Monitoring
Build judgeService.js. Implement sampling, scoring, rolling average, and session reset triggers. Store QualityScore documents.
Step 7: Embeddings + Search
Build embeddingService.js. Generate embeddings for all chunks and concept-tagged spans. Build search controller with combined full-text + semantic search. Search UI on library page.


✅  PHASE 2 DELIVERABLE: Upload a book, it processes through the full pipeline (vision → regex → metadata → spans → chunks → embeddings). Every passage is tagged, categorized, and searchable. Quality monitoring keeps metadata accurate. Search finds passages across the entire library.

8. Cost Economics Per Book (800 pages, ~3,500 chunks)
All costs assume compressed DSL output, triage-based routing, and current model pricing as of April 2026. Costs will decrease as models get cheaper.
Vision-Model Page Processing
350 pages (unique content pages, excluding blanks) × GPT-4o vision. Input: ~500 tokens/page (image). Output: ~300 tokens/page (structured text). Total: ~0.175 MTok input, ~0.105 MTok output. At GPT-4o pricing (~$2.50/MTok input, ~$10/MTok output): ~$0.44 + ~$1.05 = ~$1.50.
Surface Metadata (Nano)
3,500 chunks × ~200 tokens input, ~20 tokens output. Total: 0.7 MTok input × $0.20 + 0.07 MTok output × $1.25 = ~$0.23.
@@ Span Generation (Mid-Tier)
3,500 chunks × ~500 tokens input (section text + context), ~20–32 tokens output (3–5 annotation lines in DSL). Total: ~1.75 MTok input, ~0.07–0.11 MTok output. At mid-tier pricing (~$2.50/MTok input, $10/MTok output): ~$4.38 + ~$0.70–$1.10 = ~$5.00. Reducible to ~$2 if Nano proves sufficient on cleaner texts.
Quality Monitoring (Opus)
Sample every 10th chunk: 350 judgments. Input: ~300 tokens each (source + annotation + examples) = 0.105 MTok × $5/MTok = $0.53. Output: 1 token each = negligible. Total: ~$0.55.
Embeddings
~4,000 embeddings (chunks + concept-tagged spans). At OpenAI embedding pricing (~$0.10/MTok): ~$0.10.
Total Phase 2 Cost Per Book
Vision processing:    ~$1.50
Surface metadata:     ~$0.23
Span generation:      ~$2.00 – $5.00
Quality monitoring:    ~$0.55
Embeddings:           ~$0.10
────────────────────────────
TOTAL:                ~$4.38 – $7.38 per book
For a 50-book library: $219–$369 one-time ingestion cost. This is the infrastructure investment. Once processed, books never need reprocessing unless the pipeline is upgraded.
⚠ These costs are for Phase 2 only (metadata generation). Phase 3 (edge classification) adds $0.50–$5.00 per book depending on how citation-heavy the text is. Combined Phase 2+3 total: ~$5–$12 per book.

9. What Comes Next (Context Only)
Phase 3 — Edge Graph: The N/L/I/S/B search-class tags generated in Phase 2 drive the cross-reference resolution pipeline. Within-book edges (I tags) are resolved first using Nano with Opus escalation. External edges (S and B tags) use a four-layer candidate filtering funnel: concept tag matching (free) → embedding similarity (cheap) → Nano broad sweep → Opus strict classification. Reciprocal edges auto-generated. Transitive closure computed as background job.
Phase 4 — AI Research Partner: The metadata and edge graph from Phases 2–3 become the grounding layer for the AI chat. Every response cites exact sources. The chat/note/graph three-tier separation is enforced.
Phase 5 — Note Ingestion + Crawler: L-tagged spans from Phase 2 tell the note ingestion pipeline exactly where derivation notes are needed. The crawler resolves S-tagged spans by finding cited sources on ArXiv.


Phase 2 turns a reading app into a knowledge system.
Every feature that follows depends on the metadata being right.

GYDE MVP
Developer Specification
Phase 3: Edge Graph & Cross-Reference Resolution


Jonathan Valenzuela  •  April 2026  •  CONFIDENTIAL

1. What Phase 3 Is
Phase 3 transforms metadata into intelligence. Phase 2 tagged every passage with semantic roles and search-class needs (N/L/I/S/B). Phase 3 resolves those needs—finding the specific passages that prove, assume, contradict, or extend each other—and stores the results as typed directed edges in a persistent graph. When Phase 3 is complete, every claim in every book is connected to its justifications, dependencies, and contradictions across the entire library.
This is the core product. The edge graph is what makes Gyde different from a search engine or a chatbot. A search engine finds related passages. Gyde finds the exact chain of reasoning that justifies a claim.
1.1 The Core Principle
Most chunks do not need cross-book comparison. Most comparisons do not need to be executed fully. Most useful edges can be found within the first few ranked candidates. The entire Phase 3 pipeline is designed around this principle—cheap filters first, expensive judgment last, stop early when you have enough.
1.2 New Services Added in Phase 3
edgeService.js: Orchestrates the full cross-reference resolution pipeline. Routes spans to the correct resolution category. Manages candidate generation, ranking, and evaluation. Creates Edge documents.
candidateService.js: Generates ranked candidate lists for comparison. Uses concept tag overlap, embedding similarity, bibliography matching, and book-level scoping. No LLM calls—this is all database queries and vector search.
classificationService.js: Runs the actual edge classification. Nano for broad sweeps, Opus for strict evaluation. Loads prompt from config/prompts/edge-classification.txt. Outputs 3-character codes per relationship type.
transitivityService.js: Background job that computes transitive closure and reciprocal edges. Runs periodically as the graph grows.
1.3 New Pipeline Config Parameters (added to config/pipeline.js)
// Edge classification
STOPPING_CONFIDENCE: 't',          // a-z, ~77%. Stop when edge this confident found.
MAX_COMPARISONS_PER_SPAN: 5,       // Budget cap per unresolved span.
NANO_ESCALATION_THRESHOLD: 'm',    // Below this confidence, escalate Nano result to Opus.
CANDIDATE_CEILING_I: 5,            // Max candidates for Category I (same-book).
CANDIDATE_CEILING_S: 20,           // Max candidate cards for Category S preselection.
CANDIDATE_CEILING_B: 20,           // Max candidates for Category B broad search.
SIMILAR_BOOKS_LIMIT: 10,           // Max books to search for broad candidates.
OPUS_TOP_K: 5,                     // Opus evaluates top K from candidate list.


// Transitivity
TRANSITIVE_MAX_DEPTH_ASSUMES: 3,   // Max chain depth for assumes transitivity.
TRANSITIVE_MAX_DEPTH_EXTENDS: 5,   // Max chain depth for extends transitivity.
TRANSITIVITY_JOB_INTERVAL: '1 hour', // How often transitive closure runs.

2. How Spans Route to Resolution Pipelines
Every span produced in Phase 2 carries a search-class tag: N, L, I, S, or B. This tag determines what happens to the span in Phase 3. The routing is deterministic—no LLM decides which pipeline a span enters. The tag already made that decision during ingestion.
2.1 Category N — No Action (~50–65% of spans)
Routine content: notation definitions, connecting text, examples, remarks. No search needed. No Edge documents created. $0 cost.
2.2 Category L — Logical Gap, Awaiting Notes (~10–16%)
Internal reasoning steps the author compressed (“it is obvious,” “the reader may verify”). No cross-book search—no other book will contain the intermediate step in THIS author’s specific argument. The span stays tagged and waiting. When notes are uploaded in Phase 5, L-tagged spans are matched first, prioritized by the confidence suffix (higher confidence = the gap is more clearly fillable). $0 cost for cross-book search.
2.3 Category I — Same-Book Resolution (~15–25%)
Cites another section, theorem, or lemma in the same book. The system knows the approximate target location from the declarative tag (e.g., r7.2 = prerequisite pointing to chunk 7, tag 2).
Pipeline:
1. Look up the target chunk/tag directly from the declarative reference. If it resolves immediately (chunk 7, tag 2 exists and the relationship is clear), create the Edge. Done.
2. If the direct lookup fails or is ambiguous, pull the top 5 candidate chunks from the cited section/chapter. Nano evaluates each pair. If Nano confidence is below the NANO_ESCALATION_THRESHOLD, that specific pair escalates to Opus.
3. If nothing found in top 5, Nano sweeps the next 15 candidates from the broader chapter.
4. Stopping rule applies (see Section 3).
Model: Nano primary, Opus escalation on low-confidence pairs.
Cost per span: ~$0.001–$0.003.
Prompt: Loaded from config/prompts/edge-classification.txt.
2.4 Category S — Specific External Source (~0–15%)
Explicit citation to a named external book or paper (“see [AM, Ch. 3]”). Two sub-cases:
If the cited book IS in the library:
1. candidateService narrows deterministically within the cited source: cited chapter, matching theorem numbers, shared concept tags. Produces 10–20 compact candidate cards (chunk ID, structural type, top 3 context tags—~15 tokens each).
2. One Opus call sees all cards and picks an ordered top 5 by outputting 5 ID numbers (~5–10 output tokens). This is a cheap preselection call.
3. Opus evaluates the top 5 candidates in ranked order, stopping early per the stopping rule.
4. Average resolution: 2–3 comparisons before a strong edge is found.
If the cited book is NOT in the library:
The system already created a Book record with schema ID from bibliography metadata during Phase 2 (the S-tagged span triggered this). The span stays as a pending citation. $0 until the source is uploaded or crawled in Phase 5. When the source becomes available, all pending S-tagged spans pointing to it are resolved automatically.
Model: Opus (targeted, small candidate sets).
Cost per span: ~$0.005 when source is in library. $0 when pending.
2.5 Category B — Broad External Search (~2–7%)
No citation, no internal reference. “It can be shown,” unstated identities, results asserted without source. The most expensive class, but the rarest.
Pipeline:
1. candidateService uses embedding similarity (driven by the flagged span, not the whole chunk) to find the top 20 candidates across the SIMILAR_BOOKS_LIMIT most similar books + prerequisite books + any project-local books.
2. Nano evaluates all 20 pairs (broad sweep). This catches soft edges like “supports” and “related-to.”
3. Top 5 Nano hits ranked by relevance escalate to Opus for strict evaluation in ranked order, stopping early per the stopping rule.
Model: Nano broad sweep, then Opus strict on top hits.
Cost per span: ~$0.005.

3. The Stopping Rule
Every resolution pipeline (I, S, B) uses the same stopping rule. Evaluation proceeds through candidates in ranked order and stops when ANY of these conditions is met:
1. Strong edge found: Confidence ≥ STOPPING_CONFIDENCE (default ‘t’ ≈ 77% on a–z scale). The model is highly confident the relationship holds.
2. Consistent cluster: Two or more medium-confidence edges point to the same concept cluster or target chunk. The system has converging evidence even without a single high-confidence hit.
3. Redundancy: The next candidates have the same context tags as already-tested candidates. Further evaluation is unlikely to surface new information.
4. Budget cap: MAX_COMPARISONS_PER_SPAN reached (default 5). Hard stop regardless of results.
All four thresholds are configurable in config/pipeline.js. The stopping rule is the primary mechanism that prevents edge classification from becoming the dominant cost.

4. Edge Classification Output
4.1 The Prompt
For every pair of chunks being compared, the classification model receives both chunks’ text and a structured prompt asking the full set of relationship questions. The prompt is loaded from config/prompts/edge-classification.txt.
The prompt presents:
A = [chunk text or summary]
B = [chunk text or summary]


Does A prove B? Does A assume B? Does A contradict B?
Does A extend B? Is A prerequisite for B? Is A equivalent to B?
Does A support B? Is A a special case of B?


Reply: one 3-character code per line. Y/N + relevance (a-z) + confidence (a-z).
4.2 The 3-Character Output Code
Each relationship question gets a 3-character response:
Y = yes, relationship exists     N = no relationship
Second letter = relevance (a=low, z=high)
Third letter = confidence (a=very confident, z=very uncertain)
Examples:
Yza  = Yes, highest relevance, very confident
Nma  = No relationship, medium relevance check, very confident
Yqc  = Yes, high relevance, moderate confidence
Nta  = No, fairly relevant comparison but no relationship, very confident
⚠ Confidence scale: a = most confident, z = least confident. This is inverted from the search-class confidence on spans (where z = highest). The reason: for edge classification output, the model outputs the FIRST letter that comes to mind for confidence, and ‘a’ (certain) is the natural first choice. For search-class tags on spans, z = 100% because the scale represents a percentage. Both are defined in config/pipeline.js so they can be re-mapped if needed.
Total output per comparison: 8 lines × 3 characters = 24 characters ≈ 8 tokens. This is extremely cheap output. The cost is dominated by the INPUT (the two chunk texts), not the output.
4.3 Creating Edge Documents
For every Y response above the confidence threshold, the system creates an Edge document using the schema defined in Phase 1. The relationType maps from the question to the codebook letter (p/a/c/e/r/q/s/k/x/d/v). The relevance and confidence letters are stored directly. The model used and timestamp are recorded.
If the same pair of chunks produces multiple Y responses (e.g., A both proves and extends B), multiple Edge documents are created—one per relationship type. This is correct; the same pair can have multiple typed relationships.

5. Reciprocal Edges & Transitive Closure
5.1 Reciprocal Edges (Automatic, At Creation Time)
Every Edge document triggers automatic creation of its reciprocal. This happens in edgeService at Edge creation time—not as a background job.
A proves B       →  B is-proved-by A
A assumes B      →  B enables A
A contradicts B  →  B contradicts A        (symmetric)
A extends B      →  B is-extended-by A
A prerequisite B →  B depends-on A
A equivalent B   →  B equivalent A          (symmetric)
A supports B     →  B is-supported-by A
A special-case B →  B generalizes A
A example-of B   →  B has-example A
The reciprocal Edge has isDerived = true and derivedFrom pointing to the original Edge. Chunk B’s metadata grows even though no LLM ever analyzed B with A in mind.
5.2 Transitive Closure (Background Job, Periodic)
transitivityService runs as an agenda.js background job at the interval specified in config/pipeline.js (default: every hour). It computes transitive edges ONLY for edge types where transitivity is logically valid:
prerequisite-for: ALWAYS transitive. If A is prerequisite to B, and B is prerequisite to C, then A is prerequisite to C. This is the single most valuable computation in the entire system—it generates learning paths automatically.
equivalent-to: ALWAYS transitive. If A ≡ B and B ≡ C, then A ≡ C.
extends: Transitive, but chain length tracked. Capped at TRANSITIVE_MAX_DEPTH_EXTENDS (default 5).
assumes: Conditionally transitive. Capped at TRANSITIVE_MAX_DEPTH_ASSUMES (default 3). Gets noisy beyond that.
proves: NEVER transitive. A proves B and B proves C does NOT mean A proves C.
contradicts: NEVER transitive. A contradicts B and B contradicts C does NOT mean A contradicts C.
All transitive edges have isDerived = true and store the chain of originating edges. The system always distinguishes direct edges (from classification) from derived edges (from reflexivity/transitivity).
⚠ The prerequisite transitive closure is the foundation of learning path generation. Given any target concept, trace backward through prerequisite edges (including transitive ones) and you get the complete dependency tree—the minimum set of things you need to know, in order. This is what makes Gyde a learning tool, not just a library.
✅  DONE WHEN:
• Reciprocal edges created automatically at Edge creation time
• Transitive closure job runs periodically via agenda.js
• Only logically valid edge types propagate transitively
• All derived edges marked as isDerived = true with derivedFrom chain
• Prerequisite chain generates full dependency tree for any concept

6. Graph Evolution Over Time
6.1 New Book Upload
When a new book is uploaded and Phase 2 completes, Phase 3 runs automatically. Within-book edges (Category I) are resolved first. Then, every S-tagged span checks if its cited source is in the library. Then, B-tagged spans run broad search against the existing library. The new book enters the library already connected to existing content.
Additionally, the new book triggers re-evaluation of pending citations from OTHER books. Any existing S-tagged span that cited this book (by bibliography match) is now resolved.
6.2 New Note Upload (Phase 5)
When notes are uploaded, L-tagged spans are matched first (these are the gaps that need notes most). Notes also generate new edges if they resolve previously pending citations or fill logical gaps. L-tagged spans are prioritized by importance and difficulty suffixes.
6.3 Edge Growth Rate
The rate of edge growth exceeds the rate of content growth because each new node potentially connects to many existing ones. A book uploaded six months ago gains new edges when a newly uploaded book cites the same foundational result. The structure of knowledge becomes increasingly complete not because any model gets smarter, but because the graph compounds.

7. Phase 3 Build Order
Step 1: candidateService.js
Build the candidate generation pipeline: concept tag overlap queries, embedding similarity search via MongoDB Atlas Vector Search, bibliography matching, book-level scoping (SIMILAR_BOOKS_LIMIT). All database queries, no LLM calls. Input: a Span document. Output: a ranked list of Chunk candidates with compact card format (ID, type, top tags).
Step 2: classificationService.js
Build the edge classification wrapper. Loads prompt from config/prompts/edge-classification.txt. Sends chunk pairs to the appropriate model (Nano or Opus based on category). Parses 3-character output codes. Returns structured results.
Step 3: edgeService.js — Category I (Same-Book)
Implement within-book resolution first. This is the simplest case—target chunk is known or nearby. Use Nano with Opus escalation. Implement the stopping rule. Create Edge documents with reciprocals. Test on a real book.
Step 4: edgeService.js — Category S (Specific Source)
Add external source resolution. Implement the preselection call (compact cards → Opus picks top 5). Handle the “source not in library” case (pending citation, $0). Test with a book that cites another book already in the library.
Step 5: edgeService.js — Category B (Broad Search)
Add broad search resolution. Nano sweep on top 20 candidates from similar books. Top 5 Nano hits escalate to Opus. Implement stopping rule. Test with a claim that has no citation but should connect to another book.
Step 6: transitivityService.js
Build the transitive closure background job. Implement per-edge-type rules. Track chain depth. Run as periodic agenda.js job. Test that prerequisite chains generate correct learning paths.
Step 7: Integration with Upload Pipeline
Wire Phase 3 into the existing upload job so it runs automatically after Phase 2 completes. New book upload → Phase 2 (metadata) → Phase 3 (edges) → notification. Also trigger re-evaluation of pending citations when a new book matches existing S-tagged spans.


✅  PHASE 3 DELIVERABLE: Upload a book. It processes through Phase 2 (metadata) and Phase 3 (edges) automatically. Within-book edges resolved. Cross-book edges resolved against existing library. Pending citations stored for future resolution. Reciprocals and transitive closure computed. The graph grows with every upload.

8. Phase 3 Cost Per Book (800 pages, ~3,500 chunks)
Empirical distribution from Srednicki Ch. 13–14 analysis: ~55% N (no action), ~16% L (notes only), ~20% I (same-book), ~0–15% S (book-dependent), ~2–7% B (broad). Citation-heavy texts like Hartshorne shift more into S and B.
Category I — Same-Book (Nano + Opus Escalation)
525–875 spans. Top 5 candidates per span (ceiling; average 2–3). Nano evaluates. ~10% escalate to Opus on low confidence.
Nano: ~$0.16–$0.26
Opus escalation: ~$0.35–$0.62
Total I: ~$0.50–$0.88
Category S — Specific Source (Opus, Targeted)
0–525 spans. Preselection (compact cards → Opus picks top 5) + strict comparison (average 2–3 pairs before stopping).
Self-contained book (few citations): ~$0.37
Citation-heavy book: ~$2.76
Category B — Broad Search (Nano Sweep + Opus Strict)
70–525 spans. Nano on top 20 candidates + Opus on top 5 Nano hits.
Self-contained: ~$1.27
Citation-heavy: ~$2.71
Total Phase 3 Cost Per Book
                    Self-Contained    Citation-Heavy
Cat I (same-book):      $0.50             $0.88
Cat S (external):       $0.37             $2.76
Cat B (broad):          $1.27             $2.71
────────────────────────────────────────────────
TOTAL Phase 3:         ~$2.14            ~$6.35
Combined with Phase 2 (~$7–8 with full vision): total ingestion cost per book is ~$9–14 for self-contained texts and ~$13–20 for citation-heavy texts. For a 50-book library: $450–$1,000 one-time.

9. What Comes Next
Phase 4 — AI Research Partner: The edge graph becomes the grounding layer. Every AI response cites exact sources via edge traversal. The chat knows what the user is looking at (via highlights and the testing shell), assembles context from the graph, and surfaces connections the user hasn’t seen. Chat/note/graph three-tier separation enforced.
Phase 5 — Note Ingestion + Crawler: L-tagged spans from Phase 2 tell the note pipeline exactly where gaps exist. The crawler follows S-tagged pending citations to find referenced sources on ArXiv. Both feed new content into the Phase 2→3 pipeline, and the graph grows.
Phase 6 — Full UI/UX: The polished product interface built on a proven engine and a rich graph.


Phase 3 is where data becomes structure.
The edge graph is the product. Everything else is interface.

GYDE MVP
Developer Specification
Phase 4: AI Research Partner


Jonathan Valenzuela  •  April 2026  •  CONFIDENTIAL

1. What Phase 4 Is
Phase 4 makes the engine talk. Phases 2–3 built a structured knowledge graph in silence—processing books in the background, generating metadata and edges. Phase 4 puts an AI research partner on top of that graph so the user can ask questions, get grounded answers with exact citations, and interact with the knowledge structure through natural conversation.
This is NOT a chatbot that happens to have documents attached. This is a research partner whose every response is constrained by and grounded on the structured corpus. It cites exact book titles and page numbers. It provides clickable links to specific passages. It surfaces connections the user hasn’t seen. It flags when a claim has no justification in the corpus. It pushes back on incorrect assertions with mathematical evidence—not because it’s contrarian, but because the graph says otherwise.
1.1 The Two Response Modes
Graph Display Mode (no LLM call): When the user highlights text or clicks a passage, and the graph already has sufficient structure around that passage (resolved citations, typed edges, attached notes), the system displays the structured relationships directly: here is what this claims, here is what it assumes (clickable), here is what proves it (clickable), here is the prerequisite chain (clickable), here is the missing step (flagged, with notes if available). This is a formatted display of existing graph data. Zero LLM cost. Zero hallucination risk. This mode gets more powerful over time as the graph matures.
AI Chat Mode (LLM call): When the user asks a question that requires synthesis, reasoning, or explanation beyond what the graph directly contains, the system builds a context window from the graph and sends it to the AI model. The AI responds with grounded analysis, always citing sources. The context builder ensures the AI has the right data; the system prompt ensures it behaves correctly.
⚠ Graph Display Mode should be tried FIRST for every interaction. The system checks: does the graph have enough structure to answer this without an LLM? If yes, display the graph data. If no, fall through to AI Chat Mode. This is not just a cost optimization—graph responses are more reliable than LLM responses because they are grounded on classified edges, not generated text.
1.2 New Services
claudeService.js: Handles all AI chat. Builds context from the graph, manages streaming responses, enforces system prompt rules. Loads system prompt from config/prompts/chat-system.txt.
contextBuilder.js: Assembles the context window for each AI request. Queries the graph for relevant chunks, edges, notes, and metadata. Compresses and prioritizes to fit within token limits.
graphDisplayService.js: Generates structured, non-LLM responses from graph data. Formats edge traversals into readable displays with clickable links.

2. The Context Builder
On every AI chat message, contextBuilder.js assembles a context window tailored to what the user is doing. The context changes depending on which workspace the user is in.
2.1 Context Layers (Ordered by Priority)
The context builder includes these layers, in this priority order. If the token budget runs out, lower-priority layers are truncated or omitted.
Layer 1: Immediate Focus (always included)
Current page text: The page the user is reading. Full text of the current chunk and surrounding chunks.
Current highlight: If the user highlighted text, that exact text plus its span metadata (context tags, declarative tags, search-class).
Current note: If the user is in a note, the note’s full content.
Layer 2: Local Graph (included if budget allows)
Edges from current chunk: All typed edges originating from or pointing to the current chunk. Includes the connected chunks’ summary text and tags.
Attached notes: All notes attached to the current passage via highlights.
Prerequisite chain: The dependency path leading to the current chunk (from transitive closure). Truncated at depth 3–5.
Layer 3: Book Context (compressed)
Current book metadata: Title, authors, chapter summaries, key concepts. NOT the full book text.
All other books’ metadata: Titles, key concepts, tags only. Enables cross-book references without loading full content.
Layer 4: Library-Wide (minimal)
Unresolved spans: L-tagged and B-tagged spans from the current section that haven’t been resolved. Helps the AI flag gaps proactively.
Recent conversation history: The current chat session’s messages. Truncated from the oldest if too long.
2.2 Context Budget
The total context window is capped at a configurable token limit (defined in config/pipeline.js as CHAT_CONTEXT_BUDGET, default 8000 tokens). The context builder fills layers in priority order and stops when the budget is reached. Layer 1 is always fully included. Layers 2–4 are progressively compressed or dropped.
// config/pipeline.js additions
CHAT_CONTEXT_BUDGET: 8000,         // Max tokens for context assembly
CHAT_MODEL: 'claude-opus-4-6',     // Model for research partner
CHAT_STREAMING: true,              // Stream responses
CHAT_MAX_HISTORY: 20,              // Max conversation turns kept
⚠ The context builder NEVER sends raw page text for the entire book. It sends the current focus area plus compressed metadata. This is what makes per-query costs manageable. A query about one passage should not cost the same as re-reading the entire book.
✅  DONE WHEN:
• contextBuilder.js assembles context from graph, not from raw text
• Priority ordering ensures most relevant data always included
• Token budget respected—lower-priority layers dropped when over budget
• Cross-book metadata included without loading full book text
• Unresolved spans included so AI can proactively flag gaps

3. The System Prompt
Loaded from config/prompts/chat-system.txt. This file defines the AI’s behavior. Editing this file changes how the AI responds without any code changes.
3.1 Core Behavioral Rules
The system prompt enforces these behaviors:
Always cite sources: Every factual claim in the response includes the book title and page number. Format: “[Srednicki, p.93]” or “[Hartshorne, Lemma III.12.3, p.271].” If the AI cannot find a source for a claim in the graph, it must say so explicitly: “This step is not justified in the corpus.”
Never echo source text: The AI does not repeat what the user just read. It adds context, connections, explanations, and gap identification that go beyond the source material.
Provide clickable links: When referencing another passage, the AI provides a direct link to that specific page. Format depends on the UI, but the data must include bookId and pageNumber so the frontend can construct the link.
Surface connections proactively: If the current passage has edges connecting it to other books or notes, the AI mentions them without being asked. “This result is also used in [Hartshorne, Thm 5.1] with a different proof technique.”
Flag unjustified claims: If the current passage makes a claim that has an unresolved L-tagged or B-tagged span (no justification found in the graph), the AI flags it: “The author states this without proof. No justification was found in the library.”
Push back with evidence: When the user makes an incorrect assertion, the AI responds with specific evidence from the graph—not just disagreement. If the graph says A contradicts the user’s claim, cite A. If the graph has no evidence either way, say so. The AI revises its position only when the challenger provides new mathematical evidence, not simply because they pushed back confidently.
Create notes on request: The AI can create a Note document attached to the current highlight when the user asks. The note content is the AI’s explanation, clearly marked as AI-generated (aiGenerated = true on the Note schema).
⚠ The system prompt is a .txt file. It will be iterated frequently. The developer’s job is to load it and pass it to the model—not to understand or optimize its content. The founder writes and revises the prompt.

4. The Three-Tier Data Separation
This is a foundational data policy that protects graph quality. Three tiers, each with explicit user action to promote content to the next:
4.1 Tier 1: Ephemeral Chat (Default)
Every conversation with the AI starts here. Not stored in the graph. Not used as grounding material for other users. Personal and transient. Chat history persists within a session but is not indexed, not embedded, and not searchable beyond the current conversation. This is the safe space for messy thinking, half-formed ideas, and exploratory questions.
4.2 Tier 2: Saved Notes (User-Controlled)
The user may explicitly save portions of a conversation as notes, attaching them to specific highlights or pages. Saved notes are private by default. They can be messy and informal—they are not held to citation standards. Notes are stored in the Note collection with sourceType = “ai-generated” and aiGenerated = true. They receive embeddings and are searchable within the user’s library.
4.3 Tier 3: Curated Graph Nodes (Promoted)
Only curated notes are eligible to become graph-level knowledge. Promotion requires explicit user action (“Promote to Knowledge” or equivalent). At promotion: the system generates @@ span metadata on the note content, enforces structure, and the note enters the typed edge graph as a citable source. The system can optionally rewrite the note in professional language while preserving mathematical content, or the user can promote their original text.
The pipeline: Chat → (optional) Save → Note → (optional) Curate → Graph Node. Each transition requires explicit user action. No automatic promotion at any stage.
⚠ If chats auto-ingested into the graph: noise, errors, privacy violations, unreliable citations. If gated: high-quality graph, rich but controlled notes, user trust. This is the right tradeoff. Do not compromise it.
4.4 Schema: Conversation
New collection for chat history. Created in Phase 4.
Field
Type
Description
bookId
ObjectId
Book context when chat started. Null for global chat.
pageNumber
Number
Page context when started. Null for global.
highlightId
ObjectId
Highlight that anchored this chat. Null if not anchored.
projectId
ObjectId
Project context. Null if not in a project.
messages
[Object]
{role: 'user'|'assistant', content: String, timestamp: Date, citations: [{bookId, pageNumber, chunkId}]}
contextSnapshot
Object
Compressed snapshot of what contextBuilder sent for the first message. For debugging.
savedToNoteIds
[ObjectId]
Notes created from this conversation via explicit save action.
isActive
Boolean
True if session is ongoing.
createdAt
Date


updatedAt
Date




5. Cached Responses & User Feedback
5.1 Graph-Based Cached Responses
When sufficient structure exists in the graph around a passage—source text stored, citations resolved, typed edges connect the claim to its justification chain—the system can generate explanations by formatting stored relationships rather than calling an LLM.
The user clicks a highlight and sees: here is the claim, here is what it assumes (with clickable links to the assumption text), here is what proves it (with links), here is the prerequisite chain (with links), here is the missing step (flagged, with attached notes if available). This is a structured display of existing graph data, not a generation task.
As the graph matures and cached responses accumulate, the system’s dependence on LLM generation decreases. For the most well-annotated passages, the structured graph display fully replaces LLM calls—zero generation cost, zero hallucination risk.
5.2 User Feedback as Quality Signal
User interactions generate implicit quality signals that feed back into the system:
Thumbs down on AI response: Signal that the existing metadata is insufficient for this passage. System can create an L tag on the span if one doesn’t exist, or escalate to the judge model to identify what’s missing.
Repeated follow-up questions on same passage: Signal of confusion—the explanation didn’t resolve the user’s question. The passage may need richer metadata or a cached explanation.
Thumbs up / no follow-up: Signal that the response was sufficient. If the response was an LLM generation, consider caching it for future users asking about the same passage.
Over time, the most-asked-about passages accumulate the richest metadata and the most reliable cached responses. Passages nobody asks about stay lean. The system allocates metadata depth where users actually need it.
5.3 Response Caching Schema
Field
Type
Description
chunkId
ObjectId
Chunk this cached response explains.
spanId
ObjectId
Specific span if applicable.
responseType
String
"graph_display" | "llm_generated" | "user_promoted"
content
String
The formatted response content.
citations
[Object]
[{bookId, pageNumber, chunkId, text_snippet}]
qualityScore
Number
Derived from user feedback. Higher = more reliable.
usageCount
Number
How many times this cache was served.
modelUsed
String
Which model generated it. Null for graph_display.
createdAt
Date


updatedAt
Date



// config/pipeline.js additions
CACHE_QUALITY_THRESHOLD: 0.7,       // Min quality score to serve cached response
CACHE_ENABLED: true,                // Toggle caching on/off
FEEDBACK_CREATES_L_TAG: true,       // Thumbs down creates L tag on span

6. Phase 4 Build Order
Step 1: Conversation Schema + Basic Chat Endpoint
Create the Conversation model. Build POST /api/chat endpoint that accepts a message, creates a Conversation document (or appends to existing one), and returns a response. For Step 1, the response is a simple passthrough to the AI model with minimal context (just the user’s message + current page text). This proves the chat pipeline works end-to-end.
Step 2: contextBuilder.js
Build the full context assembly system. Query the graph for edges, notes, and metadata around the user’s current focus. Implement the priority-ordered layer system. Respect the CHAT_CONTEXT_BUDGET token limit. Test by logging what context gets assembled for different user positions in different books.
Step 3: System Prompt + Behavioral Rules
Write config/prompts/chat-system.txt with all behavioral rules from Section 3. Wire claudeService to load this prompt and prepend it to every API call. Test that the AI cites sources, flags gaps, and provides clickable links. Iterate on the prompt until behavior is correct.
Step 4: graphDisplayService.js (Graph Display Mode)
Build the structured graph response system. When a user clicks a highlight, check if the graph has sufficient data to answer without an LLM. If yes, format and return the graph display. If no, fall through to AI Chat Mode. Define “sufficient data” as: the chunk has at least 2 resolved edges AND no unresolved high-confidence L/B spans.
Step 5: Chat → Note Save Action
Add the ability to save a portion of a chat conversation as a Note. User selects text from the AI’s response, clicks “Save as Note,” and a Note document is created with sourceType = “ai-generated”, attached to the current highlight. The Highlight.noteIds array is updated. The saved note is private by default.
Step 6: Cached Response System
Build the CachedResponse schema and service. After an LLM response receives a thumbs-up (or no negative feedback after serving it multiple times), cache it. On subsequent requests about the same passage, check the cache first. If a high-quality cached response exists, serve it without an LLM call.
Step 7: Feedback Loop
Wire thumbs up/down buttons to the feedback system. Thumbs down on a passage with no L tag creates one. Repeated confusion signals escalate to the judge model. Cache quality scores adjust based on feedback. Test the full loop: bad response → thumbs down → L tag created → future queries include the gap flag → better response.


✅  PHASE 4 DELIVERABLE: User can chat with the AI about any passage. AI cites exact sources from the graph. Clicking a well-annotated passage shows structured graph data without an LLM call. User can save AI responses as notes. Feedback loop creates quality signals that improve future responses. Chat/Note/Graph separation enforced.

7. Per-Query Cost
Phase 4 costs are per-query, not per-book. They scale with usage, not with library size.
Graph Display Mode
$0. Database queries only. No LLM call. This is the preferred mode and handles an increasing fraction of queries as the graph matures.
AI Chat Mode (Claude Opus)
Context input: ~2,000–8,000 tokens depending on graph density. Output: ~200–1,000 tokens. At Claude Opus pricing ($5/MTok input, $25/MTok output): ~$0.01–$0.065 per query. Average: ~$0.03.
For a power user making 50 queries/day: ~$1.50/day = ~$45/month. For 20 queries/day: ~$18/month. This is within the $50–$150/month infrastructure estimate for a single power user.
Cached Responses
$0 after initial generation. The first query about a passage costs ~$0.03. Every subsequent query about the same passage costs $0 if the cached response is served. High-traffic passages amortize to near-zero per-query cost.

8. What Comes Next
Phase 5 — Note Ingestion + Crawler: Bulk upload of handwritten notebooks, parsed by GPT-4o vision, matched to library passages. L-tagged spans from Phase 2 guide where notes are needed most. ArXiv crawler resolves pending S-tagged citations. Both feed new content through the Phase 2→3 pipeline, enriching the graph that Phase 4’s AI partner draws from.
Phase 6 — Full UI/UX: The polished product interface. Library grid, reader with chapter navigation, note panel with rich editor and LaTeX, stylus/draw canvas, standalone notes page, dark mode, tablet optimization, notification system. Built on top of a proven engine.


The graph is the intelligence. The AI is the interface to it.
Every response grounded. Every claim cited. Every gap flagged.

GYDE MVP
Developer Specification
Phase 5: Note Ingestion & Crawler


Jonathan Valenzuela  •  April 2026  •  CONFIDENTIAL

1. What Phase 5 Is
Phase 5 feeds the engine from two new directions. Note ingestion brings in the hidden knowledge layer—professors’ handwritten notebooks, lecture notes, margin annotations—the intermediate reasoning steps that textbooks skip and that no LLM was ever trained on. The crawler brings in the missing citation layer—following unresolved references from ingested books to find their sources on ArXiv and open repositories.
Both feed new content through the existing Phase 2→3 pipeline. Notes are chunked, tagged with @@ spans, embedded, and matched to library passages. Crawled papers are ingested as books. The graph grows from both sides: notes fill the gaps that textbooks left (L-tagged spans), and crawled papers resolve the citations that textbooks pointed to (S-tagged spans).
1.1 Why Notes Are the Origin, Not a Byproduct
In most annotation systems, the book comes first and notes derive from it. In Gyde, notes can come first. A professor uploads a folder of handwritten derivation notes from 20 years of teaching. The system parses them, chunks them, and matches them to passages across the library. The note existed before the highlight. The highlight is the junction that the system creates to connect the note to the relevant passage.
This inversion enables bulk ingestion of the hidden knowledge layer at scale. Without it, every note would require a human to manually find the passage and attach it. With it, a professor drops a folder and walks away.
⚠ This is the architectural foundation: Note.bookId, Note.pageNumber, and Note.highlightId are all OPTIONAL. A note can exist before it is matched to any book. The matching is the system’s job, not the user’s. This was defined in the Phase 1 schema for exactly this reason.
1.2 New Services
noteIngestionService.js: Orchestrates the bulk note upload pipeline. Accepts photos, scans, typed documents. Routes through GPT-4o vision for handwriting parsing. Chunks by concept. Generates @@ spans. Runs vector search against library. Creates matches.
crawlerService.js: Searches ArXiv and open repositories for papers and books. Follows unresolved S-tagged references. Downloads PDFs. Queues them for standard Phase 2→3 ingestion.
matchingService.js: Matches note chunks to library passages. Handles confidence scoring, automatic highlight creation above threshold, and review queue for low-confidence matches.

2. Note Ingestion Pipeline
2.1 Upload
User uploads one or more files: photos of handwritten notes, scanned PDFs, typed documents. The user can optionally provide context to narrow the search:
Which book(s): “These are my notes for Hartshorne.” Narrows matching to that book first.
Subject tags: “Algebraic geometry, sheaf cohomology.” Narrows by concept.
Course / professor / institution: Metadata for future multi-user features. Optional.
No context is required. The system matches blind if no context is given. More context = faster, more precise matching.
2.2 Parsing (GPT-4o Vision)
Every uploaded file is sent page-by-page to GPT-4o vision. The vision model reads handwriting, mathematical notation, diagrams, and returns structured text with LaTeX. This is the same vision model used in Phase 2 for book pages, but the prompt is tuned for handwritten notes (loaded from config/prompts/note-parsing.txt).
Output per note page: structured text with equations in LaTeX, paragraph boundaries detected, key concepts identified.
2.3 Chunking and @@ Spans
Parsed note content is chunked by concept—not by page. A derivation that spans 3 handwritten pages becomes one chunk if it’s a single logical argument. The same @@ span generation system from Phase 2 runs on note chunks: context tags, declarative tags, search-class tags. Notes enter the same metadata pipeline as books.
2.4 Matching to Library
For each note chunk, matchingService runs vector search against the entire library (or against the user-specified book if context was provided). The matching process:
1. Generate embedding for the note chunk.
2. Vector search finds top 20 candidate passages (chunks) ranked by cosine similarity.
3. If the user specified a book, candidates from that book are boosted.
4. For each candidate above MATCH_SIMILARITY_THRESHOLD (defined in config/pipeline.js, default 0.75): create a Highlight document as the junction, attach the NoteChunk to it.
5. For candidates between MATCH_REVIEW_THRESHOLD (default 0.5) and MATCH_SIMILARITY_THRESHOLD: add to review queue. User confirms or rejects.
6. Candidates below MATCH_REVIEW_THRESHOLD: discarded.
2.5 L-Tag Priority Matching
L-tagged spans in the library are matched against incoming notes FIRST, before broad matching. These are the gaps that need notes most—passages where the author said “it is obvious” and no derivation exists. When a note chunk matches an L-tagged span above threshold, the span’s resolved flag is set to true and the note chunk is attached.
L-tagged spans carry confidence, difficulty, and importance suffixes. Matching prioritizes by importance first (which gaps matter most for understanding), then difficulty (matching a professor’s detailed derivation to a high-difficulty gap, a student’s notes to lower-difficulty gaps).
2.6 NoteChunk Schema
Defined in Phase 1 but populated here. One document per logical unit from an uploaded note.
Field
Type
Description
noteId
ObjectId
Reference to parent Note upload. Required.
rawText
String
Parsed text of this chunk.
latexBlocks
[Object]
{raw, renderedUrl}
contextTags
[String]
Context tags from @@ span generation.
concepts
[String]
Concepts extracted.
equations
[String]
LaTeX strings in this chunk.
embedding
[Number]
Vector embedding for matching.
matchedHighlights
[ObjectId]
Highlight junction records created from this chunk.
confidence
[Object]
{highlightId, score} per match.
reviewRequired
Boolean
True if any match was below auto-threshold.
sourceType
String
"handwritten" | "typed" | "scanned"
createdAt
Date



// config/pipeline.js additions
MATCH_SIMILARITY_THRESHOLD: 0.75,   // Auto-create highlight above this
MATCH_REVIEW_THRESHOLD: 0.50,       // Add to review queue above this
MATCH_TOP_K: 20,                    // Candidates per note chunk
L_TAG_PRIORITY_BOOST: 0.15,         // Similarity boost for L-tagged targets
✅  DONE WHEN:
• Upload handwritten notes (photos, scans, PDFs)
• GPT-4o vision parses handwriting + math notation
• Note content chunked by concept, not by page
• @@ span generation runs on note chunks (same pipeline as books)
• Vector search matches chunks to library passages
• Above threshold: automatic Highlight junction created
• Below threshold: added to review queue for user confirmation
• L-tagged spans matched first and prioritized by importance
• One note chunk can attach to multiple books/passages (many-to-many)

3. The Crawler
3.1 What It Does
The crawler searches ArXiv and open-access repositories for papers and books that the library references but doesn’t yet contain. It follows unresolved S-tagged spans—explicit citations to external works that aren’t in the library.
3.2 When It Runs
On demand: User requests: “Find [AM, Ch. 3]” or “Search ArXiv for papers on spectral density in QFT.”
Automatically (background): After a new book is ingested, the system checks all S-tagged spans. For each unresolved citation, it attempts to find the source on ArXiv by matching title, author, and year from the bibliography. Runs as an agenda.js background job.
Batch mode: The user can trigger “Resolve all pending citations” for the entire library. The crawler works through the queue of unresolved S-tagged spans.
3.3 Pipeline
1. Extract search query from the S-tagged span’s bibliography metadata: title, author, year, journal.
2. Search ArXiv API (or other configured repositories) for matching papers.
3. If a match is found: download the PDF.
4. Queue the PDF as a standard upload through the Phase 2→3 pipeline (process-book job).
5. When the crawled paper completes processing, all pending S-tagged spans pointing to it are resolved automatically (Phase 3 re-runs for those spans).
6. If no match found: log the attempt, keep the span as unresolved. The citation remains pending.
3.4 Crawled Book Records
When the crawler finds a match, it creates a Book document with sourceType = “crawl” and sourceUrl = the ArXiv URL. If only metadata is available (paywalled source), it creates a reference-card Book with no pages—just bibliography metadata and the schema ID. The S-tagged spans point to this Book, and the citation resolves automatically if the full text is ever uploaded.
⚠ The crawler downloads papers for internal metadata generation and edge creation. The paper content is used for ingestion (chunking, tagging, edge classification) but is never displayed or distributed to the user as content. Only the metadata, edges, and citations derived from the paper are used in the system’s responses. This is a defensible fair-use position for research tooling, but should be reviewed by legal counsel before scaling beyond the MVP.
// config/pipeline.js additions
CRAWLER_ENABLED: true,              // Toggle crawler on/off
CRAWLER_SOURCES: ['arxiv'],         // Which repositories to search
CRAWLER_MAX_CONCURRENT: 3,          // Max simultaneous downloads
CRAWLER_RETRY_DAYS: 30,             // Retry failed lookups after N days
CRAWLER_AUTO_ON_INGEST: true,       // Auto-crawl after new book ingested
✅  DONE WHEN:
• Search ArXiv API by title/author/year from bibliography metadata
• Download matching papers as PDFs
• Queue crawled papers through standard Phase 2→3 pipeline
• Pending S-tagged spans resolve automatically when source is processed
• Reference-card Books created for paywalled sources (metadata only)
• Manual trigger: user can request specific papers
• Batch trigger: resolve all pending citations in library
• Auto trigger: check S-tagged spans after every new book ingestion

4. The Review Queue
When matchingService produces a match between a note chunk and a library passage with confidence between MATCH_REVIEW_THRESHOLD and MATCH_SIMILARITY_THRESHOLD, it enters the review queue. The user sees the note chunk alongside the candidate passage and confirms or rejects the match.
4.1 Review Queue UI (Minimal)
A simple list view accessible from the testing shell. Each item shows: the note chunk text on the left, the candidate passage text on the right, the confidence score, and two buttons (Confirm / Reject). Confirming creates the Highlight junction and updates the NoteChunk. Rejecting removes the candidate from the queue.
The review queue is also where the crawler’s failed lookups surface. If the crawler couldn’t find a citation, the user sees: “Couldn’t find [AM, Ch. 3] on ArXiv. Upload manually or skip.”
4.2 Review Queue Schema
Field
Type
Description
noteChunkId
ObjectId
The note chunk to be matched.
candidateChunkId
ObjectId
The library passage candidate.
similarity
Number
Cosine similarity score.
status
String
"pending" | "confirmed" | "rejected"
reviewedAt
Date
When user reviewed. Null if pending.
createdAt
Date




5. Phase 5 Build Order
Step 1: Note Upload + Vision Parsing
Build the upload endpoint for notes (POST /api/notes/ingest). Accept photos, scans, PDFs. Send each page to GPT-4o vision with the note-parsing prompt (config/prompts/note-parsing.txt). Store parsed text in Note documents. Create config/prompts/note-parsing.txt tuned for handwritten mathematical content.
Step 2: Note Chunking + @@ Spans
Run the Phase 2 span generation pipeline on parsed note content. Create NoteChunk documents with context tags, embeddings, and search-class tags. Notes enter the same metadata pipeline as books.
Step 3: matchingService.js
Build the matching pipeline: embedding generation, vector search against library, L-tag priority boost, confidence scoring, automatic Highlight creation above threshold, review queue population between thresholds. Test with real handwritten notes matched to an ingested book.
Step 4: Review Queue
Build the review queue UI and API. List view of pending matches. Confirm/reject actions. Update NoteChunk and Highlight documents accordingly.
Step 5: crawlerService.js
Build the ArXiv search integration. Extract queries from S-tagged span bibliography metadata. Search ArXiv API. Download matching PDFs. Queue for Phase 2→3 ingestion. Handle no-match cases (log, keep pending).
Step 6: Auto-Triggers
Wire the crawler to run automatically after new book ingestion (if CRAWLER_AUTO_ON_INGEST is true). Wire note matching to prioritize L-tagged spans. Wire S-tagged span resolution to trigger when a crawled paper finishes processing. Test the full cycle: upload a book with citations → crawler finds the cited paper → cited paper ingested → S-tagged spans resolve automatically.


✅  PHASE 5 DELIVERABLE: Upload handwritten notes → parsed by vision → chunked → matched to library passages automatically. L-tagged gaps filled first. Crawler resolves pending citations from ArXiv. Review queue for low-confidence matches. The graph grows from both notes (hidden knowledge) and crawled papers (missing citations).

6. Cost
Note Ingestion
Per note page: GPT-4o vision (~$0.01–$0.03) + span generation (~$0.005) + embedding (~$0.0001). Total: ~$0.02–$0.04 per handwritten page. A 100-page notebook: ~$2–$4.
Matching (vector search + auto-highlight creation): database operations only, no LLM. $0.
Crawler
ArXiv API search: free. PDF download: free. Ingestion of crawled paper: same as any book (~$9–$20 depending on length and citation density). For 50 crawled papers (average 10 pages each): ~$2.50–$10 in vision + metadata, negligible edge costs since papers are short.
Total Phase 5
Highly variable. Depends on how many notes the user uploads and how many citations the crawler resolves. For the founder’s MVP usage: a few hundred handwritten note pages (~$5–$15) plus 20–50 crawled papers (~$5–$25). Total: $10–$40.

7. What Comes Next
Phase 6 — Full UI/UX: The polished product interface. Library grid with covers and collections. Polished reader with chapter navigation and smooth page transitions. Note panel with rich editor, LaTeX via MathJax, and stylus/draw canvas with GPT-4o vision conversion. Standalone notes page. Dark mode. Tablet optimization. Notification system. Projects mode for scoped research workspaces. This is the consumer-facing product built on top of the proven engine from Phases 1–5.


Notes are the hidden knowledge. Citations are the missing links.
Phase 5 is how the graph grows beyond what any single book contains.

