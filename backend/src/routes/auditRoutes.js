const express = require('express');
const audit = require('../controllers/auditController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', audit.list);
router.get('/mine', audit.myActivity);

module.exports = router;
