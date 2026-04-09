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

const FULL_PROMPT = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'span-generation-full.txt'), 'utf-8');
const SHORT_PROMPT = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'span-generation-short.txt'), 'utf-8');

let openai = null;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ─── SESSION STATE ───────────────────────────────────────────────

let currentSessionId = null;
let chunksInSession = 0;

function startNewSession() {
  currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  chunksInSession = 0;
  console.log(`[spanService] New session: ${currentSessionId}`);
  return currentSessionId;
}

function shouldResetSession() {
  return chunksInSession >= pipeline.SPAN_SESSION_MAX_CHUNKS;
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

    // Parse remaining tokens
    const contextTags = [];
    const declarativeTags = [];
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

      // Context tag: lowercase with underscores
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
 * Generate spans for a page's text.
 * @param {string} bookId
 * @param {number} pageNumber
 * @param {string} rawText - The page's rawText
 * @param {Array} preAnnotations - From regexService (structuralAnnotations)
 * @param {boolean} isNewSession - Whether to use the full prompt
 * @returns {Array} Created Span documents
 */
async function generateSpansForPage(bookId, pageNumber, rawText, preAnnotations, isNewSession) {
  const client = getOpenAI();
  if (!client || !rawText) return [];

  // Number sentences
  const { numbered, sentences } = numberSentences(rawText);
  if (sentences.length === 0) return [];

  // Build input with pre-annotations as hints
  let input = numbered;
  if (preAnnotations && preAnnotations.length > 0) {
    const hints = preAnnotations.map(a => `  [${a.kind}] ${a.value} (sentence ~${a.sentenceRange?.[0] || '?'})`).join('\n');
    input += `\n\nPre-detected signals:\n${hints}`;
  }

  // Choose prompt
  const systemPrompt = isNewSession ? FULL_PROMPT : SHORT_PROMPT;

  try {
    const response = await client.chat.completions.create({
      model: process.env.SPAN_MODEL || 'gpt-4o',
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input },
      ],
    });

    const dslOutput = response.choices[0]?.message?.content || '';
    const spanData = parseSpanOutput(dslOutput, bookId, pageNumber);

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

    chunksInSession++;
    return savedSpans;

  } catch (err) {
    console.error(`[spanService] Page ${pageNumber} failed: ${err.message}`);
    return [];
  }
}

/**
 * Generate spans for all pages of a book.
 * Uses session management: starts with full prompt, continues with short.
 * @param {string} bookId
 * @returns {Object} { pagesProcessed, spansCreated, sessionId }
 */
async function generateSpansForBook(bookId) {
  const pages = await Page.find({ bookId })
    .select('pageNumber rawText structuralAnnotations')
    .sort({ pageNumber: 1 });

  if (pages.length === 0) return { pagesProcessed: 0, spansCreated: 0 };

  // Clear existing spans for this book
  await Span.deleteMany({ bookId });
  await Page.updateMany({ bookId }, { $set: { spanIds: [] } });

  startNewSession();
  let totalSpans = 0;
  let pagesProcessed = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const isNew = i === 0 || shouldResetSession();
    if (isNew && i > 0) startNewSession();

    const spans = await generateSpansForPage(
      bookId,
      page.pageNumber,
      page.rawText,
      page.structuralAnnotations || [],
      isNew
    );

    totalSpans += spans.length;
    pagesProcessed++;

    if ((i + 1) % 5 === 0) {
      console.log(`[spanService] ${pagesProcessed}/${pages.length} pages, ${totalSpans} spans so far`);
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
