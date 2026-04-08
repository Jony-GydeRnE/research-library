const express = require('express');
const router = express.Router();
const c = require('../controllers/highlightsController');

router.post('/', c.saveHighlight);
router.get('/chat/:id', c.getHighlightChat);  // must be before /:bookId/:pageNumber
router.get('/:bookId/:pageNumber', c.getHighlights);
router.delete('/:id', c.deleteHighlight);

module.exports = router;
