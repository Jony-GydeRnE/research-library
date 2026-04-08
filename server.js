require('dotenv').config();

const express = require('express');
const path = require('path');
const { connectDatabase } = require('./config/database');
const { initAgenda } = require('./services/jobService');

const uploadRoutes = require('./routes/upload');
const libraryRoutes = require('./routes/library');
const readerRoutes = require('./routes/reader');
const collectionsRoutes = require('./routes/collections');

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
  const chat = await Chat.findById(req.params.chatId).lean();
  if (!chat) return res.redirect('/chats');
  const sidebar = await getSidebarData();
  res.render('chat', { title: chat.title || 'Chat', page: 'chats', chat, hideInputBar: true, ...sidebar });
});

// API: create chat from input bar
app.post('/api/chat', async (req, res) => {
  try {
    const Chat = require('./models/Chat');
    const Collection = require('./models/Collection');
    const { message, context, contextId, bookId, bookTitle, pageNumber } = req.body;
    const chatData = { messages: [{ role: 'user', content: message }] };
    if (context === 'collections' && contextId) {
      chatData.collectionId = contextId;
    }
    if (context === 'reader' && bookId) {
      chatData.bookId = bookId;
      if (pageNumber) chatData.pageNumber = pageNumber;
    }
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
