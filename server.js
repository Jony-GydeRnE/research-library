require('dotenv').config();

const express = require('express');
const path = require('path');
const { connectDatabase } = require('./config/database');
const { initAgenda } = require('./services/jobService');

const uploadRoutes = require('./routes/upload');
const libraryRoutes = require('./routes/library');
const readerRoutes = require('./routes/reader');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'uploads', 'images')));

// Routes
app.use('/upload', uploadRoutes);
app.use('/library', libraryRoutes);
app.use('/reader', readerRoutes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/library');
});

// Start server
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
