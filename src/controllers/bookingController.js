const { validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const User = require('../models/User');
const { buildExcel, buildPdf } = require('../services/exportService');
const { getOwnerStats, getClientBookings } = require('../services/statsService');
const {
  ALL_SESSIONS,
  startOfDay,
  validateSessionsAvailable,
} = require('../utils/bookingHelpers');

async function createBooking(req, res, next) {
  try {
    let { venueId, clientName, clientPhone, date, sessions, isExternalBooking } = req.body;

    if (!req.user && (!clientName?.trim() || !clientPhone?.trim())) {
      return res.status(400).json({ message: 'Ism va telefon talab qilinadi' });
    }

    if (req.user && (!clientName || !clientPhone)) {
      const user = await User.findById(req.user.userId);
      if (user) {
        clientName = clientName || `${user.firstName} ${user.lastName}`;
        clientPhone = clientPhone || user.phone;
      }
    }

    const venue = await Venue.findById(venueId);
    if (!venue || venue.status !== 'approved' || !venue.isEnabled) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    const bookingDate = startOfDay(date);
    const sessionList = Array.isArray(sessions) ? sessions : [sessions];
    const validation = await validateSessionsAvailable(venueId, bookingDate, sessionList);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }
    const booking = await Booking.create({
      venue: venueId,
      clientName,
      clientPhone,
      date: bookingDate,
      sessions: sessionList,
      isExternalBooking: !!isExternalBooking,
      status: isExternalBooking ? 'confirmed' : 'pending',
    });
    if (booking.status === 'confirmed') {
      await Venue.findByIdAndUpdate(venueId, { $inc: { totalBookings: 1 } });
    }
    const populated = await Booking.findById(booking._id).populate('venue', 'name');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}

async function getVenueBookings(req, res, next) {
  try {
    const venue = await Venue.findById(req.params.venueId);
    if (!venue) return res.status(404).json({ message: 'Venue not found' });
    if (req.user.role !== 'admin' && venue.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const bookings = await Booking.find({ venue: req.params.venueId })
      .populate('venue', 'name region')
      .sort({ date: -1 });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

async function getCalendar(req, res, next) {
  try {
    const { venueId } = req.params;
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'month query required (YYYY-MM)' });
    }
    const [year, mon] = month.split('-').map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 0, 23, 59, 59, 999);
    const bookings = await Booking.find({
      venue: venueId,
      date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed'] },
    });
    const calendar = {};
    const daysInMonth = new Date(year, mon, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendar[key] = { booked: [], available: [...ALL_SESSIONS], status: 'available' };
    }
    bookings.forEach((b) => {
      const d = new Date(b.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!calendar[key]) return;
      b.sessions.forEach((s) => {
        if (!calendar[key].booked.includes(s)) calendar[key].booked.push(s);
      });
    });
    Object.keys(calendar).forEach((key) => {
      const day = calendar[key];
      day.available = ALL_SESSIONS.filter((s) => !day.booked.includes(s));
      if (day.booked.length === 3) day.status = 'full';
      else if (day.booked.length > 0) day.status = 'partial';
      else day.status = 'available';
    });
    res.json({ month, calendar });
  } catch (err) {
    next(err);
  }
}

async function ownerDashboard(req, res, next) {
  try {
    const stats = await getOwnerStats(req.user.userId, {
      month: req.query.month,
      venueId: req.query.venueId,
    });
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

async function ownerDashboardExport(req, res, next) {
  try {
    const format = req.query.format || 'xlsx';
    const stats = await getOwnerStats(req.user.userId, {
      month: req.query.month,
      venueId: req.query.venueId,
    });
    const data = {
      title: 'Egasi statistikasi',
      summaryRows: [
        ['Bu oy bronlar', stats.totalBookingsThisMonth],
        ['Daromad', stats.revenueEstimate],
        ['Faol to\'yxonalar', stats.activeVenues],
        ['Kutilayotgan bronlar', stats.pendingBookings],
      ],
      bookings: stats.recentBookings.map((b) => ({
        ...b.toObject?.() || b,
        venueName: b.venue?.name,
      })),
      venues: stats.perVenue,
    };
    if (format === 'pdf') {
      const buf = await buildPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=owner-stats.pdf');
      return res.send(buf);
    }
    const buf = await buildExcel(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=owner-stats.xlsx');
    res.send(buf);
  } catch (err) {
    next(err);
  }
}

async function getMyBookings(req, res, next) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const bookings = await getClientBookings(user.phone);
    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

async function updateBookingStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const booking = await Booking.findById(req.params.id).populate('venue');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const venue = await Venue.findById(booking.venue._id || booking.venue);
    if (req.user.role !== 'admin' && venue.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const wasConfirmed = booking.status === 'confirmed';
    booking.status = status;
    await booking.save();
    if (status === 'confirmed' && !wasConfirmed) {
      await Venue.findByIdAndUpdate(venue._id, { $inc: { totalBookings: 1 } });
    }
    res.json(booking);
  } catch (err) {
    next(err);
  }
}

async function getAllBookings(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const bookings = await Booking.find(filter)
      .populate('venue', 'name region')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBooking,
  getVenueBookings,
  getCalendar,
  ownerDashboard,
  ownerDashboardExport,
  getMyBookings,
  updateBookingStatus,
  getAllBookings,
};
