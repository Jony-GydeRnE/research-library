/**
 * Taxonomy normalization — maps synonyms to canonical terms.
 * Simple map for now. Will grow as more books are processed.
 */

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

/**
 * Normalize a term to its canonical form.
 * Returns the canonical term or the original (lowercased) if no synonym found.
 */
function normalize(term) {
  if (!term) return term;
  const lower = term.toLowerCase().trim();
  return SYNONYMS[lower] || lower;
}

/**
 * Normalize an array of terms, deduplicate.
 */
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

module.exports = { normalize, normalizeList };
