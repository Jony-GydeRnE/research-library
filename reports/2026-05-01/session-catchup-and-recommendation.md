# Session catch-up + recommended next moves

**Date:** 2026-05-01
**Author:** CC (cold-start session, ~2 weeks since last work)
**Audience:** Jony

This is the deep dive you asked for. Read it to confirm the picture, then we decide.

---

## Where things actually stand

### What's built and working

The MVP is real. Upload a PDF → vision pipeline rasterizes pages → GPT-4o vision converts each page to HTML+LaTeX → MathJax renders → reader UI works (Format × Layout × Metadata axes, Ask AI dropdown, Projects sidebar pill, mobile/Z-Fold reader fixes, split-reader docked right). Over 6,000 chunks, ~5,000 spans, 1,200+ edges across the library.

The funnel pipeline (`services/funnelService.js`: cosine → GPT-4o-mini picker → relationship classification) is the production edge generator. 92–94% precision on cross-book edges. The notes-rewrite pipeline (`scripts/rewrite-notes-pages-batch.js` + `prompts/notes-rewrite.txt`) pivots handwritten notes from "vision transcribe verbatim" to "rewrite as clean LaTeX in Rodina's voice with grounded `[[cite]]` tags." Sonnet/Opus routing on Rodina-native vocabulary; 65-page Lagrangians book ran in 32m at $7.

The canonical-definition resolver (`services/canonicalDefinitionService.js` + `taxonomyService.getCanonicals()` + `/api/metadata/resolve`) is the live "highlight any text → see canonical concept + every related span + the definition chunk" feature. After the 2026-04-13 data-quality session: `uses_definition` edges 754 → 2,112. `bcfw_shift` / `bcfw_shifts` / `Britto-Cachazo-Feng-Witten shifts` all collapse to one canonical with 40 spans.

The figure judge loop v1 (`services/figureJudge.js` + `cropWithJudgeLoop()`) ships behind `FIGURE_JUDGE=1`. Sonnet 4.6 vision critic, decaying amplifier [2.5x, 1.5x, 1.0x], asymmetric clamp, 60px floor guard. Rodina avg score 84 over 4 figures.

**Phase A graph tools are already shipped but toggled off** (commits `d791cf4` + `32d5e41`). `services/graphToolService.js` exposes `search_chunks`, `follow_edges`, `read_chunk`, `get_path`, `verify_quote` to the chat LLM via Anthropic tool-use. Tool-use state machine is in `services/claudeService.js`. This is the architectural pivot from "RAG that hallucinates" to "agent that navigates verified graph." It just hasn't been enabled in production.

### What's pinned but unfinished

From `Vision/Updates:read-me:to-dos/`:

**Hot data-quality items** (all code-complete, awaiting validation):

1. The **33-page span gap**. Lagrangians notes book had 33 pages dropped by TPM 429s during the original vision burst. `scripts/fill-missing-pages.js` (commit `9f7009e`) backfilled the htmlContent + rawText for those pages, AND `reconcilePages()` in `jobService.js` now self-heals future uploads. But the chunk/span/embedding/edge pipeline never re-ran on those 33 pages. They have text and no edges. ~5-min backfill: `node -e "require('./services/spanService').generateSpansForBook('69d9ce81aa83b8b11c1837dd')"` then re-match.

2. **Fix 2 (Rodina p1 candidate-pool exclusion)** and **Fix 3 (notes-source relationship-letter mapping)** are both shipped in code, never re-validated because OpenAI quota was exhausted at end of the 2026-04-11 session. Forecast: Tier B 62 → ~71-73, Tier C 20 → ~50+.

3. **Notes-rewrite prompt-cache miss.** `prompts/notes-rewrite.txt` is ~600 tokens, below Anthropic's 1024-token cache minimum, so `cache_control: ephemeral` is silently ignored. Live batch confirms `cr=0 cw=0` on every call. The Opus/Sonnet routing savings ARE real; the caching savings are not. Fix: pad the system prompt past 1024 with stricter citation/LaTeX rules (probably improves quality too).

**Decision-locked but not executed (the "DO NOW" sequence from to-do.md):**

1. Add 8–10 hardcoded few-shot examples to `prompts/span-generation-full.txt` and `short.txt`.
2. Regenerate Rodina spans → target 70+ L-tags (currently 38).
3. Implement direction reversal in `services/noteIngestionService.js matchNotesToSourceBooks` (notes→paper primary, paper→notes secondary for L-tagged uncovered chunks).
4. Score against the 81-item benchmark.

**JONY MUST READ EDIT (your own pin):** every citation in any book must auto-create span/chunk edges. If the cited book isn't in the library, the edge points to a null Book record carrying just enough metadata (title, author, year, page if known) to uniquely specify the target. "Citations must be taken as 'something is missing here that needs to be read.'" This is the bibliography-resolution layer that Section 4.5 of `Vision.md` calls the "missing citation layer" data moat. Not built yet.

**Hot UI items:**

- Mobile single-screen mode for Z-Fold (split-screen shouldn't open below ~520px; clicking edge replaces current pane instead).
- "Add to collection" kebab silent no-op on `/files`.
- Edge-click in metadata panel opens a **third** pane instead of morphing the right pane → should replace the right pane with the target book.
- Metadata button single-use-then-dies (highlight → metadata works once → dismiss → re-highlight → click metadata → silent no-op).
- Notes-vision quality loop spec (`reports/Notes rewrite and vision/notes-vision-quality-loop-spec.md`) needs 8 open-question answers before build (Puppeteer vs mathjax-node, judge model, force-accept flag, etc.).

### The big horizon (from `Vision/Gyde Research agents (GR agents)/`)

Four-agent hierarchy:

```
PHILOSOPHER   (slowest — generates direction from graph anomalies, isolationist mode)
   ↓
EXPLORER      (Phase C — autonomous traversal, builds vibes)
   ↓
SUBJECT TUTOR (per-domain canonical subgraph, shared across users)
   ↓
MINIME        (per-user reasoning profile)
```

Three-layer architecture is locked in:
- **Layer 1**: the immutable graph (chunks, spans, edges, embeddings) — agents read only.
- **Layer 2**: the collection workspace — filesystem-like, per-collection, agent-writable, persists across chats. Where vibes live.
- **Layer 3**: query cache — keyed by question-embedding cosine.

Phase A ships against Layer 1 only and **is already in the codebase, toggled off**.

### Uncommitted state right now

You renamed the 13 Rodina notes PDFs in `reports/Rodina Docs and Data/Rodina Notes/` (numbered them 1.–18. by reading order, dropped the old unnumbered originals, added 5 new ones I haven't seen: `14. encroaching-locality-proof.pdf`, `15. Pattern-Structures in Zeroes-Chords.pdf`, `16. Cyclic shifts of zeroes.pdf`, `17. Hidden zeroes and non local interactions correspondance.pdf`, `18. d subset rigorous proof.pdf`). These are new research artifacts that haven't been ingested into the library yet — they're in `reports/`, which is git tracking only, not the live library DB.

---

## What I think the best next moves are (in priority order)

The user-facing question — "make something that knows the strongest relationships across all content so any quote points to all contextual content most relevant" — is **already 80% built**. The canonical resolver + funnel + metadata panel does this for any single span. What it does NOT yet do is:

1. **Navigate multi-hop.** "Why does B factor through c_ij?" requires 3–5 edge follows. Phase A (graph tools shipped, toggled off) is what flips that on.
2. **Surface paths, not prose.** Right now Claude generates citations into prose; with tools on, it returns ordered chunk traversals.
3. **Work across domains.** The architecture is domain-neutral, but the tuning (especially the Rodina-native vocabulary regex in `chooseModel()`) is physics-specific. Nuclear/fusion/business would need its own vocabulary list or an embedding-based routing fallback.

### Tier 1 — finish the loose ends so Phase A is meaningful when we flip it (½ session)

1. **Backfill spans/chunks/embeddings/edges for the 33 pages** of the Lagrangians notes book. Pure backfill, no risk, ~5 min of compute. Without this, agent paths through pages 27–63 of that book are blind.
2. **Re-run the match pass** to validate Fix 2 + Fix 3. Quota permitting. Confirms Tier B/C jump and that the relationship-type collapse is fixed.
3. **Pad `prompts/notes-rewrite.txt` past 1024 tokens** with stricter citation rules. Cache hits go from 0 → ~80% on long batches; quality probably improves too.

### Tier 2 — flip Phase A on, prove the agent loop works (1–2 sessions)

4. **Enable graph tools per-collection** (feature flag in collection settings, not global). Test on the Rodina collection first. The pivot is from "Claude generates an answer that includes [[cite]] tags" to "Claude calls `search_chunks` → `follow_edges` → `read_chunk` and returns an ordered path." Most of the wiring exists; needs:
   - Feature-flag gate on the tools array in `claudeService.streamResponse`
   - Path renderer in `views/chat.ejs` (steps with chunk previews + relationship arrows + click-to-reader)
   - Per-collection toggle in the settings UI

   This is the change that makes "any quote points to all relevant context" go from "side panel showing one canonical concept" to "live agent that walks the graph and surfaces verified paths."

### Tier 3 — extend to nuclear/fusion/business (1–2 sessions)

5. **Domain-extension plan.** The architecture is domain-neutral. What's not is:
   - The `chooseModel()` regex in `scripts/rewrite-notes-pages-batch.js` — Rodina-specific. Replace with embedding-distance routing: any page whose embedding is within cosine 0.6 of "high-stakes domain content" routes to Opus. Generalizes to any domain.
   - Subject taxonomy. Right now we have one canonical-concept dictionary mostly populated with physics terms (`bcfw`, `planar_invariants`, etc.). For nuclear engineering, you'd want concepts like `lwr_safety_analysis`, `10_cfr_50_appendix_b`, `containment_design_basis_accident`. The infrastructure (`services/taxonomyService.js`, `models/CanonicalDefinition.js`) handles this — it's a content question, not a code question.
   - Subject tutor seeds. Per the agent hierarchy, each domain eventually gets a curated subgraph. For now we can seed by uploading 5–10 anchor documents per domain into a dedicated collection.

6. **Concrete first move for the nuclear track:** create a Collection called "Nuclear compliance" with custom AI instructions ("you are reviewing reactor safety analysis reports against 10 CFR 50 / NRC RG / ASME III compliance requirements; cite the regulatory section for every claim"). Upload 3–5 anchor docs (NRC RG 1.70, NUREG-0800, the relevant CFR sections, one or two SARs as examples). The same pipeline that ingested Rodina runs unchanged. Then Phase A's graph tools work over the nuclear corpus the same way they do over physics. Test query: "Is this SAR section §15.X compliant with NUREG-0800 §15.X?"

### Tier 4 — UI fires that block daily use (parallel, ~1 session)

7. **Mobile single-screen mode** (Z-Fold split-screen replacement nav stack).
8. **Metadata button single-use-then-dies** + **edge-click right-pane morph** + **"Add to collection" kebab no-op**. These three are the friction points you've flagged most often.

### Tier 5 — the horizon (don't start yet)

Phase B (TraversalSession + collection workspace), Phase C (autonomous Explorer), Phase G (Philosopher with isolationist mode + dead-end clustering + cut-set analysis). All designed in the agent vision docs. Build order: B → C → D → E → F → G. Start when Phase A is proven valuable in production.

---

## My honest read on the question you asked

You said: "you could be better than any top CTO out there in time and this is where you start to show it." The CTO move here is **not** to add another shiny feature. It's to **finish the architectural pivot you already started** (Phase A is built, toggled off — that's a half-shipped feature that isn't earning anything right now), validate it on the domain you know best (Rodina), then **prove cross-domain transfer** by spinning up a nuclear collection with the same pipeline. That's the demo that turns "personal research library" into "platform for any knowledge-work-heavy domain."

The Rodina, fusion, and nuclear compliance work-streams aren't competing — they're one architecture exercised on three corpora. The system that makes Rodina's hidden-zeros proof navigable is the same system that surfaces "this SAR section relies on a UFSAR assumption that conflicts with the 2018 NUREG amendment." Different content, same edges + funnel + agent traversal.

I'd recommend starting with Tier 1 + Tier 2 in order. Tier 3 is the validation that this scales beyond physics. Tier 4 in parallel because it's a different code path.

---

## Specific questions for you

1. **OpenAI quota** — restored or still capped? (Determines whether Tier 1 #2 is doable today.)
2. **The 5 new Rodina notes PDFs** in `reports/Rodina Docs and Data/Rodina Notes/` (`14.–18.`) — do you want them ingested into the live library now, or are they still scratch?
3. **Phase A flip** — do you want it gated per-collection (safer, lets us A/B against current RAG behavior) or globally (faster signal, riskier)?
4. **Nuclear track priority** — do you have an actual document set ready (NRC RGs, specific SARs, CFR sections), or is "nuclear" still aspirational?
5. **Anything I missed?** I read deep but not exhaustively. If there's something you've been mulling that isn't in `update.md` / `ai-update.md` / `ui-update.md`, this is the moment to dump it.
