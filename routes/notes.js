const express = require('express');
const router = express.Router();
const c = require('../controllers/notesController');

router.post('/', c.saveNote);
router.get('/book/:bookId', c.getNotesForBook);
router.get('/:id', c.getNote);
router.put('/:id', c.updateNote);
router.delete('/:id', c.deleteNote);

module.exports = router;
