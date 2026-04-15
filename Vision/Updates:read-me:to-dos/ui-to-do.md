# ui-to-do.md

UI / UX / reader / split-screen / chat surface / file cards / kebab menus.
Backend / pipeline / data-quality items live in `ai-to-do.md`.

Add new items at the bottom of their priority bucket. Cross out and move to "Recently shipped" when they land. Keep file paths + function names on every item so future sessions can grep to the right place.

---

## 🖼 Reader / split-screen / metadata UI (the 2026-04-13 bucket)

- [ ] 🟡 **Mobile single-screen mode (new 2026-04-14).** On regular handheld phones (viewport ≲ 500px), split-screen shouldn't open at all — instead, clicking an edge should REPLACE the current reader pane with the target book (single-pane toggle). The back/forward buttons then step through the navigation stack. Z Fold 7 and larger devices keep the current two-pane split behavior. Fold the stack per-tab so the user can always get back to where they came from. Detection: use `window.matchMedia('(max-width: 520px)')` or similar. Files: `public/js/chat-split-reader.js` (add mobile detection in `open()` → navigate instead of iframe), `public/js/reader.js` (maintain a nav stack in localStorage keyed by tab), `public/css/reader.css` (hide the split-panel divider on narrow).


- [ ] 🟡 **Reader view-mode axis redesign (Jony 2026-04-13).** Current mode toggle is Pages / Scroll / PDF / Chunks — four buttons on one axis. Conflates two independent concerns: FORMAT (HTML vs PDF) and LAYOUT (pages vs scroll). Also Chunks is really "view the metadata layer", not a third format. Proposed redesign:
  - Two axes. **Format**: HTML or PDF. **Layout**: Pages or Scroll. Default layout = Scroll for both formats. Currently Scroll is only implemented for HTML, "and that's racist" — PDF should also support Scroll mode (stitched vertical PDF page images).
  - Rename "Chunks" → "Metadata". It IS the metadata layer, not a separate format.
  - Put the controls under a book-settings button in the reader header (like the Books app). Settings panel has two rows: (Format: HTML | PDF) and (Layout: Pages | Scroll). Plus a separate toggle for the Metadata overlay.
  - The Metadata toggle opens chunks view in SPLIT SCREEN with the actual book content on one side — most of the time the user wants both visible, not a full-screen metadata mode.
  - Alternative sidebar arrangement (stolen from Books app): split the left sidebar in half, top half lists format/layout options, bottom half lists chapters/sections.
  - Files: `views/reader.ejs`, `public/js/reader.js`, `public/css/reader.css`. Significant refactor — spec first, then build.

- [ ] 🟡 **Highlight context menu: "Metadata" opens chunks view at exact span (Jony 2026-04-13).** Currently the highlight context menu has actions like "Save highlight", "Ask about this passage", etc. Add a new action: "Metadata". Clicking it opens the chunks-view of the current page in split screen, scrolled to the exact chunk containing the highlighted text, with the matching span's detail panel pre-expanded. This is the natural evolution of the current metadata panel — instead of a standalone side panel showing one tag set, the user jumps into the chunks view where they can see the span in context, click `;;` to switch concepts, follow edges, etc. Files: `public/js/highlights.js` (context menu), `public/js/chunks-view.js` (jumpToSpan helper that scrolls + opens panel), `public/js/reader.js` (split-screen integration).

- [ ] 🟡 **Metadata panel size regressed (Jony 2026-04-13).** The current metadata side panel is ~2x wider than it used to be. User reports it was smaller before. Either (a) revert the CSS width change that made it wider, or (b) obsolete the panel entirely in favor of the "Metadata context menu → chunks view in split screen" flow above. If (b), archive the current metadata-panel.js once the highlight-context-menu → chunks-jump flow works. File: `public/css/reader.css` metadata-panel selectors.

- [ ] 🟡 **Sidebar collapsed state doesn't show section numbers (Jony 2026-04-13).** When the reader sidebar is collapsed, the section list loses its numbering (chapter/section numbers from `Page.chapterTitle` / `Page.sectionTitle`). Collapsed mode should show at minimum the number + first 2-3 characters of the title as an icon so the user can still navigate. Files: `views/partials/sidebar.ejs`, `public/css/reader.css`.

- [ ] 🟡 **Metadata button is single-use then dies (Jony 2026-04-13 screenshots).** User highlights text → context menu shows "Metadata" button → clicks → panel opens and works. User dismisses the highlight and re-highlights something → context menu shows "Metadata" button → clicks → nothing happens. Button renders but the click handler has detached or the panel open-state guard short-circuits. Likely in `public/js/highlights.js` (context menu wiring) and/or `public/js/metadata-panel.js` (open-once state flag). Repro: highlight, open metadata, close, re-highlight, click metadata → silent no-op.

- [ ] 🟡 **Weak-highlight dismiss button (Jony 2026-04-13).** The current highlight triggered by selecting text for the metadata panel is ephemeral — it disappears on page refresh and isn't a "saved" highlight. But while it's visible there's no way to dismiss it short of clicking elsewhere. Add a tiny `×` button at the top-right corner of any active weak-highlight that closes it. Should NOT be on saved highlights (those have their own delete flow). Files: `public/js/highlights.js`, `public/css/reader.css`.

- [ ] 🟡 **Edge-click: right panel morphs into target book, sidebar always closes (Jony 2026-04-13).** When the user clicks an edge row in the metadata panel, the expected behavior is: the RIGHT half of the split screen (currently showing metadata) REPLACES itself with the actual target book content, opened to the exact page, with a weak-highlight callout box around the quoted chunk. Current behavior (per screenshots 32-35): going into a double split, so the user sees 3 panes squeezed. Logic rules:
  - If split-screen is already open with metadata on the right: replace the right pane contents with the target book reader (don't open a new split level).
  - If split-screen is not open: open a new split, with the current reader on the left and the target book on the right.
  - In EITHER case, force-close the app sidebar / hamburger immediately on transition. Even if it was open before. The user must explicitly re-open it. Same rule applies every time we transition into any split-screen state.
  - The right-pane-morph should visually transition (fade/morph/slide) rather than hard-swap — makes it feel like the metadata "window" is turning INTO the cited content, which is conceptually true: the metadata preview WAS a window into that book, the click opens the full window.
  - Aspiration log: future version should make the morph feel magical — the preview text within the metadata card is already the chunk text, and clicking it should feel like the card expands out to fill the pane as the full book view.
  Files: `public/js/metadata-panel.js` `wireResolvedLinks()` (currently calls `window.__openSplitReader` unconditionally), `public/js/chat-split-reader.js` (split controller), `views/reader.ejs` (sidebar force-close hook).

- [ ] **Chunks view per-mode rendering inheritance.** Currently chunks view is always scroll-all-pages. User's original spec: if opened from Pages mode, render single-page mirroring Pages; if opened from Scroll/PDF, render scroll-all-pages. Marked as TODO in header comment of `public/js/chunks-view.js` (`load()` function).

- [ ] **Metadata panel: show definition FROM scroll notes, not PDF.** When a span's `uses_definition` edge points at a notes book, the metadata popup should render the SCROLL/HTML version of that notes page (the AI-rewritten clean version via `Page.htmlContent` — NOT `rawText` or PDF mode). The PDF source is messy handwritten content; the scroll version is the clean narrative. This is a render-path change in the metadata panel: resolve target chunk → target page → render htmlContent inline in the popup.

---

## 🔥 High priority — fires

- [ ] 🟡 **"Add to collection" kebab is a silent no-op (new 2026-04-13).** On the `/files` page, the book-card kebab → "Add to collection" opens the collection picker, user selects a collection, dialog closes, nothing is persisted. No error in UI. Start points: `views/files.ejs` (or `views/files-notebook.ejs`) for the kebab menu handler + picker modal; `public/js/files.js` (if it exists) for the client-side submit handler; `controllers/booksController.js` or `controllers/collectionsController.js` for the expected endpoint. Most likely root cause candidates: (a) client POST is not firing / is hitting a 404; (b) endpoint writes to `Collection.bookIds` but `Book.collections` is also used as the canonical display list and isn't being updated; (c) endpoint writes the right field but the `/files` cards read from a stale aggregation. Verify by watching Network tab during the click and checking both `Collection.bookIds` and `Book.collections` in Mongo after.

- [ ] **Source-side cite click broken when bookId is hallucinated.** Old chats from before `842796f` contain `[[cite]]` tags with fabricated bookIds (verified: `682b9b5b...`, `6839b022...`, `6838f4f2...`, none in DB). The chat renderer at `views/chat.ejs:282-308 renderCitation()` falls back to `'Book'` as the title and emits a dead-link `<a href>`. Hallucination root-cause is fixed in `services/claudeService.js BASE_PROMPT` (anti-hallucination rule, c0a8284) and `services/claudeService.js getAllCrossBookEdges()` (high-priority cross_book_edges section, 842796f). **ACTION:** test in a fresh chat post-c0a8284. If new chats still produce dead-link sources, add a server-side validator that strips `[[cite]]` tags whose bookId isn't in `booksMap` before sending to client.

---

## 🛠 Medium priority — UX

- [ ] **Split-screen sidebar consolidation (clunky-UI ask).** When split-screen is open, only ONE app sidebar should be visible at a time (the one for the book in focus). Default state: hamburger COLLAPSED. Never 2 sidebars at a time. When the user exits a book, return to the sidebar that was there before. Files: `views/reader.ejs`, `views/partials/sidebar.ejs`, `public/css/reader.css`. Likely fix: when split-reader injects the inner book reader, force `?sidebar=collapsed` (already supported by reader.js IIFE around line 240) AND CSS-hide the outer app sidebar via a class on `body` toggled by split-reader open/close.

- [ ] **Back/forward navigation between books in split-screen.** If user is reading Book A in the split panel, clicks an edge → Book B opens, they need a back button to return to Book A and a forward button to re-open Book B. Eventually a stack of N books with arrows in the split-reader header. Files: `public/js/chat-split-reader.js` (the split-panel controller), `views/chat.ejs`.

- [ ] **Chat continuation across navigation.** If AI is mid-stream when user navigates away from `/chat/:id`, the stream is killed and the partial reply is lost. Two parts: (a) server keeps the stream alive and persists the message even if the SSE client disconnects — `services/claudeService.js streamResponse() onDone` callback already saves the full message, but the controller likely tears down the stream when the response object closes; (b) when user returns to `/chat/:id`, show in-progress message and reconnect to the stream if running. Files: `server.js` `/api/chat/:id/message`, `services/claudeService.js`, `views/chat.ejs`.

- [ ] **Persistent chat input draft.** `input#chatInput` value should persist across page navigations. Use `localStorage` keyed by `chatId`. Restore on `/chat/:id` load, clear on send. File: `views/chat.ejs` around `function send()` (line ~262).

- [ ] **Per-message UX bundle: thumbs ↑↓, regenerate, branch toggle, export to .tex/.pdf with timestamps.** Schema: add `Message.feedback` (`up | down | null`) and `Message.parentMessageId` for branching. UI: extend `views/chat.ejs` `chat-message-actions` row (line ~76). Copy button already shipped in 842796f.

- [ ] **Quality sweep UI integration (kebab + stats modal block).** Sweep v1 is CLI-only via `scripts/sweep-book.js`. Needs: "Improve metadata" kebab item on the Files page per book that enqueues the sweep. Stats modal block showing last-run date, chunks scanned, pattern breakdown, cost, "Run again" button. Rollback endpoint wired to a button. Schema and service already exist — pure UI wiring. File: `views/files.ejs`, `public/js/files-*.js`.

---

## 📋 Low priority — features and polish

- [ ] **Reader UX for note-citation highlights.** Backend shipped in `8f8a7b7` (`services/noteIngestionService.js`). Need: distinct color (light green) for `Highlight.color === 'note'` (model already has the field), click opens notes panel side-by-side with the source page, "→ notes" pill on source-book chunks that have outgoing `note-citation` edges. Files: `public/css/reader.css`, `public/js/highlights.js`, `views/reader.ejs`.

- [ ] **Cost analysis refinement on stats modal.** Per-page constants in `controllers/booksController.js` (`COST_PER_VISION_PAGE = 0.015`, `COST_PER_SPAN_PAGE = 0.005`) are pegged to GPT-4o pricing and rough. Refine against actual OpenAI bills. Add a "history" view that shows cumulative spend over time across the library.

- [ ] **3-pane split screen.** 2 books + chat, or 2 books + notes. Defer until 2-pane is solid.

---

## ✅ Recently shipped (move here once stable, then prune after a few sessions)

- ✅ **Split-reader: dock right in reader context + TOC alignment + chunks focus carry-through** (`63c147c`, `835f4ca`, 2026-04-13). Clicking an edge from the chunks panel now opens the target book in a RIGHT-docked split panel (not the middle dock used by chat). Outer sidebar stops force-collapsing in reader context since right-docking puts the new panel on the opposite side. TOC page numbers are tabular-nums right-aligned with `min-width: 0` on `.toc-title` (fixes the "numbers disappear past page 54" flex-overflow bug). Chunks view emits `cv-page-change` events as the user scrolls, seeding `pendingHighlight` so Scroll/Pages mode lands on the same chunk with the dismissable citation callout.

- ✅ **Rewrite preview shell** (`public/rewrite-preview.html`, 2026-04-13). Dark-background standalone MathJax viewer for rewritten notes pages that live in `/tmp/rewrite-*.html` before they hit the DB. Used during the notes-rewrite pipeline iteration to avoid reader.css leaking in and painting display-math blocks as white boxes.
