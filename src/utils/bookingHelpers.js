const Booking = require('../models/Booking');

const ALL_SESSIONS = ['morning', 'afternoon', 'evening'];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function getBookedSessionsForDate(venueId, date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const bookings = await Booking.find({
    venue: venueId,
    date: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ['pending', 'confirmed'] },
  });
  const booked = new Set();
  bookings.forEach((b) => b.sessions.forEach((s) => booked.add(s)));
  return booked;
}

async function validateSessionsAvailable(venueId, date, sessions) {
  const booked = await getBookedSessionsForDate(venueId, date);
  for (const session of sessions) {
    if (booked.has(session)) {
      return { ok: false, message: `Session ${session} is already booked` };
    }
  }
  if (booked.size + sessions.length > 3) {
    return { ok: false, message: 'Not enough sessions available on this date' };
  }
  return { ok: true };
}

module.exports = {
  ALL_SESSIONS,
  startOfDay,
  endOfDay,
  getBookedSessionsForDate,
  validateSessionsAvailable,
};
