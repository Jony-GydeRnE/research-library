const crypto = require('crypto');
const multer = require('multer');
const Book = require('../models/Book');
const Job = require('../models/Job');
const { uploadPdf } = require('../services/s3Service');
const { getAgenda } = require('../services/jobService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

exports.multerUpload = upload.single('pdf');

exports.showUploadForm = (req, res) => {
  res.render('upload', { title: 'Upload' });
};

exports.handleUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const buffer = req.file.buffer;
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Deduplication check
    const existing = await Book.findOne({ fileHash });
    if (existing) {
      return res.status(409).json({
        error: 'This PDF has already been uploaded',
        bookId: existing._id,
        title: existing.title || req.file.originalname,
      });
    }

    // Generate S3 key
    const timestamp = Date.now();
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const s3Key = `pdfs/${timestamp}_${safeName}`;

    // Store PDF
    await uploadPdf(buffer, s3Key);

    // Create Book document
    const book = new Book({
      title: req.file.originalname.replace('.pdf', ''),
      s3Key,
      fileHash,
      status: 'uploading',
      processingProgress: 0,
    });
    await book.save();

    // Create Job document
    const job = new Job({
      bookId: book._id,
      type: 'extract-pdf',
      status: 'pending',
    });
    await job.save();

    // Enqueue background extraction
    const agenda = getAgenda();
    await agenda.now('extract-pdf', { bookId: book._id.toString() });

    book.status = 'processing';
    await book.save();

    res.status(201).json({
      bookId: book._id,
      title: book.title,
      status: 'processing',
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
};

// SSE endpoint for real-time processing progress
exports.streamProgress = async (req, res) => {
  const { bookId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const interval = setInterval(async () => {
    try {
      const book = await Book.findById(bookId).lean();
      if (!book) {
        res.write(`data: ${JSON.stringify({ error: 'Book not found' })}\n\n`);
        clearInterval(interval);
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify({
        status: book.status,
        progress: book.processingProgress,
        title: book.title,
        pageCount: book.pageCount,
      })}\n\n`);

      if (book.status === 'ready' || book.status === 'error') {
        clearInterval(interval);
        res.end();
      }
    } catch (err) {
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
};
