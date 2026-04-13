/**
 * One-shot notes-page rewrite. Given a notes book + page number, pulls
 * the page's existing text, the page PNG, and the top-K most relevant
 * chunks from each linked source paper (Rodina), and asks Claude Opus
 * to rewrite the page as clean expository HTML+LaTeX with inline
 * [[cite]] tags.
 *
 * Usage:
 *   node scripts/rewrite-notes-page.js <notesBookId> <pageNumber> [topK]
 *
 * Does NOT write to the database. Output goes to stdout and to
 *   /tmp/rewrite-<notesBookId>-p<pageNumber>.html
 * so you can diff/iterate without burning DB state.
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
const pipeline = require('../config/pipeline');

const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images');
const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'notes-rewrite.txt');
const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, 'utf-8');

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

async function main() {
  const [,, notesBookId, pageNumArg, topKArg] = process.argv;
  if (!notesBookId || !pageNumArg) {
    console.error('Usage: node scripts/rewrite-notes-page.js <notesBookId> <pageNumber> [topK]');
    process.exit(1);
  }
  const pageNumber = parseInt(pageNumArg, 10);
  const topK = parseInt(topKArg || '12', 10);

  await mongoose.connect(process.env.MONGODB_URI);

  const notesBook = await Book.findById(notesBookId).lean();
  if (!notesBook) throw new Error(`Notes book ${notesBookId} not found`);
  if (notesBook.kind !== 'notes') console.warn(`[warn] book.kind is '${notesBook.kind}', expected 'notes'`);
  if (!notesBook.linkedBookIds || notesBook.linkedBookIds.length === 0) {
    throw new Error('Notes book has no linkedBookIds — cannot retrieve ground-truth passages');
  }

  const notesPage = await Page.findOne({ bookId: notesBookId, pageNumber }).lean();
  if (!notesPage) throw new Error(`Notes page ${pageNumber} not found`);

  const notesChunks = await Chunk.find({ bookId: notesBookId, pageNumber }).lean();

  const notesPageText = [
    notesPage.chapterTitle, notesPage.sectionTitle,
    ...notesChunks.map(c => c.sourceText || ''),
    notesPage.rawText || '',
  ].filter(Boolean).join('\n\n').trim();

  if (!notesPageText) throw new Error('Notes page has no text content to rewrite');

  console.error(`[info] notes book: ${notesBook.title}`);
  console.error(`[info] page ${pageNumber}, ${notesChunks.length} chunks, ${notesPageText.length} chars`);
  console.error(`[info] linked source books: ${notesBook.linkedBookIds.length}`);

  console.error(`[info] embedding notes page text...`);
  const queryVec = await embed(notesPageText);
  if (!queryVec) throw new Error('Failed to embed notes page text');

  const groundTruthBlocks = [];
  for (const linkedId of notesBook.linkedBookIds) {
    const srcBook = await Book.findById(linkedId).lean();
    if (!srcBook) continue;
    const srcChunks = await Chunk.find(
      { bookId: linkedId, embedding: { $exists: true, $ne: [] } },
      'pageNumber sourceText embedding chunkIndex structuralType'
    ).lean();
    console.error(`[info] scoring ${srcChunks.length} chunks from "${srcBook.title.slice(0, 60)}..."`);

    const scored = srcChunks
      .filter(c => Array.isArray(c.embedding) && c.embedding.length > 0)
      .map(c => ({ c, score: cosine(queryVec, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .sort((a, b) => (a.c.pageNumber - b.c.pageNumber) || (a.c.chunkIndex - b.c.chunkIndex));

    groundTruthBlocks.push({ book: srcBook, hits: scored });
  }

  const groundTruthText = groundTruthBlocks.map(({ book, hits }) => {
    const lines = [`<source_book id="${book._id}" title="${book.title.replace(/"/g, "'")}">`];
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
  console.error(`[info] page PNG: ${hasImage ? pngPath : 'MISSING'}`);

  const userContent = [];
  userContent.push({
    type: 'text',
    text: `NOTES_PAGE (book="${notesBook.title}", page=${pageNumber}):\n\n${notesPageText}\n\n---\n\nGROUND_TRUTH passages (Rodina, ordered by page):\n\n${groundTruthText}\n\n---\n\nRewrite this notes page now. Output ONLY the HTML fragment starting with <div class="page-content">.`,
  });
  if (hasImage) {
    const b64 = fs.readFileSync(pngPath).toString('base64');
    userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } });
  }

  const client = new Anthropic();
  const model = process.env.REWRITE_MODEL || 'claude-opus-4-6';
  console.error(`[info] calling ${model}...`);
  const resp = await client.messages.create({
    model,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  let html = resp.content?.[0]?.text || '';
  html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  const outPath = `/tmp/rewrite-${notesBookId}-p${pageNumber}.html`;
  fs.writeFileSync(outPath, html);
  console.error(`[info] wrote ${html.length} chars to ${outPath}`);
  console.error(`[info] input tokens: ${resp.usage?.input_tokens}, output: ${resp.usage?.output_tokens}`);
  console.log(html);

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
