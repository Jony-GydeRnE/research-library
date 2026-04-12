const mongoose = require('mongoose');

/**
 * TraversalVibe — unverified connections the agent noticed but
 * cannot currently back with a verified edge. First-class epistemic
 * category: a vibe is NEVER a citation, never surfaces in a path,
 * but also is not deleted. It persists across sessions and is
 * checked on every new ingestion to see if freshly created edges
 * now make the vibe "reachable" — if so the vibe is auto-promoted
 * from `vibe` → `candidate` and resurfaces to the user.
 *
 * Schema only for Phase A. Service logic (create / read / auto-
 * promote on new ingestion) lands in Phase B alongside the full
 * TraversalSession / collection-workspace work. Planted now so the
 * field shape doesn't migrate later.
 *
 * Auto-promotion (Phase B+): after a new book is ingested and
 * edges are created, run a sweep —
 *   for each open vibe:
 *     if any new edge connects two chunks that are both in
 *     vibe.seedChunkIds (or one seed + a chunk reachable within
 *     max_depth from another seed):
 *       → set vibe.status = 'candidate'
 *       → notify the owning collection / chat
 * This makes auto-promotion a deterministic DB query rather than
 * requiring the agent to re-read its own workspace notes.
 */
const traversalVibeSchema = new mongoose.Schema({
  // Scope — a vibe belongs to a collection workspace (primary) and
  // optionally to the chat that birthed it. Either can be null for
  // library-wide vibes the agent notices outside any one chat.
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },

  // The nodes that triggered the intuition. The vibe is "about"
  // the (possibly nonexistent) path between them. Auto-promotion
  // sweeps these against newly created edges.
  seedChunkIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' }],

  // Freeform prose capturing what the connection feels like.
  // Written by the agent, displayed to the user as-is. Not a
  // citation; explicitly unverified.
  intuitionText: String,

  // Optional — what kind of new content would make this worth
  // rechecking. Used as a filter hint in the auto-promote sweep
  // (e.g. "any paper on simplicial homology", "any chunk tagged
  // boundary_operator"). Freeform string, no schema enforcement —
  // the sweep matches it loosely against new chunks' contextTags
  // and structural types. Null means "check on every ingestion".
  autoPromoteOn: { type: String, default: null },

  // Lifecycle:
  //   vibe       → initial state, unverified, do NOT cite
  //   candidate  → a path now appears to exist; surfaces to user
  //                for judgment but is still not authoritative
  //   promoted   → user accepted the candidate; treated as a real
  //                path from now on (still stored as a vibe for
  //                provenance — the underlying edges are the
  //                actual citations)
  //   dead       → user rejected, or the underlying chunks were
  //                deleted; kept as a tombstone to avoid
  //                re-noticing the same dead-end vibe later
  status: {
    type: String,
    enum: ['vibe', 'candidate', 'promoted', 'dead'],
    default: 'vibe',
  },

  // Bookkeeping for the auto-promote sweep: the last time we
  // checked this vibe against the graph, and what ingestion
  // triggered the check. Lets us skip re-checking unchanged vibes.
  lastCheckedAt: Date,
  lastCheckedAgainstBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

traversalVibeSchema.index({ collectionId: 1, status: 1 });
traversalVibeSchema.index({ seedChunkIds: 1 });
traversalVibeSchema.index({ status: 1, lastCheckedAt: 1 });

traversalVibeSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('TraversalVibe', traversalVibeSchema);
