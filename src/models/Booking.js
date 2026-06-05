const mongoose = require('mongoose');

const SESSIONS = ['morning', 'afternoon', 'evening'];

const bookingSchema = new mongoose.Schema(
  {
    venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    clientName: { type: String, required: true, trim: true },
    clientPhone: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    sessions: {
      type: [String],
      enum: SESSIONS,
      required: true,
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one session is required',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
    },
    isExternalBooking: { type: Boolean, default: false },
  },
  { timestamps: true }
);

bookingSchema.index({ venue: 1, date: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.SESSIONS = SESSIONS;
