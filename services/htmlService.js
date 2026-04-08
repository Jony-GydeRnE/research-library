/**
 * Convert raw extracted text into structured HTML for the reader.
 *
 * Academic paper-aware conversion:
 * - Page 1: detects title, author, affiliation, abstract
 * - Equations: display and inline math detection
 * - Section headings: Roman numerals, numbered sections, ALL CAPS
 * - Figure captions, numbered lists, references
 * - Cleans up PDF extraction artifacts
 */

// ─── PATTERNS ────────────────────────────────────────────────────

// Section heading patterns (academic papers)
const SECTION_PATTERNS = [
  /^@@FS\d+@@\s*(chapter|part)\s+\d+/i,
  /^@@FS\d+@@\s*/,                                      // any large-font line
  /^(I{1,3}V?|VI{0,3}|IX|X{0,3})\.\s+[A-Z]/,           // Roman numeral: "III. Results"
  /^(section|§)\s*\d+/i,
  /^\d+\.\s+[A-Z][a-z]/,                                 // "3. Discussion"
  /^[A-Z][A-Z\s]{4,}$/,                                  // ALL CAPS lines (4+ chars)
  /^[A-Z][A-Z\s]+[A-Z]$/,                                // ALL CAPS with spaces
];

const SUBSECTION_PATTERNS = [
  /^\d+\.\d+\.?\s+[A-Z]/,                                // "3.2 Sheaves"
  /^[A-Z]\.\s+[A-Z]/,                                    // "A. Proof of Theorem"
];

// Abstract detection
const ABSTRACT_START = /^(abstract|summary)[:\s]*$/i;
const ABSTRACT_INLINE = /^(abstract|summary)[.:]\s+/i;

// Figure/table captions
const FIGURE_RE = /^(FIG\.|Figure|TABLE|Table)\s*\d+/i;

// Equation-heavy line detection
const MATH_SYMBOLS = /[∫∑∏∂∇∞≤≥≠±→←↔∈∉⊂⊃∪∩∧∨¬∀∃⟨⟩‖αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΦΨΩ]/;
const DISPLAY_EQ_INDICATORS = [
  /^\s*[A-Za-z]\s*[=<>≤≥≠]\s*/,                          // "B = ..."
  /^\([\d]+\)\s*$/,                                       // equation number "(8)"
  /^[A-Za-z]+\([^)]+\)\s*[=<>]/,                         // "f(x) = ..."
  /^\s*\\[(\[]/,                                          // LaTeX display
  /^\s*\$\$/,                                             // $$ display
];

// Numbered list
const NUMBERED_LIST_RE = /^(\d+)\.\s+(?![A-Z][a-z]{20})/;  // "1. Short item" but not "1. Long sentence starting..."

// Font size marker from pdfService
const FONTSIZE_RE = /^@@FS(\d+)@@\s*/;

// ─── HELPERS ─────────────────────────────────────────────────────

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripFsMarker(line) {
  return line.replace(FONTSIZE_RE, '');
}

function getFontSize(line) {
  const m = line.match(FONTSIZE_RE);
  return m ? parseInt(m[1], 10) : 0;
}

function isLikelyEquationLine(line) {
  const stripped = stripFsMarker(line).trim();
  if (stripped.length < 5) return false;  // too short to be a meaningful equation
  // Don't classify normal prose as equations
  if (stripped.length > 100) return false;
  // If it's mostly regular words, it's not an equation
  const wordCount = stripped.split(/\s+/).filter(w => /^[a-zA-Z]{3,}$/.test(w)).length;
  if (wordCount >= 3) return false;

  // Count math symbol density
  const mathCount = (stripped.match(new RegExp(MATH_SYMBOLS.source, 'g')) || []).length;
  if (mathCount / stripped.length > 0.15) return true;

  // Check structural equation patterns
  if (DISPLAY_EQ_INDICATORS.some(re => re.test(stripped))) return true;

  // Lines dominated by operators and symbols (but require = sign for confidence)
  const hasEquals = stripped.includes('=');
  const symbolCount = (stripped.match(/[=+\-*/^_{}()\[\]|∫∑∏≤≥<>]/g) || []).length;
  if (hasEquals && symbolCount > 3 && stripped.length < 80) return true;

  return false;
}

// Common standalone section headings in academic papers
const KNOWN_HEADINGS = /^(INTRODUCTION|CONCLUSION|CONCLUSIONS|DISCUSSION|RESULTS|METHODS|REFERENCES|ACKNOWLEDGMENTS|ACKNOWLEDGEMENTS|APPENDIX|SUMMARY|ABSTRACT|PRELIMINARIES|BACKGROUND|NOTATION|PROOF|SETUP|EXAMPLES?|REMARKS?)\s*$/i;

function isSectionHeading(line) {
  const stripped = stripFsMarker(line).trim();
  if (stripped.length === 0 || stripped.length > 100) return false;
  // Reject very short ALL CAPS (likely variable names like "X X" or "B T")
  if (stripped.length < 6) return false;
  if (KNOWN_HEADINGS.test(stripped)) return true;
  // Multi-word ALL CAPS titles like "REVIEW OF AMPLITUDE PROPERTIES"
  // Require at least 2 words of 3+ chars each
  if (/^[A-Z][A-Z\s\-,]+[A-Z]$/.test(stripped) && stripped.length >= 10) {
    const words = stripped.split(/\s+/).filter(w => w.length >= 3);
    if (words.length >= 2) return true;
  }
  return SECTION_PATTERNS.some(re => re.test(line));
}

function isSubsectionHeading(line) {
  const stripped = stripFsMarker(line).trim();
  if (stripped.length === 0 || stripped.length > 100) return false;
  return SUBSECTION_PATTERNS.some(re => re.test(stripped));
}

function isFigureCaption(line) {
  return FIGURE_RE.test(stripFsMarker(line).trim());
}

function wrapInlineMath(html) {
  // Wrap $...$ as inline math
  html = html.replace(/\$([^$\n]+)\$/g, '<span class="math-inline">\\($1\\)</span>');
  return html;
}

// ─── PAGE 1: TITLE / AUTHOR / ABSTRACT ──────────────────────────

function convertFirstPage(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    return { html: '<div class="page-content"><p class="empty-page">[Empty page]</p></div>' };
  }

  const lines = rawText.split('\n');
  const blocks = [];
  let phase = 'title';  // title -> author -> abstract -> body
  let titleLines = [];
  let authorLines = [];
  let abstractLines = [];
  let bodyStartIdx = 0;
  let detectedChapter = null;

  // Phase 1: Scan for structure
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripFsMarker(line).trim();
    const fs = getFontSize(line);

    if (phase === 'title') {
      if (stripped === '') {
        if (titleLines.length > 0) phase = 'author';
        continue;
      }
      // Title: collect all lines until we hit a clear non-title indicator.
      // Title lines are typically large-font, but continuation lines may not
      // have a font marker if the PDF extraction merges them.
      // Stop collecting title when we see a name-like pattern (author) at normal size
      // after at least one title line.
      const looksLikeAuthor = titleLines.length > 0 && fs === 0 &&
        (stripped.length < 60) &&
        (/^[A-Z][a-z]+\s+[A-Z]/.test(stripped) || /^[A-Z]\.\s*[A-Z]/.test(stripped));

      if (looksLikeAuthor) {
        phase = 'author';
        authorLines.push(stripped);
      } else {
        titleLines.push(stripped);
      }
      continue;
    }

    if (phase === 'author') {
      if (stripped === '') {
        if (authorLines.length > 0) phase = 'pre-abstract';
        continue;
      }
      // Check if we've hit abstract
      if (ABSTRACT_START.test(stripped) || ABSTRACT_INLINE.test(stripped)) {
        phase = 'abstract';
        const inlineText = stripped.replace(ABSTRACT_INLINE, '').replace(ABSTRACT_START, '');
        if (inlineText.trim()) abstractLines.push(inlineText.trim());
        continue;
      }
      // Check if we've hit a section heading — skip abstract
      if (isSectionHeading(lines[i])) {
        phase = 'body';
        bodyStartIdx = i;
        break;
      }
      // Detect transition from author/affiliation to abstract:
      // A sentence-like line (starts with common sentence starters for academic abstracts)
      const affiliationWords = /university|institute|department|school|center|laboratory|college|cnrs|inria/i;
      const isSentence = /^(We|This|In\s+this|The|A\s+\w|An\s+\w|Our|Here)\s/.test(stripped) && stripped.length > 40;
      const isAffiliation = affiliationWords.test(stripped);
      if (isSentence && !isAffiliation) {
        phase = 'abstract';
        abstractLines.push(stripped);
        continue;
      }
      authorLines.push(stripped);
      continue;
    }

    if (phase === 'pre-abstract') {
      if (stripped === '') continue;
      if (ABSTRACT_START.test(stripped) || ABSTRACT_INLINE.test(stripped)) {
        phase = 'abstract';
        const inlineText = stripped.replace(ABSTRACT_INLINE, '').replace(ABSTRACT_START, '');
        if (inlineText.trim()) abstractLines.push(inlineText.trim());
        continue;
      }
      // Check for section heading — means no abstract, go to body
      if (isSectionHeading(lines[i])) {
        phase = 'body';
        bodyStartIdx = i;
        break;
      }
      // If it looks like a long sentence (body/abstract text), treat as abstract
      // Many physics papers don't have an explicit "Abstract" label
      if (stripped.length > 50 && /[a-z]{3,}/.test(stripped)) {
        phase = 'abstract';
        abstractLines.push(stripped);
        continue;
      }
      // Short lines could still be affiliation/email
      authorLines.push(stripped);
      continue;
    }

    if (phase === 'abstract') {
      if (stripped === '' && abstractLines.length > 0) {
        // End of abstract
        phase = 'body';
        bodyStartIdx = i + 1;
        continue;
      }
      // Check for section heading (abstract is over)
      if (isSectionHeading(lines[i]) && abstractLines.length > 0) {
        phase = 'body';
        bodyStartIdx = i;
        break;
      }
      if (stripped !== '') {
        abstractLines.push(stripped);
      }
      continue;
    }

    if (phase === 'body') {
      bodyStartIdx = i;
      break;
    }
  }

  // Build HTML for page 1
  if (titleLines.length > 0) {
    const title = escapeHtml(titleLines.join(' '));
    blocks.push(`<h1 class="paper-title">${title}</h1>`);
    detectedChapter = titleLines.join(' ');
  }

  if (authorLines.length > 0) {
    // Separate author names from affiliations
    // Heuristic: lines with institutional words are affiliations
    const affiliationWords = /university|institute|department|school|center|laboratory|lab|college|beijing|china|usa|uk|france|germany/i;
    const authors = [];
    const affiliations = [];

    for (const line of authorLines) {
      // Skip footnote markers like * or †
      const cleaned = line.replace(/^[∗†‡§¶\*]+\s*/, '').replace(/[∗†‡§¶\*]+$/, '').trim();
      if (!cleaned) continue;
      if (affiliationWords.test(cleaned) || cleaned.includes('@')) {
        affiliations.push(cleaned);
      } else {
        authors.push(cleaned);
      }
    }

    if (authors.length > 0) {
      blocks.push(`<div class="paper-authors">${escapeHtml(authors.join(', '))}</div>`);
    }
    if (affiliations.length > 0) {
      blocks.push(`<div class="paper-affiliations">${affiliations.map(a => escapeHtml(a)).join('<br>')}</div>`);
    }
  }

  if (abstractLines.length > 0) {
    const abstractText = escapeHtml(abstractLines.join(' '));
    const withMath = wrapInlineMath(abstractText);
    blocks.push(`<div class="paper-abstract"><span class="abstract-label">Abstract</span>${withMath}</div>`);
  }

  // Process remaining body text on page 1
  if (bodyStartIdx > 0 && bodyStartIdx < lines.length) {
    const bodyLines = lines.slice(bodyStartIdx);
    const bodyResult = convertBodyText(bodyLines);
    blocks.push(bodyResult.html);
    if (bodyResult.chapterTitle) detectedChapter = bodyResult.chapterTitle;
  }

  return {
    html: `<div class="page-content page-first">\n${blocks.join('\n')}\n</div>`,
    chapterTitle: detectedChapter,
    sectionTitle: null,
    hasEquations: rawText.includes('\\(') || rawText.includes('$$') || MATH_SYMBOLS.test(rawText),
  };
}

// ─── BODY PAGES ─────────────────────────────────────────────────

function convertBodyText(lines) {
  const blocks = [];
  let currentPara = [];
  let equationLines = [];
  let inEquation = false;
  let detectedChapter = null;
  let detectedSection = null;
  let hasEquations = false;

  function flushPara() {
    if (currentPara.length > 0) {
      const text = currentPara.join(' ').trim();
      if (text.length > 0) {
        const escaped = escapeHtml(text);
        const withMath = wrapInlineMath(escaped);
        blocks.push(`<p>${withMath}</p>`);
      }
      currentPara = [];
    }
  }

  function flushEquation() {
    if (equationLines.length > 0) {
      hasEquations = true;
      const eq = escapeHtml(equationLines.join(' '));
      blocks.push(`<div class="math-display">\\[${eq}\\]</div>`);
      equationLines = [];
      inEquation = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripFsMarker(line).trim();

    // Empty line = paragraph break
    if (stripped === '') {
      if (inEquation) flushEquation();
      flushPara();
      continue;
    }

    // Section heading
    if (isSectionHeading(line)) {
      if (inEquation) flushEquation();
      flushPara();
      const headingText = escapeHtml(stripFsMarker(line).trim());
      const fs = getFontSize(line);
      if (fs > 16 || /^(chapter|part)\s+/i.test(stripped)) {
        blocks.push(`<h2 class="section-heading">${headingText}</h2>`);
        detectedChapter = stripFsMarker(line).trim();
      } else {
        blocks.push(`<h3 class="section-heading">${headingText}</h3>`);
        if (!detectedSection) detectedSection = stripFsMarker(line).trim();
      }
      continue;
    }

    // Subsection heading
    if (isSubsectionHeading(line)) {
      if (inEquation) flushEquation();
      flushPara();
      const headingText = escapeHtml(stripFsMarker(line).trim());
      blocks.push(`<h4 class="section-heading">${headingText}</h4>`);
      if (!detectedSection) detectedSection = stripFsMarker(line).trim();
      continue;
    }

    // Figure caption
    if (isFigureCaption(line)) {
      if (inEquation) flushEquation();
      flushPara();
      const captionText = escapeHtml(stripped);
      blocks.push(`<figcaption class="figure-caption">${wrapInlineMath(captionText)}</figcaption>`);
      continue;
    }

    // Equation detection
    if (isLikelyEquationLine(line)) {
      flushPara();
      if (!inEquation) {
        inEquation = true;
        equationLines = [];
      }
      equationLines.push(stripped);
      continue;
    }

    // If we were in an equation block but this isn't an equation, flush
    if (inEquation) {
      flushEquation();
    }

    // Regular text — accumulate into paragraph
    currentPara.push(stripped);
  }

  // Flush remaining
  if (inEquation) flushEquation();
  flushPara();

  return {
    html: blocks.join('\n'),
    chapterTitle: detectedChapter,
    sectionTitle: detectedSection,
    hasEquations,
  };
}

// ─── MAIN ENTRY POINT ───────────────────────────────────────────

function convertPageToHtml(rawText, pageNumber) {
  if (!rawText || rawText.trim().length === 0) {
    return {
      html: '<div class="page-content"><p class="empty-page">[Empty page]</p></div>',
      chapterTitle: null,
      sectionTitle: null,
      hasEquations: false,
    };
  }

  // Page 1 gets special title/author/abstract treatment
  if (pageNumber === 1) {
    return convertFirstPage(rawText);
  }

  const lines = rawText.split('\n');
  const result = convertBodyText(lines);

  return {
    html: `<div class="page-content">\n${result.html}\n</div>`,
    chapterTitle: result.chapterTitle,
    sectionTitle: result.sectionTitle,
    hasEquations: result.hasEquations,
  };
}

module.exports = { convertPageToHtml };
