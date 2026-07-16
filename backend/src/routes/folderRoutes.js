const express = require('express');
const folders = require('../controllers/folderController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/contents', folders.contents);
router.post('/', folders.create);
router.patch('/:id/rename', folders.rename);
router.delete('/:id', folders.remove);

module.exports = router;
