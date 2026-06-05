const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { register, login, me } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: 'Too many requests, please try again later' },
});

router.post(
  '/register',
  authLimiter,
  [
    body('role').isIn(['client', 'owner']),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('phone').trim().notEmpty(),
    body('password').isLength({ min: 6 }),
    body('telegram').optional().trim(),
  ],
  register
);

router.post(
  '/login',
  authLimiter,
  [body('phone').trim().notEmpty(), body('password').notEmpty()],
  login
);

router.get('/me', verifyToken, me);

module.exports = router;
