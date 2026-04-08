const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

router.get('/', uploadController.showUploadForm);
router.post('/', uploadController.multerUpload, uploadController.handleUpload);
router.get('/progress/:bookId', uploadController.streamProgress);

module.exports = router;
