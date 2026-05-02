#!/usr/bin/env node
/**
 * scripts/sample-quality-snapshot.js — hands-on metadata/edge inspector.
 *
 * For verification by humans (Jony). Pulls N random chunks from a book and
 * dumps each one with EVERYTHING the system has attached to it: rawText,
 * every span and its tags, every outgoing edge with the target chunk's
 * preview, every incoming edge, every canonical-definition link.
 *
 * Output is a single markdown file with deep links you can paste into a
 * browser or click in Cursor. The link format
 *   /reader/<bookId>?page=<N>&mode=metadata
 * jumps the reader straight to the chunk's page in metadata-overlay mode.
 *
 * Usage:
 *   node scripts/sample-quality-snapshot.js --book=<bookId> [--n=8] [--page=<N>]
 *
 * Flags:
 *   --book   bookId. Required.
 *   --n      sample size (default 8 — enough to spot patterns, short enough to read)
 *   --page   restrict to a specific page (overrides --n; pulls every chunk on that page)
 *   --slug   filename slug (default: bookid-n<n> or bookid-page<page>)
 *
 * Output: reports/YYYY-MM-DD/sample-quality-<slug>.md
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function fmt(s, n = 240) {
  if (!s) return '_(empty)_';
  const collapsed = s.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= n) return collapsed;
  return collapsed.slice(0, n) + '…';
}

function pickRandom(arr, n) {
  if (n >= arr.length) return arr.slice();
  const out = [];
  const used = new Set();
  while (out.length < n) {
    const i = Math.floor(Math.random() * arr.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(arr[i]);
  }
  return out;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=') || true];
  }));

  if (!args.book) {
    console.error('Usage: node scripts/sample-quality-snapshot.js --book=<bookId> [--n=8] [--page=<N>]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const Book = require('../models/Book');
  const Chunk = require('../models/Chunk');
  const Span = require('../models/Span');
  const Edge = require('../models/Edge');
  const CanonicalDefinition = require('../models/CanonicalDefinition');

  const book = await Book.findById(args.book).lean();
  if (!book) {
    console.error(`Book ${args.book} not found.`);
    process.exit(1);
  }

  let chunks;
  if (args.page) {
    chunks = await Chunk.find({ bookId: args.book, pageNumber: parseInt(args.page, 10) })
      .sort({ chunkIndex: 1 }).lean();
    if (!chunks.length) {
      console.error(`No chunks on page ${args.page} for ${book.title}.`);
      process.exit(1);
    }
  } else {
    const all = await Chunk.find({ bookId: args.book }).lean();
    if (!all.length) {
      console.error(`No chunks for ${book.title}.`);
      process.exit(1);
    }
    const n = parseInt(args.n, 10) || 8;
    chunks = pickRandom(all, n);
    chunks.sort((a, b) => (a.pageNumber - b.pageNumber) || (a.chunkIndex - b.chunkIndex));
  }

  const slug = args.slug
    || (args.page
        ? `${String(args.book).slice(-6)}-page${args.page}`
        : `${String(args.book).slice(-6)}-n${chunks.length}`);

  const lines = [];
  lines.push(`# Quality snapshot — ${fmt(book.title, 90)}`);
  lines.push('');
  lines.push(`- Book ID: \`${book._id}\``);
  lines.push(`- Kind: \`${book.kind || 'paper'}\``);
  lines.push(`- Linked source books: \`${(book.linkedBookIds || []).map(String).join(', ') || '(none)'}\``);
  lines.push(`- Sampled: ${chunks.length} chunk${chunks.length === 1 ? '' : 's'}${args.page ? ` (full page ${args.page})` : ' (random)'}`);
  lines.push('');
  lines.push(`Click any link to open the reader at that page in metadata-overlay mode.`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Pre-fetch related books for edge target previews
  const otherBookIds = new Set();
  for (const c of chunks) {
    const outE = await Edge.find({ fromChunkId: c._id }).lean();
    const inE = await Edge.find({ toChunkId: c._id }).lean();
    for (const e of [...outE, ...inE]) {
      if (e.fromBookId) otherBookIds.add(String(e.fromBookId));
      if (e.toBookId) otherBookIds.add(String(e.toBookId));
    }
  }
  const otherBooks = new Map();
  for (const b of await Book.find({ _id: { $in: [...otherBookIds] } }).select('title kind').lean()) {
    otherBooks.set(String(b._id), b);
  }

  let chunkIdx = 0;
  for (const chunk of chunks) {
    chunkIdx++;
    const readerUrl = `/reader/${book._id}?page=${chunk.pageNumber}&mode=metadata`;
    lines.push(`## ${chunkIdx}. Chunk \`${String(chunk._id).slice(-8)}\` — page ${chunk.pageNumber}`);
    lines.push('');
    lines.push(`- **Open in reader:** [${readerUrl}](${readerUrl})`);
    lines.push(`- **Type:** \`${chunk.structuralType || chunk.chunkType || 'unknown'}\``);
    lines.push(`- **Subject tags:** ${(chunk.subjectTags || []).map(t => '`' + t + '`').join(', ') || '_(none)_'}`);
    lines.push(`- **Concept tags:** ${(chunk.conceptTags || chunk.contextTags || []).map(t => '`' + t + '`').join(', ') || '_(none)_'}`);
    if (chunk.hasMissingProof) lines.push('- **⚠ hasMissingProof:** true');
    if (chunk.qualityScore != null) lines.push(`- **Quality score (judge):** ${chunk.qualityScore} / 9`);
    lines.push('');

    lines.push('**Raw text:**');
    lines.push('');
    lines.push('> ' + fmt((chunk.sourceText || chunk.rawText), 600).replace(/\n/g, '\n> '));
    lines.push('');

    // Spans on this chunk
    const spans = await Span.find({ chunkId: chunk._id }).sort({ sentenceStart: 1 }).lean();
    lines.push(`### Spans (${spans.length})`);
    lines.push('');
    if (!spans.length) {
      lines.push('_(no spans on this chunk — usually means this chunk fell into a single big span or was skipped during span generation)_');
      lines.push('');
    } else {
      lines.push('| # | range | role | context tags | declarative | search-class | preview |');
      lines.push('|---|---|---|---|---|---|---|');
      let i = 0;
      for (const s of spans) {
        i++;
        const start = s.sentenceStart ?? s.startOffset;
        const end = s.sentenceEnd ?? s.endOffset;
        const range = (start != null && end != null && start !== end)
          ? `${start}-${end}` : (start != null ? `${start}` : '?');

        const ctxTags = (s.contextTags && s.contextTags.length ? s.contextTags : (s.tags || []));
        const ctxStr = ctxTags.length ? ctxTags.map(t => '`' + t + '`').join(' ') : '_(empty)_';

        const role = s.role ? '`' + s.role + '`' : '_(none)_';

        let declStr = '_(none)_';
        if (Array.isArray(s.declarativeTags) && s.declarativeTags.length) {
          declStr = s.declarativeTags
            .map(d => `\`${d.kind || '?'}${(d.targetChunk != null && d.targetTag != null) ? d.targetChunk + '.' + d.targetTag : ''}\``)
            .join(' ');
        }

        let scStr = '_(N)_';
        if (s.searchClass && s.searchClass !== 'N') {
          if (s.searchClass === 'L') {
            if (s.gapType === 'definition') scStr = '`Ld`';
            else if (s.gapType === 'derivation') scStr = '`Lv`';
            else if (s.gapType === 'proof') scStr = '`Lp`';
            else if (s.searchConfidence) scStr = '`L' + s.searchConfidence + '`';
            else scStr = '`L?`';
          } else if (s.searchClass === 'S') {
            scStr = '`S`';
          } else {
            scStr = '`' + s.searchClass + (s.searchConfidence || '?') + '`';
          }
        }

        const preview = fmt(s.spanText || '', 70);
        lines.push(`| ${i} | ${range} | ${role} | ${ctxStr} | ${declStr} | ${scStr} | ${preview} |`);
      }
      lines.push('');
    }

    // Outgoing edges
    const outEdges = await Edge.find({ fromChunkId: chunk._id }).lean();
    lines.push(`### Outgoing edges (${outEdges.length})`);
    lines.push('');
    if (!outEdges.length) {
      lines.push('_(no outgoing edges — this chunk is a graph leaf)_');
      lines.push('');
    } else {
      lines.push('| target | rel | conf | method | target preview |');
      lines.push('|---|---|---|---|---|');
      for (const e of outEdges.slice(0, 12)) {
        const tBook = otherBooks.get(String(e.toBookId));
        const tBookTitle = fmt(tBook?.title || 'unknown', 50);
        const tChunk = e.toChunkId
          ? await Chunk.findById(e.toChunkId).select('pageNumber sourceText rawText').lean()
          : null;
        const tPage = tChunk?.pageNumber ?? '?';
        const tPreview = fmt(tChunk?.sourceText || tChunk?.rawText || '', 80);
        const targetUrl = e.toBookId
          ? `/reader/${e.toBookId}?page=${tPage}&mode=metadata`
          : '#';
        lines.push(`| [${tBookTitle} p${tPage}](${targetUrl}) | \`${e.relationshipType || '?'}\` | \`${e.confidence || '?'}\` | \`${e.method || '?'}\` | ${tPreview} |`);
      }
      if (outEdges.length > 12) {
        lines.push(`| _… ${outEdges.length - 12} more_ | | | | |`);
      }
      lines.push('');
    }

    // Incoming edges
    const inEdges = await Edge.find({ toChunkId: chunk._id }).lean();
    lines.push(`### Incoming edges (${inEdges.length})`);
    lines.push('');
    if (!inEdges.length) {
      lines.push('_(no incoming edges — nothing in the library currently points at this chunk)_');
      lines.push('');
    } else {
      lines.push('| source | rel | conf | method |');
      lines.push('|---|---|---|---|');
      for (const e of inEdges.slice(0, 8)) {
        const sBook = otherBooks.get(String(e.fromBookId));
        const sBookTitle = fmt(sBook?.title || 'unknown', 50);
        const sChunk = e.fromChunkId
          ? await Chunk.findById(e.fromChunkId).select('pageNumber').lean()
          : null;
        const sPage = sChunk?.pageNumber ?? '?';
        const sourceUrl = e.fromBookId
          ? `/reader/${e.fromBookId}?page=${sPage}&mode=metadata`
          : '#';
        lines.push(`| [${sBookTitle} p${sPage}](${sourceUrl}) | \`${e.relationshipType || '?'}\` | \`${e.confidence || '?'}\` | \`${e.method || '?'}\` |`);
      }
      if (inEdges.length > 8) {
        lines.push(`| _… ${inEdges.length - 8} more_ | | | |`);
      }
      lines.push('');
    }

    // Canonical definitions this chunk anchors
    const canonicalsAnchored = await CanonicalDefinition.find({ chunkId: chunk._id }).lean();
    if (canonicalsAnchored.length) {
      lines.push(`### Canonical definitions anchored here (${canonicalsAnchored.length})`);
      lines.push('');
      for (const c of canonicalsAnchored) {
        lines.push(`- **\`${c.concept}\`** — ${(c.surfaceForms || []).slice(0, 6).map(s => '`' + s + '`').join(', ')} (tier ${c.tier ?? '?'})`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Footer with summary stats
  let totalSpans = 0;
  let totalOut = 0, totalIn = 0;
  for (const c of chunks) {
    totalSpans += await Span.countDocuments({ chunkId: c._id });
    totalOut += await Edge.countDocuments({ fromChunkId: c._id });
    totalIn += await Edge.countDocuments({ toChunkId: c._id });
  }

  lines.push('## Sample summary');
  lines.push('');
  lines.push(`- Spans across sample: ${totalSpans} (avg ${(totalSpans / chunks.length).toFixed(1)} per chunk)`);
  lines.push(`- Outgoing edges across sample: ${totalOut}`);
  lines.push(`- Incoming edges across sample: ${totalIn}`);
  lines.push('');
  lines.push('## How to verify quality (eyeball test)');
  lines.push('');
  lines.push('For each chunk above, ask:');
  lines.push('');
  lines.push('1. **Tag specificity** — are the concept tags at the level of "what THIS chunk is about" (e.g. `bcfw_complex_parameter`) or at the level of "what section this chunk lives under" (e.g. `bcfw_recursion`)? The former is what we want.');
  lines.push('2. **Tag normalization** — does the same concept get the same tag every time? Look for `bcfw_shift` vs `bcfw_shifts` vs `bcfw_recursion_relation` — they should all collapse to one canonical via taxonomyService.');
  lines.push('3. **Role accuracy** — does each span\'s role match what the sentence actually does? `:=` lines must always be `definition`. "We will prove..." is `preview`, not `proof`.');
  lines.push('4. **Gap detection (Ld/Lv/Lp)** — does every undefined term carry `Ld`, every skipped derivation `Lv`, every unproved claim `Lp`? An L-tag-free chunk is suspicious unless the chunk is purely self-contained.');
  lines.push('5. **Edge sanity** — for each outgoing edge, click the target link and read the chunk. Does the claimed relationship hold? `proves` should mean THIS chunk contains a proof step that establishes the target. `prerequisite` should mean a reader needs to understand the target before this chunk is intelligible.');
  lines.push('6. **Edge confidence calibration** — are `Yz` (highest confidence) edges actually the strongest matches, and `Yp` (mid) edges weaker? If you see a confident-looking edge with confidence `j` or below, that\'s a calibration miss.');
  lines.push('');
  lines.push('Anything that looks wrong, copy the chunk ID and tell me — I\'ll wire it into the next prompt iteration as a negative example.');

  const dateSlug = new Date().toISOString().slice(0, 10);
  const reportDir = path.join(__dirname, '..', 'reports', dateSlug);
  fs.mkdirSync(reportDir, { recursive: true });
  const outPath = path.join(reportDir, `sample-quality-${slug}.md`);
  fs.writeFileSync(outPath, lines.join('\n'));

  console.log(`[snapshot] wrote ${outPath}`);
  console.log(`[snapshot] sampled ${chunks.length} chunks, ${totalSpans} spans, ${totalOut} out-edges, ${totalIn} in-edges`);
  process.exit(0);
}

main().catch(e => {
  console.error('[snapshot] FATAL', e);
  process.exit(1);
});
