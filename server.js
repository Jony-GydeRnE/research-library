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
  res.render('chat', { title: chat.title || 'Chat', page: 'chats', chat, ...sidebar });
});

// API: create chat from input bar
app.post('/api/chat', async (req, res) => {
  try {
    const Chat = require('./models/Chat');
    const { message, context, contextId } = req.body;
    const chatData = { messages: [{ role: 'user', content: message }] };
    if (context === 'collections' && contextId) {
      chatData.collectionId = contextId;
    }
    const chat = await Chat.create(chatData);
    // Add to collection's chatIds if applicable
    if (chatData.collectionId) {
      const Collection = require('./models/Collection');
      await Collection.findByIdAndUpdate(chatData.collectionId, { $addToSet: { chatIds: chat._id } });
    }
    res.json({ chatId: chat._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
