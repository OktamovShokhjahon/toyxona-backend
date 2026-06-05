const express = require('express');
const { body } = require('express-validator');
const { getVenueReviews, createReview } = require('../controllers/reviewController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/venue/:venueId', getVenueReviews);

router.post(
  '/',
  optionalAuth,
  [
    body('venueId').notEmpty(),
    body('authorName').optional().trim(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').trim().notEmpty(),
  ],
  createReview
);

module.exports = router;
