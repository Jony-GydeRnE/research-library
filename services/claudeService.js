const Anthropic = require('@anthropic-ai/sdk');
const Book = require('../models/Book');
const Collection = require('../models/Collection');
const Page = require('../models/Page');

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a research assistant for an advanced physics and mathematics researcher. You have deep knowledge of theoretical physics, algebraic geometry, quantum field theory, and related fields.

When answering:
- Be precise and rigorous. Cite specific theorems, equations, and page numbers when referencing the user's books.
- Use LaTeX notation for math: \\( ... \\) for inline, \\[ ... \\] for display equations.
- If you reference a passage from a book in the library, mention the book title and page number.
- Be concise but thorough. Prioritize clarity over verbosity.
- If you're unsure about something, say so rather than guessing.`;

/**
 * Build the full message context for a chat.
 * Includes system prompt, collection instructions, book context, and chat history.
 */
async function buildContext(chat) {
  let system = SYSTEM_PROMPT;

  // Add collection context: instructions + summaries from all books in collection
  if (chat.collectionId) {
    const collection = await Collection.findById(chat.collectionId).lean();
    if (collection) {
      if (collection.instructions) {
        system += `\n\nThe user has provided these research context instructions:\n${collection.instructions}`;
      }
      // Include first-page text from all books in this collection
      if (collection.bookIds && collection.bookIds.length > 0) {
        const colBooks = await Book.find({ _id: { $in: collection.bookIds }, status: 'ready' }).select('_id title author').lean();
        const bookSummaries = [];
        for (const b of colBooks.slice(0, 10)) { // limit to 10 books
          const firstPage = await Page.findOne({ bookId: b._id, pageNumber: 1 }).select('rawText').lean();
          const snippet = firstPage?.rawText?.substring(0, 800) || '';
          bookSummaries.push(`"${b.title}"${b.author ? ' by ' + b.author : ''}:\n${snippet}`);
        }
        if (bookSummaries.length > 0) {
          system += `\n\nBooks in this collection (with first-page excerpts):\n\n${bookSummaries.join('\n\n---\n\n')}`;
        }
      }
    }
  }

  // Add book/page context if chat is anchored to a reader page
  if (chat.bookId) {
    const book = await Book.findById(chat.bookId).lean();
    if (book) {
      system += `\n\nThe user is currently reading: "${book.title}"${book.author ? ' by ' + book.author : ''}.`;

      if (chat.pageNumber) {
        const page = await Page.findOne({ bookId: chat.bookId, pageNumber: chat.pageNumber }).lean();
        if (page && page.rawText) {
          const text = page.rawText.substring(0, 2000);
          system += `\n\nCurrent page ${chat.pageNumber} content:\n${text}`;
        }
      }
    }
  }

  // Add highlighted text context
  if (chat.highlightText) {
    system += `\n\nThe user highlighted this passage:\n"${chat.highlightText}"`;
  }

  // Add library overview (book titles for reference)
  const books = await Book.find({ status: 'ready' }).select('title author pageCount').lean();
  if (books.length > 0) {
    const bookList = books.map(b => `- ${b.title}${b.author ? ' (' + b.author + ')' : ''}`).join('\n');
    system += `\n\nBooks in the user's library:\n${bookList}`;
  }

  return system;
}

/**
 * Stream a response from Claude given a chat document.
 * Yields text chunks as they arrive.
 *
 * @param {Object} chat - The chat document (with messages array)
 * @param {Function} onChunk - Called with each text chunk
 * @param {Function} onDone - Called when streaming is complete with full text
 */
async function streamResponse(chat, onChunk, onDone) {
  const system = await buildContext(chat);

  // Build messages array from chat history
  const messages = chat.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  let fullText = '';

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      fullText += event.delta.text;
      onChunk(event.delta.text);
    }
  }

  onDone(fullText);
}

module.exports = { streamResponse, buildContext };
