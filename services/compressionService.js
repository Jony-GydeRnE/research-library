/**
 * compressionService — alphabet-based compression for Phase 3
 * edge classification I/O.
 *
 * Goal: every LLM call in the edge funnel speaks the same compact
 * letter-only language, so output tokens drop to ~3-30 chars per
 * verdict regardless of how many edges are produced.
 *
 * The encoding is documented in update.md (the new Phase 3
 * Architecture entry) and has three orthogonal letter spaces:
 *
 *   1. CHUNK INDEX
 *      Within a single ranking call, candidate chunks are labeled
 *      a, b, c, ..., z (1-indexed: a=1, ..., z=26). The strict
 *      26-candidate cap enforces single-letter encoding so the
 *      output stays at 2 chars per ranked entry.
 *
 *   2. CONFIDENCE / RELEVANCE
 *      a-z scale, ~3.846% per letter (a≈4%, z=100%). Used both
 *      for "how confident is the LLM in this match" and for
 *      "how relevant is this target to the source span".
 *
 *      Mapping: letter index 1..26 → percentile 1/26 .. 26/26.
 *
 *   3. RELATIONSHIP TYPE
 *      Single letter for each Edge.relationshipType:
 *        p = proves
 *        e = extends
 *        s = supports / assumes (s for "supports")
 *        d = uses_definition (d for definition)
 *        c = contradicts
 *        r = prerequisite (r for requires)
 *        q = equivalent (q for the math symbol that visually maps)
 *        m = missing_proof
 *        n = annotates (n for notes)
 *
 * Output formats used by the edge funnel:
 *
 *   Stage 4 (ranking call output, 2 chars per entry):
 *     Format:  <chunk_letter><confidence_letter>
 *     Example: "ez ct br ln dm aj"
 *              = "chunk e ranked at confidence z, chunk c at confidence t, ..."
 *     Up to 26 entries per call.
 *
 *   Stage 5 (classification call output, 3 chars per verdict):
 *     Format:  <relationship_letter><confidence_letter><relevance_letter>
 *     Example: "epz" = "extends, confidence p (~62%), relevance z (100%)"
 *     Or with multiple targets: "epz cdm" = two pairs in one call.
 *
 * The decoder is forgiving: it strips whitespace, ignores unknown
 * characters, and accepts both lowercase and uppercase. This means
 * the LLM can stutter or include explanatory text and we still
 * extract the verdict.
 */

// ─── Letter ↔ index ──────────────────────────────────────────────

/**
 * Letter for a 1-indexed chunk position. 1→a, 2→b, ..., 26→z.
 * Returns null when out of range — caller is responsible for
 * either truncating to 26 candidates or starting a new session.
 */
function indexToLetter(idx) {
  if (typeof idx !== 'number' || !Number.isFinite(idx)) return null;
  if (idx < 1 || idx > 26) return null;
  return String.fromCharCode('a'.charCodeAt(0) + idx - 1);
}

/**
 * 1-indexed position from a letter. Tolerates upper- or
 * lowercase. Returns null for non-letters.
 */
function letterToIndex(letter) {
  if (typeof letter !== 'string' || letter.length !== 1) return null;
  const lc = letter.toLowerCase();
  const code = lc.charCodeAt(0) - 'a'.charCodeAt(0);
  if (code < 0 || code > 25) return null;
  return code + 1;
}

// ─── Confidence / relevance percentiles ─────────────────────────
//
// 26 letters → 26 buckets. a is the lowest bucket (3.85%),
// z is the highest bucket (100%). Letter k is the midpoint at 50%.

/**
 * Map a 0..1 fraction to a confidence letter. 0 → a, 1 → z,
 * intermediate values → the bucket they fall into.
 */
function fractionToConfidence(f) {
  if (typeof f !== 'number' || !Number.isFinite(f)) return 'a';
  if (f <= 0) return 'a';
  if (f >= 1) return 'z';
  const idx = Math.max(1, Math.min(26, Math.ceil(f * 26)));
  return indexToLetter(idx);
}

/**
 * Inverse: confidence letter → mid-bucket fraction. a → ~0.019,
 * z → ~0.981. Useful when ranking edges or comparing scores.
 */
function confidenceToFraction(letter) {
  const idx = letterToIndex(letter);
  if (idx == null) return 0;
  // Mid-bucket value: (idx - 0.5) / 26
  return (idx - 0.5) / 26;
}

// ─── Relationship encoding ──────────────────────────────────────

const RELATIONSHIP_TO_LETTER = {
  proves: 'p',
  extends: 'e',
  assumes: 's',           // "supports"
  uses_definition: 'd',
  contradicts: 'c',
  prerequisite: 'r',      // "requires"
  equivalent: 'q',
  missing_proof: 'm',
  annotates: 'n',         // "notes"
};

const LETTER_TO_RELATIONSHIP = {};
for (const [name, letter] of Object.entries(RELATIONSHIP_TO_LETTER)) {
  LETTER_TO_RELATIONSHIP[letter] = name;
}

function relationshipToLetter(rel) {
  return RELATIONSHIP_TO_LETTER[rel] || 's'; // default supports/assumes
}

function letterToRelationship(letter) {
  if (typeof letter !== 'string' || letter.length === 0) return 'assumes';
  return LETTER_TO_RELATIONSHIP[letter.toLowerCase()] || 'assumes';
}

// ─── Encode/decode ranking output ───────────────────────────────
//
// Ranking call output is whitespace-separated entries of
// `<chunk_letter><confidence_letter>`. The decoder is forgiving:
// it splits on whitespace, drops anything that isn't exactly two
// letters, and returns the survivors in order.

/**
 * Decode a ranking output string. Returns an array of
 * { chunkIndex, confidence, fraction } in the order the LLM
 * provided (which is itself the ranking — first listed is most
 * confident).
 *
 * Example input:  "ez ct br ln dm aj"
 * Example output: [
 *   { chunkIndex: 5,  confidence: 'z', fraction: 0.981 },
 *   { chunkIndex: 3,  confidence: 't', fraction: 0.750 },
 *   ...
 * ]
 */
function decodeRanking(rankingStr) {
  if (!rankingStr || typeof rankingStr !== 'string') return [];
  const out = [];
  // Split on any non-letter sequence so commas, newlines, parens etc all work
  const tokens = rankingStr.split(/[^a-zA-Z]+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok.length !== 2) continue;
    const chunkIndex = letterToIndex(tok[0]);
    const confidence = tok[1].toLowerCase();
    const fraction = confidenceToFraction(confidence);
    if (chunkIndex == null || fraction === 0 && confidence !== 'a') continue;
    out.push({ chunkIndex, confidence, fraction });
  }
  return out;
}

/**
 * Encode an array of {chunkIndex, confidence} pairs back to the
 * compact ranking format. Used in tests and dry runs.
 */
function encodeRanking(entries) {
  if (!Array.isArray(entries)) return '';
  return entries
    .map(e => {
      const letter = indexToLetter(e.chunkIndex);
      const conf = e.confidence || fractionToConfidence(e.fraction || 0);
      if (!letter || !conf) return null;
      return letter + conf;
    })
    .filter(Boolean)
    .join(' ');
}

// ─── Encode/decode classification output ────────────────────────
//
// Classification call output is one or more 3-char verdicts:
//   <relationship_letter><confidence_letter><relevance_letter>
// Multiple verdicts are space- or comma-separated.
//
// Examples:
//   "epz"           = single verdict: extends, conf z, relevance z
//   "epz cdm"       = two verdicts in one call
//   "p z z"         = same as "pzz", whitespace-tolerant

/**
 * Decode a classification output. Returns an array of
 * { relationship, confidence, relevance, fraction }.
 */
function decodeClassification(s) {
  if (!s || typeof s !== 'string') return [];
  const compact = s.replace(/[^a-zA-Z]/g, '');
  const out = [];
  for (let i = 0; i + 3 <= compact.length; i += 3) {
    const relLetter = compact[i].toLowerCase();
    const confLetter = compact[i + 1].toLowerCase();
    const relevLetter = compact[i + 2].toLowerCase();
    const relationship = letterToRelationship(relLetter);
    const fraction = confidenceToFraction(confLetter);
    out.push({
      relationship,
      confidence: confLetter,
      relevance: relevLetter,
      fraction,
    });
  }
  return out;
}

/**
 * Encode a single classification verdict. Used in tests.
 */
function encodeClassification(rel, confLetter, relevLetter) {
  return relationshipToLetter(rel) + (confLetter || 'a') + (relevLetter || 'a');
}

module.exports = {
  // Letter ↔ index
  indexToLetter,
  letterToIndex,
  // Confidence
  fractionToConfidence,
  confidenceToFraction,
  // Relationship
  relationshipToLetter,
  letterToRelationship,
  RELATIONSHIP_TO_LETTER,
  LETTER_TO_RELATIONSHIP,
  // Ranking format
  decodeRanking,
  encodeRanking,
  // Classification format
  decodeClassification,
  encodeClassification,
};
