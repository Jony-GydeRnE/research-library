/**
 * Span generation service — core intelligence.
 * Generates @@ span annotations using an LLM in compressed DSL format.
 * Session-managed: full prompt at start, short prompt for continuation,
 * judge triggers reset when quality drifts.
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const Span = require('../models/Span');
const Page = require('../models/Page');
const pipeline = require('../config/pipeline');

// Load prompts from paths in pipeline config
const FULL_PROMPT = fs.readFileSync(path.join(__dirname, '..', pipeline.SPAN_PROMPT_FULL), 'utf-8');
const SHORT_PROMPT = fs.readFileSync(path.join(__dirname, '..', pipeline.SPAN_PROMPT_SHORT), 'utf-8');

let openai = null;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ─── HTML → PLAIN TEXT (preserves LaTeX source) ─────────────────
// The vision pipeline produces HTML containing real LaTeX delimiters
// (\(...\), \[...\]) inside <p>/<div>/<h2>/<div class="math-display">.
// Stripping the HTML tags leaves the LaTeX source intact, which is what
// we want both for the LLM (so it understands the math) and for the
// citation matcher (so the highlight URL contains real symbol-bearing
// text instead of pdf-parse garbage like "˜X 2,5˜˜˜˜").
function stripHtml(html) {
  return (html || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── SESSION STATE ───────────────────────────────────────────────
// A "session" is one continuous run of span-generation LLM calls where
// the model is expected to retain format memory from an initial full
// prompt. We track sessions at PAGE granularity (one generateSpansForPage
// call per page) — the variable was previously named `chunksInSession`
// which was misleading since it was always a page counter.

let currentSessionId = null;
let pagesInSession = 0;

function startNewSession(reason) {
  currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  pagesInSession = 0;
  console.log(`[spanService] New session: ${currentSessionId}${reason ? ' (reason: ' + reason + ')' : ''}`);
  return currentSessionId;
}

function shouldResetSession() {
  return pagesInSession >= (pipeline.SPAN_SESSION_MAX_PAGES || 8);
}

// ─── QUALITY GATE ────────────────────────────────────────────────
// A parsed span is considered "enriched" if it carries ANY metadata
// beyond its bare sentence range. Spans that have only a sentence range
// (no context tags, no role, no declarative tags, and searchClass N
// which is the implicit default) are format-collapse artifacts from a
// drifted session and must trigger a retry with the full prompt.
function isSpanEnriched(span) {
  if (span.contextTags && span.contextTags.length > 0) return true;
  if (span.role) return true;
  if (span.declarativeTags && span.declarativeTags.length > 0) return true;
  if (span.searchClass && span.searchClass !== 'N') return true;
  return false;
}

// Fraction of parsed spans that are enriched. Returns 1 for empty input
// so the caller can distinguish "no spans parsed" (handled by a separate
// empty-output retry) from "spans parsed but all junk".
function enrichmentRatio(spans) {
  if (!spans || spans.length === 0) return 1;
  const enriched = spans.filter(isSpanEnriched).length;
  return enriched / spans.length;
}

// ─── SENTENCE NUMBERING ─────────────────────────────────────────

/**
 * Split text into sentences and number them.
 * Returns: { numbered: "[1] First sentence.\n[2] Second...", sentences: [...] }
 */
function numberSentences(text) {
  if (!text) return { numbered: '', sentences: [] };
  // Split on sentence boundaries: period + space/newline, or double newline
  const raw = text.split(/(?<=\.)\s+|\n\n+/).filter(s => s.trim());
  const sentences = raw.map((s, i) => ({ index: i + 1, text: s.trim() }));
  const numbered = sentences.map(s => `[${s.index}] ${s.text}`).join('\n');
  return { numbered, sentences };
}

// ─── DSL PARSER ──────────────────────────────────────────────────

/**
 * Parse the DSL output from the LLM into Span-ready objects.
 * Each line: "1-3 concept_tag another_tag p14.3 Bs"
 */
function parseSpanOutput(dslOutput, bookId, pageNumber) {
  const lines = (dslOutput || '').split('\n').filter(l => l.trim());
  const spans = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    // Parse sentence range
    const rangePart = parts[0];
    let sentenceStart, sentenceEnd;
    if (rangePart.includes('-')) {
      const [s, e] = rangePart.split('-').map(Number);
      sentenceStart = s;
      sentenceEnd = e;
    } else {
      sentenceStart = sentenceEnd = parseInt(rangePart, 10);
    }

    if (isNaN(sentenceStart)) continue;

    // Known role tags
    const ROLE_TAGS = new Set([
      'claim', 'background', 'conjecture', 'result', 'review',
      'definition', 'equation', 'application', 'citation', 'preview',
      'proof', 'remark', 'example', 'figure_ref',
    ]);

    // Parse remaining tokens
    const contextTags = [];
    const declarativeTags = [];
    let role = null;
    let searchClass = 'N';
    let searchConfidence = null;
    const regexFlags = [];

    for (let i = 1; i < parts.length; i++) {
      const token = parts[i];

      // Search class: single uppercase letter + lowercase confidence
      if (/^[LISB][a-z]$/.test(token)) {
        searchClass = token[0];
        searchConfidence = token[1];
        continue;
      }

      // Declarative tag: letter + number.number
      if (/^[pacerqskxdv]\d+(\.\d+)?$/.test(token)) {
        const tagType = token[0];
        const rest = token.substring(1);
        const dotIdx = rest.indexOf('.');
        let targetChunk, targetTag;
        if (dotIdx >= 0) {
          targetChunk = parseInt(rest.substring(0, dotIdx), 10);
          targetTag = parseInt(rest.substring(dotIdx + 1), 10);
        } else {
          targetChunk = parseInt(rest, 10);
          targetTag = 0;
        }
        declarativeTags.push({ kind: tagType, targetChunk, targetTag });
        continue;
      }

      // Role tag: known single word
      if (ROLE_TAGS.has(token)) {
        role = token;
        continue;
      }

      // Context tag: lowercase with underscores (not a role)
      if (/^[a-z][a-z0-9_]*$/.test(token)) {
        contextTags.push(token);
        continue;
      }
    }

    spans.push({
      bookId,
      pageNumber,
      sentenceStart,
      sentenceEnd,
      contextTags,
      role,
      declarativeTags,
      searchClass,
      searchConfidence,
      regexFlags,
    });
  }

  return spans;
}

// ─── GENERATE SPANS FOR A PAGE ───────────────────────────────────

/**
 * Run a single LLM call for span generation on a page's text and return
 * the parsed (but not yet persisted) span objects plus the raw DSL output
 * for diagnostics. Does not touch the database. Separated from the main
 * generateSpansForPage so we can invoke it twice in the quality-gated
 * retry path without duplicating DB work.
 */
async function runSpanLLMCall(client, systemPrompt, input, sentences, bookId, pageNumber) {
  const response = await client.chat.completions.create({
    model: pipeline.SPAN_MODEL,
    max_tokens: 800,
    temperature: pipeline.SPAN_TEMPERATURE,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ],
  });
  const dslOutput = response.choices[0]?.message?.content || '';
  const spanData = parseSpanOutput(dslOutput, bookId, pageNumber);
  // Materialize spanText from the numbered sentences so chat context +
  // metadata listing always see the actual text. The DSL parser only
  // stores indices.
  for (const s of spanData) {
    if (!s.spanText) {
      const start = Math.max(0, (s.sentenceStart || 1) - 1);
      const end = Math.min(sentences.length, s.sentenceEnd || s.sentenceStart || 1);
      if (end > start) {
        s.spanText = sentences.slice(start, end).map(x => x.text).join(' ').trim();
      }
    }
  }
  return { spanData, dslOutput };
}

/**
 * Generate spans for a page's text.
 *
 * Quality pipeline on every call:
 *   1. Run the LLM with the full or short prompt based on session state.
 *   2. Parse the DSL output.
 *   3. If the parse returned 0 spans AND SPAN_RETRY_ON_EMPTY is set,
 *      retry ONCE with the full prompt (drift so severe the LLM emitted
 *      nothing parseable).
 *   4. Compute enrichment ratio (fraction of spans with at least one
 *      tag/role/searchClass).
 *   5. If enrichment is below SPAN_MIN_ENRICHED_RATIO AND we haven't
 *      already used the full prompt, retry ONCE with the full prompt.
 *   6. If the retry is still below the ratio floor, save what we got
 *      AND force a session reset so the next page starts clean.
 *   7. Save spans, link to page, return.
 *
 * @returns {Array} Created Span documents. Empty array on total failure.
 */
async function generateSpansForPage(bookId, pageNumber, rawText, preAnnotations, isNewSession) {
  const client = getOpenAI();
  if (!client || !rawText) {
    if (!rawText) console.log('[spanService] SKIPPING page ' + pageNumber + ' — no rawText');
    return [];
  }

  // Number sentences, cap at pipeline limit
  const { numbered, sentences } = numberSentences(rawText);
  if (sentences.length === 0) return [];

  // Truncate to max sentences per call
  const maxSentences = pipeline.SPAN_MAX_SENTENCES_PER_CALL || 30;
  const truncatedNumbered = sentences.length > maxSentences
    ? sentences.slice(0, maxSentences).map(s => `[${s.index}] ${s.text}`).join('\n')
    : numbered;
  if (sentences.length > maxSentences) {
    console.warn(`[spanService] Page ${pageNumber}: ${sentences.length} sentences truncated to ${maxSentences} (consider raising SPAN_MAX_SENTENCES_PER_CALL)`);
  }

  // Build input with pre-annotations as hints
  let input = truncatedNumbered;
  if (preAnnotations && preAnnotations.length > 0) {
    const hints = preAnnotations.map(a => `  [${a.kind}] ${a.value} (sentence ~${a.sentenceRange?.[0] || '?'})`).join('\n');
    input += `\n\nPre-detected signals:\n${hints}`;
  }

  // ── PASS 1: initial LLM call (full prompt at session start, short otherwise)
  let usedFullPrompt = !!isNewSession;
  let systemPrompt = usedFullPrompt ? FULL_PROMPT : SHORT_PROMPT;
  let result;
  try {
    result = await runSpanLLMCall(client, systemPrompt, input, sentences, bookId, pageNumber);
  } catch (err) {
    console.error(`[spanService] Page ${pageNumber} failed: ${err.message}`);
    return [];
  }

  let { spanData, dslOutput } = result;
  console.log(`[spanService] Page ${pageNumber} PASS 1 (${usedFullPrompt ? 'full' : 'short'} prompt, ${sentences.length} sentences): ${spanData.length} spans parsed`);
  if (spanData.length === 0 || dslOutput.trim().length < 10) {
    console.log(`[spanService] Page ${pageNumber} PASS 1 raw DSL:\n${dslOutput}\n---`);
  }

  // ── PASS 2: empty-output retry with the full prompt
  const retryOnEmpty = pipeline.SPAN_RETRY_ON_EMPTY !== false;
  if (spanData.length === 0 && retryOnEmpty && !usedFullPrompt) {
    console.warn(`[spanService] Page ${pageNumber}: 0 spans parsed — retrying with full prompt`);
    try {
      result = await runSpanLLMCall(client, FULL_PROMPT, input, sentences, bookId, pageNumber);
      spanData = result.spanData;
      dslOutput = result.dslOutput;
      usedFullPrompt = true;
      console.log(`[spanService] Page ${pageNumber} PASS 2 (empty-retry, full prompt): ${spanData.length} spans parsed`);
      // After an empty-retry, force the next session to start fresh too.
      startNewSession('empty-output recovery on page ' + pageNumber);
    } catch (err) {
      console.error(`[spanService] Page ${pageNumber} empty-retry failed: ${err.message}`);
    }
  }

  // ── PASS 3: low-enrichment retry with the full prompt
  const minRatio = pipeline.SPAN_MIN_ENRICHED_RATIO != null ? pipeline.SPAN_MIN_ENRICHED_RATIO : 0.5;
  const ratio = enrichmentRatio(spanData);
  if (spanData.length > 0 && ratio < minRatio && !usedFullPrompt) {
    console.warn(`[spanService] Page ${pageNumber}: enrichment ratio ${ratio.toFixed(2)} < ${minRatio} — retrying with full prompt`);
    try {
      const retryResult = await runSpanLLMCall(client, FULL_PROMPT, input, sentences, bookId, pageNumber);
      const retryRatio = enrichmentRatio(retryResult.spanData);
      console.log(`[spanService] Page ${pageNumber} PASS 3 (low-enrichment retry): ${retryResult.spanData.length} spans parsed, ratio ${retryRatio.toFixed(2)}`);
      // Accept the retry result if it beats the original (even if still
      // below floor — something is better than junk).
      if (retryRatio > ratio) {
        spanData = retryResult.spanData;
        dslOutput = retryResult.dslOutput;
      }
      usedFullPrompt = true;
      // Always reset the session after a quality retry so subsequent
      // pages start with the full prompt too.
      startNewSession('low-enrichment recovery on page ' + pageNumber);
    } catch (err) {
      console.error(`[spanService] Page ${pageNumber} enrichment retry failed: ${err.message}`);
    }
  }

  // Final diagnostic log — the raw DSL of whatever we're saving.
  console.log(`[spanService] Page ${pageNumber} final: ${spanData.length} spans, enrichment ${enrichmentRatio(spanData).toFixed(2)}, model: ${pipeline.SPAN_MODEL}`);

  // Save spans
  const savedSpans = [];
  for (const s of spanData) {
    const span = await Span.create(s);
    savedSpans.push(span);
  }

  // Link spans to page
  if (savedSpans.length > 0) {
    await Page.findOneAndUpdate(
      { bookId, pageNumber },
      { $push: { spanIds: { $each: savedSpans.map(s => s._id) } } }
    );
  }

  pagesInSession++;
  return savedSpans;
}

/**
 * Generate spans for all pages of a book.
 * Uses session management: starts with full prompt, continues with short.
 * @param {string} bookId
 * @returns {Object} { pagesProcessed, spansCreated, sessionId }
 */
async function generateSpansForBook(bookId) {
  const pages = await Page.find({ bookId })
    .select('pageNumber rawText htmlContent visionProcessed structuralAnnotations')
    .sort({ pageNumber: 1 });

  if (pages.length === 0) return { pagesProcessed: 0, spansCreated: 0 };

  // For each page, pick the best available source text:
  // 1. Vision-stripped HTML (preserves LaTeX source, no pdf-parse garbage)
  // 2. rawText (vision pipeline overwrites this with vision plain text on
  //    success, but reading htmlContent directly is safer in case spans
  //    were generated before that overwrite happened, or in case rawText
  //    got reverted somewhere)
  // A page is only "skipped" if BOTH sources are empty.
  const sources = pages.map(p => {
    if (p.visionProcessed && p.htmlContent) {
      return { page: p, text: stripHtml(p.htmlContent), source: 'vision' };
    }
    return { page: p, text: p.rawText || '', source: 'raw' };
  });

  const skipped = sources.filter(s => !s.text).length;
  const visionCount = sources.filter(s => s.source === 'vision' && s.text).length;
  console.log('[spanService] Source mix: ' + visionCount + ' vision, ' +
    (sources.length - skipped - visionCount) + ' rawText, ' + skipped + ' skipped (empty), total ' + sources.length);

  // Clear existing spans for this book
  await Span.deleteMany({ bookId });
  await Page.updateMany({ bookId }, { $set: { spanIds: [] } });

  startNewSession('book start');
  let totalSpans = 0;
  let pagesProcessed = 0;

  for (let i = 0; i < sources.length; i++) {
    const { page, text, source } = sources[i];
    const isNew = i === 0 || shouldResetSession();
    if (isNew && i > 0) startNewSession('SPAN_SESSION_MAX_PAGES cap reached');

    if (!text) {
      console.log('[spanService] SKIPPING page ' + page.pageNumber + ' — no source text (vision=' + page.visionProcessed + ', html=' + !!page.htmlContent + ', raw=' + !!page.rawText + ')');
      pagesProcessed++;
      continue;
    }

    const spans = await generateSpansForPage(
      bookId,
      page.pageNumber,
      text,
      page.structuralAnnotations || [],
      isNew
    );

    totalSpans += spans.length;
    pagesProcessed++;

    if ((i + 1) % 5 === 0) {
      console.log(`[spanService] ${pagesProcessed}/${sources.length} pages (using ${source} for last), ${totalSpans} spans so far`);
    }
  }

  console.log(`[spanService] Complete: ${pagesProcessed} pages, ${totalSpans} spans, session ${currentSessionId}`);
  return { pagesProcessed, spansCreated: totalSpans, sessionId: currentSessionId };
}

module.exports = {
  generateSpansForPage,
  generateSpansForBook,
  parseSpanOutput,
  numberSentences,
  startNewSession,
};
