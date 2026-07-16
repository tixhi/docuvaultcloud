const express = require('express');
const users = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(authenticate);

// --- Self-service profile ---------------------------------------------
router.patch('/me', users.updateMyProfile);
router.post('/me/password', users.changeMyPassword);
router.get('/me/usage', users.myUsage);

// --- Admin only ----------------------------------------------------------
router.get('/', requireRole('admin', 'manager'), users.listUsers);
router.patch('/:id/role', requireRole('admin'), users.changeUserRole);
router.patch('/:id/active', requireRole('admin'), users.setUserActive);

module.exports = router;
