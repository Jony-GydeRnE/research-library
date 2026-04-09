/**
 * Embedding service — generates vector embeddings for chunks and spans.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 */

const OpenAI = require('openai');
const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const pipeline = require('../config/pipeline');

let openai = null;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate embedding for a single text string.
 * @returns {Array<number>} embedding vector
 */
async function embed(text) {
  const client = getOpenAI();
  if (!client || !text) return null;

  const input = text.substring(0, 8000); // model limit
  const response = await client.embeddings.create({
    model: pipeline.EMBEDDING_MODEL || 'text-embedding-3-small',
    input,
  });

  return response.data[0]?.embedding || null;
}

/**
 * Generate embeddings for multiple texts in one API call (batched).
 * OpenAI allows up to 2048 inputs per request.
 * @returns {Array<Array<number>>} array of embeddings
 */
async function embedBatch(texts) {
  const client = getOpenAI();
  if (!client || texts.length === 0) return [];

  const inputs = texts.map(t => (t || '').substring(0, 8000));
  const response = await client.embeddings.create({
    model: pipeline.EMBEDDING_MODEL || 'text-embedding-3-small',
    input: inputs,
  });

  return response.data.map(d => d.embedding);
}

/**
 * Generate embeddings for all chunks of a book.
 */
async function embedChunksForBook(bookId) {
  const chunks = await Chunk.find({ bookId, embedding: { $size: 0 } })
    .select('_id sourceText contextTags')
    .lean();

  if (chunks.length === 0) {
    // Check for chunks without embeddings (embedding field may not exist)
    const allChunks = await Chunk.find({ bookId }).select('_id sourceText contextTags embedding').lean();
    const needEmbed = allChunks.filter(c => !c.embedding || c.embedding.length === 0);
    if (needEmbed.length === 0) return { chunksEmbedded: 0 };
    return await embedChunkBatch(needEmbed);
  }

  return await embedChunkBatch(chunks);
}

async function embedChunkBatch(chunks) {
  const BATCH = 50;
  let embedded = 0;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);

    // Build embedding text: sourceText + context tags
    const texts = batch.map(c => {
      let text = c.sourceText || '';
      if (c.contextTags?.length) text += '\nTags: ' + c.contextTags.join(', ');
      return text;
    });

    try {
      const embeddings = await embedBatch(texts);
      for (let j = 0; j < batch.length; j++) {
        if (embeddings[j]) {
          await Chunk.findByIdAndUpdate(batch[j]._id, { embedding: embeddings[j] });
          embedded++;
        }
      }
    } catch (err) {
      console.error(`[embeddingService] Chunk batch failed: ${err.message}`);
      // Retry individually
      for (const c of batch) {
        try {
          let text = c.sourceText || '';
          if (c.contextTags?.length) text += '\nTags: ' + c.contextTags.join(', ');
          const emb = await embed(text);
          if (emb) {
            await Chunk.findByIdAndUpdate(c._id, { embedding: emb });
            embedded++;
          }
        } catch (e2) {
          console.error(`[embeddingService] Chunk ${c._id} failed: ${e2.message}`);
        }
      }
    }
  }

  console.log(`[embeddingService] Embedded ${embedded} chunks`);
  return { chunksEmbedded: embedded };
}

/**
 * Generate embeddings for all spans of a book that have concept tags.
 */
async function embedSpansForBook(bookId) {
  const spans = await Span.find({
    bookId,
    contextTags: { $exists: true, $not: { $size: 0 } },
  }).select('_id contextTags sentenceStart sentenceEnd embedding').lean();

  const needEmbed = spans.filter(s => !s.embedding || s.embedding.length === 0);
  if (needEmbed.length === 0) return { spansEmbedded: 0 };

  const BATCH = 100;
  let embedded = 0;

  for (let i = 0; i < needEmbed.length; i += BATCH) {
    const batch = needEmbed.slice(i, i + BATCH);
    const texts = batch.map(s => (s.contextTags || []).join(' '));

    try {
      const embeddings = await embedBatch(texts);
      for (let j = 0; j < batch.length; j++) {
        if (embeddings[j]) {
          await Span.findByIdAndUpdate(batch[j]._id, { embedding: embeddings[j] });
          embedded++;
        }
      }
    } catch (err) {
      console.error(`[embeddingService] Span batch failed: ${err.message}`);
    }
  }

  console.log(`[embeddingService] Embedded ${embedded} spans`);
  return { spansEmbedded: embedded };
}

/**
 * Generate all embeddings for a book (chunks + spans).
 */
async function generateEmbeddingsForBook(bookId) {
  const chunkResult = await embedChunksForBook(bookId);
  const spanResult = await embedSpansForBook(bookId);
  return { ...chunkResult, ...spanResult };
}

module.exports = { embed, embedBatch, generateEmbeddingsForBook };
