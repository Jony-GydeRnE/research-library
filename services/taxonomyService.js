/**
 * taxonomyService — synonym normalization for context tags.
 *
 * Two layers, both still exported:
 *
 *   1. Surface synonyms (legacy `normalize` / `normalizeList`).
 *      A small hand-curated map used by metadataService for topic
 *      and concept extraction. Stays as-is so existing callers
 *      keep working.
 *
 *   2. Concept normalization for span/chunk contextTags (new).
 *      The edge resolver matches a source span's tags against a
 *      target chunk's tags. With exact-string matching this fails
 *      whenever two books' LLM tagging passes use different
 *      surface vocabulary for the same physics concept:
 *
 *        Book A span: contextTags = ["hidden_zeros", "splitting"]
 *        Book B chunk: contextTags = ["tr_phi3_zeros", "smooth_splitting"]
 *        -> exact-match overlap = 0 even though they're describing
 *           the same thing
 *
 *      The fix is to map each surface tag to a SET of canonical
 *      concepts (not a single canonical, because compound tags
 *      like `hidden_zero_factorisation` legitimately belong to
 *      both `hidden_zeros` and `factorization`). Two tags are
 *      synonymous when their concept sets intersect.
 *
 * Why concept-via-substring instead of a hand-curated alias list
 * of every observed tag string:
 *   - The tag space is large (1300+ distinct strings across the
 *     current 4-book corpus) and grows every regen, so per-string
 *     curation is unmaintainable.
 *   - The LLM is consistent at the *token* level — it'll spell
 *     things like `hidden_zero`, `hidden_zeroes`, `hidden_zero_*`
 *     with the same root. If we identify the concept by a small
 *     set of marker substrings, we catch every variant the LLM
 *     can plausibly produce, including ones we haven't seen yet.
 *   - This is closer to a stem-and-cluster strategy than a
 *     dictionary lookup, which is what we actually want.
 *
 * Concepts and their markers were bootstrapped from the actual
 * frequency distribution of contextTags in the database (run
 * `node -e "Span.distinct('contextTags')"` to regenerate the
 * frequency table when the corpus shifts).
 *
 * Coverage philosophy: a tag that doesn't match any concept maps
 * to itself (lowercased) as a singleton, so unknown tags retain
 * exact-match semantics. The concept layer is strictly additive,
 * never lossy.
 */

// ─── Layer 1 — surface synonyms (legacy, used by metadataService) ──

const SYNONYMS = {
  'qft': 'quantum field theory',
  'quantum field theories': 'quantum field theory',
  'scattering amplitude': 'scattering amplitudes',
  'amplitude': 'scattering amplitudes',
  'bcfw': 'bcfw recursion',
  'bcfw shift': 'bcfw recursion',
  'britto-cachazo-feng-witten': 'bcfw recursion',
  'nlsm': 'non-linear sigma model',
  'yang-mills': 'yang-mills theory',
  'ym': 'yang-mills theory',
  'feynman diagram': 'feynman diagrams',
  'color-kinematic duality': 'bcj duality',
  'bern-carrasco-johansson': 'bcj duality',
  'alg geom': 'algebraic geometry',
  'algebraic geom': 'algebraic geometry',
  'sheaf': 'sheaves',
  'scheme': 'schemes',
  'variety': 'algebraic varieties',
  'varieties': 'algebraic varieties',
};

function normalize(term) {
  if (!term) return term;
  const lower = term.toLowerCase().trim();
  return SYNONYMS[lower] || lower;
}

function normalizeList(terms) {
  if (!terms || !Array.isArray(terms)) return [];
  const seen = new Set();
  return terms
    .map(normalize)
    .filter(t => {
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
}

// ─── Layer 2 — concept catalog for contextTag matching ────────
//
// concept name → array of marker substrings. A tag matches a
// concept if any marker is a substring of the lowercased tag.
//
// Concept names are intentionally human-readable so they show up
// understandably in score-detail logs. They're never stored on
// chunks or spans — only computed at match time.
//
// Marker substrings are chosen to be specific enough to avoid
// cross-concept collisions. Order within each list doesn't
// matter (first match wins per concept) but ordering concepts
// from most-specific to most-general is a good practice for
// future readability.

const CONCEPTS = {
  // ── The big four in our current edge graph ─────────────
  hidden_zeros: [
    'hidden_zero', 'hidden_zeroes',
    'amplitude_zero', 'amplitude_zeros',
    'tr_phi3_zero', 'phi3_zero',
    'ym_zero', 'gluon_zero', 'massless_zero', 'general_zero',
    'novel_zero', 'amplitude_vanishing',
    'zero_locus', 'zero_condition', 'zeros_factorization',
    'zeros_factorisation', 'zero_causal_diamond',
    'string_amplitude_zero', 'zeros_factorizations',
    'skinny_rectangle_zero',
  ],
  splitting: [
    'splitting', 'splittings', 'smooth_split',
    'amplitude_split', 'phi3_split', 'ym_split',
    'tensor_split', 'vertex_split',
    'factorization_3_split',
  ],
  factorization: [
    'factorization', 'factorisation', 'factorizations',
    'amplitude_factor', 'propagator_factor', 'recursive_factor',
    'gluon_factor', 'tr_phi3_factor', 'stringy_factor',
    'factorization_proof', 'factorization_pattern',
    'factorization_mechanism', 'factorization_example',
    'causal_diamond_factor', 'numerator_factor',
  ],
  kinematic_mesh: [
    'kinematic_mesh', 'mesh_picture', 'mesh_structure',
    'mesh_region', 'gluon_mesh', 'simplices_mesh',
    'scattering_mesh', 'effective_gluon_kinematic_mesh',
    'massive_kinematic_mesh', 'kinematic_mesh_example',
  ],
  abhy_associahedron: [
    'abhy_associahedron', 'associahedron',
  ],

  // ── Theory-family concepts ─────────────────────────────
  nlsm: [
    'nlsm', 'mnlsm', 'pion_amplitude', 'pion_soft',
    'non_linear_sigma', 'nonlinear_sigma',
  ],
  tr_phi3: [
    'tr_phi3', 'tr_phi_amplitude', 'tr_phi_3',
    'phi3_amplitude', 'phi3_theory', 'phi3_currents',
  ],
  yang_mills: [
    'yang_mills', 'ym_amplitude', 'ym_amplitudes',
    'ym_hidden', 'ym_constraints', 'gluon_amplitude',
    'n_gluon', 'n_point_gluon',
  ],
  string_amplitude: [
    'string_amplitude', 'stringy_integral',
    'stringy_deformation', 'stringy_generalization',
    'bosonic_string', 'stringy_factorization',
    'stringy_uv', 'stringy_tr_phi', 'stringy_formulation',
  ],

  // ── Physical/mathematical structures ───────────────────
  uv_scaling: [
    'uv_scaling', 'uv_completion', 'uv_behaviour',
    'uv_softening', 'uv_amplitude', 'uv_power',
    'enhanced_uv', 'ultraviolet_scaling',
  ],
  bcfw: [
    'bcfw',
    // Spelled-out author form. Required so highlights that
    // capture the full citation form (which is how Rodina's
    // abstract introduces the concept — "non-adjacent
    // Britto-Cachazo-Feng-Witten (BCFW) shifts") map to the
    // same canonical as the acronym. The four surnames are
    // included as individual markers so any single-author
    // mention also resolves.
    'britto', 'cachazo', 'feng', 'witten',
    'britto_cachazo_feng_witten',
    'britto-cachazo-feng-witten',
  ],
  adler_zero: [
    'adler_zero', 'adler_limit',
  ],
  uniqueness_conjecture: [
    'uniqueness', 'unique_amplitude',
    'tr_phi3_conjecture', 'phi3_conjecture',
    'amplitude_determination', 'amplitude_uniqueness',
    'uniqueness_proof', 'uniqueness_theorem',
    'uniqueness_conjecture', 'uniqueness_results',
    // Bridge markers for the regen-only state. The LLM tags
    // chunks discussing the conjecture with `ansatz`,
    // `tr_phi3_ansatz`, `tree_amplitude_ansatz`, and (for the
    // ansatz-proof chunks) `scattering_amplitudes_proof`. The
    // generic `conjecture` marker also catches any *_conjecture
    // tag without us needing to enumerate them.
    'conjecture', 'ansatz',
    'scattering_amplitudes_proof',
  ],
  soft_theorem: [
    'soft_theorem', 'soft_limit', 'soft_limits',
    'soft_recursion',
  ],
  causal_diamond: [
    'causal_diamond',
  ],
  kinematic_shift: [
    'kinematic_shift', 'kinematical_shift', 'triangulation_shift',
  ],
  scaffolding: [
    'scaffolding',
  ],
  planar_variables: [
    'planar_variable', 'planar_variables', 'mandelstam',
    'kinematic_invariant', 'kinematic_basis', 'kinematic_data',
  ],

  // ── Discovery / introduction signals ───────────────────
  // Narrow concept that helps route "X was discovered in [Y]"
  // citations to intro chunks rather than the abstract.
  // `observation` deliberately NOT included — the abstract uses
  // it to summarize the paper's discovery, which makes the
  // abstract win discovery-tagged source spans by overlap=2.
  // Body chunks discussing the discovery use phrases like
  // "in this paper we discovered" and the LLM tags those with
  // `discovery` directly, so this catalog stays narrow.
  discovery: [
    'discovery', 'first_observation', 'first_seen',
    'introduction', 'discovered_in',
  ],
};

// ─── Lookup ───────────────────────────────────────────────────

/**
 * Return the set of canonical concepts a tag belongs to. A tag
 * with no concept matches maps to itself as a singleton, so
 * unknown tags still get exact-match semantics.
 */
function getCanonicals(tag) {
  if (!tag) return [];
  const t = String(tag).toLowerCase();
  const concepts = [];
  for (const [name, markers] of Object.entries(CONCEPTS)) {
    for (const m of markers) {
      if (t.includes(m)) {
        concepts.push(name);
        break;
      }
    }
  }
  if (concepts.length === 0) concepts.push(t);
  return concepts;
}

/**
 * Expand a list of tags to the union of their canonical concepts.
 * Use this in the resolver to compute "what concepts does this
 * source span / target chunk cover?"
 */
function expandTags(tags) {
  const out = new Set();
  if (!tags) return out;
  for (const t of tags) {
    for (const c of getCanonicals(t)) out.add(c);
  }
  return out;
}

/**
 * True if the two tags share at least one canonical concept.
 */
function areSynonyms(a, b) {
  if (!a || !b) return false;
  if (String(a).toLowerCase() === String(b).toLowerCase()) return true;
  const ca = new Set(getCanonicals(a));
  for (const c of getCanonicals(b)) if (ca.has(c)) return true;
  return false;
}

/**
 * Number of canonical concepts shared between two tag lists.
 * This is the value the resolver uses for its overlap score.
 */
function conceptOverlap(tagsA, tagsB) {
  const ca = expandTags(tagsA);
  const cb = expandTags(tagsB);
  let n = 0;
  for (const c of ca) if (cb.has(c)) n++;
  return n;
}

module.exports = {
  // Layer 1 (legacy)
  normalize,
  normalizeList,
  // Layer 2 (concept normalization)
  CONCEPTS,
  getCanonicals,
  expandTags,
  areSynonyms,
  conceptOverlap,
};
