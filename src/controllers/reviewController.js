const { validationResult } = require('express-validator');
const Review = require('../models/Review');
const Venue = require('../models/Venue');
const { updateVenueRating } = require('../utils/reviewRating');

async function getVenueReviews(req, res, next) {
  try {
    const reviews = await Review.find({ venue: req.params.venueId })
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

async function createReview(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }
    const venue = await Venue.findById(req.body.venueId);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    const review = await Review.create({
      venue: req.body.venueId,
      author: req.user?.userId,
      authorName: req.body.authorName || (req.user ? 'User' : 'Guest'),
      rating: req.body.rating,
      comment: req.body.comment,
    });
    await updateVenueRating(req.body.venueId);
    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

module.exports = { getVenueReviews, createReview };
