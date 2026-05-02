#!/usr/bin/env node
/**
 * Repair Page.rawText for pages that have htmlContent but no rawText.
 * Derives plain text from htmlContent, preserving LaTeX (inline \(...\)
 * and display \[...\]) and treating block tags as paragraph separators.
 * Idempotent — only writes pages where rawText is empty/missing.
 *
 * Usage:
 *   node scripts/repair-rawtext-from-html.js --book=<bookId>
 *
 * 2026-05-01 — pulled in to fix the 32 old-format pages on the
 * Lagrangians notes book whose spans got deleted by generateSpansForBook
 * because rawText was empty even though the rewrite is clean.
 */

require('dotenv').config();
const mongoose = require('mongoose');

function htmlToPlainText(html) {
  if (!html) return '';
  let s = html;

  // Drop script/style blocks entirely.
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Block tags → newlines so paragraphs separate cleanly.
  s = s.replace(/<\/(p|div|h[1-6]|li|ul|ol|figure|figcaption|blockquote|pre|table|tr|hr)>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');

  // Strip remaining tags but keep their contents.
  s = s.replace(/<[^>]+>/g, '');

  // Common HTML entities. Keep math chars intact.
  s = s.replace(/&nbsp;/g, ' ')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .replace(/&hellip;/g, '...')
       .replace(/&mdash;/g, '—')
       .replace(/&ndash;/g, '–');

  // Collapse whitespace but preserve paragraph breaks.
  s = s.replace(/[ \t\f\v]+/g, ' ')
       .replace(/\n{3,}/g, '\n\n')
       .replace(/^[ \t]+/gm, '')
       .trim();

  return s;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=') || true];
  }));

  if (!args.book) {
    console.error('Usage: node scripts/repair-rawtext-from-html.js --book=<bookId>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const Page = require('../models/Page');

  const pages = await Page.find({
    bookId: args.book,
    htmlContent: { $exists: true, $ne: '' }
  }).select('pageNumber rawText htmlContent').lean();

  console.log(`[repair] book=${args.book} total pages with htmlContent: ${pages.length}`);

  let candidates = 0, written = 0, skipped = 0;
  for (const p of pages) {
    if (p.rawText && p.rawText.length > 20) { skipped++; continue; }
    candidates++;
    const derived = htmlToPlainText(p.htmlContent);
    if (!derived || derived.length < 10) {
      console.log(`[repair] page ${p.pageNumber} — derived rawText too short (${derived.length} chars), skipping`);
      continue;
    }
    if (args.dry === true) {
      console.log(`[repair] DRY page ${p.pageNumber} would write ${derived.length} chars`);
      written++;
      continue;
    }
    await Page.updateOne({ _id: p._id }, { $set: { rawText: derived } });
    written++;
    if (written <= 3) {
      console.log(`[repair] page ${p.pageNumber} wrote ${derived.length} chars; sample: ${derived.slice(0,160).replace(/\n/g,' ')}`);
    }
  }

  console.log(`[repair] done. candidates=${candidates}, written=${written}, skipped(already had rawText)=${skipped}`);
  process.exit(0);
}

main().catch(e => {
  console.error('[repair] FATAL', e);
  process.exit(1);
});
