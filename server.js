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
    const { message } = req.body;

    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // Add user message
    chat.messages.push({ role: 'user', content: message });
    await chat.save();

    // Stream response via SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    await streamResponse(
      chat.toObject(),
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      },
      async (fullText) => {
        // Save assistant message
        chat.messages.push({ role: 'assistant', content: fullText });
        await chat.save();
        res.write(`data: ${JSON.stringify({ type: 'done', text: fullText })}\n\n`);
        res.end();
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

    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    await streamResponse(
      chat.toObject(),
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      },
      async (fullText) => {
        chat.messages.push({ role: 'assistant', content: fullText });
        await chat.save();
        res.write(`data: ${JSON.stringify({ type: 'done', text: fullText })}\n\n`);
        res.end();
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
  res.redirect('/collections');
});

async function start() {
  try {
    await connectDatabase();
    await initAgenda();
    app.listen(PORT, () => {
      console.log(`${process.env.SITE_NAME} running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
