const express = require('express');
const router = express.Router();
const c = require('../controllers/highlightsController');

router.post('/', c.saveHighlight);
router.post('/link-chat', c.linkChat);
router.get('/detail/:id', c.getHighlightDetail);
router.get('/chat/:id', c.getHighlightChats);
router.get('/:bookId/:pageNumber', c.getHighlights);
router.put('/:id', c.updateHighlight);
router.delete('/:id', c.deleteHighlight);

module.exports = router;
