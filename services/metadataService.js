/**
 * Surface metadata extraction — uses a cheap model (GPT-4o-mini)
 * to extract topics, concepts, equations, chapter/section titles
 * from each page's rawText. ~$0.02 per book.
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { normalizeList } = require('./taxonomyService');

const PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'surface-metadata.txt');
const PROMPT = fs.readFileSync(PROMPT_PATH, 'utf-8');

let openai = null;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Extract surface metadata for a single page.
 * @param {string} rawText - The page's rawText
 * @returns {Object} { topics, concepts, equations, chapterTitle, sectionTitle, academicLevel }
 */
async function extractPageMetadata(rawText) {
  const client = getOpenAI();
  if (!client || !rawText) return null;

  // Truncate to ~500 tokens (~2000 chars) for cheap model
  const input = rawText.substring(0, 2000);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      temperature: 0,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: input },
      ],
    });

    const content = response.choices[0]?.message?.content || '';
    // Parse JSON — handle markdown fences
    const cleaned = content.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const data = JSON.parse(cleaned);

    return {
      topics: normalizeList(data.topics || []),
      concepts: normalizeList(data.concepts || []),
      equations: (data.equations || []).slice(0, 3),
      chapterTitle: data.chapterTitle || null,
      sectionTitle: data.sectionTitle || null,
      academicLevel: data.academicLevel || null,
    };
  } catch (err) {
    console.warn(`  Metadata extraction failed: ${err.message}`);
    return null;
  }
}

/**
 * Extract metadata for all pages of a book, then aggregate book-level metadata.
 * @param {string} bookId
 * @returns {Object} { pagesProcessed, bookUpdated }
 */
async function extractBookMetadata(bookId) {
  const Page = require('../models/Page');
  const Book = require('../models/Book');

  const pages = await Page.find({ bookId }).sort({ pageNumber: 1 });
  const book = await Book.findById(bookId);
  if (!book) throw new Error('Book not found');

  let processed = 0;
  const allTopics = new Set();
  const allConcepts = new Set();
  const chapters = [];
  let academicLevel = null;

  // Process in batches of 10 (cheap model, high throughput)
  const BATCH = 10;
  for (let i = 0; i < pages.length; i += BATCH) {
    const batch = pages.slice(i, i + BATCH);

    const results = await Promise.all(batch.map(async (page) => {
      const meta = await extractPageMetadata(page.rawText);
      return { page, meta };
    }));

    for (const { page, meta } of results) {
      if (meta) {
        page.topics = meta.topics;
        page.concepts = meta.concepts;
        page.equations = meta.equations;
        if (meta.chapterTitle && !page.chapterTitle) page.chapterTitle = meta.chapterTitle;
        if (meta.sectionTitle && !page.sectionTitle) page.sectionTitle = meta.sectionTitle;
        await page.save();

        meta.topics.forEach(t => allTopics.add(t));
        meta.concepts.forEach(c => allConcepts.add(c));
        if (meta.academicLevel) academicLevel = meta.academicLevel;
        if (meta.chapterTitle) {
          chapters.push({ chapter: meta.chapterTitle, pageStart: page.pageNumber });
        }
      }
      processed++;
    }
  }

  // Aggregate book-level metadata
  book.tags = [...allTopics].slice(0, 20);
  book.keyConcepts = [...allConcepts].slice(0, 30);
  if (academicLevel) book.academicLevel = academicLevel;
  book.documentType = 'research-paper'; // default; could be enhanced

  // Generate book summary from page 1 concepts
  if (!book.summary) {
    const p1 = await Page.findOne({ bookId, pageNumber: 1 }).select('concepts topics').lean();
    if (p1) {
      const topicStr = (p1.topics || []).join(', ');
      const conceptStr = (p1.concepts || []).join(', ');
      book.summary = `Research paper on ${topicStr}. Key concepts: ${conceptStr}.`;
    }
  }

  // Chapter summaries
  if (chapters.length > 0) {
    book.chapterSummaries = chapters.map(ch => ({
      chapter: ch.chapter,
      summary: '',
      pageStart: ch.pageStart,
    }));
  }

  await book.save();

  return { pagesProcessed: processed, bookUpdated: true };
}

module.exports = { extractPageMetadata, extractBookMetadata };
