const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/libraryController');

router.get('/', libraryController.showLibrary);
router.get('/status', libraryController.getBookStatus);

module.exports = router;
