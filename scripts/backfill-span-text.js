/**
 * One-shot backfill: populate Span.spanText for every span where it is
 * empty/null, by extracting the right sentence range from the parent
 * Page's rawText.
 *
 * Why page rawText (not chunk sourceText): a span's sentenceStart /
 * sentenceEnd are indices into the page's numbered sentences (see
 * services/spanService.js numberSentences()), NOT indices into the
 * chunk's sourceText. The chunk's sourceText is itself derived from
 * the same page rawText, so going to the page is the source of truth.
 *
 * Run: node scripts/backfill-span-text.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Span = require('../models/Span');
const Page = require('../models/Page');

// Same splitter used by services/spanService.js numberSentences()
function splitSentences(text) {
  if (!text) return [];
  return text.split(/(?<=\.)\s+|\n\n+/).filter(s => s.trim()).map(s => s.trim());
}

function extractSpanText(rawText, sentenceStart, sentenceEnd) {
  const sentences = splitSentences(rawText);
  if (sentences.length === 0) return '';
  // sentence indices in DB are 1-based (from numberSentences())
  const start = Math.max(0, (sentenceStart || 1) - 1);
  const end = Math.min(sentences.length, sentenceEnd || sentenceStart || 1);
  if (end <= start) return '';
  return sentences.slice(start, end).join(' ').trim();
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[backfill] connected');

  // Find every span with empty/missing spanText
  const cursor = Span.find({
    $or: [{ spanText: null }, { spanText: '' }, { spanText: { $exists: false } }],
  }).cursor();

  // Cache pages by (bookId|pageNumber) so we don't re-query
  const pageCache = new Map();
  async function getPageRawText(bookId, pageNumber) {
    const key = `${bookId}|${pageNumber}`;
    if (pageCache.has(key)) return pageCache.get(key);
    const page = await Page.findOne({ bookId, pageNumber }).select('rawText').lean();
    const txt = page?.rawText || '';
    pageCache.set(key, txt);
    return txt;
  }

  let scanned = 0;
  let updated = 0;
  let skippedNoPage = 0;
  let skippedEmptyExtract = 0;

  for await (const span of cursor) {
    scanned++;
    const rawText = await getPageRawText(span.bookId, span.pageNumber);
    if (!rawText) { skippedNoPage++; continue; }
    const text = extractSpanText(rawText, span.sentenceStart, span.sentenceEnd);
    if (!text) { skippedEmptyExtract++; continue; }
    await Span.updateOne({ _id: span._id }, { $set: { spanText: text } });
    updated++;
    if (updated % 200 === 0) console.log(`[backfill] updated ${updated} so far (scanned ${scanned})`);
  }

  // Verify
  const remaining = await Span.countDocuments({
    $or: [{ spanText: null }, { spanText: '' }, { spanText: { $exists: false } }],
  });
  const total = await Span.countDocuments({});

  console.log('─────────────────────────────────────────');
  console.log('[backfill] DONE');
  console.log(`  scanned:                ${scanned}`);
  console.log(`  updated:                ${updated}`);
  console.log(`  skipped (no page):      ${skippedNoPage}`);
  console.log(`  skipped (empty range):  ${skippedEmptyExtract}`);
  console.log(`  total spans in db:      ${total}`);
  console.log(`  spans still empty:      ${remaining}`);
  console.log('─────────────────────────────────────────');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[backfill] FAILED:', err);
  process.exit(1);
});
