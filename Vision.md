#Vision.md


GYDE
Reconstructing the Logical Structure of Knowledge
and Making It Navigable


Internal Vision Document — Final Version
Jonathan Valenzuela
April 2026

CONFIDENTIAL

1. The Problem
Knowledge is fragmented, implicit, and non-computable.
The world’s scientific and mathematical knowledge suffers from three structural failures that no amount of model intelligence can overcome:
Fragmentation. The proof of a theorem may depend on results spread across three books, two papers, and a set of lecture notes, none of which reference each other. A human reader must discover these connections manually. No machine system currently maps them.
Implicitness. Advanced textbooks routinely skip intermediate reasoning steps. Phrases like “it is obvious,” “the reader may verify,” and “it is trivial” replace pages of careful argument that the author considers routine—but that a graduate student needs and that an LLM was never trained on, because those steps were never written down in any published source.
Non-computability. Even where knowledge exists in published form, it is not structured in a way that machines (or humans) can traverse programmatically. There is no graph of typed logical dependencies between claims across the corpus. The knowledge exists as flat text, not as navigable structure.
These failures produce a specific, measurable consequence: Large Language Models hallucinate on advanced mathematics and physics. Not because they lack reasoning ability, but because their training data contains systematic gaps at exactly the points where rigor matters most.
The Empirical Evidence
Hartshorne’s Algebraic Geometry, Lemma III.12.3: a standard result on replacing bounded complexes with free resolutions over Noetherian rings. When asked to prove this lemma, ChatGPT produced a structurally plausible sketch that collapsed at the critical inductive step—replacing the actual construction (two sets of generators with explicitly defined differentials) with English sentences like “extra elements are forced into boundaries.”
Grok initially certified the proof as correct. Only after being shown the actual pages from Hartshorne (pp. 283–284) did Grok reverse its assessment, acknowledging the proof was “incomplete” and “would be marked down by an instructor.”
This demonstrates three things: LLMs cannot reliably reconstruct niche proofs. LLMs evaluating other LLMs cannot detect the errors without source material. And grounding on the actual text immediately enables correct evaluation.
The failure has two distinct causes. The first is statistical: probabilistic methods over a general training data set assign vanishingly small probability to the exact word sequences needed for specialized proof constructions. Targeted source material closes this gap immediately—Grok went from wrong to right the moment it saw two pages of Hartshorne. The second cause is deeper: phrases like “it can be shown” and “the reader may verify” mean the proof was never written down in any published source. The training data doesn’t just underrepresent these steps—it doesn’t contain them at all. No amount of model scaling fixes missing data.
The Hidden Knowledge Layer and the Missing Citation Layer
The intermediate reasoning steps that textbooks skip were never published. But they were written down—in professors’ handwritten notebooks, in lecture notes passed between students, in margin annotations, in office hour explanations. Millions of pages of this material exist, almost entirely undigitized. They will vanish from the historical record unless they are collected. Academics should be able to upload personal notes in any format, optionally specify what book or tags the notes are for, and have the system match chunks of their notes to the chunks in corresponding books.
But missing notes are only half the problem. Published books routinely cite other books without resolving the citation to a specific passage. Hartshorne writes “see [AM, Ch. 3]”—a pointer to an entire chapter, not to the exact theorem that justifies the current step. When the system has both books, it resolves that pointer automatically: not “go read Atiyah-Macdonald” but “here is the specific passage on page 47 that completes this argument.” When a book skips a proof entirely—“it can be shown” with no reference at all—the system searches the corpus and auto-generates the missing citation. For every sentence or group of sentences that makes a claim, the system attempts to find or generate a citation that grounds it, whether the original author provided one or not.
Highlights are citations. Every connection the system creates between two passages is a citation that the original author either left vague, omitted entirely, or never thought to include. The system does not merely animate existing references—it generates new ones, enriching every book’s rigor beyond what its author provided.
When a referenced source is not yet in the library, the system extracts its bibliographic metadata (title, author, year, publisher) and assigns it a persistent schema ID before the source is ever uploaded. The unresolved reference is stored as a pending citation—pointing to a node that does not yet have content. When a matching document is later ingested—by user upload or automated crawling of ArXiv and open repositories—the system immediately resolves all pending references by running cross-book matching against every passage that cited it.
This is Gyde’s data moat. It operates on two fronts simultaneously: digitizing the hidden knowledge layer (notes that were never published) and grounding the citation layer (references that were published but never resolved to specific passages, and claims that were never cited at all). Notes and books enter the same pipeline, produce the same metadata, generate the same typed edges. Both are sources. Both create highlights. Both enrich the graph.
2. What Gyde Is
Gyde is a centralized education and research platform built on a knowledge graph of typed logical connections between academic content. The platform maps knowledge across a network of academic profiles, enabling users to upload content (notes, homework, research papers, textbooks), sell intellectual products and services, and access AI systems grounded on the structured corpus rather than on raw training data.
The for-profit entity is GydeRnE (Guiding Research & Education). The nonprofit entity is GydeNPO, which owns 51% of GydeRnE, distributes 50% of GydeRnE profits to professors and students, and is governed by a board consisting of at least 50% professors democratically elected by GydeRnE users. Board members serve limited terms (Elected Officials: 5-year terms, max three; Chairman: 10-year terms, max two). Board members cannot hold GydeRnE shares. All votes and financial flows are recorded on blockchain.
GydeNPO Dividends (50% of GydeRnE profits) are split equally between student funds and professor funds. Student funds cover free tutoring, student-led project grants, and school/university financing. Professor funds follow a tiered structure culminating in the Gyding Awards—five prizes for decade-defining contributions in Mathematical Physics, Technical Engineering, Physical Sciences, Social Sciences, and Liberal Arts.
The MVP is a personal AI-powered research library called GydeMVP. It is the engine that powers the full platform: the same ingestion pipeline, metadata generation, and edge classification system that serves a single researcher’s library will eventually serve any academic user across the Gyde network.
3. The Core Thesis
Edges, Not Content, Are the Product
The analogy is Palantir. Palantir’s Gotham platform takes disparate intelligence data sources and the value is not in any single source—it is in the typed edges between entities. Without edges, analysts drown in disconnected files. With edges, patterns emerge that no single document reveals. Gyde does the same for knowledge. Without edges, the LLM sees only whatever single document you pointed it at. With edges, it traverses from the gap in Hartshorne to the explanation in Atiyah-Macdonald to the worked example in someone’s notebook. That traversal is the product.
Notes Are the Origin, Highlights Are Derived
The standard annotation model assumes users read a book, highlight passages, and attach notes afterward. Gyde inverts this. Users bring existing notes. The system parses them, chunks them, and automatically matches those chunks to relevant passages across every book in the library. The highlight is a junction record created by the system, not a manual act by the user. This inversion enables bulk ingestion of the hidden knowledge layer at scale.
LLMs Recognize Relationships Better Than They Construct Proofs
LLMs may be much better at recognizing that A implies B than at constructing the proof. This asymmetry is the foundation of the edge generation system. A system that asks “Does A prove B?” exploits the recognition ability without depending on the construction ability. The hypothesis: rated relation labels may already capture a surprisingly large fraction of the useful logical structure in a corpus.
4. The Architecture
4.1 Ingestion Pipeline
Page-Level Processing via Vision Models
Books and papers enter the system in whatever source format is available—PDF, HTML, or plain text—but PDF remains the most common archival source. Internally, Gyde should not treat PDF as the primary interaction surface. PDF is the source artifact and verification layer; the primary interaction surface should be a structured, rendered document view derived from parsed text, equations, spans, and chunks.
This distinction matters. PDF preserves visual fidelity and page authority, but it is rigid, layout-heavy, and poorly suited for dynamic interaction, graph overlays, chunk-aware highlighting, and AI-grounded navigation. A rendered document layer (HTML/text-based) is more flexible, addressable, and future-proof. It enables responsive layouts, direct span/chunk anchoring, better note attachment, cleaner citation jumps, and richer graph visualization.
Therefore, Gyde’s long-term architecture should be:

PDF (or original source) as the archival source of truth
Structured document representation as the canonical internal interaction layer
Rendered HTML/text view as the primary user-facing reading surface
Original PDF view preserved as a verification and fallback mode
Structural Type Detection (Pre-LLM, Free)
Before any LLM call, the system detects chunk types from PDF formatting markers: named environments (“Theorem 3.4,” “Definition 1.1”), bold/italic headers, indentation patterns. Regex on extracted text also catches missing-proof phrases (“it is obvious that,” “the reader may verify,” “it follows immediately”) and bibliography citations. These free signals feed directly into the search-class triage system described below.
The @@ Span Annotation System and Output DSL
The core metadata pass. For each section of text, a micro-LLM generates span annotations identifying the semantic role of each meaningful unit. The output uses a compressed machine-readable domain-specific language (DSL) — not prose summaries, not echoed source text. The source text already exists in the system; the LLM outputs only pointers, codes, and labels.
Tag types. Every span can carry up to three types of tags on a single line:
Context tags are open-ended concept labels that grow with the corpus. They are written in lowercase: propagator, flat_module, spectral_density, completeness_relation. These describe what the span is about.
Declarative tags define typed relationships between spans. They use a single lowercase letter from a finite codebook followed by a chunk.tag target reference:
p = proves, a = assumes, c = contradicts, e = extends, r = prerequisite, q = equivalent, s = supports, k = special case, x = example of, d = experimental data for, v = visualization/figure reference
Example: p14.3 means "this span proves the claim at chunk 14, tag 3." The target reference uses the structural ID system: book → chapter → section → chunk → tag, with only the chunk and tag numbers needed when operating within the same book.
Search-class tags indicate what kind of cross-reference resolution the span needs. They use a single uppercase letter optionally followed by a lowercase confidence letter (a–z, where each letter ≈ 3.84% increment, a ≈ 4%, z ≈ 100%):
N = no search needed (implicit — spans without a search-class tag are N by default, so this tag is never output), L = logical gap awaiting notes, I = internal same-book reference, S = specific external source cited, B = broad external search needed
L and B always carry a confidence suffix. I carries a confidence suffix. S has no suffix — the system will check when the source is available. Examples: Bz = broad search, 100% confident another book has it. Ls = logical gap, ~73% confident notes would help. Iv = internal reference, ~85% confident.
Output format. One line per span. Sentence range first, then all tags for that span separated by spaces. All context tags, declarative tags, and search-class tags for a span appear on the same line:
1-3 free_propagator definition 
4-5 spectral_density r7.2 Iv 
6-8 completeness_relation a3.1 Bt 
9 Ls 
10-12 lehmann_kallen_form p7.2 s3.1
Line 1: sentences 1-3, context tags "free_propagator" and "definition," no search class (implicitly N). Line 2: sentences 4-5, context tag "spectral_density," declarative tag r (prerequisite) pointing to chunk 7 tag 2, search class I (internal reference) with confidence v (~85%). Line 3: sentences 6-8, context tag "completeness_relation," declarative tag a (assumes) pointing to chunk 3 tag 1, search class B (broad search) with confidence t (~77%). Line 4: sentence 9, search class L (logical gap) with confidence s (~73%). Line 5: sentences 10-12, context tag "lehmann_kallen_form," declarative tag p (proves) chunk 7 tag 2, declarative tag s (supports) chunk 3 tag 1.
Each line is roughly 4-8 tokens. A typical chunk produces 3-5 annotation lines. Total output per chunk: ~15-30 tokens in compressed DSL. This is 5-10x cheaper than natural-language annotation output and easier for the system parser to convert into graph nodes and edges.
The LLM receives gold-standard examples of this format during the full vision prompt at the start of each ingestion session. During normal operation, shorter prompts reference the format by name without repeating examples. When the judge model detects format drift or quality degradation, a new session is initialized with the full prompt.
Search-Class Tags: N / L / I / S / B
During span generation, the LLM also assigns a search-class tag to every span that may need justification. Search-class tags are assigned at the span level and propagated upward to the containing chunk only for scheduling and budgeting. The five classes:
N (null). No search needed. Self-contained, routine. No suffix. This tag is implicit—spans without any flag are N by default. The LLM does not output N tags; their absence is the signal.
L (logical gap). Internal reasoning step that another book cannot resolve. The derivation exists within the text’s own logical framework but the author compressed it. A professor’s notes would fill this in. No cross-book search. Suffix: a–z confidence that notes would resolve it (a ≈ 3.84%, z ≈ 100%, each letter ≈ 3.84% increment). Example: Ls = logical gap, ~73% confident notes would help.
I (internal reference). Cites another section, theorem, or lemma in the same book. The system knows the target location. Suffix: a–z confidence the internal reference resolves the gap. Example: Iv = internal ref, ~85% confident. Often very high since the section number is known.
S (specific external source). Cites a named external book or paper. No confidence suffix needed—the system will check when the source is available. If the cited source is in the library, comparison runs immediately. If not, the system creates a Book record with schema ID from bibliography metadata and stores the span as a pending citation.
B (broad external search). No citation, no internal reference. “It can be shown,” unstated identities, results asserted without source. Suffix: a–z confidence that another book in the corpus would contain the justification. Example: Bt = ~77% confident.
This classification determines which chunks enter which comparison pipeline and at what cost. It is the primary cost-control mechanism in the entire system.
Chunks Derived from Spans
Chunks are not imposed before the LLM sees the text. They are derived after @@ span generation. A grouping algorithm clusters spans into coherent logical units: a theorem statement and its proof stay together, a definition and its first use stay together. Pre-LLM splitting exists only for context window management. Each chunk carries sequential pointers (next_chunk_id, prev_chunk_id) to reconstruct reading order without LLM involvement.
ISBN/Hash Deduplication and Embedding Generation
Duplicate uploads detected via ISBN or text hash. Each chunk and each @@ span with a concept label receives a vector embedding at ingestion time.
4.2 Quality Monitoring and Model Routing
Multi-Model Routing by Task
Strongest math/physics model (Claude Opus 4.6): Edge classification (Y/N + relevance + confidence). Cheap output: 3 characters per question. Also the judge model for quality auditing.
Mid-tier model (GPT-4o): @@ span generation on dense mathematical text. One pass per section at ingestion time.
Cheapest model (GPT-5.4 Nano): Surface metadata, broad-sweep edge comparisons. High volume, low cost.
Vision model (GPT-4o vision): Page image processing during ingestion.
Judge Model System
A separate model from a different AI company samples a fraction of @@ span outputs (every 10th–100th chunk depending on quality consistency) and rates them 0–9 against gold-standard examples. When the quality score drops below threshold, the system re-injects the full vision prompt with 3–5 gold-standard examples into the generation model’s context. During normal operation, the generation model receives a shorter prompt. The full prompt is the expensive reset; short prompts are the cheap default. This prompt degradation monitoring keeps metadata quality stable over long ingestion runs.
Quality Convergence Cycle
The quality monitoring system operates in cycles. A new ingestion session begins with the full vision prompt: the project's goals, the complete @@ annotation specification, the compressed output DSL format, and 3-5 gold-standard examples of correctly annotated chunks. This is expensive but sets the quality baseline. Subsequent chunks receive shorter prompts that rely on the model's in-context memory of the standard. The judge model samples periodically. When the quality score drops below threshold, the system does not patch the existing session — it creates a new session with the full vision prompt, resetting the model's context entirely. The cycle repeats: full prompt → short prompts (cheap) → drift detected → new session with full prompt. Each cycle typically covers 50-200 chunks before needing a reset, depending on text density and mathematical complexity. This is the primary mechanism for maintaining consistent metadata quality at scale.
A separate concern is hallucination detection in the user-facing AI research partner. The judge model can also sample AI chat responses, comparing claims against the source text and edge graph. If the AI asserts something that has no grounding in the corpus and no supporting edge path, the judge flags it. Over time, flagged responses can be used to tighten the research partner's system prompt. This is distinct from the ingestion quality cycle — it monitors the output layer, not the metadata layer.
Multi-Company AI Sourcing
Different AI companies handle different stages: one generates metadata, another judges it, a third handles the user-facing research assistant. This optimizes cost (best model per task regardless of provider) and protects privacy (no single company sees the complete data flow).
4.3 Cross-Reference Resolution Pipeline
Not every chunk deserves cross-book comparison. The search-class tags (N/L/I/S/B) assigned during span generation determine which chunks enter which pipeline. Once a flagged span within a chunk receives a resolved citation, that span is marked complete and no further comparisons are run for it—even if the containing chunk has other unresolved spans, those are treated independently. Similarity searches are driven by the span of interest, not the entire chunk.
The Ordered Top-K Hypothesis:
The system does not treat candidate lists as unordered sets. When the triage pipeline produces candidate chunks for comparison, they are ranked by expected relevance before any expensive evaluation runs. Our hypothesis: the first 1-5 candidates in a well-ranked list will resolve most flagged spans. This is because the triage system (I/S/B classification + book-level scoping + embedding similarity + bibliography weighting) already narrows to the right neighborhood, and ranking within that neighborhood front-loads the most relevant matches. Evaluation proceeds in ranked order and stops early when the stopping rule is satisfied. Later candidates are genuinely less likely to add new information. This hypothesis is testable and should be validated empirically during the MVP phase. We will define the ranking system with the proceeding categories and procedures.
Category N — No Action (~50–65% of chunks)
Routine content: notation, definitions, examples, connective text. No search. $0.
Category L — Logical Gap, Awaiting Notes (~10–16%)
Internal reasoning steps compressed by the author. No cross-book search—no other book contains the intermediate step in this specific argument. The span is tagged so the note ingestion pipeline knows where derivation notes are most needed. When anyone uploads notes for this book (or a similar book), L-tagged spans are matched first. The confidence suffix (a–z) helps prioritize which gaps are shown in the “gaps needing notes” view. $0 for cross-book search.
Category I — Same-Book Resolution (~15–25%)
Explicit internal references. The system looks up the cited section/theorem. Top 5 candidate chunks from the known location (ceiling; average likely 2–3), evaluated by Nano. If Nano confidence is low on any pair, that specific pair escalates to Opus. If nothing found in top 5, Nano sweeps the next 15 candidates from the broader chapter.
Stopping rule: stop when a strong edge is found with confidence ≥ t on the a–z scale (t ≈ 77%, meaning the model is highly confident the relationship holds), or when two or more consistent medium-confidence edges point to the same concept cluster, or when the next candidates have the same tags as already-tested ones (redundancy), or when the per-span comparison budget is exhausted (5 comparisons).
Category S — Specific External Source (~0–15%, highly book-dependent)
Explicit citations to named external works. If the cited book is in the library: deterministic narrowing within the cited source (cited chapter, matching theorem numbers, shared concept tags) produces 10–20 compact candidate cards (chunk ID, type, top 3 tags—~15 tokens each). One Opus call picks an ordered top 5 by outputting 5 ID numbers (~5–10 tokens). Opus then evaluates candidates in ranked order, stopping early per the stopping rule above. Average resolution: 2–3 comparisons.
If the cited book is NOT in the library: the system creates a Book record with schema ID from bibliography metadata, stores the S-tagged span as a pending citation, and resolves automatically when the source is uploaded or crawled. $0 until then. Optionally, the system can assign a confidence suffix to S tags to indicate priority of verification—useful when comparison costs are high and budgeting is needed, ie Sa is low priority and Sz is highest priority.
Category B — Broad External Search (~2–7%, upper-bound ~15% for citation-heavy texts)
No citation, no internal reference. The most expensive class, but the rarest. Embedding similarity (driven by the flagged span, not the whole chunk) finds the top 20 candidates across the 10 most similar books + prerequisite books + project-local books. Nano evaluates all 20 pairs (broad sweep for soft edges like supports, related-to). The top 5 Nano hits ranked by relevance escalate to Opus for strict evaluation in ranked order, stopping early per the stopping rule.
Edge Output Format
For all edge classification calls (I, S, B), the prompt presents both chunks and asks the full set of relationship questions:
A = [chunk text]
B = [chunk text]

Does A prove B? Does A assume B? Does A contradict B?
Does A extend B? Is A prerequisite for B? Is A equivalent to B?
Does A support B? Is A a special case of B?

Reply: 3 characters per line, Y/N + relevance (a-z) + confidence (a-z).
Example:
Yza
Nma
Nta
Yqc
Where Y/N = relationship exists. First letter = relevance (a=low, z=high). Second letter = confidence (a=very confident, z=very uncertain). Example: Yza = yes, highest relevance, very confident. Nma = no relationship, medium relevance, very confident. Each letter increment ≈ 3.84%.
Graph Evolution Over Time:
The graph is not static storage. Every new edge enables derived edges through reciprocal generation (automatic) and transitive closure (periodic background job). Every new book upload triggers matching against all pending unresolved S-tagged references. Every new note upload matches against L-tagged spans first, prioritizing the gaps that most need filling. Over time, the system discovers connections that were not explicitly present in any single source — a book uploaded six months ago gains new edges when a newly uploaded book cites the same foundational result. The structure of knowledge becomes increasingly complete not because any one model gets smarter, but because the graph compounds. The rate of edge growth exceeds the rate of content growth, because each new node potentially connects to many existing ones.
4.4 Reflexivity and Transitivity
Reciprocal Edges
Every typed edge has a reciprocal generated automatically at creation time:
A proves B → B is-proved-by A
A assumes B → B enables A
A contradicts B → B contradicts A (symmetric)
A extends B → B is-extended-by A
A prerequisite-for B → B depends-on A
A equivalent-to B → B equivalent-to A (symmetric)
Transitive Closure
Computed as a periodic background job, only for logically valid edge types:
Prerequisite-for: always transitive. Generates learning paths automatically.
Equivalent-to: always transitive.
Extends: transitive, chain length tracked.
Assumes: conditionally transitive, capped at depth 2–3.
Proves: NEVER transitive.
Contradicts: NEVER transitive.
All edges marked as direct (from classification) or derived (from reflexivity/transitivity).
4.5 Note Ingestion
Notes are first-class inputs. Users upload photos, scans, typed documents. GPT-4o vision parses handwriting and mathematical notation. Content is chunked by concept using the same @@ span system as books. Each chunk receives metadata, embeddings, concept tags, and search-class tags. Vector search runs against the library; above threshold, highlight junctions are created automatically; below threshold, flagged for review.
Many-to-many: one note chunk can attach to multiple books/passages. One passage can have multiple note chunks from different authors. Notes are bridges between sources. Users can optionally specify which book(s) the notes relate to, subject tags, course name, professor, institution. More context = faster, more precise matching. No context required—the system matches blind if needed.
L-tagged spans can optionally carry two additional signals beyond the base confidence letter: difficulty (a-z, how hard is the missing step for an early graduate student?) and importance (a-z, how critical is this gap to understanding the surrounding argument?). When notes are uploaded, the system matches against L-tagged spans prioritized by importance first. Note quality is assessed during ingestion (via the same @@ span system) and routed accordingly — a professor's detailed derivation notes match high-difficulty L-tagged gaps, while a student's study notes match lower-difficulty gaps. This ensures that the most valuable notes fill the most critical gaps first.
The number and type of additional signals on L-tagged spans is configurable by the system administrator. Beyond difficulty and importance, additional dimensions can be added (e.g., mathematical subfield, prerequisite depth, notation complexity), each rated a-z. The administrator controls how many signal dimensions are active and what questions generate them. This makes the note-matching system tunable across different corpora and use cases.
4.6 Grounded AI Research Partner
The AI is a research partner grounded on the structured corpus. On every message it receives: current page text, current note, book metadata, all other books’ metadata, matched note chunks, the typed edge graph, and conversation history. It cites exact sources with page numbers, provides clickable links, surfaces gaps and contradictions proactively, flags “this step is not justified in the corpus,” creates notes on the user’s behalf, and revises its position only when the challenger provides mathematical evidence—not simply because they pushed back confidently.
Chat, Note, and Graph Separation
Ephemeral chat (default). Not stored in graph. Not grounding material. Personal, transient.
Saved notes (user-controlled). User explicitly saves conversation excerpts as notes attached to highlights. Private by default.
Curated graph nodes (promoted). Only curated notes—optionally rewritten and structured—become graph-level knowledge with typed edges.
Pipeline: Chat → Save → Note → Curate → Graph Node. Each transition requires explicit user action. Highlights support three actions: write note (text/LaTeX/stylus), start anchored chat, view connections (notes + chats + system citations).
Cached Responses and User Feedback:
When sufficient structure exists in the graph — the source text is stored, citations are resolved, typed edges connect the claim to its justification chain — the system can generate explanations by formatting stored relationships rather than calling an LLM. The user clicks a highlight a text in a book and sees: here is the claim, here is what it assumes (with clickable links to the assumption text), here is what proves it (with links), here is the prerequisite chain (with links), here is the missing step (flagged, with attached notes if available), etc. This is a structured display of existing graph data, not a generation task. The LLM is only called when the user asks something that requires synthesis or reasoning beyond what the graph already contains. As the graph matures and cached responses accumulate, the system's dependence on LLM generation decreases. For the most well-annotated passages, the structured graph display fully replaces LLM calls — the system delivers grounded, citation-backed explanations with zero generation cost and zero hallucination risk. This dramatically reduces per-query costs at scale and produces more reliable answers — the graph is grounded on source text, while LLM generation always carries hallucination risk.
User feedback enriches the graph. When a user gives a thumbs-down to an AI explanation, or asks repeated follow-up questions about the same passage, that is a signal that the existing metadata is insufficient. The system can create an L tag on the span if one does not already exist, escalate the span to the judge model to identify what's missing, and cache any improved explanation for future users. Over time, the most-asked-about passages accumulate the richest metadata and the most reliable cached responses. Passages that nobody asks about stay lean. The system allocates metadata depth where users actually need it.
5. Cost Economics
5.1 Model Pricing
Model
Input
Cached
Output
Role
GPT-5.4 Nano
$0.20/MTok
$0.02/MTok
$1.25/MTok
Metadata, soft edges
Opus 4.6
$5.00/MTok
$0.50/MTok
$25.00/MTok
Judge, strict edges

5.2 Surface Metadata (Nano)
Input per chunk: ~200 tokens. Output: ~20 tokens (IDs + codes only). For 3,500 chunks: input 0.7 MTok × $0.20 = $0.14. Output 0.07 MTok × $1.25 = $0.09. Total: ~$0.23.
5.3 @@ Span Generation (Mid-Tier)
Input per chunk: ~500 tokens (chunk text + section context window). Output per chunk: ~20–32 tokens (3–4 span annotations × 5–8 tokens each in compressed DSL). For 3,500 chunks: input ~1.75 MTok, output ~0.07–0.11 MTok. At mid-tier pricing (~$2.50/MTok input, $10/MTok output): input $4.38, output $0.70–1.10. Total: ~$5 per book. Reducible to ~$2 if Nano proves sufficient on cleaner texts. Assumes chunk-window context, not full section dumps; output uses compact DSL, not prose.
5.4 Edge Classification by Triage Class
Empirical analysis of Srednicki Ch. 13–14 (14 pages, ~50 chunks) found: 55% Category N (no action), 16% Category L (logical gap, notes only), 20% Category I (same-book), 0% Category S (self-contained text), 4% Category B (broad search), with the remaining 5% ambiguous. Citation-heavy texts like Hartshorne would shift more chunks into S and B. The following estimates use these proportions with ranges.
Category I — Same-Book (Nano + Escalation)
525–875 chunks. Top 5 candidates per chunk (ceiling; average 2–3). Nano evaluates. ~10% escalate to Opus on low confidence. Total pairs: 2,625–4,375 Nano + 260–440 Opus.
Nano: input 0.39–0.66 MTok × $0.20 + output 0.06–0.10 MTok × $1.25 = $0.16–0.26. Opus escalation: input 0.04–0.07 MTok × $5 + output 0.006–0.011 MTok × $25 = $0.35–0.62. Total I: ~$0.50–$0.88.
Category S — Specific Source (Opus, Targeted)
0–525 chunks. Per chunk: deterministic narrowing → 10–20 compact cards → Opus picks ordered top 5 (~5–10 output tokens) → Opus evaluates in order, average 2–3 comparisons before stopping.
Preselection per chunk: input 300 tokens × $5/MTok = $0.0015, output 8 tokens × $25/MTok = $0.0002. Strict comparison per pair: input 150 tokens × $5/MTok = $0.00075, output 24 tokens × $25/MTok = $0.0006 = $0.00135 per pair. Average 2.5 pairs: $0.0034. Total per chunk: ~$0.005.
Self-contained book (70 chunks): ~$0.37. Citation-heavy (525 chunks): ~$2.76.
Category B — Broad Search (Nano Sweep + Opus Strict)
70–525 chunks (upper-bound estimate for citation-heavy texts). Per chunk: Nano evaluates top 20 candidates (input 3,000 tokens + output 480 tokens = $0.0012). Top 5 Nano hits escalate to Opus (average 3 comparisons: input 450 tokens + output 72 tokens = $0.004). Total per chunk: ~$0.005.
Self-contained (245 chunks): ~$1.27. Citation-heavy (525 chunks): ~$2.71.
5.5 Quality Monitoring
Opus samples every 10th chunk: 350 judgments. Input 0.105 MTok × $5 = $0.53. Output negligible. Total: ~$0.55.
5.6 Total Cost Per Book
Component
Self-Contained
Citation-Heavy
Surface metadata (Nano)
$0.23
$0.23
@@ span generation
$2.00
$5.00
Cat I: same-book (Nano+Opus)
$0.50
$0.88
Cat S: specific source (Opus)
$0.37
$2.76
Cat B: broad search (Nano+Opus)
$1.27
$2.71
Quality monitoring (Opus)
$0.55
$0.55
TOTAL
~$4.92
~$12.13

Under compressed-output and triage assumptions, @@ span generation and edge classification are comparable in cost. The primary cost levers are: output compression (machine-readable DSL vs natural language), triage accuracy (correctly classifying N/L/I/S/B to avoid wasted comparisons), and early stopping (ordered top-K evaluation terminating at first strong edge). For a 50-book library: $246–607 one-time ingestion. Cross-book edges generated incrementally; caching can materially reduce repeated input costs.
Monthly infrastructure (MongoDB Atlas, AWS S3, Heroku, API costs for grounded AI assistant): $50–150 for a single power user depending on chat volume.
6. The MVP: GydeMVP Research Library
What It Is
A personal AI-powered research library for a single user—a physicist working through advanced textbooks. The first user is the founder. The tool must be genuinely useful for daily research before it is offered to anyone else.
User Experience: Chats, Projects, and Books
The system is a unified research environment with three workspaces accessed through a persistent sidebar. A persistent input field at the bottom is always available, its context changing with the active workspace.
Library Mode
The sidebar shows collections of “book shelves”. Main view: library grid with covers, “Continue Reading,” “Want to Read.” Upload PDFs, organize into collections, update covers. The input field allows library-aware chat without leaving the view. This is very much the UI for the Books app in iOS (except the ability to edit the thumbnail book cover one sees in one's book shelves/collections).
Reading Mode
Opening a book: page-by-page reader with chapter/section titles in an HTML based – not PDF based – environment.  Whether HTML directly on a web app or a mobile app version, the text should be interactable. PDF is highly rigid and difficult to interact with. Every highlight is a central interaction hub. From any highlight: create a note (text/LaTeX/stylus canvas), start an anchored chat, or view connections (personal notes, personal chats, system-generated citations). Opening a book’s “notes” presents all notes in reading order—a reconstructed digital notebook tied to the source.
Chat Mode
Full-screen conversation, no book open. The sidebar shows chat history. The AI retains full library and graph access. Big-picture questions spanning multiple books.
Projects Mode
Projects provide scoped research workspaces. A project groups together selected chats, books, PDFs, notes, and user-defined instructions around a specific research thread. Within a project, the system prioritizes retrieval and reasoning over project materials first, while still allowing access to the broader library.
Projects signal graph enrichment. When multiple sources are grouped inside the same project, the system can run additional project-scoped edge discovery, using concept tag overlap, unresolved references, repeated missing-edge patterns, and book-level similarity as cheap signals to determine whether new comparisons are worth running.
Projects also serve as a computation and revenue layer. When a user groups books into a project, the system can offer enhanced cross-reference analysis: "Discover connections between these 5 books." The system runs the full I/S/B pipeline across all project sources, the user receives enriched citations and edge connections, and the graph permanently benefits. This is a self-funding data acquisition strategy — user demand directly funds the expansion of the knowledge graph.
Enhancement is tunable. Users can adjust the depth of analysis by choosing how aggressively the system searches for connections. At the basic level, the system uses the standard compressed DSL and concise output. At higher investment levels, the system can use richer input prompts with more context tokens, run the judge model more frequently, activate the crawler to fetch referenced sources, allow the LLM to actively search for gaps rather than passively flagging them, and accept less compressed output where additional detail might surface connections that the minimal format misses. Users can even supply their own custom prompt instructions for specific questions they want answered about their project materials — for example, "find every instance where Book A uses a result that Book B proves differently" or "identify all assumptions in my notes that are not justified by any source in this project." Users may discover genuinely effective prompt strategies that the system can analyze and adopt for all users.
Pricing scales with scope and depth: comparing two specific books at basic depth is cheap, comparing a full project library with enhanced settings is more expensive, and comparing a book against the entire corpus at maximum depth is the premium tier. Monthly subscription users receive continuous enhancement. Free users benefit from whatever edges already exist from other users' paid comparisons.
Design Principle: Continuity
The input field’s context changes with the workspace: general in Chats, project-scoped in Projects, library-aware in Books, page/highlight-aware in Reader. Users move seamlessly between modes. A chat started from a highlight stays anchored. The global chat knows the user’s recent reading context. One living environment, not separate apps.
Tech Stack
Node.js, Express, EJS, MongoDB, AWS S3, Heroku. Background processing via agenda.js. AI via Claude (research partner), OpenAI (metadata, vision), strongest available math model for edge classification. No frontend framework.
Build Strategy
Edgar Robledo builds the foundation for $500 non-refundable deposit. Full system: $9,600 (core) to $11,000 (advanced features). The founder vibe-codes in parallel. Edgar has validated: GPT-4o vision for semantic processing, cosine pre-filtering with relationship classification, typed edges on real ArXiv papers, AI pushback behavior. The triage pipeline in this document is the production-scale upgrade to Edgar’s working prototype.

7. From Personal Library to Platform
Multi-user support. Authentication, profiles, permissions. Each user’s library; shared edge graph.
Notebook marketplace. Professors upload notes—free or paid. System matches to relevant passages corpus-wide.
Learning path generation. Prerequisite edge traversal generates automatic curricula personalized to what the user knows.
Research recommendations. Typed-edge connections in the newsfeed: “This paper’s Theorem 3.2 uses the same construction as your notes on spectral sequences.”
Peer review and publishing. Edge graph shows how claims connect to literature. Crypto incentives. Blockchain transparency.
LMS integration. Courses from notes with prerequisite checking and AI tutoring grounded on course content.
ArXiv indexing. Ingest public corpus, generate knowledge map, auto-generate claimable academic profiles.

The Data Flywheel:
The business model creates a compounding data flywheel. Users pay to enhance their metadata. The enhanced metadata enriches the global graph. The richer graph attracts more users. More users generate more feedback signals (thumbs up/down, follow-up questions, note uploads). More feedback creates more L-tags and cached responses. The cached responses reduce per-query costs. The reduced costs improve margins. The improved margins fund more infrastructure. Each cycle makes the product better and cheaper simultaneously. This is the same flywheel that powers Palantir's government contracts and Amazon's marketplace — the data asset compounds with use.
The Trust Layer: GydeNPO
Professors will not upload decades of personal notes to a platform they do not trust. GydeNPO owns 51% of GydeRnE. Board: Chairman + 12 Elected Officials, mandatory disciplinary representation. No board members hold GydeRnE shares. All votes and finances on blockchain. Academics govern it. Academics profit from it.
8. Future Capabilities
Visualization. Static diagrams → interactive widgets → proof map animations → video. Layer-on-top, not foundation.
SymPy operator signatures. Notation-independent equation matching via canonical operator signatures. Layer 1.5 in the funnel if tag-based matching proves insufficient.
Implication Map. If/then logical dependencies, truth states (green/yellow/red) with cascade propagation, contradiction monitoring. The current edge system with typed declarative tags and transitive closure is the architectural precursor to this capability; the implication map extends it with explicit truth-value tracking and automated contradiction detection across the full graph.
Agentic AI. Persistent memory, proactive gap detection, goal tracking, self-correction. User opt-in for autonomy levels.
Span-level edge refinement. Edges connecting specific sentences rather than chunks. 10–50x cost multiplier, justified after chunk-level proves value.
9. What Makes This Different
Every competitor works on making models smarter. Gyde gives existing models the right data and structure to be effectively smarter now.
The dual-front data moat. Digitizing professors’ notebooks (hidden knowledge) and auto-generating resolved citations for every claim (missing citations). Notes and books enter the same pipeline.
Highlights are citations. Every connection is a citation the author left vague, omitted, or never thought to include.
Typed edges as the product. Not “related passages” but “the exact chain of reasoning that justifies this claim.”
The @@ span system + N/L/I/S/B triage. Fine-grained semantic tagging with search-class routing. Ensures only the right chunks are compared at the right cost.
Note-as-origin architecture. Bulk ingestion. The only approach that scales.
Self-tuning quality. Judge model monitoring, prompt re-injection, multi-company routing.
Academic governance. GydeNPO. Democratic control by professors. Trust layer for data acquisition at scale.
The cost structure. $5–12 per 800-page textbook. Micro-LLM calls, compressed DSL outputs, three-class triage, ordered top-K early stopping.


We have text. We have LLM reasoning.
But we do not have structured proof-level connectivity.
That is the gap. Gyde fills it.
