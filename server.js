require('dotenv').config();

const express = require('express');
const path = require('path');
const { connectDatabase } = require('./config/database');
const { initAgenda } = require('./services/jobService');

const uploadRoutes = require('./routes/upload');
const libraryRoutes = require('./routes/library');
const readerRoutes = require('./routes/reader');
const collectionsRoutes = require('./routes/collections');
const highlightsRoutes = require('./routes/highlights');
const notesRoutes = require('./routes/notes');
const spansRoutes = require('./routes/spans');
const booksRoutes = require('./routes/books');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'uploads', 'images')));

// Routes
app.use('/upload', uploadRoutes);
app.use('/library', libraryRoutes);
app.use('/reader', readerRoutes);
app.use('/collections', collectionsRoutes);
app.use('/collection', collectionsRoutes);
app.use('/api/highlights', highlightsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/spans', spansRoutes);
app.use('/api/books', booksRoutes);
app.use('/covers', express.static(path.join(__dirname, 'uploads', 'covers')));

// ─── All Files section (books + notes tabs) ────────────────────
// "All Files" is the default landing area for every book in the
// library. It mirrors the legacy "All Books" collection but is
// presented as a first-class nav item with its own tabs:
//   /files           → Books tab (grid of every book)
//   /files/notes     → Notes tab (grid of every book-as-notebook)
//   /files/notebook/:bookId → single book's notes in scroll view
// The underlying "All Books" Collection document is preserved so
// uploads still auto-add to it and the existing collections
// machinery keeps working.

app.get('/files', async (req, res) => {
  const Collection = require('./models/Collection');
  const Book = require('./models/Book');
  const Note = require('./models/Note');
  try {
    let allBooksCol = await Collection.findOne({ title: 'All Books' });
    // Auto-create if somehow missing
    if (!allBooksCol) {
      const allBooks = await Book.find({ status: { $ne: 'pending-citation' } }).sort({ uploadedAt: -1 }).lean();
      allBooksCol = await Collection.create({
        title: 'All Books',
        bookIds: allBooks.map(b => b._id),
      });
    }
    // Filter pending-citation stubs out of the user-visible list. Stubs
    // exist for cross-book citations to papers we don't yet have
    // uploaded — they're real Book documents but they have no file,
    // no pages, no chunks, and shouldn't appear in the library view.
    const books = await Book.find({ _id: { $in: allBooksCol.bookIds }, status: { $ne: 'pending-citation' } }).sort({ uploadedAt: -1 }).lean();
    // Attach note counts per book so the Notes tab can show them
    const counts = await Note.aggregate([
      { $match: { bookId: { $in: allBooksCol.bookIds } } },
      { $group: { _id: '$bookId', n: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[String(c._id)] = c.n; });
    books.forEach(b => { b.noteCount = countMap[String(b._id)] || 0; });

    const sidebar = await getSidebarData();
    res.render('files', {
      title: 'All Files',
      page: 'files',
      tab: 'books',
      books,
      activeCollection: allBooksCol,
      collections: sidebar.collections,
    });
  } catch (err) {
    console.error('All Files error:', err);
    res.status(500).send('Error loading files');
  }
});

app.get('/files/notes', async (req, res) => {
  const Collection = require('./models/Collection');
  const Book = require('./models/Book');
  const Note = require('./models/Note');
  try {
    const allBooksCol = await Collection.findOne({ title: 'All Books' });
    const bookIds = allBooksCol ? allBooksCol.bookIds : [];
    const books = await Book.find({ _id: { $in: bookIds }, status: { $ne: 'pending-citation' } }).sort({ uploadedAt: -1 }).lean();
    const counts = await Note.aggregate([
      { $match: { bookId: { $in: bookIds } } },
      { $group: { _id: '$bookId', n: { $sum: 1 }, latest: { $max: '$updatedAt' } } },
    ]);
    const map = {};
    counts.forEach(c => { map[String(c._id)] = c; });
    // Only books with at least one note are shown in the Notes tab
    const notebooks = books
      .map(b => ({ ...b, noteCount: (map[String(b._id)] || {}).n || 0, latestNote: (map[String(b._id)] || {}).latest || null }))
      .filter(b => b.noteCount > 0);

    const sidebar = await getSidebarData();
    res.render('files', {
      title: 'All Notes',
      page: 'files',
      tab: 'notes',
      notebooks,
      activeCollection: allBooksCol,
      collections: sidebar.collections,
    });
  } catch (err) {
    console.error('Files notes error:', err);
    res.status(500).send('Error loading notes');
  }
});

app.get('/files/notebook/:bookId', async (req, res) => {
  const Book = require('./models/Book');
  const Note = require('./models/Note');
  const Highlight = require('./models/Highlight');
  try {
    const book = await Book.findById(req.params.bookId).lean();
    if (!book) return res.redirect('/files/notes');
    const sort = (req.query.sort || 'page').toLowerCase();
    let sortSpec;
    if (sort === 'newest') sortSpec = { createdAt: -1 };
    else if (sort === 'oldest') sortSpec = { createdAt: 1 };
    else sortSpec = { pageNumber: 1, createdAt: 1 };
    const notes = await Note.find({ bookId: book._id }).sort(sortSpec).lean();
    // Attach the highlight text (if any) so the note can show the
    // passage it was written about as context above the note body.
    const highlightIds = notes.map(n => n.highlightId).filter(Boolean);
    const highlights = highlightIds.length
      ? await Highlight.find({ _id: { $in: highlightIds } }).lean()
      : [];
    const hMap = {};
    highlights.forEach(h => { hMap[String(h._id)] = h; });
    notes.forEach(n => {
      if (n.highlightId) n.highlight = hMap[String(n.highlightId)] || null;
    });

    const sidebar = await getSidebarData();
    res.render('files-notebook', {
      title: book.title || 'Notebook',
      page: 'files',
      tab: 'notes',
      book,
      notes,
      sort,
      collections: sidebar.collections,
    });
  } catch (err) {
    console.error('Files notebook error:', err);
    res.status(500).send('Error loading notebook');
  }
});

// Chats
const { getSidebarData } = require('./services/sidebarData');

app.get('/chats', async (req, res) => {
  const Chat = require('./models/Chat');
  const sidebar = await getSidebarData();
  const chats = await Chat.find({ collectionId: null }).sort({ updatedAt: -1 }).lean();
  res.render('chats', { title: 'Chats', page: 'chats', chats, ...sidebar });
});

app.get('/chat/:chatId', async (req, res) => {
  const Chat = require('./models/Chat');
  const Collection = require('./models/Collection');
  const Book = require('./models/Book');
  const chat = await Chat.findById(req.params.chatId).lean();
  if (!chat) return res.redirect('/chats');
  const sidebar = await getSidebarData();
  let chatCollection = null;
  if (chat.collectionId) {
    chatCollection = await Collection.findById(chat.collectionId).select('_id title color').lean();
  }
  // Books available for citation rendering (id → {title, author})
  const allBooks = await Book.find().select('_id title author').lean();
  const booksMap = {};
  for (const b of allBooks) {
    booksMap[String(b._id)] = { title: b.title, author: b.author || '' };
  }
  res.render('chat', {
    title: chat.title || 'Chat',
    page: 'chats',
    chat,
    chatCollection,
    booksMap,
    hideInputBar: true,
    ...sidebar,
  });
});

// Chat CRUD: rename, star, change/remove project, delete
app.patch('/api/chat/:chatId', async (req, res) => {
  try {
    const Chat = require('./models/Chat');
    const Collection = require('./models/Collection');
    const update = {};
    const { title, starred, collectionId } = req.body;
    if (title !== undefined) update.title = title;
    if (starred !== undefined) update.starred = !!starred;
    if (collectionId !== undefined) update.collectionId = collectionId || null;

    const previous = await Chat.findById(req.params.chatId).select('collectionId').lean();
    const chat = await Chat.findByIdAndUpdate(req.params.chatId, update, { new: true }).lean();
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // Sync Collection.chatIds when collectionId changes
    if (collectionId !== undefined) {
      if (previous && previous.collectionId && String(previous.collectionId) !== String(collectionId || '')) {
        await Collection.findByIdAndUpdate(previous.collectionId, { $pull: { chatIds: chat._id } });
      }
      if (collectionId) {
        await Collection.findByIdAndUpdate(collectionId, { $addToSet: { chatIds: chat._id } });
      }
    }
    res.json({ ok: true, chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chat/:chatId', async (req, res) => {
  try {
    const Chat = require('./models/Chat');
    const Collection = require('./models/Collection');
    const chat = await Chat.findById(req.params.chatId).lean();
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (chat.collectionId) {
      await Collection.findByIdAndUpdate(chat.collectionId, { $pull: { chatIds: chat._id } });
    }
    await Chat.findByIdAndDelete(req.params.chatId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Copy a chat into another collection. Creates a new Chat record with
// the same messages/title/bookId/pageNumber/highlightText but a different
// collectionId, so the original remains untouched. The copy inherits its
// scope (book list, instructions) from its new collection automatically,
// since claudeService's context builder keys off chat.collectionId. Used
// by the sidebar chat-actions popup "Copy to…" action.
app.post('/api/chat/:chatId/copy', async (req, res) => {
  try {
    const Chat = require('./models/Chat');
    const Collection = require('./models/Collection');
    const { collectionId } = req.body || {};
    const original = await Chat.findById(req.params.chatId).lean();
    if (!original) return res.status(404).json({ error: 'Chat not found' });
    const copy = await Chat.create({
      title: original.title ? original.title + ' (copy)' : undefined,
      messages: original.messages || [],
      collectionId: collectionId || null,
      bookId: original.bookId || null,
      pageNumber: original.pageNumber || null,
      highlightText: original.highlightText || null,
    });
    if (copy.collectionId) {
      await Collection.findByIdAndUpdate(copy.collectionId, { $addToSet: { chatIds: copy._id } });
    }
    res.json({ ok: true, chat: copy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: reprocess book with vision
app.post('/api/books/:bookId/reprocess-vision', async (req, res) => {
  try {
    const Book = require('./models/Book');
    const Job = require('./models/Job');
    const { getAgenda } = require('./services/jobService');

    const book = await Book.findById(req.params.bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const job = await Job.create({ bookId: book._id, type: 'reprocess-vision', status: 'pending' });
    const agenda = getAgenda();
    await agenda.now('reprocess-vision', { bookId: book._id.toString() });

    res.json({ ok: true, jobId: job._id, message: 'Vision reprocessing started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: generate embeddings for a book
app.post('/api/books/:bookId/generate-embeddings', async (req, res) => {
  try {
    const { generateEmbeddingsForBook } = require('./services/embeddingService');
    const result = await generateEmbeddingsForBook(req.params.bookId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: generate chunks for a book
app.post('/api/books/:bookId/generate-chunks', async (req, res) => {
  try {
    const { generateChunksForBook } = require('./services/chunkService');
    const result = await generateChunksForBook(req.params.bookId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: generate spans for a book
app.post('/api/books/:bookId/generate-spans', async (req, res) => {
  try {
    const { generateSpansForBook } = require('./services/spanService');
    const result = await generateSpansForBook(req.params.bookId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: reprocess surface metadata
app.post('/api/books/:bookId/reprocess-metadata', async (req, res) => {
  try {
    const { extractBookMetadata } = require('./services/metadataService');
    const result = await extractBookMetadata(req.params.bookId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: reprocess regex annotations
app.post('/api/books/:bookId/reprocess-regex', async (req, res) => {
  try {
    const { annotateBook } = require('./services/regexService');
    const count = await annotateBook(req.params.bookId);
    res.json({ ok: true, pagesAnnotated: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: get chat messages (for split panel loading existing chats)
app.get('/chat/:chatId/api/messages', async (req, res) => {
  try {
    const Chat = require('./models/Chat');
    const chat = await Chat.findById(req.params.chatId).lean();
    if (!chat) return res.status(404).json({ error: 'Not found' });
    res.json({ messages: chat.messages, highlightText: chat.highlightText || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: create chat from input bar
app.post('/api/chat', async (req, res) => {
  try {
    const Chat = require('./models/Chat');
    const Collection = require('./models/Collection');
    const { message, context, contextId, bookId, bookTitle, pageNumber, highlightText } = req.body;
    const chatData = { messages: [{ role: 'user', content: message }] };
    if (context === 'collections' && contextId) {
      chatData.collectionId = contextId;
    }
    if (bookId) {
      chatData.bookId = bookId;
      if (pageNumber) chatData.pageNumber = pageNumber;
    }
    if (highlightText) chatData.highlightText = highlightText;
    const chat = await Chat.create(chatData);
    if (chatData.collectionId) {
      await Collection.findByIdAndUpdate(chatData.collectionId, { $addToSet: { chatIds: chat._id } });
    }
    res.json({ chatId: chat._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: send message to existing chat — streaming SSE response
app.post('/api/chat/:chatId/message', async (req, res) => {
  try {
    const Chat = require('./models/Chat');
    const { streamResponse } = require('./services/claudeService');
    const pipeline = require('./config/pipeline');
    const { message, generalKnowledge, useTools } = req.body;
    const chatId = req.params.chatId;

    // Atomic $push avoids the lost-update race where two
    // concurrent requests would each load, mutate, and save a
    // stale copy of chat.messages. findByIdAndUpdate runs
    // server-side so the user message is appended without
    // clobbering anything else.
    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { $push: { messages: { role: 'user', content: message, kind: 'text' } } },
      { new: true }
    );
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // Stream response via SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Phase A — tool-use is opt-in. Client can pass useTools:true
    // per message; the pipeline.AGENT_TOOLS_DEFAULT env toggle
    // flips the default. Plain-chat behavior is unchanged when
    // both are false.
    const toolsEnabled = useTools === true || (useTools !== false && pipeline.AGENT_TOOLS_DEFAULT);

    await streamResponse(
      chat.toObject(),
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      },
      async (fullText, meta = {}) => {
        // Persist tool turns first (if any) so they appear
        // before the final assistant message in chat.messages,
        // matching the order Claude saw them during the loop.
        // One atomic $push with $each keeps it to a single write.
        const toolTurns = meta.toolTurns || [];
        const payload = [
          ...toolTurns,
          { role: 'assistant', content: fullText, kind: 'text' },
        ];
        await Chat.findByIdAndUpdate(
          chatId,
          { $push: { messages: { $each: payload } } }
        );
        res.write(`data: ${JSON.stringify({ type: 'done', text: fullText, toolTurnsCount: toolTurns.length })}\n\n`);
        res.end();
      },
      {
        generalKnowledge: generalKnowledge === true,
        useTools: toolsEnabled,
        onToolCall: (name, input) => {
          res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: name, input })}\n\n`);
        },
        onToolResult: (name, result) => {
          const summary = result?.error
            ? { error: result.error }
            : {
                returned: result?.returned ?? result?.length ?? result?.total ?? null,
                found: result?.found,
              };
          res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: name, summary })}\n\n`);
        },
      }
    );
  } catch (err) {
    console.error('Chat message error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

// API: trigger AI response for existing chat (no new user message)
app.post('/api/chat/:chatId/respond', async (req, res) => {
  try {
    const Chat = require('./models/Chat');
    const { streamResponse } = require('./services/claudeService');
    const pipeline = require('./config/pipeline');
    const generalKnowledge = req.body && req.body.generalKnowledge === true;
    const useTools = req.body && req.body.useTools;
    const chatId = req.params.chatId;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const toolsEnabled = useTools === true || (useTools !== false && pipeline.AGENT_TOOLS_DEFAULT);

    await streamResponse(
      chat.toObject(),
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      },
      async (fullText, meta = {}) => {
        // Atomic $push for the same race-safety reason as
        // /message. Tool turns (if any) go before the final
        // assistant text in a single write.
        const toolTurns = meta.toolTurns || [];
        const payload = [
          ...toolTurns,
          { role: 'assistant', content: fullText, kind: 'text' },
        ];
        await Chat.findByIdAndUpdate(
          chatId,
          { $push: { messages: { $each: payload } } }
        );
        res.write(`data: ${JSON.stringify({ type: 'done', text: fullText, toolTurnsCount: toolTurns.length })}\n\n`);
        res.end();
      },
      {
        generalKnowledge,
        useTools: toolsEnabled,
        onToolCall: (name, input) => {
          res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: name, input })}\n\n`);
        },
        onToolResult: (name, result) => {
          const summary = result?.error
            ? { error: result.error }
            : {
                returned: result?.returned ?? result?.length ?? result?.total ?? null,
                found: result?.found,
              };
          res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: name, summary })}\n\n`);
        },
      }
    );
  } catch (err) {
    console.error('Respond error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

// Root → collections
app.get('/', (req, res) => {
  res.redirect('/files');
});

async function start() {
  try {
    await connectDatabase();
    await initAgenda();
    app.listen(PORT, () => {
      console.log(`${process.env.SITE_NAME} running on port ${PORT}`);
      console.log('[startup] CHAT_MODEL:', require('./config/pipeline').CHAT_MODEL);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
