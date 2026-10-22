# Research library: foundation audit and rebuild decision

Date: 2026-10-22. Repository: `Jony-GydeRnE/research-library`.
Audited baseline: `083c03717b4ef58ca756ac8e2932d0ac391fa5a1`.
Audit began at 09:58:25 UTC. Completion and verification are recorded in `verification.md`.

## Decision

**Keep the application; replace its ingestion, publication, and evidence model in stages. Do not restart the whole product, and do not treat this as a prompt-tuning project.**

The prototype contains useful work: library management, PDF storage and extraction, reader modes, notes, highlights, bibliography parsing, candidate retrieval, streaming chat, and experimental graph navigation. Express, EJS, and MongoDB are not the reason it falls short. Recreating those surfaces would consume effort while recreating the same source-identity and trust problems.

The central weakness is the data contract. The app mixes original text, vision transcription, AI-expanded notes, inferred concepts, candidate links, and supposedly verified claims. Rebuilding annotations can destroy the old version and invalidate references before the replacement succeeds. An impressive-looking graph built on that foundation is unreliable research memory.

This audit includes a first set of bounded repairs and regression tests. **It does not make the whole product reliable, migrate existing data, or establish that its mathematical links are correct.** The necessary next build is a versioned ingestion and evidence pipeline behind the existing reader.

## What was examined, and what was not established

- Reviewed the repository's runtime services, controllers, routes, models, configuration, browser JavaScript, EJS templates, CSS declarations, prompts, maintenance scripts, Swift renderer, and server entry point. `source-inventory.csv` records the tracked source inventory. This is source review, not branch coverage or proof that every defect was found.
- Traced upload → extraction → vision → readiness; separately traced span generation → chunks → citations → bibliography → edges → embeddings/canonical lookup/note matching. Traced chat construction, tool execution, streaming completion, citation navigation, reader state, notes, and highlights.
- Read the active AI/UI to-do lists, superseded combined to-do list, relevant update history, architectural instructions, benchmark scripts and saved April/May quality reports. Historical reports are evidence about those runs, not the current database.
- Compared the available workspace snapshot and differing saved worktree implementations. The snapshot's core matched the public repository; variants did not reveal a separate finished replacement. Some contained useful experiments, but none justified blindly replacing main. One reclassification script queried `bookType` although the schema uses `kind`.
- Ran deterministic service/DOM regressions and real-Mongo integration tests in a newly created disposable database. Provider responses and rendering are explicitly doubled where needed; no paid model evaluations were run.
- Did **not** access or alter the live research database, reprocess the user's PDFs, run production migrations, or measure current model accuracy/cost. A Chromium download failed, so DOM tests are not rendered-browser visual QA. The macOS Swift renderer cannot run on this Linux host.
- Reviewed application code, not the entire implementation of every transitive npm dependency. Dependency audit results require reachability triage.

## The most consequential findings

### 1. Normal upload does not construct the promised research graph

`services/jobService.js` completes extraction, vision, regex annotation, and surface metadata. It does not automatically run the full span/chunk/embedding/edge pipeline. That later pipeline lives in `spanService.generateSpansForBook`, maintenance scripts, and explicit matching actions.

Consequently, a book can be readable and called ready while lacking the structures that are supposed to make the library intelligent. The Files “Resume” confirmation also claims it reruns spans, chunks, and embeddings, while the reprocess-vision worker does not do that. Do not solve this merely by calling every existing stage from upload: their destructive and inconsistent behaviors need fixing first.

**Required:** separate readable, indexed, linked, and reviewed readiness; one durable stage coordinator with explicit dependencies and resumable progress.

### 2. Regeneration can destroy annotations and invalidate graph references

`spanService.generateSpansForBook` deletes the book's spans before producing replacements. `chunkService.generateChunksForBook` deletes chunks and creates new IDs. A model outage, parser failure, empty source page, validation error, or process interruption can leave a partial replacement. References elsewhere include incoming edges, canonical definitions, span/chunk links, quality reviews, and traversal state.

This was already documented on May 1: existing spans disappeared when old-format pages were skipped. Repairing missing rawText was a data workaround, not a durable publication design. The audit added a missing-provider guard, but a configured provider can still fail mid-run. **That larger problem remains open.**

`scripts/rebuild-metadata.js` also regenerated chunks after span generation had already done so, deleting the very chunk IDs the post-processing chain had just used. That duplicate rebuild is fixed.

**Required:** generate into a new run/version, validate it, then atomically switch the active version. Preserve the previous version until rollback and incoming-reference handling are proven.

### 3. The source being annotated is not consistently the source being read

Original PDF extraction, vision-generated plain text, HTML-to-text conversion, and AI-expanded notes differ. Sentence splitting is repeated rather than referencing a canonical segmentation. `regexService` uses zero-based sentence positions where span coordinates are one-based. Chunk text joins sentences, which can erase paragraph-only boundaries used by the original splitter. Reader selection offsets are DOM-based and can change after MathJax typesetting.

The notes rewrite scripts replace page HTML with generated exposition. That can be useful as an interpretation, but it must be a separate, attributed derivative. Otherwise the system can cite its own expansion as though it were what the researcher or paper actually said.

**Required:** immutable source revisions, stable passage anchors, explicit extraction versions, separate generated explanations, and a single coordinate convention shared by annotation and reader rendering. Preserve both PDF page index and printed page labels.

### 4. Graph scores and relationship direction are inconsistent

The lexical resolver interprets `a` as strongest and `z` as weakest; compression/funnel and graph traversal use the opposite direction. The old cosine confidence helper in note ingestion also uses the lexical direction, although the current primary picker uses funnel scores. The method name alone is therefore not a safe universal migration key for historical note edges.

There is also a semantic mismatch: the audit rubric describes `source proves target`, while the notes picker asks for the relationship the **target provides to the note**, including “target proves a claim.” The resulting edge is stored from note to paper. `s` is described as supports but persisted as assumes. These are different relationships.

The path finder traverses edges as undirected. That is useful for discovery, but cannot reverse a proof. It previously omitted original edge direction from its result; that is fixed. Its depth-limited Dijkstra implementation could also discard a valid shorter-hop route; that is fixed.

**Required:** one explicit directional relation contract, numeric score plus score meaning/version, provenance per edge, and migration/quarantine of ambiguous legacy edges. Never globally flip all existing confidence letters.

### 5. Matching and semantic verification are conflated

The notes prompt encourages selecting relationship types from the target's structural label. A theorem or proof-shaped target is not evidence that the source proves it. Canonical concept matches create high-confidence links without establishing that the definition applies under the same assumptions. `resolved=true` generally means a target was selected, not that a mathematician or verifier checked the claim.

The chat prompt called these edges verified ground truth. The settings UI claimed unverified citations were blocked, although the server's detector is commented out. The audit removes those misleading assurances. Prompt changes are not an enforcement mechanism; actual provenance and quote validation remain necessary.

**Required:** distinguish explicit citation, similarity, uses-definition, proposed implication, and reviewed implication. Store supporting passages, conditions, rationale, producer/run, and review status. A discovered connection is allowed to remain a hypothesis.

### 6. The old benchmark cannot establish semantic quality

Commit `6416d21` reports 80/81 = 98.8% after widening the notes-page window from 2 to 3. `scripts/score_benchmark.js` measures target/source page-window hits, with broad wildcard cases. Its strict-relationship option excludes annotates; it does not require the correct mathematical relationship or gap type, and the wildcard branch is weaker still.

The post-fix May 2 edge audit sampled 20 edges: **2 correct, 10 borderline, 3 wrong, and 5 unparseable/failed**. That is 2/15 among rated cases, not a reliable estimate of whole-library precision. It is nevertheless strong historical evidence that related passages were often mislabeled. The ten-chunk judge run reported 4.9/9; it is also a small model-judged sample, not a validated accuracy measure.

The earlier 50-edge audit reported 41/41 wrong because the evaluator read the empty legacy `rawText` field. Commit history explicitly identifies and fixes that evaluation bug. **Do not cite that 100%-wrong result as product accuracy.**

**Required:** separate extraction completeness, exact source anchoring, retrieval recall, relation/direction precision, abstention, researcher usefulness, latency, and cost. Keep evaluation examples independent of the prompt examples. Human-reviewed hard negatives matter more than increasing edge count.

## Repairs included in this audit

| Area | Reproduced failure / correction | Boundary of the fix |
|---|---|---|
| Chat persistence | Await asynchronous completion/save callbacks in both plain and tool paths; propagate a save failure once instead of swallowing/retrying it | Does not add durable turn jobs or concurrent-message ordering |
| Streaming | Shared SSE parser handles arbitrary byte boundaries, UTF-8, CRLF, terminal events, and interrupted streams; both chat surfaces display the saved final text and unlock input on failure | No reconnect/resume protocol |
| Chat rendering | Skip tool-only records in split chat; escape HTML inside math; protect embedded chat JSON from script termination; escape citation attributes and reject invalid page links | Other page/metadata/notes HTML surfaces still need systematic sanitization |
| Reader navigation | Reload the selected HTML page after PDF navigation; ignore stale page responses; retain embed/sidebar URL state | Scroll/highlight behavior still needs browser and corpus tests |
| Note editing | Failed HTTP saves retain the draft and report failure; capture the note's opening page; reject stale loads/saves from an older panel; retain newer edits made during a save | Closing/reloading can still lose an unsaved draft; server write idempotency is not implemented |
| Page readiness | Require each expected PDF page to have successful nonempty vision HTML before completing vision jobs; expose failure instead of silently marking ready | Does not establish transcription accuracy or graph readiness; text-only fallback remains separate |
| Chunk ranges | Union overlapping sentence ranges rather than truncating to the last span's end | Canonical sentence segmentation still needed |
| Chunk schema | Accept inferred lemma/proposition/corollary structural types | Not a complete mathematical ontology |
| Span regeneration | Refuse destructive generation when no OpenAI client is configured; reject an empty enrichment retry replacing useful output | Mid-run failures still require versioned publication |
| Rebuild script | Remove the second chunk rebuild after the span post-chain | Skip-spans/manual rebuild still needs reference migration |
| Citation spans | Use page-relative positions; cover repeated cited sentences; overlay rather than overwrite proof roles/gaps; update Page and Chunk references; bound numeric range expansion | Legacy unanchored chunks are reported/skipped; imperfect sentence splitting remains |
| Model verdicts | Validate compact picker/classifier contracts, reject malformed/truncated output, remove fabricated no-provider classification; preserve ranked-candidate shape in fallback | Compact alphabets remain ambiguous/limited; switch to a versioned schema during redesign |
| Partial note matching | Count returned errors and exceptions; abort replacement if any picker attempt fails, including small runs | Successful-run delete/insert is still non-atomic; failed embedding coverage remains a separate concern |
| Graph navigation | Keep distance per node and hop count; include stored edge direction; reject whitespace-only quote verification | Legacy score calibration, retired nodes, and scope enforcement remain |
| Trust language | Remove verified-ground-truth claims and false strict-grounding UI promise; explain path depth limits and PDF page indexing | This is disclosure, not verification |
| Structural diagnosis | Add read-only `scripts/audit-integrity.js` and `services/integrityService.js` | No live audit was run; does not judge semantics or audit every model collection |

The conservative note-matching guard may cause more runs to abort visibly when a provider produces malformed output. That is intentional until publication is transactional: incomplete output should not replace an existing graph.

## Remaining defect register

Severity here means impact on reliable use, not a formal security score. “Confirmed” means visible in code or reproduced; “needs live reproduction” means an old user report or plausible UI failure whose present behavior was not established in a real browser.

| ID | Priority | Evidence and remaining problem | Next correction |
|---|---|---|---|
| F01 | P0 | `spanService` / `chunkService`: delete-first publication and changing IDs, confirmed | Versioned staging and active-version switch |
| F02 | P0 | `jobService`: graph stages absent from normal upload/reprocess, confirmed | Durable dependency-aware pipeline and separate readiness states |
| F03 | P0 | `jobService`, rewrite scripts, regex/span/chunk/reader: conflicting source and coordinate systems, confirmed | Immutable sources and common passage anchors |
| F04 | P0 | `edgeResolverService`, `compressionService`, `funnelService`, `graphToolService`: conflicting confidence/direction contracts, confirmed | Versioned relation/score schema; quarantine legacy ambiguity |
| F05 | P0 | `noteIngestionService`: successful commit deletes before insert; broad incoming/outgoing ownership; zero-result run keeps stale edges, confirmed | Run-owned edge sets and atomic publication; explicit zero-result semantics |
| F06 | P0 | `booksController.deleteBook`: incomplete graph/canonical/job/file/chat cleanup and no coordination with running workers, confirmed | Logical deletion/tombstone, job cancellation, controlled cleanup |
| F07 | P0 before network deployment | `server.js` and HTML surfaces: no authentication/CSRF boundary; raw generated page/metadata HTML reaches the DOM, confirmed | Define local-only boundary or add authentication; sanitize generated content and enforce CSP |
| F08 | P1 | `jobService`: pending-only Job lookup makes crash recovery inconsistent with Agenda retries; no unified job identity/lease heartbeat, confirmed | Idempotent stage keys, leases, retry states, resume checkpoints |
| F09 | P1 | `jobService` extract: retries can repeat `Page.insertMany`; no safe replacement transaction, confirmed | Unique source-version/page identity and idempotent upserts |
| F10 | P1 | `spanService`: 60-sentence cap, small output cap, missing finish-reason/range/coverage validation, confirmed | Windowed processing with validated coverage and explicit partial failures |
| F11 | P1 | Span schema/parser: one scalar gap/search class cannot represent multiple missing prerequisites on the same idea cleanly, confirmed | Independent typed assertions/gaps over stable passages |
| F12 | P1 | `spanService`: global session bookkeeping is not persistent model understanding and may cross concurrent runs, confirmed | Per-run state; explicit context and raw output records |
| F13 | P1 | `canonicalDefinitionService`: missing projected span text disables a definition fallback; chunk index 0 treated as absent; scoped replacement comparisons lack complete rank data, confirmed | Correct query/ordering and test incremental-vs-full rebuild equivalence |
| F14 | P1 | Canonical definition model: a single global winner per normalized concept ignores context/assumptions; lookup can overstate certainty, architectural | Contextual definitions plus competing evidence, not one authoritative tag string |
| F15 | P1 | Canonical lookup/reranking: singleton tag fallback and sorting a sliced array can defeat intended fuzzy/rerank behavior, confirmed | Explicit exact/fuzzy candidate stages and stable winner selection |
| F16 | P1 | `qualitySweepService`: claims of add-only/rollback do not cover all pointer/tag mutations; repaired chunk embeddings/neighbors/page references can remain stale, confirmed | Version repair output; validate every reference before promotion |
| F17 | P1 | Quality sweep tombstone resolvers exist but normal readers/retrieval do not consistently use them, confirmed | Filter retired records and resolve only unambiguous replacements |
| F18 | P1 | Quality sweep budget gates do not guarantee a hard run cap; fallback tag repair can spread chunk-wide tags onto all spans, confirmed | Reserve budget before calls; preserve uncertainty instead of fabricating specificity |
| F19 | P1 | `funnelService`: top-12 picker truncates a top-25 candidate pool; short source/target snippets may omit assumptions/proofs, confirmed | Measure recall before classification; expand evidence for shortlisted relations |
| F20 | P1 | `noteIngestionService`: all-library matching scales with notes × books × chunks; missing embeddings can silently skip work, confirmed | Coverage accounting, prioritized scoped jobs, explicit budgets/checkpoints |
| F21 | P1 | `graphToolService`: vector cache lacks wired invalidation; retired records and collection scope are not consistently enforced, confirmed | Version-keyed cache and mandatory scope predicates |
| F22 | P1 | `claudeService`: large context blocks are dropped/truncated; edge block not query-ranked; library overview XML contract is inconsistent, confirmed | Retrieval-driven context with explicit coverage/omissions |
| F23 | P1 | `claudeService`: quote/citation gate disabled; real IDs do not validate quotations, implications, or page numbers, confirmed | Validate selected evidence and quotations against immutable source anchors |
| F24 | P1 | `server.js` chat: no durable turn idempotency/order/reconnection; `updatedAt` hooks do not cover every update path, confirmed | Persist turn lifecycle and client request IDs |
| F25 | P1 | Tool loop may duplicate intermediate text in final history and end at a budget boundary without a proper synthesis, confirmed | Separate tool commentary from final answer; explicit budget-stop result |
| F26 | P1 | Reader highlights: DOM/MathJax offsets, scroll page attribution, overlapping ranges, equation-only selection, and fuzzy-prefix matching can misanchor, confirmed code risks | Canonical source anchors plus rendered-browser regression corpus |
| F27 | P1 | Old metadata “works once” and three-pane reports need current browser reproduction; state/pane ownership spread across scripts | One pane state controller; reproduce documented sequence before marking fixed |
| F28 | P1 | Notes close/navigation can discard drafts; server create + highlight linking is non-atomic | Draft persistence and idempotent write/link transaction |
| F29 | P1 | `visionService` / `pdf2png.swift`: platform-specific renderer and synchronous rendering block portable operation | Portable worker renderer and extraction capability preflight |
| F30 | P1 | Vision output lacks robust truncation/sanitization/equation validation; math wrapper normalization can double-wrap | Preserve source transcription, validate output, render representative fixtures |
| F31 | P1 | Production figure call omits page text/coordinate anchors used by repair scripts; crop-only judge cannot see omitted surroundings | Use full-page context and validated geometry in the actual upload path |
| F32 | P1 | Dependency audit found 16 affected packages, including high/critical advisories | Reachability triage and compatible upgrades with smoke tests; no forced major-version sweep |
| F33 | P2 | `score_benchmark.js`: page matching mistaken for semantic precision; wildcard/strict handling inconsistent | Separate retrieval and relation benchmarks with reviewed negatives |
| F34 | P2 | `audit-edges.js`: missing endpoints don't use the expected parsed-result shape; nonseeded random-sort sampling/stratum trimming, failures and cost accounting weaken estimates | Reproducible sampling; explicit unassessable bucket; complete usage accounting |
| F35 | P2 | `sample-quality-snapshot.js`: wrong canonical-definition query field and empty-array fallback mask available data | Correct schema fields and data-presence checks |
| F36 | P2 | `figureJudge`, judge rubric: model self-ratings are treated too strongly; rubric itself can encourage over-tagging gaps | Calibrate against researcher-reviewed examples; do not label scores probability of truth |
| F37 | P2 | `booksController.copyToCollection` returns success for nonexistent target; Files UI alerts success without checking HTTP, confirmed; old no-op cause not fully reproduced | Validate endpoints, propagate errors, test actual picker flow |
| F38 | P2 | Reader/chunks view loads entire books or many pages concurrently and can cache a failed load as finished | Virtualization, bounded fetch queue, retryable page states |
| F39 | P2 | CSS/panes: fixed header controls, independent pane widths, hidden-overflow wrappers and hover-only controls need mobile/touch QA | Test fold/phone/desktop layouts; avoid cosmetic rewrite before source reliability |
| F40 | P2 | Storage: backend selected globally rather than per file; local images alongside S3 PDFs; timestamp names and nonunique hash dedup, confirmed | Per-artifact location/identity, content hashes, export/restore test |
| F41 | P2 | Scripts contain one-book IDs/absolute developer paths and several bypass normal pipeline guarantees, confirmed | Consolidate supported administrative commands and dry-run/write boundaries |
| F42 | P2 | `graphToolService.get_path`: same-ID shortcut does not establish that the chunk exists; graph reads may still traverse dangling nodes | Validate endpoints and active-version references |

P0 means foundational correctness or exposure must be addressed before treating the graph as dependable. It does not mean every row is a remotely exploitable vulnerability or that the current private deployment is known to be exposed.

## Keep, repair, replace

| Component | Decision | Reason |
|---|---|---|
| Express/EJS app shell, existing routes | Keep and simplify | No evidence that changing framework fixes research correctness |
| MongoDB | Keep initially | Can support versioned records, indexes, and transactions; no demonstrated need for a graph database |
| PDF originals, handwritten originals, user notes and highlights | Preserve | Irreplaceable source material and researcher work |
| Reader visual design and useful interactions | Keep; repair state and anchoring | Existing value, but needs reliable coordinates and pane ownership |
| Bibliography parsing and retrieval candidates | Retain behind tests | Useful components; extraction/selection is not semantic verification |
| Ingestion orchestration and publication | Replace incrementally | Destructive updates, missing stages, ambiguous readiness, weak restart semantics |
| Source/annotation/edge schema | Introduce versioned replacement | Current entities conflate source, interpretation, and certainty |
| Historical graph | Preserve as legacy candidate data | Useful hints, insufficient provenance for blanket trust or score conversion |
| Prompt alphabet protocols | Replace as stages are migrated | Small token savings do not justify opaque contracts and silent coercion |
| Audit/benchmark tooling | Repair and retain | Good scaffolding; measurement definitions need correction |
| OS, keyboard, publishing/peer-review marketplace | Defer from this MVP | They do not repair the research-library's current failure mode |

## Concrete next architecture

Keep a modular monolith with background workers. Introduce these responsibilities before splitting services or changing frameworks:

1. **SourceRevision:** immutable document hash, original file location, extraction version, page index/printed label, original text/geometry. An AI rewrite is a separate derived document with authorship and parent references.
2. **PassageAnchor:** source revision + page/block/character or geometry coordinates. One shared segmentation implementation. Claims can overlap; one paragraph need not equal one concept.
3. **AnnotationRun:** model/version, prompt hash, configuration, raw model output, parser/schema version, token usage, validation errors, status, and budget. Replay parsing without paying to regenerate.
4. **Assertions and concepts:** individual definitions, claims, assumptions, proof steps, unresolved gaps, and context-qualified concept references. Keep evidence separate from normalized vocabulary.
5. **RelationCandidate:** explicit source and target assertion, directional predicate, supporting passages, assumptions, producer/run, score meaning, and proposed/reviewed/rejected/stale status. A similarity link cannot silently become `proves`.
6. **PublishedVersion:** atomic pointer to a complete, validated derived version. Keep the previous version available. Incoming links name exact source versions; ambiguous remapping becomes stale rather than silently pointing elsewhere.
7. **PipelineTask:** idempotent key `(sourceRevision, stage, configurationVersion)`, dependency state, lease/heartbeat, attempt count, durable checkpoint, budget reservation, and error. A background study task is bounded, inspectable, and resumable.
8. **ReviewDecision:** durable researcher corrections over evidence, separate from generated output. Regeneration must not erase them. Reapply only when the new anchor is demonstrably equivalent; otherwise ask for review.

Use adapters to return the old reader/API shapes while these records are introduced. A new screen or framework is not a prerequisite. Multi-document Mongo transactions require an appropriate deployment topology; do not assume standalone Mongo supports them. A publication pointer plus immutable completed versions can keep large generation work outside a transaction.

### Migration and rollback sequence

1. Snapshot DB and source files; verify restore. Run the structural audit against the snapshot and save output privately. Inventory originals, annotations, references, and review/user-authored data.
2. Stop automated destructive regeneration during migration. Continue reading the existing library. Do not delete old records as a cleanup step.
3. Implement source revisions, anchors, task state, and staged publication. Run one representative collection in parallel with the legacy output.
4. Exercise model failure, process interruption, malformed output, empty pages, duplicate deliveries, and reprocessing. The active library must retain its prior valid version after each failure.
5. Import old edges as legacy candidates with original IDs/scores. Reassess direction and meaning from evidence; do not guess a universal score inversion. Retain unresolved references explicitly.
6. Switch that collection's active version only after source coverage, structural integrity, anchoring, and manual evidence review pass. Roll back by switching the pointer, not reconstructing lost records.
7. Expand collection by collection; retire bypass scripts only after their supported replacement exists.

## What to build first

**A dependable research library that connects a difficult paper to the researcher's own notes and shows the evidence for each connection.** Start with the existing Rodina/hidden-zero papers and notes because they already contain real failures and a researcher who knows the material.

The first complete user experience should be:

> Upload a paper and notes. Processing finishes or identifies exactly what failed. Read a claim, see the relevant definition/derivation/proof candidate from your notes or another paper, jump to the exact passage, and accept or correct the connection. Reprocess later without losing the correction or breaking its source.

Background work should first operate on this bounded collection: resolve citations, inspect unresolved gaps, propose a small set of evidence-backed links, record what changed, and stop at a configured budget. Web expansion can follow once local evidence and provenance are reliable. “Always studying” should mean accumulated, inspectable work, not unlimited repeated calls or a claim that model weights are being retrained.

That is a concrete product distinction from a generic upload-and-chat interface. Its value still needs to be demonstrated: the fact that models have finite context/resources does not itself prove that this graph improves research enough to justify its cost.

### Exit criteria for the first dependable version

- Every expected PDF page is present or explicitly failed; no silent complete state.
- Every displayed quotation resolves to its exact immutable source revision and passage.
- Zero dangling active-version graph references in the migration fixture/corpus.
- Interrupted/retried generation preserves the previous published library and user corrections.
- Candidate vs reviewed connections are visibly distinct; direction and assumptions are inspectable.
- A fixed collection budget and job history expose work, failures, and actual provider usage.
- A small researcher-reviewed task set demonstrates useful note-to-paper links and catches plausible but wrong proof relationships. Report false positives and abstentions, not just coverage.
- Compare the same model and corpus with direct-context chat, ordinary retrieval, and retrieval plus persistent graph work. Measure researcher time/corrections and total precomputation plus query cost. Treat any quality/latency win as an experiment until measured.

Do these checks while building the working vertical slice. They are acceptance criteria, not an indefinite research phase that delays implementation.

## How to inspect the current library without rewriting it

From a trusted environment with the correct database connection:

```sh
node scripts/audit-integrity.js > integrity-report.json
```

Prefer a restored snapshot or read-only database credentials. The command disables automatic index/collection creation and performs read queries only. It reports reference problems and per-book page/chunk/span coverage, with small ID-only samples. It does not include source prose. Counts are reference occurrences: one edge with two missing endpoints contributes two missing-chunk findings. A concurrently changing database is not a consistent migration snapshot.

Do not commit a private live-library inventory to this public repository by default. Save it with the private research workspace. The code and synthetic tests here contain no live database dump.

The first patch is deliberately a stabilization layer. The central follow-up is F01–F05: preserve evidence, publish versions safely, and make relation meaning explicit. Until then, turning on more autonomous agents would amplify existing uncertainty.
