const express = require('express');
const shares = require('../controllers/shareController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Public link resolution needs no auth -- must be registered before the
// authenticate middleware below.
router.get('/public/:token', shares.resolvePublicLink);

router.use(authenticate);
router.post('/', shares.createShare);
router.get('/with-me', shares.sharedWithMe);
router.get('/by-me', shares.sharedByMe);
router.patch('/:id/permission', shares.updatePermission);
router.delete('/:id', shares.revoke);

module.exports = router;
