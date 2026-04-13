/**
 * Batch rewrite of notes pages using the same prompt + retrieval as
 * rewrite-notes-page.js, but loops over a page range, writes to DB,
 * and reports total tokens / cost / wall time.
 *
 * Usage:
 *   node scripts/rewrite-notes-pages-batch.js <notesBookId> <from> <to> [topK]
 *
 * Side effects:
 *   - Page.htmlContent is overwritten with the rewritten HTML.
 *   - The pre-rewrite HTML is preserved in Page.htmlContentLegacy
 *     (only if that field was previously empty — so re-running is safe).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');

const Book = require('../models/Book');
const Page = require('../models/Page');
const Chunk = require('../models/Chunk');
const { embed } = require('../services/embeddingService');

const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images');
const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'notes-rewrite.txt');
const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, 'utf-8');

// Claude pricing (per 1M tokens). Rewrite routes between Opus and
// Sonnet per page; we track tokens per model so the cost report
// reflects the actual mix.
const PRICING = {
  'claude-opus-4-6':   { in: 15.0, out: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-sonnet-4-6': { in:  3.0, out: 15.0, cacheWrite:  3.75, cacheRead: 0.30 },
};

// Opus triggers — Rodina-native vocabulary. When a notes page text
// contains any of these, we route to Opus; otherwise Sonnet. Pure
// prereq/background pages (Lagrangian mechanics, Gaussian integrals,
// etc.) go through Sonnet for 5x cost reduction at indistinguishable
// quality for straight exposition.
const OPUS_TRIGGERS = [
  /hidden\s*zero/i, /bcfw/i, /tr\s*\(\s*[φϕ\\phi]\^?3?/i,
  /kinematic\s*mesh/i, /scattering\s*amplitude/i, /feynman\s*diagram/i,
  /yang[-\s]*mills/i, /nlsm|nonlinear\s*sigma/i, /colored\s*scalar/i,
  /splittings?/i, /factoriz/i, /unitarity/i, /locality/i,
  /residue|pole/i, /uv\s*scaling|ultraviolet/i, /pion|gluon/i,
  /amplitude\s*zero/i, /gauge\s*invariance/i, /soft\s*(theorem|limit)/i,
];

function chooseModel(notesPageText) {
  for (const re of OPUS_TRIGGERS) if (re.test(notesPageText)) return 'claude-opus-4-6';
  return 'claude-sonnet-4-6';
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

async function rewriteOnePage(client, notesBook, pageNumber, srcBookChunkCache, topK) {
  const notesBookId = notesBook._id.toString();
  const notesPage = await Page.findOne({ bookId: notesBookId, pageNumber });
  if (!notesPage) throw new Error(`page ${pageNumber} missing`);

  const notesChunks = await Chunk.find({ bookId: notesBookId, pageNumber }).lean();
  const notesPageText = [
    notesPage.chapterTitle, notesPage.sectionTitle,
    ...notesChunks.map(c => c.sourceText || ''),
    notesPage.rawText || '',
  ].filter(Boolean).join('\n\n').trim();

  if (!notesPageText) {
    console.error(`  [p${pageNumber}] empty page, skipping`);
    return { skipped: true };
  }

  const queryVec = await embed(notesPageText);

  const groundTruthBlocks = [];
  for (const linkedId of notesBook.linkedBookIds) {
    const srcBook = srcBookChunkCache.get(linkedId.toString()).book;
    const srcChunks = srcBookChunkCache.get(linkedId.toString()).chunks;
    const scored = srcChunks
      .map(c => ({ c, score: cosine(queryVec, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .sort((a, b) => (a.c.pageNumber - b.c.pageNumber) || ((a.c.chunkIndex || 0) - (b.c.chunkIndex || 0)));
    groundTruthBlocks.push({ book: srcBook, hits: scored });
  }

  const groundTruthText = groundTruthBlocks.map(({ book, hits }) => {
    const lines = [`<source_book id="${book._id}" title="${(book.title || '').replace(/"/g, "'")}">`];
    for (const { c, score } of hits) {
      const txt = (c.sourceText || '').replace(/\s+/g, ' ').trim().slice(0, 700);
      lines.push(`  <passage page="${c.pageNumber}" type="${c.structuralType || 'narrative'}" score="${score.toFixed(3)}">`);
      lines.push(`    ${txt}`);
      lines.push(`  </passage>`);
    }
    lines.push(`</source_book>`);
    return lines.join('\n');
  }).join('\n\n');

  const pngPath = path.join(IMAGE_DIR, notesBookId, `page-${pageNumber}.png`);
  const hasImage = fs.existsSync(pngPath);

  const userContent = [];
  userContent.push({
    type: 'text',
    text: `NOTES_PAGE (book="${notesBook.title}", page=${pageNumber}):\n\n${notesPageText}\n\n---\n\nGROUND_TRUTH passages (Rodina, ordered by page):\n\n${groundTruthText}\n\n---\n\nRewrite this notes page now. Output ONLY the HTML fragment starting with <div class="page-content">.`,
  });
  if (hasImage) {
    const b64 = fs.readFileSync(pngPath).toString('base64');
    userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } });
  }

  const model = process.env.REWRITE_MODEL || chooseModel(notesPageText);
  // Prompt caching: the system prompt is identical across every page
  // in a batch (and across runs). Marking it cache_control=ephemeral
  // makes the first call pay a ~25% write premium on the cached
  // portion, and every subsequent call within 5 minutes reads the
  // cached system prompt at a 90% discount. At ~2.5k tokens the
  // system prompt alone is the dominant input on prereq pages, so
  // this is the single largest lever.
  const resp = await client.messages.create({
    model,
    max_tokens: 8192,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userContent }],
  });

  let html = resp.content?.[0]?.text || '';
  html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  // Backup original only if not already backed up
  if (!notesPage.htmlContentLegacy && notesPage.htmlContent) {
    notesPage.htmlContentLegacy = notesPage.htmlContent;
  }
  notesPage.htmlContent = html;
  await notesPage.save();

  fs.writeFileSync(`/tmp/rewrite-${notesBookId}-p${pageNumber}.html`, html);

  return {
    skipped: false,
    model,
    inputTokens: resp.usage?.input_tokens || 0,
    outputTokens: resp.usage?.output_tokens || 0,
    cacheReadTokens: resp.usage?.cache_read_input_tokens || 0,
    cacheWriteTokens: resp.usage?.cache_creation_input_tokens || 0,
    chars: html.length,
  };
}

async function main() {
  const [,, notesBookId, fromArg, toArg, topKArg] = process.argv;
  if (!notesBookId || !fromArg || !toArg) {
    console.error('Usage: node scripts/rewrite-notes-pages-batch.js <notesBookId> <from> <to> [topK]');
    process.exit(1);
  }
  const fromPage = parseInt(fromArg, 10);
  const toPage = parseInt(toArg, 10);
  const topK = parseInt(topKArg || '12', 10);

  const t0 = Date.now();
  await mongoose.connect(process.env.MONGODB_URI);

  const notesBook = await Book.findById(notesBookId).lean();
  if (!notesBook) throw new Error(`notes book ${notesBookId} not found`);
  if (!notesBook.linkedBookIds?.length) throw new Error('no linkedBookIds');

  console.error(`[info] notes book: ${notesBook.title}`);
  console.error(`[info] pages ${fromPage}..${toPage}, topK=${topK}`);

  // Preload linked source books' chunks ONCE
  const srcBookChunkCache = new Map();
  for (const linkedId of notesBook.linkedBookIds) {
    const srcBook = await Book.findById(linkedId).lean();
    const chunks = await Chunk.find(
      { bookId: linkedId, embedding: { $exists: true, $ne: [] } },
      'pageNumber sourceText embedding chunkIndex structuralType'
    ).lean();
    const filtered = chunks.filter(c => Array.isArray(c.embedding) && c.embedding.length > 0);
    srcBookChunkCache.set(linkedId.toString(), { book: srcBook, chunks: filtered });
    console.error(`[info] cached ${filtered.length} embedded chunks from "${srcBook.title.slice(0, 60)}..."`);
  }

  const client = new Anthropic();
  const results = [];
  for (let p = fromPage; p <= toPage; p++) {
    const pt0 = Date.now();
    try {
      const r = await rewriteOnePage(client, notesBook, p, srcBookChunkCache, topK);
      const elapsed = ((Date.now() - pt0) / 1000).toFixed(1);
      if (r.skipped) {
        console.error(`[p${p}] SKIPPED (empty) in ${elapsed}s`);
      } else {
        const modelTag = r.model.includes('opus') ? 'OPUS' : 'sonnet';
        console.error(`[p${p}] ${modelTag} in=${r.inputTokens} (cr=${r.cacheReadTokens} cw=${r.cacheWriteTokens}) out=${r.outputTokens} chars=${r.chars} (${elapsed}s)`);
      }
      results.push({ page: p, ...r });
    } catch (err) {
      console.error(`[p${p}] FAILED: ${err.message}`);
      results.push({ page: p, error: err.message });
    }
  }

  // Per-model cost rollup. Anthropic usage.input_tokens already
  // EXCLUDES cached read/write tokens — those are billed separately
  // via the cache_read_input_tokens / cache_creation_input_tokens
  // fields. So the total input cost is:
  //   (input_tokens * normal_in) + (cache_read * cacheRead) + (cache_creation * cacheWrite)
  const rollup = {};
  for (const r of results) {
    if (r.skipped || r.error) continue;
    const m = r.model;
    if (!rollup[m]) rollup[m] = { pages: 0, in: 0, out: 0, cr: 0, cw: 0 };
    rollup[m].pages += 1;
    rollup[m].in += r.inputTokens;
    rollup[m].out += r.outputTokens;
    rollup[m].cr += r.cacheReadTokens;
    rollup[m].cw += r.cacheWriteTokens;
  }

  let totalCost = 0;
  const costLines = [];
  for (const [model, r] of Object.entries(rollup)) {
    const p = PRICING[model] || PRICING['claude-opus-4-6'];
    const costIn = (r.in / 1e6) * p.in;
    const costOut = (r.out / 1e6) * p.out;
    const costCR = (r.cr / 1e6) * p.cacheRead;
    const costCW = (r.cw / 1e6) * p.cacheWrite;
    const sub = costIn + costOut + costCR + costCW;
    totalCost += sub;
    costLines.push(
      `  ${model}: ${r.pages} pages, in=${r.in} out=${r.out} cr=${r.cr} cw=${r.cw}`
    );
    costLines.push(
      `    in=$${costIn.toFixed(4)} out=$${costOut.toFixed(4)} cacheRead=$${costCR.toFixed(4)} cacheWrite=$${costCW.toFixed(4)}  → $${sub.toFixed(4)}`
    );
  }

  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);

  console.error('');
  console.error('=== BATCH COMPLETE ===');
  console.error(`pages processed: ${results.filter(r => !r.skipped && !r.error).length}/${results.length}`);
  for (const line of costLines) console.error(line);
  console.error(`cost (total):  $${totalCost.toFixed(4)}`);
  console.error(`wall time: ${totalSec}s`);

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
