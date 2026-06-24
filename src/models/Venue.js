const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    address: { type: String, required: true },
    location: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    mapLink: { type: String, trim: true },
    region: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    images: { type: [String], default: [] },
    pricePerSession: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 1 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalBookings: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

venueSchema.index({ region: 1, status: 1, rating: -1 });
venueSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Venue', venueSchema);
