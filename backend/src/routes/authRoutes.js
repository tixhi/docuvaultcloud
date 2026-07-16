const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Throttle auth endpoints harder than the rest of the API to slow down
// credential-stuffing / brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

router.post('/register', authLimiter, auth.register);
router.post('/login', authLimiter, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', authenticate, auth.logout);
router.get('/me', authenticate, auth.me);

module.exports = router;
