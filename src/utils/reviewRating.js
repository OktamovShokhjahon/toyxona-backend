const Review = require('../models/Review');
const Venue = require('../models/Venue');

async function updateVenueRating(venueId) {
  const reviews = await Review.find({ venue: venueId });
  if (reviews.length === 0) {
    await Venue.findByIdAndUpdate(venueId, { rating: 0 });
    return 0;
  }
  const avg =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const rounded = Math.round(avg * 10) / 10;
  await Venue.findByIdAndUpdate(venueId, { rating: rounded });
  return rounded;
}

module.exports = { updateVenueRating };
