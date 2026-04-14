# ui-update.md

A rolling knowledge log of UI / UX / reader / split-screen / chat surface changes. **Newest entries at the top.** Pair with `ui-to-do.md` for the working list.

Maintained by Claude Code (CC) on a ~3-5-response cadence. Bad attempts that got fixed in the same session are not listed — only the final state of each session's work matters. Backend / pipeline / data-quality entries live in `ai-update.md`.

Commit messages are the authoritative comprehensive change record. This file is the narrative view: what was the session trying to accomplish, what worked, what didn't, what's the current feel of the UI.

---

## 2026-04-13 — UI split session

**Session shape:** figure-first, with split-reader + TOC alignment as the durable wins. See the detailed entry in `ai-update.md` for the full timeline; the UI-relevant deltas are summarized here.

**What shipped on the UI side:**

1. **Split-reader docks right in reader context.** Clicking an edge from the chunks panel now opens the target book in a RIGHT-docked iframe panel, not the chat's middle dock. Outer sidebar stays visible (no force-collapse in reader context). Rodina + notes can sit side-by-side with both TOCs accessible.

2. **TOC page-number alignment fix.** The missing `min-width: 0` on `.toc-title` was causing long section titles to push page numbers off the right edge past ~page 54. Flex children now shrink correctly, page numbers render in a tabular-nums fixed column regardless of nesting depth.

3. **Chunks-view scroll-spy carries focus across mode switches.** When the user scrolls to chunk 14 in chunks mode and hits Scroll or Pages, the new mode lands on the same physical chunk with the dismissable citation-callout box highlighting it. Previously the mode switch always dropped back to page 1.

4. **Reader auto-recovery on edge-click latency.** Edge URL now emits `mode=pages` instead of `mode=scroll` (single-page fetch, <1s) and intercepts the click to route through the split-reader iframe instead of opening a new tab. No more "forever + flash at page 1 then scroll down" delay.

**What's still open:** See `ui-to-do.md` for the full list. Highlights:
- Reader view-mode axis redesign (Format × Layout as two axes, not 4 buttons on one).
- Metadata panel regression (~2x wider than before).
- Metadata button one-shot death (single-use-then-dies bug).
- Edge-click right-pane morph (don't open a second split level).
- Add-to-collection kebab silent no-op on /files page.
