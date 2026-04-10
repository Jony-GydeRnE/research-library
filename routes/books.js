const express = require('express');
const router = express.Router();
const c = require('../controllers/booksController');

router.post('/:id/cover', c.coverUpload, c.setCover);
router.post('/:id/copy', c.copyToCollection);
router.post('/:id/move', c.moveToCollection);
router.get('/:id/stats', c.getBookStats);
router.delete('/:id', c.deleteBook);

module.exports = router;
