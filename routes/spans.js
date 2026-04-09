const express = require('express');
const router = express.Router();
const c = require('../controllers/spansController');

router.get('/intersecting', c.getIntersectingSpans);

module.exports = router;
