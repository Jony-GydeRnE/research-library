# PHASE 2: Ingestion Pipeline & Metadata Intelligence

# This spec will be populated when Phase 1 UI is stable.
# See Gyde_Research_Library_Specs.pdf for full details.

# PHASE 2: Ingestion Pipeline & Metadata Intelligence

> Replace this file's contents into your project's CLAUDE_PHASE2.md.
> Claude Code: read this file when told to "start Phase 2" or "build the metadata engine."
> Do NOT build Phase 2 features while Phase 1 UI work is active.

---

## What Phase 2 Does

Phase 2 transforms the reading shell into an intelligent research library. Every page of every book gets processed by AI to produce structured metadata. When complete, every passage is tagged, categorized, and searchable.

**User-visible changes after Phase 2:**
- Chapter titles and section titles appear in the reader sidebar
- Equations render correctly (vision model preserves LaTeX)
- Search bar finds passages by concept across the entire library
- Book processing status shows metadata generation progress

**Phase 2 has zero user-facing AI chat changes.** The chat already works from Phase 1. Phase 2 is entirely background processing.

---

## New Environment Variables

```
OPENAI_API_KEY=        # Already set — GPT-4o vision + Nano
ANTHROPIC_API_KEY=     # Already set — Claude for judge model
SPAN_MODEL=gpt-4o     # Model ID for @@ span generation
JUDGE_MODEL=claude-opus-4-6  # Model ID for quality judge
NANO_MODEL=gpt-5.4-nano-2026-03-17      # Model ID for surface metadata (cheapest available)
VISION_MODEL=gpt-4o          # Model ID for page image processing
```

⚠ Model IDs are env vars, not hardcoded. Swapping a model = changing one env var.

---

## New Files to Create

```
services/
  spanService.js          # @@ span annotation generation + session management
  chunkService.js         # Groups spans into logical chunks
  embeddingService.js     # Vector embeddings for chunks and spans
  judgeService.js         # Quality monitoring — samples span outputs
  taxonomyService.js      # Normalizes tags/concepts to canonical terms

config/
  pipeline.js             # All configurable thresholds and model settings
  prompts/
    span-generation-full.txt    # Full prompt with gold-standard examples
    span-generation-short.txt   # Short prompt for subsequent chunks
    surface-metadata.txt        # Nano prompt for topics/concepts extraction
    judge-rating.txt            # Judge model prompt for 0-9 quality rating

models/
  Span.js                 # New schema
  Chunk.js                # New schema (may already exist — update if so)
  QualityScore.js         # New schema (may already exist — update if so)
```

---

## Pipeline Config (config/pipeline.js)

```javascript
module.exports = {
  // Vision processing
  VISION_PAGES_BATCH_SIZE: 5,       // Pages per batch to vision model

  // Span generation
  SPAN_SESSION_RESET_THRESHOLD: 6,  // Judge score 0-9; below this triggers reset
  SPAN_JUDGE_SAMPLE_RATE: 10,       // Judge every Nth chunk
  SPAN_SESSION_MAX_CHUNKS: 200,     // Max chunks before forced session reset

  // Search-class confidence: each letter a-z ≈ 3.84% (a≈4%, z≈100%)
  // Used in span annotations and edge classification

  // Embeddings
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: 1536,

  // Future Phase 3 settings (define now, use later)
  STOPPING_CONFIDENCE: 't',         // ~77% on a-z scale
  MAX_COMPARISONS_PER_SPAN: 5,
  NANO_ESCALATION_THRESHOLD: 'm',
  CANDIDATE_CEILING_I: 5,
  CANDIDATE_CEILING_S: 20,
  CANDIDATE_CEILING_B: 20,
  SIMILAR_BOOKS_LIMIT: 10,
  OPUS_TOP_K: 5,
  TRANSITIVE_MAX_DEPTH_ASSUMES: 3,
  TRANSITIVE_MAX_DEPTH_EXTENDS: 5,
  TRANSITIVITY_JOB_INTERVAL: '1 hour',

  // Chat context (already in use from Phase 1)
  CHAT_CONTEXT_BUDGET: 8000,
  CHAT_MODEL: 'claude-opus-4-6',
  CHAT_STREAMING: true,
  CHAT_MAX_HISTORY: 20,
};
```

---

## Schema: Span

```javascript
// models/Span.js
const spanSchema = new mongoose.Schema({
  bookId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  pageNumber:       { type: Number, required: true },
  chunkId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk', default: null },
  sentenceStart:    { type: Number, required: true },
  sentenceEnd:      { type: Number, required: true },
  contextTags:      [String],    // e.g. ["free_propagator", "definition"]
  declarativeTags:  [{
    type:        String,          // p/a/c/e/r/q/s/k/x/d/v
    targetChunk: Number,
    targetTag:   Number,
  }],
  searchClass:      { type: String, enum: ['N', 'L', 'I', 'S', 'B'], default: 'N' },
  searchConfidence: { type: String, default: null },  // single letter a-z
  resolved:         { type: Boolean, default: false },
  resolvedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'Edge', default: null },
  regexFlags:       [String],    // e.g. ["missing_proof", "citation:AM_Ch3"]
  embedding:        [Number],
  createdAt:        { type: Date, default: Date.now },
});
```

---

## Schema: Chunk (update existing or create)

```javascript
// models/Chunk.js — if it already exists, ADD these fields
const chunkSchema = new mongoose.Schema({
  bookId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  chapterNumber:     Number,
  sectionTitle:      String,
  chunkIndex:        { type: Number, required: true },  // sequential within book
  pageNumber:        Number,
  sentenceStart:     Number,
  sentenceEnd:       Number,
  spanIds:           [{ type: mongoose.Schema.Types.ObjectId, ref: 'Span' }],
  structuralType:    { type: String, enum: ['theorem', 'definition', 'proof', 'example', 'remark', 'narrative', 'notation', 'equation', 'unknown'] },
  contextTags:       [String],   // union of all span context tags
  searchClasses:     [String],   // union of search-class tags from spans
  hasUnresolvedSpans: { type: Boolean, default: false },
  nextChunkId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  prevChunkId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  embedding:         [Number],
  wordCount:         Number,
  sourceText:        String,     // the actual text this chunk covers
  createdAt:         { type: Date, default: Date.now },
});
```

---

## Schema: QualityScore

```javascript
// models/QualityScore.js
const qualityScoreSchema = new mongoose.Schema({
  bookId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  chunkId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  score:           { type: Number, min: 0, max: 9, required: true },
  sessionId:       String,
  modelUsed:       String,
  judgeModelUsed:  String,
  triggeredReset:  { type: Boolean, default: false },
  createdAt:       { type: Date, default: Date.now },
});
```

---

## Updated Schema: Page (add fields, don't remove existing)

Add these fields to the existing Page model:

```javascript
rawTextLegacy:       String,     // Original pdf-parse text, preserved for highlight re-mapping
visionProcessed:     { type: Boolean, default: false },
structuralAnnotations: [{        // Regex-detected signals
  type: String,                  // "theorem", "definition", "missing_proof", "citation", "equation"
  sentenceRange: [Number],
  value: String,                 // e.g. "it is obvious that" or "[AM, Ch. 3]"
}],
chunkIds:            [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' }],
spanIds:             [{ type: mongoose.Schema.Types.ObjectId, ref: 'Span' }],
```

---

## Build Order — Follow Exactly

### Step 1: Vision-Model Page Processing

Upgrade the existing process-book agenda.js job. After pdf-parse runs (Phase 1 behavior), add a second stage:

1. For each page, convert the PDF page to an image (use `pdf-poppler` or `sharp` to rasterize)
2. Send the image to GPT-4o vision with this prompt: "Read this page from a STEM textbook. Return the complete text preserving all mathematical equations in LaTeX (using \\( \\) for inline and \\[ \\] for display). Preserve section headers, theorem/definition labels, and paragraph structure. Return structured text, not a description of the page."
3. Store the vision output in `Page.rawText` (replacing pdf-parse output)
4. Preserve original pdf-parse text in `Page.rawTextLegacy`
5. Set `Page.visionProcessed = true`
6. Re-map Phase 1 highlights by matching `selectedText` against new rawText

⚠ This is the most expensive step but runs once per page. Quality of everything downstream depends on this.

✅ DONE WHEN: Pages have vision-processed text with LaTeX equations preserved. Reader shows improved text. Old highlights still work.

### Step 2: Regex Pre-Annotation

After vision processing, scan each page's text with regex:

```javascript
// In pdfService.js or a new regexService.js
const MISSING_PROOF_PATTERNS = [
  /it is obvious that/gi,
  /the reader may verify/gi,
  /it follows immediately/gi,
  /it is trivial/gi,
  /it can be shown/gi,
  /one easily checks/gi,
  /left as an exercise/gi,
];

const CITATION_PATTERN = /\[([A-Za-z]+(?:\d{2,4})?(?:,\s*(?:Ch\.|Thm\.|Prop\.|Sec\.|p\.)\s*[\d.–-]+)?)\]/g;

const NAMED_ENV_PATTERN = /^(Theorem|Definition|Lemma|Proposition|Corollary|Proof|Example|Remark)\s*[\d.]*\s*/gm;
```

Store results in `Page.structuralAnnotations`. These are free signals — no AI cost.

✅ DONE WHEN: Every page has structural annotations. Missing-proof phrases flagged. Citations extracted.

### Step 3: Surface Metadata Extraction (Nano — cheap)

Use the cheapest model (GPT-4o-mini or equivalent) to extract per-page metadata:

```
Prompt (surface-metadata.txt):
Given this page from a STEM textbook, return JSON:
{"topics": [...], "concepts": [...], "equations": [...], "chapterTitle": "...", "sectionTitle": "...", "academicLevel": "graduate"}
Be concise. Max 5 topics, 5 concepts. Equations as LaTeX strings.
```

Input: ~200 tokens/page. Output: ~20 tokens. Cost: ~$0.02 per book. Essentially free.

Populate: `Page.topics`, `Page.concepts`, `Page.equations`, `Book.tags`, `Book.keyConcepts`, `Book.summary`, `Book.chapterSummaries`, `Book.academicLevel`, `Book.documentType`.

All terms normalized through `taxonomyService.js` (simple synonym map for now).

✅ DONE WHEN: All empty Phase 1 metadata fields populated. Book summary generated. Chapter boundaries detected.

### Step 4: @@ Span Generation (Core Intelligence Step)

This is the heart of the system. For each section of text, a mid-tier LLM generates span annotations in compressed DSL format.

**The DSL format — one line per span:**
```
1-3 free_propagator definition
4-5 spectral_density r7.2 Iv
6-8 completeness_relation a3.1 Bt
9 Ls
10-12 lehmann_kallen_form p7.2 s3.1
```

**Tag types on each line:**
- **Context tags** (lowercase): concept labels — `free_propagator`, `flat_module`
- **Declarative tags** (letter + target): relationships — `p14.3` = proves chunk 14 tag 3
  - p=proves, a=assumes, c=contradicts, e=extends, r=prerequisite, q=equivalent, s=supports, k=special_case, x=example_of, d=data_for, v=figure_ref
- **Search-class tags** (uppercase + confidence): what cross-reference resolution is needed
  - N=no search (implicit, never output), L=logical gap, I=internal ref, S=specific external source, B=broad search
  - Confidence suffix a-z where each letter ≈ 3.84% (a≈4%, z≈100%)

**Session management:**
- New session: full prompt with 3-5 gold-standard examples (~2000-3000 input tokens)
- Subsequent chunks: short prompt (~200-500 tokens) referencing format by name
- Judge model (Step 6) detects quality drift → triggers new session with full prompt
- Cycle: full prompt → short prompts (cheap) → drift → new session → repeat
- Each cycle covers 50-200 chunks before reset

**Output per chunk:** ~15-30 tokens in compressed DSL (5-10x cheaper than prose)

Build `spanService.js` with:
- `generateSpans(pageText, sentenceNumbers, preAnnotations, isNewSession)`
- `parseSpanOutput(dslOutput)` → returns array of Span objects
- `startNewSession()` / `continueSession()`
- Load prompts from `config/prompts/span-generation-full.txt` and `span-generation-short.txt`

✅ DONE WHEN: Every section produces Span documents with context tags, declarative tags, and search-class tags.

### Step 5: Chunk Derivation

Chunks are derived FROM spans, not imposed before. Build `chunkService.js`:

1. Group consecutive spans into logical units (theorem + proof together, definition + first use together)
2. Create Chunk documents with sequential pointers (`nextChunkId`, `prevChunkId`)
3. Set `structuralType` based on contained spans
4. Aggregate `contextTags` and `searchClasses` from child spans
5. Set `hasUnresolvedSpans` flag
6. Link back to Page via `pageNumber` and sentence range

✅ DONE WHEN: Chunks exist for every book. Reading order reconstructable via sequential pointers.

### Step 6: Quality Monitoring (Judge Model)

Build `judgeService.js`. Uses Claude Opus (different company from span generation model).

1. Sample every Nth chunk (configurable via `SPAN_JUDGE_SAMPLE_RATE`)
2. Send to judge: source text + span annotation + 2-3 gold-standard examples
3. Judge outputs single digit 0-9
4. Store in QualityScore collection
5. Compute rolling average per session
6. Below `SPAN_SESSION_RESET_THRESHOLD` → trigger new session in spanService

Output per judgment: 1 token. Very cheap even with expensive model.

✅ DONE WHEN: Quality scores tracked. Below-threshold triggers session reset. Scores visible in server logs.

### Step 7: Embeddings + Search

Build `embeddingService.js`:

1. Generate vector embedding for every Chunk (from sourceText)
2. Generate embedding for every Span with concept tags
3. Store as arrays on the document
4. Create MongoDB Atlas Vector Search index on Chunk.embedding

Build search endpoint:
- `GET /api/search?q=spectral+density`
- Combines full-text search (MongoDB text index on contextTags) with vector search (embedding similarity)
- Returns: book title, chapter, page number, matched text snippet, relevance score
- Clicking result navigates to reader at that page

✅ DONE WHEN: Search bar on library page works. Natural-language queries find passages across all books.

---

## Cost Per Book (800 pages, ~3,500 chunks)

| Component | Cost |
|-----------|------|
| Vision processing (GPT-4o) | ~$1.50 |
| Surface metadata (Nano) | ~$0.23 |
| @@ Span generation (mid-tier) | ~$2.00–$5.00 |
| Quality monitoring (Opus) | ~$0.55 |
| Embeddings | ~$0.10 |
| **TOTAL** | **~$4.38–$7.38** |

For a 50-book library: $219–$369 one-time ingestion.

---

## What NOT to Build in Phase 2

- No cross-book edges (Phase 3)
- No edge classification pipeline (Phase 3)
- No note ingestion / handwriting parsing (Phase 5)
- No ArXiv crawler (Phase 5)
- No changes to the AI chat behavior (Phase 1 chat keeps working as-is)

Phase 2 is purely background processing. The user uploads a book, it processes silently, and the library gets smarter.