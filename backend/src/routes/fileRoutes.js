const express = require('express');
const files = require('../controllers/fileController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(authenticate);

router.get('/usage', files.usageSummary);
router.get('/trash', files.listTrash);
router.post('/upload', upload.single('file'), files.upload);
router.post('/presign-upload', files.presignUpload);
router.post('/complete-upload', files.completeUpload);
router.get('/', files.list);
router.get('/:id', files.getOne);
router.get('/:id/download', files.download);
router.patch('/:id/rename', files.rename);
router.patch('/:id/move', files.move);
router.delete('/:id', files.trash);
router.post('/:id/restore', files.restore);
router.delete('/:id/permanent', files.permanentlyDelete);

module.exports = router;
