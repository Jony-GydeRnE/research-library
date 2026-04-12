# Grounding Gate — Shipped 2026-04-12

Commit `fc3112d`. Five files changed.

## What it does

After Claude responds in the in-app chat, the server runs `detectFakeCitations()` on the output. If fake citations are detected (books not in the library, fabricated ObjectIds, unknown author references), the hallucinated response is discarded and replaced with a gatekeeper message offering Yes/No buttons.

- **No** = pure client-side dismiss. Zero server calls, zero tokens.
- **Yes** = re-sends the last user message with `generalKnowledge: true`. Server skips the library metadata context entirely and sends a clean "answer from general knowledge, label it clearly" system prompt. Response is prefixed with a visible warning.

## Expected behaviors

1. User asks about something covered by the library → normal response passes through, no gatekeeper.
2. User asks about something NOT in the library → model fabricates → gatekeeper catches it → "Gyde stopped this response" message with Yes/No.
3. User clicks Yes → labeled general-knowledge answer with no `[[cite]]` tags.
4. User clicks No → buttons disappear, nothing happens.
5. User turns off "Strict grounding" in Settings → all messages bypass the validator automatically.

## Files changed

| file | change |
|---|---|
| `services/claudeService.js` | (A) Removed library-scope `renderBookMetadata` dump for every book — library scope now has overview + edges + notes only, no full chunk/span metadata. (B) New `detectFakeCitations(text)` — 5 Tier A checks (cite tags, prose hex IDs, possessive author refs, author-chapter refs, title-by-author patterns). (C) `streamResponse()` now accepts `opts = { generalKnowledge }`, runs validator post-stream, replaces response with gatekeeper if fakes found. (D) Exports `detectFakeCitations`. |
| `server.js` | Both `/api/chat/:chatId/message` and `/respond` routes read `generalKnowledge` from `req.body` and pass as opts to `streamResponse`. |
| `views/chat.ejs` | Streaming handler detects `[[GYDE_ASK_GENERAL_KNOWLEDGE]]` marker in `done` event, replaces streamed content with gatekeeper UI + Yes/No buttons. `send()` reads `gyde-grounding-strict` from localStorage. New `gydeRequestGeneralKnowledge()` re-sends last user message with flag. |
| `views/partials/sidebar.ejs` | Settings modal gains "Chat grounding mode" toggle (checkbox, default ON). Stored in localStorage. |
| `public/css/app.css` | Styles for `.gyde-confirm-row`, `.gyde-btn-confirm-yes`, `.gyde-btn-confirm-no`, `.settings-desc`, `.settings-toggle`. |

## Known limitations / follow-ups

- **Streaming UX**: the hallucinated text streams visibly, THEN gets replaced by the gatekeeper when the `done` event fires. User sees a flash of bad content before the swap. Future fix: buffer the full response server-side before streaming, or stream a "thinking..." placeholder until validation passes.
- **Tier B checks not implemented yet**: "Title by Author" prose patterns where the author IS known but the title is wrong. Currently only checks when BOTH title and author are unrecognized. Could produce false negatives when the model uses a real author name with a fabricated title.
- **Library-scope metadata removed**: the All Files chat no longer sees full chunk/span dumps for every book. This is intentional (it was the enabler of convincing fabrication) but means the All Files chat is less capable at answering specific metadata questions about a book. The user must navigate to the book's chat or collection chat for full metadata access.
- **Scale concern (user-flagged)**: even per-book full metadata dumps may be too large at scale (3500 chunks/book x dozens of books). Long-term fix: embedding-first retrieval layer — cosine kills noise, AI picks 5 books to deep-dive from the top 20-30%. Queued for a future session.
- **Quote existence validation not implemented**: the strongest possible check would verify that `[[cite]]` quoted text actually appears in the stored page/chunk text. This is unfakeable. Deferred because it requires chunk-text lookup per citation, which adds latency.

## Reconsider / pivot notes

The user is considering a fundamental architectural pivot away from "LLM answers questions grounded in citations" toward "LLM navigates the knowledge graph as a persistent agent, surfaces verified paths, never generates content — only selects existing content." This changes the role of the grounding gate from a safety net to an irrelevant feature (the LLM would never be in a position to hallucinate citations because it would never generate prose answers). The pivot is discussed in `reports/2026-04-12/vision-gyde-as-agent.md`.
