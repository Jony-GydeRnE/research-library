const express = require('express');
const router = express.Router();
const readerController = require('../controllers/readerController');

router.get('/:bookId', readerController.showReader);
router.get('/:bookId/page/:pageNumber', readerController.showReader);
router.get('/:bookId/api/page/:pageNumber', readerController.getPage);

module.exports = router;
