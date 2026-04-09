/**
 * Regex pre-annotation service.
 * Scans page rawText for structural signals: missing-proof phrases,
 * citations, named environments, equation markers.
 * Zero AI cost — pure regex.
 */

const MISSING_PROOF_PATTERNS = [
  { re: /it is obvious(?:\s+that)?/gi, label: 'it is obvious' },
  { re: /the reader may verify/gi, label: 'the reader may verify' },
  { re: /it follows immediately/gi, label: 'it follows immediately' },
  { re: /it is trivial/gi, label: 'it is trivial' },
  { re: /it can be shown/gi, label: 'it can be shown' },
  { re: /one easily checks/gi, label: 'one easily checks' },
  { re: /left as an exercise/gi, label: 'left as an exercise' },
  { re: /clearly\b/gi, label: 'clearly' },
  { re: /it follows easily/gi, label: 'it follows easily' },
  { re: /one can verify/gi, label: 'one can verify' },
  { re: /trivially\b/gi, label: 'trivially' },
];

const CITATION_PATTERN = /\[([A-Za-z]+(?:\d{2,4})?(?:,\s*(?:Ch\.|Thm\.|Prop\.|Sec\.|p\.)\s*[\d.–\-]+)?)\]/g;

const NAMED_ENV_PATTERN = /\b(Theorem|Definition|Lemma|Proposition|Corollary|Proof|Example|Remark)\s*([\d.]*)/gi;

const EQUATION_NUMBER_PATTERN = /\((\d+(?:\.\d+)?)\)\s*$/gm;

/**
 * Find the sentence index for a character offset in the text.
 * Sentences are split roughly by period-space or newline-newline.
 */
function getSentenceIndex(text, offset) {
  const before = text.substring(0, offset);
  // Count sentence boundaries: ". " or double newline
  const sentences = before.split(/(?:\.\s+|\n\n+)/);
  return sentences.length - 1;
}

/**
 * Scan a page's rawText and return structural annotations.
 * @param {string} rawText - The page's rawText field
 * @returns {Array} annotations: [{ type, sentenceRange, value }]
 */
function annotate(rawText) {
  if (!rawText) return [];
  const annotations = [];

  // Missing-proof phrases
  for (const { re, label } of MISSING_PROOF_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(rawText)) !== null) {
      const sentIdx = getSentenceIndex(rawText, match.index);
      annotations.push({
        kind: 'missing_proof',
        sentenceRange: [sentIdx, sentIdx],
        value: label,
      });
    }
  }

  // Citations
  CITATION_PATTERN.lastIndex = 0;
  let citMatch;
  while ((citMatch = CITATION_PATTERN.exec(rawText)) !== null) {
    const sentIdx = getSentenceIndex(rawText, citMatch.index);
    annotations.push({
      kind: 'citation',
      sentenceRange: [sentIdx, sentIdx],
      value: citMatch[1],
    });
  }

  // Named environments
  NAMED_ENV_PATTERN.lastIndex = 0;
  let envMatch;
  while ((envMatch = NAMED_ENV_PATTERN.exec(rawText)) !== null) {
    const sentIdx = getSentenceIndex(rawText, envMatch.index);
    const envType = envMatch[1].toLowerCase();
    const envNum = envMatch[2] || '';
    annotations.push({
      kind: envType,
      sentenceRange: [sentIdx, sentIdx],
      value: `${envMatch[1]} ${envNum}`.trim(),
    });
  }

  // Equation numbers
  EQUATION_NUMBER_PATTERN.lastIndex = 0;
  let eqMatch;
  while ((eqMatch = EQUATION_NUMBER_PATTERN.exec(rawText)) !== null) {
    const sentIdx = getSentenceIndex(rawText, eqMatch.index);
    annotations.push({
      kind: 'equation',
      sentenceRange: [sentIdx, sentIdx],
      value: `(${eqMatch[1]})`,
    });
  }

  return annotations;
}

/**
 * Annotate all pages of a book.
 * @param {string} bookId
 * @returns {number} count of pages annotated
 */
async function annotateBook(bookId) {
  const Page = require('../models/Page');
  const pages = await Page.find({ bookId }).select('_id rawText structuralAnnotations');
  let count = 0;

  for (const page of pages) {
    const annotations = annotate(page.rawText || '');
    page.structuralAnnotations = annotations;
    await page.save();
    count++;
  }

  return count;
}

module.exports = { annotate, annotateBook };
