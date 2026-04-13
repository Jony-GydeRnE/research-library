#!/usr/bin/env node
/**
 * rebuild-metadata.js — re-ingest metadata for one or more books
 * after the 2026-04-12 metadata pipeline fixes:
 *
 *   - chunker no longer breaks on search class (chunkService.js)
 *   - chunker merges chunks whose next span starts with a pronoun
 *   - CHUNK_MAX_SPANS bumped from 3 -> 8
 *   - span prompts teach multi-concept decomposition
 *   - canonical-definition dictionary links uses_definition edges
 *
 * Usage:
 *   node scripts/rebuild-metadata.js --book <bookId>
 *   node scripts/rebuild-metadata.js --book <bookId> --skip-spans
 *   node scripts/rebuild-metadata.js --all
 *
 * Stages (each optional via flags):
 *   1. Regenerate spans via spanService.generateSpansForBook
 *      (hits OpenAI — costs money, ~$0.05-0.20 per book).
 *      Skipped when --skip-spans is passed.
 *   2. Regenerate chunks via chunkService.generateChunksForBook
 *      (pure DB, free). Always runs.
 *   3. Regenerate embeddings for chunks/spans via
 *      embeddingService.generateEmbeddingsForBook
 *      (hits OpenAI — cheap, ~$0.002 per book). Skipped with
 *      --skip-embed.
 *   4. Rebuild canonical definition dictionary (library-wide)
 *      and link this book's spans to canonical defs. Pure DB.
 *      Always runs unless --skip-canonical.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
function getFlag(name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  return args[i + 1] || true;
}
function hasFlag(name) { return args.includes(name); }

const bookIdArg = getFlag('--book');
const all = hasFlag('--all');
const skipSpans = hasFlag('--skip-spans');
const skipEmbed = hasFlag('--skip-embed');
const skipCanonical = hasFlag('--skip-canonical');

if (!bookIdArg && !all) {
  console.error('Usage: node scripts/rebuild-metadata.js --book <bookId> [--skip-spans] [--skip-embed] [--skip-canonical]');
  console.error('       node scripts/rebuild-metadata.js --all');
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Book = require('../models/Book');
  const spanService = require('../services/spanService');
  const chunkService = require('../services/chunkService');
  const embeddingService = require('../services/embeddingService');
  const canonicalDefinitionService = require('../services/canonicalDefinitionService');

  // Resolve book list.
  let bookIds = [];
  if (all) {
    const books = await Book.find({ status: 'ready' }).select('_id title').lean();
    bookIds = books.map(b => ({ _id: b._id, title: b.title }));
  } else {
    const b = await Book.findById(bookIdArg).select('_id title').lean();
    if (!b) {
      console.error('Book not found:', bookIdArg);
      process.exit(2);
    }
    bookIds = [{ _id: b._id, title: b.title }];
  }

  console.log(`\n=== rebuild-metadata: ${bookIds.length} book${bookIds.length !== 1 ? 's' : ''} ===\n`);
  for (const b of bookIds) console.log(`  • ${String(b._id)}  ${b.title || ''}`);
  console.log('');

  for (const b of bookIds) {
    const label = b.title || String(b._id);
    console.log(`\n--- ${label} ---`);

    if (!skipSpans) {
      console.log('  [1/4] regenerating spans (OpenAI)…');
      const spanResult = await spanService.generateSpansForBook(b._id);
      console.log('       spans:', spanResult);
    } else {
      console.log('  [1/4] spans skipped (--skip-spans)');
    }

    console.log('  [2/4] regenerating chunks from spans…');
    const chunkResult = await chunkService.generateChunksForBook(b._id);
    console.log('       chunks:', chunkResult);

    if (!skipEmbed) {
      console.log('  [3/4] regenerating chunk & span embeddings (OpenAI)…');
      try {
        const embedResult = await embeddingService.generateEmbeddingsForBook(b._id);
        console.log('       embeddings:', embedResult);
      } catch (err) {
        console.error('       embedding failed:', err.message);
      }
    } else {
      console.log('  [3/4] embeddings skipped (--skip-embed)');
    }

    if (!skipCanonical) {
      console.log('  [4/4] rebuilding canonical definition dictionary + linking…');
      const canon = await canonicalDefinitionService.rebuildCanonicalForBook(b._id);
      console.log('       canonical:', canon);
    } else {
      console.log('  [4/4] canonical skipped (--skip-canonical)');
    }
  }

  console.log('\n=== done ===\n');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
