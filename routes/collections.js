const express = require('express');
const router = express.Router();
const c = require('../controllers/collectionsController');

router.get('/', c.listCollections);
router.get('/:id', c.showCollection);
router.post('/api', c.createCollection);
router.put('/api/:id', c.updateCollection);
router.post('/api/:id/books', c.addBookToCollection);

module.exports = router;
